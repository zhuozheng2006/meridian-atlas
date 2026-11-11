import assert from 'node:assert/strict';
import {BoundaryController} from '../public/boundary-controller.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const empty={type:'FeatureCollection',features:[]};
const geometry={type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]};
const country=year=>({date:year+'-07-01',records:[{id:'state-'+year,name:'State',geometryId:'g'}],geometries:{g:geometry}});
function fixture({mode='auto',year=1900}={}){
 const gate=deferred(),calls={loads:0,frames:[],updates:0};
 const atlas={year,request:1,destroyed:false,geometryKey:'',map:{setPaintProperty(){},getContainer:()=>({dispatchEvent(){}})},regional:{update(){calls.updates++}},displayTerritories(data){calls.frames.push(data)},refreshLabels(){}};
 const c=new BoundaryController(atlas,{mode,color:()=> '#123456',loadCountry:()=>{calls.loads++;return gate.promise}});atlas.boundaries=c;
 const initial={requested:mode,source:'cliopatria',year,key:'overview',reason:null,records:[],data:empty};
 return {atlas,c,gate,calls,initial};
}
let passed=0;const test=async(name,fn)=>{await fn();console.log('PASS '+name);passed++};
await test('Overview is usable immediately; exact dated country frame upgrades later',async()=>{
 const f=fixture();f.c.commit(f.initial);const pending=f.c.automaticUpgrade;
 assert.equal(f.c.current,f.initial);assert.equal(f.calls.frames.length,1);assert.equal(f.c.loading,false);
 const data=country(1900);f.gate.resolve(data);assert.equal(await pending,true);assert(f.c.isCountry);assert.equal(f.c.mode,'auto');assert.equal(f.c.current.data.features[0].geometry,geometry);assert.equal(f.calls.updates,1);
});
for(const mutation of ['year','request','mode','destroy','replacement'])await test('Late country result cannot overwrite '+mutation,async()=>{
 const f=fixture();f.c.commit(f.initial);const pending=f.c.automaticUpgrade;
 if(mutation==='year')f.atlas.year=1800;if(mutation==='request')f.atlas.request++;if(mutation==='mode')f.c.mode='overview';if(mutation==='destroy'){f.atlas.destroyed=true;f.c.destroy()}
 if(mutation==='replacement'){f.c.mode='overview';f.c.commit({...f.initial,key:'replacement'})}
 f.gate.resolve(country(1900));assert.equal(await pending,false);assert(!f.c.isCountry);
});
await test('Network failure retains the usable overview',async()=>{const f=fixture();f.c.commit(f.initial);const p=f.c.automaticUpgrade;f.gate.reject(Error('offline'));assert.equal(await p,false);assert.equal(f.c.current,f.initial);assert.equal(f.calls.frames.length,1)});
for(const options of [{mode:'overview'},{mode:'regional'},{mode:'halc'},{mode:'cshapes'},{year:1885},{year:2024}])await test('No unsolicited country fetch '+JSON.stringify(options),async()=>{const f=fixture(options);f.c.commit(f.initial);assert.equal(await f.c.automaticUpgrade,false);assert.equal(f.calls.loads,0)});
await test('Two maps upgrade independently',async()=>{const a=fixture(),b=fixture({year:1950});a.c.commit(a.initial);b.c.commit(b.initial);const pa=a.c.automaticUpgrade,pb=b.c.automaticUpgrade;a.c.destroy();a.gate.resolve(country(1900));b.gate.resolve(country(1950));assert.equal(await pa,false);assert.equal(await pb,true);assert.equal(b.c.current.year,1950)});
await test('Cold preparation starts both sources; country can win while overview is blocked',async()=>{
 const f=fixture(),overview=deferred();let keep,overviewStarted=false;
 const p=f.c.prepare(1900,allowed=>{keep=allowed;overviewStarted=true;return overview.promise});await Promise.resolve();
 assert(overviewStarted);assert.equal(f.calls.loads,1);f.gate.resolve(country(1900));const result=await p;
 assert.equal(result.source,'cshapes');assert.equal(keep(),false);f.c.commit(result);assert.equal(f.calls.frames.length,1);overview.resolve(null);
});
await test('Fast overview commits immediately and reuses the already running country request',async()=>{
 const f=fixture();const first=await f.c.prepare(1900,async()=>f.initial);assert.equal(first.source,'cliopatria');f.c.commit(first);const p=f.c.automaticUpgrade;
 assert.equal(f.calls.loads,1);f.gate.resolve(country(1900));assert.equal(await p,true);assert.equal(f.calls.loads,1);assert.equal(f.calls.frames.length,2);
});
await test('Country succeeds despite a rejected overview',async()=>{const f=fixture(),p=f.c.prepare(1900,async()=>{throw Error('overview offline')});f.gate.resolve(country(1900));assert.equal((await p).source,'cshapes')});
await test('Country rejection leaves the first available overview usable without immediate retry',async()=>{const f=fixture();f.gate.reject(Error('offline'));const first=await f.c.prepare(1900,async()=>f.initial);f.c.commit(first);assert.equal(await f.c.automaticUpgrade,false);assert.equal(f.c.current,first);assert.equal(f.calls.loads,1)});
await test('Both sources failing is an explicit failure, with no invented empty frame',async()=>{const f=fixture();f.gate.reject(Error('country offline'));await assert.rejects(f.c.prepare(1900,async()=>{throw Error('overview offline')}),AggregateError);assert.equal(f.calls.frames.length,0)});
await test('Exact cached country frame skips overview and country downloads entirely',async()=>{const f=fixture();f.c.peekCountry=year=>country(year);const first=await f.c.prepare(1951,()=>assert.fail('Warm frame must not load overview'));assert.equal(first.frame.date,'1951-07-01');assert.equal(first.year,1951);assert.equal(f.calls.loads,0)});
await test('An early country request still cannot overwrite a newer year after overview wins',async()=>{const f=fixture();const first=await f.c.prepare(1900,async()=>f.initial);f.c.commit(first);const p=f.c.automaticUpgrade;f.atlas.year=1800;f.atlas.request++;f.gate.resolve(country(1900));assert.equal(await p,false);assert.equal(f.calls.frames.length,1)});
console.log(`${passed} automatic boundary checks passed`);
