const pools=new Map();let nextOwner=0,nextRequest=0;
const aborted=()=>Object.assign(Error('Landscape request superseded'),{name:'AbortError'});
const unavailable=message=>Object.assign(Error(message),{code:'landscape-worker-unavailable'});
// Exporting the adapter permits protocol/lifetime tests without a browser. In the
// app all simultaneous maps share one preparation worker and its immutable cache.
export class LandscapeWorkerPool{
 constructor({Worker=globalThis.Worker,workerURL=new URL('./halc-landscape-worker.js'+new URL(import.meta.url).search,import.meta.url),baseURL}={}){
  this.pending=new Map();this.owners=new Set();this.closed=false;
  this.worker=new Worker(workerURL,{type:'module',name:'Meridian landscape'});
  this.worker.addEventListener('message',({data})=>{if(data?.type==='unavailable'){this.fail();return;}const task=this.pending.get(data?.id);if(!task)return;this.pending.delete(data.id);data.error?task.reject(Error(data.error.message)):task.resolve(data);});
  this.worker.addEventListener('error',()=>this.fail());this.worker.addEventListener('messageerror',()=>this.fail());
  try{this.worker.postMessage({type:'init',baseURL});}catch(error){this.worker.terminate();this.closed=true;throw error;}
 }
 acquire(){const owner=++nextOwner;this.owners.add(owner);let released=false;return {
  prepare:bounds=>{if(released||this.closed)return Promise.reject(unavailable('Landscape worker is unavailable'));this.cancel(owner);const id=++nextRequest;return new Promise((resolve,reject)=>{this.pending.set(id,{owner,resolve,reject});try{this.worker.postMessage({type:'prepare',owner,id,bounds});}catch{this.fail();}});},
  cancel:()=>{if(!released)this.cancel(owner);},
  destroy:()=>{if(released)return;released=true;this.cancel(owner);this.owners.delete(owner);if(!this.owners.size)this.close();}
 };}
 cancel(owner){for(const[id,task]of this.pending)if(task.owner===owner){this.pending.delete(id);task.reject(aborted());}if(!this.closed)try{this.worker.postMessage({type:'cancel',owner});}catch{this.fail();}}
 fail(){if(this.closed)return;for(const task of this.pending.values())task.reject(unavailable('Landscape worker failed'));this.pending.clear();this.close();}
 close(){if(this.closed)return;this.closed=true;this.worker.terminate();}
}
export function acquireLandscapeWorker(){
 if(typeof Worker!=='function'||typeof document==='undefined')return null;
 // Avoid the extra archive cache and base64 encoding peak on browsers that
 // explicitly report a small memory tier. This is not a total map-memory bound.
 if(typeof globalThis.navigator?.deviceMemory==='number'&&navigator.deviceMemory<=4)return null;
 const baseURL=new URL('data/halc-landscape/',document.baseURI).href;let pool=pools.get(baseURL);
 try{if(!pool||pool.closed){pool=new LandscapeWorkerPool({baseURL});pools.set(baseURL,pool);}return pool.acquire();}
 catch{return null;}
}
