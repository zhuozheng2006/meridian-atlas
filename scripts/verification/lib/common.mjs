// Shared helpers for the reproducible verification scripts in scripts/verification/.
// Node >=20 built-ins only (plus ../browser.mjs). No npm dependencies.
//
// Every report produced by these scripts follows the same contract:
//   meta.provenance - git revision + sha256 of the product files under test
//   checks[]        - each assertion carries expected/observed/pass; pass is never assumed
//   limitations[]   - what the harness could NOT measure (never silently reported as pass)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { evaluate, waitFor, sleep } from '../browser.mjs';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..', '..');
export const PUBLIC = path.join(ROOT, 'public');
export const DOCS = path.join(ROOT, 'docs', 'verification-3.10');
export const SHOTS = path.join(DOCS, 'shots');
export const DEFAULT_URL = process.env.ATLAS_URL || 'http://127.0.0.1:8767';

export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const next = argv[i + 1]; const v = next !== undefined && !next.startsWith('--') ? argv[++i] : true; out[k] = v; }
    else out._.push(a);
  }
  return out;
}

export const nowIso = () => new Date().toISOString();
export const round = (n, d = 1) => (Number.isFinite(n) ? Number(n.toFixed(d)) : null);
export const MB = n => (Number.isFinite(n) ? Number((n / 1048576).toFixed(2)) : null);
export const log = (...a) => console.log('[verify]', ...a);

// Host load at measurement time: this machine may run several verification
// browsers in parallel, which is recorded so numbers stay auditable.
export function systemLoad() {
  let chrome = null;
  try { chrome = execFileSync('bash', ['-lc', 'ps ax | grep -c "[C]hrome" || true'], { encoding: 'utf8' }).trim(); } catch (e) { chrome = null; }
  return { loadavg: os.loadavg().map(v => Number(v.toFixed(2))), chromeProcesses: chrome === null ? null : Number(chrome), cpus: os.cpus().length };
}

export function stats(list) {
  const xs = list.filter(Number.isFinite).sort((a, b) => a - b);
  if (!xs.length) return { n: 0 };
  const pick = q => xs[Math.min(xs.length - 1, Math.max(0, Math.ceil(q * xs.length) - 1))];
  return { n: xs.length, min: round(xs[0]), median: round(pick(0.5)), p95: round(pick(0.95)), max: round(xs[xs.length - 1]), mean: round(xs.reduce((a, b) => a + b, 0) / xs.length) };
}

export function sha256(file) {
  try { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16); } catch (e) { return null; }
}

