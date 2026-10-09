/** Actual HalcLandscape lifecycle fixtures. No copied lifecycle implementation. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
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
 addSource(id,definition){assert(!this.sources.has(id));this.writes.push(['addSource',id]);const source={...definition,ready:false,queued:false,handlers:new Set(),on(name,fn){if(name==='error')this.handlers.add(fn)},off(name,fn){if(name==='error')this.handlers.delete(fn)},loaded(){return this.ready&&!this.queued},serialize(){return {type:'geojson',data:this.data}},setData:data=>{source.data=data;source.ready=false;this.writes.push(['setData',id,typeof data==='string'?data:data.features.map(f=>f.id)])},error:()=>{source.ready=true;const event={sourceId:id,error:Error('source load failed')};for(const fn of [...source.handlers])fn(event);event.source={type:'geojson',data:source.data};if(this.sources.get(id)===source)this.emit('error',event)}};this.sources.set(id,source)}
 addLayer(layer,before){assert(!this.getLayer(layer.id));const at=before?this.layers.findIndex(x=>x.id===before):this.layers.length;assert(at>=0);this.layers.splice(at,0,structuredClone(layer));this.writes.push(['addLayer',layer.id,before])}
 moveLayer(id,before){const at=this.layers.findIndex(x=>x.id===id);assert(at>=0);const [layer]=this.layers.splice(at,1);const dest=before?this.layers.findIndex(x=>x.id===before):this.layers.length;assert(dest>=0);this.layers.splice(dest,0,layer);this.writes.push(['moveLayer',id,before])}
 setLayoutProperty(id,key,value){const layer=this.getLayer(id);assert(layer);(layer.layout??={})[key]=value;this.writes.push(['layout',id,key,value])}
 isSourceLoaded(id){return this.sources.get(id)?.loaded()===true}
 sourceReady(id=LANDSCAPE_SOURCE){assert(this.sources.has(id));this.sources.get(id).ready=true;this.emit('sourcedata',{sourceId:id,isSourceLoaded:true})}
 project(coordinate){const p=Array.isArray(coordinate)?coordinate:[coordinate.lng,coordinate.lat];return {x:p[0]*10,y:p[1]*10}}
 queryRenderedFeatures(point,options){this.queries.push({point,options});assert(!Array.isArray(point),'Coverage must query a projected point, not a bbox');return this.hits}
 order(){return this.layers.map(x=>x.id)}
}
const alive=new Set();
function fixture({transport:t=transport(),bounds=A,prepareWorker=()=>null}={}){
 const map=new MapFixture();map.bounds=[...bounds];let labels=0;
 const atlas={showBorders:true,destroyed:false,geography:{enabled:true,reference:false,lakes:{refreshLabels(){labels++}}}};
 const owner={mode:'halc',year:1500,modern:false,lang:'en',controls:new Node('div'),closePopup(){},popupAt(){}};
 const parent={owner,atlas,map,load:t.load,labels:{QUALITY:{1:{en:'Documentary evidence',zh:'文献资料'}}}};
 const layer=new HalcLandscape(parent,{prepareWorker});alive.add(layer);
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
function preparation(){const tasks=[],leases=[];return {tasks,leases,acquire(){let disposed=false;const lease={cancelCount:0,destroyCount:0,prepare(bounds){const gate=deferred();tasks.push({bounds,gate,lease});return gate.promise;},cancel(){this.cancelCount++;for(const task of tasks)if(task.lease===this)task.gate.reject(Object.assign(Error('cancelled'),{name:'AbortError'}));},destroy(){if(disposed)return;disposed=true;this.destroyCount++;this.cancel();}};leases.push(lease);return lease;}};}
const resultFor=(records=features)=>({records:records.map(({geometry,...record})=>record),dataURL:'data:application/geo+json;base64,'+Buffer.from(JSON.stringify({type:'FeatureCollection',features:records})).toString('base64'),metrics:{test:true}});
await test('Worker URL preserves exact source data and metadata, with source readiness gating visibility',async()=>{const p=preparation(),h=fixture({prepareWorker:()=>p.acquire()}),job=h.layer.update();p.tasks[0].gate.resolve(resultFor([features[0]]));await job;assert.equal(h.transport.calls.length,0);const source=h.map.getSource(LANDSCAPE_SOURCE);assert.match(source.data,/^data:application\/geo\+json;base64,/);assert.deepEqual(await(await fetch(source.data)).json(),{type:'FeatureCollection',features:[features[0]]});assert(!h.layer.active);assert.equal(h.layer.status,'rendering');h.map.sourceReady();assert(h.layer.active);assert.deepEqual(h.layer.features[0].properties,features[0].properties);assert.deepEqual(h.layer.preparationMetrics,{test:true});await fetch(source.data);});
await test('Superseded URL frames remain independently reloadable and settle only latest metadata',async()=>{const p=preparation(),h=fixture({prepareWorker:()=>p.acquire()});let job=h.layer.update();p.tasks.at(-1).gate.resolve(resultFor([features[0]]));await job;const first=h.map.getSource(LANDSCAPE_SOURCE).data;h.map.bounds=[...B];job=h.layer.update();p.tasks.at(-1).gate.resolve(resultFor([features[1]]));await job;const second=h.map.getSource(LANDSCAPE_SOURCE).data;h.map.sourceReady();assert.deepEqual(h.layer.features.map(f=>f.id),[2]);await fetch(first);await fetch(second);});
await test('Leaving year or destroying cancels preparation and prevents late source/style writes',async()=>{for(const destroy of [false,true]){const p=preparation(),h=fixture({prepareWorker:()=>p.acquire()}),job=h.layer.update();if(destroy)h.destroy();else{h.owner.year=1501;await h.layer.update();}p.tasks[0].gate.resolve(resultFor());await job;assert.equal(h.map.sources.size,0);assert(!h.layer.active);assert(p.leases[0].cancelCount);}});
await test('Worker availability failure falls back once to the existing data path; later views do not restart a broken worker',async()=>{const p=preparation(),h=fixture({prepareWorker:()=>p.acquire()}),job=h.layer.update();p.tasks[0].gate.reject(Object.assign(Error('worker unavailable'),{code:'landscape-worker-unavailable'}));await job;assert(h.transport.calls.length>0);assert.equal(h.layer.preparation,null);assert.equal(h.layer.prepareWorker,null);h.map.sourceReady();assert(h.layer.active);h.map.bounds=[...B];await h.layer.update();h.map.sourceReady();assert.deepEqual(h.layer.features.map(f=>f.id),[2]);assert.equal(p.leases.length,1);assert.equal(p.leases[0].destroyCount,1);});
await test('Ordinary worker data errors preserve the explicit-retry experience rather than silently retrying via the main thread',async()=>{const p=preparation(),h=fixture({prepareWorker:()=>p.acquire()}),job=h.layer.update();p.tasks[0].gate.reject(Error('Landscape load failed'));await job;assert(h.layer.failed);assert.equal(h.transport.calls.length,0);await h.layer.update();assert.equal(p.tasks.length,1);h.layer.retry();p.tasks[1].gate.resolve(resultFor([features[0]]));await tick();h.map.sourceReady();assert(h.layer.active);assert(!h.layer.failed);assert.equal(h.transport.calls.length,0);});
await test('A custom parent loader cannot be silently bypassed by the automatic Worker path',async()=>{const h=fixture(),priorWorker=globalThis.Worker;let created=0;h.layer.destroy();try{globalThis.Worker=class {constructor(){created++;throw Error('Unexpected Worker');}};const layer=new HalcLandscape(h.parent);alive.add(layer);await layer.update();assert.equal(created,0);assert(h.transport.calls.length>0);h.map.sourceReady();assert(layer.active);}finally{globalThis.Worker=priorWorker;}});
await test('Guide uses metadata fields only and displays original dates, quality, bibliography, remarks and overlap order',async()=>{const p=preparation(),h=fixture({prepareWorker:()=>p.acquire()}),sourceRows=[{...features[0],properties:{fid:1,LANDSCAPE:0,TIME_START:'1500-01-01',TIME_END:'1500-12-31',QUALITY:1,SOURCE:'17, 23',REMARKS:'原始备注 · original remark'}},{...features[1],properties:{fid:2,LANDSCAPE:7,TIME_START:null,TIME_END:null,QUALITY:null,SOURCE:null,REMARKS:null}}];let popup;h.owner.popupAt=node=>popup=node;const job=h.layer.update();p.tasks[0].gate.resolve(resultFor(sourceRows));await job;h.map.sourceReady();for(const record of h.layer.features)Object.defineProperty(record,'geometry',{get(){throw Error('Guide must not read geometry');}});h.map.hits=[{properties:{fid:2}},{id:1,properties:{fid:1}},{id:1,properties:{fid:1}}];h.layer.openGuide();const walk=node=>[node,...node.children.flatMap(walk)],text=walk(popup).map(n=>n.textContent??'').join('\n');for(const expected of ['1500-01-01 — 1500-12-31','Documentary evidence','17, 23','原始备注 · original remark','Included in the 1500 snapshot; record dates unfilled','Not recorded in this entry'])assert(text.includes(expected),expected);const summaries=walk(popup).filter(n=>n.tagName==='summary').map(n=>n.textContent);assert.deepEqual(summaries.slice(0,2),['Cultivatable land · 1','Fresh or coastal water · 2']);assert(h.layer.covers([4.5,50.5]));assert.equal(h.layer.hit({x:45,y:505}),h.map.hits[0]);assert.equal(h.map.queries.at(-1).options.layers[0],LANDSCAPE_SOURCE);});

await test('Current data URL source failure falls back once, rebuilds the source, and a repeated error stays explicit',async()=>{const p=preparation(),h=fixture({prepareWorker:()=>p.acquire()}),job=h.layer.update();p.tasks[0].gate.resolve(resultFor([features[0]]));await job;const old=h.map.getSource(LANDSCAPE_SOURCE);old.error();await waitFor(()=>h.layer.pending);const current=h.map.getSource(LANDSCAPE_SOURCE);assert.notEqual(old,current);assert.equal(old.handlers.size,0,'Removed source listeners must release the old URL even if fallback fails');assert.equal(typeof current.data,'object');assert.equal(h.layer.prepareWorker,null);assert.equal(p.leases[0].destroyCount,1);assert.equal(h.layer.fallbackReason,'data-url-source-error');assert(!h.layer.failed);old.error();assert(!h.layer.failed);current.error();assert(h.layer.failed);const calls=h.transport.calls.length;await h.layer.update();assert.equal(h.transport.calls.length,calls);assert.equal(p.leases.length,1);});
await test('A superseded viewport error or queued older source error cannot downgrade a new request',async()=>{const p=preparation(),h=fixture({prepareWorker:()=>p.acquire()});let job=h.layer.update();p.tasks[0].gate.resolve(resultFor([features[0]]));await job;const source=h.map.getSource(LANDSCAPE_SOURCE);h.map.bounds=[...B];job=h.layer.update();source.error();assert.equal(h.layer.prepareWorker!==null,true);assert(!h.layer.failed);p.tasks[1].gate.resolve(resultFor([features[1]]));await job;source.queued=true;source.error();assert.equal(h.layer.prepareWorker!==null,true);assert(!h.layer.failed);source.queued=false;h.map.sourceReady();assert.deepEqual(h.layer.features.map(f=>f.id),[2]);});
await test('Late source errors after date exit or destroy do not restart work or change status',async()=>{for(const destroy of [false,true]){const p=preparation(),h=fixture({prepareWorker:()=>p.acquire()}),job=h.layer.update();p.tasks[0].gate.resolve(resultFor());await job;const source=h.map.getSource(LANDSCAPE_SOURCE);if(destroy)h.destroy();else{h.owner.year=1501;await h.layer.update();}const calls=h.transport.calls.length,writes=h.map.writes.length;source.error();await tick();assert.equal(h.transport.calls.length,calls);assert.equal(h.map.writes.length,writes);assert(!h.layer.failed);assert(!h.layer.active);}});
await test('One map data URL fallback releases only its lease; the other map still prepares and renders',async()=>{const p=preparation(),a=fixture({prepareWorker:()=>p.acquire()}),b=fixture({prepareWorker:()=>p.acquire()});const aj=a.layer.update(),bj=b.layer.update();p.tasks[0].gate.resolve(resultFor([features[0]]));p.tasks[1].gate.resolve(resultFor([features[0]]));await Promise.all([aj,bj]);a.map.getSource(LANDSCAPE_SOURCE).error();await waitFor(()=>a.layer.pending);assert.equal(p.leases[0].destroyCount,1);assert.equal(p.leases[1].destroyCount,0);b.map.sourceReady();assert(b.layer.active);assert(!b.layer.failed);b.map.bounds=[...B];const job=b.layer.update();p.tasks.at(-1).gate.resolve(resultFor([features[1]]));await job;b.map.sourceReady();assert.deepEqual(b.layer.features.map(f=>f.id),[2]);a.map.sourceReady();assert(a.layer.active);});
globalThis.document=previousDocument;
const moduleAfter=await readFile(modulePath,'utf8');
const report={checkedAt:new Date().toISOString(),modulePath,moduleSha256:createHash('sha256').update(importedSource).digest('hex'),moduleStableDuringRun:importedSource===moduleAfter,runtime:'Actual HalcLandscape and LandscapeCache classes; fake DOM/map transport only. One retry test also uses actual readJSON over mocked fetch + real gzip decoding.',passed:results.filter(x=>x.passed).length,total:results.length,results};
const reportPath=resolve(process.argv[3]||resolve(root,'docs/verification-3.46/halc-landscape-lifecycle.json'));await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(`${report.passed}/${report.total}`);if(report.passed!==report.total)process.exitCode=1;
