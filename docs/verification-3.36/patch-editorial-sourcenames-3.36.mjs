import {readFile,writeFile} from 'node:fs/promises';
const root='/Users/zane/meridian_atlas/world-history-atlas';
const ex=JSON.parse(await readFile(root+'/docs/verification-3.36/narratives-extracts.json','utf8'));
const byQ=new Map(ex.entries.map(e=>[e.qid,e]));
const ep=root+'/editorial/enrichment-narratives-3.12.json';
const ed=JSON.parse(await readFile(ep,'utf8'));
let set=0;
for(const e of ed.entries){
  const src=byQ.get(e.qid);
  if(src&&Array.isArray(src.sourceNames)&&src.sourceNames.length){ e.sourceNames=[...src.sourceNames]; set++; }
}
await writeFile(ep,JSON.stringify(ed,null,2)+'\n');
console.log(JSON.stringify({unconditionalSet:set,entries:ed.entries.length}));