export function provenance() {
  const files = ['public/index.html', 'public/app.js', 'public/map-engine.js', 'public/timeline-controls.js', 'public/view-state.js', 'public/style.css', 'public/product.css', 'public/cartography.css', 'public/boundary-controller.js', 'public/regional-boundaries.js', 'public/geography.js'];
  let head = null; let dirty = null;
  try { head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch (e) { head = null; }
  try { dirty = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean); } catch (e) { dirty = null; }
  let assets = null;
  try { assets = (fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8').match(/[?]v=([0-9a-z.\-]+)/) || [])[1] || null; } catch (e) { assets = null; }
  return { gitHead: head, dirtyPaths: dirty, assetVersion: assets, files: Object.fromEntries(files.map(f => [f, sha256(path.join(ROOT, f))])), node: process.version, platform: process.platform, driverNote: 'browser.mjs sets Network.setCacheDisabled(true): HTTP cache is never used.' };
}

export function ensureDirs() { for (const d of arguments) fs.mkdirSync(d, { recursive: true }); }

// Chrome releases the CDP port a moment after SIGKILL. Launching the next session
// on a port that is still answering makes the driver attach to the dying browser,
// which shows up as a page that never becomes ready. Always pick a free port.
export async function portFree(port) {
  try { const r = await fetch('http://127.0.0.1:' + port + '/json/version'); return !r.ok; } catch (e) { return true; }
}
export async function pickPort(base, tries = 12) {
  for (let i = 0; i < tries; i++) {
    const port = base + i;
    if (await portFree(port)) return port;
    await sleep(300);
  }
  return base + tries;
}

export function writeJSON(rel, data) {
  const file = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
  ensureDirs(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  return file;
}

export function checkFn(id, description, predicate, observed, extra) {
  let pass = false;
  try { pass = !!predicate(observed); } catch (e) { pass = false; }
  return { id, description, expected: predicate.toString().replace(/\s+/g, ' ').slice(0, 200), observed, pass, ...(extra || {}) };
}

export function mkReport(script, args, extraMeta) {
  return {
    report: script,
    generatedAt: nowIso(),
    command: 'node scripts/verification/' + script + (process.argv.slice(2).length ? ' ' + process.argv.slice(2).join(' ') : ''),
    target: { url: (args && args.url) || DEFAULT_URL, viewport: args && args.width ? { width: +args.width, height: +args.height } : null },
    meta: { provenance: provenance(), ...(extraMeta || {}) },
    checks: [],
    limitations: [],
    notes: []
  };
}

// ---------------------------------------------------------------------------
// In-page instrumentation, installed before any document script runs. Payloads
// are real functions here and are stringified into the page.
//   window.__maps    live maplibre Map instances (0 = left map, 1 = right map)
//   window.__camops  every camera API call with the centre before the call
//   window.__rec     rAF frames, long tasks, page errors, key/DOM timeline
// The DOM timeline uses MutationObserver (not rAF) because headless Chrome
// throttles requestAnimationFrame to ~2 fps here; see meta.rafRate.
// ---------------------------------------------------------------------------
function instrumentPayload() {
  window.__camops = []; window.__maps = []; window.__instrument = { mode: 'none' };
  const serial = a => {
    try {
      if (a === null || typeof a === 'number' || typeof a === 'string' || typeof a === 'boolean') return a;
      if (Array.isArray(a)) return a.map(serial);
      if (typeof a === 'object') { const o = {}; for (const k of ['center', 'zoom', 'duration', 'offset', 'animate', 'essential', 'bearing', 'pitch']) if (k in a) o[k] = serial(a[k]); return o; }
      return String(a).slice(0, 80);
    } catch (e) { return null; }
  };
  const wrapCam = proto => {
    for (const name of ['panBy', 'panTo', 'jumpTo', 'easeTo', 'flyTo', 'setCenter', 'zoomTo', 'rotateTo', 'setBearing', 'setPitch']) {
      const orig = proto[name];
      if (typeof orig !== 'function' || orig.__atlasWrapped) continue;
      const wrapped = function () {
        const args = Array.prototype.slice.call(arguments);
        let before = null;
        try { const c = this.getCenter(); before = [+c.lng.toFixed(5), +c.lat.toFixed(5), +this.getZoom().toFixed(3)]; } catch (e) {}
        try { window.__camops.push({ name: name, t: Math.round(performance.now()), before: before, args: args.map(serial) }); } catch (e) {}
        return orig.apply(this, args);
      };
      wrapped.__atlasWrapped = true; proto[name] = wrapped;
    }
  };
  const install = v => {
    if (!v || !v.Map || window.__instrument.mode !== 'none') return;
    try {
      wrapCam(v.Map.prototype);
      const Orig = v.Map;
      class WrappedMap extends Orig { constructor() { super(...arguments); window.__maps.push(this); } }
      v.Map = WrappedMap;
      window.__instrument = { mode: 'subclass+camops' };
    } catch (e) {
      try { wrapCam(v.Map.prototype); window.__instrument = { mode: 'camops-only' }; } catch (e2) { window.__instrument = { mode: 'none', error: String(e) }; }
    }
  };
  if (window.maplibregl) install(window.maplibregl);
  else { let stored; Object.defineProperty(window, 'maplibregl', { configurable: true, get() { return stored; }, set(v) { stored = v; install(v); } }); }
  window.__rec = { frames: [], longtasks: [], errors: [], keys: [], steps: [] };
  const heap = () => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 104857.6) / 10 : null);
  const t = () => Math.round(performance.now() * 10) / 10;
  try { if (window.PerformanceObserver) new PerformanceObserver(l => { for (const e of l.getEntries()) window.__rec.longtasks.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) }); }).observe({ entryTypes: ['longtask'] }); } catch (e) {}
  addEventListener('error', e => window.__rec.errors.push(String((e && e.message) || e)));
  addEventListener('unhandledrejection', e => window.__rec.errors.push('unhandledrejection: ' + String((e && e.reason && e.reason.message) || (e && e.reason))));
  window.__compositionActive = false;
  document.addEventListener('compositionstart', () => { window.__compositionActive = true; }, true);
  document.addEventListener('compositionend', () => { window.__compositionActive = false; }, true);
  addEventListener('keydown', e => { try { const tg = e.target; window.__rec.keys.push({ t: t(), key: e.key, alt: !!e.altKey, shift: !!e.shiftKey, composing: !!e.isComposing, repeat: !!e.repeat, target: (tg && (tg.id || (typeof tg.className === 'string' ? tg.className : ''))) || (tg && tg.tagName) || null }); } catch (err) {} }, true);
  document.addEventListener('DOMContentLoaded', () => {
    const watch = (sel, kind, read, opts) => {
      const el = document.querySelector(sel); if (!el) return;
      window.__rec.steps.push({ t: t(), kind, value: read(el), heap: heap() });
      new MutationObserver(() => { try { window.__rec.steps.push({ t: t(), kind, value: read(el), heap: heap() }); } catch (e) {} }).observe(el, opts);
    };
    watch('#bigYear', 'bigYear', el => el.textContent, { childList: true, characterData: true, subtree: true });
    watch('#loading', 'loadingHidden', el => el.hidden, { attributes: true, attributeFilter: ['hidden'] });
    watch('#atlasView', 'busy', el => el.getAttribute('aria-busy'), { attributes: true, attributeFilter: ['aria-busy'] });
    watch('#datasetStatus', 'datasetStatus', el => el.textContent, { childList: true, subtree: true, characterData: true });
    watch('#mapError', 'mapError', el => (el.hidden ? null : el.textContent.slice(0, 120)), { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true });
    watch('#terrainStatus', 'terrainStatus', el => el.textContent, { childList: true, subtree: true, characterData: true });
  });
  (function loop(prev) {
    const now = performance.now();
    if (prev) { if (!window.__rafFirst) window.__rafFirst = prev; window.__rafLast = now; window.__rafCount = (window.__rafCount || 0) + 1; }
    try { window.__rec.frames.push(Math.round(now)); } catch (e) {}
    requestAnimationFrame(loop);
  })(0);
}
export const INSTRUMENT = '(' + instrumentPayload.toString() + ')();';

