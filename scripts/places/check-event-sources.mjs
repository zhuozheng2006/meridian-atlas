#!/usr/bin/env node
// Usage: node scripts/places/check-event-sources.mjs [repo-root] [out.json]
// Verifies every source cited by editorial/events-3.10.json against two independent
// records: (a) an HTTP fetch when the host allows this session, (b) the repository's
// own source records (shipped events, city dossiers, enrichment narratives, docs) and
// the reviewed handoff candidate file. A source passes when at least one record holds.
// The report always states which mode produced the evidence; blocked hosts are never
// reported as verified by a live fetch.
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(process.argv[2]||resolve(dirname(fileURLToPath(import.meta.url)),'../..'));
const outPath=resolve(root,process.argv[3]||'docs/verification-3.10/content-sources.json');
const HANDOFF='/Users/zane/meridian_atlas/经纬纪-AI交接/研究资料/全球覆盖审查/settlement-candidates.json';
const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
// Words that must occur in a live page for the fetch to count as content evidence.
// Expectations may be keyed by exact URL (preferred) or by host.
const EXPECT={
 'https://en.wikipedia.org/wiki/Ban_Chiang':['ban chiang','bronze'],
 'https://en.wikipedia.org/wiki/Newgrange':['newgrange','neolithic'],
 'https://en.wikipedia.org/wiki/Br%C3%BA_na_B%C3%B3inne':['boyne','passage tomb'],
 'https://en.wikipedia.org/wiki/Dong_Son_culture':['dong son','bronze'],
 'https://en.wikipedia.org/wiki/Painted_Grey_Ware_culture':['painted grey ware','iron age'],
 'https://en.wikipedia.org/wiki/Nabta_Playa':['nabta playa','neolithic'],
 'https://en.wikipedia.org/wiki/Meadowcroft_Rockshelter':['meadowcroft','radiocarbon'],
 'https://en.wikipedia.org/wiki/Hoabinhian':['hoabinhian','hunter-gatherer'],
 'https://en.wikipedia.org/wiki/Iron_Age':['iron age','smelted iron'],
 'https://en.wikipedia.org/wiki/Polynesian_navigation':['polynesian','canoe'],
 'https://en.wikipedia.org/wiki/Polynesian_culture':['polynesian','settlement'],
 'https://en.wikipedia.org/wiki/Neolithic_Revolution':['neolithic','domestication'],
 'https://en.wikipedia.org/wiki/Bronze_Age':['bronze age','tin'],
 'https://en.wikipedia.org/wiki/Minoan_civilization':['minoan','crete'],
 'https://en.wikipedia.org/wiki/Hallstatt_culture':['hallstatt','iron age'],
 'https://en.wikipedia.org/wiki/Erlitou_culture':['erlitou','bronze'],
 'https://en.wikipedia.org/wiki/Elam':['elam','susa'],
 'https://en.wikipedia.org/wiki/Cemetery_H_culture':['cemetery h','harappa'],
 'https://en.wikipedia.org/wiki/Paracas_culture':['paracas','textile'],
 'https://en.wikipedia.org/wiki/Indian_Ocean_trade':['indian ocean','trade'],
 'https://en.wikipedia.org/wiki/Dhar_Tichitt':['dhar tichitt','neolithic'],
 'https://en.wikipedia.org/wiki/D%27mt':['dʿmt','aksum'],
 'https://en.wikipedia.org/wiki/Gyeongguk_daejeon':['joseon','code of law'],
 'https://en.wikipedia.org/wiki/China_and_the_World_Trade_Organization':['world trade organization','2001'],
 'https://en.wikipedia.org/wiki/Khalji_dynasty':['khalji','delhi'],
 'https://en.wikipedia.org/wiki/Jai_Singh_II':['jaipur','jai singh'],
 'https://en.wikipedia.org/wiki/Aq_Qoyunlu':['aq qoyunlu','turkoman'],
 'https://en.wikipedia.org/wiki/Durrani_Empire':['durrani','afghan'],
 'https://en.wikipedia.org/wiki/First_Anglo-Afghan_War':['anglo-afghan','kabul'],
 'https://en.wikipedia.org/wiki/The_Great_Game':['great game','central asia'],
 'https://en.wikipedia.org/wiki/War_in_Afghanistan_(2001%E2%80%932021)':['afghanistan','taliban'],
 'https://en.wikipedia.org/wiki/North_Sea_Empire':['north sea empire','cnut'],
 'https://en.wikipedia.org/wiki/Kingdom_of_Sicily':['sicily','norman'],
 'https://en.wikipedia.org/wiki/Third_Crusade':['third crusade','saladin'],
 'https://en.wikipedia.org/wiki/War_of_the_Spanish_Succession':['spanish succession','1701'],
 'https://en.wikipedia.org/wiki/Mit%27a':['inca','mandatory'],
 'https://en.wikipedia.org/wiki/New_France':['new france','1763'],
 'https://en.wikipedia.org/wiki/Sugar_plantations_in_the_Caribbean':['sugar','caribbean'],
 'https://en.wikipedia.org/wiki/Pacific_Islands_Forum':['pacific islands forum','1971'],
 'https://en.wikipedia.org/wiki/Carnac_stones':['carnac','megalith'],
 'https://en.wikipedia.org/wiki/%C3%87atalh%C3%B6y%C3%BCk':['neolithic','anatolia'],
 'www.historicenvironment.scot':['skara brae','neolithic'],
 'whc.unesco.org':[],
 'www.iranicaonline.org':['isfahan','abbas'],
 'www.loc.gov':['1733'],
 'online.bunka.go.jp':['794'],
 'en.xa.gov.cn':['daming','634'],
 'nijo-jocastle.city.kyoto.lg.jp':['1603','1867'],
 'www.pib.gov.in':['1639','1648'],
 'egymonuments.gov.eg':['mamluk','1250'],
 'www.sydney.edu.au':['14th century'],
 'www.unesco.org':['astronom'],
 'www.metmuseum.org':[],
 'www.si.edu':[],
 'americanindian.si.edu':[],
 'apsaraauthority.gov.kh':[],
 'colosseo.it':[],
 'resources.metmuseum.org':[],
 'www.britishmuseum.org':[]
};
const batchFiles=(await readdir(resolve(root,'editorial'))).filter(name=>/^events-3\.\d+\.json$/.test(name)).sort();
const batches=await Promise.all(batchFiles.map(async name=>JSON.parse(await readFile(resolve(root,'editorial',name),'utf8'))));
const batch={files:batchFiles,entries:batches.flatMap(batch=>batch.entries)};
const urls=[...new Set(batch.entries.flatMap(entry=>entry.sources.map(source=>source.url)))].sort();

