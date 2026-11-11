import {readJSON,forgetJSON} from './map-engine.js?v=3.54.0-440274174472';
import {nativeTemporalBundles} from './native-temporal-index.js?v=3.54.0-440274174472';
const native=new Map(),failedBundles=new Set(),pendingBundles=new Map(),loadedBundles=new Set();
const bootYears=new Set([-3400,-221,1,500,1000,1492,1500,1750,1914,1945,1991,2024]);
export const hasNativeBootstrap=year=>bootYears.has(year);
export const nativeGeometry=id=>native.get(id);
function validGeometry(g){
 if(!g||!['Polygon','MultiPolygon'].includes(g.type)||!Array.isArray(g.coordinates)||!g.coordinates.length)return false;
 const polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;
 return polygons.every(p=>Array.isArray(p)&&p.length&&p.every(r=>Array.isArray(r)&&r.length>=4&&r.every(c=>Array.isArray(c)&&c.length>=2&&Number.isFinite(c[0])&&Number.isFinite(c[1]))));
}
async function checkedJSON(url,validate){const value=await readJSON(url);if(!validate(value)){forgetJSON(url);throw Error('Invalid territory resource: '+url);}return value;}
// Native packs are smaller than the aggregate legacy overview shards. Do not
// start those competing downloads merely because a healthy request is slow.
// readJSON still enforces connection/stall timeouts; actual failures may fall back.
export const loadNativeFrame=(records,year,keepGoing=()=>true)=>loadNative(records,year,keepGoing,{bundlesOnly:true});
function validPack(p,records){
 if(!p?.recordIndex||!p.geometries||typeof p.recordIndex!=='object'||typeof p.geometries!=='object'||Array.isArray(p.recordIndex)||Array.isArray(p.geometries))return false;
 const entries=Object.entries(p.recordIndex),geometries=Object.values(p.geometries);
 return entries.length>0&&geometries.length>0&&geometries.every(validGeometry)&&
  records.every(r=>Object.hasOwn(p.recordIndex,r.id))&&entries.every(([,gid])=>typeof gid==='string'&&Object.hasOwn(p.geometries,gid));
}
function frameBundle(year){
 if(!Number.isInteger(year)||year===0)return null;
 if(bootYears.has(year))return {url:`data/native/year-${year}.json.gz`,valid:p=>p?.year===year};
 const slot=nativeTemporalBundles.find(([start,end])=>start<=year&&year<=end);
 if(!slot)return null;
 const[start,end,file]=slot;return {url:'data/native/'+file,valid:p=>p?.version===1&&p.start===start&&p.end===end};
}
async function cacheBundle(bundle,records=[]){
 const {url}=bundle;let pending=pendingBundles.get(url);
 if(!pending&&!loadedBundles.has(url)){
  pending=(async()=>{
   try{
    const pack=await checkedJSON(url,p=>bundle.valid(p)&&validPack(p,[]));
    for(const[id,gid]of Object.entries(pack.recordIndex))native.set(id,pack.geometries[gid]);
    loadedBundles.add(url);failedBundles.delete(url);
   }catch(error){failedBundles.add(url);throw error;}
   finally{forgetJSON(url);pendingBundles.delete(url);}
  })();pendingBundles.set(url,pending);
 }
 if(pending)await pending;
 // Prefetch has no catalog yet. The actual frame must still prove its complete
 // record coverage, including aliases; a valid but incomplete pack is not a frame.
 if(!records.every(r=>native.has(r.id))){loadedBundles.delete(url);failedBundles.add(url);throw Error('Incomplete territory resource: '+url);}
}
// Warm exactly the selected year's one small pack while the catalog/renderer load.
// Cancellation never aborts a shared fetch used by another map. Late valid data may
// enter the geometry cache; only AtlasMap's current request may commit a frame.
export async function prefetchNativeFrame(year,keepGoing=()=>true){
 const bundle=frameBundle(year);if(!bundle||!keepGoing())return false;
 try{await cacheBundle(bundle);return keepGoing();}catch{return false;}
}
export async function loadNative(records,year,keepGoing=()=>true,{bundlesOnly=false}={}){
 if(records.every(r=>native.has(r.id))||!keepGoing())return native;
 if(bootYears.has(year)){
  const url=`data/native/year-${year}.json.gz`;
  if(bundlesOnly||!failedBundles.has(url)){
   try{
    await cacheBundle({url,valid:p=>p?.year===year},records);
   }catch{
    failedBundles.add(url);
    if(bundlesOnly)return native;
    // A broken optional bootstrap must not block the independently indexed files.
    // Background upgrades skip it; a later first-frame request may retry it.
   }
  }
 }
 let missing=records.filter(r=>!native.has(r.id));
 if(missing.length&&keepGoing()){
  // The tiny generated lookup locates a dated pack without downloading the full
  // record-to-file index. That index is only needed for independent-file recovery.
  const slot=nativeTemporalBundles.find(([start,end])=>start<=year&&year<=end);
  if(slot&&(bundlesOnly||missing.length>=8)&&missing.every(r=>r.type==='POLITY'&&r.start<=year&&year<=r.end)&&(bundlesOnly||!failedBundles.has('data/native/'+slot[2]))){
   const[start,end,file]=slot,url='data/native/'+file;
   try{
    await cacheBundle({url,valid:p=>p?.version===1&&p.start===start&&p.end===end},missing);
   }catch{
    failedBundles.add(url);
    // First-frame callers can immediately fall back to the old overview. A following
    // upgrade skips this failed optional pack and reads exact individual files.
    // A later first-frame request retries the pack, so this hint is not permanent.
   }
   missing=records.filter(r=>!native.has(r.id));
  }
  if(bundlesOnly||!missing.length||!keepGoing())return native;
  const index=await checkedJSON('data/native/index.json.gz',i=>i?.recordIndex&&i.geometryIndex&&missing.every(r=>typeof i.geometryIndex[i.recordIndex[r.id]]==='string'));
  if(!keepGoing())return native;
  const byFile=new Map();
  for(const r of missing){const gid=index.recordIndex[r.id],file=index.geometryIndex[gid];if(!byFile.has(file))byFile.set(file,[]);byFile.get(file).push([r.id,gid]);}
  const jobs=[...byFile];let cursor=0;
  await Promise.all(Array.from({length:Math.min(6,jobs.length)},async()=>{while(cursor<jobs.length&&keepGoing()){const[file,entries]=jobs[cursor++];const data=await checkedJSON('data/native/'+file,d=>d&&entries.every(([,gid])=>validGeometry(d[gid])));for(const[id,gid]of entries)native.set(id,data[gid]);}}));
 }
 return native;
}