export async function installInstrument(s) { await s.send('Page.addScriptToEvaluateOnNewDocument', { source: INSTRUMENT }); }

function mapStateExpr(i) {
  const m = (window.__maps || [])[i];
  if (!m) return null;
  const c = m.getCenter();
  const el = m.getCanvas();
  const r = el.getBoundingClientRect();
  const params = Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
  return { center: [+c.lng.toFixed(5), +c.lat.toFixed(5)], zoom: +m.getZoom().toFixed(3), bearing: +m.getBearing().toFixed(2), pitch: +m.getPitch().toFixed(2), projection: m.getProjection().type, canvas: { attr: [el.width, el.height], rect: [Math.round(r.width), Math.round(r.height)], dpr: devicePixelRatio }, moving: m.isMoving(), hashYear: params.year !== undefined ? Number(params.year) : null, hashCamera: params.camera || null };
}
function settledExpr(year) {
  const m = (window.__maps || [])[0];
  if (!m) return false;
  const params = Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
  const busy = document.querySelector('#atlasView');
  const loading = document.querySelector('#loading');
  const big = document.querySelector('#bigYear');
  const label = big ? big.textContent : '';
  const plain = String(Math.abs(year));
  const grouped = Math.abs(year).toLocaleString('en-US');
  const labelled = label.indexOf(plain) >= 0 || label.indexOf(grouped) >= 0;
  return Number(params.year) === year && !m.isMoving() && busy && busy.getAttribute('aria-busy') === 'false' && loading && loading.hidden === true && labelled;
}
export const exprs = {
  instrumentMode: 'window.__instrument ? window.__instrument.mode : "none"',
  mapCount: 'Array.isArray(window.__maps) ? window.__maps.length : 0',
  mapState: i => '(' + mapStateExpr.toString() + ')(' + i + ')',
  camOps: 'window.__camops || []',
  frames: '(window.__rec ? window.__rec.frames : []).slice(-6000)',
  rafRate: '({ count: window.__rafCount || 0, spanMs: window.__rafFirst ? Math.round((window.__rafLast || window.__rafFirst) - window.__rafFirst) : 0 })',
  longTasks: '(window.__rec ? window.__rec.longtasks : [])',
  steps: '(window.__rec ? window.__rec.steps : [])',
  keys: '(window.__rec ? window.__rec.keys : [])',
  pageErrors: '(window.__rec ? window.__rec.errors : [])',
  compositionActive: '!!window.__compositionActive',
  heapMB: 'performance.memory ? Math.round(performance.memory.usedJSHeapSize / 104857.6) / 10 : null',
  reset: '(() => { window.__camops.length = 0; window.__rec.frames.length = 0; window.__rec.longtasks.length = 0; window.__rec.keys.length = 0; window.__rec.steps.length = 0; window.__rec.errors.length = 0; return true; })()',
  hash: 'location.hash',
  hashParams: '(() => Object.fromEntries(new URLSearchParams(location.hash.slice(1))))()'
};

export const evalx = (s, expr) => evaluate(s, expr);
export const mapState = (s, i = 0) => evaluate(s, exprs.mapState(i));
export const camOps = s => evaluate(s, exprs.camOps);
export const frames = s => evaluate(s, exprs.frames);
export const rafRate = s => evaluate(s, exprs.rafRate);
export const longTasks = s => evaluate(s, exprs.longTasks);
export const stepTimeline = s => evaluate(s, exprs.steps);
export const keyTimeline = s => evaluate(s, exprs.keys);
export const heapMB = s => evaluate(s, exprs.heapMB);
export const pageErrors = s => evaluate(s, exprs.pageErrors);
export const compositionActive = s => evaluate(s, exprs.compositionActive);
export const resetRecorder = s => evaluate(s, exprs.reset);
export const hashParams = s => evaluate(s, exprs.hashParams);

