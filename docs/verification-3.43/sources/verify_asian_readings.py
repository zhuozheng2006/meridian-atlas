"""Read-only verification. Usage: python3 verify.py REPOSITORY [EVIDENCE_DIR] [REPORT]
Requires pypdf. Writes only REPORT; defaults beside this script.
"""
import gzip,hashlib,json,pathlib,re,sys
from pypdf import PdfReader
ROOT=pathlib.Path(sys.argv[1]).resolve()
HERE=pathlib.Path(__file__).resolve().parent
E=pathlib.Path(sys.argv[2]).resolve() if len(sys.argv)>2 else HERE
REPORT=pathlib.Path(sys.argv[3]).resolve() if len(sys.argv)>3 else HERE/'verification.json'
load=lambda p:json.loads(p.read_text())
norm=lambda s:' '.join(s.split())
sha=lambda b:hashlib.sha256(b).hexdigest()
catalog=load(E/'catalog.json'); sources=load(E/'sources.json')['sources']; claims=load(E/'claim-evidence.json')['claims']; manifest=load(E/'manifest.json')
base=ROOT/'public/data/seshat-polaris-2026';index=load(base/'index.json')
checks=[]
def ck(name,ok,detail=None):
    checks.append(dict(name=name,passed=bool(ok),detail=detail))
    if not ok: print('FAIL',name,detail)

ck('exact-snapshot',catalog['sourceSha256']==index['sourceSha256'] and catalog['version']==index['version'])
ck('bounded-additions',len(catalog['cards'])==5 and len(sources)==2 and len(claims)==5)
ck('unique-reading-and-source-identities',len({c['id'] for c in catalog['cards']})==5 and len({s['sourceId'] for s in sources})==2)
sourceMap={s['sourceId']:s for s in sources}
textCache={}; anchorAudit=[]
for s in sources:
    data=(E/s['acquisition']['file']).read_bytes()
    ck('source-bytes:'+s['sourceId'],len(data)==s['bytes']==s['acquisition']['bytes'])
    ck('source-hash:'+s['sourceId'],sha(data)==s['sha256']==s['acquisition']['sha256'])
    ck('public-acquisition:'+s['sourceId'],s['acquisition']['status']==200 and s['acquisition']['url'].startswith('https://'))
    ck('manifest:'+s['sourceId'],next(x for x in manifest['files'] if x['file']==s['acquisition']['file'])=={'file':s['acquisition']['file'],'bytes':len(data),'sha256':sha(data)})
    if s['representation']=='original-pdf-bytes':
        p=PdfReader(E/s['acquisition']['file']); textCache[s['sourceId']]=[page.extract_text() for page in p.pages]
        ck('pdf-page-count',len(p.pages)==s['pdfPages']==5)
    else:
        textCache[s['sourceId']]=data.decode('utf-8')
        ck('saved-html-is-document','<H3>CODE OF LAWS</H3>' in textCache[s['sourceId']] and 'Translated by L. W. King' in textCache[s['sourceId']])
ck('total-source-bytes',sum(s['bytes'] for s in sources)==manifest['totalBytes']==231324)
ck('edition-year-not-invented',sourceMap['hammurabi-king-yale']['year'] is None and sourceMap['taika-lu-columbia-1997']['year']==1997)

phaseMap={p['id']:p for p in index['polities']}; decoded={}
for pid in {c['phaseId'] for c in catalog['cards']}:
    p=phaseMap[pid]; data=(base/p['file']).read_bytes()
    ck('phase-chunk-integrity:'+pid,len(data)==p['bytes'] and sha(data)==p['sha256'])
    decoded[pid]=json.loads(gzip.decompress(data))
