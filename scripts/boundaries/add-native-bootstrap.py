#!/usr/bin/env python3
"""Bundle an additional year from the already audited, exact native assets."""
import gzip, hashlib, json, sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]
folder = root / 'public/data/native'
year = int(sys.argv[1])
def read(path):
    return json.loads(gzip.decompress(path.read_bytes()))
def save(name, value):
    raw = json.dumps(value, ensure_ascii=False, separators=(',', ':'), sort_keys=True).encode()
    compressed = gzip.compress(raw, compresslevel=9, mtime=0)
    (folder / name).write_bytes(compressed)
    return dict(file=name, bytes=len(raw), gzipBytes=len(compressed), sha256=hashlib.sha256(raw).hexdigest(), gzipSha256=hashlib.sha256(compressed).hexdigest())
def vertices(v):
    return 1 if isinstance(v[0], (int, float)) else sum(vertices(p) for p in v)
catalog = read(root / 'public/data/fast/catalog.json.gz')
index = read(folder / 'index.json.gz')
manifest = json.loads((folder / 'manifest.json').read_text())
records = [r for r in catalog['records'] if r['type'] == 'POLITY' and r['start'] <= year <= r['end']]
assert records and year != 0
mapping = {r['id']: index['recordIndex'][r['id']] for r in records}
geometries = {}
for gid in sorted(set(mapping.values())):
    geometries[gid] = read(folder / index['geometryIndex'][gid])[gid]
name = f'year-{year}.json.gz'
package = dict(year=year, recordIndex=mapping, geometries=geometries)
meta = save(name, package)
assert read(folder / name) == package
meta.update(records=len(records), geometries=len(geometries), vertices=sum(vertices(g['coordinates']) for g in geometries.values()))
manifest['bootstrap'][str(year)] = meta
index['bootstrap'][str(year)] = name
manifest['index'] = save('index.json.gz', index)
sizes = manifest['bytes']
sizes['indexGzip'] = manifest['index']['gzipBytes']
sizes['bootstrapGzip'] = sum(m['gzipBytes'] for m in manifest['bootstrap'].values())
sizes['allGzipAssets'] = sum(sizes[k] for k in ['geometryGzip', 'indexGzip', 'bootstrapGzip', 'auditGzip'])
(folder / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(meta))
