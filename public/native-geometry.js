import {readJSON,forgetJSON} from './map-engine.js?v=3.2.0-a6cebd0ac9b0';
const native=new Map();
const bootYears=new Set([-3400,-221,1,500,1000,1492,1750,1914,1945,1991,2024]);
export const nativeGeometry=id=>native.get(id);
function validGeometry(g){
 if(!g||!['Polygon','MultiPolygon'].includes(g.type)||!Array.isArray(g.coordinates)||!g.coordinates.length)return false;
 const polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;
 return polygons.every(p=>Array.isArray(p)&&p.length&&p.every(r=>Array.isArray(r)&&r.length>=4&&r.every(c=>Array.isArray(c)&&c.length>=2&&Number.isFinite(c[0])&&Number.isFinite(c[1]))));
}
async function checkedJSON(url,validate){const value=await readJSON(url);if(!validate(value)){forgetJSON(url);throw Error('Invalid territory resource: '+url);}return value;}
export async function loadNative(records,year,keepGoing=()=>true){
 if(records.every(r=>native.has(r.id)))return native;
 if(bootYears.has(year)){
  const pack=await checkedJSON(`data/native/year-${year}.json.gz`,p=>p?.year===year&&p.recordIndex&&p.geometries&&records.every(r=>validGeometry(p.geometries[p.recordIndex[r.id]])));
  for(const [id,gid]of Object.entries(pack.recordIndex))native.set(id,pack.geometries[gid]);
 }
 const missing=records.filter(r=>!native.has(r.id));
 if(missing.length){
  const index=await checkedJSON('data/native/index.json.gz',i=>i?.recordIndex&&i.geometryIndex&&missing.every(r=>typeof i.geometryIndex[i.recordIndex[r.id]]==='string'));
  const byFile=new Map();
  for(const r of missing){const gid=index.recordIndex[r.id],file=index.geometryIndex[gid];if(!byFile.has(file))byFile.set(file,[]);byFile.get(file).push([r.id,gid]);}
  const jobs=[...byFile];let cursor=0;
  await Promise.all(Array.from({length:Math.min(6,jobs.length)},async()=>{while(cursor<jobs.length&&keepGoing()){const[file,entries]=jobs[cursor++];const data=await checkedJSON('data/native/'+file,d=>d&&entries.every(([,gid])=>validGeometry(d[gid])));for(const[id,gid]of entries)native.set(id,data[gid]);}}));
 }
 return native;
}
