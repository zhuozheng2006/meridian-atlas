import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {POLARIS_VARIABLES as variables, POLARIS_CODES as codes, CRISIS_FIELDS as crisis} from '../public/polaris-vocabulary.js';

const read = async name => JSON.parse(await readFile(new URL(`../docs/verification-3.38/polaris/polaris-review-${name}`, import.meta.url), 'utf8'));
const inventory = await read('variable-inventory.json');
const enums = await read('enum-review.json');
const edge = await read('polaris-edge-audit.json');
assert.equal(Object.keys(variables).length, 173);
assert.equal(Object.keys(codes).length, 19);
assert.equal(Object.keys(crisis).length, 21);
for (const source of inventory) {
  const row = variables[source.id];
  assert.ok(row, source.id);
  for (const field of ['id','zh','en','domain','sheet','unitZh','unitEn','unitEvidence']) assert.equal(row[field], source[field]);
  assert.equal(row.section, source.source.section);
  assert.equal(row.definitionReview.status, source.labelReview.status);
  assert.equal(row.definitionReview.scope, 'display-label');
  assert.equal(row.definitionReview.noteZh, source.labelReview.noteZh);
  assert.deepEqual(row.searchTerms, source.searchTerms);
  assert.ok(Object.isFrozen(row));
  assert.ok(Object.isFrozen(row.searchTerms));
  assert.equal(Object.hasOwn(row, 'equinoxMapping'), false);
}
for (const source of enums.codes) {
  const row = codes[source.raw];
  assert.equal(row.zh, source.displayHintZh);
  assert.equal(row.evidence, source.evidence);
  assert.ok(row.en);
  assert.ok(Object.isFrozen(row));
}
for (const code of ['DIS','A~P','P~A']) {
  assert.equal(codes[code].status, 'unresolved');
  assert.match(codes[code].en, /exact meaning unverified/);
}
assert.equal(codes.unknown.en, 'Unknown');
assert.equal(codes.uncoded.en, 'Not yet coded');
assert.notEqual(codes.unknown.en, codes.A.en);
assert.equal(Object.hasOwn(codes, 'null'), false);
assert.equal(Object.hasOwn(codes, 'false'), false);

const sourceOutcomes = Object.keys(edge.crisisFields).filter(key => !['seshat_region','section','variable_name','is_disputed','is_uncertain'].includes(key));
assert.deepEqual(Object.keys(crisis), sourceOutcomes);
for (const field of Object.values(crisis)) {
  assert.equal(field.status, 'provisional-definition-needed');
  assert.ok(field.zh && field.en && field.noteZh && field.noteEn);
  assert.ok(Object.isFrozen(field));
}
assert.equal(variables.largest_communication_distance.unitEn, 'km');
assert.equal(variables.fastest_individual_communication.unitEn, 'days');
for (const id of ['length_measurement_system','area_measurement_system','occupational_complexity']) {
  assert.equal(Object.hasOwn(variables[id], 'unitZh'), false);
}
assert.equal(variables.sync_rel_pra_ind_beli.definitionReview.status, 'provisional-definition-needed');
assert.throws(() => { variables.bronze.zh = '铁'; }, TypeError);
assert.throws(() => { variables.bronze.searchTerms.push('Iron'); }, TypeError);
assert.equal(variables.bronze.zh, '军用青铜');
assert.equal(variables.nonwritten_record.zh, '非文字记录');
console.log(JSON.stringify({passed:true, variables:173, codes:19, crisisFields:21,
  checked:'source agreement, unresolved-code boundaries, correct units, absent mappings, nested immutability'}, null, 2));
