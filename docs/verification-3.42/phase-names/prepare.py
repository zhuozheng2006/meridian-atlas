import json,gzip,pathlib,hashlib,re,collections
ROOT=pathlib.Path('/Users/zane/meridian_atlas/world-history-atlas')
WORK=pathlib.Path('/Users/zane/Documents/Codex/2026-10-02/new-chat/work/release-342/phase-names')
def load(p):return json.loads(p.read_text())
def save(name,data):(WORK/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
index=json.loads(gzip.decompress((ROOT/'public/data/seshat-polaris-2026/index.json.gz').read_bytes()))
base={x['polity_id']:x for x in load(WORK/'baseline-107.json')}
polities={x['id']:x for x in index['polities']}
module=(ROOT/'public/polaris-polity-names.js').read_text()
rows=json.loads(re.search(r'const ROWS = (\{.*?\});\n',module).group(1))

sources=[
 {'id':'unesco-kakatiya','title':'Kakatiya Rudreshwara (Ramappa) Temple, Telangana','publisher':'UNESCO World Heritage Centre','url':'https://whc.unesco.org/en/list/1570/','representation':'web-extracted-text','snapshot':'raw/unesco-names.json','locator':'English description and Chinese heading/description; retrieved lines 19–21','terms':{'Kakatiya':'卡卡提亚王朝'},'quote':'卡卡提亚王朝','scope':'Lexical correspondence only. The page dates the dynasty 1123–1323; Polaris dates this phase 1175–1324. No correction of the Polaris dates.'},
 {'id':'unesco-chola','title':'Great Living Chola Temples','publisher':'UNESCO World Heritage Centre','url':'https://whc.unesco.org/en/list/250/','representation':'web-extracted-text','snapshot':'raw/unesco-names.json','locator':'English description and Chinese heading/description; retrieved lines 16–18','terms':{'Chola':'朱罗'},'quote':'朱罗王朝','scope':'Lexical correspondence for Chola. The monument description concerns later temples, so it is not offered as evidence for the Early Cholas phase dates.'},
 {'id':'song-bai-2013','title':'论印度的海洋战略传统与现代海洋安全思想','authors':['宋德星','白俊'],'publisher':'《世界经济与政治论坛》2013年第1期；四川大学南亚研究所馆藏副本','year':2013,'url':'https://ccsas.scu.edu.cn/uploadfile/2019/2019110/2183094158756459.pdf','representation':'original-pdf-bytes','snapshot':'raw/indian-ocean-seapower.pdf','locator':'PDF page 5, printed page 21, footnote 1','pdfPages':[5],'printedPages':['21'],'terms':{'Pallava':'帕拉瓦','Chola':'朱罗','Pandya':'潘迪亚'},'quote':'帕拉瓦、朱罗和潘迪亚三个王朝','visualVerification':{'status':'passed','file':'indian-ocean-page-5-pdfium.png','method':'Original PDF rendered with bundled PDFium and visually checked; Poppler lacked the Adobe-GB1 mapping and its blank attempt was rejected.'},'scope':'Published Chinese dynasty vocabulary. Source modifiers Early/Late/Empire/Dynasty are translated from the pinned Polaris title, not inferred from this article.'},
 {'id':'mfa-uganda','title':'乌干达：国家概况','publisher':'中华人民共和国外交部中国领事服务网','url':'https://cs.mfa.gov.cn/zggmcg/ljmdd/fz_648564/wgd_651915/','representation':'web-extracted-text','snapshot':'raw/oyo-buganda-asante-passages.json','locator':'简况, retrieved line 195','terms':{'Buganda':'布干达'},'quote':'布干达王国','scope':'Established Chinese polity name; source phase numerals I and II remain separate. Modern information on the page is not imported.'},
 {'id':'unesco-buganda','title':'Tombs of Buganda Kings at Kasubi','publisher':'UNESCO World Heritage Centre','url':'https://whc.unesco.org/en/list/1022/','representation':'web-extracted-text','snapshot':'raw/yoruba-buganda-pallava.json','locator':'English description and Chinese description; retrieved lines 16–18','terms':{'Buganda':'巴干达'},'quote':'巴干达王国','scope':'Alternate Chinese rendering retained as a search alias, not a distinct polity.'},
 {'id':'embassy-nigeria-culture','title':'尼日利亚的科技文化与民俗','publisher':'中国驻尼日利亚大使馆','publishedOn':'2004-06-29','url':'https://ng.china-embassy.gov.cn/zngx/znwh/200406/t20040629_7734878.htm','representation':'web-extracted-text','snapshot':'raw/china-sources-open.json','locator':'（三）文化 / 1、尼文化简况; retrieved lines 61–66','terms':{'Nok':'诺克文化','Ife':'伊费'},'quote':'诺克文化、伊费文化','scope':'Chinese cultural/place names only. Historical dates in this older overview are not used to revise the Polaris cultural phases.'},
 {'id':'jiang-yoruba-2015','title':'从多元到聚合：尼日利亚约鲁巴民族的历史透视','authors':['蒋俊'],'publisher':'《世界民族》2015年第4期；浙江师范大学非洲研究院馆藏','year':2015,'url':'https://ias.zjnu.edu.cn/_upload/article/files/a5/9f/e5b2992944339b0e1c32869be38f/ad896166-497b-4f6c-b226-3f76c1c6e50f.pdf','representation':'web-extracted-pdf-text','snapshot':'raw/oyo-buganda-asante-passages.json','locator':'PDF page 2, printed page 55, paragraph on multiple Yoruba polities; retrieved lines 185–189','pdfPages':[2],'printedPages':['55'],'terms':{'Oyo':'奥约'},'quote':'奥约','scope':'The text pairs 奥约 with Oyo in a historical polity context. Raw PDF returned 403 and page-image retrieval failed; extracted PDF text is preserved, not described as a downloaded or visually checked PDF.'},
 {'id':'mfa-freetown','title':'塞拉利昂：国家概况','publisher':'中华人民共和国外交部中国领事服务网','url':'https://cs.mfa.gov.cn/zggmcg/ljmdd/fz_648564/slla_651295/','representation':'web-extracted-text','snapshot':'raw/china-source-passages.json','locator':'首都, retrieved line 189','terms':{'Freetown':'弗里敦'},'quote':'弗里敦（Freetown）','scope':'Toponym correspondence only; the 1787–1808 historical phase remains exactly as supplied by Polaris.'},
 {'id':'yu-akan-2026','title':'“母亲非洲”与“非洲母亲”的文学对视','authors':['余静远'],'publisher':'中国社会科学报 / 中国社会科学网','publishedOn':'2026-05-22','url':'https://www.cssn.cn/skgz/bwyc/202605/t20260522_5992738.shtml','representation':'web-extracted-text','snapshot':'raw/china-source-passages.json','locator':'“母亲非洲”的象征; retrieved line 114','terms':{'Akan':'阿坎'},'quote':'阿坎人（Akan）','scope':'Explicit bilingual ethnonym, not evidence of a single pre-Ashanti state.'},
 {'id':'unesco-asante','title':'Asante Traditional Buildings / 阿散蒂传统建筑','publisher':'UNESCO World Heritage Centre','url':'https://whc.unesco.org/zh/list/35','representation':'web-search-extracted-page-text','snapshot':'raw/nok-asante-search.json','locator':'Chinese description and parallel English/French descriptions in the accessible source result','terms':{'Asante / Ashanti':'阿散蒂'},'quote':'阿散蒂(Asante)','scope':'Name element only. The predecessor-phase relationship is from the source title Akan - Pre-Ashanti.'}
]
for s in sources:
 s['retrievedOn']='2026-10-06';b=(WORK/s['snapshot']).read_bytes();s['snapshotBytes']=len(b);s['snapshotSha256']=hashlib.sha256(b).hexdigest()
save('sources.json',sources)

spec=[
 ('in_kakatiya_dyn','卡卡提亚王朝',['卡卡提亚'],['unesco-kakatiya']),
 ('in_cholas_1','朱罗 · 早期',['早期朱罗','朱罗'],['unesco-chola','song-bai-2013']),
 ('in_pandya_emp_1','潘迪亚 · 早期',['早期潘迪亚','潘迪亚'],['song-bai-2013']),
 ('in_pandya_emp_2','潘迪亚王朝',['潘迪亚'],['song-bai-2013']),
 ('in_pandya_emp_3','潘迪亚帝国',['潘迪亚'],['song-bai-2013']),
 ('in_pallava_emp_2','帕拉瓦帝国后期',['帕拉瓦','帕拉瓦后期'],['song-bai-2013']),
 ('ug_buganda_k_1','布干达 I',['布干达','巴干达','布干达王国'],['mfa-uganda','unesco-buganda']),
 ('ug_buganda_k_2','布干达 II',['布干达','巴干达','布干达王国'],['mfa-uganda','unesco-buganda']),
 ('ni_nok_1','诺克文化 · 中晚期',['诺克','诺克文化'],['embassy-nigeria-culture']),
 ('ni_nok_2','诺克文化 · 中晚期',['诺克','诺克文化'],['embassy-nigeria-culture']),
 ('ni_yoruba_classic','伊费 · 古典时期',['伊费','伊费文化'],['embassy-nigeria-culture']),
 ('ni_oyo_emp_1','奥约',['奥约'],['jiang-yoruba-2015']),
 ('si_freetown_1','弗里敦',['弗里敦'],['mfa-freetown']),
 ('gh_akan','阿坎 · 前阿散蒂时期',['阿坎','阿散蒂之前'],['yu-akan-2026','unesco-asante'])
]
out=[];patch={}
for id,zh,aliases,sourceIds in spec:
 p=polities[id];b=base[id];assert b['status']=='untranslated';assert p['names']==[b['sourceName']]
 phase=p['periods'][0]
 tuple=[p['names'][0],p['sourceNumber'],phase['sourceRow'],phase['startRaw'],phase['endRaw'],p['regions'][0],p['samplingAreas'][0] if p['samplingAreas'] else None,zh,list(dict.fromkeys([zh]+aliases)),'','']
 auditNotes=[]
 if id.startswith('ni_nok'):auditNotes+=['Two different source IDs share the exact source title Middle and Late Nok. The same Chinese title is intentional; neither phases nor raw dates (including source year 0) are merged or corrected.']
 if id.startswith('in_pandya'):auditNotes+=['Early Pandyas, Pandya Dynasty, and Pandya Empire retain distinct titles and source bindings.']
 if id=='gh_akan':auditNotes+=['Akan is an ethnonym/research-area label; the display does not add Kingdom or Empire. Pre-Ashanti is translated literally from the source phase title.']
 if id=='in_kakatiya_dyn':auditNotes+=['UNESCO dates 1123–1323 and the pinned phase dates 1175–1324 differ. This is a vocabulary patch, not a date adjudication.']
 if id.startswith('ug_buganda'):auditNotes+=['Roman numerals are source phase labels, not dynastic names.']
 out.append({'polity_id':id,'sourceName':p['names'][0],'zh':zh,'en':p['names'][0],'status':'complete','beforeStatus':b['status'],'noteZh':'','noteEn':'','searchTerms':tuple[8],'seshat_region':p['regions'][0],'startRaw':phase['startRaw'],'endRaw':phase['endRaw'],'sourceBinding':{'snapshotSha256':b['sourceBinding']['snapshotSha256'],'sourceNumber':p['sourceNumber'],'sheet':phase['sourceSheet'],'sourceRow':phase['sourceRow'],'names':p['names'],'regions':p['regions'],'samplingAreas':p['samplingAreas'],'periods':p['periods']},'reviewEvidence':{'kind':'reviewed-display-translation','relation':'lexical-name-evidence','sourceIds':sourceIds,'sourceUrls':[s['url'] for s in sources if s['id'] in sourceIds],'phaseModifiersFrom':'Pinned Polaris source title; no chronological reclassification','reviewedOn':'2026-10-06'},'auditNotes':auditNotes,'allowDateCorrection':False,'allowIdentityMerge':False,'allowSourceRewrite':False,'runtimeTuple':tuple,'previousRuntimeTuple':rows.get(id)})
 patch[id]=tuple
save('polity-name-candidates.json',out);save('runtime-rows-patch.json',patch)
regions=collections.Counter(x['seshat_region'] for x in out)
save('coverage.json',{'baseline':{'totalPhases':626,'translated':369,'fallback':257,'priorityFallback':107,'priorityRegions':{'West Africa':52,'East Africa':39,'Southern India':16}},'proposed':{'translatedAdded':len(out),'translated':369+len(out),'fallback':257-len(out),'priorityFallback':107-len(out),'additionsByRegion':dict(regions),'remainingPriorityByRegion':{r:n-regions[r] for r,n in {'West Africa':52,'East Africa':39,'Southern India':16}.items()}},'productionEdited':False,'sourcePhaseDatesRewritten':0,'sourceIdsChanged':0})
deferred=[{'polity_id':x['polity_id'],'sourceName':x['sourceName'],'reason':('Ambiguous source title or identity; no evidence-backed normalization made.' if x['polity_id'] in ['ni_dahomey_k','ni_proto_yoruboid','Early Niynginya','ni_oyo_emp_2'] else 'Outside this bounded fully reviewed vocabulary batch.')} for x in base.values() if x['polity_id'] not in patch]
save('deferred.json',deferred)

# Prove proposed runtime tuples bind to the actual source snapshot without writing production.
for c in out:
 t=c['runtimeTuple'];p=polities[c['polity_id']];q=p['periods'][0]
 assert t[:7]==[p['names'][0],p['sourceNumber'],q['sourceRow'],q['startRaw'],q['endRaw'],p['regions'][0],p['samplingAreas'][0] if p['samplingAreas'] else None]
 assert c['en']==p['names'][0];assert all(c[k] is False for k in ['allowDateCorrection','allowIdentityMerge','allowSourceRewrite'])
 assert all(any(s['id']==id for s in sources) for id in c['reviewEvidence']['sourceIds'])
 assert re.search('[\u3400-\u9fff]',c['zh']);assert len(t)==11
save('verification.json',{'passed':True,'checkedCandidateCount':len(out),'uniqueIds':len(set(x['polity_id'] for x in out)),'snapshotBindingChecks':len(out),'sourceEvidenceEntries':len(sources),'sameTitleNokPreservesTwoIds':len([x for x in out if x['sourceName']=='Middle and Late Nok'])==2,'productionModuleUnchanged':module==(ROOT/'public/polaris-polity-names.js').read_text()})
print(json.dumps(load(WORK/'coverage.json'),ensure_ascii=False,indent=2))
