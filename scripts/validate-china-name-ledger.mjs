import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {divisionRows, matchDivisions, divisionMapLink, groupSourceSpellings} from '../public/china-name-ledger.js';
import {decodeCamera} from '../public/view-state.js';

const root = new URL('../public/data/china-prefectures/', import.meta.url);
const index = JSON.parse(gunzipSync(readFileSync(new URL('index.json.gz', root))));
const audit = JSON.parse(readFileSync(new URL('name-audit.json', root)));
const rows = divisionRows(index);
assert.equal(rows.length, 420);
assert.deepEqual(matchDivisions(rows, '', '', 'pending').map(row => row.record.id).sort(), audit.deferred.map(item => item.id).sort());
assert.deepEqual(matchDivisions(rows, '', '', 'verified').map(row => row.record.id).sort(), audit.records.map(item => item.id).sort());
assert.equal(matchDivisions(rows, '#29', '742', '')[0].record.sourceRecord.PrefNAM, 'Tang Zhou');
assert.equal(matchDivisions(rows, '742-29', '', '').length, 1);
assert.equal(matchDivisions(rows, 'china-prefecture-742-29', '', '')[0].PrefID, 29);
assert.equal(matchDivisions(rows, '  tÁnG zHOu  ', '742', '').some(row => row.PrefID === 29), true);
assert.equal(matchDivisions(rows, '京兆尹', '2', 'verified').length, 1);
assert.equal(matchDivisions(rows, '742-29', '2', '').length, 0);
assert.equal(matchDivisions(rows, 'Wue Zhou', '742', 'verified')[0].PrefID, 10);
assert.equal(matchDivisions(rows, '武峩州', '742', 'verified')[0].PrefID, 10);
// Comparison uses the source spelling verbatim, independently of the search normalizer.
const spellings = ["Wu'e Zhou", 'Wue Zhou', "Wú'e Zhou", "WU'E ZHOU", "Wu'e Zhou", 'Wu’e Zhou', ''];
const samples = spellings.map(PrefNAM => ({record: {sourceRecord: {PrefNAM}}}));
const groups = groupSourceSpellings(samples);
assert.deepEqual(groups.get("Wu'e Zhou"), [samples[0], samples[4]]);
for (const i of [1, 2, 3, 5]) assert.deepEqual(groups.get(spellings[i]), [samples[i]]);
assert(!groups.has(''));
for (const {record} of rows) {
  const url = new URL(divisionMapLink(record, 'en'), 'https://example.org/meridian-atlas/');
  assert.equal(url.pathname, '/meridian-atlas/');
  const params = new URLSearchParams(url.hash.slice(1));
  assert.equal(params.get('year'), String(record.year));
  assert.equal(params.get('lang'), 'en');
  assert.equal(params.get('boundaries'), 'regional');
  assert.equal(params.get('boundary'), record.id);
  const {center: [lon, lat], zoom} = decodeCamera(params.get('camera'));
  const [west, south, east, north] = record.bounds;
  assert(lon >= west && lon <= east && lat >= south && lat <= north && zoom >= 6);
}
console.log('Validated 420 Han and Tang directory records, status filters, name/ID search, and map links');
await import('./validate-china-directory-return.mjs');
