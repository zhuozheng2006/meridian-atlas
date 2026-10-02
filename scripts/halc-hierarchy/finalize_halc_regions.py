#!/usr/bin/env python3
"""Add the bundled data notice and an external full asset checksum inventory."""
import argparse,hashlib,json
from pathlib import Path
from halc_geometry import compact,check

def descriptor(path):
    raw=path.read_bytes()
    return {'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}

def finalize_assets(directory,integrity):
    check(not integrity.resolve().is_relative_to(directory.resolve()),'Inventory must remain outside assets')
    notice=Path(__file__).with_name('NOTICE.txt').read_bytes()
    (directory/'NOTICE.txt').write_bytes(notice)
    manifest=json.loads((directory/'manifest.json').read_bytes())
    manifest['zooms']=[{k:v for k,v in row.items() if k!='elapsedSeconds'} for row in manifest['zooms']]
    manifest['notice']={'path':'NOTICE.txt',**descriptor(directory/'NOTICE.txt')}
    (directory/'manifest.json').write_bytes(compact(manifest))
    files={p.relative_to(directory).as_posix():descriptor(p) for p in sorted(directory.rglob('*')) if p.is_file()}
    result={'schemaVersion':1,'datasetId':manifest['datasetId'],'snapshotYear':1500,
      'sourceSha1':manifest['sourceSha1'],'sourceSha256':manifest['sourceSha256'],
      'fileCount':len(files),'totalBytes':sum(v['bytes'] for v in files.values()),'files':files}
    integrity.parent.mkdir(parents=True,exist_ok=True);integrity.write_bytes(compact(result))
    return result

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--data-dir',type=Path,required=True)
    p.add_argument('--integrity',type=Path,required=True);a=p.parse_args()
    r=finalize_assets(a.data_dir,a.integrity)
    print(json.dumps({k:v for k,v in r.items() if k!='files'},indent=2))
