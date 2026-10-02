"""Build lightweight overview geometry, a lean catalog and lazy record details."""
from pathlib import Path
import json,gzip,hashlib,collections
from shapely.geometry import shape,mapping
from opencc import OpenCC
root=Path(__file__).resolve().parents[1];data=root/'public/data';out=data/'fast';out.mkdir(exist_ok=True)
cc=OpenCC('t2s');cat=json.loads(gzip.decompress((data/'catalog.json.gz').read_bytes()))
def encode(v):return json.dumps(v,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
def write(name,obj):
 b=encode(obj);z=gzip.compress(b,compresslevel=9,mtime=0);(out/name).write_bytes(z);return len(b),len(z)
def rounded(v):
 if isinstance(v,(list,tuple)):return [rounded(x)for x in v]
 return round(v,4)if isinstance(v,float)else v
changed=[]
for r in cat['records']:
 old=r.get('zhName');r['zhName']=cc.convert(old)if old else None
 if old!=r['zhName']:changed.append({'id':r['id'],'before':old,'after':r['zhName']})
 if r.get('translationNote'):r['translationNote']=cc.convert(r['translationNote'])
 r['evidenceWarnings']=[cc.convert(x)for x in r.get('evidenceWarnings',[])]
 if r['zhName']:r['zhLanguage']='zh-Hans'
fields=['id','name','zhName','start','end','area','type','geometryId','center','verifiedWikidata','nameTranslationStatus']
slim=[];detail_index={};detail_files={}
for i,r in enumerate(cat['records']):
 filename=f'records-{i//256:03d}.json.gz';detail_index[r['id']]=filename;detail_files.setdefault(filename,{})[r['id']]=r
 nr={k:r.get(k)for k in fields};nr['area']=round(nr['area'],2);nr['noteCount']=len(r.get('evidenceWarnings',[]));slim.append(nr)
for f,v in detail_files.items():write(f,v)
overview_index={};overview_bytes=0;detail_bytes=0;geos={};full_geos={};invalid=[]
for shard in cat['metadata']['shards']:
 raw=json.loads(gzip.decompress((data/shard['gzipFile']).read_bytes()));simple={}
 for gid,g in raw.items():
  old=shape(g);new=old.simplify(.04,preserve_topology=True);m=mapping(new);result={'type':m['type'],'coordinates':rounded(m['coordinates'])}
  if new.is_valid and not shape(result).is_valid:result=m
  if old.is_valid and not shape(result).is_valid:result=g
  if not shape(result).is_valid:invalid.append(gid)
  simple[gid]=result
 name=shard['gzipFile'].replace('geometries','overview');overview_bytes+=write(name,simple)[1];detail_bytes+=shard['gzipBytes'];geos.update(simple);full_geos.update(raw)
 for gid in simple:overview_index[gid]=name
 print(name,flush=True)
anchors={}
for gid,g in full_geos.items():
 polygon=shape(g)
 if polygon.is_empty or not polygon.is_valid:continue
 component=max(polygon.geoms,key=lambda x:x.area)if polygon.geom_type=='MultiPolygon'else polygon
 point=component.representative_point();anchors[gid]=[point.x,point.y]
for record in slim:
 if record['geometryId']in anchors:record['labelCenter']=anchors[record['geometryId']]
meta=cat['metadata'];fast={'version':2,'records':slim,'geometryIndex':cat['geometryIndex'],'metadata':meta}
_,lean_bytes=write('catalog.json.gz',fast)
boot_years=[-3400,-221,1,500,1000,1492,1750,1914,1945,1991,2024]
boot={}
for y in boot_years:
 recs=[r for r in slim if r['type']=='POLITY' and r['start']<=y<=r['end']]
 ids={r['geometryId']for r in recs};f=f'year-{y}.json.gz';boot[str(y)]=f;write(f,{g:full_geos[g]for g in sorted(ids)})
(out/'bootstrap.json').write_text(json.dumps(boot))
report={'overviewToleranceDegrees':.04,'detailToleranceDegrees':.02,'bootstrapToleranceDegrees':.02,'originalCatalogCompressedBytes':(data/'catalog.json.gz').stat().st_size,'leanCatalogCompressedBytes':lean_bytes,'overviewCompressedBytes':overview_bytes,'detailCompressedBytes':detail_bytes,'simplifiedChineseRecordsChanged':len(changed),'overviewInvalidGeometries':len(invalid),'bootstrap':{y:(out/f).stat().st_size for y,f in boot.items()},'allCoordinatesKeptAsPolygonComponents':True,'labelAnchorsInsideLargestComponent':len(anchors)}
(out/'build-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
(root/'docs/simplified-chinese-conversion.json').write_text(json.dumps(changed,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
