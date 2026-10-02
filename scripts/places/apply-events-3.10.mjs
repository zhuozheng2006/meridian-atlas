#!/usr/bin/env node
// Usage: node scripts/places/apply-events-3.10.mjs [--check]
// Merges editorial/events-3.10.json into public/data/events.json and rebuilds the
// deterministic gzip mirror. Existing entries are never rewritten: only entries whose
// id appears in the editorial batch are replaced, so the script is idempotent.
// The gzip header is patched to mtime=0 / OS=255 so the archive is byte-stable.
import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const checkOnly=process.argv.includes('--check');
const CATEGORIES=['politics','war','culture','science','trade','society','religion','disaster'];
const REGIONS=['east-asia','southeast-asia','south-asia','west-central-asia','europe','africa','americas','oceania','global'];
const PRECISIONS=['year','circa','range'];
const LOCATION_TYPES=['site','representative'];
const KEY_ORDER=['id','title','start','end','lat','lon','region','category','precision','locationType','summary','significance','sources','editorialNotes'];

const problems=[];
const fail=message=>problems.push(message);
const sameKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&JSON.stringify(Object.keys(value))===JSON.stringify(keys);
const ordered=entry=>{const built={};for(const key of KEY_ORDER)if(entry[key]!==undefined)built[key]=entry[key];return built};
const validate=entry=>{
 const where=entry?.id||'(missing id)';
 if(!/^[a-z0-9-]+$/.test(String(entry?.id||'')))fail(where+': id must be lower-case kebab-case');
 if(!sameKeys(entry.title,['zh','en']))fail(where+': title keys');
 if(!sameKeys(entry.summary,['zh','en']))fail(where+': summary keys');
 if(!sameKeys(entry.significance,['zh','en']))fail(where+': significance keys');
 if(entry.editorialNotes&&!sameKeys(entry.editorialNotes,['zh','en']))fail(where+': editorialNotes keys');
 if(!Number.isInteger(entry.start)||!Number.isInteger(entry.end))fail(where+': start/end must be integers');
 if(!entry.start||!entry.end||entry.start>entry.end)fail(where+': civil years must be non-zero and ordered');
 if(entry.start<-70000||entry.end>2024)fail(where+': outside supported year range');
 for(const group of ['title','summary','significance'])for(const lang of ['zh','en'])if(typeof entry[group]?.[lang]!=='string'||entry[group][lang].trim().length<4)fail(where+': '+group+'.'+lang+' too short');
 for(const group of ['title','summary','significance'])if(entry[group].zh.length>0&&entry[group].zh.length>200)fail(where+': '+group+'.zh unexpectedly long');
 if(!(entry.lat>=-90&&entry.lat<=90))fail(where+': lat');
 if(!(entry.lon>=-180&&entry.lon<=180))fail(where+': lon');
 if(!REGIONS.includes(entry.region))fail(where+': region '+entry.region);
 if(!CATEGORIES.includes(entry.category))fail(where+': category '+entry.category);
 if(!PRECISIONS.includes(entry.precision))fail(where+': precision '+entry.precision);
 if(!LOCATION_TYPES.includes(entry.locationType))fail(where+': locationType '+entry.locationType);
 if(!Array.isArray(entry.sources)||!entry.sources.length)fail(where+': at least one source required');
 for(const source of entry.sources||[]){if(!source.title)fail(where+': source title missing');try{if(new URL(source.url).protocol!=='https:')fail(where+': source must use https')}catch{fail(where+': invalid source url '+source.url)}}
 // Extra provenance keys (for example wikidataQid) are allowed after the shipped keys;
 // the shipped keys themselves must keep their documented order.
 const presentKeys=Object.keys(entry).filter(key=>KEY_ORDER.includes(key));
 if(JSON.stringify(presentKeys)!==JSON.stringify(KEY_ORDER.filter(key=>key in entry)))fail(where+': shipped keys must follow the order '+KEY_ORDER.join(','));
 // Structured entries must keep English fields free of CJK characters.
 if(entry.provenance==='wikidata-structured'){
  for(const [field,text] of [['title.en',entry.title?.en],['summary.en',entry.summary?.en],['significance.en',entry.significance?.en],['editorialNotes.en',entry.editorialNotes?.en]]){
   const cjk=String(text||'').match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/);
   if(cjk)fail(where+': CJK character in English field '+field);
  }
 }
 if(JSON.stringify(ordered(entry))!==JSON.stringify(Object.fromEntries(presentKeys.map(key=>[key,entry[key]]))))fail(where+': shipped keys must keep their values in order');
 // Traditional-only characters must not enter the simplified-Chinese corpus.
 for(const group of ['title','summary','significance','editorialNotes'])for(const text of group==='editorialNotes'?[entry.editorialNotes?.zh||'']:[entry[group]?.zh||'']){
  const traditional=text.match(/[與臺灣國學會東車馬鳥魚點線個時間問題則無為說話語實質]/g);
  if(traditional)fail(where+': possible traditional characters '+[...new Set(traditional)].join(''));
 }
};
const batchPaths=process.argv.filter(arg=>arg.startsWith('--batch=')).map(arg=>arg.slice('--batch='.length));
if(!batchPaths.length)batchPaths.push('editorial/events-3.10.json');
const batches=[];
for(const batchPath of batchPaths){const batch=JSON.parse(await readFile(resolve(root,batchPath),'utf8'));if(!Array.isArray(batch.entries)||!batch.entries.length)fail('editorial batch is empty: '+batchPath);batches.push({path:batchPath,entries:batch.entries})}
const editorial={entries:batches.flatMap(batch=>batch.entries)};
const current=JSON.parse(await readFile(resolve(root,'public/data/events.json'),'utf8'));
const seen=new Set();
for(const entry of editorial.entries){validate(entry);if(seen.has(entry.id))fail('duplicate id inside batches: '+entry.id);seen.add(entry.id)}
if(problems.length){console.error('FAIL editorial/events-3.10.json\n'+problems.join('\n'));process.exit(1)}

