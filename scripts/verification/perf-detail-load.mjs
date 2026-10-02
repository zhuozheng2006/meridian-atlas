// Perf measurement for the 3.12 round: first screen and the overview -> detail path.
// Reproduce:
//   node scripts/verification/perf-detail-load.mjs --label baseline
//   node scripts/verification/perf-detail-load.mjs --label round3 --quick
// Report: docs/verification-3.12/perf-detail-load-<label>.json
//
// Scenarios per throttle profile: cold first screen at 1500 (boot year) and the
// detail path at 1450 (non-boot: overview first frame -> native geometry -> zoom 3/7/9).
// All timings are in-page performance.now() marks; request counts/bytes come from an
// in-page fetch() wrapper plus CDP Network events (connection ids prove reuse).
import fs from 'node:fs';
import path from 'node:path';
import { launch, evaluate, screenshot, sleep } from './browser.mjs';
import * as C from './lib/common.mjs';

const args = C.parseArgs();
// Accept both "--url value" and "--url=value" (parseArgs only splits on whitespace).
for (const raw of process.argv.slice(2)) { const m = raw.match(/^--([a-z-]+)=(.*)$/); if (m && args[m[1]] === undefined) args[m[1]] = m[2]; }
const URL_BASE = String(args.url || C.DEFAULT_URL).replace(/\/$/, '');
const PORT = Number(args.port || 9521);
const LABEL = String(args.label || 'run');
const OUT = String(args.out || ('docs/verification-3.12/perf-detail-load-' + LABEL + '.json'));
const QUICK = !!args.quick;
const DEVICE = String(args.device || 'desktop'); // desktop | mobile
const ALL_PROFILES = [
  { name: 'unthrottled', latency: 0, kbps: null },
  { name: 'wifi-4mbps', latency: 100, kbps: 4096 },
  { name: 'slow-4g-1.6mbps', latency: 300, kbps: 1638 },
  { name: 'slow-3g-400kbps', latency: 400, kbps: 400 }
];
const PROFILES = args.profiles
  ? ALL_PROFILES.filter(p => String(args.profiles).split(',').includes(p.name))
  : (QUICK ? [ALL_PROFILES[0]] : ALL_PROFILES);
const report = C.mkReport('perf-detail-load.mjs', { url: URL_BASE, width: DEVICE === 'mobile' ? 390 : 1400, height: DEVICE === 'mobile' ? 844 : 900 });
// A lost renderer leaves CDP awaits pending forever; the guard turns that into an
// error, and the watchdog keeps one stuck scenario from hanging the whole suite.
function guardSession(s, timeoutMs = 90000) {
  const origSend = s.send.bind(s);
  s.send = (method, params) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('CDP ' + method + ' did not answer within ' + timeoutMs + ' ms; browser session lost')), timeoutMs);
    origSend(method, params).then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
  });
  return s;
}
const withTimeout = (promise, ms, label) => Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(Error('scenario watchdog: ' + label + ' exceeded ' + ms + ' ms')), ms))]);
report.label = LABEL;
report.device = DEVICE;

// --- in-page instrumentation: fetch timeline, geometry-status, loading transitions ---
function perfPayload() {
  window.__perf = { fetches: [], geometry: [], notes: [] };
  const of = window.fetch;
  window.fetch = function () {
    const args = Array.prototype.slice.call(arguments);
    const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '?';
    const t0 = performance.now();
    const p = of.apply(this, args);
    p.then(
      r => window.__perf.fetches.push({ url: url.split('/').slice(-2).join('/'), full: url, start: Math.round(t0), end: Math.round(performance.now()), status: r.status, bytes: Number(r.headers.get('content-length') || 0) }),
      e => window.__perf.fetches.push({ url: url.split('/').slice(-2).join('/'), full: url, start: Math.round(t0), end: Math.round(performance.now()), status: 0, error: String(e && e.message || e) })
    );
    return p;
  };
  addEventListener('geometry-status', e => window.__perf.geometry.push({ t: Math.round(performance.now()), fine: !!(e.detail && e.detail.fine) }), true);
  document.addEventListener('visibilitychange', () => window.__perf.notes.push('visibility:' + document.visibilityState));
}
const PERF_SETUP = '(' + perfPayload.toString() + ')();';