export function frameStats(frameList) {
  const d = [];
  for (let i = 1; i < frameList.length; i++) d.push(frameList[i] - frameList[i - 1]);
  const valid = d.filter(x => x > 0 && x < 5000);
  return { frames: valid.length, intervalMs: stats(valid), jankFramesOver50ms: valid.filter(x => x > 50).length, fps: valid.length ? round(1000 / (valid.reduce((a, b) => a + b, 0) / valid.length)) : null };
}

export const zhYear = y => { const n = Math.abs(y) >= 10000 ? Math.abs(y).toLocaleString('en-US') : String(Math.abs(y)); return (y < 0 ? '公元前 ' : '公元 ') + n + ' 年'; };

// Polling note (measured by the Lead and reproduced here): driving Runtime.evaluate
// at 200-250 ms while the map is loading can keep missing #loading.hidden even though
// the page settled seconds earlier. All waiting below polls at >= 250 ms (ready: 1 s)
// and the precise per-step timings come from the in-page MutationObserver timeline,
// never from the poll loop.
export async function waitYearSettled(s, target, timeout = 30000) {
  const start = Date.now();
  const expr = '(' + settledExpr.toString() + ')(' + target + ')';
  let last = null;
  while (Date.now() - start < timeout) {
    try { last = await evaluate(s, expr); } catch (e) { last = 'eval-error'; }
    if (last === true) return { settled: true, elapsed: Date.now() - start, pollMs: 300 };
    await sleep(300);
  }
  return { settled: false, elapsed: Date.now() - start, last, pollMs: 300 };
}

// Page.navigate resolves before the new document commits, so polling straight away can
// read the OLD document (which usually looks "ready"). Tag the old document, navigate and
// wait until the tag is gone and a new body exists.
export async function navigate(s, url, { timeout = 30000 } = {}) {
  const token = 'nav-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  try { await evaluate(s, 'window.__navToken = ' + JSON.stringify(token)); } catch (e) {}
  await s.send('Page.navigate', { url });
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    let fresh = false;
    try { fresh = await evaluate(s, 'window.__navToken === undefined && !!document.body'); } catch (e) { fresh = false; }
    if (fresh === true) return { committed: true, elapsed: Date.now() - t0, token };
    await sleep(200);
  }
  return { committed: false, elapsed: Date.now() - t0, token };
}

// Like navigate(), but bypasses the HTTP cache for the document and its subresources
// (Page.reload ignoreCache) so request interception cannot be served from cache.
export async function hardReload(s, { timeout = 30000 } = {}) {
  const token = 'nav-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  try { await evaluate(s, 'window.__navToken = ' + JSON.stringify(token)); } catch (e) {}
  await s.send('Page.reload', { ignoreCache: true });
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    let fresh = false;
    try { fresh = await evaluate(s, 'window.__navToken === undefined && !!document.body'); } catch (e) { fresh = false; }
    if (fresh === true) return { committed: true, elapsed: Date.now() - t0, token, ignoreCache: true };
    await sleep(200);
  }
  return { committed: false, elapsed: Date.now() - t0, token, ignoreCache: true };
}

export async function appReady(s) {
  return evaluate(s, '(() => { const l = document.querySelector("#loading"); const a = document.querySelector("#atlasView"); const m = (window.__maps || [])[0]; return { loadingHidden: !!(l && l.hidden), busy: a ? a.getAttribute("aria-busy") : null, mapYear: m ? m.year : null, hashYear: Number(new URLSearchParams(location.hash.slice(1)).get("year")) }; })()');
}

export async function waitMapReady(s, timeout = 90000) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeout) {
    try { last = await appReady(s); } catch (e) { last = { error: String(e.message || e) }; }
    if (last && last.loadingHidden === true) return { ready: true, elapsed: Date.now() - start, state: last };
    await sleep(1000);
  }
  // One calm re-check: some loads only settle once the polling stops.
  await sleep(3000);
  try { last = await appReady(s); } catch (e) { last = { error: String(e.message || e) }; }
  if (last && last.loadingHidden === true) return { ready: true, elapsed: Date.now() - start, state: last, afterQuietRecheck: true };
  return { ready: false, elapsed: Date.now() - start, state: last };
}

export async function waitNotMoving(s, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const st = await evaluate(s, '(() => { const m = (window.__maps || [])[0]; return m ? !m.isMoving() : null; })()');
    if (st === true) return Date.now() - start;
    await sleep(60);
  }
  return null;
}

export function eventsBetween(steps, kind, from, to) { return steps.filter(e => e.kind === kind && e.t >= from && (!to || e.t <= to)); }
export function screenshotPath(name) { ensureDirs(SHOTS); return path.join(SHOTS, name); }
