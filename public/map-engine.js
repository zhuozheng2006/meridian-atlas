import {RegionalBoundaries} from './regional-boundaries.js?v=3.5.0-1b93c46bd25d';
import {HistoricalDetailLayer} from './historical-detail.js?v=3.5.0-1b93c46bd25d';
import {Geography} from './geography.js?v=3.5.0-1b93c46bd25d';
import {loadNative,nativeGeometry} from './native-geometry.js?v=3.5.0-1b93c46bd25d';
export const EMPTY={type:'FeatureCollection',features:[]};
export const civilYear=y=>y>0?y-1:y;
export const inWindow=(e,year,span)=>civilYear(e.start)<=civilYear(year)+span&&civilYear(e.end)>=civilYear(year)-span;
export const stepYear=(year,step)=>{const n=year+step;return year<0&&n>=0?n+1:year>0&&n<=0?n-1:n;};
export const formatYear=(y,lang='zh')=>{const n=Math.abs(y)>=10000?Math.abs(y).toLocaleString('en-US'):String(Math.abs(y));return lang==='en'?`${n} ${y<0?'BCE':'CE'}`:`${y<0?'公元前':'公元'} ${n} 年`;};
export const polityName=(r,lang)=>lang==='en'?r.name:(r.zhName||r.name);
export function wikipediaURL(v){if(/^https:\/\//.test(v))return v;if(/^[a-z-]+\.wikipedia\.org\/wiki\//.test(v))return 'https://'+v;return 'https://en.wikipedia.org/wiki/'+encodeURIComponent(v.replaceAll(' ','_'));}
export function activeRecords(catalog,year,relations=false){if(!year||year< -3400||year>2024)return [];return catalog.records.filter(r=>r.start<=year&&year<=r.end&&(relations||r.type==='POLITY')).sort((a,b)=>b.area-a.area);}
const resources=new Map();
export const forgetJSON=url=>resources.delete(url);
export async function readJSON(url){
 if(resources.has(url))return resources.get(url);
 const pending=(async()=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
   const response=await fetch(url,{signal:controller.signal,cache:'no-cache'});if(!response.ok)throw Error(`${response.status} ${url}`);
   if(!url.endsWith('.gz'))return await response.json();
   const bytes=new Uint8Array(await response.arrayBuffer());
   return bytes[0]===31&&bytes[1]===139?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json():JSON.parse(new TextDecoder().decode(bytes));
  }finally{clearTimeout(timer);}
 })();
 resources.set(url,pending);pending.catch(()=>resources.delete(url));return pending;
}
export const recordDetail=id=>readJSON(`data/fast/records-${String(Math.floor(+id.slice(5)/256)).padStart(3,'0')}.json.gz`).then(d=>d[id]);
const PALETTE=['#b69b68','#799a92','#9d919d','#a6a273','#729cab','#ab8973','#8caa79','#8198b7','#b38978','#98a283','#968eb3','#adad91'];
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
 constructor(container,{onPolity,onReady,onError,globe=true,camera=null,year=1492,historical=true,reference=false,regional=true,boundaryMode='auto',onBoundaryMode}={}){
  this.year=year;this.container=container;this.onPolity=onPolity;this.onBoundaryMode=onBoundaryMode;this.lang='bi';this.showLabels=true;this.showEvents=true;this.showBorders=true;this.request=0;this.active=[];this.labels=[];this.markers=[];this.markerKey='';this.geometryKey='';this.destroyed=false;
  this.map=new maplibregl.Map({container,keyboard:false,canvasContextAttributes:{antialias:true},center:[25,18],zoom:globe?worldZoom(document.getElementById(container)):.6,...(camera||{}),minZoom:.2,maxZoom:18,attributionControl:false,fadeDuration:100,style:{version:8,projection:{type:globe?'globe':'mercator'},sky:{'sky-color':'#091725','horizon-color':'#718c97','atmosphere-blend':.5,'sky-horizon-blend':.3},sources:{land:{type:'geojson',data:'data/land.geojson'},polities:{type:'geojson',data:EMPTY,tolerance:0,maxzoom:14}},layers:[{id:'ocean',type:'background',paint:{'background-color':'#163246'}},{id:'land',type:'fill',source:'land',paint:{'fill-color':'#c9c4a4'}},{id:'coast',type:'line',source:'land',paint:{'line-color':'#a5b6ae','line-width':['interpolate',['linear'],['zoom'],0,.25,4,.65],'line-opacity':.55}},{id:'territories',type:'fill',source:'polities',paint:{'fill-color':['get','color'],'fill-opacity':['interpolate',['linear'],['zoom'],0,.53,4,.4,9,.2]}},{id:'boundary',type:'line',source:'polities',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#f2e8c8','line-width':['interpolate',['linear'],['zoom'],0,.22,2,.4,5,.65,10,1],'line-opacity':['interpolate',['linear'],['zoom'],1,.36,4,.5,9,.4],'line-blur':.25}},{id:'selection-fill',type:'fill',source:'polities',filter:['==','id',''],paint:{'fill-color':'#efd199','fill-opacity':.08}},{id:'selection',type:'line',source:'polities',layout:{'line-join':'round','line-cap':'round'},filter:['==','id',''],paint:{'line-color':'#fff0b9','line-width':['interpolate',['linear'],['zoom'],1,1.2,5,1.8,10,2.2]}}]}});
  this.map.addControl(new maplibregl.NavigationControl({showCompass:false}),'bottom-right');
  this.map.addControl(new maplibregl.AttributionControl({compact:true,customAttribution:'<a href="https://github.com/Seshat-Global-History-Databank/cliopatria" target="_blank" rel="noopener">Cliopatria / Seshat · CC BY 4.0</a> · <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>'}),'bottom-right');
  this.ready=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Map initialization timed out')),25000);this.map.once('load',()=>{clearTimeout(timeout);{const attribution=this.map.getContainer().querySelector('.maplibregl-ctrl-attrib');if(attribution){attribution.open=false;attribution.classList.remove('maplibregl-compact-show');}}resolve();this.geography=new Geography(this);this.geography.init().catch(()=>{});this.regional=new RegionalBoundaries(this,{enabled:regional,modern:reference,mode:boundaryMode});this.historical=new HistoricalDetailLayer(this,{enabled:historical,modern:reference});onReady?.();});});
  this.map.getCanvas().setAttribute('aria-label','历史地图 · 左右键调整年份，Alt + 方向键移动地图 / Historical map: arrows change year; Alt + arrows pan');
  this.map.getCanvas().addEventListener('webglcontextlost',()=>onError?.(Error('contextlost')));
  this.map.on('click','territories',e=>{if(this.regional?.active||this.historical?.hit(e.point))return;if(this.geography?.reference&&this.map.getLayer('reference-water')&&this.map.queryRenderedFeatures(e.point,{layers:['reference-water']}).length)return;if(this.geography?.coastAligned&&this.geography.fineCoastVisible&&this.map.getLayer('reference-ocean')&&this.map.queryRenderedFeatures(e.point,{layers:['reference-ocean']}).length)return;if(this.geography?.coastAligned&&!this.geography.fineCoastVisible&&this.map.getLayer('coastal-water')&&this.map.queryRenderedFeatures(e.point,{layers:['coastal-water']}).length)return;if(this.showBorders&&e.features?.length){const r=this.recordMap?.get(e.features[0].properties.id);if(r)this.onPolity?.(r);}});
  this.map.on('mousemove',e=>{if(this.regional?.active)this.map.getCanvas().style.cursor=this.regional.hit(e.point)?'pointer':'';});this.map.on('mouseenter','territories',()=>{if(!this.regional?.active)this.map.getCanvas().style.cursor='pointer';});this.map.on('mouseleave','territories',()=>this.map.getCanvas().style.cursor='');
  this.map.on('error',e=>{if(!['terrain-dem','geographic-reference','historical-detail','regional-boundaries','relief'].includes(e.sourceId)&&e.error?.message?.includes('Failed to fetch'))onError?.(e.error);});
  this.map.on('moveend',()=>{this.refreshLabels();this.upgradeLand();if(this.catalog)this.upgradeDetail();});
 }
 async setYear(catalog,year,lang=this.lang){
  const seq=++this.request;this.lang=lang;this.catalog=catalog;await this.ready;
  const records=activeRecords(catalog,year);if(BOOT_YEARS.has(year)){try{await loadNative(records,year);}catch{}}const geos=records.every(r=>nativeGeometry(r.id)||detail.has(r.geometryId))?detail:await geometryFor(catalog,records,year,false);const high=records.every(r=>detail.has(r.geometryId));
  if(seq!==this.request||this.destroyed)return false;
  this.upgradeLand();this.year=year;this.active=records;this.recordMap=new Map(records.map(r=>[r.id,r]));this.renderGeometry(high?detail:geos,high);this.refreshLabels();this.upgradeDetail();this.places?.setYear(year,lang);this.historical?.setYear(year,lang);this.regional?.setYear(year,lang);return records.length;
 }
 renderGeometry(geos,high){
  const complete=this.active.every(r=>nativeGeometry(r.id));const key=this.active.map(r=>r.id+(nativeGeometry(r.id)?'n':'')).join(',')+(complete?'n':high?'h':'o');if(key===this.geometryKey)return;this.geometryKey=key;this.map.getContainer?.()?.dispatchEvent(new CustomEvent('geometry-status',{bubbles:true,detail:{fine:complete}}));
  this.map.getSource('polities').setData({type:'FeatureCollection',features:this.active.map(r=>({type:'Feature',properties:{id:r.id,color:color(r.name)},geometry:nativeGeometry(r.id)||geos.get(r.geometryId)||detail.get(r.geometryId)||overview.get(r.geometryId)}))});
 }
 async upgradeLand(){/* Geography owns the progressively loaded physical base. */}
 async upgradeDetail(){
  const seq=this.request,records=this.active,year=this.year;
  if(this.highRequest===seq||this.geometryKey.endsWith('n'))return;
  this.highRequest=seq;
  try{await loadNative(records,year,()=>!this.destroyed&&seq===this.request);if(!this.destroyed&&seq===this.request)this.renderGeometry(detail,true);}
  catch{/* Retain the fast map. A later navigation retries failed source files. */}
  finally{if(this.highRequest===seq)this.highRequest=null;}
 }
 refreshLabels(){
  this.labels.forEach(m=>m.remove());this.labels=[];this.labelBoxes=[];this.geography?.lakes?.refreshLabels();this.historical?.refreshLabels();this.regional?.refreshLabels();
  if(!this.showLabels||!this.showBorders||this.destroyed||this.regional?.active){this.places?.refresh();return;}
  const bounds=this.map.getBounds(),zoom=this.map.getZoom(),placed=[];
  const origin=this.map.getContainer().getBoundingClientRect();
  const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  const blockers=[...document.querySelectorAll('.map-heading,.map-tools,.compare-heading,.map-legend,.map-notice,.layer-panel')]
   .filter(el=>el.getClientRects().length).map(el=>el.getBoundingClientRect());
  const context=document.createElement('canvas').getContext('2d');context.font='13px system-ui';
  for(const r of this.active.filter(r=>(r.labelCenter||r.center)&&bounds.contains(r.labelCenter||r.center))){
   const anchor=r.labelCenter||r.center;
   if(this.labels.length>=Math.min(30,6+Math.floor(zoom)*5))break;
   if(r.area<8000/Math.max(1,zoom))continue;
   if(this.map.getProjection().type==='globe'&&zoom<2.5){const c=this.map.getCenter(),rad=Math.PI/180;const dot=Math.sin(c.lat*rad)*Math.sin(anchor[1]*rad)+Math.cos(c.lat*rad)*Math.cos(anchor[1]*rad)*Math.cos((anchor[0]-c.lng)*rad);if(dot<.15)continue;}
   const p=this.map.project(anchor),name=polityName(r,this.lang);
   const bilingual=this.lang==='bi'&&r.zhName&&zoom>=2.3;
   const w=Math.min(164,Math.max(context.measureText(name).width,bilingual?context.measureText(r.name).width*.82:0)+16),h=bilingual?42:25;
   const box={left:origin.left+p.x-w/2,right:origin.left+p.x+w/2,top:origin.top+p.y-h/2,bottom:origin.top+p.y+h/2};
   if(box.left<origin.left+12||box.right>origin.right-12||box.top<origin.top+12||box.bottom>origin.bottom-28)continue;
   if(blockers.some(b=>overlap(box,b))||placed.some(b=>overlap(box,b)))continue;
   this.labelBoxes.push(box);placed.push({...box,left:box.left-10,right:box.right+10,top:box.top-7,bottom:box.bottom+7});
   const el=document.createElement('div');el.className='polity-label';el.textContent=name;
   if(bilingual){const en=document.createElement('span');en.textContent=r.name;el.append(en);}
   this.labels.push(new maplibregl.Marker({element:el,opacityWhenCovered:'0'}).setLngLat(anchor).addTo(this.map));
  }
  this.places?.refresh();
 }
 setEvents(events,lang,onClick,selected){
  const key=[this.showEvents,lang,selected,...events.map(e=>e.id)].join('|');if(key===this.markerKey)return;this.markerKey=key;
  this.markers.forEach(m=>m.remove());this.markers=[];if(!this.showEvents)return;
  for(const e of events.slice(0,600)){const el=document.createElement('button');el.className='event-marker'+(e.id===selected?' selected':'');el.style.setProperty('--cat',e.color||'#e3bf7d');el.title=lang==='en'?e.title.en:e.title.zh;el.setAttribute('aria-label',el.title);el.addEventListener('click',ev=>{ev.stopPropagation();onClick(e);});this.markers.push(new maplibregl.Marker({element:el,opacityWhenCovered:'0'}).setLngLat([e.lon,e.lat]).addTo(this.map));}
 }
 toggleBorders(v){this.showBorders=v;['territories','boundary','selection','selection-fill'].forEach(id=>this.map.setLayoutProperty(id,'visibility',v?'visible':'none'));this.regional?.update();this.refreshLabels();}
 selectPolity(r){['selection','selection-fill'].forEach(id=>this.map.setFilter(id,['==','id',r?.id||'']));}
 focusPolity(record){
  const geometry=nativeGeometry(record.id)||detail.get(record.geometryId)||overview.get(record.geometryId);if(!geometry||!record.center)return;
  const lons=[],lats=[],center=(record.labelCenter||record.center)[0];
  const visit=coordinates=>{if(typeof coordinates[0]==='number'){let x=coordinates[0];while(x-center>180)x-=360;while(x-center< -180)x+=360;lons.push(x);lats.push(coordinates[1]);}else coordinates.forEach(visit);};visit(geometry.coordinates);
  const west=Math.min(...lons),east=Math.max(...lons),south=Math.max(-85,Math.min(...lats)),north=Math.min(85,Math.max(...lats));
  if(east-west>210){this.fly(...(record.labelCenter||record.center),1.5);return;}
  this.map.fitBounds([[west,south],[east,north]],{padding:{top:120,bottom:60,left:38,right:100},maxZoom:4.5,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:650});
 }
 fly(lon,lat,zoom=2.6){this.map.flyTo({center:[lon,lat],zoom:Math.min(18,zoom),duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:650,essential:false});}
 reset(){this.map.flyTo({center:[25,18],zoom:this.map.getProjection().type==='globe'?worldZoom(this.map.getContainer()):.6,duration:650});}
 projection(globe){this.map.setProjection({type:globe?'globe':'mercator'});}
 destroy(){this.destroyed=true;this.historical?.destroy();this.regional?.destroy();this.geography?.lakes?.destroy();this.places?.destroy();this.markers.forEach(m=>m.remove());this.labels.forEach(m=>m.remove());this.map.remove();}
}
