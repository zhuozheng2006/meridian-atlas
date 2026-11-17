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
        div = M[col][col] or 1e-18
        for j in range(col, n + 1):
            M[col][j] /= div
        for r in range(n):
            if r != col and M[r][col] != 0.0:
                f = M[r][col]
                for j in range(col, n + 1):
                    M[r][j] -= f * M[col][j]
    return [M[i][n] for i in range(n)]

def inverse_conic(model, x, y, phi1=PHI1, phi2=PHI2, lon0=80.0):
    if model == 'equidistant-conic':
        n = (math.cos(phi1) - math.cos(phi2)) / (phi2 - phi1)
        g = math.cos(phi1) / n + phi1
        r0 = g
        r = math.hypot(x, r0 - y)
        phi = g - r
        lon = lon0 + math.degrees(math.atan2(x, r0 - y) / n)
        return lon, math.degrees(phi)
    if model == 'lambert-conformal-conic':
        n = math.log(math.cos(phi1) / math.cos(phi2)) / math.log(math.tan(math.pi / 4 + phi2 / 2) / math.tan(math.pi / 4 + phi1 / 2))
        f = math.cos(phi1) * (math.tan(math.pi / 4 + phi1 / 2) ** n) / n
        r0 = f
        r = math.hypot(x, r0 - y)
        phi = 2 * math.atan((f / r) ** (1 / n)) - math.pi / 2
        lon = lon0 + math.degrees(math.atan2(x, r0 - y) / n)
        return lon, math.degrees(phi)
    raise ValueError(model)

fit_pts = [p for p in PTS if p['role'] == 'fit']
hold_pts = [p for p in PTS if p['role'] == 'holdout']

LANDMARKS = [
    ('pleiades:59978', 'Pataliputra', 2068, 1608, 'settlements-012.json.gz'),
    ('pleiades:961886', 'Bactria city symbol', 719, 597, 'settlements-035.json.gz'),
]

