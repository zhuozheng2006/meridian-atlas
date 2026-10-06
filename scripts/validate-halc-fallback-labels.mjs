/** Bounded source-order contract test; no browser/network/GPU benchmark. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(process.argv[2]||'.');
const {halcVisibleUnits}=await import(pathToFileURL(resolve(root,'public/halc-boundaries.js')));
const {regionalAnchor}=await import(pathToFileURL(resolve(root,'public/regional-boundaries.js')));
const {createActualAdapter}=await import(pathToFileURL(resolve(root,'scripts/halc-test-adapter.mjs')));
const text=await fs.readFile(resolve(root,'public/assets/maplibre-gl.js'),'utf8'),hook='modules.shared(sharedModule);';assert.equal(text.split(hook).length,2);
const sandbox=vm.createContext({console,setTimeout,clearTimeout,performance,TextEncoder,TextDecoder,URL,AbortController,Blob});
vm.runInContext(text.replace(hook,hook+'globalThis.shared=sharedModule;'),sandbox);
const shared=sandbox.shared,Feature=shared.ac,original=Object.getOwnPropertyDescriptor(Feature.prototype,'geometry');
let activeMetrics=null;
Object.defineProperty(Feature.prototype,'geometry',{...original,get(){if(activeMetrics){const key=this.source||'other';activeMetrics.reads[key]=(activeMetrics.reads[key]||0)+1;if(this._geometry===undefined)activeMetrics.cold[key]=(activeMetrics.cold[key]||0)+1;}return original.get.call(this);}});
const tilePath='6/32/20.pbf',localBytes=await fs.readFile(resolve(root,'public/data/halc/tiles/'+tilePath)),regionBytes=await fs.readFile(resolve(root,'public/data/halc-regions/tiles/'+tilePath));
const localTile=new shared.cL(new shared.cM(localBytes)).layers.halc_localities,regionTile=new shared.cL(new shared.cM(regionBytes)).layers.halc_regions;
const labels=JSON.parse(await fs.readFile(resolve(root,'public/data/halc/labels.json'),'utf8'));
function features(layer,source,sourceLayer,idKey){return Array.from({length:layer.length},(_,i)=>{const vt=layer.feature(i),f=new Feature(vt,6,32,20,vt.properties[idKey]);f.source=source;f.sourceLayer=sourceLayer;f.layer={id:source==='halc-boundaries'?'halc-wash':'halc-region-query'};f.state={};return f;});}
const localFeatures=()=>features(localTile,'halc-boundaries','halc_localities','fid'),regionFeatures=()=>features(regionTile,'halc-regions','halc_regions','gid');
function eagerGroup(rendered){const units=new Map();for(const f of rendered){const id=+f.properties.fid;if(!units.has(id))units.set(id,{...f,fragments:[]});units.get(id).fragments.push(f.geometry);}return [...units.values()].sort((a,b)=>a.properties.fid-b.properties.fid);}
const qualifies=f=>f.properties.TYPE!==8&&f.properties.ADM1&&f.properties.ADM1!=='XX'&&!f.properties.ADM1.includes(';');
const hash=data=>createHash('sha256').update(data).digest('hex');
const geometryJSON=units=>JSON.stringify(units.map(f=>({fid:f.properties.fid,fragments:f.fragments})));
const metrics=()=>({reads:{},cold:{},anchors:[]});
const {createHarness,restoreGlobals}=await createActualAdapter(root);
const live=new Set();
async function setup({eager=false,showLabels=true}={}){
 const h=await createHarness({mode:'halc',year:1500,zoom:6.3,borders:true,modern:false,inside:true});live.add(h);await h.settle();
 const box=[0,52.45,5.625,55.80];h.map.getBounds=()=>({getWest:()=>box[0],getSouth:()=>box[1],getEast:()=>box[2],getNorth:()=>box[3]});
 h.map.project=p=>({x:80+(p[0]-box[0])/(box[2]-box[0])*1040,y:100+(box[3]-p[1])/(box[3]-box[1])*560});
 h.halc.labels=labels;h.owner.atlas.showLabels=showLabels;h.metrics=metrics();h.local=localFeatures();h.map.rendered=h.local;
 h.halc.anchor=(f,bounds)=>{h.metrics.anchors.push({source:f.source,id:f.properties.fid??f.properties.gid});return regionalAnchor(f,bounds);};
 if(eager){const setActive=h.halc.setActive;h.halc.setActive=function(value){if(value&&this.features.length){this.features=eagerGroup(h.local);}return setActive.call(this,value);};}
 return h;
}
function mainReady(h){activeMetrics=h.metrics;h.map.sourceReadyWithoutIdle('halc-boundaries');assert(!h.halc.active);h.map.renderFrame();assert(h.halc.active);activeMetrics=null;}
function regionReady(h){activeMetrics=h.metrics;h.map.renderedByLayer.set('halc-region-query',regionFeatures());h.map.sourceReadyWithoutIdle('halc-regions');h.map.renderFrame();assert(h.halc.regions.ready);activeMetrics=null;}
function view(h){return h.halc.markers.filter(m=>!m.removed).map(m=>{m.element.onclick({stopPropagation(){}});return {text:m.element.textContent,point:m.point,aria:m.element.getAttribute('aria-label'),title:m.element.title,width:m.element.style.maxWidth,target:h.owner.lastIndex};});}
const checks=[],observations={};async function test(name,fn){try{await fn();checks.push({name,pass:true});console.log('PASS '+name);}catch(error){checks.push({name,pass:false,error:error.stack});console.error('FAIL '+name+'\n'+error.stack);}}
let lazy,control;
try{
 await test('Locality content renders before region data and anchors every qualifying fallback candidate',async()=>{
  lazy=await setup();assert.equal(lazy.halc.regions.ready,false);const direct=halcVisibleUnits(lazy.local);assert.equal(lazy.metrics.cold['halc-boundaries']||0,0);mainReady(lazy);assert.equal(lazy.halc.regions.ready,false);assert(lazy.halc.features.length>0);
  const eligible=direct.filter(qualifies),eligibleIds=new Set(eligible.map(f=>f.properties.fid)),expectedFragments=lazy.local.filter(f=>eligibleIds.has(f.properties.fid)).length;
  assert.equal(lazy.metrics.anchors.length,eligible.length);assert.equal(lazy.metrics.cold['halc-boundaries'],expectedFragments);assert(lazy.metrics.anchors.every(a=>a.source==='halc-boundaries'));assert(lazy.halc.markers.length>0);assert(lazy.halc.markers.length<=12);
  observations.localFirst={tileFeatures:lazy.local.length,visibleUnits:direct.length,qualifyingLabelCandidates:eligible.length,geometryFragmentsDecoded:expectedFragments,displayedLabels:view(lazy)};
 });
 await test('Fallback marker names, anchors, order, sizes and group actions exactly equal eager grouping',async()=>{control=await setup({eager:true});mainReady(control);assert.deepEqual(view(lazy),view(control));assert.deepEqual(lazy.metrics.anchors,control.metrics.anchors);observations.eagerLocalGeometryConversions=control.metrics.cold['halc-boundaries'];});
 await test('Unused locality fragments stay lazy until explicitly serialized, with exact geometry preservation',()=>{activeMetrics=lazy.metrics;const got=geometryJSON(lazy.halc.features);activeMetrics=null;const expected=geometryJSON(control.halc.features);assert.equal(got,expected);assert.equal(lazy.metrics.cold['halc-boundaries'],lazy.local.length);const count=lazy.metrics.cold['halc-boundaries'];activeMetrics=lazy.metrics;assert.equal(geometryJSON(lazy.halc.features),got);activeMetrics=null;assert.equal(lazy.metrics.cold['halc-boundaries'],count);observations.exactGeometrySha256=hash(got);});
 await test('Repeated refresh in the same view performs neither additional anchors nor geometry reads',()=>{const old=JSON.stringify(lazy.metrics);activeMetrics=lazy.metrics;lazy.halc.refreshLabels();lazy.map.emit('idle');activeMetrics=null;assert.equal(JSON.stringify(lazy.metrics),old);});
 await test('Late real region tiles replace the fallback label set without changing the locality registry',()=>{const beforeIds=lazy.halc.features.map(f=>f.properties.fid),oldAnchors=lazy.metrics.anchors.length;regionReady(lazy);regionReady(control);assert.deepEqual(view(lazy),view(control));assert.deepEqual(lazy.halc.features.map(f=>f.properties.fid),beforeIds);assert(lazy.metrics.anchors.length>oldAnchors);assert(lazy.metrics.anchors.slice(oldAnchors).every(a=>a.source==='halc-regions'));observations.afterRegions={displayedLabels:view(lazy),regionGeometryConversions:lazy.metrics.cold['halc-regions']};});
 await test('Region-first arrival uses regional anchors and leaves every locality geometry fragment lazy',async()=>{const h=await setup();regionReady(h);assert(!h.halc.active);mainReady(h);assert.equal(h.metrics.cold['halc-boundaries']||0,0);assert(h.metrics.anchors.length>0);assert(h.metrics.anchors.every(a=>a.source==='halc-regions'));assert.deepEqual(view(h),view(lazy));observations.regionFirstLocalGeometryConversions=0;});
 await test('With labels hidden, locality-first arrival stays lazy; enabling labels activates the same fallback',async()=>{const h=await setup({showLabels:false});mainReady(h);assert.equal(h.metrics.cold['halc-boundaries']||0,0);assert.equal(h.metrics.anchors.length,0);h.owner.atlas.showLabels=true;activeMetrics=h.metrics;h.halc.refreshLabels();activeMetrics=null;assert.deepEqual(view(h),observations.localFirst.displayedLabels);assert.equal(h.metrics.cold['halc-boundaries'],observations.localFirst.geometryFragmentsDecoded);});
 await test('Explicit region-source failure preserves the original locality fallback labels',async()=>{const h=await setup();h.groupError();assert(h.halc.regions.failed&&!h.halc.regions.ready);mainReady(h);assert.deepEqual(view(h),observations.localFirst.displayedLabels);assert.equal(h.metrics.cold['halc-boundaries'],observations.localFirst.geometryFragmentsDecoded);});
}finally{activeMetrics=null;for(const h of live)h.destroy();restoreGlobals();}
const report={method:'Actual production halcVisibleUnits + HalcBoundaries settle/refreshLabels + HalcRegions source-order handling + regionalAnchor; shipped MapLibre lazy Feature and two real local/regional MVT tiles. Map event bus, screen projection, DOM/Marker and render/GPU boundary are deterministic test doubles. Eager control replaces the candidate grouping with the exact prior grouping before activation. No speed claim.',bundleSha256:hash(text),tilePath,localTile:{bytes:localBytes.length,sha256:hash(localBytes),features:localTile.length},regionTile:{bytes:regionBytes.length,sha256:hash(regionBytes),features:regionTile.length},conditions:'active && !loading && showLabels && anchor; zoom<8 and regions.ready===false chooses locality candidates. All candidates passing TYPE!=8, nonempty ADM1, ADM1!=XX and no semicolon are anchored before marker limit/name collision filtering, materializing all their fragment geometry.',limitations:['The viewport query returns this bounded real tile through the map fixture; viewport clipping is not independently retested.','Projection is a deterministic geographic-to-screen transform, not actual MapLibre projection or browser pixels.','Label equivalence and exact geometry are verified; CPU/GPU memory, browser latency, worldwide completeness and all source-order permutations are not claimed.','Fallback intentionally retains its eager demand for every qualifying candidate; the test does not require a speedup in that path.'],pass:checks.filter(c=>c.pass).length,fail:checks.filter(c=>!c.pass).length,observations,checks};
console.log(JSON.stringify({pass:report.pass,fail:report.fail,localFeatures:localTile.length,qualifyingCandidates:observations.localFirst?.qualifyingLabelCandidates,geometryDecoded:observations.localFirst?.geometryFragmentsDecoded,labels:observations.localFirst?.displayedLabels.length}));if(process.env.HALC_FALLBACK_REPORT)await fs.writeFile(process.env.HALC_FALLBACK_REPORT,JSON.stringify(report,null,2)+'\n');if(report.fail)process.exitCode=1;
