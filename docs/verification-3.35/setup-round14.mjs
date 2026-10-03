import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root='/Users/zane/meridian_atlas/world-history-atlas';
const out=root+'/docs/verification-3.35';
await mkdir(out+'/authoring',{recursive:true});
for (const name of ['select-narratives','verify-candidates','choose-narratives','fetch-polity-extracts']) {
  let t = await readFile(root+'/docs/verification-3.32/'+name+'-3.32.mjs','utf8');
  t = t.split('3.32').join('3.35');
  // raise the per-region verification caps (availability calibration round)
  t = t.replace(/const priority=\{[^}]*\};/, "const priority={europe:300,africa:150,'west-central-asia':120,'south-asia':120,americas:100,'east-asia':100,'southeast-asia':80,oceania:60,global:60};");
  await writeFile(out+'/'+name+'-3.35.mjs', t);
}
for (const name of ['check-lengths','build-narratives-batch','clean-coverage-notes','write-narratives-gz','patch-editorial-sourcenames','patch-sourcenames']) {
  let t = await readFile(root+'/docs/verification-3.34/'+name+'-3.34.mjs','utf8');
  t = t.split('3.34').join('3.35');
  await writeFile(out+'/'+name+'-3.35.mjs', t);
}
console.log('round-3.35 tools ready');
