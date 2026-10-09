"""Local asset facts only: no hosted bytes, browser timing, or inferred speedups."""
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path('/Users/zane/meridian_atlas/world-history-atlas')
OUT = Path(__file__).resolve().parent
PUBLIC = ROOT / 'public'

def load(rel):
    return json.loads(gzip.decompress((PUBLIC / rel).read_bytes()))

def stat(rel):
    raw = (PUBLIC / rel).read_bytes()
    decoded = gzip.decompress(raw) if raw[:2] == b'\x1f\x8b' else raw
    return {'path': rel, 'fileBytes': len(raw), 'decodedBytes': len(decoded), 'sha256': hashlib.sha256(raw).hexdigest()}

def vertices(coords):
    if coords and isinstance(coords[0], (int, float)):
        return 1
    return sum(vertices(c) for c in coords)

catalog = load('data/fast/catalog.json.gz')
records = [r for r in catalog['records'] if r['type'] == 'POLITY' and r['start'] <= 1492 <= r['end']]
pack = load('data/native/year-1492.json.gz')
temporal = json.loads((PUBLIC / 'native-temporal-index.js').read_text().split('=', 1)[1].strip().rstrip(';'))
start, end, file = next(s for s in temporal if s[0] <= 1492 <= s[1])
slot = {'start': start, 'end': end, 'url': 'data/native/'+file}
files = ['data/fast/catalog.json.gz', 'data/events.json.gz', 'data/native/year-1492.json.gz',
         'data/fast/year-1492.json.gz', 'data/land.geojson', 'data/land-50m.json.gz',
         'data/physical/physical-overview.json.gz', 'data/physical/modern-ocean-mask-overview.json.gz',
         'data/physical-spatial/index.json.gz', 'data/lakes/index.json.gz', slot['url']]
assets = [stat(f) for f in files]
grid = load('data/physical-spatial/index.json.gz')
lakes = load('data/lakes/index.json.gz')
intersects = lambda a, b: a[0] <= b[2] and a[2] >= b[0] and a[1] <= b[3] and a[3] >= b[1]
examples = []
for name, box in [('Northeast Africa and the Red Sea', [20, 5, 45, 30]), ('Europe excluding a HALC-specific focus', [0, 40, 25, 60]), ('Mainland and maritime Southeast Asia', [100, -5, 125, 20])]:
    dx, dy = (box[2] - box[0]) * .2, (box[3] - box[1]) * .2
    bounds = [box[0]-dx, box[1]-dy, box[2]+dx, box[3]+dy]
    cells = [c for c in grid['cells'] if intersects(c['bbox'], bounds)]
    tiers = []
    for tier in [4, 6, 9]:
        shards = [s for s in lakes['shards'] if s['minZoom'] <= tier and intersects(s['bbox'], bounds)]
        tiers.append({'tier': tier, 'shards': len(shards), 'gzipFileBytes': sum((PUBLIC / 'data/lakes' / s['file']).stat().st_size for s in shards), 'archivedVerticesBeforeFeatureViewportFilter': sum(s['vertices'] for s in shards)})
    examples.append({'name': name, 'illustrativeBoundsNotBrowserViewport': box, 'paddedBounds': bounds, 'gridCells': len(cells), 'gridGzipFileBytes': sum((PUBLIC / 'data/physical-spatial' / c['file']).stat().st_size for c in cells), 'gridFeaturesBeforeSetData': sum(sum(c['features'].values()) for c in cells), 'lakesByTier': tiers})
report = {'scope': 'Read-only local file and selection arithmetic. Illustrative rectangles are NOT captured browser viewports; no timing or hosted transfer claim.',
          'headAtAuditStart': 'a5cc8779de597ffd1838aecdc1097218f505c72f', 'year': 1492,
          'catalogRecords': len(catalog['records']), 'activePolities': len(records), 'nativeGeometries': len(pack['geometries']),
          'nativeRecordMappings': len(pack['recordIndex']), 'activeNativeComplete': all(str(r['id']) in pack['recordIndex'] for r in records),
          'nativeUniqueGeometryVertices': sum(vertices(g['coordinates']) for g in pack['geometries'].values()),
          'nativeDisplayedVerticesIncludingAliases': sum(vertices(pack['geometries'][pack['recordIndex'][str(r['id'])]]['coordinates']) for r in records),
          'temporalFallback1492': slot, 'assets': assets, 'illustrativeSpatialSelections': examples}
(OUT / 'static-inventory.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({k: v for k, v in report.items() if k not in ['assets', 'illustrativeSpatialSelections']}, ensure_ascii=False))
