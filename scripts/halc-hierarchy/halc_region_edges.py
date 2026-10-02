"""Unique display-boundary linework on the same integer grid as region MVTs."""
import shapely
from shapely import union_all

def lines(geometry):
    if geometry.geom_type=='LineString':return [geometry]
    if geometry.geom_type in ('MultiLineString','GeometryCollection'):
        return [line for child in geometry.geoms for line in lines(child)]
    return []

def build_edge_network(regions):
    # Global boundaries precede clipping: no buffered tile-frame edges enter
    # this layer. Noding and line-grid quantization do not alter memberships.
    unique=union_all([region.boundary for region in regions],grid_size=1.)
    return shapely.line_merge(unique)

def clip_edge_network(network,clip):
    clipped=shapely.intersection(network,clip,grid_size=1.)
    parts=lines(clipped)
    if not parts:return shapely.MultiLineString([])
    # Clipping can make sub-grid near-coincidences identical. Normalize again
    # on the explicit tile grid; line_merge only concatenates adjacent arcs.
    return shapely.line_merge(union_all(parts,grid_size=1.))

def duplicate_segment_count(geometry):
    seen=set();duplicates=0
    for line in lines(geometry):
        pts=list(line.coords)
        for start,end in zip(pts,pts[1:]):
            if start==end:continue
            key=tuple(sorted((start,end)))
            if key in seen:duplicates+=1
            seen.add(key)
    return duplicates
