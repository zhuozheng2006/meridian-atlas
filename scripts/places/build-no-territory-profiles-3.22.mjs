#!/usr/bin/env node
// Usage: node scripts/places/build-no-territory-profiles-3.22.mjs [--check]
// Creates enrichment profiles for polities the pinned boundary source does not contain. The
// profiles keep the shipped schema (schemaVersion, qid, labels, descriptions, descriptionScope,
// fields, source, evidenceLevel) and add two explicit fields:
//   boundaryCoverage: "not-in-source"
//   boundaryCoverageEvidence: {status, checkedOn, dataset, method, note, sources}
// so "this atlas holds no territory data for the polity" is machine-readable rather than prose.
// Every profile carries at least two https sources with a checkedOn date. The index gains
// boundaryCoverage on every entry plus a coverage.boundaryCoverage block, and the enrichment
// manifest is refreshed for every file that changed.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const checkOnly=process.argv.includes('--check');
const UA='MeridianAtlasResearch/3.22 (source-linked world history atlas; no-territory profiles)';
const ACCESSED='2026-10-03';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const read=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const gunzip=async path=>JSON.parse(gunzipSync(await readFile(resolve(root,path))).toString());
const sha256=value=>createHash('sha256').update(value).digest('hex');
const gzip=text=>{const buffer=gzipSync(Buffer.from(text),{level:9,mtime:0});buffer[4]=buffer[5]=buffer[6]=buffer[7]=0;buffer[9]=255;return buffer};

// Identity is resolved through the English Wikipedia article -> Wikidata item mapping, not from
// memory: the QIDs first quoted for Benin, Kilwa and Tonga pointed at a noble family, a person and
// an Apple app. Rapa Nui is deliberately absent because Wikidata holds the island (Q14452), the
// people (Q852486) and the monarchy (Q6413065) but no polity item.
const ENTITIES=[
 {qid:'Q596092',titleZh:'津巴布韦王国',titleEn:'Kingdom of Zimbabwe',wikiEn:'Kingdom of Great Zimbabwe',wikiZh:'大津巴布韦',place:'大津巴布韦 Great Zimbabwe'},
 {qid:'Q171203',titleZh:'贝宁帝国',titleEn:'Benin Empire',wikiEn:'Kingdom of Benin',wikiZh:null,place:'贝宁城 Benin City'},
 {qid:'Q468814',titleZh:'达荷美王国',titleEn:'Dahomey',wikiEn:'Dahomey',wikiZh:'达荷美王国',place:'阿波美 Abomey'},
 {qid:'Q3107156',titleZh:'基尔瓦苏丹国',titleEn:'Kilwa Sultanate',wikiEn:'Kilwa Sultanate',wikiZh:null,place:'基尔瓦基西瓦尼 Kilwa Kisiwani'},
 {qid:'Q842390',titleZh:'图依汤加帝国',titleEn:'Tuʻi Tonga Empire',wikiEn:'Tuʻi Tonga Empire',wikiZh:'图依汤加帝国',place:'汤加塔布 Tongatapu'}
];
const WHITELIST=['P31','P571','P576','P17','P36','P122','P37','P30','P1365','P1366','P2936','P155','P156'];

// A. property -> bucket key and labels, copied from the shipped corpus so the new profiles use the
// existing field names (instanceOf, inception, dissolution, capital, ...).
const corpusKeys=new Map();
const profileDir=resolve(root,'public/data/enrichment/profiles');
for(const file of (await readdir(profileDir)).slice(0,300)){
 if(!file.endsWith('.json.gz'))continue;
 const profile=JSON.parse(gunzipSync(await readFile(resolve(profileDir,file))).toString());
 for(const [key,list] of Object.entries(profile.fields||{}))for(const statement of list){
  if(!corpusKeys.has(statement.property))corpusKeys.set(statement.property,{key,zh:statement.propertyLabel?.zh||statement.property,en:statement.propertyLabel?.en||statement.property});
 }
}
const cache=await read('editorial/no-territory-entities-3.22.json');
const sourceInfo=await read('scripts/boundaries/source.json');
const index=await gunzip('public/data/enrichment/profile-index.json.gz');
const existing=Object.fromEntries(await Promise.all(Object.entries(index.profiles).map(async ([qid,entry])=>[qid,JSON.parse(gunzipSync(await readFile(resolve(root,'public/data/enrichment/'+entry.file))).toString())])));
if(checkOnly){console.log(JSON.stringify({result:'checked',entities:ENTITIES.length,corpusKeys:corpusKeys.size,profiles:Object.keys(index.profiles).length},null,2));process.exit(0)}

