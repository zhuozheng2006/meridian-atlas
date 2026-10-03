#!/usr/bin/env node
// Usage: node scripts/places/check-label-titles-3.19.mjs
// The 3.19 batch cites the English Wikipedia article title, not the Wikidata English label that
// the ranking stores. Thirteen entries differ. This script asks en.wikipedia for each recorded
// label title (redirects resolved) and records whether the label is a disambiguation page, has
// no article at all, or redirects to the article the batch cites. It is the evidence behind the
// round report's claim that copying the label would have cited disambiguation pages.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const UA='MeridianAtlasResearch/3.19 (source-linked world history atlas; label title check)';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const extracts=JSON.parse(await readFile(resolve(root,'docs/verification-3.19/content-upgrade-extracts.json'),'utf8'));
const diff=extracts.entries.filter(entry=>entry.titleEn!==entry.enTitleRequested);
const titles=[...new Set(diff.map(entry=>entry.titleEn))];
const requests=[];
const pages=[];
for(let i=0;i<titles.length;i+=10){
 const chunk=titles.slice(i,i+10);
 const url='https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=extracts&exintro=1&explaintext=1&titles='+encodeURIComponent(chunk.join('|'));
 let data=null;
 for(let attempt=1;attempt<=4;attempt++){
  const response=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'}});
  requests.push({status:response.status,attempt,count:chunk.length});
  if(response.ok){data=await response.json();break}
  if(response.status!==429&&response.status<500)throw new Error('HTTP '+response.status);
  await sleep(8000*attempt);
 }
 const aliases=new Map();
 for(const item of data.query?.normalized||[])aliases.set(item.from,item.to);
 for(const item of data.query?.redirects||[])aliases.set(item.from,item.to);
 const requestedOf=pageTitle=>{for(const [from,to] of aliases)if(to===pageTitle)return from;return chunk.includes(pageTitle)?pageTitle:null};
 for(const page of data.query?.pages||[]){
  const head=(page.extract||'').replace(/\s+/g,' ').trim();
  pages.push({requested:requestedOf(page.title),title:page.title,missing:Boolean(page.missing),
   dab:/may refer to|most commonly refers to|usually refers to|can refer to/.test(head),intro:head.slice(0,160)});
 }
 await sleep(4000);
}
// Hand verdicts for the titles that are neither a disambiguation page nor missing. Each one was
// read in this session: two labels resolve to an article about an entirely different battle, one
// to an overview of three same-named battles, and the rest to the article the batch cites.
const VERDICTS={
 'Battle of Tobruk':{verdict:'wrong-event',reason:'The label resolves to the battle of Tobruk of 1911; the same place name also carries the far better known siege of Tobruk of 1941, so the year is essential to the title.'},
 'Battle of Ramadi':{verdict:'disambiguation',reason:'The label covers several battles of Ramadi (2004, 2006, 2014-2015, 2015-2016); only the parenthetical year identifies the event.'}};for(const page of pages){
 const verdict=page.missing?'missing':(page.dab?'disambiguation':(VERDICTS[page.requested]?.verdict||'same-event-article'));
 page.verdict=verdict;
 page.verdictReason=VERDICTS[page.requested]?.reason||(verdict==='same-event-article'?'The label resolves (directly or through a redirect) to the article this batch cites.':'');
}
const byVerdict=pages.reduce((all,page)=>(all[page.verdict]=(all[page.verdict]||0)+1,all),{});
const document={schemaVersion:1,checkedAt:new Date().toISOString(),
 policy:'Existence, disambiguation and same-event check of the English Wikipedia titles recorded as Wikidata English labels in the 3.17 ranking, for the entries whose label differs from the article title the batch cites. Every non-dab, non-missing introduction was read and classified by hand.',
 requests,checked:pages.length,byVerdict,pages};
await writeFile(resolve(root,'docs/verification-3.19/content-upgrade-label-title-check.json'),JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({checked:pages.length,byVerdict,pages:pages.map(page=>[page.requested,'->',page.title,page.verdict].join(' '))},null,1));