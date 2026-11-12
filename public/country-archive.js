import {countryAlias} from './country-names.js?v=3.58.0-4e6c095f36aa';
export {countryAlias} from './country-names.js?v=3.58.0-4e6c095f36aa';
// CShapes data is independently licensed CC BY-NC-SA 4.0; see data/cshapes/.
const ROOT='data/cshapes/',pending=new Map();let catalogPromise,catalogValue;
export const countrySnapshot=year=>Number.isInteger(year)&&year>=1886&&year<=2023?`${year}-07-01`:null;
export const countryVisible=(r,date)=>typeof date==='string'&&r.startDate<=date&&date<=r.endDate;
export const countryName=(r,lang,date)=>{const alias=countryAlias(r,date);return lang==='en'?(alias?.en||r.name):(alias?.zh||r.zhName||r.name);};
export const countryStatus=(value,lang)=>({independent:['独立国家','Independent state'],colony:['殖民地','Colony'],protectorate:['保护国','Protectorate'],occupied:['被占领地区','Occupied territory'],mandate:['委任统治地','Mandated territory']}[value]||['未记载','Not recorded'])[lang==='en'?1:0];
async function readArchive(file){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{const r=await fetch(ROOT+file,{signal:controller.signal});if(!r.ok)throw Error('CShapes '+r.status);const b=new Uint8Array(await r.arrayBuffer());return b[0]===31&&b[1]===139?await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).json():JSON.parse(new TextDecoder().decode(b));}
 finally{clearTimeout(timer);}
}
export function loadCountryCatalog(){
 if(!catalogPromise)catalogPromise=readArchive('catalog.json.gz').then(c=>{if(!Array.isArray(c.records)||!Array.isArray(c.packs)||c.range?.[0]!==1886||c.range?.[1]!==2023)throw Error('Invalid CShapes catalog');catalogValue=c;return c;}).catch(e=>{catalogPromise=null;throw e;});return catalogPromise;
}
function loadPack(file){
 if(pending.has(file)){const entry=pending.get(file);pending.delete(file);pending.set(file,entry);return entry.promise;}
 const entry={data:null,promise:null};entry.promise=readArchive(file).then(data=>{entry.data=data;return data;});pending.set(file,entry);entry.promise.catch(()=>{if(pending.get(file)===entry)pending.delete(file);});while(pending.size>3)pending.delete(pending.keys().next().value);return entry.promise;
}
function datedFrame(catalog,geometries,date){
 const records=catalog.records.filter(r=>countryVisible(r,date));
 if(!records.length||records.some(r=>!r.id||!['Polygon','MultiPolygon'].includes(geometries[r.geometryId]?.type)))throw Error('Incomplete CShapes frame');
 return {catalog,date,records,geometries};
}
// Reuse the same three-pack LRU, never a second geometry cache or another year's frame.
export function cachedCountryFrame(year){
 const date=countrySnapshot(year);if(!date||!catalogValue)return null;
 const pack=catalogValue.packs.find(p=>p.decade===Math.floor(year/10)*10),entry=pack&&pending.get(pack.file);
 if(!entry?.data)return null;
 try{const frame=datedFrame(catalogValue,entry.data,date);pending.delete(pack.file);pending.set(pack.file,entry);return frame;}catch{return null;}
}
export async function loadCountryFrame(year){
 const date=countrySnapshot(year);if(!date)throw Error('CShapes date outside coverage');
 const catalog=await loadCountryCatalog(),decade=Math.floor(year/10)*10,pack=catalog.packs.find(p=>p.decade===decade);if(!pack)throw Error('CShapes decade missing');
 return datedFrame(catalog,await loadPack(pack.file),date);
}
export function countryFeatures(frame,color){return frame.records.map(r=>({type:'Feature',properties:{id:r.id,record_id:r.id,archive:'cshapes',name:countryName(r,'en',frame.date),source_name:r.name,name_en:countryName(r,'en',frame.date),name_zh:countryName(r,'zh',frame.date),start_date:r.startDate,end_date:r.endDate,color:color(r.name)},geometry:frame.geometries[r.geometryId]}));}