function stateExpr() {
  const a = (window.__meridian && window.__meridian.instances || [])[0];
  if (!a) return null;
  const g = a.geography;
  const src = id => { try { return a.map.getSource(id) ? a.map.isSourceLoaded(id) : null; } catch (e) { return null; } };
  const feat = id => { try { return a.map.getSource(id) ? a.map.querySourceFeatures(id).length : null; } catch (e) { return null; } };
  return {
    zoom: +a.map.getZoom().toFixed(2), year: a.year, geometryKeyTail: (a.geometryKey || '').slice(-2), nativeComplete: (a.geometryKey || '').endsWith('n'),
    geographyStatus: g && g.status, localLoaded: g ? [...g.localLoaded] : null, terrainReady: !!g && g.terrainReady, referenceReady: !!g && g.referenceReady,
    lakesStatus: g && g.lakes && g.lakes.status, lakesCount: (g && g.lakes && g.lakes.count) || 0,
    regionalStatus: a.regional && a.regional.status, ohmState: a.regional && a.regional.ohmState, regionalFeatures: (a.regional && a.regional.features && a.regional.features.length) || 0,
    places: (a.places && a.places.markers && a.places.markers.length) || 0,
    sources: { polities: src('polities'), land: src('land'), physicalLakes: src('physical-lakes'), physicalRivers: src('physical-rivers'), lakeDetail: src('lake-detail'), reference: src('geographic-reference'), terrain: src('terrain-dem') },
    features: { land: feat('land'), physicalLakes: feat('physical-lakes'), lakeDetail: feat('lake-detail'), ohm: feat('ohm-frozen') }
  };
}
const STATE = '(' + stateExpr.toString() + ')()';

