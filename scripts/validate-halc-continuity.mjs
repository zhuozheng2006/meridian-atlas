import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createActualAdapter} from './halc-test-adapter.mjs';

const roots=process.argv[2]?[resolve(process.argv[2])]:[process.cwd(),resolve(dirname(fileURLToPath(import.meta.url)),'..')];
const root=roots.find(p=>existsSync(resolve(p,'public/halc-boundaries.js')));
if(!root)throw Error('Run from the atlas checkout, place in scripts/, or supply a checkout-root argument');
const files=['halc-boundaries.js','halc-regions.js','regional-boundaries.js'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(resolve(root,'public',f))).digest('hex')])));
const before=await hashes();
const {RegionalBoundaries}=await import(pathToFileURL(resolve(root,'public/regional-boundaries.js')));
const {createHarness,restoreGlobals}=await createActualAdapter(root),results=[];
const createElement=document.createElement;
document.createElement=tag=>{const n=createElement(tag);n.value='';n.scrollTop=0;return n;};
const initial={mode:'halc',year:1500,zoom:7,borders:true,modern:false,inside:true};
const tick=async h=>{await h.settle();await h.settle();};
const ink=(h,id='halc-region-edges')=>{const l=h.map.getLayer(id);return l?.layout?.visibility==='none'||l?.paint?.['line-opacity']===0?'none':'visible';};
async function make(patch={}){const h=await createHarness({...initial,...patch});await tick(h);return h;}
async function both(h){h.tilesReady();h.groupReady();await tick(h);assert(h.halc.active&&h.halc.regions.ready&&h.halc.regions.hasFrame);}
function updating(h){assert.equal(h.halc.active,true);assert.equal(h.halc.reason,'updating');assert.equal(h.snapshot().visibleSource,'halc');assert.equal(ink(h,'halc-edges'),'visible');assert(!/visible units|条可见/.test(h.halc.title()),'Stale visible-count claim during an incomplete frame');}
function hardOff(h){assert.equal(h.halc.active,false);assert.equal(h.halc.features.length,0);assert.equal(h.halc.regions.hasFrame,false);assert.equal(h.halc.regions.ready,false);assert.equal(h.snapshot().popupId,null);assert.equal(ink(h),'none');assert.equal(ink(h,'halc-edges'),'none');}
function workCounter(h){const counts={query:0,style:0,anchor:0};const query=h.map.queryRenderedFeatures.bind(h.map);h.map.queryRenderedFeatures=(...a)=>{counts.query++;return query(...a);};for(const k of ['setPaintProperty','setLayoutProperty']){const f=h.map[k].bind(h.map);h.map[k]=(...a)=>{counts.style++;return f(...a);};}const anchor=h.halc.anchor;h.halc.anchor=(...a)=>{counts.anchor++;return anchor?.(...a);};return counts;}
async function test(name,fn){let h;try{h=await make();await fn(h);results.push({name,pass:true});console.log('PASS '+name);}catch(e){results.push({name,pass:false,error:e.stack});console.error('FAIL '+name+'\n'+e.message);}finally{h?.destroy();}}
function walk(node){return [node,...(node.children||[]).filter(n=>typeof n==='object').flatMap(walk)];}
function cls(node,name){return walk(node).find(n=>n.className===name);}
function wireActualIndex(h){
 h.owner.openIndex=RegionalBoundaries.prototype.openIndex;
 // openIndex also asks the frozen-source layer for its uncovered-polity notice. The
 // harness owner is a stub, so bind that method too: with no frozen metadata loaded it
 // returns null, exactly as it does in the app before data/ohm-1500 is read.
 h.owner.ohmGapNotice=RegionalBoundaries.prototype.ohmGapNotice;
 const close=h.owner.closePopup.bind(h.owner);h.owner.closePopup=()=>{h.owner.indexRefresh=null;close();};
 h.owner.setStatus=function(status){this.status=status;this.indexRefresh?.();};
}
async function groupedFrame(h){
 await both(h);h.map.getSource('halc-boundaries').loaded=false;h.map.emit('sourcedataloading',{sourceId:'halc-boundaries'});
 h.map.rendered=h.halc.features.map(f=>({...f,properties:{...f.properties,ADM1:'AA'}}));h.map.sourceReady('halc-boundaries');await tick(h);
}

