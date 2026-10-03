import {readFile,writeFile,unlink,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const root='/Users/zane/meridian_atlas/world-history-atlas';
// 1. remove the copies that the 3.26 copy step created inside this round's directory by mistake
const dir=resolve(root,'docs/verification-3.26');
const stale=(await readdir(dir)).filter(name=>name.endsWith('-3.23.mjs'));
for(const name of stale)await unlink(resolve(dir,name));
// 2. build this round's builder: same code as the 3.26 builder, but the parts and the statistics
// live in docs/verification-3.27, while the chosen plans and the verified extracts are read from
// docs/verification-3.26 where the selection and the identity checks were made.
let text=await readFile(resolve(dir,'build-narratives-batch-3.26.mjs'),'utf8');
text=text.replaceAll('docs/verification-3.26/authoring','docs/verification-3.27/authoring');
text=text.replaceAll('docs/verification-3.26/narratives-batch-stats.json','docs/verification-3.27/narratives-batch-stats.json');
text=text.replaceAll("Usage: node docs/verification-3.26/build-narratives-batch-3.26.mjs","Usage: node docs/verification-3.27/build-narratives-batch-3.27.mjs");
text=text.replaceAll('docs/verification-3.26/select-narratives-3.26.mjs','docs/verification-3.26/select-narratives-3.26.mjs (the selection and identity checks were made in that round)');
text=text.replace("const extracts=await read('docs/verification-3.26/narratives-extracts.json');","const extracts=await read('docs/verification-3.26/narratives-extracts.json');");
await writeFile(resolve(root,'docs/verification-3.27/build-narratives-batch-3.27.mjs'),text);
console.log(JSON.stringify({removed:stale}));
