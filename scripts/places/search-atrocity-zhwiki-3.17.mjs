#!/usr/bin/env node
// Usage: node scripts/places/search-atrocity-zhwiki-3.17.mjs [--limit=0]
// Chinese-name search pass for the atrocity layer. For every incident whose entity has neither
// a Chinese label variant nor a zh.wikipedia sitelink, it searches the Chinese Wikipedia by the
// English name and reads the introduction of every candidate, so a human can decide whether the
// article documents the same event. Nothing is accepted on a name resemblance alone.
//
// The Wikimedia search endpoints throttle bursts, so the sweep is checkpointed: each answered
// query is appended to docs/verification-3.17/atrocities-zh-search.json as it arrives, and a
// rerun skips what is already recorded. A query that keeps failing is recorded as an error for
// that incident instead of stopping the sweep, so partial coverage is visible in the output.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const limitArg=process.argv.find(value=>value.startsWith('--limit='));
const limit=limitArg?Number(limitArg.slice('--limit='.length)):0;
const outPath=resolve(root,'docs/verification-3.17/atrocities-zh-search.json');
const UA='MeridianAtlasResearch/3.17 (source-linked world history atlas; atrocity name search)';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const evidence=JSON.parse(await readFile(resolve(root,'docs/verification-3.17/atrocities-evidence.json'),'utf8'));
const targets=evidence.rows.filter(row=>!row.zhVariantCJK&&!row.zhwikiTitle);
let document={schemaVersion:1,fetchedAt:new Date().toISOString(),
 policy:'Chinese Wikipedia search by the English name for every atrocity-layer incident whose entity has no Chinese label variant and no zhwiki sitelink, with the introduction of each candidate read so a human can confirm whether it documents the same event before any name is accepted. No candidate is accepted on a name resemblance alone. The sweep is checkpointed and records per-incident errors, so its coverage is auditable.',
 searched:0,errors:0,perIncident:[],introductions:{}};
try{document={...document,...JSON.parse(await readFile(outPath,'utf8'))}}catch{}
const done=new Set(document.perIncident.map(item=>item.qid));
const pending=targets.filter(row=>!done.has(row.qid));
const queue=limit?pending.slice(0,limit):pending;
const candidates=new Map();
const get=async url=>{
 let last=0;
 for(let attempt=1;attempt<=3;attempt++){
  const response=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'}});
  last=response.status;
  if(response.ok)return await response.json();
  if(response.status!==429&&response.status<500)throw new Error('HTTP '+response.status);
  await sleep(15000*attempt);
 }
 throw new Error('HTTP '+last);
};
let index=0;
for(const row of queue){
 index++;
 let results=[],error=null;
 try{
  const data=await get('https://zh.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&list=search&srnamespace=0&srlimit=3&srsearch='+encodeURIComponent(row.nameEn||row.qid));
  results=(data.query?.search||[]).map(hit=>({title:hit.title,size:hit.size,snippet:(hit.snippet||'').replace(/<[^>]+>/g,'')}));
 }catch(failure){error=failure.message;document.errors++}
 for(const hit of results)if(!candidates.has(hit.title))candidates.set(hit.title,true);
 document.perIncident.push({qid:row.qid,id:row.id,nameEn:row.nameEn,year:row.year,error,results});
 document.searched=document.perIncident.length;
 if(index%5===0||index===queue.length){
  await writeFile(outPath,JSON.stringify(document,null,2)+'\n');
  console.error('progress',index,'/',queue.length,'errors',document.errors);
 }
 await sleep(3000);
}
// Introductions for every candidate title not read yet, 10 per request.
const titles=[...new Set(document.perIncident.flatMap(item=>(item.results||[]).map(hit=>hit.title)))].filter(title=>!document.introductions[title]);
for(let i=0;i<titles.length;i+=10){
 const chunk=titles.slice(i,i+10);
 try{
  const data=await get('https://zh.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=extracts&exintro=1&explaintext=1&variant=zh-cn&titles='+encodeURIComponent(chunk.join('|')));
  for(const page of data.query?.pages||[])document.introductions[page.title]=(page.extract||'').replace(/\s+/g,' ').slice(0,400);
 }catch(error){console.error('intro batch failed',error.message)}
 await writeFile(outPath,JSON.stringify(document,null,2)+'\n');
 await sleep(6000);
}
for(const item of document.perIncident)for(const hit of item.results||[])hit.intro=document.introductions[hit.title]||null;
document.fetchedAt=new Date().toISOString();
document.candidateCount=Object.keys(document.introductions).length;
await writeFile(outPath,JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({out:'docs/verification-3.17/atrocities-zh-search.json',targets:targets.length,searched:document.searched,errors:document.errors,candidates:document.candidateCount},null,1));
