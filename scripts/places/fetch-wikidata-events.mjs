#!/usr/bin/env node
// Usage: node scripts/places/fetch-wikidata-events.mjs [out.json]
// Harvests dated, located historical events (treaties, disasters, elections, rebellions,
// coups) from Wikidata for the structured event expansion. Battles are excluded because
// they ship as their own layer. Chinese labels and descriptions are converted to
// simplified through the zh.wikipedia parse API (mechanical variant conversion only).
import {writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const outPath=resolve(root,process.argv[2]||'editorial/events-wikidata-source.json');
const UA='MeridianAtlas/3.12 (research; data import for a source-linked history atlas)';
const ENDPOINT='https://query.wikidata.org/sparql';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const CLASSES=['Q131569','Q625298','Q3839081','Q8065','Q40231','Q10931','Q3882219'];
const sparql=async query=>{
 for(let attempt=1;attempt<=4;attempt++){
  try{
   const response=await fetch(ENDPOINT,{method:'POST',headers:{'user-agent':UA,accept:'application/sparql-results+json','content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({query})});
   if(!response.ok)throw new Error('HTTP '+response.status);
   return await response.json();
  }catch(error){if(attempt===4)throw error;await sleep(4000*attempt)}
 }
};
const wkt=value=>{const m=/Point\(([-0-9.]+) ([-0-9.]+)\)/.exec(value||'');return m?[Number(m[1]),Number(m[2])]:null};
const year=value=>{const m=/^(-?\d{1,6})-/.exec(value||'');return m?Number(m[1]):null};
const eras=[[-3000,-500],[-500,500],[500,1000],[1000,1500],[1500,1800],[1800,1900],[1900,1945],[1945,2000],[2000,2027]];
const rows=new Map();
for(const [from,to] of eras){
 const query=`SELECT DISTINCT ?item ?itemLabel ?itemDescription ?enLabel ?enDescription ?date ?coord ?classLabel ?countryLabel WHERE {
  VALUES ?cls { ${CLASSES.map(q=>'wd:'+q).join(' ')} }
  ?item wdt:P31/wdt:P279* ?cls .
  ?item wdt:P625 ?coord .
  ?item wdt:P585 ?date .
  FILTER NOT EXISTS { ?item wdt:P31/wdt:P279* wd:Q178561 }
  FILTER(YEAR(?date) >= ${from} && YEAR(?date) < ${to})
  OPTIONAL { ?item wdt:P31 ?class }
  OPTIONAL { ?item wdt:P17 ?country }
  OPTIONAL { ?item rdfs:label ?enLabel . FILTER(lang(?enLabel)="en") }
  OPTIONAL { ?item schema:description ?enDescription . FILTER(lang(?enDescription)="en") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "zh-hans,zh-cn,zh,en". }
 } LIMIT 600`;
 const result=await sparql(query);
 for(const row of result.results.bindings){
  const qid=row.item.value.split('/').pop();
  const coordinates=wkt(row.coord.value),y=year(row.date.value);
  if(!coordinates||y===null)continue;
  const label=row.itemLabel?.value||row.enLabel?.value||qid;
  const lang=row.itemLabel?.['xml:lang']||'en';
  const existing=rows.get(qid);
  const classLabel=row.classLabel?.value||null;
  if(existing){if(classLabel&&!existing.classLabels.includes(classLabel))existing.classLabels.push(classLabel);continue}
  rows.set(qid,{qid,label,labelLang:lang,enLabel:row.enLabel?.value||null,description:row.itemDescription?.value||null,descriptionLang:row.itemDescription?.['xml:lang']||null,enDescription:row.enDescription?.value||null,year:y,coordinates,classLabels:classLabel?[classLabel]:[],country:row.countryLabel?.value||null});
 }
 console.log('era',from,to,'total items',rows.size);
 await sleep(2500);
}
console.log('total event items',rows.size);

const traditional=/[與臺灣國學會東車馬鳥魚點線個時間問題則無為說話語實質軍戰勝歐亞羅馬蘇聯義紀興漢滿蒙藏條約災難選舉起義政變簽署]/;
const toConvert=new Set();
for(const item of rows.values()){
 if((item.labelLang==='zh'||item.descriptionLang==='zh')&&traditional.test(item.label))toConvert.add(item.label);
 if(item.description&&item.descriptionLang==='zh'&&traditional.test(item.description))toConvert.add(item.description);
 if(item.country&&traditional.test(item.country))toConvert.add(item.country);
 for(const value of item.classLabels)if(traditional.test(value))toConvert.add(value);
}
const converted=new Map();
const list=[...toConvert];
for(let i=0;i<list.length;i+=60){
 const chunk=list.slice(i,i+60);
 try{
  const response=await fetch('https://zh.wikipedia.org/w/api.php',{method:'POST',headers:{'user-agent':UA,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({action:'parse',format:'json',formatversion:'2',variant:'zh-cn',prop:'text',text:chunk.join('\n')})});
  const data=await response.json();
  const text=(data?.parse?.text||'').replace(/<[^>]*>/g,' ').replace(/&[a-z]+;/g,' ').split('\n').map(line=>line.trim()).filter(Boolean);
  chunk.forEach((value,index)=>converted.set(value,(text[index]||value).trim()));
 }catch{for(const value of chunk)converted.set(value,value)}
 await sleep(1000);
}
console.log('converted',converted.size,'of',list.length);
const items=[...rows.values()].map(item=>({...item,
 labelZh:(item.labelLang==='zh'||item.labelLang==='zh-hans'||item.labelLang==='zh-cn')?(converted.get(item.label)||item.label):null,
 descriptionZh:(item.descriptionLang==='zh'||item.descriptionLang==='zh-hans'||item.descriptionLang==='zh-cn')?(converted.get(item.description)||item.description):null,
 countryZh:item.country?(converted.get(item.country)||item.country):null,
 classLabels:item.classLabels.map(value=>converted.get(value)||value)}));
const output={schemaVersion:1,fetchedAt:new Date().toISOString(),
 source:'Wikidata Query Service: items that are instances of treaty, disaster, election, rebellion or coup classes, with P625 coordinates and P585 date, excluding battles (Q178561). Chinese labels/descriptions converted to simplified through the zh.wikipedia parse API.',
 classes:CLASSES,endpoint:ENDPOINT,count:items.length,items};
await writeFile(outPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({out:outPath,items:items.length,withZhLabel:items.filter(item=>item.labelZh).length,withZhDescription:items.filter(item=>item.descriptionZh).length,withEnglish:items.filter(item=>item.enLabel).length},null,2));
