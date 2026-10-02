#!/usr/bin/env python3
"""Build exact-coordinate Cliopatria display assets, without mutating the Site.

Only Python's JSON parser/serializer and gzip transform the representation.
There is NO geometric simplification, coordinate rounding, interpolation,
repair, ring reordering or component removal. Parsed numeric values survive
exactly; whitespace, key order and numeric lexical spelling may change.

The record ID follows the existing catalog's source feature order. Never use
the old, simplified geometry ID to identify an original geometry: distinct
original geometries can collapse to the same simplified shape.
"""
from __future__ import annotations

import argparse
import collections
import datetime
import gzip
import hashlib
import json
import pathlib
import zipfile
import zlib

BOOT_YEARS = [-3400, -221, 1, 500, 1000, 1492, 1750, 1914, 1945, 1991, 2024]
MIN_SHARD = 250_000
MAX_SHARD = 600_000


def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":"), allow_nan=False).encode("utf-8")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def file_digest(path):
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def coordinate_count(value):
    if not value:
        return 0
    if isinstance(value[0], (int, float)):
        return 1
    return sum(coordinate_count(child) for child in value)


def vertex_count(geometry):
    if geometry["type"] == "GeometryCollection":
        return sum(vertex_count(g) for g in geometry["geometries"])
    return coordinate_count(geometry["coordinates"])


def geometry_shape_counts(geometry):
    kind = geometry["type"]
    if kind == "Polygon":
        return 1, len(geometry["coordinates"])
    if kind == "MultiPolygon":
        return len(geometry["coordinates"]), sum(map(len, geometry["coordinates"]))
    raise ValueError(f"Unexpected source geometry: {kind}")


def read_json(path):
    data = path.read_bytes()
    if data[:2] == b"\x1f\x8b":
        data = gzip.decompress(data)
    return json.loads(data)


def write_gzip(path, value):
    payload = encode(value)
    compressed = gzip.compress(payload, compresslevel=9, mtime=0)
    path.write_bytes(compressed)
    return {"file": path.name, "bytes": len(payload), "gzipBytes": len(compressed),
            "sha256": digest(payload), "gzipSha256": digest(compressed)}


