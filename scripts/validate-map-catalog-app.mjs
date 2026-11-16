import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createMapCatalogLoader,mapCatalogPath} from '../public/map-catalog.js';
import {AtlasMap,activeRecords} from '../public/map-engine.js';
import {searchPolityIndex,groupPolityIndex,polityChainPath,polityNameGroupKey} from '../public/polity-names.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(process.env.MAP_CATALOG_APP_SOURCE||resolve(root,'public/app.js'),'utf8');
function extract(name){
 const start=new RegExp('^(?:async )?function '+name+'\\(','m').exec(source)?.index;assert.notEqual(start,undefined,name);
 const next=/^(?:(?:async )?function |const |let |export |class )/m.exec(source.slice(start+1));
 return source.slice(start,next?start+1+next.index:source.length);
}
const read=path=>path==='data/coverage.json'?[]:JSON.parse(gunzipSync(fs.readFileSync(resolve(root,'public',path))));
const completeCatalog=read('data/fast/catalog.json.gz');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<35;i++)await Promise.resolve();};
const turn=()=>new Promise(resolve=>setImmediate(resolve));

function fixture({startup=false}={}){
 const calls=[],reads=[],gates=new Map(),nodes=new Map(),maps=[];
 const node=id=>{
  if(!nodes.has(id))nodes.set(id,{hidden:true,disabled:false,value:'',innerHTML:'',events:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},focus(){},closest:()=>null,querySelector:selector=>node(id+' '+selector),querySelectorAll:()=>[],addEventListener(type,fn){this.events[type]=fn;},append(){},replaceChildren(){}});
  return nodes.get(id);
 };
 const c={Promise,console,URL,URLSearchParams,Number,Set,Map,Error,RangeError,setTimeout,clearTimeout,
  state:{view:'atlas',year:1492,compareYear:1650,compare:false,lang:'en',boundaryMode:'auto',compareBoundaryMode:'auto',borders:true,reference:false,projection:'globe',streets:false,borderCurves:true,events:true,labels:true,terrain:true,coast:true,search:'',selectedSide:'left',browse:false,allTime:false},
  catalog:undefined,catalogStatus:'idle',catalogDataPromise:null,politySearchIndex:null,politySearchIndexPromise:null,politySearchIndexStatus:'idle',polityChainPromises:new Map(),mapCatalogs:null,coverage:[],events:[],eventsStatus:'ready',eventsDataPromise:null,eventsFullPromise:null,eventsFullReady:true,
  atlas:null,compareMap:null,atlasReady:!startup,atlasBootPromise:null,updateId:0,compareGeneration:0,pendingYear:null,pendingCompareYear:null,pendingInitialEvent:null,displayedPolityCount:null,
  detailNavigation:0,placeReturn:null,readerReturnBrowse:false,detailFocus:null,restoringView:false,applyingBoundaryComparison:false,savedCamera:null,viewRevision:0,
  $:node,$$:()=>[],window:{__meridian:{instances:[]}},document:{activeElement:null,body:{classList:{add(){},remove(){}}},createElement:()=>node('created')},location:{reload(){}},performance:{mark:name=>calls.push(['mark',name])},
  text:(zh,en)=>en,escape:v=>String(v??''),yr:String,normalizeYear:Number,polityName:r=>r.name,polityNameGroupKey,polityChainPath,groupPolityIndex,activeRecords,
  createMapCatalogLoader,forgetJSON:path=>calls.push(['forget',path]),readJSON:path=>{reads.push(path);return gates.has(path)?gates.get(path).promise:Promise.resolve(read(path));},
  recordDetail:id=>c.readJSON(`data/fast/records-${String(Math.floor(+id.slice(5)/256)).padStart(3,'0')}.json.gz`).then(d=>d[id]),
  loadMapLibre:async()=>{},ensureEventsData:Object.assign(async()=>{},{fullReady:true}),ensureFullEventsData:async()=>{},refreshEventData(){},prefetchNativeFrame:async()=>{},cancelBoundaryComparison(){},
  pause(){},renderYear(){node('#yearInput').value=c.state.year;},renderEvents(){},renderBrowse(){},renderRegionalStatus(){},renderLayerLabels(){},renderDatasetStatus(){},saveURL(){},
  mapError:(message,retry)=>calls.push(['error',message,retry]),setMapControlsReady:value=>calls.push(['controls',value]),registerTools(){},exportMapImage(){},boundarySelection(){},openEvent(){},
  renderPlaceSearch(){},searchPlaces:async()=>[],loadBattles:async()=>[],filteredEvents:()=>[],eventCountText:n=>String(n),bindEventRetries(){},COLORS:{},inWindow:()=>true,
  searchPolityIndex:(index,query,year)=>{calls.push(['search',index,query]);return searchPolityIndex(index,query,year);},
  searchPolityRecords:(records,query,year)=>{calls.push(['search',records,query]);return records.filter(r=>r.name.toLowerCase().includes(query.toLowerCase())).slice(0,2).map(record=>({record,year}));}
 };
 const makeMap=year=>{
  const renderGates=new Map(),m={year,request:0,lang:'en',destroyed:false,active:[],ready:Promise.resolve(),renderGates,catalog:null,
   map:{on(){},off(){},getCenter:()=>[0,0],getZoom:()=>2,getBearing:()=>0,getPitch:()=>0,jumpTo(){},resize(){}},
   places:{select(){},setYear(){}},regional:{closePopup(){},setModern(){},setMode(){},setYear(){}},historical:{setModern(){},toggle(){},setYear(){}},
   geography:{toggle(){},alignCoast(){},setReference(){}},startGeography(){calls.push(['geography',this.year,this.geography.enabled,this.geography.coastAligned,this.geography.reference]);},toggleBorders(){},projection(){},setEvents(){},selectPolity(){},focusPolity(){},
   upgradeLand(){},upgradeDetail(){},refreshLabels(){},destroy(){this.destroyed=true;++this.request;},cleanup(){},
   boundaries:{mode:'auto',async prepare(next){const g=renderGates.get(next);if(g){g.started=true;await g.promise;}return {requested:'auto',year:next};},commit(frame){calls.push(['commit',m,frame.year]);}}
  };
  m.setYear=(catalog,next,lang)=>AtlasMap.prototype.setYear.call(m,catalog,next,lang);
  m.delayRender=year=>{const g=deferred();renderGates.set(year,g);return g;};maps.push(m);return m;
 };
 c.AtlasMap=function(container,options){const m=makeMap(options.year);c.window.__meridian.instances.push(m);return m;};
 c.polityReader={seq:0,async open(record,map,options){const chain=options?.chainRecords||c.catalog?.records;assert(chain&&Array.isArray(chain)&&chain.some(x=>x.id===record.id)&&(!c.catalog||!c.catalog.mapCatalog),'Reader must receive the polity period chain');calls.push(['reader',record,map,options]);}};
 if(!startup)c.atlas=makeMap(1492);
 const names=['mapCatalogForYear','ensureCatalogData','ensurePolitySearchIndex','ensurePolityChain','applyYear','setCompareYear','openPolity','closeDetail','beginDetail','bindDetailClose','ensureAtlas','toggleCompare','closeComparison'];
 vm.createContext(c);vm.runInContext(names.map(extract).join('\n'),c);
 c.setYear=(year,options)=>c.applyYear(year,options);c.showView=async view=>{c.state.view=view;return true;};
 const block=path=>{const g=deferred();gates.set(path,g);return {...g,complete:()=>g.resolve(read(path))};};
 const recordPath=id=>`data/fast/records-${String(Math.floor(+id.slice(5)/256)).padStart(3,'0')}.json.gz`;
 return {c,calls,reads,nodes,node,maps,makeMap,block,blockYear:year=>block(mapCatalogPath(year)),blockFull:()=>block('data/fast/catalog.json.gz'),blockIndex:()=>block('data/fast/polity-search-index.json.gz'),blockChain:r=>block(polityChainPath(r)),blockRecord:id=>block(recordPath(id)),recordPath,unblock:path=>gates.delete(path),loadFunction:name=>vm.runInContext(extract(name),c)};
}
const tests=[],unhandled=[];const onUnhandled=e=>unhandled.push(String(e));process.on('unhandledRejection',onUnhandled);
async function test(name,fn){try{await fn();tests.push({name,passed:true});console.log('PASS '+name);}catch(e){tests.push({name,passed:false,error:String(e.stack||e)});console.error('FAIL '+name+'\n'+e.stack);}}

