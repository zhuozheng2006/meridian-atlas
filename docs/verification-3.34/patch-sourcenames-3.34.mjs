import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
const root='/Users/zane/meridian_atlas/world-history-atlas';
const catalog=JSON.parse(gunzipSync(await readFile(root+'/public/data/fast/catalog.json.gz')));
const byQ=new Map();
for(const r of catalog.records||[]){
  if(!r.verifiedWikidata) continue;
  if(!byQ.has(r.verifiedWikidata)) byQ.set(r.verifiedWikidata,new Set());
  byQ.get(r.verifiedWikidata).add(r.name);
}
const p=root+'/docs/verification-3.34/narratives-extracts.json';
const ex=JSON.parse(await readFile(p,'utf8'));
let patched=0, missing=[];
for(const e of ex.entries){
  const names=byQ.get(e.qid);
  if(names&&names.size){ e.sourceNames=[...names]; patched++; }
  else missing.push(e.qid+' '+e.titleZh);
}
await writeFile(p,JSON.stringify(ex,null,2)+'\n');
console.log(JSON.stringify({patched,missing:missing.length,sample:missing.slice(0,5)}));
