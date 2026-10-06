"""Read-only 3.44 evidence verification. Writes only the requested report.
Usage: python3 verify.py REPO [EVIDENCE_DIR] [REPORT]
"""
import gzip, hashlib, html, json, pathlib, re, sys
from html.parser import HTMLParser
ROOT=pathlib.Path(sys.argv[1]).resolve();HERE=pathlib.Path(__file__).resolve().parent
E=pathlib.Path(sys.argv[2]).resolve() if len(sys.argv)>2 else HERE
REPORT=pathlib.Path(sys.argv[3]).resolve() if len(sys.argv)>3 else HERE/'verification.json'
load=lambda p:json.loads(p.read_text());sha=lambda b:hashlib.sha256(b).hexdigest()
checks=[]
def ck(name,ok,detail=None):
    checks.append(dict(name=name,passed=bool(ok),detail=detail))
    if not ok:print('FAIL',name,detail)
cat=load(E/'catalog.json');sources=load(E/'sources.json')['sources'];claims=load(E/'claim-evidence.json')['claims'];manifest=load(E/'manifest.json')
base=ROOT/'public/data/seshat-polaris-2026';idx=load(base/'index.json');sm={s['sourceId']:s for s in sources}
ck('snapshot',cat['sourceSha256']==idx['sourceSha256'] and cat['version']==idx['version'])
ck('bounded-five-cards-two-phases-three-payloads',len(cat['cards'])==5 and len(claims)==5 and len(sources)==3 and len({c['phaseId'] for c in cat['cards']})==2)
ck('unique-card-identities',len({c['id'] for c in cat['cards']})==5)
for f in manifest['files']:
    raw=(E/f['file']).read_bytes();ck('raw-file:'+f['file'],len(raw)==f['bytes'] and sha(raw)==f['sha256'])
ck('original-total-bytes',manifest['totalBytes']==sum(f['bytes'] for f in manifest['files'])==98601)
for s in sources:
    a=s['acquisition'];raw=(E/a['file']).read_bytes()
    ck('source-integrity:'+s['sourceId'],sha(raw)==s['sha256']==a['sha256'] and len(raw)==s['bytes']==a['bytes'] and a['status']==200)
    for support in s.get('supportFiles',[]):
        data=(E/support['file']).read_bytes();ck('support-integrity:'+support['file'],sha(data)==support['sha256'] and len(data)==support['bytes'])
    if s['sourceId'].startswith('faxian'):
        shell=(E/s['supportFiles'][0]['file']).read_text();chapter=s['sourceId'].rsplit('-',1)[1]
        ck('chapter-explicit-data-link:'+chapter,'Faashean'+chapter+'Data.js' in shell and '2012-11-24' in shell)
        ck('edition-dates-separated:'+chapter,s['year']==1886 and '2012-11-24' in s['version'] and 'revised' in s['version'])
    else:ck('cortes-correct-edition',s['year']==1907 and 'Thatcher' in s['version'] and 'Arkenberg' in s['version'])
pm={p['id']:p for p in idx['polities']};decoded={}
for pid in {c['phaseId'] for c in cat['cards']}:
    p=pm[pid];data=(base/p['file']).read_bytes();ck('phase-chunk:'+pid,len(data)==p['bytes'] and sha(data)==p['sha256']);decoded[pid]=json.loads(gzip.decompress(data))
