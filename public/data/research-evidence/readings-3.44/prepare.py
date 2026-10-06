"""Prepare bounded 3.44 research candidates. Writes only beside this script.
Usage: python3 prepare.py /path/to/world-history-atlas
JavaScript source files are parsed as inert string assignments, never executed.
"""
import gzip, hashlib, json, pathlib, re, sys

ROOT = pathlib.Path(sys.argv[1]).resolve()
OUT = pathlib.Path(__file__).resolve().parent
BASE = ROOT / 'public/data/seshat-polaris-2026'
INDEX = json.loads((BASE / 'index.json').read_text())
SHA = 'cf60c9f76eeda6db545521831a9201e65c64d2b74d4aeb55445cd2b564456c41'
assert INDEX['sourceSha256'] == SHA
PREFIX = './data/research-evidence/readings-3.44/'
sha = lambda data: hashlib.sha256(data).hexdigest()
def write(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

acquisitions = json.loads((OUT / 'acquisitions.json').read_text())
acq = {a['file']:a for a in acquisitions}
for a in acquisitions:
    data = (OUT / a['file']).read_bytes()
    assert len(data) == a['bytes'] and sha(data) == a['sha256']

def raw_anchor(file, start, end, **extra):
    """One-based inclusive raw line numbers; byte offsets refer to unmodified bytes."""
    lines = (OUT / file).read_bytes().splitlines(keepends=True)
    data = b''.join(lines[start-1:end])
    return dict(file=file, rawSourceLines=[start,end], byteStart=sum(map(len,lines[:start-1])),
                byteEndExclusive=sum(map(len,lines[:end])), fragmentSha256=sha(data), **extra)

def line_anchor(file, needle, **extra):
    lines = (OUT / file).read_bytes().splitlines(keepends=True)
    hits = [n+1 for n,line in enumerate(lines) if needle.encode() in line]
    assert len(hits) == 1, (file,needle,hits)
    return raw_anchor(file,hits[0],hits[0],needle=needle,**extra)

# The host's chapter HTML explicitly points to these public data files.
parsed = []
for chapter in (16,36):
    file = f'raw/faxian-ucsd-{chapter}-data.js.txt'
    data = (OUT / file).read_bytes()
    segments = []
    for n,line in enumerate(data.splitlines(keepends=True),1):
        m = re.fullmatch(rb'(eng|schin|pin|tchin)\[(\d+)\]\s*=\s*("(?:[^"\\]|\\.)*")\s*;\s*', line)
        if not m: continue
        language,index,literal = m.groups()
        # JSON string decoding, not eval or a JavaScript runtime.
        value = json.loads(literal.decode('utf-8'))
        segments.append(dict(language=language.decode(), segment=int(index), textWithSourceHTML=value,
                             sourceSpan=raw_anchor(file,n,n)))
    expected = 38 if chapter == 16 else 12
    assert len(segments) == expected * 4
    assert all(sorted(s['segment'] for s in segments if s['language']==lang)==list(range(1,expected+1))
               for lang in ('eng','schin','pin','tchin'))
    parsed.append(dict(chapter=chapter,sourceFile=file,sourceSha256=sha(data),declaredSegments=expected,
                       parsing='Inert JSON decoding of literal assignments; source markup and spelling retained.',segments=segments))
write('verification/faxian-segments.json',dict(schemaVersion=1,chapters=parsed))

def fax_anchor(chapter, language, number):
    file = f'raw/faxian-ucsd-{chapter}-data.js.txt'
    return line_anchor(file,f'{language}[{number}]=',assignment=f'{language}[{number}]',chapter=chapter,segment=number)

intro_file = 'raw/faxian-ucsd-introduction.html.txt'
intro_anchor = [line_anchor(intro_file,needle) for needle in [
    '<h4>Translated into English by James Legge (1886)',
    'The present version is intended for class use.',
    'the simplified (red) version is mechanically transformed',
    '<dt> LEGGE, James</dt>',
]]
sources = []
for chapter in (16,36):
    a = acq[f'raw/faxian-ucsd-{chapter}-data.js.txt']
    shell = acq[f'raw/faxian-ucsd-{chapter}.html.txt']
    source = dict(sourceId=f'faxian-legge-jordan-ucsd-{chapter}',
        title=f'A Record of Buddhist Kingdoms — Chapter {chapter}',
        authors=['Faxian (author)', 'James Legge (1886 translation)', 'David K. Jordan (revised teaching edition)'],
        year=1886, publisher='David K. Jordan’s UCSD-hosted teaching website; based on the Clarendon Press edition',
        edition='Legge 1886 translation revised for teaching; chapter page states content created 2012-11-24',
        landingURL=shell['url'], version='UCSD revised teaching edition, chapter page created 2012-11-24; retrieved 2026-10-06; not an unaltered 1886 transcription',
        representation='original-javascript-data-bytes',
        attributionLocator={'supportFile':intro_file,'rawHTMLLines':[113,150,163,172,212],
                            'chapterHTML':shell['file'],'creationLine':39},
        attributionAnchors=intro_anchor,
        supportFiles=[shell,acq[intro_file]],
        authorVerification=dict(url='https://pages.ucsd.edu/~dkjordan/',accessed='2026-10-06',
            representation='web tool returned text',locator='Page heading and subheading, lines 7–8',
            excerpt='David K. Jordan; Professor Emeritus of Anthropology, UCSD'),
        scopeNotes='The account concerns a Buddhist pilgrim’s journey dated 399–414 in the introduction. Association with the Gupta phase is chronological/geographic reading context, not a named Gupta administrative survey. The edition revises English wording and notes; its simplified Chinese was mechanically converted and its place identifications were not systematically updated. Segment numbers are this teaching edition’s divisions. Downloaded JavaScript is stored as inert text and never executed.',
        acquisition=a,bytes=a['bytes'],sha256=a['sha256'],localURL=PREFIX+a['file'],
        evidenceScope='Independent reading association; Polaris source lineage not established.')
    sources.append(source)

a = acq['raw/cortes-fordham.html.txt']
sources.append(dict(sourceId='cortes-second-letter-thatcher-fordham-1907',
    title='Hernan Cortés: from Second Letter to Charles V, 1520',
    authors=['Hernán Cortés (author)', 'Oliver J. Thatcher (1907 editor)', 'Jerome S. Arkenberg (scanning and text modernization)', 'Internet History Sourcebooks Project (digital edition)'],
    year=1907,publisher='University Research Extension Co.; digital excerpt hosted by Fordham University',
    edition='The Library of Original Sources, volume V: 9th to 16th Centuries (1907), pp. 317–326; modernized electronic excerpt',
    landingURL=a['url'],version='Thatcher 1907 anthology excerpt of the 1520 letter; Arkenberg modernization, Fordham page © Paul Halsall June 1998; retrieved 2026-10-06',
    representation='original-html-bytes',attributionLocator={'rawHTMLLines':[570,577]},
    attributionAnchors=[raw_anchor(a['file'],570,573),raw_anchor(a['file'],576,577)],
    scopeNotes='Cortés addresses Charles V as a conqueror seeking royal support. His comparisons with Spain and reported crowds or territorial extent are not imported as measured population or boundary data. This saved source is the Thatcher 1907 anthology excerpt modernized by Arkenberg, not the separately available MacNutt 1908 translation; no individual translator is supplied here.',
    acquisition=a,bytes=a['bytes'],sha256=a['sha256'],localURL=PREFIX+a['file'],
    evidenceScope='Independent reading association; Polaris source lineage not established.'))
write('sources.json',dict(schemaVersion=1,sources=sources))

phases={p['id']:p for p in INDEX['polities'] if p['id'] in ['in_gupta_emp','mx_aztec_emp']}
payloads={pid:json.loads(gzip.decompress((BASE/p['file']).read_bytes())) for pid,p in phases.items()}
rows={pid:{r['raw']['variable_name']:r for r in payload['observations'] if r['raw'].get('section')=='sc'} for pid,payload in payloads.items()}
cards=[];claims=[]

def add(slug,pid,variables,source,relation,titleZh,titleEn,summaryZh,summaryEn,scopeZh,scopeEn,locator,notes,anchors):
    targets=sorted([rows[pid][variable] for variable in variables],key=lambda r:int(r['sourceRow']))
    c=dict(id=slug+'--'+pid,phaseId=pid,variableIds=variables,targetRowIds=[r['id'] for r in targets],
        relation=relation,sourceId=source['sourceId'],titleZh=titleZh,titleEn=titleEn,
        authors=source['authors'],year=source['year'],url=source['acquisition']['url'],landingURL=source['landingURL'],
        doi=None,relatedDatasetDOI=None,relatedArticleDOI=None,locator=locator,summaryZh=summaryZh,summaryEn=summaryEn,
        scopeZh=scopeZh,scopeEn=scopeEn,sourceSha256=source['sha256'],sourceBytes=source['bytes'],sourceRecordId=None,
        sourceSnapshot=source['version'],conflicts=[],sourceLineageEstablished=False,allowRecordMerge=False,
        allowRawRewrite=False,localURL=source['localURL'])
    cards.append(c)
    claims.append(dict(cardId=c['id'],targets=targets,verifiedSourceLocator=locator,reviewNotes=notes,
        sourceId=source['sourceId'],sourceAnchors=anchors,phaseBinding=phases[pid],phaseMetadata=payloads[pid]['metadata']))

add('gupta-faxian-tax-penalties','in_gupta_emp',['formal_legal_code'],sources[0],'comparative-reading',
    '法显眼中的赋税与刑罚','Tax and punishment through Faxian’s eyes',
    '法显写到耕种王地者缴纳收获的一部分，也描述依罪轻重罚钱、反复谋反者被截右手等处罚。把相邻段落连起来读，可以分清旅行见闻与成文法典各自提供的信息。',
    'Faxian describes dues from royal land, fines graded by the offence, and the cutting off of the right hand for repeated attempts at rebellion. Reading the adjacent passages together helps distinguish a travel account from a formal legal code.',
    '第16章教学版第8—13段；与笈多帝国（320—550年）的成文法典原值P对读，观察年未注明。文中的“中国”指印度中部。',
    'Chapter 16, teaching-edition segments 8–13, alongside Gupta (320–550): formal legal code P, observation date unspecified. “Middle Kingdom” here refers to central India.',
    {'htmlSection':'Chapter 16 — Condition and Customs of Central India','section':'第16章，第8—13段（教学版） / Chapter 16, segments 8–13 (teaching edition)'},
    'Comparative association only: a traveller’s account of penalties does not itself identify a formal law code. Read segment 11 together with 12 rather than infer an absolute absence of corporal punishment. The account does not name Gupta kings; phase association uses the journey’s 399–414 context and North Indian setting, without imputing uniform practice across 320–550. No absence/presence flag is altered.',
    [fax_anchor(16,lang,n) for n in [8,9,11,12,13] for lang in ['eng','schin']])

add('gupta-faxian-monastic-deeds','in_gupta_emp',['written_record'],sources[0],'direct-evidence',
    '寺院供养如何留下凭据','Recording monastic endowments',
    '第16章记述田宅、园圃与耕作资源的捐施，并以铁券记录、传付后王。将捐施凭据与随后列出的衣食卧具连读，可以理解寺院日常供养的物质基础。',
    'Chapter 16 describes gifts of fields, dwellings, gardens, and farming resources, recorded on metal plates and passed to later kings. Read these deeds beside the following account of clothing, food, and bedding to explore the material basis of monastic support.',
    '教学版第19—21段；中文原文为“铁券书录”，英译用金属板概称，对应文字记录原值P。',
    'Teaching-edition segments 19–21 accompany written records P. The Chinese specifies iron deeds; the English translation uses the broader term metal plates.',
    {'htmlSection':'Chapter 16 — Of Monks, Viharas, and Monasteries','section':'第16章，第19—21段（教学版） / Chapter 16, segments 19–21 (teaching edition)'},
    'Direct evidence means the acquired text describes a documentary practice; no original deed or archaeological metal plate has been acquired. Chinese 鐵券/铁券 must not be silently replaced with copper plates. Source observations are geographically broad and do not establish an empire-wide legal regime, a dated grant, or unbroken institutional continuity throughout the Gupta phase.',
    [fax_anchor(16,lang,n) for n in [19,20,21] for lang in ['eng','schin']])

add('gupta-faxian-vinaya-manuscripts','in_gupta_emp',['written_record','religious_literature'],sources[1],'direct-evidence',
    '从口传到抄本：法显在巴连弗求律','From oral transmission to manuscripts at Pataliputra',
    '法显先在北印度遇到师徒口传的戒律，后来在巴连弗获得律本与其他佛教文献。第9段写他停留三年学习梵语、文字并抄写戒律，呈现求书、学习与传经怎样相互衔接。',
    'Faxian first encounters Vinaya rules transmitted orally in North India, then obtains manuscripts and other Buddhist works at Pataliputra. Segment 9 describes three years learning Sanskrit language and writing and copying the Vinaya, connecting acquisition, study, and transmission.',
    '第36章教学版第1—9段；文字记录与宗教文献两项原值均为P，三年为叙事中的停留时长。',
    'Chapter 36, teaching-edition segments 1–9: written records and religious literature both have raw value P; three years is the duration reported in the narrative.',
    {'htmlSection':'Chapter 36 — In Patna; Transcription of Manuscripts and Indian Studies','section':'第36章，第1—9段（教学版） / Chapter 36, segments 1–9 (teaching edition)'},
    'Direct textual evidence of Buddhist manuscripts and copying at the place the edition identifies as Pataliputra. Oral transmission and encountered manuscripts coexist in the account; failure to find a copy in earlier places is not coded as general illiteracy. No start/end years are inferred from the three-year stay, and no verse totals are imported because English/Chinese details differ. Chapter divisions and segment numbers belong to the later edition.',
    [fax_anchor(36,lang,n) for n in [1,2,3,7,8,9] for lang in ['eng','schin']])

add('aztec-cortes-market-justice','mx_aztec_emp',['market','judge'],sources[2],'comparative-reading',
    '特诺奇蒂特兰的市场与裁断','Markets and adjudication in Tenochtitlan',
    '科尔特斯写到按货物分区的街市，以及处理争执、巡查量器的人员。把商品陈列、纠纷裁断与度量监督放在一起，可以读出市场秩序的几个层面。',
    'Cortés describes merchandise grouped by street, people deciding disputes, and inspectors checking measures. Read the arrangement of goods alongside adjudication and inspection to explore several layers of market order.',
    '1520年第二封信的市场段落；与阿兹特克帝国的市场P、法官P两项原记录对读。',
    'Market passages in the Second Letter of 1520, alongside Aztec raw rows for markets P and judges P.',
    {'htmlSection':'Market squares; merchandise streets; audience house and measures','section':'市场段落 / Market passages (raw HTML lines 297–344)'},
    'Comparative for the combined card: magistrates are described, but their professional/full-time status is not established here. The passage reports a crowd in a market square, not total urban population; the crowd estimate is deliberately not imported. Cortés is a colonial observer addressing the king, and Spanish analogies are his framing rather than neutral classifications. The original phase end 1526 is retained, not silently changed to the conquest date.',
    [raw_anchor(a['file'],297,316,needle='This city has many public squares'),raw_anchor(a['file'],337,344,needle='magistrates')])

add('aztec-cortes-tribute-records','mx_aztec_emp',['mnemonic_device','nonwritten_record','written_record'],sources[2],'comparative-reading',
    '贡赋如何记在纸上','Recording tribute on paper',
    '信中描述各省按本地出产纳贡，并用纸上的符号与图像记录应纳物品。结合文字、非文字记录与助记工具三类条目，可以追问同一种记录方式在不同分类中如何被描述。',
    'The letter describes provinces rendering local products and recording their obligations with characters and figures on paper. Read this beside written records, non-written records, and mnemonic devices to examine how recording practices are classified.',
    '贡赋段落；助记工具P、非文字记录P、文字记录A均保留为原始编码。',
    'Tribute passage; mnemonic devices P, non-written records P, and written records A are preserved as raw coding.',
    {'htmlSection':'Provincial governors, tribute collectors, and records on paper','section':'贡赋与纸面记录 / Tribute and paper records (raw HTML lines 471–480)'},
    'A comparative question about coding categories, not a claim that this passage establishes workbook lineage or proves the A entry erroneous. Characters and figures are the translation’s terms; no phonetic decipherment, literacy rate, surviving codex identification, or empire boundary is inferred. All original raw values and cell types, including written_record A, remain intact.',
    [raw_anchor(a['file'],471,480,needle='characters and figures made on paper')])

write('catalog.json',dict(schemaVersion=1,datasetId=INDEX['datasetId'],sourceSha256=SHA,version=INDEX['version'],cards=cards,sourceManifest=PREFIX+'sources.json'))
write('claim-evidence.json',dict(schemaVersion=1,claims=claims))
prior=[]
for release in ['readings-3.39','readings-3.40','readings-3.43']:
    prior+=json.loads((ROOT/'public/data/research-evidence'/release/'catalog.json').read_text())['cards']
priorPhases={c['phaseId'] for c in prior}
assert not (priorPhases & set(phases))
baseline=dict(cards=len(prior),phases=len(priorPhases),sources=len({c['sourceId'] for c in prior}))
additions=dict(cards=len(cards),phases=len(phases),sources=len(sources),works=2,phaseIds=list(phases),
    originalSourceBytes=sum(s['bytes'] for s in sources),savedOriginalFiles=len(acquisitions),
    savedOriginalBytes=sum(a['bytes'] for a in acquisitions),targetRows=len({r for c in cards for r in c['targetRowIds']}))
write('coverage-audit.json',dict(schemaVersion=1,baseline=baseline,additions=additions,
    after=dict(cards=len(prior)+len(cards),phases=len(priorPhases|set(phases)),sources=baseline['sources']+len(sources)),
    beforeReadingCounts={p:sum(c['phaseId']==p for c in prior) for p in phases},phaseBindings=phases,observationCountChange=0,
    limitations=['Two works are represented by three source entries because two Faxian chapters have separate immutable payloads.',
        'All five guides are bilingual; this batch does not newly translate the complete originals.',
        'These sources are independent reading aids, not proven Polaris coding sources.',
        'Neither travel account is a statistical survey; whole-phase continuity, population totals and exact territorial geometry are not established.',
        'UCSD source bodies require the explicitly linked JavaScript data files; original chapter HTML alone contains no body.',
        'Both scholarly teaching editions revise older translations; their edition metadata and revision roles are retained.']))
write('manifest.json',dict(schemaVersion=1,files=[{k:a[k] for k in ['file','bytes','sha256']} for a in acquisitions],totalBytes=sum(a['bytes'] for a in acquisitions)))
print(json.dumps(dict(baseline=baseline,additions=additions,writeDirectory=str(OUT)),ensure_ascii=False))
