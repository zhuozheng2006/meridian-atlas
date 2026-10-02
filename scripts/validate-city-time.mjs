/** Independent regression tests for real browser modules; no DOM or copied algorithm.
 * Validates synthetic regressions and the real place archive by default.
 *   node scripts/validate-city-time.mjs [checkout-root] [data-dir]
 * Input transport is replaced by gzip fixtures to exercise actual cache/filter paths.
 */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {gzipSync,gunzipSync} from 'node:zlib';

const root=resolve(process.argv[2]||fileURLToPath(new URL('../',import.meta.url)));
const dataDir=resolve(process.argv[3]||resolve(root,'public/data/places'));
const source={title:'A synthetic, explicitly dated name change',url:'https://example.org/name-evidence'};
const oldEpoch={start:1600,end:1868,name:'Old Name',nameZh:'旧名',source};
const newEpoch={start:1868,end:2000,name:'New Name',nameZh:'新名',source};
const base={id:'test:population',kind:'urban-observation',source:'test',name:'Study label',nameZh:'研究原名',coordinates:[5,5],observations:[[1854,788000],[1875,780621]],nameTimeline:[oldEpoch,newEpoch],timeBasis:'discrete-observations'};
const record={id:'test:territory',name:'Test polity',start:1800,end:2000};
const geometry={type:'Polygon',coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]]]};
const cachePlace={...base,id:'test:cache-window',nameTimeline:undefined,observations:[[1900,1000],[1950,2000]]};
const fixtures=new Map([
 ['data/places/historical-settlements-index.json.gz',{places:[]}],
 ['data/places/historical-capitals.json.gz',{claims:[]}],
 ['data/places/urban-observations.json.gz',{cities:[cachePlace,base]}],
 ['data/places/attested-places.json.gz',{schemaVersion:1,layer:'attested-places',records:[]}],
 ['data/enrichment/profile-index.json.gz',{records:{}}],
 ['data/native/year-1914.json.gz',{year:1914,recordIndex:{[record.id]:'g'},geometries:{g:geometry}}],
]);
const requests=[];
const originalFetch=globalThis.fetch;
globalThis.fetch=async input=>{
 const file=String(input);requests.push(file);
 return fixtures.has(file)?new Response(gzipSync(JSON.stringify(fixtures.get(file)))):new Response('Missing fixture: '+file,{status:404});
};
const {placeAtYear,placeName,placeNamePeriods,loadPlaces,searchPlaces}=await import(pathToFileURL(resolve(root,'public/places.js')));
const {selectedPolityPlace,prepareTerritory,polityPlaces,filterPolityPlaces}=await import(pathToFileURL(resolve(root,'public/polity-places.js')));
const {placeWindow}=await import(pathToFileURL(resolve(root,'public/view-state.js')));
const results=[];
async function check(name,fn){
 try{await fn();results.push({name,passed:true});}
 catch(error){results.push({name,passed:false,error:error.message});}
}
const frozen=value=>{
 if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))frozen(child);}
 return value;
};

