#!/usr/bin/env node
// Usage: node docs/verification-3.23/verify-zh-3.23.mjs
// Decides, for every entry of the second narratives batch, whether the Chinese Wikipedia article
// may be cited. Two sources are used:
//   * pageprops.wikibase_item of the Chinese article title, compared with the polity QID - an
//     article that carries the same item is the same entity;
//   * for articles without an item (or a different one), the introductions gathered in the two
//     lookup passes, read by hand and recorded with the decision.
// Output: docs/verification-3.23/narratives-zh-verified.json, which the builder reads.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const UA='MeridianAtlasResearch/3.23 (source-linked world history atlas; Chinese identity check)';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const extracts=JSON.parse(await readFile(resolve(root,'docs/verification-3.23/narratives-extracts.json'),'utf8'));
const lookup=JSON.parse(await readFile(resolve(root,'docs/verification-3.23/narratives-zh-lookup.json'),'utf8'));
const lookupByQid=new Map(lookup.results.map(row=>[row.qid,row]));
// Hand decisions for the entries whose label article was missing: the article is accepted only
// when its introduction is about this polity. Everything else is rejected with the reason.
const HAND={
 Q1155700:{accept:'拉達那哥欣王國',reason:'The article is the Rattanakosin Kingdom itself.'},
 Q734867:{accept:'萬丹蘇丹國',reason:'The article is the Banten Sultanate itself.'},
 Q2247225:{accept:'塔魯曼內格拉',reason:'The article is Tarumanagara itself.'},
 Q248572:{accept:'馬京達瑙蘇丹國',reason:'The article is the Sultanate of Maguindanao itself.'},
 Q187979:{accept:'早王朝時期 (埃及)',reason:'The article is the Early Dynastic Period of Egypt itself.'},
 Q4899891:{reject:'searched candidates are the Ottoman vilayet, the Eastern Crisis and unrelated biographies; none documents the Beylik of Tunis'},
 Q1709337:{reject:'no Chinese article about the Emirate of Nekor; the search returned an unrelated list and biographies'},
 Q309272:{reject:'the candidates are the Roman provinces Mauretania Caesariensis and Tingitana, not the kingdom of Mauretania'},
 Q748595:{reject:'no Chinese article about Qataban; the search returned unrelated lists'},
 Q1109279:{reject:'the candidates are the modern country and unrelated articles; none documents the First Mexican Republic'},
 Q466803:{reject:'the candidates are the Pala dynasty, Tamil people and unrelated topics, not the Pallava dynasty'},
 Q5636647:{reject:'the candidates are other dynasties (Umayyad, Samanid, Habsburg, Mirdasid, Nasrid), not the Habbari dynasty'},
 Q1315339:{reject:'no Chinese article found for the Lohara dynasty'},
 Q123027565:{reject:'no Chinese article about the Kashmir Sultanate; the search returned Pakistan and unrelated pages'},
 Q5519387:{reject:'the candidates are other kingdoms (Suebi, Frankish, Lavo) and unrelated pages, not Galuh'},
 Q3503555:{reject:'the candidates are the Malacca Sultanate, Singapore and an airport, not Palembang'},
 Q287996:{reject:'no Chinese article about Blambangan; the search returned unrelated pages'},
 Q2817348:{reject:'no Chinese article about the Bima Sultanate'},
 Q4401026:{reject:'no Chinese article found for the Kingdom of Namayan'}};
const url='https://zh.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=pageprops&titles=';
const titles=[...new Set(extracts.entries.filter(entry=>entry.zhTitle).map(entry=>entry.zhTitle))];
const props={};
const requests=[];
for(let i=0;i<titles.length;i+=50){
 const chunk=titles.slice(i,i+50);
 for(let attempt=1;attempt<=4;attempt++){
  const response=await fetch(url+encodeURIComponent(chunk.join('|')),{headers:{'user-agent':UA,accept:'application/json'}});
  requests.push({status:response.status,attempt,count:chunk.length});
  if(response.ok){
   const data=await response.json();
   const aliases=new Map();
   for(const item of data.query?.normalized||[])aliases.set(item.from,item.to);
   for(const item of data.query?.redirects||[])aliases.set(item.from,item.to);
   for(const page of data.query?.pages||[]){
    const record={title:page.title,missing:Boolean(page.missing),wikibaseItem:page.pageprops?.wikibase_item||null};
    props[page.title]=record;
    for(const [from,to] of aliases)if(to===page.title)props[from]=record;
   }
   break;
  }
  if(response.status!==429&&response.status<500)throw new Error('HTTP '+response.status);
  await sleep(10000*attempt);
 }
 await sleep(1500);
}
const decisions=extracts.entries.map(entry=>{
 const hand=HAND[entry.qid];
 if(hand?.accept){return {qid:entry.qid,accepted:true,title:hand.accept,reason:hand.reason,evidence:'hand review of the introduction'}}
 if(hand?.reject){return {qid:entry.qid,accepted:false,title:entry.zhTitle||null,reason:hand.reject,evidence:'hand review of the search candidates'}}
 const record=entry.zhTitle?props[entry.zhTitle]:null;
 if(!entry.zhTitle||!record||record.missing)return {qid:entry.qid,accepted:false,title:entry.zhTitle||null,reason:'no Chinese article under the recorded label',evidence:'pageprops lookup returned no page'};
 if(record.wikibaseItem===entry.qid)return {qid:entry.qid,accepted:true,title:record.title,reason:'the Chinese article carries the same Wikidata item as the polity',evidence:'pageprops.wikibase_item = '+record.wikibaseItem};
 return {qid:entry.qid,accepted:false,title:record.title,reason:'the Chinese article under the label carries a different Wikidata item ('+(record.wikibaseItem||'none')+')',evidence:'pageprops lookup'};
});
const document={schemaVersion:1,checkedAt:new Date().toISOString(),
 policy:'Chinese citation decisions for the 3.23 batch: an article is cited only when pageprops.wikibase_item equals the polity QID, or when its introduction was read and confirmed by hand. Rejections are recorded with their reason and the entry then ships with an English citation plus the Wikidata entity (identity and period) so that every entry still carries at least two https sources.',
 requests,checked:decisions.length,accepted:decisions.filter(row=>row.accepted).length,
 rejected:decisions.filter(row=>!row.accepted).length,decisions};
await writeFile(resolve(root,'docs/verification-3.23/narratives-zh-verified.json'),JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({checked:document.checked,accepted:document.accepted,rejected:document.rejected,
 acceptedList:decisions.filter(row=>row.accepted).map(row=>row.qid+' '+row.title),
 rejectedSample:decisions.filter(row=>!row.accepted).slice(0,6).map(row=>row.qid+' '+row.reason)},null,1));