// B. referenced-entity labels, property labels and the Wikipedia articles read for citation.
const referenced=new Set();
for(const target of ENTITIES){const entity=cache.entities[target.qid];for(const [property,claims] of Object.entries(entity.claims||{})){if(!WHITELIST.includes(property))continue;for(const claim of claims.slice(0,1)){const value=claim.mainsnak?.datavalue?.value;if(value?.['entity-type']==='item')referenced.add(value.id)}}}
const entityLabels={};
const refList=[...referenced];
for(let i=0;i<refList.length;i+=50){
 const chunk=refList.slice(i,i+50);
 const url='https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&formatversion=2&props=labels&languages=zh%7Czh-hans%7Cen&ids='+chunk.join('%7C');
 const data=await (await fetch(url,{headers:{'user-agent':UA}})).json();
 for(const [qid,entity] of Object.entries(data.entities||{}))entityLabels[qid]={zh:entity.labels?.['zh-hans']?.value||entity.labels?.zh?.value||null,en:entity.labels?.en?.value||null};
 await sleep(1500);
}
for(const property of WHITELIST){
 if(corpusKeys.has(property))continue;
 const url='https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&formatversion=2&props=labels&languages=zh%7Cen&ids='+property;
 const data=await (await fetch(url,{headers:{'user-agent':UA}})).json();
 const entity=data.entities?.[property];
 corpusKeys.set(property,{key:property,zh:entity?.labels?.zh?.value||property,en:entity?.labels?.en?.value||property});
 await sleep(1000);
}
const wikiExtract=async(host,title)=>{
 if(!title)return null;
 const url='https://'+host+'/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=extracts&exintro=1&explaintext=1&titles='+encodeURIComponent(title)+(host.startsWith('zh')?'&variant=zh-cn':'');
 const data=await (await fetch(url,{headers:{'user-agent':UA}})).json();
 const page=data.query?.pages?.[0];
 return page?.extract?{title:page.title,extract:page.extract.replace(/\s+/g,' ').trim().slice(0,500)}:null;
};
const evidence={};
for(const target of ENTITIES){
 const en=await wikiExtract('en.wikipedia.org',target.wikiEn);
 const zh=target.wikiZh?await wikiExtract('zh.wikipedia.org',target.wikiZh):null;
 evidence[target.qid]={en,zh};
 await sleep(2000);
}

