import {simplifiedChinese} from './simplified-chinese.js?v=3.4.0-87749ce3b390';
import {historicalYearRange} from './historical-dates.js?v=3.4.0-87749ce3b390';
import {featureName,recordYear,historicalMapURL} from './historical-detail.js?v=3.4.0-87749ce3b390';

const SOURCE='regional-boundaries',IDS=['regional-wash','regional-edges','regional-selected'];
export const REGIONAL_MIN_ZOOM=6;
const tr=(lang,zh,en)=>lang==='en'?en:zh;

const CITY_ZH={'Rottweil':'罗特魏尔','Kaysersberg':'凯泽斯贝格','Kaufbeuren':'考夫博伊伦','Kempten':'肯普滕','Besançon':'贝桑松','Strasbourg':'斯特拉斯堡','Bern':'伯尔尼','Colmar':'科尔马','Haguenau':'阿格诺','Hagenau':'阿格诺','Munster':'明斯特','Obernai':'奥贝尔奈','Rosheim':'罗斯海姆','Sélestat':'塞莱斯塔','Turckheim':'蒂尔凯姆','Ulm':'乌尔姆','Memmingen':'梅明根','Lindau':'林道'};
const AREA_ZH={'Prince-Bishopric of Basel':'巴塞尔主教领','Landgraviate of Thurgau':'图尔高方伯领','Republic of Mulhouse':'米卢斯共和国','Duchy of Lorraine':'洛林公国','Duchy of Bar':'巴尔公国'};
export function regionalName(p,lang='bi',records=[]){
 if(lang==='en')return featureName(p,'en');
 const zh=p['name_zh-hans']||p['name_zh-cn']||p.name_zh;
 if(zh)return simplifiedChinese(zh).slice(0,200);
 const en=p.name_en||p.name,existing=records.find(r=>r.name===en&&r.zhName);
 if(existing)return existing.zhName;
 if(AREA_ZH[en])return AREA_ZH[en];
 const city=/^Free Imperial City of (.+)$/.exec(en||'');
 if(city&&CITY_ZH[city[1]])return CITY_ZH[city[1]]+'帝国自由市';
 return featureName(p,lang);
}

