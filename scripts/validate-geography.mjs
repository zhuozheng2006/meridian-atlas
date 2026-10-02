import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const sourcePath=new URL('../public/geography.js',import.meta.url);
const source=fs.readFileSync(sourcePath,'utf8');
const transformed=source.replace(/^import[^\n]*\n/gm,'').replace('export class Geography','globalThis.Geography = class Geography');
const EMPTY={type:'FeatureCollection',features:[]};
const results=[];
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
const fc=(name,layer)=>({type:'FeatureCollection',features:[{type:'Feature',properties:{name,layer,artificial:false},geometry:{type:'Point',coordinates:[0,0]}}]});

function environment(zoom=1){
 const requests=[];const events=[];const operations=[];const listeners={};
 const sources=new Map([['land',{spec:{type:'geojson'},data:EMPTY}],['polities',{spec:{type:'geojson'},data:EMPTY}]]);
 const layers=['ocean','land','coast','territories','boundary','selection-fill','selection'].map(id=>({id,layout:{},paint:{}}));
 const atlas={destroyed:false,landDetailed:false};
 const map={zoom,removed:false,
  addSource(id,spec){assert(!sources.has(id),'duplicate source '+id);sources.set(id,{spec,data:spec.data});operations.push(['addSource',id]);},
  getSource(id){const s=sources.get(id);return s?{...s,setData(d){s.data=d;operations.push(['setData',id,d.features?.[0]?.properties?.name,atlas.destroyed]);}}:undefined;},
  removeSource(id){assert(!layers.some(l=>l.source===id),'source still used '+id);sources.delete(id);operations.push(['removeSource',id]);},
  addLayer(layer,before){assert(!layers.some(l=>l.id===layer.id),'duplicate layer '+layer.id);const normalized={layout:{},paint:{},...structuredClone(layer)};const at=before?layers.findIndex(l=>l.id===before):-1;if(before)assert(at>=0,'missing before '+before);if(at<0)layers.push(normalized);else layers.splice(at,0,normalized);operations.push(['addLayer',layer.id]);},
  getLayer(id){return layers.find(l=>l.id===id);},
  removeLayer(id){const at=layers.findIndex(l=>l.id===id);assert(at>=0);layers.splice(at,1);operations.push(['removeLayer',id]);},
  moveLayer(id,before){const at=layers.findIndex(l=>l.id===id);assert(at>=0);const [l]=layers.splice(at,1);const dest=before?layers.findIndex(l=>l.id===before):layers.length;layers.splice(dest,0,l);},
  addControl(){},
  on(type,fn){(listeners[type]??=[]).push(fn);},
  emit(type,data){if(data?.sourceId&&typeof data.isSourceLoaded==='boolean'&&sources.has(data.sourceId))sources.get(data.sourceId).currentLoaded=data.isSourceLoaded;for(const fn of listeners[type]||[])fn(data);},
  isSourceLoaded(id){return Boolean(sources.get(id)?.currentLoaded);},
  getZoom(){return this.zoom;},
  setPaintProperty(id,p,v){const l=this.getLayer(id);assert(l,'missing paint layer '+id);l.paint[p]=v;operations.push(['paint',id,p,v,atlas.destroyed]);},
  setLayoutProperty(id,p,v){const l=this.getLayer(id);assert(l,'missing layout layer '+id);l.layout[p]=v;operations.push(['layout',id,p,v,atlas.destroyed]);},
  getContainer(){return {dispatchEvent(e){events.push({type:e.type,detail:e.detail,afterDestroy:atlas.destroyed});}};},
  destroy(){this.removed=true;atlas.destroyed=true;},
 };
 atlas.map=map;
 const context=vm.createContext({LakeLayer:class{constructor(){this.status='overview';this.ready=false;}update(){}},EMPTY,URL,location:{href:'https://atlas.test/index.html'},maplibregl:{ScaleControl:class{}},CustomEvent:class{constructor(type,options){this.type=type;Object.assign(this,options);}},readJSON:url=>new Promise((resolve,reject)=>requests.push({url,resolve,reject,done:false})),console});
 vm.runInContext(transformed,context,{filename:sourcePath.pathname});
 const geography=new context.Geography(atlas);
 const init=geography.init();
 const settle=(match,data,rejected=false)=>{
  const r=requests.find(r=>!r.done&&r.url.includes(match));assert(r,'missing pending request '+match);r.done=true;(rejected?r.reject:r.resolve)(rejected?Error(String(data)):data);return r.url;
 };
 const resolvePending=()=>{for(const r of requests.filter(r=>!r.done)){r.done=true;r.resolve(r.url.includes('physical-overview')?{type:'FeatureCollection',features:[...fc('overview-rivers','rivers').features,...fc('overview-lakes','lakes').features]}:fc(r.url));}};
 const data=id=>sources.get(id)?.data;
 const layer=id=>map.getLayer(id);
 return {atlas,map,geography,requests,events,operations,layers,sources,init,settle,resolvePending,data,layer};
}

