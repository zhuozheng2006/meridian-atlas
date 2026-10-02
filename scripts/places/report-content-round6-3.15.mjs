#!/usr/bin/env node
// Usage: node scripts/places/report-content-round6-3.15.mjs
// Writes docs/verification-3.15/content-round6.json, the machine-readable half of the 3.15
// content report. It reads the committed baseline with git (HEAD) so the before/after numbers
// cannot drift, then runs the project validators and records their exit codes, and finally
// checks that both shipped gzip mirrors are byte-deterministic and deep-equal to their JSON.
import {execSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const outPath=resolve(root,'docs/verification-3.15/content-round6.json');
// The comparison baseline is the commit the task was opened against, not HEAD: the lead commits
// this round's files as they land, so HEAD moves while the round is still running.
const baselineCommit=(process.argv.find(arg=>arg.startsWith('--baseline='))||'--baseline=a7784a02').slice('--baseline='.length);
const git=path=>JSON.parse(execSync('git show '+baselineCommit+':'+path,{cwd:root,maxBuffer:64*1024*1024}).toString());
const readText=path=>readFile(resolve(root,path),'utf8');
const readJson=async path=>JSON.parse(await readText(path));
const regionCounts=list=>list.reduce((all,item)=>(all[item.region]=(all[item.region]||0)+1,all),{});

const baselineEvents=git('public/data/events.json');
const baselineBattles=git('public/data/battles.json');
const events=await readJson('public/data/events.json');
const battles=await readJson('public/data/battles.json');
const batch=await readJson('editorial/events-upgraded-3.15.json');
const audit=await readJson('docs/verification-3.15/content-upgrade-authoring.json');
const extracts=await readJson('docs/verification-3.15/content-upgrade-extracts.json');
const auditByQid=new Map(audit.entries.map(entry=>[entry.qid,entry]));
const extractByQid=new Map(extracts.entries.map(entry=>[entry.qid,entry]));
const ranking=await readJson('docs/verification-3.14/content-upgrade-ranking.json');
const rankingByQid=new Map(ranking.ranking.map(row=>[row.qid,row]));
let harvest=null;try{harvest=await readJson('editorial/battles-thin-regions-3.15.json')}catch{}

const structuredOf=list=>list.filter(entry=>entry.provenance==='wikidata-structured');
const upgradedIdsOf=list=>list.filter(entry=>/^v312wd-/.test(entry.id)&&!entry.provenance);
const newIds=new Set(batch.entries.map(entry=>entry.id));
const batchEntries=batch.entries.map(entry=>{
 const row=rankingByQid.get(entry.wikidataQid),auditRow=auditByQid.get(entry.wikidataQid),extract=extractByQid.get(entry.wikidataQid);
 return {rank:row?.rank,id:entry.id,qid:entry.wikidataQid,titleZh:entry.title.zh,titleEn:entry.title.en,year:entry.start,region:entry.region,
  sitelinks:row?.sitelinks,zhArticle:extract?.zhResolvedTitle,enArticle:extract?.enTitleUsed,summaryZhChars:auditRow?.summaryZhChars,summaryEnWords:auditRow?.summaryEnWords,
  sources:entry.sources.map(source=>source.url),inheritedCoordinates:[entry.lat,entry.lon],provenanceRemoved:!('provenance' in entry)};
}).sort((a,b)=>a.rank-b.rank);

const byQid=new Map(battles.battles.map(battle=>[battle.qid,battle]));
const shared=events.filter(event=>event.wikidataQid&&byQid.has(event.wikidataQid));
const sharedMismatch=shared.filter(event=>Number(event.start)!==Number(byQid.get(event.wikidataQid).year));
const disclosed=battles.battles.filter(battle=>/3\.15 report|3.15 报告/.test(battle.notes+battle.notesEn));

const gzipCheck=async path=>{
 const bytes=await readFile(resolve(root,path));
 const json=JSON.parse(await readText(path.replace(/\.gz$/,'')));
 return {file:path,mtimeZero:bytes[4]===0&&bytes[5]===0&&bytes[6]===0&&bytes[7]===0,os:bytes[9],deepEqual:JSON.stringify(JSON.parse(gunzipSync(bytes).toString()))===JSON.stringify(json)};
};

const commands=[
 ['node scripts/validate.mjs'],['node scripts/validate-v2.mjs'],['node scripts/validate-places.mjs'],
 ['node scripts/validate-city-time.mjs'],['node scripts/validate-polity-period.mjs'],['node scripts/validate-release.mjs'],
 ['node scripts/validate-cross-layer.mjs'],
 ['node scripts/places/validate-battles.mjs . docs/verification-3.15/content-battles-validation.json'],
 ['node scripts/places/audit-language.mjs . docs/verification-3.15/content-language-audit.json']];
const validations=[];
for(const [command] of commands){
 let exitCode=0,output='';
 try{output=execSync(command,{cwd:root,maxBuffer:32*1024*1024}).toString()}catch(error){exitCode=error.status??1;output=String(error.stdout||'')+String(error.stderr||'')}
 validations.push({command,exitCode,lastLines:output.trim().split('\n').slice(-3)});
}
const language=await readJson('docs/verification-3.15/content-language-audit.json');
const battleValidation=await readJson('docs/verification-3.15/content-battles-validation.json');

const report={schemaVersion:1,generatedAt:new Date().toISOString(),task:'task-17',baselineCommit,
 scope:'Promote index-level events ranked 41-100 to editorial level and extend the battle layer for Oceania, South Asia and Southeast Asia.',
 events:{baselineTotal:baselineEvents.length,total:events.length,
  structuredBaseline:structuredOf(baselineEvents).length,structured:structuredOf(events).length,
  upgradedIndexEntriesBaseline:upgradedIdsOf(baselineEvents).length,upgradedIndexEntries:upgradedIdsOf(events).length,
  batchCount:batch.count,newlyUpgraded:newIds.size,
  batchByRegion:regionCounts(batch.entries),
  idRule:'id stays v312wd-<qid>; the provenance field is removed entirely and wikidataQid is kept',
  minSummaryZhChars:Math.min(...audit.entries.map(entry=>entry.summaryZhChars)),maxSummaryZhChars:Math.max(...audit.entries.map(entry=>entry.summaryZhChars)),
  minSummaryEnWords:Math.min(...audit.entries.map(entry=>entry.summaryEnWords)),maxSummaryEnWords:Math.max(...audit.entries.map(entry=>entry.summaryEnWords)),
  entries:batchEntries},
 civilYears:{policy:'Wikidata P585 is ISO 8601 astronomical (year zero exists); the project uses civil years without a year zero, so iso<=0 ships as iso-1.',
  convertedInBatch:batch.entries.filter(entry=>entry.start<0).map(entry=>({id:entry.id,qid:entry.wikidataQid,titleZh:entry.title.zh,civilYear:entry.start,isoYear:entry.start+1}))},
 excluded:[{id:'v312wd-q111383245',qid:'Q111383245',titleZh:'阿夫迪伊夫卡战役',reason:'Wikidata P585 records 2020 while the English and Chinese Wikipedia articles date the fighting from 2022; the battle layer inherits 2020, so an editorial entry with the sourced year would break cross-layer consistency and one with 2020 would enshrine a wrong date.'},
  {id:'v312wd-q112206624',qid:'Q112206624',titleZh:'克列缅纳亚战役',reason:'Wikidata P585 records 2020 while both Wikipedia articles date the battle to 2022; the same conflict as Q111383245 applies.'}],
 crossLayer:{sharedEntities:shared.length,mismatches:sharedMismatch.length,examples:sharedMismatch.slice(0,5),
  limitation:'The check only compares the two layers with each other. Two layers can agree on a year that both sources contradict, which is exactly how Q111383245 and Q112206624 stayed hidden until the Wikipedia articles were read by hand.'},
 battles:{baselineTotal:baselineBattles.battles.length,total:battles.battles.length,
  baselineByRegion:regionCounts(baselineBattles.battles),byRegion:regionCounts(battles.battles),
  counts:battles.counts,
  dateConflictDisclosures:disclosed.map(battle=>({id:battle.id,qid:battle.qid,nameZh:battle.nameZh,year:battle.year,notes:battle.notes}))},
 harvest:harvest?{classEnumeration:harvest.classEnumeration,boxesHarvested:harvest.boxesHarvested,items:harvest.count,
  byBox:harvest.items.reduce((all,item)=>(all[item.box]=(all[item.box]||0)+1,all),{}),
  byBoxWithChineseName:harvest.items.reduce((all,item)=>{if(item.labelZh)all[item.box]=(all[item.box]||0)+1;return all},{}),
  boxFile:harvest.boxes}:null,
 language:{eventOffenders:language.events.entriesWithCjkInEnglish,structured:language.events.structured,battleOffenders:language.battles.entriesAffected},
 validation:{battleChecks:battleValidation.checks.map(check=>({name:check.name,passed:check.passed})),battlePassed:battleValidation.passed,commands:validations},
 gzip:[await gzipCheck('public/data/events.json.gz'),await gzipCheck('public/data/battles.json.gz')]};

await writeFile(outPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({out:outPath,events:{total:report.events.total,structured:report.events.structured,batch:report.events.batchCount},
 battles:{total:report.battles.total,byRegion:report.battles.byRegion},validations:validations.map(item=>item.command.split(' ')[1]+'='+item.exitCode),
 battlePassed:battleValidation.passed,crossLayer:report.crossLayer,gzip:report.gzip.map(item=>item.file+':'+(item.mtimeZero&&item.deepEqual))},null,2));
if(validations.some(item=>item.exitCode!==0))process.exitCode=1;
