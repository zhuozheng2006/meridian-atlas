"""Local-only A/B harness. Baseline is the previous release, not shipped."""
import importlib.util,functools,io,gzip,subprocess,argparse
from pathlib import Path
from urllib.parse import urlsplit
from http.server import ThreadingHTTPServer
root=Path(__file__).resolve().parents[3]
spec=importlib.util.spec_from_file_location('atlas_serve',root/'serve.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=argparse.ArgumentParser();p.add_argument('--baseline',action='store_true');p.add_argument('--port',type=int,default=8769);args=p.parse_args()
paths=['app.js','map-engine.js','regional-boundaries.js','boundary-controller.js','boundary-style.js']
baseline={f:subprocess.check_output(['git','show','82b61fde:public/'+f],cwd=root).decode() for f in paths} if args.baseline else {}
extra='''
const displayMeasured=AtlasMap.prototype.displayTerritories;
AtlasMap.prototype.displayTerritories=function(data){
 window.__bench??={updates:[]};window.__benchMap=this;
 const mark={start:performance.now(),year:this.year,zoom:this.map.getZoom()};window.__bench.updates.push(mark);
 const draw=()=>{if(mark.ready)return;try{if(this.map.getSource('polities').loaded()&&this.map.queryRenderedFeatures({layers:['territories']}).length){mark.ready=performance.now();this.map.off('render',draw);}}catch{}};
 this.map.on('render',draw);const start=performance.now();const result=displayMeasured.call(this,data);mark.work=performance.now()-start;mark.tolerance=this.borderTolerance;return result;
};
'''
regional='''
const settleMeasured=RegionalBoundaries.prototype.settle;
RegionalBoundaries.prototype.settle=function(rendered){const result=settleMeasured.call(this,rendered);if(this.features.length&&this.ohmReady){window.__detailReady??={time:performance.now(),active:this.active,records:this.features.length,status:this.status};}return result;};
'''
class Handler(m.AtlasHandler):
 def send_head(self):
  f=urlsplit(self.path).path.lstrip('/')
  if f in paths:
   text=baseline.get(f) if args.baseline else (root/'public'/f).read_text()
   if f=='map-engine.js':text+=extra
   if f=='regional-boundaries.js':text+=regional
   data=gzip.compress(text.encode());self.send_response(200);self.send_header('Content-Type','text/javascript');self.send_header('Content-Encoding','gzip');self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store');self.end_headers();return io.BytesIO(data)
  return super().send_head()
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',args.port),functools.partial(Handler,directory=str(root/'public')));print('QA http://127.0.0.1:'+str(args.port),flush=True);server.serve_forever()
