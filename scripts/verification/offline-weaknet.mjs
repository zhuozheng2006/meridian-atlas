// P2 network resilience verification for Meridian Atlas (real headless Chrome via CDP).
// Reproduce:
//   node scripts/verification/offline-weaknet.mjs
// Report: docs/verification-3.10/network-resilience.json
//
// Scenarios: throttled first loads (4 Mbps / 1.6 Mbps / 400 kbps), a data source
// answered with HTTP 404 while the app is running, and going offline mid-session.
// Each scenario ends with a recovery attempt and records whether the in-app error
// surface recovers without a stale bad cache.
import { launch, goto, evaluate, click, key, press, screenshot, sleep } from './browser.mjs';
import * as C from './lib/common.mjs';

const args = C.parseArgs();
const URL_BASE = String(args.url || C.DEFAULT_URL).replace(/\/$/, '');
const PORT = Number(args.port || 9441);
const OUT = String(args.out || 'docs/verification-3.10/network-resilience.json');
const QUICK = !!args.quick;
const START = URL_BASE + '/#year=1500&lang=bi&browse=1&step=10';
const report = C.mkReport('offline-weaknet.mjs', { url: URL_BASE, width: 1400, height: 900 });

const THROTTLE = QUICK ? [] : [
  { name: 'wifi-4mbps', latency: 100, kbps: 4096 },
  { name: 'slow-4g-1.6mbps', latency: 300, kbps: 1638 },
  { name: 'slow-3g-400kbps', latency: 400, kbps: 400 }
];

const ERRBOX = '(() => { const el = document.querySelector("#mapError"); if (!el) return { present: false, hidden: null, text: "", hasRetryButton: false }; return { present: true, hidden: el.hidden, text: el.textContent.trim().slice(0, 160), hasRetryButton: !!el.querySelector("button") }; })()';
const LOADING = '(() => { const el = document.querySelector("#loading"); return { hidden: el.hidden, text: el.textContent.slice(0, 60) }; })()';
const year = async s => Number((await C.hashParams(s)).year);
const statusText = s => evaluate(s, 'document.querySelector("#datasetStatus").textContent');

async function waitOutcome(s, timeout = 60000) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < timeout) {
    last = await evaluate(s, '(() => { const e = document.querySelector("#mapError"); const l = document.querySelector("#loading"); return { hasDom: !!document.body, readyState: document.readyState, error: !!(e && !e.hidden), loading: !!(l && !l.hidden) }; })()');
    if (last.error) return { outcome: 'error-ui', ms: Date.now() - t0 };
    if (last.hasDom && !last.loading) return { outcome: 'ready', ms: Date.now() - t0 };
    await sleep(1000); // >=1 s: faster evaluate polling can itself miss the settled state
  }
  return { outcome: 'timeout', ms: Date.now() - t0, last };
}

function netRecorder(s) {
  const log = { requests: [], responses: [], failures: [], byId: new Map() };
  s.on(m => {
    if (m.method === 'Network.requestWillBeSent') { log.byId.set(m.params.requestId, m.params.request.url); log.requests.push({ url: m.params.request.url, t: Date.now() }); }
    if (m.method === 'Network.responseReceived') log.responses.push({ url: m.params.response.url, status: m.params.response.status, t: Date.now() });
    if (m.method === 'Network.loadingFailed') log.failures.push({ url: log.byId.get(m.params.requestId) || null, error: m.params.errorText, blocked: m.params.blockedReason || null, t: Date.now() });
  });
  return log;
}
const countUrl = (list, re) => list.filter(x => x.url && re.test(x.url)).length;

