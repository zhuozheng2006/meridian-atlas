#!/usr/bin/env node
// Usage: node scripts/places/build-attested-places.mjs [--check] [repo-root]
// Builds public/data/places/attested-places.json.gz from editorial/attested-places.json.
// The layer is deliberately isolated: it never edits Pleiades, Chandler, Modelski or
// Wikidata-derived records, and it re-verifies every UNESCO coordinate and date quote
// against the reviewed handoff research file when that file is available.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const args=process.argv.slice(2);
const checkOnly=args.includes('--check');
const root=resolve(args.find(arg=>!arg.startsWith('--'))||resolve(dirname(fileURLToPath(import.meta.url)),'../..'));
const HANDOFF='/Users/zane/meridian_atlas/经纬纪-AI交接/研究资料/全球覆盖审查/settlement-candidates.json';
const TRADITIONAL=/[與臺灣國學會東車馬鳥魚點線個時間問題則無為說話語實質]/;
const problems=[];
const fail=message=>problems.push(message);
const ROUND=value=>Math.round(value*10000)/10000;
const haversine=(a,b)=>{const toRad=d=>d*Math.PI/180;const dLat=toRad(b[1]-a[1]),dLon=toRad(b[0]-a[0]);const s=Math.sin(dLat/2)**2+Math.cos(toRad(a[1]))*Math.cos(toRad(b[1]))*Math.sin(dLon/2)**2;return ROUND(6371*2*Math.asin(Math.sqrt(s)))};
const disk=async file=>JSON.parse(gunzipSync(await readFile(resolve(root,file))));
const editorial=JSON.parse(await readFile(resolve(root,'editorial/attested-places.json'),'utf8'));
const index=await disk('public/data/places/historical-settlements-index.json.gz');
const urban=await disk('public/data/places/urban-observations.json.gz');
const capitals=await disk('public/data/places/historical-capitals.json.gz');
const modern=await disk('public/data/places/modern-cities.json.gz');
const known=new Map();
for(const place of index.places)known.set(place.id,{id:place.id,name:place.name,nameZh:place.nameZh??null,coordinates:place.coordinates,periods:place.periods??null,dataset:'historical-settlements'});
for(const city of urban.cities)known.set(city.id,{id:city.id,name:city.name,nameZh:city.nameZh??null,coordinates:city.coordinates,observations:city.observations??null,dataset:'urban-observations'});
for(const claim of capitals.claims)known.set(claim.id,{id:claim.id,name:claim.name,nameZh:claim.nameZh??null,coordinates:claim.coordinates,periods:claim.periods??null,dataset:'historical-capitals'});
for(const city of modern.cities)known.set(city.id,{id:city.id,name:city.name,nameZh:city.nameZh??null,coordinates:city.coordinates,dataset:'modern-cities'});
let handoff=null;
try{handoff=JSON.parse(await readFile(HANDOFF,'utf8'))}catch{}
const handoffById=new Map((handoff?.entries||[]).map(entry=>[entry.id,entry]));

const bilingual=(value,where)=>{if(!value||typeof value.zh!=='string'||typeof value.en!=='string'||value.zh.trim().length<8||value.en.trim().length<8)fail(where+': bilingual text too short');else if(TRADITIONAL.test(value.zh))fail(where+': traditional characters in zh text')};
const inSourceRange=(period,where)=>{
 const range=period.sourceRange;
 if(!range||!['bce-range','ce-range','ce-centuries','bce-to-ce','event-years','open-ended-from'].includes(range.kind))return fail(where+': unknown sourceRange kind');
 if(!Number.isInteger(range.from))fail(where+': sourceRange.from must be an integer');
 if(range.to!==null&&!Number.isInteger(range.to))fail(where+': sourceRange.to must be an integer or null');
 if(range.to===null){
  if(period.displayHorizon===null||!Number.isInteger(period.displayHorizon))fail(where+': open-ended source requires a declared integer displayHorizon');
  else if(period.end!==period.displayHorizon)fail(where+': period.end must equal the declared display horizon for open-ended sources');
 }else if(period.start<range.from||period.end>range.to)fail(where+': period '+period.start+'..'+period.end+' escapes source range '+range.from+'..'+range.to);
 if(!Number.isInteger(period.start)||!Number.isInteger(period.end)||!period.start||period.end<period.start)fail(where+': invalid period bounds');
};