def pack_groups(entries):
    """Group intact geometries using actual gzip-stream sizes, not raw sizes."""
    groups = []
    current = []
    compressor = zlib.compressobj(level=9, wbits=31)
    emitted = compressor.compress(b"{")
    for gid, serialized in entries:
        fragment = (b"," if current else b"") + encode(gid) + b":" + serialized
        candidate = compressor.copy()
        extra = candidate.compress(fragment)
        final_size = len(emitted) + len(extra) + len(candidate.compress(b"}")) + len(candidate.flush())
        if current and final_size > MAX_SHARD:
            groups.append(current)
            current = []
            compressor = zlib.compressobj(level=9, wbits=31)
            emitted = compressor.compress(b"{")
            fragment = encode(gid) + b":" + serialized
        current.append((gid, serialized))
        emitted += compressor.compress(fragment)
    if current:
        groups.append(current)

    def size(items):
        payload = b"{" + b",".join(encode(gid) + b":" + value for gid, value in items) + b"}"
        return len(gzip.compress(payload, compresslevel=9, mtime=0))

    # Balance the final shard where possible, without splitting a geometry.
    if len(groups) > 1 and size(groups[-1]) < MIN_SHARD:
        joined = groups[-2] + groups[-1]
        if size(joined) <= MAX_SHARD:
            groups[-2:] = [joined]
        else:
            while len(groups[-2]) > 1 and size(groups[-1]) < MIN_SHARD:
                proposed_left = groups[-2][:-1]
                proposed_right = groups[-2][-1:] + groups[-1]
                if size(proposed_left) < MIN_SHARD or size(proposed_right) > MAX_SHARD:
                    break
                groups[-2] = proposed_left
                groups[-1] = proposed_right
    return groups


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=pathlib.Path, required=True)
    parser.add_argument("--source-metadata", type=pathlib.Path, required=True)
    parser.add_argument("--source-archive", type=pathlib.Path, required=True)
    parser.add_argument("--catalog", type=pathlib.Path, required=True)
    parser.add_argument("--display-data", type=pathlib.Path, required=True,
                        help="Existing dist/data directory containing 0.02-degree geometry shards")
    parser.add_argument("--output", type=pathlib.Path,
                        default=pathlib.Path(__file__).resolve().parent / "assets")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    # Do not silently leave obsolete generated files in a rebuilt directory.
    for pattern in ["native-*.json.gz", "year-*.json.gz", "index.json.gz", "geometry-audit.json.gz", "manifest.json"]:
        for previous in args.output.glob(pattern):
            previous.unlink()

    source_meta = read_json(args.source_metadata)
    source_hash = file_digest(args.source)
    archive_hash = file_digest(args.source_archive)
    if archive_hash != source_meta["sha256"]:
        raise ValueError("Pinned source archive hash does not match source metadata")
    source = read_json(args.source)
    with zipfile.ZipFile(args.source_archive) as archive:
        members = [name for name in archive.namelist() if name.endswith(".geojson") and not name.startswith("__MACOSX/")]
        if len(members) != 1:
            raise ValueError(f"Expected one GeoJSON archive member, got {members}")
        archive_member = members[0]
        member_hash = hashlib.sha256()
        with archive.open(archive_member) as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                member_hash.update(chunk)
        source_bytes_match_archive = source_hash == member_hash.hexdigest()
        if not source_bytes_match_archive:
            # The existing build stores a compact serialization of the source.
            # Accept formatting differences only after whole-object equality.
            with archive.open(archive_member) as stream:
                archive_object = json.load(stream)
            if archive_object != source:
                raise ValueError("Source values differ from pinned archive member")
            del archive_object

    catalog = read_json(args.catalog)
    source_features = source["features"]
    records = catalog["records"]
    if len(source_features) != len(records):
        raise ValueError("Feature count and existing catalog record count differ")

    native_geometries = {}
    native_bytes = {}
    hash_to_gid = {}
    geometry_audit = {}
    record_index = {}
    old_to_new = collections.defaultdict(set)
    native_to_records = collections.defaultdict(list)
    source_vertices = 0
    source_polygons = 0
    source_rings = 0
    source_invalid = []
    try:
        from shapely.geometry import shape
    except ImportError:
        shape = None

    for i, (feature, record) in enumerate(zip(source_features, records)):
        rid = f"clio-{i:05d}"
        properties = feature["properties"]
        expected = {"id": rid, "name": properties["Name"], "start": properties["FromYear"],
                    "end": properties["ToYear"], "type": properties["Type"]}
        if any(record.get(key) != value for key, value in expected.items()):
            raise ValueError(f"Catalog no longer matches source feature order/properties: {rid}")
        geometry = feature["geometry"]
        serialized = encode(geometry)
        key = digest(serialized)
        count = vertex_count(geometry)
        polygons, rings = geometry_shape_counts(geometry)
        source_vertices += count
        source_polygons += polygons
        source_rings += rings
        if key not in hash_to_gid:
            gid = f"ng{len(hash_to_gid):05d}"
            hash_to_gid[key] = gid
            native_geometries[gid] = geometry
            native_bytes[gid] = serialized
            geometry_audit[gid] = {"sha256": key, "vertices": count, "polygons": polygons,
                                   "rings": rings, "type": geometry["type"]}
            if shape is not None:
                geometry_audit[gid]["valid"] = bool(shape(geometry).is_valid)
        else:
            gid = hash_to_gid[key]
            # Hashing is an index; exact content comparison decides equality.
            if native_bytes[gid] != serialized or native_geometries[gid] != geometry:
                raise ValueError("Unexpected geometry hash collision")
        if geometry_audit[gid].get("valid") is False:
            source_invalid.append(rid)
        record_index[rid] = gid
        old_to_new[record["geometryId"]].add(gid)
        native_to_records[gid].append(rid)
        if (i + 1) % 3000 == 0:
            print(f"Indexed {i + 1} source records", flush=True)

    print(f"Packing {len(native_geometries)} original geometries", flush=True)
    groups = pack_groups(native_bytes.items())
    geometry_index = {}
    shards = []
    for i, group in enumerate(groups):
        name = f"native-{i:03d}.json.gz"
        objects = {gid: native_geometries[gid] for gid, _ in group}
        metadata = write_gzip(args.output / name, objects)
        metadata.update({"count": len(objects), "vertices": sum(geometry_audit[gid]["vertices"] for gid in objects)})
        metadata["outsideTargetRange"] = not MIN_SHARD <= metadata["gzipBytes"] <= MAX_SHARD
        shards.append(metadata)
        for gid in objects:
            geometry_index[gid] = name
        print(f"{name}: {metadata['gzipBytes']:,} bytes, {len(objects)} geometries", flush=True)

    # Load old display geometries to quantify what detail this version restores.
    old_geometries = {}
    for shard in catalog["metadata"]["shards"]:
        old_geometries.update(read_json(args.display_data / shard["gzipFile"]))
    old_record_vertices = sum(vertex_count(old_geometries[r["geometryId"]]) for r in records)
    old_unique_vertices = sum(vertex_count(g) for g in old_geometries.values())

    bootstrap = {}
    boot_index = {}
    for year in BOOT_YEARS:
        active = [r for r in records if r["type"] == "POLITY" and r["start"] <= year <= r["end"]]
        mapping = {r["id"]: record_index[r["id"]] for r in active}
        ids = sorted(set(mapping.values()))
        name = f"year-{year}.json.gz"
        package = {"year": year, "recordIndex": mapping,
                   "geometries": {gid: native_geometries[gid] for gid in ids}}
        metadata = write_gzip(args.output / name, package)
        metadata.update({"records": len(active), "geometries": len(ids),
                         "vertices": sum(geometry_audit[gid]["vertices"] for gid in ids)})
        bootstrap[str(year)] = metadata
        boot_index[str(year)] = name

    index = {"version": 1, "recordIndex": record_index, "geometryIndex": geometry_index,
             "bootstrap": boot_index, "manifest": "manifest.json",
             "identity": "record ID to exact original geometry; existing geometry IDs are unchanged"}
    index_meta = write_gzip(args.output / "index.json.gz", index)
    audit_meta = write_gzip(args.output / "geometry-audit.json.gz", geometry_audit)

    # Independent output round trip: every record's saved geometry must equal
    # the source geometry, including every coordinate, ring and component.
    saved = {}
    for shard in shards:
        decoded = read_json(args.output / shard["file"])
        for gid, geometry in decoded.items():
            if encode(geometry) != native_bytes[gid]:
                raise AssertionError(f"Shard coordinate/order mismatch for {gid}")
        saved.update(decoded)
    for i, feature in enumerate(source_features):
        rid = f"clio-{i:05d}"
        if saved[record_index[rid]] != feature["geometry"]:
            raise AssertionError(f"Source coordinate/order mismatch for {rid}")
    saved_index = read_json(args.output / "index.json.gz")
    if saved_index != index:
        raise AssertionError("Saved index mismatch")
    for year in BOOT_YEARS:
        package = read_json(args.output / boot_index[str(year)])
        expected_records = {r["id"] for r in records if r["type"] == "POLITY" and r["start"] <= year <= r["end"]}
        if set(package["recordIndex"]) != expected_records or package["year"] != year:
            raise AssertionError(f"Bootstrap membership mismatch for {year}")
        for rid, gid in package["recordIndex"].items():
            if record_index[rid] != gid or package["geometries"][gid] != saved[gid]:
                raise AssertionError(f"Bootstrap geometry mismatch for {year}, {rid}")
        if set(package["geometries"]) != set(package["recordIndex"].values()):
            raise AssertionError(f"Unexpected bootstrap geometries for {year}")

    collisions = {old: sorted(new) for old, new in old_to_new.items() if len(new) > 1}
    collision_records = {old: [r["id"] for r in records if r["geometryId"] == old] for old in collisions}
    unique_native_vertices = sum(a["vertices"] for a in geometry_audit.values())
    manifest = {
        "version": 1,
        "title": "Cliopatria native-coordinate geometry assets",
        "builtUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source": {"project": "Seshat Global History Databank / Cliopatria", **source_meta,
                   "archiveSha256Verified": True, "archiveMember": archive_member,
                   "archiveMemberSha256": member_hash.hexdigest(),
                   "geojsonSha256": source_hash, "geojsonBytes": args.source.stat().st_size,
                   "archiveMemberBytesMatchInput": source_bytes_match_archive,
                   "archiveMemberJSONExactlyEqualsInput": True,
                   "catalogSha256": file_digest(args.catalog),
                   "catalogRecordIdentityVerified": True},
        "license": "CC BY 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
        "attribution": "Historical territories: Cliopatria / Seshat Global History Databank (CC BY 4.0).",
        "processing": {
            "simplification": False, "coordinateQuantization": False, "coordinateRounding": False,
            "repairs": False, "interpolation": False, "ringReordering": False,
            "droppedComponents": False, "droppedRecords": False,
            "numericSemantics": "JSON parsed as binary64 numbers and serialized with round-trip-safe Python JSON; all parsed numeric values preserved exactly. Numeric lexical spelling/whitespace may differ from source.",
            "deduplication": "SHA-256 of canonical complete geometry JSON followed by exact byte and object equality checks; ordered rings and components retained",
            "recordIdentity": "clio-{source feature array index:05d}, verified against existing id/name/start/end/type",
            "sourceGeometryValidity": "retained unchanged; invalid source geometries are not repaired"
        },
        "counts": {
            "sourceRecords": len(records), "nativeRecords": len(record_index),
            "polityRecords": sum(r["type"] == "POLITY" for r in records),
            "relationRecords": sum(r["type"] == "RELATION" for r in records),
            "sourceVerticesAcrossRecords": source_vertices,
            "nativeVerticesAcrossRecords": sum(vertex_count(saved[record_index[r["id"]]]) for r in records),
            "sourcePolygonComponentsAcrossRecords": source_polygons,
            "sourceRingsAcrossRecords": source_rings,
            "nativeUniqueGeometries": len(native_geometries),
            "nativeVerticesAcrossUniqueGeometries": unique_native_vertices,
            "oldSimplifiedUniqueGeometries": len(old_geometries),
            "oldSimplifiedVerticesAcrossRecords": old_record_vertices,
            "oldSimplifiedVerticesAcrossUniqueGeometries": old_unique_vertices,
            "restoredVertexRatioAcrossRecords": source_vertices / old_record_vertices,
            "oldGeometryIdsWithMultipleNativeShapes": len(collisions),
            "sourceInvalidGeometryRecords": len(source_invalid) if shape is not None else None,
            "sourceInvalidUniqueGeometries": sum(a.get("valid") is False for a in geometry_audit.values()) if shape is not None else None
        },
        "validation": {
            "allRecordGeometriesEqualSourceAfterDiskRoundTrip": True,
            "allCoordinateValuesPreserved": True, "allCoordinateOrdersPreserved": True,
            "allRecordIdsAndDatesRetained": True, "allBootstrapMembershipsAndGeometriesVerified": True,
            "existingCatalogOrGeometryIdsModified": False,
            "newInvalidGeometries": 0 if shape is not None else None,
            "validityChecker": "Shapely" if shape is not None else "Not installed; exact equality checked only",
            "existingSourceInvalidRecordIds": source_invalid if shape is not None else None
        },
        "shardSizeTarget": {"minGzipBytes": MIN_SHARD, "maxGzipBytes": MAX_SHARD,
                            "geometryIsAtomic": True, "exceptions": [s["file"] for s in shards if s["outsideTargetRange"]]},
        "shards": shards, "index": index_meta, "geometryAudit": audit_meta,
        "bootstrap": bootstrap,
        "simplifiedIdCollisions": {old: {"nativeGeometryIds": new, "recordIds": collision_records[old]} for old, new in collisions.items()},
        "bytes": {"geometryGzip": sum(s["gzipBytes"] for s in shards),
                  "geometryUncompressed": sum(s["bytes"] for s in shards),
                  "indexGzip": index_meta["gzipBytes"],
                  "bootstrapGzip": sum(b["gzipBytes"] for b in bootstrap.values()),
                  "auditGzip": audit_meta["gzipBytes"],
                  "allGzipAssets": sum(p.stat().st_size for p in args.output.glob("*.json.gz"))},
        "limits": "Native coordinates preserve source geometry fidelity; they do not establish greater historical accuracy, reconstruct unknown dates, or reconcile historical coastlines with a modern basemap."
    }
    manifest_path = args.output / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"counts": manifest["counts"], "bytes": manifest["bytes"],
                      "bootstrap": {y: v["gzipBytes"] for y, v in bootstrap.items()},
                      "shardExceptions": manifest["shardSizeTarget"]["exceptions"],
                      "validation": manifest["validation"]}, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    main()
