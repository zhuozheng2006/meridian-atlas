#!/usr/bin/env node
// Usage: node scripts/places/verify-zh-absence-3.19.mjs [--from=41] [--to=80]
// The full-text search pass (search-zh-articles-3.19.mjs) could not run: the Chinese Wikipedia
// search endpoint answered HTTP 429 through five backoff attempts on the very first entity,
// because this session is being throttled hard. This script is the cheaper, title-based
// fallback the 3.17 round also used: for every 3.19 entry without a Chinese sitelink it asks
// the Chinese Wikipedia for the exact recorded Chinese label (ten titles per request, with
// redirects resolved). A missing page confirms there is no article under the name a Chinese
// reader would search for; it cannot prove that no differently-titled article exists, and the
// round report says so.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const arg=name=>{const hit=process.argv.find(value=>value.startsWith('--'+name+'='));return hit?hit.slice(name.length+3):null};
const from=Number(arg('from')||81);
const to=Number(arg('to')||120);
const UA='MeridianAtlasResearch/3.19 (source-linked world history atlas; Chinese title lookup)';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const extracts=JSON.parse(await readFile(resolve(root,'docs/verification-3.19/content-upgrade-extracts.json'),'utf8'));
const picked=extracts.entries.filter(entry=>entry.rank>=from&&entry.rank<=to&&!entry.zhTitleRequested);
const requests=[];
const lookup=async titles=>{
 const url='https://zh.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=extracts&exintro=1&explaintext=1&variant=zh-cn&titles='+encodeURIComponent(titles.join('|'));
 for(let attempt=1;attempt<=6;attempt++){
  const response=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'}});
  requests.push({status:response.status,count:titles.length,attempt,at:new Date().toISOString()});
  if(response.ok)return await response.json();
  if(response.status!==429&&response.status<500)throw new Error('HTTP '+response.status);
  await sleep(10000*attempt);
 }
 throw new Error('kept returning throttling responses');
};
const pages={};
const titles=picked.map(entry=>entry.titleZh);
for(let i=0;i<titles.length;i+=10){
 const chunk=titles.slice(i,i+10);
 const data=await lookup(chunk);
 const aliases=new Map();
 for(const item of data.query?.normalized||[])aliases.set(item.from,item.to);
 for(const item of data.query?.redirects||[])aliases.set(item.from,item.to);
 for(const page of data.query?.pages||[]){
  const record={title:page.title,missing:Boolean(page.missing),redirected:false,intro:(page.extract||'').replace(/\s+/g,' ').trim().slice(0,400)};
  pages[page.title]=record;
  for(const [alias,target] of aliases)if(target===page.title&&alias!==page.title)pages[alias]={...record,title:page.title,redirected:true,requested:alias};
 }
 await sleep(8000);
}
const entries=picked.map(entry=>{
 const record=pages[entry.titleZh]||null;
 return {rank:entry.rank,qid:entry.qid,titleZh:entry.titleZh,requested:entry.titleZh,
  exists:record?Boolean(!record.missing):null,resolvedTitle:record?record.title:null,redirected:record?record.redirected:false,intro:record?record.intro:null};
});
const document={schemaVersion:1,fetchedAt:new Date().toISOString(),
 policy:'Exact-title lookup on the Chinese Wikipedia for the 3.19 entries that have no zhwiki sitelink, as a fallback after the full-text search endpoint returned 429 through six backoff attempts. A missing page proves there is no article under the recorded Chinese label; it does not prove that no differently-titled article exists.',
 searchAttempt:'scripts/places/search-zh-articles-3.19.mjs was aborted after the first entity (Q1784785) failed five search attempts with HTTP 429; see the round report.',
 requests,checked:entries.length,missing:entries.filter(entry=>entry.exists===false).length,
 existing:entries.filter(entry=>entry.exists).map(entry=>({qid:entry.qid,titleZh:entry.titleZh,resolvedTitle:entry.resolvedTitle,intro:entry.intro})),
 entries};
await writeFile(resolve(root,'docs/verification-3.19/content-upgrade-zh-lookup.json'),JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({checked:entries.length,missing:document.missing,existing:document.existing,requests:requests.length},null,1));