const records=[];
for(const record of editorial.entries){
 const where=record.id||'(record without id)';
 if(!/^attested:[a-z0-9-]+$/.test(where))fail(where+': id must be attested:<slug>');
 for(const key of ['kind','region','nameZh','nameEn'])if(!record[key])fail(where+': missing '+key);
 if(record.kind!=='attested-site')fail(where+': unexpected kind '+record.kind);
 bilingual(record.scope?.spatial,where+' scope.spatial');bilingual(record.scope?.temporal,where+' scope.temporal');
 bilingual(record.significance,where+' significance');
 for(const part of ['setting','development','legacy'])bilingual(record.narrative?.[part],where+' narrative.'+part);
 bilingual(record.period?.interpretationZh?{zh:record.period.interpretationZh,en:record.period.interpretationEn}:null,where+' period.interpretation');
 inSourceRange(record.period||{},where);
 if(!Array.isArray(record.location?.coordinates)||record.location.coordinates.length!==2)fail(where+': coordinates');
 else{const [lon,lat]=record.location.coordinates;if(!(lon>=-180&&lon<=180&&lat>=-90&&lat<=90))fail(where+': coordinate out of range')}
 if(record.location?.representativePoint!==true)fail(where+': representativePoint must be true');
 if(record.location?.accuracyMeters!==null)fail(where+': accuracyMeters must stay null');
 if(record.continuousOccupationAsserted!==false)fail(where+': continuous occupation must not be asserted');
 if(record.displayWindow!==null)fail(where+': displayWindow must stay null');
 if(!Array.isArray(record.sources)||!record.sources.length)fail(where+': source required');
 for(const source of record.sources||[]){if(!source.publisher||!source.title||!source.readOn)fail(where+': incomplete source '+source.id);try{if(new URL(source.url).protocol!=='https:')fail(where+': source must use https')}catch{fail(where+': bad source url')}}
 const checkIds=(record.review?.checks||[]).map(check=>check.id);
 for(const required of ['coordinate-provenance','period-source-anchored','no-continuous-occupation','no-identity-merge','display-window-null'])if(!checkIds.includes(required))fail(where+': missing review check '+required);
 for(const check of record.review?.checks||[])if(check.passed!==true||!check.statementZh||!check.statementEn)fail(where+': incomplete check '+check.id);
 // Cross-check against the reviewed handoff research where it is available.
 const candidate=handoffById.get(record.handoffCandidateId||'');
 if(candidate&&handoff){
  if(JSON.stringify(candidate.coordinates)!==JSON.stringify(record.location.coordinates))fail(where+': coordinates differ from handoff '+JSON.stringify(candidate.coordinates));
  if(candidate.dateQuote!==record.period.dateQuote)fail(where+': dateQuote differs from handoff "'+candidate.dateQuote+'"');
  if(String(candidate.sourcePropertyId)!==String(record.sources[0]?.propertyId))fail(where+': property id differs from handoff');
 }
 records.push(record);
}
if(new Set(records.map(record=>record.id)).size!==records.length)fail('duplicate record ids');
// Every handoff candidate must be accounted for exactly once in the ledger.
if(handoff){
 const ids=(handoff.entries||[]).map(entry=>entry.id).sort();
 const ledger=(editorial.reviewLedger||[]).map(row=>row.candidateId).sort();
 if(JSON.stringify(ids)!==JSON.stringify(ledger))fail('review ledger does not cover the handoff candidates exactly once');
 for(const row of editorial.reviewLedger||[]){
  if(row.decision==='integrated'&&!records.some(record=>record.id===row.recordId))fail('ledger points at a missing record '+row.recordId);
  if(row.decision==='deferred'&&row.recordId)fail('deferred candidate must not carry a record id');
 }
 const decisions=editorial.reviewLedger.reduce((all,row)=>{all[row.decision]=(all[row.decision]||0)+1;return all},{});
 for(const [decision,count] of Object.entries(decisions))if(decision!=='integrated'&&decision!=='enhancement'&&decision!=='deferred')fail('unknown ledger decision '+decision);
}
// Nearby records are review prompts: resolve them against shipped data and recompute distance.
const nearby=[];
for(const record of records){
 const resolved=[];
 for(const item of record.nearbyExistingRecords||[]){
  const knownRecord=known.get(item.id);
  if(!knownRecord){resolved.push({...item,found:false,note:'not found in the shipped place datasets'});continue}
  const distance=haversine(record.location.coordinates,knownRecord.coordinates);
  resolved.push({id:item.id,name:knownRecord.name,nameZh:knownRecord.nameZh,kind:item.kind,dataset:knownRecord.dataset,found:true,distanceKm:distance,recordedDistanceKm:item.distanceKm??null,distanceDeltaKm:item.distanceKm===null||item.distanceKm===undefined?null:ROUND(Math.abs(distance-item.distanceKm))});
 }
 nearby.push({recordId:record.id,resolved});
}
// Enhancements attach to existing records without overwriting them.
const enhancements=[];
for(const item of editorial.enhancements||[]){
 const where=item.id||'(enhancement without id)';
 bilingual(item.proposedUse,where+' proposedUse');bilingual(item.coordinatePolicy,where+' coordinatePolicy');bilingual(item.notes,where+' notes');
 bilingual({zh:item.attestationPeriod?.interpretationZh,en:item.attestationPeriod?.interpretationEn},where+' attestation interpretation');
 if(!Array.isArray(item.attestationCoordinate)||item.attestationCoordinate.length!==2)fail(where+': attestationCoordinate required');
 inSourceRange(item.attestationPeriod||{},where);
 const existing=[];
 for(const id of item.existingRecordIds||[]){
  const knownRecord=known.get(id);
  if(!knownRecord)fail(where+': existing record '+id+' not found in shipped datasets');
  else existing.push({id,dataset:knownRecord.dataset,name:knownRecord.name,nameZh:knownRecord.nameZh,coordinates:knownRecord.coordinates,periods:knownRecord.periods??null,observations:knownRecord.observations??null,distanceToAttestationPointKm:haversine(item.attestationCoordinate,knownRecord.coordinates)});
 }
 enhancements.push({...item,existingRecords:existing});
}
if(problems.length){console.error('FAIL build-attested-places\n'+problems.join('\n'));process.exit(1)}
const built={schemaVersion:1,builtAt:process.env.ATTESTED_BUILT_AT||'2026-10-03T00:00:00+00:00',layer:'attested-places',policy:editorial.policy,
 counts:{records:records.length,enhancements:enhancements.length,deferred:(editorial.deferred||[]).length,reviewedCandidates:(editorial.reviewLedger||[]).length},
 regions:records.reduce((all,record)=>{all[record.region]=(all[record.region]||0)+1;return all},{}),
 records:records.map(record=>({...record,review:{...record.review,nearbyExistingRecords:nearby.find(item=>item.recordId===record.id)?.resolved||[]}})),
 enhancements,
 deferred:editorial.deferred||[],
 readSemantics:{yearWindow:'A record is active for a year only when period.start <= year <= period.end; no interpolation across gaps.',kinds:'Only kind="attested-site" is shipped; enhancements carry kind="existing-record-enhancement" and must be attached to existingRecordIds, never inserted as new points.',identity:'Attested ids never merge with Pleiades/Chandler/Modelski ids; nearbyExistingRecords are prompts.',search:'Match nameZh, nameEn and aliases; show the period, the source link and the representative-point caveat.',boundaries:'Do not use these coordinates to draw or clip polygons.'}};