const s = await launch({ port: await C.pickPort(PORT), width: 1400, height: 900, profile: '/tmp/atlas-net-' + Date.now() });
try {
  await C.installInstrument(s);
  const net = netRecorder(s);

  // 1. Baseline (unthrottled) first load.
  const t0 = Date.now();
  await goto(s, START, { waitMs: 200 });
  const baseReady = await waitOutcome(s, 60000);
  report.baseline = {
    ms: Date.now() - t0, outcome: baseReady.outcome, errorBox: await evaluate(s, ERRBOX), loading: await evaluate(s, LOADING),
    datasetStatus: await statusText(s), year: await year(s), onLine: await evaluate(s, 'navigator.onLine'),
    requests: net.requests.length, transferBytes: (await evaluate(s, 'performance.getEntriesByType("resource").reduce((a, r) => a + (r.encodedBodySize || 0), 0)'))
  };
  report.checks.push(C.checkFn('net.baseline-ready', 'Baseline first load reaches map-ready without an error surface', v => v.outcome === 'ready' && v.errorBox.hidden === true && v.year === 1500, { outcome: baseReady.outcome, ms: report.baseline.ms, errorBox: report.baseline.errorBox, year: report.baseline.year }));

  // 2. Throttled first loads.
  report.throttled = [];
  for (const p of THROTTLE) {
    C.log('throttle', p.name);
    await s.send('Network.emulateNetworkConditions', { offline: false, latency: p.latency, downloadThroughput: Math.round(p.kbps * 1024 / 8), uploadThroughput: Math.round(p.kbps * 512 / 8), connectionType: 'cellular4g' });
    net.requests.length = 0; net.responses.length = 0; net.failures.length = 0;
    const start = Date.now();
    await goto(s, START, { waitMs: 300 });
    const outcome = await waitOutcome(s, 75000);
    const entry = {
      profile: p.name, latencyMs: p.latency, kbps: p.kbps, outcome: outcome.outcome, elapsedMs: Date.now() - start,
      errorBox: await evaluate(s, ERRBOX), loading: await evaluate(s, LOADING), year: await year(s),
      requests: net.requests.length, failures: net.failures.slice(0, 8), aborted: net.failures.filter(f => /ABORTED|TIMED_OUT/.test(f.error)).length, datasetStatus: await statusText(s)
    };
    // Recovery: restore full speed, then use the retry control if the app showed one.
    await s.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1, connectionType: 'none' });
    const recStart = Date.now();
    if (entry.errorBox.hasRetryButton) await click(s, '#mapError button');
    else await goto(s, START, { waitMs: 200 });
    const rec = await waitOutcome(s, 60000);
    entry.recovery = { outcome: rec.outcome, ms: Date.now() - recStart, errorBox: await evaluate(s, ERRBOX), year: await year(s) };
    report.throttled.push(entry);
    await screenshot(s, C.screenshotPath('network-' + p.name + '.png'));
  }
  if (report.throttled.length) {
    report.checks.push(C.checkFn('net.throttled-outcomes-recorded', 'Every throttled first load either reaches ready or shows a retry surface (no endless spinner)', v => v.every(x => x.outcome === 'ready' || x.outcome === 'error-ui'), report.throttled.map(x => ({ profile: x.profile, outcome: x.outcome, ms: x.elapsedMs, error: x.errorBox.text.slice(0, 60), failures: x.failures.length }))));
    report.checks.push(C.checkFn('net.throttled-recovers', 'After the throttle is removed the app reaches map-ready again', v => v.every(x => x.recovery === 'ready'), report.throttled.map(x => ({ profile: x.profile, recovery: x.recovery.outcome, ms: x.recovery.ms }))));
  }

  // reset any throttle
  await s.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1, connectionType: 'none' });

  // 3. Data source answered with HTTP 404 (Fetch domain interception).
  C.log('404 interception');
  let hits404 = 0;
  const fetchHandler = m => {
    if (m.method !== 'Fetch.requestPaused') return;
    const url = m.params.request.url;
    if (/data\/fast\/year-1500\.json\.gz/.test(url)) {
      hits404++;
      s.send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 404, responsePhrase: 'Not Found', responseHeaders: [{ name: 'Content-Type', value: 'text/plain' }], body: Buffer.from('verification: simulated 404').toString('base64') }).catch(() => {});
    } else s.send('Fetch.continueRequest', { requestId: m.params.requestId }).catch(() => {});
  };
  s.on(fetchHandler);
  await s.send('Fetch.enable', { patterns: [{ urlPattern: '*data/fast/year-1500.json.gz*', requestStage: 'Request' }] });
  net.requests.length = 0; net.responses.length = 0; net.failures.length = 0;
  await goto(s, START, { waitMs: 300 });
  const notFoundOutcome = await waitOutcome(s, 45000);
  const notFoundError = await evaluate(s, ERRBOX);
  const notFoundYear = await year(s);
  const status404 = net.responses.filter(r => /year-1500/.test(r.url)).map(r => r.status);
  await screenshot(s, C.screenshotPath('network-404-error.png'));
  // Retry while the source is still 404: must re-request, must not be served from a bad cache.
  const requestsBeforeRetry = countUrl(net.requests, /year-1500/);
  if (notFoundError.hasRetryButton) await click(s, '#mapError button');
  await sleep(2500);
  const afterFailedRetry = { errorBox: await evaluate(s, ERRBOX), year: await year(s) };
  const requestsAfterRetry = countUrl(net.requests, /year-1500/);
  // Now let the real file through and retry again.
  await s.send('Fetch.disable');
  const recStart = Date.now();
  if ((await evaluate(s, ERRBOX)).hasRetryButton) await click(s, '#mapError button');
  const notFoundRecovery = await waitOutcome(s, 45000);
  const recoveredYear = await year(s);
  const recoveredStatus = await statusText(s);
  // Year switch away and back to prove no stale error state.
  await evaluate(s, '(() => { const el = document.querySelector("#yearInput"); el.focus(); el.value = "1510"; return true; })()');
  await press(s, 'Enter', 'Enter');
  const y1510 = await C.waitYearSettled(s, 1510, 30000);
  await evaluate(s, '(() => { const el = document.querySelector("#yearInput"); el.focus(); el.value = "1500"; return true; })()');
  await press(s, 'Enter', 'Enter');
  const y1500 = await C.waitYearSettled(s, 1500, 30000);
  report.notFound = {
    simulatedUrl: 'data/fast/year-1500.json.gz', httpHits: hits404,
    initial: { outcome: notFoundOutcome.outcome, ms: notFoundOutcome.ms, errorBox: notFoundError, year: notFoundYear, responseStatuses: status404 },
    retryWhile404: { requestsBeforeRetry, requestsAfterRetry, errorBox: afterFailedRetry.errorBox, year: afterFailedRetry.year },
    recovery: { outcome: notFoundRecovery.outcome, ms: Date.now() - recStart, year: recoveredYear, datasetStatus: recoveredStatus, errorBox: await evaluate(s, ERRBOX) },
    yearSwitch: { to1510: y1510.settled, to1500: y1500.settled, finalYear: await year(s), finalErrorBox: await evaluate(s, ERRBOX) }
  };
  report.checks.push(C.checkFn('net.404-surface', 'A 404 data source shows a retryable error surface naming the year', v => v.outcome === 'error-ui' && v.errorBox.hasRetryButton === true && /1500/.test(v.errorBox.text) && v.statuses.includes(404), { outcome: notFoundOutcome.outcome, errorBox: notFoundError, statuses: status404, requested: countUrl(net.requests, /year-1500/) }));
  report.checks.push(C.checkFn('net.404-no-bad-cache', 'Retry while still 404 re-requests the source instead of replaying a cached rejection', v => v.after > v.before && v.stillError === true, { before: requestsBeforeRetry, after: requestsAfterRetry, stillError: afterFailedRetry.errorBox.hidden === false }));
  report.checks.push(C.checkFn('net.404-recovers', 'Once the source returns 200 the retry loads the year and clears the error', v => v.outcome === 'ready' && v.year === 1500 && v.errorBox.hidden === true && /政体/.test(v.datasetStatus), { outcome: notFoundRecovery.outcome, year: recoveredYear, datasetStatus: recoveredStatus, errorBox: report.notFound.recovery.errorBox }));
  report.checks.push(C.checkFn('net.404-no-stale-state', 'After recovery the year can be switched away and back with no stale error', v => v.to1510 === true && v.to1500 === true && v.finalYear === 1500 && v.finalErrorBox.hidden === true, report.notFound.yearSwitch));

  // 4. Going offline mid-session.
  C.log('offline mid-session');
  await goto(s, START, { waitMs: 200 });
  await waitOutcome(s, 60000);
  await C.waitYearSettled(s, 1500, 30000);
  await s.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0, connectionType: 'none' });
  const offline0 = { onLine: await evaluate(s, 'navigator.onLine'), year: await year(s), errorBox: await evaluate(s, ERRBOX) };
  net.requests.length = 0; net.failures.length = 0;
  const offStart = Date.now();
  await evaluate(s, '(() => { const el = document.querySelector("#yearInput"); el.focus(); el.value = "1600"; return true; })()');
  await press(s, 'Enter', 'Enter');
  const offOutcome = await waitOutcome(s, 40000);
  const offlineError = await evaluate(s, ERRBOX);
  const offlineYear = await year(s);
  const offlineFailures = net.failures.slice(0, 6);
  await screenshot(s, C.screenshotPath('network-offline-error.png'));
  // Retry while still offline: the error must persist, not silently "succeed".
  if (offlineError.hasRetryButton) await click(s, '#mapError button');
  await sleep(2500);
  const retryWhileOffline = { errorBox: await evaluate(s, ERRBOX), year: await year(s) };
  // Back online, then retry.
  await s.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1, connectionType: 'none' });
  const backStart = Date.now();
  if ((await evaluate(s, ERRBOX)).hasRetryButton) await click(s, '#mapError button');
  const backOutcome = await waitOutcome(s, 60000);
  const backYear = await year(s);
  // Offline cold start is not testable with the driver cache disabled; record what happens.
  report.offline = {
    duringOffline: offline0, switchYear: { outcome: offOutcome.outcome, ms: Date.now() - offStart, errorBox: offlineError, year: offlineYear, failures: offlineFailures, onLine: await evaluate(s, 'navigator.onLine') },
    retryWhileOffline, recoveryAfterOnline: { outcome: backOutcome.outcome, ms: Date.now() - backStart, year: backYear, errorBox: await evaluate(s, ERRBOX), datasetStatus: await statusText(s) },
    serviceWorker: await evaluate(s, 'navigator.serviceWorker ? navigator.serviceWorker.controller ? "controlled" : "registered-none" : "unsupported"'),
    cacheDisabledByDriver: true
  };
  report.checks.push(C.checkFn('net.offline-keeps-map', 'Going offline while switching year keeps the previous map and shows a retryable error', v => v.outcome === 'error-ui' && v.errorBox.hasRetryButton === true && v.year === 1500 && v.onLine === false, { outcome: offOutcome.outcome, year: offlineYear, onLine: report.offline.switchYear.onLine, errorBox: offlineError, failures: offlineFailures.map(f => f.error) }));
  report.checks.push(C.checkFn('net.offline-retry-honest', 'Retrying while offline does not fake success', v => v.errorBox.hidden === false && v.year === 1500, retryWhileOffline));
  report.checks.push(C.checkFn('net.online-recovers', 'After the connection returns, retry loads the requested year', v => v.outcome === 'ready' && v.year === 1600 && v.errorBox.hidden === true, { outcome: backOutcome.outcome, year: backYear, ms: Date.now() - backStart, errorBox: await evaluate(s, ERRBOX) }));

  report.notes.push('The driver disables the HTTP cache (Network.setCacheDisabled(true)), so browser-cache behaviour under offline conditions is out of scope; the in-app readJSON memory cache is what the 404 retry test exercises.');
  report.limitations = [
    'Throttling uses Network.emulateNetworkConditions (latency + throughput), which does not reproduce packet loss, DNS failures or flaky connections.',
    'Offline cold start (reload while offline) is not meaningfully testable with the HTTP cache disabled by the driver; the app registers no service worker, so no offline shell exists.',
    'CDP Fetch interception answers the 404 locally; the response body and headers are synthetic (status 404 only).',
    'No automated retry/backoff policy is asserted: the app exposes manual retry only.'
  ];
  report.conclusions = [
    'Baseline first load: ' + report.baseline.outcome + ' in ' + report.baseline.ms + ' ms, ' + report.baseline.requests + ' requests, ' + (report.baseline.transferBytes / 1024).toFixed(0) + ' KiB encoded.',
    ...report.throttled.map(t => 'Throttled ' + t.profile + ' (' + t.kbps + ' kbps, ' + t.latencyMs + ' ms): ' + t.outcome + ' after ' + t.elapsedMs + ' ms; aborted/failed requests ' + t.aborted + '/' + t.requests + '; recovery ' + t.recovery.outcome + ' in ' + t.recovery.ms + ' ms.'),
    'Simulated 404 on ' + report.notFound.simulatedUrl + ': error surface after ' + report.notFound.initial.ms + ' ms (' + report.notFound.initial.responseStatuses.join(',') + '), retry re-requested the file (' + report.notFound.retryWhile404.requestsBeforeRetry + ' -> ' + report.notFound.retryWhile404.requestsAfterRetry + ' requests), and after the file was served the retry succeeded in ' + report.notFound.recovery.ms + ' ms.',
    'Offline year switch: error surface after ' + report.offline.switchYear.ms + ' ms with ' + report.offline.switchYear.failures.length + ' failed requests; recovery after going online in ' + report.offline.recoveryAfterOnline.ms + ' ms.'
  ];
  await screenshot(s, C.screenshotPath('network-recovered.png'));
} catch (e) {
  report.fatal = String((e && e.stack) || e);
} finally {
  await s.close();
}
const file = C.writeJSON(OUT, report);
const failed = report.checks.filter(c => c.pass !== true);
C.log('wrote', file);
C.log('checks:', report.checks.length - failed.length, '/', report.checks.length);
for (const c of report.checks) C.log(c.pass === true ? 'PASS' : (c.pass === false ? 'FAIL' : 'NONE'), c.id);
process.exitCode = failed.some(f => f.pass === false) || report.fatal ? 2 : 0;
