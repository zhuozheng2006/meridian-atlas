import {countryAlias} from './country-names.js?v=4.13.0-f69e1c6cb88b';
export {countryAlias} from './country-names.js?v=4.13.0-f69e1c6cb88b';
// CShapes data is independently licensed CC BY-NC-SA 4.0; see data/cshapes/.
const ROOT='data/cshapes/',pending=new Map(),COUNTRY_ZH_FIX=new Map([['Inini','伊尼尼领地'],['Belarus (Byelorussia)','白俄罗斯'],['Myanmar (Burma)','缅甸'],['Cambodia (Kampuchea)','柬埔寨']]);let catalogPromise,catalogValue;
export const countrySnapshot=year=>Number.isInteger(year)&&year>=1886&&year<=2023?`${year}-07-01`:null;
export const countryVisible=(r,date)=>typeof date==='string'&&r.startDate<=date&&date<=r.endDate;
export const countryName=(r,lang,date)=>{const alias=countryAlias(r,date);return lang==='en'?(alias?.en||r.name):(alias?.zh||COUNTRY_ZH_FIX.get(r?.name)||(r?.zhName&&r.zhName!==r.name?r.zhName:'')||r.zhName||r.name);};
export const countryStatus=(value,lang)=>({independent:['独立国家','Independent state'],colony:['殖民地','Colony'],protectorate:['保护国','Protectorate'],occupied:['被占领地区','Occupied territory'],mandate:['委任统治地','Mandated territory']}[value]||['未记载','Not recorded'])[lang==='en'?1:0];
async function readArchive(file,priority='auto'){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{const r=await fetch(ROOT+file,{signal:controller.signal,priority});if(!r.ok)throw Error('CShapes '+r.status);const b=new Uint8Array(await r.arrayBuffer());return b[0]===31&&b[1]===139?await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).json():JSON.parse(new TextDecoder().decode(b));}
 finally{clearTimeout(timer);}
}
export function loadCountryCatalog(priority='auto'){
 if(!catalogPromise)catalogPromise=readArchive('catalog.json.gz',priority).then(c=>{if(!Array.isArray(c.records)||!Array.isArray(c.packs)||c.range?.[0]!==1886||c.range?.[1]!==2023)throw Error('Invalid CShapes catalog');catalogValue=c;return c;}).catch(e=>{catalogPromise=null;throw e;});return catalogPromise;
}
function loadPack(file,priority='auto'){
 if(pending.has(file)){const entry=pending.get(file);pending.delete(file);pending.set(file,entry);return entry.promise;}
 const entry={data:null,promise:null};entry.promise=readArchive(file,priority).then(data=>{entry.data=data;return data;});pending.set(file,entry);entry.promise.catch(()=>{if(pending.get(file)===entry)pending.delete(file);});while(pending.size>3)pending.delete(pending.keys().next().value);return entry.promise;
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
export async function loadCountryFrame(year,{priority='auto'}={}){
 const date=countrySnapshot(year);if(!date)throw Error('CShapes date outside coverage');
 const catalog=await loadCountryCatalog(priority),decade=Math.floor(year/10)*10,pack=catalog.packs.find(p=>p.decade===decade);if(!pack)throw Error('CShapes decade missing');
 return datedFrame(catalog,await loadPack(pack.file,priority),date);
}
export function countryFeatures(frame,color){return frame.records.map(r=>({type:'Feature',properties:{id:r.id,record_id:r.id,archive:'cshapes',name:countryName(r,'en',frame.date),source_name:r.name,name_en:countryName(r,'en',frame.date),name_zh:countryName(r,'zh',frame.date),start_date:r.startDate,end_date:r.endDate,color:color(r.name)},geometry:frame.geometries[r.geometryId]}));}
