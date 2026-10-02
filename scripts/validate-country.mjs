// Standalone read-only archive/controller audit. Writes only its report beside this file.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {countrySnapshot,countryVisible,loadCountryFrame,countryFeatures,countryStatus} from '../public/country-archive.js';
import {BoundaryController} from '../public/boundary-controller.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const archive=path.join(root,'public/data/cshapes');
const sourcePath=process.argv[2];if(!sourcePath)throw Error('Supply the pinned CShapes-COW-2.1.geojson path as the first argument; source hash is checked before use.');
const resultPath=path.join(root,'docs/country-validation.json');
const sha=b=>createHash('sha256').update(b).digest('hex');
const results=[];let source,manifest,catalog,allGeometry;
async function test(name,fn){try{const details=await fn();results.push({name,passed:true,...(details||{})});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.stack||String(error)});console.log('FAIL '+name+' — '+error.message);}}
const parseGzip=b=>JSON.parse(gunzipSync(b));
const originalFetch=globalThis.fetch,requests=[];
// No network: exercise the actual browser archive reader against the local release files.
globalThis.fetch=async url=>{
 const prefix='data/cshapes/';assert.equal(typeof url,'string');assert(url.startsWith(prefix));
 const file=url.slice(prefix.length);assert.equal(path.basename(file),file);requests.push(file);
 try{return new Response(await fs.readFile(path.join(archive,file)),{status:200});}
 catch{return new Response('missing',{status:404});}
};
const iso=(p,k)=>`${p[k+'year']}-${String(p[k+'month']).padStart(2,'0')}-${String(p[k+'day']).padStart(2,'0')}`;
const instant=(p,k)=>Date.UTC(p[k+'year'],p[k+'month']-1,p[k+'day']);
const vertices=x=>typeof x[0]==='number'?1:x.reduce((n,c)=>n+vertices(c),0);
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.freeze(x);for(const v of Object.values(x))freeze(v);}return x;};

