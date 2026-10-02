#!/usr/bin/env python3
"""Build view-loaded HALC display-group MVT without altering locality tiles."""
import argparse,collections,gzip,hashlib,json,math,time
from pathlib import Path
import numpy as np
import shapely
from shapely import transform,set_precision,union_all,STRtree
from shapely.geometry import shape,box
import mapbox_vector_tile
from mapbox_vector_tile.encoder import on_invalid_geometry_raise
from halc_geometry import (source,eligible,group_id,forward,inverse,compact,check,
                           SOURCE_SHA1,WORLD,EXTENT,BUFFER)
from finalize_halc_regions import finalize_assets
from halc_region_edges import build_edge_network,clip_edge_network,lines,duplicate_segment_count

def polygonal(g):
    if g.geom_type in ('Polygon','MultiPolygon'):return g
    if g.geom_type=='GeometryCollection':
        parts=[]
        for x in g.geoms:
            if x.geom_type=='Polygon':parts.append(x)
            elif x.geom_type=='MultiPolygon':parts.extend(x.geoms)
        return shapely.MultiPolygon(parts)
    return shapely.MultiPolygon([])

def numeric_id(gid):return int(gid.rsplit('-',1)[1][:13],16)

def write_json(path,x):path.write_bytes(compact(x))

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',type=Path,required=True);p.add_argument('--canonical',type=Path,required=True)
    p.add_argument('--locality-manifest',type=Path,required=True);p.add_argument('--output',type=Path,required=True)
    p.add_argument('--report',type=Path,required=True);a=p.parse_args();t0=time.perf_counter()
    check(not a.output.exists() or a.output.is_dir() and not any(a.output.iterdir()),'Output must be new or empty')
    check(not a.report.resolve().is_relative_to(a.output.resolve()),'Report must be outside assets')
    attrs,original,sha=source(a.source);meta=json.loads((a.canonical/'manifest.json').read_bytes())
    locality=json.loads(a.locality_manifest.read_bytes());check(locality['sourceSha1']==SOURCE_SHA1,'Wrong locality manifest')
    canonical_raw=(a.canonical/meta['geometryFile']).read_bytes()
    check(hashlib.sha256(canonical_raw).hexdigest()==meta['geometrySha256'],'Canonical hash mismatch')
    fc=json.loads(gzip.decompress(canonical_raw));grouped=collections.defaultdict(list)
    for i,r in enumerate(attrs):
        if eligible(r):grouped[r['ADM1']].append(i)
    labels=sorted(grouped);ids=[group_id(label) for label in labels];numeric=[numeric_id(gid) for gid in ids]
    check(len(set(numeric))==len(numeric) and max(numeric)<2**52,'Numeric group ID collision/range')
    by_id={f['id']:f for f in fc['features']};props=[];index={}
    for gid,num in zip(ids,numeric):
        entry=meta['groups'][gid];f=by_id[gid];g=shape(f['geometry']);point=g.representative_point()
        index[gid]={k:entry[k] for k in ['id','ADM1','shared','memberCount','ADM0Values','ADM0Codes','TYPECounts','QUALITYCounts','fids','bounds']}
        index[gid].update({'numericId':num,'representativePoint':[point.x,point.y]})
        props.append({'gid':gid,'ADM1':entry['ADM1'],'shared':entry['shared'],'memberCount':entry['memberCount'],
                      'ADM0Values':json.dumps(entry['ADM0Values'],separators=(',',':')),
                      'ADM0Codes':json.dumps(entry['ADM0Codes'],separators=(',',':'))})
    projected=transform(original,forward);a.output.mkdir(parents=True,exist_ok=True)
    index_payload={'schemaVersion':1,'datasetId':'halc-v15-1500-adm1-groups','snapshotYear':1500,'sourceDoi':meta['sourceDoi'],
      'license':meta['license'],'licenseUrl':meta['licenseUrl'],'sourceSha1':SOURCE_SHA1,'groups':index,
      'groupCount':len(ids),'includedLocalities':meta['includedLocalities'],'excludedLocalities':meta['excludedLocalities'],
      'meaning':meta['meaning'],'bounds':meta['bounds']}
    index_raw=compact(index_payload);index_gz=gzip.compress(index_raw,compresslevel=9,mtime=0)
    (a.output/'groups-index.json.gz').write_bytes(index_gz)
    tile_stats=[];zoom_stats=[];max_wire_delta=0.;max_bound_excess=0.;decoded_instances=0
    decoded_edges=0;max_edge_length_delta=0.;edge_zero_duplicate=True
    for z in range(6,11):
        zt=time.perf_counter();scale=(2**z*EXTENT)/WORLD
        scaled=transform(projected,lambda xy:xy*scale)
        quantized=set_precision(scaled,1.,mode='valid_output');simple=shapely.simplify(quantized,0.,preserve_topology=True)
        check(all(shapely.equals(quantized,simple)),'Zero tolerance changed source shape')
        cleared=set_precision(simple,0.)
        check(all(shapely.equals(simple,cleared)),'Clearing precision altered source shape')
        shapes=np.array([union_all(cleared[grouped[label]],grid_size=0.) for label in labels],dtype=object)
        check(all(shapely.is_valid(shapes)),'Invalid region member union')
        exact=shapely.simplify(shapes,0.,preserve_topology=True)
        check(all(shapely.equals(shapes,exact)),'Region optimization altered member union')
        shapes=exact;tree=STRtree(shapes);network=build_edge_network(shapes)
        check(network.is_valid and duplicate_segment_count(network)==0,'Invalid or duplicated global line network')
        ranges=locality['tileRanges'][str(z)];seen=set();empty=0;size=0;count=0;zoom_edges=0
        for x in range(ranges['x'][0],ranges['x'][1]+1):
            for y in range(ranges['y'][0],ranges['y'][1]+1):
                origin=np.array([x*EXTENT,y*EXTENT]);clip=box(origin[0]-BUFFER,origin[1]-BUFFER,origin[0]+EXTENT+BUFFER,origin[1]+EXTENT+BUFFER)
                features=[];prewire={}
                for i in sorted(map(int,tree.query(clip,predicate='intersects'))):
                    g=polygonal(shapely.intersection(shapes[i],clip,grid_size=1.))
                    if g.is_empty:continue
                    check(g.is_valid,'Invalid clipped region')
                    local=transform(g,lambda xy:xy-origin);prewire[numeric[i]]=local
                    features.append({'id':numeric[i],'properties':props[i],'geometry':local})
                clipped_edges=clip_edge_network(network,clip)
                local_edges=transform(clipped_edges,lambda xy:xy-origin)
                edge_features=[] if clipped_edges.is_empty else [{'id':1,'properties':{'kind':'adm1-boundary','snapshotYear':1500},'geometry':local_edges}]
                raw=mapbox_vector_tile.encode([{'name':'halc_regions','features':features},{'name':'halc_region_edges','features':edge_features}],default_options={
                  'extents':EXTENT,'y_coord_down':True,'on_invalid_geometry':on_invalid_geometry_raise,'check_winding_order':True})
                all_decoded=mapbox_vector_tile.decode(raw,default_options={'y_coord_down':True})
                decoded=all_decoded['halc_regions'];wire_ids=set()
                for f in decoded['features']:
                    gid=f['properties']['gid'];wire_ids.add(f['id']);seen.add(gid)
                    check(f['id']==index[gid]['numericId'],'Encoded ID mismatch')
                    check(f['properties']==props[ids.index(gid)],'Encoded source properties changed')
                    g=shape(f['geometry']);check(g.is_valid and not g.is_empty,'Invalid encoded MVT')
                    delta=g.symmetric_difference(prewire[f['id']]).area;max_wire_delta=max(max_wire_delta,delta)
                    check(delta==0.,'MVT encoding altered clipped polygon')
                    l,b,r,t=g.bounds;max_bound_excess=max(max_bound_excess,-BUFFER-l,-BUFFER-b,r-(EXTENT+BUFFER),t-(EXTENT+BUFFER));decoded_instances+=1
                missing=set(prewire)-wire_ids
                check(not missing,'Region disappears during MVT encoding')
                edge_decoded=all_decoded['halc_region_edges']['features']
                check(len(edge_decoded)==len(edge_features),'Edge network disappeared during MVT encoding')
                if edge_decoded:
                    edge=shape(edge_decoded[0]['geometry'])
                    check(edge.is_valid and not edge.is_empty,'Invalid encoded edge network')
                    check(edge.equals(local_edges),'Edge encoding altered clipped line set')
                    check(duplicate_segment_count(edge)==0,'Duplicate encoded edge segment')
                    length_delta=abs(edge.length-union_all(lines(edge),grid_size=0.).length)
                    max_edge_length_delta=max(max_edge_length_delta,length_delta)
                    check(length_delta<1e-6,'Overlapping encoded linework')
                decoded_edges+=len(edge_decoded);zoom_edges+=len(edge_decoded)
                empty+=not decoded['features'];size+=len(raw);count+=1
                relative=f'tiles/{z}/{x}/{y}.pbf';path=a.output/relative;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw)
                tile_stats.append({'path':relative,'z':z,'x':x,'y':y,'bytes':len(raw),'features':len(decoded['features']),
                  'edgeFeatures':len(edge_decoded),'sha256':hashlib.sha256(raw).hexdigest()})
        zoom_stats.append({'zoom':z,'tiles':count,'emptyTiles':int(empty),'bytes':size,'groupsPresent':len(seen),'missingGroups':sorted(set(ids)-seen),
                           'edgeFeatures':zoom_edges,'elapsedSeconds':round(time.perf_counter()-zt,3)})
        print(json.dumps(zoom_stats[-1]),flush=True)
    check(max_bound_excess==0.,'Encoded buffer exceeded')
    manifest={'schemaVersion':1,'datasetId':'halc-v15-1500-adm1-groups','snapshotYear':1500,'sourceVersion':'15.0',
      'sourceDoi':meta['sourceDoi'],'sourceGeometryUrl':meta['sourceGeometryUrl'],'sourceSha1':SOURCE_SHA1,'sourceSha256':sha,
      'license':meta['license'],'licenseUrl':meta['licenseUrl'],'attribution':meta['attribution'],'meaning':meta['meaning'],
      'groupCount':len(ids),'includedLocalities':meta['includedLocalities'],'excludedLocalities':meta['excludedLocalities'],
      'sourceLayer':'halc_regions','edgeSourceLayer':'halc_region_edges','bounds':locality['bounds'],'minzoom':6,'maxzoom':10,'extent':EXTENT,'buffer':BUFFER,
      'tileUrlTemplate':'tiles/{z}/{x}/{y}.pbf','tileFormat':'MVT2 uncompressed protobuf','tileRanges':locality['tileRanges'],
      'tileCount':len(tile_stats),'emptyTiles':sum(t['emptyTiles'] for t in zoom_stats),'tileBytes':sum(t['bytes'] for t in tile_stats),
      'maxTileBytes':max(t['bytes'] for t in tile_stats),'tiles':tile_stats,
      'zooms':[{k:v for k,v in row.items() if k!='elapsedSeconds'} for row in zoom_stats],
      'index':{'path':'groups-index.json.gz','bytes':len(index_gz),'uncompressedBytes':len(index_raw),'sha256':hashlib.sha256(index_gz).hexdigest()},
      'numericId':'First 13 hexadecimal digits (52 bits) of the complete ADM1 SHA256; stable gid string also retained in properties',
      'canonicalGeometrySha256':meta['geometrySha256'],
      'conversion':{'inputGrid':'Original source projected and independently quantized at each zoom using the same locality-MVT grid, extent and buffer',
        'union':'Clear precision model without moving quantized coordinates; union per full ADM1 string with grid_size=0; no second union snap',
        'clipping':'Per-group polygon intersection with buffered tile rectangle at grid_size=1, followed by standard MVT encoding',
        'note':'Tile clipping re-quantizes union intersection nodes to the tile integer grid. This is not identical to the canonical floating-coordinate union everywhere, nor always associative with per-locality clipping. No manual repairs or smoothing.',
        'sharedBoundaries':'Each query polygon retains its own boundary. Visible edges use a separate unique line network; draw halc_region_edges uniformly instead of stroking each polygon.',
        'edgeNetwork':'Global group boundaries are unioned at grid_size=1, line-merged, clipped on the tile grid, unioned at grid_size=1 again to deduplicate snapped coincidences, and line-merged. This line conversion may differ from ghost polygon boundaries by grid quantization; no tile-frame boundaries are invented. Group memberships remain unchanged.',
        'TYPE8Excluded':True,'XXExcluded':True,'smoothing':False,'sourceGeometryUnmodified':True},
      'validation':{'allDecodedGeometriesValid':True,'decodedFeatureInstances':decoded_instances,'allEncodedAttributesPreserved':True,
                    'maxEncodingSymmetricDifferenceFromClippedInputGridSquared':max_wire_delta,'maxBufferExcess':max_bound_excess,
                    'decodedEdgeFeatures':decoded_edges,'allDecodedEdgeGeometriesValid':True,'duplicateDecodedLineSegments':0,
                    'maxDecodedLineLengthMinusUniqueLineLength':max_edge_length_delta}}
    write_json(a.output/'manifest.json',manifest)
    finalize_assets(a.output,a.report.with_name('halc-regions.integrity.json'))
    report={k:manifest[k] for k in ['groupCount','includedLocalities','excludedLocalities','tileCount','emptyTiles','tileBytes','maxTileBytes','index','validation','zooms']}
    report['zooms']=zoom_stats
    report.update({'elapsedSeconds':round(time.perf_counter()-t0,3),'fileCount':len([f for f in a.output.rglob('*') if f.is_file()]),
                  'totalBytes':sum(f.stat().st_size for f in a.output.rglob('*') if f.is_file())})
    a.report.parent.mkdir(parents=True,exist_ok=True);a.report.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='zooms'},indent=2))

if __name__=='__main__':main()
