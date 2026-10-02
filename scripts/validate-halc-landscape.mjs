/** Actual HalcLandscape lifecycle fixtures. No copied lifecycle implementation. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {gzipSync} from 'node:zlib';
const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(process.argv[2]||resolve(here,'..'));
const modulePath=resolve(process.argv[4]||resolve(root,'public/halc-landscape.js'));
const importedSource=await readFile(modulePath,'utf8');
const {HalcLandscape,LANDSCAPE_SOURCE,LandscapeCache}=await import(pathToFileURL(modulePath));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const tick=()=>new Promise(r=>setImmediate(r));
async function waitFor(predicate){for(let i=0;i<200;i++){if(predicate())return;await new Promise(r=>setTimeout(r,5))}throw Error('Fixture condition did not settle within 1 second')}
const previousDocument=globalThis.document;
class Node {
 constructor(tag){this.tagName=tag;this.children=[];this.style={};this.attributes={};this.classList={add(){},remove(){}};this.hidden=false;this.removed=false;}
 append(...children){this.children.push(...children)}
 setAttribute(key,value){this.attributes[key]=value}
 remove(){this.removed=true}
}
globalThis.document={createElement:tag=>new Node(tag)};
const A=[4.2,50.2,4.8,50.8],B=[6.2,52.2,6.8,52.8];
const geometry=b=>({type:'Polygon',coordinates:[[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]],[b[0],b[1]]]]});
const feature=(id,b,code=0)=>({type:'Feature',id,properties:{fid:id,LANDSCAPE:code,QUALITY:1},geometry:geometry(b)});
const features=[feature(1,[4,50,5,51]),feature(2,[6,52,7,53],7)];
const index={schemaVersion:1,snapshotYear:1500,shards:[{file:'a.json.gz',bbox:[4,50,5,51],count:1,features:[{id:1,bbox:[4,50,5,51]}]},{file:'b.json.gz',bbox:[6,52,7,53],count:1,features:[{id:2,bbox:[6,52,7,53]}]}]};
const content=new Map([['index.json.gz',index],['a.json.gz',{type:'FeatureCollection',features:[features[0]]}],['b.json.gz',{type:'FeatureCollection',features:[features[1]]}]]);
function transport(){
 const calls=[],responses=new Map();
 const load=async path=>{calls.push(path);const file=path.split('/').at(-1),queue=responses.get(file),next=queue?.length?queue.shift():structuredClone(content.get(file));if(next instanceof Error)throw next;if(typeof next==='function')return await next();return await next};
 return {load,calls,queue(file,...values){responses.set(file,values)}};
}
const initialLayers=[{id:'ocean',type:'background'},{id:'land',source:'land'},
 {id:'halc-wash',source:'halc-boundaries'},{id:'halc-edges',source:'halc-boundaries'},
 {id:'halc-region-fill',source:'halc-regions'},{id:'boundary',source:'polities'},
 {id:'reference-ocean',source:'geographic-reference'},{id:'historical-streets',source:'historical-detail'},
 {id:'reference-water',source:'geographic-reference'},{id:'labels',source:'labels'}];
class MapFixture {
 constructor(){this.bounds=[...A];this.zoom=8;this.layers=structuredClone(initialLayers);this.sources=new Map();this.events=new Map();this.writes=[];this.queries=[];this.hits=[];}
 on(name,fn){if(!this.events.has(name))this.events.set(name,new Set());this.events.get(name).add(fn)}
 off(name,fn){this.events.get(name)?.delete(fn)}
 emit(name,data={}){for(const fn of [...(this.events.get(name)||[])])fn(data)}
 getBounds(){const b=this.bounds;return {getWest:()=>b[0],getSouth:()=>b[1],getEast:()=>b[2],getNorth:()=>b[3]}}
 getZoom(){return this.zoom}
 getCenter(){return {lng:(this.bounds[0]+this.bounds[2])/2,lat:(this.bounds[1]+this.bounds[3])/2}}
 getStyle(){return {layers:structuredClone(this.layers)}}
 getLayer(id){return this.layers.find(x=>x.id===id)}
 getSource(id){return this.sources.get(id)}
 removeSource(id){assert(this.sources.has(id));this.sources.delete(id);this.writes.push(['removeSource',id])}
 removeLayer(id){const at=this.layers.findIndex(x=>x.id===id);assert(at>=0);this.layers.splice(at,1);this.writes.push(['removeLayer',id])}
 addSource(id,definition){assert(!this.sources.has(id));this.writes.push(['addSource',id]);this.sources.set(id,{...definition,loaded:false,setData:data=>{const source=this.sources.get(id);source.data=data;source.loaded=false;this.writes.push(['setData',id,data.features.map(f=>f.id)])}})}
 addLayer(layer,before){assert(!this.getLayer(layer.id));const at=before?this.layers.findIndex(x=>x.id===before):this.layers.length;assert(at>=0);this.layers.splice(at,0,structuredClone(layer));this.writes.push(['addLayer',layer.id,before])}
 moveLayer(id,before){const at=this.layers.findIndex(x=>x.id===id);assert(at>=0);const [layer]=this.layers.splice(at,1);const dest=before?this.layers.findIndex(x=>x.id===before):this.layers.length;assert(dest>=0);this.layers.splice(dest,0,layer);this.writes.push(['moveLayer',id,before])}
 setLayoutProperty(id,key,value){const layer=this.getLayer(id);assert(layer);(layer.layout??={})[key]=value;this.writes.push(['layout',id,key,value])}
 isSourceLoaded(id){return this.sources.get(id)?.loaded===true}
 sourceReady(id=LANDSCAPE_SOURCE){assert(this.sources.has(id));this.sources.get(id).loaded=true;this.emit('sourcedata',{sourceId:id,isSourceLoaded:true})}
 project(coordinate){const p=Array.isArray(coordinate)?coordinate:[coordinate.lng,coordinate.lat];return {x:p[0]*10,y:p[1]*10}}
 queryRenderedFeatures(point,options){this.queries.push({point,options});assert(!Array.isArray(point),'Coverage must query a projected point, not a bbox');return this.hits}
 order(){return this.layers.map(x=>x.id)}
}
const alive=new Set();
function fixture({transport:t=transport(),bounds=A}={}){
 const map=new MapFixture();map.bounds=[...bounds];let labels=0;
 const atlas={showBorders:true,destroyed:false,geography:{enabled:true,reference:false,lakes:{refreshLabels(){labels++}}}};
 const owner={mode:'halc',year:1500,modern:false,lang:'en',controls:new Node('div'),closePopup(){},popupAt(){}};
 const parent={owner,atlas,map,load:t.load,labels:{QUALITY:{1:{en:'Documentary evidence',zh:'文献资料'}}}};
 const layer=new HalcLandscape(parent);alive.add(layer);
 const ready=async()=>{await layer.update();map.sourceReady();assert(layer.active);return layer};
 return {map,atlas,owner,parent,layer,transport:t,ready,labelRefreshes:()=>labels,destroy(){layer.destroy();alive.delete(layer)}};
}
const results=[];
async function test(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS '+name)}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL '+name+': '+error.message)}finally{for(const layer of alive)layer.destroy();alive.clear()}}
await test('Every ineligible date/mode/modern/terrain/borders/zoom/view/destroyed context does zero network or source writes',async()=>{
 const cases=[h=>h.owner.year=1499,h=>h.owner.year=1501,h=>h.owner.year=-1500,h=>h.owner.mode='auto',h=>h.owner.mode='regional',h=>h.owner.modern=true,h=>h.atlas.geography.reference=true,h=>h.atlas.geography.enabled=false,h=>h.atlas.showBorders=false,h=>h.map.zoom=5.99,h=>h.map.bounds=[100,20,110,30],h=>h.atlas.destroyed=true];
 for(const configure of cases){const h=fixture();configure(h);await h.layer.update();h.map.emit('idle');assert.equal(h.transport.calls.length,0);assert.equal(h.map.writes.length,0);assert(!h.layer.active);h.destroy()}
});
await test('Source readiness gates first visibility and settled features',async()=>{
 const h=fixture();await h.layer.update();assert.equal(h.layer.status,'rendering');assert(!h.layer.active);assert.deepEqual(h.layer.features,[]);assert.equal(h.map.getLayer(LANDSCAPE_SOURCE).layout.visibility,'none');
 h.map.emit('idle');h.map.emit('sourcedata',{sourceId:'unrelated',isSourceLoaded:true});assert(!h.layer.active);
 h.map.sourceReady();assert(h.layer.active);assert.equal(h.layer.status,'ready');assert.equal(h.map.getLayer(LANDSCAPE_SOURCE).layout.visibility,'visible');assert.deepEqual(h.layer.features.map(f=>f.id),[1]);
});
await test('Same context retains the rendered frame while a new viewport loads and renders',async()=>{
 const h=fixture();await h.ready();const gate=deferred();h.transport.queue('b.json.gz',gate.promise);h.map.bounds=[...B];const pending=h.layer.update();await tick();
 assert(h.layer.active);assert.equal(h.layer.status,'updating');assert.deepEqual(h.layer.features.map(f=>f.id),[1]);assert.equal(h.map.getLayer(LANDSCAPE_SOURCE).layout.visibility,'visible');
 gate.resolve(structuredClone(content.get('b.json.gz')));await pending;assert.deepEqual(h.layer.features.map(f=>f.id),[1]);h.map.sourceReady();assert.deepEqual(h.layer.features.map(f=>f.id),[2]);
});
await test('Closing/changing date during late shard data prevents all late source/style writes',async()=>{
 const h=fixture(),gate=deferred();h.transport.queue('a.json.gz',gate.promise);const pending=h.layer.update();await tick();h.owner.year=1501;await h.layer.update();const writes=h.map.writes.length;
 gate.resolve(structuredClone(content.get('a.json.gz')));await pending;h.map.emit('idle');assert.equal(h.map.writes.length,writes);assert(!h.layer.active);assert.deepEqual(h.layer.features,[]);assert.equal(h.layer.status,'off');
});
await test('An old viewport request cannot replace a newer settled frame',async()=>{
 const h=fixture(),gate=deferred();h.transport.queue('a.json.gz',gate.promise);const old=h.layer.update();await tick();h.map.bounds=[...B];await h.layer.update();h.map.sourceReady();assert.deepEqual(h.layer.features.map(f=>f.id),[2]);const writes=h.map.writes.length;
 gate.resolve(structuredClone(content.get('a.json.gz')));await old;h.map.emit('idle');assert.equal(h.map.writes.length,writes);assert.deepEqual(h.layer.features.map(f=>f.id),[2]);
});
await test('A network-rejected shard is evicted and explicit retry can load it',async()=>{
 const h=fixture();h.transport.queue('a.json.gz',Error('Transient network failure'));await h.layer.update();assert(h.layer.failed);assert.equal(h.layer.status,'error');assert(!h.layer.active);const calls=h.transport.calls.length;
 await h.layer.update();assert.equal(h.transport.calls.length,calls);h.layer.retry();await tick();h.map.sourceReady();assert(h.layer.active);assert(!h.layer.failed);assert.equal(h.transport.calls.filter(x=>x.endsWith('/a.json.gz')).length,2);
});
await test('A semantically invalid cached shard is evicted for explicit retry',async()=>{
 const h=fixture();h.transport.queue('a.json.gz',{type:'FeatureCollection',features:[]});await h.layer.update();assert(h.layer.failed);h.layer.retry();await tick();
 assert(h.map.getSource(LANDSCAPE_SOURCE),'Retry reused an invalid cached response instead of loading corrected data');h.map.sourceReady();assert(h.layer.active);assert.equal(h.transport.calls.filter(x=>x.endsWith('/a.json.gz')).length,2);
});
await test('A semantically invalid cached index is evicted for explicit retry',async()=>{
 const h=fixture();h.transport.queue('index.json.gz',{...index,snapshotYear:1499});await h.layer.update();assert(h.layer.failed);h.layer.retry();await tick();
 assert(h.map.getSource(LANDSCAPE_SOURCE),'Retry reused an invalid cached index');h.map.sourceReady();assert(h.layer.active);assert.equal(h.transport.calls.filter(x=>x.endsWith('/index.json.gz')).length,2);
});
await test('Separate maps may share immutable requests while rendering readiness remains independent',async()=>{
 const shared=transport(),a=fixture({transport:shared}),b=fixture({transport:shared});await Promise.all([a.layer.update(),b.layer.update()]);assert.equal(shared.calls.filter(x=>x.endsWith('/index.json.gz')).length,1);assert.equal(shared.calls.filter(x=>x.endsWith('/a.json.gz')).length,1);
 a.map.sourceReady();assert(a.layer.active);assert(!b.layer.active);b.map.sourceReady();assert(b.layer.active);a.destroy();b.map.bounds=[...B];await b.layer.update();b.map.sourceReady();assert.deepEqual(b.layer.features.map(f=>f.id),[2]);
});
await test('A failure in one map/source does not poison another map with the same loader',async()=>{
 const shared=transport(),a=fixture({transport:shared}),b=fixture({transport:shared});await Promise.all([a.ready(),b.ready()]);a.map.emit('error',{sourceId:LANDSCAPE_SOURCE,error:Error('GPU source error')});assert(a.layer.failed);assert(!a.layer.active);assert(b.layer.active);assert(!b.layer.failed);assert.equal(b.map.getLayer(LANDSCAPE_SOURCE).layout.visibility,'visible');
});
await test('A GPU/source error is recoverable by recreating the source on explicit retry',async()=>{
 const h=fixture();await h.ready();const oldSource=h.map.getSource(LANDSCAPE_SOURCE);h.map.emit('error',{sourceId:LANDSCAPE_SOURCE,error:Error('Worker failed')});assert(h.layer.failed);assert.equal(h.map.getLayer(LANDSCAPE_SOURCE).layout.visibility,'none');
 h.layer.retry();await tick();assert.notEqual(h.map.getSource(LANDSCAPE_SOURCE),oldSource);assert(!h.layer.active);h.map.sourceReady();assert(h.layer.active);assert.equal(h.layer.status,'ready');
});
await test('Semantic retry also evicts the actual readJSON parsed-response cache',async()=>{
 const specifier=/import\s*\{forgetJSON\}\s*from\s*['"]([^'"]+)['"]/.exec(importedSource)?.[1];assert(specifier,'The actual readJSON eviction route must be inspectable');
 const engine=await import(new URL(specifier,pathToFileURL(modulePath))),priorFetch=globalThis.fetch,calls=[];let corrupt=true;
 for(const file of content.keys())engine.forgetJSON('data/halc-landscape/'+file);
 globalThis.fetch=async url=>{calls.push(String(url));const file=String(url).split('/').at(-1),data=file==='a.json.gz'&&corrupt?{type:'FeatureCollection',features:[]}:content.get(file);return new Response(gzipSync(JSON.stringify(data)),{status:200})};
 try{const h=fixture({transport:{load:engine.readJSON,calls}});await h.layer.update();assert(h.layer.failed);corrupt=false;h.layer.retry();await waitFor(()=>h.layer.pending||h.layer.failed);assert(h.map.getSource(LANDSCAPE_SOURCE));h.map.sourceReady();assert(h.layer.active);assert.equal(calls.filter(x=>x.endsWith('/a.json.gz')).length,2);h.destroy()}
 finally{globalThis.fetch=priorFetch;for(const file of content.keys())engine.forgetJSON('data/halc-landscape/'+file)}
});
await test('Different loaders never share cached content',async()=>{
 const a=fixture(),t=transport();t.queue('a.json.gz',{type:'FeatureCollection',features:[{...features[0],properties:{...features[0].properties,LANDSCAPE:3}}]});const b=fixture({transport:t});await Promise.all([a.ready(),b.ready()]);assert.equal(a.layer.features[0].properties.LANDSCAPE,0);assert.equal(b.layer.features[0].properties.LANDSCAPE,3);assert.notEqual(a.layer.cache,b.layer.cache);
});
await test('Coverage tests the actual rendered point and does not assume the archive bbox is filled',async()=>{
 const h=fixture();await h.ready();h.map.hits=[];assert.equal(h.layer.covers([4.5,50.5]),false);h.map.hits=[features[0]];assert.equal(h.layer.covers([4.5,50.5]),true);
 assert.deepEqual(h.map.queries.at(-1),{point:{x:45,y:505},options:{layers:[LANDSCAPE_SOURCE]}});h.atlas.geography.reference=true;const calls=h.map.queries.length;assert.equal(h.layer.covers([4.5,50.5]),false);assert.equal(h.map.queries.length,calls);
});
await test('Turning terrain/borders/modern/mode/date off immediately hides and restores original layer order',async()=>{
 for(const change of [h=>h.atlas.geography.enabled=false,h=>h.atlas.showBorders=false,h=>h.owner.modern=true,h=>h.owner.mode='auto',h=>h.owner.year=1501]){
  const h=fixture(),base=h.map.order();await h.ready();const order=h.map.order();for(const id of ['halc-wash','halc-edges','halc-region-fill','historical-streets'])assert(order.indexOf(id)>order.indexOf(LANDSCAPE_SOURCE));
  change(h);await h.layer.update();assert(!h.layer.active);assert.equal(h.map.getLayer(LANDSCAPE_SOURCE).layout.visibility,'none');assert.deepEqual(h.map.order().filter(x=>x!==LANDSCAPE_SOURCE),base);h.destroy();
 }
});
await test('Late reference insertion reconciles once, is idempotent, and remains ordered after exit',async()=>{
 const h=fixture();await h.ready();h.map.addLayer({id:'late-reference-water',source:'geographic-reference'},'reference-water');h.layer.reconcileOrder();const expected=h.map.order();const writes=h.map.writes.length;
 h.layer.reconcileOrder();h.layer.reconcileOrder();assert.equal(h.map.writes.length,writes);assert.deepEqual(h.map.order(),expected);assert(expected.indexOf('late-reference-water')<expected.indexOf(LANDSCAPE_SOURCE));
 h.owner.mode='auto';await h.layer.update();const restore=[...initialLayers.map(x=>x.id)];restore.splice(restore.indexOf('reference-water'),0,'late-reference-water');assert.deepEqual(h.map.order().filter(x=>x!==LANDSCAPE_SOURCE),restore);
});
await test('Repeated unchanged updates and idle produce no network or map style writes',async()=>{
 const h=fixture();await h.ready();const calls=h.transport.calls.length,writes=h.map.writes.length;for(let i=0;i<5;i++){await h.layer.update();h.map.emit('idle')}assert.equal(h.transport.calls.length,calls);assert.equal(h.map.writes.length,writes);
});
await test('Destroy removes listeners and late data/retry/idle cannot write to the map',async()=>{
 const h=fixture(),gate=deferred();h.transport.queue('a.json.gz',gate.promise);const pending=h.layer.update();await tick();h.destroy();const writes=h.map.writes.length,calls=h.transport.calls.length;gate.resolve(structuredClone(content.get('a.json.gz')));await pending;
 h.map.emit('idle');h.map.emit('error',{sourceId:LANDSCAPE_SOURCE});await h.layer.update();h.layer.retry();await tick();assert.equal(h.map.writes.length,writes);assert.equal(h.transport.calls.length,calls);assert(!h.layer.active);assert(h.layer.button.removed);assert([...h.map.events.values()].every(set=>set.size===0));
});
await test('Destroy after a rendered frame makes later retry and reconciliation strict no-ops',async()=>{
 const h=fixture();await h.ready();h.destroy();const writes=h.map.writes.length,calls=h.transport.calls.length;h.layer.retry();await h.layer.update();h.layer.reconcileOrder();h.map.emit('idle');await tick();
 assert.equal(h.map.writes.length,writes,'A destroyed layer still changed map source/style state');assert.equal(h.transport.calls.length,calls);assert(!h.layer.active);
});
globalThis.document=previousDocument;
const moduleAfter=await readFile(modulePath,'utf8');
const report={checkedAt:new Date().toISOString(),modulePath,moduleSha256:createHash('sha256').update(importedSource).digest('hex'),moduleStableDuringRun:importedSource===moduleAfter,runtime:'Actual HalcLandscape and LandscapeCache classes; fake DOM/map transport only. One retry test also uses actual readJSON over mocked fetch + real gzip decoding.',passed:results.filter(x=>x.passed).length,total:results.length,results};
if(process.argv[3])await writeFile(resolve(process.argv[3]),JSON.stringify(report,null,2)+'\n');
console.log(`${report.passed}/${report.total}`);if(report.passed!==report.total)process.exitCode=1;
