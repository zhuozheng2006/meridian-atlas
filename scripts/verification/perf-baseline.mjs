// P1 performance baseline for Meridian Atlas (real headless Chrome via CDP).
// Reproduce:
//   node scripts/verification/perf-baseline.mjs
//   node scripts/verification/perf-baseline.mjs --url http://127.0.0.1:8767 --port 9411
// Report: docs/verification-3.10/perf-baseline.json (screenshots in docs/verification-3.10/shots/)
//
// Measured: first screen (cold, fresh profile), resource weight, 20 consecutive year
// steps (1490 -> 1510, step 1), one large map drag, a blocked map-layer source with
// retry, and opening the two-map comparison. Every number in the report is observed
// in this run; limitations are listed explicitly and never reported as passes.
import fs from 'node:fs';
import { launch, goto, evaluate, click, key, dragMap, screenshot, sleep } from './browser.mjs';
import * as C from './lib/common.mjs';

const args = C.parseArgs();
const URL_BASE = String(args.url || C.DEFAULT_URL).replace(/\/$/, '');
const PORT = Number(args.port || 9411);
const OUT = String(args.out || 'docs/verification-3.10/perf-baseline.json');
const report = C.mkReport('perf-baseline.mjs', { url: URL_BASE, width: 1600, height: 900 });

const NAV_EXPR = '(() => { const n = performance.getEntriesByType("navigation")[0] || {}; const paints = performance.getEntriesByType("paint").map(p => [p.name, Math.round(p.startTime)]); const res = performance.getEntriesByType("resource").map(r => ({ name: r.name.replace(location.origin + "/", ""), type: r.initiatorType, ms: Math.round(r.duration), encoded: r.encodedBodySize, transfer: r.transferSize, decoded: r.decodedBodySize, status: r.responseStatus })); return { ttfbMs: Math.round(n.responseStart || 0), responseEndMs: Math.round(n.responseEnd || 0), domContentLoadedMs: Math.round(n.domContentLoadedEventEnd || 0), loadEventMs: Math.round(n.loadEventEnd || 0), paints, resources: res }; })()';

function resourceSummary(res) {
  const byType = {};
  for (const r of res) { byType[r.type] = byType[r.type] || { count: 0, encoded: 0 }; byType[r.type].count++; byType[r.type].encoded += r.encoded || 0; }
  return { count: res.length, encodedBytes: res.reduce((a, r) => a + (r.encoded || 0), 0), transferBytes: res.reduce((a, r) => a + (r.transfer || 0), 0), byType, largest: [...res].sort((a, b) => (b.encoded || 0) - (a.encoded || 0)).slice(0, 12).map(r => ({ name: r.name, ms: r.ms, encodedBytes: r.encoded, decodedBytes: r.decoded })) };
}

async function coldRun(index, port) {
  const s = await launch({ port, width: 1600, height: 900, profile: '/tmp/atlas-perf-cold-' + index + '-' + Date.now() });
  const run = { index, profile: 'fresh (network cache disabled by driver)' };
  try {
    await C.installInstrument(s);
    const t0 = Date.now();
    await goto(s, URL_BASE + '/#year=1500&lang=bi&browse=1&step=10', { waitMs: 200 });
    run.systemAtStart = C.systemLoad();
    const ready = await C.waitMapReady(s, 120000);
    run.mapReadyMs = ready.ready ? Date.now() - t0 : { timeout: true, state: ready.state };
    run.readyAfterQuietRecheck = !!ready.afterQuietRecheck;
    run.measureMs = Date.now() - t0;
    const nav = await evaluate(s, NAV_EXPR);
    run.navigation = { ttfbMs: nav.ttfbMs, responseEndMs: nav.responseEndMs, domContentLoadedMs: nav.domContentLoadedMs, loadEventMs: nav.loadEventMs, paints: nav.paints };
    run.resources = resourceSummary(nav.resources);
    run.instrumentation = await evaluate(s, C.exprs.instrumentMode);
    run.rafRate = await C.rafRate(s);
    run.mapCanvas = (await C.mapState(s, 0)).canvas;
    run.heapMB = await C.heapMB(s);
    run.userAgent = await evaluate(s, 'navigator.userAgent');
    run.consoleErrors = s.console.filter(c => c.type !== 'log').slice(0, 10);
    run.datasetStatus = await evaluate(s, 'document.querySelector("#datasetStatus").textContent');
    run.mapErrorShown = await evaluate(s, 'document.querySelector("#mapError").hidden === false');
    await screenshot(s, C.screenshotPath('perf-desktop-1500.png'));
  } catch (e) { run.fatal = String((e && e.stack) || e); }
  finally { await s.close(); }
  return run;
}

