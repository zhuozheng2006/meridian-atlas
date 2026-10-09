"""Build source-preserving 3.45 candidates beside this script, never in the repo.
Usage: python3 prepare.py /path/to/world-history-atlas
No downloaded content is executed. All preparation is offline.
"""
import gzip, hashlib, json, pathlib, sys

ROOT = pathlib.Path(sys.argv[1]).resolve()
OUT = pathlib.Path(__file__).resolve().parent
BASE = ROOT / 'public/data/seshat-polaris-2026'
INDEX = json.loads((BASE / 'index.json').read_text())
SHA = 'cf60c9f76eeda6db545521831a9201e65c64d2b74d4aeb55445cd2b564456c41'
assert INDEX['sourceSha256'] == SHA
PREFIX = './data/research-evidence/readings-3.45/'
sha = lambda b: hashlib.sha256(b).hexdigest()
def write(name, data):
    (OUT / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

acquisitions = json.loads((OUT / 'acquisitions.json').read_text())
acq = {a['file']: a for a in acquisitions}
for a in acquisitions:
    raw = (OUT / a['file']).read_bytes()
    assert len(raw) == a['bytes'] and sha(raw) == a['sha256']

def anchor(file, start, end, **extra):
    lines = (OUT / file).read_bytes().splitlines(keepends=True)
    piece = b''.join(lines[start-1:end])
    return dict(file=file, rawSourceLines=[start,end], byteStart=sum(map(len,lines[:start-1])),
                byteEndExclusive=sum(map(len,lines[:end])), fragmentSha256=sha(piece), **extra)

def line(file, needle):
    matches = [i+1 for i,s in enumerate((OUT/file).read_bytes().splitlines()) if needle.encode() in s]
    assert len(matches)==1, (needle,matches)
    return anchor(file,matches[0],matches[0],needle=needle)

per = acq['raw/periplus-fordham.html.txt']
haw = acq['raw/hawaii-1840-unl.html.txt']
pdf = acq['raw/hawaii-1840-constitution-archives.pdf']
uni = acq['raw/hawaii-1840-university.html.txt']
sources = [dict(sourceId='periplus-schoff-fordham-1912',
    title='The Periplus of the Erythraean Sea',
    authors=['Anonymous merchant (author)', 'W. H. Schoff (1912 translator and editor)', 'Internet History Sourcebooks Project (digital edition)'],
    year=1912, publisher='1912 edition cited as London, Bombay and Calcutta; digital text hosted by Fordham University',
    edition='Schoff 1912 translation, complete numbered text 1–66 in the Fordham electronic edition',
    version='Schoff 1912 translation; Fordham page © Paul Halsall October 2000; retrieved 2026-10-10',
    representation='original-html-bytes',landingURL=per['url'],acquisition=per,bytes=per['bytes'],sha256=per['sha256'],localURL=PREFIX+per['file'],
    attributionAnchors=[anchor(per['file'],749,752),anchor(per['file'],754,761)],
    scopeNotes='A merchant’s account presented by this edition as first-century CE. Sections 4–6 describe the Adulis coastal trade network and an inland connection to the Auxumites. This supports reading context for Axum I, not a surveyed imperial boundary or a claim that Zoscales ruled the whole Axumite state. Ancient ethnic labels and the old translation’s language remain in the original, while guide prose uses place-based description. Coin origin and circulation totals are not supplied in section 6. The 1912 translation is retained as a historical edition, not presented as the latest critical text.',
    evidenceScope='Independent reading association; Polaris source lineage not established.'),
    dict(sourceId='hawaii-1840-constitution-unl-1842',
    title='Constitution of the Hawaiian Kingdom (1840)',
    authors=['Kamehameha III (signatory)', 'Kekāuluohi (signatory)', 'University of Nebraska–Lincoln, U.S. Law and Race Initiative OER (digital transcription)'],
    year=1842,publisher='Lahainaluna, 1842; transcription hosted by University of Nebraska–Lincoln',
    edition='Translation of the Constitution and Laws of the Hawaiian Islands, Established in the Reign of Kamehameha III (Lahainaluna, 1842); UNL transcription',
    version='Constitution signed 1840-10-08; UNL transcription cites Lahainaluna 1842 translation; item modified 2026-08-05; retrieved 2026-10-10',
    representation='original-html-bytes',landingURL=haw['url'],acquisition=haw,bytes=haw['bytes'],sha256=haw['sha256'],localURL=PREFIX+haw['file'],
    supportFiles=[pdf,uni],
    attributionAnchors=[anchor(haw['file'],291,291,needle='Lahainaluna: 1842.'),line(uni['file'],'Enacted on October 8, 1840')],
    scopeNotes='The digital transcript identifies its edition as the 1842 English translation. No individual translator is named by this item. The eight-page State Archives scan was visually read in full: its first page has no printed folio, followed by pp. 10–16. Relevant clauses match in substance, with editorial differences recorded in verification/hawaii-scan-review.json; the transcript is preserved rather than silently corrected. This constitutional text sets out norms in 1840, not proof of uniform enforcement or full-time office holding through the entire database phase. The supplied Polaris phase label and 1820–1898 bounds are preserved as dataset metadata, not a new assertion about the date the monarchy ended.',
    evidenceScope='Independent reading association; Polaris source lineage not established.')]
write('sources.json',dict(schemaVersion=1,sources=sources))

phase_ids=['et_aksum_emp_1','us_hawaii_k']
phases={p['id']:p for p in INDEX['polities'] if p['id'] in phase_ids}
payloads={pid:json.loads(gzip.decompress((BASE/p['file']).read_bytes())) for pid,p in phases.items()}
rows={pid:{r['sourceRow']:r for r in obj['observations']} for pid,obj in payloads.items()}
cards=[];claims=[]

def add(slug,pid,rownums,source,relation,titleZh,titleEn,summaryZh,summaryEn,scopeZh,scopeEn,locator,notes,anchors,pages=None):
    targets=[rows[pid][str(n)] for n in sorted(rownums)]
    variables=list(dict.fromkeys(r['raw']['variable_name'] for r in targets))
    c=dict(id=slug+'--'+pid,phaseId=pid,variableIds=variables,targetRowIds=[r['id'] for r in targets],
        relation=relation,sourceId=source['sourceId'],titleZh=titleZh,titleEn=titleEn,
        authors=source['authors'],year=source['year'],url=source['acquisition']['url'],landingURL=source['landingURL'],
        doi=None,relatedDatasetDOI=None,relatedArticleDOI=None,locator=locator,summaryZh=summaryZh,summaryEn=summaryEn,
        scopeZh=scopeZh,scopeEn=scopeEn,sourceSha256=source['sha256'],sourceBytes=source['bytes'],sourceRecordId=None,
        sourceSnapshot=source['version'],conflicts=[],sourceLineageEstablished=False,allowRecordMerge=False,allowRawRewrite=False,localURL=source['localURL'])
    cards.append(c)
    q=dict(cardId=c['id'],targets=targets,verifiedSourceLocator=locator,reviewNotes=notes,sourceId=source['sourceId'],sourceAnchors=anchors,phaseBinding=phases[pid],phaseMetadata=payloads[pid]['metadata'])
    if pages:q['scanCorroboration']=dict(file=pdf['file'],sha256=pdf['sha256'],pagesOneBased=pages,review='verification/hawaii-scan-review.json')
    claims.append(q)

add('aksum-periplus-port-hinterland','et_aksum_emp_1',[9726,11868],sources[0],'comparative-reading',
    '从阿杜利斯港到内陆象牙市场','From Adulis to the inland ivory markets',
    '航行记把海湾中的停泊点、阿杜利斯聚落、科洛埃象牙市场和阿克苏姆人的城市连成一条贸易路线。作者还解释船只为何改换锚地。顺着货物流动阅读，能看到港口安全与内陆集散怎样相互联系。',
    'The account connects offshore anchorages, the settlement of Adulis, the ivory market at Coloe, and the city of the Auxumites. It also explains why ships changed their anchorage. Following this movement of goods reveals how port security and inland collection were linked.',
    '第4节；与Axum I的市场设施IP、港口P两条原记录对读。原文以行程天数描述内陆联系。',
    'Section 4, alongside Axum I rows for markets IP and ports P. The account expresses inland connections in days of travel.',
    dict(htmlSection='Section 4 — Adulis and the inland ivory route',section='第4节 / Section 4; raw HTML lines 212–227'),
    'The market and port are named in a first-century account, while the rows are undated within the -149–349 phase. Market IP is not promoted to P. Travel days are retained as narrative units; no modern roads, exact coordinates, border polygon, or equivalence between Adulis and the whole Axumite kingdom is inferred.',
    [anchor(per['file'],212,227,needle='Adulis')])

add('aksum-periplus-goods-exchange','et_aksum_emp_1',[19813,21066],sources[0],'comparative-reading',
    '货单里的交换方式：铜块、钱币与跨海贸易','Brass, coins, and exchange across the sea',
    '第6节列出埃及织物、铜铁器材、印度铁钢与棉布等进口品，出口则包括象牙、龟甲和犀角。货单中还出现切成小块、用来替代钱币的黄铜，以及少量钱币，帮助我们比较商品用途和支付方式。',
    'Section 6 lists Egyptian textiles, copper and iron supplies, Indian iron and steel, and cotton cloth among imports; exports include ivory, tortoiseshell, and rhinoceros horn. Brass cut into pieces for exchange appears beside a little coin, inviting comparison between goods and means of payment.',
    '第6节；关联兼作货币的实用品P、外来钱币P。钱币铸造地与交易规模在这一段未注明。',
    'Section 6, linked to articles used as money P and foreign coins P. The passage supplies neither a mint attribution nor transaction totals.',
    dict(htmlSection='Section 6 — Imports, exports, and means of exchange',section='第6节 / Section 6; raw HTML lines 235–251'),
    'The variable article denotes articles used as money in the source schema. The text explicitly describes cut brass instead of coin and imports a little coin, but does not name a foreign mint or prove uniform monetary use. Foreign_coin P and article P are retained unchanged. References to month names and seasonal sailing are not converted into a precise annual shipping series.',
    [anchor(per['file'],235,251,needle='instead of coin')])

add('hawaii-constitution-legislation-records','us_hawaii_k',[7375,13677],sources[1],'direct-evidence',
    '一部法律如何形成：议事、签署与记录','Making a law: deliberation, signatures, and records',
    '1840年宪法规定代表由各岛人民选出，贵族与代表各自议事，也可合议。新法须获双方多数同意，再由国王与总理签署；两方各设书记，将决议记录成册并保存。沿着这套程序，可以读懂立法权与文字记录的关系。',
    'The 1840 constitution provides for representatives chosen by the people of the islands. Nobles and representatives deliberate separately or jointly; a new law requires both majorities and the signatures of the king and premier. Each body keeps a secretary and a preserved decision book, connecting lawmaking to written records.',
    '代表机构及立法会议条款；正式法律体系、文字记录原值均为P。档案馆扫描第5—6页（印刷页13—14）。',
    'Representative-body and legislative-meeting clauses; formal legal code and written records both have raw value P. Archive scan pages 5–6 (printed pp. 13–14).',
    dict(htmlSection='Respecting the Representative Body; Respecting the Meetings of the Legislative Body',section='代表机构与立法会议 / Representative body and legislative meetings; printed pp. 13–14'),
    'Direct evidence here is the acquired constitutional text and its prescribed record books. The formal_legal_code variable permits a unified oral legal system as well as a written one; its Chinese label follows the project’s 正式法律体系 rather than reducing the category to written codes. It does not prove that every meeting produced a surviving volume. Electoral details are left by the constitution to law; no universal franchise, actual seat totals, or fully separated modern branches are inferred. Both Polaris observations remain undated.',
    [anchor(haw['file'],162,174,needle='Secretary')],[5,6])

add('hawaii-constitution-tax-administration','us_hawaii_k',[2769,5707,5708],sources[1],'comparative-reading',
    '赋税如何逐级汇集','How taxes moved through the administration',
    '宪法让国王与总理任命税官，由税官核定税额并预先告知人民，征收后依次交给总督、总理与国王。税官还管理公共劳役，并处理部分土地纠纷。把这几项职责一起读，能看见财政、行政与裁断在同一职务中的交汇。',
    'The constitution assigns appointment of tax officers to the king and premier. Officers assess and announce taxes, then pass collections through the governor and premier to the king. They also oversee public labor and hear some land disputes, bringing finance, administration, and adjudication together in one office.',
    '税官条款；行政层级原值4—4。专职行政人员两行保留1820—1840年SA与1840—1898年P，1840年为原表交叠端点。',
    'Tax-officer clauses; administrative levels have raw range 4–4. Full-time bureaucracy retains both rows: SA for 1820–1840 and P for 1840–1898, including their shared endpoint.',
    dict(htmlSection='Respecting the Tax Officers',section='税官条款 / Tax officers; archive scan pp. 6–7 (printed pp. 14–15)'),
    'The constitution describes appointment, accountability and a payment route, not employment hours or an independently counted Seshat hierarchy. Both full_time_bureaucrat rows are deliberately associated because 1840 appears in both; no interval endpoint is repaired, no SA value is discarded, and no present/absent decision is derived from this text. Tax and land jurisdiction is separately distinguishable from ordinary judges.',
    [anchor(haw['file'],176,186,needle='Tax Officers')],[6,7])

add('hawaii-constitution-courts-appeals','us_hawaii_k',[7853,8304],sources[1],'comparative-reading',
    '从地方审理到最高法院','From local hearings to the Supreme Court',
    '各岛总督任命法官，开庭日期须预先公布。宪法把税务及部分土地纠纷另交税官处理，同时为不服裁判者设置复审途径。最高法院由国王、总理和代表机构选任的四人组成，可把这些条款与相邻税官职责连读。',
    'Island governors appoint judges, and court dates must be announced in advance. Tax and certain land disputes go to tax officers, with routes for further hearing. The Supreme Court combines the king, premier, and four people appointed by the representative body; read these clauses beside the tax officers’ jurisdiction.',
    '法官、最高法官及税官末段；关联专职法官P、专用审判建筑P。这里可比较司法职权与复审程序；专职任职和专用建筑另需材料核实。档案馆扫描第6—7页（印刷页14—15）。',
    'Judges, supreme judges, and the closing tax-officer paragraph, alongside full-time judges P and dedicated court buildings P. Compare judicial responsibilities and review procedures here; full-time service and dedicated buildings require separate evidence. Archive scan pages 6–7 (printed pp. 14–15).',
    dict(htmlSection='Of the Judges; Of the Supreme Judges',section='法官与最高法官 / Judges and supreme judges; printed p. 15'),
    'The source directly prescribes courts and judicial responsibilities, but does not establish full-time professional status, specialized court buildings, or actual caseload. The combined card is comparative to preserve those distinctions. Four appointees plus the king and premier make six members; the constitutional architecture is not described as modern judicial separation. Raw undated P entries remain unchanged.',
    [anchor(haw['file'],186,200,needle='Supreme')],[6,7])

write('catalog.json',dict(schemaVersion=1,datasetId=INDEX['datasetId'],sourceSha256=SHA,version=INDEX['version'],cards=cards,sourceManifest=PREFIX+'sources.json'))
write('claim-evidence.json',dict(schemaVersion=1,claims=claims))
prior=[]
for rel in ['readings-3.39','readings-3.40','readings-3.43','readings-3.44']:
    prior+=json.loads((ROOT/'public/data/research-evidence'/rel/'catalog.json').read_text())['cards']
assert not ({c['phaseId'] for c in prior}&set(phases))
before=dict(cards=len(prior),phases=len({c['phaseId'] for c in prior}),sources=len({c['sourceId'] for c in prior}))
additions=dict(cards=len(cards),phases=len(phases),sources=len(sources),works=2,phaseIds=phase_ids,originalSourceBytes=sum(s['bytes'] for s in sources),savedOriginalFiles=len(acquisitions),savedOriginalBytes=sum(a['bytes'] for a in acquisitions),targetRows=len({r for c in cards for r in c['targetRowIds']}))
write('coverage-audit.json',dict(schemaVersion=1,baseline=before,additions=additions,after=dict(cards=len(prior+cards),phases=len({c['phaseId'] for c in prior+cards}),sources=before['sources']+len(sources)),beforeReadingCounts={p:0 for p in phases},phaseBindings=phases,observationCountChange=0,limitations=['Two new phases improve East Africa and Polynesia coverage but only 15 of 626 Polaris phases then have guides.','Both complete acquired text bodies are English; guides are bilingual, not full new Chinese translations.','Primary texts are independent readings, not established Polaris coding sources.','The constitutional transcript and scan have documented editorial differences; neither is silently rewritten.','No new precise borders or statistical observations are inferred from these narrative and normative texts.']))
write('manifest.json',dict(schemaVersion=1,files=[{k:a[k] for k in ['file','bytes','sha256']} for a in acquisitions],totalBytes=sum(a['bytes'] for a in acquisitions)))
print(json.dumps(dict(baseline=before,additions=additions),ensure_ascii=False))
