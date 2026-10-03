import {readFile,writeFile} from 'node:fs/promises';
const root='/Users/zane/meridian_atlas/world-history-atlas';
let text=await readFile(root+'/docs/verification-3.32/fetch-polity-extracts-3.32.mjs','utf8');
text=text.split('3.32').join('3.33');
await writeFile(root+'/docs/verification-3.33/fetch-polity-extracts-3.33.mjs',text);
for (const name of ['build-narratives-batch','clean-coverage-notes','write-narratives-gz','check-lengths']) {
  const src = name==='check-lengths' ? '/docs/verification-3.32/'+name+'-3.32.mjs' : '/docs/verification-3.32/'+name+'-3.32.mjs';
  let t = await readFile(root+src,'utf8');
  t = t.split('3.32').join('3.33');
  await writeFile(root+'/docs/verification-3.33/'+name+'-3.33.mjs', t);
}
console.log('round-12 tools ready');
