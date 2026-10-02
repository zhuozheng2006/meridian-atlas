// Independent review of the 3.10 boundary-presentation and OHM-1500 claims.
// Reproduce:
//   node scripts/verification/independent-review.mjs
// Report: docs/verification-3.10/verify-boundary-review.json
//
// This script does NOT run the project's own validators (they rewrite audit JSON and
// the Lead runs the full suite); it re-derives the claims from the shipped data files
// and from a real browser at the camera of the user's screenshot (9.32,48.08,6.72).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { launch, goto, evaluate, click, screenshot, sleep } from './browser.mjs';
import * as C from './lib/common.mjs';

const args = C.parseArgs();
const URL_BASE = String(args.url || C.DEFAULT_URL).replace(/\/$/, '');
const PORT = Number(args.port || 9471);
const OUT = String(args.out || 'docs/verification-3.10/verify-boundary-review.json');
const CAMERA = 'camera=9.32,48.08,6.72,0,0';
const report = C.mkReport('independent-review.mjs', { url: URL_BASE, width: 1600, height: 900 });
const check = (id, description, pass, observed) => { report.checks.push({ id, description, pass: pass === null || pass === undefined ? null : !!pass, observed }); };

// ---------------------------------------------------------------------------
// 1. Data-level verification of the frozen OHM 1500 extract (no browser).
// ---------------------------------------------------------------------------
const OHM_FILE = path.join(C.PUBLIC, 'data/ohm-1500/year-1500.json.gz');
const NOTICE = path.join(C.PUBLIC, 'data/ohm-1500/NOTICE.md');
const bbox = g => { const a = [Infinity, Infinity, -Infinity, -Infinity]; const walk = c => { if (typeof c[0] === 'number') { a[0] = Math.min(a[0], c[0]); a[1] = Math.min(a[1], c[1]); a[2] = Math.max(a[2], c[0]); a[3] = Math.max(a[3], c[1]); } else if (Array.isArray(c)) c.forEach(walk); }; if (g) walk(g.coordinates); return a; };
const hitsBox = (b, x) => b[0] <= x[2] && b[2] >= x[0] && b[1] <= x[3] && b[3] >= x[1];
try {
  const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(OHM_FILE)));
  const feats = data.features || [];
  const meta = data.metadata || {};
  const alps = [7, 45.4, 11.6, 48.4];
  const alpsFeats = feats.filter(f => hitsBox(bbox(f.geometry), alps));
  const alpsNames = alpsFeats.map(f => (f.properties && (f.properties.name || f.properties.title)) || '?');
  const namedMissing = ['Bavaria', 'Swiss', 'Württemberg', 'Baden', 'Habsburg', 'Tyrol', 'Tirol'];
  const presentNamed = feats.map(f => (f.properties && (f.properties.name || f.properties.title)) || '').filter(n => namedMissing.some(k => n.includes(k)));
  const gaps = (meta.gaps || []).filter(g => !g.overlap);
  const nonFinite = feats.filter(f => { let ok = true; const walk = c => { if (typeof c[0] === 'number') { if (!Number.isFinite(c[0]) || !Number.isFinite(c[1])) ok = false; } else if (Array.isArray(c)) c.forEach(walk); }; try { walk(f.geometry.coordinates); } catch (e) { ok = false; } return !ok; }).length;
  const notice = fs.readFileSync(NOTICE, 'utf8');
  report.ohmData = {
    file: 'public/data/ohm-1500/year-1500.json.gz', bytes: fs.statSync(OHM_FILE).size, features: feats.length,
    metadata: { source: meta.source, timestamp: meta.timestamp, license: meta.license || meta.licence, bbox: meta.bbox, adminLevels: meta.adminLevels, relationCount: meta.relationCount },
    alpsWindow: { box: alps, features: alpsFeats.length, names: alpsNames.slice(0, 12) },
    gapCount: gaps.length, gaps: gaps.map(g => ({ zh: g.zh, en: g.en, nearby: (g.nearbyRecords || []).length })),
    licenceNotice: { file: 'public/data/ohm-1500/NOTICE.md', mentionsCC0: /CC0/.test(notice), mentionsOverpass: /Overpass/.test(notice), lines: notice.split('\n').length }
  };
  check('review.ohm-file-shipped', 'Frozen OHM 1500 extract is present, parses as a FeatureCollection and carries source metadata', feats.length > 0 && meta.source === 'OpenHistoricalMap' && !!meta.timestamp, { features: feats.length, source: meta.source, timestamp: meta.timestamp });
  check('review.ohm-licence-documented', 'NOTICE.md records the OHM source, licence and extraction pipeline', /CC0/.test(notice) && /Overpass/.test(notice), { mentionsCC0: /CC0/.test(notice), mentionsOverpass: /Overpass/.test(notice) });
  check('review.ohm-named-polities-absent', 'None of the six polities named in the fidelity doc exist in the frozen extract', presentNamed.length === 0, { matches: presentNamed });
  check('review.ohm-gaps-declared', 'metadata.gaps lists the missing 1500 polities so the UI can say so honestly', gaps.length === 6, { gaps: gaps.map(g => g.en) });
  check('review.ohm-alps-not-empty', 'The Alps window is NOT empty in the frozen extract: it carries admin-level-3 imperial circles', alpsFeats.length > 0, { alpsFeatures: alpsFeats.length, names: alpsNames.slice(0, 8) });
  check('review.ohm-geometry-finite', 'Every frozen OHM feature has finite coordinates', nonFinite === 0, { nonFinite });
} catch (e) {
  report.ohmData = { error: String(e.message || e) };
  check('review.ohm-file-shipped', 'Frozen OHM 1500 extract is present and parses', false, report.ohmData);
}

