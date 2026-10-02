#!/usr/bin/env node
// Usage: node scripts/places/validate-atrocities.mjs [repo-root] [report.json]
// Independent checks for the separate mass-violence layer. It rebuilds nothing: it reads the
// shipped public/data/atrocities.json.gz, verifies the archive, the schema, the provenance
// rules, the semantic boundary against the battle layer and the count bookkeeping.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(process.argv[2]||resolve(dirname(fileURLToPath(import.meta.url)),'../..'));
const reportPath=process.argv[3]?resolve(process.argv[3]):null;
const results=[],counters={incidents:0,withChineseName:0,withEnglishName:0,withReferenceLinks:0};
const check=async(name,fn)=>{try{await fn();results.push({name,passed:true});console.log('PASS',name)}catch(error){results.push({name,passed:false,error:error.message});console.error('FAIL',name,error.message)}};
const raw=await readFile(resolve(root,'public/data/atrocities.json.gz'));
const jsonText=await readFile(resolve(root,'public/data/atrocities.json'),'utf8');
const data=JSON.parse(gunzipSync(raw));
const battles=JSON.parse(await readFile(resolve(root,'public/data/battles.json'),'utf8'));
const REGIONS=['east-asia','southeast-asia','south-asia','west-central-asia','europe','africa','americas','oceania','global'];
const CJK=/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/;

await check('The archive is deterministic and mirrors the editable JSON',()=>{
 assert.equal(raw[4],0);assert.equal(raw[5],0);assert.equal(raw[6],0);assert.equal(raw[7],0);assert.equal(raw[9],255);
 assert.equal(JSON.stringify(JSON.parse(jsonText)),JSON.stringify(data));
 assert.equal(data.schemaVersion,1);assert.equal(data.layer,'atrocities');
});

await check('The layer states its semantic boundary against the battle layer',()=>{
 assert(typeof data.policy.semantics==='string'&&data.policy.semantics.length>120,'policy.semantics');
 assert(/not the battles layer|NOT the battles layer/i.test(data.policy.semantics),'semantics must exclude the battle layer explicitly');
 assert(typeof data.policy.language==='string'&&/transliterat|machine translated/i.test(data.policy.language),'language policy');
});

await check('Every incident has a unique id and a sourced Wikidata entity',()=>{
 assert(data.incidents.length>0);
 assert.equal(new Set(data.incidents.map(item=>item.id)).size,data.incidents.length);
 assert.equal(data.counts.shipped,data.incidents.length);
 for(const incident of data.incidents){
  assert.match(incident.id,/^atrocity-[a-z0-9]+$/,incident.id);
  assert.match(incident.qid,/^Q\d+$/,incident.qid);
  assert.equal(incident.id,'atrocity-'+incident.qid.toLowerCase(),incident.id+' id must encode the entity');
  assert(Array.isArray(incident.sources)&&incident.sources.length>=1,incident.id+' sources');
  for(const source of incident.sources){
   assert(source.title&&source.accessedAt,incident.id+' source title/accessedAt');
   assert.equal(new URL(source.url).protocol,'https:',incident.id+' source protocol');
  }
  if(incident.sources.length>1)counters.withReferenceLinks++;
  counters.incidents++;
 }
});

await check('The two layers stay disjoint by Wikidata entity id',()=>{
 const battleQids=new Set(battles.battles.map(battle=>battle.qid));
 const overlap=data.incidents.filter(incident=>battleQids.has(incident.qid));
 assert.equal(overlap.length,0,'entities present in both layers: '+overlap.slice(0,5).map(item=>item.qid).join(','));
 assert.equal(data.counts.dropped.battleLayerOverlap,0);
});

await check('Coordinates, years and regions come from the source record',()=>{
 for(const incident of data.incidents){
  const [lon,lat]=incident.coordinates;
  assert(Number.isFinite(lon)&&lon>=-180&&lon<=180,incident.id+' lon');
  assert(Number.isFinite(lat)&&lat>=-90&&lat<=90,incident.id+' lat');
  assert(Number.isInteger(incident.year)&&incident.year!==0&&incident.year>=-4000&&incident.year<=2024,incident.id+' year');
  assert.equal(incident.start,incident.year,incident.id+' start');
  assert.equal(incident.end,incident.year,incident.id+' end');
  assert(REGIONS.includes(incident.region),incident.id+' region '+incident.region);
  assert.equal(incident.regionBasis,'coordinate-box',incident.id+' region basis');
  assert(incident.classQid&&incident.classSemantics,incident.id+' class semantics');
 }
});

await check('Names are source labels: at least one is present, Chinese may be absent but is never invented',()=>{
 for(const incident of data.incidents){
  const hasZh=typeof incident.nameZh==='string'&&incident.nameZh.trim().length>0;
  const hasEn=typeof incident.nameEn==='string'&&incident.nameEn.trim().length>0;
  assert(hasZh||hasEn,incident.id+' has no name at all');
  assert.equal(incident.nameZh===null||typeof incident.nameZh==='string',true,incident.id+' nameZh type');
  if(hasZh)counters.withChineseName++;
  if(hasEn)counters.withEnglishName++;
  assert(incident.nameSource,incident.id+' nameSource');
 }
 assert.equal(data.counts.withChineseName,counters.withChineseName);
 assert.equal(data.counts.withoutChineseName,data.incidents.length-counters.withChineseName);
});

await check('English fields contain Latin script only',()=>{
 for(const incident of data.incidents){
  for(const field of ['nameEn','notesEn'])assert(!CJK.test(incident[field]||''),incident.id+' '+field);
  for(const value of [...incident.countries,...incident.conflict,...incident.victims])assert(!CJK.test(value),incident.id+' English list '+value);
  assert(typeof incident.notes==='string'&&incident.notes.length>10,incident.id+' notes');
 }
});

await check('The count bookkeeping matches the pool',()=>{
 const {pool,shipped,withChineseName,withoutChineseName,dropped,poolByClass,byClass}=data.counts;
 assert.equal(withChineseName+withoutChineseName,shipped);
 assert.equal(dropped.noName+shipped,pool,'pool must be the shipped records plus the unnamed ones');
 assert.equal(dropped.badCoordinates+dropped.badYear+dropped.outOfRange,0,'no record should fail the coordinate or year standard');
 const poolClassTotal=Object.values(poolByClass).reduce((sum,value)=>sum+value,0);
 const shippedClassTotal=Object.values(byClass).reduce((sum,value)=>sum+value,0);
 assert.equal(poolClassTotal,pool);
 assert.equal(shippedClassTotal,shipped);
});

const passed=results.filter(result=>result.passed).length;
const report={layer:'atrocities',checkedAt:new Date().toISOString(),passed,total:results.length,counters,results};
if(reportPath)await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed,total:results.length,counters},null,2));
if(passed!==results.length)process.exitCode=1;
