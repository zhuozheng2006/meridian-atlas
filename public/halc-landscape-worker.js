import {LandscapeArchive} from './halc-landscape-prepare.js?v=3.57.0-100cb4a60c31';
const tasks=new Map();let archive;
self.addEventListener('message',async({data})=>{
 const {type,owner,id}=data||{};
 if(type==='init'){
  try{const base=new URL(data.baseURL,self.location.href);
   if(base.origin!==self.location.origin||!base.pathname.endsWith('/data/halc-landscape/'))throw Error('Invalid landscape root');
   archive??=new LandscapeArchive({baseURL:base.href});
  }catch{self.postMessage({type:'unavailable'});}
  return;
 }
 if(type==='cancel'){tasks.delete(owner);return;}
 if(type!=='prepare'||!archive)return;
 tasks.set(owner,id);const current=()=>tasks.get(owner)===id;
 try{const result=await archive.prepare(data.bounds,current);if(result&&current())self.postMessage({id,...result});}
 catch(error){if(current())self.postMessage({id,error:{message:error.message}});}
 finally{if(current())tasks.delete(owner);}
});