for c,q in zip(cat['cards'],claims):
    sid=c['sourceId'];s=sm[sid];pid=c['phaseId'];rm={r['id']:r for r in decoded[pid]['observations']}
    ck('card-claim:'+c['id'],q['cardId']==c['id'] and q['sourceId']==sid and q['verifiedSourceLocator']==c['locator'])
    ck('phase-binding:'+c['id'],q['phaseBinding']==pm[pid] and q['phaseMetadata']==decoded[pid]['metadata'])
    ck('immutable-association:'+c['id'],all(c[k] is False for k in ['sourceLineageEstablished','allowRecordMerge','allowRawRewrite']))
    ck('source-card:'+c['id'],c['sourceSha256']==s['sha256'] and c['sourceBytes']==s['bytes'] and c['authors']==s['authors'] and c['year']==s['year'] and c['localURL']==s['localURL'])
    ck('exact-target-set:'+c['id'],c['targetRowIds']==[r['id'] for r in q['targets']] and set(c['variableIds'])=={r['raw']['variable_name'] for r in q['targets']})
    ck('bilingual-complete:'+c['id'],all(c[k].strip() for k in ['titleZh','titleEn','summaryZh','summaryEn','scopeZh','scopeEn']))
    for r in q['targets']:
        ck('full-typed-row:'+c['id']+':'+r['sourceRow'],r==rm[r['id']] and r['raw']['polity_id']==pid and r['raw']['year_from'] is None and r['raw']['year_to'] is None)
    for n,a in enumerate(q['sourceAnchors']):
        raw=(E/a['file']).read_bytes();piece=raw[a['byteStart']:a['byteEndExclusive']];lines=raw.splitlines(keepends=True);lo,hi=a['rawSourceLines']
        ck('source-anchor:'+c['id']+':'+str(n),piece==b''.join(lines[lo-1:hi]) and sha(piece)==a['fragmentSha256'] and a.get('needle','').encode() in piece and a['file']==s['acquisition']['file'])
ck('aztec-raw-written-absence-kept',next(r for q in claims for r in q['targets'] if r['raw']['polity_id']=='mx_aztec_emp' and r['raw']['variable_name']=='written_record')['raw']['value_from']=='A')
ck('iron-not-copper',all('铜' not in c['summaryZh'] for c in cat['cards']) and '铁券书录' in cat['cards'][1]['scopeZh'])
before=[]
for rel in ['readings-3.39','readings-3.40','readings-3.43']:before+=load(ROOT/'public/data/research-evidence'/rel/'catalog.json')['cards']
ck('zero-prior-phase-overlap',not ({c['phaseId'] for c in before}&{c['phaseId'] for c in cat['cards']}))
ck('coverage-35-cards-13-phases',len(before)+5==35 and len({c['phaseId'] for c in before+cat['cards']})==13)

class Text(HTMLParser):
    def __init__(self):super().__init__(convert_charrefs=True);self.p=[]
    def handle_data(self,s):self.p.append(s)
    def handle_starttag(self,tag,attrs):
        if tag=='br':self.p.append('\x00')
def norm(s):return '\n'.join(re.sub(r'\s+',' ',part).strip() for part in s.split('\x00')).strip()
def plain(s):
    p=Text();p.feed(s);p.close();return norm(''.join(p.p))

