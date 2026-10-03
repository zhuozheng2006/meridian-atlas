import {readFile,writeFile} from 'node:fs/promises';
const root='/Users/zane/meridian_atlas/world-history-atlas';
const cp=root+'/docs/verification-3.33/narratives-chosen.json';
const ep=root+'/docs/verification-3.33/narratives-extracts.json';
const chosen=JSON.parse(await readFile(cp,'utf8'));
const ex=JSON.parse(await readFile(ep,'utf8'));
const byQ=new Map(chosen.entries.map(e=>[e.qid,e]));
let added=0;
for(const e of ex.entries){ const c=byQ.get(e.qid); if(c&&!e.region){ e.region=c.region; e.score=c.score; added++; } }
await writeFile(ep,JSON.stringify(ex,null,2)+'\n');
const counts={};
for(const e of ex.entries) counts[e.region]=(counts[e.region]||0)+1;
console.log(JSON.stringify({patched:added,byRegion:counts}));
