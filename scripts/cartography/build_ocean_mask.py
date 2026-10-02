from physical_paths import workspace
"""Derive a visual modern ocean mask; historical geometry is never an input."""
from pathlib import Path
import gzip
import hashlib
import json
import math
import random
import time

from shapely.geometry import shape, mapping, box, Point, Polygon, MultiPolygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
from shapely.prepared import prep
from shapely.validation import explain_validity

HERE = workspace()
SOURCE = HERE / 'publish/land-10m.json.gz'
LIMIT = 85.0511287798066
OUT = HERE / 'modern-ocean-mask.json.gz'
start = time.time()
source_bytes = SOURCE.read_bytes()
source = json.loads(gzip.decompress(source_bytes))
land = unary_union([shape(f['geometry']) for f in source['features']])
assert land.is_valid, explain_validity(land)
world = box(-180, -LIMIT, 180, LIMIT)
land = land.intersection(world)
ocean = world.difference(land)
assert ocean.is_valid, explain_validity(ocean)

def polygons(geom):
    if geom.is_empty:
        return []
    if geom.geom_type == 'Polygon':
        return [geom]
    if geom.geom_type in ('MultiPolygon', 'GeometryCollection'):
        return [p for sub in geom.geoms for p in polygons(sub)]
    raise ValueError(geom.geom_type)

features = []
parts = []
ring_count = 0
vertex_count = 0
max_lon_step = 0
max_ring_span = 0
for index, west in enumerate(range(-180, 180, 60)):
    east = west + 60
    strip_ocean = box(west, -LIMIT, east, LIMIT).difference(land)
    polys = [orient(p, sign=1.0) for p in polygons(strip_ocean)]
    geom = polys[0] if len(polys) == 1 else MultiPolygon(polys)
    assert geom.is_valid, explain_validity(geom)
    for p in polys:
        assert p.exterior.is_ccw
        assert all(not hole.is_ccw for hole in p.interiors)
        for ring in [p.exterior, *p.interiors]:
            coords = list(ring.coords)
            assert coords[0] == coords[-1]
            ring_count += 1
            vertex_count += len(coords)
            assert all(west <= x <= east and -LIMIT <= y <= LIMIT for x,y in coords)
            max_lon_step = max(max_lon_step, *(abs(b[0]-a[0]) for a,b in zip(coords, coords[1:])))
            max_ring_span = max(max_ring_span, max(x for x,y in coords)-min(x for x,y in coords))
    parts.append(geom)
    features.append({
        'type':'Feature', 'id':index,
        'properties': {'id':index, 'kind':'ModernOceanMask', 'west':west, 'east':east},
        'geometry':mapping(geom),
    })
collection = {'type':'FeatureCollection', 'features':features}
raw = json.dumps(collection, separators=(',',':'), ensure_ascii=False, allow_nan=False).encode()
packed = gzip.compress(raw, compresslevel=9, mtime=0)
OUT.write_bytes(packed)

# Test the serialized asset, not only the in-memory intermediates.
round_trip = json.loads(gzip.decompress(OUT.read_bytes()))
round_geoms = [shape(f['geometry']) for f in round_trip['features']]
assert all(g.is_valid for g in round_geoms)
mask = unary_union(round_geoms)
assert mask.is_valid, explain_validity(mask)
difference_area = mask.symmetric_difference(ocean).area
overlap_area = mask.intersection(land).area
uncovered_area = world.difference(mask.union(land)).area
partition_area_error = abs(sum(g.area for g in round_geoms) + land.area - world.area)
assert difference_area < 1e-7
assert overlap_area < 1e-7
assert uncovered_area < 1e-7
assert partition_area_error < 1e-7

prepared_land = prep(land)
prepared_mask = prep(mask)
known = [
    ('North Atlantic', -35, 30, True), ('South Atlantic', -20, -30, True),
    ('North Pacific west', 179.99, 10, True), ('North Pacific east', -179.99, 10, True),
    ('Indian Ocean', 80, -25, True), ('Southern Ocean', 0, -60, True),
    ('Arctic Ocean near limit', 0, 85, True), ('Antarctic interior near limit', 0, -85, False),
    ('Beijing', 116.4074, 39.9042, False), ('Paris', 2.3522, 48.8566, False),
    ('Nairobi', 36.8219, -1.2921, False), ('New York', -74.006, 40.7128, False),
    ('Sao Paulo', -46.6333, -23.5505, False), ('Sydney', 151.2093, -33.8688, False),
    ('Greenland', -40, 72, False), ('Madagascar', 46.5, -19, False),
    ('Taiwan', 121, 23.5, False), ('Sri Lanka', 80.7, 7.8, False),
    ('Viti Levu, Fiji', 178, -18, False),
]
known_results = []
for name,x,y,expect_ocean in known:
    actual = prepared_mask.contains(Point(x,y))
    assert actual == expect_ocean, (name, actual, expect_ocean)
    known_results.append({'place':name,'lon':x,'lat':y,'ocean':actual})

