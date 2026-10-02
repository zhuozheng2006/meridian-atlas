#!/usr/bin/env node
// Usage: node scripts/places/apply-city-narratives-3.11.mjs [--check]
// Merges editorial/city-narratives-3.11.json into the canonical editorial dossier file
// and rebuilds the deterministic gzip mirror. sourceRecords are generated here from the
// shipped place datasets, so names, coordinates, periods, observation years and source
// URLs must match the sources exactly. Running twice changes nothing.
import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const checkOnly=process.argv.includes('--check');
const problems=[];
const fail=message=>problems.push(message);
const disk=async file=>JSON.parse(gunzipSync(await readFile(resolve(root,file))));
const datasets=[['historical-settlements.json',(await disk('public/data/places/historical-settlements-index.json.gz')).places,'attested-settlement','source-attested-period','preserve-source-representative-point'],
 ['historical-capitals.json',(await disk('public/data/places/historical-capitals.json.gz')).claims,'capital-tenure','capital-tenure','preserve-source-urban-reference'],
 ['urban-observations.json',(await disk('public/data/places/urban-observations.json.gz')).cities,'urban-observation','population-observation','preserve-source-urban-reference'],
 ['modern-cities.json',(await disk('public/data/places/modern-cities.json.gz')).cities,'modern-reference','modern-reference','preserve-source-urban-reference']];
const lookup=new Map();
for(const [file,rows,kind,timeBasis,coordinateUse] of datasets)for(const row of rows)if(!lookup.has(row.id))lookup.set(row.id,{file,row,kind,timeBasis,coordinateUse});

const canonical=JSON.parse(await readFile(resolve(root,'editorial/city-narratives.json'),'utf8'));
const batch=JSON.parse(await readFile(resolve(root,'editorial/city-narratives-3.11.json'),'utf8'));
const sources=new Map(canonical.sources.map(source=>[source.id,source]));
for(const source of batch.sources){
 if(sources.has(source.id)&&JSON.stringify(sources.get(source.id))!==JSON.stringify(source))fail('source id already registered with different content: '+source.id);
 sources.set(source.id,source);
}
const entries=new Map(canonical.entries.map(entry=>[entry.id,entry]));
for(const entry of batch.entries){
 const where=entry.id||'(entry without id)';
 if(!/^city-[a-z0-9-]+$/.test(where))fail(where+': id must be city-<slug>');
 for(const field of ['nameZh','nameEn','scope','bindingRules','sections','milestones','sourceRecordIds','sourceIds'])if(!entry[field])fail(where+': missing '+field);
 if(entry.sections.length!==3)fail(where+': exactly three sections required');
 if(entry.milestones.length!==3)fail(where+': exactly three milestones required');
 if(new Set(entry.sourceRecordIds).size!==entry.sourceRecordIds.length)fail(where+': duplicate sourceRecordIds');
 const ruleIds=entry.bindingRules.map(rule=>rule.sourceRecordId).sort();
 if(JSON.stringify(ruleIds)!==JSON.stringify([...entry.sourceRecordIds].sort()))fail(where+': binding rules must cover the source records once each');
 for(const sourceId of entry.sourceIds)if(!sources.has(sourceId))fail(where+': unknown source '+sourceId);
 const publishers=new Set(entry.sourceIds.map(id=>sources.get(id).publisher));
 if(publishers.size<2)fail(where+': at least two distinct publishers required');
 for(const part of [...entry.sections,...entry.milestones]){
  if(!part.zh||!part.en||!part.sourceIds?.length)fail(where+': section/milestone text or sources missing');
  for(const id of part.sourceIds||[])if(!sources.has(id))fail(where+': section references unknown source '+id);
 }
 const sourceRecords=[];
 for(const rule of entry.bindingRules){
  const found=lookup.get(rule.sourceRecordId);
  if(!found){fail(where+': source record not found in shipped datasets: '+rule.sourceRecordId);continue}
  const {file,row,kind,timeBasis,coordinateUse}=found;
  if(entry.scope.start>rule.start||rule.start>rule.end||rule.end>entry.scope.end)fail(where+': rule '+rule.sourceRecordId+' escapes the dossier scope');
  if(row.observations){
   if(rule.requiresObservation!==true||!rule.observationYears?.length)fail(where+': observation record needs requiresObservation and observationYears: '+rule.sourceRecordId);
   for(const year of rule.observationYears||[]){
    if(!row.observations.some(observation=>observation[0]===year))fail(where+': observation year '+year+' not in '+rule.sourceRecordId);
    if(year<rule.start||year>rule.end)fail(where+': observation year '+year+' outside rule range for '+rule.sourceRecordId);
   }
  }else{
   if(!rule.sourcePeriods?.length)fail(where+': period record needs sourcePeriods: '+rule.sourceRecordId);
   for(const period of rule.sourcePeriods||[])if(!(row.periods||[]).some(candidate=>JSON.stringify(candidate)===JSON.stringify(period)))fail(where+': declared period not in '+rule.sourceRecordId);
  }
  sourceRecords.push({id:row.id,name:row.name,...(row.nameZh?{nameZh:row.nameZh}:{}),coordinates:row.coordinates,periods:row.periods||null,
   observationYears:(row.observations||[]).map(observation=>observation[0]),sourceUrl:row.sourceUrl,dataFile:file,recordKind:kind,timeBasis,
   coordinateUse,bindingMode:'city-region-context',changesCoordinates:false,extendsSourceDates:false});
 }
 for(const milestone of entry.milestones){
  if(!Number.isInteger(milestone.year)||milestone.year===0||milestone.year>milestone.endYear)fail(where+': invalid milestone year');
  if(milestone.year<entry.scope.start||milestone.endYear>entry.scope.end)fail(where+': milestone outside scope: '+milestone.year);
  if(!milestone.date?.zh||!milestone.date?.en||!milestone.precision)fail(where+': milestone date or precision missing');
 }
 entries.set(where,{...entry,sourceRecords});
}
if(problems.length){console.error('FAIL apply-city-narratives-3.11\n'+problems.join('\n'));process.exit(1)}
const merged={...canonical,sources:[...sources.values()],entries:[...entries.values()]};
const text=JSON.stringify(merged,null,2)+'\n';
const gzip=gzipSync(Buffer.from(text),{level:9});
gzip[4]=gzip[5]=gzip[6]=gzip[7]=0;gzip[9]=255;
const roundTrip=JSON.parse(gunzipSync(gzip).toString());
if(JSON.stringify(roundTrip)!==JSON.stringify(merged))fail('gzip mirror does not round-trip');
const stats={entries:merged.entries.length,sources:merged.sources.length,boundRecords:merged.entries.reduce((n,e)=>n+e.sourceRecordIds.length,0),added:batch.entries.map(e=>e.id),gzipBytes:gzip.length};
if(problems.length){console.error('FAIL\n'+problems.join('\n'));process.exit(1)}
if(checkOnly){console.log(JSON.stringify({result:'checked',...stats},null,2));process.exit(0)}
await writeFile(resolve(root,'editorial/city-narratives.json'),text);
await writeFile(resolve(root,'public/data/places/city-narratives.json.gz'),gzip);
console.log(JSON.stringify({result:'merged',...stats},null,2));
