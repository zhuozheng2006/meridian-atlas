"""Transform pinned HydroLAKES into spatially grouped, compact delta-coordinate shards.
Requires PyShp 2.3.1. Source ZIP must be kept outside the published directory.
"""
import argparse,collections,gzip,hashlib,json,math,pathlib,struct,sys,time
p=argparse.ArgumentParser();p.add_argument('--source',type=pathlib.Path,required=True);p.add_argument('--output',type=pathlib.Path,required=True);a=p.parse_args()
import shapefile
from shapely.geometry import shape
from shapely.validation import explain_validity
out=a.output;out.mkdir(parents=True,exist_ok=True)
here=pathlib.Path(__file__).resolve().parent
lock=json.loads((here/'source-lock.json').read_text())
for name,meta in lock['files'].items():
 path=a.source.parent/name;h=hashlib.sha256()
 with path.open('rb') as source:
  for block in iter(lambda:source.read(8*1024*1024),b''):h.update(block)
 assert path.stat().st_size==meta['bytes'] and h.hexdigest()==meta['sha256'],'Source hash mismatch: '+name
translations=json.loads((here/'name-translations.json').read_text());names={}

r=shapefile.Reader(str(a.source),encoding='cp1252')
fields=['Hylak_id','Lake_name','Lake_type','Lake_area']
shx=a.source.with_suffix('.shx').read_bytes()[100:]
offsets=[x[0]*2 for x in struct.iter_unpack('>II',shx)]
f=a.source.with_suffix('.shp').open('rb')
buckets=collections.defaultdict(list);types=collections.Counter();kept=0;vertices=0
start=time.time()
for i,rec in enumerate(r.iterRecords(fields=fields)):
 hid,name,kind,area=rec;types[kind]+=1
 if kind==2:continue
 f.seek(offsets[i]+12);bb=struct.unpack('<4d',f.read(32));parts,n=struct.unpack('<II',f.read(8));cx=(bb[0]+bb[2])/2;cy=(bb[1]+bb[3])/2
 band=4 if area>=100 else 6 if area>=5 else 9
 key=(band,math.floor(cx/10),math.floor(cy/10))
 buckets[key].append((i,hid,name,kind,area,bb,n));kept+=1;vertices+=n
 if i%250000==0:print('Index',i,'elapsed',round(time.time()-start),flush=True)
f.close();print('Indexed',kept,'vertices',vertices,'buckets',len(buckets),flush=True)
manifest={'schemaVersion':1,'dataset':'HydroLAKES v1.0','sourceUrl':'https://www.hydrosheds.org/products/hydrolakes','downloadUrl':'https://data.hydrosheds.org/file/hydrolakes/HydroLAKES_polys_v10_shp.zip','sourceSha256':'9ef63498569dd7ccd0b8d8852da026e009a75f42d293f00e483f3b9fcfe8e1f9','license':'CC BY 4.0','licenseUrl':'https://creativecommons.org/licenses/by/4.0/','citation':'Messager, M.L., Lehner, B., Grill, G., Nedeva, I. & Schmitt, O. (2016). https://doi.org/10.1038/ncomms13603','rawRecords':len(r),'sourceTypes':dict(types),'includedRecords':kept,'vertices':vertices,'excludedTypes':[2],'coordinateScope':'Contemporary geographic reference; diverse source dates, no annual historical reconstruction. Lake_type 1 may include unidentified reservoirs. Type 3 is a natural lake with regulation.','method':'WGS84 coordinates quantized to 0.000001 degree (maximum <0.08 metre displacement at equator), then delta-encoded as paired integer increments; no simplification, smoothing or vertex removal. Valid source polygons that become invalid after quantization retain original floating-point coordinates. DBF code-page byte 0x57 read as Windows-1252. Spatial shards have no clipping. Polygon shell/hole order may be normalized by PyShp. Area tiers: >=100 km² from zoom 4, >=5 from zoom 6, all >=0.1 from zoom 9.','shards':[]}

