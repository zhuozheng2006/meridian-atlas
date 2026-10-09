// One current derived territory frame per AtlasMap. Geometry in the native and
// overview stores is immutable; replacement references invalidate this cache.
// Explicit invalidation also supports callers that edit geometry in place.
function snapshot(data){
 const {features,...header}=data,geometries=[],coordinates=[],metadata=[];
 for(const feature of features){
  const {geometry,...fields}=feature;
  geometries.push(geometry);coordinates.push(geometry?.coordinates);
  if(geometry){const {coordinates:ignored,...geometryFields}=geometry;metadata.push([fields,geometryFields]);}
  else metadata.push([fields,geometry]);
 }
 return {metadata:JSON.stringify([header,metadata]),geometries,coordinates};
}
const equal=(a,b)=>a.metadata===b.metadata&&a.geometries.length===b.geometries.length&&a.geometries.every((g,i)=>g===b.geometries[i]&&a.coordinates[i]===b.coordinates[i]);
export class TerritoryFrameCache{
 constructor(){this.entry=null;this.source=null;this.accepted=null;this.pendingInput=null;this.flight=null;this.submitted=null;this.stats={builds:0,hits:0,submissions:0,skipped:0,invalidations:0};}
 bind(source){
  if(this.source===source)return;
  this.unbind();this.source=source;
  this.observable=['serialize','on','off','loaded'].every(k=>typeof source?.[k]==='function');
  if(!this.observable)return;
  this.onLoading=()=>{
   // A queued request can start after an older response replaced _data. When
   // provenance is uncertain, keep the derived cache but allow resubmission.
   this.flight=source.serialize().data===this.pendingInput?this.entry:null;
   if(!this.flight)this.accepted=null;
  };
  this.onData=event=>{
   if(event.sourceDataType!=='metadata')return;
   this.accepted=this.flight===this.entry&&this.entry&&this.pendingInput===this.entry.payload&&source.loaded()?source.serialize().data:null;
   this.flight=null;
  };
  this.onError=()=>{this.accepted=null;this.flight=null;};
  source.on('dataloading',this.onLoading);source.on('data',this.onData);source.on('error',this.onError);
 }
 unbind(){
  if(this.observable){this.source.off('dataloading',this.onLoading);this.source.off('data',this.onData);this.source.off('error',this.onError);}
  this.onLoading=null;this.onData=null;this.onError=null;
  this.source=null;this.observable=false;this.accepted=null;this.pendingInput=null;this.flight=null;this.submitted=null;
 }
 submit(data,mode,source,build){
  const next=snapshot(data),same=this.entry&&equal(this.entry.snapshot,next);
  if(!same){
   // A fresh collection key also invalidates the existing WeakMap portrayal
   // caches after explicit invalidation, without copying source coordinates.
   this.entry={snapshot:next,raw:{...data,features:data.features.slice()},mode:null,payload:null};
  }
  const entry=this.entry;
  if(entry.mode!==mode){entry.payload=build(entry.raw);entry.mode=mode;this.stats.builds++;}else this.stats.hits++;
  this.bind(source);
  // updateData can enqueue a diff without changing serialize().data. A settled
  // source is required so a later same-year commit cannot leave that diff active.
  if(this.observable&&source.loaded()&&this.submitted===entry.payload&&this.accepted!==null&&source.serialize().data===this.accepted){this.stats.skipped++;return false;}
  this.pendingInput=entry.payload;this.accepted=entry.payload;this.submitted=entry.payload;
  try{source.setData(entry.payload);this.stats.submissions++;return true;}
  catch(error){this.accepted=null;this.flight=null;throw error;}
 }
 invalidate(){this.entry=null;this.accepted=null;this.pendingInput=null;this.flight=null;this.submitted=null;this.stats.invalidations++;}
 destroy(){this.unbind();this.entry=null;}
 getStats(){return {...this.stats,retainedFrames:this.entry?1:0};}
}
