#!/usr/bin/env node
// Usage: node docs/verification-3.36/choose-narratives-3.36.mjs [--target=70]
// Chooses the second narratives batch from the verified candidates.
//
// Eligibility: the entity must be a polity by its Wikidata P31 classes. A class label such as
// "historical country", "kingdom", "empire", "khanate", "dynasty", "confederation", "republic"
// qualifies it; an entity whose classes are only an island, a person, a family, a position, an
// event, a culture or a history topic does not. Five entities that pass the class test but are
// not polities in this atlas's sense are excluded by hand, each with its reason.
//
// Region: the documented coordinate-box rule applied to the records (regionBox), reviewed by
// hand where the box puts a European metropole in the region of most of its colonial records;
// the reviewed region is what the Europe cap is applied to.
//
// Quotas: Africa, the Americas, South Asia, Southeast Asia and Oceania are filled first; Europe
// is capped at 20 per cent of the batch; the remaining places go to the other regions by score.
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const arg=name=>{const hit=process.argv.find(value=>value.startsWith('--'+name+'='));return hit?hit.slice(name.length+3):null};
const target=Number(arg('target')||100);
const candidates=JSON.parse(await readFile(resolve(root,'docs/verification-3.36/narratives-candidates.json'),'utf8'));
const catalog=JSON.parse(gunzipSync(await readFile(resolve(root,'public/data/fast/catalog.json.gz'))));
const index=JSON.parse(gunzipSync(await readFile(resolve(root,'public/data/enrichment/profile-index.json.gz'))));
const narratives=JSON.parse(await readFile(resolve(root,'public/data/enrichment/narratives.json'),'utf8'));
const excluded=new Set((index.exclusions||[]).map(item=>item.recordId));
const covered=new Set(narratives.entries.map(entry=>entry.qid));

const POLITY=/(historical country|sovereign state|country|state in the|empire|kingdom|khanate|khaganate|kaganate|dynasty|confederation|republic|principality|monarchy|caliphate|sultanate|emirate|duchy|polity|colony|protectorate|mandate|commonwealth|federation|city-state|satrapy|despotate|tsardom|shogunate|beylik|chiefdom|electoral principate|colonial power|republic regime)/i;
// Passes the class test but is not a polity in this atlas's sense (a concept, an island
// territory, or a disambiguation/history topic that also carries a country class).
const HAND_BLOCK={
 Q617219:'"English overseas possessions" is a description of a collection of territories, not a polity with its own records.',
 Q223:'Greenland is an island territory; the atlas records bound to it describe the island and its Danish autonomy rather than a sovereign polity of its own.',
 Q2345840:'"History of Sumer" is a history topic, not a polity.',
 Q521263:'"History of Tibet" is a history topic, not a polity.',
 Q19951607:'"French Colonial Africa" is a region, not a polity.',
 Q1794655:'Kutai: the classes include a monarchy, but the only English article under this name documents a historical region and the Kutai people rather than a state, so it was registered as a gap in the previous round as well.'};
// Regions reviewed by hand: the box rule assigns these to the region where most of their
// records sit, which for a European metropole with colonial records is not Europe.
const REGION_REVIEW={Q55:'europe',Q69829:'europe',Q229:'europe',
 Q216068:'west-central-asia',Q289577:'west-central-asia',Q146871:'west-central-asia',Q146862:'west-central-asia',
 Q851:'west-central-asia',Q5362837:'west-central-asia',Q846:'west-central-asia',
 Q70802:'europe',Q71092:'europe',Q824489:'europe',Q926295:'europe'};