async function yearSequence(port) {
  const s = await launch({ port, width: 1600, height: 900, profile: '/tmp/atlas-perf-years-' + Date.now() });
  const out = { startYear: 1490, step: 1, steps: [] };
  try {
    await C.installInstrument(s);
    const initialStart = Date.now();
    await goto(s, URL_BASE + '/#year=1490&lang=bi&browse=1&step=1', { waitMs: 200 });
    out.initialReadyMs = await C.waitMapReady(s, 120000).then(() => Date.now() - initialStart).catch(e => ({ timeout: true, error: String(e.message) }));
    out.initialSettled = await C.waitYearSettled(s, 1490, 60000);
    out.systemAtStart = C.systemLoad();
    // Focus the map canvas so the keyboard route is the same one users hit.
    await evaluate(s, '(() => { const c = document.querySelector(".maplibregl-canvas"); c.focus(); return document.activeElement === c; })()');
    await C.resetRecorder(s);
    const heapStart = await C.heapMB(s);
    for (let year = 1491; year <= 1510; year++) {
      const wallStart = Date.now();
      await key(s, { code: 'ArrowRight', key: 'ArrowRight' });
      const settled = await C.waitYearSettled(s, year, 60000);
      out.steps.push({ year, wallMs: Date.now() - wallStart, settled: settled.settled, settleElapsed: settled.elapsed, settleLast: settled.last === undefined ? null : settled.last });
      if (!settled.settled) break;
    }
    out.heapStartMB = heapStart;
    out.heapEndMB = await C.heapMB(s);
    const steps = await C.stepTimeline(s);
    const keys = await C.keyTimeline(s);
    const longs = await C.longTasks(s);
    out.rawKeyEvents = keys.length;
    const perStep = [];
    for (let i = 0; i < out.steps.length; i++) {
      const k = keys[i];
      if (!k) { perStep.push({ year: out.steps[i].year, missing: 'no key event recorded' }); continue; }
      const commit = steps.find(e => e.kind === 'bigYear' && e.t >= k.t && String(e.value).indexOf(String(out.steps[i].year)) >= 0);
      const idle = commit ? steps.find(e => e.kind === 'busy' && e.value === 'false' && e.t >= commit.t) : null;
      const inWindow = longs.filter(l => l.start >= k.t && (!idle || l.start <= idle.t));
      perStep.push({ year: out.steps[i].year, keyT: k.t, commitT: commit ? commit.t : null, idleT: idle ? idle.t : null, keyToCommitMs: commit ? C.round(commit.t - k.t) : null, keyToIdleMs: idle && commit ? C.round(idle.t - k.t) : null, longTasks: inWindow.length, longestTaskMs: inWindow.length ? Math.max(...inWindow.map(l => l.dur)) : 0, heapAtIdleMB: idle ? idle.heap : null });
    }
    out.steps = perStep;
    out.summary = {
      steps: perStep.length,
      keyToCommitMs: C.stats(perStep.map(p => p.keyToCommitMs).filter(Number.isFinite)),
      keyToIdleMs: C.stats(perStep.map(p => p.keyToIdleMs).filter(Number.isFinite)),
      longTaskCount: longs.length,
      longestTaskMs: longs.length ? C.round(Math.max(...longs.map(l => l.dur))) : 0,
      heapGrowthMB: C.round((out.heapEndMB || 0) - (heapStart || 0))
    };
    out.resultYears = await evaluate(s, '(window.__maps[0] && Number(new URLSearchParams(location.hash.slice(1)).get("year"))) || null');
    out.pageErrors = await C.pageErrors(s);
    await screenshot(s, C.screenshotPath('perf-year-1510.png'));
  } catch (e) { out.fatal = String((e && e.stack) || e); }
  finally { await s.close(); }
  return out;
}

