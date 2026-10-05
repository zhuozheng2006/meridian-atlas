#!/usr/bin/env python3
"""Experimental physical-geography spatial bundles. Writes only outside the project.
Uses published 1e-5-degree physical coordinates without further simplification or
rounding. Clipping inserts intersection vertices. Derives water and coast from the
SAME land union; only the original land boundary can enter the coast line layer.
"""
import argparse,gzip,hashlib,json,math,pathlib,time
import shapely
from shapely.geometry import shape,mapping,box,Polygon,MultiPolygon,LineString,MultiLineString
from shapely.ops import unary_union

LIMIT=85.0511287798066

def read(p):
 b=p.read_bytes();return json.loads(gzip.decompress(b) if b[:2]==b'\x1f\x8b' else b)
def decode(payload):
 if payload.get('type')=='FeatureCollection':return payload
 q=payload.get('q',100000);ox,oy=payload.get('o',[0,0])
 def ring(v):
  x,y=ox,oy;out=[]
  for i in range(0,len(v),2):x+=v[i];y+=v[i+1];out.append([x/q,y/q])
  return out
 def coords(t,c):return ring(c) if t=='LineString' else [ring(r) for r in c] if t in ('Polygon','MultiLineString') else [[ring(r) for r in p] for p in c]
 return {'type':'FeatureCollection','features':[{'type':'Feature','properties':p,'geometry':{'type':t,'coordinates':coords(t,c)}} for p,t,c in payload['c']]}
def atomic(g,dimension):
 if g.is_empty:return []
 if (dimension==2 and g.geom_type=='Polygon')or(dimension==1 and g.geom_type=='LineString'):return [g]
 if hasattr(g,'geoms'):return [p for part in g.geoms for p in atomic(part,dimension)]
 return []
def normalized(g,dimension):
 pieces=atomic(g,dimension)
 if not pieces:return None
 return pieces[0] if len(pieces)==1 else MultiPolygon(pieces) if dimension==2 else MultiLineString(pieces)
def feature(g,properties,id=None):
 r={'type':'Feature','properties':properties,'geometry':mapping(g)}
 if id is not None:r['id']=id
 return r
def fc(features):return {'type':'FeatureCollection','features':features}
def encode(v):return json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
def packed_write(p,v):
 raw=encode(v);data=gzip.compress(raw,9,mtime=0);p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data);assert read(p)==json.loads(raw);return len(data),hashlib.sha256(data).hexdigest()
