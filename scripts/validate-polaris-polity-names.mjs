import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {polarisPolityName as name, polarisPolitySearchText as search, polarisPolityNameNote as note} from '../public/polaris-polity-names.js';

const index = JSON.parse(gunzipSync(await readFile(new URL('../public/data/seshat-polaris-2026/index.json.gz', import.meta.url))));
const reviewed = JSON.parse(await readFile(new URL('../docs/verification-3.38/polaris/polaris-names-polity-names.json', import.meta.url), 'utf8'));
const byId = new Map(reviewed.map(row => [row.polity_id, row]));
const qinReview = JSON.parse(await readFile(new URL('../docs/verification-3.39/semantic-evidence/polity-name-candidates.json', import.meta.url), 'utf8'))[0];
assert.equal(qinReview.polity_id, 'cn_qin_emp');
assert.equal(qinReview.allowDateCorrection, false);
assert.equal(qinReview.allowIdentityMerge, false);
byId.set(qinReview.polity_id, {...byId.get(qinReview.polity_id), zh:qinReview.zh, status:'complete', note:qinReview.noteZh});
const names342=JSON.parse(await readFile(new URL('../docs/verification-3.42/phase-names/polity-name-candidates.json',import.meta.url),'utf8'));
for(const row of names342){assert.equal(row.allowDateCorrection,false);assert.equal(row.allowIdentityMerge,false);byId.set(row.polity_id,{...byId.get(row.polity_id),zh:row.zh,status:'complete',note:row.noteZh});}
const originalIndex = JSON.stringify(index);
let translated = 0;
for (const polity of index.polities) {
  const row = byId.get(polity.id);
  assert.ok(row);
  assert.equal(name(polity, 'en'), polity.names.join(' / '));
  assert.equal(name(polity, 'zh'), row.status === 'complete' ? row.zh : row.sourceName);
  assert.equal(name(polity, 'bi'), row.status === 'complete' ? `${row.zh} · ${row.sourceName}` : row.sourceName);
  if (row.status === 'complete') { translated++; assert.ok(search(polity).includes(row.zh.toLowerCase())); }
  assert.ok(search(polity).includes(row.polity_id.toLowerCase()));
  const generic = row.note === '本批尚未完成可靠中文译名审核，保留来源英文。';
  assert.equal(note(polity, 'zh'), generic ? '' : row.note);
  if (note(polity, 'zh')) {
    assert.ok(note(polity, 'en'));
    assert.doesNotMatch(note(polity, 'en'), /[\u3400-\u9fff]/);
    assert.equal(note(polity, 'bi'), `${note(polity, 'zh')} ${note(polity, 'en')}`);
  }
}
assert.equal(translated, 383);
assert.equal(JSON.stringify(index), originalIndex, 'display/search must not change the source index');
const ming = index.polities.find(p => p.id === 'cn_ming_dyn');
assert.equal(name(ming), '明朝');
assert.ok(search(ming).includes('明朝'));

const mismatches = [
  p => { p.names = ['Changed source name']; },
  p => { p.sourceNumber = '83'; },
  p => { p.sourceNumber = 269; },
  p => { p.periods[0].sourceRow = '80'; },
  p => { p.periods[0].sourceSheet = 'General'; },
  p => { p.periods[0].startRaw = '1400'; },
  p => { p.periods[0].endRaw = '1643'; },
  p => { p.regions = ['Andes']; },
  p => { p.samplingAreas = ['Cuzco']; },
  p => { p.names.push('Additional name'); },
  p => { p.periods.push({...p.periods[0]}); },
];
for (const mutate of mismatches) {
  const changed = structuredClone(ming); mutate(changed);
  assert.equal(name(changed), changed.names.join(' / '));
  assert.equal(note(changed), '');
  assert.ok(!search(changed).includes('明朝'));
}
for(const row of names342){const p=index.polities.find(p=>p.id===row.polity_id);assert.equal(name(p),row.zh);assert.equal(name(p,'en'),row.sourceName);for(const mutate of mismatches){const altered=structuredClone(p);mutate(altered);assert.equal(name(altered),altered.names.join(' / '));}}
const malacca = index.polities.filter(p => p.names[0] === 'Malacca Sultanate');
assert.equal(malacca.length, 2);
assert.equal(name(malacca.find(p => p.id.endsWith('22222'))), 'Malacca Sultanate');
assert.equal(name(malacca.find(p => !p.id.endsWith('22222'))), '马六甲苏丹国');
const qin = index.polities.find(p => p.id === 'cn_qin_emp');
assert.equal(name(qin), '秦帝国');
assert.equal(name(qin, 'en'), 'Qin Empire');
assert.ok(search(qin).includes('秦'));
assert.equal(qin.periods[0].startRaw, '-338');
assert.equal(qin.periods[0].endRaw, '-207');
assert.equal(qin.periods[0].sourceRow, '234');
assert.equal(qin.sourceNumber, '250');
assert.equal(note(qin, 'en'), qinReview.noteEn);
const independentlyRedatedQin = structuredClone(qin);
independentlyRedatedQin.periods[0].startRaw = '-221';
assert.equal(name(independentlyRedatedQin), 'Qin Empire');
assert.equal(note(independentlyRedatedQin), '');
assert.equal(name({id:'__proto__',names:['Literal source']}), 'Literal source');
assert.equal(name(null), '');
assert.equal(note(null), '');
console.log(JSON.stringify({passed:true, phases:626, translated, fallback:243, mismatchRegressions:mismatches.length*(names342.length+1)+1, reviewedNames342:names342.length,
  checked:'actual source index, bilingual notes, source authority, row/number/period/region binding, immutable display'}, null, 2));
