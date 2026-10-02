// P2 network resilience verification for Meridian Atlas (real headless Chrome via CDP).
// Reproduce:
//   node scripts/verification/offline-weaknet.mjs
//   node scripts/verification/offline-weaknet.mjs --only notfound,offline
// Report: docs/verification-3.10/network-resilience.json
//
// Scenarios: throttled first loads (4 Mbps / 1.6 Mbps / 400 kbps), a data source
// answered with HTTP 404 while the app is running, and going offline mid-session.
// The 404 and offline scenarios run in their own fresh browser sessions: after a
// same-renderer reload, subresources come from Chrome's in-memory cache and never
// reach the network, so request interception cannot see them (measured: 0 paused
// requests; a fresh renderer pauses all 59).
import { launch, evaluate, click, key, press, screenshot, sleep } from './browser.mjs';
import * as C from './lib/common.mjs';

const args = C.parseArgs();
const URL_BASE = String(args.url || C.DEFAULT_URL).replace(/\/$/, '');
const PORT = Number(args.port || 9441);
const OUT = String(args.out || 'docs/verification-3.10/network-resilience.json');
const QUICK = !!args.quick;
const ONLY = args.only ? String(args.only).split(',') : null;
const wants = name => !ONLY || ONLY.includes(name);
const START = URL_BASE + '/#year=1500&lang=bi&browse=1&step=10';
const report = C.mkReport('offline-weaknet.mjs', { url: URL_BASE, width: 1400, height: 900 });

const THROTTLE = QUICK ? [] : [
  { name: 'wifi-4mbps', latency: 100, kbps: 4096 },
  { name: 'slow-4g-1.6mbps', latency: 300, kbps: 1638 },
  { name: 'slow-3g-400kbps', latency: 400, kbps: 400 }
];

const ERRBOX = '(() => { const el = document.querySelector("#mapError"); if (!el) return { present: false, hidden: null, text: "", hasRetryButton: false }; return { present: true, hidden: el.hidden, text: el.textContent.trim().slice(0, 160), hasRetryButton: !!el.querySelector("button") }; })()';
const year = async s => Number((await C.hashParams(s)).year);
const statusText = s => evaluate(s, 'document.querySelector("#datasetStatus").textContent');

async function waitOutcome(s, timeout = 90000) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < timeout) {
    last = await evaluate(s, '(() => { const e = document.querySelector("#mapError"); const l = document.querySelector("#loading"); return { hasDom: !!document.body, hasLoading: !!l, error: !!(e && !e.hidden), loading: !!(l && !l.hidden) }; })()');
    if (last.error) return { outcome: 'error-ui', ms: Date.now() - t0 };
    if (last.hasLoading && !last.loading) return { outcome: 'ready', ms: Date.now() - t0 };
    await sleep(1000); // >=1 s: faster evaluate polling can itself miss the settled state
  }
  return { outcome: 'timeout', ms: Date.now() - t0, last };
}

function netRecorder(s) {
  const log = { requests: [], responses: [], failures: [], servedFromCache: [], byId: new Map() };
  s.on(m => {
    if (m.method === 'Network.requestWillBeSent') { log.byId.set(m.params.requestId, m.params.request.url); log.requests.push({ url: m.params.request.url, t: Date.now() }); }
    if (m.method === 'Network.requestServedFromCache') log.servedFromCache.push(log.byId.get(m.params.requestId) || m.params.requestId);
    if (m.method === 'Network.responseReceived') log.responses.push({ url: m.params.response.url, status: m.params.response.status, fromDiskCache: !!m.params.response.fromDiskCache, fromServiceWorker: !!m.params.response.fromServiceWorker, t: Date.now() });
    if (m.method === 'Network.loadingFailed') log.failures.push({ url: log.byId.get(m.params.requestId) || null, error: m.params.errorText, blocked: m.params.blockedReason || null, t: Date.now() });
  });
  return log;
}
const countUrl = (list, re) => list.filter(x => x.url && re.test(x.url)).length;
const newSession = async (name, port, size = { width: 1400, height: 900 }) => {
  const s = await launch({ port: await C.pickPort(port), ...size, profile: '/tmp/atlas-net-' + name + '-' + Date.now() });
  await C.installInstrument(s);
  return s;
};

