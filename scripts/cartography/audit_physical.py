"""Read-only validation of a physical asset release; writes one explicit report."""
import argparse
import collections
import gzip
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--physical-dir', type=Path, required=True)
parser.add_argument('--mode', choices=['geometry', 'tiles', 'all'], default='all')
parser.add_argument('--raw-dir', type=Path)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
root = args.physical_dir.resolve()
inventory = {str(p.relative_to(root)): {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(root.rglob('*')) if p.is_file()}
report = {'root': str(root), 'mode': args.mode, 'file_count': len(inventory), 'total_bytes': sum(x['bytes'] for x in inventory.values()), 'inventory': inventory, 'geometry': {}, 'tiles': {}, 'errors': []}

if args.mode in ['geometry', 'all']:
    from shapely.geometry import shape
    from shapely.validation import explain_validity
    from opencc import OpenCC
    cc = OpenCC('t2s')
    data = {}
    for path in sorted(root.glob('*.json.gz')):
        raw = gzip.decompress(path.read_bytes())  # also verifies gzip CRC
        d = json.loads(raw)
        assert d['type'] == 'FeatureCollection', path
        data[path.name] = d
        invalid = []
        empty = []
        chinese = []
        bounds = []
        vertices = 0
        def count(coords):
            if not coords:
                return 0
            if isinstance(coords[0], (int, float)):
                return 1
            return sum(count(c) for c in coords)
        for f in d['features']:
            g = shape(f['geometry'])
            if not g.is_valid:
                invalid.append({'id': f.get('id', f['properties'].get('id')), 'reason': explain_validity(g)})
            if g.is_empty:
                empty.append({'id': f.get('id', f['properties'].get('id')), 'name':f['properties'].get('name'), 'source_preserved':True})
            zh = f['properties'].get('zh', '')
            if cc.convert(zh) != zh:
                chinese.append(zh)
            bounds.append(g.bounds)
            vertices += count(f['geometry']['coordinates'])
            if 'ocean-mask' in path.name:
                for p in ([g] if g.geom_type == 'Polygon' else g.geoms):
                    assert p.exterior.is_ccw and all(not r.is_ccw for r in p.interiors), path
                    for ring in [p.exterior, *p.interiors]:
                        xy = list(ring.coords)
                        assert all(-180 <= x <= 180 and -85.051128779807 <= y <= 85.051128779807 for x, y in xy)
                        assert all(abs(b[0]-a[0]) <= 60.000000001 for a, b in zip(xy, xy[1:]))
        report['geometry'][path.name] = {'gzip_crc_valid': True, 'json_bytes': len(raw), 'features': len(d['features']), 'nonempty_features':len(d['features'])-len(empty), 'vertices': vertices, 'invalid_geometries': invalid, 'empty_geometries':empty, 'non_simplified_chinese': chinese, 'kind_counts': dict(collections.Counter(f['properties'].get('kind') for f in d['features'])), 'artificial_features': sum(bool(f['properties'].get('artificial')) for f in d['features'])}
        if invalid or chinese:
            report['errors'].append(path.name)
    river_names = json.loads((root/'river-names-zh-en.json').read_text())
    byid = {f['properties']['id']: f for f in data['rivers-10m.json.gz']['features']}
    matched = 0
    for row in river_names['rivers']:
        for fid in row['featureIds']:
            f = byid[fid]
            assert f['properties']['zh'] == row['nameZh']
            assert f['properties']['label_en'] == row['nameEn']
            assert f['properties']['name_source'] == row['sourceUrl']
            matched += 1
    report['river_names'] = {'groups': len(river_names['rivers']), 'matched_features': matched, 'all_labels_match_reviewed_mapping': True}
    if args.raw_dir:
        original = json.loads((args.raw_dir/'ne_10m_rivers_lake_centerlines.geojson').read_text())
        published = data['rivers-10m.json.gz']
        assert len(original['features']) == len(published['features'])
        assert all(a['geometry'] == b['geometry'] for a, b in zip(original['features'], published['features']))
        report['river_names']['river_geometries_equal_original_source'] = True

if args.mode in ['tiles', 'all']:
    from PIL import Image, features
    import PIL
    actual = {str(p.relative_to(root)) for p in (root/'relief').rglob('*.webp')}
    expected = {f'relief/{z}/{x}/{y}.webp' for z in range(5) for x in range(2**z) for y in range(2**z)}
    assert actual == expected, {'missing': sorted(expected-actual), 'unexpected': sorted(actual-expected)}
    for rel in sorted(actual):
        with Image.open(root/rel) as im:
            im.load()
            assert im.size == (512, 512) and im.mode == 'RGBA', (rel, im.size, im.mode)
    report['tiles'] = {'count': len(actual), 'bytes': sum(inventory[p]['bytes'] for p in actual), 'all_decode': True, 'all_size_512': True, 'all_mode_rgba': True, 'complete_xyz_z0_to_4': True, 'Pillow': PIL.__version__, 'libwebp': features.version_module('webp')}

old_index = json.loads((root/'files.json').read_text()) if (root/'files.json').exists() else {}
report['old_inventory_differences'] = {'changed': [k for k,v in old_index.items() if inventory.get(k) != v], 'unindexed': sorted(set(inventory)-set(old_index)-{'files.json'}), 'missing': sorted(set(old_index)-set(inventory))}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='inventory'}, ensure_ascii=False, indent=2))
assert not report['errors'], report['errors']