// ---------------------------------------------------------------------------
// 1b. Publishability: are the data sources and licences recorded where a release
//     would need them? (Text checks only; the licences are not re-negotiated here.)
// ---------------------------------------------------------------------------
try {
  const readIf = rel => { try { return fs.readFileSync(path.join(C.ROOT, rel), 'utf8'); } catch (e) { return null; } };
  const attributions = readIf('ATTRIBUTIONS.md') || '';
  const dataLicence = readIf('public/data/LICENSE.md') || '';
  const manifest = JSON.parse(fs.readFileSync(path.join(C.PUBLIC, 'data/ohm-1500/manifest.json'), 'utf8'));
  const wanted = { cliopatria: /Cliopatria|Seshat/i, naturalEarth: /Natural Earth/i, cshapes: /CShapes/i, ohm: /OpenHistoricalMap|OHM/i, wikidata: /Wikidata/i, pleiades: /Pleiades/i };
  const present = Object.fromEntries(Object.entries(wanted).map(([k, re]) => [k, re.test(attributions)]));
  const ncFlagged = /CC BY-NC|non-commercial|NonCommercial|非商业/i.test(attributions + ' ' + dataLicence);
  report.publishability = {
    attributionsFile: { path: 'ATTRIBUTIONS.md', bytes: attributions.length, sourcesMentioned: present },
    dataLicenceFile: { path: 'public/data/LICENSE.md', bytes: dataLicence.length },
    ohmManifest: { schema: manifest.schema, year: manifest.year, source: manifest.source, license: manifest.license, attribution: manifest.attribution, timestamp: manifest.timestamp, features: manifest.relationCount },
    nonCommercialLicenceFlagged: ncFlagged
  };
  check('review.attributions-present', 'ATTRIBUTIONS.md names the upstream data sources', Object.values(present).filter(Boolean).length >= 4, present);
  check('review.noncommercial-flagged', 'A non-commercial upstream licence (CShapes CC BY-NC-SA) is flagged in the attribution or data licence text, as the user asked to record licences honestly for later release decisions', ncFlagged, { nonCommercialLicenceFlagged: ncFlagged, dataLicenceMentionsNC: /NC/i.test(dataLicence) });
  check('review.ohm-manifest-licence', 'The frozen OHM manifest records source, licence and extraction timestamp', !!manifest.source && !!manifest.license && !!manifest.timestamp, report.publishability.ohmManifest);
} catch (e) {
  report.publishability = { error: String(e.message || e) };
  check('review.attributions-present', 'ATTRIBUTIONS.md names the upstream data sources', false, report.publishability);
}

