import {boundaryMode} from './view-state.js?v=3.6.0-8e0c6ac31e93';
import {simplifiedChinese} from './simplified-chinese.js?v=3.6.0-8e0c6ac31e93';
import {historicalYearRange} from './historical-dates.js?v=3.6.0-8e0c6ac31e93';
import {featureName,recordYear,historicalMapURL} from './historical-detail.js?v=3.6.0-8e0c6ac31e93';

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

// The regional atlas is a July 1 snapshot. This reduces same-year phase
// overlap; source intervals can still overlap and remain distinct records.
export function regionalDate(year){
 const [a]=historicalYearRange(year),leap=a%4===0&&(a%100!==0||a%400===0);
 return a+(leap?182.5/366:181.5/365);
}
export function regionalVisible(p,year,maxLevel=4){
 const t=regionalDate(year),s=p.start_decdate,e=p.end_decdate;
 return Number.isFinite(s)&&Math.abs(s)<1e8&&s<=t&&
  (Number.isFinite(e)?Math.abs(e)<1e8&&e>=s&&e>=t:!Object.hasOwn(p,'end_decdate')&&!Object.hasOwn(p,'end_date'))&&
  p.type==='administrative'&&Number.isFinite(p.admin_level)&&p.admin_level>=2&&p.admin_level<=maxLevel;
}
export function regionalFilter(year,maxLevel=4){
 const t=regionalDate(year);
 return ['all',['==',['get','type'],'administrative'],
  ['>=',['number',['get','admin_level'],99],2],['<=',['number',['get','admin_level'],99],maxLevel],
  ['==',['typeof',['get','start_decdate']],'number'],['>',['number',['get','start_decdate'],1e8],-1e8],['<=',['number',['get','start_decdate'],1e8],t],
  ['any',['all',['!', ['has','end_decdate']],['!', ['has','end_date']]],
   ['all',['==',['typeof',['get','end_decdate']],'number'],['<',['number',['get','end_decdate'],-1e8],1e8],
    ['>=',['number',['get','end_decdate'],-1e8],t],['>=',['number',['get','end_decdate'],-1e8],['number',['get','start_decdate'],1e8]]]]];
}
export function regionalLayers(year,maxLevel=4){
 const base={source:SOURCE,'source-layer':'boundaries',minzoom:REGIONAL_MIN_ZOOM,filter:regionalFilter(year,maxLevel)};
 return [
  {...base,id:IDS[0],type:'fill',paint:{'fill-color':['to-color',['at',['%', ['abs',['number',['get','osm_id'],0]],6],['literal',['#a89563','#6f9693','#93936a','#a38e83','#879baa','#ab9a75']]]],'fill-opacity':['case',['==',['get','admin_level'],2],.035,.22]}},
  {...base,id:IDS[1],type:'line',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#635d4a','line-width':['interpolate',['linear'],['zoom'],6,['case',['==',['get','admin_level'],2],.85,.6],10,['case',['==',['get','admin_level'],2],1.35,['>=',['get','admin_level'],5],.65,1],15,['case',['==',['get','admin_level'],2],1.7,['>=',['get','admin_level'],5],.85,1.3]],'line-opacity':['case',['==',['get','disputed'],'yes'],.45,.8],'line-blur':.15}},
  {...base,id:IDS[2],type:'line',filter:['all',regionalFilter(year,maxLevel),['==',['get','osm_id'],0]],layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#e6bc6a','line-width':2.5,'line-opacity':.9}}
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
export function interiorAnchor(geometry,box=null){
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
 return best?{coordinate:best,score}:null;
}
export const interiorPoint=(geometry,box=null)=>interiorAnchor(geometry,box)?.coordinate||null;
export function coverageAllowsDetail(samples,previous=false){
 const land=samples.filter(s=>s.land),covered=land.filter(s=>s.covered);
 if(land.length<5||covered.length/land.length<(previous?.65:.8))return false;
 for(const q of [0,1,2,3]){const cells=land.filter(s=>s.quadrant===q);if(cells.length>=3&&cells.filter(s=>s.covered).length/cells.length<.5)return false;}
 const center=land.filter(s=>s.central);return !center.length||center.filter(s=>s.covered).length/center.length>=.5;
}
export function groupRegionalFeatures(features,year,maxLevel=4){
 const unique=new Map();for(const f of features){if(!regionalVisible(f.properties,year,maxLevel))continue;const id=f.properties.osm_id;if(!Number.isSafeInteger(id)||id===0)continue;if(!unique.has(id))unique.set(id,{...f,fragments:[]});if(f.geometry)unique.get(id).fragments.push(f.geometry);}
 return [...unique.values()].sort((a,b)=>a.properties.admin_level-b.properties.admin_level||(b.properties.area||0)-(a.properties.area||0)||a.properties.osm_id-b.properties.osm_id);
}
export function regionalAnchor(feature,box){
 let best=null;for(const geometry of feature.fragments||[feature.geometry]){if(!geometry)continue;const candidate=interiorAnchor(geometry,box);if(candidate&&(!best||candidate.score>best.score))best=candidate;}return best;
}
export const regionalPeriod=(p,lang='bi')=>[p.start_date||recordYear(p.start_decdate,lang),p.end_date||recordYear(p.end_decdate,lang)].join(' — ');
export class RegionalBoundaries{
 constructor(atlas,{enabled=true,modern=false,mode='auto'}={}){
  this.atlas=atlas;this.map=atlas.map;this.mode=enabled?boundaryMode(mode):'overview';this.modern=modern;this.year=atlas.year;this.lang=atlas.lang;this.status='zoom';this.active=false;this.failed=false;this.features=[];this.markers=[];this.listeners=[];this.settling=false;this.samples=[];this.maxLevel=this.map.getZoom()>=8?6:4;
  const on=(event,fn)=>{this.map.on(event,fn);this.listeners.push([event,fn]);};
  this.controls=document.createElement('div');this.controls.className='regional-controls';this.controls.hidden=true;
  this.badge=document.createElement('button');this.badge.className='regional-badge';this.badge.onclick=()=>this.openIndex();
  this.switcher=document.createElement('button');this.switcher.className='regional-switch';this.switcher.onclick=()=>this.setMode(this.active?'overview':'regional');this.controls.append(this.badge,this.switcher);this.map.getContainer().append(this.controls);
  on('moveend',()=>this.update());on('idle',()=>{this.settle();if(this.mode==='cshapes')this.indexRefresh?.();});
  on('error',e=>{if(e.sourceId===SOURCE){this.failed=true;this.lastError=String(e.error?.message||e.error||'Source error');this.features=[];this.closePopup();this.setActive(false);this.setStatus('error');this.visibility();}});
  on('click',e=>{if(this.atlas.historical?.hit(e.point))return;const f=this.hit(e.point);if(f)this.openFeature(f,e.lngLat);});this.update();
 }
 get enabled(){return this.mode==='auto'||this.mode==='regional';}
 get eligible(){return this.enabled&&this.atlas.showBorders&&!this.modern&&this.map.getZoom()>=REGIONAL_MIN_ZOOM&&!this.atlas.destroyed;}
 ensure(){
  if(this.map.getSource(SOURCE))return;
  this.map.addSource(SOURCE,{type:'vector',tiles:['https://vtiles.openhistoricalmap.org/maps/ohm_admin/{z}/{x}/{y}'],minzoom:REGIONAL_MIN_ZOOM,maxzoom:14,attribution:'<a href="https://www.openhistoricalmap.org/copyright" target="_blank" rel="noopener">OpenHistoricalMap contributors</a> · <a href="https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Sources" target="_blank" rel="noopener">Sources & attribution</a>'});
  for(const layer of regionalLayers(this.year,this.maxLevel))this.map.addLayer(layer,'boundary');this.visibilityKey=null;
 }
 setStatus(status){
  this.status=status;const country=this.atlas.boundaries;this.controls.hidden=!this.atlas.showBorders||this.modern&&!country?.isCountry||this.map.getZoom()<REGIONAL_MIN_ZOOM&&this.mode==='auto';this.badge.hidden=this.controls.hidden;
  const labels={ready:[`地区详图 · ${this.features.length} 条区划`,`Regional detail · ${this.features.length} areas`],partial:[`详图局部覆盖 · ${this.features.length} 条`,`Local detail available · ${this.features.length} areas`],error:['全球疆域 · 详图暂不可用','Global overview · detail unavailable'],empty:['全球疆域 · 此处暂无详图','Global overview · no detail here'],loading:['全球疆域 · 正在读取详图','Global overview · loading detail'],overview:['全球疆域 · 切换来源','Global overview · choose source'],zoom:['全球疆域 · 放大查看详图','Global overview · zoom for detail']};
  this.badge.textContent=country?.mode==='cshapes'?country.title(this.lang):tr(this.lang,...(labels[status]||labels.overview));this.badge.title=tr(this.lang,'选择边界来源与查看区划档案','Choose boundary source and browse area records');
  this.switcher.hidden=this.controls.hidden||this.map.getZoom()<REGIONAL_MIN_ZOOM||this.failed||(!this.active&&this.mode==='regional');this.switcher.textContent=tr(this.lang,this.active?'对照概览':'查看详图',this.active?'Compare overview':'View detail');
  this.indexRefresh?.();this.map.getContainer().dispatchEvent(new CustomEvent('regional-status',{bubbles:true}));
 }
 setActive(v){
  if(v===this.active){this.visibility();return;}this.active=v;
  if(this.atlas.boundaries){this.atlas.boundaries.applyVisibility(v);this.visibility();this.atlas.refreshLabels();return;}
  // Switch archives atomically: cross-fading unrelated outlines creates false double borders.
  for(const [id,property]of [['territories','fill-opacity'],['boundary','line-opacity'],['selection','line-opacity'],['selection-fill','fill-opacity']])this.map.setPaintProperty(id,property+'-transition',{duration:0,delay:0});
  this.map.setPaintProperty('territories','fill-opacity',v?0:['interpolate',['linear'],['zoom'],0,.53,4,.4,9,.2]);
  this.map.setPaintProperty('boundary','line-opacity',v?0:['interpolate',['linear'],['zoom'],1,.36,4,.5,9,.4]);
  this.map.setPaintProperty('selection','line-opacity',v?0:1);this.map.setPaintProperty('selection-fill','fill-opacity',v?0:.08);
  this.visibility();this.atlas.refreshLabels();
 }
 visibility(){
  const visible=this.eligible&&!this.failed,key=visible+':'+this.active;if(this.visibilityKey===key)return;this.visibilityKey=key;
  if(this.map.getLayer(IDS[0]))this.map.setPaintProperty(IDS[0],'fill-opacity-transition',{duration:0,delay:0});
  for(const id of IDS)if(this.map.getLayer(id))this.map.setLayoutProperty(id,'visibility',visible&&(id===IDS[0]||this.active)?'visible':'none');
  if(this.map.getLayer(IDS[0]))this.map.setPaintProperty(IDS[0],'fill-opacity',this.active?['case',['==',['get','admin_level'],2],.05,.2]:0);
 }
 update(){
  if(this.atlas.destroyed)return;
  const maxLevel=this.map.getZoom()>=8?6:4;if(maxLevel!==this.maxLevel){this.maxLevel=maxLevel;this.closePopup();for(const layer of regionalLayers(this.year,maxLevel))if(this.map.getLayer(layer.id))this.map.setFilter(layer.id,layer.filter);}
  if(!this.eligible){this.setActive(false);this.clearLabels();if(this.mode!=='cshapes'||!this.atlas.showBorders)this.closePopup();this.features=[];this.samples=[];this.setStatus(!this.enabled?'overview':this.modern?'modern':'zoom');}
  else if(!this.failed){this.ensure();this.visibility();this.setStatus(this.active?'ready':'loading');}else this.setStatus('error');
  this.visibility();
 }
 coverage(){
  const container=this.map.getContainer(),width=container.clientWidth,height=container.clientHeight,samples=[];
  for(let row=0;row<7;row++)for(let col=0;col<9;col++){
   const x=width*(.06+.88*(col+.5)/9),y=height*(.08+.84*(row+.5)/7);
   const found=this.map.queryRenderedFeatures([x,y],{layers:['land',IDS[0]]});
   samples.push({land:found.some(f=>f.layer?.id==='land'),covered:found.some(f=>f.layer?.id===IDS[0]&&regionalVisible(f.properties,this.year,this.maxLevel)),central:col>=3&&col<=5&&row>=2&&row<=4,quadrant:Number(col>=4)*2+Number(row>=3)});
  }
  return samples;
 }
 settle(){
  if(this.settling||!this.eligible||this.failed||this.map.isMoving()||!this.map.getSource(SOURCE)||!this.map.isSourceLoaded(SOURCE))return;
  this.settling=true;
  try{
   this.features=groupRegionalFeatures(this.map.queryRenderedFeatures({layers:[IDS[0]]}),this.year,this.maxLevel);this.samples=this.features.length?this.coverage():[];
   const enough=coverageAllowsDetail(this.samples,this.active),show=this.features.length>0&&(this.mode==='regional'||enough);
   this.setActive(show);this.setStatus(!this.features.length?'empty':show?'ready':'partial');this.refreshLabels();
  }finally{this.settling=false;}
 }
 setYear(year,lang){
  this.year=year;this.lang=lang;this.features=[];this.samples=[];this.closePopup();this.clearLabels();this.setActive(false);
  for(const layer of regionalLayers(year,this.maxLevel))if(this.map.getLayer(layer.id))this.map.setFilter(layer.id,layer.filter);this.update();
 }
 setMode(mode){this.mode=boundaryMode(mode);this.closePopup();this.update();this.settle();this.atlas.onBoundaryMode?.(this.mode);this.atlas.boundaries?.setMode(this.mode);}
 toggle(v){this.setMode(v?'auto':'overview');}
 setModern(v){this.modern=v;this.update();}
 hit(point){
  if(!this.active||!this.eligible||this.failed)return null;
  return this.map.queryRenderedFeatures(point,{layers:[IDS[0]]}).filter(f=>regionalVisible(f.properties,this.year,this.maxLevel)).sort((a,b)=>(a.properties.area||Infinity)-(b.properties.area||Infinity))[0]||null;
 }
 clearLabels(){for(const m of this.markers)m.remove();this.markers=[];}
 refreshLabels(){
  this.clearLabels();if(!this.active||!this.atlas.showLabels)return;this.atlas.labelBoxes=[];
  const root=this.map.getContainer().getBoundingClientRect(),overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  const bounds=this.map.getBounds();let clipBox=[bounds.getWest(),bounds.getSouth(),bounds.getEast(),bounds.getNorth()];
  if(Math.abs(this.map.getBearing())<1&&root.width>220&&root.height>250){const a=this.map.unproject([80,100]),b=this.map.unproject([root.width-80,root.height-90]);clipBox=[a.lng,b.lat,b.lng,a.lat];}
  const boxes=[...document.querySelectorAll('.map-heading,.map-tools,.compare-heading,.map-legend,.map-notice,.layer-panel,.event-marker,.regional-controls,.lake-label')].filter(el=>el.getClientRects().length).map(el=>el.getBoundingClientRect()),names=new Set();
  const ranked=this.features.map(f=>({f,anchor:regionalAnchor(f,clipBox[0]<clipBox[2]?clipBox:null)})).filter(x=>x.anchor).sort((a,b)=>a.f.properties.admin_level-b.f.properties.admin_level||b.anchor.score-a.anchor.score);
  for(const {f,anchor}of ranked){
   if(this.markers.length>=14)break;const name=regionalName(f.properties,this.lang,this.atlas.active),coord=anchor.coordinate,national=f.properties.admin_level===2;if(!name||names.has(name))continue;
   const p=this.map.project(coord),primary=[...name].reduce((n,c)=>n+(/[\u3400-\u9fff]/.test(c)?national?16:13:national?8:7),0),width=Math.min(national?220:190,Math.max(90,primary+16)),height=this.lang==='bi'&&f.properties.name_en&&name!==f.properties.name_en?58:40,box={left:root.left+p.x-width/2,right:root.left+p.x+width/2,top:root.top+p.y-height/2,bottom:root.top+p.y+height/2};
   if(box.left<root.left+12||box.right>root.right-12||box.top<root.top+85||box.bottom>root.bottom-85||boxes.some(b=>overlap(box,b)))continue;
   const el=document.createElement('button');el.className='regional-label'+(national?' regional-national':'');el.textContent=name;el.style.maxWidth=width+'px';if(this.lang==='bi'&&f.properties.name_en&&name!==f.properties.name_en){const en=document.createElement('span');en.textContent=f.properties.name_en;el.append(en);}el.setAttribute('aria-label',name);el.onclick=e=>{e.stopPropagation();this.openFeature(f,{lng:coord[0],lat:coord[1]});};
   this.markers.push(new maplibregl.Marker({element:el,opacityWhenCovered:'0'}).setLngLat(coord).addTo(this.map));boxes.push(box);this.atlas.labelBoxes.push(box);names.add(name);
  }
  this.atlas.places?.refresh();
 }
 closePopup(){this.indexRefresh=null;this.popup?.remove();this.popup=null;if(this.map.getLayer(IDS[2]))this.map.setFilter(IDS[2],['all',regionalFilter(this.year,this.maxLevel),['==',['get','osm_id'],0]]);}
 popupAt(node,point,index=false){
  this.popup=new maplibregl.Popup({className:'historical-popup regional-popup'+(index?' regional-index':''),maxWidth:'350px',closeButton:true,closeOnClick:true,focusAfterOpen:false,offset:12}).setLngLat(point).setDOMContent(node).addTo(this.map);
  const el=this.popup.getElement();el.style.setProperty('--regional-panel-height',Math.max(150,this.map.getContainer().clientHeight-32)+'px');el.setAttribute('role','dialog');el.setAttribute('aria-label',tr(this.lang,'历史区划档案','Historical boundary record'));const close=el.querySelector('.maplibregl-popup-close-button');close.setAttribute('aria-label',tr(this.lang,'关闭区划档案','Close boundary record'));close.focus({preventScroll:true});el.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();this.closePopup();this.map.getCanvas().focus();}});
  const popup=this.popup;this.popup.on('close',()=>{if(this.popup===popup){this.indexRefresh=null;this.popup=null;}if(this.map.getLayer(IDS[2]))this.map.setFilter(IDS[2],['all',regionalFilter(this.year,this.maxLevel),['==',['get','osm_id'],0]]);});
 }
 openFeature(f,point){
  if(f.properties.archive==='cshapes'){this.atlas.boundaries?.openRecord(f.properties.id,point);return;}
  if(!regionalVisible(f.properties,this.year,this.maxLevel))return;if(!this.active)this.setMode('regional');this.closePopup();const p=f.properties,node=document.createElement('section');
  const small=document.createElement('small');small.className='historical-eyebrow';small.textContent=tr(this.lang,'历史区划 · 地区详图','Historical area · regional detail');const h=document.createElement('h3');h.textContent=regionalName(p,this.lang,this.atlas.active);node.append(small,h);if(this.lang==='bi'&&p.name_en&&h.textContent!==p.name_en){const en=document.createElement('p');en.textContent=p.name_en;node.append(en);}
  const dl=document.createElement('dl');for(const [term,value]of [[tr(this.lang,'记录开始','Record begins'),p.start_date||recordYear(p.start_decdate,this.lang)],[tr(this.lang,'记录结束','Record ends'),p.end_date||recordYear(p.end_decdate,this.lang)]]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=term;dd.textContent=value;dl.append(dt,dd);}node.append(dl);
  const links=document.createElement('div');links.className='historical-source-links';for(const [label,url]of [[tr(this.lang,'原始区划记录','Original boundary record'),regionalElementURL(p)],[tr(this.lang,'同年来源地图','Source map in this year'),historicalMapURL(this.year,this.map.getCenter(),this.map.getZoom())]]){if(!url)continue;const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);}node.append(links);
  const related=this.atlas.active?.find(r=>r.name===(p.name_en||p.name));if(related){const b=document.createElement('button');b.className='regional-dossier';b.textContent=tr(this.lang,'相关疆域档案','Related territory dossier');b.onclick=()=>{this.closePopup();this.atlas.onPolity?.(related);};node.append(b);}
  const credit=document.createElement('p');credit.className='historical-credit';credit.textContent='OpenHistoricalMap contributors';node.append(credit);this.popupAt(node,point);this.map.setFilter(IDS[2],['all',regionalFilter(this.year,this.maxLevel),['==',['get','osm_id'],p.osm_id]]);
 }
 openIndex(){
  this.closePopup();const node=document.createElement('section'),h=document.createElement('h3');h.textContent=tr(this.lang,'边界与历史区划','Borders & historical areas');node.append(h);
  const controls=document.createElement('div');controls.className='regional-modes';controls.setAttribute('role','group');controls.setAttribute('aria-label',tr(this.lang,'边界来源','Boundary source'));
  for(const [mode,zh,en]of [['auto','自动','Auto'],['overview','全球疆域','Global overview'],['regional','地区详图','Regional detail'],['cshapes','近现代国家','Modern-era states']]){const b=document.createElement('button');b.textContent=tr(this.lang,zh,en);b.setAttribute('aria-pressed',String(this.mode===mode));b.onclick=()=>{this.setMode(mode);this.openIndex();};controls.append(b);}node.append(controls);
  const note=document.createElement('p');const updateNote=()=>{if(this.mode==='cshapes'){note.textContent=tr(this.lang,'CShapes 2.1 · 国家与属地。1886—2023年，按所选年年中读取；口径与许可见来源说明。','CShapes 2.1 · states and dependencies, 1886–2023. Records use the selected midyear; coding and license are documented in Sources.');return;}note.textContent=tr(this.lang,this.status==='partial'?'这里收录了部分详细区划。自动模式保留全球疆域，可切换详图逐一阅读。':this.mode==='regional'?'显示所选年年中的原始区划。留白处暂无该来源的记录。':'自动模式在详细资料覆盖较充分时切换来源。两套疆域可独立对照。',this.status==='partial'?'Local detail is available here. Auto keeps the global overview; switch to detail to explore these records.':this.mode==='regional'?'Dated source areas at midyear. Gaps have no matching record in this source.':'Auto switches when detailed records cover enough of the visible land. The two archives remain independently selectable.');};updateNote();node.append(note);
  if(this.failed&&this.enabled||this.mode==='cshapes'&&this.atlas.boundaries?.reason==='error'){const retry=document.createElement('button');retry.className='regional-retry';retry.textContent=this.mode==='cshapes'?tr(this.lang,'重新读取国家边界','Retry country boundaries'):tr(this.lang,'重新读取地区详图','Retry regional detail');retry.onclick=()=>this.retry();node.append(retry);}
  {const search=document.createElement('input');search.type='search';search.className='regional-search';search.placeholder=this.mode==='cshapes'?tr(this.lang,'查找当年国家与属地…','Find states & territories this year…'):tr(this.lang,'查找区划…','Find an area…');search.setAttribute('aria-label',this.mode==='cshapes'?tr(this.lang,'查找当年国家与属地','Find states and territories this year'):tr(this.lang,'查找当前区划','Find a visible area'));const count=document.createElement('p');count.className='historical-credit';const list=document.createElement('div');list.className='historical-record-list';const more=document.createElement('button');more.className='regional-more';let limit=24,lastListKey='';const indexFeatures=()=>this.mode==='cshapes'?this.atlas.boundaries?.indexFeatures()||[]:this.features;
   const render=()=>{updateNote();const available=indexFeatures();const key=[this.lang,search.value,limit,...available.map(f=>(f.properties.record_id||f.properties.osm_id)+':'+regionalPeriod(f.properties,this.lang))].join('|');if(key===lastListKey)return;lastListKey=key;search.hidden=!available.length;count.hidden=!available.length;list.hidden=!available.length;const scroll=list.scrollTop;const q=search.value.trim().toLocaleLowerCase(),features=available.filter(f=>[regionalName(f.properties,this.lang,this.atlas.active),f.properties.name,f.properties.name_en,f.properties.name_zh,f.properties.source_name,String(f.properties.record_id||f.properties.osm_id)].some(v=>v?.toLocaleLowerCase().includes(q)));list.replaceChildren();count.textContent=tr(this.lang,`${features.length} 条来源记录`,` ${features.length} source records`);for(const f of features.slice(0,limit)){const b=document.createElement('button');b.textContent=regionalName(f.properties,this.lang,this.atlas.active);const meta=document.createElement('small');meta.textContent=regionalPeriod(f.properties,this.lang)+' · '+(f.properties.record_id||Math.abs(f.properties.osm_id));b.append(meta);b.onclick=()=>this.openFeature(f,this.map.getCenter());list.append(b);}list.scrollTop=scroll;more.hidden=features.length<=limit;more.textContent=tr(this.lang,'继续展开','Show more');};search.oninput=()=>{limit=24;render();};more.onclick=()=>{limit+=24;render();};node.append(search,count,list,more);this.indexRefresh=render;render();}
  this.popupAt(node,this.map.getCenter(),true);
 }
 retry(){this.closePopup();if(this.mode==='cshapes'){this.atlas.boundaries?.setMode('cshapes');return;}for(const id of IDS.toReversed())if(this.map.getLayer(id))this.map.removeLayer(id);if(this.map.getSource(SOURCE))this.map.removeSource(SOURCE);this.failed=false;this.lastError=null;this.update();}
 destroy(){this.closePopup();this.clearLabels();this.controls.remove();for(const [event,fn]of this.listeners)this.map.off(event,fn);}
}
