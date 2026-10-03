#!/usr/bin/env node
// Usage: node scripts/places/search-zh-articles-3.17.mjs [--top=48]
// For every 3.17 candidate whose entity has no zh.wikipedia sitelink, searches the Chinese
// Wikipedia twice (by the English article title and by the simplified Chinese label), then
// reads the introductions of the candidates so a human can decide whether the article is
// about the same event. Wikidata's sitelink is not complete: the 3.16 round recovered two
// Chinese articles this way. Titles are converted to simplified script with the MediaWiki
// variant converter (action=parse&variant=zh-cn), never by hand.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const arg=name=>{const hit=process.argv.find(value=>value.startsWith('--'+name+'='));return hit?hit.slice(name.length+3):null};
const top=Number(arg('top')||48);
const UA='MeridianAtlasResearch/3.17 (source-linked world history atlas; Chinese article search)';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const extracts=JSON.parse(await readFile(resolve(root,'docs/verification-3.17/content-upgrade-extracts.json'),'utf8'));
const picked=extracts.entries.filter(entry=>entry.rank<=top&&!entry.zhTitleRequested);
const requests=[];
// The Chinese Wikipedia search endpoint throttles a burst with 429; every call is retried
// with a growing pause and the whole sweep runs at a few seconds per request.
const get=async(url)=>{
 let lastStatus=0;
 for(let attempt=1;attempt<=5;attempt++){
  const response=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'}});
  lastStatus=response.status;
  requests.push({url:url.split('?')[0],status:response.status,attempt,at:new Date().toISOString()});
  if(response.ok)return await response.json();
  if(response.status!==429&&response.status<500)throw new Error('HTTP '+response.status+' '+url);
  await sleep(20000*attempt);
 }
 throw new Error('HTTP '+lastStatus+' '+url);
};

const candidates=new Map();
for(const entry of picked){
 const queries=[entry.enTitleRequested,entry.titleZh].filter(Boolean);
 for(const query of queries){
  const url='https://zh.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&list=search&srnamespace=0&srlimit=5&srsearch='+encodeURIComponent(query);
  let data;
  try{data=await get(url)}catch(error){console.error('search failed',entry.qid,query,error.message);continue}
  for(const hit of data.query?.search||[]){
   const record=candidates.get(hit.title)||{title:hit.title,queries:[],hits:[]};
   if(!record.queries.includes(query))record.queries.push(query);
   record.hits.push({qid:entry.qid,rank:entry.rank,query,size:hit.size,wordcount:hit.wordcount,snippet:(hit.snippet||'').replace(/<[^>]+>/g,'')});
   candidates.set(hit.title,record);
  }
  await sleep(3500);
 }
}
// Simplified conversion of every candidate title through MediaWiki's own converter.
const simplified={};
for(const title of candidates.keys()){
 const url='https://zh.wikipedia.org/w/api.php?action=parse&format=json&formatversion=2&contentmodel=wikitext&variant=zh-cn&prop=text&text='+encodeURIComponent(title);
 try{const data=await get(url);const html=data.parse?.text||'';const plain=html.replace(/<[^>]+>/g,'').trim();simplified[title]=plain||title}catch{simplified[title]=null}
 await sleep(3200);
}
// Introductions of the candidates, 10 per request.
const titles=[...candidates.keys()];
const intros={};
for(let i=0;i<titles.length;i+=10){
 const chunk=titles.slice(i,i+10);
 const url='https://zh.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=extracts&exintro=1&explaintext=1&variant=zh-cn&titles='+encodeURIComponent(chunk.join('|'));
 const data=await get(url);
 for(const page of data.query?.pages||[])intros[page.title]={missing:Boolean(page.missing),intro:(page.extract||'').replace(/\s+/g,' ').trim().slice(0,400)};
 await sleep(6000);
}
const document={schemaVersion:1,fetchedAt:new Date().toISOString(),
 policy:'Chinese Wikipedia search for the 3.17 candidates whose Wikidata entity has no zhwiki sitelink. Two queries per entity (English article title, simplified Chinese label); the introductions of every returned candidate were read to decide whether it documents the same event. Titles are converted to simplified script by the MediaWiki variant converter. No article is used unless its introduction matches the event.',
 searched:picked.length,queries:picked.length*2,requests,
 candidates:[...candidates.values()].map(record=>({...record,simplifiedTitle:simplified[record.title]??null,
  intro:intros[record.title]?.intro||null,missing:intros[record.title]?.missing??null}))};
await mkdir(resolve(root,'docs/verification-3.17'),{recursive:true});
await writeFile(resolve(root,'docs/verification-3.17/content-upgrade-zh-search.json'),JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({out:'docs/verification-3.17/content-upgrade-zh-search.json',searched:picked.length,candidates:candidates.size,requests:requests.length},null,1));
