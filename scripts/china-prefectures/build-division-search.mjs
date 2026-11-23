// Derive only the names and camera needed for map search. Source prose and shapes remain in the reader.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {gunzipSync, gzipSync} from 'node:zlib';
import {chinaDisplayName} from '../../public/china-prefectures.js';
import {reviewedChinaName} from '../../public/china-name-reviews.js';

const publicDir = new URL('../../public/', import.meta.url);
const source = JSON.parse(gunzipSync(readFileSync(new URL('data/china-prefectures/index.json.gz', publicDir))));
const rows = source.records.map(record => {
  const review = reviewedChinaName(record);
  const {zh, en} = chinaDisplayName(record, review);
  const {PrefID, PrefNAM, ProvNAM} = record.sourceRecord;
  const [west, south, east, north] = record.bounds;
  return {
    year: record.year, prefId: PrefID, zh, en, sourceName: PrefNAM, parent: ProvNAM, verified: !!review,
    ...(review?.formerNameZh ? {formerZh: review.formerNameZh} : {}),
    center: [Number(((west + east) / 2).toFixed(5)), Number(((south + north) / 2).toFixed(5))]
  };
});
const bytes = gzipSync(Buffer.from(JSON.stringify({version: 1, rows})), {level: 9});
const out = new URL('data/fast/division-search.json.gz', publicDir);
if (process.argv.includes('--check')) {
  assert(readFileSync(out).equals(bytes), 'Rebuild the map division search index');
} else {
  writeFileSync(out, bytes);
}
console.log('Division search index:', rows.length, 'rows,', bytes.length, 'gzip bytes');
