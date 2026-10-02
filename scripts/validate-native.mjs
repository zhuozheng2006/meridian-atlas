// Integration tests import the actual Site modules. Each case runs in a fresh
// Node process, isolating their private resource/native geometry caches.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const here=path.dirname(fileURLToPath(import.meta.url));
const dist=path.resolve(here,'../public');
const read=relative=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dist,relative))));
const catalog=read('data/fast/catalog.json.gz');
const index=read('data/native/index.json.gz');
const manifest=JSON.parse(fs.readFileSync(path.join(dist,'data/native/manifest.json')));
const caseName=process.argv[process.argv.indexOf('--case')+1];

const cases={
 async collision_all({loadNative,nativeGeometry,AtlasMap,requests,subject}){
  const collisions=manifest.simplifiedIdCollisions;
  assert.equal(Object.keys(collisions).length,59);
  const ids=new Set(Object.values(collisions).flatMap(c=>c.recordIds));
  const records=catalog.records.filter(r=>ids.has(r.id));
  await loadNative(records,1666);
  const map=subject(records);
  AtlasMap.prototype.renderGeometry.call(map,new Map(),true);
  const rendered=new Map(map.frames.at(-1).features.map(f=>[f.properties.id,f.geometry]));
  for(const record of records){
   const gid=index.recordIndex[record.id];
   const expected=read('data/native/'+index.geometryIndex[gid])[gid];
   assert.deepEqual(nativeGeometry(record.id),expected);
   assert.deepEqual(rendered.get(record.id),expected);
  }
  for(const collision of Object.values(collisions)){
   const byNative=new Map(collision.recordIds.map(id=>[index.recordIndex[id],JSON.stringify(rendered.get(id))]));
   assert.equal(new Set(byNative.values()).size,collision.nativeGeometryIds.length);
  }
  assert(requests.some(r=>r.url.startsWith('data/native/geos/')));
  assert(!requests.some(r=>r.url.includes('native-')));
  return {collisionGroups:59,records:records.length,networkRequests:requests.length};
 },
 async boot_no_index({loadNative,nativeGeometry,activeRecords,requests}){
  const records=activeRecords(catalog,1492);await loadNative(records,1492);
  assert.deepEqual(requests.map(r=>r.url),['data/native/year-1492.json.gz']);
  const boot=read('data/native/year-1492.json.gz');
  for(const record of records)assert.deepEqual(nativeGeometry(record.id),boot.geometries[boot.recordIndex[record.id]]);
  await loadNative(records,1492);assert.equal(requests.length,1);
  return {records:records.length,requests:1,bytes:requests[0].bytes};
 },
 async arbitrary_files_concurrency({loadNative,nativeGeometry,activeRecords,requests,stats}){
  const records=activeRecords(catalog,1666);await loadNative(records,1666);
  const gids=new Set(records.map(r=>index.recordIndex[r.id]));
  const paths=new Set([...gids].map(gid=>'data/native/'+index.geometryIndex[gid]));
  assert.equal(requests.length,paths.size+1);
  assert.equal(requests.filter(r=>r.url==='data/native/index.json.gz').length,1);
  assert.deepEqual(new Set(requests.filter(r=>r.url!=='data/native/index.json.gz').map(r=>r.url)),paths);
  assert(stats.maxInFlight<=6);assert(stats.maxInFlight>1);
  for(const r of records)assert(nativeGeometry(r.id));
  const geometryBytes=requests.filter(r=>r.url.includes('/geos/')).reduce((n,r)=>n+r.bytes,0);
  assert.equal(geometryBytes,269168);
  return {records:records.length,geometries:gids.size,requests:requests.length,geometryBytes,maxConcurrent:stats.maxInFlight};
 },
 async mixed_cache_render({loadNative,nativeGeometry,AtlasMap,activeRecords,subject}){
  const records=activeRecords(catalog,1666).slice(0,3);
  const map=subject();map.upgradeDetail=async()=>{};
  await AtlasMap.prototype.setYear.call(map,{...catalog,records},1666);
  const coarse=new Map(map.frames.at(-1).features.map(f=>[f.properties.id,f.geometry]));
  await loadNative([records[0]],1666);
  AtlasMap.prototype.renderGeometry.call(map,new Map(),true);
  const partial=map.frames.at(-1);
  assert.equal(partial.features.length,3);
  assert.deepEqual(partial.features[0].geometry,nativeGeometry(records[0].id));
  for(const f of partial.features.slice(1))assert.deepEqual(f.geometry,coarse.get(f.properties.id));
  assert(!map.geometryKey.endsWith('n'));
  const before=map.frames.length;
  await loadNative(records,1666);
  AtlasMap.prototype.renderGeometry.call(map,new Map(),true);
  assert.equal(map.frames.length,before+1);assert(map.geometryKey.endsWith('n'));
  for(const f of map.frames.at(-1).features)assert.deepEqual(f.geometry,nativeGeometry(f.properties.id));
  AtlasMap.prototype.renderGeometry.call(map,new Map(),true);assert.equal(map.frames.length,before+1);
  return {records:3,partialFallbackRetained:true,completeCachePreventsRedundantSetData:true};
 },
 async failed_boot_fallback_retry({AtlasMap,activeRecords,subject,overrides,requests}){
  const records=activeRecords(catalog,1492);const url='data/native/year-1492.json.gz';
  overrides.set(url,()=>new Response('unavailable',{status:503}));
  const map=subject();map.upgradeDetail=async()=>{};
  await AtlasMap.prototype.setYear.call(map,catalog,1492);
  assert.equal(map.year,1492);assert.equal(map.frames.at(-1).features.length,records.length);
  assert(map.frames.at(-1).features.every(f=>f.geometry));assert(!map.geometryKey.endsWith('n'));
  overrides.delete(url);
  await AtlasMap.prototype.setYear.call(map,catalog,1492);
  assert(map.geometryKey.endsWith('n'));
  assert.equal(requests.filter(r=>r.url===url).length,2);
  return {fallbackRendered:true,retryNativeRendered:true};
 },
 async canceled_upgrade_next_sequence({AtlasMap,activeRecords,subject,gate,waitUntil}){
  const [a,b]=activeRecords(catalog,1666).slice(0,2);
  const url='data/native/'+index.geometryIndex[index.recordIndex[a.id]];
  const barrier=gate(url);const map=subject([a]);map.year=1666;
  const first=AtlasMap.prototype.upgradeDetail.call(map);
  await waitUntil(()=>barrier.reached);
  map.request=2;map.active=[b];map.year=1667;map.geometryKey='o';
  const second=AtlasMap.prototype.upgradeDetail.call(map);await second;
  assert.equal(map.frames.length,1);assert.equal(map.frames[0].features[0].properties.id,b.id);
  barrier.release();await first;
  assert.equal(map.frames.length,1);assert.equal(map.highRequest,null);
  return {staleUpgradeRenderCount:0,currentUpgradeRenderCount:1};
 },
 async destroyed_upgrade({AtlasMap,activeRecords,subject,gate,waitUntil,nativeGeometry}){
  const [r]=activeRecords(catalog,1666);
  const barrier=gate('data/native/'+index.geometryIndex[index.recordIndex[r.id]]);
  const map=subject([r]);map.year=1666;
  const pending=AtlasMap.prototype.upgradeDetail.call(map);
  await waitUntil(()=>barrier.reached);map.destroyed=true;barrier.release();await pending;
  assert.equal(map.frames.length,0);assert(nativeGeometry(r.id));assert.equal(map.highRequest,null);
  return {destroyedRenderCount:0,inFlightCachePreserved:true};
 },
 async zero_year({activeRecords,loadNative,AtlasMap,subject,requests}){
  assert.deepEqual(activeRecords(catalog,0),[]);await loadNative([],0);
  const map=subject();map.upgradeDetail=async()=>{};
  assert.equal(await AtlasMap.prototype.setYear.call(map,catalog,0),0);
  assert.deepEqual(map.frames.at(-1).features,[]);assert.equal(requests.length,0);
  return {zeroYearShowsNoTerritories:true,requests:0,note:'Engine empties the map; UI is responsible for rejecting a user-selected year zero.'};
 },
 async shared_file_cache({loadNative,nativeGeometry,requests}){
  const grouped=new Map();for(const record of catalog.records){const gid=index.recordIndex[record.id];if(!grouped.has(gid))grouped.set(gid,[]);grouped.get(gid).push(record);}
  const records=[...grouped.values()].find(r=>r.length>1).slice(0,2);
  await Promise.all(records.map(r=>loadNative([r],1666)));
  assert.deepEqual(nativeGeometry(records[0].id),nativeGeometry(records[1].id));
  assert.equal(requests.length,2);
  return {recordAliases:2,sharedIndexRequests:1,sharedGeometryRequests:1};
 },
 async missing_geometry_recovery({loadNative,nativeGeometry,activeRecords,overrides,requests}){
  const [r]=activeRecords(catalog,1666);const url='data/native/'+index.geometryIndex[index.recordIndex[r.id]];
  overrides.set(url,()=>new Response('{}',{status:200}));
  let rejected=false;try{await loadNative([r],1666);}catch{rejected=true;}
  assert(rejected,'A successful HTTP response missing its indexed geometry must reject, not poison the native cache with undefined');
  overrides.delete(url);await loadNative([r],1666);assert(nativeGeometry(r.id));
  assert.equal(requests.filter(q=>q.url===url).length,2);
  return {malformedPayloadRejected:true,retrySucceeded:true};
 }
};

