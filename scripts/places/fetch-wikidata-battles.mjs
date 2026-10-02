#!/usr/bin/env node
// Usage: node scripts/places/fetch-wikidata-battles.mjs [out.json]
// Harvests battles from Wikidata with coordinates, dates, participants and conflict
// context, and converts any traditional Chinese labels to simplified through the
// zh.wikipedia parse API (mechanical variant conversion, not machine translation).
// The harvested file is an intermediate research record; scripts/places/build-battles.mjs
// turns it into the shipped layer.
import {writeFile,readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const outPath=resolve(root,process.argv[2]||'editorial/battles-wikidata-source.json');
const UA='MeridianAtlas/3.12 (research; data import for a source-linked history atlas)';
const ENDPOINT='https://query.wikidata.org/sparql';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const sparql=async query=>{
 for(let attempt=1;attempt<=4;attempt++){
  try{
   const response=await fetch(ENDPOINT,{method:'POST',headers:{'user-agent':UA,accept:'application/sparql-results+json','content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({query})});
   if(!response.ok)throw new Error('HTTP '+response.status);
   return await response.json();
  }catch(error){
   if(attempt===4)throw error;
   await sleep(4000*attempt);
  }
 }
};
const wkt=value=>{const m=/Point\(([-0-9.]+) ([-0-9.]+)\)/.exec(value||'');return m?[Number(m[1]),Number(m[2])]:null};
const year=value=>{const m=/^(-?\d{1,6})-/.exec(value||'');return m?Number(m[1]):null};

const eras=[[-4000,500],[500,1500],[1500,1800],[1800,1900],[1900,1945],[1945,2000],[2000,2026]];
const rows=new Map();
for(const [from,to] of eras){
 const query=`SELECT DISTINCT ?item ?itemLabel ?date ?coord ?enLabel WHERE {
  ?item wdt:P31/wdt:P279* wd:Q178561 .
  ?item wdt:P625 ?coord .
  ?item wdt:P585 ?date .
  FILTER(YEAR(?date) >= ${from} && YEAR(?date) < ${to})
  OPTIONAL { ?item rdfs:label ?enLabel . FILTER(lang(?enLabel)="en") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "zh-hans,zh-cn,zh,en". }
 } LIMIT 500`;
 const result=await sparql(query);
 for(const row of result.results.bindings){
  const qid=row.item.value.split('/').pop();
  const coordinates=wkt(row.coord.value),y=year(row.date.value);
  if(!coordinates||y===null)continue;
  const label=row.itemLabel?.value||row.enLabel?.value||qid;
  const lang=row.itemLabel?.['xml:lang']||'en';
  rows.set(qid,{qid,label,labelLang:lang,enLabel:row.enLabel?.value||null,year:y,coordinates});
 }
 console.log('era',from,to,'new items',rows.size);
 await sleep(2500);
}
console.log('total battle items',rows.size);

const details=new Map();
const qids=[...rows.keys()];
for(let i=0;i<qids.length;i+=120){
 const chunk=qids.slice(i,i+120);
 const query=`SELECT ?item ?belligerentLabel ?partLabel ?countryLabel ?refUrl WHERE {
  VALUES ?item { ${chunk.map(q=>'wd:'+q).join(' ')} }
  OPTIONAL { ?item wdt:P710 ?belligerent }
  OPTIONAL { ?item wdt:P361 ?part }
  OPTIONAL { ?item wdt:P17 ?country }
  OPTIONAL { ?item p:P585/prov:wasDerivedFrom/pr:P854 ?refUrl }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "zh-hans,zh-cn,zh,en". }
 }`;
 const result=await sparql(query);
 for(const row of result.results.bindings){
  const qid=row.item.value.split('/').pop();
  if(!details.has(qid))details.set(qid,{belligerents:[],parts:[],countries:[],refs:[]});
  const entry=details.get(qid);
  if(row.belligerentLabel&&!entry.belligerents.includes(row.belligerentLabel.value))entry.belligerents.push(row.belligerentLabel.value);
  if(row.partLabel&&!entry.parts.includes(row.partLabel.value))entry.parts.push(row.partLabel.value);
  if(row.countryLabel&&!entry.countries.includes(row.countryLabel.value))entry.countries.push(row.countryLabel.value);
  if(row.refUrl&&!entry.refs.includes(row.refUrl.value))entry.refs.push(row.refUrl.value);
 }
 console.log('details chunk',i,'items with context',details.size);
 await sleep(2500);
}

// Mechanical traditional-to-simplified conversion for labels that are not already simplified.
const traditional=/[與臺灣國學會東車馬鳥魚點線個時間問題則無為說話語實質軍戰勝戰東歐亞羅馬蘇聯義紀興漢滿蒙藏臺]/;
const toConvert=new Set();
for(const item of rows.values())if(item.labelLang==='zh'&&traditional.test(item.label))toConvert.add(item.label);
for(const entry of details.values())for(const list of [entry.belligerents,entry.parts,entry.countries])for(const value of list)if(traditional.test(value))toConvert.add(value);
const converted=new Map();
const convert=async values=>{
 const list=[...values];
 for(let i=0;i<list.length;i+=60){
  const chunk=list.slice(i,i+60);
  try{
   const response=await fetch('https://zh.wikipedia.org/w/api.php',{method:'POST',headers:{'user-agent':UA,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({action:'parse',format:'json',formatversion:'2',variant:'zh-cn',prop:'text',text:chunk.join('\n')})});
   const data=await response.json();
   const text=(data?.parse?.text||'').replace(/<[^>]*>/g,' ').replace(/&[a-z]+;/g,' ').split('\n').map(line=>line.trim()).filter(Boolean);
   chunk.forEach((value,index)=>converted.set(value,(text[index]||value).trim()));
  }catch(error){
   for(const value of chunk)converted.set(value,value);
  }
  await sleep(1200);
 }
};
await convert(toConvert);
console.log('converted labels',converted.size,'of',toConvert.size);

const items=[...rows.values()].map(item=>({
 ...item,
 labelZh:item.labelLang==='zh'||item.labelLang==='zh-hans'||item.labelLang==='zh-cn'?(converted.get(item.label)||item.label):null,
 ...(details.get(item.qid)||{belligerents:[],parts:[],countries:[],refs:[]})
})).map(item=>({
 ...item,
 belligerents:item.belligerents.map(value=>converted.get(value)||value),
 parts:item.parts.map(value=>converted.get(value)||value),
 countries:item.countries.map(value=>converted.get(value)||value)
}));
const output={schemaVersion:1,fetchedAt:new Date().toISOString(),source:'Wikidata Query Service, items that are instances (or subclasses) of battle (Q178561) with P625 coordinates and P585 date; Chinese labels converted to simplified through the zh.wikipedia parse API.',
 endpoint:ENDPOINT,count:items.length,items};
await writeFile(outPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({out:outPath,items:items.length,withZh:items.filter(item=>item.labelZh).length,withBelligerents:items.filter(item=>item.belligerents.length).length,withParts:items.filter(item=>item.parts.length).length,withRefs:items.filter(item=>item.refs.length).length},null,2));
