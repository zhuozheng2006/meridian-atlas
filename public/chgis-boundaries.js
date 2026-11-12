import {readJSON,forgetJSON} from './map-engine.js?v=3.58.0-4e6c095f36aa';
export const chgisDisplayNames={'浔阳郡':'Xunyang Jun','鄱阳郡':'Poyang Jun','新定郡':'Xinding Jun','会稽郡':'Kuaiji Jun','义兴郡':'Yixing Jun'};
const ROOT='data/chgis/',packs=new Map();let indexPromise;
export const chgisCoversYear=year=>Number.isInteger(year)&&year!==0&&year>=-224&&year<=1911;
export const CHGIS_WINDOW={id:'chgis-prefectures',zh:'中国历史府级区划',en:'Chinese historical prefectures',root:ROOT,bounds:[106.60376,18.160896,124.576195,35.726135],years:{includes:chgisCoversYear}};
export function chgisWindowFor(bounds,year){
 if(!bounds||!chgisCoversYear(year))return null;
 const x=(bounds.getWest()+bounds.getEast())/2,y=(bounds.getSouth()+bounds.getNorth())/2,b=CHGIS_WINDOW.bounds;
 return Number.isFinite(x)&&Number.isFinite(y)&&x>=b[0]&&x<=b[2]&&y>=b[1]&&y<=b[3]?CHGIS_WINDOW:null;
}
export function decodeChgisPack(pack){
 if(pack?.schemaVersion!==1||pack.encoding!=='chgis-delta-1e6'||!pack.geometries)throw Error('Invalid CHGIS pack');
 const ring=values=>{if(!Array.isArray(values)||values.length<8||values.length%2)throw Error('Invalid CHGIS ring');let x=0,y=0;const out=[];for(let i=0;i<values.length;i+=2){if(!Number.isSafeInteger(values[i])||!Number.isSafeInteger(values[i+1]))throw Error('Invalid CHGIS coordinate');x+=values[i];y+=values[i+1];if(Math.abs(x)>180e6||Math.abs(y)>90e6)throw Error('CHGIS coordinate out of bounds');out.push([x/1e6,y/1e6]);}if(out[0][0]!==out.at(-1)[0]||out[0][1]!==out.at(-1)[1])throw Error('Unclosed CHGIS ring');return out;};
 return Object.fromEntries(Object.entries(pack.geometries).map(([id,g])=>{if(!['Polygon','MultiPolygon'].includes(g.type))throw Error('Invalid CHGIS geometry');return [id,{type:g.type,coordinates:g.type==='Polygon'?g.coordinates.map(ring):g.coordinates.map(p=>p.map(ring))}];}));
}
export function chgisFeatures(index,geometries,year){
 if(!chgisCoversYear(year))return [];
 return index.records.filter(r=>r.start<=year&&year<=r.end).map(r=>{
  const p=r.sourceRecord,g=geometries[r.geometryId];if(!g)throw Error('Incomplete CHGIS frame');
  return {type:'Feature',properties:{id:r.id,osm_id:-1000000000-r.row,record_id:r.id,archive:'chgis',type:'administrative',admin_level:4,name:p.NAME_CH,name_zh:p.NAME_CH,name_en:chgisDisplayNames[p.NAME_CH]||p.NAME_PY,source_pinyin:p.NAME_PY,start_date:String(r.start),end_date:String(r.end),start_decdate:r.start<0?r.start+1:r.start,end_decdate:(r.end<0?r.end+1:r.end)+.9999,source_id:p.SYS_ID,source_row:r.row,source_note:p.NOTE_ID,begin_rule:p.BEG_RULE,end_rule:p.END_RULE,begin_change:p.BEG_CHG_TYPE||'',end_change:p.END_CHG_TYPE||'',compiler:p.COMPILER,geometry_compiler:p.GECOMPLR},geometry:g};
 });
}
export async function loadChgisIndex(){
 if(!indexPromise)indexPromise=readJSON(ROOT+'index.json.gz').then(index=>{if(index?.schemaVersion!==1||!Array.isArray(index.records)||index.records.length!==2016)throw Error('Invalid CHGIS index');return index;}).catch(error=>{indexPromise=null;forgetJSON(ROOT+'index.json.gz');throw error;});return indexPromise;
}
export async function readChgisSnapshot(year){
 if(!chgisCoversYear(year))throw Error('Year outside CHGIS');
 const start=Math.floor(year/100)*100,url=ROOT+'century-'+start+'.json.gz';let pending=packs.get(start);
 if(!pending){pending=readJSON(url).then(pack=>{if(pack.start!==start||pack.end!==start+99)throw Error('Wrong CHGIS century');return decodeChgisPack(pack);}).finally(()=>forgetJSON(url));packs.set(start,pending);pending.catch(()=>{if(packs.get(start)===pending)packs.delete(start);});}
 packs.delete(start);packs.set(start,pending);while(packs.size>3)packs.delete(packs.keys().next().value);
 const [index,geometries]=await Promise.all([loadChgisIndex(),pending]),features=chgisFeatures(index,geometries,year);
 return {type:'FeatureCollection',metadata:{source:'CHGIS V4',window:CHGIS_WINDOW,year,relationCount:features.length,datePrecision:'year'},features};
}
export async function chgisRecord(id,year){const index=await loadChgisIndex(),record=index.records.find(r=>r.id===id),frame=await readChgisSnapshot(year);return record?{source:index.metadata,record,geometry:frame.features.find(f=>f.properties.id===id)?.geometry}:null;}