await test('Pinned raw source and every distributed compressed archive match their published hashes',async()=>{
 manifest=JSON.parse(await fs.readFile(path.join(archive,'manifest.json'),'utf8'));
 const raw=await fs.readFile(sourcePath);assert.equal(sha(raw),manifest.sourceSha256);assert.equal(raw.length,manifest.sourceBytes);source=JSON.parse(raw);
 allGeometry=new Map();
 for(const item of [manifest.index,...manifest.packs]){
  const bytes=await fs.readFile(path.join(archive,item.file));assert.equal(bytes.length,item.bytes,item.file+' bytes');assert.equal(sha(bytes),item.sha256,item.file+' hash');
  const decoded=parseGzip(bytes);
  if(item===manifest.index)catalog=decoded;
  else{assert.equal(Object.keys(decoded).length,item.geometries,item.file+' geometry count');for(const [id,g]of Object.entries(decoded)){if(allGeometry.has(id))assert.deepEqual(g,allGeometry.get(id),id+' differs between decade packs');else allGeometry.set(id,g);}}
 }
 assert.equal(catalog.license,'CC BY-NC-SA 4.0');assert.equal(manifest.licenseURL,'https://creativecommons.org/licenses/by-nc-sa/4.0/');assert.equal(manifest.records,source.features.length);assert.equal(catalog.records.length,source.features.length);assert.equal(allGeometry.size,manifest.uniqueGeometries);
 return {archives:manifest.packs.length+1,records:source.features.length,uniqueGeometries:allGeometry.size};
});
await test('All source coordinates, rings, components, properties and civil dates survive the conversion',()=>{
 assert(source&&catalog&&allGeometry,'Integrity prerequisites unavailable');const seen=new Set();let count=0;
 for(const r of catalog.records){const raw=source.features[r.sourceIndex];assert(raw,r.id);assert(!seen.has(r.id));seen.add(r.id);assert.equal(r.id,`cshapes-cow-${String(r.sourceIndex).padStart(4,'0')}`);assert.deepEqual(r.source,raw.properties,r.id+' properties');assert.deepEqual(allGeometry.get(r.geometryId),raw.geometry,r.id+' exact coordinates');assert.equal(r.startDate,iso(raw.properties,'cows'));assert.equal(r.endDate,iso(raw.properties,'cowe'));assert(r.startDate<=r.endDate);count+=vertices(raw.geometry.coordinates);}
 assert.equal(count,manifest.sourceVertices);return {records:seen.size,vertices:count};
});
await test('Date support rejects unsupported years; day intervals include their documented endpoints',()=>{
 for(const year of [1500,1885,2024,-1,0,1900.5,NaN,Infinity,'1900'])assert.equal(countrySnapshot(year),null,String(year));
 assert.equal(countrySnapshot(1886),'1886-07-01');assert.equal(countrySnapshot(2023),'2023-07-01');
 const r={startDate:'1900-06-30',endDate:'1900-07-01'};assert(!countryVisible(r,'1900-06-29'));assert(countryVisible(r,'1900-06-30'));assert(countryVisible(r,'1900-07-01'));assert(!countryVisible(r,'1900-07-02'));
 assert(!countryVisible({startDate:'1900-07-02',endDate:'1900-12-31'},countrySnapshot(1900)));
});
await test('Every supported annual frame agrees with an independent raw-source UTC date oracle, offline',async()=>{
 assert(source,'Source prerequisite unavailable');let comparisons=0;const counts={};
 for(let year=1886;year<=2023;year++){
  const frame=await loadCountryFrame(year),t=Date.UTC(year,6,1);
  const expected=source.features.flatMap((f,i)=>instant(f.properties,'cows')<=t&&t<=instant(f.properties,'cowe')?[i]:[]);
  assert.deepEqual(frame.records.map(r=>r.sourceIndex).sort((a,b)=>a-b),expected,year+' active records');
  for(const r of frame.records){assert.deepEqual(frame.geometries[r.geometryId],source.features[r.sourceIndex].geometry,year+' / '+r.id);comparisons++;}
  counts[year]=frame.records.length;
 }
 return {years:138,recordGeometryComparisons:comparisons,networkRequests:0,localReads:requests.length,minRecords:Math.min(...Object.values(counts)),maxRecords:Math.max(...Object.values(counts))};
});
await test('Rendering features never mutates source geometry or substitutes archive identities',async()=>{
 const frame=await loadCountryFrame(1900);const r=frame.records.reduce((a,b)=>vertices(frame.geometries[a.geometryId].coordinates)<vertices(frame.geometries[b.geometryId].coordinates)?a:b);
 const fixture=freeze({records:[structuredClone(r)],geometries:{[r.geometryId]:structuredClone(frame.geometries[r.geometryId])},date:frame.date,catalog:{version:'fixture'}}),before=JSON.stringify(fixture);
 const features=countryFeatures(fixture,()=> '#123456');assert.equal(JSON.stringify(fixture),before);assert.equal(features.length,1);assert.equal(features[0].geometry,fixture.geometries[r.geometryId]);assert.equal(features[0].properties.id,r.id);assert.equal(features[0].properties.archive,'cshapes');assert.equal(features[0].properties.start_date,r.startDate);assert.equal(features[0].properties.end_date,r.endDate);assert.equal(countryStatus(null,'en'),'Not recorded');
});

