#!/usr/bin/env python3
"""Exercise actual AtlasHandler over localhost; no external connection or asset edits."""
import functools, gzip, hashlib, http.client, importlib.util, json, os, pathlib, sys, tempfile, threading, time
from http.server import ThreadingHTTPServer
sys.dont_write_bytecode=True
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('atlas_local_server',ROOT/'serve.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class QuietHandler(module.AtlasHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT/'public')))
server.daemon_threads=True
thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
results=[]
def request(path,headers=None,method='GET'):
    c=http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=15)
    try:
        c.request(method,path,headers=headers or {});r=c.getresponse();body=r.read()
        return r.status,{k.lower():v for k,v in r.getheaders()},body
    finally:c.close()
def check(name,fn):
    try:fn();results.append({'name':name,'pass':True});print('PASS '+name)
    except Exception as error:results.append({'name':name,'pass':False,'error':repr(error)});print('FAIL '+name+': '+repr(error),file=sys.stderr)
def sha(b):return hashlib.sha256(b).hexdigest()
def must(value,description='condition failed'):
    if not value:raise AssertionError(description)
path='/data/halc/tiles/6/32/21.pbf';raw=(ROOT/'public'/path.lstrip('/')).read_bytes()
measure={}
def compressed():
    code,headers,body=request(path,{'Accept-Encoding':'gzip'})
    must(code==200);must(headers['content-type']=='application/vnd.mapbox-vector-tile');must(headers['content-encoding']=='gzip');must(headers['vary']=='Accept-Encoding');must(int(headers['content-length'])==len(body));must(sha(gzip.decompress(body))==sha(raw));must(len(body)<len(raw))
    measure.update(file=path,originalBytes=len(raw),gzipBytes=len(body),decodedSha256=sha(raw),reductionPercent=round((1-len(body)/len(raw))*100,4),httpStatus=code)
def head():
    code,h,b=request(path,{'Accept-Encoding':'gzip'},'HEAD');must(code==200);must(b==b'');must(h['content-encoding']=='gzip');must(int(h['content-length'])==measure['gzipBytes'])
def identity(headers):
    code,h,b=request(path,headers);must(code==200);must('content-encoding' not in h);must(h['content-type']=='application/vnd.mapbox-vector-tile');must(h['vary']=='Accept-Encoding');must(b==raw);must(int(h['content-length'])==len(raw))
def small():
    p='/data/halc/tiles/6/32/22.pbf';code,h,b=request(p,{'Accept-Encoding':'gzip'});must(code==200);must('content-encoding' not in h);must(h['content-type']=='application/vnd.mapbox-vector-tile');must(b==(ROOT/'public'/p.lstrip('/')).read_bytes())
def existing_gzip():
    p='/data/native/year-1500.json.gz';code,h,b=request(p,{'Accept-Encoding':'gzip'});must(code==200);must('content-encoding' not in h);must(b==(ROOT/'public'/p.lstrip('/')).read_bytes())
def head_identity():
    code,h,b=request(path,{'Accept-Encoding':'identity'},'HEAD');must(code==200);must(not b);must('content-encoding' not in h);must(int(h['content-length'])==len(raw));must(h['content-type']=='application/vnd.mapbox-vector-tile')
def text_assets():
    code,h,b=request('/index.html',{'Accept-Encoding':'gzip'});must(code==200);must(h['content-encoding']=='gzip');must(gzip.decompress(b)==(ROOT/'public/index.html').read_bytes())
def cache_update():
    with tempfile.TemporaryDirectory(prefix='atlas-http-') as folder:
        p=pathlib.Path(folder)/'tile.pbf';a=b'original fixture'*1000;b=b'replaced fixture'*1000;p.write_bytes(a)
        first=module.AtlasHandler.compressed(None,str(p));must(gzip.decompress(first)==a)
        old=p.stat().st_mtime_ns;p.write_bytes(b);os.utime(p,ns=(old+10000000,old+10000000))
        second=module.AtlasHandler.compressed(None,str(p));must(gzip.decompress(second)==b);must(first!=second)
def native_fingerprint():
    file='year-1492.json.gz';body=(ROOT/'public/data/native'/file).read_bytes()
    route='/__atlas-native/'+file+'?sha256='+sha(body)
    code,h,b=request(route);must(code==200);must(b==body);must(h['cache-control']=='private, max-age=31536000, immutable')
    code,h,b=request(route,method='HEAD');must(code==200);must(not b);must(int(h['content-length'])==len(body))
    must(request('/__atlas-native/'+file+'?sha256=wrong')[0]==412)
    must(request('/__atlas-native/'+file)[0]==412)
    must(request('/__atlas-native/missing.json.gz?sha256=wrong')[0]==404)
try:
    check('Pinned native route preserves bytes, private cache and rejects wrong fingerprints',native_fingerprint)
    check('PBF gzip response preserves every decoded byte, MIME and wire length',compressed)
    check('HEAD uses the same compressed representation headers and no body',head)
    check('Identity returns original PBF bytes with negotiated Vary',lambda:identity({'Accept-Encoding':'identity'}))
    check('No accepted encoding returns original bytes',lambda:identity({}))
    check('Explicit gzip q=0 overrides wildcard',lambda:identity({'Accept-Encoding':'gzip;q=0, *;q=1'}))
    check('Malformed gzip quality refuses compression',lambda:identity({'Accept-Encoding':'gzip;q=bogus'}))
    check('Wildcard support and case-insensitive gzip quality are parsed',lambda:must(module.accepts_gzip('*;q=0.5') and module.accepts_gzip('GZip;q=0.2') and not module.accepts_gzip('gzip;q=2')))
    check('Range requests keep the base server identity behavior',lambda:identity({'Accept-Encoding':'gzip','Range':'bytes=0-99'}))
    check('Tiny empty MVT stays uncompressed and parseable',small)
    check('Existing .gz archives are never double-encoded',existing_gzip)
    check('Identity HEAD has original length and no body',head_identity)
    check('Existing HTML compression remains byte-exact',text_assets)
    check('Compression cache invalidates a changed file',cache_update)
finally:server.shutdown();server.server_close();thread.join(timeout=5)
report={'checkedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'method':'Actual local HTTP server, GET/HEAD headers, gzip decode and source byte equality. No deployed response or browser MVT rendering claimed. Range requests retain SimpleHTTPRequestHandler full-200 behavior.','pass':sum(r['pass'] for r in results),'fail':sum(not r['pass'] for r in results),'measure':measure,'results':results}
if os.environ.get('LOCAL_HTTP_REPORT'):pathlib.Path(os.environ['LOCAL_HTTP_REPORT']).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(f"{report['pass']}/{len(results)} local HTTP checks passed")
if report['fail']:sys.exit(1)
