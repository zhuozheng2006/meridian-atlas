#!/usr/bin/env node
'use strict';

// Exercise the real source functions in a controlled async/DOM harness. This
// intentionally does not launch a browser, fetch data, or modify the checkout.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {gunzipSync} = require('node:zlib');
const {pathToFileURL} = require('node:url');
const checkout = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(checkout, 'public/app.js'), 'utf8');
const readerSource = fs.readFileSync(path.join(checkout, 'public/polity-reader.js'), 'utf8');
const start = app.indexOf('async function returnToPolity(){');
const end = app.indexOf('\nasync function openPlace(', start);
assert(start >= 0 && end > start, 'returnToPolity source boundary exists');
const returnSource = app.slice(start, end);
const checks = [];

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {resolve = res; reject = rej;});
  return {promise, resolve, reject};
}
const nextTurn = () => new Promise(resolve => setImmediate(resolve));

function harness(side = 'left') {
  const dossier = deferred(), cities = deferred();
  const focus = [], camera = [], opens = [];
  const body = {scrollTop: 80};
  const makeMap = name => ({name, year: 1500, map: {
    stop() {camera.push([name, 'stop']);},
    jumpTo(value) {camera.push([name, 'jump', value]);}
  }});
  const left = makeMap('left'), right = makeMap('right');
  const map = side === 'right' ? right : left;
  const origin = {
    record: {id: 'clio:test'}, whichMap: map, year: 1500,
    camera: {center: [8.2, 47.7], zoom: 7, bearing: 0, pitch: 0},
    query: 'Rome', kind: 'urban-observation', limit: 80, scroll: 4000, index: 44
  };
  let saves = 0, closes = 0;
  const context = {
    placeReturn: origin, atlas: left, compareMap: right, detailNavigation: 10, pause() {},
    setYear: async year => {left.year = year; return true;}, setCompareYear: async year => {right.year = year; return true;},
    polityReader: {seq: 3, interaction: 5, tab: 'overview', citiesReady: null},
    closeDetail() {closes++;}, saveURL() {saves++;},
    $(selector) {
      if (selector === '#detailPanel .reader-content') return body;
      return {focus(options) {focus.push({selector, options});}};
    }
  };
  context.openPolity = (record, whichMap, options) => {
    opens.push({record, whichMap, options});
    context.detailNavigation++;
    context.polityReader.seq++;
    context.polityReader.citiesReady = cities.promise;
    context.placeReturn = null;
    return dossier.promise;
  };
  vm.createContext(context);
  vm.runInContext(returnSource, context, {filename: 'app.js:returnToPolity'});
  return {
    context, origin, map, body, focus, camera, opens, dossier, cities,
    get saves() {return saves;}, get closes() {return closes;},
    run() {return vm.runInContext('returnToPolity()', context);},
    finish() {dossier.resolve(); cities.resolve();}
  };
}

async function check(name, fn) {
  try {await fn(); checks.push({name, passed: true}); console.log('PASS', name);}
  catch (error) {checks.push({name, passed: false, error: error.stack}); console.error('FAIL', name, error.stack);}
}