async function collect(s, t0) {
  const fetches = await evaluate(s, '(window.__perf ? window.__perf.fetches : [])');
  const geometry = await evaluate(s, '(window.__perf ? window.__perf.geometry : [])');
  const nav = await evaluate(s, '(() => { const n = performance.getEntriesByType("navigation")[0] || {}; const p = performance.getEntriesByType("paint").map(x => [x.name, Math.round(x.startTime)]); return { responseStart: Math.round(n.responseStart || 0), responseEnd: Math.round(n.responseEnd || 0), domContentLoaded: Math.round(n.domContentLoadedEventEnd || 0), loadEvent: Math.round(n.loadEventEnd || 0), paints: p }; })()');
  const res = await evaluate(s, 'performance.getEntriesByType("resource").map(r => ({ u: r.name, n: r.name.split("/").slice(-2).join("/"), type: r.initiatorType, start: Math.round(r.startTime), end: Math.round(r.responseEnd), ms: Math.round(r.duration), bytes: r.encodedBodySize, transfer: r.transferSize }))');
  return {
    wallMs: Date.now() - t0, nav, fetches, geometry,
    resources: { count: res.length, encodedBytes: res.reduce((a, r) => a + (r.bytes || 0), 0), byType: groupBy(res, r => r.type), byHost: groupBy(res, r => { const m = (r.u || '').match(/^https?:\/\/([^/]+)/); return m && !/127[.]0[.]0[.]1|localhost/.test(m[1]) ? m[1] : 'local'; }), lastEndMs: res.length ? Math.max(...res.map(r => r.end || 0)) : null, slowest: [...res].sort((a, b) => b.ms - a.ms).slice(0, 10), all: res },
    phases: {
      htmlMs: nav.responseEnd,
      cssDoneMs: maxEnd(res, r => /[.]css(\?|$)/.test(r.u)),
      jsDoneMs: maxEnd(res, r => /maplibre-gl[.]js|app[.]js|startup[.]js/.test(r.u)),
      firstGeometryMs: minEnd(res, r => /\/data\//.test(r.u)),
      allDataMs: maxEnd(res, r => /\/data\//.test(r.u)),
      jsBytes: sumBytes(res, r => /[.]js(\?|$)/.test(r.u)),
      cssBytes: sumBytes(res, r => /[.]css(\?|$)/.test(r.u)),
      dataBytes: sumBytes(res, r => /\/data\//.test(r.u)),
      externalRequests: res.filter(r => /^https?:\/\/([^/]+)/.test(r.u) && !/127[.]0[.]0[.]1|localhost/.test((r.u.match(/^https?:\/\/([^/]+)/) || [])[1] || '')).length
    },
    groups: {
      fast: sumGroup(fetches, /data\/fast\//), native: sumGroup(fetches, /data\/native\//), physical: sumGroup(fetches, /data\/physical\//),
      lakes: sumGroup(fetches, /data\/lakes\//), places: sumGroup(fetches, /data\/places\//), app: sumGroup(fetches, /[.]js|[.]css|^\/$/)
    },
    nativeTimeline: fetches.filter(f => /data\/native\//.test(f.full || '')).map(f => ({ file: (f.full || '').split('/').slice(-2).join('/'), start: f.start, end: f.end })).sort((a, b) => a.start - b.start)
  };
}
const maxEnd = (list, pred) => { const hit = list.filter(x => pred(x) && Number.isFinite(x.end)); return hit.length ? Math.max(...hit.map(x => x.end)) : null; };
const minEnd = (list, pred) => { const hit = list.filter(x => pred(x) && Number.isFinite(x.end)); return hit.length ? Math.min(...hit.map(x => x.end)) : null; };
const sumBytes = (list, pred) => list.filter(pred).reduce((a, x) => a + (x.bytes || 0), 0);
const groupBy = (list, key) => list.reduce((acc, x) => { const k = key(x) || 'other'; acc[k] = acc[k] || { count: 0, bytes: 0 }; acc[k].count++; acc[k].bytes += x.bytes || 0; return acc; }, {});
const sumGroup = (list, re) => { const hit = list.filter(f => re.test(f.full || '')); return { count: hit.length, bytes: hit.reduce((a, f) => a + (f.bytes || 0), 0), lastEndMs: hit.length ? Math.max(...hit.map(f => f.end)) : null }; };

async function newSession(name, mobile) {
  const s = guardSession(await launch({ port: await C.pickPort(PORT + (mobile ? 40 : 0)), width: mobile ? 390 : 1400, height: mobile ? 844 : 900, mobile: !!mobile, profile: '/tmp/atlas-detail-' + name + '-' + Date.now() }));
  await s.send('Page.addScriptToEvaluateOnNewDocument', { source: PERF_SETUP });
  await C.installInstrument(s);
  return s;
}

async function setupThrottle(s, profile) {
  if (profile.kbps) await s.send('Network.emulateNetworkConditions', { offline: false, latency: profile.latency, downloadThroughput: Math.round(profile.kbps * 1024 / 8), uploadThroughput: Math.round(profile.kbps * 512 / 8), connectionType: 'cellular4g' });
  else await s.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1, connectionType: 'none' });
}

async function scenarioCold(profile, mobile) {
  const s = await newSession('cold-' + profile.name, mobile);
  const conns = new Set(); const netReq = [];
  s.on(m => {
    if (m.method === 'Network.requestWillBeSent') netReq.push(m.params.request.url);
    if (m.method === 'Network.responseReceived') conns.add(m.params.response.connectionId);
  });
  const out = { profile: profile.name, scenario: 'cold-1500' };
  try {
    await setupThrottle(s, profile);
    const t0 = Date.now();
    await C.navigate(s, URL_BASE + '/#year=1500&lang=bi&browse=1&step=10');
    const ready = await C.waitMapReady(s, 240000);
    out.firstFrameMs = ready.elapsed;
    out.afterFirstFrame = await evaluate(s, STATE);
    out.collected = await collect(s, t0);
    out.connections = conns.size;
    out.requests = netReq.length;
    await screenshot(s, C.screenshotPath('detail-' + LABEL + '-cold-' + profile.name + (mobile ? '-mobile' : '') + '.png'));
  } catch (e) { out.fatal = String((e && e.stack) || e).slice(0, 400); }
  finally { await s.close(); }
  return out;
}

async function waitFor(s, expr, timeout, interval = 300) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const v = await evaluate(s, expr).catch(() => null);
    if (v) return Date.now() - t0;
    await sleep(interval);
  }
  return null;
}

async function scenarioDetail(profile, { withZoom = true } = {}) {
  const s = await newSession('detail-' + profile.name, false);
  const conns = new Set(); const netReq = [];
  s.on(m => {
    if (m.method === 'Network.requestWillBeSent') netReq.push(m.params.request.url);
    if (m.method === 'Network.responseReceived') conns.add(m.params.response.connectionId);
  });
  const out = { profile: profile.name, scenario: 'detail-1450' };
  try {
    await setupThrottle(s, profile);
    const t0 = Date.now();
    // Start at the default globe view (the user's first screen) so the zoom steps
    // measure the real overview -> fine-layer transition rather than a warm zoom.
    await C.navigate(s, URL_BASE + '/#year=1450&lang=bi&browse=1&step=10');
    const ready = await C.waitMapReady(s, 240000);
    out.firstFrameMs = ready.elapsed;
    out.afterFirstFrame = await evaluate(s, STATE);
    const tNative = Date.now();
    const nativeMs = await waitFor(s, '(() => { const a = (window.__meridian.instances || [])[0]; return !!(a && a.geometryKey && a.geometryKey.endsWith("n")); })()', 300000, 200);
    out.nativeCompleteMs = nativeMs === null ? null : (Date.now() - t0);
    out.nativeWaitMs = nativeMs;
    out.afterNative = await evaluate(s, STATE);
    if (withZoom) {
      out.zoom = [];
      for (const z of [3, 7, 9]) {
        const zt = Date.now();
        await evaluate(s, '(() => { const a = window.__meridian.instances[0]; a.map.jumpTo({ center: [8.2, 46.9], zoom: ' + z + ' }); return true; })()');
        // Sample the layer state every 250 ms instead of waiting for one predicate:
        // the point is to record WHEN each detail layer first becomes usable.
        const samples = [];
        let stable = 0;
        for (let i = 0; i < 240; i++) {
          const st = await evaluate(s, STATE).catch(() => null);
          if (!st) break;
          samples.push({ ms: Date.now() - zt, ...st });
          const settled = st.lakesStatus !== 'loading' && st.lakesStatus !== 'rendering' && st.sources.polities === true;
          stable = settled ? stable + 1 : 0;
          if (stable >= 6 && samples.length > 12) break; // ~1.5 s of unchanged state
          await sleep(250);
        }
        const first = pred => { const hit = samples.find(x => { try { return pred(x); } catch (e) { return false; } }); return hit ? hit.ms : null; };
        out.zoom.push({
          zoom: z, elapsedMs: Date.now() - zt, samples: samples.length,
          markers: {
            physicalLoadedMs: first(x => x.sources.land === true && x.sources.physicalLakes === true),
            lakesDetailMs: first(x => x.lakesStatus === 'ready'),
            lakesOverviewMs: first(x => x.lakesStatus === 'overview'),
            terrainMs: first(x => x.terrainReady === true),
            referenceMs: first(x => x.referenceReady === true),
            regionalReadyMs: first(x => x.regionalStatus === 'partial' || x.regionalStatus === 'empty' || x.features.ohm !== null),
            ohmFeaturesMs: first(x => (x.features.ohm || 0) > 0),
            nativeMs: first(x => x.nativeComplete === true)
          },
          settleMs: samples.length ? samples[samples.length - 1].ms : null,
          lastState: samples.length ? samples[samples.length - 1] : null
        });
      }
    }
    out.collected = await collect(s, t0);
    out.connections = conns.size;
    out.requests = netReq.length;
    await screenshot(s, C.screenshotPath('detail-' + LABEL + '-detail-' + profile.name + '.png'));
  } catch (e) { out.fatal = String((e && e.stack) || e).slice(0, 400); }
  finally { await s.close(); }
  return out;
}

async function scenarioRegional(profile) {
  const s = await newSession('regional-' + profile.name, false);
  const out = { profile: profile.name, scenario: 'regional-ohm-1500' };
  try {
    await setupThrottle(s, profile);
    const t0 = Date.now();
    await C.navigate(s, URL_BASE + '/#year=1500&lang=bi&browse=1&boundaries=regional&camera=9.32,48.08,6.72,0,0');
    const ready = await C.waitMapReady(s, 240000);
    out.firstFrameMs = ready.elapsed;
    out.ohmReadyMs = await waitFor(s, '(() => { const a = (window.__meridian.instances || [])[0]; return !!(a && a.regional && a.regional.ohmState === "ready" && a.map.getLayer("ohm-frozen-wash")); })()', 180000, 200);
    out.ohmReadyTotalMs = out.ohmReadyMs === null ? null : Date.now() - t0;
    out.regionalSettledMs = await waitFor(s, '(() => { const el = document.querySelector("#regionalStatus"); return !!el && el.textContent.indexOf("正在") < 0; })()', 180000, 500);
    out.state = await evaluate(s, STATE);
    out.collected = await collect(s, t0);
    await screenshot(s, C.screenshotPath('detail-' + LABEL + '-regional-' + profile.name + '.png'));
  } catch (e) { out.fatal = String((e && e.stack) || e).slice(0, 400); }
  finally { await s.close(); }
  return out;
}

// --keepalive-bench : measure how the static server handles many small files.
// Node's http.Agent with keepAlive reuses sockets only when the server allows it, so
// newSockets vs requests is a direct read-out of HTTP/1.0 vs HTTP/1.1 behaviour.
if (args['keepalive-bench']) {
  const { default: http } = await import('node:http');
  const limit = Number(args.files || 133);
  const root = path.join(C.PUBLIC, 'data', 'native', 'geos');
  const list = [];
  const dirs = fs.readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();
  for (const dir of dirs) {
    if (list.length >= limit) break;
    for (const file of fs.readdirSync(path.join(root, dir)).sort()) {
      list.push(dir + '/' + file);
      if (list.length >= limit) break;
    }
  }
  const run = async (concurrency) => {
    const agent = new http.Agent({ keepAlive: true, maxSockets: concurrency });
    const seen = new WeakSet();
    let newSockets = 0, bytes = 0, errors = 0;
    const t0 = Date.now();
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, async () => {
      while (cursor < list.length) {
        const file = list[cursor++];
        await new Promise(resolve => {
          const req = http.get(URL_BASE + '/data/native/geos/' + file, { agent }, res => {
            res.on('data', d => { bytes += d.length; });
            res.on('end', resolve);
          });
          req.on('socket', s => { if (!seen.has(s)) { seen.add(s); newSockets++; } });
          req.on('error', () => { errors++; resolve(); });
        });
      }
    }));
    const ms = Date.now() - t0;
    agent.destroy();
    return { files: list.length, concurrency, ms, newSockets, bytes, errors, msPerFile: Number((ms / list.length).toFixed(2)) };
  };
  const out = { label: LABEL, url: URL_BASE, generatedAt: C.nowIso(), provenance: C.provenance(), results: [await run(1), await run(6)] };
  const file3 = C.writeJSON('docs/verification-3.12/keepalive-bench-' + LABEL + '.json', out);
  C.log('wrote', file3);
  for (const r of out.results) C.log(JSON.stringify(r));
  process.exit(0);
}

