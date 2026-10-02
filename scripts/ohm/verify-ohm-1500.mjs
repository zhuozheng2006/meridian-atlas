// Independent checks of the frozen OpenHistoricalMap extract and the detail-layer integration.
//   node scripts/ohm/verify-ohm-1500.mjs [--out /tmp/ohm-1500/verify.json]
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {regionalFilterExcluding,regionalFilter,regionalVisible,groupRegionalFeatures,ohmInView,ohmCoversYear,OHM_YEARS,OHM_BOUNDS} from '../../public/regional-boundaries.js';
import {decimalDate,snapshotDate} from './build-ohm-1500.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const args=process.argv.slice(2),value=(name,fallback)=>args.includes('--'+name)?args[args.indexOf('--'+name)+1]:fallback;
const dataDir=path.resolve(value('data',path.join(root,'public/data/ohm-1500')));
const cacheDir=path.resolve(value('cache',path.join(root,'scripts/ohm/.cache')));
const out=value('out',null);
const sha256=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const key=point=>point[0].toFixed(7)+','+point[1].toFixed(7);
const results=[],notes=[];
const check=(name,fn)=>{try{const detail=fn();results.push({name,passed:true,detail});}catch(error){results.push({name,passed:false,error:String(error.message||error)});}};
const assert=(condition,message)=>{if(!condition)throw Error(message);};

const manifest=JSON.parse(fs.readFileSync(path.join(dataDir,'manifest.json'),'utf8'));
const payloads=new Map();
for(const year of OHM_YEARS){
 const meta=manifest.years[year],file=path.join(dataDir,meta.file),compressed=fs.readFileSync(file);
 const decoded=zlib.gunzipSync(compressed);
 assert(sha256(compressed)===meta.sha256,'gzip hash differs from the manifest for '+year);
 assert(sha256(decoded)===meta.decodedSha256,'decoded hash differs from the manifest for '+year);
 const payload=JSON.parse(decoded.toString('utf8'));
 payloads.set(year,payload);
 check('Year file '+year+' matches its frozen manifest hashes and count',()=>{
  assert(payload.type==='FeatureCollection','not a FeatureCollection');
  assert(payload.features.length===meta.features,'feature count '+payload.features.length+' != '+meta.features);
  assert(payload.metadata.year===year&&payload.metadata.timestamp===manifest.source.timestamp,'metadata year or snapshot differs');
  return {features:payload.features.length,bytes:decoded.length,gzipBytes:compressed.length,sha256:meta.sha256.slice(0,16)};
 });
}

// 1. Date derivation has to agree with the decimal dates OHM serves in its vector tiles.
check('Decimal dates reproduce the OHM tile values used by the existing validators',()=>{
 const lorraine={start:decimalDate('1480').decdate,end:decimalDate('1661-02-28').decdate};
 assert(Math.abs(lorraine.start-1480.00137)<1e-5,'start decdate '+lorraine.start);
 assert(Math.abs(lorraine.end-1661.16027)<1e-5,'end decdate '+lorraine.end);
 const snapshot=snapshotDate(1500);assert(snapshot>1500&&snapshot<1501,'snapshot date');
 return {start:lorraine.start,end:lorraine.end,snapshot};
});

