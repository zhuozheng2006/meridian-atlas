#!/usr/bin/env node
// Usage: node docs/verification-3.26/fetch-polity-extracts-3.26.mjs
// Reads docs/verification-3.26/narratives-chosen.json and gathers the research evidence for the
// second narratives batch:
//   * English and Chinese Wikipedia introductions (10 titles per request, 6 s apart, 429 retried
//     with a growing pause). A title that does not resolve is looked up with the search API and
//     the resolved title is recorded, so a citation always points at the page that was read.
//   * For entities whose profile has no Chinese label, a Chinese search by the English name; the
//     resolved article title, when one exists, becomes the Chinese title of the entry.
//   * pageprops.wikibase_item for every English article actually used: the article must carry the
//     candidate's QID, which is the identity check the round requires (a QID is never taken from
//     memory). Articles whose wikibase_item differs are recorded and must not be cited.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const outPath=resolve(root,process.argv[2]||'docs/verification-3.26/narratives-extracts.json');
const UA='MeridianAtlasResearch/3.26 (source-linked world history atlas; polity narratives)';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const chosen=JSON.parse(await readFile(resolve(root,'docs/verification-3.26/narratives-chosen.json'),'utf8'));
const requests=[];
const call=async url=>{
 for(let attempt=1;attempt<=4;attempt++){
  const response=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'}});
  requests.push({url:url.slice(0,110),status:response.status,attempt});
  if(response.ok)return await response.json();
  if(response.status!==429&&response.status<500)throw new Error('HTTP '+response.status);
  await sleep(15000*attempt);
 }
 throw new Error('throttled');
};
const wiki=async(host,params,suffix='')=>call('https://'+host+'/w/api.php?action=query&format=json&formatversion=2&'+params+suffix);
const fetchExtracts=async(host,titles)=>{
 const texts={};
 for(let i=0;i<titles.length;i+=10){
  const chunk=titles.slice(i,i+10);
  const data=await wiki(host,'redirects=1&prop=extracts|pageprops&exintro=1&explaintext=1&titles='+encodeURIComponent(chunk.join('|')),host.startsWith('zh')?'&variant=zh-cn':'');
  const aliases=new Map();
  for(const item of data.query?.normalized||[])aliases.set(item.from,item.to);
  for(const item of data.query?.redirects||[])aliases.set(item.from,item.to);
  for(const page of data.query?.pages||[]){
   const record={extract:page.extract||null,missing:Boolean(page.missing),resolvedTitle:page.title,wikibaseItem:page.pageprops?.wikibase_item||null};
   texts[page.title]=record;
   for(const [from,to] of aliases)if(to===page.title)texts[from]=record;
  }
  await sleep(6000);
 }
 return texts;
};
const searchTitle=async(host,term)=>{
 const data=await wiki(host,'list=search&srlimit=1&srsearch='+encodeURIComponent(term));
 return data.query?.search?.[0]?.title||null;
};
const enTitles=[...new Set(chosen.entries.map(entry=>entry.titleEn).filter(Boolean))];
const zhTitles=[...new Set(chosen.entries.map(entry=>entry.titleZh).filter(Boolean))];
const en=await fetchExtracts('en.wikipedia.org',enTitles);
const zh=await fetchExtracts('zh.wikipedia.org',zhTitles);
const limit=(text,n)=>text?text.replace(/\s+/g,' ').trim().slice(0,n):null;
const entries=[];
for(const plan of chosen.entries){
 const enRecord=en[plan.titleEn];
 let zhRecord=plan.titleZh?zh[plan.titleZh]:null;
 let zhSearched=null;
 if(!zhRecord?.extract){
  // No Chinese label (or the label has no article): search by the English name and record the
  // resolved title. The title is used only when an article actually exists.
  const found=await searchTitle('zh.wikipedia.org',plan.titleEn);
  if(found){zhSearched=found;const extra=await fetchExtracts('zh.wikipedia.org',[found]);zhRecord=extra[found]}
 }
 entries.push({qid:plan.qid,titleZh:plan.titleZh,titleEn:plan.titleEn,regionReviewed:plan.regionReviewed,regionBox:plan.regionBox,era:plan.era,
  scope:plan.scope,recordCount:plan.recordCount,spanYears:plan.spanYears,thin:plan.thin,recordIds:plan.recordIds,
  enTitle:enRecord?.resolvedTitle||null,enIntro:limit(enRecord?.extract,1500),enWikibaseItem:enRecord?.wikibaseItem||null,
  enIdentityMatch:Boolean(enRecord?.wikibaseItem&&enRecord.wikibaseItem===plan.qid),
  zhTitle:zhRecord?.resolvedTitle||null,zhIntro:limit(zhRecord?.extract,900),zhSearched});
 await sleep(300);
}
const document={schemaVersion:1,fetchedAt:new Date().toISOString(),
 policy:'Wikipedia introductions and pageprops (CC BY-SA 4.0) read through the MediaWiki API as research evidence for the 3.26 narratives; no sentence is copied into the shipped entries. Chinese pages are requested with variant=zh-cn. The pageprops.wikibase_item of every English article is recorded: an article whose item does not equal the profile QID is not cited.',
 requests,count:entries.length,entries};
await writeFile(outPath,JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({out:outPath,count:entries.length,
 missingEn:entries.filter(e=>!e.enIntro).map(e=>e.qid),
 identityMismatch:entries.filter(e=>!e.enIdentityMatch).map(e=>[e.qid,e.enTitle,e.enWikibaseItem]),
 missingZh:entries.filter(e=>!e.zhIntro).length,
 zhFoundBySearch:entries.filter(e=>e.zhSearched&&e.zhIntro).map(e=>[e.qid,e.zhSearched]),
 requests:requests.length},null,1));