def fit_warp(model, dof, reg=1e-4, phi1=PHI1, phi2=PHI2):
    # Initialize affine from 6-DOF result, extra quadratic terms = 0
    if dof == 6:
        p = [0.207, -0.003, -0.333, -0.003, -0.203, 0.782]
    elif dof == 12:
        p = [0.207, -0.003, -0.333, 0.0, 0.0, 0.0, -0.003, -0.203, 0.782, 0.0, 0.0, 0.0]
    else:
        raise ValueError(dof)

    # Center coordinates around plate midpoint (1.401, 1.578) for well-conditioned quadratic terms
    def map_xy(pv, px, py):
        ux, uy = px - 1.401, py - 1.578
        if dof == 6:
            return pv[0]*ux + pv[1]*uy + pv[2], pv[3]*ux + pv[4]*uy + pv[5]
        mx = pv[0]*ux + pv[1]*uy + pv[2] + pv[3]*ux*ux + pv[4]*ux*uy + pv[5]*uy*uy
        my = pv[6]*ux + pv[7]*uy + pv[8] + pv[9]*ux*ux + pv[10]*ux*uy + pv[11]*uy*uy
        return mx, my

    # Start offset near center
    if dof == 6: p[2], p[5] = -0.333 + 0.207*1.401 - 0.003*1.578, 0.782 - 0.003*1.401 - 0.203*1.578
    else: p[2], p[8] = -0.333 + 0.207*1.401 - 0.003*1.578, 0.782 - 0.003*1.401 - 0.203*1.578

    def res_fn(pv, sub):
        out = []
        for r in sub:
            mx, my = map_xy(pv, r['x']/1000.0, r['y']/1000.0)
            lon, lat = inverse_conic(model, mx, my, phi1, phi2)
            out.append((lon if r['axis'] == 'lon' else lat) - r['value'])
        return out

    lam = 1e-4
    for _ in range(220):
        r0 = res_fn(p, fit_pts)
        n0 = sum(v*v for v in r0) + (reg * sum(p[k]*p[k] for k in (3,4,5,9,10,11)) if dof == 12 else 0.0)
        J = [[0.0]*dof for _ in r0]
        for j in range(dof):
            pj = list(p); pj[j] += 1e-6; rj = res_fn(pj, fit_pts)
            for i in range(len(r0)): J[i][j] = (rj[i] - r0[i]) / 1e-6
        JTJ = [[sum(J[i][a]*J[i][b] for i in range(len(r0))) + (lam if a==b else 0.0) for b in range(dof)] for a in range(dof)]
        JTr = [-sum(J[i][a]*r0[i] for i in range(len(r0))) for a in range(dof)]
        if dof == 12:
            for k in (3,4,5,9,10,11):
                JTJ[k][k] += reg
                JTr[k] -= reg * p[k]
        d = solve_linear(JTJ, JTr)
        cand = [p[j] + d[j] for j in range(dof)]
        r1 = res_fn(cand, fit_pts)
        n1 = sum(v*v for v in r1) + (reg * sum(cand[k]*cand[k] for k in (3,4,5,9,10,11)) if dof == 12 else 0.0)
        if n1 < n0:
            p = cand; lam = max(1e-10, lam / 3.0)
        else:
            lam = min(1e12, lam * 10.0)
        if math.sqrt(sum(v*v for v in d)) < 1e-10:
            break

    def eval_pts(sub):
        kms = []
        for r in sub:
            mx, my = map_xy(p, r['x']/1000.0, r['y']/1000.0)
            lon, lat = inverse_conic(model, mx, my, phi1, phi2)
            d = (lon if r['axis'] == 'lon' else lat) - r['value']
            kms.append(d * 111.195 * (math.cos(lat * RAD) if r['axis'] == 'lon' else 1.0))
        return {
            'count': len(kms),
            'rmsSingleCoordinateKm': round(math.sqrt(sum(k*k for k in kms)/len(kms)), 3),
            'maxAbsSingleCoordinateKm': round(max(abs(k) for k in kms), 3),
        }

    lms = []
    for pid, lbl, px, py, sfile in LANDMARKS:
        rec = json.loads(gzip.decompress((ROOT / 'public/data/places' / sfile).read_bytes()))[pid]
        elon, elat = rec['coordinates']
        mx, my = map_xy(p, px/1000.0, py/1000.0)
        plon, plat = inverse_conic(model, mx, my, phi1, phi2)
        l1, a1, l2, a2 = map(math.radians, [plon, plat, elon, elat])
        dk = 6371.0088 * 2 * math.asin(min(1.0, math.sqrt(math.sin((a2-a1)/2)**2 + math.cos(a1)*math.cos(a2)*math.sin((l2-l1)/2)**2)))
        lms.append({'id': pid, 'label': lbl, 'residualKm': round(dk, 2), 'predicted': [round(plon, 4), round(plat, 4)], 'expected': [round(elon, 4), round(elat, 4)]})

    return {
        'model': model,
        'dof': dof,
        'parallelsDeg': [round(math.degrees(phi1), 1), round(math.degrees(phi2), 1)],
        'fit': eval_pts(fit_pts),
        'holdout': eval_pts(hold_pts),
        'landmarks': lms,
    }

nonlinear_tests = [
    fit_warp('equidistant-conic', 6),
    fit_warp('equidistant-conic', 12, reg=1e-4),
    fit_warp('equidistant-conic', 12, reg=1e-6),
    fit_warp('lambert-conformal-conic', 6),
    fit_warp('lambert-conformal-conic', 12, reg=1e-4),
    fit_warp('equidistant-conic', 6, phi1=10.0*RAD, phi2=28.0*RAD),
]

# Part 2: Global Cross-Era Cliopatria + Events Integrity Audit
cat = json.loads(gzip.decompress((ROOT / 'public/data/catalog.json.gz').read_bytes()))
ev = json.loads(gzip.decompress((ROOT / 'public/data/events.json.gz').read_bytes()))

