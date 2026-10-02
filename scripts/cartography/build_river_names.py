"""Apply reviewed exact-ID bilingual names without modifying any geometry."""
import gzip
import json
from pathlib import Path
from physical_paths import workspace

root = workspace()
mapping_bytes = (Path(__file__).parent/'data/river-names-zh-en.json').read_bytes()
mapping = json.loads(mapping_bytes)
data = json.loads(gzip.decompress((root/'publish/rivers-10m.json.gz').read_bytes()))
rows = {fid:row for row in mapping['rivers'] for fid in row['featureIds']}
matched = set()
for feature in data['features']:
    fid = feature['properties']['id']
    if fid in rows:
        row = rows[fid]
        feature['properties'].update(zh=row['nameZh'], label_en=row['nameEn'], name_source=row['sourceUrl'])
        matched.add(fid)
assert matched == set(rows), 'Source identifiers changed; review the mapping before release.'
raw = json.dumps(data, ensure_ascii=False, separators=(',',':')).encode()
(root/'rivers-10m-named.json.gz').write_bytes(gzip.compress(raw, compresslevel=9, mtime=0))
(root/'river-names-zh-en.json').write_bytes(mapping_bytes)
print('Applied', len(mapping['rivers']), 'river names to', len(matched), 'segments')
