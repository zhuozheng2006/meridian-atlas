"""Verify the separate local research archive against the publishable source manifest."""
from pathlib import Path
import json,hashlib,re
BASE=Path(__file__).resolve().parent
catalog=json.loads((BASE/'integration/public/data/research-evidence/cities-3.47/catalog.json').read_text())
checks=[]
for source in catalog['sources']:
 meta=source['retrieval'];p=BASE/meta['localFile'];b=p.read_bytes()
 assert len(b)==meta['bytes'] and hashlib.sha256(b).hexdigest()==meta['sha256'],p
 text=json.loads(b) if p.suffix=='.json' else b.decode()
 text=re.sub(r'\s+',' ',text)
 for quote in source['shortExcerpts']:assert re.sub(r'\s+',' ',quote) in text,(source['sourceId'],quote)
 if 'originalFile' in source:
  original=source['originalFile'];q=BASE/original['archivePath'];raw=q.read_bytes()
  assert len(raw)==original['bytes'] and hashlib.sha256(raw).hexdigest()==original['sha256'],q
  if q.suffix=='.pdf':assert raw.startswith(b'%PDF-')
 checks.append({'sourceId':source['sourceId'],'passed':True,'originalResponseAvailable':'originalFile' in source})
report={'passed':True,'checks':checks,'originalBodies':sum(c['originalResponseAvailable'] for c in checks),'representationPolicy':'Only the Rice PDF and NMMZ HTML are original HTTP body bytes. Other sources retain the actual web-tool extraction, identified as such. Published excerpts are bounded and linked to the local archive by hash.'}
(BASE/'archive-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'passed':len(checks),'originalBodies':report['originalBodies']}))
