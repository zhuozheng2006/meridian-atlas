"""Shapely audit of actual JS curvedBorders exports. Read-only checkout."""
import argparse,json,math,pathlib,sys
from shapely.geometry import shape,box
from shapely.affinity import scale
from shapely.ops import unary_union
from shapely.validation import explain_validity
from shapely.strtree import STRtree

parser=argparse.ArgumentParser(description='Audit real curvedBorders output with Shapely; run export-border-curves.mjs first.')
parser.add_argument('--input-dir',type=pathlib.Path,default=pathlib.Path(__file__).resolve().parent/'actual')
parser.add_argument('--report',type=pathlib.Path,default=pathlib.Path(__file__).resolve().parent/'actual-shapely-audit.json')
args=parser.parse_args()
ROOT=args.input_dir.resolve()
REGION=box(3,44,16,52)
SCALE_X=111195*math.cos(math.radians(48));SCALE_Y=111195
def metric(g):return scale(g,xfact=SCALE_X,yfact=SCALE_Y,origin=(0,0))
def counts(g):
 p=[g['coordinates']] if g['type']=='Polygon' else g['coordinates']
 return (len(p),sum(len(x) for x in p))
reports=[]
for entry in json.loads((ROOT/'export-audit.json').read_text()):
 year=entry['year']
 raw=json.loads((ROOT/f'{year}-original.geojson').read_text())['features']
 curved=json.loads((ROOT/f'{year}-curved.geojson').read_text())['features']
 originals={};derived={};names={};invalid_before=[];invalid_after=[];shape_count_changes=[];max_relative_area=[]
 for f,g in zip(raw,curved):
  rid=f['properties']['id'];assert rid==g['properties']['id'];names[rid]=f['properties']['name']
  a,b=shape(f['geometry']),shape(g['geometry']);originals[rid]=a;derived[rid]=b
  if not a.is_valid:invalid_before.append(rid)
  if a.is_valid and not b.is_valid:invalid_after.append({'id':rid,'name':names[rid],'reason':explain_validity(b)})
  if counts(f['geometry'])!=counts(g['geometry']):shape_count_changes.append(rid)
  if a.is_valid and b.is_valid and a.area:
   ratio=(b.area/a.area-1)*100
   if abs(ratio)>2.00001:max_relative_area.append({'id':rid,'name':names[rid],'areaChangePct':ratio})
 ids=[rid for rid,g in originals.items() if g.is_valid and derived[rid].is_valid and g.intersects(REGION)]
 before={rid:metric(originals[rid].intersection(REGION)) for rid in ids}
 after={rid:metric(derived[rid].intersection(REGION)) for rid in ids}
 old_union=unary_union(list(before.values()));new_union=unary_union(list(after.values()))
 # Remove a 2.2 km neighborhood of all external/coast boundaries, keeping only
 # interior coverage where fillets should not introduce inter-state gaps.
 internal_gap=old_union.buffer(-2200).difference(new_union).area
 new_overlap=[];overlap_deltas=[]
 for i,a in enumerate(ids):
  for b in ids[i+1:]:
   old=before[a].intersection(before[b]).area;new=after[a].intersection(after[b]).area
   if old<.01 and new>.01:new_overlap.append({'a':a,'b':b,'nameA':names[a],'nameB':names[b],'areaM2Approx':new})
   if abs(new-old)>100:overlap_deltas.append({'a':a,'b':b,'nameA':names[a],'nameB':names[b],'beforeM2Approx':old,'afterM2Approx':new,'differenceM2Approx':new-old})
 changes=[]
 for rid in ids:
  original,display=originals[rid],derived[rid]
  # Measure only actual boundaries inside the regional metric scope, excluding
  # distant parts of colonial/multicontinental or high-latitude geometries.
  old_boundary=metric(original.boundary.intersection(REGION))
  new_boundary=metric(display.boundary.intersection(REGION))
  delta=old_boundary.hausdorff_distance(new_boundary) if not old_boundary.is_empty and not new_boundary.is_empty else 0
  changes.append({'id':rid,'name':names[rid],'maxDeviationMApprox':delta,'areaChangePct':100*(display.area/original.area-1)})
 # Global topology is checked in native lon/lat coordinates without claiming
 # equal-area or geodesic measurement. 0.12 degrees conservatively exceeds the
 # implemented <= 2 km local displacement at every eligible latitude <= 80 N/S.
 # It excludes legitimate movement at exterior/coastal boundaries from gap checks.
 valid_ids=[rid for rid,g in originals.items() if g.is_valid and derived[rid].is_valid]
 display_geometries=[derived[rid] for rid in valid_ids]
 spatial_index=STRtree(display_geometries);global_new_overlap=[];pair_count=0
 area_epsilon=1e-10
 for i,rid in enumerate(valid_ids):
  for j in spatial_index.query(display_geometries[i],predicate='intersects'):
   if int(j)<=i:continue
   other=valid_ids[int(j)];pair_count+=1
   source_overlap=originals[rid].intersection(originals[other]).area
   if source_overlap>area_epsilon:continue
   display_overlap=derived[rid].intersection(derived[other]).area
   if display_overlap>area_epsilon:
    global_new_overlap.append({'a':rid,'b':other,'nameA':names[rid],'nameB':names[other],'sourceAreaDegreeSquared':source_overlap,'displayAreaDegreeSquared':display_overlap})
 global_source=unary_union([originals[rid] for rid in valid_ids])
 global_display=unary_union(display_geometries)
 global_new_gaps=global_source.buffer(-.12).difference(global_display)
 gap_components=list(global_new_gaps.geoms) if hasattr(global_new_gaps,'geoms') else [global_new_gaps]
 meaningful_gaps=[g for g in gap_components if g.area>area_epsilon]
 global_audit={'sourceInvalidCount':len(invalid_before),'excludedSourceInvalidIds':invalid_before,'validRecordCount':len(valid_ids),'intersectingCandidatePairs':pair_count,'numericAreaToleranceDegreeSquared':area_epsilon,'newOverlapPreviouslyDisjointPairs':global_new_overlap,'internalNewGapAreaDegreeSquared':sum(g.area for g in meaningful_gaps),'internalNewGapBounds':[list(g.bounds) for g in meaningful_gaps],'coastBufferDegrees':.12,'limitations':'Planar native lon/lat topology. Positive overlap threshold 1e-10 deg^2 excludes floating-point residuals. External/source-hole boundaries are eroded by a conservative 0.12 deg before checking newly uncovered interiors; this is not a uniform ground-distance buffer and omits narrow coastal/island interiors. Existing overlaps, source gaps and invalid input are not repaired. Dateline-crossing source geometries retain the source planar interpretation.'}
 report={**entry,'inputInvalidIds':invalid_before,'newInvalid':invalid_after,'componentOrHoleCountChanges':shape_count_changes,'countriesAbove2PctAreaChange':max_relative_area,'global':global_audit,'europe':{'region':[3,44,16,52],'metric':'Local equirectangular at 48 deg N; approximate ground metres, not an accuracy claim','records':len(ids),'internalNewGapM2Approx':internal_gap,'newOverlapPreviouslyDisjointM2Approx':sum(p['areaM2Approx'] for p in new_overlap),'newOverlapPairs':new_overlap,'existingOverlapDeltas':overlap_deltas,'changes':changes}}
 reports.append(report)
 print(json.dumps({k:v for k,v in report.items() if k not in ['inputInvalidIds','europe','global']},ensure_ascii=False))
 print(json.dumps({'year':year,'globalInputInvalid':len(invalid_before),'globalNewOverlapPairs':global_new_overlap,'globalNewGapDegreeSquared':global_audit['internalNewGapAreaDegreeSquared']},ensure_ascii=False))
 print(json.dumps({'year':year,'europeRecords':len(ids),'internalNewGapM2Approx':internal_gap,'newOverlapPreviouslyDisjointM2Approx':report['europe']['newOverlapPreviouslyDisjointM2Approx'],'newOverlapPairs':new_overlap,'maxDeviationMApprox':max([p['maxDeviationMApprox'] for p in changes] or [0])},ensure_ascii=False))
args.report.write_text(json.dumps(reports,ensure_ascii=False,indent=2))
failed=[r['year'] for r in reports if r.get('orderDependentIds') or r['newInvalid'] or r['componentOrHoleCountChanges'] or r['countriesAbove2PctAreaChange'] or r['global']['newOverlapPreviouslyDisjointPairs'] or r['global']['internalNewGapAreaDegreeSquared']>1e-10 or r['europe']['newOverlapPreviouslyDisjointM2Approx']>.1 or r['europe']['internalNewGapM2Approx']>.1]
print(json.dumps({'passed':len(reports)-len(failed),'total':len(reports),'failedYears':failed,'report':str(args.report)},ensure_ascii=False))
if failed:sys.exit(1)
