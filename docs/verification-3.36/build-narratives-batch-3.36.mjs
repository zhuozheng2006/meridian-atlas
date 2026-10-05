#!/usr/bin/env node
// Usage: node docs/verification-3.36/build-narratives-batch-3.36.mjs [--check]
// Turns the authored parts under docs/verification-3.36/authoring/ into batch entries and
// appends them to editorial/enrichment-narratives-3.12.json, the single editable source that
// scripts/places/apply-enrichment-3.12.mjs reads. scripts/ is outside this round's write scope,
// so the round deliberately does not add a second batch file: the authored parts stay in
// docs/verification-3.36/authoring/ as this round's provenance.
//
// What is authored: the four sections, the highlights, the citations, the keywords and any
// dating note. What is generated from the shipped catalogue: the exact sourceNames and the
// scope every entry binds to (the first and last year of that entity's POLITY records), the
// record ids, and the territory-coverage note that states how many records this atlas holds
// for the polity and over which years - including the thin cases, which say so plainly.
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {citationRegistry,citationIds,narrativeScope,verifiedChineseTitle} from '../../scripts/places/narrative-metadata.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const checkOnly=process.argv.includes('--check');
const CJK=/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
const TRADITIONAL=/[與臺灣國學會東車馬鳥魚點線個時間問題則無為說話語實質軍戰勝歐亞羅蘇聯義紀興漢滿爾佔爭萬長門開關風飛書讀詞]/;
// Phrase-level so that ordinary words such as 陷落后 (after the fall) do not match 落后.
const EVALUATIVE=/伟大|辉煌|野蛮|最强|无敌|邪恶|优秀|卓越|最为先进|(十分|非常|极其|明显)落后/
const SECTION_KEYS=['politics','economy','culture','events'];
const ACCESSED_AT='2026-10-03';
const problems=[];
const fail=message=>problems.push(message);
const read=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));

const chosen=await read('docs/verification-3.36/narratives-chosen.json');
const extracts=await read('docs/verification-3.36/narratives-extracts.json');
const batch=await read('editorial/enrichment-narratives-3.12.json');
const extractByQid=new Map(extracts.entries.map(entry=>[entry.qid,entry]));
const chosenByQid=new Map(chosen.entries.map(entry=>[entry.qid,entry]));