async function test(name,fn){try{const details=await fn();results.push({name,status:'pass',details});}catch(error){results.push({name,status:'finding',message:error.message,details:error.details});}}
function expect(ok,message,details){if(!ok){const e=Error(message);e.details=details;throw e;}}

await test('Fine local data is never replaced by a late coarse success',async()=>{
 const e=environment(1);e.map.zoom=4;const fine=e.geography.loadLocal();
 for(const [match,name] of [['land-10m','fine-land'],['rivers-10m','fine-rivers'],['lakes-10m','fine-lakes'],['modern-ocean-mask.json','fine-ocean']])e.settle(match,fc(name));
 await fine;e.resolvePending();await e.init;
 const actual=['land','physical-rivers','physical-lakes','coastal-water'].map(id=>e.data(id).features[0].properties.name);
 assert.deepEqual(actual,['fine-land','fine-rivers','fine-lakes','fine-ocean']);return actual;
});

await test('Fine water waits for zoom 4 while the zoom 3 view keeps the coarse overview water',async()=>{
 const e=environment(1);e.map.zoom=3;e.geography.loadLocal().catch(()=>{});
 const atThree=e.requests.map(r=>r.url).join(' ');
 expect(!/rivers-10m|lakes-10m/.test(atThree),'Fine rivers and lakes must not be fetched below zoom 4',{atThree});
 e.map.zoom=4;e.geography.loadLocal().catch(()=>{});
 const atFour=e.requests.map(r=>r.url).join(' ');
 expect(/rivers-10m/.test(atFour),'Fine rivers must be fetched at zoom 4',{atFour});
 return {atThree,atFour};
});
await test('Coarse water supplements a failed fine layer without downgrading another fine layer',async()=>{
 const e=environment(1);e.map.zoom=4;const fine=e.geography.loadLocal();
 e.settle('land-10m',fc('fine-land'));e.settle('rivers-10m',fc('fine-rivers'));e.settle('lakes-10m','transient',true);e.settle('modern-ocean-mask.json',fc('fine-ocean'));
 await fine;e.resolvePending();await e.init;
 assert.equal(e.data('physical-rivers').features[0].properties.name,'fine-rivers');assert.equal(e.data('physical-lakes').features[0].properties.name,'overview-lakes');
 const before=e.requests.length;const again=e.geography.loadLocal();assert.equal(e.requests.length,before+1);e.settle('lakes-10m',fc('fine-lakes'));await again;assert.equal(e.data('physical-lakes').features[0].properties.name,'fine-lakes');
 return {retriedOnlyMissingFine:true,loaded:[...e.geography.localLoaded]};
});

await test('Successful later local retry clears partial status',async()=>{
 const e=environment(4);e.settle('lakes-10m','transient',true);e.resolvePending();await e.init;assert.equal(e.geography.status,'partial');
 const again=e.geography.loadLocal();e.resolvePending();await again;
 expect(e.geography.status!=='partial','Recovered local data keeps stale partial status',{status:e.geography.status,loaded:[...e.geography.localLoaded]});
});

