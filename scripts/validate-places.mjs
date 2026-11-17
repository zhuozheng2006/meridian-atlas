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
const {loadPlaces,placeDetail,placeName,placeAtYear,nearestPlaceYear,searchPlaces}=await import(pathToFileURL(resolve(dist,'places.js')));
const index=await diskJSON('historical-settlements-index');
const urban=await diskJSON('urban-observations');
const capitals=await diskJSON('historical-capitals');
const modern=await diskJSON('modern-cities');
const attested=await diskJSON('attested-places');
const results=[];
async function check(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS',name);}catch(error){results.push({name,passed:false,error:error.message});console.error('FAIL',name,':',error.message);}}
let historical;

await check('Imports real places.js without DOM',()=>assert.equal(typeof globalThis.document,'undefined'));
await check('Capital labels are readable and use pinned entity names',()=>{
 assert(capitals.claims.every(p=>p.name&&!/^Q\d+$/.test(p.name)));
 const changan=capitals.claims.find(p=>p.qid==='Q10923028');
 assert.equal(changan.name,"Chang'an, Tang Empire");assert.equal(changan.nameZh,'唐长安城');
 assert(changan.coordinateRevision);assert.deepEqual(changan.periods,[[618,904]]);
});
await check('Dated city names follow the observation and preserve raw names across transitions',async()=>{
 const p=urban.cities.find(p=>p.id==='chandler:1429');
 const edo=placeAtYear(p,1600);assert.equal(edo.displayName,'Edo');assert.equal(edo.displayNameZh,'江户');assert.equal(edo.name,'Tokyo');
 assert.equal(placeAtYear(p,1860).displayName,'Edo');assert.equal(placeAtYear(p,1860).observation[0],1854);
 const tokyo=placeAtYear(edo,1875);assert.equal(tokyo.displayName,'Tokyo');assert.equal(tokyo.labelEvidence.name,'Tokyo');assert.equal(tokyo.name,'Tokyo');
 assert(edo.labelEvidence.source.url.startsWith('https://www.archives.go.jp/'));assert.equal(placeAtYear(p,1867).observation[0],1854);assert.equal(placeAtYear(p,1869).observation[0],1875);
 const mexico=urban.cities.find(p=>p.id==='chandler:921');
 assert.equal(placeAtYear(mexico,1500).displayName,'Tenochtitlan');assert.equal(placeAtYear(mexico,1520).displayNameZh,'特诺奇蒂特兰');assert.equal(placeAtYear(mexico,1600).displayName,undefined);
 assert.equal(placeAtYear(urban.cities.find(p=>p.id==='chandler:623'),1200).displayName,'Constantinople');
 assert.equal(placeAtYear(urban.cities.find(p=>p.id==='chandler:1552'),800).displayNameZh,'长安');
});
await check('One unavailable archive preserves other sources and is retryable',async()=>{
  failOnce.add('data/places/historical-capitals.json.gz');
  const partial=await loadPlaces();assert.equal(partial.partial,true);
  assert.equal(partial.length,index.places.length+urban.cities.length+attested.records.length);
  historical=await loadPlaces();assert.equal(historical.partial,false);
  assert.equal(historical.length,index.places.length+urban.cities.length+capitals.claims.length+attested.records.length);
});
await check('Reviewed archaeological sites join the layer with their own period only',async()=>{
  const sites=historical.filter(p=>p.kind==='attested-site');
  assert.equal(sites.length,attested.records.length);
  for(const site of sites){
    const record=attested.records.find(r=>r.id===site.id);assert(record,site.id);
    assert.deepEqual(site.periods,[[record.period.start,record.period.end]]);
    assert.deepEqual(site.coordinates,record.location.coordinates);
    const before=placeAtYear(site,record.period.start-1),inside=placeAtYear(site,record.period.start),after=placeAtYear(site,record.period.end+1);
    assert.equal(before,null,site.id+' should not exist before its source period');
    assert.equal(after,null,site.id+' should not exist after its source period');
    assert(inside,site.id+' should exist inside its source period');
  }
  // Search lists records regardless of the selected year; the year filter stays
  // in placeAtYear, so a site outside its period is findable but not map-active.
  // A reviewed site must not be crowded off the map by a population observation
  // drawn at the same point: the marker layer places records in rank order and
  // skips colliding labels, so the site has to outrank the observation.
  const observation=historical.find(p=>p.id==='chandler:1457');
  assert(observation,'the real Quanzhou observation record is present');
  const siteRank=placeAtYear(sites.find(p=>p.id==='attested:quanzhou'),1200).rank;
  const observationRank=placeAtYear(observation,1200).rank;
  assert(siteRank<observationRank,`reviewed site rank ${siteRank} should beat the observation rank ${observationRank}`);
  assert.equal((await searchPlaces('阿瑜陀耶',1450)).some(p=>p.id==='attested:ayutthaya'),true);
  assert.equal((await searchPlaces('Ayutthaya',1200)).some(p=>p.id==='attested:ayutthaya'),true);
  assert.equal(placeAtYear((await searchPlaces('Ayutthaya',1200)).find(p=>p.id==='attested:ayutthaya'),1200),null);
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
await check('Corrupted Wikidata capital dates are quarantined and editorial labels resolve cleanly',async()=>{
  for(const [id,year] of [
    ['capital:Q180568$5ac9055c-44f4-93a7-fcb7-88674c46b701',742],
    ['capital:Q2980623$613b5f92-45dd-ce9b-abcd-9c5fc0145c32',500],
    ['capital:Q3627069$d0b39cb4-4d5e-15ee-4f60-725632ee182d',14],
    ['capital:Q83958$cf01679d-4565-d213-61db-12abfbc7b7b4',808]
  ]){
    const c=capitals.claims.find(x=>x.id===id);assert(c,id);
    assert.equal(placeAtYear(c,year),null,id+' should be quarantined at '+year);
  }
  const amarna=placeAtYear(capitals.claims.find(x=>x.qid==='Q5736'),-1345);
  assert.equal(amarna.nameZh,'阿玛尔纳');
  const madrid=placeAtYear(capitals.claims.find(x=>x.qid==='Q116170766'),1570);
  assert.equal(madrid.nameZh,'马德里');
  const kashmir=placeAtYear(capitals.claims.find(x=>x.polityQid==='Q123027565'&&x.qid==='Q170115'),1450);
  assert.equal(kashmir.polityLabels.zh,'克什米尔苏丹国');
  const francia=placeAtYear(capitals.claims.find(x=>x.polityQid==='Q146246'&&x.qid==='Q90'),600);
  assert.equal(francia.polityLabels.en,'Francia');
  assert((await searchPlaces('阿玛尔纳',-1345)).some(p=>p.qid==='Q5736'));
  assert(!(await searchPlaces('尼托斯',-1345)).some(p=>p.qid==='Q5736'));
});
await check('Editorial global city exonyms resolve without mutating frozen sources or dated timelines',async()=>{
  const samples=[
    ['urban','chandler:1510',1500,'毗奢耶那伽罗'],
    ['urban','chandler:474',1492,'高尔（高达）'],
    ['urban','modelski-modern:266',2000,'乌鲁木齐'],
    ['index','pleiades:668331',200,'巴尔米拉']
  ];
  for(const [src,id,year,expectedZh] of samples){
    const raw=(src==='urban'?urban.cities:index.places).find(p=>p.id===id);
    assert(raw,id);assert(!raw.nameZh,id+' raw should stay unmutated');
    const frozen=Object.freeze({...raw}),atYear=placeAtYear(frozen,year);
    assert(atYear,id+' at '+year);
    assert.equal(atYear.nameZh,expectedZh);
    assert.equal(placeName(frozen,'zh'),expectedZh);
    assert.equal(frozen.nameZh,raw.nameZh);
    const hits=await searchPlaces(expectedZh,year);
    assert(hits.some(p=>p.id===id),'searchPlaces failed for '+expectedZh);
  }
  const dated=urban.cities.find(p=>p.nameTimeline?.length&&!p.nameZh);
  if(dated){const atYear=placeAtYear(dated,dated.observations[0][0]);assert.equal(placeName(atYear,'en'),atYear.displayName||dated.name);}
});
await check('Displaced Chandler coordinate sign flips stay quarantined while Wave-2 editorial exonyms resolve cleanly',async()=>{
  const displaced=[
    ['chandler:422','El Tajin',800],
    ['chandler:545','Hamilton',1975],
    ['chandler:1192','Richmond',1950],
    ['chandler:136','Barrow',1900],
    ['chandler:279','Changteh',1900],
    ['chandler:382','Dienne',1300],
    ['chandler:562','Haverhill',1900],
    ['chandler:819','Londonderry',1900],
    ['chandler:1090','Pau',1900],
    ['chandler:1198','Rochefort',1900],
    ['chandler:1333','St. Helens',1900],
    ['chandler:1341','Stoke',1850],
    ['modelski-ancient:117','Shangqi',-500]
  ];
  for(const [id,query,year] of displaced){
    const raw=urban.cities.find(p=>p.id===id);
    assert(raw,id+' must stay untouched in raw archive');
    assert.equal(placeAtYear(raw,year),null,id+' must be withheld by PLACE_COORD_QUARANTINE');
    const hits=await searchPlaces(query,year);
    assert(!hits.some(p=>p.id===id),id+' must not appear in searchPlaces');
  }
  const wave2=[
    ['urban','chandler:181',1600,'比贾布尔'],
    ['urban','chandler:1093',1500,'勃固'],
    ['urban','chandler:1224',1600,'堺市'],
    ['urban','chandler:1136',1600,'波托西'],
    ['urban','chandler:1041',1950,'波尔图'],
    ['urban','chandler:1596',1950,'苏黎世'],
    ['index','pleiades:413107',100,'科萨'],
    ['index','pleiades:344448',200,'大莱波蒂斯'],
    ['urban','chandler:524',1492,'古马尔卡赫'],
    ['urban','modelski-ancient:112',-1200,'三星堆'],
    ['urban','chandler:399',-100,'敦煌'],
    ['urban','chandler:963',1750,'穆尔希达巴德'],
    ['urban','chandler:828',1400,'吕贝克'],
    ['urban','chandler:1105',-100,'佩特拉'],
    ['index','pleiades:599799',-400,'米利都'],
    ['index','pleiades:961886',-200,'巴克特拉（蓝氏城）'],
    ['urban','chandler:2',1500,'亚琛'],
    ['urban','chandler:50',-1360,'阿马尔奈'],
    ['urban','chandler:938',-1800,'摩亨佐-达罗'],
    ['urban','chandler:1563',1821,'叶尔羌（莎车）'],
    ['urban','modelski-ancient:2',-2200,'阿卡德'],
    ['urban','modelski-ancient:23',-1600,'亳'],
    ['urban','modelski-ancient:138',-1300,'特洛伊'],
    ['index','pleiades:109126',200,'卢泰西亚（巴黎）'],
    ['index','pleiades:961873',100,'梅尔夫（安条克）'],
    ['index','pleiades:697725',100,'佩特拉'],
    ['urban','chandler:303',1850,'基希讷乌'],
    ['urban','chandler:824',1200,'鲁汶'],
    ['urban','chandler:1311',1300,'索斯特'],
    ['urban','chandler:760',900,'库施（纳帕塔）'],
    ['index','pleiades:638751',100,'弗里吉亚阿帕米亚'],
    ['index','pleiades:589872',-100,'克诺索斯'],
    ['urban','chandler:8',1900,'图尔库（奥布）'],
    ['urban','chandler:165',1900,'贝鲁特'],
    ['urban','chandler:285',1900,'烟台（芝罘）'],
    ['urban','chandler:1191',1914,'朗达'],
    ['urban','chandler:1422',1900,'蒂米什瓦拉'],
    ['index','pleiades:422859',-200,'凯雷'],
    ['index','pleiades:452488',-300,'埃利亚（韦利亚）'],
    ['index','pleiades:668261',200,'埃梅萨（霍姆斯）'],
    ['index','pleiades:462214',-400,'杰拉'],
    ['index','pleiades:678010',100,'阿克（托勒密斯）'],
    ['index','pleiades:570740',-600,'梯林斯'],
    ['index','pleiades:658465',-100,'卡赫美士'],
    ['index','pleiades:501347',-400,'安菲波利斯'],
    ['index','pleiades:59978',-200,'华氏城（巴连弗邑）'],
    ['index','pleiades:49863',100,'阿努拉达普拉'],
    ['index','pleiades:570685',-400,'斯巴达'],
    ['index','pleiades:580021',-400,'马拉松'],
    ['index','pleiades:687917',-100,'耶利哥'],
    ['index','pleiades:148127',-400,'马赛（马萨利亚）'],
    ['index','pleiades:177460',100,'奥古斯托杜努姆（欧坦）'],
    ['index','pleiades:383664',100,'热那亚'],
    ['index','pleiades:275740',100,'瓦卢比利斯'],
    ['index','pleiades:648789',-200,'塔尔苏斯'],
    ['index','pleiades:678179',100,'赫利奥波利斯（巴勒贝克）'],
    ['index','pleiades:59750',-200,'布刻法拉'],
    ['index','pleiades:256338',100,'奥利西波（里斯本）'],
    ['index','pleiades:246344',100,'凯撒奥古斯塔（萨拉戈萨）'],
    ['index','pleiades:658409',100,'阿勒颇（叙利亚贝罗亚）'],
    ['index','pleiades:874341',100,'埃尔比勒（阿尔贝拉）'],
    ['index','pleiades:79739',100,'维鲁拉米乌姆（圣奥尔本斯）']
  ];
  for(const [src,id,year,expectedZh] of wave2){
    const raw=(src==='urban'?urban.cities:index.places).find(p=>p.id===id);
    assert(raw&&!raw.nameZh,id);
    const active=placeAtYear(Object.freeze({...raw}),year);
    assert(active,id+' active in '+year);
    assert.equal(active.nameZh,expectedZh);
    assert.equal(placeName(active,'zh'),expectedZh);
  }
});
await check('Known internally contradictory name dates are quarantined',()=>{
  for(const id of ['pleiades:520998','pleiades:211425280']){
    const p=index.places.find(p=>p.id===id);assert(p);
    assert.equal(placeAtYear(p,-1200),null,id);
    assert.equal(placeAtYear(p,-1199),null,id);
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
  const changan=await searchPlaces('长安',750);assert.equal(changan[0].qid,'Q10923028','The active Tang capital should precede an inactive Han namesake');
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
