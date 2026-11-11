import assert from 'node:assert/strict';
import fs from 'node:fs';
const priorityImport=fs.readFileSync(new URL('../public/map-engine.js',import.meta.url),'utf8').match(/from '(\.\/map-load-priority\.js[^']*)'/)[1];
const {beginMapForeground,waitForMapForeground}=await import(new URL(priorityImport,new URL('../public/map-engine.js',import.meta.url)));
import {readRegionalSnapshot,RegionalBoundaries} from '../public/regional-boundaries.js';
import {readJSON} from '../public/map-engine.js';
import {decodeRegionalTransport} from '../public/regional-transport.js';
const checks=[],test=async(name,run)=>{await run();checks.push(name);console.log('PASS '+name);};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const originalFetch=globalThis.fetch,requests=[],data={type:'FeatureCollection',features:[{type:'Feature',properties:{id:'unchanged'},geometry:{type:'Polygon',coordinates:[[[1,1],[2,1],[2,2],[1,1]]]}}]};
globalThis.fetch=async url=>{requests.push(url);return new Response(JSON.stringify(data));};
try{
 await test('Optional city downloads wait while first-frame catalog remains unblocked',async()=>{
  const release=beginMapForeground(),p=readJSON('data/places/historical-settlements-priority-test.json.gz');await tick();assert(!requests.length);
  await readJSON('data/fast/priority-test.json.gz');assert.deepEqual(requests,['data/fast/priority-test.json.gz']);release();await p;assert.equal(requests.length,2);
 });
 await test('Two independent map snapshots release their shared priority safely',async()=>{const a=beginMapForeground(),b=beginMapForeground();let done=false;const p=waitForMapForeground('data/lakes/0000.bin.gz').then(()=>done=true);a();a();await tick();assert(!done);b();await p;assert(done);});
 await test('A stalled historical snapshot cannot indefinitely block physical geography',async()=>{const release=beginMapForeground();await waitForMapForeground('data/land-50m.json.gz',{timeout:5});release();});
 await test('Corrupt compact snapshot falls back to its exact original file',async()=>{
  requests.length=0;globalThis.fetch=async url=>{requests.push(url);return new Response(JSON.stringify(url.includes('ohm-transport')?{encoding:'ohm-delta-1e7',features:[{deltaGeometry:{type:'Polygon',coordinates:[[1,2,3]]}}]}:data));};
  const window_={id:'central-europe',root:'data/ohm-1500/'};assert.deepEqual(await readRegionalSnapshot(window_,1492),data);
  assert.deepEqual(requests,['data/ohm-transport/central-europe-1492.json.gz','data/ohm-1500/year-1492.json.gz']);await waitForMapForeground('data/land-50m.json.gz');
 });
 await test('Online detail starts after a bounded head start, but never after a map exits',async()=>{
  for(const live of [true,false]){let starts=0;const owner={liveWarmTimer:null,eligible:true,failed:false,map:{getSource:()=>null},ensure(){starts++;},applyFilters(){},visibility(){},requestRender(){}};
   RegionalBoundaries.prototype.deferOnline.call(owner,5);RegionalBoundaries.prototype.deferOnline.call(owner,5);owner.eligible=live;await new Promise(r=>setTimeout(r,15));assert.equal(starts,live?1:0);assert.equal(owner.liveWarmTimer,null);
  }
 });
 await test('Malformed deltas are rejected instead of drawing corrupt polygons',()=>{for(const ring of [[1,2,3],[0,0,1,0,0,1,NaN,0],[181e7,0,0,0,0,0,0,0]])assert.throws(()=>decodeRegionalTransport({encoding:'ohm-delta-1e7',features:[{deltaGeometry:{type:'Polygon',coordinates:[ring]}}]}));});
}finally{globalThis.fetch=originalFetch;}
console.log(`${checks.length} loading checks passed`);
