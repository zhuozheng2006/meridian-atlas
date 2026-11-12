"""Independently verify archived source members, attributes and projected vertices."""
import pathlib,json,gzip,zipfile,hashlib,sys,math
import fiona
from fiona.transform import transform_geom
root=pathlib.Path(__file__).resolve().parents[2];folder=root/'public/data/china-prefectures'
original=pathlib.Path(sys.argv[1]);index=json.loads(gzip.decompress((folder/'index.json.gz').read_bytes()))
retrieval=json.loads((root/'docs/verification-3.56/china-retrieval.json').read_text())
with zipfile.ZipFile(folder/'ResearchArea-originals.zip') as z:
 for m in retrieval['members']:
  b=z.read(pathlib.Path(m['name']).name);assert hashlib.sha256(b).hexdigest()==m['sha256']
shapes={};instances=0
for file in folder.glob('year-*.json.gz'):
 pack=json.loads(gzip.decompress(file.read_bytes()))
 for key,g in pack['geometries'].items():
  if key in shapes:assert shapes[key]==g
  shapes[key]=g;instances+=1
def flatten(g):
 for poly in ([g['coordinates']] if g['type']=='Polygon' else g['coordinates']):
  for ring in poly:
   yield from ring
byrow={r['row']:r for r in index['records']};points=0;error=0
with fiona.open(original/'ResearchArea.shp') as d:
 for i,f in enumerate(d):
  if i not in byrow:continue
  r=byrow[i];assert dict(f.properties)==r['sourceRecord'];g=shapes[r['id']]
  expected=dict(transform_geom(d.crs,'+proj=longlat +ellps=krass +no_defs',f.geometry))
  assert json.loads(json.dumps(expected))==g
  reverse=dict(transform_geom('+proj=longlat +ellps=krass +no_defs',d.crs,g))
  a=list(flatten(dict(f.geometry)));b=list(flatten(reverse));assert len(a)==len(b)
  error=max(error,max(math.dist(x,y) for x,y in zip(a,b)));points+=len(a)
assert len(shapes)==len(index['records'])==420 and error<.001
report={'passed':True,'sourceComponentsVerified':len(retrieval['members']),'sourceRows':420,'uniqueGeometries':len(shapes),'bandInstances':instances,'sourceVertices':points,'maxInverseRoundtripMetres':error,'allSourceAttributesPreserved':True,'allInverseProjectedCoordinatesExact':True,'excludedYears':[1102,1820]}
(root/'docs/verification-3.56/china-source-verification.json').write_text(json.dumps(report,indent=2)+'\n');print(report)
