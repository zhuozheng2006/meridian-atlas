import sys,json,urllib.request,termios,hashlib,gzip
from pathlib import Path
state=termios.tcgetattr(sys.stdin.fileno());quiet=state.copy();quiet[3]&=~termios.ECHO;termios.tcsetattr(sys.stdin.fileno(),termios.TCSANOW,quiet)
print('Ready for authenticated readback (input hidden).',flush=True)
try: request=json.loads(sys.stdin.readline())
finally: termios.tcsetattr(sys.stdin.fileno(),termios.TCSANOW,state)
root=Path('/Users/zane/meridian_atlas/world-history-atlas/public');stamp='3.48.0-58fa2842faf4';results=[]
files=['index.html','entry.js','app.js','map-engine.js','polity-reader.js','polity-places.js','polity-names.js','polity-display-names-data.js','territory-frame-cache.js','assets/maplibre-gl.js','data/events.json.gz','data/research-evidence/names-3.48/catalog.json']
for name in files:
 url=request['origin']+('/' if name=='index.html' else '/'+name+('?v='+stamp if name.endswith('.js') else ''))
 req=urllib.request.Request(url,headers={'OAI-Sites-Authorization':'Bearer '+request['token'],'Accept-Encoding':'identity'})
 with urllib.request.urlopen(req,timeout=30) as response:
  body=response.read()
  if response.headers.get('Content-Encoding')=='gzip':body=gzip.decompress(body)
  headers={k:v for k,v in response.headers.items() if k.lower() in ['content-security-policy','content-type','x-content-type-options','cache-control','content-encoding']}
  same=body==(root/name).read_bytes()
  if name=='index.html':assert stamp.encode() in body
  else:
   assert same,name
   if name.endswith('.js'):assert 'javascript' in response.headers.get('Content-Type',''),name
  result={'file':name,'status':response.status,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest(),'matchesLocal':same,'headers':headers};results.append(result);print(json.dumps(result),flush=True)
Path('/Users/zane/Documents/Codex/2026-10-02/new-chat/outputs/meridian-3.48/deployed-modules.json').write_text(json.dumps({'stamp':stamp,'scope':'Authenticated original-URL HTTP readback, exact payloads and MIME; browser rendering is separate evidence','results':results},indent=2)+'\n')
