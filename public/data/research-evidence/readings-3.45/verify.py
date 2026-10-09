"""Read-only verification of acquired bytes, typed rows and complete derivatives.
Usage: python3 verify.py REPO [EVIDENCE_DIR] [REPORT]
"""
import gzip, hashlib, html, json, pathlib, re, sys
from html.parser import HTMLParser

ROOT=pathlib.Path(sys.argv[1]).resolve();HERE=pathlib.Path(__file__).resolve().parent
E=pathlib.Path(sys.argv[2]).resolve() if len(sys.argv)>2 else HERE
REPORT=pathlib.Path(sys.argv[3]).resolve() if len(sys.argv)>3 else E/'verification.json'
load=lambda p:json.loads(p.read_text());sha=lambda b:hashlib.sha256(b).hexdigest()
checks=[]
def ck(name,ok,detail=None):
 checks.append(dict(name=name,passed=bool(ok),detail=detail))
 if not ok:print('FAIL',name,detail)
cat=load(E/'catalog.json');sources=load(E/'sources.json')['sources'];claims=load(E/'claim-evidence.json')['claims'];manifest=load(E/'manifest.json')
base=ROOT/'public/data/seshat-polaris-2026';idx=load(base/'index.json');sm={s['sourceId']:s for s in sources}
ck('snapshot',cat['sourceSha256']==idx['sourceSha256'] and cat['version']==idx['version'])
ck('five-cards-two-new-phases-two-texts',len(cat['cards'])==5 and len(claims)==5 and len(sources)==2 and len({c['phaseId'] for c in cat['cards']})==2)
ck('unique-cards',len({c['id'] for c in cat['cards']})==5)
for f in manifest['files']:
 raw=(E/f['file']).read_bytes();ck('raw-file:'+f['file'],len(raw)==f['bytes'] and sha(raw)==f['sha256'])
ck('original-total',manifest['totalBytes']==sum(f['bytes'] for f in manifest['files'])==624755)
for s in sources:
 a=s['acquisition'];raw=(E/a['file']).read_bytes()
 ck('source-integrity:'+s['sourceId'],sha(raw)==s['sha256']==a['sha256'] and len(raw)==s['bytes']==a['bytes'] and a['status']==200)
 for a in s['attributionAnchors']:
  data=(E/a['file']).read_bytes();piece=data[a['byteStart']:a['byteEndExclusive']]
  ck('source-attribution:'+s['sourceId']+':'+str(a['byteStart']),sha(piece)==a['fragmentSha256'] and a.get('needle','').encode() in piece)
 for support in s.get('supportFiles',[]):
  data=(E/support['file']).read_bytes();ck('support-integrity:'+support['file'],sha(data)==support['sha256'] and len(data)==support['bytes'])
pm={p['id']:p for p in idx['polities']};decoded={}
for pid in {c['phaseId'] for c in cat['cards']}:
 p=pm[pid];data=(base/p['file']).read_bytes();ck('phase-chunk:'+pid,len(data)==p['bytes'] and sha(data)==p['sha256']);decoded[pid]=json.loads(gzip.decompress(data))
for c,q in zip(cat['cards'],claims):
 sid=c['sourceId'];s=sm[sid];pid=c['phaseId'];rm={r['id']:r for r in decoded[pid]['observations']}
 ck('card-evidence:'+c['id'],q['cardId']==c['id'] and q['sourceId']==sid and q['verifiedSourceLocator']==c['locator'])
 ck('phase-binding:'+c['id'],q['phaseBinding']==pm[pid] and q['phaseMetadata']==decoded[pid]['metadata'])
 ck('read-only-association:'+c['id'],all(c[k] is False for k in ['sourceLineageEstablished','allowRecordMerge','allowRawRewrite']))
 ck('source-card:'+c['id'],c['sourceSha256']==s['sha256'] and c['sourceBytes']==s['bytes'] and c['authors']==s['authors'] and c['year']==s['year'] and c['localURL']==s['localURL'])
 ck('exact-target-set:'+c['id'],c['targetRowIds']==[r['id'] for r in q['targets']] and set(c['variableIds'])=={r['raw']['variable_name'] for r in q['targets']})
 ck('bilingual-fields:'+c['id'],all(c[k].strip() for k in ['titleZh','titleEn','summaryZh','summaryEn','scopeZh','scopeEn']))
 for r in q['targets']:
  ck('full-typed-row:'+c['id']+':'+r['sourceRow'],r==rm[r['id']] and r['raw']['polity_id']==pid)
 for n,a in enumerate(q['sourceAnchors']):
  raw=(E/a['file']).read_bytes();piece=raw[a['byteStart']:a['byteEndExclusive']];lines=raw.splitlines(keepends=True);lo,hi=a['rawSourceLines']
  ck('source-anchor:'+c['id']+':'+str(n),piece==b''.join(lines[lo-1:hi]) and sha(piece)==a['fragmentSha256'] and a.get('needle','').encode() in piece and a['file']==s['acquisition']['file'])
