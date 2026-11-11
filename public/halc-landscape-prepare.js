// Runs in the landscape preparation worker. Source geometries are never simplified.
import {HALC_LANDSCAPE_CLASSES} from './halc-landscape-reader.js?v=3.50.0-ac226550198f';
const classes=new Set(HALC_LANDSCAPE_CLASSES.map(c=>c.code));
export function landscapeIntersects(a,b){
 if(!a||!b||a[3]<b[1]||a[1]>b[3])return false;
 let east=b[2];while(east<b[0])east+=360;if(east-b[0]>=360)return true;
 const shift=Math.floor((b[0]-a[0])/360)*360;return [shift,shift+360].some(s=>a[0]+s<=east&&a[2]+s>=b[0]);
}
export const selectLandscapeShards=(index,bounds)=>index.shards.filter(s=>landscapeIntersects(s.bbox,bounds)&&s.features.some(f=>landscapeIntersects(f.bbox,bounds)));
const now=()=>performance.now();
export const LANDSCAPE_DATA_PREFIX='data:application/geo+json;base64,';
export function landscapeDataURL(text){
 const blob=new Blob([text],{type:'application/geo+json'});
 // Dedicated workers can encode the UTF-8 Blob without constructing a large
 // intermediate JavaScript binary string. No object URL or revocation is used.
 if(typeof FileReaderSync==='function')return {dataURL:new FileReaderSync().readAsDataURL(blob),jsonBytes:blob.size};
 const bytes=new TextEncoder().encode(text);
 if(typeof bytes.toBase64==='function')return {dataURL:LANDSCAPE_DATA_PREFIX+bytes.toBase64(),jsonBytes:bytes.byteLength};
 const parts=[],stride=3*8192;
 for(let start=0;start<bytes.length;start+=stride)parts.push(btoa(String.fromCharCode(...bytes.subarray(start,start+stride))));
 return {dataURL:LANDSCAPE_DATA_PREFIX+parts.join(''),jsonBytes:bytes.byteLength};
}
export class LandscapeArchive{
 constructor({baseURL,fetch:fetcher=globalThis.fetch.bind(globalThis)}={}){this.baseURL=baseURL;this.fetch=fetcher;this.entries=new Map();}
 forget(file){this.entries.delete(file);}
 get(file){
  if(!/^(?:index\.json\.gz|shards\/[A-Za-z0-9+_-]+\.geojson\.gz)$/.test(file))throw Error('Invalid landscape path');
  if(this.entries.has(file))return this.entries.get(file);
  const pending=this.read(file);this.entries.set(file,pending);
  pending.catch(()=>{if(this.entries.get(file)===pending)this.entries.delete(file);});return pending;
 }
 async read(file){
  const controller=new AbortController();let timer=setTimeout(()=>controller.abort(),45000);
  const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(),20000);},start=now();
  try{
   const response=await this.fetch(new URL(file,this.baseURL).href,{signal:controller.signal,cache:'no-cache',priority:'auto'});
   if(!response.ok)throw Error(`Landscape request failed: ${response.status}`);
   const reader=response.body.getReader(),chunks=[];let total=0;
   for(;;){const{done,value}=await reader.read();if(done)break;chunks.push(value);total+=value.length;arm();}
   const networkEnd=now(),bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   const text=bytes[0]===31&&bytes[1]===139?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text():new TextDecoder().decode(bytes);
   const decodeEnd=now(),data=JSON.parse(text),end=now();
   return {data,metrics:{file,bytes:total,textBytes:new TextEncoder().encode(text).byteLength,readMs:networkEnd-start,decodeMs:decodeEnd-networkEnd,parseMs:end-decodeEnd}};
  }finally{clearTimeout(timer);}
 }
 async prepare(bounds,current=()=>true){
  const start=now(),files=[];
  const read=async file=>{const cached=this.entries.has(file),result=await this.get(file);files.push({...result.metrics,cached});return result.data;};
  const index=await read('index.json.gz');if(!current())return null;
  if(index.schemaVersion!==1||index.snapshotYear!==1500||!Array.isArray(index.shards)){this.forget('index.json.gz');throw Error('Invalid landscape snapshot');}
  const shards=selectLandscapeShards(index,bounds),features=[];let cursor=0;
  const outcomes=await Promise.allSettled(Array.from({length:Math.min(3,shards.length)},async()=>{while(cursor<shards.length&&current()){
   const shard=shards[cursor++],data=await read(shard.file);if(!current())return;
   if(data.type!=='FeatureCollection'||!Array.isArray(data.features)||data.features.length!==shard.count){this.forget(shard.file);throw Error('Invalid landscape shard');}
   const ids=new Set(shard.features.filter(f=>landscapeIntersects(f.bbox,bounds)).map(f=>f.id));
   for(const feature of data.features){if(!classes.has(feature.properties?.LANDSCAPE)){this.forget(shard.file);throw Error('Unknown landscape class');}if(ids.has(feature.id))features.push(feature);}
  }}));
  if(!current())return null;if(outcomes.some(r=>r.status==='rejected'))throw Error('Landscape load failed');
  features.sort((a,b)=>a.id-b.id);
  // Give newer viewport/cancel messages a chance to arrive before the largest CPU step.
  await new Promise(resolve=>setTimeout(resolve,0));if(!current())return null;
  const prepared=now(),text=JSON.stringify({type:'FeatureCollection',features}),serialized=now();
  const {dataURL,jsonBytes}=landscapeDataURL(text),encoded=now();
  // The panel uses original non-geometry fields; complete geometries remain in
  // the self-contained URL and are parsed/indexed only in the map worker.
  const records=features.map(({geometry,...record})=>record);
  return {dataURL,records,metrics:{timeOrigin:performance.timeOrigin,startedAt:start,files,featureCount:features.length,jsonBytes,dataURLChars:dataURL.length,loadAndSelectMs:prepared-start,stringifyMs:serialized-prepared,base64Ms:encoded-serialized,recordsMs:now()-encoded,totalMs:now()-start}};
 }
}
