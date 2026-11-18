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
    ['index','pleiades:79739',100,'维鲁拉米乌姆（圣奥尔本斯）'],
    ['index','pleiades:442523',-216,'坎尼'],
    ['index','pleiades:256128',100,'科尔多瓦（科尔杜巴）'],
    ['index','pleiades:648647',100,'科尼亚（伊科尼乌姆）'],
    ['index','pleiades:857321',100,'锡诺普'],
    ['index','pleiades:197488',300,'萨洛纳'],
    ['index','pleiades:59672',-200,'极东亚历山大里亚（苦盏）'],
    ['index','pleiades:818739154',750,'威尼斯'],
    ['index','pleiades:893952',750,'巴格达'],
    ['index','pleiades:942260',750,'达姆甘（库米斯）'],
    ['index','pleiades:403627900',1960,'拉利贝拉'],
    ['index','pleiades:383706',100,'米兰（梅迪奥拉努姆）'],
    ['index','pleiades:266021',-219,'萨贡托（阿尔塞）'],
    ['index','pleiades:678393',-300,'西顿'],
    ['index','pleiades:805630',100,'麦罗埃'],
    ['index','pleiades:786123',100,'西耶尼（阿斯旺）'],
    ['index','pleiades:894004',200,'哈特拉'],
    ['index','pleiades:942276',-200,'百门城（赫卡托姆皮洛斯）'],
    ['index','pleiades:971886',100,'铁尔梅兹（塔尔米塔）'],
    ['index','pleiades:430344981',1000,'大不里士'],
    ['index','pleiades:410216618',1000,'麦迪纳·阿扎哈拉'],
    ['index','pleiades:922695',-400,'波斯波利斯（帕尔萨）'],
    ['index','pleiades:483473194',-6000,'恰塔尔休于'],
    ['index','pleiades:59915',-200,'马拉坎达（撒马尔罕）'],
    ['index','pleiades:246349',100,'塔拉科（塔拉戈纳）'],
    ['index','pleiades:266066',100,'托莱多（托莱图姆）'],
    ['index','pleiades:854719',-200,'潘提卡彭（刻赤）'],
    ['index','pleiades:197130',200,'阿昆库姆（布达佩斯）'],
    ['index','pleiades:874361',-100,'阿塔沙特（阿尔塔克萨塔）'],
    ['index','pleiades:211425279',1000,'拉什特'],
    ['index','pleiades:890432541',1000,'卡尚'],
    ['index','pleiades:982176368',1000,'法达克'],
    ['index','pleiades:897829063',1300,'格迪古城'],
    ['index','pleiades:922693',-400,'帕萨尔加德（巴特拉卡塔什）'],
    ['index','pleiades:912985',-500,'乌尔'],
    ['index','pleiades:60083',-200,'塔克西拉'],
    ['index','pleiades:39303',300,'阿克苏姆'],
    ['index','pleiades:393421',100,'博洛尼亚（费尔西纳/波诺尼亚）'],
    ['index','pleiades:265849',-200,'新迦太基（卡塔赫纳）'],
    ['index','pleiades:118569',100,'阿奎莱亚'],
    ['index','pleiades:481818',100,'都拉斯（迪拉基乌姆）'],
    ['index','pleiades:903104',-100,'拉伊（拉加埃/雷伊）'],
    ['index','pleiades:541042',-100,'法萨卢斯'],
    ['index','pleiades:79395',100,'林杜姆（林肯）'],
    ['index','pleiades:236642',100,'萨拉曼卡（萨尔曼蒂卡）'],
    ['index','pleiades:912845',-4500,'埃里都'],
    ['index','pleiades:894019',-500,'尼姆鲁德（卡拉赫）'],
    ['index','pleiades:894082',500,'萨迈拉'],
    ['index','pleiades:874735',-1500,'布拉克丘（纳加尔）'],
    ['index','pleiades:805634',100,'纳帕塔'],
    ['index','pleiades:678401',100,'滨海凯撒利亚'],
    ['index','pleiades:678301',100,'尼亚波利斯（纳布卢斯）'],
    ['index','pleiades:108778',100,'沙特尔（奥特里库姆）'],
    ['index','pleiades:108903',100,'科布伦茨（汇流城）'],
    ['index','pleiades:79590',100,'马穆基乌姆（曼彻斯特古堡）'],
    ['index','pleiades:59737',100,'巴里加扎'],
    ['index','pleiades:59873',-200,'憍赏弥'],
    ['index','pleiades:687902',100,'加沙'],
    ['index','pleiades:266090',100,'瓦伦蒂亚（瓦伦西亚）'],
    ['index','pleiades:157868',-100,'摩纳哥（赫拉克勒斯·莫诺伊科斯港）'],
    ['index','pleiades:39379',-100,'马里卜（马里亚巴）'],
    ['index','pleiades:419508714',1600,'德黑兰'],
    ['index','pleiades:79393',100,'卡穆洛杜努姆（科尔切斯特）'],
    ['index','pleiades:177434',100,'阿莱西亚'],
    ['index','pleiades:207447',200,'西尔米乌姆'],
    ['index','pleiades:207100',200,'德罗贝塔'],
    ['index','pleiades:108896',100,'克桑滕（乌尔皮亚·图拉真城）'],
    ['index','pleiades:98992',100,'卡尔克里泽（条顿堡遗址）'],
    ['index','pleiades:668295',-1300,'白港（乌加里特港）'],
    ['index','pleiades:727117',-1457,'赫利奥波利斯'],
    ['index','pleiades:286681704',-1457,'马里'],
    ['index','pleiades:912910',-1500,'尼普尔'],
    ['index','pleiades:787747618',-2200,'阿达卜'],
    ['index','pleiades:874478',-331,'高加米拉'],
    ['index','pleiades:668216',100,'比布鲁斯（朱拜勒）'],
    ['index','pleiades:639005',100,'米拉'],
    ['index','pleiades:265963',100,'马拉卡（马拉加）'],
    ['index','pleiades:207443',200,'辛吉杜努姆（贝尔格莱德）'],
    ['index','pleiades:902990',200,'伊斯法罕（阿斯帕达纳）'],
    ['index','pleiades:814671',100,'德丹（欧拉）'],
    ['index','pleiades:79651',100,'拉泰（莱斯特）'],
    ['index','pleiades:912821',500,'巴士拉'],
    ['index','pleiades:912897',-2500,'拉尔萨'],
    ['index','pleiades:687915',100,'希伯仑'],
    ['index','pleiades:814688',100,'叶斯里卜（麦地那旧名）'],
    ['index','pleiades:716520',-300,'阿蒙（锡瓦）'],
    ['index','pleiades:727080',100,'阿瓦里斯（比兰塞旧址）'],
    ['index','pleiades:707549',100,'库里昂'],
    ['index','pleiades:540701',-338,'喀罗尼亚'],
    ['index','pleiades:540699',-300,'卡吕冬'],
    ['index','pleiades:894056',-539,'俄庇斯'],
    ['index','pleiades:108749',200,'亚琛（格拉努斯温泉）'],
    ['index','pleiades:236658',100,'塞哥维亚'],
    ['index','pleiades:246567',100,'庞佩洛（潘普洛纳）'],
    ['index','pleiades:324835',200,'蒂斯德鲁斯（艾尔·杰姆）'],
    ['index','pleiades:197498',200,'萨瓦里亚（松博特海伊）'],
    ['index','pleiades:13818291',-1457,'恩科米'],
    ['index','pleiades:668200',-1457,'阿沙尔奈'],
    ['index','pleiades:90720956',-2500,'埃什努纳'],
    ['index','pleiades:44626252',-2500,'温马'],
    ['index','pleiades:894089',-600,'西帕尔'],
    ['index','pleiades:952092',400,'内沙布尔（沙普尔新城）'],
    ['index','pleiades:922740',400,'比沙普尔'],
    ['index','pleiades:207303',200,'纳伊苏斯（尼什）'],
    ['index','pleiades:177528',100,'日内瓦（热那瓦）'],
    ['index','pleiades:187596',200,'苏黎世（图里库姆）'],
    ['index','pleiades:246523',-150,'努曼西亚'],
    ['index','pleiades:638811',-400,'歌罗西'],
    ['index','pleiades:501609',-480,'塞斯托斯'],
    ['index','pleiades:511225',-400,'达斯库莱翁'],
    ['index','pleiades:26356565',-650,'米吉多（米吉杜）'],
    ['index','pleiades:912855',-2500,'吉尔苏（泰洛）'],
    ['index','pleiades:912868',-1900,'伊辛'],
    ['index','pleiades:894028',-600,'基什'],
    ['index','pleiades:893977',-1800,'库塔（易卜拉欣丘）'],
    ['index','pleiades:29811',400,'亚兹德'],
    ['index','pleiades:687951',-200,'拉吉'],
    ['index','pleiades:520988',-500,'迦克墩（卡尔克顿）'],
    ['index','pleiades:639139',-300,'特尔梅索斯'],
    ['index','pleiades:501336',-405,'羊河口（埃戈斯波塔米）'],
    ['index','pleiades:864388873',-1300,'代尔麦地那工匠村'],
    ['index','pleiades:991964195',-1500,'阿拉贾胡尤克'],
    ['index','pleiades:459393126',-1250,'恰高·赞比尔'],
    ['index','pleiades:599971',-500,'锡拉古城（圣托里尼）'],
    ['index','pleiades:197524',300,'斯帕拉图姆（斯普利特）'],
    ['index','pleiades:109188',100,'那慕尔'],
    ['index','pleiades:29652',100,'马科拉巴（麦加）'],
    ['index','pleiades:912851',-400,'法伊拉卡岛遗址（伊卡罗斯）'],
    ['index','pleiades:912941',200,'舒什塔尔（索斯特拉特）'],
    ['index','pleiades:678403',-200,'示剑'],
    ['index','pleiades:687904',-800,'基泽尔（基色）'],
    ['index','pleiades:688015',-217,'拉菲亚（拉法）'],
    ['index','pleiades:550496',2005,'希俄斯'],
    ['index','pleiades:540703',-400,'哈尔基斯（优卑亚）'],
    ['index','pleiades:59759',100,'迦毕试（巴格兰—贝格拉姆）'],
    ['index','pleiades:128384',200,'卡农图姆殖民地'],
    ['index','pleiades:207193',550,'第一查士丁尼亚（卡里钦格勒）'],
    ['index','pleiades:863739',100,'阿尼（亚美尼亚）'],
    ['index','pleiades:893988',-600,'杜尔-库里加尔祖'],
    ['index','pleiades:894185',300,'芝诺比娅（哈拉比耶）'],
    ['index','pleiades:118701',-200,'格劳贝格凯尔特王城'],
    ['index','pleiades:912800',500,'希拉（拉赫姆王都）'],
    ['index','pleiades:912808',500,'库法（阿科拉）'],
    ['index','pleiades:912873',500,'贡德沙普尔（韦赫-安迪约克-沙普尔）'],
    ['index','pleiades:149576487',-1350,'阿马尔纳（阿赫塔顿）'],
    ['index','pleiades:58129442',-1600,'卡内什（屈尔泰佩）'],
    ['index','pleiades:393135871',-6000,'耶莫新石器遗址'],
    ['index','pleiades:339709658',-3500,'欧贝德丘遗址'],
    ['index','pleiades:932478',-100,'巴林堡（卡拉特·巴林）'],
    ['index','pleiades:863907',100,'蒂格拉纳克特（亚美尼亚）'],
    ['index','pleiades:688011',1,'库姆兰遗址'],
    ['index','pleiades:697700',50,'马凯鲁斯要塞'],
    ['index','pleiades:697701',100,'马代巴'],
    ['index','pleiades:157894',-400,'尼凯亚（尼斯）'],
    ['index','pleiades:118731',150,'罗马时期海德堡'],
    ['index','pleiades:97875559',-6500,'阿特利特-亚姆水下新石器遗址'],
    ['index','pleiades:893987',-600,'迪尔巴特'],
    ['index','pleiades:878719593',1500,'特万（比尔湖畔）'],
    ['index','pleiades:39269',100,'亚丁（阿达内／幸福阿拉伯港）'],
    ['index','pleiades:29457',-200,'赫拉特（阿里亚的亚历山大城）'],
    ['index','pleiades:216981',-200,'修索波利斯（色雷斯王都）'],
    ['index','pleiades:718296310',-3500,'马阿迪铜石并用时期遗址（下埃及）'],
    ['index','pleiades:902113570',-2500,'摩亨佐-达罗（印度河文明大都市）'],
    ['index','pleiades:869702586',-2400,'埃勃拉（泰勒·马尔迪赫 · 叙利亚青铜王城）'],
    ['index','pleiades:104811110',1800,'萨那古城（也门）'],
    ['index','pleiades:128460',150,'温多波纳罗马市政城（维也纳）'],
    ['index','pleiades:108992',150,'法兰克福（美因河畔罗马聚落）'],
    ['index','pleiades:432670',500,'阿马尔菲'],
    ['index','pleiades:236396',100,'卡莱（波尔图古港）'],
    ['index','pleiades:322739224',1800,'大津巴布韦石城遗址'],
    ['index','pleiades:58094152',-1500,'科基诺巨石天文台遗址（北马其顿青铜时代）'],
    ['index','pleiades:863785',-500,'埃雷布尼要塞（乌拉尔图王城 · 埃里温）'],
    ['index','pleiades:80606012',-3000,'斯卡拉布雷新石器聚落（奥克尼）'],
    ['index','pleiades:265883',-600,'埃布苏斯（伊维萨腓尼基古港）'],
    ['index','pleiades:569531631',1800,'白沙瓦（布路沙布逻 · 健陀罗都城）'],
    ['index','pleiades:688028',-100,'示罗古城（泰勒·西伦 · 早期以色列圣所）'],
    ['index','pleiades:509457605',-3500,'加苏尔土丘遗址（外约旦铜石并用加苏尔文化代表地）'],
    ['index','pleiades:56036938',-2500,'萨尔遗址（巴林 · 迪尔蒙青铜时代古城与神庙）'],
    ['index','pleiades:423885388',-2500,'纳巴达古城（泰勒·贝达尔 · 早王朝北叙利亚圆城）'],
    ['index','pleiades:923122730',-3500,'泰勒·哈布巴·卡比拉（幼发拉底河中游乌鲁克古城）'],
    ['index','pleiades:187406',-440,'哈尔施塔特（欧洲早期铁器时代哈尔施塔特文化命名地 · 古盐矿城）'],
    ['index','pleiades:20410',-650,'比斯库平遗址（卢萨蒂亚文化湖心木构要塞城）'],
    ['index','pleiades:207425',-180,'萨尔米泽杰图萨皇家圣城（达契亚王国首都 · 格勒迪什泰亚德蒙泰）'],
    ['index','pleiades:668345',470,'伊本·瓦尔丹堡（查士丁尼东方行省皇宫教堂群）'],
    ['index','pleiades:49999',135,'希波库拉（百乘王朝西德干名都 · 科尔哈普尔）'],
    ['index','pleiades:550588',-180,'希尔卡尼斯（吕底亚波斯殖民城）'],
    ['index','pleiades:570612',-650,'皮萨（奥林匹亚旁古代名邦）'],
    ['index','pleiades:59739',135,'巴坦凯萨拉（巴特什瓦尔 · 阿格拉东南古镇）'],
    ['index','pleiades:688210632',1250,'阿尔莫格拉（科尔多瓦东南中世纪村）'],
    ['index','pleiades:77149477',150,'洛桑纳罗马港与乡邑（莱芒湖北岸）'],
    ['index','pleiades:394649378',-4500,'塔勒伊卜利斯（伊朗铜石并用冶铜遗址）'],
    ['index','pleiades:394649380',-800,'塔维兰遗址（佩特拉以西 · 以东人铁器古城）'],
    ['index','pleiades:414082997',-5000,'梅里姆达新石器遗址（尼罗河三角洲西缘）'],
    ['index','pleiades:211790934',500,'拉塔基亚（劳迪凯亚 · 叙利亚海岸）'],
    ['index','pleiades:890432540',800,'卡尔巴拉（幼发拉底河西伊拉克圣城）'],
    ['index','pleiades:464208937',-3000,'锡亚勒克遗址（卡尚伊朗高原史前名址）'],
    ['index','pleiades:629167850',-400,'毕达哥拉斯港（萨摩斯岛古城）'],
    ['index','pleiades:912807',200,'阿波洛戈斯（乌布拉古港 · 巴士拉前身）'],
    ['index','pleiades:60016',-200,'王舍城（罗阅祇 · 摩揭陀早期都城）'],
    ['index','pleiades:60067',-200,'舍卫城（室罗伐悉底 · 憍萨罗名都）'],
    ['index','pleiades:60097',-200,'毗舍离古城（跋耆联邦名都）'],
    ['index','pleiades:60011',-200,'奔那罗城（摩哈斯坦 · 孟加拉莫卧儿前古代大名都）'],
    ['index','pleiades:60100',-200,'毗罗吒城（摩差国古都 · 拜拉特孔雀碑址）'],
    ['index','pleiades:223856813',-1800,'泰勒莱兰（舒巴特-恩利勒 · 沙姆希-阿达德一世亚述北都）'],
    ['index','pleiades:629034',-100,'马扎卡（卡帕多西亚王都前身）'],
    ['index','pleiades:285501',200,'波马里亚（特莱姆森 · 罗马毛里塔尼亚边境名城）'],
    ['index','pleiades:863787',-100,'耶尔万达沙特（阿拉克斯河畔奥龙特王朝古都）'],
    ['index','pleiades:108830',200,'布鲁日（佛兰德罗马—中世纪名港城）'],
    ['index','pleiades:203544460',-2500,'巴恩豪斯新石器聚落（奥克尼哈雷湖滨遗址）'],
    ['index','pleiades:353701933',-750,'拉丰特塔（塞古拉河口腓尼基殖民港城）'],
    ['index','pleiades:86623849',-600,'西拉（外约旦以东王国圣石崖壁古都）'],
    ['index','pleiades:59799',-200,'迪尔塔（斯瓦特—迪尔山地亚历山大东征所至古邑）'],
    ['index','pleiades:187275',-100,'阿尔滕堡-赖瑙（高莱茵双联凯尔特奥皮杜姆）'],
    ['index','pleiades:128518',-100,'旧赫拉迪斯科（摩拉维亚拉坦文化琥珀之路奥皮杜姆）'],
    ['index','pleiades:39375',100,'马拉奥（厄立特里亚海周航记索马里兰柏培拉古大港）'],
    ['index','pleiades:138529',100,'坎佩尔（阿摩里卡奥西斯米古港镇）'],
    ['index','pleiades:29762',400,'锡拉夫（波斯湾萨珊—早期伊斯兰远洋大港）'],
    ['index','pleiades:912923',400,'卡迪西亚（伊拉克中南部萨珊古城遗址）'],
    ['index','pleiades:629028',400,'吕坎多斯（又称拉帕拉 · 陶鲁斯拜占庭军区名城）'],
    ['index','pleiades:29542',1550,'达拉布吉尔德（法尔斯萨珊王室环形规划古城）']
  ];
  const kaesong=urban.cities.find(c=>c.id==='chandler:659');
  assert(kaesong);
  const k1000=placeAtYear(Object.freeze({...kaesong}),1000);
  assert.equal(k1000?.nameZh,'开城');
  assert.equal(placeName(k1000,'zh'),'开城');
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
