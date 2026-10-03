#!/usr/bin/env node
// Usage: node scripts/places/apply-atrocities-3.17.mjs [--check]
// Bilingual strengthening pass over public/data/atrocities.json(+.gz).
//
// Two things change in the 3.17 round, and nothing else:
//
// a) Chinese names. The 3.16 build looked up the plain \`zh\` label and shipped 37 of 293 names.
//    This pass first accepts any Chinese label variant Wikidata records for the entity itself
//    (zh, zh-hans, zh-hant, zh-cn, zh-tw, zh-hk, zh-sg, zh-my), then the zh.wikipedia sitelink,
//    and finally a Chinese article found by search whose introduction was read and confirmed to
//    document the same event (recorded by hand in docs/verification-3.17/atrocities-zh-names.json).
//    A name is never transliterated or machine translated: when no Chinese source names the
//    event, nameZh stays null and the incident is counted as such.
//
// b) English country/conflict/victim values. The shipped English arrays were empty because the
//    3.15 sweep kept only Chinese label strings. This pass reads the entity's own P17 (country),
//    P361 (part of) and P710 (participant) statements, resolves the Chinese and English labels of
//    exactly those entities, and writes an English value only where that entity's Chinese label
//    is the string the layer already records. Unresolved slots are null, never a translation.
//
// Coordinates, years, regions, classes, sources and notes are untouched.
import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const checkOnly=process.argv.includes('--check');
const ACCESSED_AT='2026-10-03';
const dataPath=resolve(root,'public/data/atrocities.json');
const evidencePath=resolve(root,'docs/verification-3.17/atrocities-evidence.json');
const namesPath=resolve(root,'docs/verification-3.17/atrocities-zh-names.json');
const document=JSON.parse(await readFile(dataPath,'utf8'));
const evidence=JSON.parse(await readFile(evidencePath,'utf8'));
const evidenceByQid=new Map(evidence.rows.map(row=>[row.qid,row]));
let confirmed={entries:[]};
try{confirmed=JSON.parse(await readFile(namesPath,'utf8'))}catch{}
const confirmedByQid=new Map((confirmed.entries||[]).map(entry=>[entry.qid,entry]));
const labels=evidence.labels||{};
const normalise=value=>String(value||'').replace(/\s+/g,'').trim();
const problems=[];

// The 3.15 sweep stored the statement labels after a MediaWiki zh-cn conversion, so an entity
// whose Wikidata label exists only in traditional script records a simplified string here. A
// slot is matched against every label variant of the statement entity, original and converted.
const formsOf=qid=>{
 const label=labels[qid]||{};
 const forms=new Set([label.cjkZh,label.zh,...Object.values(label.zhVariant||{}),...Object.values(label.zhSimplifiedVariants||{})]);
 return [...forms].map(normalise).filter(Boolean);
};
const englishFor=(qid,zhStrings)=>{
 const candidates=[...(evidenceByQid.get(qid)?.countries||[]),...(evidenceByQid.get(qid)?.conflict||[]),...(evidenceByQid.get(qid)?.victims||[])];
 const used=new Set();
 return (zhStrings||[]).map(text=>{
  const target=normalise(text);
  const hit=candidates.find(qid=>!used.has(qid)&&formsOf(qid).includes(target));
  if(!hit)return null;
  used.add(hit);
  return labels[hit]?.en||null;
 });
};
const nameBySource={wikidataZhName:0,wikidataZhVariant:0,zhwikiSitelink:0,zhwikiSearchConfirmed:0,existing:0,none:0};
let changedNames=[];
for(const incident of document.incidents){
 const row=evidenceByQid.get(incident.qid);
 if(!row){problems.push('no evidence row for '+incident.qid);continue}
 const before=incident.nameZh;
 const search=confirmedByQid.get(incident.qid);
 if(before&&!search){nameBySource.existing++}
 else if(search){
  incident.nameZh=search.nameZh;incident.nameZhSource=search.source||'zhwiki-search-confirmed';
  nameBySource.zhwikiSearchConfirmed++;
  if(before!==incident.nameZh)changedNames.push({qid:incident.qid,from:before,to:incident.nameZh,source:incident.nameZhSource,basis:search.basis||null});
 }else if(row.zhVariants?.zh){
  incident.nameZh=row.zhVariants.zh;incident.nameZhSource='wikidata-zh-label';nameBySource.wikidataZhName++;
  changedNames.push({qid:incident.qid,from:before,to:incident.nameZh,source:'wikidata-zh-label',basis:'Wikidata zh label'});
 }else{
  const variant=Object.entries(row.zhVariants||{}).find(([,value])=>value);
  if(variant){
   incident.nameZh=variant[1];incident.nameZhSource='wikidata-'+variant[0]+'-label';nameBySource.wikidataZhVariant++;
   changedNames.push({qid:incident.qid,from:before,to:incident.nameZh,source:incident.nameZhSource,basis:'Wikidata '+variant[0]+' label'});
  }else if(row.zhwikiTitle){
   incident.nameZh=row.zhwikiTitle;incident.nameZhSource='zhwiki-sitelink';nameBySource.zhwikiSitelink++;
   changedNames.push({qid:incident.qid,from:before,to:incident.nameZh,source:'zhwiki-sitelink',basis:'zh.wikipedia sitelink'});
  }else{incident.nameZh=null;incident.nameZhSource='wikidata-en-label';nameBySource.none++}
 }
 incident.countries=englishFor(incident.qid,incident.countriesZh);
 incident.conflict=englishFor(incident.qid,incident.conflictZh);
 incident.victims=englishFor(incident.qid,incident.victimsZh);
}
const slotStats=list=>({slots:list.reduce((sum,item)=>sum+item.length,0),resolved:list.reduce((sum,item)=>sum+item.filter(value=>value).length,0)});
const coverage={
 countries:slotStats(document.incidents.map(item=>item.countries)),
 conflict:slotStats(document.incidents.map(item=>item.conflict)),
 victims:slotStats(document.incidents.map(item=>item.victims)),
 incidentsWithEnglishCountry:document.incidents.filter(item=>item.countries.some(Boolean)).length,
 incidentsWithEnglishConflict:document.incidents.filter(item=>item.conflict.some(Boolean)).length};
