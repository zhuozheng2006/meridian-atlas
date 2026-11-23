import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {readDivisionDirectoryRoute} from '../public/view-state.js';
import {mountDivisionLedger} from '../public/china-name-ledger.js';

// Exercise the production renderer with its on-disk index and native EventTarget.
class Element extends EventTarget {
  constructor(tag) {
    super();
    this.tag = tag;
    this.children = [];
    this.value = '';
  }
  append(...nodes) {
    for (const node of nodes) this.children.push(...(node.tag === 'fragment' ? node.children : [node]));
  }
  replaceChildren() { this.children = []; }
  setAttribute(key, value) { this[key] = value; }
  focus() { document.activeElement = this; }
  scrollIntoView() { document.scrolledTo = this; }
}

async function mount(initialId = '', lang = 'en') {
  const controls = Object.fromEntries([
    ['input', 'input'], ['[name="year"]', 'select'], ['[name="status"]', 'select'],
    ['ul', 'ul'], ['[role="status"]', 'p'], ['[data-more]', 'button'], ['[data-copy-division]', 'button'], ['[data-copy-status]', 'span']
  ].map(([key, tag]) => [key, new Element(tag)]));
  const host = {isConnected: true, querySelector: selector => controls[selector]};
  const route = readDivisionDirectoryRoute(location.search);
  await mountDivisionLedger(host, lang, initialId || route?.id || '', history.state.atlasDivisionDirectory, route);
  return {
    input: controls.input, year: controls['[name="year"]'], status: controls['[name="status"]'],
    list: controls.ul, more: controls['[data-more]'], count: controls['[role="status"]'], copy: controls['[data-copy-division]'], copyStatus: controls['[data-copy-status]']
  };
}

function rowFor(list, id) {
  for (const row of list.children) {
    const locate = row.children.find(el => el.tag === 'a');
    const params = new URLSearchParams(new URL(locate.href, location).hash.slice(1));
    if (params.get('boundary') === 'china-prefecture-' + id) {
      return {locate, evidence: row.children.find(el => el.className === 'historical-review-details'),
        comparison: row.children.find(el => el.className === 'division-comparison')};
    }
  }
}
function click(link, modifiers = {}) {
  const event = Object.assign(new Event('click', {cancelable: true}), {button: 0}, modifiers);
  link.dispatchEvent(event);
  link.onclick?.(event);
}

function descendants(node, tag) {
  return node.children.flatMap(child => typeof child === 'string' ? [] :
    [...(child.tag === tag ? [child] : []), ...descendants(child, tag)]);
}

function elementText(node) {
  if (typeof node === 'string') return node;
  return [node.textContent || '', ...node.children.map(elementText)].join(' ');
}

function setDetailsOpen(details, open) {
  details.open = open;
  const event = new Event('toggle');
  details.dispatchEvent(event);
  details.ontoggle?.(event);
}

function comparedRecords(comparison) {
  return descendants(comparison, 'tr').flatMap(row => {
    const links = descendants(row, 'a');
    if (!links.length) return [];
    const map = links.find(a => new URLSearchParams(new URL(a.href, location).hash.slice(1)).has('boundary'));
    const record = links.find(a => new URL(a.href, location).searchParams.has('division'));
    assert(map && record, 'Each comparison row opens the corresponding map and source record');
    const id = new URL(record.href, location).searchParams.get('division');
    const params = new URLSearchParams(new URL(map.href, location).hash.slice(1));
    assert.equal(params.get('boundary'), 'china-prefecture-' + id);
    assert.equal(params.get('year'), id.split('-')[0]);
    return [{id, map, record, text: elementText(row)}];
  });
}

globalThis.document = {createElement: tag => new Element(tag), createDocumentFragment: () => new Element('fragment')};
globalThis.location = new URL('https://example.org/meridian-atlas/#view=sources&lang=en');
globalThis.history = {
  state: {other: 'keep'},
  replaceState(state, _, url) {
    this.state = structuredClone(state);
    if (url) location.href = url;
  }
};
globalThis.fetch = async path => new Response(readFileSync(new URL('../public/' + path, import.meta.url)));