await test('Initial map becomes interactive from a date pack without reading the complete catalog',async()=>{
 const h=fixture({startup:true});await h.c.ensureAtlas();assert(h.c.atlasReady);assert.equal(h.c.atlas.year,1492);assert(h.c.atlas.active.length>0);assert(h.reads.includes(mapCatalogPath(1492)));assert(!h.reads.includes('data/fast/catalog.json.gz'));assert.equal(h.c.catalog,undefined);
});
await test('Optional geography starts only after the initial historical frame commits, with restored preferences',async()=>{
 const h=fixture({startup:true});h.c.state.terrain=false;h.c.state.coast=false;h.c.state.reference=true;let gate;
 h.c.AtlasMap=function(container,options){const map=h.makeMap(options.year);gate=map.delayRender(options.year);h.c.window.__meridian.instances.push(map);return map;};
 const p=h.c.ensureAtlas();await flush();assert(gate.started);assert(!h.calls.some(x=>x[0]==='geography'));gate.resolve();await p;const position=h.calls.findIndex(x=>x[0]==='geography');assert(position>h.calls.findIndex(x=>x[0]==='commit'));assert.deepEqual(h.calls[position].slice(1),[1492,false,false,true]);
});
await test('Every date pack preserves active records; subsequent full reading never replaces global catalog with a partial pack',async()=>{
 const h=fixture();for(const y of [-250,2,742,1492,1700,2024]){const pack=await h.c.mapCatalogForYear(y);assert.deepEqual(activeRecords(pack,y),activeRecords(completeCatalog,y));assert.equal(h.c.catalog,undefined);}
 await h.c.ensureCatalogData();assert.equal(h.c.catalog.records.length,completeCatalog.records.length);assert(!h.c.catalog.mapCatalog);assert.strictEqual(await h.c.mapCatalogForYear(1600),h.c.catalog);
});
await test('A late older date catalog cannot overwrite the latest left-map request',async()=>{
 const h=fixture(),old=h.blockYear(1600),newest=h.blockYear(1700),a=h.c.applyYear(1600),b=h.c.applyYear(1700);await flush();newest.complete();assert.equal(await b,true);old.complete();assert.equal(await a,false);assert.equal(h.c.state.year,1700);assert.equal(h.c.atlas.year,1700);
});
await test('A newer left catalog failure cancels an earlier in-flight renderer and preserves the committed year',async()=>{
 const h=fixture(),committed=read(mapCatalogPath(1492));h.c.atlas.catalog=committed;const render=h.c.atlas.delayRender(1600),a=h.c.applyYear(1600);await flush();assert(render.started);const late=h.blockYear(1700),b=h.c.applyYear(1700);await flush();render.resolve();await a;late.reject(Error('catalog unavailable'));await b;assert.equal(h.c.state.year,1492);assert.equal(h.c.atlas.year,1492);assert(!h.calls.some(x=>x[0]==='commit'&&x[2]===1600));assert.strictEqual(h.c.atlas.catalog,committed,'Failed replacement must keep the committed-year catalog');
});
await test('Comparison date catalogs obey their own generation and keep the left map unchanged',async()=>{
 const h=fixture();h.c.compareMap=h.makeMap(1650);h.c.state.compare=true;const old=h.blockYear(1700),fresh=h.blockYear(1800),a=h.c.setCompareYear(1700),b=h.c.setCompareYear(1800);await flush();fresh.complete();assert.equal(await b,true);old.complete();assert.equal(await a,false);assert.equal(h.c.compareMap.year,1800);assert.equal(h.c.state.compareYear,1800);assert.equal(h.c.atlas.year,1492);
});
await test('A newer comparison catalog failure invalidates an earlier renderer before it can commit',async()=>{
 const h=fixture();h.c.compareMap=h.makeMap(1650);h.c.state.compare=true;const committed=read(mapCatalogPath(1650));h.c.compareMap.catalog=committed;const render=h.c.compareMap.delayRender(1700),a=h.c.setCompareYear(1700);await flush();assert(render.started);const late=h.blockYear(1800),b=h.c.setCompareYear(1800);await flush();render.resolve();await a;late.reject(Error('catalog unavailable'));await b;assert.equal(h.c.state.compareYear,1650);assert.equal(h.c.compareMap.year,1650);assert.strictEqual(h.c.compareMap.catalog,committed,'Comparison catalog must stay paired with its committed year');
});
await test('Preparing another year keeps the displayed catalog until its map frame commits',async()=>{
 const h=fixture(),committed=read(mapCatalogPath(1492));h.c.atlas.catalog=committed;const gate=h.c.atlas.delayRender(1600),p=h.c.applyYear(1600);await flush();assert(gate.started);assert.strictEqual(h.c.atlas.catalog,committed);gate.resolve();assert.equal(await p,true);assert.notStrictEqual(h.c.atlas.catalog,committed);assert.deepEqual(h.c.atlas.catalog.mapCatalog.range,[1576,1600]);
});
await test('Closing comparison while its catalog is pending cannot revive the removed map',async()=>{
 const h=fixture(),old=h.makeMap(1650);h.c.compareMap=old;h.c.state.compare=true;const late=h.blockYear(1800),p=h.c.setCompareYear(1800);await flush();h.c.closeComparison();late.complete();assert.equal(await p,false);assert(old.destroyed);assert.equal(h.c.compareMap,null);assert.equal(h.c.state.compare,false);
});
await test('Initial comparison cannot submit an old catalog under a newer year',async()=>{
 const h=fixture(),initial=h.blockYear(1650),opening=h.c.toggleCompare();await flush();assert(h.c.compareMap);const newer=h.c.setCompareYear(1800);await newer;initial.complete();await opening;assert.equal(h.c.state.compareYear,1800);assert.equal(h.c.compareMap.year,1800);assert.deepEqual(h.c.compareMap.active,activeRecords(completeCatalog,1800));assert.equal(h.node('#compareYear').disabled,false);
});
await test('Polity reading waits for its sharded period chain without loading the full catalog',async()=>{
 const h=fixture(),r=activeRecords(completeCatalog,1492)[0],gate=h.blockChain(r),opening=h.c.openPolity(r);await flush();assert.equal(h.calls.filter(x=>x[0]==='reader').length,0);assert(!h.reads.includes('data/fast/catalog.json.gz'));assert(h.node('#detailPanel').innerHTML.includes('complete historical record'));gate.complete();await opening;const call=h.calls.find(x=>x[0]==='reader');assert(call);assert(!h.reads.includes('data/fast/catalog.json.gz'));assert.equal(h.c.catalog,undefined);assert.equal(call[3].chainRecords.length,completeCatalog.records.filter(x=>x.type==='POLITY'&&polityNameGroupKey(x)===polityNameGroupKey(r)).length);
});
await test('Closing a pending polity dossier prevents its later period chain from opening the reader',async()=>{
 const h=fixture(),r=activeRecords(completeCatalog,1492)[0],gate=h.blockChain(r),p=h.c.openPolity(r);await flush();h.c.closeDetail();gate.complete();await p;assert.equal(h.calls.filter(x=>x[0]==='reader').length,0);assert.equal(h.node('#detailPanel').hidden,true);assert.equal(h.c.state.selectedPolity,null);
});
await test('Changing a dossier map year rejects the obsolete reader completion',async()=>{
 const h=fixture(),r=activeRecords(completeCatalog,1492)[0],gate=h.blockChain(r),p=h.c.openPolity(r);await flush();h.c.atlas.year=1500;gate.complete();await p;assert.equal(h.calls.filter(x=>x[0]==='reader').length,0);
});
await test('A different polity selected during chain loading wins the reader',async()=>{
 const h=fixture(),records=activeRecords(completeCatalog,1492),gate0=h.blockChain(records[0]),gate1=h.blockChain(records[1]),a=h.c.openPolity(records[0]);await flush();const b=h.c.openPolity(records[1]);gate0.complete();await flush();gate1.complete();await Promise.all([a,b]);assert.deepEqual(h.calls.filter(x=>x[0]==='reader').map(x=>x[1].id),[records[1].id]);
});
await test('Dossier chain failures display retry; retry succeeds and preserves the original selection',async()=>{
 const h=fixture(),r=activeRecords(completeCatalog,1492)[0],chainPath=polityChainPath(r),gate=h.block(chainPath),p=h.c.openPolity(r);gate.reject(Error('offline'));await p;assert(h.node('#detailPanel .reader-content').innerHTML.includes('could not load'));assert.equal(h.calls.filter(x=>x[0]==='reader').length,0);h.unblock(chainPath);await h.node('#retryPolityCatalog').onclick();assert.equal(h.calls.filter(x=>x[0]==='reader')[0][1].id,r.id);assert.equal(h.c.catalog,undefined);
});
await test('Search lazily reads the all-period polity index, retries failures, and renders the newest query',async()=>{
 const h=fixture();h.loadFunction('renderEvents');h.c.renderEvents();assert(!h.reads.includes('data/fast/polity-search-index.json.gz'));assert(!h.reads.includes('data/fast/catalog.json.gz'));const gate=h.blockIndex();h.c.state.search='rome';h.c.renderEvents();await flush();assert.equal(h.reads.filter(x=>x==='data/fast/polity-search-index.json.gz').length,1);gate.reject(Error('offline'));await flush();assert(h.node('#eventList').innerHTML.includes('Polity catalog unavailable'));assert(h.node('#retryCatalogSearch').events.click);h.unblock('data/fast/polity-search-index.json.gz');h.c.state.search='Ming';h.node('#retryCatalogSearch').events.click();await flush();assert.equal(h.c.politySearchIndexStatus,'ready');assert(!h.reads.includes('data/fast/catalog.json.gz'));const last=h.calls.filter(x=>x[0]==='search').at(-1);assert.equal(last[2],'Ming');assert.equal(last[1].groups.length,read('data/fast/polity-search-index.json.gz').groups.length);
});
await test('Search observes shared search-index completion started by another view',async()=>{
 const h=fixture();h.loadFunction('renderEvents');const gate=h.blockIndex(),loading=h.c.ensurePolitySearchIndex();h.c.state.search='Ming';h.c.renderEvents();assert(h.node('#eventList').innerHTML.includes('Searching polities'));gate.complete();await loading;await flush();const last=h.calls.filter(x=>x[0]==='search').at(-1);assert(last,'Shared polity search-index completion must refresh current search');assert.equal(last[2],'Ming');
});
await test('Search observes failures of a shared search-index request started by another view',async()=>{
 const h=fixture();h.loadFunction('renderEvents');const gate=h.blockIndex(),loading=h.c.ensurePolitySearchIndex().catch(()=>{});h.c.state.search='Ming';h.c.renderEvents();gate.reject(Error('offline'));await loading;await flush();assert(h.node('#eventList').innerHTML.includes('Polity catalog unavailable'));assert(h.node('#retryCatalogSearch').events.click);
});
await test('A polity deep link retries its record lookup after an initial download failure without reading full catalog',async()=>{
 const h=fixture(),record=activeRecords(completeCatalog,1492)[0],gate=h.blockRecord(record.id);h.c.mapURLRestored=false;h.c.params=new URLSearchParams({polity:record.id});h.c.jumpPolity=async r=>h.calls.push(['jump',r.id]);h.loadFunction('restoreInitialMapView');
 const first=assert.rejects(h.c.restoreInitialMapView(),/offline/);gate.reject(Error('offline'));await first;assert.equal(h.c.mapURLRestored,false,'A failed deep-link restoration must remain retryable');h.unblock(h.recordPath(record.id));await h.c.restoreInitialMapView();assert.deepEqual(h.calls.filter(x=>x[0]==='jump').map(x=>x[1]),[record.id]);assert(!h.reads.includes('data/fast/catalog.json.gz'));assert.equal(h.c.mapURLRestored,true);
});
await test('A completed user year change supersedes a pending initial polity deep link',async()=>{
 const h=fixture(),record=activeRecords(completeCatalog,1492)[0],gate=h.blockRecord(record.id);h.c.mapURLRestored=false;h.c.params=new URLSearchParams({polity:record.id});h.c.jumpPolity=async r=>h.calls.push(['jump',r.id]);h.loadFunction('restoreInitialMapView');
 const opening=h.c.restoreInitialMapView();await flush();assert.equal(await h.c.applyYear(1700),true);gate.complete();await opening;assert.equal(h.calls.filter(x=>x[0]==='jump').length,0,'Initial polity must not overwrite a newer user year');assert.equal(h.c.state.year,1700);
});
await test('A still-pending user year request supersedes a pending initial polity deep link',async()=>{
 const h=fixture(),record=activeRecords(completeCatalog,1492)[0],gate=h.blockRecord(record.id);h.c.mapURLRestored=false;h.c.params=new URLSearchParams({polity:record.id});h.c.jumpPolity=async r=>h.calls.push(['jump',r.id]);h.loadFunction('restoreInitialMapView');
 const opening=h.c.restoreInitialMapView();await flush();const next=h.blockYear(1700),changing=h.c.applyYear(1700);await flush();assert.equal(h.c.state.year,1492);assert.equal(h.c.pendingYear,1700);gate.complete();await opening;next.complete();await changing;assert.equal(h.calls.filter(x=>x[0]==='jump').length,0,'A newer pending year intent must not be overwritten');assert.equal(h.c.state.year,1700);
});
await test('Opening another dossier supersedes a pending initial polity deep link',async()=>{
 const h=fixture(),records=activeRecords(completeCatalog,1492),gate=h.blockRecord(records[0].id);h.c.mapURLRestored=false;h.c.params=new URLSearchParams({polity:records[0].id});h.c.jumpPolity=async r=>h.calls.push(['jump',r.id]);h.loadFunction('restoreInitialMapView');
 const opening=h.c.restoreInitialMapView();await flush();const selected=h.c.openPolity(records[1]);await flush();gate.complete();await Promise.all([opening,selected]);assert.equal(h.calls.filter(x=>x[0]==='jump').length,0,'Initial polity must not replace a newly selected dossier');assert.equal(h.c.state.selectedPolity.id,records[1].id);assert.deepEqual(h.calls.filter(x=>x[0]==='reader').map(x=>x[1].id),[records[1].id]);
});
await test('Closing the target comparison map cancels its pending initial polity deep link',async()=>{
 const h=fixture(),record=activeRecords(completeCatalog,1650)[0],gate=h.blockRecord(record.id);h.c.compareMap=h.makeMap(1650);h.c.state.compare=true;h.c.mapURLRestored=false;h.c.params=new URLSearchParams({polity:record.id,side:'right'});h.c.jumpPolity=async(r,map)=>h.calls.push(['jump',r.id,map]);h.loadFunction('restoreInitialMapView');
 const opening=h.c.restoreInitialMapView();await flush();h.c.closeComparison();gate.complete();await opening;assert.equal(h.calls.filter(x=>x[0]==='jump').length,0,'A removed right-side target must not fall back to the left map');assert.equal(h.c.compareMap,null);
});
await test('A rejected obsolete deep-link record cannot surface a map error or re-arm old restoration',async()=>{
 const h=fixture(),record=activeRecords(completeCatalog,1492)[0],gate=h.blockRecord(record.id);h.c.mapURLRestored=false;h.c.params=new URLSearchParams({polity:record.id});h.c.jumpPolity=async r=>h.calls.push(['jump',r.id]);h.loadFunction('restoreInitialMapView');
 const opening=h.c.restoreInitialMapView().then(()=>true,()=>false);await flush();assert.equal(await h.c.applyYear(1700),true);gate.reject(Error('obsolete record offline'));assert.equal(await opening,true,'A superseded deep link must settle without bubbling an error to showView');assert.equal(h.c.mapURLRestored,true,'User navigation must not re-arm the obsolete initial link');assert.equal(h.calls.filter(x=>x[0]==='jump'||x[0]==='error').length,0);assert.equal(h.c.state.year,1700);
});
await test('Recorded-change navigation never mutates a shared date index and stays nearest in both directions',async()=>{
 const h=fixture();h.c.atlas.catalog={changeYears:[1400,1450,1500,1550,1600]};h.c.state.year=1520;const jumps=[];h.c.setYear=y=>{jumps.push(y);h.c.state.year=y;};
 const start=source.indexOf(' const changes=()=>'),end=source.indexOf("$('#projectionBtn').onclick",start);assert(start>=0&&end>start);vm.runInContext(source.slice(start,end),h.c);
 h.node('#prevChange').onclick();h.node('#prevChange').onclick();h.node('#nextChange').onclick();assert.deepEqual(jumps,[1500,1450,1500]);assert.deepEqual(h.c.atlas.catalog.changeYears,[1400,1450,1500,1550,1600]);
});
await test('No rejected lazy catalog or obsolete callback creates an unhandled rejection',async()=>{await turn();assert.deepEqual(unhandled,[]);});
process.off('unhandledRejection',onUnhandled);
const report={method:'Actual app functions, real map-catalog loader and packed source data, and AtlasMap.setYear; only rendering, DOM and I/O completion are controlled.',appSHA256:createHash('sha256').update(source).digest('hex'),passed:tests.filter(x=>x.passed).length,total:tests.length,tests};
const path=process.env.MAP_CATALOG_APP_REPORT;if(path){fs.mkdirSync(dirname(resolve(path)),{recursive:true});fs.writeFileSync(path,JSON.stringify(report,null,2)+'\n');}
console.log(`${report.passed}/${report.total} map catalog app checks passed`);if(report.passed!==report.total)process.exitCode=1;
