// Independent checks of the frozen OpenHistoricalMap extracts and their detail-layer integration.
//   node scripts/ohm/verify-ohm-1500.mjs [--out /tmp/ohm-frozen-verify.json]
// Covers every window declared in public/regional-boundaries.js (central Europe, East Asia).
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {regionalFilterExcluding,regionalFilter,regionalVisible,groupRegionalFeatures,ohmInView,ohmWindowFor,ohmCoversYear,OHM_WINDOWS,OHM_YEARS} from '../../public/regional-boundaries.js';
import {decimalDate,snapshotDate} from './build-ohm-1500.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const args=process.argv.slice(2);
const value=(name,fallback)=>{
 const inline=args.find(argument=>argument.startsWith('--'+name+'='));
 if(inline)return inline.slice(name.length+3);
 const index=args.indexOf('--'+name);
 return index<0?fallback:args[index+1];
};
const out=value('out',null);
const sha256=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const key=point=>point[0].toFixed(7)+','+point[1].toFixed(7);
const results=[],notes=[];
const check=(name,fn)=>{try{const detail=fn();results.push({name,passed:true,detail});}catch(error){results.push({name,passed:false,error:String(error.message||error)});}};
const assert=(condition,message)=>{if(!condition)throw Error(message);};

// ---------------------------------------------------------------------------
// Load every window declared by the runtime, straight from its manifest.
const windows=[];
for(const declared of OHM_WINDOWS){
 // window.root is page-relative (data/ohm-1500/), so it resolves inside public/.
 const dataDir=path.resolve(root,'public',declared.root);
 const manifest=JSON.parse(fs.readFileSync(path.join(dataDir,'manifest.json'),'utf8'));
 assert(manifest.window?.id===declared.id,'manifest window id differs for '+declared.id);
 // The manifest stores bbox as south,west,north,east; the runtime window is west,south,east,north.
 assert(JSON.stringify(manifest.bbox)===JSON.stringify([declared.bounds[1],declared.bounds[0],declared.bounds[3],declared.bounds[2]]),'manifest bbox differs from the runtime window '+declared.id);
 // manifest.years is a map keyed by year; compare its keys with the runtime list.
 assert(JSON.stringify(Object.keys(manifest.years).map(Number).sort((a,b)=>a-b))===JSON.stringify([...declared.years].sort((a,b)=>a-b)),'manifest years differ from the runtime window '+declared.id);
 const payloads=new Map();
 for(const year of declared.years){
  const meta=manifest.years[year];
  assert(meta,'manifest has no entry for '+declared.id+' '+year);
  const compressed=fs.readFileSync(path.join(dataDir,meta.file)),decoded=zlib.gunzipSync(compressed);
  assert(sha256(compressed)===meta.sha256,'gzip hash differs from the manifest for '+declared.id+' '+year);
  assert(sha256(decoded)===meta.decodedSha256,'decoded hash differs from the manifest for '+declared.id+' '+year);
  const payload=JSON.parse(decoded.toString('utf8'));
  payloads.set(year,payload);
  check('Year file '+declared.id+' '+year+' matches its frozen manifest hashes and count',()=>{
   assert(payload.type==='FeatureCollection','not a FeatureCollection');
   assert(payload.features.length===meta.features,'feature count '+payload.features.length+' != '+meta.features);
   assert(payload.metadata.year===year&&payload.metadata.window?.id===declared.id,'metadata window or year differs');
   assert(payload.metadata.timestamp===manifest.source.timestamp,'metadata snapshot differs');
   return {features:payload.features.length,bytes:decoded.length,gzipBytes:compressed.length,sha256:meta.sha256.slice(0,16)};
  });
 }
 const cacheDir=path.resolve(root,'scripts/ohm/.cache',declared.id==='central-europe'?'':declared.id);
 const geomFile=path.join(cacheDir,'ohm-admin-geom.json');
 windows.push({...declared,dataDir,manifest,payloads,geomFile});
}
const windowOf=id=>windows.find(window_=>window_.id===id);

