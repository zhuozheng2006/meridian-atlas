#!/usr/bin/env node
// Usage: node docs/verification-3.35/fetch-polity-extracts-3.35.mjs
// Collects the source introductions for the sixth batch. Rule one of this project is that an
// external article must be reached by looking the entity up, never by taking the first hit of a
// search by name: in 3.26 name lookup produced a disambiguation page for the Jin dynasty and an
// article about the concept qi for the state of Qi. This script therefore asks Wikidata for the
// enwiki and zhwiki sitelinks of every plan QID, fetches the introductions of exactly those pages
// and records each page's pageprops.wikibase_item, so the identity of every citation is checked
// while it is collected.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const UA='MeridianAtlasResearch/3.35 (source-linked world history atlas)';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const read=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const chosen=await read('docs/verification-3.35/narratives-chosen.json');
const limit=(text,size)=>String(text||'').replace(/\s+/g,' ').trim().slice(0,size);
const requests=[];
const call=async url=>{
 for(let attempt=1;attempt<=4;attempt++){
  const response=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'}});
  requests.push({status:response.status,attempt});
  if(response.ok)return await response.json();
  if(response.status!==429&&response.status<500)throw new Error('HTTP '+response.status);
  await sleep(8000*attempt);
 }
 throw new Error('throttled');
};
const sitelinks={};
const qids=chosen.entries.map(entry=>entry.qid);
for(let i=0;i<qids.length;i+=45){
 const data=await call('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&formatversion=2&props=sitelinks&sitefilter=enwiki%7Czhwiki&ids='+qids.slice(i,i+45).join('|'));
 for(const [qid,entity] of Object.entries(data.entities||{}))sitelinks[qid]=entity.sitelinks||{};
 await sleep(1200);
}
const fetchPages=async(host,titles)=>{
 const out={};
 // the extracts extension returns introductions for at most twenty pages per request
 for(let i=0;i<titles.length;i+=20){
  const chunk=titles.slice(i,i+20);
  const data=await call('https://'+host+'/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=extracts|pageprops&exintro=1&explaintext=1&exlimit=20&titles='+encodeURIComponent(chunk.join('|')));
  const alias=new Map();
  for(const item of data.query?.normalized||[])alias.set(item.from,item.to);
  for(const item of data.query?.redirects||[])alias.set(item.from,item.to);
  for(const page of data.query?.pages||[]){
   const record={title:page.title,missing:Boolean(page.missing),disambiguation:Boolean(page.pageprops?.disambiguation),wikibaseItem:page.pageprops?.wikibase_item||null,extract:limit(page.extract,1600)};
   out[page.title]=record;
   for(const [fromName,toName] of alias)if(toName===page.title)out[fromName]=record;
  }
  await sleep(1500);
 }
 return out;
};
const enTitles=[...new Set(chosen.entries.map(entry=>sitelinks[entry.qid]?.enwiki?.title).filter(Boolean))];
const zhTitles=[...new Set(chosen.entries.map(entry=>sitelinks[entry.qid]?.zhwiki?.title).filter(Boolean))];
const en=await fetchPages('en.wikipedia.org',enTitles);
const zh=await fetchPages('zh.wikipedia.org',zhTitles);
const entries=chosen.entries.map(plan=>{
 const enTitle=sitelinks[plan.qid]?.enwiki?.title||null;
 const zhTitle=sitelinks[plan.qid]?.zhwiki?.title||null;
 const enRecord=enTitle?en[enTitle]:null;
 const zhRecord=zhTitle?zh[zhTitle]:null;
 return {qid:plan.qid,titleZh:plan.titleZh,titleEn:plan.titleEn,region:plan.regionReviewed,scope:plan.scope,
  recordCount:plan.recordCount,spanYears:plan.spanYears,thin:Boolean(plan.thin),
  enTitle:enRecord?.title||enTitle,enIntro:enRecord?.extract||null,enWikibaseItem:enRecord?.wikibaseItem||null,
  enDisambiguation:Boolean(enRecord?.disambiguation),
  enIdentityMatch:Boolean(enRecord&&!enRecord.missing&&!enRecord.disambiguation&&enRecord.wikibaseItem===plan.qid),
  zhTitle:zhRecord?.title||zhTitle,zhIntro:zhRecord?.extract||null,zhWikibaseItem:zhRecord?.wikibaseItem||null,
  zhIdentityMatch:Boolean(zhRecord&&!zhRecord.missing&&zhRecord.wikibaseItem===plan.qid)};
});
const document={schemaVersion:1,fetchedAt:new Date().toISOString(),
 policy:'Every article was resolved through the Wikidata sitelinks of the plan QID (rule one: look the entity up, never search by name) and each page carries its pageprops.wikibase_item, so an article that documents another entity is visible immediately.',
 resolution:{enTitles:enTitles.length,zhTitles:zhTitles.length,requests:requests.length},
 entries,missingEn:entries.filter(entry=>!entry.enIntro).map(entry=>entry.qid),
 identityMismatch:entries.filter(entry=>!entry.enIdentityMatch).map(entry=>[entry.qid,entry.enTitle,entry.enWikibaseItem]),
 zhMismatch:entries.filter(entry=>!entry.zhIdentityMatch).map(entry=>[entry.qid,entry.zhTitle,entry.zhWikibaseItem])};
await writeFile(resolve(root,'docs/verification-3.35/narratives-extracts.json'),JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({plans:entries.length,missingEn:document.missingEn.length,identityMismatch:document.identityMismatch.length,
 zhMismatch:document.zhMismatch.length,enTitles:enTitles.length,zhTitles:zhTitles.length,requests:requests.length},null,1));