// 2. Every feature is a real, closed, in-window polygon whose rings keep their stored coordinates.
for(const year of OHM_YEARS){
 const payload=payloads.get(year);
 check('Every '+year+' feature is a closed polygon overlapping the extract window with a positive area',()=>{
  let points=0,rings=0,parts=0,worstPrecision=0,holes=0,excursion=0;
  for(const feature of payload.features){
   const p=feature.properties,geometry=feature.geometry;
   assert(Number.isSafeInteger(p.osm_id)&&p.osm_id<0,'osm_id must be a negative relation id: '+p.osm_id);
   assert(Number.isFinite(p.area)&&p.area>0,'missing area on '+p.osm_id);
   assert(Number.isFinite(p.start_decdate),'missing start_decdate on '+p.osm_id);
   if(!('end_date' in p))assert(!('end_decdate' in p),'an open-ended record must not carry an end date: '+p.osm_id);
   assert(regionalVisible(p,year),'feature '+p.osm_id+' is not visible at its own year');
   let inside=false;
   assert(['Polygon','MultiPolygon'].includes(geometry.type),'geometry type '+geometry.type);
   const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
   assert(polygons.length===p.parts,'parts mismatch on '+p.osm_id);
   parts+=polygons.length;
   for(const polygon of polygons){
    polygon.forEach((ring,index)=>{
     rings++;if(index)holes++;
     assert(ring.length>=4,'ring with fewer than four points on '+p.osm_id);
     assert(key(ring[0])===key(ring[ring.length-1]),'unclosed ring on '+p.osm_id);
     points+=ring.length;
     for(const [lon,lat] of ring){
      assert(Number.isFinite(lon)&&Number.isFinite(lat),'non-finite coordinate on '+p.osm_id);
      if(lon>=OHM_BOUNDS[0]&&lon<=OHM_BOUNDS[2]&&lat>=OHM_BOUNDS[1]&&lat<=OHM_BOUNDS[3])inside=true;
      excursion=Math.max(excursion,OHM_BOUNDS[0]-lon,lon-OHM_BOUNDS[2],OHM_BOUNDS[1]-lat,lat-OHM_BOUNDS[3],0);
      worstPrecision=Math.max(worstPrecision,String(lon).split('.')[1]?.length||0,String(lat).split('.')[1]?.length||0);
     }
    });
   }
   assert(points>0,'empty geometry on '+p.osm_id);
   assert(inside,'record '+p.osm_id+' does not reach into the extract window at all');
  }
  assert(points===payload.features.reduce((sum,f)=>sum+f.properties.points,0),'declared point totals differ from the geometry');
  return {features:payload.features.length,parts,rings,holes,points,maxCoordinateDigits:worstPrecision,outsideWindowDegrees:Number(excursion.toFixed(4))};
 });
}

// 3. Holes really sit inside their own outer ring; the builder never moves a ring to make that true.
function insidePoint(ring){
 let low=Infinity,high=-Infinity;for(const point of ring){low=Math.min(low,point[1]);high=Math.max(high,point[1]);}
 for(const ratio of [.5,.37,.63,.29,.71]){
  const y=low+(high-low)*ratio,crossings=[];
  for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i];if((a[1]>y)!==(b[1]>y))crossings.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}
  crossings.sort((a,b)=>a-b);
  for(let i=0;i+1<crossings.length;i+=2)if(crossings[i+1]-crossings[i]>1e-9)return [(crossings[i]+crossings[i+1])/2,y];
 }
 return null;
}
function pointInRing(point,ring){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const [xi,yi]=ring[i],[xj,yj]=ring[j];
  if((yi>point[1])!==(yj>point[1])&&point[0]<(xj-xi)*(point[1]-yi)/(yj-yi)+xi)inside=!inside;
 }
 return inside;
}
for(const year of OHM_YEARS){
 const payload=payloads.get(year);
 check('Holes of the '+year+' extract are contained by an outer ring of the same record',()=>{
  let checked=0,contained=0;
  for(const feature of payload.features){
   const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
   for(const polygon of polygons)for(const hole of polygon.slice(1)){
    checked++;const probe=insidePoint(hole);
    if(probe&&polygon.slice(0,1).some(outer=>pointInRing(probe,outer)))contained++;
   }
  }
  assert(checked===contained,contained+'/'+checked+' holes are inside their outer ring');
  return {holes:checked,contained};
 });
}

// 4. Coordinates are byte-identical to the Overpass answer; no rounding, no repair.
const geomFile=path.join(cacheDir,'ohm-admin-geom.json');
if(fs.existsSync(geomFile))check('Every stored coordinate appears verbatim in the cached Overpass answer',()=>{
 const raw=JSON.parse(fs.readFileSync(geomFile,'utf8'));
 const source=new Map((raw.elements||[]).filter(e=>e.type==='relation').map(e=>[e.id,e]));
 let compared=0,matched=0,missing=[];
 for(const year of OHM_YEARS)for(const feature of payloads.get(year).features){
  const relation=source.get(feature.properties.ohm_relation);
  assert(relation,'relation missing from the Overpass cache: '+feature.properties.ohm_relation);
  const allowed=new Set();
  for(const member of relation.members||[])if(member.type==='way'&&Array.isArray(member.geometry))for(const point of member.geometry)allowed.add(point.lon.toFixed(7)+','+point.lat.toFixed(7));
  const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
  for(const polygon of polygons)for(const ring of polygon)for(const point of ring){
   compared++;if(allowed.has(key(point)))matched++;else if(missing.length<5)missing.push(feature.properties.ohm_relation+':'+key(point));
  }
 }
 assert(matched===compared,'moved coordinates: '+missing.join(' '));
 return {compared,matched};
});else notes.push('Overpass cache '+geomFile+' is absent; the unchanged-coordinate check was skipped.');

