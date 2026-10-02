#!/usr/bin/env node
/**
 * Offline regression for the reviewed place corrections in the shipped atlas.
 * Usage: node scripts/validate-place-corrections.mjs [repo-root] [--report file.json]
 * Requires Node >=18, shipped public assets/modules and scripts/places/rules.
 * No git, raw source download, browser, third-party package or work/ directory.
 * A deliberate source refresh must review the snapshot counts/digest below.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

function options(args){
 let root,report;
 for(let i=0;i<args.length;i++){
  const a=args[i];
  if(a==='--report'){assert(args[i+1]&&!args[i+1].startsWith('--'),'--report requires a file path');report=args[++i];}
  else if(a==='--root'){assert(args[i+1]&&!args[i+1].startsWith('--'),'--root requires a directory');assert(!root,'Only one repository root may be supplied');root=args[++i];}
  else {assert(!a.startsWith('-'),`Unknown option: ${a}`);assert(!root,'Only one repository root may be supplied');root=a;}
 }
 return {root:resolve(root||resolve(dirname(fileURLToPath(import.meta.url)),'..')),report:report&&resolve(report)};
}
const {root,report:reportPath}=options(process.argv.slice(2));
const publicDir=resolve(root,'public'),dataDir=resolve(publicDir,'data/places'),rulesDir=resolve(root,'scripts/places/rules');
const asset=async name=>JSON.parse(gunzipSync(await readFile(resolve(dataDir,name+'.json.gz'))));
const ruleFile=async name=>JSON.parse(await readFile(resolve(rulesDir,name+'.json'),'utf8'));
const results=[],requests=[];
async function check(name,fn){
 try{await fn();results.push({name,passed:true});console.log('PASS',name);}
 catch(error){results.push({name,passed:false,error:error.stack||String(error)});console.error('FAIL',name,error.message);}
}
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const sortId=(a,b)=>a.id<b.id?-1:a.id>b.id?1:0;
const digest=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
// These two fields are editorial display metadata. Everything else, including
// original names, aliases, coordinates, populations and provenance, is frozen.
function sourceValues(record){const copy=structuredClone(record);delete copy.datedNames;delete copy.nameTimeline;return copy;}
const SNAPSHOT={active:2040,activeObservations:10339,quarantined:3,quarantinedObservations:11,totalRows:2043,totalObservations:10350,sourceValuesSha256:'8653af1d1cf33bd19e691d2ec4ada4f8de07fd1c921bc2114b6b20aefac064e5'};
const QUANZHOU='chandler:1457',NEW_QUARANTINE=['chandler:245','chandler:715'],ALL_QUARANTINE=['chandler:1356',...NEW_QUARANTINE];
let actual,quarantine,sources,datedRules,quarantineRules,all,modules;
const originalFetch=globalThis.fetch;

try{
 await check('Shipped archives and reviewed rules load without an old checkout or raw-source cache',async()=>{
  [actual,quarantine,sources,datedRules,quarantineRules]=await Promise.all([asset('urban-observations'),asset('urban-quarantine'),asset('city-sources'),ruleFile('dated-place-names'),ruleFile('urban-quarantine-rules')]);
  for(const data of [actual,quarantine,sources])assert.equal(data.schemaVersion,1);
  assert(Array.isArray(actual.cities));assert(Array.isArray(quarantine.entries));assert(Array.isArray(datedRules.entries));assert(Array.isArray(quarantineRules.entries));
 });
 await check('Active and archived rows conserve all reviewed source values and observation totals',()=>{
  const archived=quarantine.entries.map(e=>e.originalRecord),combined=[...actual.cities,...archived];
  assert.equal(actual.cities.length,SNAPSHOT.active);assert.equal(archived.length,SNAPSHOT.quarantined);
  assert.equal(actual.cities.reduce((n,p)=>n+p.observations.length,0),SNAPSHOT.activeObservations);
  assert.equal(archived.reduce((n,p)=>n+p.observations.length,0),SNAPSHOT.quarantinedObservations);
  assert.equal(combined.length,SNAPSHOT.totalRows);assert.equal(new Set(combined.map(p=>p.id)).size,SNAPSHOT.totalRows,'Duplicate or active/archive identity collision');
  assert.equal(combined.reduce((n,p)=>n+p.observations.length,0),SNAPSHOT.totalObservations);
  assert.equal(digest(combined.map(sourceValues).sort(sortId)),SNAPSHOT.sourceValuesSha256,'Reviewed source values changed; investigate before updating the snapshot');
 });
 await check('All three corrected source rows match their exact rule bindings',()=>{
  const bindings=[datedRules.entries.find(e=>e.recordId===QUANZHOU),...NEW_QUARANTINE.map(id=>quarantineRules.entries.find(e=>e.recordId===id))];
  assert(bindings.every(Boolean));
  const combined=new Map([...actual.cities,...quarantine.entries.map(e=>e.originalRecord)].map(p=>[p.id,p]));
  for(const rule of bindings){const p=combined.get(rule.recordId);assert(p,rule.recordId);assert(rule.expected&&Object.keys(rule.expected).length>=6);for(const [key,value]of Object.entries(rule.expected))assert.deepEqual(p[key],value,`${rule.recordId}: ${key}`);}
  const p=combined.get(QUANZHOU),rule=bindings[0];
  assert.deepEqual(p.datedNames.filter(n=>n.recordId===QUANZHOU),[rule]);
  assert.equal(p.name,'Tsinkiang');assert.equal(p.nameZh,'晋江');assert.equal(p.otherNames,'Zayton, Chinchiang, Chuanchow');
  assert.equal(p.nameTimeline,undefined);assert.equal(p.periods,undefined);
 });
 await check('All quarantine entries preserve original records, reviewed reasons, uncertainty and source license',()=>{
  assert.equal(quarantine.rawSourceUnmodified,true);
  assert.deepEqual(quarantine.entries.map(e=>e.recordId).sort(),[...ALL_QUARANTINE].sort());
  assert.deepEqual(quarantineRules.entries.map(e=>e.recordId).sort(),[...ALL_QUARANTINE].sort());
  for(const rule of quarantineRules.entries){
   const entry=quarantine.entries.find(e=>e.recordId===rule.recordId),p=entry.originalRecord;
   assert.equal(p.id,entry.recordId);assert.equal(entry.status,'withheld-from-city-layer');
   assert.equal(entry.license,'CC BY 4.0');assert.equal(entry.license,sources.sources[p.source].license);
   assert.equal(entry.source,p.source);assert.equal(entry.sourceUrl,p.sourceUrl);assert(entry.unresolved&&entry.reasonZh&&entry.reasonEn);
   for(const [key,value]of Object.entries(rule))assert.deepEqual(entry[key],value,`${rule.recordId}: audit ${key}`);
   for(const [key,value]of Object.entries(rule.expected))assert.deepEqual(p[key],value,`${rule.recordId}: original ${key}`);
   assert(!actual.cities.some(r=>r.id===entry.recordId));
  }
 });
 await check('Source metadata reports the corrected active/archive counts consistently',()=>{
  assert.equal(sources.counts.urbanObservationCityRows,SNAPSHOT.active);
  assert.equal(sources.counts.populationObservations,SNAPSHOT.activeObservations);
  assert.equal(sources.urbanQuarantine.records,SNAPSHOT.quarantined);
  assert.equal(sources.urbanQuarantine.file,'urban-quarantine.json.gz');
  assert.equal(sources.urbanQuarantine.sourceRowValuesPreserved,true);
 });

 // Real browser modules use their normal loader. Only fetch is redirected to
 // shipped local assets; there is deliberately no network fallback.
 globalThis.fetch=async input=>{
  const request=typeof input==='string'?input:input instanceof URL?input.href:input?.url;
  requests.push(String(request));
  assert(typeof request==='string'&&!/^[a-z][a-z0-9+.-]*:/i.test(request),'Only relative shipped-asset requests are allowed');
  const pathname=request.split(/[?#]/,1)[0],file=resolve(publicDir,pathname),inside=relative(dataDir,file);
  assert(pathname.startsWith('data/places/')&&!inside.startsWith('..')&&!isAbsolute(inside),'Request outside place assets');
  try{return new Response(await readFile(file));}catch{return new Response('Missing shipped asset',{status:404});}
 };
 await check('Imports and loads the real places and polity-places modules offline',async()=>{
  const places=await import(pathToFileURL(resolve(publicDir,'places.js')).href);
  const polity=await import(pathToFileURL(resolve(publicDir,'polity-places.js')).href);
  modules={...places,...polity};assert.equal(typeof document,'undefined');
  all=await modules.loadPlaces();assert.equal(all.partial,false);
  assert.deepEqual(all.filter(p=>p.kind==='urban-observation').sort(sortId),[...actual.cities].sort(sortId));
  const withModern=await modules.loadPlaces(true);assert.equal(withModern.partial,false);
  for(const id of ALL_QUARANTINE){assert(!all.some(p=>p.id===id),id);assert(!withModern.some(p=>p.id===id),id);}
 });
 await check('Quarantined source IDs never reappear in real map-loader search results',async()=>{
  for(const entry of quarantine.entries){
   const queries=[entry.originalRecord.name,entry.originalRecord.nameZh].filter(Boolean);
   const years=[...new Set(entry.originalRecord.observations.map(o=>o[0]).concat(1500))];
   for(const q of queries)for(const year of years){const hits=await modules.searchPlaces(q,year,50);assert(!hits.some(p=>p.id===entry.recordId),`${entry.recordId}: ${q}@${year}`);}
  }
 });
 await check('All 27 source observations display Quanzhou without mutating date, population or coordinates',()=>{
  const p=actual.cities.find(r=>r.id===QUANZHOU),before=JSON.stringify(p);assert.equal(p.observations.length,27);
  for(const observation of p.observations){
   const at=modules.placeAtYear(p,observation[0],0);assert(at);
   assert.equal(modules.placeName(at,'en'),'Quanzhou');assert.equal(modules.placeName(at,'zh'),'泉州');assert.equal(modules.placeName(at,'bi'),'泉州');
   assert.deepEqual(at.observation,observation);assert.deepEqual(at.coordinates,p.coordinates);
   assert.equal(at.name,'Tsinkiang');assert.equal(at.nameZh,'晋江');assert.equal(at.labelEvidence.recordId,p.id);
  }
  assert.equal(JSON.stringify(p),before);
 });
 await check('Display evidence remains tied to observation years and does not invent a continuous city lifespan',()=>{
  const rule=datedRules.entries.find(e=>e.recordId===QUANZHOU),p=actual.cities.find(r=>r.id===QUANZHOU);
  assert.deepEqual(rule.observationYears,rule.expected.observations.map(o=>o[0]));assert.equal(new Set(rule.observationYears).size,27);
  assert.equal(rule.start,Math.min(...rule.observationYears));assert.equal(rule.end,Math.max(...rule.observationYears));
  assert.equal(rule.name,'Quanzhou');assert.equal(rule.nameZh,'泉州');assert.match(rule.scope,/no inferred/);
  assert(rule.sources.length>=4);for(const s of rule.sources){assert(s.title);assert.match(s.url,/^https:\/\//);}
  for(const year of [741,743,900,1949,0,1300.5,NaN])assert.equal(modules.placeAtYear(p,year,0),null,`Unexpected exact-year presence: ${year}`);
  const near=modules.placeAtYear(p,1949,1);assert(near);assert.deepEqual(near.observation,[1948,120655]);assert.equal(modules.placeName(near,'en'),'Quanzhou');
  assert.equal(modules.placeAtYear(p,1950,1),null);
 });
 await check('Chinese, English and historical aliases find the same corrected source row',async()=>{
  for(const q of ['泉州','Quanzhou','Tsinkiang','Zayton','Chinchiang','Chuanchow']){
   const hits=await modules.searchPlaces(q,1300,0);assert(hits.some(p=>p.id===QUANZHOU),q);
  }
 });
 await check('The real polity reader uses the corrected display while retaining the source alias and spatial/date limits',()=>{
  const p=all.find(r=>r.id===QUANZHOU),before=JSON.stringify(p);
  const geometry={type:'Polygon',coordinates:[[[118.5,24.8],[118.7,24.8],[118.7,25],[118.5,25],[118.5,24.8]]]},prepared=modules.prepareTerritory(geometry);
  const record={id:'test-source-outline',start:1200,end:1400};
  const selected=modules.selectedPolityPlace(p,record,1300,prepared,0);
  assert(selected);assert.equal(selected.association,'within-source-outline');assert.equal(modules.placeName(selected,'zh'),'泉州');assert.equal(modules.placeName(selected,'en'),'Quanzhou');
  assert.deepEqual(selected.observation,[1300,80000]);assert.deepEqual(selected.coordinates,p.coordinates);
  for(const q of ['泉州','Quanzhou','Tsinkiang','Zayton'])assert.equal(modules.filterPolityPlaces([selected],q,'all','zh').length,1,q);
  assert.equal(modules.filterPolityPlaces([selected],'Quanzhou','dated-capital','en').length,0);
  assert.equal(modules.selectedPolityPlace(p,record,1500,prepared,0),null,'Outside polity dates');
  assert.equal(modules.selectedPolityPlace(p,record,1301,prepared,0),null,'No exact source observation');
  assert.equal(modules.selectedPolityPlace(p,record,1300,modules.prepareTerritory({type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,1],[0,0]]]}),0),null,'Outside source geometry');
  assert.equal(JSON.stringify(p),before);
 });
}finally{globalThis.fetch=originalFetch;}

const report={passed:results.every(c=>c.passed),checks:results,snapshot:SNAPSHOT,requests:[...new Set(requests)].sort(),limits:'Offline shipped-data and actual-module regression. No browser rendering or new historical fact verification.'};
if(reportPath)await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(`${report.passed?'PASS':'FAIL'}: ${results.filter(c=>c.passed).length}/${results.length} place-correction checks`);
if(!report.passed)process.exitCode=1;
