// Builds the frozen OpenHistoricalMap extract used by the regional detail layer at 1492 and 1500.
//
//   node scripts/ohm/build-ohm-1500.mjs --fetch          # query OHM Overpass, cache the raw answers
//   node scripts/ohm/build-ohm-1500.mjs                  # rebuild from the cached raw answers
//
// The extract keeps the source geometry untouched: member ways of every boundary relation are
// chained in their original order, coordinates are never simplified, rounded or repaired, and
// holes and multiple polygons are preserved. Relations whose member ways do not form a closed
// ring are reported and excluded instead of being patched up.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const ENDPOINT='https://overpass-api.openhistoricalmap.org/api/interpreter';
const BBOX=[44.0,4.5,50.5,14.5];              // south,west,north,east
const LEVELS=[2,3,4];
const YEARS=[1492,1500];
const OUT=path.resolve(root,'public/data/ohm-1500');
const CACHE=path.resolve(root,'scripts/ohm/.cache');
const args=process.argv.slice(2);
const flag=name=>args.includes('--'+name);
const value=(name,fallback)=>args.includes('--'+name)?args[args.indexOf('--'+name)+1]:fallback;
const TAGS_FILE=path.resolve(value('tags',path.join(CACHE,'ohm-admin-tags.json')));
const GEOM_FILE=path.resolve(value('geom',path.join(CACHE,'ohm-admin-geom.json')));
const USER_AGENT='meridian-atlas/3.9.4 (frozen regional extract; +https://github.com/openhistoricalmap)';

const sha256=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const redact=url=>url.replaceAll(/timestamp_osm_base[^,]*/g,'timestamp_osm_base:REDACTED');

async function overpass(query,label){
 const body=new URLSearchParams({data:query});
 const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':USER_AGENT,'Accept':'application/json'},body});
 if(!response.ok)throw Error('Overpass '+label+' failed: '+response.status+' '+response.statusText);
 const text=await response.text();
 try{return {text,json:JSON.parse(text)};}catch(e){throw Error('Overpass '+label+' returned non-JSON: '+text.slice(0,200));}
}
function readJSONFile(file){const buffer=fs.readFileSync(file);return {text:buffer.toString('utf8'),json:JSON.parse(buffer.toString('utf8'))};}

// OpenHistoricalMap derives a decimal date from a calendar date: whole year plus the day of the
// year, counted from zero, plus half a day. Verified against OHM tile attributes
// (1480 -> 1480.00137, 1661-02-28 -> 1661.16027).
export function decimalDate(value){
 if(value===undefined||value===null)return null;
 const match=/^(-?\d{1,6})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(String(value).trim());
 if(!match)return null;
 const year=Number(match[1]),month=match[2]?Number(match[2]):1,day=match[3]?Number(match[3]):1;
 if(!Number.isFinite(year)||month<1||month>12||day<1||day>31)return null;
 const leap=year%4===0&&(year%100!==0||year%400===0),days=leap?366:365;
 const cumulative=[0,31,59,90,120,151,181,212,243,273,304,334];
 let dayOfYear=cumulative[month-1]+day;if(leap&&month>2)dayOfYear++;
 return {decdate:year+(dayOfYear-1+.5)/days,year,month,day};
}
export const snapshotDate=year=>year+(181.5/365);
export const overlaps=({start,end},year)=>{
 const at=snapshotDate(year);
 if(start===null||start.decdate>at)return false;
 if(end===null)return true;
 return end.decdate>=at;
};

