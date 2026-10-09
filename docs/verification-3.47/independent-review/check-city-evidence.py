from pathlib import Path
import json,gzip,hashlib,subprocess,re
ROOT=Path('/Users/zane/meridian_atlas/world-history-atlas')
CANDIDATE=Path('/Users/zane/Documents/Codex/2026-10-02/new-chat/work/release-347/cities-candidate')
OUT=Path(__file__).parent
BASE='25ba64cd5eac5a41b2e4bb6ac38f5fad959bce45'
def sha(b):return hashlib.sha256(b).hexdigest()
def old(path):return subprocess.check_output(['git','show',BASE+':'+path],cwd=ROOT)
def j(path):return json.loads(path.read_bytes())
p=CANDIDATE/'integration/public/data/research-evidence/cities-3.47';manifest=j(p/'base-preservation.json');cat=j(p/'catalog.json')
original=json.loads(old('editorial/attested-places.json'));candidate=j(CANDIDATE/'integration/editorial/attested-places.json')
protected=[]
for f in manifest['files']:
 baseline=old(f['path']);current=(ROOT/f['path']).read_bytes()
 protected.append({'path':f['path'],'sha256':sha(baseline),'baselineMatchesRecorded':sha(baseline)==f['sha256'],'currentMatchesBaseline':current==baseline})
checks={
 'oldEntriesUnchanged':candidate['entries'][:len(original['entries'])]==original['entries'],
 'oldEnhancementsUnchanged':candidate['enhancements']==original['enhancements'],
 'oldDeferredUnchanged':candidate['deferred']==original['deferred'],
 'oldReviewLedgerUnchanged':candidate['reviewLedger']==original['reviewLedger'],
 'oldSupplementalLedgerPrefixUnchanged':candidate['supplementalReviewLedger'][:len(original['supplementalReviewLedger'])]==original['supplementalReviewLedger'],
}
origBuilt=json.loads(gzip.decompress(old('public/data/places/attested-places.json.gz')))
built=json.loads(gzip.decompress((CANDIDATE/'integration/public/data/places/attested-places.json.gz').read_bytes()))
checks['oldBuiltRecordsUnchanged']=built['records'][:len(origBuilt['records'])]==origBuilt['records']
checks['oldBuiltEnhancementsUnchanged']=built['enhancements']==origBuilt['enhancements']
coords=[]
for r in candidate['entries'][len(original['entries']):]:
 raw=r['location']['sourceDMS'];m=re.fullmatch(r'([NS])(\d+) (\d+) ([\d.]+) ([EW])(\d+) (\d+) ([\d.]+)',raw)
 lat=(int(m[2])+int(m[3])/60+float(m[4])/3600)*(-1 if m[1]=='S' else 1);lon=(int(m[6])+int(m[7])/60+float(m[8])/3600)*(-1 if m[5]=='W' else 1)
 coords.append({'id':r['id'],'dms':raw,'coordinates':[lon,lat],'matches':max(abs(x-y) for x,y in zip([lon,lat],r['location']['coordinates']))<1e-12,'period':[r['period']['start'],r['period']['end']],'dateQuote':r['period']['dateQuote'],'continuousOccupationAsserted':r['continuousOccupationAsserted'],'displayWindow':r['displayWindow'],'displayHorizon':r['period']['displayHorizon'],'accuracyMeters':r['location']['accuracyMeters']})
pol=json.loads(gzip.decompress(old('public/data/seshat-polaris-2026/metadata/polities.json.gz')))
phases=[{'sourceRow':r['sourceRow'],**r['raw']} for r in pol['records'] if any(x in json.dumps(r).lower() for x in ['zimbabwe','tiwanaku','djenne','djenné','jenne'])]
snapshots=[{'path':x['path'],'sha256':sha((p/x['path']).read_bytes()),'matches':sha((p/x['path']).read_bytes())==x['sha256']} for x in cat['snapshots']]
sources=[{'sourceId':x['sourceId'],'path':x['retrieval']['localFile'],'matches':sha((CANDIDATE/x['retrieval']['localFile']).read_bytes())==x['retrieval']['sha256']} for x in cat['sources']]
originals=[{'sourceId':x['sourceId'],'path':x['originalFile']['archivePath'],'sha256':sha((CANDIDATE/x['originalFile']['archivePath']).read_bytes()),'matches':sha((CANDIDATE/x['originalFile']['archivePath']).read_bytes())==x['originalFile']['sha256']} for x in cat['sources'] if 'originalFile' in x]
result={'reviewedOn':'2026-10-10','baseCommit':BASE,'checks':checks,'oldRecords':len(original['entries']),'newRecords':len(candidate['entries']),'builtCounts':built['counts'],'coordinates':coords,'protected':protected,'polarisPhases':phases,'snapshots':snapshots,'sourceRepresentations':sources,'originalFiles':originals,'reviewedFileHashes':{str(x.relative_to(CANDIDATE)):sha(x.read_bytes()) for x in [CANDIDATE/'integration/editorial/attested-places.json',p/'catalog.json',p/'claim-evidence.json']},'limits':['Read-only independent evidence audit; did not rerun source agent runtime/browser checks.','Source extraction representations are not original HTML bytes; original Rice PDF and NMMZ HTML verified separately.','Point positions are representative references with unknown metric accuracy, not archaeological boundary polygons.']}
assert all(checks.values())
assert all(x['matches'] for x in coords+snapshots+sources+originals)
assert all(x['baselineMatchesRecorded'] and x['currentMatchesBaseline'] for x in protected)
(OUT/'city-evidence.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'checks':checks,'oldRecords':len(original['entries']),'newRecords':len(candidate['entries']),'protected':len(protected),'coordinateChecks':len(coords),'sourceRepresentationChecks':len(sources),'snapshotChecks':len(snapshots),'originalFiles':len(originals)},ensure_ascii=False))
