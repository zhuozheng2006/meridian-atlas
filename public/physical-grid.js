import {readJSON,forgetJSON,EMPTY} from './map-engine.js?v=3.47.0-6485bddcb9a4';
import {intersectsLakeBounds,containsLakeBounds,lakeViewport} from './lakes.js?v=3.47.0-6485bddcb9a4';

export const PHYSICAL_GRID_SOURCE='physical-grid';
export const PHYSICAL_GRID_MIN_ZOOM=4;
const ROOT='data/physical-spatial/',KINDS=['land','ocean','coast','rivers','lakes'];
export const PHYSICAL_GRID_LAYERS=['physical-grid-base-water','physical-grid-land','physical-grid-lakes','physical-grid-rivers','physical-grid-mask','physical-grid-coast'];
const filter=kind=>['==',['get','_physicalLayer'],kind];
const finiteBox=b=>Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&b[0]<b[2]&&b[1]<b[3];
export function selectPhysicalCells(index,bounds){return index.cells.filter(c=>intersectsLakeBounds(c.bbox,bounds));}
function validIndex(index){return index?.schemaVersion===1&&finiteBox(index.bounds)&&Array.isArray(index.cells)&&index.cells.length>0&&index.cells.every(c=>typeof c.file==='string'&&/^cells\/[0-9]+-[0-9]+\.json\.gz$/.test(c.file)&&finiteBox(c.bbox)&&c.features&&KINDS.every(k=>Number.isSafeInteger(c.features[k])&&c.features[k]>=0));}
function validGeometry(g,kind){
 const point=p=>Array.isArray(p)&&p.length>=2&&p.every(Number.isFinite),line=r=>Array.isArray(r)&&r.length>=2&&r.every(point);
 const ring=r=>line(r)&&r.length>=4&&r[0][0]===r.at(-1)[0]&&r[0][1]===r.at(-1)[1];
 if(['coast','rivers'].includes(kind))return g?.type==='LineString'?line(g.coordinates):g?.type==='MultiLineString'&&Array.isArray(g.coordinates)&&g.coordinates.every(line);
 const polygon=p=>Array.isArray(p)&&p.length>0&&p.every(ring);
 return g?.type==='Polygon'?polygon(g.coordinates):g?.type==='MultiPolygon'&&Array.isArray(g.coordinates)&&g.coordinates.length>0&&g.coordinates.every(polygon);
}
function validCell(data,meta){return data?.schemaVersion===1&&JSON.stringify(data.bbox)===JSON.stringify(meta.bbox)&&data.layers&&KINDS.every(k=>data.layers[k]?.type==='FeatureCollection'&&Array.isArray(data.layers[k].features)&&data.layers[k].features.length===meta.features[k]&&data.layers[k].features.every(f=>f?.type==='Feature'&&f.properties&&validGeometry(f.geometry,k)));}
// Comparison maps share in-flight requests. Bounded parsed-cell retention also
// evicts readJSON's copy; failed or malformed assets never poison either cache.
export class PhysicalGridCache{
 constructor(load=readJSON,limit=128){this.load=load;this.limit=limit;this.entries=new Map();}
 forget(file){this.entries.delete(file);forgetJSON(ROOT+file);}
 get(file,validate){
  const hit=this.entries.get(file);if(hit){this.entries.delete(file);this.entries.set(file,hit);return hit;}
  const promise=this.load(ROOT+file).then(data=>{if(!validate(data)){this.forget(file);throw Error('Invalid physical grid asset: '+file);}for(const[key,value]of this.entries){if(this.entries.size<=this.limit+1)break;if(key!=='index.json.gz'&&value!==promise)this.forget(key);}return data;}).catch(error=>{if(this.entries.get(file)===promise)this.forget(file);throw error;});
  this.entries.set(file,promise);return promise;
 }
}
const caches=new WeakMap();
export class PhysicalGrid{
 constructor(geo,{load=readJSON}={}){
  this.geo=geo;this.atlas=geo.atlas;this.map=geo.map;this.seq=0;this.dead=false;this.ready=false;this.failed=false;this.status='overview';this.pending=null;this.coverage=null;this.listeners=[];
  if(!caches.has(load))caches.set(load,new PhysicalGridCache(load));this.cache=caches.get(load);
  const on=(type,fn)=>{this.map.on(type,fn);this.listeners.push([type,fn]);};
  on('movestart',()=>{++this.seq;this.requestKey=null;if(this.pending){this.pending=null;this.ready=false;this.coverage=null;this.sync();}});
  on('move',()=>{if(this.ready&&(!this.eligible||!containsLakeBounds(this.coverage,lakeViewport(this.map)))){this.ready=false;this.sync();}});
  on('moveend',()=>this.update());
  on('idle',()=>this.settle());
  on('sourcedata',e=>{if(e.sourceId===PHYSICAL_GRID_SOURCE&&e.isSourceLoaded)this.settle();});
  on('error',e=>{if(e.sourceId===PHYSICAL_GRID_SOURCE&&!this.dead&&!this.atlas.destroyed)this.fail(true);});
 }
 get eligible(){return !this.dead&&!this.atlas.destroyed&&this.map.getZoom()>=PHYSICAL_GRID_MIN_ZOOM;}
 get active(){return this.eligible&&this.ready&&!this.failed&&containsLakeBounds(this.coverage,lakeViewport(this.map));}
 ensure(){
  if(this.map.getSource(PHYSICAL_GRID_SOURCE))return;
  this.map.addSource(PHYSICAL_GRID_SOURCE,{type:'geojson',data:EMPTY,tolerance:0,maxzoom:14,attribution:'Natural Earth · Public domain · Spatially clipped contemporary reference'});
  const source=PHYSICAL_GRID_SOURCE,layout={visibility:'none'},base={source,minzoom:PHYSICAL_GRID_MIN_ZOOM,layout};
  this.map.addLayer({...base,id:PHYSICAL_GRID_LAYERS[0],type:'fill',filter:filter('ocean'),paint:{'fill-color':'#163246','fill-antialias':false}},'relief');
  this.map.addLayer({...base,id:PHYSICAL_GRID_LAYERS[1],type:'fill',filter:filter('land'),paint:{'fill-color':'#c9c4a4','fill-antialias':false}},'relief');
  this.map.addLayer({...base,id:PHYSICAL_GRID_LAYERS[2],type:'fill',filter:['all',filter('lakes'),['==',['get','artificial'],false]],paint:{'fill-color':'#40738a','fill-antialias':false,'fill-opacity':.8}},'boundary');
  this.map.addLayer({...base,id:PHYSICAL_GRID_LAYERS[3],type:'line',filter:['all',filter('rivers'),['==',['get','artificial'],false],['!=',['get','kind'],'Lake Centerline']],layout:{...layout,'line-cap':'butt','line-join':'round'},paint:{'line-color':'#3d7388','line-opacity':.85,'line-width':['interpolate',['linear'],['zoom'],1,.12,4,.5,8,1.25]}},'boundary');
  this.map.addLayer({...base,id:PHYSICAL_GRID_LAYERS[4],type:'fill',filter:filter('ocean'),paint:{'fill-color':'#163246','fill-antialias':false}},'coast');
  this.map.addLayer({...base,id:PHYSICAL_GRID_LAYERS[5],type:'line',filter:filter('coast'),layout:{...layout,'line-cap':'butt','line-join':'round'},paint:{'line-color':'#a5b6ae','line-width':['interpolate',['linear'],['zoom'],0,.25,4,.65],'line-opacity':.55}},'coast');
  this.atlas.regional?.halc?.landscape?.reconcileOrder();
 }
 visibility(){
  if(this.dead||this.atlas.destroyed)return;
  const active=this.active,remote=this.geo.fineCoastVisible,map=this.map;
  for(const id of PHYSICAL_GRID_LAYERS)if(map.getLayer(id)){
   const visible=active&&(id==='physical-grid-mask'?this.geo.coastAligned&&!remote:id==='physical-grid-coast'?!remote:['physical-grid-rivers','physical-grid-lakes'].includes(id)?this.geo.enabled:true);
   map.setLayoutProperty(id,'visibility',visible?'visible':'none');
  }
  if(map.getLayer('physical-grid-rivers'))map.setPaintProperty('physical-grid-rivers','line-opacity',map.getPaintProperty?.('physical-rivers','line-opacity')??['interpolate',['linear'],['zoom'],1,.08,3,.55,7,.85]);
  if(map.getLayer('physical-grid-lakes'))map.setPaintProperty('physical-grid-lakes','fill-opacity',map.getPaintProperty?.('physical-lakes','fill-opacity')??.8);
  // Only the true clipped coastline is stroked. The coarse coast must not remain
  // beneath it, and the clipped fill polygon closures are never stroked.
  if(map.getLayer('coast'))map.setLayoutProperty('coast','visibility',active?'none':'visible');
  if(map.getLayer('coastal-water'))map.setLayoutProperty('coastal-water','visibility',this.geo.coastAligned&&!active?'visible':'none');
  for(const id of ['physical-rivers','physical-lakes'])if(map.getLayer(id))map.setLayoutProperty(id,'visibility',this.geo.enabled&&!active?'visible':'none');
 }
 sync(){if(this.dead||this.atlas.destroyed)return;this.visibility();this.geo.syncStatus();this.atlas.regional?.halc?.landscape?.reconcileOrder();}
 fail(sourceError=false){if(sourceError)for(const file of this.requestFiles||[])this.cache.forget(file);++this.seq;this.failed=true;this.ready=false;this.pending=null;this.requestKey=null;this.status='error';this.sync();}
 async update(){
  if(this.dead||this.atlas.destroyed)return;
  if(!this.eligible){++this.seq;this.pending=null;this.requestKey=null;this.ready=false;this.status='overview';this.sync();return;}
  if(this.failed){this.sync();return;}
  const view=lakeViewport(this.map);
  if(this.active&&!this.pending){this.visibility();return;}
  const key=view.join(':');if(this.requestKey===key)return;this.requestKey=key;
  const seq=++this.seq,current=()=>!this.dead&&!this.atlas.destroyed&&seq===this.seq&&this.eligible;
  let east=view[2];while(east<view[0])east+=360;
  const dx=(east-view[0])*.2,dy=(view[3]-view[1])*.2,bounds=[view[0]-dx,Math.max(-85.0511287798066,view[1]-dy),east+dx,Math.min(85.0511287798066,view[3]+dy)];
  this.status=this.active?'updating':'loading';this.sync();
  try{
   const index=await this.cache.get('index.json.gz',validIndex);if(!current())return;
   const cells=selectPhysicalCells(index,bounds),parts=new Map();this.requestFiles=cells.map(c=>c.file);let cursor=0;
   if(!cells.length)throw Error('No physical grid cells for this viewport');
   const outcomes=await Promise.allSettled(Array.from({length:Math.min(4,cells.length)},async()=>{while(cursor<cells.length&&current()){
    const meta=cells[cursor++],data=await this.cache.get(meta.file,d=>validCell(d,meta));if(!current())return;parts.set(meta.file,data);
   }}));
   if(!current())return;if(outcomes.some(o=>o.status==='rejected'))throw Error('Physical grid is incomplete');
   const features=[];
   for(const meta of cells){const data=parts.get(meta.file);for(const kind of KINDS)for(const f of data.layers[kind].features)features.push({...f,id:meta.file+':'+kind+':'+(f.id??features.length),properties:{...f.properties,_physicalLayer:kind}});}
   this.ensure();this.pending={seq,bounds,cellCount:cells.length,featureCount:features.length};this.status='rendering';
   // ONE source update: land, water, shoreline and the corresponding waterways
   // are delivered to the worker together. Source readiness gates visibility.
   this.map.getSource(PHYSICAL_GRID_SOURCE).setData({type:'FeatureCollection',features});this.sync();
  }catch{if(current())this.fail();}
 }
 settle(){
  if(!this.eligible||this.failed||!this.pending||this.pending.seq!==this.seq||!this.map.isSourceLoaded(PHYSICAL_GRID_SOURCE))return;
  const frame=this.pending;this.pending=null;this.coverage=frame.bounds;this.cellCount=frame.cellCount;this.featureCount=frame.featureCount;this.ready=true;this.status='ready';this.sync();
 }
 retry(){
  if(this.dead||this.atlas.destroyed)return;this.failed=false;this.ready=false;this.pending=null;this.requestKey=null;++this.seq;this.visibility();
  for(const id of [...PHYSICAL_GRID_LAYERS].reverse())if(this.map.getLayer(id))this.map.removeLayer(id);
  if(this.map.getSource(PHYSICAL_GRID_SOURCE))this.map.removeSource(PHYSICAL_GRID_SOURCE);
  this.update();
 }
 destroy(){this.dead=true;++this.seq;this.pending=null;this.ready=false;for(const[type,fn]of this.listeners)this.map.off(type,fn);}
}
