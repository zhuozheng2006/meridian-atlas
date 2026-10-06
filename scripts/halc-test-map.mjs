import assert from 'node:assert/strict';
// A small MapLibre event/source double for adapters; no browser or real network.
export class HalcFakeMap{
 constructor({zoom=7,inside=true}={}){this.zoom=zoom;this.inside=inside;this.sources=new Map();this.layers=new Map();this.listeners=new Map();this.tileRequestCount=0;this.destroyed=false;this.staleWrites=0;this.rendered=[];this.renderedByLayer=new Map();this.sourceRequests=new Map();}
 recordWrite(){if(this.destroyed)this.staleWrites++;}
 on(event,layerOrFn,fn){const cb=typeof layerOrFn==='function'?layerOrFn:fn;if(!this.listeners.has(event))this.listeners.set(event,new Set());this.listeners.get(event).add(cb);return this;}
 off(event,layerOrFn,fn){this.listeners.get(event)?.delete(typeof layerOrFn==='function'?layerOrFn:fn);return this;}
 emit(event,data={}){for(const fn of [...this.listeners.get(event)||[]])fn(data);}
 addSource(id,spec){this.recordWrite();assert(!this.sources.has(id),'Source was re-added while present');this.tileRequestCount++;this.sourceRequests.set(id,(this.sourceRequests.get(id)||0)+1);this.sources.set(id,{...spec,loaded:false,setData:()=>this.recordWrite()});}
 removeSource(id){this.recordWrite();this.sources.delete(id);}
 getSource(id){return this.sources.get(id);}
 addLayer(layer){this.recordWrite();this.layers.set(layer.id,structuredClone(layer));}
 removeLayer(id){this.recordWrite();this.layers.delete(id);}
 getLayer(id){return this.layers.get(id);}
 setLayoutProperty(id,key,value){this.recordWrite();const l=this.layers.get(id);if(l)(l.layout??={})[key]=value;}
 setPaintProperty(id,key,value){this.recordWrite();const l=this.layers.get(id);if(l)(l.paint??={})[key]=value;}
 setFilter(id,value){this.recordWrite();if(this.layers.has(id))this.layers.get(id).filter=value;}
 getZoom(){return this.zoom;}
 isMoving(){return false;}
 isSourceLoaded(id){return !!this.sources.get(id)?.loaded;}
 getBounds(){const b=this.inside?[4.4,50.5,5.8,52.0]:[110,25,115,30];return {getWest:()=>b[0],getSouth:()=>b[1],getEast:()=>b[2],getNorth:()=>b[3],contains:p=>{const a=Array.isArray(p)?p:[p.lng,p.lat];return a[0]>=b[0]&&a[0]<=b[2]&&a[1]>=b[1]&&a[1]<=b[3];}};}
 getCenter(){return this.inside?{lng:5.1,lat:51.25}:{lng:112.5,lat:27.5};}
 queryRenderedFeatures(pointOrOptions,options){const layers=(options||pointOrOptions)?.layers;if(!layers)return this.rendered;return layers.flatMap(id=>this.renderedByLayer.has(id)?this.renderedByLayer.get(id):this.rendered);}
 sourceReadyWithoutIdle(id){const s=this.sources.get(id);if(s)s.loaded=true;this.emit('sourcedata',{sourceId:id,isSourceLoaded:true,sourceDataType:'content',tile:{state:'loaded'}});}
 renderFrame(){this.emit('render');}
 sourceReady(id){this.sourceReadyWithoutIdle(id);this.renderFrame();this.emit('idle');}
 sourceError(id){this.emit('error',{sourceId:id,error:Error('Synthetic HALC tile failure')});}
}