quantization={'gridDegrees':1e-6,'maxLongitudeErrorDegrees':0,'maxLatitudeErrorDegrees':0,'sourceInvalid':[],'floatFallback':[]}
def encode_ring(ring):
 result=[];x=y=0
 for a,b in ring:
  xx,yy=round(a*1000000),round(b*1000000)
  quantization['maxLongitudeErrorDegrees']=max(quantization['maxLongitudeErrorDegrees'],abs(a-xx/1000000))
  quantization['maxLatitudeErrorDegrees']=max(quantization['maxLatitudeErrorDegrees'],abs(b-yy/1000000))
  result.extend((xx-x,yy-y));x,y=xx,yy
 return result
def encode_geometry(g,hid):
 polygons=[g['coordinates']] if g['type']=='Polygon' else g['coordinates']
 rounded=[[[[round(a*1000000)/1000000,round(b*1000000)/1000000] for a,b in ring] for ring in polygon] for polygon in polygons]
 q={'type':'MultiPolygon','coordinates':rounded}
 if not shape(q).is_valid:
  if shape(g).is_valid:
   quantization['floatFallback'].append(hid);return g
  quantization['sourceInvalid'].append({'id':hid,'reason':explain_validity(shape(g))})
 return {'type':g['type'],'deltas':[[encode_ring(ring) for ring in polygon] for polygon in polygons]}

def partition(rows):
 if len(rows)<=2000 and sum(q[6] for q in rows)<=45000 or len(rows)==1:yield rows;return
 spans=[max((x[5][k]+x[5][k+2])/2 for x in rows)-min((x[5][k]+x[5][k+2])/2 for x in rows) for k in (0,1)]
 axis=0 if spans[0]>=spans[1] else 1
 rows.sort(key=lambda x:(x[5][axis]+x[5][axis+2],x[1]));mid=len(rows)//2
 yield from partition(rows[:mid]);yield from partition(rows[mid:])

for key in sorted(buckets):
 rows=buckets.pop(key)
 for part in partition(rows):
  features=[]
  for oid,hid,name,kind,area,bb,n in sorted(part,key=lambda x:x[1]):
   s=r.shape(oid);g=s.__geo_interface__
   if name:
    center=shape(g).representative_point();label={'name':name,'center':[round(center.x,6),round(center.y,6)]}
    if str(hid) in translations:
     assert translations[str(hid)]['name']==name;label['zh']=translations[str(hid)]['zh']
    names[str(hid)]=label
   assert g['type'] in ('Polygon','MultiPolygon')
   props={'id':hid,'type':kind,'area':area}
   if name:props['name']=name
   features.append({'type':'Feature','id':hid,'properties':props,'bbox':list(bb),'geometry':encode_geometry(g,hid)})
  raw=json.dumps({'encoding':'delta-1e6','features':features},ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
  packed=gzip.compress(raw,compresslevel=6,mtime=0);name='%04d.json.gz'%len(manifest['shards']);(out/name).write_bytes(packed)
  bb=[min(x[5][0] for x in part),min(x[5][1] for x in part),max(x[5][2] for x in part),max(x[5][3] for x in part)]
  manifest['shards'].append({'file':name,'minZoom':key[0],'bbox':bb,'count':len(part),'vertices':sum(x[6] for x in part),'bytes':len(raw),'gzipBytes':len(packed),'sha256':hashlib.sha256(packed).hexdigest()})
  if len(manifest['shards'])%100==0:print('Shards',len(manifest['shards']),'elapsed',round(time.time()-start),flush=True)
manifest['encoding']='delta-1e6';manifest['quantization']=quantization
manifest['compressedBytes']=sum(x['gzipBytes'] for x in manifest['shards'])
manifest['jsonBytes']=sum(x['bytes'] for x in manifest['shards'])
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
index={k:manifest[k] for k in ['schemaVersion','includedRecords','vertices']};index['shards']=[{k:s[k] for k in ['file','minZoom','bbox','count','vertices']} for s in manifest['shards']]
index['names']={k:names[k] for k in sorted(names,key=int)}
(out/'index.json.gz').write_bytes(gzip.compress(json.dumps(index,ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
packed_index=(out/'index.json.gz').read_bytes();manifest['index']={'file':'index.json.gz','gzipBytes':len(packed_index),'sha256':hashlib.sha256(packed_index).hexdigest()};manifest['namedLakes']=len(names);manifest['translatedNames']=sum('zh' in n for n in names.values());(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in manifest.items() if k not in ('shards','quantization')},indent=2),flush=True)
print('Complete',len(manifest['shards']),'shards',round(time.time()-start),'seconds',flush=True)
