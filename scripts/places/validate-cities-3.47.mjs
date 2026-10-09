#!/usr/bin/env node
// Uses actual place/search/chapter modules and shipped archives. No copied matcher.
// Usage: node scripts/places/validate-cities-3.47.mjs [repo-root] [report.json]
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=resolve(process.argv[2]||fileURLToPath(new URL('../../',import.meta.url)));
const base=resolve(root,'public/data/research-evidence/cities-3.47');
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const catalog=await json(resolve(base,'catalog.json')),claims=await json(resolve(base,'claim-evidence.json'));
const preservation=await json(resolve(base,'base-preservation.json'));
const editorial=await json(resolve(root,'editorial/attested-places.json'));
const layer=JSON.parse(gunzipSync(await readFile(resolve(root,'public/data/places/attested-places.json.gz'))));
const result=[];
const check=async(name,run)=>{try{await run();result.push({name,passed:true});console.log('PASS',name);}catch(error){result.push({name,passed:false,error:error.stack});console.error('FAIL',name,error.message);}};
const ids=['attested:great-zimbabwe','attested:tiwanaku','attested:djenne-jeno'];
const records=ids.map(id=>layer.records.find(r=>r.id===id));

await check('All original source archives, chapters, polity dates and 14 authored sites remain intact',async()=>{
 for(const file of preservation.files){const bytes=await readFile(resolve(root,file.path));assert.equal(hash(bytes),file.sha256,file.path);assert.equal(bytes.length,file.bytes,file.path);}
 assert.deepEqual(editorial.entries.slice(0,14),preservation.oldEntries);
 assert.deepEqual(editorial.reviewLedger,preservation.oldReviewLedger);
 assert.deepEqual(editorial.supplementalReviewLedger.slice(0,2),preservation.oldSupplementalReviewLedger);
 assert.deepEqual(editorial.enhancements,preservation.oldEnhancements);assert.deepEqual(editorial.deferred,preservation.oldDeferred);
});
await check('Each published evidence snapshot is hashed and every date/point/narrative has traceable claims',async()=>{
 assert.equal(catalog.entries.length,3);assert.equal(new Set(catalog.sources.map(s=>s.sourceId)).size,8);
 for(const s of catalog.snapshots){const bytes=await readFile(resolve(base,s.path));assert.equal(bytes.length,s.bytes,s.path);assert.equal(hash(bytes),s.sha256,s.path);assert(s.representation.includes('not original HTML'));}
 const sourceIds=new Set(catalog.sources.map(s=>s.sourceId));
 for(const id of ids)for(const field of ['coordinates','period','narrative.setting','narrative.development','narrative.legacy']){
  const row=claims.find(c=>c.recordId===id&&c.claim===field);assert(row,id+' '+field);assert(row.locators.length);for(const s of row.sourceIds)assert(sourceIds.has(s),s);
 }
 for(const r of records){assert(r);assert(r.sources.some(s=>s.id===r.period.sourceId));const evidence=catalog.entries.find(e=>e.recordId===r.id);assert.equal(evidence.periodSourceId,r.period.sourceId);assert.equal(evidence.dateQuote,r.period.dateQuote);assert.deepEqual(evidence.sourceRange,r.period.sourceRange);const excerpt=catalog.sources.find(s=>s.sourceId===r.period.sourceId);assert(excerpt.shortExcerpts.includes(r.period.dateQuote));}
});
await check('Independent DMS conversions use exact heritage or component points, with no invented accuracy',()=>{
 const expected=[
  [30+55/60+59.768/3600,-(20+16/60+16.212/3600)],
  [-(68+40/60+23.801/3600),-(16+33/60+18.011/3600)],
  [-(4+32/60+25.6/3600),13+53/60+24.92/3600],
 ];
 for(let i=0;i<records.length;i++){assert.deepEqual(records[i].location.coordinates,expected[i]);assert.equal(records[i].location.representativePoint,true);assert.equal(records[i].location.accuracyMeters,null);}
 assert.equal(records[2].sources[0].sourceComponentId,'116-001');
 assert.notDeepEqual(records[2].location.coordinates,[-(4+33/60+19.34/3600),13+54/60+18.96/3600]);
});
await check('Construction, planned-city, archaeological occupation and object dates keep their distinct meanings',()=>{
 assert.deepEqual(records.map(r=>[r.period.start,r.period.end]),[[1100,1450],[400,900],[-200,1400]]);
 assert(records[0].period.dateQuote.includes('built'));assert(records[0].period.interpretationEn.includes('eleventh–seventeenth'));
 assert(records[1].period.dateQuote.includes('planned city'));assert(records[1].scope.spatial.en.includes('findspot'));
 assert.equal(records[2].period.sourceId,'rice-djenne');assert(records[2].period.interpretationEn.includes('250 BCE'));
 const rice=catalog.sources.find(s=>s.sourceId==='rice-djenne');assert.equal(rice.originalFile.pages,12);assert.match(rice.originalFile.sha256,/^[a-f0-9]{64}$/);assert(rice.version.includes('2003'));assert(rice.version.includes('2020-01-28'));
 for(const r of records){assert.equal(r.continuousOccupationAsserted,false);assert.equal(r.displayWindow,null);for(const field of ['polityQid','capitalOf','capitalBindingVerified','geometry','boundary'])assert.equal(r[field],undefined);}
});