// ---------------------------------------------------------------------------
// 1 + 2. Baseline and throttled first loads (one session, cache warmed by design).
// ---------------------------------------------------------------------------
if (wants('baseline') || wants('throttle')) {
  const s = await newSession('throttle', PORT);
  const net = netRecorder(s);
  try {
    const t0 = Date.now();
    await C.navigate(s, START);
    const baseReady = await waitOutcome(s, 90000);
    report.baseline = {
      ms: Date.now() - t0, outcome: baseReady.outcome, errorBox: await evaluate(s, ERRBOX), loading: await evaluate(s, '(() => { const l = document.querySelector("#loading"); return { hidden: l ? l.hidden : null, text: l ? l.textContent.slice(0, 60) : null }; })()'),
      datasetStatus: await statusText(s), year: await year(s), onLine: await evaluate(s, 'navigator.onLine'),
      requests: net.requests.length, transferBytes: await evaluate(s, 'performance.getEntriesByType("resource").reduce((a, r) => a + (r.encodedBodySize || 0), 0)'),
      servedFromCache: net.servedFromCache.length
    };
    report.checks.push(C.checkFn('net.baseline-ready', 'Baseline first load reaches map-ready without an error surface', v => v.outcome === 'ready' && v.errorBox.hidden === true && v.year === 1500, { outcome: baseReady.outcome, ms: report.baseline.ms, errorBox: report.baseline.errorBox, year: report.baseline.year }));

    report.throttled = [];
    for (const p of (wants('throttle') ? THROTTLE : [])) {
      C.log('throttle', p.name);
      await s.send('Network.emulateNetworkConditions', { offline: false, latency: p.latency, downloadThroughput: Math.round(p.kbps * 1024 / 8), uploadThroughput: Math.round(p.kbps * 512 / 8), connectionType: 'cellular4g' });
      net.requests.length = 0; net.responses.length = 0; net.failures.length = 0; net.servedFromCache.length = 0;
      const start = Date.now();
      await C.navigate(s, START);
      const outcome = await waitOutcome(s, 150000);
      const entry = {
        profile: p.name, latencyMs: p.latency, kbps: p.kbps, outcome: outcome.outcome, elapsedMs: Date.now() - start,
        errorBox: await evaluate(s, ERRBOX), year: await year(s), datasetStatus: await statusText(s),
        requests: net.requests.length, servedFromCache: net.servedFromCache.length,
        failures: net.failures.slice(0, 8), aborted: net.failures.filter(f => /ABORTED|TIMED_OUT/.test(f.error)).length
      };
      await s.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1, connectionType: 'none' });
      await sleep(2000); // let the un-throttled conditions apply before re-loading
      const recStart = Date.now();
      let recNav = { skipped: true };
      if (entry.errorBox.hasRetryButton) await click(s, '#mapError button');
      else {
        recNav = await C.navigate(s, START, { timeout: 45000 });
        if (!recNav.committed) recNav = { ...(await C.hardReload(s, { timeout: 45000 })), retriedBecauseNavigationDidNotCommit: true };
      }
      const rec = await waitOutcome(s, 150000);
      entry.recovery = { outcome: rec.outcome, ms: Date.now() - recStart, nav: recNav, errorBox: await evaluate(s, ERRBOX), year: await year(s) };
      report.throttled.push(entry);
      await screenshot(s, C.screenshotPath('network-' + p.name + '.png'));
    }
    if (report.throttled.length) {
      report.checks.push(C.checkFn('net.throttled-outcomes-recorded', 'Every throttled first load either reaches ready or shows a retry surface (no endless spinner)', v => v.every(x => x.outcome === 'ready' || x.outcome === 'error-ui'), report.throttled.map(x => ({ profile: x.profile, outcome: x.outcome, ms: x.elapsedMs, error: x.errorBox.text.slice(0, 60), failures: x.failures.length }))));
      report.checks.push(C.checkFn('net.throttled-recovers', 'After the throttle is removed the app reaches map-ready again', v => v.every(x => x.recovery === 'ready'), report.throttled.map(x => ({ profile: x.profile, recovery: x.recovery.outcome, ms: x.recovery.ms }))));
    }
  } catch (e) { report.throttleFatal = String((e && e.stack) || e); }
  finally { await s.close(); }
}