await check('URL population window accepts only supported values and preserves exact-year zero',()=>{
 for(const v of [0,'0',25,'25',50,'50'])assert.equal(placeWindow(v),Number(v));
 for(const v of [null,undefined,'',-1,1,24,26,Infinity,NaN,'nonsense'])assert.equal(placeWindow(v),50);
});
await check('Population window limits are inclusive and exact-year mode rejects borrowed observations',()=>{
 const p={...base,nameTimeline:undefined,observations:[[1900,12345]]};
 assert.equal(placeAtYear(p,1900,0).observation[1],12345);
 assert.equal(placeAtYear(p,1901,0),null);
 assert.equal(placeAtYear(p,1925,25).observation[0],1900);
 assert.equal(placeAtYear(p,1926,25),null);
 assert.equal(placeAtYear(p,1950,50).observation[0],1900);
 assert.equal(placeAtYear(p,1951,50),null);
 assert.equal(placeAtYear(p,1875,25).observation[0],1900);
 assert.equal(placeAtYear(p,1874,25),null);
});
await check('BCE/CE population window does not insert a fictitious year zero',()=>{
 const p={...base,nameTimeline:undefined,observations:[[-1,17]]};
 assert.equal(placeAtYear(p,0,50),null);
 assert.equal(placeAtYear(p,1,0),null);
 assert.equal(placeAtYear(p,1,1).observation[0],-1);
});
await check('Same-name-period filtering happens before choosing the nearest population record',()=>{
 const p=placeAtYear(base,1867,25);
 assert(p);assert.equal(p.observation[0],1854,'1875 is closer, but belongs to a different known name period');
 assert.equal(p.observation[1],788000);assert.equal(placeName(p,'en'),'Old Name');
 assert.equal(placeName(p,'zh'),'旧名');assert.equal(p.name,'Study label');
 assert.equal(placeAtYear(base,1870,25).observation[0],1875);
 assert.equal(placeName(placeAtYear(base,1870,25),'en'),'New Name');
});
await check('Cross-name-period observations are withheld rather than renamed to the map year',()=>{
 const p={...base,observations:[[1875,780621]]};
 assert.equal(placeAtYear(p,1867,25),null);
 assert.equal(placeAtYear(p,1875,0).observation[1],780621);
});
await check('Documented overlapping boundary year accepts observations on either side',()=>{
 const before={...base,observations:[[1854,788000]]};
 const after={...base,observations:[[1875,780621]]};
 assert.equal(placeName(placeAtYear(before,1868,25),'en'),'Old Name');
 assert.equal(placeName(placeAtYear(after,1868,25),'en'),'New Name');
});
await check('A missing selected-year name period does not manufacture an exclusion or lifespan',()=>{
 const p={...base,nameTimeline:[{...oldEpoch,end:1860}],observations:[[1854,788000]]};
 const active=placeAtYear(p,1867,25);assert(active);assert.equal(active.observation[0],1854);
 assert.equal(placeName(active,'en'),'Old Name');
 assert.equal(active.period,undefined);
});
await check('A missing observation-year name period preserves its original source label',()=>{
 const p={...base,nameTimeline:[newEpoch],observations:[[1854,788000]]};
 const active=placeAtYear(p,1870,25);assert(active);assert.equal(active.observation[0],1854);
 assert.equal(placeName(active,'en'),'Study label','Do not silently relabel old population with a known map-year name');
});
await check('An uncovered gap in a name timeline stays unknown rather than becoming a name period',()=>{
 const p={...base,nameTimeline:[{...oldEpoch,end:1860},{...newEpoch,start:1870}],observations:[[1865,777]]};
 const active=placeAtYear(p,1875,25);assert(active);assert.equal(active.observation[1],777);
 assert.equal(placeName(active,'en'),'Study label');
});
await check('Reviewed observation-name ranges are not treated as inferred rename boundaries',()=>{
 const p={...base,nameTimeline:undefined,observations:[[1453,45000]],datedNames:[{start:330,end:1453,name:'Reviewed Name',nameZh:'核定名称',observationYears:[1453],source}]};
 const active=placeAtYear(p,1454,25);assert(active);assert.equal(active.observation[0],1453);
 assert.equal(placeName(active,'en'),'Reviewed Name');
 assert.equal(active.labelEvidence.observationYears[0],1453);
});
await check('Population values, source labels, coordinates and dated rules are never rewritten',()=>{
 const p=frozen(structuredClone(base));const before=JSON.stringify(p);
 for(const year of [1600,1854,1867,1868,1870,1875,1950])for(const span of [0,25,50]){
  const active=placeAtYear(p,year,span);if(!active)continue;
  assert(p.observations.some(o=>o[0]===active.observation[0]&&o[1]===active.observation[1]));
  assert.deepEqual(active.coordinates,p.coordinates);assert.equal(active.name,p.name);
  assert.equal(active.period,undefined,'A population observation is not a city lifespan');
 }
 assert.equal(JSON.stringify(p),before);
});
await check('Population window does not change independently attested settlement or capital periods',()=>{
 const p={id:'test:settlement',kind:'attested-settlement',name:'Attested city',coordinates:[5,5],periods:[[1800,1820]]};
 for(const span of [0,25,50]){
  assert(placeAtYear(p,1810,span));assert.equal(placeAtYear(p,1821,span),null);
 }
 const capital={...p,kind:'dated-capital',polityQid:'Qtest'};
 for(const span of [0,25,50])assert.equal(placeAtYear(capital,1821,span),null);
});
await check('Country city filtering uses the same population window and name-period policy',()=>{
 const prepared=prepareTerritory(geometry);
 assert.equal(selectedPolityPlace(cachePlace,record,1914,prepared,0),null);
 assert.equal(selectedPolityPlace(cachePlace,record,1914,prepared,25).observation[0],1900);
 assert.equal(selectedPolityPlace(base,record,1867,prepared,25).observation[0],1854);
 assert.equal(selectedPolityPlace({...base,coordinates:[30,30]},record,1867,prepared,25),null);
 assert.equal(selectedPolityPlace({...base,kind:'modern-reference'},record,1867,prepared,25),null);
});
await check('Country city cache differentiates 0, 25 and 50 years without mutating source records',async()=>{
 const sources=await loadPlaces(),before=JSON.stringify(sources);
 const broad=await polityPlaces(record,1914,()=>true,50);
 assert(broad.places.some(p=>p.id===cachePlace.id));assert.equal(broad.window,50);
 const exact=await polityPlaces(record,1914,()=>true,0);
 assert.equal(exact.places.some(p=>p.id===cachePlace.id),false);assert.equal(exact.window,0);
 const medium=await polityPlaces(record,1914,()=>true,25);
 assert(medium.places.some(p=>p.id===cachePlace.id));assert.equal(medium.window,25);
 assert.strictEqual(await polityPlaces(record,1914,()=>true,50),broad);
 assert.equal(JSON.stringify(await loadPlaces()),before);
 assert(requests.includes('data/native/year-1914.json.gz'));
});
await check('An observation in an overlapping renaming year retains both historical names',()=>{
 const active=placeAtYear({...base,observations:[[1868,999]]},1868,0);
 assert(active);assert.equal(active.observation[1],999);
 for(const word of ['Old Name','New Name'])assert(placeName(active,'en').includes(word));
 for(const word of ['旧名','新名'])assert(placeName(active,'zh').includes(word));
});
await check('New historical timeline aliases remain searchable in both global and country lists',async()=>{
 assert((await searchPlaces('旧名',1870,25)).some(p=>p.id===base.id));
 assert((await searchPlaces('New Name',1867,25)).some(p=>p.id===base.id));
 const active=placeAtYear(base,1870,25);
 assert(filterPolityPlaces([active],'旧名','all','zh').some(p=>p.id===base.id));
});
await check('Open name-period bounds constrain names without asserting city existence',()=>{
 const p={...base,nameTimeline:[{...oldEpoch,start:null,end:1868},{...newEpoch,start:1868,end:null}]};
 assert.equal(placeNamePeriods(p,-5000)[0].name,'Old Name');
 assert.equal(placeNamePeriods(p,3000)[0].name,'New Name');
 assert.equal(placeNamePeriods(p,1868).length,2);
 assert.equal(placeAtYear(p,-5000,50),null,'An open name period must not create an ancient population observation');
 assert.equal(placeAtYear(p,3000,50),null,'An open name period must not extrapolate population');
 assert.equal(placeName(placeAtYear(p,1867,25),'en'),'Old Name');
 assert.equal(placeName(placeAtYear(p,1870,25),'en'),'New Name');
 assert.equal(placeAtYear({...p,observations:[[1875,780621]]},1867,25),null);
});
await check('Display and JSON export retain the observation year and original source record',()=>{
 const p=frozen({...structuredClone(base),observations:[[1868,812345]]});
 const before=JSON.stringify(p),active=placeAtYear(p,1854,25);assert(active);
 assert.equal(placeNamePeriods(p,1854).length,1);
 assert(placeName(active,'en').includes('Old Name'));assert(placeName(active,'en').includes('New Name'));
 assert.equal(active.observation[0],1868,'The name and population belong to the observation year, not selected year 1854');
 const exported=JSON.parse(JSON.stringify(active));
 assert.equal(exported.name,p.name);assert.equal(exported.nameZh,p.nameZh);
 assert.deepEqual(exported.observations,p.observations);assert.deepEqual(exported.coordinates,p.coordinates);
 assert.deepEqual(exported.nameTimeline,p.nameTimeline);assert.equal(exported.observation[1],812345);
 assert.equal(exported.period,undefined);assert.equal(JSON.stringify(p),before);
});