// 5. The app side: the frozen records are excluded from the tile archive, and never double-counted.
check('Tile filters drop exactly the frozen relation ids',()=>{
 const ids=[];for(const year of OHM_YEARS)for(const feature of payloads.get(year).features)if(!ids.includes(feature.properties.osm_id))ids.push(feature.properties.osm_id);
 const filter=regionalFilterExcluding(1500,4,ids),json=JSON.stringify(filter);
 assert(json.includes(JSON.stringify(regionalFilter(1500,4))),'the dated base filter must stay inside the exclusion filter');
 assert(json.includes(JSON.stringify(['!',['in',['get','osm_id'],['literal',ids]]])),'exclusion clause missing');
 assert(JSON.stringify(regionalFilterExcluding(1500,4,[]))===JSON.stringify(regionalFilter(1500,4)),'an empty exclusion list must not change the filter');
 return {ids:ids.length,clauseCharacters:json.length};
});
check('A record present in both archives is drawn once',()=>{
 const payload=payloads.get(1500),feature=payload.features[0];
 const frozen={...feature,properties:{...feature.properties},layer:{id:'ohm-frozen-wash'}};
 const tile={...feature,properties:{...feature.properties,name:'tile copy'},layer:{id:'regional-wash'}};
 const grouped=groupRegionalFeatures([frozen,tile],1500,4);
 assert(grouped.length===1,'expected a single grouped record, got '+grouped.length);
 assert(grouped[0].properties.name===feature.properties.name,'the frozen record must win the grouping');
 return {name:grouped[0].properties.name};
});
check('The frozen extract only answers for its own years and window',()=>{
 assert(OHM_YEARS.every(ohmCoversYear)&&!ohmCoversYear(1700)&&!ohmCoversYear(1493),'year gate');
 const inside={getWest:()=>6,getSouth:()=>47,getEast:()=>9,getNorth:()=>49};
 const outside={getWest:()=>-5,getSouth:()=>40,getEast:()=>-2,getNorth:()=>44.5};
 const north={getWest:()=>6,getSouth:()=>52,getEast:()=>9,getNorth:()=>54};
 assert(ohmInView(inside)&&!ohmInView(outside)&&!ohmInView(north)&&!ohmInView(undefined),'view gate');
 return {years:OHM_YEARS,window:OHM_BOUNDS};
});

// 6. Honesty: relations the source itself leaves open are flagged instead of patched.
check('Incomplete source relations are reported and flagged on their features',()=>{
 const flagged=manifest.relations.filter(relation=>relation.droppedOpenRings||relation.droppedHoles||relation.openOuterRings);
 const missing=[];
 for(const relation of flagged){
  const payload=payloads.get(relation.year);
  const feature=payload.features.find(candidate=>candidate.properties.ohm_relation===relation.id);
  if(!feature){missing.push(relation.id);continue;}
  if(relation.droppedOpenRings&&!feature.properties.open_chains)missing.push(relation.id+':open_chains');
  if(relation.droppedHoles&&!feature.properties.unassigned_holes)missing.push(relation.id+':unassigned_holes');
 }
 assert(!missing.length,'unflagged incomplete relations: '+missing.join(', '));
 assert(manifest.excluded.length===0,'relations without a usable outer ring: '+manifest.excluded.length);
 return {flagged:flagged.map(relation=>relation.id),excluded:manifest.excluded.length};
});

// 7. The snapshot must agree with the runtime filter used by the layer.
check('Runtime visibility keeps exactly the records the snapshot expects at 1500',()=>{
 const payload=payloads.get(1500),other=payloads.get(1492);
 const kept=payload.features.filter(feature=>regionalVisible(feature.properties,1500));
 assert(kept.length===payload.features.length,'some 1500 records fail their own visibility filter');
 const stale=other.features.filter(feature=>!payload.features.some(candidate=>candidate.properties.osm_id===feature.properties.osm_id));
 const wronglyVisible=stale.filter(feature=>regionalVisible(feature.properties,1500));
 return {visible:kept.length,oneYearEarlier:other.features.length,onlyIn1492:stale.length,visibleAt1500From1492:wronglyVisible.length};
});

const report={checkedAt:new Date().toISOString(),dataDir,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results,notes};
console.log(JSON.stringify({passed:report.passed,failed:report.failed,notes,checks:results.map(r=>({name:r.name,passed:r.passed,detail:r.detail,error:r.error}))},null,1));
if(out)fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
if(report.failed)process.exitCode=1;
