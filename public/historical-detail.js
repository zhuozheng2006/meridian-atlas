import {historicalDateFilter,datedFeatureVisible,historicalYearRange} from './historical-dates.js?v=3.9.4-380fd480ab21';
const SOURCE='historical-detail';
const IDS=['historic-buildings','historic-building-edges','historic-road-casing','historic-roads','historic-railways'];
const HIT=['historic-buildings','historic-roads','historic-railways'];
const tr=(lang,zh,en)=>lang==='en'?en:zh;
export function featureName(p,lang='bi'){
 const v=lang==='en'?(p.name_en||p.name):(p['name_zh-hans']||p['name_zh-cn']||p.name_en||p.name);
 return typeof v==='string'?v.slice(0,200):'';
}
export function featureKind(f,lang='bi'){
 return tr(lang,...(f.sourceLayer==='buildings'?['建筑轮廓','Building footprint']:f.properties.class==='railway'?['铁路与轨道','Railway / track']:['道路与街巷','Road / street']));
}
export function recordYear(decimal,lang='bi'){
 if(!Number.isFinite(decimal))return tr(lang,'未记载','Unrecorded');
 const a=Math.floor(decimal),y=a<=0?a-1:a;
 return lang==='en'?`${Math.abs(y)} ${y<0?'BCE':'CE'}`:`${y<0?'公元前':'公元'} ${Math.abs(y)} 年`;
}
export function historicalMapURL(year,center,zoom){
 const [a]=historicalYearRange(year),date=(a<0?'-':'')+String(Math.abs(a)).padStart(4,'0')+'-07-01';
 return `https://www.openhistoricalmap.org/#map=${Math.min(18,Math.max(1,zoom)).toFixed(2)}/${center.lat.toFixed(6)}/${center.lng.toFixed(6)}&date=${date}`;
}
export function historyLayers(year){
 const date=historicalDateFilter(year),built=['!', ['in',['get','type'],['literal',['construction','proposed']]]],road=['all',date,built,['==',['get','class'],'highway']],rail=['all',date,built,['==',['get','class'],'railway']];
 const width=['interpolate',['exponential',1.4],['zoom'],11,.7,14,2,18,8];
 return [
  {id:IDS[0],type:'fill',source:SOURCE,'source-layer':'buildings',minzoom:14,filter:date,paint:{'fill-color':'#8b6850','fill-opacity':['interpolate',['linear'],['zoom'],14,.42,17,.64]}},
  {id:IDS[1],type:'line',source:SOURCE,'source-layer':'buildings',minzoom:15,filter:date,paint:{'line-color':'#66513e','line-width':.65,'line-opacity':.7}},
  {id:IDS[2],type:'line',source:SOURCE,'source-layer':'transport_lines',minzoom:11,filter:road,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#82684a','line-opacity':.6,'line-width':['interpolate',['exponential',1.4],['zoom'],11,1.2,14,3,18,10]}},
  {id:IDS[3],type:'line',source:SOURCE,'source-layer':'transport_lines',minzoom:11,filter:road,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#f5e3b9','line-opacity':['case',['==',['get','tunnel'],1],.55,.95],'line-width':width}},
  {id:IDS[4],type:'line',source:SOURCE,'source-layer':'transport_lines',minzoom:11,filter:rail,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#694d4e','line-opacity':.8,'line-width':['interpolate',['linear'],['zoom'],11,.8,15,1.6,18,3],'line-dasharray':[3,2]}}
 ];
}
export class HistoricalDetailLayer{
 constructor(atlas,{enabled=true,modern=false}={}){
  this.atlas=atlas;this.map=atlas.map;this.enabled=enabled;this.modern=modern;this.year=atlas.year||1492;this.lang=atlas.lang;this.status='zoom';this.failed=false;this.seen=false;this.markers=[];this.features=[];
  const on=(type,fn)=>{this.map.on(type,fn);this.listeners.push([type,fn]);};this.listeners=[];
  this.button=document.createElement('button');this.button.className='historical-browse';this.button.hidden=true;this.button.onclick=()=>this.openIndex();this.map.getContainer().append(this.button);
  on('moveend',()=>this.update());on('idle',()=>this.settle());
  on('dataloading',e=>{if(e.sourceId===SOURCE&&this.visible){this.setStatus('loading');this.clearLabels();}});
  on('sourcedata',e=>{if(e.sourceId===SOURCE&&e.tile?.state==='loaded'){this.seen=true;this.settle();}});
  on('error',e=>{if(e.sourceId===SOURCE){this.failed=true;this.setStatus('error');this.clearLabels();}});
  on('click',e=>{const f=this.hit(e.point);if(f){e.originalEvent?.stopPropagation();this.openFeature(f,e.lngLat);}});
  this.update();
 }
 get visible(){return this.enabled&&!this.modern&&this.map.getZoom()>=11&&!this.atlas.destroyed;}
 setStatus(status){if(this.status===status)return;this.status=status;this.map.getContainer().dispatchEvent(new CustomEvent('historical-detail-status',{bubbles:true,detail:{status}}));this.renderButton();}
 renderButton(){this.button.hidden=!this.visible;this.button.textContent=tr(this.lang,this.status==='error'?'街区图层 · 重试':this.status==='loading'?'正在翻阅街区…':this.status==='empty'?'此处街区资料待补':'街区档案',this.status==='error'?'Street layer · retry':this.status==='loading'?'Loading streets…':this.status==='empty'?'No dated streets here':'Street records');}
 ensure(){
  if(this.map.getSource(SOURCE))return;
  this.map.addSource(SOURCE,{type:'vector',tiles:['https://vtiles.openhistoricalmap.org/maps/ohm/{z}/{x}/{y}.pbf'],minzoom:11,maxzoom:18,attribution:'<a href="https://www.openhistoricalmap.org/" target="_blank" rel="noopener">OpenHistoricalMap contributors</a> · <a href="https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Sources" target="_blank" rel="noopener">Sources & attribution</a>'});
  for(const layer of historyLayers(this.year))this.map.addLayer(layer,'boundary');this.atlas.regional?.halc?.landscape?.reconcileOrder();
 }
 update(){
  if(this.atlas.destroyed)return;
  if(this.visible&&!this.failed){this.ensure();this.setStatus('loading');}else if(this.visible&&this.failed)this.setStatus('error');
  for(const id of IDS)if(this.map.getLayer(id))this.map.setLayoutProperty(id,'visibility',this.visible?'visible':'none');
  if(!this.visible){this.clearLabels();this.closePopup();this.features=[];this.setStatus(!this.enabled?'off':this.modern?'modern':'zoom');}
  this.renderButton();this.settle();
 }
 setYear(year,lang){
  const changed=year!==this.year||lang!==this.lang;this.year=year;this.lang=lang;
  if(changed){this.closePopup();this.clearLabels();this.lastLabels='';for(const layer of historyLayers(year))if(this.map.getLayer(layer.id))this.map.setFilter(layer.id,layer.filter);this.setStatus('loading');}
  this.update();
 }
 setModern(v){this.modern=v;this.update();}
 toggle(v){this.enabled=v;this.update();}
 retry(){
  this.closePopup();this.clearLabels();for(const id of IDS)if(this.map.getLayer(id))this.map.removeLayer(id);if(this.map.getSource(SOURCE))this.map.removeSource(SOURCE);this.failed=false;this.seen=false;this.update();
 }
 settle(){
  if(!this.visible||this.failed||!this.seen||!this.map.getSource(SOURCE)||!this.map.isSourceLoaded(SOURCE)||this.map.isMoving())return;
  const layers=HIT.filter(id=>this.map.getLayer(id)),seen=new Set();
  this.features=this.map.queryRenderedFeatures({layers}).filter(f=>{
   if(!datedFeatureVisible(f.properties,this.year))return false;
   const k=f.properties.osm_id?`${f.sourceLayer}:${f.properties.osm_id}:${f.properties.start_decdate}`:JSON.stringify(f.geometry.coordinates);
   if(seen.has(k))return false;seen.add(k);return true;
  });
  this.setStatus(this.features.length?'ready':'empty');this.refreshLabels();
 }
 hit(point){if(!this.visible||this.failed||this.status==='loading')return null;const layers=HIT.filter(id=>this.map.getLayer(id));if(!layers.length)return null;const list=this.map.queryRenderedFeatures([[point.x-4,point.y-4],[point.x+4,point.y+4]],{layers}).filter(f=>datedFeatureVisible(f.properties,this.year));return list.find(f=>f.sourceLayer==='buildings')||list[0]||null;}
 clearLabels(){this.markers.forEach(m=>m.remove());this.markers=[];this.lastLabels='';}
 refreshLabels(){
  if(!this.atlas.showLabels||!this.visible||this.failed){this.clearLabels();return;}
  const c=this.map.getCenter(),key=[this.year,this.lang,c.lng,c.lat,this.map.getZoom(),this.map.getBearing(),this.features.length].join('|');if(key===this.lastLabels)return;this.clearLabels();this.lastLabels=key;
  const root=this.map.getContainer().getBoundingClientRect(),overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  const boxes=[...document.querySelectorAll('.map-heading,.map-tools,.compare-heading,.map-legend,.map-notice,.layer-panel,.place-marker,.event-marker,.polity-label,.historical-browse')].filter(el=>el.getClientRects().length&&getComputedStyle(el).opacity!=='0').map(el=>el.getBoundingClientRect());
  const names=new Set();
  for(const f of this.features){
   if(this.markers.length>=8)break;if(f.sourceLayer!=='transport_lines')continue;const name=featureName(f.properties,this.lang);if(!name||names.has(name))continue;
   const lines=f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.type==='MultiLineString'?f.geometry.coordinates:[];
   const line=lines.slice().sort((a,b)=>b.length-a.length)[0];if(!line?.length)continue;
   const points=line.map(p=>this.map.project(p)),length=points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-points[i].x,p.y-points[i].y),0);
   const width=Math.min(190,Math.max(70,name.length*7.2));if(length<width+40)continue;
   const coord=line[Math.floor(line.length/2)],p=this.map.project(coord),box={left:root.left+p.x-width/2,right:root.left+p.x+width/2,top:root.top+p.y-15,bottom:root.top+p.y+15};
   if(box.left<root.left+16||box.right>root.right-16||box.top<root.top+100||box.bottom>root.bottom-80||boxes.some(b=>overlap(box,b)))continue;
   const el=document.createElement('button');el.className='historical-label';el.textContent=name;el.setAttribute('aria-label',name);el.title=featureKind(f,this.lang)+' · '+recordYear(f.properties.start_decdate,this.lang);el.onclick=e=>{e.stopPropagation();this.openFeature(f,{lng:coord[0],lat:coord[1]});};
   this.markers.push(new maplibregl.Marker({element:el,opacityWhenCovered:'0'}).setLngLat(coord).addTo(this.map));boxes.push(box);names.add(name);
  }
 }
 closePopup(){this.popup?.remove();this.popup=null;}
 popupAt(node,point){
  this.closePopup();this.popup=new maplibregl.Popup({className:'historical-popup',maxWidth:'320px',closeButton:true,closeOnClick:true,focusAfterOpen:false,offset:12}).setLngLat(point).setDOMContent(node).addTo(this.map);
  const el=this.popup.getElement();el.setAttribute('role','dialog');el.setAttribute('aria-label',tr(this.lang,'街区档案','Street records'));const close=el.querySelector('.maplibregl-popup-close-button');close.setAttribute('aria-label',tr(this.lang,'关闭街区档案','Close street records'));close.focus({preventScroll:true});el.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();this.closePopup();this.map.getCanvas().focus();}});
 }
 sourceLinks(node){
  const links=document.createElement('div');links.className='historical-source-links';
  for(const [label,url] of [[tr(this.lang,'查看来源地图','View source map'),historicalMapURL(this.year,this.map.getCenter(),this.map.getZoom())],[tr(this.lang,'资料与署名','Sources & credits'),'https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Sources']]){const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);}node.append(links);
 }
 openFeature(f,point){
  if(!datedFeatureVisible(f.properties,this.year))return;const p=f.properties,node=document.createElement('section');
  const eyebrow=document.createElement('small');eyebrow.className='historical-eyebrow';eyebrow.textContent=featureKind(f,this.lang);const title=document.createElement('h3');title.textContent=featureName(p,this.lang)||featureKind(f,this.lang);node.append(eyebrow,title);
  if(this.lang==='bi'&&p.name_en&&title.textContent!==p.name_en){const en=document.createElement('p');en.textContent=p.name_en;node.append(en);}
  const dl=document.createElement('dl');for(const [term,value]of [[tr(this.lang,'记录开始','Record begins'),recordYear(p.start_decdate,this.lang)],[tr(this.lang,'记录结束','Record ends'),recordYear(p.end_decdate,this.lang)]]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=term;dd.textContent=value;dl.append(dt,dd);}node.append(dl);
  const note=document.createElement('p');note.className='historical-credit';note.textContent='OpenHistoricalMap';node.append(note);this.sourceLinks(node);this.popupAt(node,point);
 }
 openIndex(){
  if(this.failed){this.retry();return;}
  const node=document.createElement('section'),h=document.createElement('h3');h.textContent=tr(this.lang,'此刻的街区','Streets in this year');node.append(h);
  const info=document.createElement('p');info.textContent=tr(this.lang,'点选地图上的街巷或建筑，翻阅年代记录。','Select a street or building on the map to read its dates.');node.append(info);
  const list=document.createElement('div');list.className='historical-record-list';const names=new Set();
  for(const f of this.features){const name=featureName(f.properties,this.lang);if(!name||names.has(name))continue;names.add(name);const b=document.createElement('button');b.textContent=name;b.onclick=()=>this.openFeature(f,this.map.getCenter());list.append(b);if(names.size===12)break;}
  if(!names.size){const p=document.createElement('p');p.textContent=tr(this.lang,this.features.length?'这一视野中的记录尚无名称，可直接点击地图阅读。':'这一视野和年份的街区资料仍待补充。',this.features.length?'These records have no names yet. Select their shapes on the map.':'Dated street records are not yet available for this view and year.');list.append(p);}node.append(list);this.sourceLinks(node);this.popupAt(node,this.map.getCenter());
 }
 destroy(){this.closePopup();this.clearLabels();this.button.remove();for(const[type,fn]of this.listeners)this.map.off(type,fn);}
}
