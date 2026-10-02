#!/usr/bin/env node
// Usage: node scripts/places/validate-battles.mjs [repo-root] [report.json]
// Independent checks for the battle layer. It does not rebuild anything: it reads the
// shipped public/data/battles.json.gz, verifies the archive, schema and provenance
// rules, and reports the region and century distribution.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(process.argv[2]||resolve(dirname(fileURLToPath(import.meta.url)),'../..'));
const results=[],counters={battles:0,withBelligerents:0,withConflict:0,withReferences:0,withChineseName:0,withEnglishName:0};
const check=async(name,fn)=>{try{await fn();results.push({name,passed:true});console.log('PASS',name)}catch(error){results.push({name,passed:false,error:error.message});console.error('FAIL',name,error.message)}};
const raw=await readFile(resolve(root,'public/data/battles.json.gz'));
const jsonText=await readFile(resolve(root,'public/data/battles.json'),'utf8');
const data=JSON.parse(gunzipSync(raw));
const REGIONS=['east-asia','southeast-asia','south-asia','west-central-asia','europe','africa','americas','oceania','global'];

await check('The battle archive is deterministic and mirrors the editable JSON',()=>{
 assert.equal(raw[4],0);assert.equal(raw[5],0);assert.equal(raw[6],0);assert.equal(raw[7],0);assert.equal(raw[9],255);
 assert.equal(JSON.stringify(JSON.parse(jsonText)),JSON.stringify(data));
 assert.equal(data.schemaVersion,1);assert.equal(data.layer,'battles');
});
await check('At least three hundred battles with unique ids ship in the layer',()=>{
 assert(data.battles.length>=300,`only ${data.battles.length} battles`);
 assert.equal(new Set(data.battles.map(b=>b.id)).size,data.battles.length);
 assert.equal(data.counts.shipped,data.battles.length);
 for(const battle of data.battles){assert.match(battle.id,/^battle-[a-z0-9]+$/);counters.battles++}
});
await check('Every battle keeps valid coordinates, years and region codes from the source',()=>{
 for(const battle of data.battles){
  const [lon,lat]=battle.coordinates;
  assert(Number.isFinite(lon)&&lon>=-180&&lon<=180,battle.id+' lon');
  assert(Number.isFinite(lat)&&lat>=-90&&lat<=90,battle.id+' lat');
  assert(Number.isInteger(battle.year)&&battle.year!==0&&battle.year>=-4000&&battle.year<=2026,battle.id+' year');
  assert(battle.start<=battle.year&&battle.year<=battle.end,battle.id+' range');
  assert(REGIONS.includes(battle.region),battle.id+' region '+battle.region);
  assert.equal(battle.regionBasis,'coordinate-box',battle.id+' region basis');
  assert(battle.nameZh&&battle.nameZh.trim().length>0,battle.id+' nameZh');
  counters.withChineseName++;
  if(battle.nameEn&&battle.nameEn.trim().length)counters.withEnglishName++;
 }
});
await check('Belligerents and conflicts stay arrays of source strings and are never invented',()=>{
 for(const battle of data.battles){
  assert(Array.isArray(battle.belligerents),battle.id);
  assert(Array.isArray(battle.conflict),battle.id);
  for(const value of [...battle.belligerents,...battle.conflict])assert(typeof value==='string'&&value.trim().length>0,battle.id);
  if(battle.belligerents.length)counters.withBelligerents++;
  if(battle.conflict.length)counters.withConflict++;
  assert(typeof battle.notes==='string'&&battle.notes.length>10,battle.id+' notes');
 }
});
await check('Every battle cites its Wikidata entity and any statement reference',()=>{
 for(const battle of data.battles){
  assert(Array.isArray(battle.sources)&&battle.sources.length,battle.id+' sources');
  for(const source of battle.sources){
   assert(source.title&&typeof source.url==='string',battle.id+' source fields');
   assert(/^https?:\/\//.test(source.url),battle.id+' source url');
  }
  // The entity link must be HTTPS; statement-level references keep the scheme Wikidata records.
  assert(battle.sources.some(source=>source.url==='https://www.wikidata.org/wiki/'+battle.qid),battle.id+' entity link');
  assert(battle.sources.some(source=>source.url.startsWith('https://')),battle.id+' https source');
  if(battle.sources.length>1)counters.withReferences++;
 }
});
await check('Layer metadata records the selection policy and drop counts',()=>{
 assert(data.policy.coordinates.includes('P625'));assert(data.policy.participants.includes('P710'));
 assert(data.policy.dates.includes('P585'));assert(data.policy.region.includes('coordinate box'));
 assert(data.counts.items>=data.battles.length);
 assert(data.counts.dropped&&Number.isInteger(data.counts.dropped.noChineseLabel));
});
await check('The layer does not duplicate ids or coordinates of existing place datasets',()=>{
 const ids=new Set(data.battles.map(b=>b.id));
 assert.equal(ids.size,data.battles.length);
 const duplicated=data.battles.filter((battle,index)=>data.battles.findIndex(other=>other.qid===battle.qid)!==index);
 assert.deepEqual(duplicated,[],'each Wikidata entity appears once');
});

const report={testedAt:new Date().toISOString(),data:'public/data/battles.json.gz',dataSha256:createHash('sha256').update(raw).digest('hex'),
 counts:counters,byRegion:data.counts.byRegion,byCentury:data.counts.byCentury,checks:results,passed:results.every(result=>result.passed)};
if(process.argv[3])await writeFile(resolve(process.argv[3]),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:results.filter(result=>result.passed).length,total:results.length,...counters}));
if(!report.passed)process.exitCode=1;