// The regional atlas is a July 1 snapshot. A single instant prevents two
// successive shapes within the same calendar year from being drawn together.
export function regionalDate(year){
 const [a]=historicalYearRange(year),leap=a%4===0&&(a%100!==0||a%400===0);
 return a+(leap?182.5/366:181.5/365);
}
export function regionalVisible(p,year){
 const t=regionalDate(year),s=p.start_decdate,e=p.end_decdate;
 return Number.isFinite(s)&&Math.abs(s)<1e8&&s<=t&&
  (Number.isFinite(e)?Math.abs(e)<1e8&&e>=s&&e>=t:!Object.hasOwn(p,'end_decdate')&&!Object.hasOwn(p,'end_date'))&&
  p.type==='administrative'&&Number.isFinite(p.admin_level)&&p.admin_level>=2&&p.admin_level<=4;
}
export function regionalFilter(year){
 const t=regionalDate(year);
 return ['all',['==',['get','type'],'administrative'],
  ['>=',['number',['get','admin_level'],99],2],['<=',['number',['get','admin_level'],99],4],
  ['==',['typeof',['get','start_decdate']],'number'],['>',['number',['get','start_decdate'],1e8],-1e8],['<=',['number',['get','start_decdate'],1e8],t],
  ['any',['all',['!', ['has','end_decdate']],['!', ['has','end_date']]],
   ['all',['==',['typeof',['get','end_decdate']],'number'],['<',['number',['get','end_decdate'],-1e8],1e8],
    ['>=',['number',['get','end_decdate'],-1e8],t],['>=',['number',['get','end_decdate'],-1e8],['number',['get','start_decdate'],1e8]]]]];
}
export function regionalLayers(year){
 const base={source:SOURCE,'source-layer':'boundaries',minzoom:REGIONAL_MIN_ZOOM,filter:regionalFilter(year)};
 return [
  {...base,id:IDS[0],type:'fill',paint:{'fill-color':['to-color',['at',['%', ['abs',['number',['get','osm_id'],0]],6],['literal',['#a89563','#6f9693','#93936a','#a38e83','#879baa','#ab9a75']]]],'fill-opacity':['case',['==',['get','admin_level'],2],.035,.22]}},
  {...base,id:IDS[1],type:'line',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#635d4a','line-width':['interpolate',['linear'],['zoom'],6,.65,10,1.05,15,1.4],'line-opacity':['case',['==',['get','disputed'],'yes'],.45,.8],'line-blur':.15}},
  {...base,id:IDS[2],type:'line',filter:['all',regionalFilter(year),['==',['get','osm_id'],0]],layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#e6bc6a','line-width':2.5,'line-opacity':.9}}
 ];
}
export function regionalElementURL(p){
 const id=Number(p.osm_id);return Number.isSafeInteger(id)&&id!==0?`https://www.openhistoricalmap.org/${id<0?'relation':'way'}/${Math.abs(id)}`:null;
}
// Interior label point: intersect a horizontal scanline with polygon rings,
// then use the midpoint of the widest inside interval (including holes).
function clipRing(ring,box){
 let points=ring.slice(0,-1);
 for(const [axis,edge,sign] of [[0,box[0],1],[0,box[2],-1],[1,box[1],1],[1,box[3],-1]]){
  const next=[];if(!points.length)break;
  for(let i=0;i<points.length;i++){
   const a=points[(i+points.length-1)%points.length],b=points[i],ain=(a[axis]-edge)*sign>=0,bin=(b[axis]-edge)*sign>=0;
   if(ain!==bin){const t=(edge-a[axis])/(b[axis]-a[axis]);next.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
   if(bin)next.push(b);
  }
  points=next;
 }
 return points.length>=3?[...points,points[0]]:[];
}
export function interiorPoint(geometry,box=null){
 const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];
 let best=null,score=0;
 for(const original of polygons){
  const rings=box?original.map(r=>clipRing(r,box)).filter(r=>r.length):original;
  const outer=rings[0];if(!outer?.length)continue;
  let lo=Infinity,hi=-Infinity;for(const p of outer){lo=Math.min(lo,p[1]);hi=Math.max(hi,p[1]);}
  for(const ratio of [.5,.35,.65]){
   const y=lo+(hi-lo)*ratio,xs=[];
   for(const ring of rings)for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i];if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}
   xs.sort((a,b)=>a-b);
   for(let i=0;i+1<xs.length;i+=2){const width=xs[i+1]-xs[i],area=width*(hi-lo);if(area>score){score=area;best=[(xs[i]+xs[i+1])/2,y];}}
  }
 }
 return best;
}
export class RegionalBoundaries{
 constructor(atlas,{enabled=true,modern=false}={}){
  this.atlas=atlas;this.map=atlas.map;this.enabled=enabled;this.modern=modern;this.year=atlas.year;this.lang=atlas.lang;this.status='zoom';this.active=false;this.failed=false;this.features=[];this.markers=[];this.listeners=[];this.settling=false;
  const on=(event,fn)=>{this.map.on(event,fn);this.listeners.push([event,fn]);};
  this.badge=document.createElement('button');this.badge.className='regional-badge';this.badge.hidden=true;this.badge.onclick=()=>this.failed?this.retry():this.openIndex();this.map.getContainer().append(this.badge);
  on('moveend',()=>this.update());on('idle',()=>this.settle());
  on('error',e=>{if(e.sourceId===SOURCE){this.failed=true;this.lastError=String(e.error?.message||e.error||'Source error');this.features=[];this.setActive(false);this.setStatus('error');this.visibility();}});
  on('click',e=>{if(this.atlas.historical?.hit(e.point))return;const f=this.hit(e.point);if(f)this.openFeature(f,e.lngLat);});
  this.update();
 }
 get eligible(){return this.enabled&&this.atlas.showBorders&&!this.modern&&this.map.getZoom()>=REGIONAL_MIN_ZOOM&&!this.atlas.destroyed;}
 ensure(){
  if(this.map.getSource(SOURCE))return;
  this.map.addSource(SOURCE,{type:'vector',tiles:['https://vtiles.openhistoricalmap.org/maps/ohm_admin/{z}/{x}/{y}'],minzoom:REGIONAL_MIN_ZOOM,maxzoom:14,attribution:'<a href="https://www.openhistoricalmap.org/copyright" target="_blank" rel="noopener">OpenHistoricalMap contributors</a> · <a href="https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Sources" target="_blank" rel="noopener">Sources & attribution</a>'});
  for(const layer of regionalLayers(this.year))this.map.addLayer(layer,'boundary');
 }
 setStatus(status){this.status=status;this.badge.hidden=!this.eligible;this.badge.textContent=tr(this.lang,status==='ready'?`地区详图 · ${this.features.length} 条区划`:status==='error'?'地区详图 · 重试':status==='empty'?'此处沿用疆域概览':'正在展开地区详图…',status==='ready'?`Regional detail · ${this.features.length} areas`:status==='error'?'Regional detail · retry':status==='empty'?'Territory overview here':'Opening regional detail…');this.map.getContainer().dispatchEvent(new CustomEvent('regional-status',{bubbles:true}));}
 setActive(v){
  if(v===this.active)return;this.active=v;
  // Switch datasets explicitly. Never bend coarse geometry to follow modern
  // rivers or silently present interpolated curves as historical evidence.
  this.map.setPaintProperty('territories','fill-opacity',v?0:['interpolate',['linear'],['zoom'],0,.53,4,.4,9,.2]);
  this.map.setPaintProperty('boundary','line-opacity',v?0:['interpolate',['linear'],['zoom'],1,.36,4,.5,9,.4]);
  this.map.setPaintProperty('selection','line-opacity',v?0:1);this.map.setPaintProperty('selection-fill','fill-opacity',v?0:.08);
  this.atlas.refreshLabels();
 }
 visibility(){for(const id of IDS)if(this.map.getLayer(id))this.map.setLayoutProperty(id,'visibility',this.eligible&&!this.failed?'visible':'none');}
 update(){
  if(this.atlas.destroyed)return;
  if(!this.eligible){this.setActive(false);this.clearLabels();this.closePopup();this.features=[];this.setStatus(!this.enabled?'off':this.modern?'modern':'zoom');}
  else if(!this.failed){this.ensure();this.setStatus('loading');}else this.setStatus('error');
  this.visibility();
 }
 settle(){
  if(this.settling||!this.eligible||this.failed||this.map.isMoving()||!this.map.getSource(SOURCE)||!this.map.isSourceLoaded(SOURCE))return;
  this.settling=true;
  try{
   const unique=new Map();for(const f of this.map.queryRenderedFeatures({layers:[IDS[0]]})){if(!regionalVisible(f.properties,this.year))continue;const key=f.properties.osm_id;if(!unique.has(key))unique.set(key,f);}
   this.features=[...unique.values()].sort((a,b)=>(a.properties.area||Infinity)-(b.properties.area||Infinity));
   this.setActive(this.features.length>0);this.setStatus(this.active?'ready':'empty');this.refreshLabels();
  }finally{this.settling=false;}
 }
 setYear(year,lang){
  this.year=year;this.lang=lang;this.features=[];this.closePopup();this.clearLabels();this.setActive(false);
  for(const layer of regionalLayers(year))if(this.map.getLayer(layer.id))this.map.setFilter(layer.id,layer.filter);
  this.update();
 }
 toggle(v){this.enabled=v;this.update();}
 setModern(v){this.modern=v;this.update();}
 hit(point){
  if(!this.active||!this.eligible||this.failed)return null;
  return this.map.queryRenderedFeatures(point,{layers:[IDS[0]]}).filter(f=>regionalVisible(f.properties,this.year)).sort((a,b)=>(a.properties.area||Infinity)-(b.properties.area||Infinity))[0]||null;
 }
 clearLabels(){for(const m of this.markers)m.remove();this.markers=[];}
 refreshLabels(){
  this.clearLabels();if(!this.active||!this.atlas.showLabels)return;
  const root=this.map.getContainer().getBoundingClientRect(),overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  const bounds=this.map.getBounds();let clipBox=[bounds.getWest(),bounds.getSouth(),bounds.getEast(),bounds.getNorth()];
  if(Math.abs(this.map.getBearing())<1&&root.width>220&&root.height>250){const a=this.map.unproject([80,100]),b=this.map.unproject([root.width-80,root.height-90]);clipBox=[a.lng,b.lat,b.lng,a.lat];}
  const boxes=[...document.querySelectorAll('.map-heading,.map-tools,.compare-heading,.map-legend,.map-notice,.layer-panel,.place-marker,.event-marker,.regional-badge')].filter(el=>el.getClientRects().length).map(el=>el.getBoundingClientRect());
  for(const f of this.features){
   if(this.markers.length>=14)break;if(f.properties.admin_level===2)continue;
   const name=regionalName(f.properties,this.lang,this.atlas.active),coord=interiorPoint(f.geometry,clipBox[0]<clipBox[2]?clipBox:null);if(!name||!coord)continue;
   const p=this.map.project(coord),width=Math.min(190,Math.max(this.lang==='bi'&&f.properties.name_en&&name!==f.properties.name_en?145:80,name.length*7)),box={left:root.left+p.x-width/2,right:root.left+p.x+width/2,top:root.top+p.y-25,bottom:root.top+p.y+25};
   if(box.left<root.left+12||box.right>root.right-12||box.top<root.top+85||box.bottom>root.bottom-85||boxes.some(b=>overlap(box,b)))continue;
   const el=document.createElement('button');el.className='regional-label';el.textContent=name;el.style.maxWidth=width+'px';if(this.lang==='bi'&&f.properties.name_en&&name!==f.properties.name_en){const en=document.createElement('span');en.textContent=f.properties.name_en;el.append(en);}el.setAttribute('aria-label',name);el.onclick=e=>{e.stopPropagation();this.openFeature(f,{lng:coord[0],lat:coord[1]});};
   this.markers.push(new maplibregl.Marker({element:el,opacityWhenCovered:'0'}).setLngLat(coord).addTo(this.map));boxes.push(box);
  }
 }
 closePopup(){this.popup?.remove();this.popup=null;if(this.map.getLayer(IDS[2]))this.map.setFilter(IDS[2],['all',regionalFilter(this.year),['==',['get','osm_id'],0]]);}
 popupAt(node,point){
  this.popup=new maplibregl.Popup({className:'historical-popup regional-popup',maxWidth:'330px',closeButton:true,closeOnClick:true,focusAfterOpen:false,offset:12}).setLngLat(point).setDOMContent(node).addTo(this.map);
  const el=this.popup.getElement();el.setAttribute('role','dialog');el.setAttribute('aria-label',tr(this.lang,'历史区划档案','Historical boundary record'));const close=el.querySelector('.maplibregl-popup-close-button');close.setAttribute('aria-label',tr(this.lang,'关闭区划档案','Close boundary record'));close.focus({preventScroll:true});el.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();this.closePopup();this.map.getCanvas().focus();}});
  this.popup.on('close',()=>{if(this.map.getLayer(IDS[2]))this.map.setFilter(IDS[2],['all',regionalFilter(this.year),['==',['get','osm_id'],0]]);});
 }
 openFeature(f,point){
  if(!regionalVisible(f.properties,this.year))return;this.closePopup();const p=f.properties,node=document.createElement('section');
  const small=document.createElement('small');small.className='historical-eyebrow';small.textContent=tr(this.lang,'历史区划 · 地区详图','Historical area · regional detail');const h=document.createElement('h3');h.textContent=regionalName(p,this.lang,this.atlas.active);node.append(small,h);if(this.lang==='bi'&&p.name_en&&h.textContent!==p.name_en){const en=document.createElement('p');en.textContent=p.name_en;node.append(en);}
  const dl=document.createElement('dl');for(const [term,value]of [[tr(this.lang,'记录开始','Record begins'),recordYear(p.start_decdate,this.lang)],[tr(this.lang,'记录结束','Record ends'),recordYear(p.end_decdate,this.lang)]]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=term;dd.textContent=value;dl.append(dt,dd);}node.append(dl);
  const links=document.createElement('div');links.className='historical-source-links';for(const [label,url]of [[tr(this.lang,'原始区划记录','Original boundary record'),regionalElementURL(p)],[tr(this.lang,'同年来源地图','Source map in this year'),historicalMapURL(this.year,this.map.getCenter(),this.map.getZoom())]]){if(!url)continue;const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);}node.append(links);
  const related=this.atlas.active?.find(r=>r.name===(p.name_en||p.name));if(related){const b=document.createElement('button');b.className='regional-dossier';b.textContent=tr(this.lang,'相关疆域档案','Related territory dossier');b.onclick=()=>{this.closePopup();this.atlas.onPolity?.(related);};node.append(b);}
  const credit=document.createElement('p');credit.className='historical-credit';credit.textContent='OpenHistoricalMap contributors';node.append(credit);this.popupAt(node,point);this.map.setFilter(IDS[2],['all',regionalFilter(this.year),['==',['get','osm_id'],p.osm_id]]);
 }
 openIndex(){
  this.closePopup();const node=document.createElement('section'),h=document.createElement('h3');h.textContent=tr(this.lang,'这一年的地区区划','Regional areas in this year');node.append(h);
  const note=document.createElement('p');note.textContent=tr(this.lang,'使用带年代的原始轮廓。点击区划可查阅来源；图层中可切回全球疆域概览。','Dated source outlines. Select an area for its record; Layers lets you return to the global territory overview.');node.append(note);
  const list=document.createElement('div');list.className='historical-record-list';for(const f of this.features.slice(0,24)){const b=document.createElement('button');b.textContent=regionalName(f.properties,this.lang,this.atlas.active);b.onclick=()=>this.openFeature(f,this.map.getCenter());list.append(b);}node.append(list);this.popupAt(node,this.map.getCenter());
 }
 retry(){this.closePopup();for(const id of IDS.toReversed())if(this.map.getLayer(id))this.map.removeLayer(id);if(this.map.getSource(SOURCE))this.map.removeSource(SOURCE);this.failed=false;this.update();}
 destroy(){this.closePopup();this.clearLabels();this.badge.remove();for(const [event,fn]of this.listeners)this.map.off(event,fn);}
}
