import gzip, hashlib, json, math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PTS = json.loads((ROOT / 'docs/verification-3.61/south-asia/graticule-control-points.json').read_text())
RAD = math.pi / 180.0
PHI1, PHI2 = 12.0 * RAD, 26.0 * RAD

def solve_linear(A, b):
    n = len(b)
    M = [list(row) + [b[i]] for i, row in enumerate(A)]
    for col in range(n):
        piv = max(range(col, n), key=lambda r: abs(M[r][col]))
        M[col], M[piv] = M[piv], M[col]
        div = M[col][col]
        for j in range(col, n + 1):
            M[col][j] /= div
        for r in range(n):
            if r != col and M[r][col] != 0.0:
                f = M[r][col]
                for j in range(col, n + 1):
                    M[r][j] -= f * M[col][j]
    return [M[i][n] for i in range(n)]

# Ellipsoid helper (Everest 1830 a=6377276.345, 1/f=300.8017 -> e^2; vs Sphere R=1 unit)
def everest_params():
    f = 1.0 / 300.8017
    e2 = 2 * f - f * f
    return e2

def m_ellip(phi, e2):
    return math.cos(phi) / math.sqrt(1 - e2 * math.sin(phi)**2)

def q_ellip(phi, e2):
    e = math.sqrt(e2)
    s = math.sin(phi)
    return (1 - e2) * (s / (1 - e2 * s * s) - math.log((1 - e * s) / (1 + e * s)) / (2 * e))

def merid_arc(phi, e2):
    # Series expansion for meridional arc / a (accurate < 1 mm)
    e4, e6 = e2 * e2, e2 * e2 * e2
    c0 = 1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256
    c2 = 3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024
    c4 = 15 * e4 / 256 + 45 * e6 / 1024
    c6 = 35 * e6 / 3072
    return c0 * phi - c2 * math.sin(2 * phi) + c4 * math.sin(4 * phi) - c6 * math.sin(6 * phi)

E2_EVEREST = everest_params()

def inverse_conic(model, x, y):
    if model == 'equidistant-conic':
        n = (math.cos(PHI1) - math.cos(PHI2)) / (PHI2 - PHI1)
        g = math.cos(PHI1) / n + PHI1
        r0 = g
        r = math.hypot(x, r0 - y)
        phi = g - r
        lon = 80.0 + math.degrees(math.atan2(x, r0 - y) / n)
        return lon, math.degrees(phi)
    if model == 'equidistant-conic-everest1830':
        m1, m2 = m_ellip(PHI1, E2_EVEREST), m_ellip(PHI2, E2_EVEREST)
        M1, M2 = merid_arc(PHI1, E2_EVEREST), merid_arc(PHI2, E2_EVEREST)
        n = (m1 - m2) / (M2 - M1)
        G = m1 / n + M1
        r0 = G  # centered at phi0 = 0 for affine offset absorption
        r = math.hypot(x, r0 - y)
        M = G - r
        # Newton invert M(phi)
        phi = M
        for _ in range(6):
            err = merid_arc(phi, E2_EVEREST) - M
            dM = (1 - E2_EVEREST * math.sin(phi)**2)**-1.5 * (1 - E2_EVEREST)
            phi -= err / dM
        lon = 80.0 + math.degrees(math.atan2(x, r0 - y) / n)
        return lon, math.degrees(phi)
    if model == 'lambert-conformal-conic':
        n = math.log(math.cos(PHI1) / math.cos(PHI2)) / math.log(math.tan(math.pi / 4 + PHI2 / 2) / math.tan(math.pi / 4 + PHI1 / 2))
        f = math.cos(PHI1) * (math.tan(math.pi / 4 + PHI1 / 2) ** n) / n
        r0 = f
        r = math.hypot(x, r0 - y)
        phi = 2 * math.atan((f / r) ** (1 / n)) - math.pi / 2
        lon = 80.0 + math.degrees(math.atan2(x, r0 - y) / n)
        return lon, math.degrees(phi)
    if model == 'albers-equal-area':
        n = (math.sin(PHI1) + math.sin(PHI2)) / 2.0
        c = math.cos(PHI1)**2 + 2 * n * math.sin(PHI1)
        r0 = math.sqrt(c) / n
        r = math.hypot(x, r0 - y)
        phi = math.asin(max(-1.0, min(1.0, (c - (r * n)**2) / (2 * n))))
        lon = 80.0 + math.degrees(math.atan2(x, r0 - y) / n)
        return lon, math.degrees(phi)
    raise ValueError(model)

