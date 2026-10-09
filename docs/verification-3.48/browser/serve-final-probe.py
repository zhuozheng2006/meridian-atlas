from pathlib import Path
from http.server import ThreadingHTTPServer
from urllib.parse import urlsplit
import importlib.util,io,functools,json,time

ROOT=Path('/Users/zane/meridian_atlas/world-history-atlas')
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('atlas_local_server',ROOT/'serve.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
def config():return json.loads((HERE/'events-control.json').read_text())
class ProbeHandler(mod.AtlasHandler):
 def send_head(self):
  path=urlsplit(self.path).path
  if path=='/data/events.json.gz':
   state=config()
   if state.get('delay'):time.sleep(state['delay'])
   if state.get('fail'):
    self.vary_encoding=False;self.send_response(503);self.send_header('Content-Length','0');self.send_header('Cache-Control','no-store');self.end_headers();return io.BytesIO(b'')
  if path in ['/','/index.html','/__qa_probe.js','/map-engine.js','/app.js']:
   if path=='/__qa_probe.js':body='window.__QA_EVENTS_GATE__='+json.dumps(config().get('gate',False))+';\n'+(HERE/'probe.js').read_text();mime='text/javascript'
   elif path in ['/','/index.html']:
    body=(ROOT/'public/index.html').read_text().replace('<head>','<head><script src="/__qa_probe.js"></script>',1);mime='text/html'
   elif path=='/map-engine.js':
    body=(ROOT/'public/map-engine.js').read_text();a='  this.map=new maplibregl.Map(';b='  // Verification handle:'
    assert body.count(a)==1 and body.count(b)==1
    body=body.replace(a,"  window.__qa348?.mark('map-constructor-start');\n"+a).replace(b,"  window.__qa348?.mark('map-constructor-end');\n"+b);mime='text/javascript'
   else:
    body=(ROOT/'public/app.js').read_text()
    for a,b in [
     ('function ensureCatalogData(){',"function ensureCatalogData(){window.__qa348?.mark('catalog-request');"),
     ('catalog=value;',"catalog=value;window.__qa348?.mark('catalog-ready');"),
     ("events=value;eventsStatus='ready';","events=value;eventsStatus='ready';window.__qa348?.mark('events-ready');"),
     ('await Promise.all([ensureCatalogData(),loadMapLibre()]);','await Promise.all([window.__QA_EVENTS_GATE__?ensureCoreData():ensureCatalogData(),loadMapLibre()]);')]:
     assert body.count(a)==1,(a,body.count(a));body=body.replace(a,b)
    mime='text/javascript'
   data=body.encode();self.vary_encoding=False;self.send_response(200);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store');self.end_headers();return io.BytesIO(data)
  return super().send_head()
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',8770),functools.partial(ProbeHandler,directory=str(ROOT/'public')));server.daemon_threads=True
print('Final local atlas QA: http://127.0.0.1:8770/',flush=True)
try:server.serve_forever()
except KeyboardInterrupt:server.server_close()
