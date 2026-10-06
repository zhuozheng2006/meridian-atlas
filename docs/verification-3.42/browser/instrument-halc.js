(()=>{
 const a=window.__meridian.instances[0],h=a.regional.halc,m=a.map;
 const p=window.__halc342={start:performance.now(),calls:[],totals:{},events:[],restore:[]};
 const wrap=(o,k,n)=>{if(typeof o?.[k]!=='function')return;const original=o[k];o[k]=function(...args){const start=performance.now();try{return original.apply(this,args)}finally{const duration=performance.now()-start,s=p.totals[n]||(p.totals[n]={count:0,total:0,max:0});s.count++;s.total+=duration;s.max=Math.max(s.max,duration);if(duration>1&&p.calls.length<150)p.calls.push({method:n,at:start-p.start,ms:duration});}};p.restore.push(()=>o[k]=original);};
 for(const k of ['settle','afterRender','refreshLabels','setActive','visibility','paint','anchor'])wrap(h,k,'halc.'+k);
 for(const k of ['settle','refreshLabels','visibility'])wrap(h.regions,k,'regions.'+k);
 for(const k of ['refreshLabels'])wrap(a,k,'atlas.'+k);
 wrap(a.places,'refresh','places.refresh');wrap(m,'queryRenderedFeatures','map.queryRenderedFeatures');
 const onSource=e=>{if(e.sourceId==='halc-boundaries'&&e.isSourceLoaded)p.events.push({event:'sourceLoaded',at:performance.now()-p.start,active:h.active,features:h.features.length});};
 let activeFrames=0;const onRender=()=>{if(h.active&&activeFrames++<3)p.events.push({event:'activeRender',at:performance.now()-p.start,features:h.features.length});};
 m.on('sourcedata',onSource);m.on('render',onRender);p.restore.push(()=>m.off('sourcedata',onSource),()=>m.off('render',onRender));
 a.map.jumpTo({center:[4.8,51.3],zoom:6.3});a.regional.setMode('halc');return true;
})()