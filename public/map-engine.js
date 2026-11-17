import {historicalDataRequest} from './native-content-hashes.js?v=3.63.0-aae975a178ba';
import {waitForMapForeground} from './map-load-priority.js?v=3.63.0-aae975a178ba';
import {TerritoryFrameCache} from './territory-frame-cache.js?v=3.63.0-aae975a178ba';
import {boundaryMesh} from './boundary-mesh.js?v=3.63.0-aae975a178ba';
import {curvedBorders,borderChordError,borderViewport} from './border-curves.js?v=3.63.0-aae975a178ba';
import {boundaryPaint,boundaryHaloPaint,territoryOpacity} from './boundary-style.js?v=3.63.0-aae975a178ba';
import {BoundaryController} from './boundary-controller.js?v=3.63.0-aae975a178ba';
import {loadNative,loadNativeFrame,nativeGeometry} from './native-geometry.js?v=3.63.0-aae975a178ba';
export const EMPTY={type:'FeatureCollection',features:[]};
export const civilYear=y=>y>0?y-1:y;
export const inWindow=(e,year,span)=>civilYear(e.start)<=civilYear(year)+span&&civilYear(e.end)>=civilYear(year)-span;
export const stepYear=(year,step)=>{const n=year+step;return year<0&&n>=0?n+1:year>0&&n<=0?n-1:n;};
export const formatYear=(y,lang='zh')=>{const n=Math.abs(y)>=10000?Math.abs(y).toLocaleString('en-US'):String(Math.abs(y));return lang==='en'?`${n} ${y<0?'BCE':'CE'}`:`${y<0?'公元前':'公元'} ${n} 年`;};
import {polityName} from './polity-names.js?v=3.63.0-aae975a178ba';
export {polityName};
export function wikipediaURL(v){if(/^https:\/\//.test(v))return v;if(/^[a-z-]+\.wikipedia\.org\/wiki\//.test(v))return 'https://'+v;return 'https://en.wikipedia.org/wiki/'+encodeURIComponent(v.replaceAll(' ','_'));}
export function activeRecords(catalog,year,relations=false){if(!year||year< -3400||year>2024)return [];return catalog.records.filter(r=>r.start<=year&&year<=r.end&&(relations||r.type==='POLITY')).sort((a,b)=>b.area-a.area);}
const resources=new Map();
export const forgetJSON=url=>resources.delete(url);
// Queue-aware load timeouts. A fixed 20 s abort used to fire while a request was
// still queued behind the multi-megabyte detail layers on a slow link, which killed
// the native-geometry upgrade and left "some fine layers unavailable". Two phases:
// CONNECT_TIMEOUT covers waiting for a connection plus the first byte, STALL_TIMEOUT
// only fires when a download that already started stops making progress.
const CONNECT_TIMEOUT=45000,STALL_TIMEOUT=20000;
export async function readJSON(url){
 if(resources.has(url))return resources.get(url);
 const pending=(async()=>{
  await waitForMapForeground(url);
  const controller=new AbortController();let timer=setTimeout(()=>controller.abort(),CONNECT_TIMEOUT);
  const arm=ms=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(),ms);};
  try{
   // Fetch Priority: first-frame data (data/fast) and the small native geometry
   // (data/native) must not sit behind the multi-megabyte detail layers, which can
   // hold all six connections for minutes on a slow link.
   const priority=/(?:^|\/)data\/(?:fast|native|chgis|awmc|china-prefectures|ohm-transport|ohm-1500|ohm-eastasia)\//.test(url)?'high':'auto';
   const transport=historicalDataRequest(url),response=await fetch(transport.url,{signal:controller.signal,cache:transport.cache,priority});if(!response.ok)throw Error(`${response.status} ${url}`);
   if(!url.endsWith('.gz'))return await response.json();
   // Start decompression after the magic bytes, while the body is still arriving.
   // Keep only the prefix here; no compressed-body collection or second copy.
   const reader=response.body.getReader(),prefix=[];let bytes=0,ended=false;
   const next=async()=>{const chunk=await reader.read();if(chunk.value?.length)arm(STALL_TIMEOUT);return chunk;};
   while(bytes<2){const chunk=await next();if(chunk.done){ended=true;break;}prefix.push(chunk.value);bytes+=chunk.value.length;}
   const magic=[];for(const chunk of prefix)for(const byte of chunk){magic.push(byte);if(magic.length===2)break;}const compressed=magic[0]===31&&magic[1]===139;
   const body=new ReadableStream({start(output){for(const chunk of prefix)output.enqueue(chunk);prefix.length=0;if(ended)output.close();},async pull(output){try{const chunk=await next();if(chunk.done)output.close();else output.enqueue(chunk.value);}catch(error){output.error(error);}},cancel(reason){return reader.cancel(reason);}});
   return await new Response(compressed?body.pipeThrough(new DecompressionStream('gzip')):body).json();
  }finally{clearTimeout(timer);}
 })();
 resources.set(url,pending);pending.catch(()=>resources.delete(url));return pending;
}
export const recordDetail=id=>readJSON(`data/fast/records-${String(Math.floor(+id.slice(5)/256)).padStart(3,'0')}.json.gz`).then(d=>d[id]);
const PALETTE=['#c9a25e','#5f8e88','#997a96','#a89b5a','#5b8da8','#b5775f','#6f9c74','#6c85ad','#ba756c','#8c9a68','#877aa8','#9ca07b','#c49150','#5d9b8f','#a37e6a','#7982a6'];
export function color(name){let h=0;for(const c of name)h=((h<<5)-h+c.charCodeAt(0))|0;return PALETTE[Math.abs(h)%PALETTE.length];}
const BOOT_YEARS=new Set([-3400,-221,1,500,1000,1492,1750,1914,1945,1991,2024]);
const overview=new Map(),detail=new Map();
async function geometryFor(catalog,records,year,high=false){
 const cache=high?detail:overview;
 if(!high&&BOOT_YEARS.has(year)&&records.some(r=>!cache.has(r.geometryId))){const b=await readJSON(`data/fast/year-${year}.json.gz`);Object.entries(b).forEach(([k,v])=>{overview.set(k,v);detail.set(k,v);});}
 const missing=records.filter(r=>!cache.has(r.geometryId));
 const files=[...new Set(missing.map(r=>catalog.geometryIndex[r.geometryId]))];
 await Promise.all(files.map(async file=>{const url=high?'data/'+file+'.gz':'data/fast/'+file.replace('geometries','overview')+'.gz';const g=await readJSON(url);Object.entries(g).forEach(([k,v])=>cache.set(k,v));}));
 return cache;
}
const worldZoom=container=>Math.max(.2,Math.min(1.65,1.5+Math.log2(Math.max(200,Math.min(container.clientWidth,container.clientHeight))/500)));
export class AtlasMap{
 constructor(container,{onPolity,onReady,onError,globe=true,camera=null,year=1492,historical=true,reference=false,regional=true,boundaryMode='auto',smoothBorders=true,showBorders=true,deferGeography=false,landData='data/land.geojson',onBoundaryMode,onBoundarySelection}={}){
  this.smoothBorders=smoothBorders;this.rawTerritories=null;this.year=year;this.container=container;this.onPolity=onPolity;this.onBoundaryMode=onBoundaryMode;this.onBoundarySelection=onBoundarySelection;this.lang='bi';this.showLabels=true;this.showEvents=true;this.showBorders=showBorders;this.request=0;this.active=[];this.labels=[];this.markers=[];this.markerKey='';this.geometryKey='';this.destroyed=false;
  this._regionalOpts={enabled:regional,modern:reference,mode:boundaryMode};this._historicalOpts={enabled:historical,modern:reference};this._detailLayersPromise=null;
  this.map=new maplibregl.Map({container,keyboard:false,canvasContextAttributes:{antialias:true},center:[25,18],zoom:globe?worldZoom(document.getElementById(container)):.6,...(camera||{}),minZoom:.2,maxZoom:18,attributionControl:false,fadeDuration:100,style:{version:8,projection:{type:globe?'globe':'mercator'},sky:{'sky-color':'#060d18','horizon-color':'#5c8296','atmosphere-blend':.68,'sky-horizon-blend':.38},sources:{land:{type:'geojson',data:landData},polities:{type:'geojson',data:EMPTY,tolerance:0,maxzoom:14,attribution:'<a href="https://icr.ethz.ch/data/cshapes/beta.html" target="_blank" rel="noopener">CShapes · Schvitz et al. · CC BY-NC-SA 4.0</a>'}},layers:[{id:'ocean',type:'background',paint:{'background-color':'#0b2236'}},{id:'land',type:'fill',source:'land',paint:{'fill-color':'#d8d0b8'}},{id:'coast',type:'line',source:'land',paint:{'line-color':'#7b938c','line-width':['interpolate',['linear'],['zoom'],0,.3,4,.75],'line-opacity':.6}},{id:'territories',type:'fill',source:'polities',filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':['get','color'],'fill-opacity':territoryOpacity}},{id:'boundary-halo',type:'line',source:'polities',filter:['==',['get','_atlasBoundaryLine'],true],layout:{'line-join':'round','line-cap':'round'},paint:boundaryHaloPaint()},{id:'boundary',type:'line',source:'polities',filter:['==',['get','_atlasBoundaryLine'],true],layout:{'line-join':'round','line-cap':'round'},paint:boundaryPaint()},{id:'hover-fill',type:'fill',source:'polities',filter:['==','id',''],paint:{'fill-color':'#f6d992','fill-opacity':.2}},{id:'hover-outline',type:'line',source:'polities',layout:{'line-join':'round','line-cap':'round'},filter:['==','id',''],paint:{'line-color':'#fff2ca','line-width':['interpolate',['linear'],['zoom'],1,1.1,6,1.6,10,2],'line-opacity':.85}},{id:'selection-fill',type:'fill',source:'polities',filter:['==','id',''],paint:{'fill-color':'#efd199','fill-opacity':.14}},{id:'selection',type:'line',source:'polities',layout:{'line-join':'round','line-cap':'round'},filter:['==','id',''],paint:{'line-color':'#fff3bf','line-width':['interpolate',['linear'],['zoom'],1,1.4,5,2.1,10,2.6]}}]}});
  // Verification handle: automated browser checks read live layers, paint and camera from here.
  if(typeof window!=='undefined'){window.__meridian=window.__meridian||{};window.__meridian.instances=(window.__meridian.instances||[]).concat(this);}
  this.map.addControl(new maplibregl.NavigationControl({showCompass:false}),'bottom-right');
  this.map.addControl(new maplibregl.AttributionControl({compact:true,customAttribution:'<a href="https://github.com/Seshat-Global-History-Databank/cliopatria" target="_blank" rel="noopener">Cliopatria / Seshat · CC BY 4.0</a> · <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>'}),'bottom-right');
  this.ready=new Promise((resolve,reject)=>{
   let settled=false;const finish=error=>{if(settled)return;settled=true;clearTimeout(timeout);this.cancelReady=null;if(error)reject(error);else resolve();};
   const timeout=setTimeout(()=>finish(Error('Map initialization timed out')),25000);this.cancelReady=()=>finish(Error('Map initialization cancelled'));
   this.map.once('load',()=>{if(this.destroyed){finish(Error('Map initialization cancelled'));return;}try{
    const attribution=this.map.getContainer().querySelector('.maplibregl-ctrl-attrib');if(attribution){attribution.open=false;attribution.classList.remove('maplibregl-compact-show');}
    this.geography=typeof Geography!=='undefined'?new Geography(this):this._geographyStub();if(!deferGeography)this.startGeography();
    this.boundaries=new BoundaryController(this,{mode:boundaryMode,color});
    const eagerRegional=typeof RegionalBoundaries!=='undefined'||!deferGeography||(camera?.zoom>=5)||!['auto','overview'].includes(boundaryMode);
    if(typeof RegionalBoundaries!=='undefined'&&typeof HistoricalDetailLayer!=='undefined'){
     this.regional=new RegionalBoundaries(this,this._regionalOpts);this.historical=new HistoricalDetailLayer(this,this._historicalOpts);
    }else{
     this.regional=this._regionalStub();this.historical=this._historicalStub();
     if(eagerRegional)void this.ensureDetailLayers();
    }
    onReady?.();finish();
   }catch(error){finish(error);}});
  });
  this.map.getCanvas().setAttribute('aria-label','历史地图 · 左右键调整年份，Alt + 方向键移动地图 / Historical map: arrows change year; Alt + arrows pan');
  this.map.getCanvas().addEventListener('webglcontextlost',()=>onError?.(Error('contextlost')));
  this.map.on('click','territories',e=>{if(this.regional?.detailedActive||this.historical?.hit(e.point))return;const landscape=this.regional?.halc?.landscape?.hit(e.point);if(landscape&&[7,8,9].includes(landscape.properties.LANDSCAPE))return;if(!landscape&&this.geography?.reference&&this.map.getLayer('reference-water')&&this.map.queryRenderedFeatures(e.point,{layers:['reference-water']}).length)return;if(!landscape&&this.geography?.coastAligned&&this.geography.fineCoastVisible&&this.map.getLayer('reference-ocean')&&this.map.queryRenderedFeatures(e.point,{layers:['reference-ocean']}).length)return;const waterLayer=this.geography?.coastWaterLayer||'coastal-water';if(!landscape&&this.geography?.coastAligned&&!this.geography.fineCoastVisible&&this.map.getLayer(waterLayer)&&this.map.queryRenderedFeatures(e.point,{layers:[waterLayer]}).length)return;if(this.showBorders&&e.features?.length){if(this.boundaries?.isCountry){this.boundaries.openRecord(e.features[0].properties.id,e.lngLat);return;}const r=this.recordMap?.get(e.features[0].properties.id);if(r)this.onPolity?.(r);}});
  this.map.on('mousemove',e=>{
   if(this._hoverMarkerActive||e.originalEvent?.target?.closest?.('.event-marker,.place-marker,.battle-marker,.atrocity-marker,.historical-label,.regional-label')){if(this.hoveredId){this.hoveredId=null;['hover-fill','hover-outline'].forEach(l=>{if(this.map.getLayer?.(l))this.map.setFilter(l,['==','id','']);});}return;}
   if(this.regional?.detailedActive){this.setHover(null);this.map.getCanvas().style.cursor=(this.regional.halc?.active?this.regional.halc.hit(e.point):this.regional.hit(e.point))?'pointer':'';return;}
   if(!this.showBorders||this.historical?.hit(e.point)){this.setHover(null);return;}
   const hits=this.map.getLayer?.('territories')?this.map.queryRenderedFeatures(e.point,{layers:['territories']}):[];
   const id=hits?.[0]?.properties?.id||null;
   this.map.getCanvas().style.cursor=id?'pointer':'';
   this.setHover(id,e.point);
  });
  this.map.on('mouseleave','territories',()=>{if(!this.regional?.detailedActive)this.map.getCanvas().style.cursor='';this.setHover(null);});
  this.map.getCanvas().addEventListener('mouseleave',()=>this.setHover(null));
  this.map.on('error',e=>{if(!['terrain-dem','geographic-reference','historical-detail','regional-boundaries','halc-boundaries','halc-regions','halc-landscape','relief','physical-grid'].includes(e.sourceId)&&e.error?.message?.includes('Failed to fetch'))onError?.(e.error);});
  this.map.on('zoomend',()=>this.refreshTerritorySampling());
  this.map.on('moveend',()=>{this.refreshTerritorySampling();this.refreshLabels();this.upgradeLand();if(this.regional?._isStub&&this.map.getZoom()>=4.5)void this.ensureDetailLayers();if(this.catalog)this.upgradeDetail();});
 }
 _geographyStub(){
  return {
   _isStub:true,enabled:true,coastAligned:true,reference:false,status:'coarse',landLayer:'land',coastWaterLayer:'coastal-water',fineCoastVisible:false,
   lakes:{status:'zoom',count:0,refreshLabels(){}},
   toggle(v){this.enabled=!!v;},alignCoast(v){this.coastAligned=!!v;},setReference(v){this.reference=!!v;},
   retry(){return false;},destroy(){}
  };
 }
 _regionalStub(){
  const self=this,opts=this._regionalOpts;
  return {
   _isStub:true,mode:opts.mode,enabled:opts.enabled,modern:opts.modern,detailedActive:false,status:'zoom',active:false,features:[],
   halc:{active:false,features:[],reason:null,restore(id){self.ensureDetailLayers().then(()=>self.regional?.halc?.restore?.(id));}},
   closePopup(){},update(){},refreshLabels(){},openIndex(){self.ensureDetailLayers().then(()=>self.regional?.openIndex?.());},
   retry(){self.ensureDetailLayers().then(()=>self.regional?.retry?.());},destroy(){},
   setYear(){},setModern(v){this.modern=opts.modern=v;},toggle(v){this.enabled=opts.enabled=v;},
   setMode(m){this.mode=opts.mode=m;return self.ensureDetailLayers().then(()=>self.regional?.setMode?.(m));}
  };
 }
 _historicalStub(){
  const self=this,opts=this._historicalOpts;
  return {
   _isStub:true,enabled:opts.enabled,modern:opts.modern,status:'zoom',features:[],
   hit(){return false;},refreshLabels(){},setYear(){},destroy(){},
   setModern(v){this.modern=opts.modern=v;},toggle(v){this.enabled=opts.enabled=v;if(v&&self.map.getZoom?.()>=11)void self.ensureDetailLayers();},retry(){}
  };
 }
 ensureDetailLayers(){
  if(this.destroyed)return Promise.resolve(false);
  if(this._detailLayersPromise)return this._detailLayersPromise;
  this._detailLayersPromise=(async()=>{
   const [{RegionalBoundaries:RB},{HistoricalDetailLayer:HD}]=await Promise.all([
    typeof RegionalBoundaries!=='undefined'?{RegionalBoundaries}:import('./regional-boundaries.js?v=3.63.0-aae975a178ba'),
    typeof HistoricalDetailLayer!=='undefined'?{HistoricalDetailLayer}:import('./historical-detail.js?v=3.63.0-aae975a178ba')
   ]);
   if(this.destroyed)return false;
   if(this.regional?._isStub){
    const r=new RB(this,this._regionalOpts);this.regional=r;
    if(this.boundaries?.current)r.setYear(this.year,this.lang);
   }
   if(this.historical?._isStub){
    const h=new HD(this,this._historicalOpts);this.historical=h;
    if(this.boundaries?.current)h.setYear(this.year,this.lang);
   }
   return true;
  })().catch(e=>{this._detailLayersPromise=null;return false;});
  return this._detailLayersPromise;
 }
 startGeography(){
  if(this.destroyed||!this.geography)return Promise.resolve(false);
  if(this.regional?._isStub||this.historical?._isStub)void this.ensureDetailLayers();
  if(!this.geographyReady){
   // A deep link may have opened regional/street layers before the catalog.
   // Preserve their original position above rivers and lakes when the deferred
   // physical layers are inserted at the same boundary anchor.
   const detailSources=new Set(['regional-boundaries','ohm-frozen','halc-boundaries','halc-regions','historical-detail']);
   const placeOrder=()=>{
    const detailLayers=this.map.getStyle().layers.filter(layer=>detailSources.has(layer.source)).map(layer=>layer.id);
    for(const id of detailLayers)if(this.map.getLayer(id))this.map.moveLayer(id,'boundary');
    this.regional?.halc?.landscape?.reconcileOrder();
   };
   if(this.geography._isStub&&typeof Geography==='undefined'){
    const stub=this.geography;
    this.geographyReady=(async()=>{
     const {Geography:RealGeography}=await import('./geography.js?v=3.63.0-aae975a178ba');
     if(this.destroyed)return false;
     const geo=new RealGeography(this);geo.enabled=stub.enabled;geo.coastAligned=stub.coastAligned;geo.reference=stub.reference;this.geography=geo;
     const ok=await geo.init().then(()=>true).catch(()=>false);
     if(!this.destroyed)placeOrder();
     return ok;
    })();
   }else{
    const detailLayers=this.map.getStyle().layers.filter(layer=>detailSources.has(layer.source)).map(layer=>layer.id);
    this.geographyReady=this.geography.init().then(()=>true).catch(()=>false);
    for(const id of detailLayers)if(this.map.getLayer(id))this.map.moveLayer(id,'boundary');
    this.regional?.halc?.landscape?.reconcileOrder();
   }
  }
  return this.geographyReady;
 }
 async prepareOverview(year,keepGoing=()=>!this.destroyed,catalog=this.catalog){
  const records=activeRecords(catalog,year);
  try{await loadNativeFrame(records,year,keepGoing);}catch{/* A failed optional pack retains the overview path. */}
  if(!keepGoing())return null;
  const geos=records.every(r=>nativeGeometry(r.id)||detail.has(r.geometryId))?detail:await geometryFor(catalog,records,year,false),high=records.every(r=>detail.has(r.geometryId)),complete=records.every(r=>nativeGeometry(r.id));
  return {source:'cliopatria',year,records,key:records.map(r=>r.id+(nativeGeometry(r.id)?'n':'')).join(',')+(complete?'n':high?'h':'o'),data:{type:'FeatureCollection',features:records.map(r=>({type:'Feature',properties:{id:r.id,color:color(r.name)},geometry:nativeGeometry(r.id)||geos.get(r.geometryId)||detail.get(r.geometryId)||overview.get(r.geometryId)}))}};
 }
 async setYear(catalog,year,lang=this.lang){
  const seq=++this.request,selectedPopup=this.boundaries?.selectedPopup,selectedId=this.boundaries?.selectedId;this.lang=lang;await this.ready;
  let frame;do{frame=await this.boundaries.prepare(year,keep=>this.prepareOverview(year,()=>seq===this.request&&!this.destroyed&&(!keep||keep()),catalog));if(seq!==this.request||this.destroyed)return false;}while(frame.requested!==this.boundaries.mode);
  const restoreSelection=year===this.year&&selectedPopup&&selectedPopup===this.boundaries.selectedPopup;const records=activeRecords(catalog,year);this.setHover?.(null);this.upgradeLand();this.catalog=catalog;this.year=year;this.active=records;this.recordMap=new Map(records.map(r=>[r.id,r]));this.boundaries.commit(frame);
  this.refreshLabels();this.upgradeDetail();this.places?.setYear(year,lang);this.battles?.setYear(year,lang);this.historical?.setYear(year,lang);this.regional?.setYear(year,lang);if(restoreSelection)this.boundaries.openRecord(selectedId);return records.length;
 }
 renderGeometry(geos,high){
  if(this.boundaries?.isCountry)return;
  const complete=this.active.every(r=>nativeGeometry(r.id));const key=this.active.map(r=>r.id+(nativeGeometry(r.id)?'n':'')).join(',')+(complete?'n':high?'h':'o');if(key===this.geometryKey)return;this.geometryKey=key;this.map.getContainer?.()?.dispatchEvent(new CustomEvent('geometry-status',{bubbles:true,detail:{fine:complete}}));
  this.displayTerritories({type:'FeatureCollection',features:this.active.map(r=>({type:'Feature',properties:{id:r.id,color:color(r.name)},geometry:nativeGeometry(r.id)||geos.get(r.geometryId)||detail.get(r.geometryId)||overview.get(r.geometryId)}))});
 }
 displayTerritories(data){
  this.rawTerritories=data;
  const country=this.boundaries?.isCountry,viewport=borderViewport(this.map.getBounds?.(),this.map.getZoom?.()),tolerance=viewport?.002:borderChordError(this.map.getZoom?.());this.borderTolerance=tolerance;this.borderViewKey=viewport?.join(',')||'';
  const mode=country?'country':this.smoothBorders?'curved:'+tolerance+':'+this.borderViewKey:'raw';
  this.territoryFrames??=new TerritoryFrameCache();
  this.territoryFrames.submit(data,mode,this.map.getSource('polities'),raw=>{
   const display=this.smoothBorders&&!country?curvedBorders(raw,tolerance,viewport):raw;
   const lines=country?{type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'MultiLineString',coordinates:display.features.flatMap(f=>f.geometry?.type==='Polygon'?f.geometry.coordinates:f.geometry?.type==='MultiPolygon'?f.geometry.coordinates.flat():[])}}]}:boundaryMesh(display);
   // One worker frame keeps polygons, boundary lines and selection in step.
   return {...display,features:[...display.features,...lines.features.map(f=>({...f,properties:{_atlasBoundaryLine:true}}))]};
  });
 }

 refreshTerritorySampling(){
  if(!this.rawTerritories||!this.smoothBorders||this.boundaries?.isCountry||this.regional?.detailedActive)return;
  const key=borderViewport(this.map.getBounds?.(),this.map.getZoom?.())?.join(',')||'';
  if(this.borderViewKey!==key||this.borderTolerance!==(key?.002:borderChordError(this.map.getZoom?.())))this.displayTerritories(this.rawTerritories);
 }
 setBorderCurves(enabled){
  this.smoothBorders=enabled;
  if(this.rawTerritories)this.displayTerritories(this.rawTerritories);
 }
 async upgradeLand(){/* Geography owns the progressively loaded physical base. */}
 async upgradeDetail(){
  if(this.boundaries?.isCountry)return;
  const seq=this.request,records=this.active,year=this.year;
  if(this.highRequest===seq||this.geometryKey.endsWith('n'))return;
  this.highRequest=seq;
  try{await loadNative(records,year,()=>!this.destroyed&&seq===this.request);if(!this.destroyed&&seq===this.request)this.renderGeometry(detail,true);}
  catch{/* Retain the fast map. A later navigation retries failed source files. */}
  finally{if(this.highRequest===seq)this.highRequest=null;}
 }
 refreshLabels(){
  this.labels.forEach(m=>m.remove());this.labels=[];this.labelBoxes=[];this.geography?.lakes?.refreshLabels();this.historical?.refreshLabels();this.regional?.refreshLabels();
  if(!this.showLabels||!this.showBorders||this.destroyed||this.regional?.detailedActive){this.places?.refresh();return;}
  const bounds=this.map.getBounds(),zoom=this.map.getZoom(),placed=[];
  const origin=this.map.getContainer().getBoundingClientRect();
  const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  const blockers=[...document.querySelectorAll('.map-heading,.map-tools,.compare-heading,.map-legend,.map-notice,.layer-panel,.lake-label')]
   .filter(el=>el.getClientRects().length).map(el=>el.getBoundingClientRect());
  const context=document.createElement('canvas').getContext('2d');context.font='13px system-ui';
  for(const r of (this.boundaries?.labelRecords()||this.active).filter(r=>(r.labelCenter||r.center)&&bounds.contains(r.labelCenter||r.center))){
   const anchor=r.labelCenter||r.center;
   if(this.labels.length>=Math.min(30,6+Math.floor(zoom)*5))break;
   if(r.area<8000/Math.max(1,zoom))continue;
   if(this.map.getProjection().type==='globe'&&zoom<2.5){const c=this.map.getCenter(),rad=Math.PI/180;const dot=Math.sin(c.lat*rad)*Math.sin(anchor[1]*rad)+Math.cos(c.lat*rad)*Math.cos(anchor[1]*rad)*Math.cos((anchor[0]-c.lng)*rad);if(dot<.15)continue;}
   const p=this.map.project(anchor),name=polityName(r,this.lang,this.year),englishName=polityName(r,'en',this.year);
   const bilingual=this.lang==='bi'&&name!==englishName&&zoom>=2.3;
   const w=Math.min(164,Math.max(context.measureText(name).width,bilingual?context.measureText(englishName).width*.82:0)+16),h=bilingual?42:25;
   const box={left:origin.left+p.x-w/2,right:origin.left+p.x+w/2,top:origin.top+p.y-h/2,bottom:origin.top+p.y+h/2};
   if(box.left<origin.left+12||box.right>origin.right-12||box.top<origin.top+12||box.bottom>origin.bottom-28)continue;
   if(blockers.some(b=>overlap(box,b))||placed.some(b=>overlap(box,b)))continue;
   this.labelBoxes.push(box);placed.push({...box,left:box.left-10,right:box.right+10,top:box.top-7,bottom:box.bottom+7});
   const el=document.createElement('div');el.className='polity-label';el.textContent=name;
   if(bilingual){const en=document.createElement('span');en.textContent=englishName;el.append(en);}
   this.labels.push(new maplibregl.Marker({element:el,opacityWhenCovered:'0'}).setLngLat(anchor).addTo(this.map));
  }
  this.places?.refresh();
 }
 setEvents(events,lang,onClick,selected){
  const key=[this.showEvents,lang,selected,...events.map(e=>e.id)].join('|');if(key===this.markerKey)return;this.markerKey=key;
  this.markers.forEach(m=>m.remove());this.markers=[];this.setHoverMarker(null);if(!this.showEvents)return;
  for(const e of events.slice(0,600)){
   const el=document.createElement('button');el.className='event-marker'+(e.id===selected?' selected':'');el.style.setProperty('--cat',e.color||'#e3bf7d');
   const primary=lang==='en'?e.title.en:e.title.zh,secondary=lang==='bi'&&e.title.en&&e.title.en!==primary?e.title.en:'';
   el.title=primary;el.setAttribute('aria-label',el.title);
   const when=formatYear(e.start,lang==='en'?'en':'zh')+(e.end!==e.start?' — '+formatYear(e.end,lang==='en'?'en':'zh'):'');
   const showHover=()=>{const rect=el.getBoundingClientRect();this.setHoverMarker({primary,secondary,meta:when},rect);};
   el.addEventListener('mouseenter',showHover);el.addEventListener('focus',showHover);
   el.addEventListener('mouseleave',()=>this.setHoverMarker(null));el.addEventListener('blur',()=>this.setHoverMarker(null));
   el.addEventListener('click',ev=>{ev.stopPropagation();this.setHoverMarker(null);onClick(e);});
   this.markers.push(new maplibregl.Marker({element:el,opacityWhenCovered:'0'}).setLngLat([e.lon,e.lat]).addTo(this.map));
  }
 }
 toggleBorders(v){this.showBorders=v;if(!v)this.setHover?.(null);['territories','boundary-halo','boundary','hover-fill','hover-outline','selection','selection-fill'].forEach(id=>{if(this.map.getLayer?.(id))this.map.setLayoutProperty(id,'visibility',v?'visible':'none');});this.regional?.update();this.refreshLabels();}
 _renderHoverCard(info,point){
  if(typeof document==='undefined'||!this.map.getContainer)return;
  const host=this.map.getContainer();
  if(!info||!point){if(this._hoverCard)this._hoverCard.hidden=true;return;}
  if(!this._hoverCard){this._hoverCard=document.createElement('div');this._hoverCard.className='map-hover-card';this._hoverCard.hidden=true;host.append(this._hoverCard);}
  const card=this._hoverCard;
  card.replaceChildren();
  const title=document.createElement('strong');title.textContent=info.primary;card.append(title);
  if(info.secondary){const sub=document.createElement('span');sub.className='map-hover-sub';sub.textContent=info.secondary;card.append(sub);}
  if(info.meta){const meta=document.createElement('small');meta.textContent=info.meta;card.append(meta);}
  card.hidden=false;
  const w=Math.max(150,card.offsetWidth||210),h=Math.max(54,card.offsetHeight||76);
  const maxX=Math.max(12,(host.clientWidth||400)-w-12),maxY=Math.max(12,(host.clientHeight||300)-h-12);
  card.style.left=Math.max(12,Math.min(maxX,point.x+16))+'px';
  card.style.top=Math.max(12,Math.min(maxY,point.y+16))+'px';
 }
 setHoverMarker(info,clientRect=null){
  this._hoverMarkerActive=!!info;
  if(!info||!clientRect||!this.map.getContainer){if(!this.hoveredId)this._renderHoverCard(null);return;}
  const host=this.map.getContainer().getBoundingClientRect();
  this._renderHoverCard(info,{x:clientRect.left+clientRect.width/2-host.left,y:clientRect.top+clientRect.height/2-host.top});
 }
 setHover(id,point=null){
  const next=id||null;
  if(next!==this.hoveredId){
   this.hoveredId=next;
   ['hover-fill','hover-outline'].forEach(layer=>{if(this.map.getLayer?.(layer))this.map.setFilter(layer,['==','id',next||'']);});
  }
  if(!next||!point){this._renderHoverCard(null);return;}
  const r=this.boundaries?.isCountry?this.boundaries.recordMap?.get(next):this.recordMap?.get(next);
  if(!r){this._renderHoverCard(null);return;}
  const primary=this.boundaries?.isCountry?(this.lang==='en'?r.name:(r.zhName||r.name)):polityName(r,this.lang,this.year);
  const secondary=this.lang==='bi'?(this.boundaries?.isCountry?(r.zhName&&r.zhName!==r.name?r.name:''):((()=>{const e=polityName(r,'en',this.year);return e&&e!==primary?e:'';})())):'';
  const meta=this.boundaries?.isCountry?`${r.startDate||''} — ${r.endDate||''}`:`${formatYear(r.start,this.lang==='en'?'en':'zh')} — ${formatYear(r.end,this.lang==='en'?'en':'zh')}`;
  this._renderHoverCard({primary,secondary,meta},point);
 }
 selectBoundary(id){['selection','selection-fill'].forEach(layer=>this.map.setFilter(layer,['==','id',id||'']));}
 selectPolity(r){if(this.boundaries?.isCountry)return;['selection','selection-fill'].forEach(id=>this.map.setFilter(id,['==','id',r?.id||'']));}
 focusPolity(record){
  const geometry=nativeGeometry(record.id)||detail.get(record.geometryId)||overview.get(record.geometryId);if(!geometry||!record.center)return;
  const lons=[],lats=[],center=(record.labelCenter||record.center)[0];
  const visit=coordinates=>{if(typeof coordinates[0]==='number'){let x=coordinates[0];while(x-center>180)x-=360;while(x-center< -180)x+=360;lons.push(x);lats.push(coordinates[1]);}else coordinates.forEach(visit);};visit(geometry.coordinates);
  const west=Math.min(...lons),east=Math.max(...lons),south=Math.max(-85,Math.min(...lats)),north=Math.min(85,Math.max(...lats));
  if(east-west>210){this.fly(...(record.labelCenter||record.center),1.5);return;}
  const rect=this.map.getContainer?.()?.getBoundingClientRect?.();
  const w=rect?.width||900,h=rect?.height||600;
  const pad={top:Math.min(116,Math.round(h*.18)),bottom:Math.min(72,Math.round(h*.12)),left:Math.min(48,Math.round(w*.08)),right:Math.min(84,Math.round(w*.12))};
  this.map.fitBounds([[west,south],[east,north]],{padding:pad,maxZoom:4.5,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:650});
 }
 fly(lon,lat,zoom=2.6){this.map.flyTo({center:[lon,lat],zoom:Math.min(18,zoom),duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:650,essential:false});}
 reset(){this.map.flyTo({center:[25,18],zoom:this.map.getProjection().type==='globe'?worldZoom(this.map.getContainer()):.6,duration:650});}
 projection(globe){this.map.setProjection({type:globe?'globe':'mercator'});}
 destroy(){if(this.destroyed)return;this.destroyed=true;this.cancelReady?.();this._hoverCard?.remove();this._hoverCard=null;this.territoryFrames?.destroy();this.boundaries?.destroy();this.historical?.destroy();this.regional?.destroy();this.geography?.destroy();this.places?.destroy();this.markers.forEach(m=>m.remove());this.labels.forEach(m=>m.remove());this.map.remove();}
}
