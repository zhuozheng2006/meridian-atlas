export const EMPTY={type:'FeatureCollection',features:[]};
export const civilYear=y=>y>0?y-1:y;
export const inWindow=(e,year,span)=>civilYear(e.start)<=civilYear(year)+span&&civilYear(e.end)>=civilYear(year)-span;
export const stepYear=(year,step)=>{const n=year+step;return year<0&&n>=0?n+1:year>0&&n<=0?n-1:n;};
export const formatYear=(y,lang='zh')=>lang==='en'?`${Math.abs(y).toLocaleString('en-US')} ${y<0?'BCE':'CE'}`:`${y<0?'公元前':'公元'} ${Math.abs(y).toLocaleString('en-US')} 年`;
export const polityName=(r,lang)=>lang==='en'?r.name:(r.zhName||r.name);
export function wikipediaURL(v){if(/^https:\/\//.test(v))return v;if(/^[a-z-]+\.wikipedia\.org\/wiki\//.test(v))return 'https://'+v;return 'https://en.wikipedia.org/wiki/'+encodeURIComponent(v.replaceAll(' ','_'));}
export function activeRecords(catalog,year,relations=false){if(!year||year< -3400||year>2024)return [];return catalog.records.filter(r=>r.start<=year&&year<=r.end&&(relations||r.type==='POLITY')).sort((a,b)=>b.area-a.area);}
const resources=new Map();
export async function readJSON(url){
 if(resources.has(url))return resources.get(url);
 const pending=(async()=>{const r=await fetch(url);if(!r.ok)throw Error(`${r.status} ${url}`);if(!url.endsWith('.gz'))return r.json();const b=new Uint8Array(await r.arrayBuffer());return b[0]===31&&b[1]===139?new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).json():JSON.parse(new TextDecoder().decode(b));})();
 resources.set(url,pending);pending.catch(()=>resources.delete(url));return pending;
}
export const recordDetail=id=>readJSON(`data/fast/records-${String(Math.floor(+id.slice(5)/256)).padStart(3,'0')}.json.gz`).then(d=>d[id]);
const PALETTE=['#b69b68','#799a92','#9d919d','#a6a273','#729cab','#ab8973','#8caa79','#8198b7','#b38978','#98a283','#968eb3','#adad91'];
export function color(name){let h=0;for(const c of name)h=((h<<5)-h+c.charCodeAt(0))|0;return PALETTE[Math.abs(h)%PALETTE.length];}
const BOOT_YEARS=new Set([-3400,-221,1,500,1000,1492,1750,1914,1945,1991,2024]);
const overview=new Map(),detail=new Map();
async function geometryFor(catalog,records,year,high=false){
 const cache=high?detail:overview;
 if(!high&&BOOT_YEARS.has(year)&&records.some(r=>!cache.has(r.geometryId))){const b=await readJSON(`data/fast/year-${year}.json.gz`);Object.entries(b).forEach(([k,v])=>cache.set(k,v));}
 const missing=records.filter(r=>!cache.has(r.geometryId));
 const files=[...new Set(missing.map(r=>catalog.geometryIndex[r.geometryId]))];
 await Promise.all(files.map(async file=>{const url=high?'data/'+file+'.gz':'data/fast/'+file.replace('geometries','overview')+'.gz';const g=await readJSON(url);Object.entries(g).forEach(([k,v])=>cache.set(k,v));}));
 return cache;
}
export class AtlasMap{
 constructor(container,{onPolity,onReady,onError,globe=true}={}){
  this.container=container;this.onPolity=onPolity;this.lang='bi';this.showLabels=true;this.showEvents=true;this.showBorders=true;this.request=0;this.active=[];this.labels=[];this.markers=[];this.markerKey='';this.geometryKey='';this.destroyed=false;
  this.map=new maplibregl.Map({container,center:[25,18],zoom:globe?1.7:.75,minZoom:.2,maxZoom:7,attributionControl:false,fadeDuration:100,style:{version:8,projection:{type:globe?'globe':'mercator'},sky:{'sky-color':'#080e1a','horizon-color':'#7595ad','atmosphere-blend':.75,'sky-horizon-blend':.3},sources:{land:{type:'geojson',data:'data/land.geojson'},polities:{type:'geojson',data:EMPTY}},layers:[{id:'ocean',type:'background',paint:{'background-color':'#0a1525'}},{id:'land',type:'fill',source:'land',paint:{'fill-color':'#2a3d45'}},{id:'coast',type:'line',source:'land',paint:{'line-color':'#728187','line-width':.55}},{id:'territories',type:'fill',source:'polities',paint:{'fill-color':['get','color'],'fill-opacity':.88}},{id:'boundary',type:'line',source:'polities',paint:{'line-color':'#e6dfc9','line-width':.65,'line-opacity':.67}},{id:'selection-fill',type:'fill',source:'polities',filter:['==','id',''],paint:{'fill-color':'#efd199','fill-opacity':.16}},{id:'selection',type:'line',source:'polities',filter:['==','id',''],paint:{'line-color':'#ffdda2','line-width':2.2}}]}});
  this.map.addControl(new maplibregl.NavigationControl({showCompass:false}),'bottom-right');
  this.map.addControl(new maplibregl.AttributionControl({compact:true,customAttribution:'<a href="https://github.com/Seshat-Global-History-Databank/cliopatria" target="_blank" rel="noopener">Cliopatria / Seshat · CC BY 4.0</a> · <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>'}),'bottom-right');
  this.ready=new Promise(resolve=>this.map.once('load',()=>{resolve();onReady?.();}));
  this.map.on('click','territories',e=>{if(this.showBorders&&e.features?.length){const r=this.recordMap?.get(e.features[0].properties.id);if(r)this.onPolity?.(r);}});
  this.map.on('mouseenter','territories',()=>this.map.getCanvas().style.cursor='pointer');this.map.on('mouseleave','territories',()=>this.map.getCanvas().style.cursor='');
  this.map.on('error',e=>{if(e.error?.message?.includes('Failed to fetch'))onError?.(e.error);});
  this.map.on('moveend',()=>{this.refreshLabels();if(this.map.getZoom()>=3.5&&this.catalog)this.upgradeDetail();});
 }
 async setYear(catalog,year,lang=this.lang){
  const seq=++this.request;this.lang=lang;this.year=year;this.catalog=catalog;await this.ready;
  const records=activeRecords(catalog,year);const high=this.map.getZoom()>=3.5;const geos=await geometryFor(catalog,records,year,false);
  if(seq!==this.request||this.destroyed)return false;
  this.active=records;this.recordMap=new Map(records.map(r=>[r.id,r]));this.renderGeometry(geos,false);this.refreshLabels();if(high)this.upgradeDetail();return records.length;
 }
 renderGeometry(geos,high){
  const key=this.active.map(r=>r.id).join(',')+(high?'h':'o');if(key===this.geometryKey)return;this.geometryKey=key;
  this.map.getSource('polities').setData({type:'FeatureCollection',features:this.active.map(r=>({type:'Feature',properties:{id:r.id,color:color(r.name)},geometry:geos.get(r.geometryId)}))});
 }
 async upgradeDetail(){const seq=this.request;const recs=this.active;if(this.highRequest===seq)return;this.highRequest=seq;try{const g=await geometryFor(this.catalog,recs,this.year,true);if(!this.destroyed&&seq===this.request&&this.map.getZoom()>=3.5)this.renderGeometry(g,true);}catch{this.highRequest=null;}}
 refreshLabels(){
  this.labels.forEach(m=>m.remove());this.labels=[];if(!this.showLabels||!this.showBorders||this.destroyed)return;
  const b=this.map.getBounds(),zoom=this.map.getZoom(),placed=[],width=this.map.getContainer().clientWidth;const origin=this.map.getContainer().getBoundingClientRect();const blockers=[...document.querySelectorAll('.map-heading,.map-tools,.compare-heading')].filter(el=>el.getClientRects().length).map(el=>el.getBoundingClientRect());
  for(const r of this.active.filter(r=>r.center&&b.contains(r.center))){
   if(this.labels.length>=Math.min(36,10+Math.floor(zoom)*6))break;if(r.area<3500/Math.max(1,zoom))continue;
   const p=this.map.project(r.center);if(p.x<20||p.x>width-20||p.y<30)continue;if(blockers.some(b=>p.x+origin.left>b.left-40&&p.x+origin.left<b.right+40&&p.y+origin.top>b.top-18&&p.y+origin.top<b.bottom+18))continue;
   if(placed.some(v=>Math.abs(v.x-p.x)<110&&Math.abs(v.y-p.y)<43))continue;placed.push(p);
   const el=document.createElement('div');el.className='polity-label';el.textContent=polityName(r,this.lang);if(this.lang==='bi'&&r.zhName){const s=document.createElement('span');s.textContent=r.name;el.append(s);}
   this.labels.push(new maplibregl.Marker({element:el}).setLngLat(r.center).addTo(this.map));
  }
 }
 setEvents(events,lang,onClick,selected){
  const key=[this.showEvents,lang,selected,...events.map(e=>e.id)].join('|');if(key===this.markerKey)return;this.markerKey=key;
  this.markers.forEach(m=>m.remove());this.markers=[];if(!this.showEvents)return;
  for(const e of events.slice(0,600)){const el=document.createElement('button');el.className='event-marker'+(e.id===selected?' selected':'');el.style.setProperty('--cat',e.color||'#e3bf7d');el.title=lang==='en'?e.title.en:e.title.zh;el.setAttribute('aria-label',el.title);el.addEventListener('click',ev=>{ev.stopPropagation();onClick(e);});this.markers.push(new maplibregl.Marker({element:el}).setLngLat([e.lon,e.lat]).addTo(this.map));}
 }
 toggleBorders(v){this.showBorders=v;['territories','boundary','selection','selection-fill'].forEach(id=>this.map.setLayoutProperty(id,'visibility',v?'visible':'none'));this.refreshLabels();}
 selectPolity(r){['selection','selection-fill'].forEach(id=>this.map.setFilter(id,['==','id',r?.id||'']));}
 fly(lon,lat,zoom=2.6){this.map.flyTo({center:[lon,lat],zoom:Math.min(5,zoom),duration:700,essential:false});}
 reset(){this.map.flyTo({center:[25,18],zoom:this.map.getProjection().type==='globe'?1.7:.75,duration:700});}
 projection(globe){this.map.setProjection({type:globe?'globe':'mercator'});}
 destroy(){this.destroyed=true;this.markers.forEach(m=>m.remove());this.labels.forEach(m=>m.remove());this.map.remove();}
}
