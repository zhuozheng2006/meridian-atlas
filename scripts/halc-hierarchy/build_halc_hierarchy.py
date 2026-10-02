#!/usr/bin/env python3
"""Build source-bound HALC 1500 ADM1 display groups, never national boundaries."""
import argparse,collections,gzip,hashlib,json,time
from pathlib import Path
import shapely
from shapely import union_all,transform
from shapely.geometry import mapping
from halc_geometry import (SOURCE_SHA1,ZOOM,EXTENT,BUFFER,WORLD,source,grid_geometries,
                           eligible,group_id,inverse,compact,check,parts_holes)

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',type=Path,required=True);p.add_argument('--output',type=Path,required=True)
    p.add_argument('--report',type=Path,required=True);a=p.parse_args();t0=time.perf_counter()
    check(not a.output.exists() or a.output.is_dir() and not any(a.output.iterdir()),'Output must be new or empty')
    check(not a.report.resolve().is_relative_to(a.output.resolve()),'Report must be outside output')
    attrs,geoms,sha=source(a.source);projected,quantized=grid_geometries(geoms)
    # Keep every existing MVT-grid coordinate; remove its precision model so
    # union cannot re-snap newly noded intersections a second time.
    quantized=shapely.set_precision(quantized,0.)
    grouped=collections.defaultdict(list);excluded=[]
    for i,attr in enumerate(attrs):
        if eligible(attr):grouped[attr['ADM1']].append(i)
        else:excluded.append({'fid':attr['fid'],'TYPE':attr['TYPE'],'ADM1':attr['ADM1']})
    features=[];groups={};audit=[];group_geoms=[];ids=set()
    for label,indices in sorted(grouped.items()):
        gid=group_id(label);check(gid not in ids,'Group hash collision');ids.add(gid)
        member_union=union_all(quantized[indices],grid_size=0.)
        check(not member_union.is_empty and member_union.is_valid,'Invalid member union '+label)
        shape=shapely.simplify(member_union,tolerance=0.,preserve_topology=True)
        check(shape.equals(member_union) and shape.boundary.equals(member_union.boundary),'Group union changed boundary '+label)
        check(shape.symmetric_difference(member_union).area==0.,'Group union changed area '+label)
        native_projected_union=union_all(projected[indices])
        original_diff=native_projected_union.symmetric_difference(shape)
        g=transform(shape,inverse);check(g.is_valid,'Invalid inverse-projected group '+label)
        selected=[attrs[i] for i in indices];adm0=sorted({v['ADM0'] for v in selected})
        typ=dict(sorted(collections.Counter(str(v['TYPE']) for v in selected).items()))
        quality=dict(sorted(collections.Counter(str(v['QUALITY']) for v in selected).items()))
        props={'id':gid,'ADM1':label,'shared':';' in label,'memberCount':len(indices),
               'ADM0Values':adm0,'ADM0Codes':sorted({c for v in adm0 for c in v.split(';')}),
               'TYPECounts':typ,'QUALITYCounts':quality}
        features.append({'type':'Feature','id':gid,'properties':props,'geometry':mapping(g)})
        part_count,hole_count=parts_holes(shape)
        item={**props,'fids':[attrs[i]['fid'] for i in indices],'bounds':list(g.bounds),
              'verticesIncludingRingClosures':int(shapely.get_num_coordinates(shape)),
              'polygonParts':part_count,'holes':hole_count,'areaGridUnitsSquared':float(shape.area),
              'boundaryLengthGridUnits':float(shape.length),
              'valid':True,'equalsQuantizedMemberUnion':True,'boundaryEqualsQuantizedMemberUnion':True,
              'symmetricDifferenceFromQuantizedMemberUnionGridUnitsSquared':0.,
              'quantizationDifferenceFromUnquantizedProjectedSourceUnionGridUnitsSquared':float(original_diff.area),
              'quantizationSymmetricDifferencePctOfOriginalArea':float(original_diff.area/native_projected_union.area*100),
              'signedAreaChangePctFromUnquantizedProjectedSourceUnion':float((shape.area/native_projected_union.area-1)*100)}
        groups[gid]=item;audit.append({k:item[k] for k in ['id','ADM1','memberCount','verticesIncludingRingClosures','polygonParts','holes','quantizationSymmetricDifferencePctOfOriginalArea','signedAreaChangePctFromUnquantizedProjectedSourceUnion']});group_geoms.append(shape)
    all_indices=[i for indices in grouped.values() for i in indices]
    all_union=union_all(quantized[all_indices],grid_size=0.);all_groups=union_all(group_geoms,grid_size=0.)
    aggregate_diff=shapely.symmetric_difference(all_groups,all_union,grid_size=0.)
    aggregate_exact=all_groups.equals(all_union)
    aggregate_boundary_exact=all_groups.boundary.equals(all_union.boundary)
    # Record floating overlay associativity residuals; a material difference of
    # even 0.0001 source-grid square units remains a build failure.
    check(aggregate_diff.area<1e-4,'Material aggregate coverage difference')
    fc={'type':'FeatureCollection','features':features};raw=compact(fc);gz=gzip.compress(raw,compresslevel=9,mtime=0)
    a.output.mkdir(parents=True,exist_ok=True);(a.output/'groups.geojson.gz').write_bytes(gz)
    manifest={'schemaVersion':1,'datasetId':'halc-v15-1500-adm1-groups','sourceVersion':'15.0','snapshotYear':1500,
      'sourceDoi':'10.34894/BTKFHV','sourceUrl':'https://doi.org/10.34894/BTKFHV','sourceGeometryUrl':'https://dataverse.nl/api/access/datafile/639014',
      'sourceSha1':SOURCE_SHA1,'sourceSha256':sha,'license':'CC BY-SA 4.0','licenseUrl':'https://creativecommons.org/licenses/by-sa/4.0/',
      'attribution':'Rombert Stapel, Historical Atlas of the Low Countries (1350–1800), v15, DataverseNL, doi:10.34894/BTKFHV. ADM1 display grouping and tile-grid conversion by World History Atlas.',
      'meaning':'Display/directory groups of original localities with identical full ADM1 strings; not national boundaries or single-sovereignty claims.',
      'selection':'TYPE != 8; ADM1 not null/empty; none of the semicolon-delimited ADM1 tokens equals XX. Shared strings and ordering are preserved.',
      'groupId':'halc1500-adm1- plus first 16 hexadecimal digits of SHA256(original complete UTF-8 ADM1 string)',
      'inputLocalities':len(attrs),'includedLocalities':len(all_indices),'excludedLocalities':len(excluded),'groupCount':len(groups),
      'sharedGroupCount':sum(v['shared'] for v in groups.values()),'sharedMemberCount':sum(v['memberCount'] for v in groups.values() if v['shared']),
      'excluded':excluded,'TYPECounts':dict(sorted(collections.Counter(str(attrs[i]['TYPE']) for i in all_indices).items())),
      'QUALITYCounts':dict(sorted(collections.Counter(str(attrs[i]['QUALITY']) for i in all_indices).items())),
      'bounds':list(shapely.total_bounds([f for f in [transform(g,inverse) for g in group_geoms]])),
      'geometryFile':'groups.geojson.gz','geometryBytes':len(gz),'geometryUncompressedBytes':len(raw),'geometrySha256':hashlib.sha256(gz).hexdigest(),
      'verticesIncludingRingClosures':sum(v['verticesIncludingRingClosures'] for v in groups.values()),
      'conversion':{'projection':'Normalized Web Mercator; same formula as HALC v15 locality MVT builder','zoom':ZOOM,'extent':EXTENT,'globalGridWidth':WORLD,
        'gridSize':1,'rounding':'Shapely set_precision(valid_output) before union; shared z10 global integer grid',
        'union':'Unary union after set_precision(quantized,0) clears the precision model without moving coordinates; grid_size=0 prevents second snapping; noded intersections may be fractional grid positions',
        'collinearRemoval':'Zero-tolerance simplify, equality and boundary equality asserted against member union',
        'geojsonCoordinates':'Inverse projection to WGS84 with Python float serialization; no decimal truncation or 6-decimal rounding; native quantized members retain original integer positions, exact union can add fractional intersection nodes',
        'smoothing':False,'manualRepair':False,'geographicInterpolation':False,'sourceFileModified':False,'TYPE8':'Excluded from groups, retained in original locality layer','XX':'Excluded from groups; never merged into one state'},
      'validation':{'allGroupsValid':True,'groupUnionEqualsAllSelectedQuantizedMembers':aggregate_exact,'aggregateBoundaryEqualsAllSelectedQuantizedMembers':aggregate_boundary_exact,'allGroupBoundariesEqualMemberUnionBoundaries':True,
        'aggregateSymmetricDifferenceGridUnitsSquared':float(aggregate_diff.area),'aggregateNumericToleranceGridUnitsSquared':1e-4,'coordinateAreaMeaning':'Web-Mercator integer grid measures, not geodesic km2 or historical positional accuracy',
        'originalSourceQuantizationDifferenceRecordedPerGroup':True},'groups':groups}
    (a.output/'manifest.json').write_bytes(compact(manifest));(a.output/'manifest.json.gz').write_bytes(gzip.compress(compact(manifest),compresslevel=9,mtime=0))
    report={'elapsedSeconds':round(time.perf_counter()-t0,3),'inputLocalities':len(attrs),'includedLocalities':len(all_indices),'excludedLocalities':len(excluded),
      'groups':len(groups),'sharedGroups':manifest['sharedGroupCount'],'vertices':manifest['verticesIncludingRingClosures'],'geojsonGzipBytes':len(gz),'geojsonRawBytes':len(raw),
      'manifestBytes':(a.output/'manifest.json').stat().st_size,'manifestGzipBytes':(a.output/'manifest.json.gz').stat().st_size,
      'validation':manifest['validation'],'largestQuantizationSymmetricDifferencePct':max(v['quantizationSymmetricDifferencePctOfOriginalArea'] for v in groups.values()),
      'environment':{'shapely':shapely.__version__,'geos':shapely.geos_version_string},'groupAudits':audit}
    a.report.parent.mkdir(parents=True,exist_ok=True);a.report.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='groupAudits'},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