def prepare(root):
 paths={n:root/'public/data/physical'/f'{n}-10m.json.gz' for n in ('land','rivers','lakes')}
 frames={n:decode(read(p)) for n,p in paths.items()};geoms={n:[shape(f['geometry']) for f in fs['features']] for n,fs in frames.items()}
 assert all(g.is_valid for values in geoms.values() for g in values)
 world=box(-180,-LIMIT,180,LIMIT);land=unary_union(geoms['land']).intersection(world);assert land.is_valid
 # This removes source data's world-cut edges. Cell boundaries are never used to
 # make this line geometry, so a rectangular grid cannot become a fake coastline.
 coast=land.boundary.difference(world.boundary)
 return frames,geoms,land,coast,world,paths

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--root',type=pathlib.Path,required=True);ap.add_argument('--output',type=pathlib.Path,required=True);ap.add_argument('--cell-degrees',type=int,default=10);a=ap.parse_args();root=a.root.resolve();out=a.output.resolve();assert out!=root/'public/data/physical','Original published physical inputs must not be overwritten';out.mkdir(parents=True,exist_ok=True);t0=time.perf_counter()
 frames,geoms,land,coast,world,paths=prepare(root);trees={n:shapely.STRtree(geoms[n]) for n in ('rivers','lakes')};assets=[];cell=a.cell_degrees;assert 180%cell==0
 for yi,s0 in enumerate(range(-90,90,cell)):
  s=max(-LIMIT,s0);n=min(LIMIT,s0+cell)
  for xi,w in enumerate(range(-180,180,cell)):
   e=w+cell;bbox=[w,s,e,n];rect=box(*bbox);lg=normalized(land.intersection(rect),2);og=normalized(rect.difference(land),2);cg=normalized(coast.intersection(rect),1)
   layers={'land':fc([feature(lg,{'kind':'ModernLand'},0)] if lg is not None else []),'ocean':fc([feature(og,{'kind':'ModernOceanMask'},0)] if og is not None else []),'coast':fc([feature(cg,{'kind':'SourceCoastline'},0)] if cg is not None else [])}
   for name,dim in [('rivers',1),('lakes',2)]:
    features=[]
    for index in sorted(trees[name].query(rect,predicate='intersects').tolist()):
     g=normalized(geoms[name][index].intersection(rect),dim)
     if g is not None:features.append(feature(g,frames[name]['features'][index]['properties'],index))
    layers[name]=fc(features)
   for collection in layers.values():
    assert all(shape(f['geometry']).is_valid for f in collection['features'])
   value={'schemaVersion':1,'cell':[xi,yi],'bbox':bbox,'layers':layers};file=f'cells/{xi:02d}-{yi:02d}.json.gz';size,digest=packed_write(out/file,value)
   assets.append({'file':file,'bbox':bbox,'bytes':size,'sha256':digest,'features':{k:len(v['features']) for k,v in layers.items()}})
  if yi%3==0:print(f'Built {len(assets)} cells in {time.perf_counter()-t0:.1f}s',flush=True)
 index={'schemaVersion':1,'cellDegrees':cell,'bounds':[-180,-LIMIT,180,LIMIT],'source':{'description':'Published Natural Earth physical geography; modern reference only','coordinateTransform':'No additional simplification, quantization or rounding. Polygon intersection/union introduces intersection vertices. Coast is source land boundary clipped as a line.','inputs':{n:{'file':str(p.relative_to(root/'public')),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for n,p in paths.items()}},'cells':assets}
 ib,ih=packed_write(out/'index.json.gz',index)
 old=sum((root/'public/data/physical'/n).stat().st_size for n in ('land-10m.json.gz','rivers-10m.json.gz','lakes-10m.json.gz','modern-ocean-mask.json.gz'))
 scenarios=[]
 def view(cx,cy,z,width=1400,height=900):
  scale=512*2**z;y=(1-math.asinh(math.tan(math.radians(cy)))/math.pi)/2
  b=[cx-width/2/scale*360,math.degrees(math.atan(math.sinh(math.pi*(1-2*(y+height/2/scale))))),cx+width/2/scale*360,math.degrees(math.atan(math.sinh(math.pi*(1-2*(y-height/2/scale)))))]
  dx=(b[2]-b[0])*.2;dy=(b[3]-b[1])*.2;return [b[0]-dx,b[1]-dy,b[2]+dx,b[3]+dy]
 for name,center in [('Europe',[8.2,46.9]),('EastAsia',[116.4,35.1]),('Dateline',[179.5,35.0])]:
  for z in [4,6,9]:
   b=view(*center,z);visible=[]
   for c in assets:
    x=c['bbox'];shift=math.floor((b[0]-x[0])/360)*360
    if x[3]>=b[1] and x[1]<=b[3] and any(x[2]+d>=b[0] and x[0]+d<=b[2] for d in [shift,shift+360]):visible.append(c)
   size=sum(c['bytes'] for c in visible);scenarios.append({'region':name,'center':center,'zoom':z,'viewportPixels':[1400,900],'paddingRatio':.2,'bounds':b,'cellRequests':len(visible),'cellBytes':size,'coldWithIndexBytes':size+ib,'globalFourLayersBytes':old,'reductionRatio':round(1-(size+ib)/old,6),'files':[c['file'] for c in visible]})
 report={'kind':'disk-byte and geometry construction prototype; browser rendering not yet tested','cells':len(assets),'allCellBytes':sum(c['bytes'] for c in assets),'indexBytes':ib,'maxCellBytes':max(c['bytes'] for c in assets),'baselineGlobalBytes':old,'elapsedSeconds':round(time.perf_counter()-t0,3),'scenarios':scenarios}
 (out/'build-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__':main()
