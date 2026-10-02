from physical_paths import workspace
"""Small first-view cartography with explicit display-only generalization."""
from pathlib import Path
import gzip
import hashlib
import json
import random

from shapely.geometry import shape, mapping, box, Point, MultiPolygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
from shapely.prepared import prep
from shapely.validation import explain_validity

HERE = workspace()
LIMIT = 85.0511287798066

def load(path):
    return json.loads(gzip.decompress(path.read_bytes()))

def parts(g):
    if g.is_empty:
        return []
    if g.geom_type == 'Polygon':
        return [g]
    if g.geom_type in ('MultiPolygon', 'GeometryCollection'):
        return [p for sub in g.geoms for p in parts(sub)]
    raise ValueError(g.geom_type)

def orient_geom(g):
    pp = [orient(p, sign=1) for p in parts(g)]
    return pp[0] if len(pp) == 1 else MultiPolygon(pp)

def vertices(g):
    if g.geom_type == 'Polygon':
        return len(g.exterior.coords) + sum(len(r.coords) for r in g.interiors)
    if g.geom_type in ('MultiPolygon','MultiLineString','GeometryCollection'):
        return sum(vertices(s) for s in g.geoms)
    return len(g.coords)

def save(name, features):
    raw = json.dumps({'type':'FeatureCollection','features':features},ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
    packed = gzip.compress(raw,compresslevel=9,mtime=0)
    path = HERE / name
    path.write_bytes(packed)
    gg = [shape(f['geometry']) for f in load(path)['features']]
    assert all(g.is_valid and not g.is_empty for g in gg)
    return {'file':name,'features':len(features),'vertices':sum(vertices(g) for g in gg),'gzip_bytes':len(packed),'json_bytes':len(raw),'sha256':hashlib.sha256(packed).hexdigest(),'all_geometries_valid':True}

# Simplify each retained physical feature with GEOS topology preservation.
# Line endpoints remain intact; no merging of different named rivers/lakes.
physical = []
counts = {}
inputs = {}
for filename, layer in [('rivers-10m-named.json.gz','rivers'),('publish/lakes-10m.json.gz','lakes')]:
    path = HERE / filename
    inputs[layer] = {'file':filename,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    fs = load(path)['features']
    selected = [f for f in fs if not f['properties'].get('artificial') and (f['properties'].get('rank',99)<=3 or f['properties'].get('minzoom',99)<=3)]
    counts[layer] = {'source':len(fs),'retained':len(selected),'before_vertices':0,'after_vertices':0,'kind_counts':{}}
    for f in selected:
        g = shape(f['geometry'])
        simplified = g.simplify(0.02,preserve_topology=True)
        assert simplified.is_valid and not simplified.is_empty, explain_validity(simplified)
        if simplified.geom_type in ('Polygon','MultiPolygon'):
            simplified = orient_geom(simplified)
        counts[layer]['before_vertices'] += vertices(g)
        counts[layer]['after_vertices'] += vertices(simplified)
        kind = f['properties']['kind']
        counts[layer]['kind_counts'][kind] = counts[layer]['kind_counts'].get(kind,0)+1
        physical.append({'type':'Feature','id':f.get('id',f['properties']['id']),'properties':{**f['properties'],'layer':layer},'geometry':mapping(simplified)})
physical_meta = save('physical-overview.json.gz',physical)

# Generalize the complete union BEFORE constructing the mask and strips.
# Thus both sides of every land/ocean boundary use identical coordinates.
land_input = HERE / 'publish/land-10m.json.gz'
world = box(-180,-LIMIT,180,LIMIT)
original_land = unary_union([shape(f['geometry']) for f in load(land_input)['features']]).intersection(world)
generalized = original_land.simplify(0.03,preserve_topology=True)
# GEOS preserves each polygon but a generalized continental coast can engulf
# a tiny separate island. Re-union the components before computing either side
# of the coastline so these nested shells cannot make the output invalid.
generalization_overlap_area = generalized.area - unary_union(parts(generalized)).area
land = unary_union(parts(generalized)).intersection(world)
assert land.is_valid, explain_validity(land)
ocean = world.difference(land)
assert ocean.is_valid, explain_validity(ocean)

land_features = []
mask_features = []
for i, west in enumerate(range(-180,180,60)):
    strip = box(west,-LIMIT,west+60,LIMIT)
    for target,g,kind in [(land_features,land.intersection(strip),'ModernLandOverview'),(mask_features,strip.difference(land),'ModernOceanMaskOverview')]:
        oriented = orient_geom(g)
        assert oriented.is_valid, explain_validity(oriented)
        for p in parts(oriented):
            assert p.exterior.is_ccw
            assert all(not r.is_ccw for r in p.interiors)
            for ring in [p.exterior,*p.interiors]:
                coords = list(ring.coords)
                assert coords[0] == coords[-1]
                assert all(west<=x<=west+60 and -LIMIT<=y<=LIMIT for x,y in coords)
                assert all(abs(b[0]-a[0])<=60 for a,b in zip(coords,coords[1:]))
        target.append({'type':'Feature','id':i,'properties':{'id':i,'kind':kind,'west':west,'east':west+60},'geometry':mapping(oriented)})
mask_meta = save('modern-ocean-mask-overview.json.gz',mask_features)
land_meta = save('land-overview.json.gz',land_features)
coastline = land.boundary.difference(world.boundary)
coastline_meta = save('coastline-overview.json.gz',[{'type':'Feature','id':0,'properties':{'id':0,'kind':'ModernCoastlineOverview'},'geometry':mapping(coastline)}])

saved_land = unary_union([shape(f['geometry']) for f in load(HERE/'land-overview.json.gz')['features']])
saved_mask = unary_union([shape(f['geometry']) for f in load(HERE/'modern-ocean-mask-overview.json.gz')['features']])
assert saved_land.is_valid and saved_mask.is_valid
gap = world.difference(saved_land.union(saved_mask)).area
overlap = saved_land.intersection(saved_mask).area
error = saved_mask.symmetric_difference(ocean).area
area_error = abs(saved_land.area+saved_mask.area-world.area)
assert gap<1e-7 and overlap<1e-7 and error<1e-7 and area_error<1e-7
pl,pm=prep(saved_land),prep(saved_mask)
rng = random.Random(20261002)
sample = [(rng.uniform(-180,180),rng.uniform(-LIMIT,LIMIT)) for _ in range(12000)]
sample += [(x,y) for x in [-179.999999,-120,-60,0,60,120,179.999999] for y in [-85,-75,-55,-25,0,25,55,75,85]]
mismatch=0
for x,y in sample:
    p=Point(x,y)
    mismatch += pm.covers(p) != (not pl.contains(p))
assert mismatch==0

manifest = {
    'outputs':[physical_meta,mask_meta,land_meta,coastline_meta],
    'physical_inputs':inputs,
    'land_input':{'file':'publish/land-10m.json.gz','sha256':hashlib.sha256(land_input.read_bytes()).hexdigest()},
    'physical_selection':'(rank <= 3 OR minzoom <= 3) AND artificial != true, preserving source kind and identifiers',
    'physical_counts':counts,
    'physical_method':'Shapely/GEOS simplify(tolerance=0.02 degrees, preserve_topology=True) independently on each selected feature; polygon exteriors CCW and holes CW. Lake Centerline features remain identifiable by kind and should be excluded from visible river line strokes when lakes are filled.',
    'mask_method':'Union the full modern Natural Earth land geometry, clip to visible Mercator latitude, simplify the full union at 0.03 degrees with preserve_topology=True, re-union generalized components to dissolve nested or overlapping shells, then compute its exact ocean complement. Finally split land and ocean into the same six 60-degree longitude strips. Shared edges are derived once, never simplified independently. Coastline is the shared generalized land boundary minus the world clip rectangle boundary, taken before longitude splitting.',
    'layer_property_values':['rivers','lakes'],
    'coordinate_units':'longitude/latitude degrees; visual cartographic generalization, not metre-level positional accuracy',
    'bounds':[-180,-LIMIT,180,LIMIT],
    'display_only':True,
    'full_10m_geometries_changed':False,
    'historical_geometries_changed':False,
    'integration_zh':'首屏加载 physical-overview、modern-ocean-mask-overview；建议同时使用提供的 land-overview 保持陆地和海罩完全共边。在 zoom >= 2.5 时加载精细 10m 陆地、水系、海罩，再把各 source.setData 一并切到精细资产。若继续用旧 50m 陆地作为首屏底图，不能声称它与此海罩完全共边。海罩 fill-antialias=false；独立海岸线置于海罩上方。概览 land-overview 是分片面，直接对它用 line 图层会画出经度切边；提供的 coastline-overview 已去掉日期线和纬度裁剪边，也不包含经度切片边。',
    'method_zh':'概览图仅为显示提速：主要水系按 0.02°、陆地与海洋共边按 0.03° 做保持拓扑的简化。精细 10m 地理数据与历史疆域来源坐标均未改变。',
    'method_en':'Overview geometry is generalized only for faster display: major waterways at 0.02 degrees, shared land/ocean edges at 0.03 degrees with topology preservation. Detailed 1:10 million geography and historical territory source coordinates remain unchanged.',
    'license':'Public domain (Natural Earth); name-source references retained in properties where supplied',
    'license_url':'https://www.naturalearthdata.com/about/terms-of-use/',
    'attribution':'Natural Earth',
    'validation':{
        'all_feature_geometries_valid':True,
        'generalized_land_component_count_before_union':len(parts(generalized)),
        'generalized_land_component_count_after_union':len(parts(land)),
        'dissolved_nested_shell_overlap_area_square_degrees':generalization_overlap_area,
        'exterior_winding':'counterclockwise','interior_winding':'clockwise',
        'maximum_longitude_segment_degrees':60,
        'mask_and_land_union_valid':True,
        'uncovered_world_area_square_degrees':gap,
        'mask_land_overlap_area_square_degrees':overlap,
        'mask_difference_from_shared_coast_complement_area_square_degrees':error,
        'area_partition_error_square_degrees':area_error,
        'classification_sample_count':len(sample),'classification_mismatches':mismatch,
    },
}
(HERE/'physical-overview.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(manifest,ensure_ascii=False,indent=2))
