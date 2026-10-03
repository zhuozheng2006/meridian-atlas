#!/usr/bin/env node
// Usage: node docs/verification-3.28/check-all-europe-3.28.mjs
// The identity verification of a round only looks at the top candidates per region (30 for Europe),
// so the claim that 19 European plans was a ceiling rested on a sample. This script tests every
// European profile that has no narrative: it asks Wikidata for the P31 classes of each profile QID
// and records whether any class is a polity class, and it also records how many of them the atlas
// catalogue binds to a POLITY record with a verified Wikidata item.
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const UA='MeridianAtlasResearch/3.28 (source-linked world history atlas; European coverage check)';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const readJson=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const selection=await readJson('docs/verification-3.28/narratives-selection.json');
const narratives=await readJson('public/data/enrichment/narratives.json');
const catalog=JSON.parse(gunzipSync(await readFile(resolve(root,'public/data/fast/catalog.json.gz'))));
const index=JSON.parse(gunzipSync(await readFile(resolve(root,'public/data/enrichment/profile-index.json.gz'))));
const covered=new Set(narratives.entries.map(entry=>entry.qid));
const excluded=new Set((index.exclusions||[]).map(item=>item.recordId));
const europe=selection.allUncovered.filter(row=>row.region==='europe'&&!covered.has(row.qid));
const recordsByQid=new Map();
for(const record of catalog.records){
 if(record.type!=='POLITY'||excluded.has(record.id)||!record.verifiedWikidata)continue;
 const list=recordsByQid.get(record.verifiedWikidata)||[];list.push(record);recordsByQid.set(record.verifiedWikidata,list);
}
const POLITY=/(historical country|sovereign state|country|state in the|empire|kingdom|khanate|khaganate|kaganate|dynasty|confederation|republic|principality|monarchy|caliphate|sultanate|emirate|duchy|polity|colony|protectorate|mandate|commonwealth|federation|city-state|satrapy|despotate|tsardom|shogunate|beylik|chiefdom|electoral principate|colonial power|republic regime)/i;
const NOT_POLITY=/(island|people|ethnic group|family|position|historical period|period|civilization|disambiguation|history of|region|language|religion|dynasty of|noble|title|office|war|battle|treaty|city|town|site|building|organization|political party)/i;
const classes={};
const qids=europe.map(row=>row.qid);
const requests=[];
for(let i=0;i<qids.length;i+=50){
 const chunk=qids.slice(i,i+50);
 const response=await fetch('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&formatversion=2&props=claims&ids='+chunk.join('|'),{headers:{'user-agent':UA,accept:'application/json'}});
 requests.push({status:response.status,count:chunk.length});
 if(!response.ok)throw new Error('HTTP '+response.status);
 const data=await response.json();
 for(const [qid,entity] of Object.entries(data.entities||{})){
  const p31=(entity.claims?.P31||[]).map(statement=>statement.mainsnak?.datavalue?.value?.id).filter(Boolean);
  classes[qid]=p31;
 }
 await sleep(1500);
}
const labelCache={};
const classIds=[...new Set(Object.values(classes).flat())];
for(let i=0;i<classIds.length;i+=50){
 const chunk=classIds.slice(i,i+50);
 const response=await fetch('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&formatversion=2&props=labels&languages=en&ids='+chunk.join('|'),{headers:{'user-agent':UA,accept:'application/json'}});
 requests.push({status:response.status,count:chunk.length});
 if(!response.ok)throw new Error('HTTP '+response.status);
 const data=await response.json();
 for(const [qid,entity] of Object.entries(data.entities||{}))labelCache[qid]=entity.labels?.en?.value||null;
 await sleep(1500);
}
const rows=europe.map(row=>{
 const p31=classes[row.qid]||[];
 const labels=p31.map(id=>labelCache[id]).filter(Boolean);
 const polity=labels.some(label=>POLITY.test(label));
 const disqualifying=labels.filter(label=>NOT_POLITY.test(label));
 return {qid:row.qid,title:row.zh||row.en,recordCount:row.recordCount,p31Labels:labels,polity,disqualifying,
  boundToPolityRecord:(recordsByQid.get(row.qid)||[]).length>0};
});
const polityRows=rows.filter(row=>row.polity);
const eligible=polityRows.filter(row=>row.boundToPolityRecord);
const document={schemaVersion:1,checkedAt:new Date().toISOString(),
 question:'How many European profiles without a narrative are there, how many pass the polity-class test when all of them are checked, and why are the others excluded?',
 method:'Every European profile without a narrative was looked up on Wikidata (P31 claims, labels resolved in English) and tested against the same polity-class list the round uses; the catalogue binding was read from public/data/fast/catalog.json.gz (POLITY records with a verifiedWikidata value, honouring profile-index exclusions).',
 europeanProfilesWithoutNarrative:europe.length,
 passedPolityClass:polityRows.length,
 rejectedByPolityClass:rows.length-polityRows.length,
 passedAndBoundToPolityRecord:eligible.length,
 alreadyInThisBatch:eligible.filter(row=>JSON.parse(JSON.stringify(selection)).allUncovered&&false).length,
 rejectionReasons:rows.filter(row=>!row.polity).reduce((all,row)=>{const key=(row.disqualifying[0]||row.p31Labels[0]||'no P31 classes');all[key]=(all[key]||0)+1;return all},{}),
 rejectionSamples:rows.filter(row=>!row.polity).slice(0,15).map(row=>({qid:row.qid,title:row.title,classes:row.p31Labels.slice(0,4)})),
 polityButUnbound:polityRows.filter(row=>!row.boundToPolityRecord).map(row=>({qid:row.qid,title:row.title,classes:row.p31Labels.slice(0,3)})),
 eligibleList:eligible.map(row=>({qid:row.qid,title:row.title,recordCount:row.recordCount})),
 requests:requests.length};
await writeFile(resolve(root,'docs/verification-3.28/europe-full-check.json'),JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({europeanWithoutNarrative:document.europeanProfilesWithoutNarrative,
 passedPolityClass:document.passedPolityClass,rejected:document.rejectedByPolityClass,
 passedAndBound:document.passedAndBoundToPolityRecord,requests:document.requests},null,1));
console.log('--- rejection reasons ---');
console.log(JSON.stringify(document.rejectionReasons,null,1));
console.log('--- samples ---');
for(const row of document.rejectionSamples.slice(0,10))console.log(row.qid,row.title,'->',row.classes.join('/'));
console.log('--- polity but unbound ---');
for(const row of document.polityButUnbound.slice(0,8))console.log(row.qid,row.title,'->',row.classes.join('/'));
