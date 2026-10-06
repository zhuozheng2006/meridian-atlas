import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createActualAdapter} from './halc-test-adapter.mjs';
const root=resolve(process.argv[2]||'.');
const {createHarness,restoreGlobals}=await createActualAdapter(root),results=[];
const initial={mode:'halc',year:1500,zoom:7,borders:true,modern:false,inside:true};
const feature={type:'Feature',properties:{fid:1,NAME:'Local fixture',ADM1:'AA',TYPE:1},geometry:{type:'Polygon',coordinates:[[[5,51],[5.01,51],[5.01,51.01],[5,51.01],[5,51]]]}};
const group={...feature,properties:{gid:'ADM1-AA',ADM1:'AA',memberCount:1}};
async function make(){const h=await createHarness(initial);await h.settle();h.map.rendered=[feature];h.map.renderedByLayer.set('halc-region-query',[group]);return h;}
const ready=(h,id='halc-boundaries')=>h.map.sourceReadyWithoutIdle(id);
const render=h=>h.map.renderFrame();
const both=h=>{ready(h);ready(h,'halc-regions');render(h);assert(h.halc.active&&h.halc.regions.ready);};
async function test(name,fn){let h;try{h=await make();await fn(h);results.push({name,pass:true});console.log('PASS '+name);}catch(error){results.push({name,pass:false,error:error.stack});console.error('FAIL '+name+'\n'+error.stack);}finally{h?.destroy();}}
try{
 await test('Own source ready then render activates without any global idle',h=>{ready(h);assert(!h.halc.active);render(h);assert(h.halc.active);assert.equal(h.halc.reason,'ready');assert.equal(h.snapshot().visibleSource,'halc');});
 await test('Idle cannot substitute for the first rendered source frame',h=>{ready(h);h.map.emit('idle');assert(!h.halc.active);render(h);assert(h.halc.active);});
 await test('Metadata readiness is insufficient even when the source reports loaded',h=>{h.map.getSource('halc-boundaries').loaded=true;h.map.emit('sourcedata',{sourceId:'halc-boundaries',sourceDataType:'metadata',isSourceLoaded:true});render(h);h.map.emit('idle');assert(!h.halc.active);ready(h);render(h);assert(h.halc.active);});
 await test('A render before readiness does not license a later unrendered frame',h=>{render(h);ready(h);h.map.emit('idle');assert(!h.halc.active);render(h);assert(h.halc.active);});
 await test('Region-only readiness waits for render and never requires a global idle',h=>{ready(h);render(h);assert(h.halc.active&&!h.halc.regions.ready);ready(h,'halc-regions');assert(!h.halc.regions.ready);render(h);assert(h.halc.regions.ready);assert.equal(h.map.getLayer('halc-region-edges').layout.visibility,'visible');});
 await test('Region-only completion never completes pending locality source',h=>{ready(h,'halc-regions');render(h);assert(h.halc.regions.ready);assert(!h.halc.active);assert.equal(h.map.getLayer('halc-region-edges').paint['line-opacity'],0);ready(h);render(h);assert(h.halc.active);});
 await test('Repeated source messages and unchanged render/idle do no duplicate geometry queries',h=>{both(h);let queries=0;const original=h.map.queryRenderedFeatures.bind(h.map);h.map.queryRenderedFeatures=(...a)=>{queries++;return original(...a);};for(let i=0;i<8;i++){ready(h);ready(h,'halc-regions');render(h);h.map.emit('idle');}assert.equal(queries,0);});
 await test('An unrelated source and render do not rescan either HALC geometry',h=>{both(h);let queries=0;h.map.queryRenderedFeatures=()=>{queries++;return [];};h.map.emit('sourcedataloading',{sourceId:'terrain-dem'});h.map.emit('sourcedata',{sourceId:'terrain-dem',isSourceLoaded:true,tile:{state:'loaded'}});render(h);h.map.emit('idle');assert.equal(queries,0);assert(h.halc.active&&h.halc.regions.ready);});
 await test('Moving between source-ready and render prevents completion until moveend and its render',h=>{ready(h);h.map.moving=true;h.map.isMoving=()=>h.map.moving;h.map.emit('movestart');render(h);assert(!h.halc.active);h.map.zoom=7.1;h.map.moving=false;h.map.emit('moveend');h.map.emit('idle');assert(!h.halc.active);render(h);assert(h.halc.active);assert.equal(h.halc.scanKey,h.halc.frameKey());});
 await test('A changed source epoch invalidates readiness before render',h=>{ready(h);h.beginViewportLoad();render(h);assert(!h.halc.active);ready(h);render(h);assert(h.halc.active);});
 for(const [name,away,back]of [['year',{year:1492},{year:1500}],['mode',{mode:'overview'},{mode:'halc'}],['borders',{borders:false},{borders:true}],['zoom',{zoom:5},{zoom:7}]])await test('Late render after leaving '+name+' cannot activate; return requires a new frame',h=>{ready(h);ready(h,'halc-regions');h.set(away);render(h);assert(!h.halc.active&&!h.halc.regions.ready);h.set(back);h.map.emit('idle');assert(!h.halc.active&&!h.halc.regions.ready);render(h);assert(h.halc.active&&h.halc.regions.ready);});
 await test('An active viewport update preserves the previous frame until the replacement render',h=>{both(h);const prior=h.halc.features;h.beginViewportLoad();h.map.rendered=[{...feature,properties:{...feature.properties,fid:2}}];ready(h);h.map.emit('idle');assert.equal(h.halc.reason,'updating');assert.equal(h.halc.features,prior);render(h);assert.equal(h.halc.reason,'ready');assert.deepEqual(h.halc.features.map(f=>f.properties.fid),[2]);});
 await test('Source error before render cannot reveal local or grouped geometry',h=>{ready(h);ready(h,'halc-regions');h.tileError();render(h);assert(!h.halc.active&&!h.halc.regions.hasFrame);});
 await test('Destroy cancels pending render and removes all added listeners',h=>{ready(h);ready(h,'halc-regions');h.destroy();render(h);h.map.emit('idle');assert.equal(h.staleWriteCount(),0);for(const event of ['render','sourcedata','movestart','moveend'])assert.equal(h.map.listeners.get(event)?.size||0,0);});
 await test('Two maps retain independent readiness and render barriers',async left=>{const right=await make();try{ready(left);ready(right);render(left);assert(left.halc.active&&!right.halc.active);render(right);assert(right.halc.active);}finally{right.destroy();}});
}finally{restoreGlobals();}
const report={checkedAt:new Date().toISOString(),method:'Actual HALC controllers with independent source-ready/render/idle fixture events. No browser pixels or network benchmark.',pass:results.filter(x=>x.pass).length,fail:results.filter(x=>!x.pass).length,results};
console.log(`${report.pass}/${results.length} HALC render readiness checks passed`);
if(process.env.HALC_RENDER_REPORT)await writeFile(process.env.HALC_RENDER_REPORT,JSON.stringify(report,null,2)+'\n');
if(report.fail)process.exitCode=1;