tax=next(q for q in claims if 'tax-administration' in q['cardId'])
br=[r for r in tax['targets'] if r['raw']['variable_name']=='full_time_bureaucrat']
ck('both-1840-bureaucracy-rows-preserved',[(r['sourceRow'],r['raw']['year_from'],r['raw']['year_to'],r['raw']['value_from']) for r in br]==[('5707','1820','1840','SA'),('5708','1840','1898','P')])
legislation=next(c for c in cat['cards'] if 'legislation-records' in c['id'])
judicial=next(c for c in cat['cards'] if 'courts-appeals' in c['id'])
ck('source-backed-labels-and-visible-judicial-scope','正式法律体系' in legislation['scopeZh'] and '成文法典' not in legislation['scopeZh'] and '专职法官P、专用审判建筑P' in judicial['scopeZh'] and '另需材料核实' in judicial['scopeZh'] and 'full-time judges P and dedicated court buildings P' in judicial['scopeEn'] and 'require separate evidence' in judicial['scopeEn'] and judicial['relation']=='comparative-reading')
ck('undated-observations-stay-undated',all(r['raw']['year_from'] is None and r['raw']['year_to'] is None for q in claims for r in q['targets'] if r['sourceRow'] not in ['5707','5708']))
before=[]
for rel in ['readings-3.39','readings-3.40','readings-3.43','readings-3.44']:before+=load(ROOT/'public/data/research-evidence'/rel/'catalog.json')['cards']
ck('no-prior-phase-overlap',not ({c['phaseId'] for c in before}&{c['phaseId'] for c in cat['cards']}))
ck('40-guides-15-phases-17-payloads',len(before)+5==40 and len({c['phaseId'] for c in before+cat['cards']})==15 and len({c['sourceId'] for c in before+cat['cards']})==17)