// ---------------------------------------------------------------------------
// 3. Data source answered with HTTP 404 (fresh session so interception works).
// ---------------------------------------------------------------------------
if (wants('notfound')) {
  C.log('404 interception (fresh session)');
  const s = await newSession('404', PORT + 20);
  const net = netRecorder(s);
  // 1500 is a native-bootstrap year: public/data/fast/year-1500.json.gz is no longer
  // requested (native geometry covers it). A non-bootstrap year pulls its overview
  // geometry from data/fast/overview-NNN.json.gz, which is the source we 404.
  const NOTFOUND_YEAR = 1450;
  const NOTFOUND_URL = URL_BASE + '/#year=' + NOTFOUND_YEAR + '&lang=bi&browse=1&step=10';
  let hits404 = 0; let pausedTotal = 0; const pausedSample = [];
  try {
    s.on(m => {
      if (m.method !== 'Fetch.requestPaused') return;
      pausedTotal++;
      const url = m.params.request.url;
      if (pausedSample.length < 12) pausedSample.push(url.replace(URL_BASE, ''));
      if (/data\/fast\/overview-\d+\.json\.gz/.test(url)) {
        hits404++;
        s.send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 404, responsePhrase: 'Not Found', responseHeaders: [{ name: 'Content-Type', value: 'text/plain' }], body: Buffer.from('verification: simulated 404').toString('base64') }).catch(() => {});
      } else s.send('Fetch.continueRequest', { requestId: m.params.requestId }).catch(() => {});
    });
    // CDP glob patterns do not match across '/' separators here (measured: the specific
    // pattern paused 0 requests while '*' paused 59), so intercept everything and filter
    // by URL in JavaScript.
    await s.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
    await C.navigate(s, NOTFOUND_URL);
    const notFoundOutcome = await waitOutcome(s, 90000);
    const notFoundError = await evaluate(s, ERRBOX);
    const notFoundYear = await year(s);
    const status404 = net.responses.filter(r => /overview-\d+/.test(r.url)).map(r => r.status);
    const requested404 = countUrl(net.requests, /overview-\d+/);
    const interceptionWorked = hits404 > 0;
    await screenshot(s, C.screenshotPath('network-404-error.png'));
    // Retry while the source is still 404: must re-request, must not replay a cached rejection.
    const requestsBeforeRetry = countUrl(net.requests, /overview-\d+/);
    if (notFoundError.hasRetryButton) await click(s, '#mapError button');
    await sleep(3000);
    const afterFailedRetry = { errorBox: await evaluate(s, ERRBOX), year: await year(s) };
    const requestsAfterRetry = countUrl(net.requests, /overview-\d+/);
    // Let the real file through and retry again.
    await s.send('Fetch.disable');
    const recStart = Date.now();
    if ((await evaluate(s, ERRBOX)).hasRetryButton) await click(s, '#mapError button');
    const notFoundRecovery = await waitOutcome(s, 90000);
    const recoveredYear = await year(s);
    const recoveredStatus = await statusText(s);
    await evaluate(s, '(() => { const el = document.querySelector("#yearInput"); el.focus(); el.value = "1500"; return true; })()');
    await press(s, 'Enter', 'Enter');
    const y1510 = await C.waitYearSettled(s, 1500, 60000);
    await evaluate(s, '(() => { const el = document.querySelector("#yearInput"); el.focus(); el.value = "1450"; return true; })()');
    await press(s, 'Enter', 'Enter');
    const y1500 = await C.waitYearSettled(s, 1450, 60000);
    report.notFound = {
      simulatedUrl: 'data/fast/overview-NNN.json.gz (year ' + NOTFOUND_YEAR + ')', year: NOTFOUND_YEAR, httpHits: hits404, interceptionWorked, pausedTotal, pausedSample,
      initial: { outcome: notFoundOutcome.outcome, ms: notFoundOutcome.ms, errorBox: notFoundError, year: notFoundYear, responseStatuses: status404 },
      retryWhile404: { requestsBeforeRetry, requestsAfterRetry, errorBox: afterFailedRetry.errorBox, year: afterFailedRetry.year },
      recovery: { outcome: notFoundRecovery.outcome, ms: Date.now() - recStart, year: recoveredYear, datasetStatus: recoveredStatus, errorBox: await evaluate(s, ERRBOX) },
      yearSwitch: { to1500: y1510.settled, backTo1450: y1500.settled, finalYear: await year(s), finalErrorBox: await evaluate(s, ERRBOX) }
    };
    if (!interceptionWorked) report.limitations.push('The 404 simulation never intercepted a request in this run (hits404 = 0); the 404 assertions are reported as not measured rather than pass/fail.');
    report.checks.push(C.checkFn('net.404-surface', 'A 404 data source shows a retryable error surface naming the year', v => interceptionWorked ? (v.outcome === 'error-ui' && v.errorBox.hasRetryButton === true && /1450/.test(v.errorBox.text) && v.statuses.includes(404)) : null, { outcome: notFoundOutcome.outcome, errorBox: notFoundError, statuses: status404, requested: requested404, pausedTotal, pausedSample }));
    report.checks.push(C.checkFn('net.404-no-bad-cache', 'Retry while still 404 re-requests the source instead of replaying a cached rejection', v => interceptionWorked ? (v.after > v.before && v.stillError === true) : null, { before: requestsBeforeRetry, after: requestsAfterRetry, stillError: afterFailedRetry.errorBox.hidden === false }));
    report.checks.push(C.checkFn('net.404-recovers', 'Once the source returns 200 the retry loads the year and clears the error', v => v.outcome === 'ready' && v.year === NOTFOUND_YEAR && v.errorBox.hidden === true && /政体/.test(v.datasetStatus), { outcome: notFoundRecovery.outcome, year: recoveredYear, datasetStatus: recoveredStatus, errorBox: report.notFound.recovery.errorBox }));
    report.checks.push(C.checkFn('net.404-no-stale-state', 'After recovery the year can be switched away and back with no stale error', v => v.to1500 === true && v.backTo1450 === true && v.finalYear === NOTFOUND_YEAR && v.finalErrorBox.hidden === true, report.notFound.yearSwitch));
  } catch (e) { report.notFound = { ...(report.notFound || {}), fatal: String((e && e.stack) || e) }; }
  finally { await s.close(); }
}