def fit_model(model, dof=6):
    fit_pts = [p for p in PTS if p['role'] == 'fit']
    hold_pts = [p for p in PTS if p['role'] == 'holdout']
    if dof == 6:
        p = [0.207, -0.003, -0.333, -0.003, -0.203, 0.782]
        def map_xy(pv, px, py):
            return pv[0]*px + pv[1]*py + pv[2], pv[3]*px + pv[4]*py + pv[5]
    else:
        p = [0.205, -0.015, -0.33, 0.78]
        def map_xy(pv, px, py):
            s, t, tx, ty = pv
            c, sn = s*math.cos(t), s*math.sin(t)
            return c*px - sn*py + tx, -sn*px - c*py + ty

    def res_fn(pv, sub):
        out = []
        for r in sub:
            mx, my = map_xy(pv, r['x']/1000.0, r['y']/1000.0)
            lon, lat = inverse_conic(model, mx, my)
            d = (lon if r['axis']=='lon' else lat) - r['value']
            out.append(d)
        return out

    lam = 1e-5
    for _ in range(180):
        r0 = res_fn(p, fit_pts)
        n0 = sum(v*v for v in r0)
        J = [[0.0]*dof for _ in r0]
        for j in range(dof):
            pj = list(p); pj[j] += 1e-6; rj = res_fn(pj, fit_pts)
            for i in range(len(r0)): J[i][j] = (rj[i] - r0[i]) / 1e-6
        JTJ = [[sum(J[i][a]*J[i][b] for i in range(len(r0))) + (lam if a==b else 0.0) for b in range(dof)] for a in range(dof)]
        JTr = [-sum(J[i][a]*r0[i] for i in range(len(r0))) for a in range(dof)]
        d = solve_linear(JTJ, JTr)
        cand = [p[j]+d[j] for j in range(dof)]
        r1 = res_fn(cand, fit_pts)
        if sum(v*v for v in r1) < n0:
            p = cand; lam = max(1e-10, lam / 3.0)
        else:
            lam = min(1e12, lam * 10.0)
        if math.sqrt(sum(v*v for v in d)) < 1e-10:
            break

    def metrics_for(sub):
        kms = []
        for r in sub:
            mx, my = map_xy(p, r['x']/1000.0, r['y']/1000.0)
            lon, lat = inverse_conic(model, mx, my)
            d = (lon if r['axis']=='lon' else lat) - r['value']
            kms.append(d * 111.195 * (math.cos(lat * RAD) if r['axis']=='lon' else 1.0))
        return {
            'count': len(kms),
            'rmsSingleCoordinateKm': round(math.sqrt(sum(k*k for k in kms)/len(kms)), 3),
            'maxAbsSingleCoordinateKm': round(max(abs(k) for k in kms), 3),
        }

    # Check Pataliputra & Bactria
    landmarks = []
    for pid, lbl, px, py, sfile in [
        ('pleiades:59978', 'Pataliputra', 2068, 1608, 'settlements-012.json.gz'),
        ('pleiades:961886', 'Bactria city symbol', 719, 597, 'settlements-035.json.gz'),
    ]:
        rec = json.loads(gzip.decompress((ROOT/'public/data/places'/sfile).read_bytes()))[pid]
        elon, elat = rec['coordinates']
        mx, my = map_xy(p, px/1000.0, py/1000.0)
        plon, plat = inverse_conic(model, mx, my)
        l1, a1, l2, a2 = map(math.radians, [plon, plat, elon, elat])
        dk = 6371.0088 * 2 * math.asin(min(1.0, math.sqrt(math.sin((a2-a1)/2)**2 + math.cos(a1)*math.cos(a2)*math.sin((l2-l1)/2)**2)))
        landmarks.append({'id': pid, 'label': lbl, 'residualKm': round(dk, 2), 'predicted': [round(plon, 4), round(plat, 4)], 'expected': [round(elon, 4), round(elat, 4)]})

    aniso_ratio = None
    if dof == 6:
        sx = math.hypot(p[0], p[3])
        sy = math.hypot(p[1], p[4])
        aniso_ratio = round(sx / sy, 5)
    return {
        'model': model,
        'dof': dof,
        'anisotropyRatioXOverY': aniso_ratio,
        'fit': metrics_for(fit_pts),
        'holdout': metrics_for(hold_pts),
        'landmarks': landmarks,
    }