// Always validate the published archive unless an explicit data-directory override is supplied.
// Optional third argument example: work/cities-v37/derived
const syntheticCheckCount=results.length;
{
 const diskJSON=async file=>JSON.parse(gunzipSync(await readFile(resolve(dataDir,file+'.json.gz'))));
 const cities=(await diskJSON('urban-observations')).cities;
 const city=id=>{const p=cities.find(p=>p.id===id);assert(p,'Missing real city '+id);return p;};
 await check('Real Tokyo records: 1867 uses Edo 1854, 1869 uses Tokyo 1875',()=>{
  const p=frozen(city('chandler:1429')),before=JSON.stringify(p);
  const edo=placeAtYear(p,1867,25),tokyo=placeAtYear(p,1869,25);
  assert.equal(edo.observation[0],1854);assert.equal(edo.observation[1],788000);
  assert.equal(placeName(edo,'en'),'Edo');assert.equal(placeName(edo,'zh'),'江户');
  assert.equal(tokyo.observation[0],1875);assert.equal(tokyo.observation[1],780621);
  assert.equal(placeName(tokyo,'en'),'Tokyo');assert.equal(placeName(tokyo,'zh'),'东京');
  assert.equal(placeAtYear(p,1867,0),null);assert.equal(placeAtYear(p,1869,0),null);
  assert.equal(edo.name,'Tokyo');assert.equal(edo.nameZh,'东京');
  assert.deepEqual(edo.coordinates,[139.69171,35.6895]);assert.equal(JSON.stringify(p),before);
 });
 await check('Real Samara: 1971 borrows 1975 Kuybyshev, not the later Samara observation',()=>{
  const early=city('chandler:1232'),late=city('modelski-modern:228');
  const active=placeAtYear(early,1971,50);assert(active);
  assert.equal(active.observation[0],1975);assert.equal(active.observation[1],1375000);
  assert.equal(placeName(active,'zh'),'古比雪夫');assert.equal(active.name,'Samara');
  assert.equal(placeAtYear(late,1971,50),null,'The 2000 Samara name must not appear in 1971');
  assert.equal(placeAtYear(early,1992,50),null,'The 1975 name must not cross the documented restoration');
  assert.equal(placeName(placeAtYear(late,1992,50),'zh'),'萨马拉');
 });
 await check('Exact source-row quarantine preserves original geography/population without reassignment',async()=>{
  assert(!cities.some(p=>p.id==='chandler:1356'));
  const quarantine=await diskJSON('urban-quarantine');
  const entry=quarantine.entries.find(e=>e.recordId==='chandler:1356');assert(entry);
  assert.equal(entry.status,'withheld-from-city-layer');assert.equal(entry.license,'CC BY 4.0');
  assert.equal(entry.originalRecord.id,'chandler:1356');assert.equal(entry.originalRecord.name,"Sverdlovs'k");
  assert.equal(entry.originalRecord.countryReference,'Ukraine');assert.equal(entry.originalRecord.qid,null);
  assert.deepEqual(entry.originalRecord.coordinates,[39.651631,48.08455]);
  assert.deepEqual(entry.originalRecord.observations,[[1950,610000],[1975,1345000]]);
  const yekaterinburg=city('chandler:1565');
  assert.deepEqual(yekaterinburg.coordinates,[60.6,56.833333]);
  assert.deepEqual(yekaterinburg.observations,[[1900,54000]]);
  assert.equal(placeName(placeAtYear(yekaterinburg,1914,25),'zh'),'叶卡捷琳堡');
  assert(quarantine.rawSourceUnmodified);assert(entry.reasonEn&&entry.reasonZh&&entry.unresolved);
 });
 await check('Every real name timeline is sourced; all displayed values remain source observations',()=>{
  let checked=0;
  for(const p of cities.filter(p=>p.nameTimeline?.length)){
   const before=JSON.stringify(p);frozen(p);
   for(const n of p.nameTimeline){
    assert(n.name&&n.nameZh,p.id);assert(/^https?:\/\//.test(n.source?.url),p.id);
    assert(n.start==null||Number.isInteger(n.start)&&n.start!==0,p.id);
    assert(n.end==null||Number.isInteger(n.end)&&n.end!==0,p.id);
    assert(n.start==null||n.end==null||n.start<=n.end,p.id);
   }
   for(const [observed] of p.observations)for(const delta of [-50,-25,-1,0,1,25,50]){
    const year=observed+delta;if(!year)continue;
    const active=placeAtYear(p,year,50);if(!active)continue;
    assert(p.observations.some(o=>o[0]===active.observation[0]&&o[1]===active.observation[1]),p.id);
    assert.deepEqual(active.coordinates,p.coordinates);assert.equal(active.name,p.name);
    assert.equal(active.period,undefined);checked++;
   }
   assert.equal(JSON.stringify(p),before,p.id);
  }
  assert(checked>100,'Expected substantive real-data temporal coverage');
 });
}

globalThis.fetch=originalFetch;
const passed=results.filter(x=>x.passed).length;
console.log(JSON.stringify({passed,total:results.length,syntheticChecks:syntheticCheckCount,realDataChecks:results.length-syntheticCheckCount,dataDir,results},null,2));
if(passed!==results.length)process.exitCode=1;
