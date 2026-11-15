import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import vm from 'node:vm';

const appSource=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const engineSource=await readFile(new URL('../public/map-engine.js',import.meta.url),'utf8');
function extract(name){
 const start=new RegExp('^(?:async )?function '+name+'\\(','m').exec(appSource)?.index;assert.notEqual(start,undefined,name);
 const next=/^(?:(?:async )?function |const |let |export |class )/m.exec(appSource.slice(start+1));
 return appSource.slice(start,next?start+1+next.index:appSource.length);
}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<25;i++)await Promise.resolve();};
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function environment(){
 const maps=[],marks=[],calls=[],nodes=new Map();let catalogRequest=deferred(),rendererRequest=deferred();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',disabled:true,hidden:false});return nodes.get(id);};
 const c={Promise,console,
  state:{view:'atlas',year:1492,lang:'bi',boundaryMode:'auto',borders:true,reference:false,projection:'globe',streets:true,borderCurves:true,events:true,labels:true,terrain:true,coast:true,search:''},
  catalog:undefined,catalogDataPromise:null,atlas:null,atlasReady:false,atlasBootPromise:null,savedCamera:null,restoringView:false,applyingBoundaryComparison:false,
  window:{__meridian:{instances:[]}},location:{reload(){}},performance:{mark:name=>marks.push(name)},$:node,
  readJSON:path=>{calls.push(['read',path]);return path.includes('catalog')?catalogRequest.promise:Promise.resolve([]);},
  loadMapLibre:()=>{calls.push(['renderer']);return rendererRequest.promise;},ensureEventsData:async()=>{},prefetchNativeFrame:async()=>{},
  text:(zh,en)=>en,openPolity(){},boundarySelection(){},cancelBoundaryComparison(){},closeDetail(){},renderLayerLabels(){},saveURL(){},mapError(){},
  setMapControlsReady:value=>calls.push(['controls',value]),renderBrowse(){},renderEvents(){},registerTools(){},exportMapImage(){},
  applyYear:async year=>{calls.push(['year',year]);c.atlas.year=year;return true;}
 };
 c.AtlasMap=class{
  constructor(container,options){this.options=options;this.load=deferred();this.ready=this.load.promise;this.year=options.year;this.map={on(){}};maps.push(this);c.window.__meridian.instances.push(this);calls.push(['constructed']);}
  startGeography(){assert(!this.destroyed);calls.push(['geography']);this.geography={toggle(){},alignCoast(){},setReference(){}};}
  toggleBorders(){}projection(){}
  destroy(){if(this.destroyed)return;this.destroyed=true;calls.push(['destroyed']);this.load.reject(Error('Map initialization cancelled'));}
 };
 vm.createContext(c);vm.runInContext(extract('ensureCatalogData')+'\n'+extract('ensureAtlas'),c);
 return {c,maps,marks,calls,nodes,get catalog(){return catalogRequest;},get renderer(){return rendererRequest;},replaceCatalog(){return catalogRequest=deferred();},replaceRenderer(){return rendererRequest=deferred();}};
}
async function complete(h,p){h.renderer.resolve({});h.catalog.resolve({records:[]});await flush();h.maps.at(-1).load.resolve();return p;}
function engineEnvironment({failController=false}={}){
 const timers=new Map(),calls=[],maps=[];let timerId=0;
 class MapView{
  constructor(options){this.options=options;this.layers=options.style.layers.map(layer=>({...layer}));this.onceEvents=new Map();maps.push(this);}
  once(name,fn){this.onceEvents.set(name,fn);}on(){}addControl(){}
  getCanvas(){return {setAttribute(){},addEventListener(){}};}
  getContainer(){return {querySelector:()=>null};}
  getStyle(){return {layers:this.layers};}getLayer(id){return this.layers.find(layer=>layer.id===id);}
  addLayer(layer,before){const at=this.layers.findIndex(l=>l.id===before);assert(at>=0);this.layers.splice(at,0,layer);}
  moveLayer(id,before){const at=this.layers.findIndex(l=>l.id===id);assert(at>=0);const [layer]=this.layers.splice(at,1);const target=this.layers.findIndex(l=>l.id===before);assert(target>=0);this.layers.splice(target,0,layer);}
  emitLoad(){this.onceEvents.get('load')?.();}
  remove(){calls.push('remove');}
 }
 class Geography{constructor(atlas){this.map=atlas.map;calls.push('geography-created');}async init(){calls.push('geography-started');this.map.addLayer({id:'physical-rivers',source:'physical-rivers'},'boundary');this.map.addLayer({id:'physical-lakes',source:'physical-lakes'},'boundary');}destroy(){calls.push('geography-destroyed');}}
 class Controller{constructor(){if(failController)throw Error('controller failed');}destroy(){}}
 class Regional{constructor(atlas){this.halc={landscape:{reconcileOrder(){calls.push('layer-order');}}};atlas.map.addLayer({id:'regional-edges',source:'regional-boundaries'},'boundary');atlas.map.addLayer({id:'ohm-frozen-edges',source:'ohm-frozen'},'boundary');}destroy(){}}
 class Historical{constructor(atlas){atlas.map.addLayer({id:'historical-roads',source:'historical-detail'},'boundary');}destroy(){}}
 const c={console,Promise,URL,Map,Set,WeakMap,document:{getElementById:()=>({clientWidth:1200,clientHeight:800})},window:{},
  setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),
  maplibregl:{Map:MapView,NavigationControl:class{},AttributionControl:class{}},
  territoryOpacity:1,boundaryPaint:()=>({}),boundaryHaloPaint:()=>({}),Geography,BoundaryController:Controller,RegionalBoundaries:Regional,HistoricalDetailLayer:Historical
 };
 vm.createContext(c);vm.runInContext(engineSource.replace(/^import[^\n]*\n/gm,'').replace(/^export \{[^\n]*\};?\s*$/gm,'').replace(/\bexport /g,'')+'\nglobalThis.ActualAtlasMap=AtlasMap;',c);
 return {c,timers,calls,maps};
}

