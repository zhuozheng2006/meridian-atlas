#!/usr/bin/env node
// Usage: node scripts/places/fetch-entity-english-labels.mjs [out.json]
// Resolves English labels for the participants, conflicts and countries of the battle
// entities used by the battle layer and the structured event batch. Entities without an
// English label are kept as their QID so downstream builds never transliterate or
// machine-translate a name. Chinese labels already harvested stay untouched.
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const outPath=resolve(root,process.argv[2]||'editorial/entity-labels-en.json');
const UA='MeridianAtlas/3.13 (research; source-linked history atlas)';
const ENDPOINT='https://query.wikidata.org/sparql';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const sparql=async query=>{
 for(let attempt=1;attempt<=5;attempt++){
  try{
   const response=await fetch(ENDPOINT,{method:'POST',headers:{'user-agent':UA,accept:'application/sparql-results+json','content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({query})});
   if(response.status===429){await sleep(15000*attempt);continue}
   if(!response.ok)throw new Error('HTTP '+response.status);
   return await response.json();
  }catch(error){if(attempt===5)throw error;await sleep(5000*attempt)}
 }
};
const battles=JSON.parse(gunzipSync(await readFile(resolve(root,'public/data/battles.json.gz')))).battles;
const events=JSON.parse(await readFile(resolve(root,'editorial/events-wikidata-3.12.json'),'utf8')).entries;
const qids=[...new Set([...battles.map(battle=>battle.qid),...events.map(event=>event.wikidataQid)].filter(Boolean))];
console.log('entities to resolve',qids.length);
const labels={};
for(let i=0;i<qids.length;i+=80){
 const chunk=qids.slice(i,i+80);
 const query=`SELECT ?item ?belligerent ?belligerentEn ?part ?partEn ?country ?countryEn WHERE {
  VALUES ?item { ${chunk.map(q=>'wd:'+q).join(' ')} }
  OPTIONAL { ?item wdt:P710 ?belligerent . OPTIONAL { ?belligerent rdfs:label ?belligerentEn . FILTER(lang(?belligerentEn)="en") } }
  OPTIONAL { ?item wdt:P361 ?part . OPTIONAL { ?part rdfs:label ?partEn . FILTER(lang(?partEn)="en") } }
  OPTIONAL { ?item wdt:P17 ?country . OPTIONAL { ?country rdfs:label ?countryEn . FILTER(lang(?countryEn)="en") } }
 }`;
 const result=await sparql(query);
 for(const row of result.results.bindings){
  const qid=row.item.value.split('/').pop();
  if(!labels[qid])labels[qid]={belligerents:[],conflict:[],countries:[]};
  const entry=labels[qid];
  const add=(list,entity,label)=>{
   if(!entity)return;
   const entityQid=entity.value.split('/').pop();
   if(list.some(item=>item.qid===entityQid))return;
   list.push({qid:entityQid,label:label?label.value:null});
  };
  add(entry.belligerents,row.belligerent,row.belligerentEn);
  add(entry.conflict,row.part,row.partEn);
  add(entry.countries,row.country,row.countryEn);
 }
 console.log('chunk',i,'resolved entities',Object.keys(labels).length);
 await sleep(3000);
}
const missing=[];
for(const [qid,entry] of Object.entries(labels))for(const key of ['belligerents','conflict','countries'])for(const item of entry[key])if(!item.label)missing.push(qid+' '+key+' '+item.qid);
const output={schemaVersion:1,fetchedAt:new Date().toISOString(),
 source:'Wikidata Query Service: English rdfs:label for P710 participants, P361 conflicts and P17 countries of the battle entities used by the atlas. Entities without an English label keep their QID with label=null.',
 resolvedEntities:Object.keys(labels).length,entitiesWithoutEnglishLabel:missing.length,missing:missing.slice(0,50),labels};
await writeFile(outPath,JSON.stringify(output,null,2)+'\n');
const withEn=Object.values(labels).filter(entry=>[...entry.belligerents,...entry.conflict,...entry.countries].some(item=>item.label)).length;
console.log(JSON.stringify({out:outPath,resolved:Object.keys(labels).length,entitiesWithAtLeastOneEnglishLabel:withEn,missingEnglishLabels:missing.length},null,2));
