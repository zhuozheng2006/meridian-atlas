#!/usr/bin/env node
// Usage: node docs/verification-3.21/fetch-polity-extracts-3.21.mjs [out.json]
// Reads docs/verification-3.21/narratives-chosen.json and fetches the English and Chinese
// Wikipedia introductions of the chosen polities through the MediaWiki API (10 titles per
// request, 6 s apart, 429 retried with a growing pause). A title that does not resolve is
// looked up with the wiki search API, and the resolved article title is recorded so the
// citation points at the page that was actually read. The extracts are research evidence for
// authoring; no sentence is copied into the shipped entries.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const outPath=resolve(root,process.argv[2]||'docs/verification-3.21/narratives-extracts.json');
const UA='MeridianAtlasResearch/3.21 (source-linked world history atlas; polity narratives)';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const chosen=JSON.parse(await readFile(resolve(root,'docs/verification-3.21/narratives-chosen.json'),'utf8'));
const requests=[];
const call=async url=>{
 for(let attempt=1;attempt<=4;attempt++){
  const response=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'}});
  requests.push({url:url.slice(0,120),status:response.status,attempt});
  if(response.ok)return await response.json();
  if(response.status!==429&&response.status<500)throw new Error('HTTP '+response.status);
  await sleep(20000*attempt);
 }
 throw new Error('throttled');
};
const fetchExtracts=async(host,titles)=>{
 const chunks=[];for(let i=0;i<titles.length;i+=10)chunks.push(titles.slice(i,i+10));
 const texts={};
 for(const chunk of chunks){
  const url='https://'+host+'/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=extracts&exintro=1&explaintext=1&titles='+encodeURIComponent(chunk.join('|'))+(host.startsWith('zh')?'&variant=zh-cn':'');
  const data=await call(url);
  const aliases=new Map();
  for(const item of data.query?.normalized||[])aliases.set(item.from,item.to);
  for(const item of data.query?.redirects||[])aliases.set(item.from,item.to);
  for(const page of data.query?.pages||[]){
   const record={extract:page.extract||null,missing:Boolean(page.missing),resolvedTitle:page.title};
   texts[page.title]=record;
   for(const [from,to] of aliases)if(to===page.title)texts[from]=record;
  }
  await sleep(6000);
 }
 return texts;
};
const searchTitle=async(host,term)=>{
 const url='https://'+host+'/w/api.php?action=query&format=json&formatversion=2&list=search&srlimit=1&srsearch='+encodeURIComponent(term);
 const data=await call(url);
 return data.query?.search?.[0]?.title||null;
};
const enTitles=chosen.entries.map(entry=>entry.titleEn);
const zhTitles=chosen.entries.map(entry=>entry.titleZh);
const en=await fetchExtracts('en.wikipedia.org',[...new Set(enTitles)]);
const zh=await fetchExtracts('zh.wikipedia.org',[...new Set(zhTitles)]);
const limit=(text,n)=>text?text.replace(/\s+/g,' ').trim().slice(0,n):null;
const entries=[];
for(const entry of chosen.entries){
 let enRecord=en[entry.titleEn],zhRecord=zh[entry.titleZh];
 if(!enRecord?.extract){
  const found=await searchTitle('en.wikipedia.org',entry.titleEn+' '+entry.qid);
  if(found){const extra=await fetchExtracts('en.wikipedia.org',[found]);enRecord=extra[found]}
 }
 if(!zhRecord?.extract){
  const found=await searchTitle('zh.wikipedia.org',entry.titleZh);
  if(found){const extra=await fetchExtracts('zh.wikipedia.org',[found]);zhRecord=extra[found]}
 }
 entries.push({qid:entry.qid,titleZh:entry.titleZh,titleEn:entry.titleEn,regionReviewed:entry.regionReviewed,era:entry.era,
  scope:entry.scope,recordCount:entry.recordCount,thin:entry.thin,
  enTitle:enRecord?.resolvedTitle||null,zhTitle:zhRecord?.resolvedTitle||null,
  enIntro:limit(enRecord?.extract,1500),zhIntro:limit(zhRecord?.extract,900)});
}
const document={schemaVersion:1,fetchedAt:new Date().toISOString(),
 policy:'Wikipedia introductions (CC BY-SA 4.0) read through the MediaWiki API as research evidence; no sentence is copied into the shipped entries. Chinese pages are requested with variant=zh-cn.',
 requests,count:entries.length,entries};
await writeFile(outPath,JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({out:outPath,count:entries.length,missingEn:entries.filter(e=>!e.enIntro).map(e=>e.qid),missingZh:entries.filter(e=>!e.zhIntro).map(e=>e.qid),requests:requests.length},null,1));
