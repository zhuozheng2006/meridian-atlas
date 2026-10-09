/** Bounded real-region-MVT benchmark: no browser, QRF simulation or geometry reduction. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {resolve,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
const root=resolve(process.argv[2]||fileURLToPath(new URL('../',import.meta.url)));
const {halcVisibleRegions}=await import(pathToFileURL(resolve(root,'public/halc-regions.js')));
const {regionalAnchor}=await import(pathToFileURL(resolve(root,'public/regional-boundaries.js')));
const {createExactLabelScheduler}=await import(pathToFileURL(resolve(root,'public/halc-label-scheduler.js')));
const hash=v=>createHash('sha256').update(v).digest('hex'),bundle=await fs.readFile(resolve(root,'public/assets/maplibre-gl.js'),'utf8'),hook='modules.shared(sharedModule);';assert.equal(bundle.split(hook).length,2);
const sandbox=vm.createContext({console,setTimeout,clearTimeout,performance,TextEncoder,TextDecoder,URL,AbortController,Blob});vm.runInContext(bundle.replace(hook,hook+'globalThis.shared=sharedModule;'),sandbox);
const shared=sandbox.shared,Feature=shared.ac,descriptor=Object.getOwnPropertyDescriptor(Feature.prototype,'geometry');let metrics=null;
Object.defineProperty(Feature.prototype,'geometry',{...descriptor,get(){if(metrics){metrics.reads++;if(this._geometry===undefined)metrics.cold++;}return descriptor.get.call(this);}});
const metricsFor=()=>({reads:0,cold:0});
const files=[];for(const x of [32,33])for(const y of [20,21,22]){const file=`6/${x}/${y}.pbf`,bytes=await fs.readFile(resolve(root,'public/data/halc-regions/tiles',file)),tile=new shared.cL(new shared.cM(bytes));files.push({file,z:6,x,y,layer:tile.layers.halc_regions,bytes,sha256:hash(bytes)});}
const fresh=tile=>Array.from({length:tile.layer?.length||0},(_,i)=>{const v=tile.layer.feature(i),f=new Feature(v,tile.z,tile.x,tile.y,v.properties.gid);f.source='halc-regions';f.sourceLayer='halc_regions';f.layer={id:'halc-region-query'};f.state={};return f;});
function eager(rendered){const groups=new Map();for(const f of rendered){const id=f.properties.gid;if(!id)continue;if(!groups.has(id))groups.set(id,{...f,fragments:[]});groups.get(id).fragments.push(f.geometry);}return [...groups.values()];}
const qualified=f=>f.properties.TYPE!==8&&f.properties.ADM1&&f.properties.ADM1!=='XX'&&!f.properties.ADM1.includes(';');
const plainGeometry=groups=>JSON.stringify(groups.map(f=>({properties:f.properties,fragments:f.fragments})));
const pointCount=value=>Array.isArray(value)?typeof value[0]==='number'?1:value.reduce((n,v)=>n+pointCount(v),0):0;
const timings=[],checks=[];
async function test(name,fn){try{await fn();checks.push({name,pass:true});console.log('PASS '+name);}catch(error){checks.push({name,pass:false,error:error.stack});console.error('FAIL '+name+'\n'+error.stack);}}
for(const spec of [
 {name:'north small tile',tiles:files.filter(t=>t.x===32&&t.y===20),box:[0,52.45,5.625,55.8]},
 {name:'largest center tile',tiles:files.filter(t=>t.x===32&&t.y===21),box:[.5,48.5,5.7,54.1]},
 {name:'all six z6 tiles, exact cross-tile grouping',tiles:files,box:[.5394,48.54,8.352,54.025]}
])await test(spec.name+': zero-decode grouping, full anchors and exact complete geometry preservation',async()=>{
 const a=spec.tiles.flatMap(fresh),am=metricsFor();metrics=am;let start=performance.now();const old=eager(a),eagerGroupMs=performance.now()-start;metrics=null;
 const b=spec.tiles.flatMap(fresh),bm=metricsFor();metrics=bm;start=performance.now();const next=halcVisibleRegions(b),lazyGroupMs=performance.now()-start;assert.equal(bm.cold,0);assert.equal(bm.reads,0);
 assert.deepEqual(next.map(f=>f.properties.gid),old.map(f=>f.properties.gid));assert.deepEqual(next.map(f=>f.fragments.length),old.map(f=>f.fragments.length));
 const metadata=next.map(f=>({...f,properties:{...f.properties}}));assert.equal(bm.cold,0);assert.equal(bm.reads,0);assert.equal(metadata.length,old.length);
 for(let i=0;i<next.length;i++){assert.deepEqual(Object.keys(next[i]),Object.keys(old[i]));assert.deepEqual(next[i].properties,old[i].properties);}
 metrics=null;const eligibleOld=old.filter(qualified),eligibleNext=next.filter(qualified);
 const oldRows=eligibleOld.map((f,index)=>({f,index,anchor:regionalAnchor(f,spec.box)})).filter(r=>r.anchor).sort((a,b)=>b.anchor.score-a.anchor.score||a.index-b.index);
 metrics=bm;const scheduler=createExactLabelScheduler({anchor:regionalAnchor}),job=scheduler.request({key:spec.name,features:eligibleNext,box:spec.box});const rows=await job.promise;metrics=null;
 const asPlain=rows=>JSON.parse(JSON.stringify(rows.map(r=>({gid:r.f.properties.gid,index:r.index,anchor:r.anchor}))));assert.deepEqual(asPlain(rows),asPlain(oldRows));
 const labelCold=bm.cold,labelReads=bm.reads;assert.equal(job.stats.computed,eligibleNext.length);assert.equal(job.stats.canceled,false);
 metrics=bm;const json=plainGeometry(next);assert.equal(json,plainGeometry(old));assert.equal(bm.cold,b.length);const once=bm.cold;assert.equal(plainGeometry(next),json);assert.equal(bm.cold,once);metrics=null;
 // Each requested entry memoizes the original Feature.geometry object itself.
 for(let i=0;i<next.length;i++)for(let j=0;j<next[i].fragments.length;j++)assert.equal(next[i].fragments[j],Object.getOwnPropertyDescriptor(next[i].fragments,String(j)).value);
 const points=next.reduce((n,f)=>n+f.fragments.reduce((m,g)=>m+pointCount(g.coordinates),0),0);
 timings.push({name:spec.name,fragments:b.length,groups:next.length,points,qualifyingGroups:eligibleNext.length,eagerGroupMs,lazyGroupMs,eagerColdGeometry:am.cold,lazyColdBeforeLabels:0,labelColdGeometry:labelCold,labelGeometryReads:labelReads,remainingUndecodedBeforeFullSerialization:b.length-labelCold,allFragmentsAfterSerialization:bm.cold,labels:{...job.stats},exactGeometrySha256:hash(json),geometryJsonBytes:Buffer.byteLength(json)});scheduler.destroy();
});
const payload=[];for(const dataset of ['halc','halc-regions'])for(const tile of files){const bytes=dataset==='halc-regions'?tile.bytes:await fs.readFile(resolve(root,'public/data',dataset,'tiles',tile.file)),start=performance.now(),gzip=gzipSync(bytes,{level:6,mtime:0}),gzipMs=performance.now()-start;assert.deepEqual(gunzipSync(gzip),bytes);payload.push({dataset,file:tile.file,rawBytes:bytes.length,gzipBytes:gzip.length,gzipMs,sha256:hash(bytes)});}
const report={method:'Actual shipped MapLibre v5.6.2 Feature geometry getter and MVT parser; exact production regionalAnchor and label scheduler. Production halcVisibleRegions vs exact preceding eager loop. Bounded one cold grouping per side and one full exact label pass per view; no browser, tile request, GPU or queryRenderedFeatures latency claim.',bundleSha256:hash(bundle),checks,pass:checks.filter(x=>x.pass).length,fail:checks.filter(x=>!x.pass).length,tiles:files.map(({layer,bytes,...t})=>({...t,bytes:bytes.length,features:layer?.length||0})),timings,payload,limits:['Full z6 tile membership is larger than a specific rendered viewport; no features are truncated.','Cold eager grouping runs before cold lazy grouping; JIT/GC/system load affect timings.','Low-zoom selected group geometries are deferred into existing exact-label slices; a large single region anchor is indivisible and can exceed budget.','Regions excluded from low-zoom single-attribution labels, all high-zoom region shapes and all labels-hidden region shapes need no conversion until explicitly read.','QRF still performs its full original query; this patch does not reduce network, worker parsing or GPU geometry.','Payload gzip sizes are deterministic level-6 local compression observations, not verified hosted wire transfer or measured network times.']};const reportPath=process.env.HALC_REGIONS_LAZY_REPORT||resolve(root,'docs/verification-3.45/halc-regions-lazy.json');await fs.mkdir(dirname(resolve(reportPath)),{recursive:true});await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:report.pass,fail:report.fail,timings},null,2));if(report.fail)process.exitCode=1;