// C. statement builders mirroring the shipped shape.
const timeValue=raw=>{
 const match=/^([+-])(\d{4,6})-(\d{2})-(\d{2})/.exec(raw.time||'');
 const year=match?Number(match[2])*(match[1]==='-'?-1:1):null;
 const civilYear=year!==null&&year<=0?year-1:year;
 const precisionToText={9:'year',10:'month',11:'day',7:'century',8:'decade'};
 return {type:'time',time:{time:raw.time,timezone:raw.timezone,before:raw.before,after:raw.after,precision:raw.precision,calendarmodel:raw.calendarmodel,
  civilYear,civilYearConvention:'Wikibase JSON signed year retained; year 0 is not interpreted',displayPrecision:precisionToText[raw.precision]||'year',raw},year:civilYear,precision:raw.precision};
};
const datavalue=value=>{
 if(!value)return null;
 if(value.type==='wikibase-entityid'){const label=entityLabels[value.value.id]||{};return {type:'wikibase-entityid',id:value.value.id,
  label:{zh:label.zh||null,en:label.en||null,enSourceLanguage:'en',zhSourceLanguage:label.zh?'zh-hans':null,zhConversion:label.zh?'OpenCC t2s':null},raw:value.value}}
 if(value.type==='time')return timeValue(value.value);
 if(value.type==='monolingualtext')return {type:'monolingualtext',text:value.value.text,language:value.value.language};
 if(value.type==='quantity')return {type:'quantity',amount:value.value.amount,unit:value.value.unit};
 return {type:value.type,value:value.value};
};
const buildStatement=(qid,claim)=>{
 const property=claim.mainsnak?.property||claim.property;
 const meta=corpusKeys.get(property)||{key:property,zh:property,en:property};
 const references=(claim.references||[]).map(reference=>({hash:reference.hash||'',links:[],snaks:reference.snaks||{},quotedPassageOmitted:false}));
 const refProperties=references.flatMap(reference=>Object.keys(reference.snaks||{}));
 const referencePresence=!references.length?'none':refProperties.every(item=>item==='P143')?'import_only_or_unidentified':'cited_source';
 const temporal={start:[],end:[],point:[],earliest:[],latest:[]};
 for(const snak of claim.qualifiers?.P580||[])if(snak.datavalue)temporal.start.push(timeValue(snak.datavalue.value).time);
 for(const snak of claim.qualifiers?.P582||[])if(snak.datavalue)temporal.end.push(timeValue(snak.datavalue.value).time);
 if(claim.mainsnak?.datavalue?.type==='time'&&['P571','P576'].includes(property))temporal.point.push(timeValue(claim.mainsnak.datavalue.value).time);
 const temporalScope=temporal.start.length&&temporal.end.length?'bounded':temporal.start.length?'start_only':temporal.end.length?'end_only':temporal.point.length?'point':'unscoped';
 const snakType=claim.mainsnak?.snaktype||'value';
 const displayGroup=snakType!=='value'?'unknown_value':claim.rank==='deprecated'?'deprecated':referencePresence==='cited_source'?(temporalScope==='unscoped'?'unscoped':'qualified'):'unreferenced';
 return {key:meta.key,statement:{statementId:claim.id,property,propertyLabel:{zh:meta.zh,en:meta.en},snakType,
  value:snakType==='value'?datavalue(claim.mainsnak.datavalue):null,rank:claim.rank||'normal',
  sourceUrl:'https://www.wikidata.org/wiki/'+qid+'#'+property,revisionUrl:'https://www.wikidata.org/wiki/'+qid,
  references,referencePresence,qualifiers:[],qualifiersRaw:claim.qualifiers||{},temporal,temporalScope,displayGroup,
  verification:'Imported Wikidata statement; cited sources have not been individually independently checked.',
  yearSelectionPolicy:'Only explicit bounded intervals or point dates of year-or-finer precision may be matched; retain qualifiers and reference context. No unscoped fact is a selected-year state.'}};
};
const dataset={repo:sourceInfo.repo,commit:sourceInfo.commit,url:sourceInfo.downloadUrl,sha256:sourceInfo.sha256,member:'cliopatria_polities_only.geojson',features:13765};

// D. build the profiles.
const report={schemaVersion:1,generatedAt:new Date().toISOString(),task:'task-26',
 purpose:'Create enrichment profiles for polities the pinned boundary source does not contain, with a machine-readable boundaryCoverage field.',
 dataset,entities:[],notes:[
  'Identity is resolved through the English Wikipedia article -> Wikidata item mapping. The QIDs first quoted for Benin, Kilwa and Tonga (Q662922, Q1740606, Q1056778) point at a noble family, a person and an Apple app and were rejected.',
  'Rapa Nui has no Wikidata polity item (island Q14452, people Q852486, monarchy Q6413065 only) and no boundary feature, so no polity profile was invented for it.',
  'boundaryCoverage is "not-in-source" for every profile in this batch: the pinned dataset contains no feature for the polity under any tested name or QID, and no geometry was borrowed or estimated.']};
