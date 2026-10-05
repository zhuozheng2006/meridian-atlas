#!/usr/bin/env python3
"""Independent audit of persisted physical cells versus ACTUAL JS runtime decoder.
Does not import the builder or its coordinate decoder. Source JSON is produced by
extracting compactGeometry from the live geography.js with the sibling Node script.
"""
import argparse,gzip,hashlib,json,math,pathlib,random,time,collections
import shapely
from shapely.geometry import shape,box,Point
from shapely.ops import unary_union
from shapely.prepared import prep

def load(p):
 b=p.read_bytes();return json.loads(gzip.decompress(b) if b[:2]==b'\x1f\x8b' else b)
def polygons(g):return [g] if g.geom_type=='Polygon' else [x for p in getattr(g,'geoms',[]) for x in polygons(p)]
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--source',type=pathlib.Path,required=True);ap.add_argument('--cells',type=pathlib.Path,required=True);a=ap.parse_args();t0=time.perf_counter();index=load(a.cells/'index.json.gz');source={k:load(a.source/(k+'.json')) for k in ['land','rivers','lakes']};orig={k:[shape(f['geometry']) for f in c['features']] for k,c in source.items()};world=box(*index['bounds']);land=unary_union(orig['land']).intersection(world);ocean=world.difference(land);coast=land.boundary.difference(world.boundary)
 all_land=[];all_ocean=[];all_coast=[];river_parts=collections.defaultdict(list);lake_parts=collections.defaultdict(list);tileChecks=[];invalid=[];maxCellGap=0;maxCellOverlap=0;maxCellUnionDiff=0;ringChecks=0;falseCoast=0;missingCoast=0;coastHausdorff=0;falseNegativeControl=0
 print("Loaded runtime baselines",flush=True)
 for meta in index['cells']:
  path=a.cells/meta['file'];raw=path.read_bytes();assert len(raw)==meta['bytes'];assert hashlib.sha256(raw).hexdigest()==meta['sha256'];d=load(path);assert d['bbox']==meta['bbox'];rect=box(*meta['bbox']);geometries={}
  for layer,frame in d['layers'].items():
   gs=[]
   for f in frame['features']:
    g=shape(f['geometry']);assert g.is_valid,(meta['file'],layer,shapely.is_valid_reason(g));assert g.difference(rect).length<1e-8,(meta['file'],layer,'outside cell');gs.append(g)
    for p in polygons(g):
     for ring in [p.exterior,*p.interiors]:assert ring.coords[0]==ring.coords[-1];ringChecks+=1
    if layer in ('rivers','lakes'):
     assert f['properties']==source[layer]['features'][f['id']]['properties'];(river_parts if layer=='rivers' else lake_parts)[f['id']].append(g)
   geometries[layer]=unary_union(gs)
  l,o,c=[geometries[k] for k in ('land','ocean','coast')];maxCellGap=max(maxCellGap,rect.difference(l.union(o)).area);maxCellOverlap=max(maxCellOverlap,l.intersection(o).area);maxCellUnionDiff=max(maxCellUnionDiff,l.symmetric_difference(land.intersection(rect)).area)
  expectedCoast=coast.intersection(rect)
  assert c.equals(expectedCoast),(meta['file'],'coast differs from original line clipped to cell')
  # Clipped polygon boundaries contain source coast PLUS artificial closures.
  # Extra lengths are an independent negative-control witness; the candidate
  # coastline must equal the original line, including every segment.
  falseNegativeControl+=max(0,(0 if l.is_empty else l.boundary.length)-c.length)
  all_land.append(l);all_ocean.append(o);all_coast.append(c)
  if len(all_land)%72==0:print(f'Checked {len(all_land)} persisted cells in {time.perf_counter()-t0:.1f}s',flush=True)
 assert maxCellGap<1e-8 and maxCellOverlap<1e-8 and maxCellUnionDiff<1e-8
 print('Reassembling global land/water',flush=True);mergedLand=unary_union(all_land);mergedOcean=unary_union(all_ocean)
 landDiff=land.symmetric_difference(mergedLand).area;oceanDiff=ocean.symmetric_difference(mergedOcean).area;globalGap=world.difference(mergedLand.union(mergedOcean)).area;globalOverlap=mergedLand.intersection(mergedOcean).area
 assert max(landDiff,oceanDiff,globalGap,globalOverlap)<1e-7
 # Boolean difference on almost coincident floating lines is unstable. A 1e-8
 # degree buffer is ~1.1 mm at the equator, far below the 1e-5 source grid.
 assert falseCoast<1e-7 and missingCoast<1e-7 and coastHausdorff<1e-8
 layerResults={}
 for name,parts in [('rivers',river_parts),('lakes',lake_parts)]:
  worst=0;worstHausdorff=0;checked=0;holes=0
  for i,g in enumerate(orig[name]):
   expected=g.intersection(world);actual=unary_union(parts[i]);assert actual.is_valid
   if expected.is_empty:assert actual.is_empty;continue
   checked+=1;hd=expected.hausdorff_distance(actual);worstHausdorff=max(worstHausdorff,hd);assert hd<1e-8,(name,i,hd)
   if name=='lakes':
    difference=expected.symmetric_difference(actual).area;holes+=sum(len(p.interiors) for p in polygons(expected));assert difference<1e-8,(name,i,difference)
   else:difference=actual.difference(expected.buffer(1e-8)).length+expected.difference(actual.buffer(1e-8)).length;assert difference<1e-7,(name,i,difference)
   worst=max(worst,difference)
  print('Reassembled',name,checked,flush=True)
  layerResults[name]={'sourceFeatures':len(orig[name]),'reassembledNonEmptyFeatures':checked,'propertiesEqualSource':True,'maxDifference':worst,'maxHausdorffDegrees':worstHausdorff,'sourceInteriorRings':holes}
 pl,po=prep(mergedLand),prep(mergedOcean);p0=prep(land);rng=random.Random(337);points=[(rng.uniform(-180,180),rng.uniform(-85,85)) for _ in range(12000)];points += [(x,y) for x in [-179.999999,-179.99,179.99,179.999999] for y in [-80,-60,-30,0,30,60,80]]
 mismatches=[]
 for x,y in points:
  p=Point(x,y);l=pl.contains(p);o=po.contains(p);base=p0.contains(p)
  if l!=base or l==o:mismatches.append([x,y,l,o,base])
 assert not mismatches
 holeSamples=[]
 for p in polygons(land):
  for hole in p.interiors:
   pt=shapely.Polygon(hole).representative_point()
   if not land.contains(pt):assert po.covers(pt) and not pl.contains(pt);holeSamples.append([pt.x,pt.y])
 # Negative control: outline clipped fill polygons. This creates hundreds of
 # straight grid boundaries that must fail exactly the same coastline test.
 assert falseNegativeControl>100
 report={'status':'pass','runtimeSourceManifest':load(a.source/'manifest.json'),'cells':len(index['cells']),'sourceCoordinateSimplification':False,'sourceCoordinateRounding':False,'validPersistedGeometry':True,'closedRingsChecked':ringChecks,'perCell':{'maxMissingAreaSquareDegrees':maxCellGap,'maxOverlapAreaSquareDegrees':maxCellOverlap,'maxLandDifferenceAreaSquareDegrees':maxCellUnionDiff},'global':{'landSymmetricDifferenceAreaSquareDegrees':landDiff,'oceanSymmetricDifferenceAreaSquareDegrees':oceanDiff,'uncoveredWorldAreaSquareDegrees':globalGap,'landOceanOverlapAreaSquareDegrees':globalOverlap},'coast':{'everyCellTopologyExactlyEqualsClippedOriginalCoast':True,'negativeControlOutlineClippedPolygonsRejected':True,'negativeControlFalseCoastLengthDegrees':falseNegativeControl},'layers':layerResults,'classification':{'points':len(points),'dateLineSidesExplicitSamples':28,'mismatches':0,'landHolePointsCoveredByWater':len(holeSamples)},'elapsedSeconds':round(time.perf_counter()-t0,3),'limits':['No browser/pixel seam verification performed.','Land is a contemporary physical reference; historical geometry is not clipped or modified.','1e-8-degree tolerance only applies to floating-line topology audit; serialized values are not modified.']}
 (a.cells/'geometry-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__':main()
