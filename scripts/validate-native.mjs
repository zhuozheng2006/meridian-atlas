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

async function bundleCacheRelease({loadNative,nativeGeometry,readJSON,activeRecords,requests,gate,waitUntil},year){
 const records=activeRecords(catalog,year),slot=Object.entries(index.temporalBundles).find(([start,p])=>+start<=year&&year<=p.end);
 const url=year===1492?'data/native/year-1492.json.gz':'data/native/'+slot[1].file,barrier=gate(url);
 const first=loadNative(records,year),second=loadNative(records,year);await waitUntil(()=>barrier.reached);
 assert.equal(requests.filter(r=>r.url===url).length,1,'Two maps must share the pending pack request');
 barrier.release();await Promise.all([first,second]);assert(records.every(r=>nativeGeometry(r.id)));
 const geometries=records.map(r=>nativeGeometry(r.id));
 await loadNative(records,year);assert.equal(requests.filter(r=>r.url===url).length,1,'Exact geometry cache must prevent another pack fetch');
 // A direct resource read must now fetch again: the resolved pack Promise was
 // released, while record geometry references remain in the native cache.
 await readJSON(url);assert.equal(requests.filter(r=>r.url===url).length,2,'Successful pack must leave the generic resource cache');
 records.forEach((r,i)=>assert.equal(nativeGeometry(r.id),geometries[i]));
 return {year,sharedPendingRequests:1,nativeCacheHitRequests:0,releasedResolvedResource:true,nativeReferencesPreserved:records.length};
}