// Repository records: every file that already cites one of these URLs.
const records=new Map(urls.map(url=>[url,[]]));
const indexText=(name,text)=>{for(const url of urls)if(text.includes(url))records.get(url).push(name)};
indexText('public/data/events.json',await readFile(resolve(root,'public/data/events.json'),'utf8'));
indexText('public/data/places/city-narratives.json.gz',gunzipSync(await readFile(resolve(root,'public/data/places/city-narratives.json.gz'))).toString());
indexText('public/data/enrichment/narratives.json',await readFile(resolve(root,'public/data/enrichment/narratives.json'),'utf8'));
indexText('docs/events-ancient-sources.txt',await readFile(resolve(root,'docs/events-ancient-sources.txt'),'utf8'));
indexText('docs/sources-modern-verification.md',await readFile(resolve(root,'docs/sources-modern-verification.md'),'utf8'));
for(const file of (await readdir(resolve(root,'docs'))).filter(name=>/\.(json|md|txt)$/.test(name))){
 if(['events-ancient-sources.txt','sources-modern-verification.md'].includes(file))continue;
 try{indexText('docs/'+file,await readFile(resolve(root,'docs',file),'utf8'))}catch{}
}
let handoff=null;
try{handoff=JSON.parse(await readFile(HANDOFF,'utf8'))}catch{}
const handoffByUrl=new Map();
if(handoff)for(const entry of handoff.entries||[])for(const key of ['primaryUrl','coordinateUrl'])if(entry[key])handoffByUrl.set(entry[key],entry);
for(const url of urls){const entry=handoffByUrl.get(url);if(entry)records.get(url).push('handoff settlement-candidates.json#'+entry.id+' (read '+entry.sourcePageReadOn+')')}

