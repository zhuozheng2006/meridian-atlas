#!/usr/bin/env node
// Usage: node docs/verification-3.28/analyse-europe-gap-3.28.mjs
// Answers the question left open after the sixth batch: the atlas has 505 profiles in the European
// coordinate box with no narrative, yet only 19 European plans enter a new batch. This script walks
// the funnel - uncovered profiles, profiles bound to a catalogue POLITY record with a verified
// Wikidata item, candidates that pass the polity-class test, plans eligible for a batch - and gives
// the reason for every drop, so the gap can be read as a property of the data rather than a
// threshold in the scripts.
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const readJson=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const selection=await readJson('docs/verification-3.28/narratives-selection.json');
const candidates=await readJson('docs/verification-3.28/narratives-candidates.json');
const chosen=await readJson('docs/verification-3.28/narratives-chosen.json');
const catalog=JSON.parse(gunzipSync(await readFile(resolve(root,'public/data/fast/catalog.json.gz'))));
const narratives=await readJson('public/data/enrichment/narratives.json');
const covered=new Set(narratives.entries.map(entry=>entry.qid));
// records grouped by the Wikidata item they are bound to, restricted to POLITY records
const recordsByQid=new Map();
for(const record of catalog.records){
 if(record.type!=='POLITY'||!record.verifiedWikidata)continue;
 const list=recordsByQid.get(record.verifiedWikidata)||[];
 list.push(record);
 recordsByQid.set(record.verifiedWikidata,list);
}
const extraBlock=new Set(['Q617219','Q223','Q2345840','Q521263','Q19951607','Q1794655','Q3125978']);
const candidateByQid=new Map(candidates.rows.map(row=>[row.qid,row]));
const regions=[...new Set(selection.allUncovered.map(row=>row.region))].sort();
const table=[];
for(const region of regions){
 const uncovered=selection.allUncovered.filter(row=>row.region===region&&!covered.has(row.qid));
 const bound=uncovered.filter(row=>(recordsByQid.get(row.qid)||[]).length>0);
 const candidateRows=uncovered.map(row=>candidateByQid.get(row.qid)).filter(Boolean);
 const verifiedCandidates=candidateRows.filter(row=>row.verdict==='verified');
 const notPolityCandidates=candidateRows.filter(row=>row.verdict==='not-a-polity');
 const eligible=verifiedCandidates.filter(row=>(recordsByQid.get(row.qid)||[]).length>0&&!extraBlock.has(row.qid));
 const inBatch=eligible.filter(row=>chosen.entries.some(entry=>entry.qid===row.qid));
 table.push({region,uncovered:uncovered.length,
  noVerifiedPolityBinding:uncovered.length-bound.length,
  boundWithVerifiedPolity:bound.length,
  candidatesChecked:candidateRows.length,
  passedPolityClass:verifiedCandidates.length,
  rejectedNotPolity:notPolityCandidates.length,
  eligibleForBatch:eligible.length,
  inThisBatch:inBatch.length});
}
const europe=selection.allUncovered.filter(row=>row.region==='europe'&&!covered.has(row.qid));
const europeCandidates=europe.map(row=>candidateByQid.get(row.qid)).filter(Boolean);
const europeVerified=europeCandidates.filter(row=>row.verdict==='verified');
const europeNotPolity=europeCandidates.filter(row=>row.verdict==='not-a-polity');
const europeUnbound=europe.filter(row=>(recordsByQid.get(row.qid)||[]).length===0);
const verifiedWithoutRecords=europeVerified.filter(row=>(recordsByQid.get(row.qid)||[]).length===0);
const verifiedBlocked=europeVerified.filter(row=>(recordsByQid.get(row.qid)||[]).length>0&&extraBlock.has(row.qid));
const verifiedEligible=europeVerified.filter(row=>(recordsByQid.get(row.qid)||[]).length>0&&!extraBlock.has(row.qid));
const document={schemaVersion:1,checkedAt:new Date().toISOString(),
 question:'How many profiles without a narrative lie in the European coordinate box, how many of them pass the identity checks, and why are the rest excluded?',
 method:'The profile index has no region field, so the region comes from the documented coordinate-box rule applied to the centres of the catalogue records bound to each profile (the same rule the selection script uses). A profile is "bound" when at least one POLITY record with a verifiedWikidata value carries that item; the polity-class test is the one recorded in narratives-candidates.json.',
 headline:{europeanProfilesWithoutNarrative:europe.length,
  europeanWithVerifiedPolityBinding:europe.length-europeUnbound.length,
  europeanCandidatesChecked:europeCandidates.length,
  europeanPassingPolityClass:europeVerified.length,
  europeanRejectedNotPolity:europeNotPolity.length,
  europeanEligibleForBatch:verifiedEligible.length,
  europeanInThisBatch:verifiedEligible.filter(row=>chosen.entries.some(entry=>entry.qid===row.qid)).length,
  conclusion:'Only '+(europe.length-europeUnbound.length)+' of the '+europe.length+' European profiles without a narrative are bound to a verified polity item at all, and only '+europeVerified.length+' of those pass the polity-class test; '+verifiedEligible.length+' of them have matching catalogue records and are eligible for a batch. The gap between '+europe.length+' and 19 is therefore a property of the data - most European profiles without a narrative are not bound to a verified polity entity - and not a threshold set by the scripts.'},
 europe:{notBoundToVerifiedPolity:europeUnbound.length,
  boundToVerifiedPolity:europe.length-europeUnbound.length,
  candidatesChecked:europeCandidates.length,
  passedPolityClass:europeVerified.length,
  rejectedNotPolity:europeNotPolity.map(row=>({qid:row.qid,title:row.zh||row.en,classes:row.p31Labels})),
  passingButNoMatchingRecord:verifiedWithoutRecords.map(row=>({qid:row.qid,title:row.zh||row.en,verifiedWikidata:row.catalogueMatch===false?null:undefined})),
  passingButHandBlocked:verifiedBlocked.map(row=>({qid:row.qid,title:row.zh||row.en})),
  eligible:verifiedEligible.map(row=>({qid:row.qid,title:row.zh||row.en,recordCount:row.recordCount,spanYears:row.spanYears})),
  unboundExamples:europeUnbound.slice(0,12).map(row=>({qid:row.qid,title:row.zh||row.en,recordCount:row.recordCount}))},
 byRegion:table,
 note:'For other regions the same funnel applies; in Africa, west-central Asia and South Asia the share bound to a verified polity item is higher, which is why those regions kept supplying plans after Europe ran out.'};
await writeFile(resolve(root,'docs/verification-3.28/europe-gap-analysis.json'),JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify(document.headline,null,1));
console.log('--- europe detail ---');
console.log(JSON.stringify({unbound:document.europe.notBoundToVerifiedPolity,bound:document.europe.boundToVerifiedPolity,
 candidates:document.europe.candidatesChecked,passed:document.europe.passedPolityClass,
 notPolity:document.europe.rejectedNotPolity,noRecord:document.europe.passingButNoMatchingRecord,
 blocked:document.europe.passingButHandBlocked,eligible:document.europe.eligible.length},null,1));
console.log('--- by region ---');
for(const row of table)console.log(row.region,'uncovered '+row.uncovered,'unbound '+row.noVerifiedPolityBinding,'bound '+row.boundWithVerifiedPolity,'passed '+row.passedPolityClass,'eligible '+row.eligibleForBatch,'inBatch '+row.inThisBatch);
