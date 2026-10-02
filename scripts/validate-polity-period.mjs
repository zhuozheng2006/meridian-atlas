import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url);
const {PolityReader,periodChain}=await import(new URL('public/polity-reader.js',root));
const {classifyStatement,recordGaps}=await import(new URL('public/fact-period.js',root));
const read=async file=>JSON.parse(gunzipSync(await readFile(new URL('public/data/'+file,root))));
const catalog=await read('fast/catalog.json.gz'),index=await read('enrichment/profile-index.json.gz');
const results=[];
function check(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.message});}}
const hash=value=>createHash('sha256').update(value).digest('hex');
const main=html=>html.replace(/<details\b[\s\S]*?<\/details>/g,'');
const keys=['capital','government','inception','dissolution','headsOfState','headsOfGovernment','predecessors','successors','officialLanguages','spokenLanguages','religion','currencies','continent'];
const records=[];
for(const name of ['Duchy of Bavaria','Swiss Confederation','Duchy of Lorraine']){
 const record=catalog.records.find(r=>r.name===name&&r.type==='POLITY'&&r.start<=1500&&r.end>=1500);
 const detail=(await read(`fast/records-${String(Math.floor(+record.id.slice(5)/256)).padStart(3,'0')}.json.gz`))[record.id];
 const profile=await read('enrichment/'+index.profiles[record.verifiedWikidata].file);
 const before=hash(JSON.stringify({record,detail,profile}));
 const reader=Object.create(PolityReader.prototype);
 Object.assign(reader,{record,detail,profile,chain:periodChain(catalog.records,record),whichMap:{year:1500},context:{language:()=> 'bi'},loading:false});
 const html={overview:reader.overview(),politics:reader.politics(),culture:reader.culture(),territory:reader.territory()};
 const mainHTML=main(html.overview+html.politics+html.culture);
 const primary=[],supplemental=[];
 for(const field of keys)for(const s of profile.fields[field]||[]){
  if(s.snakType!=='value'||s.rank==='deprecated'||!(s.value?.type==='time'||s.value?.label?.zh||s.value?.label?.en||s.value?.type==='string'))continue;
  if(['qualified','unscoped','dated_entity_fact'].includes(s.displayGroup))primary.push({field,s});
  else if(s.displayGroup==='unreferenced')supplemental.push({field,s});
 }
 const count=html=>[...html.matchAll(/class="source-ref"/g)].length;
 check(name+': all renderable primary statements survive grouping',()=>assert.equal(count(reader.currentFacts(keys)+reader.archiveFacts(keys)),primary.length));
 check(name+': supplemental statements remain in their own foldout',()=>assert.equal(count(reader.supplement(keys)),supplemental.length));
 check(name+': only selected statements are emphasized',()=>assert.equal(count(reader.currentFacts(keys)),primary.filter(({field,s})=>classifyStatement(s,1500,field)==='selected').length));
 check(name+': source record/profile remain byte-equivalent JSON',()=>assert.equal(hash(JSON.stringify({record,detail,profile})),before));
 check(name+': territory buttons show complete source intervals',()=>assert(html.territory.includes(`data-chain="${record.id}" class="active">${reader.year(record.start)} — ${reader.year(record.end)}`)));
 check(name+': English-only fallback appears once',()=>assert.equal(reader.bi({zh:null,en:'one English sentence'}),'one English sentence'));
 if(name==='Swiss Confederation'){
  check('Swiss 1500: no modern institutional facts in main prose',()=>{for(const token of ['Bern','伯尔尼','Swiss franc','瑞士法郎','Swiss Federal Council','联邦委员会','Official languages'])assert(!mainHTML.includes(token),token);assert(!mainHTML.includes('data-fact-period="selected"'));});
  check('Swiss 1500: Bern retained under other dates with 1848 start',()=>{const other=reader.factRows(['capital'],false,'other');assert(other.includes('Bern'));assert(other.includes('1848'));assert(!reader.factRows(['capital'],false,'selected'));});
  check('Swiss 1500: unscoped currency and council retained as context',()=>{assert(reader.factRows(['currencies'],false,'context').includes('Swiss franc'));assert(reader.factRows(['headsOfGovernment'],false,'context').includes('Swiss Federal Council'));});
  check('Swiss 1900: start-only Bern remains unproven for continued tenure',()=>{reader.whichMap={year:1900};assert(!reader.currentFacts(['capital']));assert(reader.factRows(['capital'],false,'context').includes('Bern'));reader.whichMap={year:1500};});
  check('Swiss: actual missing source years remain visible',()=>assert.deepEqual(recordGaps(reader.chain),[[1799,1814]]));
 }
 records.push({id:record.id,name,interval:[record.start,record.end],primaryCount:primary.length,supplementalCount:supplemental.length,selectedCount:primary.filter(({field,s})=>classifyStatement(s,1500,field)==='selected').length,sourceHash:before,mainHTML,html});
}
check('Archive gaps: civil BCE/CE adjacency creates no year-zero gap',()=>assert.deepEqual(recordGaps([{start:-5,end:-1},{start:1,end:4}]),[]));
check('Archive gaps: nested records do not invent omissions',()=>assert.deepEqual(recordGaps([{start:10,end:20},{start:12,end:14},{start:25,end:30}]),[[21,24]]));
check('Archive gaps: invalid and zero-year records do not override valid bounds',()=>assert.deepEqual(recordGaps([{start:0,end:4},{start:10,end:2},{start:1,end:4},{start:7,end:10}]),[[5,6]]));
const slovenia=await read('enrichment/'+index.profiles.Q215.file);
check('Real circa-700 Slovenia inception does not become an exact event',()=>{
 const s=slovenia.fields.inception.find(s=>s.statementId==='Q215$882efaff-43c0-c122-751c-cd0fb9fb9224');assert(s);assert.equal(classifyStatement(s,700,'inception'),'context');
 const reader=Object.create(PolityReader.prototype);reader.context={language:()=> 'zh'};assert(reader.qualifierNotes(s).includes('大约'));
});
const uncertain=await read('enrichment/'+index.profiles.Q1446192.file);
check('Real dissolution retains its earliest and latest date qualifications',()=>{
 const s=uncertain.fields.dissolution.find(s=>s.temporal.earliest?.length&&s.temporal.latest?.length);assert(s);
 const reader=Object.create(PolityReader.prototype);reader.context={language:()=> 'zh'};const scope=reader.scopeText(s);assert(scope.includes('不早于'));assert(scope.includes('1327'));assert(scope.includes('不晚于'));assert(scope.includes('1328'));
});
const {narrativeApplies}=await import(new URL('public/polity-reader.js',root));
const narratives=JSON.parse(await readFile(new URL('public/data/enrichment/narratives.json',root)));
check('Three new 1500 dossiers require exact identity, record and reviewed year',()=>{
 const entries=narratives.entries.filter(e=>e.id.startsWith('snapshot-'));assert.equal(entries.length,3);
 for(const e of entries){const r=catalog.records.find(r=>e.recordIdsOverlappingScope.includes(r.id));assert(narrativeApplies(e,r,1500));assert(!narrativeApplies(e,r,1499));assert(!narrativeApplies(e,r,1501));assert(!narrativeApplies(e,{...r,id:'unbound'},1500));assert(!narrativeApplies(e,{...r,verifiedWikidata:'Q0'},1500));}
});
const {boundaryNote}=await import(new URL('public/boundary-notes.js',root));
check('Lorraine source notes bind only to the reviewed relation and dates',()=>{
 const p={osm_id:-2815329,start_date:'1480',end_date:'1661-02-28'};assert(boundaryNote(p));for(const changed of [{osm_id:2815329},{start_date:'1473'},{end_date:'1661'}])assert.equal(boundaryNote({...p,...changed}),null);
});
const report={passed:results.filter(x=>x.passed).length,total:results.length,modules:{factPeriod:hash(await readFile(new URL('public/fact-period.js',root))),polityReader:hash(await readFile(new URL('public/polity-reader.js',root)))},results,records};
await writeFile(new URL('../docs/real-fact-period-validation.json',import.meta.url),JSON.stringify({...report,records:records.map(({html,mainHTML,...r})=>r)},null,2)+'\n');
console.log(`PASS ${report.passed}/${report.total} real polity dossier regressions`);
for(const failure of results.filter(r=>!r.passed))console.error(failure);
if(report.passed!==report.total)process.exitCode=1;
