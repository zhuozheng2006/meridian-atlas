"""Exact complete-record spatial shards for official HALC Landscape 1500.

No geometry clipping, simplification, snapping, union, difference, reprojection,
rounding or attribute edits are performed in published features. Bboxes only
select downloads. Dependencies: shapely >= 2, numpy, pyproj (audit area only).
"""
from pathlib import Path
import argparse, sqlite3, json, gzip, hashlib, math, collections, sys, time
import xml.etree.ElementTree as ET
import numpy as np
import shapely
from shapely.geometry import mapping, shape, box, Point
from pyproj import Transformer

EXPECTED_SIZE=9252864
EXPECTED_SHA1='ad5923b98e627eed5c8663790b9b3f71ff45f98b'
CLASSES={0:'Cultivatable land (e.g. residential/agricultural)',1:'Dunes or sandy soils',2:'Mud flats or marshes',3:'Forests',4:'Heath or moorland',7:'Fresh or coastal water, navigable for small vessels',8:'Fresh water, navigable for larger vessels',9:'Open sea, navigable for larger vessels'}
def encoded(obj):return json.dumps(obj,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode('utf-8')
def sha(data):return hashlib.sha256(data).hexdigest()
def bounds(items):return [min(b[0] for b in items),min(b[1] for b in items),max(b[2] for b in items),max(b[3] for b in items)]
def intersects(a,b):return a[0]<=b[2] and a[2]>=b[0] and a[1]<=b[3] and a[3]>=b[1]
def viewport(lon,lat,z,width=1200,height=700):
    scale=512*2**z;x=(lon+180)/360*scale;y=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*scale
    inv=lambda v:math.degrees(math.atan(math.sinh(math.pi*(1-2*v/scale))))
    return [(x-width/2)/scale*360-180,inv(y+height/2),(x+width/2)/scale*360-180,inv(y-height/2)]
def source_records(path):
    raw=path.read_bytes();assert len(raw)==EXPECTED_SIZE and hashlib.sha1(raw).hexdigest()==EXPECTED_SHA1,'Incomplete or unexpected official source; refusing to parse'
    db=sqlite3.connect(path.resolve().as_uri()+'?mode=ro',uri=True);db.row_factory=sqlite3.Row
    assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
    layers=[dict(r) for r in db.execute('SELECT * FROM gpkg_geometry_columns')];assert len(layers)==1
    layer=layers[0];assert layer['srs_id']==4326 and layer['geometry_type_name']=='POLYGON' and layer['z']==0 and layer['m']==0
    table=layer['table_name'];assert '"' not in table;column=layer['column_name'];items=[]
    for row in db.execute(f'SELECT * FROM "{table}" ORDER BY fid'):
        blob=row[column];assert blob[:2]==b'GP';offset=8+8*{0:0,1:4,2:6,3:6,4:8}[(blob[3]>>1)&7]
        geom=shapely.from_wkb(blob[offset:]);attrs={k:row[k] for k in row.keys() if k!=column}
        assert geom.geom_type=='Polygon' and geom.is_valid and not geom.is_empty,(attrs['fid'],shapely.is_valid_reason(geom))
        feature={'type':'Feature','id':attrs['fid'],'properties':attrs,'geometry':mapping(geom)}
        payload=encoded(feature);feature=json.loads(payload)
        assert np.array_equal(shapely.get_coordinates(geom),shapely.get_coordinates(shape(feature['geometry']))),'Geometry roundtrip changed coordinates'
        assert feature['properties']==attrs
        items.append({'feature':feature,'geom':geom,'bbox':list(geom.bounds),'vertices':int(shapely.get_num_coordinates(geom)),'rawBytes':len(payload),'sha256':sha(payload)})
    db.close();assert len({x['feature']['id'] for x in items})==len(items)
    return items,layer,{'file':path.name,'bytes':len(raw),'sha1':hashlib.sha1(raw).hexdigest(),'sha256':sha(raw),'dataFileId':639024,'datasetVersion':15,'doi':'10.34894/BTKFHV','license':'CC BY-SA 4.0','coordinateReferenceSystem':'EPSG:4326'}
def main():
    ap=argparse.ArgumentParser();ap.add_argument('source',type=Path);ap.add_argument('out',type=Path);ap.add_argument('--qml',type=Path);ap.add_argument('--full-reference',type=Path);args=ap.parse_args()
    out=args.out;out.mkdir(parents=True,exist_ok=True);data=out/'data';(data/'shards').mkdir(parents=True,exist_ok=True)
    items,layer,source=source_records(args.source)
    allfeatures={x['feature']['id']:x['feature'] for x in items};byid={x['feature']['id']:x for x in items}
    if args.full_reference:
        reference=json.loads(gzip.decompress(args.full_reference.read_bytes()))
        assert {f['id']:f for f in reference['features']}==allfeatures,'Independent exported features differ from the existing full export'
    groups=[];cells=collections.defaultdict(list)
    for item in items:
        fid=item['feature']['id'];b=item['bbox']
        if item['vertices']>=8000 or b[2]-b[0]>=2 or b[3]-b[1]>=2 or item['rawBytes']>=524288:
            groups.append((f'large-{fid:05d}',[item]))
        else:
            # Assignment is by whole-record bbox centre; the bbox remains the
            # true full extent. Neither cells nor their edges become geometry.
            cell=(math.floor((b[0]+b[2])/2),math.floor((b[1]+b[3])/2));cells[cell].append(item)
    for (x,y),entries in sorted(cells.items()):
        group=[];size=0;part=0
        for item in entries:
            if group and size+item['rawBytes']>524288:
                groups.append((f'cell-{x:+04d}-{y:+04d}-{part:02d}',group));group=[];size=0;part+=1
            group.append(item);size+=item['rawBytes']
        if group:groups.append((f'cell-{x:+04d}-{y:+04d}-{part:02d}',group))
    index={'schemaVersion':1,'snapshotYear':1500,'bounds':bounds([x['bbox'] for x in items]),'source':source,'shards':[]}
    reloaded={};duplicate_ids=[]
    for name,entries in sorted(groups):
        file='shards/'+name+'.geojson.gz';raw=encoded({'type':'FeatureCollection','features':[x['feature'] for x in entries]});compressed=gzip.compress(raw,compresslevel=9,mtime=0)
        (data/file).write_bytes(compressed)
        index['shards'].append({'file':file,'bbox':bounds([x['bbox'] for x in entries]),'count':len(entries),'vertices':sum(x['vertices'] for x in entries),'bytes':len(compressed),'sha256':sha(compressed),'features':[{'id':x['feature']['id'],'bbox':x['bbox'],'sha256':x['sha256']} for x in entries]})
        for feature in json.loads(gzip.decompress(compressed))['features']:
            if feature['id'] in reloaded:duplicate_ids.append(feature['id'])
            reloaded[feature['id']]=feature
    assert not duplicate_ids and reloaded==allfeatures,'Shards lost, duplicated, changed or added source records'
    rawindex=encoded(index);(data/'index.json').write_bytes(rawindex);(data/'index.json.gz').write_bytes(gzip.compress(rawindex,compresslevel=9,mtime=0))
    expected={s['file'] for s in index['shards']}
    existing={'shards/'+p.name for p in (data/'shards').glob('*.geojson.gz')}
    assert existing==expected,'Output has stale shards: build into a clean directory'
    # The following geometric calculations are audit-only; their results are
    # never used to replace a published face or infer mask coverage.
    geoms=[x['geom'] for x in items];tree=shapely.STRtree(geoms)
    project=Transformer.from_crs(4326,3035,always_xy=True)
    projected=shapely.transform(np.array(geoms,dtype=object),lambda p:np.column_stack(project.transform(p[:,0],p[:,1])))
    area_tree=shapely.STRtree(projected);overlaps=[]
    for i,g in enumerate(projected):
        for j in area_tree.query(g,predicate='intersects'):
            if int(j)<=i:continue
            area=g.intersection(projected[j]).area
            if area>1:overlaps.append({'a':items[i]['feature']['id'],'b':items[j]['feature']['id'],'classA':items[i]['feature']['properties']['LANDSCAPE'],'classB':items[j]['feature']['properties']['LANDSCAPE'],'areaM2':area})
    union=shapely.union_all(geoms);projected_union=shapely.union_all(projected)
    qml=None
    if args.qml:
        raw=args.qml.read_bytes();assert len(raw)==54777 and hashlib.sha1(raw).hexdigest()=='5043d8ccccb71546bc87c63412ab16f271b28d2f'
        style=ET.fromstring(raw);renderer=style.find('renderer-v2');rules=[]
        symbols={s.get('name'):s for s in renderer.findall('./symbols/symbol')}
        for rule in renderer.findall('./rules/rule'):
            opts={o.get('name'):o.get('value') for o in symbols[rule.get('symbol')].findall('.//Option') if o.get('name')}
            rules.append({**rule.attrib,'fill':opts.get('color'),'outline':opts.get('outline_color'),'outlineStyle':opts.get('outline_style')})
        qml={'bytes':len(raw),'sha1':hashlib.sha1(raw).hexdigest(),'renderer':renderer.attrib,'temporal':style.find('temporal').attrib,'rules':rules,'classZeroHasRule':any('= 0' in r.get('filter','') for r in rules)}
    probes=[]
    for name,lon,lat in [('Amsterdam',4.9041,52.3676),('Rotterdam',4.4777,51.9244),('Antwerp',4.4025,51.2194),('Tilburg',5.0919,51.5555),('Groningen',6.5665,53.2194),('Middelburg',3.6136,51.4988),('Cologne',6.96,50.94)]:
        for z,width,height,label in [(8,1200,700,'desktop-z8'),(10,1200,700,'desktop-z10'),(10,390,640,'mobile-z10')]:
            view=viewport(lon,lat,z,width,height)
            candidates=[s for s in index['shards'] if intersects(s['bbox'],view) and any(intersects(f['bbox'],view) for f in s['features'])]
            ids=[f['id'] for s in candidates for f in s['features'] if intersects(f['bbox'],view)]
            real=tree.query(box(*view),predicate='intersects');loaded=sum(s['bytes'] for s in candidates)
            probes.append({'city':name,'center':[lon,lat],'case':label,'viewport':view,'shards':len(candidates),'bytes':loaded,'MiB':round(loaded/1048576,3),'bboxCandidateFeatures':len(ids),'actualIntersectingFeatures':len(real),'files':[s['file'] for s in candidates]})
    sample_points=[]
    for name,point in [('Almere',[5.2236,52.3702]),('Lelystad',[5.4714,52.5185]),('Flevoland centre',[5.5,52.55]),('Amsterdam',[4.9041,52.3676]),('Tilburg',[5.0919,51.5555])]:
        matches=tree.query(Point(point),predicate='intersects')
        sample_points.append({'name':name,'coordinate':point,'records':[{'id':items[int(i)]['feature']['id'],'class':items[int(i)]['feature']['properties']['LANDSCAPE']} for i in matches]})
    holes=[]
    for item in items:
        for ring in item['geom'].interiors:
            hole=shapely.Polygon(ring);point=hole.representative_point();matches=tree.query(point,predicate='intersects')
            if not len(matches):holes.append({'parentId':item['feature']['id'],'point':[point.x,point.y],'holeAreaDegrees2':hole.area})
    gaps=box(*index['bounds']).difference(union);gap=gaps.representative_point()
    covered=union.representative_point()
    fullbytes=args.full_reference.stat().st_size if args.full_reference else len(gzip.compress(encoded({'type':'FeatureCollection','features':list(allfeatures.values())}),mtime=0))
    report={'source':source,'schema':layer,'records':len(items),'vertices':sum(x['vertices'] for x in items),'invalid':[],'empty':[],'geometryTypes':dict(collections.Counter(g.geom_type for g in geoms)),'classCounts':dict(collections.Counter(str(x['feature']['properties']['LANDSCAPE']) for x in items)),'qualityCounts':dict(collections.Counter(str(x['feature']['properties']['QUALITY']) for x in items)),'datePairs':dict(collections.Counter(str((x['feature']['properties']['TIME_START'],x['feature']['properties']['TIME_END'])) for x in items)),'missingDates':[x['feature']['properties'] for x in items if x['feature']['properties']['TIME_START'] is None or x['feature']['properties']['TIME_END'] is None],'overlapsAbove1m2':sorted(overlaps,key=lambda x:-x['areaM2']),'unionAreaKm2':projected_union.area/1e6,'totalFeatureAreaKm2':sum(g.area for g in projected)/1e6,'bounds':index['bounds'],'publish':{'shards':len(index['shards']),'gzipBytes':sum(s['bytes'] for s in index['shards']),'indexBytes':len(rawindex),'indexGzipBytes':(data/'index.json.gz').stat().st_size,'fullGzipBytes':fullbytes,'largestShards':sorted([{k:s[k] for k in ['file','count','vertices','bytes','bbox']} for s in index['shards']],key=lambda s:-s['bytes'])[:12],'noMissingDuplicateOrChangedRecords':True,'exactIndependentFullExportEquality':bool(args.full_reference),'geometryTransformation':'none','retrievalBoundsAreNotCoverage':True},'viewportProbes':probes,'pointProbes':sample_points,'coverageFixtures':{'bboxInsideButSourceEmpty':{'coordinate':[gap.x,gap.y],'noCoveringFeature':len(tree.query(gap,predicate='intersects'))==0},'actualPolygonInside':{'coordinate':[covered.x,covered.y]},'uncoveredPolygonInteriorHoles':sorted(holes,key=lambda h:-h['holeAreaDegrees2'])[:5]},'qml':qml,'areaMethod':'EPSG:3035 audit-only equal-area reprojection; published EPSG:4326 coordinates untouched. Overlaps are preserved, not unioned or subtracted.','dateInterpretation':'Only the named 1500 cross-section is supported. Three null row dates remain null; collection membership is not a fabricated row start/end date. Codebook dates disambiguate polygon instances, not exact historical event dates.'}
    (out/'geometry-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'records':len(items),'shards':len(index['shards']),'fullMiB':fullbytes/1048576,'shardTotalMiB':sum(s['bytes'] for s in index['shards'])/1048576,'cityLoads':[{k:p[k] for k in ['city','case','shards','MiB']} for p in probes],'emptyHoles':len(holes)},indent=2))
if __name__=='__main__':main()