const savedFetch=globalThis.fetch;
globalThis.fetch=async input=>{
 const path=resolve(root,'public',String(input));
 if(!path.startsWith(resolve(root,'public')+'/'))return new Response('outside',{status:400});
 try{return new Response(await readFile(path));}catch{return new Response('missing',{status:404});}
};
try{
 const {loadPlaces,placeAtYear,searchPlaces}=await import(pathToFileURL(resolve(root,'public/places.js')));
 const {matchCityNarrative,attestedChapter}=await import(pathToFileURL(resolve(root,'public/city-narratives.js')));
 const all=await loadPlaces(true),legacy=JSON.parse(gunzipSync(await readFile(resolve(root,'public/data/places/city-narratives.json.gz'))));
 await check('Actual loader and chapter renderer expose exactly the new records in both languages',()=>{
  for(const r of records){const place=all.find(p=>p.id===r.id);assert(place);const chapter=attestedChapter(place,r.period.start);assert.equal(chapter.id,r.id);assert.equal(chapter.sections.length,3);assert.deepEqual(chapter.sources.map(s=>s.url),r.sources.map(s=>s.url));for(const part of chapter.sections){assert(part.zh.length>=38);assert(part.en.split(/\s+/).length>=25);}}
 });
 await check('Actual filters enforce both period endpoints, reject year zero, and preserve BCE/CE continuity',()=>{
  for(const r of records){const place=all.find(p=>p.id===r.id);for(const year of [r.period.start,r.period.end]){assert(placeAtYear(place,year,0));assert(matchCityNarrative(legacy,place,year));}for(const year of [r.period.start-1,r.period.end+1,0]){assert.equal(placeAtYear(place,year),null);assert.equal(matchCityNarrative(legacy,place,year),null);}}
  const d=all.find(p=>p.id===ids[2]);assert(placeAtYear(d,-1));assert(placeAtYear(d,1));
 });
 await check('Chinese, accent-free English and historic aliases find the site without borrowing a nearby chapter',async()=>{
  for(const [query,id,year] of [['大津巴布韦',ids[0],1300],['Great Zimbabwe',ids[0],1300],['蒂瓦纳科',ids[1],600],['Tiahuanaco',ids[1],600],['杰内杰诺',ids[2],500],['Djenne-jeno',ids[2],500]])assert((await searchPlaces(query,year)).some(p=>p.id===id),query);
  for(const [id,year] of [['pleiades:322739224',1800],['chandler:1593',1300],['chandler:1417',800],['modelski-ancient:132',-500],['ne:1159150949',500]]){const place=all.find(p=>p.id===id);assert(place,id);assert.equal(matchCityNarrative(legacy,place,year),null,id+' must not inherit adjacent site chapter');}
 });
}finally{globalThis.fetch=savedFetch;}
const report={testedAt:new Date().toISOString(),checks:result,passed:result.every(r=>r.passed),newSites:records.length};
if(process.argv[3]){const target=resolve(process.argv[3]);await mkdir(dirname(target),{recursive:true});await writeFile(target,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({passed:result.filter(r=>r.passed).length,total:result.length}));if(!report.passed)process.exitCode=1;
