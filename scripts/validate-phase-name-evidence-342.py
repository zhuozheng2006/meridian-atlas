"""Read-only evidence audit. Run with Python and pypdf installed.
Usage: python scripts/validate-phase-name-evidence-342.py REPO_ROOT REPORT_JSON
All writes are limited to the explicitly selected report, never the repository.
"""
import sys,json,pathlib,hashlib,gzip,re,unicodedata,collections
from pypdf import PdfReader
repo=pathlib.Path(sys.argv[1]).resolve()
evidence=repo/'docs/verification-3.42/phase-names'
report_path=pathlib.Path(sys.argv[2] if len(sys.argv)>2 else pathlib.Path(__file__).with_name('integrated-evidence-audit.json'))
checks=[];issues=[]
def check(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail})
 if not ok:issues.append({'severity':'error','check':name,'detail':detail})
def read(name):return json.loads((evidence/name).read_text())
def sha(blob):return hashlib.sha256(blob).hexdigest()
def norm(s):return re.sub(r'\s+','',unicodedata.normalize('NFKC',s))
manifest=read('manifest.json');sources=read('sources.json');candidates=read('polity-name-candidates.json');patch=read('runtime-rows-patch.json');baseline=read('baseline-107.json');deferred=read('deferred.json');coverage=read('coverage.json')
inventory=[]
for file in sorted(evidence.rglob('*')):
 if file.is_file():
  b=file.read_bytes();inventory.append({'path':str(file.relative_to(evidence)),'bytes':len(b),'sha256':sha(b)})
inventory_map={x['path']:x for x in inventory};manifest_map={x['path']:x for x in manifest['sourceFiles']}
for item in manifest['sourceFiles']:
 actual=inventory_map.get(item['path']);check('manifest:'+item['path'],bool(actual) and actual['bytes']==item['bytes'] and actual['sha256']==item['sha256'],actual)
check('manifest-total-bytes',sum(x['bytes'] for x in manifest['sourceFiles'])==manifest['totalBytes'],manifest['totalBytes'])
check('manifest-source-count',len(sources)==manifest['sourceCount'],len(sources))
check('manifest-covers-all-referenced-snapshots',set(x['snapshot'] for x in sources)==set(manifest_map),sorted(set(x['snapshot'] for x in sources)))
check('source-ids-unique',len(set(x['id'] for x in sources))==len(sources))
source_map={x['id']:x for x in sources};texts={};source_checks=[]
for s in sources:
 item=inventory_map.get(s['snapshot']);check('source-hash:'+s['id'],item and item['bytes']==s['snapshotBytes'] and item['sha256']==s['snapshotSha256'])
 if s['snapshot'].endswith('.pdf'):
  reader=PdfReader(evidence/s['snapshot']);text='\n'.join(reader.pages[n-1].extract_text() or '' for n in s.get('pdfPages',range(1,len(reader.pages)+1)))
  check('pdf-pages:'+s['id'],all(1<=n<=len(reader.pages) for n in s.get('pdfPages',[])))
 else:
  snap=read(s['snapshot']);text=snap['response'];check('representation-label:'+s['id'],'not' in snap['representation'].lower())
  check('source-url-in-retrieval:'+s['id'],s['url'] in text)
 texts[s['id']]=text
 quote_match=norm(s['quote']) in norm(text)
 check('quote-present:'+s['id'],quote_match,{'quote':s['quote'],'locator':s['locator']})
 source_checks.append({'id':s['id'],'snapshot':s['snapshot'],'locator':s['locator'],'quotePresent':quote_match,'representation':s['representation'],'sourceBytesPresent':s['representation']=='original-pdf-bytes'})
