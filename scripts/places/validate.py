import argparse, gzip, hashlib, json, math, pathlib
from collections import Counter
parser=argparse.ArgumentParser(description='Validate generated place data and original CSV checksums.')
parser.add_argument('--input-dir',type=pathlib.Path,required=True)
parser.add_argument('--output-dir',type=pathlib.Path,required=True)
args=parser.parse_args()
ROOT=args.input_dir.resolve()
D=args.output_dir.resolve()

def load(n):return json.loads(gzip.decompress((D/(n+'.json.gz')).read_bytes()))
def point(p):return len(p)==2 and all(isinstance(v,(int,float)) and math.isfinite(v) for v in p) and -180<=p[0]<=180 and -90<=p[1]<=90
def spans(s):return bool(s) and all(len(x)>=2 and x[0] and x[1] and x[0]<=x[1] for x in s)
ps=load('historical-settlements')['places'];idx=load('historical-settlements-index')['places'];u=load('urban-observations')['cities'];c=load('historical-capitals')['claims'];n=load('modern-cities')['cities'];manifest=load('city-sources')
checks={}
for key,rows in [('settlements',ps),('urban',u),('capitals',c),('modern',n)]:
    assert len({r['id'] for r in rows})==len(rows)
    assert all(point(r['coordinates']) for r in rows)
    checks[key+'-ids-and-coordinates']=len(rows)
assert all(spans(p['periods']) and all(point(l['coordinates']) and spans(l['periods']) for l in p['locations']) for p in ps)
assert all(p['timeEvidence']!='location-period-attestation' or all(l['accuracyMeters'] is not None and 0<l['accuracyMeters']<=10000 for l in p['locations']) for p in ps)
assert all(p['timeEvidence']!='name-period-attestation' or all(l['accuracyMeters'] is None for l in p['locations']) for p in ps)
checks['historical-locations-never-claim-false-precision']=True
assert all(p['timeBasis']=='modern-reference-only' and 'periods' not in p for p in n)
checks['modern-points-have-no-invented-historical-dates']=True
assert all(p['observations'] and all(year and pop>0 for year,pop in p['observations']) and 'periods' not in p for p in u)
assert all(p['observations'][0][0]==1990 for p in u if p['source']=='modelski-modern' and p['countryReference']=='China')
checks['population-observations-retain-dates-not-lifespans']=True
assert all(spans(p['periods']) and all(d['precision']>=9 for d in p['dates']) for p in c)
checks['capital-dates-explicit-year-or-finer']=True
lookup={p['id']:p for p in ps}
shards={}
for p in idx:
    shard=p['detailsShard']
    if shard not in shards:shards[shard]=load(f"settlements-{shard:03}")
    detail=shards[shard][p['id']]
    assert detail==lookup[p['id']]
checks['lazy-detail-roundtrip']=len(idx)
assert all(p['source'] in manifest['sources'] for p in ps+u+c+n)
checks['source-and-license-present-for-every-record']=True
for fname,expected in [('chandlerV2.csv','aeff29534fb11c4f320cd79fbcba9c8b'),('modelskiAncientV2.csv','f5757dbeeeacb6dc33c26522866eff57'),('modelskiModernV2.csv','9d996673d8c46d4d66abb00dc103478a')]:
    assert hashlib.md5((ROOT/fname).read_bytes()).hexdigest()==expected
checks['author-published-checksums-match']=True
for pid in ['pleiades:423025','pleiades:579885','pleiades:893951']:
    assert pid in lookup
checks['rome-athens-babylon-retained-with-evidence']=True
q=load('city-quarantine');assert q['rawSourceUnmodified']
assert {x['placeId'] for x in q['entries'] if x['issueType']=='source-date-conflict'}=={'pleiades:520998','pleiades:211425280'}
for pid in ['pleiades:520998','pleiades:211425280']:
    p=lookup[pid]
    for periods in [p['periods']]+[l['periods'] for l in p['locations']]+[n['periods'] for n in p['names']]:
        assert not any(span[2]=='1200-bc-middle-east' for span in periods)
checks['explicit-source-date-conflicts-quarantined-not-rewritten']=True
excluded={x['placeId'] for x in q['entries'] if x['issueType']=='feature-type-conflict'}
assert len(excluded)==8 and not excluded.intersection(lookup)
assert all('pleiades:'+pid in lookup for pid in ['50132','432948','462354'])
checks['explicit-feature-type-conflicts-excluded-mountain-settlements-retained']=True
editorial=load('editorial-aliases')
assert editorial['entries'][0]['nameZh']==lookup['pleiades:520998']['nameZh']=='君士坦丁堡'
assert lookup['pleiades:520998']['editorialNameEvidence']['sourceUrls']
checks['editorial-translation-has-independent-provenance']=True
for fname,info in manifest['files'].items():
    path=D/fname
    if path.exists():assert hashlib.sha256(path.read_bytes()).hexdigest()==info['sha256']
checks['derived-file-hashes-match-manifest']=True
report={'checks':checks,'counts':manifest['counts'],'evidenceClasses':dict(Counter(p['timeEvidence'] for p in ps)),'urbanCountryReferences':len({p['countryReference'] for p in u}),'translatedSettlementLabels':sum(bool(p['nameZh']) for p in ps),'translatedUrbanRows':sum(bool(p['nameZh']) for p in u),'bytes':{p.name:p.stat().st_size for p in D.glob('*.gz')}}
(D/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='bytes'},ensure_ascii=False,indent=2))