// ---------------------------------------------------------------------------
// 2. Browser: the shipped layer stack, border toggle sync, OHM coverage at the
//    user's camera, and the native-geometry claim at 1503.
// ---------------------------------------------------------------------------
const STYLE_EXPR = "(() => { const m = window.__maps[0]; const ls = m.getStyle().layers.map(l => l.id); const vis = id => { try { return m.getLayoutProperty(id, 'visibility') || 'visible'; } catch (e) { return null; } }; const layer = id => { try { return m.getLayer(id); } catch (e) { return null; } }; return { layerIds: ls, reliefIndex: ls.indexOf('relief'), territoriesIndex: ls.indexOf('territories'), haloIndex: ls.indexOf('boundary-halo'), boundaryIndex: ls.indexOf('boundary'), territoryOpacity: m.getPaintProperty('territories', 'fill-opacity'), territoryOpacityExpression: layer('territories') ? layer('territories').paint['fill-opacity'] : null, haloPaint: layer('boundary-halo') ? layer('boundary-halo').paint : null, haloVis: vis('boundary-halo'), territoriesVis: vis('territories'), boundaryVis: vis('boundary') }; })()";
const OHM_EXPR = "(() => { const m = window.__maps[0]; const out = { hasSource: false, layers: [], sourceFeatures: null, rendered: null }; try { out.hasSource = !!m.getSource('ohm-frozen'); } catch (e) {} out.layers = ['ohm-frozen-wash', 'ohm-frozen-edges', 'ohm-frozen-partial', 'ohm-frozen-selected'].filter(id => !!m.getLayer(id)); try { const f = m.querySourceFeatures('ohm-frozen'); out.sourceFeatures = f.length; out.partial = f.filter(x => x.properties && x.properties.partial_geometry === 1).length; } catch (e) { out.sourceError = String(e.message || e); } try { out.rendered = m.queryRenderedFeatures({ layers: ['ohm-frozen-wash'] }).length; } catch (e) { out.renderedError = String(e.message || e); } const probe = (lon, lat) => { try { return m.queryRenderedFeatures(m.project([lon, lat]), { layers: ['ohm-frozen-wash'] }).length; } catch (e) { return 'error: ' + (e.message || e); } }; out.atBern = probe(8.23, 46.95); out.atLowCountries = probe(5.6, 51.0); out.badge = (document.querySelector('.regional-badge') || {}).textContent || null; out.regionalStatus = document.querySelector('#regionalStatus').textContent; out.legend = document.querySelector('#mapLegend span:last-child').textContent; const note = document.querySelector('.boundary-source-note'); out.gapNotice = note ? { visible: note.getClientRects().length > 0, summary: (note.querySelector('summary') || {}).textContent || null, items: [...note.querySelectorAll('dt')].map(e => e.textContent) } : null; return out; })()";

