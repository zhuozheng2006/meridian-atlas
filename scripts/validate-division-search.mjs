import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {findMapDivisions, mapDivisionHref} from '../public/division-search.js';
import {divisionMapLink} from '../public/china-name-ledger.js';
import {reviewedChinaName} from '../public/china-name-reviews.js';
import {chinaDisplayName} from '../public/china-prefectures.js';

const root = new URL('../public/', import.meta.url);
const source = JSON.parse(gunzipSync(readFileSync(new URL('data/china-prefectures/index.json.gz', root))));
const dataURL = 'data/fast/division-search.json.gz';
const bytes = readFileSync(new URL(dataURL, root));
const calls = [];
const fetchBefore = globalThis.fetch;
try {
  let offline = true;
  globalThis.fetch = async url => {
    calls.push(url);
    assert.equal(url, dataURL, 'Searching must not request evidence or geometry');
    return offline ? new Response('Unavailable', {status: 503}) : new Response(bytes);
  };
  assert.deepEqual(await findMapDivisions(' ', 2), []);
  assert.deepEqual(calls, []);
  await assert.rejects(findMapDivisions('桂州', 742), /503/);
  offline = false;
  const [gui, duplicate] = await Promise.all([findMapDivisions('Gui Zhou', 1492), findMapDivisions('gui zhou', 2)]);
  assert.deepEqual(gui, duplicate);
  assert.deepEqual(gui.filter(row => row.exact).map(row => row.prefId), [39, 64, 134, 145, 317]);
  assert.equal(new Set(gui.map(row => row.parent)).size, 4);
  assert.deepEqual(calls, [dataURL, dataURL]);

  const allIds = source.records.map(r => r.id);
  const qualified = await Promise.all(allIds.map(id => findMapDivisions(id, 1492)));
  for (let i = 0; i < qualified.length; i++) {
    const record = source.records[i], review = reviewedChinaName(record);
    const result = qualified[i];
    assert.equal(result.length, 1, record.id);
    const [hit] = result;
    assert.equal(hit.id, record.id);
    assert(hit.exact);
    assert.equal(hit.verified, !!review);
    assert.deepEqual([hit.zh, hit.en], Object.values(chinaDisplayName(record, review)));
    assert.equal(hit.sourceName, record.sourceRecord.PrefNAM);
    assert.equal(hit.parent, record.sourceRecord.ProvNAM);
    assert.equal(mapDivisionHref(hit, 'en'), divisionMapLink(record, 'en'));
  }
  for (const [q, id] of [['京兆尹','2-33'], ['郴州','742-67'], ['桂阳郡','742-67'], ["Wu'e Zhou",'742-10']]) {
    assert((await findMapDivisions(q, 742)).some(row => row.exact && row.id === 'china-prefecture-' + id));
  }
  assert((await findMapDivisions(' Wúe Zhou ', 742)).some(row => row.prefId === 10 && !row.exact));
  assert.deepEqual((await findMapDivisions('#64', 2)).map(row => row.year), [2, 742]);
  assert.deepEqual((await findMapDivisions('64', 1492)).map(row => row.year), [742, 2]);
  assert.deepEqual((await findMapDivisions('PrefID 64', 742)).map(row => row.year), [742, 2]);
  assert.deepEqual((await findMapDivisions('#742-64', 2)).map(row => row.id), ['china-prefecture-742-64']);
  for (const q of ['3-64', '#000', '742-0', '742-400', '742-64x', 'china-prefecture-742-64-1']) {
    assert.deepEqual(await findMapDivisions(q, 742), [], q);
  }
  assert.deepEqual(calls, [dataURL, dataURL], 'All later queries reuse the successful index');
} finally {
  globalThis.fetch = fetchBefore;
}
console.log('Validated lightweight map search, retry, exact aliases, 420 map links and both snapshot years');
