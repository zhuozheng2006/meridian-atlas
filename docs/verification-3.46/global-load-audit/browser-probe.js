// Optional, read-only observation helper for the root's authorized browser run.
// It does not move the camera or change layers. Run after the default 1492 map is
// ready, then perform the same chosen camera action on baseline and candidate.
// dispose() restores the wrapped source method and removes every listener.
(() => {
 const atlas=window.__meridian?.instances?.find(a=>!a.destroyed&&a.container==='map');
 if(!atlas?.geography?.lakes)throw Error('The main atlas and Geography.lakes are not ready');
 const map=atlas.map,lake=atlas.geography.lakes,id='lake-detail',source=map.getSource(id);
 if(!source)throw Error('Lake GeoJSON source missing');
 window.__lakeProbe?.dispose?.();
 const started=performance.now(),events=[],listeners=[],safe=f=>{try{return f();}catch{return null;}};
 const sample=(kind,extra={})=>{
  const bounds=map.getBounds();
  const value={kind,t:performance.now()-started,year:atlas.year,zoom:map.getZoom(),center:map.getCenter().toArray(),bounds:[bounds.getWest(),bounds.getSouth(),bounds.getEast(),bounds.getNorth()],seq:lake.seq,renderSeq:lake.renderSeq,contentSeq:lake.contentSeq??null,status:lake.status,ready:lake.ready,count:lake.count,workerLoaded:source.loaded(),sourceLoaded:safe(()=>map.isSourceLoaded(id)),moving:map.isMoving(),opacity:map.getPaintProperty(id,'fill-opacity'),...extra};
  events.push(value);return value;
 };
 const on=(type,fn)=>{map.on(type,fn);listeners.push([type,fn]);};
 on('movestart',()=>sample('movestart'));on('moveend',()=>sample('moveend'));
 on('sourcedataloading',e=>{if(e.sourceId===id)sample('lake-dataloading',{sourceDataType:e.sourceDataType??null,tileState:e.tile?.state??null,eventLoaded:e.isSourceLoaded??null});});
 on('sourcedata',e=>{if(e.sourceId===id)sample('lake-sourcedata',{sourceDataType:e.sourceDataType??null,tileState:e.tile?.state??null,eventLoaded:e.isSourceLoaded??null});});
 on('error',e=>sample('error',{sourceId:e.sourceId??null,message:String(e.error?.message||e.error||'')}));
 let last='';
 on('render',()=>{const key=[lake.seq,lake.status,lake.ready,source.loaded(),safe(()=>map.isSourceLoaded(id)),map.isMoving()].join('|');if(key!==last){last=key;sample('render-state');}});
 on('idle',()=>sample('global-idle'));
 const originalSetData=source.setData;
 function observedSetData(data){sample('setData-start',{features:data.features?.length??null});const result=originalSetData.call(this,data);sample('setData-return');return result;}
 source.setData=observedSetData;
 const probe={atlas,lake,map,events,mark:name=>sample('mark',{name}),snapshot:()=>sample('snapshot'),
  export(){return {scope:'Browser event/readiness observations; render-state is not a GPU pixel-readback proof',url:location.href,userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,deviceMemory:navigator.deviceMemory??null,viewport:[innerWidth,innerHeight],workerCount:window.maplibregl?.getWorkerCount(),events};},
  dispose(){if(source.setData===observedSetData)source.setData=originalSetData;for(const[type,fn]of listeners)map.off(type,fn);},
 };
 window.__lakeProbe=probe;sample('installed');return {installed:true,year:atlas.year,zoom:map.getZoom(),entry:'window.__meridian.instances.find(a=>!a.destroyed&&a.container===\'map\').geography.lakes'};
})();