async function bigDrag(port) {
  const s = await launch({ port, width: 1600, height: 900, profile: '/tmp/atlas-perf-drag-' + Date.now() });
  const out = {};
  try {
    await C.installInstrument(s);
    await goto(s, URL_BASE + '/#year=1500&lang=bi&browse=1', { waitMs: 200 });
    await C.waitMapReady(s, 120000);
    await C.resetRecorder(s);
    out.systemAtStart = C.systemLoad();
    const before = await C.mapState(s, 0);
    const heapBefore = await C.heapMB(s);
    const t0 = Date.now();
    await dragMap(s, 430, 480, 1230, 300, 20);
    out.perMoveMs = C.round((Date.now() - t0) / 20);
    out.wallMs = Date.now() - t0;
    out.settleMs = await C.waitNotMoving(s, 20000);
    const after = await C.mapState(s, 0);
    const longs = await C.longTasks(s);
    out.camera = { before: before.center, after: after.center, deltaLng: C.round(after.center[0] - before.center[0], 3), deltaLat: C.round(after.center[1] - before.center[1], 3), zoomBefore: before.zoom, zoomAfter: after.zoom };
    out.cameraOps = (await C.camOps(s)).map(o => o.name);
    out.longTasks = { count: longs.length, longestMs: longs.length ? Math.max(...longs.map(l => l.dur)) : 0, totalMs: longs.reduce((a, l) => a + l.dur, 0) };
    out.rafRate = await C.rafRate(s);
    out.heapDeltaMB = C.round((await C.heapMB(s)) - heapBefore);
    out.pageErrors = await C.pageErrors(s);
    await screenshot(s, C.screenshotPath('perf-after-drag.png'));
  } catch (e) { out.fatal = String((e && e.stack) || e); }
  finally { await s.close(); }
  return out;
}

async function layerRetry(port) {
  const s = await launch({ port, width: 1600, height: 900, profile: '/tmp/atlas-perf-layer-' + Date.now() });
  const out = { blockedPatterns: ['*data/physical/physical-overview.json.gz*', '*data/land-50m.json.gz*'] };
  const requests = [];
  try {
    await C.installInstrument(s);
    s.on(m => { if (m.method === 'Network.requestWillBeSent') requests.push({ url: m.params.request.url, t: Date.now() }); });
    await goto(s, URL_BASE + '/#year=1500&lang=bi&browse=1', { waitMs: 200 });
    await C.waitMapReady(s, 120000);
    out.baselineStatus = { terrain: await evaluate(s, 'document.querySelector("#terrainStatus").textContent'), lake: await evaluate(s, 'document.querySelector("#lakeStatus").textContent') };
    out.baselineRequests = requests.filter(r => /physical-overview|land-50m/.test(r.url)).length;
    // Block two local geography sources and reload.
    await s.send('Network.setBlockedURLs', { urls: out.blockedPatterns });
    requests.length = 0;
    await goto(s, URL_BASE + '/#year=1500&lang=bi&browse=1', { waitMs: 200 });
    out.blockedReadyMs = await C.waitMapReady(s, 90000).then(() => 'ready').catch(e => 'timeout:' + e.message);
    await sleep(1500);
    out.blockedStatus = { terrain: await evaluate(s, 'document.querySelector("#terrainStatus").textContent'), lake: await evaluate(s, 'document.querySelector("#lakeStatus").textContent'), mapError: await evaluate(s, 'document.querySelector("#mapError").hidden === false ? document.querySelector("#mapError").textContent : null') };
    out.blockedRequests = requests.filter(r => /physical-overview|land-50m/.test(r.url)).length;
    out.blockedTerrainStatusVisible = await evaluate(s, '(() => { const el = document.querySelector("#terrainStatus"); const r = el.getBoundingClientRect(); return { text: el.textContent, visible: r.width > 0 && r.height > 0 }; })()');
    // Unblock and use the in-app retry control.
    await s.send('Network.setBlockedURLs', { urls: [] });
    requests.length = 0;
    const t0 = Date.now();
    await click(s, '#layersBtn');
    await sleep(300);
    out.panelOpen = await evaluate(s, 'document.querySelector("#layerPanel").hidden === false');
    await click(s, '#terrainRetry');
    let recovered = false;
    for (let i = 0; i < 60 && !recovered; i++) {
      await sleep(250);
      const st = await evaluate(s, 'document.querySelector("#terrainStatus").textContent');
      if (st && st !== out.blockedStatus.terrain) recovered = true;
    }
    out.retryMs = Date.now() - t0;
    out.recovered = recovered;
    out.recoveredStatus = { terrain: await evaluate(s, 'document.querySelector("#terrainStatus").textContent'), lake: await evaluate(s, 'document.querySelector("#lakeStatus").textContent'), mapError: await evaluate(s, 'document.querySelector("#mapError").hidden === false ? document.querySelector("#mapError").textContent : null') };
    out.requestsAfterRetry = requests.filter(r => /physical-overview|land-50m/.test(r.url)).length;
    out.stepTimeline = (await C.stepTimeline(s)).filter(e => e.kind === 'terrainStatus' || e.kind === 'mapError').slice(-12);
    out.pageErrors = await C.pageErrors(s);
    await screenshot(s, C.screenshotPath('perf-layer-retry.png'));
  } catch (e) { out.fatal = String((e && e.stack) || e); }
  finally { await s.close(); }
  return out;
}

