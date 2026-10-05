import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createMapLibreLoader} from '../public/map-runtime.js';
let checks=0;const check=async(name,fn)=>{await fn();checks++;console.log(`PASS ${name}`);};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(options={}){
 const scripts=[],timers=new Map();let timerId=0;
 const globalObject={location:{href:'https://atlas.example/sub/index.html'}},doc={baseURI:globalObject.location.href,head:{append(node){scripts.push(node);}},createElement(tag){assert.equal(tag,'script');return {dataset:{},removed:false,remove(){this.removed=true;}};}};
 const load=createMapLibreLoader({document:doc,globalObject,assetURL:'https://atlas.example/sub/assets/maplibre-gl.js?v=test',setTimer:fn=>{const n=++timerId;timers.set(n,fn);return n;},clearTimer:n=>timers.delete(n),...options});
 return {load,globalObject,doc,scripts,timers};
}
await check('concurrent renderer requests share one promise and one same-origin script',async()=>{
 const f=fixture(),a=f.load(),b=f.load();assert.equal(a,b);assert.equal(f.scripts.length,1);assert.equal(f.scripts[0].async,true);assert.match(f.scripts[0].src,/sub\/assets\/maplibre-gl.js\?v=test$/);
 const library={Map:class{}};f.globalObject.maplibregl=library;f.scripts[0].onload();assert.equal(await a,library);assert.equal(await b,library);assert.equal(f.timers.size,0);
 assert.equal(await f.load(),library);assert.equal(f.scripts.length,1);
});
await check('an already available renderer performs no download',async()=>{
 const f=fixture(),library={Map:class{}};f.globalObject.maplibregl=library;assert.equal(await f.load(),library);assert.equal(f.scripts.length,0);
});
await check('network failure removes its script, clears timer and allows an explicit retry',async()=>{
 const f=fixture(),a=f.load(),rejection=assert.rejects(a,/could not load/);f.scripts[0].onerror();await rejection;assert(f.scripts[0].removed);assert.equal(f.timers.size,0);
 const b=f.load();assert.notEqual(a,b);assert.equal(f.scripts.length,2);f.globalObject.maplibregl={Map:class{}};f.scripts[1].onload();await b;
});
await check('a loaded script without a usable renderer is rejected and retryable',async()=>{
 const f=fixture(),a=f.load(),rejection=assert.rejects(a,/did not initialize/);f.scripts[0].onload();await rejection;assert(f.scripts[0].removed);const b=f.load();f.globalObject.maplibregl={Map:class{}};f.scripts[1].onload();await b;
});
await check('timeout permits a retry and a late old callback cannot settle it',async()=>{
 const f=fixture(),a=f.load(),late=f.scripts[0].onload,rejection=assert.rejects(a,/timed out/);[...f.timers.values()][0]();await rejection;
 let settled=false;const b=f.load().then(()=>settled=true);f.globalObject.maplibregl={Map:class{}};late();await tick();assert.equal(settled,false);f.scripts[1].onload();await b;assert.equal(settled,true);
});
await check('an optional ignored failed prefetch does not create an unhandled rejection',async()=>{
 const errors=[],listener=e=>errors.push(e);process.on('unhandledRejection',listener);
 try{const f=fixture();f.load();f.scripts[0].onerror();await tick();assert.equal(errors.length,0);}finally{process.off('unhandledRejection',listener);}
});
await check('foreign-origin script injection is rejected before DOM insertion',async()=>{
 const f=fixture({assetURL:'https://other.example/map.js'});await assert.rejects(f.load(),/same-origin/);assert.equal(f.scripts.length,0);
});
await check('DOM append failures are rejected, cleaned up and can retry',async()=>{
 const f=fixture(),append=f.doc.head.append;f.doc.head.append=()=>{throw Error('append blocked');};await assert.rejects(f.load(),/append blocked/);assert.equal(f.timers.size,0);f.doc.head.append=append;
 const a=f.load();f.globalObject.maplibregl={Map:class{}};f.scripts[0].onload();await a;
});
const startup=fs.readFileSync(new URL('../public/startup.js',import.meta.url),'utf8');
async function boot(hash,{fail=false}={}){
 // Only replace the ES-module transport boundary; execute the shipped route and URL logic.
 const marker='import(runtimeURL.href)';assert.equal(startup.split(marker).length,2);
 let imports=0,loads=0,url;const hints=[],elements=new Map(),element=id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);};
 const sandbox={URL,URLSearchParams,location:{href:'https://atlas.example/sub/index.html'+hash,hash},document:{currentScript:{src:'https://atlas.example/sub/startup.js?v=3.37-test'},getElementById:element,createElement:tag=>({tagName:tag}),head:{append:node=>hints.push(node)}},loadRuntimeForTest:async value=>{imports++;url=value;return {loadMapLibre:async()=>{loads++;if(fail)throw Error('offline');}};}};
 vm.runInNewContext(startup.replace(marker,'loadRuntimeForTest(runtimeURL.href)'),sandbox);await tick();return {imports,loads,url,elements,hints};
}
await check('research deep links do not even request the renderer loader',async()=>{
 for(const hash of ['#view=research','#view=research&lang=zh&seshat=CnMing%2A','#lang=en&view=research&year=1450']){const result=await boot(hash);assert.equal(result.imports,0);assert.equal(result.loads,0);assert.equal(result.hints.length,0);}
});
await check('default map route starts optional async renderer load with the stamped module URL',async()=>{
 const r=await boot('#year=1450');assert.equal(r.imports,1);assert.equal(r.loads,1);assert.equal(r.url,'https://atlas.example/sub/map-runtime.js?v=3.37-test');assert.equal(r.hints.length,1);assert.equal(r.hints[0].href,'https://atlas.example/sub/data/fast/catalog.json.gz');
 await boot('',{fail:true});
});
await check('HTML has no unconditional renderer preload or synchronous script',()=>{
 const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 assert(!/<link\b[^>]*href=["']assets\/maplibre-gl\.js/i.test(html));assert(!/<script\b[^>]*src=["']assets\/maplibre-gl\.js/i.test(html));
 assert(!/<link\b[^>]*rel=["']preload["'][^>]*href=["']data\/fast\/catalog\.json\.gz/.test(html));
 assert.match(html,/<script\b[^>]*src=["']startup\.js/);assert.match(html,/<script\b[^>]*type="module"[^>]*src=["']app\.js/);
});
console.log(JSON.stringify({ok:true,checks,method:'Injected DOM/network/time fixtures and startup transport-boundary fixture; no browser automation.'}));
