import {SNAPSHOT} from './polaris-contract.js?v=3.43.0-6a6bc23b738e';
const obsolete=()=>new DOMException('Research request is obsolete','AbortError');
const unavailable=message=>Object.assign(new Error(message),{workerUnavailable:true});
function cancellable(promise,signal){if(!signal)return promise;if(signal.aborted)return Promise.reject(obsolete());return new Promise((resolve,reject)=>{const cancel=()=>{signal.removeEventListener('abort',cancel);reject(obsolete());};signal.addEventListener('abort',cancel,{once:true});promise.then(value=>{signal.removeEventListener('abort',cancel);resolve(value);},error=>{signal.removeEventListener('abort',cancel);reject(error);});});}
/** One lazy worker per research reader. Only result pages cross to the UI thread. */
export class PolarisSearchClient {
 constructor({dataBaseUrl,workerFactory=url=>new Worker(url,{type:'module',name:'meridian-polaris-search'}),startupTimeoutMs=20000}={}){
  this.base=new URL(dataBaseUrl);this.workerFactory=workerFactory;this.startupTimeoutMs=startupTimeoutMs;this.worker=null;this.starting=null;this.pending=new Map();this.sequence=0;this.epoch=0;this.disposed=false;this.failureError=null;
 }
 _cancelAll(error){for(const job of this.pending.values()){job.cleanup();job.reject(error);}this.pending.clear();}
 _failure(error,worker){if(worker!==this.worker)return;this.failureError=error;this._stop(error);}
 _stop(error=obsolete()){
  this.epoch++;const pending=this.starting;this.starting=null;if(pending){clearTimeout(pending.timer);pending.reject(error);}const worker=this.worker;this.worker=null;worker?.terminate();this._cancelAll(error);
 }
 async _start(){
  if(this.disposed)throw obsolete();if(this.failureError)throw this.failureError;if(this.starting)return this.starting.promise;if(this.worker)return this.worker;
  let worker;try{const url=new URL('./polaris-search-worker.js',import.meta.url);url.search=new URL(import.meta.url).search;worker=this.workerFactory(url);}catch(error){this.failureError=unavailable('Background research could not start');throw this.failureError;}
  this.worker=worker;let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});const pending={promise,resolve,reject,timer:null};this.starting=pending;
  worker.onmessage=event=>{
   if(worker!==this.worker)return;const m=event.data;if(!m||typeof m!=='object')return;
   if(m.kind==='ready'){
    if(!this.starting)return;if(m.datasetId!==SNAPSHOT.datasetId||m.version!==SNAPSHOT.version||m.sourceSha256!==SNAPSHOT.sourceSha256){this._failure(new Error('Background research snapshot mismatch'),worker);return;}
    clearTimeout(pending.timer);this.starting=null;pending.resolve(worker);return;
   }
   if(m.kind==='error'&&m.id===null&&this.starting){this._failure(new Error(m.message||'Background research initialization failed'),worker);return;}
   const job=this.pending.get(m.id);if(!job)return;
   if(m.kind==='progress'){try{job.onProgress?.(m.progress);}catch(error){this.pending.delete(m.id);job.cleanup();worker.postMessage({kind:'cancel',id:m.id});job.reject(error);}return;}
   if(!['result','error'].includes(m.kind))return;this.pending.delete(m.id);job.cleanup();
   if(m.kind==='error'){job.reject(Object.assign(new Error(typeof m.message==='string'?m.message:'Research failed'),{name:m.name==='AbortError'?'AbortError':'Error'}));return;}
   if(m.datasetId!==SNAPSHOT.datasetId||m.version!==SNAPSHOT.version||m.sourceSha256!==SNAPSHOT.sourceSha256){job.reject(new Error('Background research result snapshot mismatch'));return;}
   job.resolve(m.result);
  };
  worker.onerror=event=>{event?.preventDefault?.();this._failure(unavailable('Background research could not run'),worker);};
  worker.onmessageerror=()=>this._failure(new Error('Background research message could not be decoded'),worker);
  pending.timer=setTimeout(()=>this._failure(unavailable('Background research startup timed out'),worker),this.startupTimeoutMs);
  try{worker.postMessage({kind:'init',dataBaseUrl:this.base.href});}catch{this._failure(unavailable('Background research could not initialize'),worker);}
  return promise;
 }
 async request(operation,filters,{signal,offset=0,limit=24,retry=false,onProgress}={}){
  const epoch=this.epoch;if(signal?.aborted||this.disposed)throw obsolete();const worker=await cancellable(this._start(),signal);if(signal?.aborted||this.disposed||epoch!==this.epoch)throw obsolete();
  const id=++this.sequence;return new Promise((resolve,reject)=>{
   const cancel=()=>{const job=this.pending.get(id);if(!job)return;this.pending.delete(id);job.cleanup();try{worker.postMessage({kind:'cancel',id});}catch{}reject(obsolete());};
   const cleanup=()=>signal?.removeEventListener('abort',cancel);this.pending.set(id,{resolve,reject,cleanup,onProgress});signal?.addEventListener('abort',cancel,{once:true});
   try{worker.postMessage({kind:'request',id,operation,filters,options:{offset,limit,retry}});}catch(error){this.pending.delete(id);cleanup();reject(error);}
  });
 }
 clearCaches(){this._stop();}
 dispose(){this.disposed=true;this._stop();}
}