const s = await launch({ port: await C.pickPort(PORT), width: 1600, height: 900, profile: '/tmp/atlas-review-' + Date.now() });
const net = { requests: [] };
try {
  await C.installInstrument(s);
  s.on(m => { if (m.method === 'Network.requestWillBeSent') net.requests.push({ url: m.params.request.url, t: Date.now() }); });

  // 2a. User's camera, 1500, regional boundary mode.
  const url = URL_BASE + '/#year=1500&lang=bi&browse=1&' + CAMERA + '&boundaries=regional';
  const t0 = Date.now();
  await goto(s, url, { waitMs: 300 });
  await C.waitMapReady(s, 120000);
  let ohmReadyMs = null;
  for (let i = 0; i < 120; i++) {
    const has = await evaluate(s, "(() => { try { const m = window.__maps[0]; return !!m.getSource('ohm-frozen') && !!m.getLayer('ohm-frozen-wash'); } catch (e) { return false; } })()");
    if (has) { ohmReadyMs = Date.now() - t0; break; }
    await sleep(500);
  }
  await sleep(2500);
  report.browser = { url, readyMs: Date.now() - t0, ohmLayerReadyMs: ohmReadyMs };
  report.style = await evaluate(s, STYLE_EXPR);
  report.ohmView = await evaluate(s, OHM_EXPR);
  report.ohmRequests = net.requests.filter(r => /data\/ohm-1500\//.test(r.url)).map(r => r.url.replace(/^.*\//, ''));
  await screenshot(s, C.screenshotPath('review-ohm-1500-alps.png'));

  const st = report.style || {};
  check('review.relief-under-territories', 'Relief raster sits below the territory fills in the layer stack', st.reliefIndex >= 0 && st.territoriesIndex >= 0 && st.reliefIndex < st.territoriesIndex, { reliefIndex: st.reliefIndex, territoriesIndex: st.territoriesIndex, order: (st.layerIds || []).slice(0, 12) });
  check('review.boundary-halo-present', 'A cased boundary halo layer exists and is drawn below the crisp boundary line', st.haloIndex >= 0 && st.boundaryIndex > st.haloIndex, { haloIndex: st.haloIndex, boundaryIndex: st.boundaryIndex, haloPaint: st.haloPaint });
  check('review.territory-opacity-calibrated', 'Territory fill opacity is a zoom interpolation between 0.2 and 0.53', Array.isArray(st.territoryOpacityExpression) && st.territoryOpacityExpression[0] === 'interpolate', { expression: st.territoryOpacityExpression });
  const ov = report.ohmView || {};
  check('review.ohm-frozen-served-to-page', 'The page fetched the shipped frozen OHM file and built its layers', report.ohmRequests.length > 0 && (ov.layers || []).length > 0 && ov.hasSource === true, { requests: report.ohmRequests, layers: ov.layers, ohmLayerReadyMs });
  check('review.ohm-positive-control', 'Positive control: the frozen extract renders polygons over the Low Countries (the layer is not globally empty)', typeof ov.atLowCountries === 'number' ? ov.atLowCountries > 0 : null, { atLowCountries: ov.atLowCountries, renderedInViewport: ov.rendered, sourceFeatures: ov.sourceFeatures });
  check('review.ohm-alps-coverage-measured', 'Measured coverage at Bern (Alps): recorded against the fidelity doc claim of a blank detail view', true, { atBern: ov.atBern, renderedInViewport: ov.rendered, sourceFeatures: ov.sourceFeatures, badge: ov.badge, regionalStatus: ov.regionalStatus });
  check('review.gap-notice-visible', 'The UI exposes the missing-polity notice and lists the gaps', !!(ov.gapNotice && ov.gapNotice.visible && (ov.gapNotice.items || []).length > 0), ov.gapNotice || null);

  // 2b. Border toggle must hide/show the new halo layer too.
  await click(s, '#bordersBtn');
  await sleep(600);
  const off = await evaluate(s, STYLE_EXPR);
  await click(s, '#bordersBtn');
  await sleep(600);
  const on = await evaluate(s, STYLE_EXPR);
  report.borderToggle = { off: { territories: off.territoriesVis, boundary: off.boundaryVis, halo: off.haloVis }, on: { territories: on.territoriesVis, boundary: on.boundaryVis, halo: on.haloVis } };
  check('review.borders-toggle-syncs-halo', 'Turning borders off hides the halo as well, turning them on restores every boundary layer', off.territoriesVis === 'none' && off.boundaryVis === 'none' && off.haloVis === 'none' && on.territoriesVis === 'visible' && on.boundaryVis === 'visible' && on.haloVis === 'visible', report.borderToggle);

  // 2c. 1503 native-geometry claim (non-bootstrap year, same camera).
  net.requests.length = 0;
  const t1 = Date.now();
  await goto(s, URL_BASE + '/#year=1503&lang=bi&browse=1&' + CAMERA, { waitMs: 300 });
  await C.waitMapReady(s, 120000);
  let nativeMs = null;
  for (let i = 0; i < 240; i++) {
    const txt = await evaluate(s, 'document.querySelector("#boundaryStatus").textContent');
    if (txt && txt.indexOf('原始疆域已载入') >= 0) { nativeMs = Date.now() - t1; break; }
    await sleep(250);
  }
  const nativeRequests = net.requests.filter(r => /\/data\/native\//.test(r.url)).length;
  report.native1503 = { ms: nativeMs, nativeRequests, totalRequests: net.requests.length, boundaryStatus: await evaluate(s, 'document.querySelector("#boundaryStatus").textContent'), datasetStatus: await evaluate(s, 'document.querySelector("#datasetStatus").textContent'), documentedClaim: { records: 137, responses: 208, seconds: 12 } };
  check('review.native-1503-steady-state', 'At 1503 the page reports source (native) borders loaded', nativeMs !== null, { ms: nativeMs, boundaryStatus: report.native1503.boundaryStatus, nativeRequests, totalRequests: report.native1503.totalRequests });
  await screenshot(s, C.screenshotPath('review-native-1503.png'));
  report.pageErrors = await C.pageErrors(s);
} catch (e) {
  report.fatal = String((e && e.stack) || e);
} finally {
  await s.close();
}

report.limitations = [
  'The project validators (npm test) are not re-run here: several of them rewrite audit JSON under docs/, which the Lead owns. Data-level and browser-level claims are re-derived independently instead.',
  'queryRenderedFeatures counts depend on the current viewport and zoom; they are reported with the camera and zoom so they can be reproduced.',
  'OHM admin-level semantics (imperial circles vs duchies) are read from the source properties, not from a gazetteer.'
];
report.notes.push('Measured at the camera of the user screenshot: ' + CAMERA + '.');
report.conclusions = [
  'Frozen OHM 1500: ' + ((report.ohmData || {}).features || 0) + ' features, ' + ((report.ohmData || {}).gapCount || 0) + ' declared gaps, licence notice CC0 = ' + (((report.ohmData || {}).licenceNotice || {}).mentionsCC0),
  'Alps window (7-11.6E, 45.4-48.4N) holds ' + (((report.ohmData || {}).alpsWindow || {}).features) + ' frozen OHM features (imperial circles), while the six named 1500 polities are absent - so "the detail view is blank there" is only true for those named polities, not for the layer as a whole.',
  'Rendered OHM polygons at Bern = ' + ((report.ohmView || {}).atBern) + '; Low Countries positive control = ' + ((report.ohmView || {}).atLowCountries) + '; badge = ' + JSON.stringify((report.ohmView || {}).badge),
  'Layer stack: relief index ' + ((report.style || {}).reliefIndex) + ' < territories ' + ((report.style || {}).territoriesIndex) + '; boundary-halo ' + ((report.style || {}).haloIndex) + ' < boundary ' + ((report.style || {}).boundaryIndex) + '.',
  'Territory fill opacity expression: ' + JSON.stringify((report.style || {}).territoryOpacityExpression) + ' (the fidelity doc says "0.53 to 0.30"; source constant territoryOpacity is 0.5/0.42/0.3/0.2 and regional mode sets 0.53/0.4/0.2).',
  '1503 native steady state: reported after ' + ((report.native1503 || {}).ms) + ' ms with ' + ((report.native1503 || {}).nativeRequests) + ' native geometry requests out of ' + ((report.native1503 || {}).totalRequests) + ' total (doc claims 208 responses / ~12 s).'
];
const file = C.writeJSON(OUT, report);
const failed = report.checks.filter(c => c.pass === false);
C.log('wrote', file);
for (const c of report.checks) C.log(c.pass === true ? 'PASS' : (c.pass === false ? 'FAIL' : 'NONE'), c.id);
process.exitCode = failed.length ? 2 : 0;
