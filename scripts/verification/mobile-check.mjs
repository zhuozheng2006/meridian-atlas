// P2 mobile layout / touch verification for Meridian Atlas (real headless Chrome via CDP).
// Reproduce:
//   node scripts/verification/mobile-check.mjs
// Report: docs/verification-3.10/mobile-check.json
// Screenshots: docs/verification-3.10/shots/mobile-*.png
//
// Two device profiles (390x844 and 360x740) with touch emulation: horizontal overflow,
// map canvas size, layer panel open/close by touch, reader readability, touch drag and
// tap on the timeline, and safe-area behaviour.
import { launch, goto, evaluate, screenshot, sleep } from './browser.mjs';
import * as C from './lib/common.mjs';

const args = C.parseArgs();
const URL_BASE = String(args.url || C.DEFAULT_URL).replace(/\/$/, '');
const PORT = Number(args.port || 9431);
const OUT = String(args.out || 'docs/verification-3.10/mobile-check.json');
const PROFILES = [
  { name: 'iphone-14-390x844', width: 390, height: 844, dsf: 3 },
  { name: 'android-360x740', width: 360, height: 740, dsf: 3 }
];
const report = C.mkReport('mobile-check.mjs', { url: URL_BASE, width: 390, height: 844 }, { profiles: PROFILES.map(p => p.name) });

// Elements outside the viewport that do NOT create document overflow are classified:
// hidden subtrees (off-canvas sidebar, closed panels), horizontal scrollers (era row,
// tabs) and genuinely clipped content. Only the last group is a layout defect.
function offendersExpr() {
  const W = innerWidth;
  const out = [];
  let excluded = 0; let inScroller = 0; const clipped = [];
  const scrollable = el => {
    let p = el.parentElement;
    while (p && p !== document.documentElement) {
      const cs = getComputedStyle(p);
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && p.scrollWidth > p.clientWidth + 1) return true;
      p = p.parentElement;
    }
    return false;
  };
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.right <= W + 1 && r.left >= -1) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (el.closest('[inert],[aria-hidden="true"],[hidden]')) { excluded++; continue; }
    if (scrollable(el)) { inScroller++; continue; }
    const entry = { tag: el.tagName, id: el.id || null, cls: (typeof el.className === 'string' ? el.className : '').slice(0, 40), right: Math.round(r.right), left: Math.round(r.left), width: Math.round(r.width) };
    out.push(entry);
    if (clipped.length < 12) clipped.push(entry);
  }
  return { count: out.length, excludedHiddenSubtrees: excluded, inHorizontalScroller: inScroller, sample: clipped };
}

const EXPR = {
  layout: '(() => ({ innerWidth, innerHeight, dpr: devicePixelRatio, scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, scrollY: window.scrollY || document.documentElement.scrollTop || 0, visualScale: window.visualViewport ? Number(window.visualViewport.scale.toFixed(2)) : null, viewportMeta: (document.querySelector("meta[name=viewport]") || {}).content || null }))()',
  offenders: '(' + offendersExpr.toString() + ')()',
  box: sel => '(() => { const el = document.querySelector(' + JSON.stringify(sel) + '); if (!el) return null; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom), cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2), visible: el.getClientRects().length > 0 && r.width > 0 && r.height > 0, inViewport: r.top >= -1 && r.left >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1, fontSize: cs.fontSize, lineHeight: cs.lineHeight, hidden: el.hidden === true, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }; })()',
  safeArea: '(() => { const read = sel => { const el = document.querySelector(sel); if (!el) return null; const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return { paddingBottom: cs.paddingBottom, paddingTop: cs.paddingTop, bottom: Math.round(r.bottom), height: Math.round(r.height) }; }; return { supportsEnv: CSS.supports("padding-bottom: env(safe-area-inset-bottom)"), timeline: read("#timeline"), layerPanel: read("#layerPanel"), bodyPaddingBottom: getComputedStyle(document.body).paddingBottom, htmlPaddingBottom: getComputedStyle(document.documentElement).paddingBottom }; })()',
  readerText: '(() => { const el = document.querySelector("#detailPanel .reader-content"); if (!el) return null; const cs = getComputedStyle(el); const p = el.querySelector("p"); const pcs = p ? getComputedStyle(p) : null; const r = el.getBoundingClientRect(); return { fontSize: cs.fontSize, lineHeight: cs.lineHeight, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, width: Math.round(r.width), paragraphFontSize: pcs ? pcs.fontSize : null, paragraphLineHeight: pcs ? pcs.lineHeight : null, textLength: (el.textContent || "").trim().length }; })()',
  marker: '(() => { const els = [...document.querySelectorAll(".event-marker")]; for (const el of els) { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0 && r.top > 60 && r.bottom < innerHeight - 170 && r.left > 4 && r.right < innerWidth - 4) return { cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2), count: els.length }; } return { cx: null, cy: null, count: els.length }; })()'
};