try{
 await test('Initial loading cannot display or claim a completed historical frame',async h=>{
  assert.equal(h.halc.active,false);assert.equal(h.halc.reason,'loading');assert.equal(h.halc.features.length,0);assert.equal(h.halc.regions.hasFrame,false);
  h.groupReady();await tick(h);assert.equal(h.halc.active,false);assert.equal(ink(h),'none');
  h.tilesReady();await tick(h);assert(h.halc.active&&h.halc.regions.hasFrame);
 });
 await test('Pan/zoom loading retains committed frame, detail ink, selection and local dossier',async h=>{
  await both(h);h.openRecord(1);await tick(h);const features=h.halc.features,popup=h.halc.popup,selection=structuredClone(h.map.getLayer('halc-selected').filter),opacity=structuredClone(h.map.getLayer('halc-edges').paint['line-opacity']);
  h.beginViewportLoad();await tick(h);updating(h);assert.equal(h.halc.features,features);assert.equal(h.halc.popup,popup);assert.equal(String(h.halc.selectedId),'1');assert.deepEqual(h.map.getLayer('halc-selected').filter,selection);assert.equal(ink(h),'visible');assert.deepEqual(h.map.getLayer('halc-edges').paint['line-opacity'],opacity);
 });
 await test('Pending idles do zero source queries, style writes and anchor calculations',async h=>{
  await both(h);h.enableLabels();h.beginViewportLoad();assert.equal(h.markerCount(),0);const counts=workCounter(h);
  for(let i=0;i<8;i++)h.map.emit('idle');assert.deepEqual(counts,{query:0,style:0,anchor:0});updating(h);assert.equal(h.markerCount(),0);
 });
 await test('Explicit label refresh while main loading cannot recreate stale labels',async h=>{
  await both(h);h.enableLabels();assert(h.markerCount());h.beginViewportLoad();h.halc.refreshLabels();assert.equal(h.markerCount(),0);updating(h);
 });
 await test('A missing loading event still preserves frame but invalidates completion and labels',async h=>{
  await both(h);h.enableLabels();const features=h.halc.features;h.map.getSource('halc-boundaries').loaded=false;h.halc.update();updating(h);assert.equal(h.halc.features,features);assert.equal(h.markerCount(),0);
  h.map.rendered=[h.map.rendered[1]];h.map.sourceReady('halc-boundaries');await tick(h);assert.equal(h.halc.reason,'ready');assert.deepEqual(h.halc.features.map(f=>f.properties.fid),[2]);assert(h.markerCount());
 });
 await test('Group loading retains committed group ink and stable local-opacity hierarchy',async h=>{
  await both(h);h.enableGroupLabels();const opacity=structuredClone(h.map.getLayer('halc-edges').paint['line-opacity']);h.beginGroupLoad();assert.equal(h.halc.regions.ready,false);assert(h.halc.regions.hasFrame);assert.equal(h.halc.regions.features.length,0);assert.equal(ink(h),'visible');assert.equal(h.markerCount(),0);assert.deepEqual(h.map.getLayer('halc-edges').paint['line-opacity'],opacity);
 });
 await test('Repeated group-loading events retain ink without style or geometry work',async h=>{
  await both(h);h.beginGroupLoad();const counts=workCounter(h);for(let i=0;i<8;i++)h.beginGroupLoad();assert.deepEqual(counts,{query:0,style:0,anchor:0});assert(h.halc.regions.hasFrame);assert.equal(h.halc.regions.ready,false);assert.equal(ink(h),'visible');
 });
 await test('Group readiness cannot complete a still-pending main frame',async h=>{
  await both(h);const prior=h.halc.features;h.beginViewportLoad();h.beginGroupLoad();h.groupReady();await tick(h);updating(h);assert.equal(h.halc.features,prior);assert(h.halc.regions.hasFrame);assert.equal(ink(h),'visible');
  h.tilesReady();await tick(h);assert.equal(h.halc.reason,'ready');assert(h.halc.regions.ready);
 });
 await test('Main readiness with a pending group retains old group ink until group refresh',async h=>{
  await both(h);h.beginViewportLoad();h.beginGroupLoad();h.tilesReady();await tick(h);assert.equal(h.halc.reason,'ready');assert.equal(h.halc.regions.ready,false);assert(h.halc.regions.hasFrame);assert.equal(ink(h),'visible');h.groupReady();await tick(h);assert(h.halc.regions.ready);
 });
 await test('Low-zoom hit during main update opens its local record, never an incomplete group',async h=>{
  await both(h);const f={...h.halc.features[0],properties:{...h.halc.features[0].properties,ADM1:'AA'}};h.beginViewportLoad();h.halc.openHit(f);await tick(h);assert.equal(h.owner.lastIndex,undefined);assert.equal(String(h.halc.selectedId),'1');updating(h);
 });
 await test('Ready low-zoom hit still opens the source-attribution directory',async h=>{
  await both(h);const f={...h.halc.features[0],properties:{...h.halc.features[0].properties,ADM1:'AA'}};h.halc.openHit(f);assert.deepEqual(h.owner.lastIndex,{halcGroup:'AA'});assert.equal(h.halc.selectedId??null,null);
 });
 await test('Actual open directory keeps its row nodes, search and scroll during updating',async h=>{
  await groupedFrame(h);wireActualIndex(h);h.owner.openIndex({halcGroup:'AA'});const popup=h.owner.popup,node=popup.node,list=cls(node,'historical-record-list'),search=cls(node,'regional-search'),count=cls(node,'historical-credit');
  search.value='Test';search.oninput();list.scrollTop=87;const rows=[...list.children];assert.equal(rows.length,2);assert.match(count.textContent,/2 visible local units/);
  h.beginViewportLoad();await tick(h);assert.equal(h.owner.popup,popup);assert.equal(search.value,'Test');assert.equal(list.scrollTop,87);assert.equal(list.children.length,rows.length);rows.forEach((row,i)=>assert.equal(list.children[i],row,'Loading must not destroy focused directory rows'));assert.match(count.textContent,/2 previously loaded local records/);assert.match(node.textContent,/Previously loaded local records remain available/);assert(!/visible local units/.test(count.textContent));
  for(let i=0;i<5;i++)h.map.emit('idle');assert.equal(list.children.length,rows.length);rows.forEach((row,i)=>assert.equal(list.children[i],row));assert.equal(list.scrollTop,87);
  h.map.rendered=[h.halc.features[1]];h.map.sourceReady('halc-boundaries');await tick(h);assert.equal(h.owner.popup,popup);assert.equal(list.children.length,1);assert.match(count.textContent,/1 visible local units/);assert.equal(search.value,'Test');assert.equal(list.scrollTop,87);
 });
 await test('A deferred dossier response may fill the same still-eligible updating popup',async h=>{
  await both(h);const gate=h.deferRecord(1);h.openRecord(1);await tick(h);const popup=h.halc.popup;assert.match(popup.node.textContent,/Loading this local record/);h.beginViewportLoad();gate.resolve();await tick(h);updating(h);assert.equal(h.halc.popup,popup);assert.match(popup.node.textContent,/Snapshot year/);assert(!/Loading this local record/.test(popup.node.textContent));
 });
 for(const [name,away,back]of [['year',{year:1492},{year:1500}],['mode',{mode:'overview'},{mode:'halc'}],['borders',{borders:false},{borders:true}],['modern reference',{modern:true},{modern:false}],['zoom',{zoom:5},{zoom:7}],['coverage',{inside:false},{inside:true}]]){
  await test('Leaving '+name+' clears continuous frames and rejects late data/dossiers',async h=>{
   await both(h);const gate=h.deferRecord(1);h.openRecord(1);await tick(h);h.beginViewportLoad();h.beginGroupLoad();h.set(away);hardOff(h);gate.resolve();h.tilesReady();h.groupReady();await tick(h);hardOff(h);
   h.set(back);assert.equal(h.halc.active,false,'Returning must wait for a rendered frame');h.map.renderFrame();await tick(h);assert(h.halc.active&&h.halc.regions.ready&&h.halc.regions.hasFrame);assert.equal(h.halc.reason,'ready');assert.equal(h.snapshot().popupId,null);
  });
 }
 await test('Main source error clears all continuous frame state and rejects late readiness',async h=>{
  await both(h);h.openRecord(1);await tick(h);h.beginViewportLoad();h.tileError();await tick(h);assert(h.halc.failed);assert.equal(h.halc.reason,'error');hardOff(h);h.tilesReady();h.groupReady();await tick(h);hardOff(h);assert.equal(h.halc.reason,'error');
  h.retry();await tick(h);assert.equal(h.halc.active,false);assert.equal(h.halc.regions.hasFrame,false);h.tilesReady();h.groupReady();await tick(h);assert(h.halc.active&&h.halc.regions.hasFrame);
 });
 await test('Group error discards only group ink, preserves pending local dossier, and retries separately',async h=>{
  await both(h);h.openRecord(1);await tick(h);const popup=h.halc.popup,source=h.map.getSource('halc-boundaries'),requests=h.requests().mainTiles;h.beginViewportLoad();h.beginGroupLoad();h.groupError();await tick(h);updating(h);assert.equal(h.halc.regions.hasFrame,false);assert.equal(ink(h),'none');assert.equal(h.halc.popup,popup);h.retry();assert.equal(h.map.getSource('halc-boundaries'),source);assert.equal(h.requests().mainTiles,requests);assert.equal(h.halc.popup,popup);h.tilesReady();h.groupReady();await tick(h);assert(h.halc.active&&h.halc.regions.ready);
 });
 await test('A completed empty main viewport legitimately falls back instead of holding a stale frame',async h=>{
  await both(h);h.beginViewportLoad();h.map.rendered=[];h.map.sourceReady('halc-boundaries');await tick(h);assert.equal(h.halc.active,false);assert.equal(h.halc.reason,'empty');assert.equal(h.halc.features.length,0);assert.equal(h.snapshot().visibleSource,'cliopatria');assert.equal(ink(h),'none');
 });
 await test('Pending destroy removes listeners and rejects both source and dossier callbacks',async h=>{
  await both(h);const gate=h.deferRecord(1);h.openRecord(1);await tick(h);h.beginViewportLoad();h.beginGroupLoad();h.destroy();gate.resolve();h.tilesReady();h.groupReady();h.map.emit('sourcedataloading',{sourceId:'halc-regions'});await tick(h);assert.equal(h.staleWriteCount(),0);assert.equal(h.snapshot().popupId,null);for(const event of ['idle','sourcedataloading','error'])assert.equal(h.map.listeners.get(event)?.size||0,0);
 });
 await test('Two maps keep independent committed frames during loading and failure',async left=>{
  const right=await make();try{await both(left);await both(right);left.beginViewportLoad();right.tileError();updating(left);assert.equal(right.halc.active,false);assert.equal(ink(left),'visible');left.tilesReady();await tick(left);assert.equal(left.halc.reason,'ready');assert.equal(right.halc.reason,'error');}finally{right.destroy();}
 });
}finally{restoreGlobals();}
assert.deepEqual(await hashes(),before,'Implementation changed during run; rerun against a stable revision');
const report={checkedAt:new Date().toISOString(),method:'Actual HalcBoundaries, HalcRegions and RegionalBoundaries.openIndex with deterministic MapLibre/DOM/network interfaces. Tests state and event ordering; does not establish real retained-tile pixels or network failure semantics.',sources:before,pass:results.filter(r=>r.pass).length,fail:results.filter(r=>!r.pass).length,results};
console.log(`${report.pass}/${results.length} HALC continuity checks passed`);
if(process.env.HALC_CONTINUITY_REPORT)await writeFile(process.env.HALC_CONTINUITY_REPORT,JSON.stringify(report,null,2)+'\n');
if(report.fail)process.exitCode=1;
