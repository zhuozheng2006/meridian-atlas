#!/usr/bin/env node
// Usage: node scripts/places/apply-enrichment-3.12.mjs [--check] [--batch path.json]
// Merges editorial/enrichment-narratives-3.12.json into the shipped enrichment
// narratives and resolves every entry's record bindings against the actual catalog.
// The binding contract is the one the reader enforces: exact sourceNames match,
// verifiedWikidata equality, scope containing the map year, and the selected record
// id present in recordIdsOverlappingScope. Running twice changes nothing.
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {citationRegistry,citationIds,narrativeScope} from './narrative-metadata.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const checkOnly=process.argv.includes('--check');
const problems=[];
const fail=message=>problems.push(message);
const disk=async file=>JSON.parse(gunzipSync(await readFile(resolve(root,file))));
const catalog=await disk('public/data/fast/catalog.json.gz');
const index=await disk('public/data/enrichment/profile-index.json.gz');
const shipped=JSON.parse(await readFile(resolve(root,'public/data/enrichment/narratives.json'),'utf8'));
const batchFlag=process.argv.indexOf('--batch');
if(batchFlag>=0&&(!process.argv[batchFlag+1]||process.argv[batchFlag+1].startsWith('--')))throw Error('--batch requires a JSON path');
const batchPath=batchFlag>=0?process.argv[batchFlag+1]:'editorial/enrichment-narratives-3.12.json';
const batch=JSON.parse(await readFile(resolve(root,batchPath),'utf8'));
if(!Array.isArray(batch.entries))throw Error('batch.entries must be an array');
if(new Set(batch.entries.map(entry=>entry.qid)).size!==batch.entries.length)throw Error('duplicate qid in narrative batch');
const SECTION_KEYS=['politics','economy','culture','events'];
const TRADITIONAL=/[與臺灣國學會東車馬鳥魚點線個時間問題則無為說話語實質]/;
const entries=new Map(shipped.entries.map(entry=>[entry.id,entry]));
let added=0,bound=0;
for(const source of batch.entries){
 const where=source.qid||'(entry without qid)';
 if(!/^Q\d+$/.test(source.qid))fail(where+': qid must look like Q123');
 if(!index.profiles[source.qid])fail(where+': no enrichment profile ships for this qid');
 if(!Array.isArray(source.sourceNames)||!source.sourceNames.length)fail(where+': sourceNames required');
 if(!Number.isInteger(source.scope?.start)||!Number.isInteger(source.scope?.end)||source.scope.start>=source.scope.end)fail(where+': invalid scope');
 for(const key of SECTION_KEYS){
  const section=source.sections?.[key];
  if(!section||!section.zh||!section.en)fail(where+': missing '+key+' section');
  else if(TRADITIONAL.test(section.zh))fail(where+': traditional characters in '+key);
 }
 if(!Array.isArray(source.facts)||source.facts.length<2)fail(where+': at least two dated highlights required');
 if(!Array.isArray(source.sources)||!source.sources.length)fail(where+': at least one readable source required');
 for(const item of source.sources){if(!item.id||!item.url?.startsWith('https://')||!item.checkedOn||!item.publisher)fail(where+': incomplete source '+item.id)}
 let sourceIds,scope,sections,facts;
 try{
  sourceIds=citationRegistry(source.sources,where);
  scope=narrativeScope(source,undefined,where);
  sections=Object.fromEntries(SECTION_KEYS.map(key=>[key,{zh:source.sections[key].zh,en:source.sections[key].en,sourceIds:citationIds(source.sections[key],sourceIds,where+': '+key)}]));
  facts=source.facts.map(fact=>({key:fact.key,value:fact.value,sourceIds:citationIds(fact,sourceIds,where+': fact '+fact.key),verification:fact.verification||'Editorial statement; evidence is linked in sourceIds.'}));
 }catch(error){fail(error.message);continue}
 // Bind against the shipped catalog: same entity, exact record name, overlapping period.
 const candidates=catalog.records.filter(record=>record.type==='POLITY'&&record.verifiedWikidata===source.qid&&source.sourceNames.includes(record.name)&&record.start<=source.scope.end&&source.scope.start<=record.end);
 if(!candidates.length)fail(where+': no shipped polity record matches these names and scope');
 for(const record of candidates){const mapped=index.records?.[record.id];if(!mapped)fail(where+': profile index has no record mapping for '+record.id);else if(mapped.qid!==source.qid)fail(where+': index maps '+record.id+' to '+mapped.qid)}
 bound+=candidates.length;
 const id='overview-'+source.qid.toLowerCase();
 const entry={
  id,qid:source.qid,sourceNames:source.sourceNames,title:source.title,scope,
  sections,
  sources:source.sources,
  editorialNotes:source.editorialNotes||[],
  license:'CC BY-SA 4.0 for the linked Wikipedia articles; original bilingual synthesis by this project.',
  verification:source.verification||'Editorial synthesis; consult each source and its recorded access date.',
  facts,
  binding:'Exact sourceNames AND matching verifiedWikidata AND exact record ID AND the map year inside scope; never bind by fuzzy name.',
  recordIds:candidates.map(record=>record.id),
  recordIdsOverlappingScope:candidates.map(record=>record.id),
  eventKeywords:source.eventKeywords||[source.title.en],
  summary:{zh:source.sections.politics.zh+'\n\n'+source.sections.economy.zh+'\n\n'+source.sections.culture.zh}
 };
 entry.zhCharacterCount=entry.summary.zh.length;
 if(entries.has(id))added++;
 entries.set(id,entry);
}
if(problems.length){console.error('FAIL apply-enrichment-3.12\n'+problems.join('\n'));process.exit(1)}
const merged={...shipped,entries:[...entries.values()]};
const text=JSON.stringify(merged,null,2)+'\n';
const stats={batchEntries:batch.entries.length,newOrUpdated:batch.entries.length,totalEntries:merged.entries.length,boundRecords:bound,checkOnly};
if(checkOnly){console.log(JSON.stringify({result:'checked',...stats},null,2));process.exit(0)}
await writeFile(resolve(root,'public/data/enrichment/narratives.json'),text);
console.log(JSON.stringify({result:'merged',...stats},null,2));