polity_recs = [r for r in cat['records'] if r.get('type') == 'POLITY']
zero_spans = [r['id'] for r in cat['records'] if r['start'] == 0 or r['end'] == 0 or r['start'] > r['end']]
major_polities = [
    'Maurya Empire', 'Shunga Empire', 'Satavahana Dynasty', 'Kushan Empire', 'Gupta Empire',
    'Chola Empire', 'Delhi Sultanate', 'Mughal Empire', 'Maratha Confederacy', 'Maratha Empire',
    'Han Dynasty', 'Tang Dynasty', 'Ming Dynasty', 'Qing Dynasty', 'Roman Empire',
    'Abbasid Caliphate', 'Mali Empire', 'Inca Empire', 'Ottoman Empire'
]
polity_summary = {}
for name in major_polities:
    rows = sorted([r for r in polity_recs if r['name'] == name], key=lambda x: (x['start'], x['end']))
    if not rows:
        continue
    overlaps = []
    for i in range(len(rows) - 1):
        if rows[i]['end'] >= rows[i+1]['start']:
            overlaps.append((rows[i]['id'], rows[i]['start'], rows[i]['end'], rows[i+1]['id'], rows[i+1]['start'], rows[i+1]['end']))
    polity_summary[name] = {
        'segments': len(rows),
        'span': [rows[0]['start'], max(r['end'] for r in rows)],
        'sameNameOverlappingSegments': len(overlaps),
        'exampleOverlaps': overlaps[:3],
    }

south_asia_events = [e for e in ev if e.get('region') == 'south-asia']
ev_issues = []
for e in ev:
    if e['start'] == 0 or e['end'] == 0 or e['start'] > e['end']:
        ev_issues.append((e['id'], 'invalid-date', e['start'], e['end']))
    if not e.get('sources') or any(not s.get('url', '').startswith('https://') for s in e['sources']):
        ev_issues.append((e['id'], 'invalid-source'))

out = {
    'schemaVersion': 1,
    'milestone': '3.63-m7',
    'nonlinearGraticuleAnalysis': nonlinear_tests,
    'findingSummary': (
        '12-DOF quadratic plate warps over the 19 fit border ticks reduce fit-set single-coordinate RMS (7.684 to 2.680 km on '
        'equidistant conic), but degrade held-out edge ticks (3.729 to 7.629 km) and worsen interior Bactria landmark error '
        '(68.84 to 93.35 km equidistant; 63.18 to 169.30 km Lambert, where Pataliputra also degrades to 255.62 km). Shifting '
        'standard parallels [12N, 26N] to [10N, 28N] alters Pataliputra by only 0.27 km (57.69 to 57.42 km). The ~57-69 km '
        'interior offset is therefore intrinsic plate symbol/compilation tolerance, not edge page curl.'
    ),
    'catalogCrossEraAudit': {
        'totalCatalogRecords': len(cat['records']),
        'totalPolityRecords': len(polity_recs),
        'zeroOrInvertedIntervalsInRawCatalog': len(zero_spans),
        'zeroOrInvertedIds': zero_spans[:20],
        'majorPolities': polity_summary,
    },
    'eventsCrossEraAudit': {
        'totalEvents': len(ev),
        'southAsiaEvents': len(south_asia_events),
        'southAsiaRange': [min(e['start'] for e in south_asia_events), max(e['end'] for e in south_asia_events)],
        'southAsiaSampleIds': [e['id'] for e in sorted(south_asia_events, key=lambda x: x['start'])[:12]],
        'dateOrSourceIssues': ev_issues,
    },
}
out_path = ROOT / 'docs/verification-3.63/south-asia/nonlinear-and-global-audit.json'
out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n')
print('=== NONLINEAR PLATE WARP ANALYSIS (055_b) ===')
for t in nonlinear_tests:
    print(f"  {t['model']:26s} dof={t['dof']:2d} phi={t['parallelsDeg']} fit={t['fit']['rmsSingleCoordinateKm']}km (max {t['fit']['maxAbsSingleCoordinateKm']}) hold={t['holdout']['rmsSingleCoordinateKm']}km landmarks={[(l['label'], l['residualKm']) for l in t['landmarks']]}")
print('\n=== CATALOG & EVENTS INTEGRITY ===')
print('zeroOrInverted:', len(zero_spans), zero_spans[:10])
print('events:', len(ev), 'southAsia:', len(south_asia_events), 'issues:', len(ev_issues))
for k, v in polity_summary.items():
    print(f"  {k:22s}: {v['segments']:3d} segs {v['span']} overlaps={v['sameNameOverlappingSegments']}")