await test('Late unused overview failure does not mark complete fine geography partial',async()=>{
 const e=environment(1);e.map.zoom=4;const fine=e.geography.loadLocal();
 for(const match of ['land-10m','rivers-10m','lakes-10m','modern-ocean-mask.json'])e.settle(match,fc(match));
 await fine;e.settle('land-50m','coarse fetch failed after all fine data arrived',true);e.resolvePending();await e.init;
 expect(e.geography.status!=='partial','Unused coarse failure overwrites fully loaded fine state',{status:e.geography.status,loaded:[...e.geography.localLoaded]});
});

await test('Delayed successful local fetch performs no setData after destroy',async()=>{
 const e=environment(1);e.map.destroy();e.resolvePending();await e.init;
 const writes=e.operations.filter(op=>op[0]==='setData');assert.equal(writes.length,0);assert.equal(e.events.length,0);return {writes:0,reports:0};
});

await test('Delayed failed local fetch reports nothing after destroy',async()=>{
 const e=environment(1);e.map.destroy();e.settle('land-50m','offline',true);e.resolvePending();await e.init;
 expect(!e.events.some(x=>x.afterDestroy),'A destroyed atlas still dispatches geography-status on late rejection',e.events);
});

await test('Terrain failure restores local relief without hiding modern reference',async()=>{
 const e=environment(8);e.resolvePending();await e.init;e.geography.setReference(true);e.map.emit('sourcedata',{sourceId:'geographic-reference',isSourceLoaded:true,tile:{state:'loaded'}});e.map.emit('sourcedata',{sourceId:'terrain-dem',isSourceLoaded:true,tile:{state:'loaded',dem:{}}});
 e.map.emit('error',{sourceId:'terrain-dem',error:Error('DEM offline')});
 assert.equal(e.layer('terrain-shade').layout.visibility,'none');assert.equal(e.layer('relief').paint['raster-opacity'],.82);assert.equal(e.layer('reference-water').layout.visibility,'visible');
 e.geography.retry();expect(e.sources.has('terrain-dem'),'Retry did not recreate terrain source');expect(!e.geography.failed.has('terrain-dem'),'Retry did not clear terrain failure');
 return {fallbackOpacity:.82,referenceStillVisible:true,terrainRecreated:true};
});

await test('An actual MapLibre 5.6 tile event without sourceDataType enables fine DEM',async()=>{
 const e=environment(6);e.resolvePending();await e.init;
 e.map.emit('sourcedata',{dataType:'source',sourceId:'terrain-dem',isSourceLoaded:true,tile:{state:'loaded',dem:{width:512}},coord:{canonical:{z:6,x:32,y:24}}});
 expect(Array.isArray(e.layer('relief').paint['raster-opacity']),'A valid loaded DEM tile without sourceDataType was ignored',{status:e.geography.status,opacity:e.layer('relief').paint['raster-opacity']});
});

await test('An actual MapLibre 5.6 tile event without sourceDataType enables vector reference',async()=>{
 const e=environment(8);e.resolvePending();await e.init;e.geography.setReference(true);
 e.map.emit('sourcedata',{dataType:'source',sourceId:'geographic-reference',isSourceLoaded:true,tile:{state:'loaded'},coord:{canonical:{z:8,x:132,y:84}}});
 expect(e.geography.referenceReady&&e.layer('reference-base').paint['background-opacity']===1,'A valid loaded vector tile without sourceDataType was ignored',{ready:e.geography.referenceReady,baseOpacity:e.layer('reference-base').paint['background-opacity']});
});

