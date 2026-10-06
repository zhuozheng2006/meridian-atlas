// Display groups follow complete source ADM1 strings; they are not states.
export const HALC_REGION_SOURCE='halc-regions';
export const HALC_REGION_LAYERS=['halc-region-query','halc-region-edges'];
export class HalcRegions{
 constructor(parent,bounds){
  this.parent=parent;this.map=parent.map;this.bounds=bounds;this.features=[];this.epoch=0;this.revision=0;this.ready=false;this.hasFrame=false;this.failed=false;this.listeners=[];this.renderedKey=null;this.renderPending=false;this.seenContent=false;
  const on=(event,fn)=>{this.map.on(event,fn);this.listeners.push([event,fn]);};
  on('sourcedataloading',e=>{if(e.sourceId!==HALC_REGION_SOURCE)return;this.epoch++;this.renderedKey=null;this.ready=false;this.features=[];this.revision++;this.visibility();parent.visibility();parent.clearLabels();});
  on('sourcedata',e=>{if(e.sourceId!==HALC_REGION_SOURCE)return;if(e.tile?.state==='loaded'||e.sourceDataType==='content')this.seenContent=true;if(this.seenContent&&e.isSourceLoaded)this.requestRender();});
  on('render',()=>this.afterRender());
  on('movestart',()=>{this.renderedKey=null;this.renderPending=false;});
  on('moveend',()=>this.requestRender());
  on('resize',()=>this.requestRender());
  on('error',e=>{if(e.sourceId!==HALC_REGION_SOURCE)return;this.failed=true;this.ready=false;this.hasFrame=false;this.features=[];this.revision++;this.visibility();parent.visibility();parent.refreshLabels();parent.notify();});
 }
 // Groups may finish after locality tiles; settle their own rendered revision.
 frameKey(){return this.parent.viewportKey()+':'+this.epoch;}
 requestRender(){if(this.parent.dead||!this.parent.eligible||this.parent.failed||this.failed)return;this.renderPending=true;this.map.triggerRepaint?.();}
 afterRender(){
  if(!this.renderPending||this.parent.dead||!this.parent.eligible||this.parent.failed||this.failed||this.map.isMoving())return;
  if(!this.seenContent||!this.map.getSource(HALC_REGION_SOURCE)||!this.map.isSourceLoaded(HALC_REGION_SOURCE))return;
  this.renderPending=false;this.renderedKey=this.frameKey();this.settle();this.parent.visibility();this.parent.refreshLabels();
 }
 ensure(){
  if(this.failed||!this.parent.eligible||this.map.getSource(HALC_REGION_SOURCE))return;
  this.map.addSource(HALC_REGION_SOURCE,{type:'vector',tiles:[new URL('data/halc-regions/tiles/{z}/{x}/{y}.pbf',location.href).href.replaceAll('%7B','{').replaceAll('%7D','}')],bounds:this.bounds,minzoom:6,maxzoom:10});
  const base={source:HALC_REGION_SOURCE,'source-layer':'halc_regions',minzoom:6};
  this.map.addLayer({...base,id:HALC_REGION_LAYERS[0],type:'fill',paint:{'fill-color':'#6b614e','fill-opacity':0}},'halc-selected');
  this.map.addLayer({...base,'source-layer':'halc_region_edges',id:HALC_REGION_LAYERS[1],type:'line',layout:{visibility:'none','line-join':'round','line-cap':'round'},paint:{'line-color':'#6b614e','line-width':['interpolate',['linear'],['zoom'],6,.65,8,.9,11,1.1,15,1.3],'line-opacity':0,'line-blur':.15}},'halc-selected');
  this.visibilityKey=null;this.requestRender();
 }
 visibility(){
  const enabled=this.parent.eligible&&!this.parent.failed&&!this.failed,ink=enabled&&this.parent.active&&this.hasFrame,key=enabled+':'+ink;
  if(key===this.visibilityKey)return;this.visibilityKey=key;
  for(const id of HALC_REGION_LAYERS)if(this.map.getLayer(id))this.map.setLayoutProperty(id,'visibility',enabled?'visible':'none');
  if(this.map.getLayer(HALC_REGION_LAYERS[1])){this.map.setPaintProperty(HALC_REGION_LAYERS[1],'line-opacity-transition',{duration:0});this.map.setPaintProperty(HALC_REGION_LAYERS[1],'line-opacity',ink?['interpolate',['linear'],['zoom'],6,.62,8,.68,12,.5]:0);}
 }
 update(){
  if(!this.parent.eligible||this.parent.failed){this.renderedKey=null;this.renderPending=false;this.scanKey=null;this.features=[];this.ready=false;this.hasFrame=false;this.revision++;}else if(this.renderedKey!==this.frameKey())this.requestRender();this.visibility();
 }
 settle(){
  if(!this.parent.eligible||this.parent.failed||this.failed||!this.map.getSource(HALC_REGION_SOURCE)||this.map.isMoving())return;
  if(!this.map.isSourceLoaded(HALC_REGION_SOURCE)){this.scanKey=null;if(this.ready){this.ready=false;this.features=[];this.revision++;this.visibility();}return;}
  const key=this.frameKey();if(this.renderedKey!==key||key===this.scanKey)return;
  const groups=new Map();for(const f of this.map.queryRenderedFeatures({layers:[HALC_REGION_LAYERS[0]]})){const id=f.properties.gid;if(!id)continue;if(!groups.has(id))groups.set(id,{...f,fragments:[]});groups.get(id).fragments.push(f.geometry);}
  this.features=[...groups.values()];this.scanKey=key;this.ready=true;this.hasFrame=true;this.revision++;this.visibility();
 }
 retry(){this.seenContent=false;this.renderedKey=null;this.renderPending=false;this.failed=false;this.ready=false;this.hasFrame=false;this.features=[];this.scanKey=null;this.visibilityKey=null;this.epoch++;this.revision++;for(const id of [...HALC_REGION_LAYERS].reverse())if(this.map.getLayer(id))this.map.removeLayer(id);if(this.map.getSource(HALC_REGION_SOURCE))this.map.removeSource(HALC_REGION_SOURCE);}
 destroy(){this.renderPending=false;this.renderedKey=null;for(const [event,fn]of this.listeners)this.map.off(event,fn);}
}