sensitivity = [
    fit_model('equidistant-conic', 6),
    fit_model('equidistant-conic', 4),
    fit_model('equidistant-conic-everest1830', 6),
    fit_model('equidistant-conic-everest1830', 4),
    fit_model('lambert-conformal-conic', 6),
    fit_model('lambert-conformal-conic', 4),
    fit_model('albers-equal-area', 6),
    fit_model('albers-equal-area', 4),
]

# Part 2: Audit Cliopatria South Asian Polygons against bundled Pleiades archaeological settlements!
def point_in_ring(lon, lat, ring):
    inside = False
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]
        x2, y2 = ring[i+1]
        if ((y1 > lat) != (y2 > lat)) and (lon < (x2 - x1) * (lat - y1) / ((y2 - y1) or 1e-18) + x1):
            inside = not inside
    return inside

def point_in_geom(lon, lat, geom):
    if geom['type'] == 'Polygon':
        if not point_in_ring(lon, lat, geom['coordinates'][0]): return False
        return not any(point_in_ring(lon, lat, h) for h in geom['coordinates'][1:])
    if geom['type'] == 'MultiPolygon':
        for poly in geom['coordinates']:
            if point_in_ring(lon, lat, poly[0]) and not any(point_in_ring(lon, lat, h) for h in poly[1:]):
                return True
    return False

def min_vertex_distance_km(lon, lat, geom):
    best = 1e9
    rings = geom['coordinates'] if geom['type'] == 'Polygon' else [r for p in geom['coordinates'] for r in p]
    for r in rings:
        for px, py in r:
            l1, a1, l2, a2 = map(math.radians, [lon, lat, px, py])
            d = 6371.0088 * 2 * math.asin(min(1.0, math.sqrt(math.sin((a2-a1)/2)**2 + math.cos(a1)*math.cos(a2)*math.sin((l2-l1)/2)**2)))
            if d < best: best = d
    return round(best, 2)

cat = json.loads(gzip.decompress((ROOT / 'public/data/catalog.json.gz').read_bytes()))
geom_cache = {}
def load_geom(gid):
    # Find geometry across geometries-*.json.gz
    if not geom_cache:
        for f in sorted((ROOT / 'public/data').glob('geometries-*.json.gz')):
            d = json.loads(gzip.decompress(f.read_bytes()))
            # d could be dict of features or FeatureCollection
            if isinstance(d, dict) and d.get('type') == 'FeatureCollection':
                for ft in d['features']:
                    geom_cache[ft.get('id') or ft['properties'].get('geometryId')] = ft['geometry']
            elif isinstance(d, dict):
                geom_cache.update(d)
    return geom_cache.get(gid)