await test('Modern reference failure restores local mask without hiding terrain',async()=>{
 const e=environment(8);e.resolvePending();await e.init;e.geography.setReference(true);e.map.emit('sourcedata',{sourceId:'geographic-reference',isSourceLoaded:true,tile:{state:'loaded'}});e.map.emit('error',{sourceId:'geographic-reference',error:Error('reference offline')});
 assert.equal(e.layer('coastal-water').paint['fill-opacity'],1);assert.equal(e.layer('reference-water').layout.visibility,'none');expect(e.layer('terrain-shade').layout.visibility!=='none','Independent terrain hidden');
 return {maskRestored:true,terrainUnaffected:true};
});

await test('Modern reference failure invalidates readiness used by territory hit testing',async()=>{
 const e=environment(8);e.resolvePending();await e.init;e.geography.setReference(true);e.map.emit('sourcedata',{sourceId:'geographic-reference',isSourceLoaded:true,tile:{state:'loaded'}});e.map.emit('error',{sourceId:'geographic-reference',error:Error('reference offline')});
 const skipLocalOceanHitTest=e.geography.reference&&e.geography.referenceReady&&e.map.getZoom()>=8;
 expect(!skipLocalOceanHitTest,'referenceReady stays true after failure, so map-engine bypasses the visible local ocean mask',{reference:e.geography.reference,referenceReady:e.geography.referenceReady,failed:[...e.geography.failed],skipLocalOceanHitTest});
});

await test('Modern reference off stays off while the default fine coast survives late remote success',async()=>{
 const e=environment(8);e.resolvePending();await e.init;e.geography.setReference(true);e.geography.setReference(false);e.map.emit('sourcedata',{sourceId:'geographic-reference',isSourceLoaded:true,tile:{state:'loaded'}});
 assert.equal(e.layer('reference-water').layout.visibility,'none');assert.equal(e.layer('reference-roads').layout.visibility,'none');assert.equal(e.layer('reference-base').paint['background-opacity'],1);assert.equal(e.layer('reference-ocean').paint['fill-opacity'],1);return 'modern layers hidden; default fine coast remains';
});

await test('Coast alignment off remains off through reference toggles/failure/retry',async()=>{
 const e=environment(8);e.resolvePending();await e.init;e.geography.alignCoast(false);e.geography.setReference(true);e.map.emit('sourcedata',{sourceId:'geographic-reference',isSourceLoaded:true,tile:{state:'loaded'}});e.map.emit('error',{sourceId:'geographic-reference',error:Error('offline')});e.geography.retry();e.geography.setReference(false);
 assert.equal(e.layer('coastal-water').layout.visibility,'none');assert.equal(e.geography.coastAligned,false);return 'local mask remains hidden';
});

await test('A metadata-only loaded signal cannot substitute for usable modern vector tiles',async()=>{
 const e=environment(1);e.resolvePending();await e.init;e.geography.setReference(true);
 // MapLibre SourceCache.loaded() may return true for an unused (below minzoom)
 // source, although no tile exists. This is a legal metadata event.
 e.map.emit('sourcedata',{sourceId:'geographic-reference',sourceDataType:'metadata',isSourceLoaded:true});e.map.zoom=8;
 expect(!e.geography.referenceReady,'Tile-free metadata marks modern vector reference ready and disables local high-zoom coast',{ready:e.geography.referenceReady,baseOpacity:e.layer('reference-base').paint['background-opacity'],maskOpacity:e.layer('coastal-water').paint['fill-opacity']});
});

await test('Previously ready reference retains local fallback while new viewport tiles load',async()=>{
 const e=environment(8);e.resolvePending();await e.init;e.geography.setReference(true);e.map.emit('sourcedata',{sourceId:'geographic-reference',isSourceLoaded:true,tile:{state:'loaded'}});
 e.map.emit('dataloading',{dataType:'source',sourceId:'geographic-reference',isSourceLoaded:false,tile:{state:'loading'}});
 expect(!e.geography.referenceReady,'Current viewport loading does not clear referenceReady; remote water gaps expose a land-colored global background',{ready:e.geography.referenceReady,baseOpacity:e.layer('reference-base').paint['background-opacity'],maskOpacity:e.layer('coastal-water').paint['fill-opacity']});
});