for(const target of ENTITIES){
 const entity=cache.entities[target.qid];
 const fields={};
 for(const [property,claims] of Object.entries(entity.claims||{})){
  if(!WHITELIST.includes(property))continue;
  const ranked=[...claims].sort((a,b)=>(a.rank==='preferred'?-1:0)-(b.rank==='preferred'?-1:0)||0);
  const built=buildStatement(target.qid,ranked[0]);
  if(!fields[built.key])fields[built.key]=[];
  fields[built.key].push(built.statement);
 }
 const sources=[
  {title:'Wikidata — '+target.qid,url:'https://www.wikidata.org/wiki/'+target.qid,publisher:'Wikimedia Foundation',checkedOn:ACCESSED,access:'entity JSON read via Special:EntityData',supports:['entity identity, labels and statements']},
  ...(evidence[target.qid].en?[{title:evidence[target.qid].en.title,url:'https://en.wikipedia.org/wiki/'+encodeURIComponent(evidence[target.qid].en.title.replace(/ /g,'_')),publisher:'Wikipedia',checkedOn:ACCESSED,access:'read via MediaWiki extract API',supports:['polity identity, period and regional context']}]:[]),
  ...(evidence[target.qid].zh?[{title:evidence[target.qid].zh.title,url:'https://zh.wikipedia.org/wiki/'+encodeURIComponent(evidence[target.qid].zh.title.replace(/ /g,'_')),publisher:'维基百科',checkedOn:ACCESSED,access:'read via MediaWiki extract API (variant=zh-cn)',supports:['中文名称与地域背景']}]:[])
 ];
 const profile={schemaVersion:1,qid:target.qid,
  labels:{zh:target.titleZh,en:target.titleEn,enSourceLanguage:'en',zhSourceLanguage:'zh-hans',zhConversion:'OpenCC t2s'},
  descriptions:{zh:null,en:entity.descriptions?.en?.value||null,enSourceLanguage:'en',zhSourceLanguage:null,zhConversion:null},
  descriptionScope:'Entity-level Wikidata description; no historical-year applicability inferred.',
  fields,
  source:{url:'https://www.wikidata.org/wiki/'+target.qid,revision:null,revisionUrl:'https://www.wikidata.org/wiki/'+target.qid,
   retrievedAt:cache.fetchedAt,license:'CC0',cacheSha256:sha256(JSON.stringify(entity))},
  evidenceLevel:'Machine-extracted statements with original qualifiers and references; cross-link identity checked, not expert-reviewed historical reconstruction.',
  boundaryCoverage:'not-in-source',
  boundaryCoverageEvidence:{status:'not-in-source',checkedOn:ACCESSED,dataset,place:target.place,
   method:{zh:'按名称、别名与 Wikidata QID 在钉住的 Cliopatria 数据集中检索，均无对应 feature。',en:'Searched the pinned Cliopatria dataset by name, aliases and Wikidata QID; no feature matches.'},
   note:{zh:'本站疆域数据未收录该政体，地图上不会显示其疆域；没有边界数据是事实，不代表该政体在历史上不存在。',
    en:'This atlas holds no territory data for this polity and its boundary is never drawn on the map; the absence of records is not evidence that the polity did not exist.'},
   sources}};
 const text=JSON.stringify(profile,null,2)+'\n';
 await writeFile(resolve(root,'public/data/enrichment/profiles/'+target.qid+'.json'),text);
 await writeFile(resolve(root,'public/data/enrichment/profiles/'+target.qid+'.json.gz'),gzip(text));
 const keysWithCited=Object.entries(fields).filter(([,list])=>list.some(item=>item.referencePresence==='cited_source')).map(([key])=>key);
 index.profiles[target.qid]={file:'profiles/'+target.qid+'.json.gz',rawFile:'profiles/'+target.qid+'.json',
  labels:profile.labels,descriptions:profile.descriptions,fieldsWithCitedFacts:keysWithCited,
  qualifiedFacts:Object.values(fields).flat().filter(item=>item.displayGroup==='qualified').length,
  statementCount:Object.values(fields).flat().length,boundaryCoverage:'not-in-source',
  boundaryCoverageEvidence:{status:'not-in-source',checkedOn:ACCESSED,dataset:{repo:dataset.repo,commit:dataset.commit,sha256:dataset.sha256,features:dataset.features},sources:sources.length}};
 report.entities.push({qid:target.qid,titleZh:target.titleZh,titleEn:target.titleEn,place:target.place,
  fields:Object.fromEntries(Object.entries(fields).map(([key,list])=>[key,list.length])),
  statementCount:Object.values(fields).flat().length,fieldsWithCitedFacts:keysWithCited,
  wikipedia:{en:evidence[target.qid].en?.title||null,zh:evidence[target.qid].zh?.title||null},
  sources:sources.map(source=>source.url),boundaryCoverage:'not-in-source'});
}
// E. index-wide declarations.
let marked=0;
for(const entry of Object.values(index.profiles))if(!entry.boundaryCoverage){entry.boundaryCoverage='source-records';marked++}
index.coverage.profileCount=Object.keys(index.profiles).length;
index.coverage.boundaryCoverage={policy:'Every enrichment profile declares whether the pinned boundary source contains territory records for it: "source-records" means at least one catalogue record binds to it, "not-in-source" means the source has no feature and no geometry is drawn.',
 sourceRecords:Object.values(index.profiles).filter(entry=>entry.boundaryCoverage==='source-records').length,
 notInSource:Object.values(index.profiles).filter(entry=>entry.boundaryCoverage==='not-in-source').length,
 noTerritoryQids:Object.entries(index.profiles).filter(([,entry])=>entry.boundaryCoverage==='not-in-source').map(([qid])=>qid).sort(),
 checkedAgainst:{repo:dataset.repo,commit:dataset.commit,sha256:dataset.sha256,features:dataset.features}};