places_lookup = {}
for pid, sfile in [
    ('pleiades:59978', 'settlements-012.json.gz'),  # Pataliputra
    ('pleiades:60083', 'settlements-022.json.gz'),  # Taxila
    ('pleiades:59972', 'settlements-012.json.gz'),  # Ozene / Ujjain
    ('pleiades:59737', 'settlements-012.json.gz'),  # Barygaza
    ('pleiades:961886', 'settlements-035.json.gz'), # Bactra / Zariaspa
    ('pleiades:59668', 'settlements-012.json.gz'),  # Alexandria/Kapisa
    ('pleiades:50294', 'settlements-031.json.gz'),  # Tagara
    ('pleiades:839190400', 'settlements-031.json.gz'), # Kanchipuram
    ('pleiades:50221', 'settlements-031.json.gz'),  # Podouke/Arikamedu
]:
    raw = (ROOT / 'public/data/places' / sfile).read_bytes()
    rec = json.loads(gzip.decompress(raw))[pid]
    places_lookup[pid] = {
        'id': pid,
        'name': rec.get('name') or rec.get('title'),
        'coordinates': rec['coordinates'],
        'sourceUrl': rec.get('sourceUrl'),
        'sha256': hashlib.sha256(raw).hexdigest(),
    }

POLITY_SITE_CHECKS = [
    ('Maurya Empire', -250, ['pleiades:59978', 'pleiades:60083', 'pleiades:59972', 'pleiades:59737', 'pleiades:59668', 'pleiades:50294', 'pleiades:839190400']),
    ('Shunga Empire', -100, ['pleiades:59978', 'pleiades:59972']),
    ('Kushan Empire', 150, ['pleiades:60083', 'pleiades:59668', 'pleiades:961886']),
    ('Satavahana Dynasty', 100, ['pleiades:59737', 'pleiades:50294']),
    ('Gupta Empire', 450, ['pleiades:59978', 'pleiades:59972', 'pleiades:59737']),
    ('Vakataka Kingdom', 450, ['pleiades:50294']),
    ('Chola Empire', 1025, ['pleiades:839190400', 'pleiades:50221']),
]

polygon_checks = []
for pname, year, site_ids in POLITY_SITE_CHECKS:
    recs = [r for r in cat['records'] if r['name'] == pname and r['start'] <= year <= r['end']]
    for r in recs:
        g = load_geom(r['geometryId'])
        site_results = []
        for sid in site_ids:
            pl = places_lookup[sid]
            lon, lat = pl['coordinates']
            inside = point_in_geom(lon, lat, g)
            dist = 0.0 if inside else min_vertex_distance_km(lon, lat, g)
            site_results.append({
                'placeId': sid,
                'placeName': pl['name'],
                'coordinates': pl['coordinates'],
                'insideCliopatriaPolygon': inside,
                'nearestVertexDistanceKmIfOutside': dist,
            })
        polygon_checks.append({
            'recordId': r['id'],
            'polityName': pname,
            'yearChecked': year,
            'frameSpan': [r['start'], r['end']],
            'areaKm2': r.get('area'),
            'evidenceWarnings': r.get('evidenceWarnings'),
            'sites': site_results,
        })

out = {
    'schemaVersion': 1,
    'milestone': '3.62-m4',
    'policy': 'Residuals and independent archaeological site congruence are documented verbatim without warping Schwartzberg scans or modifying Cliopatria geometries.',
    'conicSensitivity': sensitivity,
    'cliopatriaSouthAsiaCongruence': polygon_checks,
    'independentPlaceSources': list(places_lookup.values()),
}
(ROOT / 'docs/verification-3.62/south-asia/model-sensitivity-and-congruence.json').write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n')
print('=== CONIC SENSITIVITY ===')
for s in sensitivity:
    print(f"  {s['model']:31s} dof={s['dof']} aniso={str(s['anisotropyRatioXOverY']):7s} fit={s['fit']['rmsSingleCoordinateKm']:5.2f}km hold={s['holdout']['rmsSingleCoordinateKm']:5.2f}km landmarks={[(l['label'], l['residualKm']) for l in s['landmarks']]}")
print('\n=== CLIOPATRIA SOUTH ASIA vs PLEIADES SITES ===')
for pc in polygon_checks:
    print(f"  {pc['polityName']:20s} ({pc['yearChecked']:4d}, span {pc['frameSpan']}): " + ', '.join(f"{s['placeName']}={'IN' if s['insideCliopatriaPolygon'] else 'OUT('+str(s['nearestVertexDistanceKmIfOutside'])+'km)'}" for s in pc['sites']))
