import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const candidates=process.argv[2]?[resolve(process.argv[2])]:[process.cwd(),resolve(dirname(fileURLToPath(import.meta.url)),'..')];
const root=candidates.find(p=>existsSync(resolve(p,'public/halc-boundaries.js')));
if(!root)throw Error('Run from the atlas checkout, place this script in scripts/, or supply a checkout-root argument');
const {createActualAdapter}=await import('./halc-test-adapter.mjs');
const {regionalAnchor}=await import(pathToFileURL(resolve(root,'public/regional-boundaries.js')));
const {AtlasMap}=await import(pathToFileURL(resolve(root,'public/map-engine.js')));
const {createHarness,restoreGlobals}=await createActualAdapter(root),results=[];
const createElement=document.createElement;document.createElement=tag=>{const node=createElement(tag);if(tag==='canvas')node.getContext=()=>({measureText:text=>({width:String(text).length*7})});return node};
const feature=(id,x)=>({type:'Feature',properties:{fid:id,NAME:'Unit '+id,SHORT_ID:'UNIT'+id,ADM0:'XX',ADM1:'XX',TYPE:1,QUALITY:1},geometry:{type:'Polygon',coordinates:[[[x,51],[x+.01,51],[x+.01,51.01],[x,51.01],[x,51]]]}});
async function fixture(){
 const h=await createHarness({mode:'halc',year:1500,zoom:8,borders:true,modern:false,inside:true});await h.settle();
 const {map,halc,owner}=h,atlas=owner.atlas;let queries=0,anchors=0,writes=0;
 const view={west:4.4,south:50.5,east:5.8,north:52,width:1200,height:800,bearing:0,pitch:0};
 const container={get clientWidth(){return view.width},get clientHeight(){return view.height},getBoundingClientRect:()=>({left:0,top:0,right:view.width,bottom:view.height,width:view.width,height:view.height})};
 map.getContainer=()=>container;map.getBounds=()=>({getWest:()=>view.west,getSouth:()=>view.south,getEast:()=>view.east,getNorth:()=>view.north});map.getBearing=()=>view.bearing;map.getPitch=()=>view.pitch;
 map.rendered=[feature(1,5.02),feature(2,5.12)];
 const query=map.queryRenderedFeatures.bind(map);map.queryRenderedFeatures=(...a)=>{queries++;return query(...a)};
 for(const method of ['setLayoutProperty','setPaintProperty','setFilter']){const original=map[method].bind(map);map[method]=(...a)=>{writes++;return original(...a)}}
 halc.anchor=(...a)=>{anchors++;return regionalAnchor(...a)};
 halc.labels.localityNameLabels=[{expected:{fid:1},label:{zh:'甲地',en:'First unit'}}];
 atlas.showLabels=true;atlas.active=[];atlas.boundaries.labelRecords=()=>[];atlas.labels=[];atlas.labelBoxes=[];atlas.regional=owner;owner.refreshLabels=()=>halc.refreshLabels();atlas.refreshLabels=()=>AtlasMap.prototype.refreshLabels.call(atlas);
 map.sourceReady('halc-boundaries');assert(halc.active);assert(halc.markers.length>0);
 return Object.assign(h,{view,atlas,counts:()=>({queries,anchors,writes}),reset:()=>{queries=anchors=writes=0}});
}
async function test(name,fn){const originalQuery=document.querySelectorAll;let h;try{h=await fixture();h.reset();await fn(h);results.push({name,pass:true});console.log('PASS '+name)}catch(error){results.push({name,pass:false,error:error.stack});console.error('FAIL '+name+'\n'+error.message)}finally{h?.destroy();document.querySelectorAll=originalQuery}}
try{
 await test('Repeated unchanged idle does zero queries, anchor computations and style writes',h=>{const markers=[...h.halc.markers];for(let i=0;i<5;i++)h.map.emit('idle');assert.deepEqual(h.counts(),{queries:0,anchors:0,writes:0});assert.deepEqual(h.halc.markers,markers)});
 await test('Atlas label refresh restores cached collision boxes without recreating markers',h=>{const boxes=structuredClone(h.atlas.labelBoxes),markers=[...h.halc.markers];assert(boxes.length);h.atlas.refreshLabels();assert.deepEqual(h.atlas.labelBoxes,boxes);assert.deepEqual(h.halc.markers,markers);assert.deepEqual(h.counts(),{queries:0,anchors:0,writes:0})});
 await test('Changed viewport rescans once then returns to idle cache',h=>{h.view.west+=.01;h.map.emit('idle');assert.equal(h.counts().queries,1);assert(h.counts().anchors>0);h.reset();h.map.emit('idle');assert.deepEqual(h.counts(),{queries:0,anchors:0,writes:0})});
 await test('Resize invalidates viewport and collision caches',h=>{h.view.width=1000;h.map.emit('idle');assert.equal(h.counts().queries,1);assert(h.counts().anchors>0);assert(h.atlas.labelBoxes.every(b=>b.right<=1000))});
 await test('Bearing and pitch participate in the view cache key',h=>{h.view.bearing=15;h.view.pitch=20;h.map.emit('idle');assert.equal(h.counts().queries,1);assert(h.counts().anchors>0)});
 await test('Language updates labels without a geometry query',h=>{h.owner.lang='bi';h.halc.refreshLabels();assert(h.halc.markers.some(m=>m.element.textContent.includes('甲地')));assert.equal(h.counts().queries,0);assert(h.counts().anchors>0)});
 await test('Changed overlay blockers invalidate cached marker placement',h=>{document.querySelectorAll=()=>[{getClientRects:()=>[1],getBoundingClientRect:()=>({left:0,top:0,right:1200,bottom:800})}];h.halc.refreshLabels();assert.equal(h.halc.markers.length,0);assert.equal(h.counts().queries,0);assert(h.counts().anchors>0)});
 await test('Label hide and show cannot reuse an empty marker cache',h=>{h.atlas.showLabels=false;h.halc.refreshLabels();assert.equal(h.halc.markers.length,0);h.atlas.showLabels=true;h.halc.refreshLabels();assert(h.halc.markers.length>0)});
 await test('New source load invalidates same-fid geometry and cached labels',h=>{const before=h.halc.markers[0].point[0];h.map.getSource('halc-boundaries').loaded=false;h.map.emit('sourcedataloading',{sourceId:'halc-boundaries'});assert.equal(h.halc.active,false);h.map.rendered=[feature(1,5.06)];h.map.sourceReady('halc-boundaries');assert.equal(h.halc.active,true);assert.equal(h.counts().queries,1);assert.notEqual(h.halc.markers[0].point[0],before)});
 for(const [name,away,back]of [['mode',{mode:'overview'},{mode:'halc'}],['year',{year:1499},{year:1500}],['modern reference',{modern:true},{modern:false}],['border visibility',{borders:false},{borders:true}]])await test('Returning from '+name+' reactivates the unchanged viewport',h=>{h.set(away);assert.equal(h.halc.active,false);h.set(back);assert.equal(h.halc.active,true);assert(h.halc.features.length>0);assert(h.halc.markers.length>0)});
 await test('Source readiness fallback without a loading event cannot strand the scan cache',h=>{h.map.getSource('halc-boundaries').loaded=false;h.halc.update();assert.equal(h.halc.active,false);h.map.sourceReady('halc-boundaries');assert.equal(h.halc.active,true);assert(h.halc.features.length>0)});
 await test('Retry recreates visible source layers instead of reusing old visibility state',h=>{h.tileError();h.retry();h.map.rendered=[feature(1,5.02)];h.map.sourceReady('halc-boundaries');assert(h.halc.active);assert.equal(h.map.getLayer('halc-edges').layout.visibility,'visible');assert(h.halc.features.length>0)});
}finally{restoreGlobals()}
const source=await readFile(resolve(root,'public/halc-boundaries.js'));const report={method:'Actual HalcBoundaries, regionalAnchor and AtlasMap.refreshLabels; deterministic owner, map, DOM and load interfaces.',sourceSha256:createHash('sha256').update(source).digest('hex'),pass:results.filter(r=>r.pass).length,fail:results.filter(r=>!r.pass).length,results};
console.log(`${report.pass}/${results.length} HALC cache checks passed`);if(process.env.HALC_CACHE_REPORT)await writeFile(process.env.HALC_CACHE_REPORT,JSON.stringify(report,null,2)+'\n');if(report.fail)process.exitCode=1;