await test('Turning terrain off before DEM metadata arrives does not certify usable DEM tiles',async()=>{
 const e=environment(6);e.resolvePending();await e.init;e.geography.toggle(false);e.map.emit('sourcedata',{sourceId:'terrain-dem',sourceDataType:'metadata',isSourceLoaded:true});e.geography.toggle(true);
 const opacity=e.layer('relief').paint['raster-opacity'];
 expect(opacity===.82,'Tile-free DEM metadata fades away the local terrain before any DEM tile has loaded',{status:e.geography.status,reliefOpacity:opacity});
});

// This regression uses the actual vendored cache methods, including its silent
// cache reactivation branch, rather than inventing a source event sequence.
const vendor=fs.readFileSync(new URL('../public/assets/maplibre-gl.js',import.meta.url),'utf8');
const cacheStart=vendor.indexOf('class xe extends');
function cacheMethod(start,next){const a=vendor.indexOf(start,cacheStart),b=vendor.indexOf(next,a+start.length);assert(a>=0&&b>a);return vendor.slice(a,b);}
const cacheMethods={
 add:cacheMethod('_addTile(e){','_setTileReloadTimer(e,t){'),
 remove:cacheMethod('_removeTile(e){','_dataHandler(e){'),
 loaded:cacheMethod('loaded(){','getSource(){'),
};

for(const [sourceId,readyProperty,mode] of [['terrain-dem','terrainReady'],['geographic-reference','referenceReady','modern'],['geographic-reference','referenceReady','default-coast']]){
 await test(`${sourceId}${mode?'/'+mode:''}: return to cached view after abort converges ready without a new tile event`,async()=>{
  const e=environment(8);e.resolvePending();await e.init;if(sourceId==='geographic-reference'&&mode==='modern')e.geography.setReference(true);
  class Event{constructor(type,options){this.type=type;Object.assign(this,options);}}
  class Tile{constructor(tileID){this.tileID=tileID;this.state='loading';this.uses=0;this.aborted=false;this.dem=sourceId==='terrain-dem'?{}:undefined;}hasData(){return this.state==='loaded';}getExpiryTimeout(){return undefined;}}
  const context=vm.createContext({t:{l:Event},re:Tile,clearTimeout});
  const methods=vm.runInContext(`({${cacheMethods.add},${cacheMethods.remove},${cacheMethods.loaded}})`,context);
  const tileCache=new Map();
  const cache={...methods,_sourceLoaded:true,_sourceErrored:false,_updated:true,used:true,_tiles:{},_timers:{},_cacheTimers:{},_state:{initializeTileState(){}},
   _cache:{getAndRemove(id){const t=tileCache.get(id.key);tileCache.delete(id.key);return t;},add(id,t){tileCache.set(id.key,t);}},
   _setTileReloadTimer(){},_loadTile(){},_unloadTile(){},
   _abortTile(tile){this._source.fire(new Event('dataabort',{dataType:'source',tile,coord:tile.tileID}));},
  };
  const fired=[];
  cache._source={tileSize:512,loaded:()=>true,fire(event){const data={...event,sourceId,isSourceLoaded:cache.loaded()};fired.push(data.type);e.map.emit(data.type==='data'?'sourcedata':data.type,data);}};
  const originalIsLoaded=e.map.isSourceLoaded.bind(e.map);e.map.isSourceLoaded=id=>id===sourceId?cache.loaded():originalIsLoaded(id);
  const idA={key:'A',overscaleFactor:()=>1},idB={key:'B',overscaleFactor:()=>1};
  const a=new Tile(idA);a.state='loaded';a.uses=1;cache._tiles.A=a;
  cache._source.fire(new Event('data',{dataType:'source',tile:a,coord:idA}));
  expect(e.geography[readyProperty]===true,'A valid loaded tile did not establish initial readiness');
  cache._addTile(idB);cache._removeTile('A');
  expect(e.geography[readyProperty]===false,'Loading B did not restore local fallback');
  cache._removeTile('B');const before=fired.length;cache._addTile(idA);
  assert.equal(fired.length,before,'Actual cached tile branch unexpectedly emitted a source event');
  assert.equal(cache.loaded(),true);
  e.map.emit('moveend',{});e.map.emit('idle',{});await flush();
  expect(e.geography[readyProperty]===true,'Cached viewport is loaded but readiness remains false indefinitely',{sourceId,isSourceLoaded:cache.loaded(),ready:e.geography[readyProperty],sourceEvents:fired});
  return {actualVendorCacheMethods:true,newTileSuccessEventsAfterReturning:0,ready:true};
 });
}

