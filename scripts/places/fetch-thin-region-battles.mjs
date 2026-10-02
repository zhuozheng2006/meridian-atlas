#!/usr/bin/env node
// Usage: node scripts/places/fetch-thin-region-battles.mjs [out.json]
// Harvests the Wikidata entities that document armed events inside the three regions the
// battle layer covers thinly: Oceania, South Asia and Southeast Asia. The region boxes are
// the same documented coordinate boxes scripts/places/build-battles.mjs assigns regions
// with, so the sweep cannot import an entity the layer would then place elsewhere.
//
// Standards are unchanged: an entity ships only when Wikidata records BOTH a P625
// coordinate and a P585 date. The class set is wider than the base harvest (battle and
// subclasses, naval battle, siege, military operation, massacre) because the three boxes
// are thin in the battle class alone; every extra class is still an armed event with a
// source statement, and the class QID is recorded on every item so the choice is auditable.
// Chinese names come from the Wikidata zh labels; when an entity has none but has a
// zh.wikipedia article, the article title is used and marked labelSource=zhwiki-sitelink.
//
// The harvested file is an intermediate research record for scripts/places/build-battles.mjs.
import {writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const outPath=resolve(root,process.argv[2]||'editorial/battles-thin-regions-3.14.json');
const UA='MeridianAtlas/3.14 (research; data import for a source-linked history atlas)';
const ENDPOINT='https://query.wikidata.org/sparql';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const requests=[];
const sparql=async query=>{
 for(let attempt=1;attempt<=4;attempt++){
  const response=await fetch(ENDPOINT,{method:'POST',headers:{'user-agent':UA,accept:'application/sparql-results+json','content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({query})});
  requests.push({endpoint:'wdqs',attempt,status:response.status});
  if(response.ok)return await response.json();
  if(attempt===4)throw new Error('WDQS HTTP '+response.status);
  await sleep(response.status===429?15000*attempt:4000*attempt);
 }
};
const CLASSES=['Q178561','Q1261499','Q188055','Q645883','Q3199915'];
const BOXES=[
 {id:'oceania',lon:[110,180],lat:[-50,0]},
 {id:'south-asia',lon:[60,92],lat:[0,37]},
 {id:'southeast-asia',lon:[92,141],lat:[-11,25]}];
const traditional=/[與臺灣國學會東車馬鳥魚點線個時間問題則無為說話語實質軍戰勝歐亞羅馬蘇聯義紀興漢滿蒙藏臺爾佔]/;

const rows=new Map();
for(const box of BOXES){
 const query='SELECT DISTINCT ?item ?itemLabel ?date ?lat ?lon ?enLabel ?class WHERE {'
  +' VALUES ?class { '+CLASSES.map(qid=>'wd:'+qid).join(' ')+' }'
  +' ?item wdt:P31/wdt:P279* ?class ; wdt:P585 ?date ; p:P625/psv:P625 ?node .'
  +' ?node wikibase:geoLatitude ?lat ; wikibase:geoLongitude ?lon .'
  +' FILTER(?lon >= '+box.lon[0]+' && ?lon <= '+box.lon[1]+' && ?lat >= '+box.lat[0]+' && ?lat <= '+box.lat[1]+')'
  +' FILTER(YEAR(?date) >= -4000 && YEAR(?date) <= 2026)'
  +' OPTIONAL { ?item rdfs:label ?enLabel . FILTER(lang(?enLabel)="en") }'
  +' SERVICE wikibase:label { bd:serviceParam wikibase:language "zh-hans,zh-cn,zh,en". } }';
 const result=await sparql(query);
 let added=0;
 for(const row of result.results.bindings){
  const qid=row.item.value.split('/').pop();
  if(rows.has(qid))continue;
  const label=row.itemLabel?.value||row.enLabel?.value||qid;
  rows.set(qid,{qid,label,labelLang:row.itemLabel?.['xml:lang']||'en',enLabel:row.enLabel?.value||null,
   year:Number(/^(-?\d{1,6})-/.exec(row.date.value)[1]),coordinates:[Number(row.lon.value),Number(row.lat.value)],
   classQid:(row.class?.value||'').split('/').pop()||null,box:box.id});
  added++;
 }
 console.log('box',box.id,'new items',added,'total',rows.size);
 await sleep(4000);
}

const details=new Map();
const qids=[...rows.keys()];
for(let i=0;i<qids.length;i+=120){
 const chunk=qids.slice(i,i+120);
 const query='SELECT ?item ?belligerentLabel ?partLabel ?countryLabel ?refUrl WHERE {'
  +' VALUES ?item { '+chunk.map(qid=>'wd:'+qid).join(' ')+' }'
  +' OPTIONAL { ?item wdt:P710 ?belligerent }'
  +' OPTIONAL { ?item wdt:P361 ?part }'
  +' OPTIONAL { ?item wdt:P17 ?country }'
  +' OPTIONAL { ?item p:P585/prov:wasDerivedFrom/pr:P854 ?refUrl }'
  +' SERVICE wikibase:label { bd:serviceParam wikibase:language "zh-hans,zh-cn,zh,en". } }';
 const result=await sparql(query);
 for(const row of result.results.bindings){
  const qid=row.item.value.split('/').pop();
  if(!details.has(qid))details.set(qid,{belligerents:[],parts:[],countries:[],refs:[]});
  const entry=details.get(qid);
  const push=(key,value)=>{if(value&&!entry[key].includes(value))entry[key].push(value)};
  push('belligerents',row.belligerentLabel?.value);push('parts',row.partLabel?.value);push('countries',row.countryLabel?.value);push('refs',row.refUrl?.value);
 }
 console.log('details chunk',i,'items with context',details.size);
 await sleep(4000);
}

// Chinese names: Wikidata zh labels first; a zh.wikipedia article title is the documented
// fallback for entities that have no Chinese label at all.
const zhwiki=new Map();
const noZh=[...rows.values()].filter(item=>!(item.labelLang||'').startsWith('zh')).map(item=>item.qid);
for(let i=0;i<noZh.length;i+=50){
 const chunk=noZh.slice(i,i+50);
 const url='https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&formatversion=2&props=sitelinks&sitefilter=zhwiki&ids='+chunk.join('%7C');
 const response=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'}});
 requests.push({endpoint:'wikidata-api',status:response.status});
 if(!response.ok)throw new Error('Wikidata API HTTP '+response.status);
 const data=await response.json();
 for(const [qid,entity] of Object.entries(data.entities||{})){const title=entity.sitelinks?.zhwiki?.title;if(title)zhwiki.set(qid,title)}
 await sleep(1500);
}

// Mechanical traditional-to-simplified conversion (zh.wikipedia parse API, variant=zh-cn),
// exactly as scripts/places/fetch-wikidata-battles.mjs does: no machine translation.
const toConvert=new Set();
for(const item of rows.values()){
 const zh=zhwiki.get(item.qid);
 if(zh&&traditional.test(zh))toConvert.add(zh);
 if((item.labelLang||'').startsWith('zh')&&traditional.test(item.label))toConvert.add(item.label);
}
for(const entry of details.values())for(const list of [entry.belligerents,entry.parts,entry.countries])for(const value of list)if(traditional.test(value))toConvert.add(value);
const converted=new Map();
const list=[...toConvert];
for(let i=0;i<list.length;i+=60){
 const chunk=list.slice(i,i+60);
 try{
  const response=await fetch('https://zh.wikipedia.org/w/api.php',{method:'POST',headers:{'user-agent':UA,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({action:'parse',format:'json',formatversion:'2',variant:'zh-cn',prop:'text',text:chunk.join('\n')})});
  requests.push({endpoint:'zh.wikipedia-parse',status:response.status});
  const data=await response.json();
  const text=(data?.parse?.text||'').replace(/<[^>]*>/g,' ').replace(/&[a-z]+;/g,' ').split('\n').map(line=>line.trim()).filter(Boolean);
  chunk.forEach((value,index)=>converted.set(value,(text[index]||value).trim()));
 }catch(error){for(const value of chunk)converted.set(value,value)}
 await sleep(1200);
}

const items=[...rows.values()].map(item=>{
 const zhLabel=(item.labelLang||'').startsWith('zh')?(converted.get(item.label)||item.label):null;
 const zhTitle=zhwiki.get(item.qid)?(converted.get(zhwiki.get(item.qid))||zhwiki.get(item.qid)):null;
 const detail=details.get(item.qid)||{belligerents:[],parts:[],countries:[],refs:[]};
 return {...item,
  labelZh:zhLabel||zhTitle||null,
  labelSource:zhLabel?'wikidata-zh-label':(zhTitle?'zhwiki-sitelink':null),
  belligerents:detail.belligerents.map(value=>converted.get(value)||value),
  parts:detail.parts.map(value=>converted.get(value)||value),
  countries:detail.countries.map(value=>converted.get(value)||value),
  refs:detail.refs};
});
const output={schemaVersion:1,fetchedAt:new Date().toISOString(),
 source:'Wikidata Query Service sweep of the Oceania, South Asia and Southeast Asia coordinate boxes; classes battle (Q178561) and subclasses, naval battle (Q1261499), siege (Q188055), military operation (Q645883) and massacre (Q3199915); every item keeps a P625 coordinate and a P585 date.',
 endpoint:ENDPOINT,boxes:BOXES.reduce((all,box)=>(all[box.id]=box,all),{}),classQids:CLASSES,count:items.length,items};
await writeFile(outPath,JSON.stringify(output,null,2)+'\n');
const byBox=items.reduce((all,item)=>(all[item.box]=(all[item.box]||0)+1,all),{});
console.log(JSON.stringify({out:outPath,items:items.length,byBox,withZh:items.filter(item=>item.labelZh).length,
 fromZhwikiSitelink:items.filter(item=>item.labelSource==='zhwiki-sitelink').length,withRefs:items.filter(item=>item.refs.length).length},null,2));
