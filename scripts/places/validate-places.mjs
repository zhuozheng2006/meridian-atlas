/** Run: node scripts/validate-places.mjs [project-root]
 * Imports the actual browser module; only fetch is replaced by local-file I/O.
 * No DOM, MapLibre instance, copied implementation, or network is required.
 */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {gunzipSync,gzipSync} from 'node:zlib';

const root=resolve(process.argv[2]||resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const dist=resolve(root,'public'),requests=[],failOnce=new Set(),overrides=new Map();
const diskJSON=async file=>JSON.parse(gunzipSync(await readFile(resolve(dist,'data/places',file+'.json.gz'))));
const originals={fetch:globalThis.fetch};
globalThis.fetch=async input=>{
  const file=String(input);requests.push(file);
  if(failOnce.delete(file))return new Response('Temporarily unavailable',{status:503});
  if(overrides.has(file))return new Response(gzipSync(JSON.stringify(overrides.get(file))));
  try{return new Response(await readFile(resolve(dist,file)));}
  catch{return new Response('Missing local test asset',{status:404});}
};
const {loadPlaces,placeDetail,placeAtYear,nearestPlaceYear,searchPlaces}=await import(pathToFileURL(resolve(dist,'places.js')));
const index=await diskJSON('historical-settlements-index');
const urban=await diskJSON('urban-observations');
const capitals=await diskJSON('historical-capitals');
const modern=await diskJSON('modern-cities');
const results=[];
async function check(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS',name);}catch(error){results.push({name,passed:false,error:error.message});console.error('FAIL',name,':',error.message);}}
let historical;

await check('Imports real places.js without DOM',()=>assert.equal(typeof globalThis.document,'undefined'));
await check('One unavailable archive preserves other sources and is retryable',async()=>{
  failOnce.add('data/places/historical-capitals.json.gz');
  const partial=await loadPlaces();assert.equal(partial.partial,true);
  assert.equal(partial.length,index.places.length+urban.cities.length);
  historical=await loadPlaces();assert.equal(historical.partial,false);
  assert.equal(historical.length,index.places.length+urban.cities.length+capitals.claims.length);
});
await check('Modern reference is opt-in and never contaminates default loads',async()=>{
  assert.equal(historical.some(p=>p.kind==='modern-reference'),false);
  const withModern=await loadPlaces(true);
  assert.equal(withModern.filter(p=>p.kind==='modern-reference').length,modern.cities.length);
  assert.equal((await loadPlaces()).some(p=>p.kind==='modern-reference'),false);
});
await check('Historical index stays light and all details shards exist',async()=>{
  assert(index.places.every(p=>p.description===undefined));
  const shards=new Map();
  for(const p of index.places){
    if(!shards.has(p.detailsShard))shards.set(p.detailsShard,await diskJSON(`settlements-${String(p.detailsShard).padStart(3,'0')}`));
    assert.equal(shards.get(p.detailsShard)[p.id].id,p.id);
  }
});
await check('A failed detail request retries, hydrates, and preserves unknown accuracy',async()=>{
  const base=index.places.find(p=>p.id==='pleiades:423025');assert(base);
  const active=placeAtYear(base,100);assert(active);assert.equal(active.location.accuracyMeters,null);
  const url=`data/places/settlements-${String(base.detailsShard).padStart(3,'0')}.json.gz`;
  failOnce.add(url);await assert.rejects(placeDetail(active));
  const full=await placeDetail(active);assert(full.description);assert(full.names.length);
  assert.equal(full.location.accuracyMeters,null);
  assert.equal(full.sourceUrl,'https://pleiades.stoa.org/places/423025');
  assert.deepEqual(full.coordinates,active.coordinates);
});
await check('Detail selects the matching period, not another location sharing its coordinates',async()=>{
  const coordinates=[12,41],early={coordinates,accuracyMeters:20,periods:[[1,100,'early']],sourceUrl:'https://example.org/early'};
  const late={coordinates,accuracyMeters:20,periods:[[600,700,'late']],sourceUrl:'https://example.org/late'};
  const p={id:'test:shared-point',kind:'attested-settlement',name:'Period test',detailsShard:987,coordinates,periods:[[1,100,'early'],[600,700,'late']],locations:[early,late].map(({sourceUrl,...location})=>location)};
  overrides.set('data/places/settlements-987.json.gz',{[p.id]:{...p,locations:[early,late],description:'Fixture',names:[]}});
  const active=placeAtYear(p,650),full=await placeDetail(active);
  assert.equal(full.location.sourceUrl,late.sourceUrl);
});
await check('Selected period belongs to the displayed point evidence',()=>{
  const p=index.places.find(p=>p.id==='pleiades:912910');assert(p);
  const selected=placeAtYear(p,-750);assert(selected?.location);
  assert(selected.location.periods.some(r=>JSON.stringify(r)===JSON.stringify(selected.period)),'Nippur displayed period belongs to a different coordinate evidence');
});
await check('BCE/CE nearest year and observation selection use one consistent calendar',()=>{
  const p={observations:[[-1,100],[2,200]]};
  const active=placeAtYear(p,1,1);assert.equal(active.observation[0],-1);
  assert.equal(nearestPlaceYear(p,1),active.observation[0]);
  assert.equal(placeAtYear({observations:[[-1,100]]},1,0),null);
  assert.equal(placeAtYear({observations:[[-1,100]]},1,1).observation[0],-1);
});
await check('Dates outside population windows do not become city lifespans',()=>{
  const city={observations:[[1500,1000],[1600,2000]]};
  assert.equal(placeAtYear(city,1450,49),null);
  assert.equal(placeAtYear(city,1450,50).observation[0],1500);
  assert.equal(placeAtYear(city,1700,50),null);
  assert.equal(placeAtYear(city,0),null);
});
await check('Real historical attestation gaps remain empty',()=>{
  let checked=0;
  for(const p of index.places){
    const periods=[...p.periods].sort((a,b)=>a[0]-b[0]);let end=periods[0][1];
    for(const [start,nextEnd] of periods.slice(1)){
      if(start>end+1){let y=Math.trunc((start+end)/2);if(!y)y=1;
        if(y>end&&y<start){assert.equal(placeAtYear(p,y),null,p.id);checked++;break;}}
      end=Math.max(end,nextEnd);
    }
  }
  assert(checked>50,`Only ${checked} real gaps found`);
});
await check('Capitals use explicit tenure bounds and do not project forward',()=>{
  const p=capitals.claims.find(p=>p.qid==='Q16869'&&p.periods.some(([s,e])=>s===330&&e===1453));assert(p);
  assert(placeAtYear(p,330));assert(placeAtYear(p,1453));
  assert.equal(placeAtYear(p,329),null);assert.equal(placeAtYear(p,1454),null);
});
await check('Known internally contradictory name dates are quarantined',()=>{
  for(const id of ['pleiades:520998','pleiades:211425280']){
    const p=index.places.find(p=>p.id===id);assert(p);
    assert.equal(Boolean(placeAtYear(p,-1200)),false,`${id} visible at 1200 BCE`);
    assert.equal(Boolean(placeAtYear(p,-1199)),false,`${id} visible at 1199 BCE`);
  }
});
await check('Known geographic feature conflicts are excluded without deleting mountain settlements',()=>{
  for(const id of ['727138','727158','727225','727238','857148','619096567','434655354','423029'])assert(!index.places.some(p=>p.id==='pleiades:'+id),id);
  for(const id of ['50132','432948','462354'])assert(index.places.some(p=>p.id==='pleiades:'+id),id);
});
await check('Source URLs exist before lazy Pleiades hydration',()=>{
  for(const p of index.places)assert.equal(p.sourceUrl,`https://pleiades.stoa.org/places/${p.id.split(':')[1]}`);
});
await check('Search uses lazy-record aliases without fetching full records',async()=>{
  const before=requests.length;
  const rome=await searchPlaces('Rome',100);
  assert(rome.some(p=>p.id==='pleiades:423025'),'Rome did not find Pleiades Roma');
  assert((await searchPlaces('罗马市',100)).some(p=>p.id==='pleiades:423025'),'Original source-language alias missing');
  assert((await searchPlaces('君士坦丁堡',800)).some(p=>p.id==='pleiades:520998'),'Checked editorial Chinese alias missing');
  assert.equal(requests.slice(before).some(url=>/settlements-\d{3}/.test(url)),false);
});
await check('Major city search preserves modern isolation and known Chinese names',async()=>{
  for(const [query,predicate] of [
    ["Chang'an",p=>p.name==="Chang'an"],['长安',p=>p.nameZh==='长安'],
    ['Changan',p=>p.id==='chandler:1552'],['Roma',p=>p.id==='pleiades:423025'],
    ['Constantinople',p=>p.qid==='Q16869'],['君士坦丁堡',p=>p.qid==='Q16869']
  ]){const found=await searchPlaces(query,800);assert(found.some(predicate),query);assert(found.every(p=>p.kind!=='modern-reference'));}
});
await check('Exact city-name relevance precedes incidental substring matches',async()=>{
  const found=await searchPlaces('Rome',800),wrong=found.findIndex(p=>p.name==='Pyay');
  const exact=found.findIndex(p=>p.name==='Rome'||p.id==='pleiades:423025');
  assert(exact>=0);assert(wrong===-1||exact<wrong);
  const firstWrong=found.findIndex(p=>p.name==='Pyay');
  const lastRome=found.reduce((n,p,i)=>p.name==='Rome'?i:n,-1);
  assert(firstWrong===-1||firstWrong>lastRome,'Prome substring outranks exact Rome records');
});
const passed=results.filter(r=>r.passed).length;
console.log(JSON.stringify({passed,total:results.length,failures:results.filter(r=>!r.passed)},null,2));
globalThis.fetch=originals.fetch;
if(passed!==results.length)process.exitCode=1;
