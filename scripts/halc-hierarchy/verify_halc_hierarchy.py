#!/usr/bin/env python3
"""Independently compare serialized HALC display groups to their source members."""
import argparse,collections,gzip,hashlib,json,time
from pathlib import Path
import numpy as np
import shapely
from shapely import union_all,transform,set_precision,get_coordinates
from shapely.geometry import shape,box
from halc_geometry import source,grid_geometries,eligible,group_id,forward,inverse,check,EXTENT,BUFFER

def polygonal(g):
    if g.geom_type in ('Polygon','MultiPolygon'):return g
    if g.geom_type=='GeometryCollection':
        parts=[]
        for x in g.geoms:
            if x.geom_type=='Polygon':parts.append(x)
            elif x.geom_type=='MultiPolygon':parts.extend(x.geoms)
        return shapely.MultiPolygon(parts)
    return shapely.MultiPolygon([])

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',type=Path,required=True);p.add_argument('--publish',type=Path,required=True)
    p.add_argument('--report',type=Path,required=True);p.add_argument('--mvt-dir',type=Path)
    p.add_argument('--mvt-build-report',type=Path);a=p.parse_args();t0=time.perf_counter()
    check(not a.report.resolve().is_relative_to(a.publish.resolve()),'Audit report must be outside assets')
    m=json.loads((a.publish/'manifest.json').read_bytes());raw=(a.publish/m['geometryFile']).read_bytes()
    check(hashlib.sha256(raw).hexdigest()==m['geometrySha256'],'GeoJSON SHA256 mismatch')
    check(gzip.decompress((a.publish/'manifest.json.gz').read_bytes())==(a.publish/'manifest.json').read_bytes(),'Compressed manifest mismatch')
    check(m['snapshotYear']==1500 and m['datasetId']=='halc-v15-1500-adm1-groups','Incorrect snapshot')
    attrs,original,sha=source(a.source);_,quantized=grid_geometries(original)
    quantized=set_precision(quantized,0.)
    check(sha==m['sourceSha256'],'Source SHA256 mismatch')
    by_fid={r['fid']:i for i,r in enumerate(attrs)};grouped=collections.defaultdict(list)
    for i,r in enumerate(attrs):
        if eligible(r):grouped[r['ADM1']].append(i)
    fc=json.loads(gzip.decompress(raw));features=fc['features'];seen=set();rendered={};max_roundtrip=0.
    check(len(features)==len(grouped)==m['groupCount'],'Group count mismatch')
    for f in features:
        props=f['properties'];label=props['ADM1'];gid=group_id(label)
        check(f['id']==props['id']==gid and gid not in seen,'Unstable/duplicate group ID');seen.add(gid)
        indices=grouped[label];records=[attrs[i] for i in indices];entry=m['groups'][gid]
        check(entry['fids']==[v['fid'] for v in records],'Member fids changed '+label)
        check(all(eligible(v) for v in records),'Excluded member appears '+label)
        values=sorted({v['ADM0'] for v in records})
        expected_props={'id':gid,'ADM1':label,'shared':';' in label,'memberCount':len(indices),
                        'ADM0Values':values,'ADM0Codes':sorted({c for v in values for c in v.split(';')}),
                        'TYPECounts':dict(sorted(collections.Counter(str(v['TYPE']) for v in records).items())),
                        'QUALITYCounts':dict(sorted(collections.Counter(str(v['QUALITY']) for v in records).items()))}
        check(props==expected_props,'Source properties changed '+label)
        check(all(entry[k]==v for k,v in props.items()),'Manifest properties differ '+label)
        geographic=shape(f['geometry']);check(geographic.is_valid and not geographic.is_empty,'Invalid serialized geometry '+label)
        member_union=union_all(quantized[indices],grid_size=0.)
        expected=shapely.simplify(member_union,tolerance=0.,preserve_topology=True)
        check(expected.equals(member_union) and expected.boundary.equals(member_union.boundary),'Group differs from exact member union '+label)
        expected_geo=transform(expected,inverse)
        check(geographic.equals(expected_geo),'Serialized group differs from inverse-projected source union '+label)
        check(geographic.boundary.equals(expected_geo.boundary),'Serialized geographic boundary differs '+label)
        check(geographic.symmetric_difference(expected_geo).area==0.,'Serialized geographic area differs '+label)
        projected=transform(geographic,forward);coords=get_coordinates(projected);target=get_coordinates(expected)
        check(coords.shape==target.shape,'Serialized vertex count differs '+label)
        residual=float(np.max(np.abs(coords-target)));max_roundtrip=max(max_roundtrip,residual)
        check(residual<1e-6,'GeoJSON serialization lost source grid precision '+label)
        check(expected.area==entry['areaGridUnitsSquared'],'Reported area differs '+label)
        rendered[gid]=expected
    members=[fid for v in m['groups'].values() for fid in v['fids']]
    check(len(members)==len(set(members))==sum(map(len,grouped.values()))==m['includedLocalities'],'Duplicate/missing members')
    check(set(members)=={r['fid'] for r in attrs if eligible(r)},'Source membership coverage differs')
    check({r['fid'] for r in m['excluded']}=={r['fid'] for r in attrs if not eligible(r)},'Excluded membership differs')
    check(len(m['excluded'])==m['excludedLocalities'],'Excluded count mismatch')
    tile_results=[]
    if a.mvt_dir:
        check(a.mvt_build_report is not None,'MVT build report required for sampling')
        import mapbox_vector_tile
        bm=json.loads(a.mvt_build_report.read_bytes())
        samples=sorted([t for t in bm['tiles'] if t['z']==10],key=lambda t:(-t['features'],t['x'],t['y']))[:3]
        for tile in samples:
            path=a.mvt_dir/'tiles'/'10'/str(tile['x'])/f"{tile['y']}.pbf";data=path.read_bytes()
            check(hashlib.sha256(data).hexdigest()==tile['sha256'],'Existing MVT sample hash changed')
            decoded=mapbox_vector_tile.decode(data,default_options={'y_coord_down':True})['halc_localities']
            local=collections.defaultdict(list);origin=np.array([tile['x']*EXTENT,tile['y']*EXTENT])
            for f in decoded['features']:
                r=attrs[by_fid[f['id']]]
                if not eligible(r):continue
                local[group_id(r['ADM1'])].append(transform(shape(f['geometry']),lambda xy:xy+origin))
            bounds=box(origin[0]-BUFFER,origin[1]-BUFFER,origin[0]+EXTENT+BUFFER,origin[1]+EXTENT+BUFFER)
            differences=[]
            for gid,geoms in local.items():
                existing=union_all(geoms,grid_size=0.)
                # The locality MVT independently clips/snaps each source member;
                # the display group is clipped once only for this comparison.
                clipped=polygonal(shapely.intersection(rendered[gid],bounds,grid_size=1.))
                exact=clipped.equals(existing);boundary_exact=clipped.boundary.equals(existing.boundary)
                if not exact or not boundary_exact:
                    delta=shapely.symmetric_difference(clipped,existing,grid_size=0.)
                    differences.append({'id':gid,'areaDifferenceGridUnitsSquared':float(delta.area),
                                        'boundaryHausdorffGridUnits':float(clipped.boundary.hausdorff_distance(existing.boundary)),
                                        'equals':exact,'boundaryEquals':boundary_exact})
            tile_results.append({'z':10,'x':tile['x'],'y':tile['y'],'tileFeatures':tile['features'],'verifiedGroups':len(local),
                                 'exactUnionAndBoundaryEquality':not differences,'differences':differences})
    result={'passed':True,'elapsedSeconds':round(time.perf_counter()-t0,3),'groups':len(features),'includedLocalities':len(members),
            'excludedLocalities':len(m['excluded']),'allSerializedGroupsValid':True,'exactEqualityToInverseProjectedQuantizedSourceMemberUnions':True,
            'exactBoundaryEquality':True,'symmetricDifferenceGridUnitsSquared':0.,'maxReprojectionResidualGridUnits':max_roundtrip,
            'stableGroupIds':True,'fullAdm1OrderPreserved':True,'allAdm0MembershipValuesRetained':True,'TYPE8Excluded':True,'XXExcluded':True,
            'sampledExistingMvtTiles':tile_results,'geometrySha256':m['geometrySha256'],
            'interpretation':'Every serialized group equals the inverse-projected exact union of source members after the existing z10 input quantization. Union adds no second snap. Independently clipped/snapped locality MVT samples may have measured sub-grid differences; neither this check nor tile density guarantees historical accuracy.'}
    a.report.parent.mkdir(parents=True,exist_ok=True);a.report.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,indent=2))

if __name__=='__main__':main()
