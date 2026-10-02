#!/usr/bin/env node
// Usage: node scripts/places/build-battles.mjs [--check]
// Builds public/data/battles.json(+.gz) from the Wikidata harvest in
// editorial/battles-wikidata-source.json, with English labels for participants and
// conflicts resolved by scripts/places/fetch-entity-english-labels.mjs.
// Language rule: English fields contain Latin script only (entities without an English
// label appear as their QID); Chinese fields stay simplified. Nothing is transliterated
// or machine-translated. Coordinates, dates and participants come from source statements.
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const checkOnly=process.argv.includes('--check');
const CJK=/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
const source=JSON.parse(await readFile(resolve(root,'editorial/battles-wikidata-source.json'),'utf8'));
const english=JSON.parse(await readFile(resolve(root,'editorial/entity-labels-en.json'),'utf8')).labels;
// 3.14 thin-region supplement harvested by scripts/places/fetch-thin-region-battles.mjs.
// It is optional so the base build still runs without it; on a duplicate QID the base
// harvest record wins, so the supplement can only add entities.
const optional=async path=>{try{return JSON.parse(await readFile(resolve(root,path),'utf8'))}catch{return null}};
const supplementFiles=(await readdir(resolve(root,'editorial'))).filter(name=>/^battles-thin-regions-.*\.json$/.test(name)).sort();
const supplements=[];
for(const file of supplementFiles){const document=await optional('editorial/'+file);if(document)supplements.push({file,items:document.items||[]})}
const supplementItems=supplements.flatMap(entry=>entry.items);
// The sweep's class roots include massacre (Q3199915), but one-sided killings are not what this
// layer documents: that closure alone is 298 of the 841 items harvested in the 3.15 pass (31 of
// them with a Chinese name) and would turn a battle layer into an atrocity index. Those items
// stay in editorial/battles-thin-regions-3.15.json as a recorded pool for a possible separate
// layer. Three individual records are excluded by hand because Wikidata classes them as a
// military operation or an airstrike while their own articles describe one-sided killings of
// civilians; every exclusion carries its reason and the round report gives the pool sizes.
const SUPPLEMENT_CLASS_EXCLUSIONS={'Q3199915':'massacre root: one-sided killings belong to a different layer'};
const SUPPLEMENT_ITEM_EXCLUSIONS={
 'Q97368680':'police raid on the Apple Daily offices in 2020: not an armed clash',
 'Q208855':'Jallianwala Bagh killings in 1919: a one-sided killing of civilians classed as a military operation',
 'Q1136783':'Granai airstrike in 2009: a one-sided killing of civilians classed as an airstrike'};
