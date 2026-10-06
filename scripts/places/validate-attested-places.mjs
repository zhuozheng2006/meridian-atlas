#!/usr/bin/env node
// Usage: node scripts/places/validate-attested-places.mjs [repo-root] [report.json]
// Independent re-check of the shipped attested-place layer. It does not re-run the
// builder: it reads public/data/places/attested-places.json.gz, the edited source file,
// the reviewed handoff research and every existing place dataset, then asserts the
// isolation, provenance and honesty rules that the layer promises.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(process.argv[2]||resolve(dirname(fileURLToPath(import.meta.url)),'../..'));
const HANDOFF='/Users/zane/meridian_atlas/经纬纪-AI交接/研究资料/全球覆盖审查/settlement-candidates.json';
const results=[],counters={records:0,checks:0,bilingualParts:0,sources:0,decisions:0};
const check=async(name,fn)=>{try{await fn();results.push({name,passed:true});console.log('PASS',name);counters.checks++}catch(error){results.push({name,passed:false,error:error.message});console.error('FAIL',name,error.message)}};
const disk=async file=>JSON.parse(gunzipSync(await readFile(resolve(root,file))));
const raw=await readFile(resolve(root,'public/data/places/attested-places.json.gz'));
const data=JSON.parse(gunzipSync(raw));
const editorial=JSON.parse(await readFile(resolve(root,'editorial/attested-places.json'),'utf8'));
const supplemental=editorial.supplementalEvidenceFile?JSON.parse(await readFile(resolve(root,editorial.supplementalEvidenceFile),'utf8')):null;
const index=await disk('public/data/places/historical-settlements-index.json.gz');
const urban=await disk('public/data/places/urban-observations.json.gz');
const capitals=await disk('public/data/places/historical-capitals.json.gz');
const modern=await disk('public/data/places/modern-cities.json.gz');
const existing=new Map();
for(const place of index.places)existing.set(place.id,{name:place.name,coordinates:place.coordinates,dataset:'historical-settlements'});
for(const city of urban.cities)existing.set(city.id,{name:city.name,coordinates:city.coordinates,dataset:'urban-observations'});
for(const claim of capitals.claims)existing.set(claim.id,{name:claim.name,coordinates:claim.coordinates,dataset:'historical-capitals'});
for(const city of modern.cities)existing.set(city.id,{name:city.name,coordinates:city.coordinates,dataset:'modern-cities'});
let handoff=null;
try{handoff=JSON.parse(await readFile(HANDOFF,'utf8'))}catch{}
const TRADITIONAL=/[與臺灣國學會東車馬鳥魚點線個時間問題則無為說話語實質]/;
const ZH_MIN=38;
const haversine=(a,b)=>{const toRad=d=>d*Math.PI/180;const dLat=toRad(b[1]-a[1]),dLon=toRad(b[0]-a[0]);const s=Math.sin(dLat/2)**2+Math.cos(toRad(a[1]))*Math.cos(toRad(b[1]))*Math.sin(dLon/2)**2;return 6371*2*Math.asin(Math.sqrt(s))};

