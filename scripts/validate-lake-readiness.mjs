import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=process.argv[2]||path.resolve(here,'..');
const candidate=process.argv[3]||path.join(root,'public/lakes.js');
const sourceText=fs.readFileSync(candidate,'utf8');
const bundle=fs.readFileSync(path.join(root,'public/assets/maplibre-gl.js'),'utf8');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const hook='e.GeoJSONSource=H,';
assert.equal(bundle.split(hook).length,2,'MapLibre SourceCache export hook changed; review fixture');
const vendor=vm.createContext({console,setTimeout,clearTimeout,performance,TextEncoder,TextDecoder,URL,AbortController,Blob});
vm.runInContext(bundle.replace(hook,'globalThis.__SourceCache=xe,'+hook),vendor);
function loadController(source,filename){const context=vm.createContext({console,setTimeout,clearTimeout,performance,TextEncoder,TextDecoder,URL,AbortController,Blob});vm.runInContext(source.replace(/^import .*;$/gm,'').replace(/\bexport (?=(?:class|function|const))/g,'')+'\nglobalThis.__LakeLayer=LakeLayer;',context,{filename});return context.__LakeLayer;}
const LakeLayer=loadController(sourceText,candidate),SourceCache=vendor.__SourceCache;
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=async()=>{for(let n=0;n<24;n++)await Promise.resolve();};
const bbox=[134,34,137,37],shard={file:'fixture.bin.gz',minZoom:4,bbox,count:1,vertices:5};
const data={encoding:'delta-1e6',features:[{type:'Feature',id:1,bbox,properties:{area:673.48,type:3},geometry:{type:'Polygon',deltas:[[[135000000,35000000,1000000,0,0,1000000,-1000000,0,0,-1000000]]]}}]};
const index={schemaVersion:1,shards:[shard]};

async function environment(options={},Controller=LakeLayer){
 const handlers=new Map(),sources=new Map(),paints=[],events=[],jobs=[];let zoom=6.3,bounds=[135,35,136,36],moving=false,repaints=0;
 const emit=(type,event={})=>{events.push({type,sourceId:event.sourceId,sourceDataType:event.sourceDataType,isSourceLoaded:event.isSourceLoaded});for(const fn of [...(handlers.get(type)||[])])fn(event);};
 const atlas={destroyed:false},map={
  on(t,f){if(!handlers.has(t))handlers.set(t,new Set());handlers.get(t).add(f);},off(t,f){handlers.get(t)?.delete(f);},
  getZoom:()=>zoom,isMoving:()=>moving,getBounds:()=>({getWest:()=>bounds[0],getSouth:()=>bounds[1],getEast:()=>bounds[2],getNorth:()=>bounds[3]}),
  triggerRepaint(){repaints++;},addLayer(){},setPaintProperty(...args){paints.push(args);},
  getSource:id=>sources.get(id)?.getSource(),isSourceLoaded:id=>sources.get(id)?.loaded()===true,
  addSource(id,spec){
   const dispatcher={getActor:()=>({sendAsync(request){assert.equal(request.type,'LD');const wait=deferred();jobs.push({...wait,request});return wait.promise;}})};
   const cache=new SourceCache(id,spec,dispatcher);cache._updated=true;cache.used=true;
   // Real SourceCache content handler and loaded() run unchanged. Tile transport
   // and worker LD completion are controlled, so no network/WebGL is involved.
   cache.reload=()=>{cache._tiles={fixture:{state:'loading'}};};
   cache.on('data',e=>emit('sourcedata',{...e,sourceId:id,isSourceLoaded:cache.loaded()}));
   cache.on('dataloading',e=>emit('sourcedataloading',{...e,sourceId:id,isSourceLoaded:cache.loaded()}));
   cache.on('error',e=>emit('error',{...e,sourceId:id,isSourceLoaded:cache.loaded()}));
   sources.set(id,cache);cache.getSource().map=map;cache.getSource().load();
  },
 };
 const geo={atlas,map,enabled:true,reference:false,referenceVisibility(){},syncStatus(){}};
 const layer=new Controller(geo,{getIndex:async()=>index,getShard:async()=>data,...options});
 const complete=async(position=0)=>{const job=jobs.splice(position,1)[0];assert(job,'Expected pending real GeoJSON worker request');job.resolve({data:job.request.data.data});await tick();};
 const tile=()=>{const cache=sources.get('lake-detail');cache._tiles.fixture={state:'loaded'};emit('sourcedata',{sourceId:'lake-detail',tile:{state:'loaded'},isSourceLoaded:cache.loaded()});};
 const frame=()=>emit('render');
 await complete();tile();frame();events.length=0;paints.length=0;
 return {layer,map,geo,atlas,jobs,events,paints,handlers,sources,emit,complete,tile,frame,repaints:()=>repaints,
  zoom:v=>zoom=v,bounds:v=>bounds=v,moving:v=>moving=v,async ready(){await layer.update();await complete();tile();frame();assert(layer.ready);},
  async close(){layer.destroy();for(const job of jobs.splice(0))job.resolve({abandoned:true});await tick();},
 };
}
const results=[];
const test=async(name,fn)=>{try{await fn();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:String(error.stack||error)});console.error('FAIL '+name+' '+error.message);}};
const fixture=(name,fn)=>test(name,async()=>{const h=await environment();try{await fn(h);}finally{await h.close();}});

