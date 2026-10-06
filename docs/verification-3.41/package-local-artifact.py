#!/usr/bin/env python3
"""Package the already-built dist tree. Does not build, deploy or change it."""
from pathlib import Path
import gzip,hashlib,json,os,re,sys,tarfile

ROOT=Path('/Users/zane/meridian_atlas/world-history-atlas')
DIST=ROOT/'dist'
WORK=Path('/Users/zane/Documents/Codex/2026-10-02/new-chat/work/release-341')
OUTPUT=WORK/'meridian-3.41-deploy.tar.gz'
REPORT=ROOT/'docs/verification-3.41/build-artifact.json'
STAMP='3.41.0-ded029edf830'

def excluded(path):
    return any(part.startswith('._') or part in {'.DS_Store','__MACOSX'} for part in path.relative_to(DIST).parts)

all_paths=sorted(DIST.rglob('*'),key=lambda p:p.relative_to(DIST).as_posix())
paths=[DIST]+[p for p in all_paths if not excluded(p)]
assert all(not p.is_symlink() and (p.is_file() or p.is_dir()) for p in paths)
verify_existing='--verify-existing' in sys.argv
assert verify_existing or not OUTPUT.exists(), 'Refusing to overwrite an existing release artifact'

class HashSink:
    def __init__(self): self.hash=hashlib.sha256(); self.bytes=0
    def write(self,data): self.hash.update(data); self.bytes+=len(data); return len(data)
    def flush(self): pass

def package(sink):
    with gzip.GzipFile(filename='',mode='wb',fileobj=sink,mtime=0,compresslevel=9) as gz:
        with tarfile.open(fileobj=gz,mode='w|',format=tarfile.USTAR_FORMAT) as archive:
            for path in paths:
                name='./' if path==DIST else './'+path.relative_to(DIST).as_posix()
                info=tarfile.TarInfo(name)
                info.uid=info.gid=0; info.uname=info.gname=''; info.mtime=0
                info.pax_headers={}; info.mode=0o755 if path.is_dir() else 0o644
                if path.is_dir():
                    info.type=tarfile.DIRTYPE; info.size=0; archive.addfile(info)
                else:
                    info.type=tarfile.REGTYPE; info.size=path.stat().st_size
                    with path.open('rb') as source: archive.addfile(info,source)

partial=OUTPUT if verify_existing else OUTPUT.with_suffix('.gz.partial')
if verify_existing:
    assert OUTPUT.is_file()
    print('Checking existing deterministic archive...',flush=True)
else:
    assert not partial.exists(), 'Partial archive already exists'
    print('Writing deterministic archive from current dist...',flush=True)
    with partial.open('wb') as output: package(output)
size=partial.stat().st_size
assert size<256*1024*1024, 'Archive exceeds 256 MiB'

def file_hash(path):
    digest=hashlib.sha256()
    with path.open('rb') as f:
        while True:
            block=f.read(1024*1024)
            if not block: break
            digest.update(block)
    return digest.hexdigest()

sha=file_hash(partial)
print('Archive written; checking every member against dist...',flush=True)
expected={'./'+p.relative_to(DIST).as_posix():p for p in paths if p!=DIST}
key_paths={
    './client/index.html',
    './server/index.js',
    './client/research-reading-library.js',
    './client/data/places/attested-places.json.gz',
    './client/data/research-evidence/cities-3.41/catalog.json',
    './client/halc-boundaries.js',
}
checks={}; entries=0; files=0; seen=set()
with tarfile.open(partial,mode='r|gz') as archive:
    for member in archive:
        entries+=1
        assert member.uid==member.gid==member.mtime==0
        assert member.uname==member.gname=='' and not member.pax_headers
        assert member.mode==(0o755 if member.isdir() else 0o644)
        assert not any(part.startswith('._') or part in {'.DS_Store','__MACOSX'} for part in Path(member.name).parts)
        if member.name in {'.','./'}: assert member.isdir(); continue
        assert member.name in expected and member.name not in seen
        seen.add(member.name); source=expected[member.name]
        if member.isdir(): assert source.is_dir(); continue
        assert member.isfile() and source.is_file(); files+=1
        data=archive.extractfile(member).read()
        digest=hashlib.sha256(data).hexdigest()
        assert len(data)==source.stat().st_size and digest==file_hash(source)
        if member.name in key_paths:
            item={'bytes':len(data),'sha256':digest}
            if member.name=='./client/index.html':
                stamps=set(re.findall(rb'\?v=([0-9.]+-[0-9a-f]+)',data))
                assert stamps=={STAMP.encode()}; item['finalStamp']=True
            elif member.name=='./server/index.js':
                marker='export default createAtlasWorker('
                assert data.decode().count(marker)==1
                tail=data.decode().split(marker)[1]
                decoder=json.JSONDecoder(); manifest,end=decoder.raw_decode(tail)
                assert tail[end]==','
                options,end2=decoder.raw_decode(tail[end+1:])
                assert tail[end+1+end2:].strip()==');' and options['importUntil']==0
                item['importClosed']=True; item['importUntil']=0
            elif member.name.endswith('research-reading-library.js'):
                assert b'export function mountReadingLibrary' in data and STAMP.encode() in data
                item['readingLibrary']=True
            elif member.name.endswith('attested-places.json.gz'):
                cities=json.loads(gzip.decompress(data))
                item['gzipVerified']=True; item['recordCount']=len(cities['records']); item['enhancementCount']=len(cities['enhancements'])
                assert item['recordCount']==14 and item['enhancementCount']==2
            elif member.name.endswith('halc-boundaries.js'):
                assert b'halc-independent-selected' in data and b'feature-state' in data and b"promoteId:{halc_localities:'fid'}" in data
                item['sharedSelectionBuckets']=True
            checks[member.name]=item
assert seen==set(expected) and set(checks)==key_paths
header=partial.open('rb').read(10)
assert header[:3]==b'\x1f\x8b\x08' and header[3]==0 and int.from_bytes(header[4:8],'little')==0
print('Recreating the gzip stream into a digest sink to verify reproducibility...',flush=True)
repeat=HashSink(); package(repeat)
assert repeat.bytes==size and repeat.hash.hexdigest()==sha
if not verify_existing: partial.rename(OUTPUT)
report={
    'file':str(OUTPUT),'bytes':size,'MiB':size/(1024*1024),'sha256':sha,
    'entries':entries,'within256MiB':True,'checks':checks,'uploaded':False,
    'deterministicMetadata':True,'deterministicControls':{
        'tarFormat':'USTAR','pathOrder':'sorted POSIX relative paths','uid':0,'gid':0,
        'uname':'','gname':'','mtime':0,'fileMode':'0644','directoryMode':'0755',
        'gzipMtime':0,'gzipFilename':'','gzipLevel':9,
    },
    'reproducibilityVerified':True,'allArchivedFilesMatchDist':True,
    'verifiedFileCount':files,'excludedMetadataCount':sum(excluded(p) for p in all_paths),
    'finalStamp':STAMP,
}
REPORT.parent.mkdir(parents=True,exist_ok=True)
(WORK/'build-artifact.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'file':str(OUTPUT),'bytes':size,'MiB':report['MiB'],'sha256':sha,'entries':entries,'verifiedFiles':files,'reproducibilityVerified':True,'report':str(REPORT)},ensure_ascii=False),flush=True)
