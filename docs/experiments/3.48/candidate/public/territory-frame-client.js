import {TERRITORY_FRAME_PREFIX,TERRITORY_FRAME_PROTOCOL} from './territory-frame-protocol.js';
let sharedPool,nextOwner=0,nextId=0;
const abort=()=>Object.assign(Error('Territory preparation superseded'),{name:'AbortError'});
const unavailable=message=>Object.assign(Error(message),{code:'territory-worker-unavailable'});
// Only one task crosses into the worker at once. Each map can retain only its
// latest waiting frame, so rapid navigation cannot queue unbounded clones.
export class TerritoryWorkerPool{
 constructor({Worker=globalThis.Worker,workerURL=new URL('./territory-frame-worker.js'+new URL(import.meta.url).search,import.meta.url),timeoutMs=30000,inputFormat='object'}={}){
  this.waiting=new Map();this.owners=new Set();this.active=null;this.closed=false;this.timeoutMs=timeoutMs;this.inputFormat=inputFormat;this.stats={posted:0,superseded:0,maxWaiting:0};
  this.worker=new Worker(workerURL,{type:'module',name:'Meridian territory preparation'});
  this.worker.addEventListener('message',({data})=>{
   const task=this.active;if(!task||data?.id!==task.id)return;
   clearTimeout(this.timer);this.active=null;
   if(!task.canceled){if(data.protocol!==TERRITORY_FRAME_PROTOCOL||(!data.error&&!data.dataURL?.startsWith(TERRITORY_FRAME_PREFIX)))task.reject(unavailable('Territory worker protocol mismatch'));else if(data.error)task.reject(unavailable(data.error.message));else task.resolve({...data,metrics:{...data.metrics,queueMs:task.postedAt-task.queuedAt,inputSerializeMs:task.inputSerializeMs,postMessageMs:task.postMessageMs,roundTripMs:performance.now()-task.postedAt}});}
   this.pump();
  });
  this.worker.addEventListener('error',()=>this.fail('Territory worker failed'));this.worker.addEventListener('messageerror',()=>this.fail('Territory worker message failed'));
 }
 acquire(){
  const owner=++nextOwner;this.owners.add(owner);let released=false;
  return {prepare:(raw,mode)=>{
   if(released||this.closed)return Promise.reject(unavailable('Territory worker is unavailable'));
   this.cancel(owner);const id=++nextId;
   return new Promise((resolve,reject)=>{this.waiting.set(owner,{owner,id,raw,mode,resolve,reject,queuedAt:performance.now()});this.stats.maxWaiting=Math.max(this.stats.maxWaiting,this.waiting.size);this.pump();});
  },cancel:()=>{if(!released)this.cancel(owner);},destroy:()=>{if(released)return;released=true;this.cancel(owner);this.owners.delete(owner);if(!this.owners.size)this.close();},getStats:()=>({...this.stats,waiting:this.waiting.size,active:this.active?1:0,owners:this.owners.size})};
 }
 cancel(owner){
  const queued=this.waiting.get(owner);if(queued){this.waiting.delete(owner);queued.reject(abort());this.stats.superseded++;}
  if(this.active?.owner===owner&&!this.active.canceled){this.active.canceled=true;this.active.reject(abort());this.stats.superseded++;}
 }
 pump(){
  if(this.closed||this.active||!this.waiting.size)return;
  const [owner,task]=this.waiting.entries().next().value;this.waiting.delete(owner);this.active=task;task.postedAt=performance.now();
  this.timer=setTimeout(()=>this.fail('Territory preparation timed out'),this.timeoutMs);
  try{const inputStarted=performance.now(),input=this.inputFormat==='json'?{json:JSON.stringify(task.raw)}:{raw:task.raw};task.inputSerializeMs=performance.now()-inputStarted;const posted=performance.now();this.worker.postMessage({id:task.id,protocol:TERRITORY_FRAME_PROTOCOL,...input,mode:task.mode});task.postMessageMs=performance.now()-posted;task.raw=null;this.stats.posted++;}
  catch{this.fail('Territory worker input failed');}
 }
 fail(message){
  if(this.closed)return;const error=unavailable(message);
  if(this.active&&!this.active.canceled)this.active.reject(error);for(const task of this.waiting.values())task.reject(error);this.waiting.clear();this.close();
 }
 close(){if(this.closed)return;this.closed=true;clearTimeout(this.timer);this.worker.terminate();this.active=null;this.waiting.clear();}
}
export function acquireTerritoryWorker(){
 if(globalThis.__MERIDIAN_FRAME_TRANSPORT__==='json'||typeof Worker!=='function'||typeof document==='undefined')return null;
 if(typeof globalThis.navigator?.deviceMemory==='number'&&navigator.deviceMemory<=4)return null;
 try{if(!sharedPool||sharedPool.closed)sharedPool=new TerritoryWorkerPool({inputFormat:globalThis.__MERIDIAN_FRAME_INPUT__==='json'?'json':'object'});return sharedPool.acquire();}catch{return null;}
}
