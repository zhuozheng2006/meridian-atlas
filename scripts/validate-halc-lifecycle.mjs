import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {writeFile,readFile} from 'node:fs/promises';
import {createActualAdapter} from './halc-test-adapter.mjs';

/* Independent lifecycle contract. It does not copy the HALC implementation.
 * This runner imports the actual HalcBoundaries class; owner/map/DOM are doubles.
 * createHarness(initial) supplies:
 *   set(patch)          changes real owner/map state and invokes update
 *   settle()            flushes only pending microtasks/one render turn
 *   snapshot()          {mode,active,visibleSource,popupId,selectedId,reason}
 *   requests()          {tiles,details,metadata}; attempted source loads and reads
 *   tilesReady()        dispatches successful source-ready/idle for this revision
 *   tileError()         dispatches a source error (while partial features exist)
 *   retry()             invokes the actual public retry path
 *   deferRecord(id)     holds the actual detail request, returns {resolve(record)}
 *   openRecord(id)      invokes the actual record-opening path, without awaiting it
 *   destroy()           invokes the real lifecycle cleanup
 *   staleWriteCount()   count of layer/popup/status writes after destroy
 *
 * Defaults below represent a viewport inside HALC coverage, not a claim about
 * source country borders. Region-outside tests must use an entirely disjoint
 * viewport; a center outside with intersecting bounds is not outside coverage.
 */
export const eligibleState=Object.freeze({mode:'halc',year:1500,zoom:7,borders:true,modern:false,inside:true});
export const lifecycleCases=[];
const add=(name,run)=>lifecycleCases.push({name,run});
const tick=async h=>{await h.settle();await h.settle();};
const hidden=h=>{assert.equal(h.snapshot().active,false);assert.notEqual(h.snapshot().visibleSource,'halc');};
const noPopup=h=>{assert.equal(h.snapshot().popupId,null);assert.equal(h.snapshot().selectedId,null);};

for(const [label,patch]of [
 ['borders hidden',{borders:false}],
 ['modern reference enabled',{modern:true}],
 ['earlier year',{year:1499}],
 ['later year',{year:1501}],
 ['just below minimum zoom',{zoom:5.999}],
 ['entire viewport outside source region',{inside:false}],
 ['another requested source',{mode:'overview'}]
])add('Initial gate: '+label,async make=>{
 const h=await make({...eligibleState,...patch});try{await tick(h);assert.equal(h.requests().tiles,0,'Constructor/update must not start an ineligible tile request');assert.equal(h.requests().details,0);assert.equal(h.requests().metadata,0,'Ineligible HALC must not fetch labels or bibliography either');hidden(h);}finally{h.destroy();}
});

add('Exact year and minimum zoom permit activation only after source readiness',async make=>{
 const h=await make({...eligibleState,zoom:6});try{await tick(h);assert(h.requests().tiles>0);hidden(h);h.tilesReady();await tick(h);assert.equal(h.snapshot().active,true);assert.equal(h.snapshot().visibleSource,'halc');assert.equal(h.snapshot().mode,'halc');}finally{h.destroy();}
});

add('Repeated pending updates do not recreate the HALC vector source',async make=>{
 const h=await make({...eligibleState});try{await tick(h);const n=h.requests().tiles;h.set({});h.set({});h.set({});await tick(h);assert.equal(h.requests().tiles,n);}finally{h.destroy();}
});

for(const [label,patch]of [
 ['year changes',{year:1492}],['mode changes',{mode:'overview'}],
 ['borders are hidden',{borders:false}],['modern reference opens',{modern:true}],
 ['zoom leaves detail scale',{zoom:5}],['viewport leaves coverage',{inside:false}]
])add('Late source readiness cannot reactivate after '+label,async make=>{
 const h=await make({...eligibleState});try{await tick(h);assert(h.requests().tiles>0);h.set(patch);await tick(h);const n=h.requests().tiles;h.tilesReady();await tick(h);hidden(h);noPopup(h);assert.equal(h.requests().tiles,n,'Ineligible refresh started another request');assert.equal(h.snapshot().mode,patch.mode||'halc','Fallback must retain the chosen source');}finally{h.destroy();}
});