async function main() {
  for (const side of ['left', 'right']) {
    await check(`Normal ${side}-map return restores camera, query, filter, limit, scroll and focus`, async () => {
      const h = harness(side), result = h.run(), r = h.context.polityReader;
      assert.equal(h.opens[0].whichMap, h.map);
      assert.equal(h.opens[0].record, h.origin.record);
      assert.equal(h.opens[0].options.keepView, true);
      assert.equal(r.tab, 'cities'); assert.equal(r.placeQuery, 'Rome');
      assert.equal(r.placeKind, 'urban-observation'); assert.equal(r.placeLimit, 80);
      assert.equal(h.camera[0][0], side); assert.equal(h.camera[1][2], h.origin.camera);
      assert.equal(h.body.scrollTop, 80); assert.equal(h.focus.length, 0);
      h.finish(); await result;
      assert.equal(h.body.scrollTop, 4000);
      assert.equal(h.focus.length, 1);
      assert.equal(h.focus[0].selector, '[data-dossier-place="44"]');
      assert.equal(h.focus[0].options.preventScroll, true); assert.equal(h.saves, 1);
    });
  }

  const changes = [
    ['selected tab', h => {h.context.polityReader.tab = 'overview';}],
    ['reader sequence', h => {h.context.polityReader.seq++;}],
    ['user interaction', h => {h.context.polityReader.interaction++;}],
    ['map year', h => {h.map.year = 1501;}],
    ['query', h => {h.context.polityReader.placeQuery = 'Milan';}],
    ['kind', h => {h.context.polityReader.placeKind = 'all';}],
    ['page limit', h => {h.context.polityReader.placeLimit = 120;}],
    ['detail navigation', h => {h.context.detailNavigation++;}]
  ];
  for (const [name, change] of changes) {
    await check(`A changed ${name} prevents delayed scroll/focus restoration`, async () => {
      const h = harness(), result = h.run(); change(h);
      h.body.scrollTop = 123; h.finish(); await result;
      assert.equal(h.body.scrollTop, 123); assert.equal(h.focus.length, 0); assert.equal(h.saves, 0);
    });
  }

  await check('Return waits for its captured city load, not a later resolved citiesReady', async () => {
    const h = harness(); let done = false;
    const result = h.run().then(() => {done = true;});
    h.context.polityReader.citiesReady = Promise.resolve();
    h.dossier.resolve(); await nextTurn();
    assert.equal(done, false); assert.equal(h.body.scrollTop, 80); assert.equal(h.focus.length, 0);
    h.cities.resolve(); await result;
    assert.equal(done, true); assert.equal(h.body.scrollTop, 4000);
  });

  await check('A later pending citiesReady cannot hold the original return open', async () => {
    const h = harness(), later = deferred(); let done = false;
    const result = h.run().then(() => {done = true;});
    h.context.polityReader.citiesReady = later.promise;
    h.finish(); await nextTurn();
    const usedCapturedPromise = done;
    // Resolve the replacement even on failure to leave no pending test work.
    later.resolve(); await result;
    assert.equal(usedCapturedPromise, true); assert.equal(h.body.scrollTop, 4000);
  });

  await check('Returning after a city year jump restores the original polity year before opening', async () => {
    const h = harness(); h.map.year = 1501; const run = h.run(); h.finish(); await run;
    assert.equal(h.map.year, 1500); assert.equal(h.closes, 0); assert.equal(h.opens.length, 1); assert.equal(h.focus.length, 1);
  });

  await check('A failed origin-year load leaves the city reader open', async () => {
    const h = harness(); h.map.year = 1501; h.context.setYear = async () => false; await h.run();
    assert.equal(h.map.year, 1501); assert.equal(h.opens.length, 0); assert.equal(h.closes, 0); assert.equal(h.context.placeReturn, h.origin);
  });

  await check('A later city navigation cancels a delayed origin-year return', async () => {
    const h = harness(), waiting = deferred(); h.map.year = 1501;
    h.context.setYear = async year => {await waiting.promise; h.map.year = year; return true;};
    const run = h.run(); h.context.detailNavigation++; waiting.resolve(); await run;
    assert.equal(h.opens.length, 0); assert.equal(h.focus.length, 0);
  });

  await check('A removed comparison map does not reopen or restore focus', async () => {
    const h = harness('right'); h.context.compareMap = null; await h.run();
    assert.equal(h.opens.length, 0); assert.equal(h.focus.length, 0); assert.equal(h.camera.length, 0);
  });

  const readerContext = {document: {querySelector: () => null, activeElement: null}};
  vm.createContext(readerContext);
  vm.runInContext(readerSource.replace(/^import .*;\s*$/gm, '').replace(/\bexport /g, '') + '\nthis.Reader = PolityReader;', readerContext);
  const Reader = readerContext.Reader;
  await check('Chinese composition defers input and asynchronous reader re-render until committed', () => {
    const handlers = new Map(), reader = new Reader({}), input = {
      id: 'polityPlaceSearch', isConnected: true, value: '长安',
      selectionStart: 2, selectionEnd: 2, focus() {}, setSelectionRange() {},
      addEventListener(type, handler) {handlers.set(type, handler);}
    };
    const panel = {
      contains: element => element === input,
      querySelector: selector => selector === '#polityPlaceSearch' ? input : null,
      querySelectorAll: () => []
    };
    let renders = 0; reader.render = () => {renders++;};
    reader.bindCities(panel); handlers.get('compositionstart')();
    input.oninput({isComposing: true}); assert.equal(renders, 0);
    reader.record = {id: 'clio:test'}; reader.tab = 'cities';
    readerContext.document.querySelector = () => panel;
    readerContext.document.activeElement = input;
    // The real render must stop before attempting to replace the minimal DOM.
    Reader.prototype.render.call(reader);
    assert.equal(reader.placeComposing, true); assert.equal(renders, 0);
    handlers.get('compositionend')();
    assert.equal(reader.placeComposing, false); assert.equal(reader.placeQuery, '长安');
    assert.equal(reader.placeLimit, 40); assert.equal(renders, 1);
  });

  await check('A real population record is discoverable by its source otherNames alias', async () => {
    const {filterPolityPlaces} = await import(pathToFileURL(path.join(checkout, 'public/polity-places.js')));
    const data = JSON.parse(gunzipSync(fs.readFileSync(path.join(checkout, 'public/data/places/urban-observations.json.gz'))));
    const aachen = data.cities.find(place => place.id === 'chandler:2');
    assert.equal(aachen.name, 'Aachen'); assert.equal(aachen.otherNames, 'Aix-la-Chapelle');
    assert.equal(filterPolityPlaces([aachen], 'Aix-la-Chapelle').length, 1);
    assert.equal(filterPolityPlaces([aachen], 'aix la chapelle').length, 1);
    assert.equal(filterPolityPlaces([aachen], 'Aix-la-Chapelle', 'dated-capital').length, 0);
  });

  const passed = checks.filter(check => check.passed).length;
  console.log(JSON.stringify({suite: 'polity place return and review regressions', passed, total: checks.length}, null, 2));
  if (passed !== checks.length) process.exitCode = 1;
}
main().catch(error => {console.error(error); process.exitCode = 1;});
