// Evaluates the unchanged ensureCoreData/ensureAtlas functions from a fixed commit.
// Deferred resource promises prove a dependency gate; timings are not browser metrics.
import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const root='/Users/zane/meridian_atlas/world-history-atlas';
const commit='9a9ded84f1a89dde4544ecaf93fd8458180775f4';
const source=execFileSync('git',['show',`${commit}:public/app.js`],{cwd:root,encoding:'utf8'});
const actual=source.slice(source.indexOf('function ensureCoreData(){'),source.indexOf('async function restoreInitialMapView(){'));
assert(actual.includes("await Promise.all([ensureCoreData(),loadMapLibre()])"));
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function make(){
 const catalog=defer(),events=defer(),renderer=defer(),calls=[],nodes=new Map();
 const context={calls,state:{year:1492,view:'atlas',boundaryMode:'auto',projection:'globe',lang:'bi'},catalog:undefined,events:[],coverage:[],coreDataPromise:null,atlasBootPromise:null,atlasReady:false,atlas:null,savedCamera:null,restoringView:false,applyingBoundaryComparison:false,
  readJSON:url=>{calls.push(['readJSON',url]);return url.includes('catalog')?catalog.promise:url.includes('events')?events.promise:Promise.resolve([]);},loadMapLibre:()=>renderer.promise,prefetchNativeFrame:async()=>{calls.push(['prefetch']);},
  $:selector=>{if(!nodes.has(selector))nodes.set(selector,{});return nodes.get(selector);},text:(a)=>a,
  renderDensity:()=>calls.push(['density']),renderBrowse:()=>{},renderEvents:()=>{},renderLayerLabels:()=>{},saveURL:()=>{},registerTools:()=>{},setMapControlsReady:()=>{},openPolity:()=>{},boundarySelection:()=>{},cancelBoundaryComparison:()=>{},closeDetail:()=>{},mapError:()=>{},exportMapImage:()=>{},location:{reload(){}},window:{},applyYear:async()=>{calls.push(['applyYear']);return true;},
  AtlasMap:class{constructor(){calls.push(['construct']);this.map={on(){}};this.ready=Promise.resolve();}toggleBorders(){}projection(){}destroy(){this.destroyed=true;calls.push(['destroy']);}}
 };
 vm.createContext(context);vm.runInContext(actual,context);return {context,catalog,events,renderer,calls};
}
const cases=[];
{
 const h=make(),p=h.context.ensureAtlas();h.catalog.resolve({records:[]});h.renderer.resolve({});await settle();
 assert(!h.calls.some(x=>x[0]==='construct'));assert.equal(h.context.catalog,undefined);
 h.events.resolve([]);await p;assert.equal(h.calls.filter(x=>x[0]==='construct').length,1);assert.equal(h.context.atlasReady,true);
 cases.push({name:'catalog and renderer ready but events unresolved',mapConstructedBeforeEvents:false,mapConstructedAfterEvents:true});
}
{
 const h=make(),p=h.context.ensureAtlas().then(()=>null,e=>e.message);h.catalog.resolve({records:[]});h.renderer.resolve({});h.events.reject(Error('events failed'));assert.equal(await p,'events failed');
 assert(!h.calls.some(x=>x[0]==='construct'));assert.equal(h.context.coreDataPromise,null);assert.equal(h.context.atlasBootPromise,null);
 cases.push({name:'events failure prevents map despite catalog and renderer ready',mapConstructed:false,retryPromisesReset:true});
}
{
 const h=make(),p=h.context.ensureAtlas().then(()=>null,e=>e.message);h.catalog.resolve({records:[]});h.renderer.resolve({});await settle();h.context.state.view='library';h.events.resolve([]);assert.equal(await p,'Map navigation superseded');assert(!h.calls.some(x=>x[0]==='construct'));
 cases.push({name:'navigation leaves atlas during blocked boot',mapConstructed:false,guardPreserved:true});
}
const out={commit,method:'Unchanged production functions with deferred I/O and map/UI boundary stubs',cases,notMeasured:['browser network timings','first visible map frame','render or GPU work']};
await fs.writeFile(new URL('./events-gate-evidence.json',import.meta.url),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));
