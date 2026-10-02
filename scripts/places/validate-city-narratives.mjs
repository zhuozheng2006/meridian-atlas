#!/usr/bin/env node
// Usage: node scripts/validate-city-narratives.mjs [repo-root] [report.json]
// Uses the shipped module and data. No browser, network or third-party package.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

const root=resolve(process.argv[2]||resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const dist=resolve(root,'dist'),requests=[],results=[];
const diskJSON=async name=>JSON.parse(gunzipSync(await readFile(resolve(dist,'data/places',`${name}.json.gz`))));
const data=await diskJSON('city-narratives');
const datasets=await Promise.all([['historical-settlements','places'],['historical-capitals','claims'],['urban-observations','cities'],['modern-cities','cities']].map(async ([name,key])=>(await diskJSON(name))[key]));
const records=new Map(datasets.flat().map(r=>[r.id,r]));
const originalFetch=globalThis.fetch;
let failNext=false;
globalThis.fetch=async input=>{
 const path=String(input);requests.push(path);
 if(failNext){failNext=false;return new Response('Temporary test failure',{status:503});}
 const file=resolve(dist,path);
 if(!file.startsWith(dist+'/'))return new Response('Path outside test root',{status:400});
 try{return new Response(await readFile(file));}catch{return new Response('Missing test asset',{status:404});}
};
const {matchCityNarrative,cityNarrative}=await import(pathToFileURL(resolve(dist,'city-narratives.js')));
const selected=(id,observed)=>({...records.get(id),id,...(observed===null||observed===undefined?{}:{observation:[observed,records.get(id)?.observations?.find(o=>o[0]===observed)?.[1]??1]})});
async function check(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS',name);}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL',name,error.message);}}
const counters={entries:data.entries.length,sources:data.sources.length,sourceRecords:0,positiveBoundaries:0,negativeBoundaries:0,actualPeriodGaps:0,originalRegressionCases:0};