// ---------------------------------------------------------------------------
// 4. Going offline mid-session (fresh session).
// ---------------------------------------------------------------------------
if (wants('offline')) {
  C.log('offline mid-session');
  const s = await newSession('offline', PORT + 30);
  const net = netRecorder(s);
  try {
    await C.navigate(s, START);
    await waitOutcome(s, 90000);
    await C.waitYearSettled(s, 1500, 60000);
    await s.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0, connectionType: 'none' });
    const offline0 = { onLine: await evaluate(s, 'navigator.onLine'), year: await year(s), errorBox: await evaluate(s, ERRBOX) };
    net.requests.length = 0; net.failures.length = 0;
    const offStart = Date.now();
    await evaluate(s, '(() => { const el = document.querySelector("#yearInput"); el.focus(); el.value = "1600"; return true; })()');
    await press(s, 'Enter', 'Enter');
    const offOutcome = await waitOutcome(s, 60000);
    const offlineError = await evaluate(s, ERRBOX);
    const offlineYear = await year(s);
    const offlineOnLine = await evaluate(s, 'navigator.onLine');
    const offlineFailures = net.failures.slice(0, 6);
    await screenshot(s, C.screenshotPath('network-offline-error.png'));
    if (offlineError.hasRetryButton) await click(s, '#mapError button');
    await sleep(3000);
    const retryWhileOffline = { errorBox: await evaluate(s, ERRBOX), year: await year(s) };
    await s.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1, connectionType: 'none' });
    const backStart = Date.now();
    if ((await evaluate(s, ERRBOX)).hasRetryButton) await click(s, '#mapError button');
    const backOutcome = await waitOutcome(s, 90000);
    const backYear = await year(s);
    const backErrorBox = await evaluate(s, ERRBOX);
    report.offline = {
      duringOffline: offline0,
      switchYear: { outcome: offOutcome.outcome, ms: Date.now() - offStart, errorBox: offlineError, year: offlineYear, failures: offlineFailures, onLine: offlineOnLine },
      retryWhileOffline,
      recoveryAfterOnline: { outcome: backOutcome.outcome, ms: Date.now() - backStart, year: backYear, errorBox: backErrorBox, datasetStatus: await statusText(s) },
      serviceWorker: await evaluate(s, 'navigator.serviceWorker ? (navigator.serviceWorker.controller ? "controlled" : "registered-none") : "unsupported"'),
      cacheDisabledByDriver: true
    };
    report.checks.push(C.checkFn('net.offline-keeps-map', 'Going offline while switching year keeps the previous map and shows a retryable error', v => v.outcome === 'error-ui' && v.errorBox.hasRetryButton === true && v.year === 1500 && v.onLine === false, { outcome: offOutcome.outcome, year: offlineYear, onLine: offlineOnLine, errorBox: offlineError, failures: offlineFailures.map(f => f.error) }));
    report.checks.push(C.checkFn('net.offline-retry-honest', 'Retrying while offline does not fake success', v => v.errorBox.hidden === false && v.year === 1500, retryWhileOffline));
    report.checks.push(C.checkFn('net.online-recovers', 'After the connection returns, retry loads the requested year', v => v.outcome === 'ready' && v.year === 1600 && v.errorBox.hidden === true, { outcome: backOutcome.outcome, year: backYear, ms: Date.now() - backStart, errorBox: backErrorBox }));
    await screenshot(s, C.screenshotPath('network-recovered.png'));
  } catch (e) { report.offlineFatal = String((e && e.stack) || e); }
  finally { await s.close(); }
}

