import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import * as names from '../public/polity-names.js';
import {polityDisplayData} from '../public/polity-display-names-data.js';
import {AtlasMap} from '../public/map-engine.js';
import {PolityReader,bindingAllowsProfile,narrativeApplies,periodChain} from '../public/polity-reader.js';
import {selectedPolityPlace,prepareTerritory} from '../public/polity-places.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),results=[];
const read=f=>fs.readFileSync(path.join(root,f)),gz=f=>JSON.parse(gunzipSync(read(f))),hash=x=>createHash('sha256').update(x).digest('hex');
const full=gz('public/data/catalog.json.gz'),fast=gz('public/data/fast/catalog.json.gz'),records=fast.records;
const source=JSON.parse(read('editorial/polity-display-names.json')),evidence=JSON.parse(read('public/data/research-evidence/names-3.48/catalog.json'));
const find=id=>records.find(r=>r.id===id);
const check=(name,fn)=>{try{fn();results.push({name,passed:true});console.log('PASS',name);}catch(e){results.push({name,passed:false,error:e.stack});console.error('FAIL',name,e.message);}};
const clone=v=>JSON.parse(JSON.stringify(v));
check('Reviewed rules preserve the 82 original corrections and add 38 British records',()=>{assert.equal(source.rules.length,26);assert.equal(new Set(source.rules.flatMap(r=>r.targets.map(t=>t.id))).size,120);assert.deepEqual(source.rules,polityDisplayData.rules);});
check('All original catalogs, bindings and narratives remain byte-identical to the reviewed baseline',()=>{for(const p of evidence.preservation){assert.equal(read(p.path).length,p.bytes);assert.equal(hash(read(p.path)),p.sha256,p.path);}});
check('Every source excerpt has retrievable archived evidence with exact byte hashes',()=>{
 for(const s of source.sources){const raw=read(s.archive.path);assert.equal(raw.length,s.archive.bytes);assert.equal(hash(raw),s.archive.sha256);const text=JSON.parse(raw),normalized=text.replace(/L\d+(?:@P\d+)?: /g,'').replace(/\s+/g,' ');for(const quote of s.shortExcerpts)assert(normalized.includes(quote),s.id+': '+quote);if(s.originalFile){const pdf=read(s.originalFile.path);assert.equal(hash(pdf),s.originalFile.sha256);assert.equal(pdf.length,s.originalFile.bytes);assert.equal(pdf.subarray(0,4).toString(),'%PDF');assert.deepEqual(s.originalFile.visuallyReadPages,[38]);}}
});
const details=new Map();for(const rule of source.rules)for(const t of rule.targets){const shard=`public/data/fast/records-${String(Math.floor(+t.id.slice(5)/256)).padStart(3,'0')}.json.gz`;if(!details.has(shard))details.set(shard,gz(shard));}
check('All 82 exact id/name/start/end/type guards match full catalog, fast catalog and reader detail',()=>{
 for(const rule of source.rules)for(const t of rule.targets){const detail=details.get(`public/data/fast/records-${String(Math.floor(+t.id.slice(5)/256)).padStart(3,'0')}.json.gz`)[t.id];for(const r of [full.records.find(r=>r.id===t.id),find(t.id),detail]){assert(r,t.id);for(const k of ['id','name','start','end','type'])assert.equal(r[k],t[k],t.id+' '+k);assert.equal(names.polityNameEvidence(r,t.start)?.id,rule.id,t.id);assert.equal(names.polityName(r,'zh',t.end),rule.display.zh);assert.equal(names.polityName(r,'en',t.start),rule.display.en);}}
});
check('No guard accepts a changed record identity, type, source name or source dates',()=>{
 for(const rule of source.rules)for(const t of rule.targets){const r=find(t.id);for(const change of [{id:r.id+'x'},{name:r.name+' '},{start:r.start-1},{end:r.end+1},{type:'RELATION'}])assert.equal(names.polityNameEvidence({...r,...change},r.start),null);for(const y of [undefined,null,0,NaN,Infinity,String(r.start),r.start-.5,r.start-1,r.end+1]){assert.equal(names.polityNameEvidence(r,y),null);assert.equal(names.polityName(r,'zh',y),r.name);}}
});
check('1945 France and 1946 constitutional transition are distinguished from valid later Fourth Republic records',()=>{
 assert.equal(names.polityName(find('clio-12933'),'zh',1945),'法国（临时政府）');assert.equal(names.polityName(find('clio-12941'),'en',1945),'France and overseas territories');assert.equal(names.polityName(find('clio-12967'),'en',1946),'France');assert.equal(names.polityName(find('clio-12957'),'zh',1946),'法国及海外属地');
 for(const r of records.filter(r=>r.name==='French Fourth Republic'&&r.start>=1947)){assert.equal(names.polityNameEvidence(r,r.start),null);assert.equal(names.polityName(r,'en',r.start),r.name);}
});
check('1814 transition, post-union Denmark, 1940 Faroe and 11th-century literal name remain distinct',()=>{
 for(const [id,year,en] of [['clio-10918',1814,'Denmark–Norway / Denmark'],['clio-11893',1900,'Denmark'],['clio-12819',1940,'Faroe Islands'],['clio-04410',1046,'Norway–Denmark']])assert.equal(names.polityName(find(id),'en',year),en);
 for(const r of records.filter(r=>r.name==='Denmark-Norway'&&r.end<1814))assert.equal(names.polityNameEvidence(r,r.start),null);
});
check('British Africa remains a geographic aggregate and distinct member polities retain their names',()=>{
 assert.equal(names.polityName(find('clio-12180'),'zh',1900),'英属非洲诸领地');assert.equal(names.polityName(find('clio-12180'),'en',1900),'British territories in Africa');assert.equal(names.polityName(find('clio-00791'),'zh',-206),'常山');assert.equal(names.polityName(find('clio-00780'),'zh',-206),'韩');
 for(const n of ['Eastern Göktürks','Western Göktürks']){const r=records.find(r=>r.name===n&&r.start<=620&&r.end>=620);assert.equal(names.polityName(r,'zh',620),n.startsWith('Eastern')?'东突厥':'西突厥');}
});
check('Faroe 1940 original geometry stays within the named archipelago and is never rewritten',()=>{
 const index=gz('public/data/native/index.json.gz'),id=index.recordIndex['clio-12819'],file='public/data/native/'+index.geometryIndex[id],before=hash(read(file)),geometry=gz(file)[id];let count=0;
 const walk=x=>{if(typeof x[0]==='number'){assert(x[0]>=-8&&x[0]<=-6&&x[1]>=61&&x[1]<=63);count++;}else for(const a of x)walk(a);};walk(geometry.coordinates);assert(count>10);assert.equal(hash(read(file)),before);
});
check('All unaffected records preserve their prior translated and English names at a real year',()=>{
 const targets=new Set(source.rules.flatMap(r=>r.targets.map(t=>t.id)));for(const r of records){if(targets.has(r.id)||r.start===0)continue;assert.equal(names.polityName(r,'zh',r.start),r.zhName||r.name);assert.equal(names.polityName(r,'en',r.start),r.name);}
 assert.equal(names.polityName({id:'cshape:1',name:'Example',zhName:'例子'},'zh',1945),'例子');
});
check('Search and all-period library separate corrected periods without mutating source records',()=>{
 const before=hash(JSON.stringify(records)),search=names.searchPolityRecords(records,'丹麦',1900);assert(search.some(x=>x.year===1900&&names.polityName(x.record,'en',x.year)==='Denmark'));
 assert(!names.searchPolityRecords(records,'瓜分非洲',1900).some(x=>x.record.name==='British Africa'));
 const france=names.searchPolityRecords(records,'法国',1945);assert(france.some(x=>x.record.id==='clio-12933'&&x.year===1945));assert(france.some(x=>x.record.start>1945&&x.year===x.record.start));
 const groups=names.groupPolityRecords(records,1900),denmark=groups.filter(r=>r.name==='Denmark-Norway');assert.equal(denmark.length,4);assert(denmark.some(r=>r.min>=1815&&r.max===1939));assert.equal(names.representativePolityRecord(records,find('clio-10988'),1526).start,1815);
 for(const r of groups)assert(r.start<=r.labelYear&&r.labelYear<=r.end&&r.labelYear!==0);
 assert.equal(hash(JSON.stringify(records)),before);
});
check('Corrected topic/entity records cannot acquire encyclopedia profiles, editorial facts or asserted capitals',()=>{
 const square=prepareTerritory({type:'Polygon',coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]]]});
 for(const rule of source.rules)for(const t of rule.targets){const r=find(t.id),binding={qid:r.verifiedWikidata,safeToApplyYearFacts:true},editorial={sourceNames:[r.name],qid:r.verifiedWikidata,scope:{start:r.start,end:r.end},recordIdsOverlappingScope:[r.id]},place={kind:'dated-capital',polityQid:r.verifiedWikidata,coordinates:[1,1],periods:[[r.start,r.end]]};assert.equal(bindingAllowsProfile(binding,r,r.start),false);assert.equal(narrativeApplies(editorial,r,r.start),false);assert.equal(selectedPolityPlace(place,{...r,capitalBindingVerified:true},r.start,square),null);}
});
function makeReader(record,year,lang='bi'){
 const reader=Object.create(PolityReader.prototype);Object.assign(reader,{record,detail:record,whichMap:{year},context:{language:()=>lang,catalog:()=>full,events:()=>[],share(){},download(){}},chain:periodChain(records,record),tab:'overview',loading:false,profile:null,editorial:null,placeData:null});return reader;
}
check('Real reader overview, Sources and export preserve the original record while showing the reviewed name',()=>{
 const r=find('clio-12933'),before=clone(r),reader=makeReader(r,1945,'en');assert(reader.overview().includes('France (Provisional Government)'));const html=reader.sources();assert(html.includes('French Fourth Republic'));assert(html.includes('clio-12933'));assert(html.includes('elysee.fr'));assert(html.includes('assemblee-nationale.fr'));assert(html.includes('Names and dates'));assert.deepEqual(r,before);
});
check('Real reader title and downloadable display envelope agree in all language modes',()=>{
 for(const lang of ['zh','en','bi']){
  const r=find('clio-12933'),reader=makeReader(r,1945,lang),nodes=new Map();
  const node=()=>({scrollTop:0,scrollLeft:0,tabIndex:0,setAttribute(){},addEventListener(type,fn){this.listener=fn;},querySelector(){return null;},querySelectorAll(){return [];},focus(){}});
  for(const selector of ['.detail-close','.reader-content','.reader-tabs','#polityShare','#polityFullExport'])nodes.set(selector,node());
  const panel={innerHTML:'',contains:()=>false,querySelector:s=>nodes.get(s)||null,querySelectorAll:()=>[]};globalThis.document={activeElement:null,querySelector:()=>panel};let exported;reader.context.download=d=>exported=d;reader.render();
  const heading=panel.innerHTML.match(/<h2 id="readerTitle"[^>]*>([\s\S]*?)<\/h2>/)?.[1];assert(heading);assert(!heading.includes('Fourth'));assert(heading.includes(lang==='en'?'France (Provisional Government)':'法国（临时政府）'));if(lang==='bi')assert(heading.includes('France (Provisional Government)'));
  nodes.get('#polityFullExport').listener();assert.equal(exported.record,r);assert.equal(exported.record.name,'French Fourth Republic');assert.equal(exported.display.year,1945);assert.equal(exported.display.nameEn,'France (Provisional Government)');assert.equal(exported.display.evidence.id,'france-provisional-1945');
 }
 delete globalThis.document;
});
check('Real map label layout uses reviewed names in both lines at the displayed year',()=>{
 globalThis.document={querySelectorAll:()=>[],createElement:tag=>tag==='canvas'?{getContext:()=>({measureText:v=>({width:v.length*5})})}:{children:[],append(el){this.children.push(el);}}};globalThis.maplibregl={Marker:class{constructor(o){this.element=o.element;}setLngLat(){return this;}addTo(){return this;}remove(){}}};
 for(const [id,year,zh,en] of [['clio-12933',1945,'法国（临时政府）','France (Provisional Government)'],['clio-12180',1900,'英属非洲诸领地','British territories in Africa'],['clio-11893',1900,'丹麦','Denmark']]){
  const map={getBounds:()=>({contains:()=>true}),getZoom:()=>3,getContainer:()=>({getBoundingClientRect:()=>({left:0,top:0,right:800,bottom:600})}),getProjection:()=>({type:'mercator'}),project:()=>({x:400,y:300})},atlas={labels:[],labelBoxes:[],active:[find(id)],map,year,lang:'bi',showLabels:true,showBorders:true};AtlasMap.prototype.refreshLabels.call(atlas);assert.equal(atlas.labels.length,1);assert.equal(atlas.labels[0].element.textContent,zh);assert.equal(atlas.labels[0].element.children[0].textContent,en);
 }
 delete globalThis.document;delete globalThis.maplibregl;
});
check('Corrected reader events reject later-regime aliases and events outside the actual source record period',()=>{
 const reader=makeReader(find('clio-12933'),1945),event=(id,start,title)=>({id,start,end:start,title:{zh:title,en:title},summary:{zh:'',en:''}});
 reader.context.events=()=>[event('wrong-entity',1945,'French Fourth Republic'),event('future',1946,'France (Provisional Government)'),event('selected',1945,'法国（临时政府）')];assert.deepEqual(reader.relatedEvents().map(e=>e.id),['selected']);assert(reader.chain.every(r=>r.start===1945));
});
check('Actual app event-search rendering uses explicit result years and corrected bilingual labels',()=>{
 const app=read('public/app.js').toString(),fragment=app.slice(app.indexOf('function renderEvents(){'),app.indexOf('function mapError('));assert(fragment.includes('searchPolityRecords'));
 // Keep the real final event-status functions; only DOM/network inputs are injected.
 const helperStart=app.indexOf('function eventLoadMessage()'),helperEnd=app.indexOf('function renderDatasetStatus()');assert(helperStart>=0&&helperEnd>helperStart);
 const statusHelpers=app.slice(helperStart,helperEnd);for(const name of ['eventLoadMessage','eventCountText','eventStatusHTML','bindEventRetries'])assert(statusHelpers.includes('function '+name+'('));
 for(const eventsStatus of ['ready','loading','error']){
  let retryCalls=0;const elements=new Map(),element=s=>{if(!elements.has(s))elements.set(s,{innerHTML:'',retryButton:{},addEventListener(){},querySelectorAll(selector){return selector==='[data-retry-events]'&&this.innerHTML.includes('data-retry-events')?[this.retryButton]:[];}});return elements.get(s);};
  const state={year:1900,lang:'bi',search:'British Africa',allTime:false},context={...names,catalog:fast,state,events:[],eventsStatus,ensureEventsData:async()=>{retryCalls++;},renderPlaceSearch(){},searchPlaces:async()=>[],loadBattles:async()=>[],filteredEvents:()=>[],$:element,$$:()=>[],text:(zh)=>zh,escape:String,yr:y=>String(y),atlas:null,compareMap:null,openEvent(){},COLORS:{}};
  vm.runInNewContext(statusHelpers+fragment+';renderEvents();',context);const host=element('#eventList'),html=host.innerHTML;assert(html.includes('英属非洲诸领地'));assert(html.includes('British territories in Africa · 1900'));assert(!html.includes('瓜分非洲'));
  assert.equal(element('#resultCount').textContent,eventsStatus==='ready'?'0 条事件':eventsStatus==='error'?'事件资料暂未载入':'正在加载事件…');
  if(eventsStatus==='error'){assert(html.includes('data-retry-events'));assert.equal(typeof host.retryButton.onclick,'function');host.retryButton.onclick();assert.equal(retryCalls,1);}
  else{assert(!html.includes('data-retry-events'));assert.equal(retryCalls,0);if(eventsStatus==='loading')assert(html.includes('正在加载事件…'));}
 }
});
const report={ok:results.every(r=>r.passed),checks:results.length,passed:results.filter(r=>r.passed).length,targetRecords:120,method:'Original source byte hashes, full/fast/detail records, actual map labels, reader rendering/export/event filter and actual app search with injected DOM/data boundaries; no browser performance claims.',results};
const reportPath=process.env.POLITY_NAMES_REPORT||path.join(root,'docs/verification-3.49/polity-display-names.json');fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,passed:report.passed,checks:report.checks,report:reportPath}));if(!report.ok)process.exitCode=1;