if(!process.argv.includes('--case')){
 const results=[];
 for(const name of Object.keys(cases)){
  const result=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--case',name],{encoding:'utf8',timeout:90000});
  let output;try{output=JSON.parse(result.stdout.trim());}catch{output={raw:result.stdout};}
  results.push({name,passed:result.status===0,...output,error:result.status===0?undefined:result.stderr.trim()});
  console.log(`${result.status===0?'PASS':'FAIL'} ${name}${output.detail?' '+JSON.stringify(output.detail):''}`);
  if(result.status!==0)console.log(result.stderr.trim());
 }
 const report={testedUtc:new Date().toISOString(),dist,sourceSha256:Object.fromEntries(['native-geometry.js','map-engine.js'].map(name=>[name,createHash('sha256').update(fs.readFileSync(path.join(dist,name))).digest('hex')])),results};
 if(process.env.NATIVE_AUDIT_REPORT)fs.writeFileSync(process.env.NATIVE_AUDIT_REPORT,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length}));
 process.exitCode=results.some(r=>!r.passed)?1:0;
}else{
 const requests=[],overrides=new Map(),gates=new Map(),stats={inFlight:0,maxInFlight:0};
 globalThis.fetch=async url=>{
  url=String(url);const request={url,bytes:0};requests.push(request);
  stats.inFlight++;stats.maxInFlight=Math.max(stats.maxInFlight,stats.inFlight);
  try{
   const barrier=gates.get(url);if(barrier){barrier.reached=true;await barrier.promise;}
   await new Promise(resolve=>setTimeout(resolve,2));
   if(overrides.has(url))return overrides.get(url)();
   const file=path.resolve(dist,url);assert(file.startsWith(dist+path.sep),'Tests cannot fetch outside dist');
   if(!fs.existsSync(file))return new Response('not found',{status:404});
   const bytes=fs.readFileSync(file);request.bytes=bytes.length;
   return new Response(bytes,{status:200});
  }finally{stats.inFlight--;}
 };
 const gate=url=>{let release;const promise=new Promise(resolve=>release=resolve);const barrier={promise,release,reached:false};gates.set(url,barrier);return barrier;};
 const waitUntil=async predicate=>{for(let tries=0;tries<5000;tries++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,1));}throw Error('Timed out waiting for controlled request');};
 // Match the browser's stamped module identity so the test and the engine use
 // the same geometry cache, rather than instantiating two ESM module graphs.
 const revision=fs.readFileSync(path.join(dist,'map-engine.js'),'utf8').match(/\?v=[a-zA-Z0-9.-]+/)?.[0]||'';
 const {loadNative,nativeGeometry}=await import(pathToFileURL(path.join(dist,'native-geometry.js')).href+revision);
 const {AtlasMap,activeRecords}=await import(pathToFileURL(path.join(dist,'map-engine.js')).href+revision);
 const subject=(records=[])=>{
  const instance=Object.create(AtlasMap.prototype);const frames=[];
  Object.assign(instance,{request:1,active:records,year:1666,catalog,geometryKey:'o',ready:Promise.resolve(),lang:'bi',destroyed:false,frames,
   map:{getSource:id=>{assert.equal(id,'polities');return {setData:data=>frames.push(data)};}},
   upgradeLand(){},refreshLabels(){}});
  return instance;
 };
 try{const detail=await cases[caseName]({loadNative,nativeGeometry,AtlasMap,activeRecords,requests,overrides,stats,subject,gate,waitUntil});console.log(JSON.stringify({detail}));}
 catch(error){console.error(error.stack);process.exitCode=1;}
}
