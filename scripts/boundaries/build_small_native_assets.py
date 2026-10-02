#!/usr/bin/env python3
"""Repack validated native geometry into one gzip file per geometry.

The source geometry, native IDs, record mapping and bootstrap packages remain
unchanged. All output assets are written below --output, never to the Site.
"""
from __future__ import annotations

import argparse
import datetime
import gzip
import hashlib
import json
import pathlib
import shutil


def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":"), allow_nan=False).encode("utf-8")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read(path):
    raw = path.read_bytes()
    return json.loads(gzip.decompress(raw) if raw[:2] == b"\x1f\x8b" else raw)


def write(path, value, relative_name):
    raw = encode(value)
    compressed = gzip.compress(raw, compresslevel=9, mtime=0)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(compressed)
    return {"file": relative_name, "bytes": len(raw), "gzipBytes": len(compressed),
            "sha256": sha(raw), "gzipSha256": sha(compressed)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=pathlib.Path, required=True)
    parser.add_argument("--catalog", type=pathlib.Path, required=True)
    parser.add_argument("--output", type=pathlib.Path,
                        default=pathlib.Path(__file__).resolve().parent / "assets-small")
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        raise ValueError("Input and output must be different directories")
    args.output.mkdir(parents=True, exist_ok=True)
    old_manifest_bytes = (args.input / "manifest.json").read_bytes()
    old_manifest = json.loads(old_manifest_bytes)
    old_index = read(args.input / old_manifest["index"]["file"])
    audit = read(args.input / old_manifest["geometryAudit"]["file"])
    catalog = read(args.catalog)
    if sha(args.catalog.read_bytes()) != old_manifest["source"]["catalogSha256"]:
        # Display labels may evolve, but record identities and chronology must
        # still be verified against the native index and source build.
        if set(r["id"] for r in catalog["records"]) != set(old_index["recordIndex"]):
            raise ValueError("Catalog record IDs differ from validated native index")

    geometry_index = {}
    shards = []
    native_hashes = {}
    checked = 0
    for old_shard in old_manifest["shards"]:
        path = args.input / old_shard["file"]
        raw = path.read_bytes()
        if sha(raw) != old_shard["gzipSha256"]:
            raise ValueError(f"Source native shard checksum mismatch: {path}")
        objects = json.loads(gzip.decompress(raw))
        for gid, geometry in objects.items():
            if gid in geometry_index:
                raise ValueError(f"Duplicate native geometry {gid}")
            numeric_id = int(gid[2:])
            relative = f"geos/{numeric_id // 1000:03d}/{gid}.json.gz"
            metadata = write(args.output / relative, {gid: geometry}, relative)
            metadata.update({"count": 1, "vertices": audit[gid]["vertices"]})
            shards.append(metadata)
            geometry_index[gid] = relative
            geometry_hash = sha(encode(geometry))
            if geometry_hash != audit[gid]["sha256"]:
                raise ValueError(f"Geometry differs from original-coordinate audit: {gid}")
            # Each written file is parsed again, not only checked in memory.
            persisted = read(args.output / relative)
            if set(persisted) != {gid} or persisted[gid] != geometry:
                raise ValueError(f"Coordinate/order mismatch after writing {gid}")
            native_hashes[gid] = geometry_hash
            checked += 1
        if checked % 1000 < len(objects):
            print(f"Wrote and verified {checked:,} geometry files", flush=True)
    if set(geometry_index) != set(old_index["geometryIndex"]):
        raise ValueError("New geometry index membership differs from old index")

    index = dict(old_index)
    index["geometryIndex"] = geometry_index
    index_metadata = write(args.output / "index.json.gz", index, "index.json.gz")
    if read(args.output / "index.json.gz")["recordIndex"] != old_index["recordIndex"]:
        raise AssertionError("Record mapping changed")

    copied = []
    for metadata in [old_manifest["geometryAudit"], *old_manifest["bootstrap"].values()]:
        relative = metadata["file"]
        data = (args.input / relative).read_bytes()
        if sha(data) != metadata["gzipSha256"]:
            raise ValueError(f"Bootstrap/audit checksum mismatch: {relative}")
        (args.output / relative).write_bytes(data)
        if (args.output / relative).read_bytes() != data:
            raise AssertionError(f"Bootstrap/audit copy differs: {relative}")
        copied.append(relative)

    old_file_sizes = {s["file"]: s["gzipBytes"] for s in old_manifest["shards"]}
    new_file_sizes = {s["file"]: s["gzipBytes"] for s in shards}

    def year_requests(year):
        records = [r for r in catalog["records"]
                   if r["type"] == "POLITY" and r["start"] <= year <= r["end"]]
        gids = sorted({old_index["recordIndex"][r["id"]] for r in records})
        old_files = sorted({old_index["geometryIndex"][gid] for gid in gids})
        new_files = sorted({geometry_index[gid] for gid in gids})
        old_bytes = sum(old_file_sizes[f] for f in old_files)
        new_bytes = sum(new_file_sizes[f] for f in new_files)
        return {
            "year": year, "activePolityRecords": len(records), "uniqueNativeGeometries": len(gids),
            "scope": "All active worldwide POLITY records, cold geometry cache; unreferenced geometries are not needed. Request counts exclude index/bootstrap and assume one HTTP request per gzip resource.",
            "largeShards": {"requests": len(old_files), "gzipBytes": old_bytes,
                            "withColdIndexBytes": old_bytes + old_manifest["index"]["gzipBytes"]},
            "smallGeometryFiles": {"requests": len(new_files), "gzipBytes": new_bytes,
                                   "withColdIndexBytes": new_bytes + index_metadata["gzipBytes"]},
            "geometryBytesSaved": old_bytes - new_bytes,
            "geometryBytesReductionPercent": round(100 * (old_bytes - new_bytes) / old_bytes, 3),
            "smallGeometryFileList": new_files,
            "largeShardFileList": old_files
        }

    years = [1666, 1493, 1801, 1968, 1492]
    comparisons = {str(y): year_requests(y) for y in years}
    geometry_bytes = sum(s["gzipBytes"] for s in shards)
    geometry_uncompressed = sum(s["bytes"] for s in shards)
    bootstrap_bytes = sum(s["gzipBytes"] for s in old_manifest["bootstrap"].values())
    runtime_count = len(shards) + len(old_manifest["bootstrap"]) + 1
    manifest = dict(old_manifest)
    manifest.update({
        "title": "Cliopatria native-coordinate geometry assets — one geometry per gzip file",
        "builtUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "packing": {"mode": "one-native-geometry-per-file", "directoryPattern": "geos/{floor(native numeric id / 1000):03d}/{nativeGeometryId}.json.gz",
                    "inputNativeManifestSha256": sha(old_manifest_bytes),
                    "bootstrapByteIdentical": True, "nativeIdsUnchanged": True,
                    "recordMappingUnchanged": True, "sourceGeometryContentUnchanged": True},
        "shardSizeTarget": {"mode": "one-exact-native-geometry", "geometryIsAtomic": True,
                            "minimumGzipBytes": min(s["gzipBytes"] for s in shards),
                            "maximumGzipBytes": max(s["gzipBytes"] for s in shards),
                            "exceptions": [], "note": "The previous 250–600KB grouping target does not apply to independent geometry files."},
        "shards": shards, "index": index_metadata,
        "bytes": {"geometryGzip": geometry_bytes, "geometryUncompressed": geometry_uncompressed,
                  "indexGzip": index_metadata["gzipBytes"], "bootstrapGzip": bootstrap_bytes,
                  "auditGzip": old_manifest["geometryAudit"]["gzipBytes"],
                  "allGzipAssets": geometry_bytes + index_metadata["gzipBytes"] + bootstrap_bytes + old_manifest["geometryAudit"]["gzipBytes"]},
        "fileCounts": {"geometryFiles": len(shards), "bootstrapFiles": len(old_manifest["bootstrap"]),
                       "indexFiles": 1, "auditFiles": 1, "manifestFiles": 1,
                       "runtimeFilesExcludingAuditAndManifest": runtime_count,
                       "totalAssetFiles": runtime_count + 2},
    })
    manifest["validation"] = dict(manifest["validation"],
                                  allIndividualGeometryFilesRoundTripVerified=True,
                                  allIndividualGeometryDigestsMatchNativeSource=True,
                                  independentFilesVerified=checked,
                                  bootstrapPackagesByteIdentical=True,
                                  recordToNativeIdMappingUnchanged=True)
    (args.output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")

    # Comparison reports stay next to, not inside, runtime assets.
    report = {
        "builtUtc": manifest["builtUtc"], "fileCounts": manifest["fileCounts"],
        "bytes": manifest["bytes"],
        "largeShardGeometryGzipBytes": old_manifest["bytes"]["geometryGzip"],
        "smallGeometryGzipOverheadBytes": geometry_bytes - old_manifest["bytes"]["geometryGzip"],
        "smallGeometryGzipOverheadPercent": round(100 * (geometry_bytes / old_manifest["bytes"]["geometryGzip"] - 1), 3),
        "default1492Bootstrap": {"requests": 1, "gzipBytes": old_manifest["bootstrap"]["1492"]["gzipBytes"], "unchanged": True, "indexRequired": False},
        "years": comparisons,
        "estimatedSiteFiles": {"existingApproximate": 1600, "terrainTilesApproximate": 341,
                               "plusNativeAssetFiles": manifest["fileCounts"]["totalAssetFiles"],
                               "sumEstimate": 1600 + 341 + manifest["fileCounts"]["totalAssetFiles"],
                               "platformLimit": "Root must confirm actual hosting file-count limit and exact bundle inventory."},
        "performanceInterpretation": "This minimizes uncached geometry payload bytes, not necessarily latency. Many small requests have per-request overhead; prioritize visible/selected polities, share cache between comparison maps, and use bounded concurrency. Boot packages are still preferable for the eleven common years."
    }
    report_path = args.output.parent / "small-shard-comparison.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"fileCounts": report["fileCounts"], "bytes": report["bytes"],
                      "smallGeometryGzipOverheadPercent": report["smallGeometryGzipOverheadPercent"],
                      "default1492Bootstrap": report["default1492Bootstrap"],
                      "year1666": {k: v for k, v in comparisons["1666"].items() if not k.endswith("FileList")},
                      "estimatedSiteFiles": report["estimatedSiteFiles"]}, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    main()
