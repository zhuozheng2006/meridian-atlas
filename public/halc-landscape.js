import {HALC_LANDSCAPE_CLASSES} from './halc-landscape-reader.js?v=3.10.0-a8894d6d31c3';
import {forgetJSON} from './map-engine.js?v=3.10.0-a8894d6d31c3';

export const LANDSCAPE_SOURCE='halc-landscape';
export const LANDSCAPE_BOUNDS=[-.2635517291765086,47.49069922359204,8.90256801566143,54.129438097120065];
const ROOT='data/halc-landscape/',EMPTY={type:'FeatureCollection',features:[]};
const classes=new Map(HALC_LANDSCAPE_CLASSES.map(c=>[c.code,c]));
const t=(lang,zh,en)=>lang==='en'?en:zh;
const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
export function landscapeIntersects(a,b){
 if(!a||!b||a[3]<b[1]||a[1]>b[3])return false;
 let east=b[2];while(east<b[0])east+=360;if(east-b[0]>=360)return true;
 const shift=Math.floor((b[0]-a[0])/360)*360;return [shift,shift+360].some(s=>a[0]+s<=east&&a[2]+s>=b[0]);
}
const viewport=map=>{const b=map.getBounds();return [b.getWest(),b.getSouth(),b.getEast(),b.getNorth()];};
export function landscapeEligibility({mode,year,borders,modern,terrain,zoom,bounds,destroyed}){
 return !destroyed&&mode==='halc'&&year===1500&&borders&&!modern&&terrain!==false&&zoom>=6&&landscapeIntersects(LANDSCAPE_BOUNDS,bounds);
}
export function selectLandscapeShards(index,bounds){return index.shards.filter(s=>landscapeIntersects(s.bbox,bounds)&&s.features.some(f=>landscapeIntersects(f.bbox,bounds)));}
export class LandscapeCache{
 constructor(load){this.load=load;this.entries=new Map();}
 forget(file){this.entries.delete(file);forgetJSON(ROOT+file);}
 get(file){if(!this.entries.has(file)){const p=this.load(ROOT+file).catch(e=>{if(this.entries.get(file)===p)this.entries.delete(file);throw e;});this.entries.set(file,p);}return this.entries.get(file);}
}
const caches=new WeakMap();
// Keep the original order so temporary historical geography does not change
// modern/reference rendering after the reader leaves the 1500 snapshot.
export function mergeLandscapeOrder(base,current){
 const result=base.filter(id=>current.includes(id));
 for(let i=0;i<current.length;i++){const id=current[i];if(result.includes(id))continue;const next=current.slice(i+1).find(n=>result.includes(n));result.splice(next?result.indexOf(next):result.length,0,id);}return result;
}
export class HalcLandscape{
 constructor(parent,{load=parent.load}={}){
  this.parent=parent;this.owner=parent.owner;this.atlas=parent.atlas;this.map=parent.map;this.seq=0;this.revision=0;this.features=[];this.status='off';this.active=false;this.failed=false;this.dead=false;this.listeners=[];
  if(!caches.has(load))caches.set(load,new LandscapeCache(load));this.cache=caches.get(load);
  this.button=make('button',null,'regional-landscape');this.button.hidden=true;this.button.onclick=()=>this.openGuide();this.owner.controls?.append(this.button);
  const on=(event,fn)=>{this.map.on(event,fn);this.listeners.push([event,fn]);};
  on('idle',()=>{this.settle();if(this.labelRefreshPending){this.labelRefreshPending=false;this.revision++;this.report();}});
  on('sourcedata',e=>{if(e.sourceId===LANDSCAPE_SOURCE&&e.isSourceLoaded)this.settle();});
  on('error',e=>{if(e.sourceId===LANDSCAPE_SOURCE&&!this.dead)this.fail();});
 }
 get lang(){return this.owner.lang;}
 get eligible(){if(this.dead||this.atlas.destroyed||this.owner.mode!=='halc'||this.owner.year!==1500)return false;return landscapeEligibility({mode:this.owner.mode,year:this.owner.year,borders:this.atlas.showBorders,modern:this.owner.modern||this.atlas.geography?.reference,terrain:this.atlas.geography?.enabled,zoom:this.map.getZoom(),bounds:viewport(this.map),destroyed:false});}
 ensure(){
  if(this.map.getSource(LANDSCAPE_SOURCE))return;
  this.map.addSource(LANDSCAPE_SOURCE,{type:'geojson',data:EMPTY,tolerance:0,maxzoom:14,attribution:'Rombert Stapel · <a href="https://doi.org/10.34894/BTKFHV" target="_blank" rel="noopener">HALC v15 · Landscape 1500</a> · CC BY-SA 4.0'});
  const colors=['match',['get','LANDSCAPE'],0,'#c2c4a2',1,'#d3bd82',2,'#93aaa0',3,'#8d9e7b',4,'#a997a2',7,'#86acb7',8,'#588b9f',9,'#3c6f8b','#c2c4a2'];
  this.map.addLayer({id:LANDSCAPE_SOURCE,type:'fill',source:LANDSCAPE_SOURCE,minzoom:6,layout:{visibility:'none'},paint:{'fill-color':colors,'fill-opacity':1,'fill-antialias':true}});
 }
 report(){
  this.button.hidden=!this.eligible;this.button.textContent=t(this.lang,this.failed?'地貌未载入':this.status==='loading'?'地貌载入中…':'地貌 · 1500',this.failed?'Landscape unavailable':this.status==='loading'?'Loading landscape…':'Landscape · 1500');
  this.button.setAttribute('aria-label',t(this.lang,'查看1500年地貌图例与来源','Read the 1500 landscape legend and sources'));
  this.atlas.geography?.lakes?.refreshLabels();
  const key=[this.eligible,this.active,this.status,this.failed,this.lang].join(':');if(key!==this.reportKey){this.reportKey=key;this.map.getContainer?.()?.dispatchEvent?.(new CustomEvent('regional-status',{bubbles:true}));}
 }
 reconcileOrder(){
  const map=this.map;if(this.dead||!map.getLayer(LANDSCAPE_SOURCE))return;
  const layers=map.getStyle().layers,current=layers.map(l=>l.id),without=current.filter(id=>id!==LANDSCAPE_SOURCE);
  if(!this.active||!this.eligible){if(this.baseOrder){this.baseOrder=mergeLandscapeOrder(this.baseOrder,without);this.applyOrder([...this.baseOrder,LANDSCAPE_SOURCE]);this.baseOrder=null;}return;}
  this.baseOrder=mergeLandscapeOrder(this.baseOrder||without,without);
  const details=new Set(layers.filter(l=>['halc-boundaries','halc-regions','historical-detail'].includes(l.source)).map(l=>l.id));
  this.applyOrder([...this.baseOrder.filter(id=>!details.has(id)),LANDSCAPE_SOURCE,...this.baseOrder.filter(id=>details.has(id))]);
 }
 applyOrder(order){
  let current=this.map.getStyle().layers.map(l=>l.id);
  for(let i=order.length-1;i>=0;i--){const id=order[i],next=order[i+1],at=current.indexOf(id);if(at<0)continue;if((next&&current[at+1]===next)||(!next&&at===current.length-1))continue;this.map.moveLayer(id,next);current.splice(at,1);current.splice(next?current.indexOf(next):current.length,0,id);}
 }
 visibility(){
  const visible=this.eligible&&this.active&&!this.failed;
  if(this.map.getLayer(LANDSCAPE_SOURCE)&&this.visible!==visible){this.map.setLayoutProperty(LANDSCAPE_SOURCE,'visibility',visible?'visible':'none');this.visible=visible;this.revision++;}
  this.reconcileOrder();this.report();
 }
 fail(){++this.seq;this.failed=true;this.active=false;this.pending=null;this.features=[];this.requestKey=null;this.status='error';this.visibility();}
 async update(){
  if(this.dead)return;
  if(!this.eligible){++this.seq;this.pending=null;this.requestKey=null;this.active=false;this.features=[];this.status='off';this.visibility();return;}
  if(this.failed){this.visibility();return;}
  const bounds=viewport(this.map);let east=bounds[2];while(east<bounds[0])east+=360;const dx=(east-bounds[0])*.2,dy=(bounds[3]-bounds[1])*.2,padded=[bounds[0]-dx,bounds[1]-dy,east+dx,bounds[3]+dy];
  const key=bounds.join(':');if(key===this.requestKey){this.visibility();return;}this.requestKey=key;
  const seq=++this.seq,current=()=>!this.dead&&!this.atlas.destroyed&&seq===this.seq&&this.eligible;
  this.status=this.active?'updating':'loading';this.report();
  try{
   const index=await this.cache.get('index.json.gz');if(!current())return;
   if(index.schemaVersion!==1||index.snapshotYear!==1500||!Array.isArray(index.shards)){this.cache.forget('index.json.gz');throw Error('Invalid landscape snapshot');}
   const shards=selectLandscapeShards(index,padded),features=[];let cursor=0;
   const outcomes=await Promise.allSettled(Array.from({length:Math.min(3,shards.length)},async()=>{while(cursor<shards.length&&current()){
    const s=shards[cursor++],data=await this.cache.get(s.file);if(!current())return;
    if(data.type!=='FeatureCollection'||!Array.isArray(data.features)||data.features.length!==s.count){this.cache.forget(s.file);throw Error('Invalid landscape shard');}
    const ids=new Set(s.features.filter(f=>landscapeIntersects(f.bbox,padded)).map(f=>f.id));
    for(const f of data.features){if(!classes.has(f.properties?.LANDSCAPE)){this.cache.forget(s.file);throw Error('Unknown landscape class');}if(ids.has(f.id))features.push(f);}
   }}));
   if(!current())return;if(outcomes.some(r=>r.status==='rejected'))throw Error('Landscape load failed');
   features.sort((a,b)=>a.id-b.id);this.ensure();this.pending={seq,features};this.status=this.active?'updating':'rendering';this.map.getSource(LANDSCAPE_SOURCE).setData({type:'FeatureCollection',features});this.report();
  }catch{if(current())this.fail();}
 }
 settle(){
  if(this.dead||!this.eligible||this.failed||!this.pending||this.pending.seq!==this.seq||!this.map.isSourceLoaded(LANDSCAPE_SOURCE))return;
  this.features=this.pending.features;this.pending=null;this.active=!!this.features.length;this.status=this.active?'ready':'empty';this.revision++;this.labelRefreshPending=true;this.visibility();
 }
 covers(coordinate){
  if(!this.eligible||!this.active||this.failed)return false;
  const point=this.map.project(coordinate);return this.map.queryRenderedFeatures(point,{layers:[LANDSCAPE_SOURCE]}).length>0;
 }
 hit(point){return this.eligible&&this.active&&!this.failed?this.map.queryRenderedFeatures(point,{layers:[LANDSCAPE_SOURCE]})[0]||null:null;}
 openGuide(){
  const lang=this.lang,node=make('section'),owner=this.owner;owner.closePopup();
  node.append(make('small','HALC v15 · 1500','historical-eyebrow'),make('h3',t(lang,'水陆之间','Land & water')),make('p',t(lang,'1500年地貌重建','Landscape reconstruction · 1500'),'historical-credit'));
  if(this.failed){node.append(make('p',t(lang,'地貌暂未载入，地图保留现有地理底图。地方区划仍可阅读。','Landscape is unavailable; the existing geographic base remains. Local boundary records are still available.')));const retry=make('button',t(lang,'重新载入地貌','Retry landscape'),'regional-retry');retry.onclick=()=>{owner.closePopup();this.retry();};node.append(retry);}
  else if(!this.active)node.append(make('p',t(lang,'正在读取当前视野的地貌资料。','Loading landscape records for this view.')));
  const legend=make('div',null,'landscape-legend');
  for(const c of HALC_LANDSCAPE_CLASSES){const item=make('div'),swatch=make('i');swatch.style.background=c.code===0?'#c2c4a2':c.code===3?'#8d9e7b':c.color;const label=make('span',t(lang,c.zh,c.en));if(lang==='bi')label.append(make('small',c.en));item.append(swatch,label);legend.append(item);}node.append(legend);
  if(this.active){const center=this.map.getCenter(),hits=this.map.queryRenderedFeatures(this.map.project(center),{layers:[LANDSCAPE_SOURCE]}),ids=new Set(hits.map(f=>f.id??f.properties.fid)),records=this.features.filter(f=>ids.has(f.id));
   node.append(make('h4',t(lang,'地图中心的地貌','Landscape at map centre')));
   if(!records.length)node.append(make('p',t(lang,'这一点没有收录地貌面，保留现代地理参照。','This point has no landscape polygon; contemporary geography remains.')));
   for(const f of records){const p=f.properties,c=classes.get(p.LANDSCAPE),details=make('details');details.append(make('summary',t(lang,c.zh,c.en)+' · '+p.fid));const dl=make('dl');for(const [name,value]of [[t(lang,'条目日期','Record dates'),p.TIME_START&&p.TIME_END?p.TIME_START+' — '+p.TIME_END:t(lang,'1500年横截面收录；条目日期未填','Included in the 1500 snapshot; record dates unfilled')],[t(lang,'重建依据','Reconstruction basis'),this.parent.labels?.QUALITY?.[String(p.QUALITY)]?.[lang==='en'?'en':'zh']||t(lang,'原条目未填写','Not recorded in this entry')],[t(lang,'书目编号','Bibliography codes'),p.SOURCE||'—'],[t(lang,'原始备注','Source remarks'),p.REMARKS||'—']])dl.append(make('dt',name),make('dd',value));details.append(dl);node.append(details);}
  }
  const note=make('details');note.append(make('summary',t(lang,'来源与地图说明','Sources & map notes')),make('p',t(lang,'地貌面保留原始坐标、分类与重叠记录，仅用于1500年。覆盖区以外沿用现代地理参照；山地高程来自现代测量。地方档案的分类面积与本图层分别保留各自记录。','Landscape polygons retain source coordinates, classes and overlaps and appear only in 1500. Outside their coverage the map uses contemporary geography; elevation is contemporary. Local area statistics and these polygons retain their separate source records.')));const link=make('a','Rombert Stapel · HALC v15 · CC BY-SA 4.0 ↗');link.href='https://doi.org/10.34894/BTKFHV';link.target='_blank';link.rel='noopener noreferrer';note.append(link);node.append(note);owner.popupAt(node,this.map.getCenter(),true);owner.popup?.getElement().classList.add('halc-popup');
 }
 retry(){if(this.dead||this.atlas.destroyed)return;this.failed=false;this.requestKey=null;this.active=false;this.pending=null;this.visibility();if(this.map.getLayer(LANDSCAPE_SOURCE))this.map.removeLayer(LANDSCAPE_SOURCE);if(this.map.getSource(LANDSCAPE_SOURCE))this.map.removeSource(LANDSCAPE_SOURCE);this.visible=null;this.update();}
 destroy(){this.dead=true;++this.seq;this.active=false;this.pending=null;for(const [event,fn]of this.listeners)this.map.off(event,fn);this.button.remove();}
}