async function touchTap(s, x, y) {
  await s.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await sleep(60);
  await s.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(400);
}
async function touchDrag(s, x1, y1, x2, y2, steps = 12) {
  await s.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1, id: 1 }] });
  for (let i = 1; i <= steps; i++) {
    const x = x1 + (x2 - x1) * i / steps; const y = y1 + (y2 - y1) * i / steps;
    await s.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
    await sleep(28);
  }
  await s.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(700);
}
const year = async s => Number((await C.hashParams(s)).year);

async function profileRun(p, port) {
  const s = await launch({ port, width: p.width, height: p.height, mobile: true, deviceScaleFactor: p.dsf, profile: '/tmp/atlas-mobile-' + p.name + '-' + Date.now() });
  const out = { profile: p, states: {} };
  const checks = [];
  try {
    await C.installInstrument(s);
    let safeAreaOverride = 'not-attempted';
    await C.navigate(s, URL_BASE + '/#year=1500&lang=bi&browse=0');
    const ready = await C.waitMapReady(s, 120000);
    out.readyMs = ready.elapsed;
    out.ready = { ok: ready.ready, afterQuietRecheck: !!ready.afterQuietRecheck, state: ready.state };
    out.layout = await evaluate(s, EXPR.layout);
    out.canvas = (await C.mapState(s, 0)).canvas;
    out.mapBox = await evaluate(s, EXPR.box('#map'));
    out.offendersAtlas = await evaluate(s, EXPR.offenders);
    out.safeArea = await evaluate(s, EXPR.safeArea);
    out.userAgent = await evaluate(s, 'navigator.userAgent');
    out.instrumentation = await evaluate(s, C.exprs.instrumentMode);
    await screenshot(s, C.screenshotPath('mobile-' + p.name + '-atlas.png'));
    checks.push(C.checkFn('mobile.' + p.name + '.no-horizontal-overflow', 'Atlas view has no horizontal overflow', v => v.scrollWidth <= v.innerWidth + 1 && v.offenders.count === 0, { scrollWidth: out.layout.scrollWidth, innerWidth: out.layout.innerWidth, offenders: out.offendersAtlas }));
    checks.push(C.checkFn('mobile.' + p.name + '.canvas-fits', 'Map canvas matches the #map box, the viewport width and the device pixel ratio', v => v.canvasRect[0] === v.mapBox[0] && v.canvasRect[1] === v.mapBox[1] && v.canvasRect[0] > 0.9 * v.innerWidth && v.canvasAttr[0] === v.canvasRect[0] * v.dpr, { canvasRect: out.canvas.rect, canvasAttr: out.canvas.attr, dpr: out.layout.dpr, mapBox: [out.mapBox.width, out.mapBox.height], innerWidth: out.layout.innerWidth }));

    // Layer panel: open and close by touch.
    const beforePanel = await evaluate(s, EXPR.box('#layerPanel'));
    const layersBtn = await evaluate(s, EXPR.box('#layersBtn'));
    await touchTap(s, layersBtn.cx, layersBtn.cy);
    const openPanel = await evaluate(s, EXPR.box('#layerPanel'));
    await screenshot(s, C.screenshotPath('mobile-' + p.name + '-layers.png'));
    const openOffenders = await evaluate(s, EXPR.offenders);
    const layerLayout = await evaluate(s, EXPR.layout);
    const closeBtn = await evaluate(s, EXPR.box('#layerClose'));
    await touchTap(s, closeBtn.cx, closeBtn.cy);
    const closedPanel = await evaluate(s, EXPR.box('#layerPanel'));
    out.states.layers = { before: beforePanel, layersBtn, opened: openPanel, closeBtn, closed: closedPanel, openOffenders, openLayout: layerLayout };
    checks.push(C.checkFn('mobile.' + p.name + '.layer-panel-touch', 'Layer panel opens and closes by touch and stays inside the viewport', v => v.beforeHidden === true && v.openedHidden === false && v.openedInViewport === true && v.closedHidden === true, { beforeHidden: beforePanel.hidden, openedHidden: openPanel.hidden, openedInViewport: openPanel.inViewport, openedRect: [openPanel.x, openPanel.y, openPanel.width, openPanel.height], closedHidden: closedPanel.hidden }));
    checks.push(C.checkFn('mobile.' + p.name + '.layer-panel-no-overflow', 'Open layer panel introduces no horizontal overflow', v => v.scrollWidth <= v.innerWidth + 1 && v.offenders.count === 0, { scrollWidth: layerLayout.scrollWidth, innerWidth: layerLayout.innerWidth, offenders: openOffenders }));

    // Touch drag on the map pans the camera and does not scroll the page.
    const dragBefore = { center: (await C.mapState(s, 0)).center, layout: await evaluate(s, EXPR.layout) };
    await touchDrag(s, Math.round(p.width * 0.7), Math.round(p.height * 0.42), Math.round(p.width * 0.3), Math.round(p.height * 0.30));
    const dragAfter = { center: (await C.mapState(s, 0)).center, layout: await evaluate(s, EXPR.layout) };
    out.states.touchDrag = { before: dragBefore, after: dragAfter, delta: [C.round(dragAfter.center[0] - dragBefore.center[0], 4), C.round(dragAfter.center[1] - dragBefore.center[1], 4)] };
    checks.push(C.checkFn('mobile.' + p.name + '.touch-drag-pans', 'One-finger touch drag pans the map and does not scroll the page', v => (Math.abs(v.delta[0]) > 0.5 || Math.abs(v.delta[1]) > 0.5) && v.after.layout.scrollY === 0 && v.before.layout.scrollY === 0, out.states.touchDrag));

    // Timeline tap: #nextYear advances by the step.
    const y0 = await year(s);
    const step = await evaluate(s, 'Number(document.querySelector("#step").value)');
    const nextYearBox = await evaluate(s, EXPR.box('#nextYear'));
    await touchTap(s, nextYearBox.cx, nextYearBox.cy);
    const settled = await C.waitYearSettled(s, y0 + step, 30000);
    const y1 = await year(s);
    out.states.timelineTap = { before: y0, after: y1, step, settled, nextYearBox };
    checks.push(C.checkFn('mobile.' + p.name + '.timeline-tap', 'Tapping #nextYear advances the year by the selected step', v => v.after === v.before + v.step && v.settled === true, { before: y0, after: y1, step, settled: settled.settled, nextYearVisible: nextYearBox.visible, nextYearInViewport: nextYearBox.inViewport, note: 'a URL without a step parameter defaults the step selector to 1 year' }));

    // Event marker tap opens the reader (map-first path used on phones).
    const marker = await evaluate(s, EXPR.marker);
    let markerOpened = null;
    if (marker.cx !== null) {
      await touchTap(s, marker.cx, marker.cy);
      await sleep(1200);
      markerOpened = await evaluate(s, '({ hidden: document.querySelector("#detailPanel").hidden, title: (document.querySelector("#detailPanel h2") || {}).textContent || null })');
    }
    out.states.markerTap = { marker, opened: markerOpened };
    if (marker.cx === null) report.limitations.push(p.name + ': no event marker was inside the safe viewport band, marker tap not measured (reader opened via the sidebar path instead).');
    else checks.push(C.checkFn('mobile.' + p.name + '.marker-tap-opens-reader', 'Tapping an event marker opens the reader', v => v.opened && v.opened.hidden === false, { marker, opened: markerOpened }));

    // Reader readability through the sidebar path (guaranteed entry).
    if (!markerOpened || markerOpened.hidden === true) {
      await C.navigate(s, URL_BASE + '/#year=1500&lang=bi&browse=1');
      await C.waitMapReady(s);
      const card = await evaluate(s, EXPR.box('#eventList [data-event]'));
      await touchTap(s, card.cx, card.cy);
      await sleep(1500);
    }
    const readerBox = await evaluate(s, EXPR.box('#detailPanel'));
    const readerText = await evaluate(s, EXPR.readerText);
    const readerLayout = await evaluate(s, EXPR.layout);
    const readerOffenders = await evaluate(s, EXPR.offenders);
    const closeReaderBox = await evaluate(s, EXPR.box('#detailPanel .detail-close'));
    await screenshot(s, C.screenshotPath('mobile-' + p.name + '-reader.png'));
    out.states.reader = { box: readerBox, text: readerText, layout: readerLayout, offenders: readerOffenders, close: closeReaderBox };
    checks.push(C.checkFn('mobile.' + p.name + '.reader-readable', 'Reader fits the viewport width with readable body text', v => v.panelHidden === false && v.panelWidth <= v.innerWidth + 1 && parseFloat(v.paragraphFontSize || v.fontSize) >= 14 && parseFloat(v.paragraphLineHeight || '0') >= 20 && v.scrollWidth <= v.innerWidth + 1 && v.offenders === 0, { panel: readerBox ? [readerBox.x, readerBox.y, readerBox.width, readerBox.height] : null, panelHidden: readerBox ? readerBox.hidden : null, panelWidth: readerBox ? readerBox.width : null, fontSize: readerText && readerText.fontSize, paragraphFontSize: readerText && readerText.paragraphFontSize, paragraphLineHeight: readerText && readerText.paragraphLineHeight, scrollWidth: readerLayout.scrollWidth, innerWidth: readerLayout.innerWidth, offenders: readerOffenders.count }));
    if (closeReaderBox && closeReaderBox.visible) {
      await touchTap(s, closeReaderBox.cx, closeReaderBox.cy);
      const closed = await evaluate(s, 'document.querySelector("#detailPanel").hidden');
      out.states.reader.closedByTouch = closed;
      checks.push(C.checkFn('mobile.' + p.name + '.reader-close-touch', 'Reader close button is touch-reachable and closes the reader', v => v === true, closed));
    } else {
      report.limitations.push(p.name + ': reader close button was not visible; touch close not measured.');
    }

    // Safe area: emulate a 34 px home-indicator inset when the CDP override exists.
    try {
      await s.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 0, bottom: 34, right: 0 } });
      await sleep(400);
      const withInset = await evaluate(s, EXPR.safeArea);
      const timelineBox = await evaluate(s, EXPR.box('#timeline'));
      safeAreaOverride = 'applied(bottom:34px)';
      const safeBefore = out.safeArea;
      out.states.safeAreaWithInset = { computed: withInset, timelineBox, before: safeBefore };
      checks.push(C.checkFn('mobile.' + p.name + '.safe-area', 'With an emulated 34 px home-indicator inset the bottom UI is not covered and its padding grows by the inset', v => v.supportsEnv === true && v.timelineBottom <= v.innerHeight - 34 + 1 && v.paddingBefore !== v.paddingAfter, { supportsEnv: withInset.supportsEnv, paddingBefore: safeBefore ? safeBefore.timeline.paddingBottom : null, paddingAfter: withInset.timeline.paddingBottom, timelineBottom: withInset.timeline.bottom, innerHeight: p.height, insetBottom: 34, timelineBottomVsInset: withInset.timeline ? withInset.timeline.bottom - (p.height - 34) : null, viewportMeta: out.layout.viewportMeta }));
      await s.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 0, bottom: 0, right: 0 } });
    } catch (e) {
      safeAreaOverride = 'unsupported: ' + String(e.message || e);
      report.limitations.push(p.name + ': Emulation.setSafeAreaInsetsOverride unavailable, so safe-area insets could not be emulated; only the computed CSS values were recorded (' + JSON.stringify(await evaluate(s, EXPR.safeArea)) + ').');
    }
    out.safeAreaOverride = safeAreaOverride;
    out.pageErrors = await C.pageErrors(s);
  } catch (e) { out.fatal = String((e && e.stack) || e); }
  finally { await s.close(); }
  return { out, checks };
}

