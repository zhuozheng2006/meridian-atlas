import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root='/Users/zane/meridian_atlas/world-history-atlas';
const out=root+'/docs/verification-3.36';
await mkdir(out+'/authoring',{recursive:true});
for (const name of ['choose-narratives','fetch-polity-extracts','check-lengths','build-narratives-batch','clean-coverage-notes','write-narratives-gz','patch-editorial-sourcenames','patch-sourcenames','check-bindings']) {
  const from = name.startsWith('choose')||name.startsWith('fetch') ? '3.35' : '3.35';
  let t = await readFile(root+'/docs/verification-'+from+'/'+name+'-'+from+'.mjs','utf8');
  t = t.split('3.35').join('3.36');
  await writeFile(out+'/'+name+'-3.36.mjs', t);
}
// keep the round-14 candidate/verification artefacts as this round's source pool
for (const f of ['narratives-candidates.json']) {
  const t = await readFile(root+'/docs/verification-3.35/'+f,'utf8');
  await writeFile(out+'/'+f, t);
}
console.log('round-3.36 tools ready');
