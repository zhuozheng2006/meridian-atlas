import {countryAlias} from './country-names.js?v=3.41.0-ded029edf830';
export {countryAlias} from './country-names.js?v=3.41.0-ded029edf830';
// CShapes data is independently licensed CC BY-NC-SA 4.0; see data/cshapes/.
const ROOT='data/cshapes/',pending=new Map();let catalogPromise;
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
 if(!catalogPromise)catalogPromise=readArchive('catalog.json.gz').then(c=>{if(!Array.isArray(c.records)||!Array.isArray(c.packs)||c.range?.[0]!==1886||c.range?.[1]!==2023)throw Error('Invalid CShapes catalog');return c;}).catch(e=>{catalogPromise=null;throw e;});return catalogPromise;
}
function loadPack(file){
 if(pending.has(file)){const p=pending.get(file);pending.delete(file);pending.set(file,p);return p;}
 const p=readArchive(file);pending.set(file,p);p.catch(()=>{if(pending.get(file)===p)pending.delete(file);});while(pending.size>3)pending.delete(pending.keys().next().value);return p;
}
export async function loadCountryFrame(year){
 const date=countrySnapshot(year);if(!date)throw Error('CShapes date outside coverage');
 const catalog=await loadCountryCatalog(),decade=Math.floor(year/10)*10,pack=catalog.packs.find(p=>p.decade===decade);if(!pack)throw Error('CShapes decade missing');
 const geometries=await loadPack(pack.file),records=catalog.records.filter(r=>countryVisible(r,date));
 if(!records.length||records.some(r=>!r.id||!['Polygon','MultiPolygon'].includes(geometries[r.geometryId]?.type)))throw Error('Incomplete CShapes frame');
 return {catalog,date,records,geometries};
}
export function countryFeatures(frame,color){return frame.records.map(r=>({type:'Feature',properties:{id:r.id,record_id:r.id,archive:'cshapes',name:countryName(r,'en',frame.date),source_name:r.name,name_en:countryName(r,'en',frame.date),name_zh:countryName(r,'zh',frame.date),start_date:r.startDate,end_date:r.endDate,color:color(r.name)},geometry:frame.geometries[r.geometryId]}));}