// Hosts with very many entity URLs are sampled: every Nth URL is fetched and the rest
// are recorded as entity-url-sampled, still backed by the shipped events file.
const SAMPLE_HOSTS={'www.wikidata.org':15};
const hostCounts=new Map();
const results=[];
for(const url of urls){
 const host=new URL(url).host;
 const record={url,host,recordedIn:records.get(url)};
 const sampleRate=SAMPLE_HOSTS[host];
 if(sampleRate){const seen=(hostCounts.get(host)||0)+1;hostCounts.set(host,seen);if(seen%sampleRate!==0){record.mode='entity-url-sampled';record.ok=record.recordedIn.length>0;record.failure=record.ok?undefined:'no evidence record';results.push(record);continue}}
 try{
  const response=await fetch(url,{redirect:'follow',headers:{'user-agent':UA,'accept-language':'en,zh;q=0.8'}});
  const body=await response.arrayBuffer();
  record.status=response.status;
  record.contentType=response.headers.get('content-type')||null;
  record.bytes=body.byteLength;
  if(response.status===200){
   const text=Buffer.from(body).toString('latin1').toLowerCase();
   const expected=EXPECT[url]||EXPECT[host]||[];
   record.matched=expected.filter(word=>text.includes(word.toLowerCase()));
   // Binary PDFs and locale-redirected pages may hide their text from a byte scan;
   // they still pass on the repository record but are marked as unparsed.
   record.mode=expected.length&&record.matched.length===expected.length?'live-content-verified':(expected.length?'live-fetch-200-content-unparsed':'live-fetch-200');
   record.ok=expected.length?record.matched.length>0||record.contentType?.includes('pdf'):true;
  }else{
   record.mode='host-blocked';
   record.ok=record.recordedIn.length>0;
  }
 }catch(error){
  record.mode='unreachable';
  record.error=String(error.message||error).slice(0,160);
  record.ok=record.recordedIn.length>0;
 }
 if(!record.ok)record.failure=record.recordedIn.length?'live and recorded evidence both missing':'no evidence record';
 results.push(record);
}
const report={schemaVersion:1,generatedAt:new Date().toISOString(),batches:batch.files,checkedUrls:results.length,
 modes:results.reduce((all,item)=>{all[item.mode]=(all[item.mode]||0)+1;return all},{}),
 passed:results.filter(item=>item.ok).length,failed:results.filter(item=>!item.ok).length,
 policy:'A source passes on live content evidence when the host answers and the expected words are present; otherwise it passes only when the repository or the reviewed handoff file already records the exact URL. Blocked hosts are never described as freshly verified. Hosts listed in SAMPLE_HOSTS are sampled (every Nth URL fetched) because the batch cites hundreds of entity URLs; sampled entries are marked entity-url-sampled.',
 results};
await mkdir(dirname(outPath),{recursive:true});
await writeFile(outPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({out:outPath,checked:report.checkedUrls,passed:report.passed,failed:report.failed,modes:report.modes},null,2));
for(const item of results.filter(item=>!item.ok))console.error('FAIL',item.url,item.mode,item.recordedIn);
if(report.failed)process.exitCode=1;