// --compare before,after : read two finished reports and print/write a delta table.
if (args.compare) {
  const [aLabel, bLabel] = String(args.compare).split(',');
  const load = l => JSON.parse(fs.readFileSync(path.join(C.ROOT, 'docs/verification-3.12/perf-detail-load-' + l + '.json'), 'utf8'));
  const A = load(aLabel), B = load(bLabel);
  const key = r => r.scenario + '/' + r.profile;
  const byKey = list => Object.fromEntries((list.runs || []).map(r => [key(r), r]));
  const a = byKey(A), b = byKey(B);
  const fields = ['firstFrameMs', 'nativeCompleteMs', 'ohmReadyTotalMs', 'requests', 'connections', 'nativeReq', 'encodedMiB', 'physicalMiB'];
  const rows = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().map(k => {
    const row = { run: k };
    for (const f2 of fields) {
      const av = a[k] ? (a[k][f2] !== undefined ? a[k][f2] : (a[k].summary || {})[f2]) : null;
      const bv = b[k] ? (b[k][f2] !== undefined ? b[k][f2] : (b[k].summary || {})[f2]) : null;
      row[f2] = { before: av === undefined ? null : av, after: bv === undefined ? null : bv };
    }
    const az = (a[k] && a[k].zoom) || [], bz = (b[k] && b[k].zoom) || [];
    row.zoomSettleMs = { before: az.map(z => z.settleMs), after: bz.map(z => z.settleMs) };
    return row;
  });
  const out = { compare: aLabel + ' -> ' + bLabel, generatedAt: C.nowIso(), before: A.meta && A.meta.provenance, after: B.meta && B.meta.provenance, rows };
  const file2 = C.writeJSON('docs/verification-3.12/perf-detail-compare-' + aLabel + '-' + bLabel + '.json', out);
  for (const r of rows) C.log(r.run, 'firstFrame', JSON.stringify(r.firstFrameMs), 'native', JSON.stringify(r.nativeCompleteMs), 'req', JSON.stringify(r.requests), 'conn', JSON.stringify(r.connections));
  C.log('wrote', file2);
  process.exit(0);
}