await check('The shipped layer is a deterministic gzip with a zeroed mtime',()=>{
 assert.equal(raw[4],0);assert.equal(raw[5],0);assert.equal(raw[6],0);assert.equal(raw[7],0);assert.equal(raw[9],255);
 assert.equal(data.layer,'attested-places');
});
await check('Fourteen site records, two enhancements and four documented deferrals ship together',()=>{
 assert.equal(data.records.length,14);assert.equal(data.enhancements.length,2);assert.equal(data.deferred.length,4);
 assert.deepEqual(data.counts,{records:14,enhancements:2,deferred:4,reviewedCandidates:20});
 assert.equal(new Set(data.records.map(record=>record.id)).size,14);
 for(const record of data.records){assert.match(record.id,/^attested:[a-z0-9-]+$/);assert.equal(record.kind,'attested-site');counters.records++}
});
await check('The review ledger accounts for every reviewed candidate exactly once',()=>{
 assert.equal(editorial.reviewLedger.length,18,'original handoff ledger stays intact');
 assert.equal(editorial.supplementalReviewLedger.length,2);
 const ledger=[...editorial.reviewLedger,...editorial.supplementalReviewLedger];
 assert.equal(ledger.length,20);assert.equal(new Set(ledger.map(row=>row.candidateId)).size,20);
 const decisions=ledger.reduce((all,row)=>{all[row.decision]=(all[row.decision]||0)+1;return all},{});
 assert.deepEqual(decisions,{integrated:14,enhancement:2,deferred:4});
 counters.decisions=ledger.length;
 for(const row of ledger.filter(row=>row.decision==='integrated'))assert(data.records.some(record=>record.id===row.recordId),row.recordId);
 for(const row of ledger.filter(row=>row.decision==='enhancement'))assert(data.enhancements.some(item=>item.id===row.recordId),row.recordId);
 for(const row of ledger.filter(row=>row.decision==='deferred'))assert.equal(row.recordId,null);
});
await check('Every shipped record keeps its authored bilingual text, period and review checks',()=>{
 const authored=new Map(editorial.entries.map(record=>[record.id,record]));
 for(const record of data.records){
  const source=authored.get(record.id);assert(source,record.id);
  assert.equal(record.period.start,source.period.start);assert.equal(record.period.end,source.period.end);
  assert.equal(record.period.dateQuote,source.period.dateQuote);
  assert.deepEqual(record.location.coordinates,source.location.coordinates);
  assert.equal(record.continuousOccupationAsserted,false);assert.equal(record.displayWindow,null);
  assert.equal(record.location.representativePoint,true);assert.equal(record.location.accuracyMeters,null);
  let zhTotal=0,enWords=0;
  for(const part of ['setting','development','legacy'])for(const lang of ['zh','en']){
   const text=record.narrative[part][lang];assert(text&&text.trim().length>20,record.id+' '+part+' '+lang);
   if(lang==='zh'){assert(text.length>=ZH_MIN,record.id+' '+part+' zh too short');assert(!TRADITIONAL.test(text),record.id+' traditional characters in '+part);zhTotal+=text.length;}
   else enWords+=text.split(/\s+/).length;
   counters.bilingualParts++;
  }
  assert(zhTotal>=155,record.id+' total Chinese narrative too short: '+zhTotal);
  assert(enWords>=80,record.id+' total English narrative too short: '+enWords);
  for(const sub of ['spatial','temporal'])for(const lang of ['zh','en']){const text=record.scope[sub][lang];assert(text&&text.trim().length>10,record.id+' scope.'+sub+' '+lang);if(lang==='zh')assert(!TRADITIONAL.test(text),record.id+' traditional characters in scope.'+sub);}
  for(const lang of ['zh','en'])assert(record.significance[lang]?.trim().length>10,record.id+' significance '+lang);
  const required=['coordinate-provenance','period-source-anchored','no-continuous-occupation','no-identity-merge','display-window-null'];
  for(const id of required){const found=(record.review.checks||[]).find(item=>item.id===id);assert(found&&found.passed===true,record.id+' '+id)}
  assert.equal(record.review.reviewedOn,source.review.reviewedOn,record.id);
  assert.match(record.review.reviewedOn,/^\d{4}-\d{2}-\d{2}$/);
  assert.equal(record.review.candidateReviewStatus,authored.get(record.id).review.candidateReviewStatus);
 }
});
await check('Periods never escape their verbatim source range and open ends are declared',()=>{
 for(const record of data.records){
  const range=record.period.sourceRange;assert(range,record.id);
  if(range.to===null){assert.equal(record.period.displayHorizon,record.period.end,record.id);assert(record.period.displayHorizonReasonZh&&record.period.displayHorizonReasonEn,record.id)}
  else{assert.equal(record.period.displayHorizon,null,record.id);assert(record.period.start>=range.from&&record.period.end<=range.to,record.id+' escapes '+range.from+'..'+range.to)}
  assert(Number.isInteger(record.period.start)&&Number.isInteger(record.period.end)&&record.period.start!==0&&record.period.end!==0,record.id);
 }
});
await check('UNESCO quotes, coordinates and property ids match their reviewed evidence',()=>{
 const byId=new Map((handoff?.entries||[]).map(entry=>[entry.id,entry]));
 const newById=new Map((supplemental?.entries||[]).map(entry=>[entry.id,entry]));
 for(const record of data.records){
  const authored=editorial.entries.find(item=>item.id===record.id);
  const candidate=authored.researchCandidateId?newById.get(authored.researchCandidateId):byId.get(authored.handoffCandidateId);
  if(!candidate&&!authored.researchCandidateId&&!handoff)continue;
  assert(candidate,record.id+' has no reviewed candidate');
  assert.equal(candidate.dateQuote,record.period.dateQuote,record.id+' date quote');
  assert.deepEqual(candidate.coordinates,record.location.coordinates,record.id+' coordinates');
  assert.equal(String(candidate.sourcePropertyId),record.sources[0].propertyId,record.id+' property id');
  assert.equal(candidate.sourcePageReadOn,record.sources[0].readOn,record.id+' read date');
  assert(record.sources[0].url.startsWith('https://whc.unesco.org/en/list/'),record.id);
  counters.sources+=record.sources.length;
 }
});
await check('New city evidence snapshots, DMS conversion and activity periods remain independently verifiable',async()=>{
 assert(supplemental);assert.equal(supplemental.entries.length,2);
 const evidenceRoot=dirname(resolve(root,editorial.supplementalEvidenceFile));
 for(const snapshot of supplemental.snapshots){
  const bytes=await readFile(resolve(evidenceRoot,snapshot.path));
  assert.equal(bytes.length,snapshot.bytes,snapshot.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),snapshot.sha256,snapshot.path);
  assert(snapshot.representation.includes('not original HTML'),snapshot.path);
 }
 const expected=[['si-thep',[101+9/60+4.01/3600,15+27/60+56.94/3600],501,1000,'1662','1662-001'],['sambor-prei-kuk',[105+2/60+35/3600,12+52/60+21/3600],601,1100,'1532',null]];
 for(const [id,coordinates,start,end,property,component] of expected){
  const evidence=supplemental.entries.find(item=>item.id===id);assert(evidence,id);
  const record=data.records.find(item=>item.id===evidence.recordId);assert(record,id);
  assert.deepEqual(record.location.coordinates,coordinates,id+' DMS conversion');
  assert.deepEqual([record.period.start,record.period.end],[start,end],id+' activity period');
  assert.equal(evidence.sourcePropertyId,property);assert.equal(evidence.sourceComponentId,component);
  assert.equal(record.sources[0].sourceComponentId??null,component);
  assert.equal(record.sources[0].url,evidence.url);assert.equal(record.sources[0].coordinateUrl,evidence.coordinateUrl);
  assert.equal(evidence.sourceDMS,record.location.sourceDMS);assert.deepEqual(evidence.sourceRange,record.period.sourceRange);
  assert.equal(record.review.reviewedOn,'2026-10-06');
 }
 const temple=data.records.find(item=>item.id==='attested:sambor-prei-kuk');
 assert(temple.period.dateQuote.includes('repairs and modifications'));
 assert(temple.period.interpretationEn.includes('repairs and modifications'));
 assert(temple.location.coordinateMeaningEn.includes('temple-zone'));
 assert(!temple.period.dateQuote.includes('capital'));
 const claims=JSON.parse(await readFile(resolve(evidenceRoot,'claim-evidence.json'),'utf8'));
 for(const evidence of supplemental.entries){
  for(const claim of ['period','coordinates'])assert(claims.some(row=>row.recordId===evidence.recordId&&row.claim===claim&&row.relation==='direct-evidence'));
 }
});
await check('No attested record is merged into, or duplicates, an existing place record',()=>{
 const collisions=[];
 for(const record of data.records){
  for(const [id,known] of existing){
   if(record.id===id)collisions.push(record.id+'=='+id);
   const sameCoordinates=JSON.stringify(known.coordinates)===JSON.stringify(record.location.coordinates);
   const sameName=known.name&&record.nameEn&&known.name.toLowerCase()===record.nameEn.toLowerCase();
   if(sameCoordinates&&sameName)collisions.push(record.id+' duplicates '+id);
  }
 }
 assert.deepEqual(collisions,[],'attested layer must stay separate from existing datasets');
 for(const record of data.records)for(const nearby of record.review.nearbyExistingRecords){
  if(nearby.found!==false)assert(existing.has(nearby.id),record.id+' unresolved nearby id without flag');
  else assert(!existing.has(nearby.id),record.id+' flagged unresolved but exists');
 }
});
await check('Resolved nearby records carry recomputed distances that match the research file',()=>{
 let checked=0;
 for(const record of data.records)for(const nearby of record.review.nearbyExistingRecords){
  if(nearby.found===false){assert(nearby.note,record.id+' unresolved note');continue}
  const known=existing.get(nearby.id);assert(known,nearby.id);
  assert.equal(nearby.dataset,known.dataset,nearby.id);
  const distance=haversine(record.location.coordinates,known.coordinates);
  assert(Math.abs(distance-nearby.distanceKm)<0.05,nearby.id+' recomputed distance drift');
  if(nearby.recordedDistanceKm!==null)assert(Math.abs(distance-nearby.recordedDistanceKm)<0.2,nearby.id+' differs from the research distance');
  checked++;
 }
 assert(checked>=10,'expected at least ten resolved nearby records');
});
await check('Enhancement entries attach to real records without overwriting coordinates or observations',()=>{
 assert.equal(data.enhancements.length,2);
 for(const item of data.enhancements){
  assert.match(item.id,/^enhancement:/);assert.equal(item.kind,'existing-record-enhancement');
  assert(Array.isArray(item.attestationCoordinate)&&item.attestationCoordinate.length===2,item.id);
  assert(item.existingRecordIds.length>=2,item.id);
  for(const bound of item.existingRecords){
   const known=existing.get(bound.id);assert(known,item.id+' '+bound.id);
   assert.deepEqual(bound.coordinates,known.coordinates,bound.id+' coordinate must not be rewritten');
   assert.equal(bound.dataset,known.dataset,bound.id);
   assert(Math.abs(haversine(item.attestationCoordinate,known.coordinates)-bound.distanceToAttestationPointKm)<0.05,bound.id+' distance drift');
  }
 }
 const teotihuacan=data.enhancements.find(item=>item.id==='enhancement:teotihuacan');
 const early=teotihuacan.existingRecords.find(bound=>bound.id==='modelski-ancient:128');
 assert(early.observations.some(observation=>observation[0]<0),'early negative-year observations must stay in the record');
});
await check('Deferred candidates keep their reasons and never appear as shipped points',()=>{
 for(const item of data.deferred){
  assert(item.candidateId&&item.reasonZh&&item.reasonEn&&item.nextStepZh&&item.nextStepEn,item.candidateId);
  assert(!data.records.some(record=>record.id.includes(item.candidateId)),item.candidateId);
 }
 const ids=new Set(data.records.map(record=>record.id));
 for(const candidateId of ['sri-ksetra','mapungubwe','mbanza-kongo','roi-mata-residence'])assert(![...ids].some(id=>id.includes(candidateId)),candidateId);
});
await check('Chinese text is simplified across the layer',()=>{
 const walk=value=>{if(typeof value==='string'){if(TRADITIONAL.test(value))throw new Error('traditional characters: '+value.slice(0,40))}else if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')Object.values(value).forEach(walk)};
 walk(data.records.map(record=>({narrative:record.narrative,scope:record.scope,significance:record.significance,review:record.review.checks.map(item=>item.statementZh)})));
});
await check('Read semantics for the integration layer are shipped with the data',()=>{
 assert(data.readSemantics.yearWindow.includes('period.start'));assert(data.readSemantics.identity.includes('never merge'));
 assert(data.readSemantics.boundaries.includes('Do not'));assert(data.policy.layer.includes('Independent'));
});

const report={testedAt:new Date().toISOString(),data:'public/data/places/attested-places.json.gz',
 dataSha256:createHash('sha256').update(raw).digest('hex'),counts:counters,handoffAvailable:Boolean(handoff),checks:results,passed:results.every(result=>result.passed)};
if(process.argv[3])await writeFile(resolve(process.argv[3]),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:results.filter(result=>result.passed).length,total:results.length,...counters}));
if(!report.passed)process.exitCode=1;
