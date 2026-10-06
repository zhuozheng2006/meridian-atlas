// Current production configuration/loader, with browser signals and script transport fixtures.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=process.env.ATLAS_REPO||fileURLToPath(new URL('../',import.meta.url)),file=path.join(root,'public/map-runtime.js');
const {configureMapWorkers,createMapLibreLoader}=await import(pathToFileURL(file));
const out=process.env.MAP_WORKER_AUDIT_REPORT||path.join(root,'docs/verification-3.44/map-worker-configuration.json'),results=[];
function library(count=1){const log=[],lib={Map:class{constructor(){log.push(['Map',count]);}},getWorkerCount(){log.push(['get',count]);return count;},setWorkerCount(value){log.push(['set',value]);count=value;}};return {lib,log,count:()=>count};}
async function check(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL '+name+'\n'+error.stack);}}
for(const [name,navigator,expected] of [
 ['eligible desktop',{hardwareConcurrency:18,deviceMemory:8},2],
 ['four-core lower threshold',{hardwareConcurrency:4,deviceMemory:4},2],
 ['browser without device-memory signal',{hardwareConcurrency:8},2],
 ['two-core device',{hardwareConcurrency:2,deviceMemory:8},1],
 ['three-core device',{hardwareConcurrency:3,deviceMemory:8},1],
 ['low-memory four-core device',{hardwareConcurrency:4,deviceMemory:2},1],
 ['low-memory many-core device',{hardwareConcurrency:18,deviceMemory:0.5},1],
 ['no hardware information',{},1],
 ['non-finite hardware information',{hardwareConcurrency:Infinity,deviceMemory:8},1],
 ['invalid hardware information',{hardwareConcurrency:NaN,deviceMemory:8},1]
])await check('Worker policy preserves intended budget for '+name,()=>{const e=library();configureMapWorkers(e.lib,navigator);assert.equal(e.count(),expected);assert.equal(e.log.filter(x=>x[0]==='set').length,expected===2?1:0);});
await check('Defaults of two or more are never lowered',()=>{for(const count of [2,3,4,8]){const e=library(count);configureMapWorkers(e.lib,{hardwareConcurrency:18,deviceMemory:8});assert.equal(e.count(),count);assert.equal(e.log.filter(x=>x[0]==='set').length,0);}});
await check('One library is configured once across repeated loader and atlas callers',()=>{const e=library();for(let i=0;i<5;i++)configureMapWorkers(e.lib,{hardwareConcurrency:18,deviceMemory:8});assert.deepEqual(e.log,[['get',1],['set',2]]);});
await check('Different library instances remain independently configurable',()=>{const a=library(),b=library();configureMapWorkers(a.lib,{hardwareConcurrency:2});configureMapWorkers(b.lib,{hardwareConcurrency:8});assert.equal(a.count(),1);assert.equal(b.count(),2);});
await check('Libraries lacking optional worker APIs remain usable',()=>{for(const lib of [{Map:class{}},{Map:class{},getWorkerCount:()=>1},{Map:class{},setWorkerCount(){throw Error('must not set without getter');}}])assert.doesNotThrow(()=>configureMapWorkers(lib,{hardwareConcurrency:8}));});
function fixture(){const scripts=[],timers=new Map();let sequence=0;const globalObject={location:{href:'https://atlas.test/site/index.html'},navigator:{hardwareConcurrency:18,deviceMemory:8}},doc={head:{append:node=>scripts.push(node)},createElement:()=>({dataset:{},remove(){this.removed=true;}})};const load=createMapLibreLoader({document:doc,globalObject,assetURL:'https://atlas.test/site/assets/maplibre-gl.js',setTimer:fn=>{const id=++sequence;timers.set(id,fn);return id;},clearTimer:id=>timers.delete(id)});return {scripts,timers,globalObject,load};}
await check('Already available renderer is configured before the load promise gives it to a map constructor',async()=>{const f=fixture(),e=library();f.globalObject.maplibregl=e.lib;const ready=f.load();assert.equal(e.count(),2);new (await ready).Map();assert.deepEqual(e.log,[['get',1],['set',2],['Map',2]]);assert.equal(f.scripts.length,0);});
await check('Async script completion configures once before both concurrent map callers continue',async()=>{const f=fixture(),e=library(),a=f.load(),b=f.load();assert.equal(a,b);assert.equal(f.scripts.length,1);f.globalObject.maplibregl=e.lib;f.scripts[0].onload();new (await a).Map();new (await b).Map();assert.deepEqual(e.log,[['get',1],['set',2],['Map',2],['Map',2]]);assert.equal(f.timers.size,0);assert.equal(await f.load(),e.lib);assert.equal(e.log.filter(x=>x[0]==='set').length,1);});
await check('Low-memory async startup resolves normally without increasing its default pool',async()=>{const f=fixture(),e=library();f.globalObject.navigator.deviceMemory=2;const ready=f.load();f.globalObject.maplibregl=e.lib;f.scripts[0].onload();new (await ready).Map();assert.equal(e.count(),1);assert.deepEqual(e.log,[['Map',1]]);});
const report={generated:new Date().toISOString(),module:'public/map-runtime.js',sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex'),method:'Production configureMapWorkers and createMapLibreLoader with deterministic navigator/script fixtures; validates policy and before-construction sequencing, not actual WebWorker creation or browser speed.',total:results.length,passed:results.filter(x=>x.passed).length,results};fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,total:report.total}));if(report.passed!==report.total)process.exitCode=1;
