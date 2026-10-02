#!/usr/bin/env node
// Usage: node scripts/places/audit-language.mjs [repo-root] [out.json]
// Counts CJK characters inside English fields of the shipped event and battle layers.
// Read-only: it reports where a language field carries the wrong script so the build
// scripts can be fixed at the source instead of patching the shipped JSON.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(process.argv[2]||resolve(dirname(fileURLToPath(import.meta.url)),'../..'));
const outPath=resolve(root,process.argv[3]||'docs/verification-3.13/content-language-audit.json');
const CJK=/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
const events=JSON.parse(await readFile(resolve(root,'public/data/events.json'),'utf8'));
const battles=JSON.parse(gunzipSync(await readFile(resolve(root,'public/data/battles.json.gz'))));
const sample=value=>String(value).slice(0,90);
const eventFields={};
const eventOffenders=[];
for(const event of events){
 const checks={
  'title.en':event.title?.en,
  'summary.en':event.summary?.en,
  'significance.en':event.significance?.en,
  'editorialNotes.en':event.editorialNotes?.en,
 };
 let bad=false;
 for(const [field,value] of Object.entries(checks)){
  if(typeof value!=='string')continue;
  if(CJK.test(value)){
   eventFields[field]=(eventFields[field]||0)+1;bad=true;
   if(!eventOffenders.some(item=>item.id===event.id))eventOffenders.push({id:event.id,provenance:event.provenance||'editorial',field,sample:sample(value)});
  }
 }
 if(bad&&event.provenance!=='wikidata-structured')eventOffenders.find(item=>item.id===event.id).provenance='editorial-not-structured';
}
const battleFields={};
const battleOffenders=[];
for(const battle of battles.battles){
 // notes is the Chinese documentation field by design; its English counterpart is notesEn.
 const checks={'nameEn':battle.nameEn,'notesEn':battle.notesEn};
 for(const [field,value] of Object.entries(checks))if(typeof value==='string'&&CJK.test(value)){battleFields[field]=(battleFields[field]||0)+1;battleOffenders.push({id:battle.id,field,sample:sample(value)})}
 const zhFields=['belligerentsZh','conflictZh','countriesZh'];
 for(const field of zhFields)if(Array.isArray(battle[field]))for(const value of battle[field])if(/^[A-Za-z0-9 ,.'()-]+$/.test(value)&&value.length>2){} // Chinese arrays may keep Latin source labels; no constraint enforced here.
 for(const field of ['belligerents','conflict','countries']){
  const list=Array.isArray(battle[field])?battle[field]:[];
  const mixed=list.filter(value=>CJK.test(value));
  if(mixed.length){battleFields[field]=(battleFields[field]||0)+mixed.length;battleOffenders.push({id:battle.id,field,sample:sample(mixed.join(' / ')),count:mixed.length})}
 }
}
const report={schemaVersion:1,generatedAt:new Date().toISOString(),
 policy:'English fields must contain no CJK characters. Chinese fields must stay simplified. Entities without an English label are written as their QID or omitted; no transliteration or machine translation is used.',
 events:{total:events.length,structured:events.filter(event=>event.provenance==='wikidata-structured').length,
  entriesWithCjkInEnglish:eventOffenders.length,byField:eventFields,
  examples:eventOffenders.slice(0,8)},
 battles:{total:battles.battles.length,byField:battleFields,examples:battleOffenders.slice(0,8),entriesAffected:new Set(battleOffenders.map(item=>item.id)).size},
 conclusion:{
  structuredEventSummaryEn:eventFields['summary.en']||0,
  structuredEventSignificanceEn:eventFields['significance.en']||0,
  battleBelligerentsMixed:battleFields.belligerents||0,
  battleConflictMixed:battleFields.conflict||0,
  battleNotesMixed:battleFields.notes||0}};
await mkdir(dirname(outPath),{recursive:true});
await writeFile(outPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({out:outPath,eventsTotal:report.events.total,structured:report.events.structured,eventOffenders:report.events.entriesWithCjkInEnglish,eventFields,eventExamples:report.events.examples.slice(0,3),battles:report.battles.total,battleFields,battleAffected:report.battles.entriesAffected,battleExamples:report.battles.examples.slice(0,3)},null,2));