# A deterministic global test, including samples on both sides of the date line.
rng = random.Random(20261002)
sample_points = [(rng.uniform(-180,180), rng.uniform(-LIMIT,LIMIT)) for _ in range(12000)]
sample_points += [(x,y) for x in [-179.999999,-120,-60,0,60,120,179.999999] for y in [-85,-75,-55,-25,0,25,55,75,85]]
mismatch = []
for x,y in sample_points:
    p = Point(x,y)
    # Use covers on cut meridians so an edge is not misreported as a gap.
    actual = prepared_mask.covers(p)
    expected = not prepared_land.contains(p)
    if actual != expected:
        mismatch.append([x,y,actual,expected])
assert not mismatch, mismatch[:10]

validation = {
    'feature_count':len(features),
    'polygon_count':sum(len(polygons(g)) for g in round_geoms),
    'ring_count':ring_count,
    'vertex_count':vertex_count,
    'all_feature_geometries_valid':True,
    'union_valid':True,
    'exterior_winding':'counterclockwise',
    'interior_winding':'clockwise',
    'all_rings_closed':True,
    'bounds':[-180,-LIMIT,180,LIMIT],
    'maximum_longitude_segment_degrees':max_lon_step,
    'maximum_ring_longitude_span_degrees':max_ring_span,
    'area_units':'square degrees in the construction plane; topology check, not physical area',
    'symmetric_difference_vs_ocean_area':difference_area,
    'overlap_with_land_area':overlap_area,
    'uncovered_world_area':uncovered_area,
    'partition_area_error':partition_area_error,
    'deterministic_classification_sample_count':len(sample_points),
    'classification_mismatches':len(mismatch),
    'known_point_checks':known_results,
    'build_seconds':round(time.time()-start,3),
}
manifest = {
    'file':OUT.name,
    'gzip_bytes':len(packed),
    'json_bytes':len(raw),
    'sha256':hashlib.sha256(packed).hexdigest(),
    'crs':'GeoJSON WGS84 longitude/latitude; rendered in Web Mercator',
    'source':'Natural Earth 1:10 million modern land polygons (10m denotes map scale, not metres)',
    'source_url':'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson',
    'original_source_sha256':'1ac90796408bc6ad6911d69448485d3c4dbf2190370080368a09976e1c9f7416',
    'input_file':'publish/land-10m.json.gz',
    'input_sha256':hashlib.sha256(source_bytes).hexdigest(),
    'license':'Public domain',
    'license_url':'https://www.naturalearthdata.com/about/terms-of-use/',
    'attribution':'Natural Earth',
    'method':'Union source land polygons (synthetic Null island already excluded), clip to lon [-180,180] and lat [-85.0511287798066,85.0511287798066], subtract from six 60-degree longitude strips, and orient polygon exterior rings counterclockwise / holes clockwise. No simplification, buffering, or coordinate rounding is applied. Only clip intersections add vertices.',
    'historical_geometry_modified':False,
    'purpose_zh':'自然海岸对齐：用现今陆地以外的海洋遮罩历史疆域向海延伸的图形，保留来源疆域坐标供查阅与切换。海岸取自 Natural Earth 1:1000万现代陆地；这一视觉对齐不重建古代海岸、围垦、海侵或历史河道。',
    'purpose_en':'Natural coastline alignment uses a modern ocean mask to hide historical territory geometry extending beyond present-day land. Original territory coordinates remain unchanged and can be inspected or shown by switching this alignment off. Coastlines come from Natural Earth at 1:10 million scale; this visual alignment does not reconstruct ancient shorelines, reclamation, sea-level changes or historical river courses.',
    'rendering':{
        'source_type':'geojson',
        'source_tolerance':0,
        'fill_opacity':1,
        'fill_antialias':False,
        'fill_color':'must match the base ocean color exactly',
        'layer_order':'Above historical territory fills, outlines and selection borders; below coastline, waterways, place labels and event markers. Re-add/move coastline above the mask so the fine shore remains visible.',
        'seams':'Six features are an exact partition. Disable fill antialias on the mask to avoid translucent seams on the cut meridians; draw a separate antialiased coastline above the mask.',
    },
    'validation':validation,
}
(HERE / 'modern-ocean-mask.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:manifest[k] for k in ['file','gzip_bytes','json_bytes','sha256']},indent=2))
print(json.dumps(validation,ensure_ascii=False,indent=2))