const key=p=>p[0].toFixed(7)+','+p[1].toFixed(7);
// Chains relation member ways into closed rings exactly as they are stored: no coordinate is
// moved, added or removed. Returns closed rings plus a report of the leftovers.
export function assembleRings(ways){
 const closed=[],open=[];
 const pool=ways.map(way=>way.points.slice());
 while(pool.length){
  let chain=pool.shift(),done=chain.length>2&&key(chain[0])===key(chain[chain.length-1]);
  while(!done){
   const end=chain[chain.length-1];let index=-1,reversed=false;
   for(let i=0;i<pool.length;i++){
    const points=pool[i];
    if(key(points[0])===key(end)){index=i;break;}
    if(key(points[points.length-1])===key(end)){index=i;reversed=true;break;}
   }
   if(index<0)break;
   const points=pool.splice(index,1)[0],segment=reversed?points.slice().reverse():points;
   for(let i=1;i<segment.length;i++)chain.push(segment[i]);
   done=chain.length>2&&key(chain[0])===key(chain[chain.length-1]);
  }
  if(done)closed.push(chain);else open.push(chain);
 }
 return {closed,open};
}
export function ringArea(ring,R=6371008.8){
 let total=0;
 for(let i=0;i<ring.length-1;i++){
  const [lon1,lat1]=ring[i],[lon2,lat2]=ring[i+1];
  total+=(lon2-lon1)*Math.PI/180*(2+Math.sin(lat1*Math.PI/180)+Math.sin(lat2*Math.PI/180));
 }
 return Math.abs(total*R*R/2);
}
export function pointInRing(point,ring){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const [xi,yi]=ring[i],[xj,yj]=ring[j];
  if((yi>point[1])!==(yj>point[1])&&point[0]<(xj-xi)*(point[1]-yi)/(yj-yi)+xi)inside=!inside;
 }
 return inside;
}
// A point strictly inside a ring, used only to decide which outer ring owns a hole.
function insidePoint(ring){
 let low=Infinity,high=-Infinity;
 for(const point of ring){low=Math.min(low,point[1]);high=Math.max(high,point[1]);}
 for(const ratio of [.5,.37,.63,.29,.71]){
  const y=low+(high-low)*ratio,crossings=[];
  for(let i=1;i<ring.length;i++){
   const a=ring[i-1],b=ring[i];
   if((a[1]>y)!==(b[1]>y))crossings.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));
  }
  crossings.sort((a,b)=>a-b);
  for(let i=0;i+1<crossings.length;i+=2)if(crossings[i+1]-crossings[i]>1e-9)return [(crossings[i]+crossings[i+1])/2,y];
 }
 return ring[0];
}
export function polygonFromRings(outers,inners){
 const polygons=outers.map(ring=>[ring]),holes=[];
 for(const hole of inners){
  const probe=insidePoint(hole),owner=polygons.find(polygon=>pointInRing(probe,polygon[0]));
  if(owner)owner.push(hole);else holes.push(hole);
 }
 return {polygons,holes};
}
const NAME_KEYS=['name','name:en','name:de','name:fr','name:zh','name:zh-hans','name:zh-cn','name:ko'];
function properties(relation,geometry,stats){
 const tags=relation.tags||{},name=tags.name||tags['name:en']||String(relation.id);
 const result={osm_id:-relation.id,record_id:'OHM-'+relation.id,type:'administrative',admin_level:Number(tags.admin_level),archive:'ohm-frozen',
  name,area:stats.area,points:stats.points,parts:geometry.type==='Polygon'?1:geometry.coordinates.length,ohm_relation:relation.id};
 if(tags['name:en'])result.name_en=tags['name:en'];
 if(tags['name:de'])result.name_de=tags['name:de'];
 if(tags['name:zh']||tags['name:zh-hans'])result.name_zh=tags['name:zh-hans']||tags['name:zh'];
 const start=decimalDate(tags.start_date),end=decimalDate(tags.end_date);
 if(tags.start_date)result.start_date=tags.start_date;
 if(start)result.start_decdate=start.decdate;
 if(tags.end_date&&end){result.end_date=tags.end_date;result.end_decdate=end.decdate;}
 if(tags.border_type)result.border_type=tags.border_type;
 if(tags.empire)result.empire=tags.empire;
 if(tags.wikidata)result.wikidata=tags.wikidata;
 if(tags.wikipedia)result.wikipedia=tags.wikipedia;
 if(tags.source)result.source=tags.source;
 if(stats.droppedOpenRings)result.open_chains=stats.droppedOpenRings;
 if(stats.droppedHoles)result.unassigned_holes=stats.droppedHoles;
 if(stats.droppedOpenRings||stats.droppedHoles)result.partial_geometry=1;
 return result;
}

// ---------------------------------------------------------------------------
const report={relations:[],excluded:[],years:{},totals:{}};
fs.mkdirSync(CACHE,{recursive:true});fs.mkdirSync(OUT,{recursive:true});

