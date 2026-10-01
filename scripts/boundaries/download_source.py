"""Download the pinned public dataset and verify it before extracting."""
from pathlib import Path
import json, hashlib, urllib.request, zipfile
root=Path(__file__).resolve().parent
source=json.loads((root/'source.json').read_text())
archive=root/'cliopatria.geojson.zip'
if not archive.exists():
    urllib.request.urlretrieve(source['downloadUrl'],archive)
actual=hashlib.sha256(archive.read_bytes()).hexdigest()
if actual!=source['sha256']:
    raise SystemExit('Source SHA-256 mismatch; refusing to extract. Remove the incorrect archive and retry the pinned URL.')
with zipfile.ZipFile(archive) as z:
    member='cliopatria_polities_only.geojson'
    (root/'cliopatria.geojson').write_bytes(z.read(member))
print('Verified source downloaded and extracted.')
