// Exercise the production snapshot lifecycle with controlled network completion.
// Only the DOM/MapLibre boundary is stubbed; ensureOhm and setYear are unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {regionalTransportURL,decodeRegionalTransport} from '../public/regional-transport.js';
import {beginMapForeground} from '../public/map-load-priority.js';

const source=fs.readFileSync(new URL('../public/regional-boundaries.js',import.meta.url),'utf8');
const code=source.replace(/^import[^\n]*\n/gm,'').replace(/export /g,'')+'\nglobalThis.Subject=RegionalBoundaries;';
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function make(){
 const requests=[],evictions=[],writes=[];
 const ctx=vm.createContext({regionalTransportURL,decodeRegionalTransport,beginMapForeground,location:{protocol:'https:'},readJSON:url=>new Promise((resolve,reject)=>requests.push({url,resolve,reject})),forgetJSON:url=>evictions.push(url)});
 vm.runInContext(code,ctx);
 const s=Object.create(ctx.Subject.prototype);
 Object.assign(s,{year:1500,lang:'bi',atlas:{destroyed:false},ohmState:'idle',ohmKey:null,window:{id:'a',root:'a/',years:[1492,1500]},map:{getSource:()=>({setData:data=>writes.push(data)})},
  update(){if(!this.atlas.destroyed)this.ensureOhm();},addOhmLayers(){writes.push(this.ohmData);},applyFilters(){},visibility(){},settle(){},setStatus(){},refreshLabels(){},closePopup(){},clearLabels(){},setActive(){},removeOhmLayers(){writes.push('removed');}});
 Object.defineProperties(s,{eligible:{get(){return !this.atlas.destroyed;}},ohmWindow:{get(){return this.window;}}});
 return {s,requests,evictions,writes};
}
const data=id=>({type:'FeatureCollection',features:[{type:'Feature',properties:{osm_id:id},geometry:{type:'Polygon',coordinates:[]}}]});
let passed=0;
async function test(name,fn){await fn();console.log('PASS '+name);passed++;}
await test('Same view deduplicates its pending request',async()=>{const e=make();e.s.ensureOhm();e.s.ensureOhm();assert.equal(e.requests.length,1);e.requests[0].resolve(data(1));await flush();assert.equal(e.s.ohmState,'ready');e.s.ensureOhm();assert.equal(e.requests.length,1);});
for(const failure of [false,true])await test(`A previous window's late ${failure?'failure':'success'} cannot demote the current ready view`,async()=>{const e=make();e.s.ensureOhm();e.s.window={id:'b',root:'b/',years:[1500]};e.s.ensureOhm();assert.equal(e.requests.length,2);e.requests[1].resolve(data(2));await flush();assert.equal(e.s.ohmKey,'b|1500');failure?e.requests[0].reject(Error('offline')):e.requests[0].resolve(data(1));await flush();assert.equal(e.s.ohmState,'ready');assert.equal(e.s.ohmKey,'b|1500');assert.deepEqual(Array.from(e.s.ohmIds),[2]);assert.equal(e.writes.length,1);});
for(const failure of [false,true])await test(`Actual setYear invalidates a previous year's late ${failure?'failure':'success'}`,async()=>{const e=make();e.s.ensureOhm();e.s.setYear(1492,'bi');assert.equal(e.requests.length,2);e.requests[1].resolve(data(1492));await flush();failure?e.requests[0].reject(Error('offline')):e.requests[0].resolve(data(1500));await flush();assert.equal(e.s.ohmState,'ready');assert.equal(e.s.ohmKey,'a|1492');assert.deepEqual(Array.from(e.s.ohmIds),[1492]);});
await test('A moved viewport with no pending replacement starts the current window on completion',async()=>{const e=make();e.s.ensureOhm();e.s.window={id:'b',root:'b/',years:[1500]};e.requests[0].resolve(data(1));await flush();assert.equal(e.requests.length,2);assert.equal(e.requests[1].url,'b/year-1500.json.gz');assert.equal(e.writes.length,0);e.requests[1].resolve(data(2));await flush();assert.equal(e.s.ohmKey,'b|1500');});
await test('Malformed cached payload is evicted and can be retried',async()=>{const e=make();e.s.ensureOhm();e.requests[0].resolve({type:'FeatureCollection',features:null});await flush();assert.equal(e.s.ohmState,'failed');assert.deepEqual(e.evictions,['a/year-1500.json.gz']);assert.equal(e.writes.length,0);e.s.ensureOhm();e.requests[1].resolve(data(1));await flush();assert.equal(e.s.ohmState,'ready');});
await test('Network rejection can be retried without recreating the map',async()=>{const e=make();e.s.ensureOhm();e.requests[0].reject(Error('offline'));await flush();assert.equal(e.s.ohmState,'failed');e.s.ensureOhm();e.requests[1].resolve(data(1));await flush();assert.equal(e.s.ohmState,'ready');});
for(const failure of [false,true])await test(`Destroy rejects late ${failure?'failure':'success'} without rendering or starting another request`,async()=>{const e=make();e.s.ensureOhm();e.s.atlas.destroyed=true;failure?e.requests[0].reject(Error('offline')):e.requests[0].resolve(data(1));await flush();assert.equal(e.writes.length,0);assert.equal(e.requests.length,1);});
console.log(`${passed}/${passed} OHM asynchronous request checks passed`);