function evalZoom(expression,zoom){
 if(typeof expression==='number')return expression;
 if(expression[0]==='zoom')return zoom;
 if(expression[0]==='step'){let result=expression[2];for(let i=3;i<expression.length;i+=2)if(zoom>=expression[i])result=expression[i+1];return result;}
 if(expression[0]==='interpolate'){const pairs=expression.slice(3);if(zoom<=pairs[0])return pairs[1];for(let i=2;i<pairs.length;i+=2)if(zoom<=pairs[i]){const a=pairs[i-2],b=pairs[i],t=(zoom-a)/(b-a);return pairs[i-1]+t*(pairs[i+1]-pairs[i-1]);}return pairs.at(-1);}
 throw Error('Unsupported expression '+JSON.stringify(expression));
}
const readyVector=e=>e.map.emit('sourcedata',{dataType:'source',sourceId:'geographic-reference',isSourceLoaded:true,tile:{state:'loaded'}});

await test('Default coast starts the shared vector source only at zoom 8',async()=>{
 const e=environment(1);e.resolvePending();await e.init;assert(!e.sources.has('geographic-reference'));e.map.zoom=7.99;e.geography.detail();assert(!e.sources.has('geographic-reference'));e.map.zoom=8;e.geography.detail();assert(e.sources.has('geographic-reference'));assert.equal(e.geography.reference,false);
 assert.deepEqual(e.layer('reference-ocean').filter,['==','class','ocean']);assert.equal(e.layer('reference-ocean')['source-layer'],'water');assert.equal(e.layer('reference-ocean').minzoom,8);
 for(const id of ['reference-water','reference-waterway','reference-roads','reference-buildings'])assert.equal(e.layer(id).layout.visibility,'none');return 'ocean only; no modern urban or inland-water layers';
});

await test('Pending fine ocean requests tiles while keeping local fallback visible',async()=>{
 const e=environment(8);e.resolvePending();await e.init;assert.equal(e.layer('reference-ocean').layout.visibility,'visible');assert.equal(e.layer('reference-ocean').paint['fill-opacity'],0);assert.equal(e.layer('reference-base').paint['background-opacity'],0);assert.equal(evalZoom(e.layer('coastal-water').paint['fill-opacity'],8),1);return 'layout visible, opacity zero, local mask opaque';
});

await test('Ready default coast preserves physical rivers and lakes',async()=>{
 const e=environment(8);e.resolvePending();await e.init;readyVector(e);assert.equal(e.layer('reference-base').paint['background-opacity'],1);assert.equal(e.layer('reference-ocean').paint['fill-opacity'],1);assert.equal(evalZoom(e.layer('coastal-water').paint['fill-opacity'],8),0);assert.equal(evalZoom(e.layer('coast').paint['line-opacity'],8),0);assert(evalZoom(e.layer('physical-rivers').paint['line-opacity'],8)>0);assert(evalZoom(e.layer('physical-lakes').paint['fill-opacity'],8)>0);return 'fine coastline with local natural waterways retained';
});

await test('Terrain disabled does not block automatic fine coastline',async()=>{
 const e=environment(1);e.resolvePending();await e.init;e.geography.toggle(false);e.map.zoom=8;e.geography.detail();expect(e.sources.has('geographic-reference'),'Terrain off prevented coastline source creation');expect(!e.sources.has('terrain-dem'),'DEM loaded even though terrain disabled');readyVector(e);assert.equal(e.layer('reference-ocean').paint['fill-opacity'],1);assert.equal(e.layer('relief').layout.visibility,'none');return 'independent coast and terrain controls';
});

