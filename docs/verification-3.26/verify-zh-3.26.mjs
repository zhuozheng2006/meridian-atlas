#!/usr/bin/env node
// Usage: node docs/verification-3.26/verify-zh-3.26.mjs
// Decides which Chinese Wikipedia article may be cited for each plan of the fourth batch. The test
// is objective and strict: the article actually recorded for the entry must carry the same
// Wikidata item as the polity (pageprops.wikibase_item === QID). Anything else is rejected with
// its reason, and the entry then ships with the English article plus the Wikidata entity.
// Standing rule for writing: where a Chinese introduction disagrees with the English article, the
// English article governs (three introductions captured in the 3.23 round belonged to unrelated
// pages: Laos instead of Rattanakosin, a university instead of Tarumanagara, Islam in Indonesia
// instead of Maguindanao).
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const UA='MeridianAtlasResearch/3.26 (source-linked world history atlas; Chinese identity check)';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const extracts=JSON.parse(await readFile(resolve(root,'docs/verification-3.26/narratives-extracts.json'),'utf8'));
const titles=[...new Set(extracts.entries.map(entry=>entry.zhTitle).filter(Boolean))];
const props={};const requests=[];
for(let i=0;i<titles.length;i+=50){
 const chunk=titles.slice(i,i+50);
 for(let attempt=1;attempt<=4;attempt++){
  const response=await fetch('https://zh.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=pageprops&titles='+encodeURIComponent(chunk.join('|')),{headers:{'user-agent':UA,accept:'application/json'}});
  requests.push({status:response.status,attempt,count:chunk.length});
  if(response.ok){
   const data=await response.json();
   const alias=new Map();
   for(const item of data.query?.normalized||[])alias.set(item.from,item.to);
   for(const item of data.query?.redirects||[])alias.set(item.from,item.to);
   for(const page of data.query?.pages||[]){
    const record={title:page.title,missing:Boolean(page.missing),wikibaseItem:page.pageprops?.wikibase_item||null};
    props[page.title]=record;
    for(const [from,to] of alias)if(to===page.title)props[from]=record;
   }
   break;
  }
  if(response.status!==429&&response.status<500)throw new Error('HTTP '+response.status);
  await sleep(10000*attempt);
 }
 await sleep(1200);
}
const decisions=extracts.entries.map(entry=>{
 if(!entry.zhTitle)return {qid:entry.qid,accepted:false,title:null,reason:'the plan has no Chinese label and no Chinese article was found',evidence:'no title to check'};
 const record=props[entry.zhTitle];
 if(!record||record.missing)return {qid:entry.qid,accepted:false,title:entry.zhTitle,reason:'no Chinese article under this title',evidence:'pageprops lookup returned no page'};
 if(record.wikibaseItem===entry.qid)return {qid:entry.qid,accepted:true,title:record.title,reason:'the Chinese article carries the same Wikidata item as the polity',evidence:'pageprops.wikibase_item = '+record.wikibaseItem};
 return {qid:entry.qid,accepted:false,title:record.title,reason:'the Chinese article carries a different Wikidata item ('+(record.wikibaseItem||'none')+'), so it documents another subject',evidence:'pageprops lookup'};
});
const document={schemaVersion:1,checkedAt:new Date().toISOString(),
 policy:'A Chinese article is cited only when pageprops.wikibase_item equals the polity QID. Rejected entries ship the English article plus the Wikidata entity, and the entry text follows the English article wherever the Chinese introduction disagrees with it.',
 rule:'Where a Chinese introduction and the English article disagree, the English article governs.',
 requests,checked:decisions.length,accepted:decisions.filter(row=>row.accepted).length,
 rejected:decisions.filter(row=>!row.accepted).length,decisions};
await writeFile(resolve(root,'docs/verification-3.26/narratives-zh-verified.json'),JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({checked:document.checked,accepted:document.accepted,rejected:document.rejected,
 rejectedList:decisions.filter(row=>!row.accepted).map(row=>row.qid+' '+(row.title||'')+' -> '+row.reason)},null,1));