report.limitations = (report.limitations || []).concat([
  'Throttling uses Network.emulateNetworkConditions (latency + throughput); it does not reproduce packet loss, DNS failures or flaky connections.',
  'Offline cold start (reload while offline) is not meaningful with the driver cache disabled and no service worker: the app ships no offline shell.',
  'CDP Fetch interception answers the 404 locally; only the status code is simulated.',
  'There is no automatic retry/backoff to assert: the app exposes manual retry only.',
  'Chrome serves repeated loads of the same document from its in-memory resource cache, which request interception cannot see. The 404 scenario therefore uses a fresh browser session (measured: a reused renderer paused 0 requests, a fresh one 59).'
]);
report.conclusions = [
  report.baseline ? 'Baseline first load: ' + report.baseline.outcome + ' in ' + report.baseline.ms + ' ms, ' + report.baseline.requests + ' requests, ' + (report.baseline.transferBytes / 1024).toFixed(0) + ' KiB encoded.' : 'Baseline skipped.',
  ...(report.throttled || []).map(t => 'Throttled ' + t.profile + ' (' + t.kbps + ' kbps, ' + t.latencyMs + ' ms): ' + t.outcome + ' after ' + t.elapsedMs + ' ms; failed requests ' + t.failures.length + '; recovery ' + t.recovery.outcome + ' in ' + t.recovery.ms + ' ms.'),
  report.notFound && !report.notFound.fatal ? 'Simulated 404 on ' + report.notFound.simulatedUrl + ' (intercepted ' + report.notFound.httpHits + ' of ' + report.notFound.pausedTotal + ' paused requests)' + ': interception hits ' + report.notFound.httpHits + ', error surface after ' + report.notFound.initial.ms + ' ms (' + report.notFound.initial.responseStatuses.join(',') + '), retry re-requested the file (' + report.notFound.retryWhile404.requestsBeforeRetry + ' -> ' + report.notFound.retryWhile404.requestsAfterRetry + ' requests), recovery ' + report.notFound.recovery.outcome + ' in ' + report.notFound.recovery.ms + ' ms.' : '404 scenario not completed: ' + JSON.stringify((report.notFound || {}).fatal || 'skipped'),
  report.offline ? 'Offline year switch: error surface after ' + report.offline.switchYear.ms + ' ms with ' + report.offline.switchYear.failures.length + ' failed requests (sample error: ' + ((report.offline.switchYear.failures[0] || {}).error || '?') + '); recovery after going online in ' + report.offline.recoveryAfterOnline.ms + ' ms.' : 'Offline scenario skipped.'
];
const file = C.writeJSON(OUT, report);
const failed = report.checks.filter(c => c.pass !== true);
C.log('wrote', file);
C.log('checks:', report.checks.length - failed.length, '/', report.checks.length);
for (const c of report.checks) C.log(c.pass === true ? 'PASS' : (c.pass === false ? 'FAIL' : 'NONE'), c.id);
process.exitCode = failed.some(f => f.pass === false) || report.throttleFatal || report.offlineFatal || (report.notFound && report.notFound.fatal) ? 2 : 0;