class Text(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.p=[]
 def handle_data(self,s):self.p.append(s)
 def handle_starttag(self,tag,attrs):
  if tag=='br':self.p.append('\x00')
def norm(s):return '\n'.join(re.sub(r'\s+',' ',x).strip() for x in s.split('\x00')).strip()
def compact(s):return re.sub(r'\s+','',s.replace('\x00',''))
offline=load(E/'offline/index.json');allReadingIds=[];blockTotal=0
for entry in offline['documents']:
 rawDoc=(E/'offline'/entry['file']).read_bytes();d=json.loads(rawDoc);sid=d['sourceId'];s=sm[sid];raw=(E/s['acquisition']['file']).read_bytes()
 ck('derived-manifest:'+sid,len(rawDoc)==entry['bytes'] and sha(rawDoc)==entry['sha256'])
 ck('derived-source:'+sid,d['source']['sha256']==s['sha256'] and d['source']['bytes']==s['bytes'] and d['source']['url']==s['acquisition']['url'])
 ids={b['id'] for b in d['blocks']};blockTotal+=len(ids)
 ck('derived-counts:'+sid,len(ids)==len(d['blocks'])==d['counts']['blocks'] and sum(b['type']=='heading' for b in d['blocks'])==d['counts']['headings'] and sum(len(b['text']) for b in d['blocks'])==d['counts']['characters'])
 nav={t['id']:t for t in d['toc']};order=[b['id'] for b in d['blocks']]
 ck('toc-source-order:'+sid,[order.index(t['id']) for t in d['toc']]==sorted(order.index(t['id']) for t in d['toc']))
 for b in d['blocks']:
  bits=[];good=True
  for sp in b['sourceSpans']:
   piece=raw[sp['startByte']:sp['endByte']];good=good and sha(piece)==sp['sha256']
   bits.append('\x00' if sp['kind']=='break' else html.unescape(piece.decode()))
  ck('byte-span-text-reconstruction:'+b['id'],good and norm(''.join(bits))==b['text'] and sha(b['text'].encode())==b['textSha256'])
 for aset in d['readingAnchors']:
  allReadingIds.append(aset['readingId']);ck('readable-card-entry:'+aset['readingId'],aset['readingId'] in d['readingIds'] and bool(aset['anchors']) and all(a['blockId'] in ids and a['blockId'] in nav and a['sourceHeading']==nav[a['blockId']]['title'] for a in aset['anchors']))
 full=''.join(b['text'] for b in d['blocks']);regionText=[]
 for reg in d['extraction']['regions']:
  piece=raw[reg['startByte']:reg['endByte']];ck('region-bytes:'+sid+':'+str(reg['startByte']),sha(piece)==reg['sha256'])
  p=Text();p.feed(piece.decode());p.close();regionText.extend(p.p)
 ck('complete-selected-text:'+sid,compact(full)==compact(''.join(regionText)))
 if sid.startswith('periplus'):
  numbered=[b for b in d['blocks'] if re.match(r'^\d+\. ',b['text'])]
  ck('all-66-original-sections', [int(re.match(r'^(\d+)\.',b['text'])[1]) for b in numbered]==list(range(1,67)))
  ck('all-numbered-sections-navigable',all(b['id'] in nav for b in numbered))
  ck('periplus-attribution-retained',all(x in full for x in ['W.H. Schoff','1912','© Paul Halsall, October 2000','personal use']))
 else:
  ck('constitution-all-clauses-and-signatures',len(d['blocks'])==66 and d['counts']['headings']==15 and all(x in full for x in ['Declaration of Rights','Of Changes in This Constitution.','this eighth day of October','Kamehameha III.\nKekauluohi.']))
  ck('constitution-unl-variants-preserved','V. No man or chief' in full and 'Kamehemeha I.' in full and 'special. interests' in full and 'law. persons shall have part' in full)
ck('five-card-openings',set(allReadingIds)=={c['id'] for c in cat['cards']} and len(allReadingIds)==5)
review=load(E/'verification/hawaii-scan-review.json');pdf=(E/review['sourcePdf']['file']).read_bytes()
ck('scan-review-identity',sha(pdf)==review['sourcePdf']['sha256'] and len(pdf)==review['sourcePdf']['bytes'] and pdf.startswith(b'%PDF-'))
ck('eight-pages-visually-reviewed',[p['pdfPage'] for p in review['pages']]==list(range(1,9)) and all(p['visuallyReviewed'] for p in review['pages']))
for p in review['pages']:
 # Renders can remain in local QA instead of shipping into the public collection.
 file=E/p['renderFile']
 if file.exists():ck('review-render:'+str(p['pdfPage']),sha(file.read_bytes())==p['renderSha256'])
result=dict(passed=all(c['passed'] for c in checks),checksPassed=sum(c['passed'] for c in checks),checksTotal=len(checks),checks=checks,
 counts=dict(cards=5,phases=2,primarySourcePayloads=2,works=2,originalFiles=4,originalBytes=624755,readingBlocks=blockTotal,originalNumberedPeriplusSections=66,scanPagesVisuallyRead=8,targetRows=11),
 limitations=['Byte reconstruction and source review support the stated source associations, not every historical claim of the authors.','Constitutional rules are distinguished from actual enforcement and occupational specialization.','The acquired UNL transcription has documented differences from the scanned witness; neither file is rewritten.','Guides are bilingual; complete acquired source bodies are English, without a new full Chinese translation.'])
REPORT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['passed','checksPassed','checksTotal','counts']}));sys.exit(0 if result['passed'] else 1)
