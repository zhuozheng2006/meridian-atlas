"""Reproducible city layers. Never infer a settlement lifespan from sparse evidence.

Requires the pinned OpenCC dependency. Input, output and rule directories are explicit.
Run fetch_inputs.py --verify-only first; raw source files are never modified.
"""
import argparse, csv, gzip, hashlib, io, json, math, pathlib, re, unicodedata, zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from opencc import OpenCC

HERE = pathlib.Path(__file__).resolve().parent
parser=argparse.ArgumentParser(description='Build conservative historical-place layers from verified input files.')
parser.add_argument('--input-dir',type=pathlib.Path,required=True)
parser.add_argument('--output-dir',type=pathlib.Path,required=True)
parser.add_argument('--rules-dir',type=pathlib.Path,default=HERE/'rules')
parser.add_argument('--manifest',type=pathlib.Path,default=HERE/'input-manifest.json')
parser.add_argument('--built-at',help='Fixed ISO timestamp for snapshot reproduction; default is current UTC time.')
args=parser.parse_args()
ROOT=args.input_dir.resolve()
OUT=args.output_dir.resolve()
RULES=args.rules_dir.resolve()
OUT.mkdir(parents=True,exist_ok=True)
LOCK=json.loads(args.manifest.read_text())
for item in LOCK['sourceFiles']:
    h=hashlib.sha256()
    with (ROOT/item['name']).open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    if h.hexdigest()!=item['sha256']:raise ValueError('Source drift: '+item['name'])
