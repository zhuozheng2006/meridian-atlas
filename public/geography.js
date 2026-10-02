import {LakeLayer} from './lakes.js?v=3.10.0-0601e1f7044e';
import {readJSON,EMPTY} from './map-engine.js?v=3.10.0-0601e1f7044e';

// Physical geography is a contemporary reference. Historical claims live in
// the separate, dated territory and settlement datasets.
export class Geography {
 get fineCoastVisible(){return !!this.referenceReady&&!this.failed.has('geographic-reference')&&this.map.getZoom()>=8&&(this.coastAligned||this.reference);}
 constructor(atlas){this.atlas=atlas;this.map=atlas.map;this.enabled=true;this.reference=false;this.coastAligned=true;this.status='local';this.failed=new Set();this.localLoaded=new Set();this.localLoading=new Set();this.localErrors=new Set();this.terrainReady=false;this.seenRemote=new Set();}
 async init(){
  const map=this.map;
  map.addSource('relief',{type:'raster',tiles:[new URL('data/physical/relief/{z}/{x}/{y}.webp',location.href).href.replaceAll('%7B','{').replaceAll('%7D','}')],tileSize:512,minzoom:0,maxzoom:4,attribution:'Natural Earth · Public domain'});
  // Shaded relief is the base the historical claim is drawn onto: it belongs
  // under the political fills, otherwise it mutes every territory and border.
  map.addLayer({id:'relief',type:'raster',source:'relief',paint:{'raster-opacity':.82,'raster-fade-duration':160}},'territories');
  for(const name of ['rivers','lakes'])map.addSource('physical-'+name,{type:'geojson',data:EMPTY,tolerance:.05});
  map.addLayer({id:'physical-lakes',type:'fill',source:'physical-lakes',filter:['==','artificial',false],paint:{'fill-color':'#40738a','fill-opacity':['interpolate',['linear'],['zoom'],1,.25,3,.8]}},'boundary');
  map.addLayer({id:'physical-rivers',type:'line',source:'physical-rivers',filter:['all',['==','artificial',false],['!=','kind','Lake Centerline']],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#3d7388','line-opacity':['interpolate',['linear'],['zoom'],1,.08,3,.55,7,.85],'line-width':['interpolate',['linear'],['zoom'],1,.12,4,.5,8,1.25]}},'boundary');
  this.lakes=new LakeLayer(this);
  map.addSource('coastal-water',{type:'geojson',data:EMPTY,tolerance:0,maxzoom:14});
  map.addLayer({id:'coastal-water',type:'fill',source:'coastal-water',paint:{'fill-color':'#163246','fill-antialias':false}});
  map.moveLayer('coast');
  map.addControl(new maplibregl.ScaleControl({maxWidth:110,unit:'metric'}),'bottom-left');
  map.on('moveend',()=>{this.loadLocal();this.detail();this.reconcileRemote();});
  map.on('idle',()=>this.reconcileRemote());
  map.on('error',e=>{
   if(this.atlas.destroyed)return;
   if(!['terrain-dem','geographic-reference'].includes(e.sourceId))return;
   this.failed.add(e.sourceId);this.status='fallback';
   if(e.sourceId==='terrain-dem'&&map.getLayer('terrain-shade')){this.terrainReady=false;map.setLayoutProperty('terrain-shade','visibility','none');map.setPaintProperty('relief','raster-opacity',.82);}
   if(e.sourceId==='geographic-reference'){this.referenceReady=false;this.referenceVisibility(false);}
   this.report();
  });
  map.on('dataloading',e=>{if(this.atlas.destroyed)return;if(e.sourceId==='terrain-dem'){this.terrainReady=false;map.setPaintProperty('relief','raster-opacity',.82);}if(e.sourceId==='geographic-reference'){this.referenceReady=false;this.referenceVisibility(this.reference);}this.syncStatus();});
  map.on('sourcedata',e=>{
   // MapLibre 5.6 tile events carry tile/coord but need not carry sourceDataType.
   // Metadata alone cannot certify that the current viewport has usable tiles.
   if(this.atlas.destroyed||!e.tile||e.tile.state!=='loaded'||this.failed.has(e.sourceId))return;
   if(e.sourceId==='geographic-reference'||e.sourceId==='terrain-dem'&&e.tile.dem)this.seenRemote.add(e.sourceId);
   if(!e.isSourceLoaded)return;
   if(e.sourceId==='terrain-dem'&&e.tile.dem&&this.enabled&&map.getZoom()>=5){map.setPaintProperty('relief','raster-opacity',['interpolate',['linear'],['zoom'],4,.82,5,.55,6,0]);this.terrainReady=true;this.syncStatus();}
   if(e.sourceId==='geographic-reference'&&map.getZoom()>=5){this.referenceReady=true;this.referenceVisibility(this.reference);}
  });
  await this.loadLocal();this.detail();this.lakes.update();
 }
 reconcileRemote(){
  if(this.atlas.destroyed)return;
  const map=this.map,ready=id=>this.seenRemote.has(id)&&!this.failed.has(id)&&map.getSource(id)&&map.isSourceLoaded(id);
  if(this.enabled&&map.getZoom()>=5&&!this.terrainReady&&ready('terrain-dem')){this.terrainReady=true;map.setPaintProperty('relief','raster-opacity',['interpolate',['linear'],['zoom'],4,.82,5,.55,6,0]);this.syncStatus();}
  if((this.reference||this.coastAligned&&map.getZoom()>=8||this.enabled&&map.getZoom()>=9)&&map.getZoom()>=5&&!this.referenceReady&&ready('geographic-reference')){this.referenceReady=true;this.referenceVisibility(this.reference);}
 }
 async loadLocal(){
  if(this.atlas.destroyed)return;
  const zoom=this.map.getZoom(),fine=zoom>=2.5;
  // The 10 m water set is 6.7 MB (rivers 2.1 + lakes 1.3 + ocean mask 3.4). Below
  // WATER_ZOOM the overview water is already loaded and the river/lake opacity is at
  // most 0.55, so fetching those megabytes early spends them on a view dominated by
  // the 10 m coastline. Land stays at 2.5: the coastline is the edge the user zooms
  // to read. scripts/validate-geography.mjs locks this in (zoom 3 must not request
  // rivers-10m/lakes-10m, zoom 4 must).
  const WATER_ZOOM=4;
  const names=(fine?['land',...(zoom>=WATER_ZOOM?['rivers','lakes','ocean']:['water-overview','ocean-overview'])]:['land-overview','water-overview','ocean-overview']).filter(n=>!this.localLoaded.has(n)&&!this.localLoading.has(n));
  const results=await Promise.allSettled(names.map(async name=>{this.localLoading.add(name);try{
   const url=name==='land-overview'?'data/land-50m.json.gz':name==='water-overview'?'data/physical/physical-overview.json.gz':name==='ocean'?'data/physical/modern-ocean-mask.json.gz':name==='ocean-overview'?'data/physical/modern-ocean-mask-overview.json.gz':`data/physical/${name}-10m.json.gz`;
   const data=await readJSON(url);if(this.atlas.destroyed)return;
   if(name==='water-overview'){for(const layer of ['rivers','lakes'])if(!this.localLoaded.has(layer))this.map.getSource('physical-'+layer)?.setData({type:'FeatureCollection',features:data.features.filter(f=>f.properties.layer===layer)});}
   else if(!name.endsWith('-overview')||!this.localLoaded.has(name.replace('-overview',''))){const target=name.startsWith('land')?'land':name.startsWith('ocean')?'coastal-water':'physical-'+name;this.map.getSource(target)?.setData(data);}
   this.localLoaded.add(name);this.localErrors.delete(name);
   if(name==='land')this.atlas.landDetailed=true;
  }catch(error){this.localErrors.add(name);throw error;}finally{this.localLoading.delete(name);}}));
  if(this.atlas.destroyed)return;
  // Inspect all settled outcomes; status follows the assets useful at this zoom,
  // so a late failed overview cannot downgrade a complete detailed map.
  results.forEach((r,i)=>{if(r.status==='rejected')this.localErrors.add(names[i]);});this.syncStatus();
 }
 syncStatus(){
  if(this.atlas.destroyed)return;
  const loaded=this.localLoaded,errors=this.localErrors;
  const groups=this.map.getZoom()>=2.5?[['land'],['rivers'],['lakes'],['ocean']]:[['land','land-overview'],['rivers','water-overview'],['lakes','water-overview'],['ocean','ocean-overview']];
  const partial=groups.some(group=>!group.some(n=>loaded.has(n))&&group.some(n=>errors.has(n)));
  this.status=this.failed.size?'fallback':partial||this.lakes?.status==='error'?'partial':this.terrainReady&&this.enabled&&this.map.getZoom()>=5?'fine':'local';this.report();
 }
 report(){if(!this.atlas.destroyed)this.map.getContainer().dispatchEvent(new CustomEvent('geography-status',{bubbles:true,detail:{status:this.status,reference:this.reference}}));}
 detail(){
  if(this.atlas.destroyed)return;
  if(this.coastAligned&&this.map.getZoom()>=8||this.enabled&&this.map.getZoom()>=9)this.ensureReference();
  if(this.map.getZoom()<5||!this.enabled||this.failed.has('terrain-dem'))return;
  if(!this.map.getSource('terrain-dem')){
   this.map.addSource('terrain-dem',{type:'raster-dem',tiles:['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],tileSize:512,minzoom:5,maxzoom:12,encoding:'terrarium',attribution:'<a href="https://mapterhorn.com/attribution/" target="_blank" rel="noopener">Mapterhorn · Terrain sources</a>'});
   this.map.addLayer({id:'terrain-shade',type:'hillshade',source:'terrain-dem',minzoom:5,paint:{'hillshade-exaggeration':.5,'hillshade-shadow-color':'#33392f','hillshade-highlight-color':'#f7eac5','hillshade-accent-color':'#97866b','hillshade-illumination-direction':315,'hillshade-illumination-anchor':'map'}},'territories');
  }
 }
 toggle(v){this.enabled=v;for(const id of ['relief','terrain-shade','physical-lakes','physical-rivers'])if(this.map.getLayer(id))this.map.setLayoutProperty(id,'visibility',v&&!(id==='terrain-shade'&&this.failed.has('terrain-dem'))?'visible':'none');if(v){this.loadLocal();this.detail();this.reconcileRemote();}this.referenceVisibility(this.reference);this.lakes?.update();this.atlas.regional?.halc?.landscape?.update();this.syncStatus();}
 alignCoast(v){this.coastAligned=v;this.map.setLayoutProperty('coastal-water','visibility',v?'visible':'none');if(v)this.detail();this.referenceVisibility(this.reference);this.reconcileRemote();}
 retry(){
  for(const[id,layers]of [['terrain-dem',['terrain-shade']],['geographic-reference',['reference-base','reference-ocean','reference-natural-rivers','reference-water','reference-waterway','reference-roads','reference-buildings']]])if(this.failed.has(id)){this.seenRemote.delete(id);for(const layer of layers)if(this.map.getLayer(layer))this.map.removeLayer(layer);if(this.map.getSource(id))this.map.removeSource(id);}
  this.failed.clear();this.status='local';this.lakes?.update();this.loadLocal();this.detail();if(this.reference)this.setReference(true);this.report();
 }
 setReference(v){
  this.reference=v;this.lakes?.update();
  if(v)this.ensureReference();
  this.referenceVisibility(v);if(v)this.reconcileRemote();this.atlas.regional?.halc?.landscape?.update();this.report();
 }
 ensureReference(){
  if(this.failed.has('geographic-reference'))return;
  if(!this.map.getSource('geographic-reference')){
   this.referenceReady=false;
   this.map.addSource('geographic-reference',{type:'vector',url:'https://tiles.openfreemap.org/planet/latest',attribution:'<a href="https://openfreemap.org/">OpenFreeMap</a> © <a href="https://openmaptiles.org/">OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'});
   this.map.addLayer({id:'reference-base',type:'background',minzoom:8,paint:{'background-color':'#c9c4a4','background-opacity':0}},'territories');
   this.map.addLayer({id:'reference-ocean',type:'fill',source:'geographic-reference','source-layer':'water',filter:['==','class','ocean'],minzoom:8,paint:{'fill-color':'#163246','fill-antialias':false}});
   this.map.addLayer({id:'reference-water',type:'fill',source:'geographic-reference','source-layer':'water',minzoom:5,paint:{'fill-color':'#163246','fill-opacity':1}});
   this.map.addLayer({id:'reference-natural-rivers',type:'line',source:'geographic-reference','source-layer':'waterway',minzoom:9,filter:['in','class','river','stream'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#41788d','line-opacity':0,'line-width':['interpolate',['linear'],['zoom'],9,.8,14,1.8]}},'boundary');
   this.map.addLayer({id:'reference-waterway',type:'line',source:'geographic-reference','source-layer':'waterway',minzoom:7,paint:{'line-color':'#41788d','line-width':['interpolate',['linear'],['zoom'],7,.6,14,2]}},'boundary');
   this.map.addLayer({id:'reference-roads',type:'line',source:'geographic-reference','source-layer':'transportation',minzoom:8,filter:['in','class','motorway','trunk','primary','secondary','tertiary','minor','street'],paint:{'line-color':'#ede2c3','line-opacity':.6,'line-width':['interpolate',['linear'],['zoom'],8,.3,14,1.5]}},'boundary');
   this.map.addLayer({id:'reference-buildings',type:'fill',source:'geographic-reference','source-layer':'building',minzoom:13,paint:{'fill-color':'#7d7060','fill-opacity':.35}},'boundary');
  }
  if(this.map.getLayer('lake-detail'))this.map.moveLayer('lake-detail','boundary');
  this.referenceVisibility(this.reference);
  this.atlas.regional?.halc?.landscape?.reconcileOrder();
 }
 referenceVisibility(v){
  v=!!v&&!this.failed.has('geographic-reference');
  for(const id of ['reference-water','reference-waterway','reference-roads','reference-buildings'])if(this.map.getLayer(id))this.map.setLayoutProperty(id,'visibility',v?'visible':'none');
  const natural=this.enabled&&!this.failed.has('geographic-reference')&&!v;
  if(this.map.getLayer('reference-natural-rivers')){this.map.setLayoutProperty('reference-natural-rivers','visibility',natural?'visible':'none');this.map.setPaintProperty('reference-natural-rivers','line-opacity',natural&&this.referenceReady ? .9 : 0);}
  const coast=this.coastAligned&&!this.failed.has('geographic-reference'),fine=v&&this.referenceReady,fineCoast=(coast||v)&&this.referenceReady;
  if(this.map.getLayer('reference-ocean')){this.map.setLayoutProperty('reference-ocean','visibility',coast?'visible':'none');this.map.setPaintProperty('reference-ocean','fill-opacity',fineCoast?1:0);}
  if(this.map.getLayer('reference-base'))this.map.setPaintProperty('reference-base','background-opacity',fineCoast?1:0);
  this.map.setPaintProperty('coastal-water','fill-opacity',fineCoast?['step',['zoom'],1,8,0]:1);
  this.map.setPaintProperty('coast','line-opacity',fineCoast?['step',['zoom'],.55,8,0]:.55);
  this.map.setPaintProperty('physical-rivers','line-opacity',natural&&this.referenceReady?['interpolate',['linear'],['zoom'],1,.08,3,.55,8,.85,9,0]:fine?['interpolate',['linear'],['zoom'],1,.08,3,.55,7,.85,8,0]:['interpolate',['linear'],['zoom'],1,.08,3,.55,7,.85]);
  this.map.setPaintProperty('physical-lakes','fill-opacity',this.lakes?.ready&&this.lakes.enabled?0:fine?['interpolate',['linear'],['zoom'],1,.25,3,.8,7,.8,8,0]:['interpolate',['linear'],['zoom'],1,.25,3,.8]);
  this.atlas.regional?.halc?.landscape?.reconcileOrder();
 }
}
