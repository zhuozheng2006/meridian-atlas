import {boundaryNote} from './boundary-notes.js?v=3.48.0-58fa2842faf4';
import {readJSON,forgetJSON} from './map-engine.js?v=3.48.0-58fa2842faf4';
import {HalcBoundaries} from './halc-boundaries.js?v=3.48.0-58fa2842faf4';
import {boundaryMode} from './view-state.js?v=3.48.0-58fa2842faf4';
import {simplifiedChinese} from './simplified-chinese.js?v=3.48.0-58fa2842faf4';
import {historicalYearRange} from './historical-dates.js?v=3.48.0-58fa2842faf4';
import {featureName,recordYear,historicalMapURL} from './historical-detail.js?v=3.48.0-58fa2842faf4';

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
export const OHM_ROOT='data/ohm-1500/',OHM_SOURCE='ohm-frozen',OHM_LAYERS=['ohm-frozen-wash','ohm-frozen-edges','ohm-frozen-partial','ohm-frozen-selected'],OHM_SELECTED='ohm-frozen-selected';
// Frozen windows shipped with the atlas. bounds are west,south,east,north; root is repo-relative.
export const OHM_WINDOWS=[
 {id:'central-europe',zh:'中欧',en:'Central Europe',root:'data/ohm-1500/',bounds:[4.5,44.0,14.5,50.5],years:[1000,1200,1300,1400,1492,1500,1600,1700,1800,1900]},
 {id:'east-asia',zh:'东亚',en:'East Asia',root:'data/ohm-eastasia/',bounds:[95.0,18.0,150.0,55.0],years:[1000,1100,1200,1300,1400,1500,1600,1700,1800,1850,1900,1910,1930,1950]}
];
export const OHM_YEARS=[...new Set(OHM_WINDOWS.flatMap(window_=>window_.years))].sort((a,b)=>a-b);
export const OHM_BOUNDS=OHM_WINDOWS[0].bounds;
export const ohmCoversYear=year=>OHM_WINDOWS.some(window_=>window_.years.includes(Number(year)));
export function ohmWindowInView(window_,bounds){
 if(!bounds)return false;
 const west=bounds.getWest(),east=bounds.getEast(),south=bounds.getSouth(),north=bounds.getNorth();
 if(![west,east,south,north].every(Number.isFinite)||south>window_.bounds[3]||north<window_.bounds[1])return false;
 const end=east<west?east+360:east;if(end-west>=360)return true;
 const shift=Math.round(((west+end)/2-(window_.bounds[0]+window_.bounds[2])/2)/360)*360;
 return west<=window_.bounds[2]+shift&&end>=window_.bounds[0]+shift;
}
export const ohmInView=bounds=>OHM_WINDOWS.some(window_=>ohmWindowInView(window_,bounds));
// Which window answers for this view: the one holding the view centre, else the largest overlap.
export function ohmWindowFor(bounds){
 if(!bounds)return null;
 const west=bounds.getWest(),east=bounds.getEast(),south=bounds.getSouth(),north=bounds.getNorth();
 if(![west,east,south,north].every(Number.isFinite))return null;
 const centerLon=(west+east)/2,centerLat=(south+north)/2;
 const inside=OHM_WINDOWS.find(window_=>centerLon>=window_.bounds[0]&&centerLon<=window_.bounds[2]&&centerLat>=window_.bounds[1]&&centerLat<=window_.bounds[3]);
 if(inside)return inside;
 const candidates=OHM_WINDOWS.filter(window_=>ohmWindowInView(window_,bounds));
 if(!candidates.length)return null;
 const overlap=window_=>Math.max(0,Math.min(east,window_.bounds[2])-Math.max(west,window_.bounds[0]))*Math.max(0,Math.min(north,window_.bounds[3])-Math.max(south,window_.bounds[1]));
 return candidates.reduce((best,window_)=>overlap(window_)>overlap(best)?window_:best);
}
// The frozen extract keeps the source stroke palette but a rust outline, so a record drawn from
// it never reads as the tile archive. It is added under the same boundary anchor as the tiles.
export function ohmLayers(){
 const base={source:OHM_SOURCE,minzoom:REGIONAL_MIN_ZOOM};
 return [
  {...base,id:OHM_LAYERS[0],type:'fill',paint:{'fill-color':['to-color',['at',['%',['abs',['number',['get','osm_id'],0]],6],['literal',['#a89563','#6f9693','#93936a','#a38e83','#879baa','#ab9a75']]]],'fill-opacity':0}},
  {...base,id:OHM_LAYERS[1],type:'line',filter:['!=',['get','partial_geometry'],1],layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#a4552b','line-width':['interpolate',['linear'],['zoom'],6,.85,10,1.25,15,1.6],'line-opacity':.85,'line-blur':.12}},
  {...base,id:OHM_LAYERS[2],type:'line',filter:['==',['get','partial_geometry'],1],layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#a4552b','line-width':['interpolate',['linear'],['zoom'],6,1,10,1.4,15,1.7],'line-opacity':.7,'line-dasharray':[2,1.4],'line-blur':.12}},
  {...base,id:OHM_SELECTED,type:'line',filter:['==',['get','osm_id'],0],layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#e0913c','line-width':2.6,'line-opacity':.95}}
 ];
}
// Records already drawn from the frozen extract are removed from the tile filter, so one boundary
// never carries two strokes when both archives are on screen.
export function regionalFilterExcluding(year,maxLevel=4,excluded=[]){
 const filter=regionalFilter(year,maxLevel);
 return excluded.length?['all',filter,['!',['in',['get','osm_id'],['literal',excluded]]]]:filter;
}
export function ohmAreaLabel(p,lang='bi'){
 const area=Number(p?.area);if(!Number.isFinite(area)||area<=0)return null;
 const km2=Math.round(area/1e6).toLocaleString('en-US');
 return p.partial_geometry?tr(lang,km2+' 平方公里（仅已闭合部分 · 球面）',km2+' km² (closed parts only, spherical)'):tr(lang,km2+' 平方公里（球面面积）',km2+' km² (spherical area)');
}
// Records whose source members never close into rings are drawn hollow and dashed, and they stay
// out of the label layer, instead of being presented as a solid territory.
export const ohmPartial=p=>p?.partial_geometry===1;
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
export const regionalPeriod=(p,lang='bi')=>p.archive==='halc'?'1500':[p.start_date||recordYear(p.start_decdate,lang),p.end_date||recordYear(p.end_decdate,lang)].join(' — ');
export class RegionalBoundaries{
 constructor(atlas,{enabled=true,modern=false,mode='auto'}={}){
  this.atlas=atlas;this.map=atlas.map;this.mode=enabled?boundaryMode(mode):'overview';this.modern=modern;this.year=atlas.year;this.lang=atlas.lang;this.status='zoom';this.active=false;this.failed=false;this.features=[];this.markers=[];this.listeners=[];this.settling=false;this.samples=[];this.maxLevel=this.map.getZoom()>=8?6:4;this.ohmState='idle';this.ohmData=null;this.ohmIds=[];this.ohmKey=null;this.liveEpoch=0;this.frozenEpoch=0;this.renderPending=true;this.scanKey=null;this.dead=false;
  const on=(event,fn)=>{this.map.on(event,fn);this.listeners.push([event,fn]);};
  this.controls=document.createElement('div');this.controls.className='regional-controls';this.controls.hidden=true;
  this.badge=document.createElement('button');this.badge.className='regional-badge';this.badge.onclick=()=>this.openIndex();
  this.switcher=document.createElement('button');this.switcher.className='regional-switch';this.switcher.onclick=()=>{if(this.status==='partial'&&!this.detailedActive){this.closePopup();this.map.getContainer().dispatchEvent(new CustomEvent('boundary-compare',{bubbles:true}));}else this.setMode(this.detailedActive?'overview':this.mode==='halc'?'halc':'regional');};this.controls.append(this.badge,this.switcher);this.map.getContainer().append(this.controls);
  this.halc=new HalcBoundaries(this,{anchor:regionalAnchor});
  on('moveend',()=>{this.update();this.requestRender();});on('resize',()=>{this.fitPopup();this.requestRender();});
  // Each archive can finish while unrelated relief/tiles still keep global idle away.
  // sourcedata announces worker completion; query rendered geometry only on a later frame.
  on('render',()=>{if(this.renderPending){this.renderPending=false;this.settle(true);}});
  on('idle',()=>{this.settle(true);if(this.mode==='cshapes')this.indexRefresh?.();});
  // Content readiness belongs to the source-data generation, not individual tiles.
  // MapLibre may announce content before tile loading; the tile completion events
  // then omit sourceDataType. Only source creation/setData resets the content gate.
  on('sourcedataloading',e=>{
   if(e.sourceId===SOURCE){this.liveEpoch++;if(this.eligible&&this.active&&!this.failed&&!this.ohmReady)this.beginUpdate();}
   else if(e.sourceId===OHM_SOURCE)this.frozenEpoch++;
   else return;this.requestRender();
  });
  on('sourcedata',e=>{
   if(e.sourceId===SOURCE||e.sourceId===OHM_SOURCE){
    if(e.sourceDataType==='content'){if(e.sourceId===SOURCE){this.liveContentSeen=true;this.liveEpoch++;}else{this.frozenContentSeen=true;this.frozenEpoch++;}}
    if(e.isSourceLoaded)this.requestRender();
   }else if((e.sourceId==='land'||e.sourceId==='physical-grid')&&e.isSourceLoaded&&e.sourceDataType==='content'){this.landEpoch=(this.landEpoch||0)+1;this.requestRender();}
  });
  on('error',e=>{
   if(e.sourceId!==SOURCE&&e.sourceId!==OHM_SOURCE)return;
   if(e.sourceId===OHM_SOURCE){this.ohmState='failed';this.ohmRenderedKey=null;this.frozenEpoch++;this.applyFilters();}
   else{this.failed=true;this.liveEpoch++;this.lastError=String(e.error?.message||e.error||'Source error');}
   this.scanKey=null;
   if(this.eligible){
    const remaining=e.sourceId===SOURCE?this.ohmReady:!this.failed&&this.liveDrawn;
    if(!remaining){this.features=[];this.samples=[];this.closePopup();this.setActive(false);this.setStatus('error');}
    else if(this.selectedId&&!((e.sourceId===SOURCE)===this.ohmIds.includes(this.selectedId)))this.closePopup();
   }
   this.visibility();this.requestRender();
  });
  on('click',e=>{if(this.atlas.historical?.hit(e.point))return;const local=this.halc.hit(e.point);if(local){this.halc.openHit(local,e.lngLat);return;}const f=this.hit(e.point);if(f)this.openFeature(f,e.lngLat);});this.update();
 }
 get detailedActive(){return this.active||!!this.halc?.active;}
 get enabled(){return this.mode==='auto'||this.mode==='regional';}
 get eligible(){return this.enabled&&this.atlas.showBorders&&!this.modern&&this.map.getZoom()>=REGIONAL_MIN_ZOOM&&!this.atlas.destroyed&&!this.dead;}
 get ohmReady(){return this.ohmState==='ready'&&!!this.ohmData&&!!this.ohmKey&&this.ohmRenderedKey===this.ohmKey&&this.ohmKey===this.ohmWindow?.id+'|'+this.year&&!!this.map.getSource(OHM_SOURCE);}
 // Coverage verdict of the frozen snapshot for the selected year: good / partial / sparse.
 get ohmCoverage(){return this.ohmReady?this.ohmData.metadata?.coverage||null:null;}
 get ohmVerdict(){return this.ohmCoverage?.verdict||null;}
 get ohmWindow(){return ohmWindowFor(this.map.getBounds?.());}
 get ohmWindowLabel(){const window_=this.ohmWindow;return window_?tr(this.lang,window_.zh,window_.en):'';}
 get ohmEligible(){const window_=this.ohmWindow;return this.eligible&&!!window_&&window_.years.includes(Number(this.year));}
 ensure(){
  if(this.map.getSource(SOURCE))return;
  this.liveContentSeen=false;this.liveRendered=null;
  this.map.addSource(SOURCE,{type:'vector',tiles:['https://vtiles.openhistoricalmap.org/maps/ohm_admin/{z}/{x}/{y}'],minzoom:REGIONAL_MIN_ZOOM,maxzoom:14,attribution:'<a href="https://www.openhistoricalmap.org/copyright" target="_blank" rel="noopener">OpenHistoricalMap contributors</a> · <a href="https://wiki.openstreetmap.org/wiki/OpenHistoricalMap/Sources" target="_blank" rel="noopener">Sources & attribution</a>'});
  for(const layer of regionalLayers(this.year,this.maxLevel))this.map.addLayer(layer,'boundary');this.visibilityKey=null;
 }
 // The frozen extract is a static file next to the atlas; it is only fetched for the years it
 // covers and only while the view intersects its window. A failed load leaves the tile archive
 // untouched instead of pretending to have data.
 ensureOhm(){
  const window_=this.ohmWindow,year=this.year;
  if(!window_||!this.eligible||!window_.years.includes(Number(year)))return;
  const key=window_.id+'|'+year;
  if(this.ohmState==='loading'&&this.ohmRequestKey===key||this.ohmState==='ready'&&this.ohmKey===key)return;
  if(typeof location==='undefined'||!/^https?:$/.test(location.protocol))return;
  // Another window or year answers this view now: drop the previous geometry first, so one
  // window's boundaries are never drawn on top of another's.
  if(this.ohmKey&&this.ohmKey!==key){this.ohmKey=null;this.ohmRenderedKey=null;this.scanKey=null;this.ohmData=null;this.ohmIds=[];const source=this.map.getSource(OHM_SOURCE);if(source)source.setData({type:'FeatureCollection',features:[]});this.applyFilters();this.visibility();}
  this.ohmState='loading';this.ohmRequestKey=key;const request=this.ohmRequest=(this.ohmRequest||0)+1;
  const url=window_.root+'year-'+year+'.json.gz';
  readJSON(url).then(data=>{
   if(this.dead||this.atlas.destroyed||request!==this.ohmRequest)return;
   const current=this.ohmWindow;
   if(!current||current.id!==window_.id||this.year!==year){this.ohmState='idle';this.ohmRequestKey=null;this.update();return;}
   if(!data||data.type!=='FeatureCollection'||!Array.isArray(data.features)){forgetJSON(url);throw Error('Invalid frozen OHM extract');}
   this.ohmData=data;this.ohmIds=data.features.map(f=>f.properties?.osm_id).filter(id=>Number.isSafeInteger(id)&&id!==0);this.ohmKey=key;
   this.ohmState='ready';this.ohmRenderedKey=null;this.addOhmLayers();this.applyFilters();this.update();this.requestRender();
  }).catch(()=>{if(this.dead||this.atlas.destroyed||request!==this.ohmRequest)return;const current=this.year===year&&this.ohmWindow?.id===window_.id;this.ohmState=current?'failed':'idle';this.ohmRequestKey=null;this.ohmData=null;this.ohmIds=[];this.ohmKey=null;if(!current){this.update();return;}this.applyFilters();this.visibility();this.setStatus(this.status);this.refreshLabels();});
 }
 addOhmLayers(){
  if(!this.ohmData)return;this.frozenEpoch++;this.frozenContentSeen=false;this.scanKey=null;
  if(this.map.getSource(OHM_SOURCE)){this.map.getSource(OHM_SOURCE).setData(this.ohmData);this.visibilityKey=null;this.visibility();return;}
  this.map.addSource(OHM_SOURCE,{type:'geojson',data:this.ohmData,tolerance:0,maxzoom:14,attribution:'<a href="https://www.openhistoricalmap.org/copyright" target="_blank" rel="noopener">OpenHistoricalMap contributors</a> · CC0 · Dated static extract'});
  for(const layer of ohmLayers())this.map.addLayer(layer,'boundary');
  this.visibilityKey=null;this.visibility();
 }
 removeOhmLayers(){
  this.ohmRenderedKey=null;this.scanKey=null;
  for(const id of OHM_LAYERS.toReversed())if(this.map.getLayer(id))this.map.removeLayer(id);
  if(this.map.getSource(OHM_SOURCE))this.map.removeSource(OHM_SOURCE);
  this.visibilityKey=null;
 }
 applyFilters(){
  const excluded=this.ohmReady?this.ohmIds:[],filter=regionalFilterExcluding(this.year,this.maxLevel,excluded);
  if(this.map.getLayer(IDS[0]))this.map.setFilter(IDS[0],filter);
  if(this.map.getLayer(IDS[1]))this.map.setFilter(IDS[1],filter);
  this.applySelection(this.selectedId||0);
 }
 applySelection(id){
  if(this.map.getLayer(IDS[2]))this.map.setFilter(IDS[2],['all',regionalFilterExcluding(this.year,this.maxLevel,this.ohmReady?this.ohmIds:[]),['==',['get','osm_id'],id]]);
  if(this.map.getLayer(OHM_SELECTED))this.map.setFilter(OHM_SELECTED,['==',['get','osm_id'],id]);
 }
 // What the frozen snapshot holds for the selected year, in the atlas' own honest wording.
 ohmNote(){
  const coverage=this.ohmCoverage,records=this.ohmData?.metadata?.relationCount??this.features.length;
  if(!coverage)return tr(this.lang,'OHM 固化详图与在线瓦片合并显示；两来源都没有记录的地方留白。','The static OHM extract is merged with the online tiles; wherever both sources are silent the map stays blank.');
  const percent=Math.round((coverage.ratio||0)*100),sparse=coverage.verdict==='sparse';
  return tr(this.lang,'OHM 固化详图（'+this.ohmWindowLabel+' · '+this.year+' 年 · '+records+' 条 · 陆地采样覆盖 '+percent+'%'+(sparse?' · 覆盖不足，自动模式仍用概览':'')+'）与在线瓦片合并显示；两来源都没有记录的地方留白。','Static OHM extract ('+this.ohmWindowLabel+' · '+this.year+' · '+records+' records · '+percent+'% of sampled land'+(sparse?' · too sparse, auto mode keeps the overview':'')+') merged with the online tiles; wherever both sources are silent the map stays blank.');
 }
 // Polities the frozen snapshot checks for and does not find. They are listed as missing rather
 // than drawn from another year or from the global overview.
 ohmGapNotice(){
  const metadata=this.ohmData?.metadata,gaps=(metadata?.gaps||[]).filter(gap=>!gap.overlap);
  if(!this.ohmReady||!gaps.length||!this.ohmEligible)return null;
  const details=document.createElement('details');details.className='boundary-source-note';
  const summary=document.createElement('summary');summary.textContent=tr(this.lang,gaps.length+' 个当年政体在该来源中未收录',gaps.length+' polities of this year are missing from this source');
  const list=document.createElement('dl');
  for(const gap of gaps){
   const term=document.createElement('dt'),value=document.createElement('dd');
   term.textContent=tr(this.lang,gap.zh,gap.en);
   const nearest=(gap.nearbyRecords||[]).filter(record=>record.start).slice(0,2).map(record=>record.name+' '+record.start+'–'+(record.end||'…'));
   value.textContent=nearest.length?tr(this.lang,'来源最近记录：'+nearest.join('；'),'Nearest source records: '+nearest.join('; ')):tr(this.lang,'来源没有该政体的任何更早记录','The source holds no earlier record of it');
   const related=(gap.excludedMatches||[]).map(match=>match.name).slice(0,2);
   if(related.length)value.textContent+=tr(this.lang,'（同年来源另有 '+related.join('、')+'，属不同实体）',' (the same year only holds '+related.join(', ')+', which is a different entity)');
   list.append(term,value);
  }
  const credit=document.createElement('p');credit.className='historical-credit';
  credit.textContent=tr(this.lang,'依据 OpenHistoricalMap '+(metadata.timestamp||'')+' 快照核对 '+this.year+' 年；留白处按未收录呈现，不补画。','Checked against the OpenHistoricalMap snapshot of '+(metadata.timestamp||'')+' for '+this.year+'; gaps stay unmapped and are never drawn in.');
  details.append(summary,list,credit);
  return details;
 }
 beginUpdate(){
  this.scanKey=null;this.clearLabels();if(this.status!=='updating')this.setStatus('updating');
 }
 setStatus(status){
  this.status=status;const country=this.atlas.boundaries;this.controls.hidden=!this.atlas.showBorders||this.modern&&!country?.isCountry||this.map.getZoom()<REGIONAL_MIN_ZOOM&&this.mode==='auto';this.badge.hidden=this.controls.hidden;
  const labels={updating:['地区详图 · 正在补齐视野…','Regional detail · Updating this view…'],ready:[`地区详图 · ${this.features.length} 条区划`,`Regional detail · ${this.features.length} areas`],partial:[`详图局部覆盖 · ${this.features.length} 条`,`Local detail available · ${this.features.length} areas`],error:['全球疆域 · 详图暂不可用','Global overview · detail unavailable'],empty:['全球疆域 · 此处暂无详图','Global overview · no detail here'],loading:['全球疆域 · 正在读取详图','Global overview · loading detail'],overview:['全球疆域 · 切换来源','Global overview · choose source'],zoom:['全球疆域 · 放大查看详图','Global overview · zoom for detail']};
  this.badge.textContent=this.mode==='halc'?this.halc.title():country?.mode==='cshapes'?country.title(this.lang):tr(this.lang,...(labels[status]||labels.overview));this.badge.title=tr(this.lang,'选择边界来源与查看区划档案','Choose boundary source and browse area records');
  this.switcher.hidden=this.controls.hidden||this.map.getZoom()<REGIONAL_MIN_ZOOM||this.failed&&!this.ohmReady&&this.mode!=='halc'||(!this.detailedActive&&['regional','halc'].includes(this.mode));this.switcher.textContent=this.status==='partial'&&!this.detailedActive?tr(this.lang,'并排对照','Compare detail'):tr(this.lang,this.detailedActive?'对照概览':'查看详图',this.detailedActive?'Compare overview':'View detail');
  if(status==='ready'&&this.active&&this.coverageEnough===false)this.badge.textContent=tr(this.lang,'局部详图 · '+this.features.length+' 条 · 空白处未收录','Local detail · '+this.features.length+' areas · gaps unmapped');
  if(status==='partial'&&this.ohmReady&&this.ohmVerdict==='sparse')this.badge.textContent=tr(this.lang,'该年固化详图偏少 · '+this.features.length+' 条','Sparse dated detail · '+this.features.length+' areas');
  if(this.ohmReady&&this.active&&!this.liveFrameReady)this.badge.textContent+=tr(this.lang,this.failed?' · 在线补充暂不可用':' · 在线补充中',this.failed?' · Online supplement unavailable':' · Online supplement loading');
  this.indexRefresh?.();this.map.getContainer().dispatchEvent(new CustomEvent('regional-status',{bubbles:true}));
 }
 setActive(v){
  if(v===this.active){this.visibility();return;}this.active=v;
  if(this.atlas.boundaries){this.atlas.boundaries.applyVisibility(this.detailedActive);this.visibility();this.atlas.refreshLabels();return;}
  // Switch archives atomically: cross-fading unrelated outlines creates false double borders.
  for(const [id,property]of [['territories','fill-opacity'],['boundary','line-opacity'],['selection','line-opacity'],['selection-fill','fill-opacity']])this.map.setPaintProperty(id,property+'-transition',{duration:0,delay:0});
  this.map.setPaintProperty('territories','fill-opacity',v?0:['interpolate',['linear'],['zoom'],0,.53,4,.4,9,.2]);
  this.map.setPaintProperty('boundary','line-opacity',v?0:['interpolate',['linear'],['zoom'],1,.36,4,.5,9,.4]);
  this.map.setPaintProperty('selection','line-opacity',v?0:1);this.map.setPaintProperty('selection-fill','fill-opacity',v?0:.08);
  this.visibility();this.atlas.refreshLabels();
 }
 visibility(){
  const ohmLoaded=this.ohmEligible&&this.ohmState==='ready'&&this.ohmKey===this.ohmWindow?.id+'|'+this.year,ohmVisible=ohmLoaded&&this.ohmReady,visible=this.eligible&&!this.failed,key=visible+':'+this.active+':'+this.liveDrawn+':'+ohmLoaded+':'+ohmVisible;if(this.visibilityKey===key)return;this.visibilityKey=key;
  if(this.map.getLayer(IDS[0]))this.map.setPaintProperty(IDS[0],'fill-opacity-transition',{duration:0,delay:0});
  for(const id of IDS)if(this.map.getLayer(id))this.map.setLayoutProperty(id,'visibility',visible&&(id===IDS[0]||this.liveDrawn&&this.active)?'visible':'none');
  if(this.map.getLayer(IDS[0]))this.map.setPaintProperty(IDS[0],'fill-opacity',this.active&&this.liveDrawn?['case',['==',['get','admin_level'],2],.05,.2]:0);
  for(const id of OHM_LAYERS)if(this.map.getLayer(id))this.map.setLayoutProperty(id,'visibility',ohmLoaded&&(id===OHM_LAYERS[0]||ohmVisible&&this.active)?'visible':'none');
  if(this.map.getLayer(OHM_LAYERS[0])){this.map.setPaintProperty(OHM_LAYERS[0],'fill-opacity-transition',{duration:0});this.map.setPaintProperty(OHM_LAYERS[0],'fill-opacity',this.active&&ohmVisible?['case',['==',['get','partial_geometry'],1],0,.26]:0);}
 }
 update(){
  if(this.dead||this.atlas.destroyed)return;
  this.halc?.update();if(this.ohmEligible)this.ensureOhm();
  const frozenView=this.ohmEligible?this.ohmWindow?.id+'|'+this.year:null;if(this.frozenView!==frozenView){this.frozenView=frozenView;this.applyFilters();this.scanKey=null;}
  if(this.active&&!this.ohmReady&&!this.liveDrawn){this.features=[];this.samples=[];this.setActive(false);}
  const maxLevel=this.map.getZoom()>=8?6:4;if(maxLevel!==this.maxLevel){this.maxLevel=maxLevel;this.applyFilters();}
  if(!this.eligible){this.setActive(false);this.clearLabels();if(!['cshapes','halc'].includes(this.mode)||!this.atlas.showBorders)this.closePopup();this.features=[];this.samples=[];this.scanKey=null;this.setStatus(!this.enabled?'overview':this.modern?'modern':'zoom');}
  else{if(!this.failed)this.ensure();this.visibility();if(this.active&&!this.map.isSourceLoaded(SOURCE)&&!this.ohmReady)this.beginUpdate();else this.setStatus(this.active?'ready':this.failed&&!this.ohmReady?'error':'loading');this.requestRender();}
  this.visibility();
 }
 coverage(layers=[IDS[0]],excluded=new Set()){
  const container=this.map.getContainer(),width=container.clientWidth,height=container.clientHeight,samples=[];
  for(let row=0;row<7;row++)for(let col=0;col<9;col++){
   const x=width*(.06+.88*(col+.5)/9),y=height*(.08+.84*(row+.5)/7);
   const landLayer=this.atlas.geography?.landLayer||'land';
   const found=this.map.queryRenderedFeatures([x,y],{layers:[landLayer,...layers]});
   samples.push({land:found.some(f=>f.layer?.id===landLayer),covered:found.some(f=>f.layer?.id===OHM_LAYERS[0]&&regionalVisible(f.properties,this.year,this.maxLevel)||f.layer?.id===IDS[0]&&!excluded.has(f.properties.osm_id)&&regionalVisible(f.properties,this.year,this.maxLevel)),central:col>=3&&col<=5&&row>=2&&row<=4,quadrant:Number(col>=4)*2+Number(row>=3)});
  }
  return samples;
 }
 requestRender(){if(this.dead||this.atlas.destroyed)return;this.renderPending=true;this.map.triggerRepaint?.();}
 viewportKey(){
  const b=this.map.getBounds?.(),c=this.map.getContainer();
  return [this.year,this.maxLevel,this.mode,this.lang,this.map.getZoom(),this.map.getBearing?.(),this.map.getPitch?.(),b?.getWest(),b?.getSouth(),b?.getEast(),b?.getNorth(),c.clientWidth,c.clientHeight,this.atlas.geography?.landLayer||'land',this.landEpoch||0].join('|');
 }
 settle(rendered=false){
  if(this.settling||!this.eligible||this.map.isMoving())return;
  const view=this.viewportKey(),liveLoaded=!this.failed&&this.liveContentSeen&&!!this.map.getSource(SOURCE)&&this.map.isSourceLoaded(SOURCE),frozenLoaded=this.frozenContentSeen&&this.ohmState==='ready'&&this.ohmKey===this.ohmWindow?.id+'|'+this.year&&!!this.map.getSource(OHM_SOURCE)&&this.map.isSourceLoaded(OHM_SOURCE);
  if(rendered){
   if(liveLoaded)this.liveRendered=view+'|'+this.liveEpoch;
   if(frozenLoaded){this.frozenRendered=view+'|'+this.frozenEpoch;if(this.ohmRenderedKey!==this.ohmKey){this.ohmRenderedKey=this.ohmKey;this.applyFilters();this.visibility();}}
  }
  const live=liveLoaded&&this.liveRendered===view+'|'+this.liveEpoch,frozen=frozenLoaded&&this.frozenRendered===view+'|'+this.frozenEpoch;
  this.liveFrameReady=live;
  if(!live&&!frozen)return;
  const key=[view,live?this.liveEpoch:'pending',frozen?this.ohmKey+':'+this.frozenEpoch:'pending'].join('|');if(this.scanKey===key)return;
  this.settling=true;
  try{
   const layers=[...(frozen?[OHM_LAYERS[0]]:[]),...(live?[IDS[0]]:[])],excluded=new Set(frozen?this.ohmIds:[]);
   const local=frozen?this.map.queryRenderedFeatures({layers:[OHM_LAYERS[0]]}):[],online=live?this.map.queryRenderedFeatures({layers:[IDS[0]]}).filter(f=>!excluded.has(f.properties.osm_id)):[];
   const features=groupRegionalFeatures([...local,...online],this.year,this.maxLevel),samples=features.length?this.coverage(layers,excluded):[];
   const detailed=coverageAllowsDetail(samples,this.active)&&this.ohmVerdict!=='sparse',show=features.length>0&&(this.mode==='regional'||detailed);
   // An incomplete replacement cannot evict a useful previously committed view.
   // This applies only to the same view/year; a completed empty result does clear it.
   if(this.active&&this.committedView===view&&(!live&&!this.failed&&(this.liveDrawn||!show)||!frozen&&this.frozenDrawn&&this.ohmReady)){this.beginUpdate();this.scanKey=key;return;}
   this.features=features;this.samples=samples;this.coverageEnough=detailed;this.liveDrawn=live;this.frozenDrawn=frozen;this.committedView=view;this.scanKey=key;
   this.setActive(show);this.setStatus(!features.length?'empty':show?'ready':'partial');this.refreshLabels();
  }finally{this.settling=false;}
 }
 setYear(year,lang){
  const previous=this.year;this.year=year;this.lang=lang;this.scanKey=null;this.liveDrawn=false;this.features=[];this.samples=[];this.closePopup();this.clearLabels();this.setActive(false);
  if(year!==previous){this.ohmRequest=(this.ohmRequest||0)+1;this.ohmRequestKey=null;this.ohmState='idle';this.ohmData=null;this.ohmIds=[];this.ohmKey=null;this.removeOhmLayers();}
  this.applyFilters();this.update();
 }
 setMode(mode){this.modeRevision=(this.modeRevision||0)+1;this.mode=boundaryMode(mode);this.closePopup();this.update();this.settle();this.atlas.onBoundaryMode?.(this.mode);this.atlas.boundaries?.setMode(this.mode);}
 toggle(v){this.setMode(v?'auto':'overview');}
 setModern(v){this.modern=v;this.update();}
 hit(point){
  if(!this.active||!this.eligible)return null;
  const layers=[...(!this.failed&&this.liveDrawn&&this.map.getLayer(IDS[0])?[IDS[0]]:[]),...(this.ohmReady?[OHM_LAYERS[0]]:[])];if(!layers.length)return null;
  return this.map.queryRenderedFeatures(point,{layers}).filter(f=>regionalVisible(f.properties,this.year,this.maxLevel)).sort((a,b)=>(a.properties.area||Infinity)-(b.properties.area||Infinity))[0]||null;
 }
 clearLabels(){for(const m of this.markers)m.remove();this.markers=[];}
 refreshLabels(){
  if(this.halc?.active){this.clearLabels();this.halc.refreshLabels();return;}
  this.clearLabels();if(!this.active||this.status==='updating'||!this.atlas.showLabels)return;this.atlas.labelBoxes=[];
  const root=this.map.getContainer().getBoundingClientRect(),overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  const bounds=this.map.getBounds();let clipBox=[bounds.getWest(),bounds.getSouth(),bounds.getEast(),bounds.getNorth()];
  if(Math.abs(this.map.getBearing())<1&&root.width>220&&root.height>250){const a=this.map.unproject([80,100]),b=this.map.unproject([root.width-80,root.height-90]);clipBox=[a.lng,b.lat,b.lng,a.lat];}
  const boxes=[...document.querySelectorAll('.map-heading,.map-tools,.compare-heading,.map-legend,.map-notice,.layer-panel,.event-marker,.regional-controls,.lake-label')].filter(el=>el.getClientRects().length).map(el=>el.getBoundingClientRect()),names=new Set();
  const ranked=this.features.map(f=>({f,anchor:regionalAnchor(f,clipBox[0]<clipBox[2]?clipBox:null)})).filter(x=>x.anchor&&!ohmPartial(x.f.properties)).sort((a,b)=>a.f.properties.admin_level-b.f.properties.admin_level||b.anchor.score-a.anchor.score);
  for(const {f,anchor}of ranked){
   if(this.markers.length>=14)break;const name=regionalName(f.properties,this.lang,this.atlas.active),coord=anchor.coordinate,national=f.properties.admin_level===2;if(!name||names.has(name))continue;
   const p=this.map.project(coord),primary=[...name].reduce((n,c)=>n+(/[\u3400-\u9fff]/.test(c)?national?16:13:national?8:7),0),width=Math.min(national?220:190,Math.max(90,primary+16)),height=this.lang==='bi'&&f.properties.name_en&&name!==f.properties.name_en?58:40,box={left:root.left+p.x-width/2,right:root.left+p.x+width/2,top:root.top+p.y-height/2,bottom:root.top+p.y+height/2};
   if(box.left<root.left+12||box.right>root.right-12||box.top<root.top+85||box.bottom>root.bottom-85||boxes.some(b=>overlap(box,b)))continue;
   const el=document.createElement('button');el.className='regional-label'+(national?' regional-national':'');el.textContent=name;el.style.maxWidth=width+'px';if(this.lang==='bi'&&f.properties.name_en&&name!==f.properties.name_en){const en=document.createElement('span');en.textContent=f.properties.name_en;el.append(en);}el.setAttribute('aria-label',name);el.onclick=e=>{e.stopPropagation();this.openFeature(f,{lng:coord[0],lat:coord[1]});};
   this.markers.push(new maplibregl.Marker({element:el,opacityWhenCovered:'0'}).setLngLat(coord).addTo(this.map));boxes.push(box);this.atlas.labelBoxes.push(box);names.add(name);
  }
  this.atlas.places?.refresh();
 }
 closePopup(){this.selectedId=null;this.halc?.clearSelection();this.indexRefresh=null;this.popup?.remove();this.popup=null;this.applySelection(0);}
 fitPopup(){this.popup?.getElement().style.setProperty('--regional-panel-height',Math.max(0,this.map.getContainer().clientHeight-32)+'px');}
 popupAt(node,point,index=false){
  this.popup=new maplibregl.Popup({className:'historical-popup regional-popup'+(index?' regional-index':''),maxWidth:'350px',closeButton:true,closeOnClick:true,focusAfterOpen:false,offset:12}).setLngLat(point).setDOMContent(node).addTo(this.map);
  const el=this.popup.getElement();this.fitPopup();el.setAttribute('role','dialog');el.setAttribute('aria-label',tr(this.lang,'历史区划档案','Historical boundary record'));const close=el.querySelector('.maplibregl-popup-close-button');close.setAttribute('aria-label',tr(this.lang,'关闭区划档案','Close boundary record'));close.focus({preventScroll:true});el.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();this.closePopup();this.map.getCanvas().focus();}});
  const popup=this.popup;this.popup.on('close',()=>{if(this.popup!==popup)return;this.selectedId=null;this.indexRefresh=null;this.popup=null;this.applySelection(0);});
 }
 openFeature(f,point){
  if(f.properties.archive==='halc'){this.halc.openRecord(f.properties.fid,point);return;}
  if(f.properties.archive==='cshapes'){this.atlas.boundaries?.openRecord(f.properties.id,point);return;}
  if(!regionalVisible(f.properties,this.year,this.maxLevel))return;if(!this.active)this.setMode('regional');this.closePopup();const p=f.properties,node=document.createElement('section');
  const small=document.createElement('small');small.className='historical-eyebrow';small.textContent=tr(this.lang,'历史区划 · 地区详图','Historical area · regional detail');const h=document.createElement('h3');h.textContent=regionalName(p,this.lang,this.atlas.active);node.append(small,h);if(this.lang==='bi'&&p.name_en&&h.textContent!==p.name_en){const en=document.createElement('p');en.textContent=p.name_en;node.append(en);}
  const ends=p.end_date||(Number.isFinite(p.end_decdate)?recordYear(p.end_decdate,this.lang):null),rows=[[tr(this.lang,'记录开始','Record begins'),p.start_date||recordYear(p.start_decdate,this.lang)],[tr(this.lang,'记录结束','Record ends'),ends||tr(this.lang,'来源未记结束','No end recorded in this source')]],area=p.archive==='ohm-frozen'?ohmAreaLabel(p,this.lang):null;
  if(area)rows.push([tr(this.lang,'记录面积','Recorded area'),area]);
  const dl=document.createElement('dl');for(const [term,value]of rows){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=term;dd.textContent=value;dl.append(dt,dd);}node.append(dl);
  if(p.open_chains||p.unassigned_holes){const warn=document.createElement('p');warn.className='historical-credit';warn.textContent=tr(this.lang,'来源记录的 '+(p.open_chains||0)+' 段成员线未闭合成环，图上只画已闭合的部分；另有 '+(p.unassigned_holes||0)+' 个内环未能匹配到外环。',(p.open_chains||0)+' member chains of this record do not close into rings, so only the closed parts are drawn; '+(p.unassigned_holes||0)+' inner rings could not be matched to an outer ring.');node.append(warn);}
  const links=document.createElement('div');links.className='historical-source-links';for(const [label,url]of [[tr(this.lang,'原始区划记录','Original boundary record'),regionalElementURL(p)],[tr(this.lang,'同年来源地图','Source map in this year'),historicalMapURL(this.year,this.map.getCenter(),this.map.getZoom())]]){if(!url)continue;const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);}node.append(links);
  const related=this.atlas.active?.find(r=>r.name===(p.name_en||p.name));if(related){const b=document.createElement('button');b.className='regional-dossier';b.textContent=tr(this.lang,'相关疆域档案','Related territory dossier');b.onclick=()=>{this.closePopup();this.atlas.onPolity?.(related);};node.append(b);}
  const note=boundaryNote(p);if(note){const details=document.createElement('details'),summary=document.createElement('summary'),text=document.createElement('p'),date=document.createElement('small');details.className='boundary-source-note';summary.textContent=tr(this.lang,'这条边界的来源说明','Notes on this boundary');text.textContent=tr(this.lang,note.zh,note.en);date.textContent=tr(this.lang,'核查日期 · ','Reviewed · ')+note.checkedOn;details.append(summary,text,date);node.append(details);}
  const credit=document.createElement('p');credit.className='historical-credit';credit.textContent='OpenHistoricalMap contributors';node.append(credit);this.popupAt(node,point);this.selectedId=p.osm_id;this.applySelection(p.osm_id);
 }
 openIndex({halcGroup=null}={}){
  if(this.mode!=='halc')halcGroup=null;
  this.closePopup();const node=document.createElement('section'),h=document.createElement('h3');h.textContent=halcGroup?this.halc.groupName(halcGroup):tr(this.lang,'边界与历史区划','Borders & historical areas');node.append(h);if(halcGroup){const back=document.createElement('button');back.className='regional-dossier';back.textContent=tr(this.lang,'← 全部区划','← All areas');back.onclick=()=>this.openIndex();node.append(back);}
  const controls=document.createElement('div');controls.className='regional-modes';controls.setAttribute('role','group');controls.setAttribute('aria-label',tr(this.lang,'边界来源','Boundary source'));
  for(const [mode,zh,en]of [['auto','自动','Auto'],['overview','全球疆域','Global overview'],['regional','地区详图','Regional detail'],['cshapes','近现代国家','Modern-era states'],['halc','低地国家 · 1500','Low Countries · 1500']]){const b=document.createElement('button');b.textContent=tr(this.lang,zh,en);b.setAttribute('aria-pressed',String(this.mode===mode));b.onclick=()=>{this.setMode(mode);this.openIndex();};controls.append(b);}if(!halcGroup)node.append(controls);
  const note=document.createElement('p');const updateNote=()=>{if(this.mode==='halc'){note.textContent=halcGroup?tr(this.lang,'按原始领地归属分组，以下列出当前视野内的地方单元。','Grouped by source territorial attribution; local units in the current view are listed below.'):this.halc.title()+' · '+tr(this.lang,'地方区划重建 · 可见范围内逐条阅读','Reconstructed local divisions · records in the current view');if(this.halc.loading&&this.halc.active)note.textContent=tr(this.lang,'正在补齐当前视野，可继续阅读上次载入的地方记录。','Updating this view. Previously loaded local records remain available.');if(this.halc.regions.failed)note.textContent+=' '+tr(this.lang,'地区轮廓暂未载入，可重新读取。地方区划仍可浏览。','Regional outlines are unavailable; retry to load them. Local divisions remain available.');return;}if(this.mode==='cshapes'){note.textContent=tr(this.lang,'CShapes 2.1 · 国家与属地。1886—2023年，按所选年年中读取；口径与许可见来源说明。','CShapes 2.1 · states and dependencies, 1886–2023. Records use the selected midyear; coding and license are documented in Sources.');return;}if(this.enabled&&this.status==='updating'){note.textContent=tr(this.lang,'正在补齐当前视野，可继续阅读上次载入的区划记录。','Updating this view. Previously loaded area records remain available.');return;}note.textContent=(this.ohmReady?this.ohmNote()+' ':'')+tr(this.lang,this.status==='partial'?'这里收录了部分详细区划。可并排查看同年概览与详图，或切换到详图逐一阅读。':this.mode==='regional'?'显示所选年年中的原始区划。留白处暂无该来源的记录。':'自动模式在详细资料覆盖较充分时切换来源。两套疆域可独立对照。',this.status==='partial'?'Local detail is available here. Compare the same year side by side, or select detail to explore individual records.':this.mode==='regional'?'Dated source areas at midyear. Gaps have no matching record in this source.':'Auto switches when detailed records cover enough of the visible land. The two archives remain independently selectable.');};updateNote();node.append(note);const gapNotice=this.ohmGapNotice();if(gapNotice)node.append(gapNotice);if(this.status==='partial'&&!this.detailedActive){const compare=document.createElement('button');compare.className='regional-dossier';compare.textContent=tr(this.lang,'并排对照同年边界','Compare this year’s boundaries');compare.onclick=()=>{this.closePopup();this.map.getContainer().dispatchEvent(new CustomEvent('boundary-compare',{bubbles:true}));};node.append(compare);}if(this.mode==='halc'&&!halcGroup){const visit=document.createElement('button');visit.className='regional-dossier';visit.textContent=tr(this.lang,'前往1500年低地国家','Explore the Low Countries in 1500');visit.onclick=()=>{this.closePopup();this.map.getContainer().dispatchEvent(new CustomEvent('halc-explore',{bubbles:true}));};node.append(visit);}
  const retry=document.createElement('button');retry.className='regional-retry';const updateRetry=()=>{retry.hidden=!(this.mode==='halc'&&(this.halc.failed||this.halc.regions.failed)||(this.failed||this.ohmState==='failed')&&this.enabled||this.mode==='cshapes'&&this.atlas.boundaries?.reason==='error');retry.textContent=this.mode==='cshapes'?tr(this.lang,'重新读取国家边界','Retry country boundaries'):this.mode==='halc'&&!this.halc.failed?tr(this.lang,'重新读取地区轮廓','Retry regional outlines'):tr(this.lang,'重新读取地区详图','Retry regional detail');};retry.onclick=()=>{this.retry();updateRetry();};node.append(retry);updateRetry();
  {const search=document.createElement('input');search.type='search';search.className='regional-search';search.placeholder=this.mode==='cshapes'?tr(this.lang,'查找当年国家与属地…','Find states & territories this year…'):tr(this.lang,'查找区划…','Find an area…');search.setAttribute('aria-label',this.mode==='cshapes'?tr(this.lang,'查找当年国家与属地','Find states and territories this year'):tr(this.lang,'查找当前区划','Find a visible area'));const count=document.createElement('p');count.className='historical-credit';const list=document.createElement('div');list.className='historical-record-list';const more=document.createElement('button');more.className='regional-more';let limit=24,lastListKey='';const indexFeatures=()=>this.mode==='halc'?this.halc.indexFeatures().filter(f=>!halcGroup||f.properties.ADM1===halcGroup):this.mode==='cshapes'?this.atlas.boundaries?.indexFeatures()||[]:this.features;
   const render=()=>{updateNote();updateRetry();const available=indexFeatures();const q=search.value.trim().toLocaleLowerCase(),features=available.filter(f=>[regionalName(f.properties,this.lang,this.atlas.active),f.properties.name,f.properties.name_en,f.properties.name_zh,f.properties.source_name,f.properties.SHORT_ID,String(f.properties.record_id||f.properties.osm_id)].some(v=>v?.toLocaleLowerCase().includes(q)));count.textContent=this.mode==='halc'&&this.halc.loading&&this.halc.active?tr(this.lang,`${features.length} 条上次载入的地方记录`,`${features.length} previously loaded local records`):this.enabled&&this.status==='updating'&&this.active?tr(this.lang,`${features.length} 条上次载入的区划记录`,`${features.length} previously loaded area records`):halcGroup?tr(this.lang,`${features.length} 个可见地方单元`,`${features.length} visible local units`):tr(this.lang,`${features.length} 条来源记录`,`${features.length} source records`);const key=[this.lang,search.value,limit,...available.map(f=>(f.properties.record_id||f.properties.osm_id)+':'+regionalPeriod(f.properties,this.lang))].join('|');if(key===lastListKey)return;lastListKey=key;search.hidden=!available.length;count.hidden=!available.length&&!halcGroup;list.hidden=!available.length;const scroll=list.scrollTop;list.replaceChildren();for(const f of features.slice(0,limit)){const b=document.createElement('button');b.textContent=regionalName(f.properties,this.lang,this.atlas.active);const meta=document.createElement('small');meta.textContent=regionalPeriod(f.properties,this.lang)+' · '+(f.properties.archive==='halc'?f.properties.SHORT_ID:f.properties.record_id||Math.abs(f.properties.osm_id));b.append(meta);b.onclick=()=>this.openFeature(f,this.map.getCenter());list.append(b);}list.scrollTop=scroll;more.hidden=features.length<=limit;more.textContent=tr(this.lang,'继续展开','Show more');};search.oninput=()=>{limit=24;render();};more.onclick=()=>{limit+=24;render();};node.append(search,count,list,more);this.indexRefresh=render;render();}
  this.popupAt(node,this.map.getCenter(),true);
 }
 retry(){
  if(this.mode==='halc'&&!this.halc.failed&&this.halc.regions.failed){this.halc.retryRegions();return;}
  if(this.mode==='halc'){this.closePopup();this.halc.retry();return;}if(this.mode==='cshapes'){this.closePopup();this.atlas.boundaries?.setMode('cshapes');return;}
  if(!this.ohmReady)this.closePopup();
  if(this.failed){for(const id of IDS.toReversed())if(this.map.getLayer(id))this.map.removeLayer(id);if(this.map.getSource(SOURCE))this.map.removeSource(SOURCE);this.liveEpoch++;this.liveContentSeen=false;this.liveRendered=null;this.liveDrawn=false;this.failed=false;this.lastError=null;}
  if(this.ohmState==='failed'){this.removeOhmLayers();this.ohmState='idle';this.ohmKey=null;}
  this.scanKey=null;this.update();
 }
 destroy(){this.dead=true;this.ohmRequest=(this.ohmRequest||0)+1;this.renderPending=false;this.closePopup();this.halc.destroy();this.removeOhmLayers();this.clearLabels();this.controls.remove();for(const [event,fn]of this.listeners)this.map.off(event,fn);}
}