for item in LOCK['wikidataCities']:
    entity=json.loads((ROOT/'wikidata-cities'/(item['qid']+'.json')).read_text())['entities'][item['qid']]
    actual=hashlib.sha256(json.dumps(entity,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    if actual!=item['canonicalEntitySha256']:raise ValueError('Source drift: '+item['qid'])
locked_claims=json.loads((ROOT/'capital-claims.json').read_text())
claims_hash=hashlib.sha256(json.dumps(locked_claims,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
if claims_hash!=LOCK['capitalClaimsCanonicalSha256']:raise ValueError('Capital claims differ from locked profile extraction')
SC = OpenCC('t2s')
NOW = args.built_at or datetime.now(timezone.utc).isoformat()
EDITORIAL_NAMES = {
    'Tombouctou':'廷巴克图', 'Timbuktu':'廷巴克图',
    'Roma':'罗马', 'Athenae':'雅典', 'Pompeii':'庞贝', 'Poseidonia/Paestum':'波塞冬尼亚／帕埃斯图姆',
    'Veii':'维伊', 'Ilium/Troia':'伊利昂／特洛伊', 'Carthago':'迦太基', 'Pergamum':'帕加马',
    'Capua':'卡普阿', 'Olynthos':'奥林索斯', 'Ravenna':'拉文纳', 'Cyrene':'昔兰尼', 'Delphi':'德尔斐',
    'Eleusis':'厄琉息斯', 'Londinium/Augusta':'伦迪尼乌姆／奥古斯塔', 'Nineveh/Ninos':'尼尼微',
    'Dur-Sharrukin':'杜尔沙鲁金', 'Damascus':'大马士革', 'Memphis':'孟菲斯', 'Babylon':'巴比伦',
    'Byzantium':'拜占庭', 'Thebai/Thebae':'底比斯', 'Diospolis Magna/Thebai':'底比斯',
    'Samaria/Sebaste':'撒马利亚／塞巴斯特', 'Peiraieus/Piraeus':'比雷埃夫斯',
    'Carthage':'迦太基','Ur':'乌尔','Uruk':'乌鲁克','Lagash':'拉伽什','Girsu':'吉尔苏','Mari':'马里','Susa':'苏萨',
    'Nineveh':'尼尼微','Hattusa':'哈图沙','Ecbatana':'埃克巴坦那','Ctesiphon':'泰西封','Seleucia':'塞琉西亚',
    'Thebes':'底比斯','Avaris':'阿瓦里斯','Pi-Ramesses':'比兰塞','Antioch':'安条克','Ephesus':'以弗所',
    'Smyrna':'士麦那','Corinth':'科林斯','Angkor':'吴哥','Pataliputra':'华氏城','Vaishali':'毗舍离',
    'Rajagriha':'王舍城','Taxilla':'塔克西拉','Mohenjo Daro':'摩亨佐达罗','Harappa':'哈拉帕',
    'Xian':'西安','Linzi':'临淄','Maoling':'茂陵','Qufu':'曲阜','Xinzheng':'新郑','Yin':'殷',
    'Anyi':'安邑','Shangqi':'商丘','Chinkiang':'镇江','Tsinkiang':'晋江','Kashi':'喀什',
    'Teotihuacan':'特奥蒂瓦坎','Tikal':'蒂卡尔','Caracol':'卡拉科尔','Cahokia':'卡霍基亚',
    'Tenochtitlan':'特诺奇蒂特兰','Cuzco':'库斯科','Cusco':'库斯科','Tiahuanaco':'蒂亚瓦纳科',
    'Merv':'梅尔夫','Kufa':'库法','Rayy':'雷伊','Nara City':'奈良','Cordoba':'科尔多瓦',
    'Esfahan':'伊斯法罕','Liege':'列日','Augsberg':'奥格斯堡','Edessa':'埃德萨','Nicomedia':'尼科米底亚',
    'Kanauji':'曲女城','Kanauji, Kanauj':'曲女城','Manyakheta':'摩尼耶凯塔','Prambanan':'普兰巴南',
    'Osaka':'大阪','Sao Paolo':'圣保罗','Calcutta':'加尔各答','Bogota':'波哥大','Ruhr':'鲁尔区',
    'Madras':'马德拉斯','Ho Chi Minh':'胡志明市','Bangalore':'班加罗尔','Washington D.C.':'华盛顿',
    'Ahmadabad':'艾哈迈达巴德','Montreal':'蒙特利尔','Brussel':'布鲁塞尔','Brasilia':'巴西利亚',
    'Minneapolis':'明尼阿波利斯','Medellin':'麦德林','Nizhniy Novgorod':'下诺夫哥罗德',
    'Frankfurt am Main':'美因河畔法兰克福','Kharkov':'哈尔科夫','Tianmen':'天门','Xinghua':'兴化',
    'Kobe':'神户','Kitakyushu':'北九州','Suizhou':'随州','Taian':'泰安','Danzhou':'儋州','Chittagong':'吉大港',
    'Jilin':'吉林','Zhongshan':'中山','Belem':'贝伦','Dongtai':'东台','Kansas City':'堪萨斯城',
    'Dnipropetrovsk':'第聂伯罗彼得罗夫斯克', "Sverdlovs'k":'斯维尔德洛夫斯克'
}
EDITORIAL_BY_ID={'727070':'亚历山大港','687928':'耶路撒冷','413096':'克卢西乌姆','550867':'萨迪斯','609393':'戈尔迪翁'}
QUARANTINED_PERIODS={
    '520998': {'period':'1200-bc-middle-east','originalRange':[-1200,-1199],
        'sourceUrl':'https://pleiades.stoa.org/places/520998',
        'sourceDescription':'Capital city of the Eastern Roman Empire, the Latin, and the Ottoman Empires founded by Constantine I in AD 330.',
        'reason':'The name Kōnstantinoupolis has a 1200 BCE vocabulary attestation, while this same place record explicitly describes Constantinople as founded in AD 330. The contradictory BCE attestation is withheld from derived display periods; no replacement year is guessed.'},
    '211425280': {'period':'1200-bc-middle-east','originalRange':[-1200,-1199],
        'sourceUrl':'https://pleiades.stoa.org/places/211425280',
        'sourceDescription':'A settlement on Ābādān island, which is located at the head of the Persian Gulf. The name of the city derives from that of the island; the city is first mentioned by this name in the 9th century CE.',
        'reason':'The representative-point record dates this name to 1200 BCE although its own description says the name is first mentioned in the ninth century CE. The incompatible name attestation is withheld, without inferring when the settlement was founded or changing the date to a guessed CE year.'}
}
quarantined_attestations=[]
TYPE_QUARANTINE=json.loads((RULES/'type-quarantine-rules.json').read_text())
TYPE_QUARANTINE_IDS={x['placeId'].split(':')[1] for x in TYPE_QUARANTINE}
EDITORIAL_ALIASES=json.loads((RULES/'editorial-aliases.json').read_text())
editorial_by_place={x['placeId']:x for x in EDITORIAL_ALIASES['entries']}

def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()

def write(name, value):
    payload = compact(value)
    (OUT / (name + '.json')).write_bytes(payload)
    (OUT / (name + '.json.gz')).write_bytes(gzip.compress(payload, compresslevel=9, mtime=0))

def norm(s):
    return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower())

def sane_point(p):
    return isinstance(p, (list, tuple)) and len(p) >= 2 and all(isinstance(v, (int, float)) and math.isfinite(v) for v in p[:2]) and -180 <= p[0] <= 180 and -90 <= p[1] <= 90

def distance(a, b):
    # Only used for an additional conservative identity check after exact name match.
    p1, p2 = math.radians(a[1]), math.radians(b[1])
    h = math.sin((p2-p1)/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(math.radians(b[0]-a[0])/2)**2
    return 12742 * math.asin(min(1, math.sqrt(h)))

def bound(text):
    m = re.search(r'(\d+)', text or '')
    if not m:
        return None
    y = int(m.group(1))
    return -y if 'BC' in text else y

def cite_links(refs):
    links = []
    for ref in refs:
        for key in ('accessURI', 'bibliographicURI', 'alternateURI'):
            u = ref.get(key)
            if isinstance(u, str) and u.startswith(('https://','http://')) and u not in links:
                links.append(u)
    return links

sources = {
    'pleiades': {'name':'Pleiades gazetteer of ancient places', 'url':'https://pleiades.stoa.org/downloads', 'download':'https://atlantides.org/downloads/pleiades/json/pleiades-places-latest.json.gz', 'license':'CC BY 3.0', 'licenseUrl':'https://creativecommons.org/licenses/by/3.0/', 'attribution':'Pleiades contributors, Ancient World Mapping Center and Institute for the Study of the Ancient World', 'timeMeaning':'Attestation in a named historical period, not a year-exact lifespan or proof of uninterrupted occupation.', 'transformation':'Settlement places only; certain point locations at stated accuracy <= 10 km with confident attestation periods. A separate name-period-attestation class uses source representative points and dated names, with unknown metric accuracy retained as null. No smoothing or gap filling.'},
    'natural-earth': {'name':'Natural Earth 1:10m populated places', 'url':'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-populated-places/', 'download':'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places.geojson', 'license':'Public domain', 'licenseUrl':'https://www.naturalearthdata.com/about/terms-of-use/', 'attribution':'Made with Natural Earth', 'timeMeaning':'Modern reference gazetteer. No founding year or historical existence is inferred.', 'transformation':'Selected fields; source coordinates retained; Chinese converted to Simplified with OpenCC.'},
    'wikidata-capitals': {'name':'Wikidata dated capital statements', 'url':'https://www.wikidata.org/wiki/Property:P36', 'license':'CC0', 'licenseUrl':'https://www.wikidata.org/wiki/Wikidata:Licensing', 'attribution':'Wikidata contributors', 'timeMeaning':'Only bounded capital-tenure intervals or explicit point dates; no city lifespan is inferred.', 'transformation':'Year-or-finer qualifiers retained. Unscoped, open-ended, deprecated, ambiguous, and date-inverted statements excluded. Coordinate QIDs matched exactly.'},
}
for key, article, filename in [('chandler',2059494,'chandlerV2.csv'),('modelski-ancient',2059497,'modelskiAncientV2.csv'),('modelski-modern',2059500,'modelskiModernV2.csv')]:
    sources[key] = {'name':{'chandler':'Chandler historical urban population, digitized by Reba et al.','modelski-ancient':'Modelski ancient urban population, digitized by Reba et al.','modelski-modern':'Modelski modern urban population, digitized by Reba et al.'}[key], 'url':f'https://doi.org/10.6084/m9.figshare.{article}', 'doi':f'https://doi.org/10.6084/m9.figshare.{article}', 'paper':'https://doi.org/10.1038/sdata.2016.34', 'license':'CC BY 4.0', 'licenseUrl':'https://creativecommons.org/licenses/by/4.0/', 'attribution':'Meredith Reba, Femke Reitsma and Karen C. Seto (2016). Spatializing 6,000 years of global urbanization from 3700 BC to AD 2000. Scientific Data 3, 160034.', 'timeMeaning':'Discrete city population observations. Neither a city lifespan nor continuous annual population estimates.', 'file':filename, 'transformation':'Empty cells omitted; coordinates and certainty codes retained; no interpolation. Modelski modern China observation year uses the paper documented 1990 census date instead of the generic AD_2000 column.'}

ne_raw = json.loads((ROOT/'ne_10m_populated_places.geojson').read_text())['features']
modern = []
ne_by_qid, ne_by_name = {}, defaultdict(list)
for f in ne_raw:
    p, point = f['properties'], f['geometry']['coordinates']
    if not sane_point(point):
        continue
    row = {'id':'ne:'+str(p['NE_ID']), 'source':'natural-earth', 'kind':'modern-reference', 'name':p.get('NAME_EN') or p['NAME'], 'nameZh':SC.convert(p.get('NAME_ZH') or ''), 'coordinates':point, 'minZoom':p.get('MIN_ZOOM'), 'scaleRank':p.get('SCALERANK'), 'capital':bool(p.get('ADM0CAP')), 'worldCity':bool(p.get('WORLDCITY')), 'populationReference':p.get('POP_MAX'), 'country':p.get('ADM0NAME'), 'countryCode':p.get('ISO_A2'), 'qid':p.get('WIKIDATAID'), 'timeBasis':'modern-reference-only', 'nameBasis':'modern-gazetteer'}
    modern.append(row)
    if row['qid']:
        ne_by_qid[row['qid']] = row
    for n in set([p.get('NAME_EN'),p.get('NAME'),p.get('NAMEASCII')]):
        if norm(n): ne_by_name[norm(n)].append(row)
write('modern-cities', {'schemaVersion':1,'source':'natural-earth','timeBasis':'modern-reference-only','cities':modern})

with zipfile.ZipFile(ROOT/'pleiades_gis_data.zip') as z:
    periods = list(csv.DictReader(io.StringIO(z.read('data/gis/time_periods.csv').decode('utf-8-sig'))))
    place_precision={p['id']:p['location_precision'] for p in csv.DictReader(io.StringIO(z.read('data/gis/places.csv').decode('utf-8-sig')))}
period_by_id = {p['key']:{'start':bound(p['lower_bound']),'end':bound(p['upper_bound']),'name':p['term'],'uri':'https://pleiades.stoa.org/vocabularies/time-periods/'+p['key']} for p in periods}
bad_periods = [k for k,p in period_by_id.items() if p['start'] is None or p['end'] is None or p['start'] > p['end']]
for k in bad_periods: del period_by_id[k]

def attestation_periods(obj,place_id=None):
    result = []
    for a in obj.get('attestations', []):
        if a.get('confidence') not in ('confident', 'confident-inferred'):
            continue
        key = a.get('timePeriod')
        quarantine=QUARANTINED_PERIODS.get(place_id)
        if quarantine and key==quarantine['period']:
            quarantined_attestations.append({'placeId':'pleiades:'+place_id,'objectUrl':obj.get('uri'),'objectType':obj.get('@type'),'originalName':obj.get('romanized') or obj.get('title'),'originalAttestation':a,**quarantine})
            continue
        p = period_by_id.get(key)
        if p:
            s,e = p['start'],p['end']
            # Location/name min/max dates summarize these same terms. Intersect,
            # but never bridge two disconnected vocabulary periods.
            if isinstance(obj.get('start'),(int,float)): s = max(s,int(obj['start']))
            if isinstance(obj.get('end'),(int,float)): e = min(e,int(obj['end']))
            if s <= e and s != 0 and e != 0:
                result.append([s,e,key])
    return sorted({tuple(p) for p in result})

pleiades_raw = json.loads(gzip.decompress((ROOT/'pleiades-places-latest.json.gz').read_bytes()))['@graph']
historical, omitted = [], Counter()
for p in pleiades_raw:
    if 'settlement' not in p.get('placeTypes',[]): continue
    if p['id'] in TYPE_QUARANTINE_IDS:
        omitted['explicit_feature_type_conflict'] += 1
        continue
    locs = []
    for loc in p.get('locations',[]):
        geom = loc.get('geometry') or {}
        accuracy = loc.get('accuracy_value')
        if loc.get('associationCertainty') != 'certain' or geom.get('type') != 'Point' or not sane_point(geom.get('coordinates')):
            continue
        if not isinstance(accuracy,(int,float)) or accuracy <= 0 or accuracy > 10000:
            continue
        spans = attestation_periods(loc,p['id'])
        if not spans: continue
        locs.append({'coordinates':geom['coordinates'][:2],'accuracyMeters':accuracy,'periods':spans,'sourceUrl':loc.get('uri'),'accuracySource':loc.get('accuracy')})
    names=[]
    for n in p.get('names',[]):
        if n.get('nameType') != 'geographic' or n.get('associationCertainty') != 'certain': continue
        spans=attestation_periods(n,p['id'])
        if not spans: continue
        text = n.get('romanized') or n.get('attested')
        if not text: continue
        names.append({'name':text,'original':n.get('attested'),'language':n.get('language'),'periods':spans,'sourceUrl':n.get('uri')})
    # Some central place concepts (Rome and Athens, for example) have no direct
    # location: Pleiades calculates a representative point from related sites.
    # Preserve that explicit source point and attested names as a separate,
    # lower-precision evidence class, never as a meter-accurate settlement pin.
    evidence='location-period-attestation'
    if not locs and sane_point(p.get('reprPoint')) and 'unlocated' not in p.get('placeTypes',[]) and names:
        spans=sorted({tuple(a) for n in names for a in n['periods'] if a[0]<1700})
        if spans:
            locs=[{'coordinates':p['reprPoint'][:2],'accuracyMeters':None,'periods':spans,'sourceUrl':p['uri'],'accuracySource':None,'coordinateQuality':place_precision.get(p['id']),'timeEvidence':'name-attestation-at-source-representative-point'}]
            evidence='name-period-attestation'
    if not locs:
        omitted['settlements_without_qualified_point_and_period'] += 1
        continue
    locs.sort(key=lambda x:x['accuracyMeters'] if x['accuracyMeters'] is not None else 999999)
    qids=[]
    for ref in p.get('references',[]):
        for uri in cite_links([ref]):
            m=re.search(r'wikidata\.org/(?:wiki/|entity/)(Q\d+)',uri)
            if m and m.group(1) not in qids: qids.append(m.group(1))
    modern_match=next((ne_by_qid[q] for q in qids if q in ne_by_qid),None)
    authors=list(dict.fromkeys(x.get('name') for x in p.get('creators',[])+p.get('contributors',[]) if x.get('name')))
    editorial=editorial_by_place.get('pleiades:'+p['id'])
    zh=(editorial or {}).get('nameZh') or EDITORIAL_BY_ID.get(p['id']) or EDITORIAL_NAMES.get(p['title'].strip(),'')
    accuracies=[l['accuracyMeters'] for l in locs if l['accuracyMeters'] is not None]
    row={'id':'pleiades:'+p['id'],'source':'pleiades','kind':'attested-settlement','name':p['title'].strip(),'nameZh':zh,'translationSource':'editorial-Chinese-name' if zh else None,'nameBasis':'source-catalog-title','coordinates':locs[0]['coordinates'],'locations':locs,'periods':sorted({tuple(a) for l in locs for a in l['periods']}),'names':names,'sourceUrl':p['uri'],'description':p.get('description',''),'referenceUrls':cite_links(p.get('references',[])),'authors':authors,'qids':qids,'referenceCount':len(p.get('references',[])),'timeBasis':'period-attestation','timeEvidence':evidence,'minAccuracyMeters':min(accuracies) if accuracies else None,'coordinateQuality':place_precision.get(p['id'])}
    if modern_match:
        row['modernNameReference']={'name':modern_match['name'],'nameZh':modern_match['nameZh'],'qid':modern_match['qid'],'source':'natural-earth','matchBasis':'Pleiades related Wikidata reference; not asserted sameAs'}
    if editorial:
        row['editorialNameEvidence']=editorial
    historical.append(row)
write('historical-settlements',{'schemaVersion':1,'source':'pleiades','timeBasis':'period-attestation','periods':period_by_id,'places':historical})
historical_index=[]
for i,p in enumerate(historical):
    row={k:p[k] for k in ['id','source','kind','name','nameZh','coordinates','periods','referenceCount','timeBasis','timeEvidence','minAccuracyMeters','coordinateQuality','sourceUrl']}
    aliases=[p['name'],p['nameZh']]
    aliases.extend(p.get('editorialNameEvidence',{}).get('searchAliases',[]))
    for n in p['names']:
        aliases.extend([n.get('name'),n.get('original')])
    # Search vocabulary is not a selected-year historical name. Include only
    # names explicitly attached to this Pleiades place and checked translations;
    # never promote a related Wikidata modernNameReference into a sameAs alias.
    seen=set();row['searchAliases']=[]
    for alias in aliases:
        if not isinstance(alias,str) or not alias.strip():continue
        for variant in [alias.strip(),SC.convert(alias.strip())]:
            key=unicodedata.normalize('NFKC',variant).casefold()
            if key not in seen:
                seen.add(key);row['searchAliases'].append(variant)
    # Keep all time-qualified alternative points, not only a static centroid.
    row['locations']=[{k:l[k] for k in ['coordinates','accuracyMeters','periods']} for l in p['locations']]
    row['detailsShard']=i//256
    historical_index.append(row)
for start in range(0,len(historical),256):
    write(f'settlements-{start//256:03}',{p['id']:p for p in historical[start:start+256]})
write('historical-settlements-index',{'schemaVersion':1,'source':'pleiades','timeBasis':'period-attestation','periods':period_by_id,'places':historical_index})

urban=[]
urban_issues=[]
for source_id in ['chandler','modelski-ancient','modelski-modern']:
    rows=list(csv.DictReader((ROOT/sources[source_id]['file']).open(encoding='cp1252'),skipinitialspace=True))
    for i,p in enumerate(rows):
        try: point=[float(p['Longitude']),float(p['Latitude'])]
        except (ValueError,TypeError):
            urban_issues.append([source_id,i,'missing coordinates']);continue
        if not sane_point(point):
            urban_issues.append([source_id,i,'invalid coordinates']);continue
        observations=[]
        for k,v in p.items():
            if not k or not re.fullmatch(r'(BC|AD)_\d+',k) or not v or not v.strip(): continue
            try: pop=float(v.replace(',',''))
            except ValueError:
                urban_issues.append([source_id,i,k,v]);continue
            if not math.isfinite(pop) or pop <= 0:continue
            y=int(k.split('_')[1])*(-1 if k.startswith('BC') else 1)
            if source_id=='modelski-modern' and p['Country'].strip()=='China': y=1990
            observations.append([y,int(pop) if pop.is_integer() else pop])
        if not observations:continue
        name=p['City'].strip()
        matches=[x for x in ne_by_name.get(norm(name),[]) if distance(point,x['coordinates'])<=15]
        match=matches[0] if len(matches)==1 else None
        zh=EDITORIAL_NAMES.get(name) or (match['nameZh'] if match else '')
        urban.append({'id':source_id+':'+str(i+1),'source':source_id,'kind':'urban-observation','name':name,'nameZh':zh, 'nameBasis':'research-source-city-name','coordinates':point,'coordinateCertaintyCode':p.get('Certainty'),'countryReference':p.get('Country'),'otherNames':p.get('OtherName'),'observations':sorted(observations),'qid':match['qid'] if match else None,'translationSource':'editorial-Chinese-name' if name in EDITORIAL_NAMES else ('natural-earth-exact-name-and-nearby-coordinate' if match else None),'timeBasis':'discrete-observations','sourceUrl':sources[source_id]['doi']})
dated_names=json.loads((RULES/'dated-place-names.json').read_text())
for row in urban:
    matched=[x for x in dated_names['entries'] if x['recordId']==row['id']]
    if matched:row['datedNames']=matched
write('urban-observations',{'schemaVersion':1,'timeBasis':'discrete-observations','cities':urban})

capital_claims=json.loads((ROOT/'capital-claims.json').read_text())
capitals=[]
capital_issues=[]
for x in capital_claims:
    c=x['capital']; qid=c.get('value',{}).get('id')
    if c['rank']=='deprecated' or c['temporalScope'] not in ('bounded','point') or not qid:continue
    tm=c['temporal']; start=tm['start'];end=tm['end'];point=tm['point']
    if c['temporalScope']=='bounded' and len(start)==len(end)==1 and start[0]['precision']>=9 and end[0]['precision']>=9:
        s,e=start[0]['civilYear'],end[0]['civilYear']; dates=[start[0],end[0]]
    elif c['temporalScope']=='point' and len(point)==1 and point[0]['precision']>=9:
        s=e=point[0]['civilYear'];dates=point
    else:capital_issues.append([c['statementId'],'ambiguous or low-precision date']);continue
    if s>e or not s or not e:
        capital_issues.append([c['statementId'],'invalid date bounds']);continue
    ne=ne_by_qid.get(qid)
    entity=None
    coord_claim=None
    if ne:
        coords=ne['coordinates']; coord_source='natural-earth';coord_url=sources['natural-earth']['url'];revision=None
    else:
        f=ROOT/'wikidata-cities'/(qid+'.json')
        if not f.exists():capital_issues.append([qid,'missing entity']);continue
        entity=json.loads(f.read_text())['entities'][qid]
        choices=[]
        for cl in entity.get('claims',{}).get('P625',[]):
            val=cl.get('mainsnak',{}).get('datavalue',{}).get('value',{})
            if cl.get('rank')=='deprecated' or not isinstance(val,dict) or not val.get('globe','').endswith('/Q2'):continue
            coords=[val.get('longitude'),val.get('latitude')]
            if sane_point(coords):choices.append((cl,coords,val))
        if not choices:capital_issues.append([qid,'no valid Earth coordinate']);continue
        preferred=[a for a in choices if a[0].get('rank')=='preferred']
        choices=preferred or choices
        if len(choices)>1 and any(distance(choices[0][1],a[1])>10 for a in choices[1:]):
            capital_issues.append([qid,'conflicting coordinates']);continue
        coord_claim,coords,val=choices[0]; coord_source='wikidata';coord_url='https://www.wikidata.org/wiki/'+qid+'#P625';revision=entity.get('lastrevid')
    # Some polity snapshots retain only the capital QID. The pinned coordinate
    # entity also carries verified labels; use that same revision instead of
    # exposing an internal identifier as a city name.
    labels=c['value'].get('label') or {}
    entity_labels=(entity or {}).get('labels',{})
    def named(value):
        return value if value and not re.fullmatch(r'Q\d+',value) else None
    english=named(labels.get('en')) or named((ne or {}).get('name')) or entity_labels.get('en',{}).get('value') or entity_labels.get('mul',{}).get('value')
    chinese=labels.get('zh') or (ne or {}).get('nameZh') or entity_labels.get('zh-hans',{}).get('value') or entity_labels.get('zh-cn',{}).get('value') or entity_labels.get('zh',{}).get('value') or ''
    if not english:
        capital_issues.append([qid,'missing readable label']);continue
    qualifiers=[q for q in c.get('qualifiers',[]) if q.get('property') not in ('P580','P582','P585')]
    capitals.append({'id':'capital:'+c['statementId'],'source':'wikidata-capitals','kind':'dated-capital','qid':qid,'name':english,'nameZh':SC.convert(chinese),'coordinates':coords,'periods':[[s,e]],'dates':dates,'polityQid':x['polity'],'polityLabels':x['polityLabel'],'timeBasis':'capital-tenure' if s!=e else 'capital-point-date','nameBasis':'entity-label-not-dated-historical-name','sourceUrl':c['sourceUrl'],'statementId':c['statementId'],'referencePresence':c['referencePresence'],'referenceUrls':list(dict.fromkeys(link['url'] for r in c.get('references',[]) for link in r.get('links',[]) if link.get('url'))),'qualifiers':qualifiers,'coordinateSource':coord_source,'coordinateUrl':coord_url,'coordinateRevision':revision,'coordinateClaim':coord_claim,'displayPolicy':'Label as capital record; retain source status. No city lifespan inferred.'})
for row in capitals:
    matched=[x for x in dated_names['entries'] if x['recordId']==row['id']]
    if matched:row['datedNames']=matched
write('historical-capitals',{'schemaVersion':1,'timeBasis':'explicit-capital-qualifiers','claims':capitals})
write('editorial-aliases',EDITORIAL_ALIASES)
quarantine_entries=[{**x,'issueType':'source-date-conflict','scope':'single-attestation'} for x in quarantined_attestations]+TYPE_QUARANTINE
write('city-quarantine',{'schemaVersion':1,'source':'pleiades','license':'CC BY 3.0','rawSourceUnmodified':True,'policy':'Withhold explicit internally contradictory source attestations and clearly identified non-settlement geographic features. Do not guess corrected years or remove documented settlements merely because they lie on a mountain. Other coarse source periods remain coarse.','entries':quarantine_entries})

manifest={'schemaVersion':1,'builtAt':NOW,'sources':sources,'files':{},'counts':{'pleiadesSourcePlaces':len(pleiades_raw),'pleiadesSettlementPlaces':sum('settlement' in p.get('placeTypes',[]) for p in pleiades_raw),'qualifiedHistoricalSettlements':len(historical),'historicalSettlementLocations':sum(len(p['locations']) for p in historical),'modernCities':len(modern),'urbanObservationCityRows':len(urban),'populationObservations':sum(len(p['observations']) for p in urban),'datedCapitalClaims':len(capitals),'datedCapitalCities':len({p['qid'] for p in capitals}),'capitalClaimsWithCitedSource':sum(p['referencePresence']=='cited_source' for p in capitals)},'omissions':{'pleiades':dict(omitted),'invalidVocabularyPeriods':bad_periods,'urbanRows':urban_issues,'capitalClaims':capital_issues},'selectionPolicy':{'historicalSettlements':'Require selected year inside a retained per-location attestation period. The period is coarse evidence; do not present its limits as exact founding/destruction dates. Choose the best-accuracy matching point.', 'urbanObservations':'Display only observations within an explicitly labeled user-selected time window, or at exact observation years. Never infer continuous existence or interpolate populations. Keep observation year visible.', 'capitals':'Require selected year inside explicit tenure interval (or equal point date); preserve polity relation and reference status. Do not substitute polity lifespan for missing capital qualifiers.', 'modernCities':'Off by default in historical mode; user may enable a clearly labeled modern reference layer. No historical dates are assigned.'}}
for name in ['pleiades-places-latest.json.gz','pleiades_gis_data.zip','ne_10m_populated_places.geojson','chandlerV2.csv','modelskiAncientV2.csv','modelskiModernV2.csv']:
    data=(ROOT/name).read_bytes();manifest['files'][name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
manifest['searchPolicy']={'searchAliases':'Deduplicated Pleiades names, original written forms, and editorial Chinese translations. Name aliases support discovery only; each original name retains its own attestation dates in lazy detail. Related modernNameReference is deliberately excluded.','aliasCount':sum(len(p['searchAliases']) for p in historical_index),'representativePointSourceUrls':'Canonical Pleiades source URLs are included in the lightweight index before full detail loading.'}
manifest['quarantine']={'file':'city-quarantine.json.gz','placeCount':len({x['placeId'] for x in quarantine_entries}),'attestationCount':len(quarantined_attestations),'featureTypeExclusionCount':len(TYPE_QUARANTINE),'originalRangesUnmodifiedInRawSource':True,'reason':'Explicit internal date contradictions or non-settlement feature identity in the source title/description.'}
manifest['editorialAliases']={'file':'editorial-aliases.json.gz','entryCount':len(EDITORIAL_ALIASES['entries']),'timeBasis':'Undated display/search translations; no inferred historical lifespan or identity merge.'}
for f in OUT.glob('*.gz'):
    if f.name=='city-sources.json.gz':continue
    manifest['files'][f.name]={'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()}
write('city-sources',manifest)
print(json.dumps(manifest['counts'],ensure_ascii=False,indent=2))
print(json.dumps({f.name:f.stat().st_size for f in OUT.glob('*.gz')},indent=2))