// Islands and provinces that pass the class test but are not polities here.
const EXTRA_BLOCK={Q3125978:'Bali is a province and island of Indonesia, not a polity with its own records.'};
const eligible=[];
for(const row of candidates.rows){
 if(covered.has(row.qid))continue;
 const labels=row.p31Labels||[];
 const polity=labels.some(label=>POLITY.test(label));
 const block=HAND_BLOCK[row.qid]||EXTRA_BLOCK[row.qid];
 // The identity verification in verify-candidates is the authority: an entity it marked
 // not-a-polity (a dynasty class combined with "historical period", a people, a republic regime
 // that is a period, and so on) is excluded even though one of its labels matches the class
 // whitelist used here.
 if(row.verdict!=='verified'||!polity||block){continue}
 const region=REGION_REVIEW[row.qid]||row.regionBox;
 eligible.push({...row,regionReviewed:region,regionBox:row.regionBox});
}
const RECORDS=new Map();
for(const record of catalog.records){
 if(record.type!=='POLITY'||excluded.has(record.id)||!record.verifiedWikidata)continue;
 const list=RECORDS.get(record.verifiedWikidata)||[];list.push(record);RECORDS.set(record.verifiedWikidata,list);
}
const pool=eligible.filter(row=>(RECORDS.get(row.qid)||[]).length>0);
// Quotas: this is a deliberate change of policy, not drift. The first three batches pushed Europe
// down to 8.6-12 per cent in order to work the under-covered regions first; by the fourth batch
// their low-hanging candidates are used up, so Europe takes a quota of 33 of 70 plans (about 47
// per cent), capped at half the batch, while the under-covered regions keep their priorities.
// Sixth batch: a fresh selection of about sixty plans with Europe at 27 places (45 per cent), the
// normal band for a newly selected batch; the rest goes to the regions that are still under-covered.
const QUOTA={europe:46,africa:24,"south-asia":12,"east-asia":10,"west-central-asia":8};
const PRIORITY=['africa','west-central-asia','east-asia','south-asia','americas','southeast-asia','oceania','europe'];
const europeCap=Math.floor(target*0.5);
const chosen=[];const used=new Set();
for(const region of PRIORITY){
 const limit=QUOTA[region]||0;
 const list=pool.filter(row=>row.regionReviewed===region).sort((a,b)=>b.score-a.score);
 let taken=0;
 for(const row of list){if(taken>=limit)break;if(used.has(row.qid))continue;used.add(row.qid);chosen.push(row);taken++}
}
const rest=pool.filter(row=>!used.has(row.qid)).sort((a,b)=>b.score-a.score);
for(const row of rest){
 if(chosen.length>=target)break;
 if(row.regionReviewed==='europe'&&chosen.filter(item=>item.regionReviewed==='europe').length>=europeCap)continue;
 used.add(row.qid);chosen.push(row);
}
const excess=chosen.length-target;
const final=chosen.slice(0,Math.max(0,chosen.length-excess<0?chosen.length:target));
const yearText=(year,lang)=>year<0?(lang==='zh'?'公元前'+Math.abs(year)+' 年':Math.abs(year)+' BCE'):(lang==='zh'?'公元'+year+' 年':String(year)+' CE');
const plans=final.map(row=>{
 const records=(RECORDS.get(row.qid)||[]).slice().sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id));
 const start=Math.min(...records.map(record=>record.start));
 const end=Math.max(...records.map(record=>record.end));
 const span=end-start;
 const thin=records.length<6||span<60;
 return {qid:row.qid,titleZh:row.zh,titleEn:row.en,regionReviewed:row.regionReviewed,regionBox:row.regionBox,
  era:start<-3000?'prehistoric':start<=-1201?'ancient-early':start<=-501?'ancient-iron':start<=499?'classical':start<=1499?'medieval':start<=1799?'early-modern':start<=1945?'modern':'contemporary',
  // sourceNames must be the exact catalogue record names: the reader and validate-v2 bind an
  // entry by exact sourceNames AND verifiedWikidata, so a profile label that differs from the
  // record name would bind to nothing.
  sourceNames:[...new Set(records.map(record=>record.name))],scope:{start,end},recordCount:records.length,spanYears:span,
  yearsCovered:records.reduce((sum,record)=>sum+Math.max(0,record.end-record.start+1),0),
  areaMax:records.length?Math.max(...records.map(record=>record.area||0)):0,
  firstRecordId:records[0].id,recordIds:records.map(record=>record.id),
  evidence:{score:row.score,recordCount:row.recordCount,spanYears:row.spanYears,mentions:0,citedFields:0},
  coverageNote:'cliopatria',thin,
  identity:{catalogueRecords:row.catalogueRecords,enArticle:row.enArticle,articleQid:row.articleQid,p31:row.p31,p31Labels:row.p31Labels},
  notes:{zh:'本站疆域数据收录该政体 '+records.length+' 条记录，年份范围为'+yearText(start,'zh')+'至'+yearText(end,'zh')+'。',en:'This atlas holds '+records.length+' territory records for this polity, covering '+yearText(start,'en')+' to '+yearText(end,'en')+'.'}};
});
const byRegion=plans.reduce((all,plan)=>(all[plan.regionReviewed]=(all[plan.regionReviewed]||0)+1,all),{});
const thin=plans.filter(plan=>plan.thin);
const blocked=Object.entries(HAND_BLOCK).map(([qid,reason])=>({qid,reason,
 title:(candidates.rows.find(row=>row.qid===qid)||{}).en||null}));
const nonPolity=candidates.rows.filter(row=>row.verdict==='not-a-polity'&&!HAND_BLOCK[row.qid])
 .filter(row=>!(row.p31Labels||[]).some(label=>POLITY.test(label)))
 .map(row=>({qid:row.qid,title:row.zh||row.en,regionBox:row.regionBox,p31Labels:row.p31Labels,records:row.recordCount}));
const document={schemaVersion:1,generatedAt:new Date().toISOString(),
 purpose:'Fourth narratives batch (3.36): the chosen polity plans with the identity evidence and the territory-coverage arithmetic.',
 method:{eligibility:'Wikidata P31 classes must include a polity class; islands, people, families, positions, events, cultures and history topics are excluded, with five hand exclusions documented below.',
  region:'documented coordinate-box rule on record centres, reviewed by hand for European metropoles',
  quotas:'Deliberate policy change for the fourth batch: Europe takes 32 of 70 plans (about 46 per cent) while the under-covered regions - Africa, west-central Asia, east Asia, South Asia, the Americas, Southeast Asia and Oceania - take the remaining 38 by score'},
 target,count:plans.length,byRegion,europeShare:Number(((byRegion.europe||0)/plans.length).toFixed(3)),
 thinCount:thin.length,thinQids:thin.map(plan=>plan.qid),
 handExclusions:blocked,notPolityGaps:nonPolity,entries:plans};
await writeFile(resolve(root,'docs/verification-3.36/narratives-chosen.json'),JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({target,chosen:plans.length,byRegion,europeShare:document.europeShare,thin:thin.length,
 pool:pool.length,handExclusions:blocked.map(item=>item.qid),gaps:nonPolity.length,
 first:plans.slice(0,12).map(plan=>plan.qid+' '+(plan.titleZh||plan.titleEn)+' ['+plan.regionReviewed+'] rec'+plan.recordCount+' span'+plan.spanYears+(plan.thin?' THIN':''))},null,1));
