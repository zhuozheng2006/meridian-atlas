import {PolarisStore,SNAPSHOT} from './polaris-store.js?v=3.58.1-c7e43da44e1e';
import {exportPayload} from './polaris-adapter.js?v=3.58.1-c7e43da44e1e';
let store=null,queue=Promise.resolve();const requests=new Map();
const identity={datasetId:SNAPSHOT.datasetId,version:SNAPSHOT.version,sourceSha256:SNAPSHOT.sourceSha256};
function error(id,value){self.postMessage({kind:'error',id,name:value?.name==='AbortError'?'AbortError':'Error',message:value?.message||'Research failed'});}
self.onmessage=event=>{
 const message=event.data;if(!message||typeof message!=='object')return;
 if(message.kind==='init'){
  if(store)return;try{const base=new URL(message.dataBaseUrl);if(base.origin!==new URL(self.location.href).origin||!base.pathname.endsWith('/data/seshat-polaris-2026/')||base.search||base.hash)throw Error('Invalid research data origin');store=new PolarisStore({dataBaseUrl:base});self.postMessage({kind:'ready',...identity});}catch(e){error(null,e);}return;
 }
 if(message.kind==='cancel'){requests.get(message.id)?.abort();return;}
 if(message.kind!=='request'||!Number.isSafeInteger(message.id)||message.id<1||requests.has(message.id))return;
 if(!store||!['search','collect','serialize'].includes(message.operation)){error(message.id,new Error('Invalid background research operation'));return;}
 const controller=new AbortController();requests.set(message.id,controller);
 // Serialize jobs so an obsolete scan cannot compete for memory with its replacement.
 queue=queue.catch(()=>{}).then(async()=>{
  try{
   if(controller.signal.aborted)throw new DOMException('Aborted','AbortError');const options={...message.options,signal:controller.signal,onProgress:progress=>{if(!controller.signal.aborted)self.postMessage({kind:'progress',id:message.id,progress});}};
   const result=message.operation==='search'?await store.search(message.filters,options):await store.collectSearch(message.filters,options);
   if(controller.signal.aborted)return;
   if(message.operation==='serialize'){
    const index=await store.loadIndex(controller.signal);if(controller.signal.aborted)return;const payload=exportPayload(result.rows,{filters:result.filters,scope:'cross-phase-filter'});payload.metadataScope='phase-index-context';const ids=new Set(result.rows.map(r=>r.raw.polity_id));payload.phaseContexts=index.polities.filter(p=>ids.has(p.id));
    const bytes=new TextEncoder().encode(JSON.stringify(payload,null,2)+'\n');if(controller.signal.aborted)return;self.postMessage({kind:'result',id:message.id,...identity,result:bytes.buffer},[bytes.buffer]);
   }else self.postMessage({kind:'result',id:message.id,...identity,result});
  }catch(e){if(!controller.signal.aborted)error(message.id,e);}finally{requests.delete(message.id);}
 });
};