await check('Imports the real matching module without DOM',()=>{assert.equal(typeof document,'undefined');assert.equal(typeof matchCityNarrative,'function');});
await check('Twelve dossiers and thirty-nine institutional source registrations resolve',()=>{
 assert.equal(data.schemaVersion,1);assert.equal(data.entries.length,12);assert.equal(data.sources.length,39);
 assert.equal(new Set(data.entries.map(e=>e.id)).size,12);assert.equal(new Set(data.sources.map(s=>s.id)).size,39);
 const sources=new Map(data.sources.map(s=>[s.id,s]));
 for(const s of data.sources){assert(s.publisher&&s.title&&s.accessedAt&&s.access);assert.match(s.url,/^https:\/\//);}
 for(const e of data.entries){
  assert.equal(e.sections.length,3);assert.equal(e.milestones.length,3);assert(e.scope.spatial.zh&&e.scope.spatial.en&&e.scope.temporal.zh&&e.scope.temporal.en);
  assert.equal(new Set(e.sourceRecordIds).size,e.sourceRecordIds.length);
  assert.deepEqual([...e.sourceRecordIds].sort(),e.bindingRules.map(b=>b.sourceRecordId).sort());
  assert.deepEqual([...e.sourceRecordIds].sort(),e.sourceRecords.map(r=>r.id).sort());
  assert(new Set(e.sourceIds.map(s=>sources.get(s)?.publisher)).size>=2);
  for(const part of [...e.sections,...e.milestones]){assert(part.zh&&part.en&&part.sourceIds.length);for(const sid of part.sourceIds)assert(sources.has(sid),sid);}
  for(const m of e.milestones){assert(Number.isInteger(m.year)&&m.year!==0&&m.year<=m.endYear);assert(m.year>=e.scope.start&&m.endYear<=e.scope.end);assert(m.date.zh&&m.date.en&&m.precision);}
 }
});
await check('All thirty-nine bound records preserve actual names, coordinates, periods and observations',()=>{
 for(const e of data.entries)for(const r of e.sourceRecords){
  const original=records.get(r.id);assert(original,`${e.id}: missing ${r.id}`);
  assert.equal(r.name,original.name);assert.deepEqual(r.coordinates,original.coordinates);
  assert.deepEqual(r.periods,original.periods||null);assert.deepEqual(r.observationYears,original.observations?.map(o=>o[0])||[]);
  assert.equal(r.sourceUrl,original.sourceUrl);counters.sourceRecords++;
  const rule=e.bindingRules.find(b=>b.sourceRecordId===r.id);
  assert(e.scope.start<=rule.start&&rule.start<=rule.end&&rule.end<=e.scope.end);
  if(original.observations){assert.equal(rule.requiresObservation,true);assert(rule.observationYears?.length);for(const y of rule.observationYears)assert(original.observations.some(o=>o[0]===y)&&rule.start<=y&&y<=rule.end);}
  else{assert(rule.sourcePeriods?.length);for(const period of rule.sourcePeriods)assert(original.periods.some(p=>JSON.stringify(p)===JSON.stringify(period)));}
 }
 assert.equal(counters.sourceRecords,39);
});
await check('Every binding accepts its evidence endpoints and rejects years outside its range',()=>{
 for(const e of data.entries)for(const r of e.bindingRules){
  const actual=records.get(r.sourceRecordId);
  const endpointYears=actual.observations?[r.observationYears[0],r.observationYears.at(-1)]:r.sourcePeriods.flatMap(([a,z])=>[Math.max(a,r.start),Math.min(z,r.end)]).filter(y=>y>=r.start&&y<=r.end);
  for(const y of endpointYears){assert.equal(matchCityNarrative(data,selected(actual.id,actual.observations?y:null),y)?.id,e.id,`${actual.id}@${y}`);counters.positiveBoundaries++;}
  for(const y of [r.start-1,r.end+1,e.scope.start-1,e.scope.end+1].filter(y=>y!==0)){
   assert.equal(matchCityNarrative(data,selected(actual.id,actual.observations?r.observationYears[0]:null),y),null,`${actual.id}@${y}`);counters.negativeBoundaries++;
  }
 }
});
await check('Exact source IDs are required; names, coordinates and modern source kinds do not substitute',()=>{
 for(const e of data.entries){
  const r=e.bindingRules[0],p=selected(r.sourceRecordId,r.observationYears?.[0]),y=r.observationYears?.[0]??Math.max(r.start,r.sourcePeriods[0][0]);
  assert.equal(matchCityNarrative(data,{...p,id:`unbound:${p.id}`,name:e.nameEn,nameZh:e.nameZh},y),null);
  assert.equal(matchCityNarrative(data,{...p,kind:'modern-reference'},y),null);
 }
});
await check('Invalid civil years cannot attach an editorial dossier',()=>{
 const p=records.get('pleiades:423025');for(const year of [0,NaN,Infinity,-Infinity,100.5,'100',null,undefined])assert.equal(matchCityNarrative(data,p,year),null);
});
await check('Every observation binding requires the selected source observation and respects both years',()=>{
 for(const e of data.entries)for(const r of e.bindingRules.filter(r=>r.requiresObservation)){
  const p=records.get(r.sourceRecordId),y=r.observationYears[0];
  assert.equal(matchCityNarrative(data,p,y),null,`${p.id}: missing observation accepted`);
  assert.equal(matchCityNarrative(data,selected(p.id,0),y),null);
  const forbidden=p.observations.find(o=>!r.observationYears.includes(o[0]))?.[0]??r.end+1;
  assert.equal(matchCityNarrative(data,selected(p.id,forbidden),y),null,`${p.id}: wrong observation accepted`);
  assert.equal(matchCityNarrative(data,selected(p.id,y),r.end+1),null,`${p.id}: current year ignored`);
 }
});
await check('Real and synthetic disjoint source periods never acquire an interpolated history',()=>{
 for(const e of data.entries)for(const rule of e.bindingRules.filter(r=>!r.requiresObservation)){
  const periods=[...rule.sourcePeriods].sort((a,b)=>a[0]-b[0]);let end=periods[0][1];
  for(const [start,nextEnd] of periods.slice(1)){const y=Math.max(rule.start,end+1);if(y!==0&&y<start&&y<=rule.end){assert.equal(matchCityNarrative(data,records.get(rule.sourceRecordId),y),null);counters.actualPeriodGaps++;}end=Math.max(end,nextEnd);}
 }
 const fixture={entries:[{id:'test-gap',scope:{start:-100,end:100},bindingRules:[{sourceRecordId:'test:gap',start:-100,end:100,sourcePeriods:[[-100,-50],[50,100]]}],sourceIds:[]}],sources:[]};
 const p={id:'test:gap',kind:'attested-settlement',periods:[[-100,100]]};
 for(const y of [-100,-50,50,100])assert.equal(matchCityNarrative(fixture,p,y)?.id,'test-gap');
 for(const y of [-49,-1,1,49])assert.equal(matchCityNarrative(fixture,p,y),null);
 // Fall back to a place's own periods when editorial sourcePeriods are absent.
 const fallback=structuredClone(fixture);delete fallback.entries[0].bindingRules[0].sourcePeriods;
 assert.equal(matchCityNarrative(fallback,{...p,periods:[[-100,-50],[50,100]]},1),null);
});

// ORIGINAL_CASES is generated once from both reviewed authoring audits. Keep it
// inline so this script remains independently portable in the public repository.
const ORIGINAL_CASES=[
  {
    "label": "Tenochtitlan binds 1500 observation",
    "expected": true,
    "city": "city-tenochtitlan",
    "record": "chandler:921",
    "year": 1500,
    "observed": 1500
  },
  {
    "label": "Tenochtitlan binds 1520 observation",
    "expected": true,
    "city": "city-tenochtitlan",
    "record": "chandler:921",
    "year": 1520,
    "observed": 1520
  },
  {
    "label": "Tenochtitlan conquest boundary accepts prior observation",
    "expected": true,
    "city": "city-tenochtitlan",
    "record": "chandler:921",
    "year": 1521,
    "observed": 1520
  },
  {
    "label": "Tenochtitlan rejects later atlas year",
    "expected": false,
    "city": "city-tenochtitlan",
    "record": "chandler:921",
    "year": 1550,
    "observed": 1520
  },
  {
    "label": "Tenochtitlan rejects later observation",
    "expected": false,
    "city": "city-tenochtitlan",
    "record": "chandler:921",
    "year": 1521,
    "observed": 1524
  },
  {
    "label": "Tenochtitlan requires selected observation",
    "expected": false,
    "city": "city-tenochtitlan",
    "record": "chandler:921",
    "year": 1500,
    "observed": null
  },
  {
    "label": "Tenochtitlan rejects modern Mexico City record",
    "expected": false,
    "city": "city-tenochtitlan",
    "record": "modelski-modern:166",
    "year": 1500,
    "observed": 2000
  },
  {
    "label": "Tenochtitlan rejects hypothetical 1510 observation",
    "expected": false,
    "city": "city-tenochtitlan",
    "record": "chandler:921",
    "year": 1510,
    "observed": 1510
  },
  {
    "label": "Cairo rejects earlier Fustat-era observation",
    "expected": false,
    "city": "city-cairo",
    "record": "chandler:246",
    "year": 969,
    "observed": 884
  },
  {
    "label": "Cairo accepts foundation-era observation",
    "expected": true,
    "city": "city-cairo",
    "record": "chandler:246",
    "year": 969,
    "observed": 969
  },
  {
    "label": "Cairo rejects pre-foundation atlas year",
    "expected": false,
    "city": "city-cairo",
    "record": "chandler:246",
    "year": 900,
    "observed": 969
  },
  {
    "label": "Cairo accepts only 1000 in Modelski ancient series",
    "expected": true,
    "city": "city-cairo",
    "record": "modelski-ancient:25",
    "year": 1000,
    "observed": 1000
  },
  {
    "label": "Cairo rejects 900 in Modelski ancient series",
    "expected": false,
    "city": "city-cairo",
    "record": "modelski-ancient:25",
    "year": 1000,
    "observed": 900
  },
  {
    "label": "Constantinople accepts dated historical record",
    "expected": true,
    "city": "city-constantinople",
    "record": "pleiades:520998",
    "year": 537,
    "observed": null
  },
  {
    "label": "Constantinople rejects earlier Byzantium entity",
    "expected": false,
    "city": "city-constantinople",
    "record": "pleiades:520985",
    "year": 537,
    "observed": null
  },
  {
    "label": "Constantinople rejects modern Istanbul entity",
    "expected": false,
    "city": "city-constantinople",
    "record": "pleiades:77402394",
    "year": 1453,
    "observed": null
  },
  {
    "label": "Constantinople rejects Ottoman-only dated capital claim",
    "expected": false,
    "city": "city-constantinople",
    "record": "capital:Q12560$6c41d504-4649-647e-16c3-5ce527ab5552",
    "year": 1453,
    "observed": null
  },
  {
    "label": "Constantinople rejects post-1453 observation",
    "expected": false,
    "city": "city-constantinople",
    "record": "chandler:623",
    "year": 1450,
    "observed": 1477
  },
  {
    "label": "Constantinople accepts 1453 boundary observation",
    "expected": true,
    "city": "city-constantinople",
    "record": "chandler:623",
    "year": 1453,
    "observed": 1453
  },
  {
    "label": "Rome accepts attested ancient place",
    "expected": true,
    "city": "city-rome",
    "record": "pleiades:423025",
    "year": 100,
    "observed": null
  },
  {
    "label": "Rome rejects year zero",
    "expected": false,
    "city": "city-rome",
    "record": "pleiades:423025",
    "year": 0,
    "observed": null
  },
  {
    "label": "Rome rejects settlement period beyond source",
    "expected": false,
    "city": "city-rome",
    "record": "pleiades:423025",
    "year": 800,
    "observed": null
  },
  {
    "label": "Timbuktu accepts exact observation",
    "expected": true,
    "city": "city-timbuktu",
    "record": "chandler:1433",
    "year": 1500,
    "observed": 1500
  },
  {
    "label": "Cusco accepts exact observation",
    "expected": true,
    "city": "city-cusco",
    "record": "chandler:346",
    "year": 1438,
    "observed": 1438
  },
  {
    "label": "Cusco rejects invented observation",
    "expected": false,
    "city": "city-cusco",
    "record": "chandler:346",
    "year": 1500,
    "observed": 1492
  },
  {
    "label": "Unknown record never matches by name or proximity",
    "expected": false,
    "city": "city-rome",
    "record": "unknown:Rome",
    "year": 100,
    "observed": null
  },
  {
    "label": "Asia 1: city-changan -200 / observation None",
    "expected": true,
    "city": "city-changan",
    "record": "capital:Q7209$ee2368d4-4b09-0e37-d514-68db08531429",
    "year": -200,
    "observed": null
  },
  {
    "label": "Asia 2: city-changan 10 / observation None",
    "expected": false,
    "city": "city-changan",
    "record": "capital:Q7209$ee2368d4-4b09-0e37-d514-68db08531429",
    "year": 10,
    "observed": null
  },
  {
    "label": "Asia 3: city-changan 800 / observation 800",
    "expected": true,
    "city": "city-changan",
    "record": "chandler:1552",
    "year": 800,
    "observed": 800
  },
  {
    "label": "Asia 4: city-changan 800 / observation 1950",
    "expected": false,
    "city": "city-changan",
    "record": "chandler:1552",
    "year": 800,
    "observed": 1950
  },
  {
    "label": "Asia 5: city-changan 800 / observation None",
    "expected": false,
    "city": "city-changan",
    "record": "chandler:1552",
    "year": 800,
    "observed": null
  },
  {
    "label": "Asia 6: city-changan 800 / observation 1990",
    "expected": false,
    "city": "city-changan",
    "record": "modelski-modern:276",
    "year": 800,
    "observed": 1990
  },
  {
    "label": "Asia 7: city-kyoto 1000 / observation 1000",
    "expected": true,
    "city": "city-kyoto",
    "record": "chandler:764",
    "year": 1000,
    "observed": 1000
  },
  {
    "label": "Asia 8: city-kyoto 1000 / observation 1914",
    "expected": false,
    "city": "city-kyoto",
    "record": "chandler:764",
    "year": 1000,
    "observed": 1914
  },
  {
    "label": "Asia 9: city-kyoto 1000 / observation 2000",
    "expected": false,
    "city": "city-kyoto",
    "record": "modelski-modern:136",
    "year": 1000,
    "observed": 2000
  },
  {
    "label": "Asia 10: city-delhi 1648 / observation None",
    "expected": true,
    "city": "city-delhi",
    "record": "capital:Q33296$aaca60be-480f-4adc-c8f3-de0aaead129d",
    "year": 1648,
    "observed": null
  },
  {
    "label": "Asia 11: city-delhi 1600 / observation None",
    "expected": false,
    "city": "city-delhi",
    "record": "capital:Q33296$aaca60be-480f-4adc-c8f3-de0aaead129d",
    "year": 1600,
    "observed": null
  },
  {
    "label": "Asia 12: city-delhi 1858 / observation None",
    "expected": false,
    "city": "city-delhi",
    "record": "capital:Q33296$aaca60be-480f-4adc-c8f3-de0aaead129d",
    "year": 1858,
    "observed": null
  },
  {
    "label": "Asia 13: city-delhi 1600 / observation 2000",
    "expected": false,
    "city": "city-delhi",
    "record": "modelski-modern:69",
    "year": 1600,
    "observed": 2000
  },
  {
    "label": "Asia 14: city-angkor 899 / observation None",
    "expected": true,
    "city": "city-angkor",
    "record": "pleiades:531398484",
    "year": 899,
    "observed": null
  },
  {
    "label": "Asia 15: city-angkor 1499 / observation None",
    "expected": true,
    "city": "city-angkor",
    "record": "pleiades:531398484",
    "year": 1499,
    "observed": null
  },
  {
    "label": "Asia 16: city-angkor 1500 / observation None",
    "expected": false,
    "city": "city-angkor",
    "record": "pleiades:531398484",
    "year": 1500,
    "observed": null
  },
  {
    "label": "Asia 17: city-angkor 0 / observation None",
    "expected": false,
    "city": "city-angkor",
    "record": "pleiades:531398484",
    "year": 0,
    "observed": null
  },
  {
    "label": "Asia 18: city-samarkand -330 / observation None",
    "expected": true,
    "city": "city-samarkand",
    "record": "pleiades:59915",
    "year": -330,
    "observed": null
  },
  {
    "label": "Asia 19: city-samarkand 300 / observation None",
    "expected": true,
    "city": "city-samarkand",
    "record": "pleiades:59915",
    "year": 300,
    "observed": null
  },
  {
    "label": "Asia 20: city-samarkand 301 / observation None",
    "expected": false,
    "city": "city-samarkand",
    "record": "pleiades:59915",
    "year": 301,
    "observed": null
  },
  {
    "label": "Asia 21: city-samarkand -650 / observation -712",
    "expected": false,
    "city": "city-samarkand",
    "record": "chandler:1234",
    "year": -650,
    "observed": -712
  },
  {
    "label": "Asia 22: city-samarkand 900 / observation 900",
    "expected": true,
    "city": "city-samarkand",
    "record": "chandler:1234",
    "year": 900,
    "observed": 900
  },
  {
    "label": "Asia 23: city-baghdad 762 / observation None",
    "expected": false,
    "city": "city-baghdad",
    "record": "capital:Q12536$EBF2D1C0-F69F-4736-96E9-E8A1F0B2771D",
    "year": 762,
    "observed": null
  },
  {
    "label": "Asia 24: city-baghdad 763 / observation None",
    "expected": true,
    "city": "city-baghdad",
    "record": "capital:Q12536$EBF2D1C0-F69F-4736-96E9-E8A1F0B2771D",
    "year": 763,
    "observed": null
  },
  {
    "label": "Asia 25: city-baghdad 837 / observation None",
    "expected": false,
    "city": "city-baghdad",
    "record": "capital:Q12536$EBF2D1C0-F69F-4736-96E9-E8A1F0B2771D",
    "year": 837,
    "observed": null
  },
  {
    "label": "Asia 26: city-baghdad 892 / observation None",
    "expected": true,
    "city": "city-baghdad",
    "record": "capital:Q12536$F85A7661-954F-47D8-A010-93EE75274EBF",
    "year": 892,
    "observed": null
  },
  {
    "label": "Asia 27: city-baghdad 1258 / observation None",
    "expected": true,
    "city": "city-baghdad",
    "record": "capital:Q12536$F85A7661-954F-47D8-A010-93EE75274EBF",
    "year": 1258,
    "observed": null
  },
  {
    "label": "Asia 28: city-baghdad 1259 / observation None",
    "expected": false,
    "city": "city-baghdad",
    "record": "capital:Q12536$F85A7661-954F-47D8-A010-93EE75274EBF",
    "year": 1259,
    "observed": null
  },
  {
    "label": "Asia 29: city-baghdad 900 / observation 2000",
    "expected": false,
    "city": "city-baghdad",
    "record": "modelski-modern:13",
    "year": 900,
    "observed": 2000
  }
];
await check('All fifty-five reviewed Asia and world regression cases pass against the actual module',()=>{
 assert.equal(ORIGINAL_CASES.length,55);
 for(const c of ORIGINAL_CASES){const result=matchCityNarrative(data,selected(c.record,c.observed),c.year);assert.equal(result?.id===c.city,c.expected,c.label);counters.originalRegressionCases++;}
});
await check('The asynchronous local-fetch API retries after failure, deduplicates and returns only cited sources',async()=>{
 const p=selected('chandler:921',1520);failNext=true;await assert.rejects(cityNarrative(p,1520),/503/);
 const before=requests.length;
 const found=await Promise.all([cityNarrative(p,1520),cityNarrative(p,1521),cityNarrative(p,1520)]);
 assert.equal(requests.length-before,1);for(const entry of found){assert.equal(entry.id,'city-tenochtitlan');assert.deepEqual(entry.sources.map(s=>s.id).sort(),[...entry.sourceIds].sort());}
 assert.equal(await cityNarrative(p,1550),null);assert.equal(requests.length-before,1);
});

globalThis.fetch=originalFetch;
const report={testedAt:new Date().toISOString(),module:'dist/city-narratives.js',data:'dist/data/places/city-narratives.json.gz',dataSha256:createHash('sha256').update(await readFile(resolve(dist,'data/places/city-narratives.json.gz'))).digest('hex'),counts:counters,checks:results,passed:results.every(r=>r.passed)};
if(process.argv[3])await writeFile(resolve(process.argv[3]),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:results.filter(r=>r.passed).length,total:results.length,...counters}));
if(!report.passed)process.exitCode=1;
