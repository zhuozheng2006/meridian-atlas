#!/usr/bin/env python3
"""Audit every published region asset, all source memberships, and decoded MVTs.

Add --geometry to rebuild per-zoom member unions and compare every tile's set
and boundary. --canonical additionally checks representative points and bounds.
"""
import argparse,collections,gzip,hashlib,json,time
from pathlib import Path
import numpy as np
import shapely
from shapely import transform,set_precision,union_all,STRtree
from shapely.geometry import shape,box,Point,MultiLineString
import mapbox_vector_tile
from halc_geometry import source,eligible,group_id,forward,check,SOURCE_SHA1,WORLD,EXTENT,BUFFER
from halc_region_edges import build_edge_network,clip_edge_network,lines,duplicate_segment_count

def polygons(g):
    if g.geom_type=='Polygon':return [g]
    if g.geom_type=='MultiPolygon':return list(g.geoms)
    if g.geom_type=='GeometryCollection':return [p for c in g.geoms for p in polygons(c)]
    return []

def polygonal(g):
    if g.geom_type in ('Polygon','MultiPolygon'):return g
    return shapely.MultiPolygon(polygons(g))

def exterior(g):return MultiLineString([p.exterior for p in polygons(g)])

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',type=Path,required=True);p.add_argument('--data-dir',type=Path,required=True)
    p.add_argument('--integrity',type=Path,required=True);p.add_argument('--report',type=Path,required=True)
    p.add_argument('--canonical',type=Path);p.add_argument('--geometry',action='store_true');a=p.parse_args();t0=time.perf_counter()
    check(not a.report.resolve().is_relative_to(a.data_dir.resolve()),'Audit report must be outside assets')
    inventory=json.loads(a.integrity.read_bytes());manifest=json.loads((a.data_dir/'manifest.json').read_bytes())
    expected_files=inventory['files'];actual={p.relative_to(a.data_dir).as_posix() for p in a.data_dir.rglob('*') if p.is_file()}
    check(actual==set(expected_files),'Unexpected or missing assets')
    for relative,item in expected_files.items():
        path=a.data_dir/relative;check(path.resolve().is_relative_to(a.data_dir.resolve()),'Unsafe inventory path')
        raw=path.read_bytes();check(len(raw)==item['bytes'],'Asset size mismatch: '+relative)
        check(hashlib.sha256(raw).hexdigest()==item['sha256'],'Asset hash mismatch: '+relative)
    check(len(expected_files)==inventory['fileCount'],'Inventory count mismatch')
    check(sum(v['bytes'] for v in expected_files.values())==inventory['totalBytes'],'Inventory bytes mismatch')
    check(inventory['snapshotYear']==manifest['snapshotYear']==1500,'Wrong year')
    check(inventory['datasetId']==manifest['datasetId']=='halc-v15-1500-adm1-groups','Wrong dataset')
    check(manifest['sourceLayer']=='halc_regions' and manifest['edgeSourceLayer']=='halc_region_edges' and manifest['extent']==EXTENT and manifest['buffer']==BUFFER,'Wrong MVT settings')
    check(manifest['minzoom']==6 and manifest['maxzoom']==10,'Wrong zoom range')
    check(manifest['license']=='CC BY-SA 4.0' and manifest['sourceDoi']=='10.34894/BTKFHV','Wrong source/license')
    for key in ['index','notice']:
        desc=manifest[key];check({k:desc[k] for k in ['bytes','sha256']}==expected_files[desc['path']],'Manifest descriptor mismatch')
    index_raw=gzip.decompress((a.data_dir/manifest['index']['path']).read_bytes())
    check(len(index_raw)==manifest['index']['uncompressedBytes'],'Index uncompressed size mismatch')
    index=json.loads(index_raw);groups=index['groups'];attrs,original,sha=source(a.source)
    check(inventory['sourceSha1']==manifest['sourceSha1']==index['sourceSha1']==SOURCE_SHA1,'Wrong source SHA1')
    check(inventory['sourceSha256']==manifest['sourceSha256']==sha,'Wrong source SHA256')
    check(index['snapshotYear']==1500 and index['datasetId']==manifest['datasetId'],'Index snapshot mismatch')
    by_group=collections.defaultdict(list)
    for i,row in enumerate(attrs):
        if eligible(row):by_group[row['ADM1']].append(i)
    check({group_id(label) for label in by_group}==set(groups),'Group IDs differ from source')
    numeric_ids=set();fids=[]
    for label,indices in by_group.items():
        gid=group_id(label);entry=groups[gid];members=[attrs[i] for i in indices]
        expected_fids=[r['fid'] for r in members];values=sorted({r['ADM0'] for r in members})
        expected={'id':gid,'ADM1':label,'shared':';' in label,'memberCount':len(members),'fids':expected_fids,
          'ADM0Values':values,'ADM0Codes':sorted({c for value in values for c in value.split(';')}),
          'TYPECounts':dict(sorted(collections.Counter(str(r['TYPE']) for r in members).items())),
          'QUALITYCounts':dict(sorted(collections.Counter(str(r['QUALITY']) for r in members).items())),
          'numericId':int(gid.rsplit('-',1)[1][:13],16)}
        check(all(entry[key]==value for key,value in expected.items()),'Index source fields differ: '+label)
        check(entry['numericId'] not in numeric_ids and entry['numericId']<2**52,'Nonunique/unsafe numeric ID')
        numeric_ids.add(entry['numericId']);fids.extend(expected_fids)
    check(len(fids)==len(set(fids))==14145==manifest['includedLocalities']==index['includedLocalities'],'Member coverage mismatch')
    check(len(groups)==152==manifest['groupCount']==index['groupCount'],'Wrong group count')
    check(len(attrs)-len(fids)==718==manifest['excludedLocalities']==index['excludedLocalities'],'Wrong excluded count')
    if a.canonical:
        m=json.loads((a.canonical/'manifest.json').read_bytes());raw=(a.canonical/m['geometryFile']).read_bytes()
        check(hashlib.sha256(raw).hexdigest()==m['geometrySha256']==manifest['canonicalGeometrySha256'],'Canonical hash mismatch')
        for feature in json.loads(gzip.decompress(raw))['features']:
            gid=feature['id'];g=shape(feature['geometry']);entry=groups[gid]
            check(list(g.bounds)==entry['bounds'],'Group bounds differ')
            check(g.covers(Point(entry['representativePoint'])),'Group representative point outside geometry')
    expected_tiles=set()
    for z in range(6,11):
        r=manifest['tileRanges'][str(z)]
        expected_tiles.update(f'tiles/{z}/{x}/{y}.pbf' for x in range(r['x'][0],r['x'][1]+1) for y in range(r['y'][0],r['y'][1]+1))
    check(expected_tiles=={t['path'] for t in manifest['tiles']}=={s for s in actual if s.endswith('.pbf')},'Incomplete rectangular tile coverage')
    check(len(expected_tiles)==len(manifest['tiles'])==814==manifest['tileCount'],'Wrong tile count')
    for tile in manifest['tiles']:
        check({k:tile[k] for k in ['bytes','sha256']}==expected_files[tile['path']],'Manifest tile hash differs')
        check(tile['path']==f"tiles/{tile['z']}/{tile['x']}/{tile['y']}.pbf",'Tile path mismatch')
    labels=sorted(by_group);gids=[group_id(label) for label in labels];projected=transform(original,forward) if a.geometry else None
    total_instances=0;total_empty=0;zoom_reports=[];deltas=[];total_edges=0;max_edge_overlap=0.
    for z in range(6,11):
        tiles=[t for t in manifest['tiles'] if t['z']==z];seen=set();empty=0;instances=0;zoom_edges=0
        if a.geometry:
            quantized=set_precision(transform(projected,lambda xy:xy*((2**z*EXTENT)/WORLD)),1.,mode='valid_output')
            simplified=shapely.simplify(quantized,0.,preserve_topology=True)
            check(all(shapely.equals(quantized,simplified)),'Zero-tolerance simplification changed geometry')
            cleared=set_precision(simplified,0.);check(all(shapely.equals(simplified,cleared)),'Precision reset moved input')
            region_geoms=np.array([union_all(cleared[by_group[label]],grid_size=0.) for label in labels],dtype=object)
            region_geoms=shapely.simplify(region_geoms,0.,preserve_topology=True);tree=STRtree(region_geoms)
            network=build_edge_network(region_geoms)
        for tile in tiles:
            decoded=mapbox_vector_tile.decode((a.data_dir/tile['path']).read_bytes(),default_options={'y_coord_down':True})
            check(set(decoded)=={'halc_regions','halc_region_edges'},'Unexpected source layers');layer=decoded['halc_regions']
            check(layer['extent']==8192 and layer['version']==2,'Wrong MVT version/extent')
            features=layer['features'];check(len(features)==tile['features'],'Wrong feature count')
            seen_tile=set();empty+=not features;instances+=len(features);expected={};original_clip={}
            origin=np.array([tile['x']*EXTENT,tile['y']*EXTENT])
            if a.geometry:
                clip=box(origin[0]-BUFFER,origin[1]-BUFFER,origin[0]+EXTENT+BUFFER,origin[1]+EXTENT+BUFFER)
                for i in tree.query(clip,predicate='intersects'):
                    g=polygonal(shapely.intersection(region_geoms[i],clip,grid_size=1.))
                    if not g.is_empty:
                        expected[gids[i]]=g
                        original_clip[gids[i]]=polygonal(shapely.intersection(region_geoms[i],clip,grid_size=0.))
            for feature in features:
                props=feature['properties'];gid=props['gid'];check(gid in groups and gid not in seen_tile,'Unknown/repeated group in tile')
                seen.add(gid);seen_tile.add(gid);entry=groups[gid]
                expected_props={key:entry[key] for key in ['ADM1','shared','memberCount']}
                expected_props.update({'gid':gid,'ADM0Values':json.dumps(entry['ADM0Values'],separators=(',',':')),
                                      'ADM0Codes':json.dumps(entry['ADM0Codes'],separators=(',',':'))})
                check(props==expected_props and feature['id']==entry['numericId'],'MVT source attributes differ')
                g=shape(feature['geometry']);check(g.is_valid and not g.is_empty,'Invalid decoded polygon')
                xmin,ymin,xmax,ymax=g.bounds;check(xmin>=-64 and ymin>=-64 and xmax<=8256 and ymax<=8256,'Tile buffer exceeded')
                if a.geometry:
                    world=transform(g,lambda xy:xy+origin);check(gid in expected,'Unexpected nonempty group geometry')
                    check(world.equals(expected[gid]) and world.boundary.equals(expected[gid].boundary),'Tile differs from source member union/clipping')
                    exact=original_clip[gid]
                    if not world.equals(exact):
                        delta=world.symmetric_difference(exact)
                        deltas.append({'z':z,'x':tile['x'],'y':tile['y'],'gid':gid,'ADM1':entry['ADM1'],
                          'areaGridSquared':float(delta.area),'exteriorDiscreteHausdorffGrid':float(exterior(world).hausdorff_distance(exterior(exact))),
                          'fullBoundaryDiscreteHausdorffGrid':float(world.boundary.hausdorff_distance(exact.boundary))})
            if a.geometry:check(set(expected)==seen_tile,'Expected region missing from encoded tile')
            edge_layer=decoded['halc_region_edges'];edge_features=edge_layer['features']
            check(edge_layer['extent']==8192 and edge_layer['version']==2,'Wrong edge MVT settings')
            check(len(edge_features)==tile['edgeFeatures']<=1,'Wrong edge feature count')
            total_edges+=len(edge_features);zoom_edges+=len(edge_features)
            if edge_features:
                f=edge_features[0];check(f['id']==1 and f['properties']=={'kind':'adm1-boundary','snapshotYear':1500},'Wrong edge properties')
                edge=shape(f['geometry']);check(edge.is_valid and not edge.is_empty,'Invalid decoded edge geometry')
                check(duplicate_segment_count(edge)==0,'Duplicate decoded edge segment')
                overlap=abs(edge.length-union_all(lines(edge),grid_size=0.).length);max_edge_overlap=max(max_edge_overlap,overlap)
                check(overlap<1e-6,'Overlapping decoded edge linework')
                xmin,ymin,xmax,ymax=edge.bounds;check(xmin>=-64 and ymin>=-64 and xmax<=8256 and ymax<=8256,'Edge tile buffer exceeded')
            if a.geometry:
                expected_edges=clip_edge_network(network,clip)
                check(bool(edge_features)==(not expected_edges.is_empty),'Edge network missing or unexpected')
                if edge_features:
                    world_edge=transform(edge,lambda xy:xy+origin)
                    check(world_edge.equals(expected_edges),'Encoded edge differs from clipped source network')
        check(seen==set(groups),'A group is missing at zoom '+str(z))
        zr={'zoom':z,'tiles':len(tiles),'emptyTiles':int(empty),'features':instances,'groupsPresent':len(seen),'edgeFeatures':zoom_edges}
        expected_z=next(r for r in manifest['zooms'] if r['zoom']==z)
        check(zr['tiles']==expected_z['tiles'] and zr['emptyTiles']==expected_z['emptyTiles'] and zoom_edges==expected_z['edgeFeatures'],'Zoom counts mismatch')
        zoom_reports.append(zr);total_empty+=empty;total_instances+=instances;print(json.dumps(zr),flush=True)
    check(total_empty==449==manifest['emptyTiles'],'Empty count mismatch')
    check(total_instances==manifest['validation']['decodedFeatureInstances']==1919,'Total feature count mismatch')
    check(total_edges==manifest['validation']['decodedEdgeFeatures'],'Total edge count mismatch')
    check(sum(t['bytes'] for t in manifest['tiles'])==manifest['tileBytes'],'Tile total bytes mismatch')
    check(max(t['bytes'] for t in manifest['tiles'])==manifest['maxTileBytes'],'Largest tile mismatch')
    result={'passed':True,'elapsedSeconds':round(time.perf_counter()-t0,3),'inventorySha256':hashlib.sha256(a.integrity.read_bytes()).hexdigest(),
      'files':len(actual),'totalBytes':inventory['totalBytes'],'sourceYearBound':1500,'groups':len(groups),'sourceMemberships':len(fids),
      'tiles':len(expected_tiles),'emptyTiles':int(total_empty),'decodedFeatureInstances':total_instances,'allDecodedGeometriesValid':True,
      'allSourceAttributesPreserved':True,'allInventoryHashesVerified':True,'allBufferedTileRangesComplete':True,
      'decodedEdgeFeatures':total_edges,'allDecodedEdgeGeometriesValid':True,'duplicateDecodedLineSegments':0,
      'maxDecodedLineLengthMinusUniqueLineLength':max_edge_overlap,
      'representativePointsVerifiedAgainstCanonical':bool(a.canonical),'allTileGeometriesComparedToSourceMemberUnions':a.geometry,'zooms':zoom_reports}
    if a.geometry:
        result['clippingQuantizationDifferences']={'changedFeatureInstances':len(deltas),
          'maxAreaGridSquared':max((d['areaGridSquared'] for d in deltas),default=0.),
          'maxExteriorDiscreteHausdorffGrid':max((d['exteriorDiscreteHausdorffGrid'] for d in deltas),default=0.),
          'maxFullBoundaryDiscreteHausdorffGrid':max((d['fullBoundaryDiscreteHausdorffGrid'] for d in deltas),default=0.),
          'meaning':'MVT after integer-grid clipping versus an unsnapped clip of the per-zoom quantized-member union. Distances are discrete Hausdorff samples, not continuous error bounds or source historical accuracy. Tiny holes/parts may collapse.',
          'differences':deltas}
    a.report.parent.mkdir(parents=True,exist_ok=True);a.report.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k not in ('zooms','clippingQuantizationDifferences')},indent=2))

if __name__=='__main__':main()
