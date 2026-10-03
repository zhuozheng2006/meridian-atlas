#!/usr/bin/env node
// Usage: node docs/verification-3.21/report-narratives-round-3.21.mjs
// Writes docs/verification-3.21/narratives-round.json: the machine-readable half of the 3.21
// polity-narrative report. It reads the shipped narratives, the editable batch, the selection
// evidence and this round's authoring stats, runs the validators the task names, and checks the
// deterministic archive. Nothing is written to public/ by this script.
import {execSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const read=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const baselineCommit=execSync('git rev-parse HEAD',{cwd:root}).toString().trim();
const baseline=JSON.parse(execSync('git show HEAD:public/data/enrichment/narratives.json',{cwd:root,maxBuffer:64*1024*1024}).toString());
const narratives=await read('public/data/enrichment/narratives.json');
const batch=await read('editorial/enrichment-narratives-3.12.json');
const stats=await read('docs/verification-3.21/narratives-batch-stats.json');
const selection=await read('docs/verification-3.21/narratives-selection.json');
const extracts=await read('docs/verification-3.21/narratives-extracts.json');
const byQid=new Map(narratives.entries.map(entry=>[entry.qid,entry]));
const added=stats.entries.map(entry=>{const shipped=byQid.get(entry.qid);return {...entry,
 sections:shipped?Object.fromEntries(Object.entries(shipped.sections).map(([key,value])=>[key,{zh:[...value.zh].length,en:value.en.trim().split(/\s+/).filter(Boolean).length}])):entry.sections,
 boundRecords:shipped?shipped.recordIdsOverlappingScope.length:0,
 sources:shipped?shipped.sources.map(source=>source.url):entry.sources,
 editorialNote:shipped?shipped.editorialNotes.map(note=>note.zh).join(' '):null,
 eventKeywords:shipped?shipped.eventKeywords:[]};});
const before=baseline.entries.length,after=narratives.entries.length;
const sectionKeys=['politics','economy','culture','events'];
const lengths={zh:[],en:[]};
for(const entry of added)for(const key of sectionKeys){lengths.zh.push(entry.sections[key].zh);lengths.en.push(entry.sections[key].en)}
const sorted=list=>[...list].sort((a,b)=>a-b);
const median=list=>sorted(list)[Math.floor(list.length/2)];
const regionOf={};for(const entry of added)regionOf[entry.region]=(regionOf[entry.region]||0)+1;
const eraOf={};for(const entry of added)eraOf[entry.era]=(eraOf[entry.era]||0)+1;
const remaining=selection.allUncovered.filter(row=>!byQid.has(row.qid));
const remainingByRegion={};for(const row of remaining)remainingByRegion[row.region]=(remainingByRegion[row.region]||0)+1;
const commands=[['node scripts/validate-v2.mjs'],['node scripts/validate.mjs'],['node scripts/validate-release.mjs'],
 ['node scripts/places/audit-language.mjs . docs/verification-3.21/narratives-language-audit.json']];
const validations=[];
for(const [command] of commands){
 let exitCode=0,output='';
 try{output=execSync(command,{cwd:root,maxBuffer:32*1024*1024}).toString()}catch(error){exitCode=error.status??1;output=String(error.stdout||'')+String(error.stderr||'')}
 validations.push({command,exitCode,lastLines:output.trim().split('\n').slice(-2)});
}
const gz=await readFile(resolve(root,'public/data/enrichment/narratives.json.gz'));
const language=await read('docs/verification-3.21/narratives-language-audit.json');
const report={schemaVersion:1,generatedAt:new Date().toISOString(),task:'task-24',baselineCommit,
 scope:'Extend the polity four-column narratives from 95 to about 160, choosing by territory-record evidence and prioritising under-covered regions.',
 totals:{narrativesBefore:before,narrativesAfter:after,added:added.length,batchEntries:batch.entries.length,
  profiles:selection.totals.profiles,coveredBefore:selection.totals.covered,uncoveredBefore:selection.totals.uncovered,uncoveredAfter:remaining.length},
 selection:{method:selection.method,
  byRegion:regionOf,byEra:eraOf,
  thinCoverage:added.filter(entry=>entry.thin).map(entry=>({qid:entry.qid,titleZh:entry.titleZh,recordCount:entry.recordCount,scope:entry.scope})),
  notes:['Regions follow hand-reviewed geography; the automatic coordinate-box region is recorded as regionBox in narratives-chosen.json.',
   'Eleven entries have fewer than six territory records or a span under sixty years; their editorial note states the thin coverage plainly.',
   'Chinese Wikipedia has no article on Makuria, so that entry cites the Nubia article for background and rests its political detail on the English article.']},
 writing:{zhChars:{min:Math.min(...lengths.zh),median:median(lengths.zh),max:Math.max(...lengths.zh)},
  enWords:{min:Math.min(...lengths.en),median:median(lengths.en),max:Math.max(...lengths.en)},
  highlightsPerEntry:{min:Math.min(...added.map(entry=>byQid.get(entry.qid).facts.length)),max:Math.max(...added.map(entry=>byQid.get(entry.qid).facts.length))},
  sourcesPerEntry:{min:Math.min(...added.map(entry=>entry.sources.length)),max:Math.max(...added.map(entry=>entry.sources.length))},
  sourceHosts:[...new Set(added.flatMap(entry=>entry.sources.map(url=>new URL(url).host)))],
  allSourcesHttps:added.every(entry=>entry.sources.every(url=>url.startsWith('https://'))),
  allEntriesFourSections:added.every(entry=>sectionKeys.every(key=>entry.sections[key]&&entry.sections[key].zh>0&&entry.sections[key].en>0)),
  boundRecordsTotal:added.reduce((sum,entry)=>sum+entry.boundRecords,0)},
 schema:{keys:Object.keys(narratives.entries[0]),sectionKeys,
  note:'Entries keep the shipped schema exactly: the apply script builds id, sourceNames, title, scope, sections, sources, editorialNotes, license, verification, facts, binding, recordIds, recordIdsOverlappingScope, eventKeywords, summary and zhCharacterCount; no field name was changed.',
  bindingRule:'Exact sourceNames match AND verifiedWikidata equality AND scope overlapping the record; recordIdsOverlappingScope holds every matching record id.'},
 entries:added,
 validation:{commands:validations,language:{eventOffenders:language.events.entriesWithCjkInEnglish,battleOffenders:language.battles.entriesAffected,
  note:'audit-language audits the event and battle layers (both zero); the narratives English columns are enforced by docs/verification-3.21/build-narratives-batch-3.21.mjs, which refuses CJK in any en field.'},
  gzip:{mtimeZero:gz[4]===0&&gz[5]===0&&gz[6]===0&&gz[7]===0,deepEqual:JSON.stringify(JSON.parse(gunzipSync(gz).toString()))===JSON.stringify(narratives)}},
 remaining:{uncoveredProfiles:remaining.length,byRegion:remainingByRegion,
  gaps:['1288 profiles still have no narrative; Europe accounts for most of them (its pool is the largest), so the next round should keep the regional priority.',
   'Some large regional cultures have no enrichment profile at all and therefore cannot be written: for example Great Zimbabwe, Kanem-Bornu, Kongo, Benin, Dahomey, Zulu, Kilwa, Srivijaya, Ayutthaya, Pagan, Aceh, Tonga, Rapa Nui and Samoa are absent from the 1,450-profile index.',
   'Chinese Wikipedia coverage is uneven: a few entries cite a broader or neighbouring article (Makuria/Nubia) or a one-line stub (Pandya), and those limitations are stated in the entry note or the report.',
   'Narratives rest on two Wikipedia articles each; no institutional or primary source was consulted for this round beyond the articles themselves.']}};
await writeFile(resolve(root,'docs/verification-3.21/narratives-round.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({out:'docs/verification-3.21/narratives-round.json',baselineCommit,before,after,
 added:added.length,regions:regionOf,eras:eraOf,zh:report.writing.zhChars,en:report.writing.enWords,
 sourcesPerEntry:report.writing.sourcesPerEntry,remaining:remaining.length,validations:validations.map(item=>item.command.split(' ')[1]+'='+item.exitCode),gzip:report.validation.gzip},null,2));
if(validations.some(item=>item.exitCode!==0))process.exitCode=1;
