import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
const root='/Users/zane/meridian_atlas/world-history-atlas';
const catalog=JSON.parse(gunzipSync(await readFile(root+'/public/data/fast/catalog.json.gz')));
const byQ=new Map();
for(const r of catalog.records||[]){ if(!r.verifiedWikidata) continue; if(!byQ.has(r.verifiedWikidata)) byQ.set(r.verifiedWikidata,new Set()); byQ.get(r.verifiedWikidata).add(r.name); }
const ex=JSON.parse(await readFile(root+'/docs/verification-3.36/narratives-extracts.json','utf8'));
const ed=JSON.parse(await readFile(root+'/editorial/enrichment-narratives-3.12.json','utf8'));
const batchQ=new Set(ex.entries.map(e=>e.qid));
const bad=[];
for(const e of ed.entries){
  if(!batchQ.has(e.qid)) continue;
  const names=byQ.get(e.qid);
  const ok=Array.isArray(e.sourceNames)&&e.sourceNames.length>0&&names&&e.sourceNames.some(n=>names.has(n));
  if(!ok) bad.push((e.qid||'?')+' sourceNames='+JSON.stringify(e.sourceNames||null));
}
console.log(JSON.stringify({checked:ed.entries.length,batch:batchQ.size,bad:bad.length,sample:bad.slice(0,5)}));
process.exit(bad.length?1:0);
