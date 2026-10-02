"""MLK1: unsigned LEB128 metadata and ZigZag point deltas, in gzip shards.

Coordinate integers remain unchanged from the audited delta-1e6 representation.
Bounding boxes are rounded outwards; the index retains original source bounds.
The exceptional exact floating-point geometries remain JSON inside the stream.
"""
import json, math

def encode(features):
    out = bytearray(b'MLK1')
    def uint(n):
        assert isinstance(n, int) and 0 <= n < 2**53
        while n > 127:
            out.append((n & 127) | 128)
            n >>= 7
        out.append(n)
    def sint(n):
        uint(-2*n-1 if n < 0 else 2*n)
    uint(len(features))
    last_id = 0
    for f in features:
        hid, props, bbox, g = f['id'], f['properties'], f['bbox'], f['geometry']
        sint(hid-last_id)
        last_id = hid
        uint(props['type'])
        area = round(props['area']*100)
        assert abs(area/100-props['area']) < 1e-9
        uint(area)
        # One guard cell avoids floating-point division rounding an outward
        # bound inwards by a few ulps. Geometry coordinates remain unchanged.
        bb = [max(-180000000, math.floor(bbox[0]*1e6)-1), max(-90000000, math.floor(bbox[1]*1e6)-1), min(180000000, math.ceil(bbox[2]*1e6)+1), min(90000000, math.ceil(bbox[3]*1e6)+1)]
        sint(bb[0]); sint(bb[1]); uint(bb[2]-bb[0]); uint(bb[3]-bb[1])
        if 'coordinates' in g:
            uint(0)
            raw = json.dumps(g, separators=(',', ':'), allow_nan=False).encode()
            uint(len(raw)); out.extend(raw)
            continue
        uint(1 if g['type'] == 'Polygon' else 2)
        uint(len(g['deltas']))
        for polygon in g['deltas']:
            uint(len(polygon))
            for ring in polygon:
                uint(len(ring)//2)
                for i, n in enumerate(ring):
                    sint(n-(bb[i] if i < 2 else 0))
    return bytes(out)

def decode(raw):
    assert raw[:4] == b'MLK1'
    cursor = 4
    def uint():
        nonlocal cursor
        n = shift = 0
        while True:
            assert cursor < len(raw) and shift <= 49, 'Invalid varint'
            b = raw[cursor]; cursor += 1
            n |= (b & 127) << shift
            if b < 128: return n
            shift += 7
    def sint():
        n = uint()
        return -(n+1)//2 if n & 1 else n//2
    count = uint(); features = []; last_id = 0
    assert count <= 2000
    for _ in range(count):
        hid = last_id+sint(); last_id = hid
        kind, area = uint(), uint()/100
        x, y = sint(), sint(); w, h = uint(), uint()
        bbox = [x/1e6, y/1e6, (x+w)/1e6, (y+h)/1e6]
        shape_type = uint()
        if shape_type == 0:
            length = uint()
            assert cursor+length <= len(raw)
            geometry = json.loads(raw[cursor:cursor+length]); cursor += length
        else:
            assert shape_type in (1, 2)
            polygons = []
            for _ in range(uint()):
                polygon = []
                for _ in range(uint()):
                    points = uint(); ring = [sint() for _ in range(points*2)]
                    ring[0] += x; ring[1] += y; polygon.append(ring)
                polygons.append(polygon)
            geometry = {'type': 'Polygon' if shape_type == 1 else 'MultiPolygon', 'deltas': polygons}
        features.append({'type': 'Feature', 'id': hid, 'properties': {'id': hid, 'type': kind, 'area': area}, 'bbox': bbox, 'geometry': geometry})
    assert cursor == len(raw), 'Trailing bytes'
    return {'encoding': 'delta-1e6', 'features': features}