const t0 = Date.now();
report.systemAtStart = C.systemLoad();
report.runs = [];
if (args.append && fs.existsSync(path.join(C.ROOT, OUT))) {
  const prev = JSON.parse(fs.readFileSync(path.join(C.ROOT, OUT), 'utf8'));
  report.runs = prev.runs || [];
  report.appendRuns = (prev.appendRuns || 0) + 1;
  C.log('append: keeping', report.runs.length, 'runs from', OUT);
}
const save = () => {
  report.systemAtEnd = C.systemLoad();
  report.wallClockMs = Date.now() - t0;
  report.summary = report.runs.map(r => ({
    id: r.scenario + '/' + r.profile,
    firstFrameMs: r.firstFrameMs || null,
    nativeCompleteMs: r.nativeCompleteMs === undefined ? null : r.nativeCompleteMs,
    ohmReadyTotalMs: r.ohmReadyTotalMs === undefined ? null : r.ohmReadyTotalMs,
    requests: r.requests || null, connections: r.connections || null,
    encodedMiB: r.collected ? Number((r.collected.resources.encodedBytes / 1048576).toFixed(2)) : null,
    nativeReq: r.collected ? r.collected.groups.native.count : null,
    physicalMiB: r.collected ? Number((r.collected.groups.physical.bytes / 1048576).toFixed(2)) : null,
    zoomSettleMs: r.zoom ? r.zoom.map(z => z.settleMs) : null,
    fatal: r.fatal || null
  }));
  return C.writeJSON(OUT, report);
};
const scenarioRunners = { cold: p => scenarioCold(p, DEVICE === 'mobile'), detail: p => scenarioDetail(p), regional: p => scenarioRegional(p) };
for (const p of PROFILES) {
  const kinds = args.kinds ? String(args.kinds).split(',') : ['cold', 'detail', 'regional'];
  for (const kind of kinds) {
    if (kind === 'regional' && QUICK && !args.regional) continue;
    const id = kind + '/' + p.name;
    const fullKey = (kind === 'cold' ? 'cold-1500/' : kind === 'detail' ? 'detail-1450/' : 'regional-ohm-1500/') + p.name;
    if (!args.force && report.runs.some(r => (r.scenario + '/' + r.profile) === fullKey)) { C.log('skip (already measured)', id); continue; }
    if (args.force) report.runs = report.runs.filter(r => (r.scenario + '/' + r.profile) !== fullKey);
    for (let attempt = 0; attempt < 2; attempt++) {
      C.log(kind, p.name, attempt ? '(retry)' : '');
      let run;
      try { run = await withTimeout(scenarioRunners[kind](p), 600000, id + ' attempt ' + attempt); }
      catch (e) { run = { profile: p.name, scenario: kind === 'cold' ? 'cold-1500' : kind === 'detail' ? 'detail-1450' : 'regional-ohm-1500', fatal: String((e && e.message) || e) }; }
      if (!run.fatal) { report.runs.push(run); save(); C.log('done', id, 'firstFrameMs', run.firstFrameMs, 'nativeCompleteMs', run.nativeCompleteMs); break; }
      C.log('failed', id, String(run.fatal).slice(0, 160));
      if (attempt === 1) { report.runs.push(run); save(); }
    }
  }
}
const file = save();
C.log('wrote', file, 'in', report.wallClockMs, 'ms with', report.runs.length, 'runs');
for (const r of report.summary) C.log(JSON.stringify(r));
