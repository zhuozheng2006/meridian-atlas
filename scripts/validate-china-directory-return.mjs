import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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

async function mount(initialId = '') {
  const controls = Object.fromEntries([
    ['input', 'input'], ['[name="year"]', 'select'], ['[name="status"]', 'select'],
    ['ul', 'ul'], ['[role="status"]', 'p'], ['[data-more]', 'button']
  ].map(([key, tag]) => [key, new Element(tag)]));
  const host = {isConnected: true, querySelector: selector => controls[selector]};
  await mountDivisionLedger(host, 'en', initialId, history.state.atlasDivisionDirectory);
  return {
    input: controls.input, year: controls['[name="year"]'], status: controls['[name="status"]'],
    list: controls.ul, more: controls['[data-more]'], count: controls['[role="status"]']
  };
}

function rowFor(list, id) {
  for (const row of list.children) {
    const locate = row.children.find(el => el.tag === 'a');
    const params = new URLSearchParams(new URL(locate.href, location).hash.slice(1));
    if (params.get('boundary') === 'china-prefecture-' + id) {
      return {locate, evidence: row.children.find(el => el.tag === 'details')};
    }
  }
}
function click(link, modifiers = {}) {
  link.dispatchEvent(Object.assign(new Event('click', {cancelable: true}), {button: 0}, modifiers));
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
history.state = {other: 'keep'};

location.search = '?division=742-29&keep=1';
directory = await mount('742-29');
assert.equal(directory.list.children.length, 1);
assert.equal(rowFor(directory.list, '742-29').evidence.open, true);
directory.input.value = '#29';
directory.input.oninput();
assert.equal(location.search, '?keep=1');
assert.equal(location.hash, '#view=sources&lang=en');
assert.equal(directory.list.children.length, 2);
for (const id of ['2-29', '742-29']) assert.equal(rowFor(directory.list, id).evidence.open, false);
console.log('Validated directory return, second-page focus, open reviews, modified clicks, and year-specific permalinks');