let directory = await mount();
directory.input.value = 'Zhou';
directory.input.oninput();
directory.year.value = '742';
directory.year.onchange();
directory.status.value = 'pending';
directory.status.onchange();
assert.equal(directory.list.children.length, 20);
assert.equal(rowFor(directory.list, '742-64'), undefined);
directory.more.onclick();
const target = rowFor(directory.list, '742-64');
target.evidence.open = true;
rowFor(directory.list, '742-29').evidence.open = true;
for (const key of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey']) {
  click(target.locate, {[key]: true});
  assert.deepEqual(history.state, {other: 'keep'});
}
click(target.locate);
assert.equal(history.state.other, 'keep');
assert(!location.hash.includes('boundary='));

// Back recreates the directory from the state of the history entry it returns to.
directory = await mount();
assert.deepEqual([directory.input.value, directory.year.value, directory.status.value], ['Zhou', '742', 'pending']);
assert.equal(directory.list.children.length, 40);
assert.match(directory.count.textContent, /Showing 40 of/);
const restored = rowFor(directory.list, '742-64');
assert.equal(restored.evidence.open, true);
assert.equal(rowFor(directory.list, '742-29').evidence.open, true);
assert.equal(directory.list.children.flatMap(row => row.children).filter(item => item.tag === 'details' && item.open).length, 2);
assert.equal(document.activeElement, restored.locate);
assert.equal(document.scrolledTo, restored.locate);
assert.equal(history.state.other, 'keep');
// Traversing forward and back again must still find the same directory entry.
directory = await mount();
assert.equal(directory.list.children.length, 40);
assert.equal(document.activeElement, rowFor(directory.list, '742-64').locate);
// The five source records extend beyond both this page and the active status filter.
const anchor = rowFor(directory.list, '742-64');
assert(anchor.comparison);
setDetailsOpen(anchor.comparison, true);
let compared = comparedRecords(anchor.comparison);
const guiIds = [39, 64, 134, 145, 317].map(id => '742-' + id);
assert.deepEqual(compared.map(r => r.id), guiIds);
assert.match(elementText(anchor.comparison.children[0]), /Compare.*5/);
assert.match(compared[0].text, /Lingnan Dao/);
assert.match(compared[2].text, /Shannan East Dao/);
assert.match(compared[0].text, /Verified/);
assert.match(compared[1].text, /Under review/);
const earlier = structuredClone(history.state);
click(compared[0].map, {ctrlKey: true});
assert.deepEqual(history.state, earlier);
click(compared[0].map);
for (let traversal = 0; traversal < 2; traversal++) {
  directory = await mount();
  assert.deepEqual([directory.input.value, directory.year.value, directory.status.value], ['Zhou', '742', 'pending']);
  assert.equal(directory.list.children.length, 40);
  const origin = rowFor(directory.list, '742-64');
  assert.equal(origin.evidence.open, true);
  assert.equal(origin.comparison.open, true);
  compared = comparedRecords(origin.comparison);
  assert.equal(document.activeElement, compared[0].map);
  assert.equal(document.scrolledTo, compared[0].map);
}
click(compared[2].record);
directory = await mount();
const comparison = rowFor(directory.list, '742-64').comparison;
assert.equal(document.activeElement, comparedRecords(comparison)[2].record);
const back = descendants(comparison, 'button').at(-1);
assert(back);
click(back);
assert.equal(comparison.open, false);
assert.equal(document.activeElement, descendants(comparison, 'summary')[0]);
assert.equal(directory.list.children.length, 40);
assert.equal(rowFor(directory.list, '742-64').evidence.open, true);
assert.equal(history.state.other, 'keep');
history.state = {other: 'keep'};