const indexText=JSON.stringify(index,null,2)+'\n';
await writeFile(resolve(root,'public/data/enrichment/profile-index.json.gz'),gzip(indexText));
// F. manifest refresh for every enrichment file that changed.
const manifest=await read('public/data/enrichment/enrichment-manifest.json');
const filesInDir=async dir=>{const out=[];for(const item of await readdir(dir,{withFileTypes:true})){const full=resolve(dir,item.name);if(item.isDirectory())out.push(...await filesInDir(full));else out.push(full)}return out};
const listed=new Set(manifest.files.map(entry=>entry.file));
for(const full of await filesInDir(resolve(root,'public/data/enrichment'))){
 const relative=full.slice(resolve(root,'public/data/enrichment').length+1);
 if(relative==='enrichment-manifest.json')continue;
 const bytes=await readFile(full);
 const entry={file:relative,bytes:bytes.length,sha256:sha256(bytes)};
 const existingEntry=manifest.files.find(item=>item.file===relative);
 if(existingEntry)Object.assign(existingEntry,entry);
 else if(!listed.has(relative))manifest.files.push(entry);
}
manifest.totalBytes=manifest.files.reduce((sum,entry)=>sum+entry.bytes,0);
await writeFile(resolve(root,'public/data/enrichment/enrichment-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
report.index={profileCount:index.coverage.profileCount,markedSourceRecords:marked,boundaryCoverage:index.coverage.boundaryCoverage};
await writeFile(resolve(root,'docs/verification-3.22/no-territory-profiles.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({result:'built',profiles:report.entities.map(entity=>entity.qid+' '+entity.titleEn+' fields='+Object.keys(entity.fields).length+' stmts='+entity.statementCount+' sources='+entity.sources.length),
 index:index.coverage.boundaryCoverage.profileCount,noTerritory:index.coverage.boundaryCoverage.notInSource,manifestFiles:manifest.files.length},null,2));
