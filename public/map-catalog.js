// A map uses the complete source rows relevant to its date window. Search and
// reading keep their separate, full-catalog contract in app.js.
const ROOT='data/fast/map-catalog/',MIN_YEAR=-3400,MAX_YEAR=2024;
const civilYear=year=>year>0?year-1:year;
const historicalYear=year=>year>=0?year+1:year;
export function mapCatalogRange(year){
 if(!Number.isInteger(year)||year===0)throw RangeError('A catalog year must be a nonzero integer');
 if(year<MIN_YEAR||year>MAX_YEAR)return null;
 const start=Math.floor(civilYear(year)/25)*25;
 return [Math.max(MIN_YEAR,historicalYear(start)),Math.min(MAX_YEAR,historicalYear(start+24))];
}
export function mapCatalogPath(year){const range=mapCatalogRange(year);return ROOT+(range?`years-${range[0]}-${range[1]}.json.gz`:'empty.json.gz');}
function validCatalog(value,range){
 const scope=value?.mapCatalog;
 if(value?.version!==2||scope?.schemaVersion!==1||!Array.isArray(value.records)||!value.geometryIndex||typeof value.geometryIndex!=='object'||!value.metadata||!Array.isArray(value.changeYears))throw Error('Invalid map catalog structure');
 if(!Array.isArray(scope.range)&&scope.range!==null||JSON.stringify(scope.range)!==JSON.stringify(range))throw Error('Map catalog date range mismatch');
 if(!/^[a-f0-9]{64}$/.test(scope.sourceCatalogSHA256)||scope.sourceRecordCount!==value.metadata.counts?.records)throw Error('Invalid map catalog source identity');
 if(!range&&(value.records.length||Object.keys(value.geometryIndex).length))throw Error('Out-of-range map catalog must be empty');
 const ids=new Set();
 for(const r of value.records){
  if(!r||typeof r.id!=='string'||ids.has(r.id)||!Number.isInteger(r.start)||!Number.isInteger(r.end)||r.start>r.end||!['POLITY','RELATION'].includes(r.type)||typeof r.name!=='string'||!Number.isFinite(r.area)||!Array.isArray(r.center)||r.center.length!==2||!r.center.every(Number.isFinite)||!/^geometries-\d{3}\.json$/.test(value.geometryIndex[r.geometryId]||'')||r.start>range[1]||r.end<range[0])throw Error('Invalid map catalog record');
  ids.add(r.id);
 }
 for(let i=0;i<value.changeYears.length;i++){const y=value.changeYears[i];if(!Number.isInteger(y)||!y||y<MIN_YEAR||y>MAX_YEAR||i&&y<=value.changeYears[i-1])throw Error('Invalid map catalog change years');}
 return value;
}
export function createMapCatalogLoader(readJSON,forgetJSON=()=>{}){
 const pending=new Map();
 return {forYear(year){
  const range=mapCatalogRange(year),path=mapCatalogPath(year);
  if(!pending.has(path)){
   const request=Promise.resolve().then(()=>readJSON(path)).then(value=>validCatalog(value,range)).catch(error=>{pending.delete(path);forgetJSON(path);throw error;});
   pending.set(path,request);
  }
  return pending.get(path);
 }};
}