// 1. Date derivation has to agree with the decimal dates OHM serves in its vector tiles.
check('Decimal dates reproduce the OHM tile values used by the existing validators',()=>{
 const lorraine={start:decimalDate('1480').decdate,end:decimalDate('1661-02-28').decdate};
 assert(Math.abs(lorraine.start-1480.00137)<1e-5,'start decdate '+lorraine.start);
 assert(Math.abs(lorraine.end-1661.16027)<1e-5,'end decdate '+lorraine.end);
 const snapshot=snapshotDate(1500);assert(snapshot>1500&&snapshot<1501,'snapshot date');
 const joseon=decimalDate('1392-08-05').decdate;
 assert(Number.isFinite(joseon)&&joseon>1392&&joseon<1393,'east asian calendar date');
 return {start:lorraine.start,end:lorraine.end,snapshot,joseon:Number(joseon.toFixed(5))};
});

// 2. Every feature is a real, closed polygon that reaches into its own window.
for(const window_ of windows){
 for(const year of window_.years){
  const payload=window_.payloads.get(year);
  check('Every '+window_.id+' '+year+' feature is a closed polygon overlapping its window with a positive area',()=>{
   let points=0,rings=0,parts=0,worstPrecision=0,holes=0,excursion=0;
   const bounds=window_.bounds;
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
       if(lon>=bounds[0]&&lon<=bounds[2]&&lat>=bounds[1]&&lat<=bounds[3])inside=true;
       excursion=Math.max(excursion,bounds[0]-lon,lon-bounds[2],bounds[1]-lat,lat-bounds[3],0);
       worstPrecision=Math.max(worstPrecision,String(lon).split('.')[1]?.length||0,String(lat).split('.')[1]?.length||0);
      }
     });
    }
    assert(points>0,'empty geometry on '+p.osm_id);
    assert(inside,'record '+p.osm_id+' does not reach into '+window_.id+' at all');
   }
   assert(points===payload.features.reduce((sum,f)=>sum+f.properties.points,0),'declared point totals differ from the geometry');
   return {features:payload.features.length,parts,rings,holes,points,maxCoordinateDigits:worstPrecision,outsideWindowDegrees:Number(excursion.toFixed(4))};
  });
 }
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
for(const window_ of windows){
 for(const year of window_.years){
  const payload=window_.payloads.get(year);
  check('Holes of '+window_.id+' '+year+' are contained by an outer ring of the same record',()=>{
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
}

// 4. Coordinates are byte-identical to the Overpass answer; no rounding, no repair.
for(const window_ of windows){
 if(!fs.existsSync(window_.geomFile)){notes.push('Overpass cache '+window_.geomFile+' is absent; the unchanged-coordinate check was skipped for '+window_.id);continue;}
 check('Every stored coordinate of '+window_.id+' appears verbatim in its cached Overpass answer',()=>{
  const raw=JSON.parse(fs.readFileSync(window_.geomFile,'utf8'));
  const source=new Map((raw.elements||[]).filter(element=>element.type==='relation').map(element=>[element.id,element]));
  let compared=0,matched=0,missing=[];
  for(const year of window_.years)for(const feature of window_.payloads.get(year).features){
   const relation=source.get(feature.properties.ohm_relation);
   assert(relation,'relation missing from the Overpass cache: '+feature.properties.ohm_relation);
   const allowed=new Set();
   for(const member of relation.members||[])if(member.type==='way'&&Array.isArray(member.geometry))for(const point of member.geometry)allowed.add(key([point.lon,point.lat]));
   const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
   for(const polygon of polygons)for(const ring of polygon)for(const point of ring){
    compared++;if(allowed.has(key(point)))matched++;else if(missing.length<5)missing.push(feature.properties.ohm_relation+':'+key(point));
   }
  }
  assert(matched===compared,'moved coordinates: '+missing.join(' '));
  return {compared,matched,cache:path.basename(path.dirname(window_.geomFile))+'/'+path.basename(window_.geomFile)};
 });
}

// 5. The app side: the frozen records are excluded from the tile archive, and never double-counted.
check('Tile filters drop exactly the frozen relation ids of every window',()=>{
 const perWindow={},ids=[];
 for(const window_ of windows){
  const own=[];
  for(const year of window_.years)for(const feature of window_.payloads.get(year).features)if(!own.includes(feature.properties.osm_id))own.push(feature.properties.osm_id);
  perWindow[window_.id]=own.length;
  for(const id of own)if(!ids.includes(id))ids.push(id);
 }
 const filter=regionalFilterExcluding(1500,4,ids),json=JSON.stringify(filter);
 assert(json.includes(JSON.stringify(regionalFilter(1500,4))),'the dated base filter must stay inside the exclusion filter');
 assert(json.includes(JSON.stringify(['!',['in',['get','osm_id'],['literal',ids]]])),'exclusion clause missing');
 assert(JSON.stringify(regionalFilterExcluding(1500,4,[]))===JSON.stringify(regionalFilter(1500,4)),'an empty exclusion list must not change the filter');
 return {perWindow,total:ids.length,clauseCharacters:json.length};
});
check('A record present in both archives is drawn once',()=>{
 const feature=windowOf('central-europe').payloads.get(1500).features[0];
 const frozen={...feature,properties:{...feature.properties},layer:{id:'ohm-frozen-wash'}};
 const tile={...feature,properties:{...feature.properties,name:'tile copy'},layer:{id:'regional-wash'}};
 const grouped=groupRegionalFeatures([frozen,tile],1500,4);
 assert(grouped.length===1,'expected a single grouped record, got '+grouped.length);
 assert(grouped[0].properties.name===feature.properties.name,'the frozen record must win the grouping');
 return {name:grouped[0].properties.name};
});
check('Windows answer only for their own years and their own view',()=>{
 assert(OHM_YEARS.every(ohmCoversYear)&&!ohmCoversYear(1750)&&!ohmCoversYear(1150),'year gate');
 const europe={getWest:()=>6,getSouth:()=>47,getEast:()=>9,getNorth:()=>49};
 const asia={getWest:()=>110,getSouth:()=>30,getEast:()=>122,getNorth:()=>42};
 const nowhere={getWest:()=>-5,getSouth:()=>40,getEast:()=>-2,getNorth:()=>44.5};
 const northEurope={getWest:()=>6,getSouth:()=>52,getEast:()=>9,getNorth:()=>54};
 assert(ohmInView(europe)&&ohmInView(asia)&&!ohmInView(nowhere)&&!ohmInView(northEurope)&&!ohmInView(undefined),'view gate');
 assert(ohmWindowFor(europe)?.id==='central-europe','europe view must pick central-europe, got '+ohmWindowFor(europe)?.id);
 assert(ohmWindowFor(asia)?.id==='east-asia','asia view must pick east-asia, got '+ohmWindowFor(asia)?.id);
 assert(ohmWindowFor(nowhere)===null,'a view outside both windows must pick nothing');
 const between={getWest:()=>60,getSouth:()=>40,getEast:()=>80,getNorth:()=>50};
 assert(ohmWindowFor(between)===null,'central Asia belongs to neither window');
 return {windows:OHM_WINDOWS.map(window_=>({id:window_.id,bounds:window_.bounds,years:window_.years.length})),years:OHM_YEARS.length};
});

// 6. Honesty: relations the source itself leaves open are flagged instead of patched.
for(const window_ of windows){
 check('Incomplete source relations of '+window_.id+' are reported and flagged on their features',()=>{
  const manifest=window_.manifest;
  const flagged=manifest.relations.filter(relation=>relation.droppedOpenRings||relation.droppedHoles||relation.openOuterRings);
  const missing=[];
  for(const relation of flagged){
   const payload=window_.payloads.get(relation.year);
   const feature=payload.features.find(candidate=>candidate.properties.ohm_relation===relation.id);
   if(!feature){missing.push(relation.id);continue;}
   if(relation.droppedOpenRings&&!feature.properties.open_chains)missing.push(relation.id+':open_chains');
   if(relation.droppedHoles&&!feature.properties.unassigned_holes)missing.push(relation.id+':unassigned_holes');
  }
  assert(!missing.length,'unflagged incomplete relations: '+missing.join(', '));
  for(const relation of manifest.excluded){
   const payload=window_.payloads.get(relation.year),listed=payload?.metadata?.undrawable||[];
   assert(listed.some(entry=>entry.ohm_relation===relation.id),'excluded relation '+relation.id+' is not listed for '+relation.year);
   assert(payload.features.every(feature=>feature.properties.ohm_relation!==relation.id),'excluded relation '+relation.id+' was drawn anyway');
  }
  return {flagged:flagged.length,excluded:manifest.excluded.length};
 });
}

// 7. The snapshot must agree with the runtime filter used by the layer.
check('Every record is visible in its own year and geometry is never borrowed across years',()=>{
 const perYear={};
 for(const window_ of windows)for(const year of window_.years){
  const payload=window_.payloads.get(year);
  const kept=payload.features.filter(feature=>regionalVisible(feature.properties,year));
  assert(kept.length===payload.features.length,'some '+window_.id+' '+year+' records fail their own visibility filter');
  perYear[window_.id+'|'+year]={records:payload.features.length,visible:kept.length};
 }
 // Geometry must never be borrowed across years *within a window*: a record that is absent from
 // one year's snapshot of a window must not satisfy that year's filter. Windows are separate
 // scopes, so a record that only exists in the other window is not a leak.
 let leaked=0;
 const leaks=[];
 for(const window_ of windows)for(const year of window_.years){
  const ids=new Set(window_.payloads.get(year).features.map(feature=>feature.properties.osm_id));
  for(const otherYear of window_.years){
   if(otherYear===year)continue;
   for(const feature of window_.payloads.get(otherYear).features){
    if(ids.has(feature.properties.osm_id))continue;
    if(regionalVisible(feature.properties,year)){leaked++;if(leaks.length<5)leaks.push(window_.id+' '+feature.properties.osm_id+' from '+otherYear+' visible at '+year);}
   }
  }
 }
 assert(leaked===0,'records from another year pass a foreign filter: '+leaks.join(', '));
 return {snapshots:Object.keys(perYear).length,leakedAcrossYears:leaked};
});
check('Per-year coverage verdicts match the sampled land mask',()=>{
 const perYear={};
 for(const window_ of windows)for(const year of window_.years){
  const coverage=window_.payloads.get(year).metadata.coverage;
  assert(coverage&&coverage.grid===24,'missing coverage metadata for '+window_.id+' '+year);
  assert(coverage.landSamples>0&&coverage.covered>=0&&coverage.covered<=coverage.landSamples,'impossible sample counts for '+window_.id+' '+year);
  const ratio=coverage.covered/coverage.landSamples;
  assert(Math.abs(ratio-coverage.ratio)<1e-9,'ratio does not match its own samples for '+window_.id+' '+year);
  const expected=coverage.records<8||ratio<.12?'sparse':ratio>=.45?'good':'partial';
  assert(coverage.verdict===expected,'verdict '+coverage.verdict+' disagrees with the documented thresholds for '+window_.id+' '+year);
  perYear[window_.id+'|'+year]={records:coverage.records,covered:coverage.covered,land:coverage.landSamples,ratio:Number(ratio.toFixed(4)),verdict:coverage.verdict};
 }
 return perYear;
});
check('Undrawable source relations are reported per year instead of being patched',()=>{
 const perWindow={};
 for(const window_ of windows){
  let total=0;
  for(const year of window_.years){
   const payload=window_.payloads.get(year),listed=payload.metadata.undrawable||[];
   assert(Array.isArray(listed),'missing undrawable list for '+window_.id+' '+year);
   for(const entry of listed){
    assert(payload.features.every(feature=>feature.properties.ohm_relation!==entry.ohm_relation),'an undrawable relation was drawn in '+window_.id+' '+year);
    assert(entry.open_chains>=0,'undrawable entry without a reason for '+window_.id+' '+year);
   }
   total+=listed.length;
  }
  assert(total===window_.manifest.excluded.length,'per-year undrawable count differs from the manifest for '+window_.id+': '+total);
  perWindow[window_.id]=total;
 }
 return perWindow;
});

const report={checkedAt:new Date().toISOString(),windows:windows.map(window_=>({id:window_.id,root:window_.root})),passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results,notes};
console.log(JSON.stringify({passed:report.passed,failed:report.failed,notes,checks:results.map(r=>({name:r.name,passed:r.passed,detail:r.detail,error:r.error}))},null,1));
if(out)fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
if(report.failed)process.exitCode=1;