const cases={
 async prefetch_bootstrap_one_pack({prefetchNativeFrame,loadNativeFrame,nativeGeometry,activeRecords,requests}){
  assert.equal(await prefetchNativeFrame(1492),true);assert.deepEqual(requests.map(r=>r.url),['data/native/year-1492.json.gz']);
  const records=activeRecords(catalog,1492);await loadNativeFrame(records,1492);await prefetchNativeFrame(1492);assert.equal(requests.length,1);
  for(const r of records){const gid=index.recordIndex[r.id];assert.deepEqual(nativeGeometry(r.id),read('data/native/'+index.geometryIndex[gid])[gid]);}
  return {onePack:true,noIndex:true,exactAliasRecords:records.length};
 },
 async prefetch_temporal_shared_cancel({prefetchNativeFrame,loadNativeFrame,nativeGeometry,activeRecords,requests,gate,waitUntil}){
  const year=1450,slot=Object.entries(index.temporalBundles).find(([s,p])=>+s<=year&&year<=p.end),url='data/native/'+slot[1].file,barrier=gate(url);let live=true;
  const first=prefetchNativeFrame(year,()=>live),second=prefetchNativeFrame(year),frame=loadNativeFrame(activeRecords(catalog,year),year);
  await waitUntil(()=>barrier.reached);assert.equal(requests.length,1);live=false;barrier.release();assert.equal(await first,false);assert.equal(await second,true);await frame;
  assert(activeRecords(catalog,year).every(r=>nativeGeometry(r.id)));assert.equal(requests.length,1);
  return {sharedConsumers:3,requests:1,cancelDidNotAbortOtherMap:true};
 },
 async prefetch_invalid_or_canceled_no_requests({prefetchNativeFrame,requests}){
  assert.equal(await prefetchNativeFrame(1450,()=>false),false);assert.equal(await prefetchNativeFrame(-70000),false);assert.equal(await prefetchNativeFrame(0),false);assert.equal(await prefetchNativeFrame(NaN),false);assert.equal(requests.length,0);return {requests:0};
 },
 async prefetch_failure_retries_real_frame({prefetchNativeFrame,loadNativeFrame,activeRecords,nativeGeometry,requests,overrides}){
  const url='data/native/year-1492.json.gz';overrides.set(url,()=>new Response('unavailable',{status:503}));assert.equal(await prefetchNativeFrame(1492),false);assert.equal(requests.length,1);
  overrides.delete(url);const records=activeRecords(catalog,1492);await loadNativeFrame(records,1492);assert(records.every(r=>nativeGeometry(r.id)));assert.equal(requests.length,2);assert(requests.every(r=>r.url===url));return {retrySucceeded:true,indexOrOverviewRequests:0};
 },
 async prefetch_incomplete_pack_requires_frame_coverage({prefetchNativeFrame,AtlasMap,subject,requests,overrides,activeRecords}){
  const year=1450,slot=Object.entries(index.temporalBundles).find(([s,p])=>+s<=year&&year<=p.end),url='data/native/'+slot[1].file,pack=read(url),missing=activeRecords(catalog,year)[0];delete pack.recordIndex[missing.id];
  overrides.set(url,()=>new Response(JSON.stringify(pack)));assert.equal(await prefetchNativeFrame(year),true);
  const map=subject();map.upgradeDetail=async()=>{};await AtlasMap.prototype.setYear.call(map,catalog,year);assert(!map.geometryKey.endsWith('n'));assert(requests.some(r=>r.url.includes('/overview-')));assert(!requests.some(r=>r.url.endsWith('/index.json.gz')));
  overrides.delete(url);await AtlasMap.prototype.setYear.call(map,catalog,year);assert(map.geometryKey.endsWith('n'));assert.equal(requests.filter(r=>r.url===url).length,2);return {missingRecordNotComplete:true,overviewFallback:true,retrySucceeded:true};
 },
 async prefetch_rejects_wrong_dates_and_invalid_unused_geometry({prefetchNativeFrame,nativeGeometry,requests,overrides}){
  const url='data/native/year-1492.json.gz',pack=read(url),ids=Object.keys(pack.recordIndex);pack.year=1493;overrides.set(url,()=>new Response(JSON.stringify(pack)));assert.equal(await prefetchNativeFrame(1492),false);assert(ids.every(id=>!nativeGeometry(id)));
  pack.year=1492;delete pack.geometries[pack.recordIndex[ids.at(-1)]];assert.equal(await prefetchNativeFrame(1492),false);assert(ids.every(id=>!nativeGeometry(id)));assert.equal(requests.length,2);return {invalidPrefetchPollution:0,requests:2};
 },
 async prefetch_late_result_cannot_commit_old_year({prefetchNativeFrame,AtlasMap,subject,requests,gate,waitUntil}){
  const year=1450,slot=Object.entries(index.temporalBundles).find(([s,p])=>+s<=year&&year<=p.end),url='data/native/'+slot[1].file,barrier=gate(url),map=subject();
  const warm=prefetchNativeFrame(year),old=AtlasMap.prototype.setYear.call(map,catalog,year);await waitUntil(()=>barrier.reached);await AtlasMap.prototype.setYear.call(map,catalog,1666);const count=map.frames.length;barrier.release();await warm;assert.equal(await old,false);assert.equal(map.frames.length,count);assert.equal(map.year,1666);assert.equal(requests.filter(r=>r.url===url).length,1);return {lateFrames:0,currentYear:1666};
 },
 async bootstrap_cache_release(context){return bundleCacheRelease(context,1492);},
 async temporal_cache_release(context){return bundleCacheRelease(context,1450);},
 async persistent_boot_failure_independent_fallback({AtlasMap,activeRecords,nativeGeometry,subject,overrides,requests}){
  const year=1492,records=activeRecords(catalog,year),url='data/native/year-1492.json.gz';
  const slot=Object.entries(index.temporalBundles).find(([start,p])=>+start<=year&&year<=p.end);
  overrides.set(url,()=>new Response('unavailable',{status:503}));
  overrides.set('data/native/'+slot[1].file,()=>new Response('unavailable',{status:503}));
  const map=subject();map.upgradeDetail=async()=>{};
  await AtlasMap.prototype.setYear.call(map,catalog,year);assert(!map.geometryKey.endsWith('n'));
  await AtlasMap.prototype.upgradeDetail.call(map);
  assert(records.every(r=>nativeGeometry(r.id)));assert(map.geometryKey.endsWith('n'));
  assert(requests.some(r=>r.url.includes('/geos/')));assert.equal(requests.filter(r=>r.url===url).length,1);
  return {permanentlyFailedOptionalPacks:2,independentFallbackRecords:records.length,bootstrapAttempts:1};
 },
 async bootstrap_validates_all_cached_entries({loadNative,nativeGeometry,activeRecords,overrides,requests}){
  const year=1492,records=activeRecords(catalog,year),url='data/native/year-1492.json.gz',pack=read(url);
  const first=records[0],other=records.find(r=>pack.recordIndex[r.id]!==pack.recordIndex[first.id]);
  delete pack.geometries[pack.recordIndex[other.id]];
  overrides.set(url,()=>new Response(JSON.stringify(pack)));
  await loadNative([first],year);assert(nativeGeometry(first.id));assert(!nativeGeometry(other.id));
  overrides.delete(url);const before=requests.length;
  await loadNative([other],year);assert(nativeGeometry(other.id));assert(requests.length>before);
  assert.equal(requests.filter(r=>r.url===url).length,1,'Background recovery must not repeatedly fetch the failed bootstrap');
  return {unrequestedInvalidGeometryExcluded:true,independentRecoverySucceeded:true};
 },
 async slow_pack_waits_without_competing_overview({AtlasMap,subject,requests,gate,waitUntil}){
  const year=1450,slot=Object.entries(index.temporalBundles).find(([start,p])=>+start<=year&&year<=p.end),url='data/native/'+slot[1].file,barrier=gate(url),map=subject();
  let settled=false;const start=Date.now(),pending=AtlasMap.prototype.setYear.call(map,catalog,year).then(value=>{settled=true;return value;});
  await waitUntil(()=>barrier.reached);await new Promise(resolve=>setTimeout(resolve,1500));
  assert(!settled,'A healthy slow pack continues without an arbitrary frame timeout');assert.equal(map.frames.length,0);
  assert.deepEqual(requests.map(r=>r.url),[url],'Neither the large index nor overview shards compete with the pack');
  barrier.release();await pending;
  assert.equal(map.frames.length,1);assert(map.geometryKey.endsWith('n'));assert(map.frames[0].features.every(f=>f.geometry));
  assert.equal(requests.length,1);
  return {controlledDelayMs:Date.now()-start,completeFirstFrame:true,nativePackRequests:1,overviewRequests:0,largeIndexRequests:0};
 },
 async slow_pack_late_result_after_navigation({AtlasMap,subject,requests,gate,waitUntil}){
  const year=1450,slot=Object.entries(index.temporalBundles).find(([start,p])=>+start<=year&&year<=p.end),url='data/native/'+slot[1].file,barrier=gate(url),map=subject();
  const old=AtlasMap.prototype.setYear.call(map,catalog,year);await waitUntil(()=>barrier.reached);
  await new Promise(resolve=>setTimeout(resolve,1500));assert.equal(map.frames.length,0);
  await AtlasMap.prototype.setYear.call(map,catalog,1666);assert.equal(map.year,1666);const frames=map.frames.length;
  barrier.release();assert.equal(await old,false);
  assert.equal(map.year,1666);assert.equal(map.frames.length,frames);assert.equal(requests.filter(r=>r.url===url).length,1);
  assert(!requests.some(r=>r.url.includes('/overview-')||r.url.endsWith('/index.json.gz')));
  return {lateNativeRenderCount:0,latestYear:1666,overviewRequests:0};
 },
 async temporal_validates_entire_payload({loadNative,nativeGeometry,activeRecords,overrides,requests}){
  const year=1666,records=activeRecords(catalog,year).slice(0,8),slot=Object.entries(index.temporalBundles).find(([start,p])=>+start<=year&&year<=p.end),url='data/native/'+slot[1].file,pack=read(url);
  const unused=Object.keys(pack.recordIndex).find(id=>!records.some(r=>pack.recordIndex[r.id]===pack.recordIndex[id]));assert(unused);
  delete pack.geometries[pack.recordIndex[unused]];
  overrides.set(url,()=>new Response(JSON.stringify(pack)));
  await loadNative(records,year);assert(records.every(r=>nativeGeometry(r.id)));assert(!nativeGeometry(unused));
  assert(requests.some(r=>r.url.includes('/geos/')));assert.equal(requests.filter(r=>r.url===url).length,1);
  return {allPackMappingsValidated:true,independentFallbackRecords:records.length};
 },

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
 async alps_1500_boot_no_index({loadNative,nativeGeometry,activeRecords,requests}){
  const records=activeRecords(catalog,1500);await loadNative(records,1500);
  assert.equal(records.length,137);assert.deepEqual(requests.map(r=>r.url),['data/native/year-1500.json.gz']);
  for(const r of records){const gid=index.recordIndex[r.id],expected=read('data/native/'+index.geometryIndex[gid])[gid];assert.deepEqual(nativeGeometry(r.id),expected);}
  return {records:records.length,requests:1,bytes:requests[0].bytes,exactIndividualGeometriesCompared:137};
 },
 async arbitrary_files_concurrency({loadNative,nativeGeometry,activeRecords,requests,stats,overrides}){
  const slot=Object.entries(index.temporalBundles).find(([start,p])=>+start<=1666&&1666<=p.end),failedPack='data/native/'+slot[1].file;overrides.set(failedPack,()=>new Response('unavailable',{status:503}));
  const records=activeRecords(catalog,1666);await loadNative(records,1666);
  const gids=new Set(records.map(r=>index.recordIndex[r.id]));
  const paths=new Set([...gids].map(gid=>'data/native/'+index.geometryIndex[gid]));
  assert.equal(requests.length,paths.size+2);
  assert.equal(requests.filter(r=>r.url==='data/native/index.json.gz').length,1);
  assert.deepEqual(new Set(requests.filter(r=>r.url.includes('/geos/')).map(r=>r.url)),paths);
  assert(stats.maxInFlight<=6);assert(stats.maxInFlight>1);
  for(const r of records)assert(nativeGeometry(r.id));
  const geometryBytes=requests.filter(r=>r.url.includes('/geos/')).reduce((n,r)=>n+r.bytes,0);
  assert.equal(geometryBytes,269168);
  return {records:records.length,geometries:gids.size,requests:requests.length,geometryBytes,maxConcurrent:stats.maxInFlight};
 },
 async arbitrary_bundle_exact({loadNative,nativeGeometry,activeRecords,requests,stats}){
  const records=activeRecords(catalog,1666);await loadNative(records,1666);
  assert.equal(requests.length,1);assert(requests[0].url.includes('/temporal/'));
  for(const r of records){const gid=index.recordIndex[r.id];assert.deepEqual(nativeGeometry(r.id),read('data/native/'+index.geometryIndex[gid])[gid]);}
  assert(requests.every(r=>r.priority==='high'));
  return {records:records.length,requests:1,geometryBytes:requests[0].bytes,largeIndexRequests:0};
 },
 async arbitrary_first_frame_exact({AtlasMap,activeRecords,subject,requests}){
  const map=subject();await AtlasMap.prototype.setYear.call(map,catalog,1450);
  assert(map.geometryKey.endsWith('n'));assert.equal(map.frames.length,1);assert.equal(map.frames[0].features.length,activeRecords(catalog,1450).length);
  assert.equal(requests.length,1);assert(requests.every(r=>r.url.startsWith('data/native/')));
  return {firstFrameComplete:true,overviewRequests:0,requests:1,largeIndexRequests:0};
 },
 async failed_bundle_frame_fallback_retry({AtlasMap,activeRecords,subject,overrides,requests}){
  const slot=Object.entries(index.temporalBundles).find(([start,p])=>+start<=1450&&1450<=p.end);const url='data/native/'+slot[1].file;
  overrides.set(url,()=>new Response('unavailable',{status:503}));const map=subject();map.upgradeDetail=async()=>{};
  await AtlasMap.prototype.setYear.call(map,catalog,1450);assert.equal(map.frames.at(-1).features.length,activeRecords(catalog,1450).length);assert(!map.geometryKey.endsWith('n'));
  assert(!requests.some(r=>r.url.includes('/geos/')));assert(requests.some(r=>r.url.includes('/overview-')));
  overrides.delete(url);await AtlasMap.prototype.setYear.call(map,catalog,1450);assert(map.geometryKey.endsWith('n'));assert.equal(requests.filter(r=>r.url===url).length,2);
  return {coarseFallback:true,individualRequestsDuringFrame:0,retrySucceeded:true};
 },
 async canceled_bundle_first_frame({AtlasMap,subject,gate,waitUntil}){
  const slot=Object.entries(index.temporalBundles).find(([start,p])=>+start<=1450&&1450<=p.end),barrier=gate('data/native/'+slot[1].file),map=subject();
  const first=AtlasMap.prototype.setYear.call(map,catalog,1450);await waitUntil(()=>barrier.reached);
  await AtlasMap.prototype.setYear.call(map,catalog,1666);assert.equal(map.frames.length,1);assert.equal(map.year,1666);
  barrier.release();assert.equal(await first,false);assert.equal(map.frames.length,1);assert.equal(map.year,1666);
  return {staleFrames:0,latestYear:1666};
 },
 async mixed_cache_render({loadNative,nativeGeometry,AtlasMap,activeRecords,subject,overrides}){
  const records=activeRecords(catalog,1666).slice(0,3);
  const slot=Object.entries(index.temporalBundles).find(([start,p])=>+start<=1666&&1666<=p.end);overrides.set('data/native/'+slot[1].file,()=>new Response('unavailable',{status:503}));
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
 const report={testedUtc:new Date().toISOString(),dist,sourceSha256:Object.fromEntries(['native-geometry.js','native-temporal-index.js','map-engine.js'].map(name=>[name,createHash('sha256').update(fs.readFileSync(path.join(dist,name))).digest('hex')])),results};
 if(process.env.NATIVE_AUDIT_REPORT)fs.writeFileSync(process.env.NATIVE_AUDIT_REPORT,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length}));
 process.exitCode=results.some(r=>!r.passed)?1:0;
}else{
 const requests=[],overrides=new Map(),gates=new Map(),stats={inFlight:0,maxInFlight:0};
 globalThis.fetch=async (url,options={})=>{
  url=String(url);const request={url,bytes:0,priority:options.priority};requests.push(request);
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
 const {loadNative,loadNativeFrame,prefetchNativeFrame,nativeGeometry}=await import(pathToFileURL(path.join(dist,'native-geometry.js')).href+revision);
 const {BoundaryController}=await import(pathToFileURL(path.join(dist,'boundary-controller.js')).href+revision);
 const {AtlasMap,activeRecords,color,readJSON}=await import(pathToFileURL(path.join(dist,'map-engine.js')).href+revision);
 const subject=(records=[])=>{
  const instance=Object.create(AtlasMap.prototype);const frames=[];
  Object.assign(instance,{request:1,active:records,year:1666,catalog,geometryKey:'o',ready:Promise.resolve(),lang:'bi',destroyed:false,frames,
   map:{setPaintProperty(){},getSource:id=>{assert.equal(id,'polities');return {setData:data=>frames.push({...data,features:data.features.filter(f=>!f.properties._atlasBoundaryLine)})};}},
   upgradeLand(){},refreshLabels(){}});
  instance.boundaries=new BoundaryController(instance,{mode:'auto',color});
  return instance;
 };
 try{const detail=await cases[caseName]({loadNative,loadNativeFrame,prefetchNativeFrame,nativeGeometry,readJSON,AtlasMap,activeRecords,requests,overrides,stats,subject,gate,waitUntil});console.log(JSON.stringify({detail}));}
 catch(error){console.error(error.stack);process.exitCode=1;}
}