let tagsSource,geomSource;
if(flag('fetch')){
 const tagQuery='[out:json][timeout:180];rel["boundary"="administrative"]["admin_level"~"^('+LEVELS.join('|')+')$"]('+BBOX[0]+','+BBOX[1]+','+BBOX[2]+','+BBOX[3]+');out tags;';
 process.stderr.write('querying OHM Overpass for administrative relations...\n');
 const tags=await overpass(tagQuery,'tags');fs.writeFileSync(TAGS_FILE,tags.text);
 tagsSource={text:tags.text,query:tagQuery};
 geomSource={query:null};
} else {
 if(!fs.existsSync(TAGS_FILE))throw Error('Missing '+TAGS_FILE+'; run with --fetch first');
 tagsSource={...readJSONFile(TAGS_FILE),query:null};
 geomSource=null;
}
const tagData=JSON.parse(tagsSource.text);
const allRelations=(tagData.elements||[]).filter(element=>element.type==='relation');
const timestamp=tagData.osm3s?.timestamp_osm_base||null;

const decorated=allRelations.map(relation=>({relation,start:decimalDate(relation.tags?.start_date),end:decimalDate(relation.tags?.end_date)}));
const selectedIds=new Set();
for(const year of YEARS)for(const entry of decorated)if(overlaps(entry,year))selectedIds.add(entry.relation.id);

if(flag('fetch')||!fs.existsSync(GEOM_FILE)){
 const ids=[...selectedIds].sort((a,b)=>a-b);
 const geometries=[];
 for(let i=0;i<ids.length;i+=60){
  const batch=ids.slice(i,i+60),query='[out:json][timeout:280];rel(id:'+batch.join(',')+');out geom;';
  process.stderr.write('fetching geometry '+batch.length+' relations...\n');
  const answer=await overpass(query,'geometry');
  if(i===0)geomSource={query};
  geometries.push(...(answer.json.elements||[]));
 }
 const payload=JSON.stringify({version:.6,generator:'meridian-atlas frozen extract',elements:geometries});
 fs.writeFileSync(GEOM_FILE,payload);
 process.stderr.write('cached raw geometry in '+GEOM_FILE+'\n');
}
const geomData=JSON.parse(fs.readFileSync(GEOM_FILE,'utf8'));
const byId=new Map((geomData.elements||[]).filter(e=>e.type==='relation').map(e=>[e.id,e]));

function build(year){
 const features=[];
 for(const entry of decorated){
  const {relation,start,end}=entry;
  if(!overlaps(entry,year))continue;
  const level=Number(relation.tags?.admin_level);
  if(!LEVELS.includes(level))continue;
  const raw=byId.get(relation.id);
  const record={id:relation.id,name:relation.tags?.name||relation.tags?.['name:en'],level,start:relation.tags?.start_date||null,end:relation.tags?.end_date||null,members:raw?(raw.members||[]).filter(m=>m.type==='way').length:0};
  if(!raw){record.status='missing-geometry';report.excluded.push({...record,year});continue;}
  const members=(raw.members||[]).filter(m=>m.type==='way'&&Array.isArray(m.geometry)&&m.geometry.length>1);
  const outers=assembleRings(members.filter(m=>m.role!=='inner').map(m=>({points:m.geometry.map(p=>[p.lon,p.lat])})));
  const inners=assembleRings(members.filter(m=>m.role==='inner').map(m=>({points:m.geometry.map(p=>[p.lon,p.lat])})));
  record.outerRings=outers.closed.length;record.openOuterRings=outers.open.length;
  record.innerRings=inners.closed.length;record.openInnerRings=inners.open.length;
  if(!outers.closed.length){record.status='no-closed-outer-ring';report.excluded.push({...record,year});continue;}
  const {polygons,holes}=polygonFromRings(outers.closed,inners.closed);
  record.droppedHoles=holes.length;record.droppedOpenRings=outers.open.length+inners.open.length;
  const outerArea=polygons.reduce((sum,polygon)=>sum+ringArea(polygon[0]),0);
  const holeArea=polygons.reduce((sum,polygon)=>sum+polygon.slice(1).reduce((inner,ring)=>inner+ringArea(ring),0),0);
  const points=polygons.reduce((sum,polygon)=>sum+polygon.reduce((inner,ring)=>inner+ring.length,0),0);
  const geometry=polygons.length===1?{type:'Polygon',coordinates:polygons[0]}:{type:'MultiPolygon',coordinates:polygons};
  record.status='ok';record.points=points;record.area=Math.round(outerArea-holeArea);record.polygons=polygons.length;
  features.push({type:'Feature',properties:properties(relation,geometry,record),geometry});
  report.relations.push({...record,year,start_decdate:start?.decdate??null,end_decdate:end?.decdate??null});
 }
 features.sort((a,b)=>a.properties.admin_level-b.properties.admin_level||(b.properties.area||0)-(a.properties.area||0)||a.properties.osm_id-b.properties.osm_id);
 return features;
}

