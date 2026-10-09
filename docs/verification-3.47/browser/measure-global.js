(()=>{
 const start=performance.now(),events=[],tasks=[],serializations=[],calls=[],frames=[],restores=[],originalStringify=JSON.stringify;
 const mark=(kind,more={})=>events.push({t:performance.now()-start,kind,...more});
 JSON.stringify=function(value,...rest){const landscape=value?.type==='FeatureCollection'&&value.features?.some(f=>f.properties?._atlasBoundaryLine===true),t=performance.now(),out=originalStringify.call(this,value,...rest);if(landscape)serializations.push({t:t-start,ms:performance.now()-t,chars:out.length,features:value.features.length});return out;};
 const observer=new PerformanceObserver(list=>tasks.push(...list.getEntries().map(e=>({t:e.startTime-start,ms:e.duration}))));observer.observe({type:'longtask'});
 let attached=null,last='',running=true,raf;
 function attach(a){
  attached=a;mark('instance',{year:a.year});
  for(const method of ['displayTerritories','prepareOverview','setYear']){const original=a[method];a[method]=function(...args){const t=performance.now(),value=original.apply(this,args);if(value?.then)return value.then(result=>{calls.push({method,t:t-start,ms:performance.now()-t,year:this.year,features:this.rawTerritories?.features.length});return result;});calls.push({method,t:t-start,ms:performance.now()-t,year:this.year,features:args[0]?.features?.length});return value;};restores.push(()=>a[method]=original);}
  const source=a.map.getSource('polities');if(source){const setData=source.setData;source.setData=function(data){const t=performance.now(),out=setData.call(this,data);calls.push({method:'polities.setData',t:t-start,ms:performance.now()-t,features:data.features?.length});return out;};restores.push(()=>source.setData=setData);}
  for(const name of ['sourcedataloading','sourcedata','idle','error']){const fn=e=>{if(e.sourceId&&e.sourceId!=='polities')return;mark(name,{source:e.sourceId,loaded:e.isSourceLoaded,type:e.sourceDataType});};a.map.on(name,fn);restores.push(()=>a.map.off(name,fn));}
 }
 function tick(){const a=window.__meridian?.instances?.find(a=>!a.destroyed&&a.container==='map');if(a&&!attached)attach(a);if(a){const state={year:a.year,lang:a.lang,features:a.rawTerritories?.features.length||0,labels:a.labels.length,sourceLoaded:a.map.getSource('polities')?a.map.isSourceLoaded('polities'):false,loaded:a.map.loaded(),controls:!document.querySelector('#yearInput')?.disabled};const key=originalStringify(state);if(key!==last){frames.push({t:performance.now()-start,...state});last=key;}}if(running)raf=requestAnimationFrame(tick);}
 window.__global347={mark,result(){const a=attached;return {start,elapsed:performance.now()-start,events,tasks,serializations,calls,frames,year:a?.year,language:a?.lang,rawIds:a?.rawTerritories?.features.map(f=>f.properties.id),view:a?{center:a.map.getCenter(),zoom:a.map.getZoom(),width:a.map.getContainer().clientWidth,height:a.map.getContainer().clientHeight}:null};},stop(){running=false;cancelAnimationFrame(raf);observer.disconnect();JSON.stringify=originalStringify;for(const restore of restores)restore();}};
 tick();return 'started';
})()