const withChineseName=document.incidents.filter(item=>item.nameZh).length;
document.builtAt=ACCESSED_AT+'T00:00:00+00:00';
document.round='3.17 bilingual strengthening pass';
document.counts={...document.counts,withChineseName,withoutChineseName:document.incidents.length-withChineseName,
 nameZhBySource:nameBySource,englishFieldCoverage:coverage,
 nameZhResolvedThisRound:changedNames.length};
document.policy.language='Names are source labels, not editorial renderings. nameZh is taken, in this order, from a Chinese article found by search and confirmed to document the same event, the entity\'s Wikidata label in any Chinese variant (zh, zh-hans, zh-hant, zh-cn, zh-tw, zh-hk, zh-sg, zh-my), or the zh.wikipedia sitelink; it is quoted verbatim and may therefore be written in traditional script. When no Chinese source names the event nameZh is null. Nothing is transliterated or machine translated. nameEn is the Wikidata English label.';
document.policy.countries='countriesZh, conflictZh and victimsZh repeat the Chinese labels recorded by the 3.15 sweep. The English arrays are resolved from the same Wikidata statements the Chinese labels came from: the entity\'s P17 (country), P361 (part of) and P710 (participant) values are read back, their Chinese labels are matched against the recorded strings, and the English label of that same entity is written in the matching slot. A slot whose statement entity could not be matched is null - it is never machine translated. counts.englishFieldCoverage records how many slots were resolved.';
document.policy.zhNamesRound='The 3.17 pass re-queried every Chinese label variant and the zh.wikipedia sitelink, then searched the Chinese Wikipedia by the English and Chinese names for the entities still without a name, reading each candidate introduction before accepting it; the confirmations and the rejected candidates are recorded in docs/verification-3.17/atrocities-zh-search.json and the round report.';
for(const incident of document.incidents){
 for(const field of ['nameEn','notesEn'])if(incident[field]&&/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(incident[field]))problems.push('CJK in English field '+incident.id+' '+field);
 for(const value of [...incident.countries,...incident.conflict,...incident.victims])if(value&&/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(value))problems.push('CJK in English list '+incident.id+' '+value);
 if(incident.countries.length!==incident.countriesZh.length)problems.push('country slot mismatch '+incident.id);
 if(incident.conflict.length!==incident.conflictZh.length)problems.push('conflict slot mismatch '+incident.id);
 if(incident.victims.length!==incident.victimsZh.length)problems.push('victim slot mismatch '+incident.id);
}
if(problems.length){console.error('FAIL apply-atrocities-3.17\n'+problems.slice(0,20).join('\n'));process.exit(1)}
const text=JSON.stringify(document,null,2)+'\n';
const gzip=gzipSync(Buffer.from(text),{level:9});
gzip[4]=gzip[5]=gzip[6]=gzip[7]=0;gzip[9]=255;
if(JSON.stringify(JSON.parse(gunzipSync(gzip).toString()))!==JSON.stringify(document))throw new Error('gzip round-trip mismatch');
const report={schemaVersion:1,generatedAt:ACCESSED_AT+'T00:00:00+00:00',layer:'atrocities',
 policy:'3.17 bilingual strengthening: Chinese names resolved from Wikidata label variants, the zh.wikipedia sitelink and search-confirmed Chinese articles; English country/conflict/victim values resolved from the same Wikidata statement entities the Chinese labels came from. Nothing translated.',
 before:{withChineseName:37,withoutChineseName:256,englishArraysEmpty:true},
 after:{shipped:document.incidents.length,withChineseName,withoutChineseName:document.incidents.length-withChineseName,nameZhBySource:nameBySource,englishFieldCoverage:coverage},
 changedNames};
if(checkOnly){console.log(JSON.stringify({result:'checked',...report.after},null,1));process.exit(0)}
await writeFile(dataPath,text);
await writeFile(resolve(root,'public/data/atrocities.json.gz'),gzip);
await writeFile(resolve(root,'docs/verification-3.17/content-atrocities-bilingual.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({result:'applied',...report.after,gzipBytes:gzip.length,jsonBytes:Buffer.byteLength(text)},null,1));
