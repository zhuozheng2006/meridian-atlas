#!/usr/bin/env python3
"""Verify HALC v15/1500 release assets; Python standard library only.

The reviewed inventory binds the prior full MVT geometry/source-attribute audit
to exact asset bytes. This check does not decode MVT or rerun geometric checks.
After rebuilding source assets, regenerate and review the full audit/inventory.
"""
import argparse
import collections
import gzip
import hashlib
import json
import math
from pathlib import Path, PurePosixPath
import sys


def require(condition, message):
    if not condition:
        raise ValueError(message)


def object_without_duplicates(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def read_json(raw):
    return json.loads(raw, object_pairs_hook=object_without_duplicates)


def sha256(raw):
    return hashlib.sha256(raw).hexdigest()


def canonical(raw):
    return json.dumps(raw, ensure_ascii=False, sort_keys=True,
                      separators=(',', ':')).encode()


def safe_path(root, relative):
    name = PurePosixPath(relative)
    require(not name.is_absolute() and '..' not in name.parts,
            f"Unsafe asset path: {relative}")
    path = root.joinpath(*name.parts)
    require(path.resolve().is_relative_to(root.resolve()),
            f"Asset escapes data directory: {relative}")
    return path


def verify(args):
    data = args.data_dir.resolve()
    inventory = read_json(args.integrity.read_bytes())
    expected = inventory['expected']
    deep = inventory['deepVerification']
    require(inventory['schemaVersion'] == 1, 'Unknown integrity schema')
    require(inventory['datasetId'] == 'halc-v15-1500' and
            inventory['snapshotYear'] == 1500, 'Wrong source snapshot')
    entries = {entry['path']: entry for entry in inventory['files']}
    require(len(entries) == len(inventory['files']), 'Duplicate inventory path')
    actual = {p.relative_to(data).as_posix() for p in data.rglob('*') if p.is_file()}
    extras = actual - set(entries)
    require(set(entries) <= actual, f"Missing assets: {sorted(set(entries)-actual)}")
    require(extras <= set(args.allow_extra), f"Unreviewed extra assets: {sorted(extras)}")
    for name, entry in entries.items():
        raw = safe_path(data, name).read_bytes()
        require(len(raw) == entry['bytes'], f"Wrong byte count: {name}")
        require(sha256(raw) == entry['sha256'], f"SHA256 mismatch: {name}")
    require(len(entries) == expected['assetFileCount'] == deep['fileCount'],
            'Asset count differs from prior complete audit')
    require(sum(e['bytes'] for e in entries.values()) == expected['assetBytes'],
            'Asset byte total differs from reviewed inventory')

    # Formal release prose may change after the source-data audit. Only this
    # explicitly recorded NOTICE change is accepted; every data asset stays bound
    # to its reviewed exact SHA256, and the original deep report stays untouched.
    changes = inventory['provenance'].get('postAuditTextChanges', [])
    require(len(changes) <= 1 and all(c['path'] == 'NOTICE.txt' for c in changes),
            'Post-audit changes may only contain the formal NOTICE text')
    byte_delta = 0
    for change in changes:
        current = entries[change['path']]
        require(current['sha256'] == change['afterSha256'] and
                current['bytes'] == change['afterBytes'], 'NOTICE change provenance mismatch')
        byte_delta += change['afterBytes'] - change['beforeBytes']
    require(expected['assetBytes'] - byte_delta == deep['totalPublishedBytes'],
            'Data byte total differs from the prior complete audit')

    manifest_raw = (data/'manifest.json').read_bytes()
    manifest = read_json(manifest_raw)
    require(sha256(manifest_raw) == inventory['provenance']['manifestSha256'],
            'Manifest differs from reviewed original manifest')
    for key in ['datasetId', 'sourceVersion', 'snapshotYear']:
        require(manifest[key] == inventory[key], f"Manifest {key} mismatch")
    require(manifest['sourceSha1'] == inventory['provenance']['sourceGeometrySha1'],
            'Original geometry source hash differs')
    require(manifest['sourceDoi'] == '10.34894/BTKFHV' and
            manifest['license'] == 'CC BY-SA 4.0', 'Source or license changed')
    require(manifest['sourceLayer'] == 'halc_localities' and manifest['extent'] == 8192
            and manifest['minzoom'] == 6 and manifest['maxzoom'] == 10,
            'Tile source contract changed')
    transform = manifest['transformation']
    require(not transform['smoothing'] and not transform['geographicInterpolation']
            and not transform['adm1Union'] and transform['originalGeometryUnmodified'],
            'Original locality geometry preservation contract changed')

    tiles = {name: entry for name, entry in entries.items() if name.startswith('tiles/')}
    expected_tiles = set()
    west, south, east, north = manifest['bounds']
    for z in range(manifest['minzoom'], manifest['maxzoom']+1):
        count = 2**z
        tile_x = lambda lon: math.floor((lon+180)/360*count)
        tile_y = lambda lat: math.floor((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*count)
        limits = {'x': [tile_x(west), tile_x(east)],
                  'y': [tile_y(north), tile_y(south)]}
        require(manifest['tileRanges'][str(z)] == limits,
                f"Tile bounds mismatch at z{z}")
        for x in range(limits['x'][0], limits['x'][1]+1):
            for y in range(limits['y'][0], limits['y'][1]+1):
                expected_tiles.add(f'tiles/{z}/{x}/{y}.pbf')
    require(set(tiles) == expected_tiles, 'Incomplete rectangular tile coverage')
    require(len(tiles) == manifest['tileCount'] == expected['tileCount'] == deep['tileCount'],
            'Tile count mismatch')
    require(sum(e['bytes'] for e in tiles.values()) == manifest['tileBytes'], 'Tile bytes mismatch')
    require(sum(e['tileFeatures'] == 0 for e in tiles.values()) ==
            expected['emptyTileCount'] == manifest['emptyTileCount'] == deep['emptyTiles'],
            'Empty tile count differs from audited bytes')
    require(sum(e['tileFeatures'] for e in tiles.values()) ==
            expected['decodedFeatureInstances'] == deep['decodedFeatureInstances'],
            'Feature instances differ from audited bytes')

    records = {}
    shards = manifest['details']['shards']
    require(len(shards) == expected['detailShardCount'], 'Detail shard count mismatch')
    require(manifest['details']['shardSize'] == 256 and
            manifest['details']['originalAttributesComplete'] and
            not manifest['details']['geometryIncluded'], 'Detail schema changed')
    detail_files = {name for name in entries if name.startswith('details/')}
    require({s['path'] for s in shards} == detail_files, 'Detail file inventory differs')
    for shard in shards:
        name = shard['path']
        raw = safe_path(data, name).read_bytes()
        require(sha256(raw) == shard['sha256'] and len(raw) == shard['bytes'],
                f"Detail differs from source manifest: {name}")
        payload = read_json(gzip.decompress(raw))
        require(payload['dataset'] == manifest['datasetId'], f"Wrong detail dataset: {name}")
        part = payload['records']
        require(len(part) == shard['count'] == entries[name]['detailRecords'],
                f"Wrong detail record count: {name}")
        for fid, record in part.items():
            require(fid == str(record['fid']) and int(fid)//256 == shard['shard'],
                    f"Unstable fid/shard identity: {fid}")
            require(fid not in records, f"Duplicate fid: {fid}")
            require(set(record) == set(expected['detailFields']), f"Attributes missing for {fid}")
            require(record['TIME_START'] == '1500-01-01' and
                    record['TIME_END'] == '1500-12-31', f"Wrong snapshot dates for {fid}")
            records[fid] = record
    require(len(records) == manifest['recordCount'] == expected['recordCount'] ==
            deep['detailRecordCount'] == 14863, 'Locality record count mismatch')
    require(sha256(canonical(records)) == expected['allDetailAttributesCanonicalSha256'],
            'Original attribute content changed')
    for key in ['TYPE', 'QUALITY', 'ADM0', 'ADM1']:
        counts = dict(collections.Counter(str(r[key]) for r in records.values()))
        require(counts == expected['counts'][key], f"Original {key} values changed")
        if key in ['TYPE', 'QUALITY']:
            require(counts == manifest[key.lower()+'Counts'], f"Manifest {key} count mismatch")
    require(sum(';' in r['ADM1'] for r in records.values()) == expected['sharedAdm1RecordCount'],
            'Shared/contested memberships changed')
    require(sum('XX' in r['ADM1'].split(';') for r in records.values()) ==
            expected['xxMembershipRecordCount'], 'Small sovereign region membership changed')

    metadata = {key: read_json(safe_path(data, name).read_bytes())
                for key, name in manifest['metadata'].items()}
    for key, count in expected['metadataCounts'].items():
        require(len(metadata[key]) == count, f"Codebook {key} count mismatch")
    legend = metadata['legends']
    require(legend['specialADM1']['XX']['isSingleState'] is False,
            'XX must not become a single state')
    require(legend['sharedMembership']['separator'] == ';' and
            legend['sharedMembership']['preserveOrder'], 'Shared membership order must be preserved')
    for record in records.values():
        require(str(record['TYPE']) in legend['TYPE'] and str(record['QUALITY']) in legend['QUALITY'],
                'Unexplained TYPE/QUALITY code')
        require(all(code in legend['ADM0'] for code in record['ADM0'].split(';')) and
                all(code in metadata['regions'] for code in record['ADM1'].split(';')),
                'Unexplained administrative code')
    tilejson = read_json((data/'tilejson.json').read_bytes())
    layer = tilejson['vector_layers'][0]
    require(layer['id'] == manifest['sourceLayer'] and tilejson['bounds'] == manifest['bounds'],
            'TileJSON source contract differs')
    require(set(layer['fields']) == {'fid','NAME','SHORT_ID','ADM0','ADM1','TYPE','QUALITY'},
            'Map attribute contract changed; NAME_EXT must remain in detailed source attributes')
    for key in ['detailsEqualAllOriginalAttributes', 'completeRectangularCoverage',
                'decodedBoundsStayWithinBuffer', 'sourcePropertiesMatchEveryTileFeature',
                'codebookDictionariesMatchIndependentExtraction']:
        require(deep[key] is True, f"Prior deep audit did not pass: {key}")
    require(deep['decodedInvalidGeometries'] == 0 and
            all(deep['uniqueFidsByZoom'][str(z)] == 14863 for z in range(7,11)),
            'Prior deep audit does not establish complete valid detailed tiles')
    require(max(e['bytes'] for e in entries.values()) < 25*1024*1024,
            'HALC single-file budget exceeded')
    result = {'passed': True, 'datasetId': manifest['datasetId'], 'snapshotYear': 1500,
              'hashVerifiedAssetFiles': len(entries), 'assetBytes': expected['assetBytes'],
              'tiles': len(tiles), 'emptyTiles': expected['emptyTileCount'],
              'detailShards': len(shards), 'records': len(records),
              'sharedAdm1Records': expected['sharedAdm1RecordCount'],
              'xxMembershipRecords': expected['xxMembershipRecordCount'],
              'allowedExtraFiles': sorted(extras),
              'postAuditTextChanges': changes,
              'mvtAudit': 'Reused prior complete geometry/attribute audit after exact SHA256 matching; no MVT decoding in this run.',
              'zoom6MissingFids': deep['zoom6MissingFids'],
              'sourceTimeMeaning': 'Source reconstruction for 1500, not exact historical locality lifetimes.'}
    if args.public_dir:
        require(args.public_dir.is_dir(), 'Public directory does not exist')
        files = [p for p in args.public_dir.rglob('*') if p.is_file()]
        result['publicBudget'] = {'files': len(files), 'bytes': sum(p.stat().st_size for p in files),
                                  'maxFiles': args.max_public_files}
        if args.max_public_files is not None:
            require(len(files) <= args.max_public_files, 'Configured public file budget exceeded')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir', type=Path, required=True, help='Copied HALC publish directory')
    parser.add_argument('--integrity', type=Path, default=Path(__file__).resolve().parent/'data-integrity/halc-1500.integrity.json')
    parser.add_argument('--allow-extra', action='append', default=[], help='Explicit additional relative asset path, e.g. labels.json; not covered by the source-data audit')
    parser.add_argument('--public-dir', type=Path, help='Optionally inventory the whole public directory')
    parser.add_argument('--max-public-files', type=int, help='Enforce an externally verified hosting limit')
    parser.add_argument('--report', type=Path, help='Optional JSON result outside the checked asset directory')
    args = parser.parse_args()
    try:
        require(args.max_public_files is None or args.public_dir is not None,
                '--max-public-files requires --public-dir')
        if args.report and args.public_dir:
            require(not args.report.resolve().is_relative_to(args.public_dir.resolve()),
                    'Write the audit report outside public so it cannot change the checked file budget')
        result = verify(args)
        if args.report:
            require(not args.report.resolve().is_relative_to(args.data_dir.resolve()),
                    'Write the audit report outside the checked asset directory')
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (ValueError, KeyError, OSError, TypeError) as error:
        print(f'HALC integrity check failed: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
