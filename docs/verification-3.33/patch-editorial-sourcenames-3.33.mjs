import {readFile,writeFile} from 'node:fs/promises';
const root='/Users/zane/meridian_atlas/world-history-atlas';
const ex=JSON.parse(await readFile(root+'/docs/verification-3.33/narratives-extracts.json','utf8'));
const byQ=new Map(ex.entries.map(e=>[e.qid,e]));
const ep=root+'/editorial/enrichment-narratives-3.12.json';
const ed=JSON.parse(await readFile(ep,'utf8'));
let fixed=0;
for(const e of ed.entries){
  if(Array.isArray(e.sourceNames)&&e.sourceNames.length) continue;
  const src=byQ.get(e.qid);
  if(src&&Array.isArray(src.sourceNames)&&src.sourceNames.length){ e.sourceNames=[...src.sourceNames]; fixed++; }
}
await writeFile(ep,JSON.stringify(ed,null,2)+'\n');
console.log(JSON.stringify({fixed,entries:ed.entries.length}));