// Keep provenance keys (wikidataQid, provenance, regionBasis) after the shipped keys so
// the structured batch stays machine-filterable without changing the shipped schema.
const withExtras=entry=>{const built=ordered(entry);for(const key of Object.keys(entry))if(!KEY_ORDER.includes(key))built[key]=entry[key];return built};
const additions=new Map(editorial.entries.map(entry=>[entry.id,withExtras(entry)]));
const existingIds=new Set(current.map(entry=>entry.id));
for(const id of additions.keys())if(existingIds.has(id)&&!current.find(entry=>entry.id===id))fail('id collision: '+id);
// A regenerated structured batch replaces the previous structured entries entirely, so
// no orphaned index entry survives a rebuild.
const incomingStructured=[...additions.values()].some(entry=>entry.provenance==='wikidata-structured');
const merged=[...current.filter(entry=>!additions.has(entry.id)&&!(incomingStructured&&entry.provenance==='wikidata-structured')),...additions.values()];
const order=(a,b)=>a.start-b.start||a.end-b.end;
merged.sort(order);
const output=JSON.stringify(merged,null,2)+'\n';
const gzip=gzipSync(Buffer.from(output),{level:9});
gzip[4]=gzip[5]=gzip[6]=gzip[7]=0;gzip[9]=255; // deterministic header: no mtime, unknown OS
const roundTrip=JSON.parse(gunzipSync(gzip).toString());
if(JSON.stringify(roundTrip)!==JSON.stringify(merged))fail('gzip mirror does not round-trip');
const stats={batches:batches.map(batch=>batch.path),addedOrUpdated:additions.size,total:merged.length,previousTotal:current.length,byRegion:{},byEra:{}};
const eraOf=year=>year< -3000?'prehistoric':year<=-1201?'ancient-early':year<=-501?'ancient-iron':year<=499?'classical':year<=1499?'medieval':year<=1799?'early-modern':year<=1945?'modern':'contemporary';
for(const entry of additions.values()){stats.byRegion[entry.region]=(stats.byRegion[entry.region]||0)+1;stats.byEra[eraOf(entry.start)]=(stats.byEra[eraOf(entry.start)]||0)+1}
if(checkOnly){console.log(JSON.stringify({result:'checked',...stats},null,2));process.exit(0)}
if(problems.length){console.error('FAIL\n'+problems.join('\n'));process.exit(1)}
await writeFile(resolve(root,'public/data/events.json'),output);
await writeFile(resolve(root,'public/data/events.json.gz'),gzip);
console.log(JSON.stringify({result:'merged',...stats,gzipBytes:gzip.length,jsonBytes:Buffer.byteLength(output)},null,2));