const excludedSupplement=supplementItems.filter(item=>SUPPLEMENT_CLASS_EXCLUSIONS[item.classQid]||SUPPLEMENT_ITEM_EXCLUSIONS[item.qid]);
const shippedSupplement=supplementItems.filter(item=>!SUPPLEMENT_CLASS_EXCLUSIONS[item.classQid]&&!SUPPLEMENT_ITEM_EXCLUSIONS[item.qid]);
const seenQid=new Set();
const harvestItems=[];
for(const item of [...source.items,...shippedSupplement]){
 if(!item||!item.qid||seenQid.has(item.qid))continue;
 seenQid.add(item.qid);harvestItems.push(item);
}
const TARGET=520;
const CENTURIES=[[-4000,-1500],[-1500,-500],[-500,1],[1,500],[500,1000],[1000,1500],[1500,1800],[1800,1900],[1900,1945],[1945,2000],[2000,2027]];
const regionOf=([lon,lat])=>{
 if(lon>=-170&&lon<=-30)return 'americas';
 if(lon>=110&&lon<=180&&lat<=0)return 'oceania';
 if(lon>=95&&lon<=150&&lat>=15&&lat<=55)return 'east-asia';
 if(lon>=92&&lon<=141&&lat>=-11&&lat<=25)return 'southeast-asia';
 if(lon>=60&&lon<=92&&lat>=0&&lat<=37)return 'south-asia';
 if(lon>=33&&lon<=40&&lat>=29&&lat<=34)return 'west-central-asia';
 if(lon>=-25&&lon<=40&&lat>=36&&lat<=72)return 'europe';
 if(lon>=-20&&lon<=52&&lat>=-36&&lat<=36)return 'africa';
 if(lon>=25&&lon<=80&&lat>=12&&lat<=55)return 'west-central-asia';
 return 'global';
};
const englishList=(qid,key)=>{
 const entry=english[qid]?.[key]||[];
 return entry.map(item=>item.label&&item.label.trim()?item.label.trim():item.qid);
};
const slug=qid=>qid.toLowerCase().replace(/[^a-z0-9]/g,'');
const candidates=[];
const dropped={noChineseLabel:0,badCoordinates:0,badYear:0,duplicate:0};
const seen=new Set();
// Two thin-region records carry a Wikidata P585 that contradicts both Wikipedia articles read
// in this session: Q111383245 (Avdiivka) and Q112206624 (Kreminna) are stored as 2020 while the
// English and Chinese articles date the fighting from 2022. The layer keeps the source value and
// discloses the conflict in its notes instead of silently shipping a year the sources contradict;
// the event layer keeps both entities at index level for the same reason.
const DATE_CONFLICTS={
 'Q111383245':{zh:'维基数据 P585 记为 2020 年，而中英文维基百科记该战役自 2022 年起（2022 至 2024 年）；本条保留来源原值 2020 年，矛盾已在 3.15 报告中记录。',
  en:'Wikidata P585 records 2020 for this battle while the English and Chinese Wikipedia articles date the fighting from 2022; this record keeps the source value 2020 and the conflict is documented in the 3.15 report.'},
 'Q112206624':{zh:'维基数据 P585 记为 2020 年，而中英文维基百科记该战役发生于 2022 年；本条保留来源原值 2020 年，矛盾已在 3.15 报告中记录。',
  en:'Wikidata P585 records 2020 for this battle while the English and Chinese Wikipedia articles date it to 2022; this record keeps the source value 2020 and the conflict is documented in the 3.15 report.'}};
