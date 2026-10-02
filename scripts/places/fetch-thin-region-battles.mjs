#!/usr/bin/env node
// Usage: node scripts/places/fetch-thin-region-battles.mjs [out.json]
// Harvests the Wikidata entities that document armed events inside the three regions the
// battle layer covers thinly: Oceania, South Asia and Southeast Asia. The boxes are the
// same documented coordinate boxes scripts/places/build-battles.mjs assigns regions with.
//
// Standards are unchanged: an entity ships only when Wikidata records BOTH a P625
// coordinate and a P585 date, and only when a Chinese name exists (Wikidata zh label or a
// zh.wikipedia article title, the latter marked labelSource=zhwiki-sitelink).
//
// Class roots: battle (Q178561), naval battle (Q1261499), siege (Q188055), military
// operation (Q645883) and massacre (Q3199915), expanded through the subclass path on the
// class side (?class wdt:P279* ?root). Two shapes were rejected because WDQS answers them
// with 504/timeouts: the item-side traversal (?item wdt:P31/wdt:P279* ?root) over a
// bounding box, and the in-query label service over the same result set. Labels and
// sitelinks therefore come from the Wikidata Action API (50 entities per call), which is
// also where the zh.wikipedia fallback name is read.
import {writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const outPath=resolve(root,process.argv[2]||'editorial/battles-thin-regions-3.14.json');
const UA='MeridianAtlas/3.14 (research; data import for a source-linked history atlas)';
const ENDPOINT='https://query.wikidata.org/sparql';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const requests=[];
const sparql=async(query,label)=>{
 for(let attempt=1;attempt<=3;attempt++){
  try{
   const response=await fetch(ENDPOINT,{method:'POST',headers:{'user-agent':UA,accept:'application/sparql-results+json','content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({query}),signal:AbortSignal.timeout(110000)});
   requests.push({query:label,attempt,status:response.status});
   if(response.ok)return await response.json();
  }catch(error){requests.push({query:label,attempt,error:String(error.message||error).slice(0,60)})}
  if(attempt===3)return null;
  await sleep(12000*attempt);
 }
};
const CLASSES=['Q178561','Q1261499','Q188055','Q645883','Q3199915'];
const BOXES=[
 {id:'oceania',lon:[110,180],lat:[-50,0]},
 {id:'south-asia',lon:[60,92],lat:[0,37]},
 {id:'southeast-asia',lon:[92,141],lat:[-11,25]}];
const traditional=/[與臺灣國學會東車馬鳥魚點線個時間問題則無為說話語實質軍戰勝歐亞羅馬蘇聯義紀興漢滿蒙藏臺爾佔]/;

// The subclass path and the coordinate join together are what WDQS answers with 504:
// evaluating ?class wdt:P279* ?root over a bounding box timed out for Oceania and South Asia
// in the 3.14 pass and again on the first 3.15 attempt. The tree is therefore enumerated once
// per root in a query with no geo join, and the concrete classes are then applied per box in
// VALUES chunks. If the enumeration itself fails, the original single box query is still tried.
const rows=new Map();
const boxesHarvested=[];
const classLists=[];
let classEnumerationOk=true;
for(const root of CLASSES){
 const query='SELECT DISTINCT ?class WHERE { ?class wdt:P279* wd:'+root+' }';
 const result=await sparql(query,'classes:'+root);
 if(!result){classEnumerationOk=false;console.log('class enumeration FAILED for',root);continue}
 for(const row of result.results.bindings)classLists.push(row.class.value.split('/').pop());
 console.log('class root',root,'classes so far',new Set(classLists).size);
 await sleep(5000);
}
const classes=[...new Set(classLists)];
const chunksOf=(list,size)=>{const out=[];for(let i=0;i<list.length;i+=size)out.push(list.slice(i,i+size));return out};
const collect=result=>{
 let added=0;
 for(const row of result.results.bindings){
  const qid=row.item.value.split('/').pop();
  if(rows.has(qid))continue;
  rows.set(qid,{qid,year:Number(/^(-?\d{1,6})-/.exec(row.date.value)[1]),coordinates:[Number(row.lon.value),Number(row.lat.value)],
   classQid:(row.class?.value||'').split('/').pop()||null,box:null});
  added++;
 }
 return added;
};
for(const box of BOXES){
 let added=0,failedChunks=0,usedFallback=false;
 const boxOf=qid=>{if(rows.has(qid)&&!rows.get(qid).box)rows.get(qid).box=box.id};
 // A chunk that times out is split in half and retried, so the broad classes (battle, siege,
// naval battle, military operation) that carry the most instances cannot silently drop out of
// the sweep; only chunks of 24 classes or fewer are given up on, and those are logged.
 if(classes.length){
  const harvestChunk=async(list,label)=>{
   if(!list.length)return 0;
   const query='SELECT DISTINCT ?item ?date ?lat ?lon ?class WHERE {'
    +' VALUES ?class { '+list.map(qid=>'wd:'+qid).join(' ')+' }'
    +' ?item wdt:P31 ?class ; wdt:P585 ?date ; p:P625/psv:P625 ?node .'
    +' ?node wikibase:geoLatitude ?lat ; wikibase:geoLongitude ?lon .'
    +' FILTER(?lon >= '+box.lon[0]+' && ?lon <= '+box.lon[1]+' && ?lat >= '+box.lat[0]+' && ?lat <= '+box.lat[1]+')'
    +' FILTER(YEAR(?date) >= -4000 && YEAR(?date) <= 2026) }';
   const result=await sparql(query,'classes-box:'+label);
   if(result){
    let gained=0;
    for(const row of result.results.bindings){
     const qid=row.item.value.split('/').pop();
     if(!rows.has(qid)){
      rows.set(qid,{qid,year:Number(/^(-?\d{1,6})-/.exec(row.date.value)[1]),coordinates:[Number(row.lon.value),Number(row.lat.value)],
       classQid:(row.class?.value||'').split('/').pop()||null,box:null});
      gained++;
     }
     if(rows.get(qid)&&!rows.get(qid).box)rows.get(qid).box=box.id;
    }
    await sleep(5000);
    return gained;
   }
   if(list.length<=24){failedChunks++;console.log('chunk',label,'FAILED permanently with',list.length,'classes');await sleep(5000);return 0}
   const half=Math.ceil(list.length/2);
   console.log('chunk',label,'FAILED, splitting',list.length,'classes into',half,'+',list.length-half);
   return await harvestChunk(list.slice(0,half),label+'a')+await harvestChunk(list.slice(half),label+'b');
  };
  for(const [index,chunk] of chunksOf(classes,60).entries())added+=await harvestChunk(chunk,box.id+':'+index);
 }
 if(added===0){
  usedFallback=true;
  const query='SELECT DISTINCT ?item ?date ?lat ?lon ?class WHERE {'
   +' VALUES ?root { '+CLASSES.map(qid=>'wd:'+qid).join(' ')+' }'
   +' ?class wdt:P279* ?root .'
   +' ?item wdt:P31 ?class ; wdt:P585 ?date ; p:P625/psv:P625 ?node .'
   +' ?node wikibase:geoLatitude ?lat ; wikibase:geoLongitude ?lon .'
   +' FILTER(?lon >= '+box.lon[0]+' && ?lon <= '+box.lon[1]+' && ?lat >= '+box.lat[0]+' && ?lat <= '+box.lat[1]+')'
   +' FILTER(YEAR(?date) >= -4000 && YEAR(?date) <= 2026) }';
  const result=await sparql(query,'box:'+box.id);
  if(result){added+=collect(result);for(const row of result.results.bindings)boxOf(row.item.value.split('/').pop())}
  else console.log('box',box.id,'FAILED (WDQS timeout); keeping the partial harvest');
 }
 boxesHarvested.push({box:box.id,added,failedChunks,usedFallback,total:rows.size});
 console.log('box',box.id,'new items',added,'total',rows.size);
 await sleep(5000);
}

// Labels and sitelinks through the Action API: zh name, zh.wikipedia fallback, English name.
const labels=new Map(),sitelinks=new Map();
const allQids=[...rows.keys()];
for(let i=0;i<allQids.length;i+=50){
 const chunk=allQids.slice(i,i+50);
 const url='https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&formatversion=2&props=labels%7Csitelinks&languages=zh-hans%7Czh-cn%7Czh%7Cen&sitefilter=zhwiki%7Cenwiki&ids='+chunk.join('%7C');
 try{
  const response=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'},signal:AbortSignal.timeout(60000)});
  requests.push({query:'labels',status:response.status});
  const data=await response.json();
  for(const [qid,entity] of Object.entries(data.entities||{})){
   const zh=entity.labels?.zh||entity.labels?.['zh-hans']||entity.labels?.['zh-cn']||null;
   const en=entity.labels?.en||null;
   labels.set(qid,{zh:zh?.value||null,zhLang:zh?.language||null,en:en?.value||null});
   const title=entity.sitelinks?.zhwiki?.title||null;
   if(title)sitelinks.set(qid,title);
  }
 }catch(error){requests.push({query:'labels',error:String(error.message||error).slice(0,60)})}
 await sleep(1200);
}

const details=new Map();
for(let i=0;i<allQids.length;i+=100){
 const chunk=allQids.slice(i,i+100);
 const query='SELECT ?item ?belligerentLabel ?partLabel ?countryLabel ?refUrl WHERE {'
  +' VALUES ?item { '+chunk.map(qid=>'wd:'+qid).join(' ')+' }'
  +' OPTIONAL { ?item wdt:P710 ?belligerent }'
  +' OPTIONAL { ?item wdt:P361 ?part }'
  +' OPTIONAL { ?item wdt:P17 ?country }'
  +' OPTIONAL { ?item p:P585/prov:wasDerivedFrom/pr:P854 ?refUrl }'
  +' SERVICE wikibase:label { bd:serviceParam wikibase:language "zh-hans,zh-cn,zh,en". } }';
 const result=await sparql(query,'details:'+i);
 if(result)for(const row of result.results.bindings){
  const qid=row.item.value.split('/').pop();
  if(!details.has(qid))details.set(qid,{belligerents:[],parts:[],countries:[],refs:[]});
  const entry=details.get(qid);
  const push=(key,value)=>{if(value&&!entry[key].includes(value))entry[key].push(value)};
  push('belligerents',row.belligerentLabel?.value);push('parts',row.partLabel?.value);push('countries',row.countryLabel?.value);push('refs',row.refUrl?.value);
 }
 await sleep(5000);
}

const toConvert=new Set();
for(const item of rows.values()){
 const zh=labels.get(item.qid)?.zh,title=sitelinks.get(item.qid);
 if(zh&&traditional.test(zh))toConvert.add(zh);
 if(title&&traditional.test(title))toConvert.add(title);
}
for(const entry of details.values())for(const list of [entry.belligerents,entry.parts,entry.countries])for(const value of list)if(traditional.test(value))toConvert.add(value);
const converted=new Map();
const list=[...toConvert];
for(let i=0;i<list.length;i+=60){
 const chunk=list.slice(i,i+60);
 try{
  const response=await fetch('https://zh.wikipedia.org/w/api.php',{method:'POST',headers:{'user-agent':UA,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({action:'parse',format:'json',formatversion:'2',variant:'zh-cn',prop:'text',text:chunk.join('\n')}),signal:AbortSignal.timeout(60000)});
  requests.push({query:'convert',status:response.status});
  const data=await response.json();
  const text=(data?.parse?.text||'').replace(/<[^>]*>/g,' ').replace(/&[a-z]+;/g,' ').split('\n').map(line=>line.trim()).filter(Boolean);
  chunk.forEach((value,index)=>converted.set(value,(text[index]||value).trim()));
 }catch(error){for(const value of chunk)converted.set(value,value)}
 await sleep(1200);
}

const items=[...rows.values()].map(item=>{
 const label=labels.get(item.qid)||{};
 const zhLabel=label.zh?(converted.get(label.zh)||label.zh):null;
 const title=sitelinks.get(item.qid);
 const zhTitle=title?(converted.get(title)||title):null;
 const detail=details.get(item.qid)||{belligerents:[],parts:[],countries:[],refs:[]};
 return {...item,label:zhLabel||zhTitle||label.en||item.qid,labelLang:zhLabel?'zh':'en',enLabel:label.en||null,
  labelZh:zhLabel||zhTitle||null,
  labelSource:zhLabel?'wikidata-zh-label':(zhTitle?'zhwiki-sitelink':null),
  belligerents:detail.belligerents.map(value=>converted.get(value)||value),
  parts:detail.parts.map(value=>converted.get(value)||value),
  countries:detail.countries.map(value=>converted.get(value)||value),
  refs:detail.refs};
});
const byBox=items.reduce((all,item)=>(all[item.box]=(all[item.box]||0)+1,all),{});
const byBoxNamed=items.reduce((all,item)=>{if(item.labelZh)all[item.box]=(all[item.box]||0)+1;return all},{});
const output={schemaVersion:1,fetchedAt:new Date().toISOString(),
 source:'Wikidata Query Service sweep of the Oceania, South Asia and Southeast Asia coordinate boxes, with the class roots battle (Q178561), naval battle (Q1261499), siege (Q188055), military operation (Q645883) and massacre (Q3199915) expanded through their subclass paths; every item keeps a P625 coordinate and a P585 date. Labels and sitelinks come from the Wikidata Action API.',
 endpoint:ENDPOINT,boxes:BOXES.reduce((all,box)=>(all[box.id]=box,all),{}),classQids:CLASSES,
 classEnumeration:{roots:CLASSES,concreteClasses:classes.length,ok:classEnumerationOk},boxesHarvested,requests,count:items.length,items};
await writeFile(outPath,JSON.stringify(output,null,2)+'\n');
const byClass=items.reduce((all,item)=>(all[item.classQid]=(all[item.classQid]||0)+1,all),{});
console.log(JSON.stringify({out:outPath,items:items.length,byBox,byBoxNamed,byClass,withZh:items.filter(i=>i.labelZh).length,fromZhwikiSitelink:items.filter(i=>i.labelSource==='zhwiki-sitelink').length},null,2));
