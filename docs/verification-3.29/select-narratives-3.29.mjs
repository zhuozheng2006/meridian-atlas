#!/usr/bin/env node
// Usage: node docs/verification-3.29/select-narratives-3.29.mjs
// Ranks the polity profiles of public/data/enrichment/profile-index.json.gz by the
// evidence available for choosing which ones deserve the next editorial narratives (second batch, 3.29):
//   recordCount  number of POLITY records in public/data/fast/catalog.json.gz whose
//                verifiedWikidata is this entity (territory/period records in this atlas)
//   spanYears    max(end) - min(start) across those records (how long the entity appears)
//   yearsCovered sum(end - start + 1), i.e. how much dated territory the entity carries
//   areaMax      largest single record extent (a proxy for how much map the entity fills)
//   mentions     occurrences of the entity's labels and record names inside the shipped
//                events, battles and city narratives (does the reader meet it elsewhere)
//   citedFields  profile fields that carry at least one reference (sourceability)
// Regions come from the documented coordinate boxes the map layers already use, applied to
// each record's centre; a multi-region entity is assigned the region of most of its records.
// The output is docs/verification-3.29/narratives-selection.json; nothing is written to
// public/ by this script.
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const read=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const gunzip=async path=>JSON.parse(gunzipSync(await readFile(resolve(root,path))).toString());
const catalog=await gunzip('public/data/fast/catalog.json.gz');
const index=await gunzip('public/data/enrichment/profile-index.json.gz');
const narratives=await read('public/data/enrichment/narratives.json');
const events=await read('public/data/events.json');
const battles=(await read('public/data/battles.json')).battles;
const cities=(await read('editorial/city-narratives.json')).entries||[];
const excludedRecords=new Set((index.exclusions||[]).map(item=>item.recordId));

const regionOf=([lon,lat],name)=>{
 if(!Number.isFinite(lon)||!Number.isFinite(lat))return null;
 if(lon>=-170&&lon<=-30)return 'americas';
 if(lon>=110&&lon<=180&&lat<=0)return 'oceania';
 if(lon>=95&&lon<=150&&lat>=15&&lat<=55)return 'east-asia';
 if(lon>=92&&lon<=141&&lat>=-11&&lat<=25)return 'southeast-asia';
 if(lon>=60&&lon<=92&&lat>=0&&lat<=37)return 'south-asia';
 if(lon>=33&&lon<=40&&lat>=29&&lat<=34)return 'west-central-asia';
 if(lon>=-25&&lon<=40&&lat>=36&&lat<=72)return 'europe';
 if(lon>=-20&&lon<=52&&lat>=-36&&lat<=36)return 'africa';
 if(lon>=25&&lon<=80&&lat>=12&&lat<=55)return 'west-central-asia';
 return 'global';
};
// Mentions are matched conservatively: a Latin name must appear as a whole word, and a
// Chinese name must not be followed by a character that continues it into a longer polity
// name (印度 inside 印度尼西亚 does not count as a mention of India). The continuation set is
// derived from the other Chinese labels in the same profile catalogue.
const norm=value=>String(value||'').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g,'');
const allZhLabels=Object.values(index.profiles).map(profile=>profile.labels?.zh).filter(Boolean);
const continuations=(key)=>{
 const set=new Set();
 for(const label of allZhLabels)if(label.length>key.length&&label.startsWith(key))set.add(label.slice(key.length,key.length+1));
 return set;
};
const haystack=[];
for(const event of events)haystack.push({kind:'event',text:[event.title.zh,event.title.en,event.summary.zh,event.summary.en].join(' ')});
for(const battle of battles)haystack.push({kind:'battle',text:[battle.nameZh,battle.nameEn].join(' ')});
for(const city of cities)haystack.push({kind:'city',text:[city.title?.zh,city.title?.en,JSON.stringify(city).slice(0,4000)].filter(Boolean).join(' ')});
const flatten=item=>{const zh=[],en=[];for(const value of item.text)if(/[\u3400-\u9fff]/.test(value))zh.push(value);else en.push(value);return {kind:item.kind,zh:zh.join(' '),en:en.join(' ')}};
const normHay=haystack.map(flatten);
const matches=(row,item)=>{
 for(const name of [row.zh,...row.names])if(name&&/[\u3400-\u9fff]/.test(name)){
  const key=norm(name);if(key.length<2)continue;const cont=continuations(name);
  let index=item.zh.indexOf(key);
  while(index>=0){const next=item.zh.slice(index+key.length,index+key.length+1);if(!cont.has(next))return true;index=item.zh.indexOf(key,index+1)}
 }
 for(const name of [row.en,...row.names])if(name&&!/[\u3400-\u9fff]/.test(name)){
  const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  if(new RegExp('(^|[^a-z0-9])'+escaped.toLowerCase()+'([^a-z0-9]|$)','i').test(item.en))return true;
 }
 return false;
};