for(const item of harvestItems){
 const nameZh=(item.labelZh||'').trim();
 const nameEn=(item.enLabel||(item.labelLang==='en'?item.label:'')||'').trim();
 if(!nameZh){dropped.noChineseLabel++;continue}
 const nameSource=item.labelSource||'wikidata-zh-label';
 const coordinates=item.coordinates;
 if(!Array.isArray(coordinates)||coordinates.length!==2||!(coordinates[0]>=-180&&coordinates[0]<=180)||!(coordinates[1]>=-90&&coordinates[1]<=90)){dropped.badCoordinates++;continue}
 // Wikidata P585 is an ISO 8601 astronomical year (year 0 exists, so -489 is 490 BCE);
 // the layer, like the place catalog, uses the civil convention without a year zero.
 if(!Number.isInteger(item.year)){dropped.badYear++;continue}
 const year=item.year<=0?item.year-1:item.year;
 if(year===0||year<-4000||year>2026){dropped.badYear++;continue}
 const id='battle-'+slug(item.qid);
 if(seen.has(id)){dropped.duplicate++;continue}
 seen.add(id);
 const region=regionOf(coordinates);
 const sources=[{title:'Wikidata — '+item.qid,url:'https://www.wikidata.org/wiki/'+item.qid}];
 for(const ref of item.refs||[])if(typeof ref==='string'&&ref.startsWith('https://'))sources.push({title:'Wikidata statement reference',url:ref});
 const hasReference=sources.length>1;
 candidates.push({id,qid:item.qid,nameZh,nameEn,year,start:year,end:year,coordinates,region,
  belligerents:englishList(item.qid,'belligerents'),belligerentsZh:(item.belligerents||[]).slice(0,6),
  conflict:englishList(item.qid,'conflict'),conflictZh:(item.parts||[]).slice(0,3),
  countries:englishList(item.qid,'countries'),countriesZh:(item.countries||[]).slice(0,3),
  sources,
  notes:(hasReference?'坐标与年代取自维基数据实体声明，并附该声明中的参考链接。':'维基数据实体声明未附参考链接；坐标与年代以实体声明为准，发布前建议补一次文献核对。')+(DATE_CONFLICTS[item.qid]?' '+DATE_CONFLICTS[item.qid].zh:''),
  notesEn:(hasReference?'Coordinates and dates come from the Wikidata entity statements and their recorded reference links.':'The Wikidata entity statements carry no reference link; coordinates and dates follow the entity statements and should be checked against literature before release.')+(DATE_CONFLICTS[item.qid]?' '+DATE_CONFLICTS[item.qid].en:''),
  nameSource,supplementSource:item.box?('thin-region-sweep:'+item.box):'global-sweep',fromSupplement:Boolean(item.box),
  regionBasis:'coordinate-box'});
}
const byCentury=new Map();
for(const item of candidates){
 const index=CENTURIES.findIndex(([from,to])=>item.year>=from&&item.year<to);
 const key=index<0?CENTURIES.length-1:index;
 if(!byCentury.has(key))byCentury.set(key,[]);
 byCentury.get(key).push(item);
}
const score=item=>(item.belligerents.length?2:0)+(item.conflict.length?1:0)+(item.sources.length>1?1:0);
const selected=[];
// Supplement entities do not compete in the per-century quota. That quota is the fairness rule
// for the global harvest, and re-running it over a larger pool silently drops records that
// already ship: the 3.15 supplement alone displaced 24 European records in a dry run. The
// supplement is therefore additive-only, which is also what the thin-region guarantee intends.
const perCentury=Math.ceil(TARGET/byCentury.size);
for(const [key,items] of [...byCentury.entries()].sort((a,b)=>a[0]-b[0])){
 const baseItems=items.filter(item=>!item.fromSupplement);
 const sorted=baseItems.sort((a,b)=>score(b)-score(a)||a.year-b.year||a.id.localeCompare(b.id));
 const regionCounts={};
 const picked=[];
 for(const item of sorted){
  const used=regionCounts[item.region]||0;
  if(used>=9&&picked.length<perCentury)continue;
  picked.push(item);regionCounts[item.region]=used+1;
  if(picked.length>=perCentury)break;
 }
 for(const item of sorted)if(picked.length<perCentury&&!picked.includes(item))picked.push(item);
 selected.push(...picked);
}
// Thin-region guarantee: every qualifying Oceania, South Asia and Southeast Asia entity
// ships. The per-century quota and the nine-per-region cap are global fairness rules and
// must not silently empty the regions with the smallest pools. The guarantee only adds
// entities that already meet every standard (coordinate, year, Chinese name).
const THIN_REGIONS=new Set(['oceania','south-asia','southeast-asia']);
const supplementShipped=candidates.filter(item=>item.fromSupplement);
const guaranteed=[...candidates.filter(item=>!item.fromSupplement&&THIN_REGIONS.has(item.region)&&!selected.includes(item)),...supplementShipped];
const battles=[...selected,...guaranteed].sort((a,b)=>a.year-b.year||a.id.localeCompare(b.id));
for(const battle of battles){
 for(const field of ['nameEn','notesEn'])if(CJK.test(battle[field]||''))throw new Error('CJK in English field '+battle.id+' '+field);
 for(const field of ['belligerents','conflict','countries'])for(const value of battle[field])if(CJK.test(value))throw new Error('CJK in English list '+battle.id+' '+field+' '+value);
}
const byRegion=battles.reduce((all,item)=>{all[item.region]=(all[item.region]||0)+1;return all},{});
const byCenturyOut=battles.reduce((all,item)=>{const century=CENTURIES.find(([from,to])=>item.year>=from&&item.year<to);const key=century?century[0]+'..'+(century[1]-1):'other';all[key]=(all[key]||0)+1;return all},{});
const document={schemaVersion:1,builtAt:'2026-10-03T00:00:00+00:00',layer:'battles',
 policy:{
  language:'English fields (nameEn, belligerents, conflict, countries, notesEn) contain Latin script only; an entity without an English label appears as its QID. Chinese fields (nameZh, belligerentsZh, conflictZh, countriesZh, notes) stay simplified. No transliteration or machine translation is used.',
  coordinates:'Points come from the Wikidata P625 statement of the battle entity; no coordinate is estimated or moved.',
  participants:'Belligerents come from P710 statements of the same entity; empty arrays mean the source does not state them and no value was invented.',
  dates:'Years come from the P585 statement; single-year precision is retained and no month or day is inferred. Wikidata stores ISO 8601 astronomical years, so BCE values are converted to the project civil-year convention, which has no year zero (ISO -489, i.e. 490 BCE, ships as -490). Where P585 contradicts the English and Chinese Wikipedia articles the record keeps the source value and states the conflict in its notes instead of silently changing it.',
  names:'Chinese names come from Wikidata zh labels; when an entity has no Chinese label but has a zh.wikipedia article, the article title is used and the record keeps labelSource=zhwiki-sitelink. An entity with no Chinese name in either place is not shipped.',
  coverage:'The thin-region supplements (editorial/battles-thin-regions-*.json, harvested by scripts/places/fetch-thin-region-battles.mjs in the 3.14 and 3.15 passes) sweep the Oceania, South Asia and Southeast Asia coordinate boxes and guarantee that every qualifying entity in those three regions ships, so a global quota cannot empty them. Entities whose Wikidata class is the massacre root, and three individually listed one-sided killings classed differently by Wikidata, are kept out of this layer and recorded in counts.supplementExcluded for a possible separate layer.',
  outcome:'The outcome field is intentionally absent: Wikidata has no stable, sourced property for battle results, and this project does not infer victors. It can be added later where a verifiable source states the result.',
  provenance:'Every entry links its Wikidata entity; statement-level reference URLs are included when Wikidata records them.',
  region:'Regions are assigned by a documented coordinate box rule (regionBasis=coordinate-box), not by political judgement.'},
 counts:{items:harvestItems.length,baseHarvest:source.items.length,supplement:shippedSupplement.length,supplementHarvested:supplementItems.length,
  supplementExcluded:{total:excludedSupplement.length,byClass:excludedSupplement.reduce((all,item)=>(all[item.classQid||'none']=(all[item.classQid||'none']||0)+1,all),{}),
   reasons:excludedSupplement.map(item=>({qid:item.qid,nameZh:item.labelZh||null,classQid:item.classQid||null,reason:SUPPLEMENT_CLASS_EXCLUSIONS[item.classQid]||SUPPLEMENT_ITEM_EXCLUSIONS[item.qid]}))},
  supplements:supplements.map(entry=>({file:entry.file,items:entry.items.length})),candidates:candidates.length,shipped:battles.length,dropped,byRegion,byCentury:byCenturyOut,
  byNameSource:battles.reduce((all,item)=>{all[item.nameSource]=(all[item.nameSource]||0)+1;return all},{}),
  thinRegionGuarantee:guaranteed.length,supplementShipped:supplementShipped.length},
 battles};
const text=JSON.stringify(document,null,2)+'\n';
const gzip=gzipSync(Buffer.from(text),{level:9});
gzip[4]=gzip[5]=gzip[6]=gzip[7]=0;gzip[9]=255;
if(JSON.stringify(JSON.parse(gunzipSync(gzip).toString()))!==JSON.stringify(document))throw new Error('gzip round-trip mismatch');
if(checkOnly){console.log(JSON.stringify({result:'checked',shipped:battles.length,byRegion,dropped},null,2));process.exit(0)}
await mkdir(resolve(root,'public/data'),{recursive:true});
await writeFile(resolve(root,'public/data/battles.json'),text);
await writeFile(resolve(root,'public/data/battles.json.gz'),gzip);
console.log(JSON.stringify({result:'built',shipped:battles.length,byRegion,dropped,gzipBytes:gzip.length,jsonBytes:Buffer.byteLength(text)},null,2));