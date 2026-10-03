import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root='/Users/zane/meridian_atlas/world-history-atlas';
let text=await readFile(resolve(root,'docs/verification-3.29/build-narratives-batch-3.29.mjs'),'utf8');
text=text.replaceAll('docs/verification-3.29/authoring','docs/verification-3.30/authoring');
text=text.replaceAll('docs/verification-3.29/narratives-batch-stats.json','docs/verification-3.30/narratives-batch-stats.json');
text=text.replaceAll('3.29','3.30');
await writeFile(resolve(root,'docs/verification-3.30/build-narratives-batch-3.30.mjs'),text);
// the coverage-note cleaning step is a fixed part of every round
let clean=await readFile(resolve(root,'docs/verification-3.29/clean-coverage-notes-3.29.mjs'),'utf8');
clean=clean.replaceAll('3.29','3.30');
await writeFile(resolve(root,'docs/verification-3.30/clean-coverage-notes-3.30.mjs'),clean);
let gz=await readFile(resolve(root,'docs/verification-3.29/write-narratives-gz-3.29.mjs'),'utf8');
gz=gz.replaceAll('3.29','3.30');
await writeFile(resolve(root,'docs/verification-3.30/write-narratives-gz-3.30.mjs'),gz);
console.log('round-9 tooling ready');