add('Partial tile error falls back while preserving HALC selection and allows retry',async make=>{
 const h=await make({...eligibleState});try{await tick(h);h.tileError();await tick(h);hidden(h);assert.equal(h.snapshot().mode,'halc');assert(h.snapshot().reason,'Failure must expose an explanation');const count=h.requests().tiles;h.retry();await tick(h);assert(h.requests().tiles>count,'Retry did not issue a fresh source request');hidden(h);h.tilesReady();await tick(h);assert.equal(h.snapshot().active,true);assert.equal(h.snapshot().mode,'halc');}finally{h.destroy();}
});

add('Active HALC is hidden atomically on a source error',async make=>{
 const h=await make({...eligibleState});try{await tick(h);h.tilesReady();await tick(h);assert.equal(h.snapshot().active,true);h.tileError();await tick(h);hidden(h);noPopup(h);assert.equal(h.snapshot().mode,'halc');}finally{h.destroy();}
});

add('Moving an active view into pending tiles does not advertise a complete ready frame',async make=>{
 const h=await make({...eligibleState});try{await tick(h);h.tilesReady();await tick(h);assert.equal(h.snapshot().active,true);const prior=h.halc.features;h.beginViewportLoad();await tick(h);assert.equal(h.snapshot().active,true);assert.equal(h.snapshot().visibleSource,'halc');assert.equal(h.snapshot().reason,'updating');assert.equal(h.halc.features,prior);assert(!/visible units|条可见/.test(h.halc.title()));h.tilesReady();await tick(h);assert.equal(h.snapshot().active,true);assert.equal(h.snapshot().reason,'ready');assert(/visible units/.test(h.halc.title()));}finally{h.destroy();}
});

add('Failed active source removes its own map labels before overview fallback',async make=>{
 const h=await make({...eligibleState});try{await tick(h);h.tilesReady();await tick(h);h.enableLabels();assert(h.markerCount()>0,'Fixture did not exercise actual marker creation');h.tileError();await tick(h);hidden(h);assert.equal(h.markerCount(),0,'Stale HALC labels remain over overview');}finally{h.destroy();}
});

for(const [label,patch]of [
 ['year changes',{year:1492}],['mode changes',{mode:'overview'}],
 ['borders are hidden',{borders:false}],['modern reference opens',{modern:true}]
])add('Late record detail cannot open a popup after '+label,async make=>{
 const h=await make({...eligibleState});try{await tick(h);h.tilesReady();await tick(h);const gate=h.deferRecord(1);h.openRecord(1);await tick(h);assert(h.requests().details>0);h.set(patch);await tick(h);gate.resolve();await tick(h);noPopup(h);hidden(h);}finally{h.destroy();}
});

add('A newer record click defeats an older deferred record response',async make=>{
 const h=await make({...eligibleState});try{await tick(h);h.tilesReady();await tick(h);const first=h.deferRecord(1),second=h.deferRecord(2);h.openRecord(1);await tick(h);h.openRecord(2);await tick(h);second.resolve();await tick(h);assert.equal(String(h.snapshot().popupId),'2');first.resolve();await tick(h);assert.equal(String(h.snapshot().popupId),'2');assert.equal(String(h.snapshot().selectedId),'2');}finally{h.destroy();}
});

add('Destroy invalidates both tile readiness and an outstanding record detail',async make=>{
 const h=await make({...eligibleState});await tick(h);h.tilesReady();await tick(h);const gate=h.deferRecord(1);h.openRecord(1);await tick(h);h.destroy();gate.resolve();h.tilesReady();await tick(h);assert.equal(h.staleWriteCount(),0);noPopup(h);
});

add('A restored record waits for complete eligible geometry before opening',async make=>{
 const h=await make({...eligibleState});try{await tick(h);h.restore(1);await tick(h);noPopup(h);assert.equal(h.requests().details,0);h.tilesReady();await tick(h);assert.equal(String(h.snapshot().popupId),'1');assert.equal(String(h.snapshot().selectedId),'1');}finally{h.destroy();}
});