offline=load(E/'offline/index.json');allReadingIds=[];blockTotal=0
for entry in offline['documents']:
    rawDoc=(E/'offline'/entry['file']).read_bytes();d=json.loads(rawDoc);sid=d['sourceId'];s=sm[sid];raw=(E/s['acquisition']['file']).read_bytes()
    ck('derived-manifest:'+sid,len(rawDoc)==entry['bytes'] and sha(rawDoc)==entry['sha256'])
    ck('derived-source-identity:'+sid,d['source']['sha256']==s['sha256'] and d['source']['bytes']==s['bytes'] and d['source']['url']==s['acquisition']['url'])
    ids={b['id'] for b in d['blocks']};blockTotal+=len(ids)
    ck('derived-counts:'+sid,len(ids)==len(d['blocks'])==d['counts']['blocks'] and sum(b['type']=='heading' for b in d['blocks'])==d['counts']['headings'])
    nav={t['id']:t for t in d['toc']};order=[b['id'] for b in d['blocks']]
    ck('toc-follows-source-order:'+sid,[order.index(t['id']) for t in d['toc']]==sorted(order.index(t['id']) for t in d['toc']))
    for b in d['blocks']:
        bits=[]
        for sp in b['sourceSpans']:
            piece=raw[sp['startByte']:sp['endByte']];ck('derived-original-span:'+b['id']+':'+str(sp['startByte']),sha(piece)==sp['sha256'])
            bits.append(plain(json.loads(piece.decode())) if sp['kind']=='javascript-string-literal' else '\x00' if sp['kind']=='break' else html.unescape(piece.decode()))
        reconstructed=bits[0] if b['sourceTag']=='javascript-string-literal' else norm(''.join(bits))
        ck('derived-original-text:'+b['id'],reconstructed==b['text'] and sha(b['text'].encode())==b['textSha256'])
    for a in d['readingAnchors']:
        allReadingIds.append(a['readingId']);ck('readable-card-entry:'+a['readingId'],a['readingId'] in d['readingIds'] and bool(a['anchors']) and all(x['blockId'] in ids for x in a['anchors']))
        ck('card-entry-in-navigation:'+a['readingId'],all(x['blockId'] in nav and nav[x['blockId']]['title']==x['sourceHeading'] and nav[x['blockId']].get('anchorBasis')==x['locatorBasis'] for x in a['anchors']))
    if sid.startswith('faxian'):
        ch=int(sid.rsplit('-',1)[1]);num=38 if ch==16 else 12
        expected={f'eng[{n}]' for n in range(1,num+1)}|{'ChaptTitle'}
        ck('full-english-chapter:'+sid,{b['sourceAssignment'] for b in d['blocks']}==expected)
        zh=load(E/'offline'/f'{sid}.zh-Hans-review.json')
        ck('full-simplified-chinese-chapter:'+sid,{p['segment'] for p in zh['paragraphs']}==set(range(1,num+1)) and len(zh['paragraphs'])==num)
        for p in zh['paragraphs']:
            sp=p['sourceSpans'][0];piece=raw[sp['startByte']:sp['endByte']]
            ck('chinese-original-span:'+sid+':'+str(p['segment']),sha(piece)==sp['sha256'] and plain(json.loads(piece.decode()))==p['text'] and sha(p['text'].encode())==p['textSha256'])
    else:
        text=' '.join(b['text'] for b in d['blocks'])
        ck('cortes-opening-closing-and-attribution',all(phrase in text for phrase in ['IN ORDER, most potent Sire','ever had so much ceremonial','Oliver J. Thatcher','Scanned by Jerome S. Arkenberg','© Paul Halsall June1998']))
        # Independent plain-text extraction of entire selected source region:
        reg=d['extraction']['regions'][0];p=Text();p.feed(raw[reg['startByte']:reg['endByte']].decode());p.close()
        compact=lambda value:re.sub(r'\s+','',value)
        ck('cortes-complete-selected-source-text',compact(''.join(p.p).replace('\x00',''))==compact(text))
ck('all-five-cards-have-readable-entries',set(allReadingIds)=={c['id'] for c in cat['cards']} and len(allReadingIds)==5)
parsed=load(E/'verification/faxian-segments.json')['chapters']
ck('all-language-assignments-retained',sum(len(c['segments']) for c in parsed)==200 and {c['chapter'] for c in parsed}=={16,36})
result=dict(passed=all(c['passed'] for c in checks),checksPassed=sum(c['passed'] for c in checks),checksTotal=len(checks),checks=checks,
    counts=dict(cards=5,phases=2,primarySourcePayloads=3,works=2,originalFiles=6,originalBytes=98601,readingBlocks=blockTotal,
        englishFaxianSegments=50,simplifiedChineseFaxianSegments=50,allLanguageFaxianAssignments=200),
    limitations=['Automated identity and reconstruction checks do not establish Polaris source lineage or historical truth of every passage.',
        'Faxian English reading bodies omit the other source language variants by explicit selection; complete simplified Chinese is supplied separately and all four variants are preserved in review assets.',
        'No original source JavaScript was executed; no PDF is part of this batch.'])
REPORT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['passed','checksPassed','checksTotal','counts']}));sys.exit(0 if result['passed'] else 1)
