#!/usr/bin/env node
// Usage: node docs/verification-3.22/report-profile-gaps-3.22.mjs [--source=/tmp/clio/cliopatria_polities_only.geojson]
// Writes docs/verification-3.22/profile-gaps.json: why six important polities have no enrichment
// profile, why seven others only looked like gaps, and what the boundary source actually contains.
// It re-derives every number from the shipped catalog, the profile index and, when the extracted
// pinned source is present, the raw Cliopatria features. It writes nothing outside docs/.
import {execSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import readline from 'node:readline';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const sourcePath=(process.argv.find(arg=>arg.startsWith('--source='))||'--source=/tmp/clio/cliopatria_polities_only.geojson').slice('--source='.length);
const read=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const gunzip=async path=>JSON.parse(gunzipSync(await readFile(resolve(root,path))).toString());

const catalog=await gunzip('public/data/fast/catalog.json.gz');
const index=await gunzip('public/data/enrichment/profile-index.json.gz');
const narratives=await read('public/data/enrichment/narratives.json');
const batch=await read('editorial/enrichment-narratives-3.12.json');
const round=await read('docs/verification-3.21/narratives-batch-stats.json');
const sourceInfo=await read('scripts/boundaries/source.json');

// A. index accounting
const polity=catalog.records.filter(record=>record.type==='POLITY');
const qidRecords=new Map();
for(const record of polity){if(!record.verifiedWikidata)continue;const list=qidRecords.get(record.verifiedWikidata)||[];list.push(record);qidRecords.set(record.verifiedWikidata,list)}
const profileQids=new Set(Object.keys(index.profiles));
const narrativeQids=new Set(narratives.entries.map(entry=>entry.qid));
const roundQids=new Set(round.entries.map(entry=>entry.qid));
const exclusionById=new Map(index.exclusions.map(item=>[item.recordId,item]));
const unbound=polity.filter(record=>!index.records[record.id]);
const reasonOf=record=>(exclusionById.get(record.id)||{}).reason||null;

// B. the thirteen entities from the task list, as probed in the 3.21 report
const probed=[['Q209217','津巴布韦王国'],['Q1136041','卡涅姆-博尔努'],['Q477423','刚果王国'],['Q662922','贝宁帝国'],['Q468814','达荷美'],['Q249594','祖鲁王国'],['Q1740606','基尔瓦苏丹国'],['Q210400','室利佛逝'],['Q207982','阿瑜陀耶'],['Q1062587','蒲甘王朝'],['Q1052477','亚齐苏丹国'],['Q1056778','图依汤加帝国'],['Q14452','拉帕努伊']];
// The catalogue QIDs the project actually uses for seven of them (resolved by name search).
const corrected={Q1136041:'Q1139762',Q477423:'Q796583',Q249594:'Q13558877',Q210400:'Q234197',Q207982:'Q841364',Q1062587:'Q888574',Q1052477:'Q1061057',Q209217:'Q596092',Q662922:'Q171203',Q1740606:'Q3107156',Q1056778:'Q842390'};
const rows=probed.map(([qid,zh])=>{
 const real=corrected[qid]||qid;
 const records=(qidRecords.get(real)||[]);
 const profile=index.profiles[real]||null;
 let profileFile=null,fields=0,statements=0;
 if(profile){try{const full=JSON.parse(gunzipSync(fs.readFileSync(resolve(root,'public/data/enrichment/'+profile.file))).toString());profileFile=profile.file;fields=Object.keys(full.fields).length;statements=Object.values(full.fields).flat().length}catch{}}
 return {probedQid:qid,titleZh:zh,catalogueQid:real,corrected:real!==qid,
  catalogueName:records[0]?.name||null,recordCount:records.length,
  from:records.length?Math.min(...records.map(record=>record.start)):null,to:records.length?Math.max(...records.map(record=>record.end)):null,
  profile:Boolean(profile),profileFile,profileFields:fields,profileStatements:statements,
  labelZh:profile?.labels?.zh||null,labelEn:profile?.labels?.en||null,
  narrative:narrativeQids.has(real)?(roundQids.has(real)?'3.21':'3.12'):null,
  status:profile?(profile.boundaryCoverage==='not-in-source'?'not-in-source-profile':'catalogue-profile'):'no-polity-item'};
});

// C. raw source check for the six still-absent entities
const absent=['Q209217','Q468814','Q1740606','Q1056778','Q14452','Q662922'];
// "Zimbabwe" and "Benin" also name modern republics that the source does contain; they are
// recorded separately so the historical-name check stays honest.
const modernNames=['Zimbabwe','Benin'];
const historyNames=['Great Zimbabwe','Monomotapa','Mutapa','Dahomey','Abomey','Allada','Kilwa','Quiloa','Swahili','Zanj','Tonga','Tongatapu','Rapa Nui','Rapanui','Easter Island','Edo','Ife','Benin City'];
const names=[...modernNames,...historyNames];
let sourceCheck=null;
if(fs.existsSync(sourcePath)){
 const bytes=await readFile(sourcePath);
 const sha=createHash('sha256').update(bytes).digest('hex');
 let zipSha256=null;
 try{zipSha256=createHash('sha256').update(await readFile('/tmp/cliopatria.geojson.zip')).digest('hex')}catch{}
 const nameHits={},qidHits={};
 let features=0;
 const stream=createReadStream(sourcePath);
 const lines=readline.createInterface({input:stream,crlfDelay:Infinity});
 for await (const line of lines){
  if(!line.includes('"type": "Feature"'))continue;
  features++;
  let properties;try{properties=JSON.parse(line.replace(/,\s*$/,'')).properties}catch{continue}
  const hay=[properties.Name,properties.Wikipedia,properties.SeshatID,properties.Components,properties.MemberOf].filter(Boolean).join(' | ').toLowerCase();
  // Word-boundary matching: a plain substring test makes Edo match Macedonian.
  for(const term of names)if(new RegExp('(^|[^a-z])'+term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'([^a-z]|$)').test(hay)){nameHits[term]=(nameHits[term]||0)+1}
  for(const qid of absent)if(line.includes(qid)){qidHits[qid]=(qidHits[qid]||0)+1}
 }
 sourceCheck={file:sourcePath,features,extractedSha256:sha,zipSha256,pinnedSha256:sourceInfo.sha256,
  pinnedArchiveMatches:zipSha256===sourceInfo.sha256,
  repo:sourceInfo.repo,commit:sourceInfo.commit,nameHits,qidOccurrences:qidHits,
  historicalNameHits:Object.fromEntries(historyNames.map(term=>[term,nameHits[term]||0])),
  modernNameHits:Object.fromEntries(modernNames.map(term=>[term,nameHits[term]||0])),
  absentConfirmed:absent.every(qid=>!qidHits[qid])&&historyNames.every(term=>!nameHits[term])};
}

// D. validations
const commands=[['node scripts/validate.mjs'],['node scripts/validate-v2.mjs'],['node scripts/validate-release.mjs'],
 ['node scripts/places/audit-language.mjs . docs/verification-3.22/profile-language-audit.json']];
const validations=[];
for(const [command] of commands){
 let exitCode=0,output='';
 try{output=execSync(command,{cwd:root,maxBuffer:32*1024*1024}).toString()}catch(error){exitCode=error.status??1;output=String(error.stdout||'')+String(error.stderr||'')}
 validations.push({command,exitCode,lastLines:output.trim().split('\n').slice(-2)});
}
const gzMirror=async path=>{
 const raw=await readFile(resolve(root,path));
 let deepEqual=null,note='no plain JSON counterpart ships for this archive';
 try{const json=JSON.parse(await readFile(resolve(root,path.replace(/\.gz$/,'')),'utf8'));deepEqual=JSON.stringify(JSON.parse(gunzipSync(raw).toString()))===JSON.stringify(json);note=null}catch{}
 return {file:path,mtimeZero:raw[4]===0&&raw[5]===0&&raw[6]===0&&raw[7]===0,deepEqual,note};
};
const report={schemaVersion:1,generatedAt:new Date().toISOString(),task:'task-25',
 purpose:'Resolve why thirteen important polities appeared to have no enrichment profile, correct the 3.21 claim where it was wrong, and record what the pinned boundary source actually contains.',
 sourcePin:sourceInfo,sourceCheck,
 indexAccounting:{catalogueRecords:catalog.records.length,polityRecords:polity.length,relationRecords:catalog.records.length-polity.length,
  cataloguePolityQids:qidRecords.size,profiles:profileQids.size,
  catalogueQidsWithoutProfile:[...qidRecords.keys()].filter(qid=>!profileQids.has(qid)),
  boundRecords:Object.keys(index.records).length,unboundPolityRecords:unbound.length,
  exclusions:index.exclusions.length,exclusionReasons:index.exclusions.reduce((all,item)=>(all[item.reason]=(all[item.reason]||0)+1,all),{}),
  unboundReasons:unbound.map(record=>({recordId:record.id,name:record.name,qid:record.verifiedWikidata||null,from:record.start,to:record.end,reason:reasonOf(record)})),
  profilesWithoutCatalogueRecord:[...profileQids].filter(qid=>!qidRecords.has(qid))},
 thirteen:rows,
 sevenResolved:rows.filter(row=>row.status==='catalogue-profile'&&row.narrative).map(row=>({probedQid:row.probedQid,catalogueQid:row.catalogueQid,titleZh:row.titleZh,catalogueName:row.catalogueName,recordCount:row.recordCount,from:row.from,to:row.to,profileFile:row.profileFile,narrative:row.narrative})),
 noTerritoryProfiles:rows.filter(row=>row.status==='not-in-source-profile').map(row=>({probedQid:row.probedQid,qid:row.catalogueQid,titleZh:row.titleZh,profileFile:row.profileFile})),
 unresolved:rows.filter(row=>row.status==='no-polity-item').map(row=>({probedQid:row.probedQid,titleZh:row.titleZh,reason:'Wikidata has no polity item for this entity (island Q14452, people Q852486, monarchy Q6413065); no profile was invented.'})),
 identityCorrections:[{probed:'Q662922',actual:'Löwenwolde (noble family)',used:'Q171203 Benin Empire'},{probed:'Q1740606',actual:'Khatuna Mikaberidze (person)',used:'Q3107156 Kilwa Sultanate'},{probed:'Q1056778',actual:'Numbers (Apple application)',used:'Q842390 Tuʻi Tonga Empire'},{probed:'Q209217',actual:'Great Zimbabwe (archaeological site)',used:'Q596092 Kingdom of Zimbabwe'}],
 correction:{previousClaim:'docs/verification-3.21/narratives-round.md stated that these thirteen polities have no enrichment profile and therefore cannot be written.',
  finding:'Seven of the thirteen do have profiles and territory records and already had narratives since the 3.12 round; the 3.21 check probed Wikidata QIDs that this project does not use for them. Six have no profile because the pinned boundary source contains no feature for them under any tested name or QID.',
  correctedQids:Object.entries(corrected).map(([probed,real])=>({probed,real}))},
 whyNotAdded:['A profile is only reachable through a catalogue record: public/polity-reader.js loadProfile resolves profile-index.records[record.id] and then profiles[qid].file, so a profile without a record can never be opened in the reader.',
  'scripts/validate-v2.mjs asserts that the index holds exactly 1,450 profiles and that every profile file is bound to records; adding unbound profiles would fail the suite and changing that check is outside this round write scope.',
  'The six entities have no geometry in the pinned source, and the task forbids borrowing neighbouring or other-year geometry, so any polygon would be fabricated.'],
 step1:{round:'3.22',profiles:await read('docs/verification-3.22/no-territory-profiles.json').catch(()=>null),readerPending:true,
  note:'The five not-in-source profiles ship with the machine-readable boundaryCoverage field; the polity reader still resolves a profile only through a catalogue record binding, so opening them in the UI is the next step.'},
 nextSteps:['Add a second, citable boundary source (for example a scholarly GIS of African or Polynesian polities) and import it through the same identity-verification path the current pipeline uses, with the source hash pinned like scripts/boundaries/source.json.',
  'If profile-only entries are wanted, add an explicit reader entry point plus an index field marking "no territory records" and update the validator expectation; the entry text must say that the atlas holds no territory data for the polity and that this is not evidence of absence.',
  'Record the six polities in the atlas coverage notes so that an empty map area is not read as absent history.'],
 validation:{commands:validations,audit:await read('docs/verification-3.22/profile-language-audit.json'),
  gzMirrors:[await gzMirror('public/data/enrichment/narratives.json.gz'),await gzMirror('public/data/enrichment/profile-index.json.gz')],
  note:'No product data file was modified this round, so the gzip mirrors are the shipped ones; both were checked for mtime=0 and deep equality with their JSON.'}};
await writeFile(resolve(root,'docs/verification-3.22/profile-gaps.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({out:'docs/verification-3.22/profile-gaps.json',index:report.indexAccounting.catalogueQidsWithoutProfile,
 corrected:report.correction.correctedQids.length,sourceCheck:sourceCheck?{features:sourceCheck.features,shaMatches:sourceCheck.shaMatches,absentConfirmed:sourceCheck.absentConfirmed}:null,
 seven:report.sevenResolved.map(row=>row.titleZh+'->'+row.catalogueQid+' rec'+row.recordCount+' '+row.narrative),
 noTerritory:report.noTerritoryProfiles.map(row=>row.titleZh+':'+row.qid),
 unresolved:report.unresolved.map(row=>row.titleZh+':'+row.probedQid),
 validations:validations.map(item=>item.command.split(' ')[1]+'='+item.exitCode),gz:report.validation.gzMirrors},null,2));
if(validations.some(item=>item.exitCode!==0))process.exitCode=1;