for c,claim in zip(catalog['cards'],claims):
    s=sourceMap[c['sourceId']];pid=c['phaseId'];rowMap={r['id']:r for r in decoded[pid]['observations']}
    ck('claim-card:'+c['id'],c['id']==claim['cardId'] and c['sourceId']==claim['sourceId'])
    ck('exact-locator:'+c['id'],c['locator']==claim['verifiedSourceLocator'])
    ck('exact-target-identity:'+c['id'],c['targetRowIds']==[r['id'] for r in claim['targets']])
    ck('exact-phase-binding:'+c['id'],claim['phaseBinding']==phaseMap[pid] and claim['phaseMetadata']==decoded[pid]['metadata'])
    ck('immutable-association:'+c['id'],all(c[k] is False for k in ['sourceLineageEstablished','allowRecordMerge','allowRawRewrite']))
    ck('bilingual-completeness:'+c['id'],all(isinstance(c[k],str) and c[k].strip() for k in ['titleZh','titleEn','summaryZh','summaryEn','scopeZh','scopeEn']))
    ck('source-association:'+c['id'],c['sourceSha256']==s['sha256'] and c['sourceBytes']==s['bytes'] and c['localURL']==s['localURL'] and c['authors']==s['authors'] and c['year']==s['year'])
    ck('existing-relation:'+c['id'],c['relation'] in ['comparative-reading','direct-evidence'])
    for r in claim['targets']:
        ck('unaltered-observation:'+c['id']+':'+r['sourceRow'],r==rowMap.get(r['id']) and r['raw']['polity_id']==pid and r['raw']['variable_name'] in c['variableIds'])
    for n,a in enumerate(claim['sourceAnchors']):
        if 'rawHTMLLines' in a:
            data=(E/s['acquisition']['file']).read_bytes();lines=data.splitlines(keepends=True);start,end=a['rawHTMLLines'];segment=b''.join(lines[start-1:end]);text=segment.decode('utf-8')
            detail={'rawHTMLLines':[start,end],'byteStart':sum(map(len,lines[:start-1])),'byteEndExclusive':sum(map(len,lines[:end])),'fragmentSha256':sha(segment)}
        else:
            text=textCache[s['sourceId']][a['pdfPage']-1];detail={'pdfPage':a['pdfPage'],'section':a['section'],'extractedTextSha256':sha(text.encode())}
            ck('pdf-anchor-in-locator:'+c['id']+':'+str(n),a['pdfPage'] in c['locator']['pdfPages'])
        ck('source-needle:'+c['id']+':'+str(n),norm(a['needle']) in norm(text),detail)
        anchorAudit.append(dict(cardId=c['id'],sourceId=c['sourceId'],needle=a['needle'],**detail))
prior=[]
for name in ['readings-3.39','readings-3.40']:
    prior+=load(ROOT/'public/data/research-evidence'/name/'catalog.json')['cards']
ck('two-new-phases',not ({c['phaseId'] for c in prior}&{c['phaseId'] for c in catalog['cards']}))
ck('expected-overall-coverage',len(prior)+len(catalog['cards'])==30 and len({c['phaseId'] for c in prior+catalog['cards']})==11)
ck('no-date-invention-in-observations',all(r['raw']['year_from'] is None and r['raw']['year_to'] is None for claim in claims for r in claim['targets']))
result={'passed':all(c['passed'] for c in checks),'checksPassed':sum(c['passed'] for c in checks),'checksTotal':len(checks),'checks':checks,'sourceAnchors':anchorAudit,
        'visualReview':{'sourceId':'taika-lu-columbia-1997','pdfPages':[1,2,3,4,5],'method':'Poppler render at 1500 pixels; all five source pages inspected by the research agent','images':['verification/taika-'+str(i)+'.png' for i in range(1,6)]},
        'limitations':['Hash and locator checks cannot establish Polaris bibliographic lineage.','PDF parser reports four wrong object offsets; all pages parse and render successfully.','Original King edition date is not stated; UI must omit a null year.']}
REPORT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['passed','checksPassed','checksTotal']}))
sys.exit(0 if result['passed'] else 1)
