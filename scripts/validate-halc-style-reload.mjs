/** Real bundled MapLibre Style/StyleLayer, actual HALC controllers; no GPU/network. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(process.argv[2]||'.');
await import('../public/assets/maplibre-gl.js');
const RealStyle=globalThis.maplibregl.Style;
const {createActualAdapter}=await import('./halc-test-adapter.mjs');
const {createHarness,restoreGlobals}=await createActualAdapter(root),results=[];
const initial={mode:'halc',year:1500,zoom:7,borders:true,modern:false,inside:true};
const feature={type:'Feature',properties:{fid:1,NAME:'Fixture',ADM1:'AA',TYPE:1},geometry:{type:'Polygon',coordinates:[[[5,51],[5.01,51],[5.01,51.01],[5,51.01],[5,51]]]}};
function wireStyle(h){
 const style=Object.create(RealStyle.prototype),pauses=[];
 Object.assign(style,{_loaded:true,_layers:{},_order:[],_updatedLayers:{},_removedLayers:{},_updatedSources:{},_updatedPaintProps:{},_globalState:{},sourceCaches:Object.fromEntries([...h.map.sources].map(([id])=>[id,{getSource:()=>({type:'vector'}),pause(){pauses.push(id)},setEventedParent(){}}])),map:{}});
 style._validate=()=>false;
 for(const layer of h.map.layers.values())style.addLayer(structuredClone(layer));
 for(const method of ['setPaintProperty','setLayoutProperty','setFilter']){const original=h.map[method].bind(h.map);h.map[method]=(...a)=>{style[method](...a);return original(...a);};}
 const reset=()=>{style._updatedSources={};style._updatedLayers={};style._updatedPaintProps={};pauses.length=0;};reset();
 return {style,reset,assertNoReload(){assert.deepEqual(style._updatedSources,{});assert.deepEqual(pauses,[]);}};
}
async function make(){const h=await createHarness(initial);await h.settle();h.map.rendered=[feature];h.map.renderedByLayer.set('halc-region-query',[{...feature,properties:{gid:'ADM1-AA',ADM1:'AA'}}]);return Object.assign(h,{engine:wireStyle(h)});}
const ready=(h,id='halc-boundaries')=>h.map.sourceReadyWithoutIdle(id),render=h=>h.map.renderFrame();
const value=(h,id,property,zoom=7,props={})=>h.engine.style.getLayer(id)._transitionablePaint._values[property].value.expression.evaluate({zoom},{properties:props},{});
async function test(name,fn){let h;try{h=await make();await fn(h);results.push({name,pass:true});console.log('PASS '+name);}catch(error){results.push({name,pass:false,error:error.stack});console.error('FAIL '+name+'\n'+error.stack);}finally{h?.destroy();}}
try{
 await test('Actual bundled MapLibre confirms layout visibility change reloads vector source',h=>{h.engine.style.setLayoutProperty('halc-edges','visibility','none');assert.equal(h.engine.style._updatedSources['halc-boundaries'],'reload');});
 await test('Actual bundled MapLibre confirms old data-driven opacity activation reloads source',h=>{h.engine.style.setPaintProperty('halc-wash','fill-opacity',['case',['==',['get','TYPE'],8],.05,.24]);assert.equal(h.engine.style._updatedSources['halc-boundaries'],'reload');});
 await test('Eligible initial layers have built layout buckets and zero visible ink',h=>{for(const id of ['halc-wash','halc-edges','halc-independent-edges','halc-selected','halc-region-edges']){assert.equal(h.map.getLayer(id).layout?.visibility??'visible','visible');assert.equal(value(h,id,id==='halc-wash'?'fill-opacity':'line-opacity'),0);}});
 await test('Initial locality takeover after render does not reload any vector source',h=>{ready(h);assert(!h.halc.active);render(h);assert(h.halc.active);h.engine.assertNoReload();assert.equal(value(h,'halc-wash','fill-opacity'),.24);});
 await test('Late group completion preserves source buckets and local detail frame',h=>{ready(h);render(h);h.engine.reset();ready(h,'halc-regions');render(h);assert(h.halc.active&&h.halc.regions.ready);h.engine.assertNoReload();assert(value(h,'halc-region-edges','line-opacity')>0);});
 await test('Group-first then locality activation also causes zero reparsing',h=>{ready(h,'halc-regions');render(h);assert(!h.halc.active);h.engine.assertNoReload();ready(h);render(h);assert(h.halc.active&&h.halc.regions.ready);h.engine.assertNoReload();});
 await test('Water and land fill retain the original effective opacity',h=>{ready(h);render(h);const opacity=value(h,'halc-wash','fill-opacity'),water=value(h,'halc-wash','fill-color',7,{TYPE:8,ADM1:'AA'}),land=value(h,'halc-wash','fill-color',7,{TYPE:1,ADM1:'AA'});assert(Math.abs(water.a*opacity-.05)<1e-12);assert(Math.abs(land.a*opacity-.24)<1e-12);assert(Math.abs(water.r/water.a-120/255)<1e-12);assert(Math.abs(water.g/water.a-150/255)<1e-12);assert(Math.abs(water.b/water.a-155/255)<1e-12);});
 await test('Local and independent line opacity retains all original zoom stops without group outlines',h=>{ready(h);render(h);for(const [z,expected]of [[6,.04],[8,.16],[11,.5],[15,.65]])for(const id of ['halc-edges','halc-independent-edges'])assert.equal(value(h,id,'line-opacity',z),expected);});
 await test('Grouped line hierarchy retains every zoom stop and independent-unit emphasis',h=>{ready(h);ready(h,'halc-regions');render(h);for(const [z,ordinary,independent]of [[6,.015,.5],[8,.1,.6],[11,.45,.45],[15,.65,.65]]){assert.equal(value(h,'halc-edges','line-opacity',z),ordinary);assert.equal(value(h,'halc-independent-edges','line-opacity',z),independent);}h.engine.assertNoReload();});
 await test('Ordinary and XX-composite fixed filters partition each locality exactly once',h=>{const a=h.engine.style.getLayer('halc-edges')._featureFilter.filter,b=h.engine.style.getLayer('halc-independent-edges')._featureFilter.filter;for(const ADM1 of ['AA','XX','AA;XX','XX;BB','AAXX','',null]){const f={type:3,properties:{ADM1}};assert.notEqual(a({zoom:7},f),b({zoom:7},f));assert.equal(Boolean(b({zoom:7},f)),String(ADM1||'').split(';').includes('XX'));}});
 await test('Empty loaded viewport keeps all eligible ink invisible without reparsing',h=>{h.map.rendered=[];ready(h);render(h);assert(!h.halc.active);assert.equal(h.halc.reason,'empty');h.engine.assertNoReload();for(const id of ['halc-edges','halc-independent-edges','halc-selected','halc-region-edges'])assert.equal(value(h,id,'line-opacity'),0);});
 await test('Unchanged ready render and idle retain zero source/style reparses',h=>{ready(h);ready(h,'halc-regions');render(h);h.engine.reset();for(let i=0;i<8;i++){h.map.emit('idle');render(h);}h.engine.assertNoReload();});
 await test('Leaving eligibility still hides every layer and rejects late render',h=>{ready(h);render(h);h.set({year:1492});ready(h,'halc-regions');render(h);assert(!h.halc.active);for(const id of ['halc-wash','halc-edges','halc-independent-edges','halc-selected','halc-region-query','halc-region-edges'])assert.equal(h.map.getLayer(id).layout.visibility,'none');});
}finally{restoreGlobals();}
const bundle=await readFile(resolve(root,'public/assets/maplibre-gl.js'));
const report={checkedAt:new Date().toISOString(),method:'Executes production bundled MapLibre 5.6.2 Style.addLayer, real StyleLayer paint expression compiler/evaluator, setPaintProperty, setLayoutProperty, and _updateLayer, attached to actual HALC controller mutations. Source workers/GPU are replaced; no pixel or wall-time claim.',maplibreSha256:createHash('sha256').update(bundle).digest('hex'),pass:results.filter(r=>r.pass).length,fail:results.filter(r=>!r.pass).length,results};
console.log(`${report.pass}/${results.length} HALC real-style reload checks passed`);if(process.env.HALC_STYLE_REPORT)await writeFile(process.env.HALC_STYLE_REPORT,JSON.stringify(report,null,2)+'\n');if(report.fail)process.exitCode=1;
