"""Retrieve the pinned, public ResearchArea archive members using verified byte ranges."""
import pathlib,struct,urllib.request,zlib,json,hashlib,sys
root=pathlib.Path(__file__).resolve().parents[2]
report=json.loads((root/'docs/verification-3.56/china-retrieval.json').read_text())
out=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path(__file__).parent/'.cache'
out.mkdir(parents=True,exist_ok=True)
url=report['url'];start,end=report['byteRange'];entries=report['members']
with urllib.request.urlopen(urllib.request.Request(url,headers={'Range':f'bytes={start}-{end}'}),timeout=120) as r:
 assert r.status==206 and r.headers['Content-Range']==f'bytes {start}-{end}/563001359'
 raw=r.read();assert len(raw)==end-start+1
assert hashlib.sha256(raw).hexdigest()==report['rangeSHA256']
for e in entries:
 p=e['offset']-start;h=struct.unpack('<4s5H3I2H',raw[p:p+30]);assert h[0]==b'PK\x03\x04';ln,le=h[-2:];b=raw[p+30+ln+le:p+30+ln+le+e['compressedBytes']]
 data=zlib.decompress(b,-15) if e['method']==8 else b
 assert len(data)==e['bytes'] and zlib.crc32(data)==e['crc32']
 name=pathlib.PurePosixPath(e['name']).name;(out/name).write_bytes(data);assert hashlib.sha256(data).hexdigest()==e['sha256'];print(name,len(data),e['sha256'],flush=True)
