// Prefer the native task queue without timer nesting delays.
// postTask avoids timer nesting delay where supported; the browser still decides
// when input/rendering and tasks run. Node/older browsers use cancellable timers.
export function scheduleLabelTask(fn,environment=globalThis){
 let cancelled=false,started=false,timer=null,controller=null;
 const run=()=>{if(cancelled||started)return;started=true;return fn();};
 const fallback=()=>{if(!cancelled&&!started&&timer===null)timer=environment.setTimeout(run,0);};
 const cancel=()=>{cancelled=true;if(timer!==null)environment.clearTimeout(timer);controller?.abort();};
 if(typeof environment.scheduler?.postTask!=='function'||typeof environment.AbortController!=='function'){fallback();return cancel;}
 let posted;
 try{
  controller=new environment.AbortController();
  posted=environment.scheduler.postTask(run,{priority:'user-visible',signal:controller.signal});
 }catch{fallback();return cancel;}
 // Attach a rejection handler immediately: aborting a queued native task rejects
 // its promise. Unexpected pre-execution failures fall back once; a callback
 // exception is surfaced as a normal task error and must never rerun the callback.
 Promise.resolve(posted).catch(error=>{
  if(cancelled||controller.signal.aborted)return;
  if(started){environment.setTimeout(()=>{throw error;},0);return;}
  fallback();
 });
 return cancel;
}

// Exact anchors, cooperative main-thread scheduling, one owned job.
// The caller keeps existing markers until onReady, and clears them separately on
// source/year/eligibility exit. This module never reads or writes DOM/map style.
export function createExactLabelScheduler({anchor,now=()=>performance.now(),schedule=scheduleLabelTask,budgetMs=4,maxPerSlice=64}={}){
 if(typeof anchor!=='function')throw TypeError('anchor is required');
 if(!Number.isFinite(budgetMs)||budgetMs<=0||!Number.isInteger(maxPerSlice)||maxPerSlice<1)throw RangeError('positive budgetMs and maxPerSlice required');
 let generation=0,job=null,cache=null,dead=false;
 function stop(reason='superseded',clearCache=false){
  const previous=job;job=null;++generation;if(clearCache)cache=null;
  if(!previous)return;
  previous.cancelScheduled?.();previous.cancelScheduled=null;previous.stats.canceled=true;previous.stats.cancelReason=reason;previous.stats.elapsedMs=now()-previous.started;previous.resolve(null);
 }
 function valid(current){return !dead&&job===current&&current.generation===generation&&current.isCurrent();}
 function request({key,features,box=null,isCurrent=()=>true,onReady=()=>{},onError=()=>{}}){
  if(dead)return {status:'destroyed'};
  if(job?.key===key){job.isCurrent=isCurrent;job.onReady=onReady;job.onError=onError;return job.handle;}
  if(job)stop('superseded');
  if(cache?.key===key&&isCurrent())return {status:'ready',key,ranked:cache.ranked,stats:cache.stats};
  const current={key,features:features.slice(),box:box?.slice()||null,isCurrent,onReady,onError,rows:[],index:0,generation:++generation,started:now(),cancelScheduled:null,stats:{candidates:features.length,computed:0,retained:0,slices:0,workMs:0,maxSliceMs:0,maxAnchorMs:0,sortMs:0,canceled:false}};
  current.handle={status:'pending',key,generation:current.generation,promise:new Promise(resolve=>current.resolve=resolve),stats:current.stats};job=current;
  const fail=error=>{if(job!==current)return;current.cancelScheduled?.();job=null;current.stats.error=String(error?.message||error);current.resolve(null);current.onError(error);};
  const step=()=>{
   current.cancelScheduled=null;
   try{
    if(!valid(current)){if(job===current)stop('context-changed');return;}
    const started=now();let processed=0;current.stats.slices++;
    while(current.index<current.features.length){
     const index=current.index++,f=current.features[index],before=now(),value=anchor(f,current.box);
     current.stats.maxAnchorMs=Math.max(current.stats.maxAnchorMs,now()-before);current.stats.computed++;processed++;
     if(value)current.rows.push({f,anchor:value,index});
     if(job!==current||current.generation!==generation)return;
     if(processed>=maxPerSlice||now()-started>=budgetMs)break;
    }
    const duration=now()-started;current.stats.workMs+=duration;current.stats.maxSliceMs=Math.max(current.stats.maxSliceMs,duration);
    if(!valid(current)){if(job===current)stop('context-changed');return;}
    if(current.index<current.features.length){current.cancelScheduled=schedule(step);return;}
    const sorting=now();current.rows.sort((a,b)=>b.anchor.score-a.anchor.score||a.index-b.index);current.stats.sortMs=now()-sorting;current.stats.retained=current.rows.length;current.stats.elapsedMs=now()-current.started;
    if(!valid(current)){if(job===current)stop('context-changed');return;}
    const ranked=current.rows;cache={key,ranked,stats:current.stats};job=null;current.resolve(ranked);
    try{current.onReady(ranked,{key,generation:current.generation,stats:current.stats});}catch(error){current.stats.commitError=String(error?.message||error);current.onError(error);}
   }catch(error){fail(error);}
  };
  current.cancelScheduled=schedule(step);return current.handle;
 }
 return {request,invalidate(reason='invalidated'){stop(reason,true);},destroy(){if(dead)return;dead=true;stop('destroyed',true);},getState:()=>({dead,generation,pendingKey:job?.key??null,cachedKey:cache?.key??null}),getCached:key=>cache?.key===key?cache.ranked:null};
}