location.search = '?division=742-29&keep=1';
directory = await mount('742-29');
assert.equal(directory.list.children.length, 1);
assert.equal(rowFor(directory.list, '742-29').evidence.open, true);
directory.input.value = '#29';
directory.input.oninput();
assert.equal(location.searchParams.get('keep'), '1');
assert.equal(location.searchParams.get('divisionQuery'), '#29');
assert(!location.searchParams.has('division'));
assert.equal(location.hash, '#view=sources&lang=en');
assert.equal(directory.list.children.length, 2);
for (const id of ['2-29', '742-29']) assert.equal(rowFor(directory.list, id).evidence.open, false);
console.log('Validated directory return, second-page focus, open reviews, modified clicks, and year-specific permalinks');

// Compare all source spellings from an unfiltered directory URL.
location.search = '';
history.state = {other: 'keep'};
directory = await mount('', 'zh');
while (!directory.more.hidden) directory.more.onclick();
const source = JSON.parse(gunzipSync(readFileSync(new URL('../public/data/china-prefectures/index.json.gz', import.meta.url))));
const groups = new Map();
for (const record of source.records) {
  const spelling = record.sourceRecord.PrefNAM;
  if (!groups.has(spelling)) groups.set(spelling, []);
  groups.get(spelling).push(record);
}
let duplicateGroups = 0, duplicateRows = 0;
for (const records of groups.values()) {
  const ids = records.map(record => record.year + '-' + record.sourceRecord.PrefID);
  for (const id of ids) {
    assert.equal(!!rowFor(directory.list, id).comparison, ids.length > 1, id);
  }
  if (ids.length < 2) continue;
  duplicateGroups++;
  duplicateRows += ids.length;
  const {comparison} = rowFor(directory.list, ids[0]);
  setDetailsOpen(comparison, true);
  const compared = comparedRecords(comparison);
  assert.deepEqual(compared.map(r => r.id).sort(), [...ids].sort(), records[0].sourceRecord.PrefNAM);
  for (const entry of compared) {
    const source = records.find(r => r.year + '-' + r.sourceRecord.PrefID === entry.id);
    assert(entry.text.includes('公元 ' + source.year + ' 年'), entry.id);
    assert(entry.text.includes(source.sourceRecord.ProvNAM), entry.id);
    assert.equal(new URLSearchParams(new URL(entry.map.href, location).hash.slice(1)).get('lang'), 'zh');
  }
  if (ids.includes('742-64')) {
    assert.match(elementText(comparison.children[0]), /同拼写|同一来源拼写|相同拼写/);
    assert.match(compared.find(r => r.id === '742-64').text, /桂州/);
    assert.match(compared.find(r => r.id === '742-39').text, /怀泽郡/);
  }
}
assert.equal(duplicateGroups, 77);
assert.equal(duplicateRows, 207);
assert.equal(groups.get('Yi Zhou').length, 9);
console.log('Validated 77 exact source-spelling groups, the Gui Zhou map and record round trip, and bilingual comparisons');

// The shared URL carries a reproducible filter independently of private history state.
location.search = '?divisionQuery=Chun+Zhou&divisionYear=742&divisionStatus=pending&keep=1';
directory = await mount();
assert.equal(directory.input.value, 'Chun Zhou');
assert.equal(directory.year.value, '742');
assert.equal(directory.status.value, 'pending');
assert(directory.list.children.length > 0 && rowFor(directory.list, '742-151'));
let copied;
Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {clipboard: {writeText: async value => {copied=value;}}}});
await directory.copy.onclick();
assert.equal(new URL(copied).searchParams.get('divisionQuery'), 'Chun Zhou');
assert.equal(new URL(copied).searchParams.has('keep'), false);
assert.equal(new URL(copied).hash, '#view=sources&lang=en');
assert.equal(directory.copyStatus.textContent, 'Copied');
directory.input.value='';directory.input.oninput();
directory.year.value='';directory.year.onchange();
directory.status.value='';directory.status.onchange();
assert.equal(location.search,'?keep=1');
assert.equal(directory.copy.hidden,true);
assert.equal(readDivisionDirectoryRoute('?divisionYear=1900&divisionStatus=other'),null);
assert.deepEqual(readDivisionDirectoryRoute('?division=742-16&divisionQuery=ignored'),{id:'742-16'});
console.log('Verified shareable query, year and status, record priority, clipboard URL and clearing');