const cases=[],unhandled=[];const onUnhandled=reason=>unhandled.push(String(reason));process.on('unhandledRejection',onUnhandled);
async function test(name,run){try{await run();cases.push({name,pass:true});console.log('PASS '+name);}catch(error){cases.push({name,pass:false,error:String(error.stack||error)});console.error('FAIL '+name+'\n'+error.stack);}}

await test('Renderer opens the base before the catalog; geography and the catalog-backed year commit wait for both',async()=>{
 const h=environment(),p=h.c.ensureAtlas();h.renderer.resolve({});await flush();assert.equal(h.maps.length,1);assert.equal(h.maps[0].options.deferGeography,true);assert.equal(h.c.atlasReady,false);
 h.maps[0].load.resolve();await flush();assert(h.marks.includes('meridian:basemap-ready'));assert(!h.calls.some(([key])=>key==='geography'||key==='year'));
 h.catalog.resolve({records:[]});await p;assert.equal(h.c.atlasReady,true);assert.equal(h.calls.filter(([key])=>key==='geography').length,1);assert.equal(h.calls.filter(([key])=>key==='year').length,1);
 assert(h.marks.indexOf('meridian:basemap-ready')<h.marks.indexOf('meridian:map-interactive'));
});
await test('A fast catalog never bypasses renderer or base readiness',async()=>{
 const h=environment(),p=h.c.ensureAtlas();h.catalog.resolve({records:[]});await flush();assert.equal(h.maps.length,0);h.renderer.resolve({});await flush();assert.equal(h.maps.length,1);assert(!h.calls.some(([key])=>key==='geography'));h.maps[0].load.resolve();await p;assert(h.c.atlasReady);
});
await test('Concurrent callers share one startup and later callers reuse the same map',async()=>{
 const h=environment(),a=h.c.ensureAtlas(),b=h.c.ensureAtlas();assert.equal(a,b);await complete(h,a);assert.equal(await h.c.ensureAtlas(),h.maps[0]);assert.equal(h.maps.length,1);assert.equal(h.calls.filter(([key])=>key==='renderer').length,1);
});
await test('Catalog rejection is immediately observed; its late renderer cannot resurrect a failed attempt',async()=>{
 const h=environment(),p=assert.rejects(h.c.ensureAtlas(),/catalog failed/);h.catalog.reject(Error('catalog failed'));await p;assert.equal(h.c.atlasBootPromise,null);assert.equal(h.c.catalogDataPromise,null);h.renderer.resolve({});await turn();assert.equal(h.maps.length,0);assert.equal(h.c.atlas,null);
});
await test('Catalog failure destroys an already constructed pending base and permits retry',async()=>{
 const h=environment(),p=assert.rejects(h.c.ensureAtlas(),/catalog failed/);h.renderer.resolve({});await flush();const failed=h.maps[0];h.catalog.reject(Error('catalog failed'));await p;assert(failed.destroyed);assert.equal(h.c.atlas,null);assert.equal(h.c.window.__meridian.instances.length,0);assert(!h.calls.some(([key])=>key==='geography'));
 h.replaceCatalog();const retry=h.c.ensureAtlas();await complete(h,retry);assert.equal(h.maps.length,2);assert.equal(h.c.atlas,h.maps[1]);assert(h.c.atlasReady);
});
await test('A failed old renderer branch cannot overwrite a newer successful attempt',async()=>{
 const h=environment(),oldRenderer=h.renderer,p=assert.rejects(h.c.ensureAtlas(),/catalog failed/);h.catalog.reject(Error('catalog failed'));await p;h.replaceCatalog();h.replaceRenderer();const retry=h.c.ensureAtlas();oldRenderer.resolve({});await flush();assert.equal(h.maps.length,0);await complete(h,retry);assert.equal(h.maps.length,1);assert.equal(h.c.atlas,h.maps[0]);
});
await test('Renderer failure is observed while catalog is pending and keeps the cached catalog retryable',async()=>{
 const h=environment(),p=assert.rejects(h.c.ensureAtlas(),/renderer failed/);h.renderer.reject(Error('renderer failed'));await p;h.catalog.resolve({records:[]});await flush();h.replaceRenderer();const retry=h.c.ensureAtlas();await complete(h,retry);assert(h.c.atlasReady);assert.equal(h.calls.filter(([key,path])=>key==='read'&&path.includes('catalog')).length,1);
});
await test('Base failure before catalog completion is handled and removes the failed instance',async()=>{
 const h=environment(),p=assert.rejects(h.c.ensureAtlas(),/base failed/);h.renderer.resolve({});await flush();h.maps[0].load.reject(Error('base failed'));await p;assert(h.maps[0].destroyed);assert.equal(h.c.atlas,null);h.catalog.resolve({records:[]});await turn();assert(!h.calls.some(([key])=>key==='geography'));
});
await test('Navigating away before renderer arrival creates no map',async()=>{
 const h=environment(),p=assert.rejects(h.c.ensureAtlas(),/superseded/);h.c.state.view='research';h.renderer.resolve({});await p;h.catalog.resolve({records:[]});await flush();assert.equal(h.maps.length,0);
});
await test('Navigating away during the catalog wait destroys the base without starting geography',async()=>{
 const h=environment(),p=assert.rejects(h.c.ensureAtlas(),/superseded/);h.renderer.resolve({});await flush();h.maps[0].load.resolve();await flush();h.c.state.view='research';h.catalog.resolve({records:[]});await p;assert(h.maps[0].destroyed);assert.equal(h.c.atlas,null);assert(!h.calls.some(([key])=>key==='geography'||key==='year'));
});
await test('The latest year is applied when startup dependencies finish',async()=>{
 const h=environment(),p=h.c.ensureAtlas();h.renderer.resolve({});await flush();h.c.state.year=-221;h.maps[0].load.resolve();h.catalog.resolve({records:[]});await p;assert.deepEqual(h.calls.filter(([key])=>key==='year'),[['year',-221]]);
});
await test('Real AtlasMap defers optional geography and starts it exactly once',async()=>{
 const h=engineEnvironment(),map=new h.c.ActualAtlasMap('map',{deferGeography:true});h.maps[0].emitLoad();await map.ready;assert.equal(h.calls.filter(v=>v==='geography-started').length,0);assert.equal(h.timers.size,0);const a=map.startGeography(),b=map.startGeography();assert.equal(a,b);assert.equal(await a,true);assert.equal(h.calls.filter(v=>v==='geography-started').length,1);assert(h.calls.includes('layer-order'));map.destroy();assert.equal(await map.startGeography(),false);
});
await test('Real AtlasMap destruction cancels pending readiness and prevents late layer creation',async()=>{
 const h=engineEnvironment(),map=new h.c.ActualAtlasMap('map',{deferGeography:true}),p=assert.rejects(map.ready,/cancelled/);map.destroy();map.destroy();await p;assert.equal(h.timers.size,0);h.maps[0].emitLoad();assert.equal(h.calls.filter(v=>v==='remove').length,1);assert(!h.calls.includes('geography-created'));
});
await test('Deferred geography preserves ordinary regional, frozen and street layers above water',async()=>{
 const h=engineEnvironment(),map=new h.c.ActualAtlasMap('map',{deferGeography:true});h.maps[0].emitLoad();await map.ready;await map.startGeography();
 const order=map.map.getStyle().layers.map(layer=>layer.id),details=['regional-edges','ohm-frozen-edges','historical-roads'];
 for(const id of details){assert(order.indexOf(id)>order.indexOf('physical-rivers'));assert(order.indexOf(id)>order.indexOf('physical-lakes'));assert(order.indexOf(id)<order.indexOf('boundary'));}
 assert.deepEqual(Array.from(order.filter(id=>details.includes(id))),details);map.destroy();
});
await test('Comparison-map default still initializes geography on base load',async()=>{
 const h=engineEnvironment(),map=new h.c.ActualAtlasMap('map2');h.maps[0].emitLoad();await map.ready;assert.equal(h.calls.filter(v=>v==='geography-started').length,1);map.destroy();
});
await test('Real map readiness reports initialization errors and clears its deadline',async()=>{
 const h=engineEnvironment({failController:true}),map=new h.c.ActualAtlasMap('map',{deferGeography:true}),p=assert.rejects(map.ready,/controller failed/);h.maps[0].emitLoad();await p;assert.equal(h.timers.size,0);map.destroy();
});
await test('No asynchronous startup failure escapes as an unhandled rejection',async()=>{await turn();assert.deepEqual(unhandled,[]);});
process.off('unhandledRejection',onUnhandled);
const report={method:'Actual ensureAtlas/ensureCatalogData and actual AtlasMap class with deferred I/O and renderer boundaries; checks dependency overlap and lifecycle, not browser timing.',appSHA256:createHash('sha256').update(appSource).digest('hex'),engineSHA256:createHash('sha256').update(engineSource).digest('hex'),passed:cases.filter(c=>c.pass).length,total:cases.length,cases};
const reportFile=process.env.STARTUP_OVERLAP_REPORT;if(reportFile){await mkdir(dirname(resolve(reportFile)),{recursive:true});await writeFile(reportFile,JSON.stringify(report,null,2)+'\n');}
console.log(`${report.passed}/${report.total} startup overlap checks passed`);if(report.passed!==report.total)process.exitCode=1;
