import assert from 'node:assert/strict';
import {readFile, readdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {POLARIS_VARIABLES, POLARIS_CODES, CRISIS_FIELDS, POLARIS_SEMANTIC_SOURCE} from '../public/polaris-vocabulary.js';

const root = new URL('../', import.meta.url);
const read = async path => readFile(new URL(path, root));
const json = async path => JSON.parse(await read(path));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const version = '1f847d95e224860115a3dc358165380fe5487bcd';
const manifest = await json('public/data/research-evidence/semantic-3.39/source-manifest.json');
assert.equal(manifest.schemaVersion, 1);
assert.equal(POLARIS_SEMANTIC_SOURCE.version, version);
assert.equal(POLARIS_SEMANTIC_SOURCE.workbookSha256, 'cf60c9f76eeda6db545521831a9201e65c64d2b74d4aeb55445cd2b564456c41');
assert.equal(POLARIS_SEMANTIC_SOURCE.committedAt, '2026-09-29T12:37:09Z');
assert.deepEqual(manifest.source, POLARIS_SEMANTIC_SOURCE);
assert.ok(Object.isFrozen(POLARIS_SEMANTIC_SOURCE));
assert.equal(manifest.files.length, 8);
assert.equal(new Set(manifest.files.map(file => file.path)).size, 8);
const originals = new Map();
for (const file of manifest.files) {
  assert.match(file.path, /^data\/research-evidence\/semantic-3\.39\/raw\/[a-zA-Z0-9_.-]+\.txt$/);
  assert.equal(file.sourceVersion, version);
  assert.equal(file.url, `https://raw.githubusercontent.com/Seshat-Global-History-Databank/seshat/${version}/${file.repositoryPath}`);
  const bytes = await read('public/' + file.path);
  assert.equal(bytes.length, file.bytes);
  assert.equal(digest(bytes), file.sha256);
  originals.set(file.path, {file, lines:bytes.toString('utf8').split('\n')});
}
let references = 0;
function checkReference(ref) {
  const source = originals.get(ref.localPath);
  assert.ok(source, ref.localPath);
  assert.equal(ref.sourceVersion, version);
  assert.equal(ref.sha256, source.file.sha256);
  assert.equal(ref.lines.length, 2);
  const [start, end] = ref.lines;
  assert.ok(Number.isSafeInteger(start) && Number.isSafeInteger(end));
  assert.ok(start >= 1 && end >= start && end <= source.lines.length);
  const anchor = start === end ? `#L${start}` : `#L${start}-L${end}`;
  assert.equal(ref.url, `https://github.com/Seshat-Global-History-Databank/seshat/blob/${version}/${source.file.repositoryPath}${anchor}`);
  references++;
  return source.lines.slice(start - 1, end).join('\n');
}
for (const [key, field] of Object.entries(CRISIS_FIELDS)) {
  assert.equal(field.status, 'official-definition-read');
  assert.equal(field.evidence.sha256, 'fc5cf2655d8c3d77159f003431a7f822dbd18771c7b7ec64591124cde1056f72');
  assert.ok(checkReference(field.evidence).includes(`"${key}"`), key);
  for (const ref of field.sourceRefs) checkReference(ref);
}
for (const code of ['SU','DIS','A~P','P~A']) {
  const texts = POLARIS_CODES[code].sourceRefs.map(checkReference).join('\n');
  assert.ok(texts.includes(code));
  if (code === 'SU') assert.ok(texts.includes('Suspected Unknown') && texts.includes('only be assigned to rows coded as'));
  if (code === 'DIS') assert.ok(texts.includes('Disputed'));
  if (code === 'A~P') assert.ok(texts.includes('Absent → Present'));
  if (code === 'P~A') assert.ok(texts.includes('Present → Absent'));
}
const reviewed = Object.values(POLARIS_VARIABLES).filter(row => row.semanticReview);
assert.equal(reviewed.length, 18);
assert.deepEqual(reviewed.filter(row => row.semanticReview.criteriaStatus !== 'pending').map(row => row.id), ['crisis-consequences']);
for (const row of reviewed) for (const ref of row.semanticReview.sourceRefs) checkReference(ref);
const syncretism = POLARIS_VARIABLES.sync_rel_pra_ind_beli;
assert.ok(syncretism.semanticReview.sourceRefs.map(checkReference).join('\n').includes('Syncretism of Religious Practices at the Level of Individual Believers'));
assert.equal(syncretism.semanticReview.criteriaStatus, 'pending');
for (const code of ['SA','SP']) {
  assert.equal(POLARIS_CODES[code].status, 'provisional');
  assert.equal(POLARIS_CODES[code].definition, undefined);
}
// The interpretation overlay must never alter the pinned observation archive.
const before = await json('docs/verification-3.39/semantic-evidence/archive-before.json');
assert.equal(before.root, 'public/data/seshat-polaris-2026');
async function filesUnder(path) {
  const files = [];
  for (const entry of await readdir(new URL(path + '/', root), {withFileTypes:true})) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(child));
    else if (entry.isFile()) files.push(child);
    else assert.fail('Unexpected non-file archive entry: ' + child);
  }
  return files;
}
const archiveFiles = (await filesUnder(before.root)).sort();
assert.equal(archiveFiles.length, 643);
assert.deepEqual(archiveFiles.map(path => path.slice(before.root.length + 1)), Object.keys(before.files).sort());
for (const path of archiveFiles) assert.equal(digest(await read(path)), before.files[path.slice(before.root.length + 1)], path);
const report = {passed:true, sourceVersion:version, sourceFiles:originals.size, checkedLineReferences:references, crisisFields:21, codeDefinitions:4, variablesWithReviewedEvidence:18, criteriaStillPending:17, originalArchiveFilesUnchanged:archiveFiles.length, workbookSha256:POLARIS_SEMANTIC_SOURCE.workbookSha256};
if (process.env.POLARIS_SEMANTIC_REPORT) await writeFile(process.env.POLARIS_SEMANTIC_REPORT, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