const geometry=freeze({type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,1],[0,0]]]});
const fakeCountry=year=>({date:`${year}-07-01`,catalog:{version:'fixture',records:[]},records:[{id:'cshapes-test',name:'Test state',geometryId:'g',startDate:'1886-01-01',endDate:'2023-12-31'}],geometries:{g:geometry}});
const overview=year=>({source:'cliopatria',year,records:[{id:'clio-test'}],key:'clio:'+year,data:{type:'FeatureCollection',features:[]}});
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function setup({loadCountry=async y=>fakeCountry(y),loadOverview=async y=>overview(y),year=1900}={}){
 const writes=[],paint=new Map(),status=[];
 const atlas={year,request:1,catalog:{},active:[],lang:'en',destroyed:false,geometryKey:'',prepareOverview:loadOverview,refreshLabels(){},upgradeDetail(){},map:{getSource(){return {setData:d=>writes.push(d)};},setPaintProperty:(id,key,value)=>paint.set(id+':'+key,value)},regional:{active:false,setStatus:s=>status.push(s),update(){}}};
 const controller=new BoundaryController(atlas,{mode:'auto',color:()=> '#123456',loadCountry});atlas.boundaries=controller;return {atlas,controller,writes,paint,status};
}
await test('Supported explicit country mode does not depend on a working overview archive',async()=>{
 const x=setup({loadOverview:async()=>{throw Error('overview unavailable');}});await x.controller.setMode('cshapes');assert.equal(x.controller.current.source,'cshapes');assert.equal(x.controller.current.year,1900);assert.equal(x.writes.length,1);assert.equal(x.controller.loading,false);
});
await test('Unsupported dates and failed country requests fall back to the exact requested year',async()=>{
 for(const [year,reason]of [[1500,'unsupported'],[1900,'error']]){let requests=0;const x=setup({year,loadCountry:async()=>{requests++;throw Error('bad country pack');}});await x.controller.setMode('cshapes');assert.equal(x.controller.mode,'cshapes');assert.equal(x.controller.current.source,'cliopatria');assert.equal(x.controller.current.year,year);assert.equal(x.controller.reason,reason);assert.equal(requests,reason==='unsupported'?0:1);}
});
await test('A slower prior source choice cannot overwrite a later completed mode',async()=>{
 const d=deferred(),x=setup({loadCountry:()=>d.promise});const first=x.controller.setMode('cshapes');await x.controller.setMode('overview');d.resolve(fakeCountry(1900));await first;assert.equal(x.controller.mode,'overview');assert.equal(x.controller.current.source,'cliopatria');assert.equal(x.writes.length,1);assert.equal(x.controller.loading,false);
});
await test('A source response for a previous displayed year cannot overwrite a newly committed frame',async()=>{
 const d=deferred(),x=setup({loadCountry:()=>d.promise});const first=x.controller.setMode('cshapes');x.atlas.request++;x.atlas.year=2000;const frame={requested:'cshapes',source:'cshapes',year:2000,frame:fakeCountry(2000),records:fakeCountry(2000).records,data:{type:'FeatureCollection',features:countryFeatures(fakeCountry(2000),()=> '#123456')},key:'cshapes:2000-07-01',reason:null};x.controller.commit(frame);d.resolve(fakeCountry(1900));await first;assert.equal(x.controller.current.year,2000);assert.equal(x.writes.length,1);assert.equal(x.controller.loading,false);
});
await test('Two maps sharing a source promise keep separate mode and displayed archive state',async()=>{
 const d=deferred(),left=setup({loadCountry:()=>d.promise}),right=setup({loadCountry:()=>d.promise});const a=left.controller.setMode('cshapes'),b=right.controller.setMode('cshapes');await left.controller.setMode('overview');d.resolve(fakeCountry(1900));await Promise.all([a,b]);assert.equal(left.controller.current.source,'cliopatria');assert.equal(right.controller.current.source,'cshapes');assert.equal(left.writes.length,1);assert.equal(right.writes.length,1);
});
await test('Destroying a map invalidates pending commits',async()=>{
 const d=deferred(),x=setup({loadCountry:()=>d.promise});const load=x.controller.setMode('cshapes');x.controller.destroy();d.resolve(fakeCountry(1900));await load;assert.equal(x.writes.length,0);
});
await test('If both archives fail, the existing frame stays intact and its source is not mislabeled',async()=>{
 const x=setup();await x.controller.setMode('cshapes');const before=x.controller.current,writes=x.writes.length;x.controller.loadCountry=async()=>{throw Error('country unavailable');};x.atlas.prepareOverview=async()=>{throw Error('overview unavailable');};await x.controller.setMode('cshapes');assert.equal(x.controller.current,before);assert.equal(x.writes.length,writes);assert.equal(x.controller.loading,false);assert.equal(x.controller.reason,'error');assert(!/Global overview/.test(x.controller.title('en')),'The retained CShapes frame is incorrectly labeled Global overview');
});
await test('Selection and overview strokes hide together when regional source becomes visible',()=>{
 const x=setup();x.controller.applyVisibility(true);for(const [id,p]of [['territories','fill-opacity'],['boundary','line-opacity'],['selection','line-opacity'],['selection-fill','fill-opacity']]){assert.equal(x.paint.get(id+':'+p),0);assert.deepEqual(x.paint.get(id+':'+p+'-transition'),{duration:0,delay:0});}x.controller.applyVisibility(false);assert.notEqual(x.paint.get('boundary:line-opacity'),0);assert.equal(x.paint.get('selection:line-opacity'),1);
});

globalThis.fetch=originalFetch;
const report={checkedAt:new Date().toISOString(),status:results.every(r=>r.passed)?'passed':'failed',checks:results.length,passed:results.filter(r=>r.passed).length,results};
await fs.writeFile(resultPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,checks:report.checks,passed:report.passed,report:resultPath}));
process.exitCode=report.status==='passed'?0:1;