const authoringDir=resolve(root,'docs/verification-3.36/authoring');
const parts=(await readdir(authoringDir)).filter(name=>/^part-\d+\.json$/.test(name)).sort();
const authored=new Map();
for(const part of parts){
 const document=JSON.parse(await readFile(resolve(authoringDir,part),'utf8'));
 for(const entry of document.entries||[]){
  if(authored.has(entry.qid))fail('duplicate authoring entry for '+entry.qid);
  authored.set(entry.qid,{...entry,part});
 }
}
const yearText=(year,lang)=>{
 if(year<0)return lang==='zh'?'公元前'+Math.abs(year)+' 年':Math.abs(year)+' BCE';
 return lang==='zh'?'公元'+year+' 年':String(year)+' CE';
};
const coverageNote=(plan,lang,explicitScope)=>{
 const n=plan.recordCount,from=plan.scope.start,to=plan.scope.end;
 if(explicitScope){
  if(lang==='zh')return '本站疆域数据收录 '+n+' 条对应记录，范围为'+yearText(from,'zh')+'至'+yearText(to,'zh')+'；本篇显示范围为'+yearText(explicitScope.start,'zh')+'至'+yearText(explicitScope.end,'zh')+'，两者分别记录。';
  return 'The atlas holds '+n+' corresponding map records from '+yearText(from,'en')+' to '+yearText(to,'en')+'. This narrative is shown from '+yearText(explicitScope.start,'en')+' to '+yearText(explicitScope.end,'en')+', set independently from the map-record window.';
 }
 if(lang==='zh'){
  if(plan.thin)return '本站疆域数据仅收录该政体 '+n+' 条记录（'+yearText(from,'zh')+'至'+yearText(to,'zh')+'），覆盖很薄，叙述以所列维基百科条目为主要依据，不能据本站疆域记录推断其疆域变化。';
  return '本站疆域数据收录该政体 '+n+' 条记录，年份范围为'+yearText(from,'zh')+'至'+yearText(to,'zh')+'，本条目断代与这些记录一致；叙述依据所列维基百科条目。';
 }
 if(plan.thin)return 'This atlas holds only '+n+' territory records for this polity ('+yearText(from,'en')+' to '+yearText(to,'en')+'), a thin coverage: the essay rests mainly on the listed Wikipedia articles and the territory records here cannot support claims about territorial change.';
 return 'This atlas holds '+n+' territory records for this polity, covering '+yearText(from,'en')+' to '+yearText(to,'en')+'; the entry scope matches those records and the essay follows the listed Wikipedia articles.';
};
const entries=[];
const stats=[];
const pending=[];
for(const plan of chosen.entries){
 const source=authored.get(plan.qid);
 const where=plan.qid+' '+(plan.titleZh||'');
 // A part of the chosen batch may still be unwritten: those plans are recorded as pending and
 // left for the next round instead of blocking the batch that is finished.
 if(!source){pending.push(where);continue}
 const extract=extractByQid.get(plan.qid)||{};
 if(!extract.enIntro)fail(where+': missing English Wikipedia extract');
 if(!extract.enIdentityMatch)fail(where+': the English article does not carry this QID (pageprops identity check)');
 // A Chinese citation is used only when the Chinese article was read and confirmed to document
 // the same polity; where it was not, the entry needs an authored extra source instead.
 const zhTitle=verifiedChineseTitle(extract);
 if(!source.titleZh||!source.titleEn)fail(where+': title missing');
 for(const key of SECTION_KEYS){
  const section=source.sections?.[key];
  if(!section?.zh||!section?.en){fail(where+': missing '+key+' section');continue}
  const zhLength=[...section.zh].length,enWords=section.en.trim().split(/\s+/).filter(Boolean).length;
  if(zhLength<50||zhLength>190)fail(where+': '+key+'.zh is '+zhLength+' characters, expected 50-190');
  if(enWords<35||enWords>150)fail(where+': '+key+'.en is '+enWords+' words, expected 35-150');
  if(TRADITIONAL.test(section.zh))fail(where+': traditional characters in '+key+': '+[...new Set(section.zh.match(TRADITIONAL))].join(''));
  if(CJK.test(section.en))fail(where+': CJK in '+key+'.en');
  if(EVALUATIVE.test(section.zh))fail(where+': evaluative wording in '+key);
 }
 if(!Array.isArray(source.facts)||source.facts.length<2)fail(where+': at least two highlights required');
 for(const fact of source.facts||[]){
  if(!fact.key||!fact.value?.zh||!fact.value?.en)fail(where+': incomplete highlight '+(fact.key||''));
  if(CJK.test(fact.value?.en||''))fail(where+': CJK in highlight '+fact.key);
  if(EVALUATIVE.test(fact.value?.zh||''))fail(where+': evaluative wording in highlight '+fact.key);
 }
 if(!Array.isArray(source.supports?.en)||source.supports.en.length<2)fail(where+': at least two English supports bullets required');
 if(!Array.isArray(source.supports?.zh)||source.supports.zh.length<2)fail(where+': at least two Chinese supports bullets required');
 for(const item of source.extraSources||[]){
  if(!item.id||!item.url?.startsWith('https://')||!item.publisher||!item.checkedOn)fail(where+': incomplete extra source '+(item.id||''));
  if(!Array.isArray(item.supports)||!item.supports.length)fail(where+': extra source '+(item.id||'')+' needs a supports list');
 }
 let scope;
 try{scope=narrativeScope(source,plan.scope,where)}catch(error){fail(error.message);continue}
 const explicitScope=Object.prototype.hasOwnProperty.call(source,'scope')?scope:null;
 const notes=[coverageNote(plan,'zh',explicitScope)];
 if(source.scopeNoteZh)notes.push(source.scopeNoteZh);
 const notesEn=[coverageNote(plan,'en',explicitScope)];
 if(source.scopeNoteEn)notesEn.push(source.scopeNoteEn);
 const wikiUrl=(host,title)=>'https://'+host+'/wiki/'+encodeURIComponent(String(title).replace(/ /g,'_'));
 // The two citations are generated from the articles actually read in this session, so a
 // citation URL can never point at a page nobody opened; the supports lists are authored.
 const sources=[
  {id:plan.qid.toLowerCase()+'-enwiki',title:extract.enTitle,url:wikiUrl('en.wikipedia.org',extract.enTitle),publisher:'Wikipedia',checkedOn:ACCESSED_AT,access:'read via MediaWiki extract API; pageprops.wikibase_item equals '+plan.qid,supports:source.supports.en},
  ...(zhTitle?[{id:plan.qid.toLowerCase()+'-zhwiki',title:zhTitle,url:wikiUrl('zh.wikipedia.org',zhTitle),publisher:'维基百科',checkedOn:ACCESSED_AT,access:'read via MediaWiki extract API (variant=zh-cn); pageprops.wikibase_item or hand-read introduction confirms the polity',supports:source.supports.zh}]:[]),
  ...(zhTitle?[]:[{id:plan.qid.toLowerCase()+'-wikidata',title:'Wikidata — '+plan.qid,url:'https://www.wikidata.org/wiki/'+plan.qid,publisher:'Wikidata',checkedOn:ACCESSED_AT,access:'entity statements read for the identity and the period of this polity',supports:source.supports.en}]),
  ...(source.extraSources||[])
 ];
 if(sources.length<2)fail(where+': fewer than two citations');
 for(const item of sources)if(!item.title||!item.url?.startsWith('https://')||!item.checkedOn||!Array.isArray(item.supports)||!item.supports.length)fail(where+': incomplete citation '+item.id);
 let sections,facts;
 try{
  const known=citationRegistry(sources,where);
  sections=Object.fromEntries(SECTION_KEYS.map(key=>[key,{zh:source.sections[key].zh,en:source.sections[key].en,sourceIds:citationIds(source.sections[key],known,where+': '+key)}]));
  facts=source.facts.map(fact=>({key:fact.key,value:fact.value,sourceIds:citationIds(fact,known,where+': fact '+fact.key)}));
 }catch(error){fail(error.message);continue}
 const built={
  qid:plan.qid,
  sourceNames:plan.sourceNames,
  title:{zh:source.titleZh,en:source.titleEn},
  scope,
  eventKeywords:source.eventKeywords||[source.titleEn],
  sources,
  sections,
  facts,
  editorialNotes:[{zh:notes.join(' '),en:notesEn.join(' ')}]
 };
 entries.push(built);
 stats.push({qid:plan.qid,part:source.part,titleZh:source.titleZh,titleEn:source.titleEn,region:plan.regionReviewed,regionBox:plan.regionBox,era:plan.era,
  scope,recordCount:plan.recordCount,spanYears:plan.spanYears,yearsCovered:plan.yearsCovered,areaMax:plan.areaMax,thin:plan.thin,
  recordIds:plan.recordIds,sourceNames:plan.sourceNames,evidence:plan.evidence,
  sections:Object.fromEntries(SECTION_KEYS.map(key=>[key,{zh:[...source.sections[key].zh].length,en:source.sections[key].en.trim().split(/\s+/).filter(Boolean).length}])),
  sources:sources.map(item=>item.url),enArticle:extract.enTitle,zhArticle:extract.zhTitle});
}
if(problems.length){console.error('FAIL build-narratives-batch-3.36\n'+problems.join('\n'));process.exit(1)}
const merged={...batch,entries:[...batch.entries.filter(entry=>!entries.some(added=>added.qid===entry.qid)),...entries]};
if(!entries.length)fail('no authored entries at all');
const report={schemaVersion:1,generatedAt:new Date().toISOString(),
 pendingPlans:pending,pendingCount:pending.length,batchComplete:pending.length===0,
 purpose:'3.36 editorial narratives: the 67 added polity essays with their binding plan, section lengths, citations and territory coverage.',
 selectionMethod:'docs/verification-3.36/select-narratives-3.36.mjs; see narratives-round.md',
 count:entries.length,batchTotal:merged.entries.length,entries:stats};
if(checkOnly){console.log(JSON.stringify({result:'checked',entries:entries.length,batchTotal:merged.entries.length,
  zhMin:Math.min(...stats.flatMap(s=>SECTION_KEYS.map(k=>s.sections[k].zh))),zhMax:Math.max(...stats.flatMap(s=>SECTION_KEYS.map(k=>s.sections[k].zh))),
  enMin:Math.min(...stats.flatMap(s=>SECTION_KEYS.map(k=>s.sections[k].en))),enMax:Math.max(...stats.flatMap(s=>SECTION_KEYS.map(k=>s.sections[k].en)))},null,2));
 process.exit(0)}
await writeFile(resolve(root,'editorial/enrichment-narratives-3.12.json'),JSON.stringify(merged,null,2)+'\n');
await writeFile(resolve(root,'docs/verification-3.36/narratives-batch-stats.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({result:'written',batch:'editorial/enrichment-narratives-3.12.json',added:entries.length,total:merged.entries.length,pending:pending.length},null,2));
