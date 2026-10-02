#!/usr/bin/env node
// Usage: node scripts/places/enrich-thin-region-details.mjs [harvest.json]
// The 3.15 sweep's detail phase asked WDQS for participants through the in-query label service,
// which the endpoint rejected, so the harvested items kept empty participant, conflict and
// country lists. This script refills them without the label service: the entity links come from a
// plain OPTIONAL query per 100 items, and the labels come from the Wikidata Action API
// (zh-hans / zh-cn / zh first, English for the layer's English fields). Chinese labels that arrive
// in traditional script are converted through zh.wikipedia variant=zh-cn, the same route
// scripts/places/fetch-thin-region-battles.mjs uses. English labels are merged into
// editorial/entity-labels-en.json, which build-battles.mjs already reads.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const harvestPath=process.argv[2]||'editorial/battles-thin-regions-3.15.json';
const UA='MeridianAtlas/3.15 (research; source-linked history atlas)';
const ENDPOINT='https://query.wikidata.org/sparql';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const requests=[];
const sparql=async(query,label)=>{
 for(let attempt=1;attempt<=4;attempt++){
  try{
   const response=await fetch(ENDPOINT,{method:'POST',headers:{'user-agent':UA,accept:'application/sparql-results+json','content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({query}),signal:AbortSignal.timeout(110000)});
   requests.push({query:label,attempt,status:response.status});
   if(response.ok)return await response.json();
  }catch(error){requests.push({query:label,attempt,error:String(error.message||error).slice(0,60)})}
  if(attempt===4)return null;
  await sleep(10000*attempt);
 }
};
const traditional=/[與臺灣國學會東車馬鳥魚點線個時間問題則無為說話語實質軍戰勝歐亞羅蘇聯義紀興漢滿蒙藏臺爾佔]/;

const harvest=JSON.parse(await readFile(resolve(root,harvestPath),'utf8'));
const targets=harvest.items.filter(item=>!(item.belligerents||[]).length&&!(item.parts||[]).length&&!(item.countries||[]).length);
console.log('harvest items',harvest.items.length,'without details',targets.length);
const details=new Map();
for(let i=0;i<targets.length;i+=100){
 const chunk=targets.slice(i,i+100).map(item=>item.qid);
 const query='SELECT ?item ?belligerent ?part ?country ?refUrl WHERE {'
  +' VALUES ?item { '+chunk.map(qid=>'wd:'+qid).join(' ')+' }'
  +' OPTIONAL { ?item wdt:P710 ?belligerent }'
  +' OPTIONAL { ?item wdt:P361 ?part }'
  +' OPTIONAL { ?item wdt:P17 ?country }'
  +' OPTIONAL { ?item p:P585/prov:wasDerivedFrom/pr:P854 ?refUrl } }';
 const result=await sparql(query,'details:'+i);
 if(result)for(const row of result.results.bindings){
  const qid=row.item.value.split('/').pop();
  if(!details.has(qid))details.set(qid,{belligerents:[],parts:[],countries:[],refs:[]});
  const entry=details.get(qid);
  const push=(key,value)=>{if(value&&!entry[key].includes(value))entry[key].push(value)};
  push('belligerents',row.belligerent?.value?.split('/').pop());
  push('parts',row.part?.value?.split('/').pop());
  push('countries',row.country?.value?.split('/').pop());
  push('refs',row.refUrl?.value);
 }else console.log('details chunk',i,'FAILED');
 await sleep(5000);
}
const entityQids=[...new Set([...details.values()].flatMap(entry=>[...entry.belligerents,...entry.parts,...entry.countries]))];
console.log('participant entities to label',entityQids.length);
const labels=new Map();
for(let i=0;i<entityQids.length;i+=50){
 const chunk=entityQids.slice(i,i+50);
 const url='https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&formatversion=2&props=labels%7Csitelinks&languages=zh-hans%7Czh-cn%7Czh%7Cen&sitefilter=zhwiki&ids='+chunk.join('%7C');
 try{
  const response=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'},signal:AbortSignal.timeout(60000)});
  requests.push({query:'labels',status:response.status});
  const data=await response.json();
  for(const [qid,entity] of Object.entries(data.entities||{})){
   const zh=entity.labels?.['zh-hans']||entity.labels?.['zh-cn']||entity.labels?.zh||null;
   const en=entity.labels?.en||null;
   labels.set(qid,{zh:zh?.value||entity.sitelinks?.zhwiki?.title||null,en:en?.value||null});
  }
 }catch(error){requests.push({query:'labels',error:String(error.message||error).slice(0,60)})}
 await sleep(1200);
}
const toConvert=new Set();
for(const value of labels.values())if(value.zh&&traditional.test(value.zh))toConvert.add(value.zh);
const converted=new Map();
const convertList=[...toConvert];
for(let i=0;i<convertList.length;i+=60){
 const chunk=convertList.slice(i,i+60);
 try{
  const response=await fetch('https://zh.wikipedia.org/w/api.php',{method:'POST',headers:{'user-agent':UA,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({action:'parse',format:'json',formatversion:'2',variant:'zh-cn',prop:'text',text:chunk.join('\n')}),signal:AbortSignal.timeout(60000)});
  requests.push({query:'convert',status:response.status});
  const data=await response.json();
  const text=(data?.parse?.text||'').replace(/<[^>]*>/g,' ').replace(/&[a-z]+;/g,' ').split('\n').map(line=>line.trim()).filter(Boolean);
  chunk.forEach((value,index)=>converted.set(value,(text[index]||value).trim()));
 }catch{for(const value of chunk)converted.set(value,value)}
 await sleep(1200);
}
const zhLabel=qid=>{const value=labels.get(qid)?.zh;return value?(converted.get(value)||value):null};
const enLabel=qid=>labels.get(qid)?.en||null;
let filled=0,withParticipants=0;
for(const item of harvest.items){
 const entry=details.get(item.qid);
 if(!entry)continue;
 filled++;
 if(!(item.belligerents||[]).length)item.belligerents=entry.belligerents.map(zhLabel).filter(Boolean);
 if(!(item.parts||[]).length)item.parts=entry.parts.map(zhLabel).filter(Boolean);
 if(!(item.countries||[]).length)item.countries=entry.countries.map(zhLabel).filter(Boolean);
 if(!(item.refs||[]).length)item.refs=entry.refs.slice();
 if(item.belligerents.length||item.parts.length||item.countries.length)withParticipants++;
}
const entityLabels=JSON.parse(await readFile(resolve(root,'editorial/entity-labels-en.json'),'utf8'));
for(const [qid,entry] of details){
 entityLabels.labels[qid]={belligerents:entry.belligerents.map(entity=>({qid:entity,label:enLabel(entity)})),
  conflict:entry.parts.map(entity=>({qid:entity,label:enLabel(entity)})),
  countries:entry.countries.map(entity=>({qid:entity,label:enLabel(entity)}))};
}
entityLabels.resolvedEntities=Object.keys(entityLabels.labels).length;
entityLabels.fetchedAt=new Date().toISOString();
entityLabels.mergedFrom='scripts/places/enrich-thin-region-details.mjs (3.15 thin-region supplement)';
harvest.detailsEnrichedAt=new Date().toISOString();
harvest.detailsEnriched='Participants, conflicts and countries were refilled without the WDQS label service: entity links from a plain OPTIONAL query, labels from the Wikidata Action API, traditional Chinese converted through zh.wikipedia variant=zh-cn. English labels merged into editorial/entity-labels-en.json.';
harvest.requests=[...(harvest.requests||[]),...requests];
await writeFile(resolve(root,harvestPath),JSON.stringify(harvest,null,2)+'\n');
await writeFile(resolve(root,'editorial/entity-labels-en.json'),JSON.stringify(entityLabels,null,2)+'\n');
console.log(JSON.stringify({harvest:harvestPath,items:harvest.items.length,refilled:filled,withParticipants,entitiesLabelled:entityQids.length,failedChunks:requests.filter(r=>r.status&&r.status>=400).length},null,2));