await test('Unchanged 3.45 controller reproduces own-source ready yet still hidden until global idle',async()=>{
 const file=path.join(here,'test-support/lakes-3.45-baseline.js'),baseline=loadController(fs.readFileSync(file,'utf8'),file),h=await environment({},baseline);
 try{await h.layer.update();await h.complete();h.tile();h.frame();assert(h.map.isSourceLoaded('lake-detail'));assert(!h.layer.ready);assert.equal(h.layer.status,'rendering');h.emit('idle');assert(h.layer.ready);}finally{await h.close();}
});
await fixture('Current own-source content and tiles reveal lakes on render without global idle',async h=>{
 await h.layer.update();assert.equal(h.layer.status,'rendering');await h.complete();assert(!h.layer.ready);assert(h.layer.contentSeq===h.layer.renderSeq);
 h.tile();assert(!h.layer.ready,'Source callback must not paint inside data propagation');h.frame();assert(h.layer.ready);assert(!h.events.some(e=>e.type==='idle'));
});
await fixture('Metadata and unrelated tiles do not certify current lake content',async h=>{
 await h.layer.update();h.emit('sourcedata',{sourceId:'lake-detail',sourceDataType:'metadata',isSourceLoaded:true});h.emit('sourcedata',{sourceId:'terrain-dem',sourceDataType:'content',isSourceLoaded:true});h.frame();h.emit('idle');assert(!h.layer.ready);assert.equal(h.layer.contentSeq,-1);
});
await fixture('Content before viewport tile completion stays on overview',async h=>{
 await h.layer.update();await h.complete();h.frame();assert(!h.layer.ready);h.emit('sourcedata',{sourceId:'lake-detail',tile:{state:'loaded'},isSourceLoaded:false});h.frame();assert(!h.layer.ready);h.tile();h.frame();assert(h.layer.ready);
});
await fixture('Queued newer setData cannot be certified by older metadata/content or tile events',async h=>{
 await h.layer.update();const first=h.layer.renderSeq;await h.layer.update();assert(h.layer.renderSeq>first);assert.equal(h.jobs.length,1,'Vendor queues second request instead of sending concurrently');
 await h.complete();assert.equal(h.jobs.length,1,'Vendor starts the pending update in finally');assert.equal(h.layer.contentSeq,-1);h.tile();h.frame();assert(!h.layer.ready);h.emit('idle');assert(!h.layer.ready);
 await h.complete();assert.equal(h.layer.contentSeq,h.layer.renderSeq);h.tile();h.frame();assert(h.layer.ready);
});
await fixture('Late tile event cannot commit while a newer GeoJSON worker request runs',async h=>{
 await h.layer.update();await h.complete();h.tile();await h.layer.update();h.emit('sourcedata',{sourceId:'lake-detail',tile:{state:'loaded'},isSourceLoaded:true});h.frame();assert(!h.layer.ready);assert(!h.map.getSource('lake-detail').loaded());await h.complete();h.tile();h.frame();assert(h.layer.ready);
});
await fixture('Movestart invalidates a submitted frame before its own completion',async h=>{
 await h.layer.update();h.moving(true);h.emit('movestart');await h.complete();h.tile();h.frame();h.emit('idle');assert(!h.layer.ready);h.moving(false);await h.layer.update();await h.complete();h.tile();h.frame();assert(h.layer.ready);
});
await fixture('A camera still moving cannot activate lake detail',async h=>{
 await h.layer.update();await h.complete();h.tile();h.moving(true);h.frame();assert(!h.layer.ready);h.moving(false);h.emit('idle');assert(h.layer.ready);
});
await fixture('A stale viewport or zoom tier cannot activate detail even without a move notification',async h=>{
 await h.layer.update();await h.complete();h.tile();h.bounds([145,35,146,36]);h.frame();assert(!h.layer.ready);h.bounds([135,35,136,36]);h.zoom(9.2);h.emit('idle');assert(!h.layer.ready);h.zoom(3);h.emit('idle');assert(!h.layer.ready);
});
await fixture('Loaded margin survives a small pan without another setData',async h=>{
 await h.ready();const before=h.layer.renderSeq;h.emit('movestart');h.bounds([135.05,35,136.05,36]);h.emit('move');await h.layer.update();assert(h.layer.ready);assert.equal(h.jobs.length,0);assert.equal(h.layer.renderSeq,before);
});
await fixture('Source error after content prevents late ready; explicit update can recover',async h=>{
 await h.layer.update();await h.complete();h.emit('error',{sourceId:'lake-detail',error:Error('fixture source error')});h.tile();h.frame();h.emit('idle');assert(!h.layer.ready);assert.equal(h.layer.status,'error');await h.layer.update();await h.complete();h.tile();h.frame();assert(h.layer.ready);
});
await fixture('Real GeoJSON worker rejection cannot be mistaken for a loaded error cache',async h=>{
 await h.layer.update();h.jobs.shift().reject(Error('fixture worker failed'));await tick();assert.equal(h.layer.status,'error');assert(!h.layer.ready);h.tile();h.frame();h.emit('idle');assert(!h.layer.ready);
});
await fixture('Disabled geography and modern reference keep late source completion hidden',async h=>{
 await h.layer.update();await h.complete();h.tile();h.geo.enabled=false;h.frame();assert(!h.layer.ready);h.geo.enabled=true;h.geo.reference=true;h.emit('idle');assert(!h.layer.ready);
});
await fixture('Destroy alone removes new listeners and bars later writes or callbacks',async h=>{
 await h.layer.update();const oldData=h.layer.data,oldRender=h.layer.render,oldError=h.layer.error;h.layer.destroy();const paints=h.paints.length,repaints=h.repaints();await h.complete();h.tile();h.frame();oldData({sourceId:'lake-detail',sourceDataType:'content',isSourceLoaded:true});oldRender();oldError({sourceId:'lake-detail'});await h.layer.update();h.layer.reconcile();assert.equal(h.paints.length,paints);assert.equal(h.repaints(),repaints);assert(!h.layer.ready);for(const type of ['sourcedata','render','idle','move','moveend','movestart','error'])assert.equal(h.handlers.get(type)?.size||0,0);
});
await test('Pending network completion after destroy never reaches setData',async()=>{
 const delayed=deferred(),h=await environment({getShard:()=>delayed.promise});try{const task=h.layer.update();await tick();h.layer.destroy();const before=h.paints.length;delayed.resolve(data);await task;assert.equal(h.jobs.length,0);assert.equal(h.paints.length,before);}finally{await h.close();}
});
await fixture('Idle remains a safe completion fallback after own content and cached tiles',async h=>{
 await h.layer.update();await h.complete();h.sources.get('lake-detail')._tiles.fixture.state='loaded';h.emit('idle');assert(h.layer.ready);
});

const report={scope:'Node controller lifecycle regression using actual shipped MapLibre GeoJSONSource and SourceCache loaded/content behavior; controlled worker and tile transport; not browser or timing evidence',root,candidate,sourceSha256:sha(sourceText),maplibreSha256:sha(bundle),pass:results.filter(r=>r.passed).length,fail:results.filter(r=>!r.passed).length,results};
fs.mkdirSync(path.join(root,'docs/verification-3.46'),{recursive:true});
fs.writeFileSync(path.join(root,'docs/verification-3.46/lake-readiness-regression.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:report.pass,fail:report.fail}));if(report.fail)process.exitCode=1;
