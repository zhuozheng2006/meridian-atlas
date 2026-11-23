import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';

const publicDir = new URL('../../public/', import.meta.url);
const audit = JSON.parse(readFileSync(new URL('data/china-prefectures/name-audit.json', publicDir)));
const reviews = Object.fromEntries(audit.records.map(review => [review.id, review]));
assert.equal(Object.keys(reviews).length, audit.records.length, 'Duplicate approved record ID');

const output = `// Generated from data/china-prefectures/name-audit.json by build-name-reviews.mjs.
export const chinaNameReviews = ${JSON.stringify(reviews)};

export function reviewedChinaName(record) {
  const review = chinaNameReviews[record?.id];
  if (!review || !record.sourceRecord) return null;
  const {PrefID, PrefNAM, ProvNAM} = record.sourceRecord;
  return review.year === record.year && review.PrefID === PrefID &&
    review.sourcePrefNAM === PrefNAM && review.ProvNAM === ProvNAM ? review : null;
}
`;
const target = new URL('china-name-reviews.js', publicDir);
if (process.argv.includes('--check')) {
  assert.equal(readFileSync(target, 'utf8'), output, 'Rebuild the approved name reviews');
} else {
  writeFileSync(target, output);
}
