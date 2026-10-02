#!/usr/bin/env python3
"""Extract the already-audited P36 claims from the atlas's frozen profile shards."""
import argparse,gzip,hashlib,json,pathlib
HERE=pathlib.Path(__file__).resolve().parent
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--profiles-dir',type=pathlib.Path,required=True)
parser.add_argument('--input-dir',type=pathlib.Path,required=True,help='Write intermediate capital-claims.json and the QID fetch list here.')
parser.add_argument('--manifest',type=pathlib.Path,default=HERE/'input-manifest.json')
args=parser.parse_args();manifest=json.loads(args.manifest.read_text());claims={}
for item in manifest['profileInputs']:
    raw=(args.profiles_dir/item['file']).read_bytes()
    if hashlib.sha256(raw).hexdigest()!=item['sha256']:raise ValueError(f"Profile drift: {item['file']}")
    profile=json.loads(gzip.decompress(raw))
    for claim in profile.get('fields',{}).get('capital',[]):
        sid=claim['statementId']
        if sid in claims:raise ValueError(f'Duplicate statement ID: {sid}')
        claims[sid]={'polity':profile['qid'],'polityLabel':profile['labels'],'capital':claim}
if set(claims)!=set(manifest['capitalClaimOrder']):raise ValueError('Capital statement set differs from frozen snapshot')
ordered=[claims[sid] for sid in manifest['capitalClaimOrder']]
actual=hashlib.sha256(json.dumps(ordered,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
if actual!=manifest['capitalClaimsCanonicalSha256']:raise ValueError('Capital claim content differs from frozen snapshot')
args.input_dir.mkdir(parents=True,exist_ok=True)
(args.input_dir/'capital-claims.json').write_text(json.dumps(ordered,ensure_ascii=False))
(args.input_dir/'capital-qids-needed.json').write_text(json.dumps([e['qid'] for e in manifest['wikidataCities']],indent=2)+'\n')
print(json.dumps({'profilesVerified':len(manifest['profileInputs']),'capitalClaimsExtracted':len(ordered),'cityEntityRevisions':len(manifest['wikidataCities'])}))
