#!/usr/bin/env node
// Usage: node scripts/places/fetch-atrocity-labels.mjs
// Resolves Chinese and English names for the pool of records that build-battles.mjs keeps out
// of the battle layer (Wikidata class massacre, the police-raid class, and the two hand-listed
// one-sided killings). The 3.15 sweep deliberately skipped the WDQS label service, so most of
// these records ship with an English label only; this pass reads wbgetentities to recover the
// zh label and the zh.wikipedia sitelink title, which is what a separate layer would need.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const UA='MeridianAtlasResearch/3.16 (source-linked world history atlas; separate-layer study)';
const CLASS_EXCLUSIONS=new Set(['Q3199915','Q97368680']);
const ITEM_EXCLUSIONS=new Set(['Q208855','Q1136783']);
const harvest=JSON.parse(await readFile(resolve(root,'editorial/battles-thin-regions-3.15.json'),'utf8'));
const pool=harvest.items.filter(item=>CLASS_EXCLUSIONS.has(item.classQid)||ITEM_EXCLUSIONS.has(item.qid));
const requests=[];
const fetchBatch=async ids=>{
 const url='https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&formatversion=2&props=labels|sitelinks&languages=zh|en&sitefilter=zhwiki|enwiki&ids='+ids.join('|');
 for(let attempt=1;attempt<=4;attempt++){
  const response=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'}});
  requests.push({status:response.status,count:ids.length,attempt});
  if(response.ok)return await response.json();
  if(response.status!==429&&response.status<500)throw new Error('HTTP '+response.status);
  await sleep(5000*attempt);
 }
 throw new Error('kept returning throttling responses');
};
const resolved={};
for(let i=0;i<pool.length;i+=50){
 const ids=pool.slice(i,i+50).map(item=>item.qid);
 const data=await fetchBatch(ids);
 for(const [qid,entity] of Object.entries(data.entities||{})){
  const zhLabel=entity.labels?.zh?.value||null;
  const enLabel=entity.labels?.en?.value||null;
  const zhWiki=entity.sitelinks?.zhwiki?.title||null;
  const enWiki=entity.sitelinks?.enwiki?.title||null;
  resolved[qid]={zhLabel,enLabel,zhWiki,enWiki};
 }
 await sleep(2500);
}
const entries=pool.map(item=>{
 const r=resolved[item.qid]||{};
 const nameZh=r.zhLabel||r.zhWiki||null;
 return {...item,nameZh,nameZhSource:r.zhLabel?'wikidata-zh-label':(r.zhWiki?'zhwiki-sitelink':null),
  nameEn:item.enLabel||r.enLabel||null,enWiki:r.enWiki||null};
});
const document={schemaVersion:1,fetchedAt:new Date().toISOString(),
 policy:'Names recovered from Wikidata wbgetentities (labels and zhwiki/enwiki sitelinks) for the records that build-battles.mjs excludes from the battle layer. Coordinates, years, classes and countries are inherited unchanged from editorial/battles-thin-regions-3.15.json and were not re-fetched.',
 source:'https://www.wikidata.org/w/api.php action=wbgetentities',requests,count:entries.length,entries};
await writeFile(resolve(root,'editorial/atrocities-pool-3.16.json'),JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({count:entries.length,withChineseName:entries.filter(e=>e.nameZh).length,
 bySource:entries.reduce((all,e)=>(all[e.nameZhSource||'none']=(all[e.nameZhSource||'none']||0)+1,all),{}),
 withEnglishName:entries.filter(e=>e.nameEn).length,requests:requests.length},null,2));