index_bytes=(repo/'public/data/seshat-polaris-2026/index.json.gz').read_bytes();index=json.loads(gzip.decompress(index_bytes));polities={p['id']:p for p in index['polities']};baseline_map={x['polity_id']:x for x in baseline}
check('candidate-unique-count',len(candidates)==14 and len(set(x['polity_id'] for x in candidates))==14)
candidate_checks=[]
for c in candidates:
 id=c['polity_id'];p=polities[id];b=baseline_map[id];q=p['periods'][0];binding=c['sourceBinding']
 expected_tuple=[p['names'][0],p['sourceNumber'],q['sourceRow'],q['startRaw'],q['endRaw'],p['regions'][0],p['samplingAreas'][0] if p['samplingAreas'] else None,c['zh'],c['searchTerms'],c['noteZh'],c['noteEn']]
 check('exact-runtime-tuple:'+id,patch[id]==expected_tuple and c['runtimeTuple']==expected_tuple)
 check('exact-binding:'+id,binding['names']==p['names'] and binding['sourceNumber']==p['sourceNumber'] and binding['sheet']==q['sourceSheet'] and binding['sourceRow']==q['sourceRow'] and binding['regions']==p['regions'] and binding['samplingAreas']==p['samplingAreas'] and binding['periods']==p['periods'])
 check('source-name-and-date-preservation:'+id,c['sourceName']==p['names'][0] and c['en']==p['names'][0] and c['startRaw']==q['startRaw'] and c['endRaw']==q['endRaw'])
 check('baseline-untranslated:'+id,b['status']=='untranslated' and c['beforeStatus']=='untranslated')
 check('snapshot-hash-binding:'+id,binding['snapshotSha256']==b['sourceBinding']['snapshotSha256']=='cf60c9f76eeda6db545521831a9201e65c64d2b74d4aeb55445cd2b564456c41')
 ids=c['reviewEvidence']['sourceIds'];check('source-coverage:'+id,bool(ids) and all(x in source_map for x in ids))
 check('exact-source-urls:'+id,set(c['reviewEvidence']['sourceUrls'])=={source_map[x]['url'] for x in ids})
 check('lexical-evidence-scope:'+id,c['reviewEvidence']['relation']=='lexical-name-evidence' and all(c[x] is False for x in ['allowDateCorrection','allowIdentityMerge','allowSourceRewrite']))
 check('simplified-name:'+id,not re.search('[國羅達亞爾蘇時後諾費譯]',c['zh']))
 candidate_checks.append({'polity_id':id,'zh':c['zh'],'sourceName':c['sourceName'],'sourceRow':q['sourceRow'],'period':[q['startRaw'],q['endRaw']],'sourceIds':ids,'auditNotes':c['auditNotes']})
integrated_ids={x['polity_id'] for x in candidates};deferred_ids={x['polity_id'] for x in deferred}
check('priority-coverage-accounting',len(baseline)==107 and len(deferred)==93 and not(integrated_ids&deferred_ids) and integrated_ids|deferred_ids==set(baseline_map))
region_counts=dict(collections.Counter(x['seshat_region'] for x in candidates));check('region-counts',region_counts==coverage['proposed']['additionsByRegion'],region_counts)
check('global-coverage-arithmetic',coverage['baseline']['translated']+len(candidates)==coverage['proposed']['translated']==383 and coverage['baseline']['fallback']-len(candidates)==coverage['proposed']['fallback']==243)
check('visual-proof-file-present',manifest['visualProof'] in inventory_map)
extra_raw=sorted(set(x for x in inventory_map if x.startswith('raw/'))-set(manifest_map))
observations=[{'severity':'information','finding':'Manifest intentionally covers referenced source representations, not every copied working artifact. This audit inventories every file independently.','unreferencedRawFiles':extra_raw}]
# The originally copied convenience script is tied to the research work directory,
# so report its portability separately from source or production correctness.
convenience=evidence/'verify-runtime.mjs'
if convenience.exists() and "'./candidate-module.mjs'" in convenience.read_text() and not (evidence/'candidate-module.mjs').exists():
 observations.append({'severity':'warning','code':'archived-convenience-script-not-portable','file':'verify-runtime.mjs','finding':'This copied work script imports missing candidate-module.mjs and has an absolute /Users/zane project path. It is historical QA material, not a runnable evidence-directory command. Use scripts/validate-polaris-polity-names.mjs for the integrated module, plus scripts/validate-phase-name-evidence-342.py for evidence checks.','productionImpact':False})
observations.append({'severity':'information','finding':'Only indian-ocean-page-5-pdfium.png is the successful page proof. Native/Poppler images are failed rendering attempts and their logs correctly record missing Adobe-GB1 handling.','productionImpact':False})
result={'auditedOn':'2026-10-06','repository':str(repo),'evidenceDirectory':str(evidence),'passed':not issues,'checksPassed':sum(x['passed'] for x in checks),'checksTotal':len(checks),'errors':issues,'observations':observations,'counts':{'filesInventoried':len(inventory),'manifestFiles':len(manifest_map),'manifestBytes':manifest['totalBytes'],'sources':len(sources),'candidates':len(candidates),'deferred':len(deferred)},'sourceChecks':source_checks,'candidateChecks':candidate_checks,'checks':checks,'fileInventory':inventory,'reusableSteps':['Run this script with the bundled Python and pypdf: scripts/validate-phase-name-evidence-342.py REPO_ROOT REPORT_JSON. It writes only REPORT_JSON.','Check every referenced snapshot against both manifest.json and sources.json bytes/SHA-256.','Match each short source quotation in the saved retrieved text or the designated original PDF pages, allowing only Unicode compatibility normalization and whitespace removal.','Bind all 14 candidate tuples to the real Polaris index names, sourceNumber, row, dates, region and sampling area; preserve raw source identity and chronology.','Run node scripts/validate-polaris-polity-names.mjs from REPO_ROOT for the actual integrated display module and its negative binding regressions.'],'productionFilesModified':False,'networkUsed':False}
report_path.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['passed','checksPassed','checksTotal','counts','errors','observations']},ensure_ascii=False,indent=2))
sys.exit(0 if result['passed'] else 1)
