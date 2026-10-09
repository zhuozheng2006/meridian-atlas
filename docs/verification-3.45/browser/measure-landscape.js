(()=>{
 const a=window.__meridian.instances.find(a=>!a.destroyed),m=a.map,h=a.regional.halc,l=h.landscape;
 window.__probe345?.stop();
 const start=performance.now(),events=[],tasks=[],frames=[],queries=[],serializations=[],sourceCalls=[],loads=[];
 const elapsed=()=>performance.now()-start,originalQuery=m.queryRenderedFeatures,originalAdd=m.addSource,originalStringify=JSON.stringify,originalGet=l.cache.get;
 const mark=(kind,info={})=>events.push({t:elapsed(),kind,...info});
 m.queryRenderedFeatures=function(...args){const t=performance.now(),result=originalQuery.apply(this,args);queries.push({t:t-start,ms:performance.now()-t,count:result.length,layers:args.at(-1)?.layers});return result;};
 JSON.stringify=function(...args){const landscape=args[0]?.type==='FeatureCollection'&&args[0]?.features?.[0]?.properties?.LANDSCAPE!==undefined,t=performance.now(),result=originalStringify.apply(this,args);if(landscape)serializations.push({t:t-start,ms:performance.now()-t,chars:result.length,features:args[0].features.length});return result;};
 l.cache.get=function(file){const t=performance.now(),cached=this.entries.has(file);return originalGet.call(this,file).then(result=>{loads.push({file,cached,t:t-start,ms:performance.now()-t,features:result.features?.length});return result;});};
 let sourceOriginal,source;
 function wrapSource(){source=m.getSource('halc-landscape');if(!source||sourceOriginal)return;sourceOriginal=source.setData;source.setData=function(data){const t=performance.now();const result=sourceOriginal.call(this,data);sourceCalls.push({t:t-start,ms:performance.now()-t,dataType:typeof data,features:data?.features?.length});return result;};}
 m.addSource=function(id,...args){const result=originalAdd.call(this,id,...args);if(id==='halc-landscape')wrapSource();return result;};wrapSource();
 const names=['sourcedataloading','sourcedata','error','moveend','idle'];
 const handlers=names.map(name=>{const fn=e=>{if(e.sourceId&&!['halc-boundaries','halc-regions','halc-landscape'].includes(e.sourceId))return;mark(name,{source:e.sourceId,loaded:e.isSourceLoaded,type:e.sourceDataType});};m.on(name,fn);return[name,fn];});
 const observer=new PerformanceObserver(list=>tasks.push(...list.getEntries().map(e=>({t:e.startTime-start,ms:e.duration}))));observer.observe({type:'longtask'});
 let raf,running=true,last='';const tick=()=>{const state=originalStringify({reason:h.reason,active:h.active,units:h.features.length,regions:h.regions.features.length,regionReady:h.regions.ready,labels:h.markers.length,landscape:l.active,landscapeStatus:l.status,landscapeFeatures:l.features.length});if(state!==last){frames.push({t:elapsed(),...JSON.parse(state)});last=state;}if(running)raf=requestAnimationFrame(tick);};tick();
 window.__probe345={stop(){running=false;cancelAnimationFrame(raf);observer.disconnect();m.queryRenderedFeatures=originalQuery;m.addSource=originalAdd;JSON.stringify=originalStringify;l.cache.get=originalGet;if(source&&sourceOriginal)source.setData=sourceOriginal;for(const[n,f]of handlers)m.off(n,f);},result(){return {start,elapsed:elapsed(),events,tasks,frames,queries,serializations,sourceCalls,loads,preparationMetrics:l.preparationMetrics,labels:h.markers.map(x=>x.getElement().textContent),landscapeIds:l.features.map(f=>f.id),view:{center:m.getCenter(),zoom:m.getZoom(),width:m.getContainer().clientWidth,height:m.getContainer().clientHeight}};}};
 mark('jump');m.jumpTo({center:[4.8,51.3],zoom:6.3});return 'started';
})()
