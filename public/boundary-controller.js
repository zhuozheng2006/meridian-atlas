import {countrySnapshot,loadCountryFrame,countryFeatures,countryAlias,countryName,countryStatus,countryVisible} from './country-archive.js?v=3.10.0-7f761edc12c7';
import {interiorPoint} from './regional-boundaries.js?v=3.10.0-7f761edc12c7';
import {boundaryPaint,boundaryHaloPaint,territoryOpacity} from './boundary-style.js?v=3.10.0-7f761edc12c7';

const tr=(lang,zh,en)=>lang==='en'?en:zh;
const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;};
export class BoundaryController{
 constructor(atlas,{mode='auto',color,loadCountry=loadCountryFrame}={}){this.atlas=atlas;this.mode=mode;this.color=color;this.loadCountry=loadCountry;this.generation=0;this.current=null;this.loading=false;this.reason=null;}
 async prepare(year,loadOverview){
  const requested=this.mode;
  if(requested==='cshapes'){
   if(countrySnapshot(year)){try{const frame=await this.loadCountry(year),features=countryFeatures(frame,this.color);return {requested,source:'cshapes',year,frame,records:frame.records,data:{type:'FeatureCollection',features},key:'cshapes:'+frame.date,reason:null};}catch(e){return {...await loadOverview(),requested,reason:'error',error:String(e.message||e)};}}
   return {...await loadOverview(),requested,reason:'unsupported'};
  }
  return {...await loadOverview(),requested,reason:null};
 }
 commit(frame){
  ++this.generation;this.current=frame;this.loading=false;this.reason=frame.reason;this.atlas.geometryKey=frame.key;this.recordMap=new Map(frame.records.map(r=>[r.id,r]));
  this.atlas.displayTerritories(frame.data);this.applyVisibility(!!this.atlas.regional?.detailedActive);
  this.atlas.map.getContainer?.()?.dispatchEvent(new CustomEvent('geometry-status',{bubbles:true}));
 }
 applyVisibility(regional){
  const map=this.atlas.map;
  for(const [id,p]of [['territories','fill-opacity'],['boundary','line-opacity'],['boundary-halo','line-opacity'],['selection','line-opacity'],['selection-fill','fill-opacity']])map.setPaintProperty(id,p+'-transition',{duration:0,delay:0});
  map.setPaintProperty('territories','fill-opacity',regional?0:territoryOpacity);
  for(const [property,value]of Object.entries(boundaryPaint(this.current?.source)))map.setPaintProperty('boundary',property,regional&&property==='line-opacity'?0:value);
  for(const [property,value]of Object.entries(boundaryHaloPaint(this.current?.source)))map.setPaintProperty('boundary-halo',property,regional&&property==='line-opacity'?0:value);
  map.setPaintProperty('selection','line-opacity',regional?0:1);map.setPaintProperty('selection-fill','fill-opacity',regional?0:.08);
 }
 async setMode(mode){
  this.mode=mode;const token=++this.generation,year=this.atlas.year,request=this.atlas.request;
  if(!this.atlas.catalog)return;this.loading=true;this.atlas.regional?.setStatus('loading');
  try{const frame=await this.prepare(year,()=>this.atlas.prepareOverview(year));if(this.atlas.destroyed||token!==this.generation||year!==this.atlas.year||request!==this.atlas.request||mode!==this.mode)return;
   this.commit(frame);this.atlas.regional?.update();this.atlas.refreshLabels();this.atlas.upgradeDetail();
  }catch(e){if(token===this.generation&&!this.atlas.destroyed){this.loading=false;this.reason='error';this.atlas.regional?.setStatus('error');}}
 }
 title(lang){
  if(this.loading)return tr(lang,'正在读取国家边界…','Loading country boundaries…');
  if(this.mode==='cshapes'&&this.reason==='unsupported')return tr(lang,'全球疆域 · CShapes 未覆盖此年','Global overview · year outside CShapes');
  if(this.mode==='cshapes'&&this.reason==='error')return this.isCountry?tr(lang,'保留已载入国家边界 · 更新失败','Loaded country boundaries · update failed'):tr(lang,'全球疆域 · CShapes 暂不可用','Global overview · CShapes unavailable');
  if(this.current?.source==='cshapes')return `CShapes · ${this.current.records.length} `+tr(lang,'个国家与属地','states & territories');
  return tr(lang,'全球疆域 · Cliopatria','Global overview · Cliopatria');
 }
 get isCountry(){return this.current?.source==='cshapes';}
 labelRecords(){
  if(!this.isCountry)return this.atlas.active;const b=this.atlas.map.getBounds(),box=[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()];
  return this.current.records.map(r=>({...r,name:countryName(r,'en',this.current.frame.date),zhName:countryName(r,'zh',this.current.frame.date),labelCenter:interiorPoint(this.current.frame.geometries[r.geometryId],box[0]<box[2]?box:null)||r.center})).sort((a,b)=>b.area-a.area);
 }
 indexFeatures(){
  return this.isCountry?this.current.data.features:[];
 }
 openRecord(id,point=this.atlas.map.getCenter()){
  if(!this.isCountry)return;const r=this.recordMap.get(id),frame=this.current.frame;if(!r||!countryVisible(r,frame.date))return;
  const regional=this.atlas.regional,lang=this.atlas.lang,node=make('section');regional.closePopup();
  node.append(make('small',`CShapes ${frame.catalog.version} · ${frame.catalog.coding}`,'historical-eyebrow'),make('h3',countryName(r,lang,frame.date)));
  if(lang==='bi'&&r.zhName)node.append(make('p',countryName(r,'en',frame.date)));
  const rulers=frame.records.filter(x=>x.code===r.ruledby&&x.status==='independent'),ruler=rulers.length===1?countryName(rulers[0],lang,frame.date):String(r.ruledby??'—');
  const alias=countryAlias(r,frame.date),dl=make('dl');if(alias)dl.append(make('dt',tr(lang,'档案原名','Source name')),make('dd',r.name));for(const [zh,en,value]of [['记录开始','Record begins',r.startDate],['记录结束','Record ends',r.endDate],['资料分类','Source classification',countryStatus(r.status,lang)],['首都／行政中心','Capital / administrative centre',r.capital||'—'],['统治归属','Recorded ruler',ruler],['来源面积','Source area',new Intl.NumberFormat(lang==='en'?'en':'zh-CN',{maximumFractionDigits:0}).format(r.area)+' km²']])dl.append(make('dt',tr(lang,zh,en)),make('dd',value));node.append(dl);
  const periods=frame.catalog.records.filter(x=>x.code===r.code).sort((a,b)=>a.startDate.localeCompare(b.startDate));
  const details=make('details'),summary=make('summary',tr(lang,`同一来源代码的 ${periods.length} 段记录`,` ${periods.length} periods under this source code`));details.append(summary);
  const list=make('div',null,'country-periods');for(const p of periods){const row=make('p',p.startDate+' — '+p.endDate+' · '+countryStatus(p.status,lang));if(p.id===r.id)row.className='current';list.append(row);}details.append(list);node.append(details);
  const links=make('div',null,'historical-source-links');for(const [label,url]of [[tr(lang,'资料与收录口径','Dataset & coding'),'https://icr.ethz.ch/data/cshapes/beta.html'],['CC BY-NC-SA 4.0','https://creativecommons.org/licenses/by-nc-sa/4.0/']]){const a=make('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);}node.append(links);
  if(alias){const a=make('a',tr(lang,'名称年代与依据','Name periods & evidence'));a.href='data/cshapes/name-periods.json';a.target='_blank';a.rel='noopener noreferrer';links.append(a);}
  const download=make('button',tr(lang,'下载这条边界记录','Download this boundary record'),'regional-dossier');download.onclick=()=>{const content={source:'CShapes 2.1 beta',coding:frame.catalog.coding,license:'CC BY-NC-SA 4.0',licenseURL:'https://creativecommons.org/licenses/by-nc-sa/4.0/',citation:'Schvitz, Guy, Seraina Rüegger, Luc Girardin, Lars-Erik Cederman, Nils Weidmann, and Kristian Skrede Gleditsch (2022). Mapping The International System, 1886–2017: The CShapes 2.0 Dataset. Journal of Conflict Resolution 66(1), 144–161.',modifications:'Exact source geometry values retained; dates indexed from source integer fields; representative label anchors, Simplified Chinese translations and date-aware display aliases added.',sourceURL:'https://icr.ethz.ch/data/cshapes/beta.html',display:{date:frame.date,name:countryName(r,'en',frame.date),zhName:countryName(r,'zh',frame.date),sources:alias?.sourceURLs||[]},record:r,geometry:frame.geometries[r.geometryId]},url=URL.createObjectURL(new Blob([JSON.stringify(content,null,2)],{type:'application/json'})),a=make('a');a.href=url;a.download=r.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};node.append(download,make('p',r.id+' · '+tr(lang,'所选年年中','Midyear snapshot')+' '+frame.date,'historical-credit'));
  regional.popupAt(node,point);this.atlas.selectBoundary(id);const popup=regional.popup;this.atlas.onBoundarySelection?.(id);
  this.selectedPopup=popup;this.selectedId=id;
  popup.on('close',()=>{if(this.selectedPopup!==popup)return;this.selectedPopup=null;this.selectedId=null;this.atlas.selectBoundary(null);this.atlas.onBoundarySelection?.(null,id);});
 }
 destroy(){++this.generation;}
}
