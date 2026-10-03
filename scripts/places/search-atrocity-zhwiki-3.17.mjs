#!/usr/bin/env node
// Usage: node scripts/places/search-atrocity-zhwiki-3.17.mjs
// Chinese-name search pass for the atrocity layer. For every incident whose entity has neither
// a Chinese label variant nor a zh.wikipedia sitelink, this searches the Chinese Wikipedia by
// the English name and reads the introduction of every candidate, so a human can decide whether
// the article documents the same event. The search endpoint throttles bursts: one query per
// 2.5 seconds with a growing pause on 429.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const UA='MeridianAtlasResearch/3.17 (source-linked world history atlas; atrocity name search)';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const evidence=JSON.parse(await readFile(resolve(root,'docs/verification-3.17/atrocities-evidence.json'),'utf8'));
const rows=evidence.rows.filter(row=>!row.zhVariantCJK&&!row.zhwikiTitle);
const requests=[];
const get=async url=>{
 let last=0;
 for(let attempt=1;attempt<=5;attempt++){
  const response=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'}});
  last=response.status;
  requests.push({url:url.split('?')[0],status:response.status,attempt,at:new Date().toISOString()});
  if(response.ok)return await response.json();
  if(response.status!==429&&response.status<500)throw new Error('HTTP '+response.status);
  await sleep(20000*attempt);
 }
 throw new Error('HTTP '+last);
};
const candidates=new Map();
const perIncident=[];
for(const row of rows){
 let results=[];
 try{
  const data=await get('https://zh.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&list=search&srnamespace=0&srlimit=3&srsearch='+encodeURIComponent(row.nameEn||row.qid));
  results=(data.query?.search||[]).map(hit=>({title:hit.title,size:hit.size,snippet:(hit.snippet||'').replace(/<[^>]+>/g,'')}));
 }catch(error){console.error('search failed',row.qid,error.message)}
 perIncident.push({qid:row.qid,id:row.id,nameEn:row.nameEn,year:row.year,results});
 for(const hit of results)if(!candidates.has(hit.title))candidates.set(hit.title,{title:hit.title,forQids:[]});
 for(const hit of results)candidates.get(hit.title).forQids.push(row.qid);
 await sleep(2500);
}
const titles=[...candidates.keys()];
for(let index=0;index<titles.length;index+=10){
 const chunk=titles.slice(index,index+10);
 try{
  const data=await get('https://zh.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=extracts&exintro=1&explaintext=1&variant=zh-cn&titles='+encodeURIComponent(chunk.join('|')));
  for(const page of data.query?.pages||[])if(candidates.has(page.title))candidates.get(page.title).intro=(page.extract||'').replace(/\s+/g,' ').slice(0,400);
 }catch(error){console.error('intro batch failed',error.message)}
 await sleep(5000);
}
const document={schemaVersion:1,fetchedAt:new Date().toISOString(),
 policy:'Chinese Wikipedia search by the English name for every atrocity-layer incident whose entity has no Chinese label variant and no zhwiki sitelink, with the introduction of each candidate read so a human can confirm whether it documents the same event before any name is accepted. No candidate is accepted on a name resemblance alone.',
 searched:rows.length,requests,candidateCount:candidates.size,
 perIncident:perIncident.map(item=>({...item,results:item.results.map(hit=>({...hit,intro:candidates.get(hit.title)?.intro||null}))}))};
await writeFile(resolve(root,'docs/verification-3.17/atrocities-zh-search.json'),JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({out:'docs/verification-3.17/atrocities-zh-search.json',searched:rows.length,candidates:candidates.size,withIntro:[...candidates.values()].filter(item=>item.intro).length,requests:requests.length},null,1));