const byQid=new Map();
for(const record of catalog.records){
 if(record.type!=='POLITY'||excludedRecords.has(record.id)||!record.verifiedWikidata)continue;
 const list=byQid.get(record.verifiedWikidata)||[];
 list.push(record);byQid.set(record.verifiedWikidata,list);
}
const coveredQids=new Set(narratives.entries.map(entry=>entry.qid));
const rows=[];
for(const [qid,profile] of Object.entries(index.profiles)){
 const records=byQid.get(qid)||[];
 const zh=profile.labels?.zh||null,en=profile.labels?.en||null;
 const names=[...new Set(records.map(record=>record.name))];
 const mentions={event:0,battle:0,city:0};
 const probe={zh,en,names};
 for(const item of normHay)if(matches(probe,item))mentions[item.kind]++;
 const regionCounts={};
 for(const record of records){const region=regionOf(record.center||[],record.name);if(region)regionCounts[region]=(regionCounts[region]||0)+1}
 const region=Object.entries(regionCounts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]||'global';
 const cited=Array.isArray(profile.fieldsWithCitedFacts)?profile.fieldsWithCitedFacts.length:0;
 const row={qid,zh,en,region,recordCount:records.length,names:names.slice(0,6),
  spanYears:records.length?Math.max(...records.map(r=>r.end))-Math.min(...records.map(r=>r.start)):0,
  yearsCovered:records.reduce((sum,r)=>sum+Math.max(0,r.end-r.start+1),0),
  areaMax:records.length?Math.max(...records.map(r=>r.area||0)):0,
  firstStart:records.length?Math.min(...records.map(r=>r.start)):null,
  lastEnd:records.length?Math.max(...records.map(r=>r.end)):null,
  mentions,mentionTotal:mentions.event+mentions.battle+mentions.city,citedFields:cited,
  covered:coveredQids.has(qid),
  binding:(index.records||{})[records[0]?.id]?.temporalCompatibility?.status||null};
 rows.push(row);
}
const regionPriority={africa:5,americas:5,'south-asia':4,'southeast-asia':4,oceania:4,'west-central-asia':3,'east-asia':2,europe:0,global:1};
for(const row of rows){
 row.score=Number((Math.min(row.recordCount,25)*0.35
  +Math.min(row.spanYears/100,20)*0.5
  +Math.min(row.yearsCovered/200,15)*0.4
  +Math.min(row.mentionTotal,12)*0.9
  +Math.min(row.citedFields,25)*0.12
  +(regionPriority[row.region]||0)*1.5).toFixed(3));
}
const uncovered=rows.filter(row=>!row.covered).sort((a,b)=>b.score-a.score||a.qid.localeCompare(b.qid));
const byRegion={};
for(const row of uncovered){(byRegion[row.region]=byRegion[row.region]||[]).push(row)}
const output={schemaVersion:1,generatedAt:new Date().toISOString(),
 purpose:'Selection evidence for the 3.29 editorial narratives: which of the 1,450 polity profiles should receive the next four-column essays.',
 method:{
  recordCount:'POLITY records in public/data/fast/catalog.json.gz with this verifiedWikidata (excluded relation records skipped)',
  spanYears:'max(end) - min(start) across those records',
  yearsCovered:'sum(end - start + 1)',
  areaMax:'largest single record area',
  mentions:'occurrences of the entity labels and record names in public/data/events.json, public/data/battles.json and editorial/city-narratives.json; Latin names match as whole words and a Chinese name does not count when the next character continues it into a longer catalogue name',
  citedFields:'profile fields carrying at least one reference',
  region:'documented coordinate boxes applied to record centres; a multi-region entity takes the region of most records',
  score:'0.35*min(recordCount,25) + 0.5*min(spanYears/100,20) + 0.4*min(yearsCovered/200,15) + 0.9*min(mentionTotal,12) + 0.12*min(citedFields,25) + 1.5*regionPriority',
  regionPriority},
 totals:{profiles:rows.length,covered:rows.filter(row=>row.covered).length,uncovered:uncovered.length},
 byRegionUncovered:Object.fromEntries(Object.entries(byRegion).map(([region,list])=>[region,list.length])),
 top100:uncovered.slice(0,100),
 byRegion:Object.fromEntries(Object.entries(byRegion).map(([region,list])=>[region,list.slice(0,40)])),
 allUncovered:uncovered};
await writeFile(resolve(root,'docs/verification-3.29/narratives-selection.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({out:'docs/verification-3.29/narratives-selection.json',totals:output.totals,byRegionUncovered:output.byRegionUncovered,
 top:uncovered.slice(0,15).map(row=>row.qid+' '+(row.zh||row.en)+' ['+row.region+'] score '+row.score+' rec '+row.recordCount+' span '+row.spanYears+' mentions '+row.mentionTotal)},null,2));