"""Download only locked public sources and stop if an upstream file changed."""
import hashlib
import json
import urllib.request
import zipfile
from pathlib import Path
from physical_paths import workspace

root = workspace()
lock = json.loads((Path(__file__).parent/'source-lock.json').read_text())
for item in lock['sources']:
    dst = root/item['file']
    if not dst.exists():
        request = urllib.request.Request(item['url'], headers={'User-Agent':'MeridianAtlasPhysicalBuild/1.0'})
        with urllib.request.urlopen(request, timeout=120) as response:
            data = response.read()
        assert hashlib.sha256(data).hexdigest() == item['sha256'], 'Upstream changed: '+item['file']
        temporary = dst.with_suffix(dst.suffix+'.tmp')
        temporary.write_bytes(data)
        temporary.replace(dst)
    assert hashlib.sha256(dst.read_bytes()).hexdigest() == item['sha256'], 'Local source differs: '+str(dst)
    if item.get('extract'):
        target = root/'source-relief'
        target.mkdir(exist_ok=True)
        with zipfile.ZipFile(dst) as archive:
            for name in item['extract']:
                assert Path(name).name == name  # never trust an archive path
                (target/name).write_bytes(archive.read(name))
    print('Verified', item['file'])
