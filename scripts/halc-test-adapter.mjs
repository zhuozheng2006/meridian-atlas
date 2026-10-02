import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {HalcFakeMap} from './halc-test-map.mjs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

class Node{
 constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.style={setProperty(){}};this.listeners=new Map();this._text='';this.classNames=new Set();this.classList={add:(...names)=>{this.write();names.forEach(name=>this.classNames.add(name));},contains:name=>this.classNames.has(name)};}
 write(){this.map?.recordWrite();}
 set textContent(value){this.write();this._text=String(value);this.children=[];}
 get textContent(){return this._text+this.children.map(x=>x.textContent??String(x)).join('');}
 append(...nodes){this.write();for(const n of nodes){if(n&&typeof n==='object'){n.parentNode=this;n.attach?.(this.map);}this.children.push(n);}}
 replaceChildren(...nodes){this.write();this._text='';this.children=[];this.append(...nodes);}
 attach(map){this.map=map;for(const n of this.children)n.attach?.(map);}
 setAttribute(key,value){this.write();this.attributes[key]=String(value);}
 getAttribute(key){return this.attributes[key];}
 addEventListener(event,fn){this.listeners.set(event,fn);}
 remove(){this.write();this.removed=true;}
 click(){this.onclick?.({stopPropagation(){}});}
 focus(){}
}
class Popup{
 constructor(map,node){this.map=map;this.node=node;this.listeners=new Map();this.removed=false;node.attach(map);}
 getElement(){return this.node;}
 on(event,fn){if(!this.listeners.has(event))this.listeners.set(event,new Set());this.listeners.get(event).add(fn);return this;}
 remove(){if(this.removed)return;this.map.recordWrite();this.removed=true;for(const fn of [...this.listeners.get('close')||[]])fn();}
}
const labels={ADM0:{XX:{zh:'未指定',en:'Unspecified'}},ADM1:{XX:{zh:'小型独立领地',en:'Small sovereign regions'},AA:{zh:'测试领地甲',en:'Territorial fixture A'},BB:{zh:'测试领地乙',en:'Territorial fixture B'}},TYPE:{1:{zh:'地方单元',en:'Local unit'}},QUALITY:{1:{zh:'测试',en:'Fixture'}},ui:{},localityNameLabels:[]};
const records=Object.fromEntries([1,2].map(id=>[id,{fid:id,SHORT_ID:'TEST'+id,NAME:'Test unit '+id,ADM0:'XX',ADM1:'XX',TYPE:1,QUALITY:1,KM2:1,SOURCE:''}]));
const feature=id=>({type:'Feature',properties:records[id],geometry:{type:'Polygon',coordinates:[[[5,51],[5.01,51],[5.01,51.01],[5,51.01],[5,51]]]}});
export async function createActualAdapter(projectRoot){
 const {HalcBoundaries,HALC_SOURCE}=await import(pathToFileURL(resolve(projectRoot,'public/halc-boundaries.js')));
 const {RegionalBoundaries}=await import(pathToFileURL(resolve(projectRoot,'public/regional-boundaries.js')));
 const saved=new Map(['document','location','maplibregl'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
globalThis.document={createElement:tag=>new Node(tag),querySelectorAll:()=>[]};
globalThis.location={href:'https://fixture.invalid/'};
globalThis.maplibregl={Marker:class{constructor({element}){this.element=element;this.removed=false;}setLngLat(p){this.point=p;return this;}addTo(map){this.map=map;return this;}remove(){this.removed=true;}}};
 const restoreGlobals=()=>{for(const [key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}};
 async function createHarness(initial){
 const map=new HalcFakeMap(initial);let detailRequests=0,metadataRequests=0,overviewHidden=false,disposed=false;const gates=[];
 map.getContainer=()=>({clientWidth:1200,clientHeight:800,getBoundingClientRect:()=>({left:0,top:0,right:1200,bottom:800,width:1200,height:800})});map.project=p=>({x:400+(p[0]-5)*5000,y:350});
 const owner={mode:initial.mode,year:initial.year,modern:initial.modern,lang:'en',map,status:'initial',popup:null,active:false,
  setStatus(s){map.recordWrite();this.status=s;},get detailedActive(){return this.active||!!this.halc?.active;},
  closePopup(){this.halc?.clearSelection();const old=this.popup;this.popup=null;old?.remove();},
  popupAt(node){map.recordWrite();this.popup=new Popup(map,node);},openIndex(options){map.recordWrite();this.lastIndex=options;}
 };
 const atlas={map,showBorders:initial.borders,showLabels:false,destroyed:false,container:'fixture',boundaries:{applyVisibility(v){map.recordWrite();overviewHidden=v;}},refreshLabels(){},onBoundarySelection(){map.recordWrite();}};owner.atlas=atlas;
 const load=async url=>{if(url.endsWith('labels.json')){metadataRequests++;return structuredClone(labels);}if(url.endsWith('bibliography.json')){metadataRequests++;return {};}assert(url.includes('details/shard-'),url);detailRequests++;const gate=gates.find(g=>!g.claimed);if(gate){gate.claimed=true;return gate.promise;}return {records:structuredClone(records)};};
 const halc=new HalcBoundaries(owner,{load});owner.halc=halc;halc.update();
 return {
  owner,map,halc,
  set(patch){for(const k of ['mode','year','modern'])if(k in patch)owner[k]=patch[k];if('borders'in patch)atlas.showBorders=patch.borders;if('zoom'in patch)map.zoom=patch.zoom;if('inside'in patch)map.inside=patch.inside;halc.update();},
  async settle(){for(let i=0;i<5;i++)await Promise.resolve();await delay(0);},
  snapshot(){return {mode:owner.mode,active:halc.active,visibleSource:!atlas.showBorders?'none':overviewHidden?'halc':'cliopatria',popupId:halc.popup&&!halc.popup.removed?halc.selectedId:null,selectedId:halc.selectedId??null,reason:halc.reason};},
  requests(){return {tiles:map.tileRequestCount,details:detailRequests,metadata:metadataRequests,mainTiles:map.sourceRequests.get(HALC_SOURCE)||0,groupTiles:map.sourceRequests.get('halc-regions')||0};},
  tilesReady(){map.rendered=[feature(1),feature(2)];map.sourceReady(HALC_SOURCE);},
  tileError(){map.rendered=[feature(1)];map.sourceError(HALC_SOURCE);},
  beginViewportLoad(){map.getSource(HALC_SOURCE).loaded=false;map.rendered=[feature(1)];map.emit('sourcedataloading',{sourceId:HALC_SOURCE,isSourceLoaded:false});halc.update();},
  enableLabels(){map.zoom=8;atlas.showLabels=true;halc.anchor=f=>({coordinate:[5+f.properties.fid*.06,51],score:1});halc.refreshLabels();},
  markerCount(){return halc.markers.filter(m=>!m.removed).length;},
  groupReady(features=[{type:'Feature',properties:{gid:'ADM1-AA',ADM1:'AA',shared:false,memberCount:1},geometry:feature(1).geometry}]){map.renderedByLayer.set('halc-region-query',features);map.sourceReady('halc-regions');},
  groupError(){map.sourceError('halc-regions');},
  beginGroupLoad(){map.getSource('halc-regions').loaded=false;map.emit('sourcedataloading',{sourceId:'halc-regions',isSourceLoaded:false});},
  enableGroupLabels(){atlas.showLabels=true;halc.anchor=f=>({coordinate:[5+(f.properties.gid?1:Number(f.properties.fid))*.06,51],score:1});halc.refreshLabels();},
  retry(){RegionalBoundaries.prototype.retry.call(owner);},
  deferRecord(id){let resolve;const promise=new Promise(r=>resolve=r),gate={id,promise,claimed:false,resolve:()=>resolve({records:structuredClone(records)})};gates.push(gate);return gate;},
  openRecord(id){void halc.openRecord(id);},
  restore(id){halc.restore('halc:'+id);},
  closePopup(){halc.popup?.remove();},
  destroy(){if(disposed)return;halc.destroy();atlas.destroyed=true;map.destroyed=true;disposed=true;},
  staleWriteCount(){return map.staleWrites;}
 };
}

 return {createHarness,restoreGlobals};
}