for (let i = 0; i < PROFILES.length; i++) {
  C.log('profile', PROFILES[i].name);
  const { out, checks } = await profileRun(PROFILES[i], await C.pickPort(PORT + i * 2));
  report.profiles = report.profiles || {};
  report.profiles[PROFILES[i].name] = out;
  report.checks.push(...checks);
}
// Findings are derived from this run's measurements, never hard-coded.
const p0 = report.profiles[PROFILES[0].name] || {};
const inset = p0.states && p0.states.safeAreaWithInset;
const tap = p0.states && p0.states.timelineTap;
report.findings = (report.findings || []).concat([
  'safe-area (measured, not hard-coded): viewport meta = ' + JSON.stringify((p0.layout || {}).viewportMeta) + '; #timeline padding-bottom ' + ((p0.safeArea || {}).timeline ? p0.safeArea.timeline.paddingBottom : '?') + ' with no inset -> ' + (inset ? inset.computed.timeline.paddingBottom : 'not measured') + ' with a 34 px emulated bottom inset; timeline bottom ' + (inset && inset.timelineBox ? inset.timelineBox.bottom : '?') + ' vs inset edge ' + (PROFILES[0].height - 34) + '.',
  'Timeline step: on a fresh mobile URL without a step parameter the selector reads ' + (tap ? tap.step : '?') + ' and tapping #nextYear moved ' + (tap ? tap.before : '?') + ' -> ' + (tap ? tap.after : '?') + '.'
]);
report.notes.push('Viewport meta measured in the page: ' + JSON.stringify(((report.profiles[PROFILES[0].name] || {}).layout || {}).viewportMeta) + '.');
report.limitations.push('No physical device: Chrome device emulation reproduces viewport, DPR and touch events, not iOS Safari behaviour (rubber-band scrolling, dynamic toolbar, real safe-area insets).');
report.limitations.push('Pinch-zoom, double-tap zoom and virtual-keyboard resizing were not measured.');

const file = C.writeJSON(OUT, report);
const failed = report.checks.filter(c => c.pass !== true);
C.log('wrote', file);
C.log('checks:', report.checks.length - failed.length, '/', report.checks.length);
for (const c of report.checks) C.log(c.pass === true ? 'PASS' : (c.pass === false ? 'FAIL' : 'NONE'), c.id);
for (const f of report.limitations) C.log('LIMIT', f);
process.exitCode = failed.some(f => f.pass === false) ? 2 : 0;