async function compareOpen(port) {
  const s = await launch({ port, width: 1600, height: 900, profile: '/tmp/atlas-perf-compare-' + Date.now() });
  const out = {};
  try {
    await C.installInstrument(s);
    await goto(s, URL_BASE + '/#year=1500&lang=bi&browse=0', { waitMs: 200 });
    await C.waitMapReady(s, 120000);
    const heapBefore = await C.heapMB(s);
    const t0 = Date.now();
    await evaluate(s, 'document.querySelector("#compareBtn").click()');
    let maps = 0;
    for (let i = 0; i < 80; i++) { maps = await evaluate(s, C.exprs.mapCount); if (maps >= 2 && (await evaluate(s, 'document.querySelector("#compareYear").disabled === false'))) break; await sleep(250); }
    out.openMs = Date.now() - t0;
    out.maps = maps;
    out.compareYearEnabled = await evaluate(s, 'document.querySelector("#compareYear").disabled === false');
    out.map2Canvas = await C.mapState(s, 1).then(st => (st ? st.canvas : null));
    out.cameraSync = await (async () => { const a = await C.mapState(s, 0); const b = await C.mapState(s, 1); return { left: a.center, right: b.center, deltaLng: C.round(b.center[0] - a.center[0], 4), deltaLat: C.round(b.center[1] - a.center[1], 4) }; })();
    out.heapDeltaMB = C.round((await C.heapMB(s)) - heapBefore);
    out.pageErrors = await C.pageErrors(s);
    await screenshot(s, C.screenshotPath('perf-compare-open.png'));
  } catch (e) { out.fatal = String((e && e.stack) || e); }
  finally { await s.close(); }
  return out;
}

// ---------------------------------------------------------------------------
const t0 = Date.now();
report.systemAtStart = C.systemLoad();
C.log('cold run 1/2');
report.coldLoad = { runs: [await coldRun(1, await C.pickPort(PORT)), await coldRun(2, await C.pickPort(PORT + 2))] };
C.log('year sequence 1490->1510');
report.yearSequence = await yearSequence(await C.pickPort(PORT + 4));
C.log('large drag');
report.bigDrag = await bigDrag(await C.pickPort(PORT + 6));
C.log('layer source blocked + retry');
report.layerRetry = await layerRetry(await C.pickPort(PORT + 8));
C.log('two-map comparison');
report.compareOpen = await compareOpen(await C.pickPort(PORT + 10));

