#!/usr/bin/env node
// Usage: node docs/verification-3.28/verify-en-3.28.mjs
// Strict check of the English side of the fourth batch. The fetch step recorded an article per plan,
// but two of them turned out to be the wrong page (a disambiguation page and an article about the
// concept qi instead of the state of Qi), so every recorded title is re-checked here: the article
// must exist and its pageprops.wikibase_item must equal the polity QID. Plans that fail are listed
// as gaps and are not written.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const UA='MeridianAtlasResearch/3.28 (source-linked world history atlas; English identity check)';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const extracts=JSON.parse(await readFile(resolve(root,'docs/verification-3.28/narratives-extracts.json'),'utf8'));
const titles=[...new Set(extracts.entries.map(entry=>entry.enTitle).filter(Boolean))];
const props={};const requests=[];
for(let i=0;i<titles.length;i+=50){
 const chunk=titles.slice(i,i+50);
 for(let attempt=1;attempt<=4;attempt++){
  const response=await fetch('https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=pageprops&titles='+encodeURIComponent(chunk.join('|')),{headers:{'user-agent':UA,accept:'application/json'}});
  requests.push({status:response.status,attempt,count:chunk.length});
  if(response.ok){
   const data=await response.json();
   const alias=new Map();
   for(const item of data.query?.normalized||[])alias.set(item.from,item.to);
   for(const item of data.query?.redirects||[])alias.set(item.from,item.to);
   for(const page of data.query?.pages||[]){
    const record={title:page.title,missing:Boolean(page.missing),wikibaseItem:page.pageprops?.wikibase_item||null,disambiguation:Boolean(page.pageprops?.disambiguation)};
    props[page.title]=record;
    for(const [from,to] of alias)if(to===page.title)props[from]=record;
   }
   break;
  }
  if(response.status!==429&&response.status<500)throw new Error('HTTP '+response.status);
  await sleep(10000*attempt);
 }
 await sleep(1000);
}
const decisions=extracts.entries.map(entry=>{
 const record=entry.enTitle?props[entry.enTitle]:null;
 if(!record||record.missing)return {qid:entry.qid,title:entry.enTitle||null,accepted:false,reason:'no English article under this title',evidence:'pageprops lookup returned no page'};
 if(record.disambiguation)return {qid:entry.qid,title:record.title,accepted:false,reason:'the English article is a disambiguation page',evidence:'pageprops.disambiguation is set'};
 if(record.wikibaseItem===entry.qid)return {qid:entry.qid,title:record.title,accepted:true,reason:'the English article carries the polity QID',evidence:'pageprops.wikibase_item = '+record.wikibaseItem};
 return {qid:entry.qid,title:record.title,accepted:false,reason:'the English article carries a different Wikidata item ('+(record.wikibaseItem||'none')+')',evidence:'pageprops lookup'};
});
const document={schemaVersion:1,checkedAt:new Date().toISOString(),
 policy:'An English article is cited only when it exists, is not a disambiguation page, and carries the polity QID. Plans that fail are dropped from the batch and registered as gaps.',
 requests,checked:decisions.length,accepted:decisions.filter(row=>row.accepted).length,
 rejected:decisions.filter(row=>!row.accepted).length,decisions};
await writeFile(resolve(root,'docs/verification-3.28/narratives-en-verified.json'),JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({checked:document.checked,accepted:document.accepted,rejected:document.rejected,
 rejectedList:decisions.filter(row=>!row.accepted).map(row=>row.qid+' '+(row.title||'')+' -> '+row.reason)},null,1));
