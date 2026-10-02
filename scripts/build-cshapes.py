#!/usr/bin/env python3
"""Build independently licensed CShapes archives without geometry simplification.

Usage: python3 scripts/build-cshapes.py SOURCE.geojson [name-labels.json]
Requires Shapely for diagnostic validity and label anchors only.
"""
import sys,json,gzip,hashlib,datetime,collections
from pathlib import Path
from shapely.geometry import shape

root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]);raw=source.read_bytes();features=json.loads(raw)['features'];cow='cowcode' in features[0]['properties'];prefix='cow' if cow else 'gw';edition='Correlates of War' if cow else 'Gleditsch and Ward';source_name='CShapes-COW-2.1.geojson' if cow else 'CShapes-2.1.geojson'
labels=json.loads(Path(sys.argv[2]).read_text()).get('labels',{}) if len(sys.argv)>2 else {}
out=root/'public/data/cshapes';out.mkdir(parents=True,exist_ok=True)
encode=lambda v:json.dumps(v,ensure_ascii=False,separators=(',',':')).encode()
digest=lambda b:hashlib.sha256(b).hexdigest()
def save(name,data):
    b=gzip.compress(encode(data),compresslevel=9,mtime=0);(out/name).write_bytes(b)
    return {'file':name,'bytes':len(b),'sha256':digest(b)}
def day(p,prefix):
    value=datetime.date(p[prefix+'year'],p[prefix+'month'],p[prefix+'day'])
    return value.isoformat()
records=[];geometries={};invalid=[];vertices=0
def count(v):
    return 1 if isinstance(v[0],(int,float)) else sum(count(x) for x in v)
for i,f in enumerate(features):
    p=f['properties'];geo=f['geometry'];key=digest(encode(geo));geometries[key]=geo
    g=shape(geo);main=max(g.geoms,key=lambda x:x.area) if g.geom_type=='MultiPolygon' else g
    point=main.representative_point();start=day(p,prefix+'s');end=day(p,prefix+'e')
    assert start<=end
    rec={'id':f'cshapes-{prefix}-{i:04d}','sourceIndex':i,'name':p['cntry_name'],'zhName':labels.get(p['cntry_name']),
         'startDate':start,'endDate':end,'start':int(start[:4]),'end':int(end[:4]),
         'code':p[prefix+'code'],'ruledby':p['ruledby'],'status':p.get('status'),
         'capital':p.get('capname'),'capitalCoordinates':[p.get('caplong'),p.get('caplat')],
         'area':p['area'],'center':[point.x,point.y],'bbox':list(g.bounds),'geometryId':key,'source':p}
    records.append(rec);vertices+=count(geo['coordinates'])
    if not g.is_valid:invalid.append(rec['id'])
packs=[]
for decade in range(1880,2030,10):
    selected=[r for r in records if r['start']<=decade+9 and r['end']>=decade]
    ids=sorted({r['geometryId'] for r in selected})
    pack=save(f'decade-{decade}.json.gz',{k:geometries[k] for k in ids})
    packs.append({**pack,'decade':decade,'geometries':len(ids)})
catalog={'version':'2.1 beta','coding':edition,'range':[1886,2023],
         'snapshot':'July 1','license':'CC BY-NC-SA 4.0','records':records,'packs':packs}
index=save('catalog.json.gz',catalog)
manifest={'version':'2.1 beta','coding':edition,'sourceURL':'https://icr.ethz.ch/data/cshapes/'+source_name,
          'projectURL':'https://icr.ethz.ch/data/cshapes/beta.html','licenseURL':'https://creativecommons.org/licenses/by-nc-sa/4.0/',
          'citation':'Schvitz, Guy, Seraina Rüegger, Luc Girardin, Lars-Erik Cederman, Nils Weidmann, and Kristian Skrede Gleditsch. 2022. Mapping The International System, 1886–2017: The CShapes 2.0 Dataset. Journal of Conflict Resolution 66(1): 144–161.',
          'sourceSha256':digest(raw),'sourceBytes':len(raw),'records':len(records),'uniqueGeometries':len(geometries),'sourceVertices':vertices,
          'translatedDistinctNames':len({r['name'] for r in records if r['zhName'] and r['zhName']!=r['name']}),'translatedRecords':sum(bool(r['zhName']) and r['zhName']!=r['name'] for r in records),'untranslatedNames':sorted({r['name'] for r in records if not r['zhName'] or r['zhName']==r['name']}),'labeledRecords':sum(bool(r['zhName']) for r in records),'invalidSourceGeometries':invalid,'missingStatus':[r['id'] for r in records if not r['status']],
          'range':[1886,2023],'index':index,'packs':packs,
          'transformations':['Exact source geometry values retained; deduplicated by canonical geometry hash; gzip decade bundles.',
                             'Civil dates use integer year/month/day fields; raw timestamp strings retained only as source metadata.',
                             'Representative label points derived from largest source component, without geometry repair.',
                             'Simplified Chinese display labels are editorial translations, not identity bindings.'],
          'limitations':['State-system coverage follows the selected source edition; it is not every political entity or dependency.',
                         'Territorial coding omits many small changes and temporary wartime occupations.',
                         'Source-invalid geometries and missing classifications remain documented, not silently repaired.',
                         'Derivative data retains CC BY-NC-SA 4.0; it is not covered by the application code MIT license.']}
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:manifest[k] for k in ['records','uniqueGeometries','sourceVertices','invalidSourceGeometries','missingStatus']}))
print('Archive bytes:',sum(p.stat().st_size for p in out.iterdir() if p.is_file()))
