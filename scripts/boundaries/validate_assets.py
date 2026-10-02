import pathlib,json,gzip,hashlib,collections,math
from shapely.geometry import shape
root=pathlib.Path(__file__).parent;out=root/'assets'
source=json.loads((root/'cliopatria.geojson').read_text())['features'];cat=json.loads((out/'catalog.json').read_text());records=cat['records'];meta=cat['metadata']
assert len(source)==len(records)==13765
assert hashlib.sha256((root/'cliopatria.geojson.zip').read_bytes()).hexdigest()==meta['sourceZipSha256']
assert {r['id'] for r in records}=={f'clio-{i:05d}' for i in range(13765)}
for i,(f,r) in enumerate(zip(source,records)):
 p=f['properties']
 for raw,key in [('Name','name'),('FromYear','start'),('ToYear','end'),('Type','type'),('Area','area')]: assert r[key]==p[raw],(i,key)
 assert r['wikidata']==(p['Wikidata'] or None)
 assert r['wikipedia']==(p['Wikipedia'] or None)
 assert r['components']==[x for x in p['Components'].split(';') if x]
 assert r['memberOf']==[x for x in p['MemberOf'].split(';') if x]
 assert r['start']<=r['end']
 assert all(math.isfinite(x) for x in r['bbox']+r['center'])
 assert r['geometryId'] in cat['geometryIndex']
loaded={};invalid_output=[]
for shard in meta['shards']:
 b=(out/shard['file']).read_bytes();z=(out/shard['gzipFile']).read_bytes()
 assert len(b)<2_000_000 and len(z)<2_000_000
 assert hashlib.sha256(b).hexdigest()==shard['sha256']
 assert hashlib.sha256(z).hexdigest()==shard['gzipSha256']
 assert gzip.decompress(z)==b
 data=json.loads(b)
 assert len(data)==shard['count']
 for gid,g in data.items():
  assert gid not in loaded
  assert cat['geometryIndex'][gid]==shard['file']
  assert g['type'] in ['Polygon','MultiPolygon']
  s=shape(g); assert not s.is_empty
  if not s.is_valid:invalid_output.append(gid)
  loaded[gid]=True
assert set(loaded)==set(cat['geometryIndex'])
assert gzip.decompress((out/'catalog.json.gz').read_bytes())==(out/'catalog.json').read_bytes()
# Exclude civil year 0, retaining all original source endpoints unchanged.
years=list(range(-3400,0))+list(range(1,2025));coverage=[]
for year in years:
 active=[r for r in records if r['start']<=year<=r['end']]
 coverage.append({'year':year,'polities':sum(r['type']=='POLITY' for r in active),'relations':sum(r['type']=='RELATION' for r in active)})
assert len(years)==5424 and 0 not in years
assert all(x['polities']>0 for x in coverage)
(out/'coverage.json').write_text(json.dumps(coverage,separators=(',',':')))
raw_bytes=sum((out/x).stat().st_size for x in ['catalog.json','metadata.json','coverage.json','LICENSE.md'])+sum(s['bytes'] for s in meta['shards'])
gzip_bytes=sum((out/x).stat().st_size for x in ['catalog.json','metadata.json','coverage.json','LICENSE.md'])+sum(s['gzipBytes'] for s in meta['shards'])
report={'passed':True,'recordsPreserved':len(records),'uniqueGeometries':len(loaded),'geometryShards':len(meta['shards']),'sourceInvalidGeometryRecords':len(meta['sourceInvalidGeometryRecordIds']),'outputInvalidGeometries':invalid_output,'zeroEndpointRecords':meta['yearZeroEndpointRecordIds'],'rawDeploymentBytes':raw_bytes,'gzipGeometryDeploymentBytes':gzip_bytes,'fullyCompressedDeploymentBytes':gzip_bytes-(out/'catalog.json').stat().st_size+(out/'catalog.json.gz').stat().st_size,'selectedYearCoverage':[x for x in coverage if x['year'] in [-3400,-3000,-1000,-221,-1,1,23,100,1000,1492,1914,1945,2024]],'notes':['Validation checks asset integrity and source preservation, not historical correctness.','Original invalid geometries are preserved, not silently repaired.','Gzip-only deployment requires DecompressionStream(gzip) and filename + .gz.']}
(out/'validation-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='outputInvalidGeometries'},ensure_ascii=False,indent=2))
print('invalidOutputCount',len(invalid_output))