const okReady = report.coldLoad.runs.map(r => typeof r.mapReadyMs === 'number' ? r.mapReadyMs : null).filter(Number.isFinite);
const seq = report.yearSequence.summary || {};
const r1 = report.coldLoad.runs[0] || {};
const heaviest = ((r1.resources || {}).largest || [])[0] || null;
report.checks = [
  C.checkFn('perf.first-screen-ready', 'First screen reaches map-ready in both cold runs (network cache disabled)', v => v.every(x => x !== null && x < 20000), report.coldLoad.runs.map(r => r.mapReadyMs), { note: 'mapReady = #loading hidden after data + first territory frame' }),
  C.checkFn('perf.no-console-errors', 'No uncaught page errors on first load', v => (report.coldLoad.runs[0].consoleErrors || []).filter(c => c.type === 'exception').length === 0 && (report.yearSequence.pageErrors || []).length === 0, { coldConsole: report.coldLoad.runs[0].consoleErrors, yearSequenceErrors: report.yearSequence.pageErrors }),
  C.checkFn('perf.year-step-latency', 'Year stepping stays interactive: median < 500 ms and p95 < 1000 ms (outliers listed separately)', v => v.stats && v.stats.n === 20 && v.stats.median < 500 && v.stats.p95 < 1000, { stats: (report.yearSequence.summary || {}).keyToIdleMs, outliers: (report.yearSequence.steps || []).filter(s => s.keyToIdleMs > 1000).map(s => ({ year: s.year, ms: s.keyToIdleMs, longestTaskMs: s.longestTaskMs })), loadAtStart: report.systemAtStart }),
  C.checkFn('perf.year-steps-all-settled', 'All 20 consecutive steps reached the target year', v => v === 20, (report.yearSequence.steps || []).filter(s => s.commitT !== null).length),
  C.checkFn('perf.drag-settles', 'An 800 px drag settles and moves the camera', v => v && v.settleMs !== null && Math.abs(v.camera.deltaLng) > 1, report.bigDrag),
  C.checkFn('perf.layer-retry-recovers', 'Blocked geography source surfaces a status and #terrainRetry recovers after unblocking', v => v && v.recovered === true && v.requestsAfterRetry > 0, { recovered: report.layerRetry.recovered, retryMs: report.layerRetry.retryMs, requestsAfterRetry: report.layerRetry.requestsAfterRetry }),
  C.checkFn('perf.compare-opens', 'Two-map comparison opens with a second live map and no error', v => v.maps >= 2 && v.compareYearEnabled === true && !v.mapError, report.compareOpen)
];
report.limitations = [
  'requestAnimationFrame is throttled to ~2 fps in this headless configuration (' + JSON.stringify(r1.rafRate || {}) + '), so per-frame FPS/jank is NOT reported; the per-step timeline uses MutationObserver timestamps instead.',
  'performance.measureUserAgentSpecificMemory() is unavailable (page is not crossOriginIsolated); JS heap comes from the non-standard performance.memory.usedJSHeapSize.',
  'GPU raster times are from SwiftShader software rendering, not the user GPU.',
  'The CDP driver sets Network.setCacheDisabled(true), so cold/warm cache differences and disk-cache reuse are not measured.',
  'Frame timing during the drag is inferred from long tasks > 50 ms, not from compositor frames.'
];
report.bottlenecks = [
  heaviest ? { item: 'heaviest single resource', detail: heaviest.name, encodedBytes: heaviest.encodedBytes, ms: heaviest.ms } : null,
  { item: 'year step latency', detail: 'key -> idle median / p95', value: [((seq.keyToIdleMs || {}).median), ((seq.keyToIdleMs || {}).p95)] },
  { item: 'year step outliers', detail: '> 1000 ms, correlated with long tasks', value: (report.yearSequence.steps || []).filter(s => s.keyToIdleMs > 1000).map(s => s.year + ':' + s.keyToIdleMs + 'ms/' + s.longestTaskMs + 'ms') },
  { item: 'CDP mouse dispatch cost', detail: 'per drag move under this host load (not app latency)', value: report.bigDrag.perMoveMs },
  { item: 'longest main-thread task', detail: 'during year sequence', value: seq.longestTaskMs },
  { item: 'js heap growth', detail: '20 year steps', valueMB: seq.heapGrowthMB },
  { item: 'js heap after first load', detail: 'run 1', valueMB: r1.heapMB },
  { item: 'two-map heap cost', detail: 'compare open', valueMB: report.compareOpen.heapDeltaMB }
].filter(Boolean);
report.conclusions = [
  'First screen: ' + JSON.stringify(okReady) + ' ms map-ready (2 cold runs, cache disabled), DOMContentLoaded ' + ((r1.navigation || {}).domContentLoadedMs) + ' ms, load event ' + ((r1.navigation || {}).loadEventMs) + ' ms.',
  'Resource weight for one 1500 CE first screen: ' + (r1.resources || {}).count + ' requests / ' + (r1.resources.encodedBytes / 1024).toFixed(0) + ' KiB encoded.',
  'Year stepping 1490->1510 (21 steps of 1 year): key->idle median ' + ((seq.keyToIdleMs || {}).median) + ' ms, max ' + ((seq.keyToIdleMs || {}).max) + ' ms, long tasks ' + seq.longTaskCount + '.',
  'Large drag ~800 px: settled in ' + report.bigDrag.settleMs + ' ms wall (' + report.bigDrag.wallMs + ' ms of CDP mouse moves), camera moved ' + report.bigDrag.camera.deltaLng + ' deg lng.',
  'Blocked geography sources: status text after block = ' + JSON.stringify(report.layerRetry.blockedStatus) + '; after unblock + #terrainRetry recovered=' + report.layerRetry.recovered + ' in ' + report.layerRetry.retryMs + ' ms.',
  'Comparison map: opened in ' + report.compareOpen.openMs + ' ms, ' + report.compareOpen.maps + ' live maps, heap +' + report.compareOpen.heapDeltaMB + ' MB.'
];
report.systemAtEnd = C.systemLoad();
report.wallClockMs = Date.now() - t0;
const file = C.writeJSON(OUT, report);
C.log('wrote', file, 'in', report.wallClockMs, 'ms');
const failed = report.checks.filter(c => !c.pass);
C.log('checks:', report.checks.length - failed.length, '/', report.checks.length, 'passed');
for (const f of failed) C.log('FAIL', f.id, JSON.stringify(f.observed));
process.exitCode = failed.length ? 2 : 0;
