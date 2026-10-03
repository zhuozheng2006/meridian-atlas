#!/usr/bin/env node
// Usage: node scripts/places/search-zh-articles-3.18.mjs [--from=41] [--to=80]
// For every 3.18 candidate whose entity has no zh.wikipedia sitelink, searches the Chinese
// Wikipedia once by the recorded Chinese label and reads the introductions of the candidates,
// so a human can decide whether an article documents the same event. Wikidata sitelinks are
// incomplete (the 3.16 round recovered two articles this way) and the Chinese Wikipedia is
// being throttled hard in this session, so the sweep is deliberately one query per entity at a
// slow pace with a long backoff; a 429 is never answered with a retry burst.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const arg=name=>{const hit=process.argv.find(value=>value.startsWith('--'+name+'='));return hit?hit.slice(name.length+3):null};
const from=Number(arg('from')||41);
const to=Number(arg('to')||80);
const UA='MeridianAtlasResearch/3.18 (source-linked world history atlas; Chinese article search)';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const extracts=JSON.parse(await readFile(resolve(root,'docs/verification-3.18/content-upgrade-extracts.json'),'utf8'));
const picked=extracts.entries.filter(entry=>entry.rank>=from&&entry.rank<=to&&!entry.zhTitleRequested);
const requests=[];
const get=async url=>{
 let lastStatus=0;
 for(let attempt=1;attempt<=5;attempt++){
  const response=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'}});
  lastStatus=response.status;
  requests.push({endpoint:url.split('?')[0].split('/').pop(),status:response.status,attempt,at:new Date().toISOString()});
  if(response.ok)return await response.json();
  if(response.status!==429&&response.status<500)throw new Error('HTTP '+response.status+' '+url);
  await sleep(20000*attempt);
 }
 throw new Error('HTTP '+lastStatus+' '+url);
};
const candidates=new Map();
for(const entry of picked){
 const query=entry.titleZh;
 const url='https://zh.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&list=search&srnamespace=0&srlimit=4&srsearch='+encodeURIComponent(query);
 let data;
 try{data=await get(url)}catch(error){console.error('search failed',entry.qid,query,error.message);continue}
 for(const hit of data.query?.search||[]){
  const record=candidates.get(hit.title)||{title:hit.title,queries:[],hits:[]};
  if(!record.queries.includes(query))record.queries.push(query);
  record.hits.push({qid:entry.qid,rank:entry.rank,query,size:hit.size,wordcount:hit.wordcount,snippet:(hit.snippet||'').replace(/<[^>]+>/g,'')});
  candidates.set(hit.title,record);
 }
 await sleep(6000);
}
const titles=[...candidates.keys()];
const intros={};
for(let i=0;i<titles.length;i+=10){
 const chunk=titles.slice(i,i+10);
 const url='https://zh.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=extracts&exintro=1&explaintext=1&variant=zh-cn&titles='+encodeURIComponent(chunk.join('|'));
 const data=await get(url);
 for(const page of data.query?.pages||[])intros[page.title]={missing:Boolean(page.missing),resolvedTitle:page.title,intro:(page.extract||'').replace(/\s+/g,' ').trim().slice(0,420)};
 await sleep(6000);
}
const document={schemaVersion:1,fetchedAt:new Date().toISOString(),
 policy:'Chinese Wikipedia search for the 3.18 candidates whose Wikidata entity has no zhwiki sitelink. One query per entity (the recorded Chinese label, which is what a Chinese reader would search) and the introduction of every candidate returned, read to decide whether it documents the same event. Evidence only: no article is cited unless its introduction matches the event.',
 searched:picked.length,requests,
 candidates:[...candidates.values()].map(record=>({...record,intro:intros[record.title]?.intro||null,missing:intros[record.title]?.missing??null}))};
await mkdir(resolve(root,'docs/verification-3.18'),{recursive:true});
await writeFile(resolve(root,'docs/verification-3.18/content-upgrade-zh-search.json'),JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({out:'docs/verification-3.18/content-upgrade-zh-search.json',searched:picked.length,candidates:candidates.size,requests:requests.length},null,1));
