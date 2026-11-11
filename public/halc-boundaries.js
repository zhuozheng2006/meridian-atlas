import {createExactLabelScheduler} from './halc-label-scheduler.js?v=3.53.0-9308e8f3f08d';
import {renderHalcLandscape} from './halc-landscape-reader.js?v=3.53.0-9308e8f3f08d';
import {HalcLandscape} from './halc-landscape.js?v=3.53.0-9308e8f3f08d';
import {readJSON} from './map-engine.js?v=3.53.0-9308e8f3f08d';
import {HalcRegions} from './halc-regions.js?v=3.53.0-9308e8f3f08d';

export const HALC_BOUNDS=[.5394290754663461,48.54020298612199,8.351988466075143,54.024330541815885];
export const HALC_SOURCE='halc-boundaries';
export const HALC_LAYERS=['halc-wash','halc-edges','halc-selected','halc-independent-edges','halc-independent-selected'];
const ROOT='data/halc/',SOURCE_URL='https://doi.org/10.34894/BTKFHV';
const t=(lang,zh,en)=>lang==='en'?en:zh;
const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;};
const label=(entry,lang)=>entry?.[lang==='en'?'en':'zh']||entry?.en;
const fid=value=>{if(typeof value!=='number'&&(typeof value!=='string'||!/^\d+$/.test(value)))return null;const id=Number(value);return Number.isSafeInteger(id)&&id>0&&id<=14865?id:null;};
const selectionTarget=id=>({source:HALC_SOURCE,sourceLayer:'halc_localities',id});
// MapLibre keeps rendered-feature coordinates lazy. Keep that property for
// visible-unit listings: only label anchoring or an explicit geometry reader
// needs to convert a tile fragment into geographic coordinates.
export function halcVisibleUnits(rendered){
 const units=new Map();
 for(const feature of rendered){
  const id=fid(feature.properties.fid);if(!id)continue;
  if(!units.has(id))units.set(id,{...feature,fragments:[]});
  const fragments=units.get(id).fragments,index=fragments.length;
  Object.defineProperty(fragments,index,{enumerable:true,configurable:true,get(){
   const geometry=feature.geometry;
   Object.defineProperty(fragments,index,{value:geometry,enumerable:true,configurable:true,writable:true});
   return geometry;
  }});
 }
 return [...units.values()].sort((a,b)=>a.properties.fid-b.properties.fid);
}
export function halcInView(bounds){
 if(!bounds)return false;
 const west=bounds.getWest(),east=bounds.getEast(),south=bounds.getSouth(),north=bounds.getNorth();
 if(![west,east,south,north].every(Number.isFinite)||south>HALC_BOUNDS[3]||north<HALC_BOUNDS[1])return false;
 const end=east<west?east+360:east;if(end-west>=360)return true;
 const shift=Math.round(((west+end)/2-(HALC_BOUNDS[0]+HALC_BOUNDS[2])/2)/360)*360;
 return west<=HALC_BOUNDS[2]+shift&&end>=HALC_BOUNDS[0]+shift;
}
export function halcEligibility({mode,year,borders,modern,zoom,bounds,destroyed}){
 if(destroyed||mode!=='halc')return 'disabled';if(!borders)return 'hidden';if(modern)return 'modern';
 if(year!==1500)return 'year';if(zoom<6)return 'zoom';return halcInView(bounds)?null:'outside';
}
export function halcMembership(raw,level,labels,lang){
 return String(raw||'').split(';').filter(Boolean).map(code=>label(labels?.[level]?.[code],lang)||code).join(' / ');
}
export function halcName(p,labels,lang){
 const alias=labels?.localityNameLabels?.find(x=>Object.entries(x.expected).every(([key,value])=>Object.hasOwn(p,key)&&p[key]===value));
 return label(alias?.label,lang)||p.NAME||p.SHORT_ID||String(p.fid);
}
const independentUnit=['in',';XX;',['concat',';',['coalesce',['get','ADM1'],''],';']];
export function halcLineOpacity(regional,independent=false){return regional?['interpolate',['linear'],['zoom'],6,independent?.5:.015,8,independent?.6:.1,11,.45,15,.65]:['interpolate',['linear'],['zoom'],6,.04,8,.16,11,.5,15,.65];}
export function halcLayers(){
 const base={source:HALC_SOURCE,'source-layer':'halc_localities',minzoom:6};
 return [
  {...base,id:HALC_LAYERS[0],type:'fill',paint:{'fill-color':'#b3aa85','fill-opacity':0}},
  {...base,id:HALC_LAYERS[1],type:'line',filter:['!',independentUnit],layout:{visibility:'none','line-join':'round','line-cap':'round'},paint:{'line-color':['case',['==',['get','TYPE'],8],'#638b94','#66604f'],'line-width':['interpolate',['linear'],['zoom'],6,.3,8,.5,11,.8,15,1.1],'line-opacity':0,'line-blur':.1}},
  {...base,id:HALC_LAYERS[3],type:'line',filter:independentUnit,layout:{visibility:'none','line-join':'round','line-cap':'round'},paint:{'line-color':['case',['==',['get','TYPE'],8],'#638b94','#66604f'],'line-width':['interpolate',['linear'],['zoom'],6,.3,8,.5,11,.8,15,1.1],'line-opacity':0,'line-blur':.1}},
  // Match each base layer's fixed filter/layout to reuse its geometry bucket.
  // Paint differs, so both selection passes stay above the regional outlines.
  ...[[HALC_LAYERS[2],['!',independentUnit]],[HALC_LAYERS[4],independentUnit]].map(([id,filter])=>({...base,id,type:'line',filter,layout:{visibility:'none','line-join':'round','line-cap':'round'},paint:{'line-color':['case',['boolean',['feature-state','halcSelected'],false],'#a96926','rgba(169,105,38,0)'],'line-width':['interpolate',['linear'],['zoom'],6,1.5,12,2.3],'line-opacity':0}}))
 ];
}
export class HalcBoundaries{
 constructor(owner,{load=readJSON,anchor}={}){
  this.owner=owner;this.atlas=owner.atlas;this.map=owner.map;this.load=load;this.anchor=anchor;this.active=false;this.failed=false;this.reason='disabled';this.features=[];this.markers=[];this.seq=0;this.dead=false;this.listeners=[];this.sourceEpoch=0;this.featureEpoch=0;this.renderedKey=null;this.renderPending=false;this.seenContent=false;
  this.labelScheduler=createExactLabelScheduler({anchor:(f,box)=>this.anchor(f,box)});
  const on=(event,fn)=>{this.map.on(event,fn);this.listeners.push([event,fn]);};
  on('idle',()=>this.settle());
  on('sourcedata',e=>{if(e.sourceId!==HALC_SOURCE)return;if(e.tile?.state==='loaded'||e.sourceDataType==='content')this.seenContent=true;if(this.seenContent&&e.isSourceLoaded)this.requestRender();});
  on('render',()=>this.afterRender());
  on('movestart',()=>{this.renderedKey=null;this.renderPending=false;this.labelScheduler.invalidate('camera-moving');});
  on('moveend',()=>this.requestRender());
  on('resize',()=>this.requestRender());
  on('sourcedataloading',e=>{if(e.sourceId!==HALC_SOURCE||this.dead)return;this.sourceEpoch++;this.renderedKey=null;if(!this.eligible||!this.active)return;this.beginUpdate();});
  on('error',e=>{if(e.sourceId!==HALC_SOURCE||this.dead)return;this.failed=true;this.lastError=String(e.error?.message||'HALC source error');this.reason='error';this.features=[];this.clearSelection();this.setActive(false);this.visibility();this.notify();});
  this.regions=new HalcRegions(this,HALC_BOUNDS);
  this.landscape=new HalcLandscape(this);
 }
 // Tile completion and rendered pixels are separate phases. Queries run only
 // after a render for this source epoch and camera, never after unrelated idle.
 frameKey(){return this.viewportKey()+':'+this.sourceEpoch;}
 requestRender(){if(this.dead||!this.eligible||this.failed)return;if(this.active&&this.renderedKey!==this.frameKey())this.beginUpdate();this.renderPending=true;this.map.triggerRepaint?.();}
 afterRender(){
  if(!this.renderPending||this.dead||!this.eligible||this.failed||this.map.isMoving())return;
  if(!this.seenContent||!this.map.getSource(HALC_SOURCE)||!this.map.isSourceLoaded(HALC_SOURCE))return;
  this.renderPending=false;this.renderedKey=this.frameKey();this.settle();
 }
 get lang(){return this.owner.lang;}
 get eligibility(){return halcEligibility({mode:this.owner.mode,year:this.owner.year,borders:this.atlas.showBorders,modern:this.owner.modern,zoom:this.map.getZoom(),bounds:this.map.getBounds?.(),destroyed:this.dead||this.atlas.destroyed});}
 get eligible(){return this.eligibility===null;}
 get loading(){return this.reason==='loading'||this.reason==='updating';}
 beginUpdate(){const next=this.active?'updating':'loading',changed=this.reason!==next;this.reason=next;this.scanKey=null;this.clearLabels();if(changed)this.notify();}
 notify(){if(!this.dead&&this.owner.mode==='halc')this.owner.setStatus(this.reason);}
 title(){
  const pairs={year:['全球疆域 · HALC 提供1500年','Global overview · HALC covers 1500'],zoom:['HALC · 放大查看地方区划','HALC · Zoom in for local divisions'],outside:['全球疆域 · HALC 覆盖低地国家','Global overview · HALC covers the Low Countries'],modern:['HALC · 现代参照开启','HALC · Modern reference is on'],hidden:['HALC · 疆域已收起','HALC · Borders are hidden'],loading:['HALC · 正在载入地方区划','HALC · Loading local divisions'],error:['全球疆域 · HALC 载入失败，可重试','Global overview · HALC unavailable; retry'],empty:['全球疆域 · 此处暂无HALC记录','Global overview · No HALC records here']};
  if(this.reason==='updating')return t(this.lang,'HALC · 正在补齐视野…','HALC · Updating this view…');
  return this.active?t(this.lang,'HALC · 1500 · '+this.features.length+' 条可见区划','HALC · 1500 · '+this.features.length+' visible units'):t(this.lang,...(pairs[this.reason]||pairs.loading));
 }
 ensure(){
  if(!this.metaRequest&&!this.labels){
   this.metaRequest=this.load(ROOT+'labels.json').then(data=>{if(this.dead)return;this.labels=data;this.paint();this.requestRender();}).catch(e=>{if(this.dead)return;this.failed=true;this.lastError=String(e.message||e);this.reason='error';this.setActive(false);this.visibility();this.notify();}).finally(()=>{this.metaRequest=null;});
  }
  if(this.map.getSource(HALC_SOURCE))return;
  this.map.addSource(HALC_SOURCE,{type:'vector',tiles:[new URL(ROOT+'tiles/{z}/{x}/{y}.pbf',location.href).href.replaceAll('%7B','{').replaceAll('%7D','}')],bounds:HALC_BOUNDS,minzoom:6,maxzoom:10,promoteId:{halc_localities:'fid'},attribution:'Rombert Stapel · <a href="https://doi.org/10.34894/BTKFHV" target="_blank" rel="noopener">HALC v15</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>'});
  for(const layer of halcLayers())this.map.addLayer(layer,'boundary');this.paint();
 }
 paint(){
  if(!this.map.getLayer(HALC_LAYERS[0])||!this.labels)return;
  const palette=['#b49b74','#85a195','#a698a2','#aeb079','#859eaa','#b18f79','#99a87b','#8d9db1'],expression=['match',['get','ADM1']];
  for(const code of new Set([...Object.keys(this.labels.ADM1||{}),...Object.keys(this.labels.ADM1Composites||{})])){let h=0;for(const c of code)h=(h*31+c.charCodeAt(0))>>>0;expression.push(code,code==='XX'?'#aaa58d':palette[h%palette.length]);}
  expression.push('#aaa58d');this.map.setPaintProperty(HALC_LAYERS[0],'fill-color',['case',['==',['get','TYPE'],8],'rgba(120,150,155,0.20833333333333334)',expression]);
 }
 visibility(){
  this.regions?.visibility();this.landscape?.reconcileOrder();
  const visible=this.eligible&&!this.failed;
  const regional=!!this.regions?.hasFrame&&!this.regions?.failed,key=visible+':'+this.active+':'+regional;if(key===this.visibilityKey)return;this.visibilityKey=key;
  // Keep all eligible buckets built before the first takeover. Changing layout
  // visibility or a data-driven paint expression reparses every vector tile.
  for(const id of HALC_LAYERS)if(this.map.getLayer(id))this.map.setLayoutProperty(id,'visibility',visible?'visible':'none');
  if(this.map.getLayer(HALC_LAYERS[0])){this.map.setPaintProperty(HALC_LAYERS[0],'fill-opacity-transition',{duration:0});this.map.setPaintProperty(HALC_LAYERS[0],'fill-opacity',this.active?.24:0);}
  for(const [id,independent]of [[HALC_LAYERS[1],false],[HALC_LAYERS[3],true]])if(this.map.getLayer(id)){this.map.setPaintProperty(id,'line-opacity-transition',{duration:0});this.map.setPaintProperty(id,'line-opacity',this.active?halcLineOpacity(regional,independent):0);}
  for(const id of [HALC_LAYERS[2],HALC_LAYERS[4]])if(this.map.getLayer(id)){this.map.setPaintProperty(id,'line-opacity-transition',{duration:0});this.map.setPaintProperty(id,'line-opacity',this.active?1:0);}
 }
 setActive(value){
  if(!value){this.clearLabels();this.regions?.update();}
  if(this.active===value){this.visibility();return;}this.active=value;this.owner.atlas.boundaries?.applyVisibility(this.owner.detailedActive);this.visibility();this.atlas.refreshLabels();
 }
 update(){
  if(this.dead)return;const reason=this.eligibility;this.regions.update();this.landscape.update();
  if(reason){this.renderedKey=null;this.renderPending=false;this.reason=reason;this.features=[];this.scanKey=null;this.clearSelection();this.setActive(false);this.clearLabels();this.visibility();this.notify();return;}
  if(this.failed){this.reason='error';this.setActive(false);this.visibility();this.notify();return;}
  if(this.active&&(!this.map.isSourceLoaded(HALC_SOURCE)||this.renderedKey!==this.frameKey()))this.beginUpdate();
  if(!this.active)this.reason='loading';this.ensure();this.regions.ensure();this.visibility();this.notify();if(this.renderedKey!==this.frameKey())this.requestRender();this.settle();
 }
 settle(){
  if(!this.eligible||this.failed||!this.labels||this.settling||this.map.isMoving()||!this.map.getSource(HALC_SOURCE)||!this.map.isSourceLoaded(HALC_SOURCE))return;
  this.regions.settle();this.visibility();
  const key=this.frameKey();if(this.renderedKey!==key)return;
  if(key===this.scanKey){this.refreshLabels();if(this.active&&this.pendingId){const id=this.pendingId;this.pendingId=null;this.openRecord(id);}return;}
  this.settling=true;
  try{
   this.features=halcVisibleUnits(this.map.queryRenderedFeatures({layers:[HALC_LAYERS[0]]}));this.scanKey=key;this.featureEpoch++;this.reason=this.features.length?'ready':'empty';this.setActive(!!this.features.length);this.refreshLabels();this.notify();
   if(this.active&&this.pendingId){const id=this.pendingId;this.pendingId=null;this.openRecord(id);}
  }finally{this.settling=false;}
 }
 hit(point){return this.active&&this.eligible?this.map.queryRenderedFeatures(point,{layers:[HALC_LAYERS[0]]})[0]||null:null;}
 viewportKey(){const b=this.map.getBounds(),c=this.map.getContainer();return [b.getWest(),b.getSouth(),b.getEast(),b.getNorth(),this.map.getZoom(),this.map.getBearing?.()||0,this.map.getPitch?.()||0,c.clientWidth,c.clientHeight].join(':');}
 groupName(code){return halcMembership(code,'ADM1',this.labels,this.lang);}
 openGroup(code){this.owner.openIndex({halcGroup:code});}
 openHit(feature,point){const p=feature.properties;if(!this.loading&&this.map.getZoom()<8&&p.TYPE!==8&&p.ADM1&&!p.ADM1.split(';').includes('XX'))this.openGroup(p.ADM1);else this.openRecord(p.fid,point);}
 indexFeatures(){return this.features.map(f=>({...f,properties:{...f.properties,archive:'halc',record_id:'HALC-'+f.properties.fid,name:halcName(f.properties,this.labels,this.lang),name_en:f.properties.NAME,start_date:'1500',end_date:'1500'}}));}
 removeLabels(){for(const marker of this.markers)marker.remove();this.markers=[];this.labelKey=null;this.labelBoxes=null;}
 clearLabels(){this.labelScheduler.invalidate('labels-cleared');this.removeLabels();}
 labelContext(){
  const bounds=this.map.getBounds(),box=[bounds.getWest(),bounds.getSouth(),bounds.getEast(),bounds.getNorth()],root=this.map.getContainer().getBoundingClientRect();
  const boxes=[...document.querySelectorAll('.map-heading,.map-tools,.compare-heading,.map-legend,.layer-panel,.event-marker,.regional-controls,.lake-label')].filter(el=>el.getClientRects().length).map(el=>el.getBoundingClientRect());
  const key=[this.featureEpoch,this.regions.revision,this.viewportKey(),this.lang,root.left,root.top,...boxes.flatMap(b=>[b.left,b.top,b.right,b.bottom])].join(':');
  return {box,root,boxes,key,local:this.map.getZoom()>=8};
 }
 refreshLabels(recoveryAttempt=0){
  if(this.dead||!this.eligible||!this.active||this.loading||!this.atlas.showLabels||!this.anchor){this.clearLabels();return;}
  // Keep the currently drawn labels available to other point-layer collision
  // tests while exact anchors for the next view are computed in small slices.
  this.atlas.labelBoxes=this.labelBoxes;
  if(this.map.isMoving()){this.labelScheduler.invalidate('camera-moving');return;}
  const context=this.labelContext(),{key,box,local}=context;
  if(key===this.labelKey||key===this.labelScheduler.getState().pendingKey)return;
  const isCurrent=()=>!this.dead&&this.eligible&&this.active&&!this.loading&&this.atlas.showLabels&&!this.map.isMoving()&&key===this.labelContext().key;
  const candidates=!local&&this.regions.ready?this.regions.features:this.features;
  const request=this.labelScheduler.request({key,box:box[0]<box[2]?box:null,
   features:candidates.filter(f=>f.properties.TYPE!==8&&(local||f.properties.ADM1&&f.properties.ADM1!=='XX'&&!f.properties.ADM1.includes(';'))),isCurrent,
   onReady:(ranked,{stats})=>{if(!isCurrent())return;this.labelJobStats=stats;this.placeLabels(ranked,context);},
   onError:error=>{this.labelError=String(error?.message||error);}});
  this.labelJob=request;this.labelJobStats=request.stats;
  // Collision boxes may settle after the map's last idle (for example when
  // first-view lake/event labels appear). Recover the current canceled job from
  // that latest context without polling or waiting for another camera event.
  if(request.status==='pending')request.promise.then(()=>{
   if(request!==this.labelJob||request.stats.cancelReason!=='context-changed'||recoveryAttempt>=3)return;
   if(this.dead||!this.eligible||!this.active||this.loading||!this.atlas.showLabels||!this.anchor||this.map.isMoving())return;
   this.refreshLabels(recoveryAttempt+1);
  });
  if(request.status==='ready'&&isCurrent())this.placeLabels(request.ranked,context);
 }
 placeLabels(ranked,{key,root,boxes,local}){
  this.removeLabels();this.labelKey=key;
  const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top,names=new Set();
  for(const {f,anchor}of ranked){
   if(this.markers.length>=12)break;const p=f.properties,name=local||p.ADM1==='XX'?halcName(p,this.labels,this.lang):halcMembership(p.ADM1,'ADM1',this.labels,this.lang);if(!name||names.has(name))continue;
   const english=local?halcName(p,this.labels,'en'):halcMembership(p.ADM1,'ADM1',this.labels,'en'),bilingual=this.lang==='bi'&&english!==name;
   const point=this.map.project(anchor.coordinate),w=Math.min(190,Math.max(80,name.length*12+16,bilingual?english.length*6+16:0)),height=bilingual?44:32,r={left:root.left+point.x-w/2,right:root.left+point.x+w/2,top:root.top+point.y-height/2,bottom:root.top+point.y+height/2};
   if(r.left<root.left+12||r.right>root.right-12||r.top<root.top+85||r.bottom>root.bottom-75||boxes.some(b=>overlaps(r,b)))continue;
   const el=make('button',name,'regional-label halc-label');el.setAttribute('aria-label',name);if(bilingual)el.append(make('span',english));el.style.maxWidth=w+'px';el.title=local?t(this.lang,'查看地方单元：','Read local unit: ')+p.NAME:t(this.lang,'浏览这一归属下的地方单元','Browse local units with this attribution');el.onclick=e=>{e.stopPropagation();if(local)this.openRecord(p.fid,{lng:anchor.coordinate[0],lat:anchor.coordinate[1]});else this.openGroup(p.ADM1);};
   this.markers.push(new maplibregl.Marker({element:el,opacityWhenCovered:'0'}).setLngLat(anchor.coordinate).addTo(this.map));boxes.push(r);names.add(name);
  }
  this.labelBoxes=boxes;this.atlas.labelBoxes=boxes;this.atlas.places?.refresh();
 }
 // Stable source fids identify every clipped tile fragment of one locality.
 // Only this owned feature-state key changes; selection never reparses a tile.
 highlight(id){
  if(this.highlightedId===id)return;
  if(this.map.getSource(HALC_SOURCE)){if(this.highlightedId)this.map.removeFeatureState(selectionTarget(this.highlightedId),'halcSelected');if(id)this.map.setFeatureState(selectionTarget(id),{halcSelected:true});}
  this.highlightedId=id;
 }
 clearSelection(){
  ++this.seq;this.pendingId=null;const id=this.selectedId;this.selectedId=null;const popup=this.popup;this.popup=null;if(popup)popup.remove();
  this.highlight(null);if(id)this.atlas.onBoundarySelection?.(null,'halc:'+id);
 }
 restore(value){const id=fid(String(value).replace(/^halc:/,''));if(id&&this.eligible){this.pendingId=id;this.update();}}
 async openRecord(value,point=this.map.getCenter()){
  const id=fid(value);if(!id||!this.eligible||!this.active)return;
  this.owner.closePopup();const token=++this.seq,node=make('section'),feature=this.features.find(f=>+f.properties.fid===id);
  node.append(make('small','HALC · 1500','historical-eyebrow'),make('h3',feature?halcName(feature.properties,this.labels,this.lang):'HALC '+id),make('p',t(this.lang,'正在读取这条地方记录…','Loading this local record…')));this.owner.popupAt(node,point);const popup=this.owner.popup;this.popup=popup;this.selectedId=id;this.highlight(id);this.atlas.onBoundarySelection?.('halc:'+id);
  popup.getElement().classList.add('halc-popup');popup.on('close',()=>{if(this.popup===popup)this.clearSelection();});
  try{
   const [shard,bibliography]=await Promise.all([this.load(ROOT+'details/shard-'+String(Math.floor(id/256)).padStart(3,'0')+'.json.gz'),this.load(ROOT+'metadata/bibliography.json').catch(()=>({}))]);
   if(this.dead||!this.eligible||token!==this.seq||this.popup!==popup)return;const record=shard.records[String(id)];if(!record)throw Error('Record not in archive');this.renderRecord(node,record,bibliography);
  }catch{
   if(this.dead||!this.eligible||token!==this.seq||this.popup!==popup)return;node.replaceChildren(make('h3',t(this.lang,'地方记录暂未载入','Local record unavailable')),make('p',t(this.lang,'地图已保留，可重新读取档案。','The map remains available. Retry the record.')));const retry=make('button',t(this.lang,'重新读取','Retry'),'regional-retry');retry.onclick=()=>this.openRecord(id,point);node.append(retry);
  }
 }
 renderRecord(node,r,bibliography){
  const lang=this.lang,dict=this.labels,translate=(zh,en)=>t(lang,zh,en);node.replaceChildren(make('small','HALC v15 · 1500','historical-eyebrow'),make('h3',halcName(r,dict,lang)));
  if(lang==='bi'&&halcName(r,dict,lang)!==r.NAME)node.append(make('p',r.NAME));node.append(make('p',r.SHORT_ID+' · '+translate('地方单元','Local unit'),'historical-credit'));
  const tabs=make('div',null,'halc-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label',translate('地方档案栏目','Local record sections'));const panel=make('div',null,'halc-record-body');panel.setAttribute('role','tabpanel');panel.tabIndex=0;panel.id='halc-panel-'+this.atlas.container+'-'+r.fid;
  const row=(dl,zh,en,value)=>{if(value!==null&&value!==undefined&&value!=='')dl.append(make('dt',translate(zh,en)),make('dd',String(value)));};
  const link=(parent,title,url)=>{if(!/^https?:\/\//.test(url))return;const a=make('a',title);a.href=url;a.target='_blank';a.rel='noopener noreferrer';parent.append(a);};
  const show=kind=>{
   for(const b of tabs.children){const active=b.dataset.tab===kind;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;if(active)panel.setAttribute('aria-labelledby',b.id);}panel.replaceChildren();panel.scrollTop=0;
   if(kind==='record'){
    const dl=make('dl');row(dl,'资料年份','Snapshot year','1500');row(dl,'原始地名','Source place name',r.NAME);row(dl,'最高层级归属','Highest-level attribution',halcMembership(r.ADM0,'ADM0',dict,lang));row(dl,'领地区域','Territorial region',halcMembership(r.ADM1,'ADM1',dict,lang));row(dl,'区划性质','Unit type',label(dict.TYPE[String(r.TYPE)],lang));row(dl,'图形面积','Polygon area',Number.isFinite(r.KM2)?new Intl.NumberFormat(lang==='en'?'en':'zh-CN',{maximumFractionDigits:4}).format(r.KM2)+' km²':null);row(dl,'高等司法权','High jurisdiction',r.HIGH_JURISD);row(dl,'中等司法权','Middle jurisdiction',r.MID_JURISD);row(dl,'低等司法权','Low jurisdiction',r.LOW_JURISD);row(dl,'总教区','Archdiocese',r.ARCH_DIOC);row(dl,'教区','Diocese',r.DIOCESE);row(dl,'别名','Alternative names',r.NAME_ALT);row(dl,'原始备注','Source remarks',r.REMARKS);panel.append(dl);
    if(r.NAME_EXT){const note=make('details');note.append(make('summary',translate('原始细分说明','Source subdivision note')),make('p',r.NAME_EXT),make('p',label(dict.ui.nameExtCaption,lang),'historical-credit'));panel.append(note);}
   }else if(kind==='environment'){
    renderHalcLandscape(panel,r,lang);
   }else if(kind==='sources'){
    panel.append(make('h4',translate('边界重建依据','Boundary reconstruction basis')),make('p',label(dict.QUALITY[String(r.QUALITY)],lang)||String(r.QUALITY)));
    const list=make('ul',null,'halc-citations');for(const code of String(r.SOURCE||'').split(';').filter(Boolean)){const entry=bibliography[code],item=make('li');item.append(make('p',entry?.citation||code));for(const [i,url]of (entry?.urls||[]).entries())link(item,translate('查阅','Open')+(i?' '+(i+1):''),url);list.append(item);}if(!r.SOURCE)panel.append(make('p',label(dict.ui.noSource,lang)));else panel.append(list);
    const notes=make('details');notes.append(make('summary',label(dict.ui.sourceNoteTitle,lang)),make('p',label(dict.ui.sourceNote,lang)));panel.append(notes);
    const links=make('div',null,'historical-source-links');link(links,translate('数据集与代码本','Dataset & codebook'),SOURCE_URL);link(links,translate('重建方法','Reconstruction methods'),'https://doi.org/10.1163/24523666-bja10033');link(links,'CC BY-SA 4.0','https://creativecommons.org/licenses/by-sa/4.0/');panel.append(links,make('p','Rombert Stapel · HALC v15','historical-credit'));
   }else{
    panel.append(make('p',translate('以下字段保留原文及原有层级，其中包含后期统计对照。','Fields retain the source wording and levels, including later statistical cross-references.')));const dl=make('dl',null,'halc-raw');for(const [key,value]of Object.entries(r))dl.append(make('dt',key),make('dd',value==null?'—':String(value)));panel.append(dl);
    const download=make('button',translate('下载原始字段','Download original attributes'),'regional-dossier');download.onclick=()=>{const content={dataset:'HALC v15',source:SOURCE_URL,license:'CC BY-SA 4.0',snapshotYear:1500,record:r},url=URL.createObjectURL(new Blob([JSON.stringify(content,null,2)],{type:'application/json'})),a=make('a');a.href=url;a.download='HALC-1500-'+r.SHORT_ID+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};panel.append(download);const links=make('div',null,'historical-source-links');link(links,translate('完整原始几何','Complete source geometry'),'https://dataverse.nl/api/access/datafile/639014');panel.append(links);
   }
  };
  for(const [key,zh,en]of [['record','区划资料','Record'],['environment','地理环境','Environment'],['sources','来源依据','Sources'],['raw','原始字段','Original fields']]){const b=make('button',translate(zh,en));b.dataset.tab=key;b.id='halc-tab-'+this.atlas.container+'-'+r.fid+'-'+key;b.setAttribute('role','tab');b.setAttribute('aria-controls',panel.id);b.onclick=()=>show(key);b.onkeydown=e=>{const buttons=[...tabs.children],i=buttons.indexOf(b);let target;if(e.key==='ArrowRight')target=buttons[(i+1)%buttons.length];if(e.key==='ArrowLeft')target=buttons[(i+buttons.length-1)%buttons.length];if(e.key==='Home')target=buttons[0];if(e.key==='End')target=buttons.at(-1);if(target){e.preventDefault();e.stopPropagation();target.click();target.focus();}};tabs.append(b);}node.append(tabs,panel);show('record');
 }
 retryRegions(){this.regions.retry();this.regions.ensure();this.visibilityKey=null;this.visibility();this.refreshLabels();this.notify();}
 retry(){this.clearSelection();this.regions.retry();this.failed=false;this.lastError=null;this.visibilityKey=null;this.scanKey=null;this.sourceEpoch++;this.seenContent=false;this.renderedKey=null;for(const id of [...HALC_LAYERS].reverse())if(this.map.getLayer(id))this.map.removeLayer(id);if(this.map.getSource(HALC_SOURCE))this.map.removeSource(HALC_SOURCE);this.setActive(false);this.update();}
 destroy(){this.dead=true;this.labelScheduler.destroy();this.renderPending=false;this.renderedKey=null;this.landscape.destroy();this.regions.destroy();this.clearSelection();this.clearLabels();for(const [event,fn]of this.listeners)this.map.off(event,fn);}
}