await test('Fine coast and modern reference reuse one source through all toggles',async()=>{
 const e=environment(8);e.resolvePending();await e.init;readyVector(e);e.geography.setReference(true);assert.equal(e.layer('reference-water').layout.visibility,'visible');assert.equal(evalZoom(e.layer('physical-lakes').paint['fill-opacity'],8),0);e.geography.setReference(false);assert.equal(e.layer('reference-water').layout.visibility,'none');assert.equal(e.layer('reference-base').paint['background-opacity'],1);assert(evalZoom(e.layer('physical-lakes').paint['fill-opacity'],8)>0);
 e.geography.alignCoast(false);assert.equal(e.layer('reference-ocean').layout.visibility,'none');assert.equal(e.layer('reference-base').paint['background-opacity'],0);assert.equal(e.layer('coastal-water').layout.visibility,'none');readyVector(e);assert.equal(e.layer('reference-base').paint['background-opacity'],0);
 e.geography.setReference(true);assert.equal(e.layer('reference-water').layout.visibility,'visible');assert.equal(e.layer('reference-ocean').layout.visibility,'none');assert.equal(e.layer('reference-base').paint['background-opacity'],1);
 assert.equal(e.operations.filter(x=>x[0]==='addSource'&&x[1]==='geographic-reference').length,1);return 'one vector source; independent modes';
});

await test('Default coast failure/retry restores and reloads only the shared remote coast',async()=>{
 const e=environment(8);e.resolvePending();await e.init;readyVector(e);e.map.emit('error',{sourceId:'geographic-reference',error:Error('offline')});assert.equal(e.layer('reference-ocean').layout.visibility,'none');assert.equal(e.layer('reference-base').paint['background-opacity'],0);assert.equal(evalZoom(e.layer('coastal-water').paint['fill-opacity'],8),1);assert.equal(e.geography.referenceReady,false);e.geography.retry();assert(e.sources.has('geographic-reference'));assert(!e.geography.seenRemote.has('geographic-reference'));assert.equal(e.layer('reference-ocean').layout.visibility,'visible');assert.equal(e.layer('reference-ocean').paint['fill-opacity'],0);readyVector(e);assert.equal(e.layer('reference-base').paint['background-opacity'],1);assert.equal(e.geography.reference,false);return 'default coast retry works with modern reference off';
});

// Execute the actual AtlasMap territory click callback, not a duplicated policy.
const mapEnginePath=new URL('../public/map-engine.js',import.meta.url);
const mapEngineSource=fs.readFileSync(mapEnginePath,'utf8');
const clickLine=mapEngineSource.split('\n').find(line=>line.includes("this.map.on('click','territories',"));
assert(clickLine,'Missing territory click callback');
const clickArrow=clickLine.slice(clickLine.indexOf('e=>'),clickLine.lastIndexOf(');'));
function clickHarness(e,hits){
 const picked=[];e.atlas.geography=e.geography;e.atlas.showBorders=true;e.atlas.recordMap=new Map([['P',{id:'P'}]]);e.atlas.onPolity=record=>picked.push(record.id);
 e.map.queryRenderedFeatures=(point,{layers})=>layers.flatMap(id=>{const l=e.layer(id);if(!l||l.layout.visibility==='none'||(l.minzoom!=null&&e.map.zoom<l.minzoom))return [];return hits[id]?[{layer:{id}}]:[];});
 // MapLibre includes geometry from opacity-zero layers; intentionally do not
 // exclude it here. The click controller must honor its visible-state policy.
 const factory=vm.runInNewContext(`(function(){return (${clickArrow});})`);
 const handler=factory.call(e.atlas);handler({point:{x:10,y:10},features:[{properties:{id:'P'}}]});return picked;
}