add('A queued restored record is discarded if the selected year changes',async make=>{
 const h=await make({...eligibleState});try{await tick(h);h.restore(1);h.set({year:1492});h.tilesReady();await tick(h);noPopup(h);assert.equal(h.requests().details,0);}finally{h.destroy();}
});

add('Native popup close invalidates an outstanding record response',async make=>{
 const h=await make({...eligibleState});try{await tick(h);h.tilesReady();await tick(h);const gate=h.deferRecord(1);h.openRecord(1);await tick(h);assert.equal(String(h.snapshot().popupId),'1');h.closePopup();gate.resolve();await tick(h);noPopup(h);}finally{h.destroy();}
});

add('Two map instances retain independent requested sources and active state',async make=>{
 const left=await make({...eligibleState}),right=await make({...eligibleState});try{await tick(left);await tick(right);left.set({mode:'overview'});right.tilesReady();left.tilesReady();await tick(left);await tick(right);assert.equal(left.snapshot().mode,'overview');hidden(left);assert.equal(right.snapshot().mode,'halc');assert.equal(right.snapshot().active,true);left.destroy();assert.equal(right.snapshot().active,true);}finally{left.destroy();right.destroy();}
});

export async function runHalcContract(createHarness){
 assert.equal(typeof createHarness,'function');const results=[];
 for(const {name,run}of lifecycleCases){try{await run(createHarness);results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack||String(error)});}}
 return {passed:results.filter(r=>r.passed).length,total:results.length,results};
}

export {HalcFakeMap} from './halc-test-map.mjs';


export function resolveProjectRoot(explicitRoot){
 const candidates=explicitRoot?[resolve(explicitRoot)]:[process.env.ATLAS_ROOT,process.cwd(),resolve(dirname(fileURLToPath(import.meta.url)),'..')].filter(Boolean);
 for(const candidate of candidates){
  const root=resolve(candidate);
  if(existsSync(resolve(root,'public/halc-boundaries.js')))return root;
 }
 throw Error('Atlas checkout not found. Run from its root, place the test in scripts/, or provide the checkout path.');
}
async function main(args){
 let projectArg,reportPath,describe=false;
 for(let i=0;i<args.length;i++){
  if(args[i]==='--describe'){describe=true;continue;}
  if(args[i]==='--report'){if(!args[i+1])throw Error('--report requires a file path');reportPath=resolve(args[++i]);continue;}
  if(args[i].startsWith('--')||projectArg)throw Error('Usage: node scripts/validate-halc-lifecycle.mjs [checkout-root] [--report report.json] [--describe]');
  projectArg=args[i];
 }
 if(describe){console.log(JSON.stringify({cases:lifecycleCases.map(x=>x.name),total:lifecycleCases.length},null,2));return;}
 const root=resolveProjectRoot(projectArg),sourcePath=resolve(root,'public/halc-boundaries.js');
 const before=await readFile(sourcePath),sourceSha256=createHash('sha256').update(before).digest('hex');
 const {createHarness,restoreGlobals}=await createActualAdapter(root);
 let result;try{result=await runHalcContract(createHarness);}finally{restoreGlobals();}
 assert.equal(createHash('sha256').update(await readFile(sourcePath)).digest('hex'),sourceSha256,'HALC implementation changed during this run; rerun against a stable revision');
 const report={checkedAt:new Date().toISOString(),method:'Actual HalcBoundaries imported; MapLibre, parent owner, DOM and network boundaries are deterministic doubles. No browser or tile-byte validation.',source:{path:'public/halc-boundaries.js',sha256:sourceSha256},...result};
 for(const item of report.results)console.log(`${item.passed?'PASS':'FAIL'} ${item.name}${item.error?'\n'+item.error:''}`);
 console.log(`${report.passed}/${report.total} HALC lifecycle checks passed`);
 if(reportPath)await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
 if(report.passed!==report.total)process.exitCode=1;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main(process.argv.slice(2)).catch(error=>{console.error(error);process.exitCode=1;});
