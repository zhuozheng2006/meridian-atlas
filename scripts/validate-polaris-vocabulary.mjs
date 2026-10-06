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
  for (const field of ['id','domain','sheet','unitZh','unitEn','unitEvidence']) assert.equal(row[field], source[field]);
  if (source.id !== 'sync_rel_pra_ind_beli') {
    for (const field of ['zh','en']) assert.equal(row[field], source[field]);
    assert.deepEqual(row.searchTerms, source.searchTerms);
  }
  assert.equal(row.section, source.source.section);
  assert.equal(row.definitionReview.status, source.id === 'crisis-consequences' ? 'reviewed-label' : source.labelReview.status);
  assert.equal(row.definitionReview.scope, 'display-label');
  if (!['sync_rel_pra_ind_beli','crisis-consequences'].includes(source.id)) assert.equal(row.definitionReview.noteZh, source.labelReview.noteZh);
  assert.ok(Object.isFrozen(row));
  assert.ok(Object.isFrozen(row.searchTerms));
  assert.equal(Object.hasOwn(row, 'equinoxMapping'), false);
}
for (const source of enums.codes) {
  const row = codes[source.raw];
  if (!['SU','DIS','A~P','P~A'].includes(source.raw)) {
    assert.equal(row.zh, source.displayHintZh);
    assert.equal(row.evidence, source.evidence);
  }
  assert.ok(row.en);
  assert.ok(Object.isFrozen(row));
}
for (const code of ['SU','DIS','A~P','P~A']) {
  assert.equal(codes[code].status, 'source-explicit');
  assert.ok(codes[code].definition.zh && codes[code].definition.en);
  assert.ok(codes[code].sourceRefs.length);
}
assert.equal(codes['A~P'].en, 'Transition from absent to present');
assert.equal(codes['P~A'].en, 'Transition from present to absent');
assert.equal(codes.DIS.en, 'Disputed source coding');
assert.equal(codes.SU.en, 'Suspected unknown');
for (const code of ['SA','SP','IU']) assert.equal(codes[code].status, 'provisional');
assert.equal(codes.unknown.en, 'Unknown');
assert.equal(codes.uncoded.en, 'Not yet coded');
assert.notEqual(codes.unknown.en, codes.A.en);
assert.equal(Object.hasOwn(codes, 'null'), false);
assert.equal(Object.hasOwn(codes, 'false'), false);

const sourceOutcomes = Object.keys(edge.crisisFields).filter(key => !['seshat_region','section','variable_name','is_disputed','is_uncertain'].includes(key));
assert.deepEqual(Object.keys(crisis), sourceOutcomes);
for (const field of Object.values(crisis)) {
  assert.equal(field.status, 'official-definition-read');
  assert.ok(field.zh && field.en && field.definition.zh && field.definition.en);
  assert.equal(field.definitionReview.scope, 'current-official-explanatory-overlay');
  assert.ok(Object.isFrozen(field));
  assert.ok(Object.isFrozen(field.definition));
  assert.ok(Object.isFrozen(field.evidence.lines));
}
assert.equal(variables.largest_communication_distance.unitEn, 'km');
assert.equal(variables.fastest_individual_communication.unitEn, 'days');
for (const id of ['length_measurement_system','area_measurement_system','occupational_complexity']) {
  assert.equal(Object.hasOwn(variables[id], 'unitZh'), false);
}
assert.equal(variables.sync_rel_pra_ind_beli.definitionReview.status, 'provisional-definition-needed');
assert.equal(variables.sync_rel_pra_ind_beli.zh, '信徒个人层面的宗教实践混融');
assert.equal(variables.sync_rel_pra_ind_beli.semanticReview.criteriaStatus, 'pending');
assert.equal(Object.values(variables).filter(row => row.definitionReview.status === 'provisional-definition-needed').length, 17);
assert.throws(() => { variables.bronze.zh = '铁'; }, TypeError);
assert.throws(() => { variables.bronze.searchTerms.push('Iron'); }, TypeError);
assert.equal(variables.bronze.zh, '军用青铜');
assert.equal(variables.nonwritten_record.zh, '非文字记录');
console.log(JSON.stringify({passed:true, variables:173, codes:19, crisisFields:21,
  checked:'unchanged source vocabulary except explicit reviewed overlays, directional codes, pending criteria, correct units, absent mappings, nested immutability'}, null, 2));
