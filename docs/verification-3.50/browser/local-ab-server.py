import importlib.util,functools,io,gzip
from pathlib import Path
from urllib.parse import urlsplit
from http.server import ThreadingHTTPServer
root=Path(__file__).resolve().parents[3]
spec=importlib.util.spec_from_file_location('atlas_serve',root/'serve.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
extra='''
const displayMeasured=AtlasMap.prototype.displayTerritories;
AtlasMap.prototype.displayTerritories=function(data){
 window.__bench??={updates:[],legacy:new URLSearchParams(location.search).has('legacy')};window.__benchMap=this;
 const mark={start:performance.now(),year:this.year,zoom:this.map.getZoom()};window.__bench.updates.push(mark);
 const draw=()=>{if(mark.ready)return;try{if(this.map.getSource('polities').loaded()&&this.map.queryRenderedFeatures({layers:['territories']}).length){mark.ready=performance.now();this.map.off('render',draw);}}catch{}};
 this.map.on('render',draw);const start=performance.now();const result=displayMeasured.call(this,data);mark.work=performance.now()-start;mark.tolerance=this.borderTolerance;return result;
};
'''
class Handler(m.AtlasHandler):
 def send_head(self):
  if urlsplit(self.path).path=='/map-engine.js':
   text=(root/'public/map-engine.js').read_text().replace('tolerance=borderChordError(this.map.getZoom?.())',"tolerance=new URLSearchParams(location.search).has('legacy')?.002:borderChordError(this.map.getZoom?.())")+extra
   data=gzip.compress(text.encode());self.send_response(200);self.send_header('Content-Type','text/javascript');self.send_header('Content-Encoding','gzip');self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store');self.end_headers();return io.BytesIO(data)
  return super().send_head()
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',8768),functools.partial(Handler,directory=str(root/'public')));print('QA only http://127.0.0.1:8768',flush=True);server.serve_forever()