const text=JSON.stringify(built,null,2)+'\n';
const gzip=gzipSync(Buffer.from(text),{level:9});
gzip[4]=gzip[5]=gzip[6]=gzip[7]=0;gzip[9]=255;
if(JSON.stringify(JSON.parse(gunzipSync(gzip).toString()))!==JSON.stringify(built))fail('gzip round-trip mismatch');
const report={generatedAt:new Date().toISOString(),records:records.length,enhancements:enhancements.length,deferred:(editorial.deferred||[]).length,
 handoffVerified:Boolean(handoff),nearbyResolved:nearby.flatMap(item=>item.resolved).filter(item=>item.found).length,
 nearbyUnresolved:nearby.flatMap(item=>item.resolved).filter(item=>!item.found).map(item=>item.id),
 distanceChecks:nearby.flatMap(item=>item.resolved).filter(item=>item.found&&item.distanceDeltaKm!==null&&item.distanceDeltaKm>0.2).map(item=>({recordId:item.id,recorded:item.recordedDistanceKm,recomputed:item.distanceKm})),
 enhancementExistingRecords:enhancements.flatMap(item=>item.existingRecords.map(record=>record.id))};
await mkdir(resolve(root,'docs/verification-3.10'),{recursive:true});
await writeFile(resolve(root,'docs/verification-3.10/content-attested-places-build.json'),JSON.stringify(report,null,2)+'\n');
if(checkOnly){console.log(JSON.stringify({result:'checked',...report},null,2));process.exit(0)}
await writeFile(resolve(root,'public/data/places/attested-places.json.gz'),gzip);
console.log(JSON.stringify({result:'built',out:'public/data/places/attested-places.json.gz',...report,gzipBytes:gzip.length},null,2));