await test('Pending transparent fine-ocean geometry cannot block visible fallback land clicks',async()=>{
 const e=environment(8);e.resolvePending();await e.init;const picked=clickHarness(e,{'reference-ocean':true,'coastal-water':false});expect(picked.length===1,'Opacity-zero fine ocean prevented a visible local-land territory click',{ready:e.geography.referenceReady,opacity:e.layer('reference-ocean').paint['fill-opacity'],picked});
});

await test('Ready default fine ocean rejects water clicks but ignores obsolete coarse ocean hits',async()=>{
 const e=environment(8);e.resolvePending();await e.init;readyVector(e);assert.equal(clickHarness(e,{'reference-ocean':true}).length,0);assert.equal(clickHarness(e,{'reference-ocean':false,'coastal-water':true}).length,1);return 'clicks use the same fine coastline as the visible map';
});

await test('Failed fine coast rejects fallback-water clicks; raw coast mode allows original geometry',async()=>{
 const e=environment(8);e.resolvePending();await e.init;readyVector(e);e.map.emit('error',{sourceId:'geographic-reference',error:Error('offline')});assert.equal(clickHarness(e,{'reference-ocean':true,'coastal-water':true}).length,0);e.geography.alignCoast(false);assert.equal(clickHarness(e,{'reference-ocean':true,'coastal-water':true}).length,1);return 'fallback and raw coast hit tests match visible state';
});

await test('Fine natural waterways replace coarse rivers while modern infrastructure stays hidden',async()=>{
 const e=environment(10);e.resolvePending();await e.init;
 assert.equal(e.layer('reference-natural-rivers').layout.visibility,'visible');assert.equal(e.layer('reference-natural-rivers').paint['line-opacity'],0);
 e.map.emit('sourcedata',{sourceId:'geographic-reference',isSourceLoaded:true,tile:{state:'loaded'}});
 assert.deepEqual(Array.from(e.layer('reference-natural-rivers').filter),['in','class','river','stream']);
 assert.equal(e.layer('reference-natural-rivers').paint['line-opacity'],.9);
 assert.equal(e.layer('physical-rivers').paint['line-opacity'].at(-1),0);
 assert.equal(e.layer('reference-roads').layout.visibility,'none');assert.equal(e.layer('reference-water').layout.visibility,'none');
 e.geography.toggle(false);assert.equal(e.layer('reference-natural-rivers').layout.visibility,'none');assert.equal(e.layer('reference-ocean').layout.visibility,'visible');
 e.geography.toggle(true);assert.equal(e.layer('reference-natural-rivers').layout.visibility,'visible');
});
await test('Fine waterways failure restores the local river and retry removes dependent layers',async()=>{
 const e=environment(10);e.resolvePending();await e.init;
 e.map.emit('sourcedata',{sourceId:'geographic-reference',isSourceLoaded:true,tile:{state:'loaded'}});
 e.map.emit('error',{sourceId:'geographic-reference',error:Error('offline')});
 assert.equal(e.layer('reference-natural-rivers').layout.visibility,'none');
 assert.equal(e.layer('physical-rivers').paint['line-opacity'].at(-1),.85);
 e.geography.retry();assert(e.sources.has('geographic-reference'));assert.equal(e.layer('reference-natural-rivers').paint['line-opacity'],0);
});

const output={snapshot:{path:sourcePath.pathname,sha256:crypto.createHash('sha256').update(source).digest('hex'),mapEngineSha256:crypto.createHash('sha256').update(mapEngineSource).digest('hex'),capturedAt:new Date().toISOString()},counts:{pass:results.filter(x=>x.status==='pass').length,findings:results.filter(x=>x.status==='finding').length},results};
if(process.env.ATLAS_TEST_REPORT)fs.writeFileSync(process.env.ATLAS_TEST_REPORT,JSON.stringify(output,null,2)+'\n');
if(output.counts.findings)process.exitCode=1;
console.log(JSON.stringify(output,null,2));