const GAP_PROBES=[
 {id:'swiss-confederacy',zh:'旧瑞士联邦',en:'Old Swiss Confederacy',pattern:'Eidgenossenschaft|Schweiz|Swiss Confeder|Suisse|Helvet',exclude:'Kanton|Canton'},
 {id:'duchy-of-bavaria',zh:'巴伐利亚公国',en:'Duchy of Bavaria',pattern:'Baiern|Bayern|Bavaria',exclude:'Kreis|Circle|Bezirk|Regierungsbezirk|K(ö|o)nigreich|Churf(ü|u)rstenthum|Kurf'},
 {id:'wurttemberg',zh:'符腾堡',en:'Württemberg',pattern:'W(ü|u)rttemberg|Wirtemberg|Wirtenberg',exclude:'K(ö|o)nigreich|Baden-W'},
 {id:'baden',zh:'巴登藩侯国',en:'Margraviate of Baden',pattern:'Baden',exclude:'Kreis|Bezirk|W(ü|u)rttemberg|K(ö|o)nigreich|Reichsgau|Gau '},
 {id:'habsburg-austria',zh:'哈布斯堡奥地利',en:'Habsburg Austria',pattern:'Habsburg|sterreich|Austria',exclude:'Kreis|Circle|K(ö|o)nigreich|Republik|Reichsgau|Bezirk|Erzherzogtum'},
 {id:'tyrol',zh:'蒂罗尔',en:'County of Tyrol',pattern:'Tirol|Tyrol',exclude:'Reichsgau|Bezirk|K(ö|o)nigreich|Trentino'}
];
function gapReport(year){
 return GAP_PROBES.map(probe=>{
  const expression=new RegExp(probe.pattern,'i');
  const excluded=new RegExp(probe.exclude,'i');
  const nameOf=entry=>[entry.relation.tags?.name,entry.relation.tags?.['name:en'],entry.relation.tags?.['name:de']].filter(Boolean).join(' ');
  const matches=decorated.filter(entry=>expression.test(nameOf(entry))&&!excluded.test(nameOf(entry)));
  const nearest=matches.map(entry=>({id:entry.relation.id,name:entry.relation.tags?.['name:en']||entry.relation.tags?.name,admin_level:Number(entry.relation.tags?.admin_level),start:entry.relation.tags?.start_date||null,end:entry.relation.tags?.end_date||null}))
   .filter(entry=>entry.start&&Number(String(entry.start).slice(0,4).replace(/^0+/,'')||0)<1600)
   .sort((a,b)=>String(a.start).localeCompare(String(b.start))).slice(0,6);
  const overlapping=matches.filter(entry=>overlaps(entry,year)&&LEVELS.includes(Number(entry.relation.tags?.admin_level)));
  const ignored=decorated.filter(entry=>expression.test(nameOf(entry))&&excluded.test(nameOf(entry))&&overlaps(entry,year)&&LEVELS.includes(Number(entry.relation.tags?.admin_level)));
  return {id:probe.id,zh:probe.zh,en:probe.en,year,overlap:overlapping.length>0,overlappingIds:overlapping.map(entry=>entry.relation.id),overlappingNames:overlapping.map(entry=>entry.relation.tags?.['name:en']||entry.relation.tags?.name),excludedMatches:ignored.map(entry=>({id:entry.relation.id,name:entry.relation.tags?.['name:en']||entry.relation.tags?.name})),nearbyRecords:nearest,
   evidence:'OHM Overpass '+ENDPOINT+' bbox '+BBOX.join(',')+' admin_level '+LEVELS.join('/')+' snapshot '+timestamp};
 });
}

