#!/usr/bin/env node
// Usage: node docs/verification-3.23/refetch-zh-3.23.mjs
// The first extract pass searched the Chinese Wikipedia by the English name whenever the label's
// article was missing, which returned unrelated pages for many entries (a film, a university, an
// airport). This pass repeats the Chinese lookup the way the 3.21 round did: search by the
// recorded Chinese label when there is one, and only fall back to the English name when the
// profile has no Chinese label at all. Every hit is stored with its introduction so a human can
// decide whether it documents the same polity; nothing is accepted automatically.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const UA='MeridianAtlasResearch/3.23 (source-linked world history atlas; Chinese polity lookup)';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const extracts=JSON.parse(await readFile(resolve(root,'docs/verification-3.23/narratives-extracts.json'),'utf8'));
const targets=extracts.entries.filter(entry=>!entry.zhIntro||entry.zhSearched);
const requests=[];
const call=async url=>{
 for(let attempt=1;attempt<=4;attempt++){
  const response=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'}});
  requests.push({url:url.slice(0,100),status:response.status,attempt});
  if(response.ok)return await response.json();
  if(response.status!==429&&response.status<500)throw new Error('HTTP '+response.status);
  await sleep(10000*attempt);
 }
 throw new Error('throttled');
};
const search=async term=>{
 const data=await call('https://zh.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&list=search&srnamespace=0&srlimit=3&srsearch='+encodeURIComponent(term));
 return (data.query?.search||[]).map(hit=>hit.title);
};
const results=[];
for(const entry of targets){
 const terms=[entry.titleZh,entry.titleEn].filter(Boolean);
 const hits=[];
 for(const term of terms){hits.push(...await search(term));await sleep(4000)}
 const unique=[...new Set(hits)].slice(0,6);
 const intros={};
 if(unique.length){
  const data=await call('https://zh.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=extracts|pageprops&exintro=1&explaintext=1&variant=zh-cn&titles='+encodeURIComponent(unique.join('|')));
  for(const page of data.query?.pages||[])intros[page.title]={missing:Boolean(page.missing),extract:(page.extract||'').replace(/\s+/g,' ').trim().slice(0,500),wikibaseItem:page.pageprops?.wikibase_item||null};
  await sleep(5000);
 }
 results.push({qid:entry.qid,titleZh:entry.titleZh,titleEn:entry.titleEn,terms,hits:unique,intros});
}
const document={schemaVersion:1,fetchedAt:new Date().toISOString(),
 policy:'Second Chinese lookup pass for the 3.23 polities whose label article was missing, searching by the recorded Chinese label first and by the English name only when the profile has no Chinese label. Candidate introductions are stored for hand review; an article is cited only if it documents the same polity.',
 requests,count:results.length,results};
await writeFile(resolve(root,'docs/verification-3.23/narratives-zh-lookup.json'),JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({checked:results.length,requests:requests.length,
 summary:results.map(row=>row.qid+' | '+(row.titleZh||row.titleEn)+' | hits: '+row.hits.join(' / '))},null,1));
