#!/usr/bin/env node
// Usage: node scripts/places/check-source-links-3.16.mjs [--sample=N]
// Reads the shipped 3.16 editorial batch (and, unless --events-only is passed, a sample of the
// atrocity layer) and requests every cited URL once, recording the HTTP status. It is the only
// check in this round that leaves the repository: it exists because the batch cites hand-fixed
// article titles, and a typo in a fix map would otherwise only surface as a broken citation in
// production. Requests are spaced so the Wikimedia APIs do not throttle the sweep.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const sampleArg=process.argv.find(arg=>arg.startsWith('--sample='));
const atrocitySample=sampleArg?Number(sampleArg.slice('--sample='.length)):12;
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const batch=JSON.parse(await readFile(resolve(root,'editorial/events-upgraded-3.16.json'),'utf8'));
const atrocities=JSON.parse(await readFile(resolve(root,'public/data/atrocities.json'),'utf8'));
const targets=[];
for(const entry of batch.entries)for(const source of entry.sources)targets.push({layer:'events',id:entry.id,url:source.url});
const step=Math.max(1,Math.floor(atrocities.incidents.length/atrocitySample));
for(let index=0;index<atrocities.incidents.length&&targets.filter(item=>item.layer==='atrocities').length<atrocitySample;index+=step){
 const incident=atrocities.incidents[index];
 for(const source of incident.sources)targets.push({layer:'atrocities',id:incident.id,url:source.url});
}
const unique=[...new Map(targets.map(item=>[item.url,item])).values()];
const results=[];
for(const target of unique){
 let status=0;
 for(let attempt=1;attempt<=3;attempt++){
  try{const response=await fetch(target.url,{headers:{'user-agent':'MeridianAtlasResearch/3.16 (citation link check)'}});status=response.status}catch{status=-1}
  if(status===200)break;
  await sleep(3000*attempt);
 }
 results.push({...target,status});
 await sleep(900);
}
const report={schemaVersion:1,checkedAt:new Date().toISOString(),policy:'Every URL cited by the 3.16 editorial batch was requested once (three attempts on failure) and the atrocity layer was sampled; the shipped files were not modified.',checked:results.length,ok:results.filter(item=>item.status===200).length,failed:results.filter(item=>item.status!==200),byLayer:results.reduce((all,item)=>{all[item.layer]=(all[item.layer]||0)+1;return all},{}),results};
await writeFile(resolve(root,'docs/verification-3.16/content-source-links.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checked:report.checked,ok:report.ok,failed:report.failed.length,byLayer:report.byLayer,failedExamples:report.failed.slice(0,5)},null,1));