const manifest={schema:'meridian-ohm-frozen/1',generated:new Date().toISOString(),source:{name:'OpenHistoricalMap',endpoint:ENDPOINT,license:'CC0 1.0 (OpenHistoricalMap data)',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',copyright:'https://www.openhistoricalmap.org/copyright',timestamp},bbox:BBOX,adminLevels:LEVELS,years:YEARS,
 queries:{tags:tagsSource.query||'[out:json][timeout:180];rel["boundary"="administrative"]["admin_level"~"^(2|3|4)$"]('+BBOX.join(',')+');out tags;',geometry:geomSource?.query||'[out:json][timeout:280];rel(id:<selected>);out geom;',rawTagsSha256:sha256(fs.readFileSync(TAGS_FILE)),rawGeometrySha256:sha256(fs.readFileSync(GEOM_FILE))},
 method:'Member ways chained in stored order; coordinates copied unchanged; no simplification, rounding or boolean repair; holes assigned by containment; area from spherical ring area (R=6371008.8 m).',
 relations:[]};

for(const year of YEARS){
 const features=build(year),gaps=gapReport(year);
 const payload={type:'FeatureCollection',metadata:{schema:'meridian-ohm-frozen/1',year,source:'OpenHistoricalMap',endpoint:ENDPOINT,license:'CC0 1.0',attribution:'OpenHistoricalMap contributors',timestamp,bbox:BBOX,adminLevels:LEVELS,generated:manifest.generated,gaps,relationCount:features.length},features};
 const json=JSON.stringify(payload),gzipped=zlib.gzipSync(Buffer.from(json,'utf8'),{level:9});
 const file='year-'+year+'.json.gz';
 fs.writeFileSync(path.join(OUT,file),gzipped);
 report.years[year]={file,features:features.length,bytes:json.length,gzipBytes:gzipped.length,sha256:sha256(gzipped),decodedSha256:sha256(Buffer.from(json,'utf8')),levels:features.reduce((map,f)=>{map[f.properties.admin_level]=(map[f.properties.admin_level]||0)+1;return map;},{}),points:features.reduce((sum,f)=>sum+f.properties.points,0),gaps:gaps.map(gap=>({id:gap.id,overlap:gap.overlap,overlappingIds:gap.overlappingIds}))};
}
manifest.relations=report.relations.sort((a,b)=>a.id-b.id||a.year-b.year);
manifest.excluded=report.excluded;
manifest.years=report.years;
manifest.totals={relations:manifest.relations.length,excluded:manifest.excluded.length,sourceRelations:allRelations.length,features:Object.values(report.years).reduce((sum,y)=>sum+y.features,0)};
fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');

const notice=['# OpenHistoricalMap frozen extract (1492 / 1500, central Europe)','',
 'Source: OpenHistoricalMap (OHM), queried through the OHM Overpass API on '+timestamp+'.',
 'Endpoint: '+ENDPOINT,'Bounding box: '+BBOX.join(', ')+' (south, west, north, east)','Admin levels: '+LEVELS.join(', ')+' — relations that overlap 1492 or 1500 at the July 1 snapshot used by the atlas.','',
 'Licence: OHM states that its data is made available under CC0 1.0 Universal (public domain dedication):',
 'https://www.openhistoricalmap.org/copyright — https://creativecommons.org/publicdomain/zero/1.0/',
 'Individual OHM features may carry a source tag pointing at a third-party map or dataset; those',
 'references are preserved verbatim in the feature properties (source, wikidata, wikipedia) so that',
 'a future release can review them separately.','',
 'Pipeline: scripts/ohm/build-ohm-1500.mjs. Member ways are chained in stored order, coordinates are',
 'copied without simplification, rounding or boolean repair, and holes / multiple polygons are kept.',
 'Relations whose members do not close a ring are listed in manifest.json under "excluded" and are',
 'not drawn at all rather than patched up.','',
 'Attribution wording for the atlas: OpenHistoricalMap contributors (CC0).',''].join('\n');
fs.writeFileSync(path.join(OUT,'NOTICE.md'),notice);
process.stderr.write('wrote '+Object.keys(report.years).length+' year files and manifest.json to '+OUT+'\n');
console.log(JSON.stringify({manifest:path.join(OUT,'manifest.json'),totals:manifest.totals,years:report.years,excluded:manifest.excluded.length,relations:manifest.relations.length},null,1));
