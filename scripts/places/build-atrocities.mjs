#!/usr/bin/env node
// Usage: node scripts/places/build-atrocities.mjs [--check]
// Builds public/data/atrocities.json(+.gz), the separate data layer for the pool of records
// that build-battles.mjs keeps out of the battle layer because Wikidata classes them as
// massacres or one-sided killings rather than as armed clashes between two forces.
//
// Why a separate layer and not the battle layer: the semantic ruling of the 3.16 round is that
// 'battles' means combat between opposing forces. One-sided mass violence against non-combatants
// is a different category and must not be mixed into that layer, because a reader of a battle
// layer would otherwise read a massacre as a battle. This layer therefore carries its own
// policy text and its own identity; validate-atrocities.mjs enforces that the two layers stay
// disjoint by Wikidata entity id.
//
// Language rule: names are source labels, never transliterated and never machine translated.
// An entity with no Chinese label in Wikidata keeps nameZh=null; the incident is still shipped
// with its English label, exactly as the polity catalogue falls back to the source name.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const checkOnly=process.argv.includes('--check');
const CJK=/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
const ACCESSED_AT='2026-10-03';
const pool=JSON.parse(await readFile(resolve(root,'editorial/atrocities-pool-3.16.json'),'utf8'));
const battles=JSON.parse(await readFile(resolve(root,'public/data/battles.json'),'utf8'));
const battleQids=new Set(battles.battles.map(battle=>battle.qid));
const REGIONS=['east-asia','southeast-asia','south-asia','west-central-asia','europe','africa','americas','oceania','global'];
const CLASS_SEMANTICS={
 Q3199915:'Wikidata class: massacre (mass violence against people who cannot defend themselves)',
 Q645883:'Wikidata class: military operation whose own article describes a one-sided killing of civilians',
 Q2380335:'Wikidata class: airstrike whose own article describes a one-sided killing of civilians',
 Q97368680:'Wikidata class: police raid, a law-enforcement action rather than an armed clash'};
// The same documented coordinate-box rule the battle layer uses, so both layers agree on region.
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
const slug=qid=>qid.toLowerCase().replace(/[^a-z0-9]/g,'');
const dropped={noName:0,noChineseName:0,badCoordinates:0,badYear:0,outOfRange:0,battleLayerOverlap:0};
const incidents=[];
const seen=new Set();
for(const item of pool.entries){
 const nameZh=(item.nameZh||'').trim()||null;
 const nameEn=(item.nameEn||'').trim()||null;
 if(!nameZh&&!nameEn){dropped.noName++;continue}
 if(!nameZh)dropped.noChineseName++;
 const coordinates=item.coordinates;
 if(!Array.isArray(coordinates)||coordinates.length!==2||!(coordinates[0]>=-180&&coordinates[0]<=180)||!(coordinates[1]>=-90&&coordinates[1]<=90)){dropped.badCoordinates++;continue}
 if(!Number.isInteger(item.year)){dropped.badYear++;continue}
 // Wikidata P585 is an ISO 8601 astronomical year; the project uses civil years without a
 // year zero, so a value <= 0 ships as value - 1.
 const year=item.year<=0?item.year-1:item.year;
 if(year===0||year<-4000||year>2024){dropped.outOfRange++;continue}
 const id='atrocity-'+slug(item.qid);
 if(seen.has(id))continue;
 seen.add(id);
 if(battleQids.has(item.qid)){dropped.battleLayerOverlap++;continue}
 const region=regionOf(coordinates);
 if(!REGIONS.includes(region))throw new Error('region outside the documented set for '+item.qid);
 const sources=[{title:'Wikidata — '+item.qid,url:'https://www.wikidata.org/wiki/'+item.qid,accessedAt:ACCESSED_AT}];
 for(const ref of item.refs||[])if(typeof ref==='string'&&ref.startsWith('https://'))sources.push({title:'Wikidata statement reference',url:ref,accessedAt:ACCESSED_AT});
 const hasReference=sources.length>1;
 incidents.push({id,qid:item.qid,nameZh,nameEn,year,start:year,end:year,coordinates,region,
  classQid:item.classQid,classSemantics:CLASS_SEMANTICS[item.classQid]||('Wikidata class '+item.classQid),
  countriesZh:(item.countries||[]).slice(0,3),conflictZh:(item.parts||[]).slice(0,3),victimsZh:(item.belligerents||[]).slice(0,3),
  countries:[],conflict:[],victims:[],
  sources,
  notes:(hasReference?'坐标与年代取自维基数据实体声明，并附该声明中的参考链接。':'维基数据实体声明未附参考链接；坐标与年代以实体声明为准，发布前建议补一次文献核对。')
   +' 本层记录的是针对非战斗人员的单方面暴力事件，与 battles 层的两军交战不属同一语义，两者按维基数据实体互斥。',
  notesEn:(hasReference?'Coordinates and dates come from the Wikidata entity statements and their recorded reference links.':'The Wikidata entity statements carry no reference link; coordinates and dates follow the entity statements and should be checked against literature before release.')
   +' This layer records one-sided violence against non-combatants, a different category from the combat between opposing forces documented in the battles layer; the two layers are disjoint by Wikidata entity.',
  nameSource:nameZh?(item.nameZhSource||'wikidata-zh-label'):'wikidata-en-label',
  regionBasis:'coordinate-box',fromSupplement:true,box:item.box||null});
}
const byRegion=incidents.reduce((all,item)=>(all[item.region]=(all[item.region]||0)+1,all),{});
const byClass=incidents.reduce((all,item)=>(all[item.classQid]=(all[item.classQid]||0)+1,all),{});
const byCentury=incidents.reduce((all,item)=>{const start=Math.floor((item.year-1)/100)*100+1;const key=start+'..'+(start+99);all[key]=(all[key]||0)+1;return all},{});
const withChineseName=incidents.filter(item=>item.nameZh).length;
const document={schemaVersion:1,builtAt:ACCESSED_AT+'T00:00:00+00:00',layer:'atrocities',
 policy:{
  semantics:'This layer documents one-sided mass violence and killings in which the victims could not mount an armed defence: entities Wikidata classes as massacre (Q3199915), plus two individually listed one-sided killings classed by Wikidata as a military operation or an airstrike, plus the police-raid class (Q97368680). It is deliberately NOT the battles layer: battles.json documents combat between opposing forces, and validate-atrocities.mjs fails if any entity id appears in both layers. The layer records the source classification only; it does not assert that a state, army or organised group was responsible for any incident, and it does not distinguish state, communal or criminal mass violence.',
  language:'Names are source labels, not editorial renderings: nameZh is the Wikidata Chinese label verbatim when one exists and null when it does not, and nameEn is the Wikidata English label. Nothing is transliterated or machine translated. A Chinese label may be written in traditional script and may mix scripts because it is quoted as recorded in the source; entries without a Chinese label ship with nameZh=null rather than an invented translation.',
  coordinates:'Points come from the Wikidata P625 statement of the incident entity; no coordinate is estimated or moved.',
  dates:'Years come from the P585 statement at single-year precision; no month or day is inferred. Wikidata stores ISO 8601 astronomical years, so BCE values are converted to the project civil-year convention, which has no year zero (ISO -489, i.e. 490 BCE, ships as -490).',
  names:'English names come from the Wikidata English label (293 of 302 pool records have one). Nine pool records carry neither a Chinese nor an English label and are not shipped; their count is recorded in counts.dropped.noName.',
  countries:'countriesZh, conflictZh and victimsZh repeat the Chinese labels recorded by the source sweep; the English arrays are empty rather than machine translated, because the sweep did not resolve the corresponding entity ids.',
  provenance:'Every entry links its Wikidata entity; statement-level reference URLs are included when Wikidata records them.',
  coverage:'The pool is the Wikidata sweep of the Oceania, South Asia and Southeast Asia coordinate boxes that build-battles.mjs excludes from the battle layer (editorial/battles-thin-regions-3.15.json). Chinese-name coverage is therefore a property of Wikidata, not of this build: see counts.withChineseName and counts.withoutChineseName.',
  ui:'No user interface consumes this layer in the 3.16 round. It ships as data plus the independent validator so a later round can decide how to present it, for example whether a Chinese-language mode shows only the sub-set with Chinese names.',
  region:'Regions are assigned by the documented coordinate box rule (regionBasis=coordinate-box), the same rule the battle layer uses.'},
 counts:{pool:pool.count,shipped:incidents.length,withChineseName,withoutChineseName:incidents.length-withChineseName,
  withReferenceLinks:incidents.filter(item=>item.sources.length>1).length,
  dropped,byClass,byRegion,byCentury,
  poolByClass:pool.entries.reduce((all,item)=>(all[item.classQid]=(all[item.classQid]||0)+1,all),{})},
 incidents};
for(const incident of incidents){
 for(const field of ['nameEn','notesEn'])if(incident[field]&&CJK.test(incident[field]))throw new Error('CJK in English field '+incident.id+' '+field);
 for(const value of [...incident.countries,...incident.conflict,...incident.victims])if(CJK.test(value))throw new Error('CJK in English list '+incident.id);
}
const text=JSON.stringify(document,null,2)+'\n';
const gzip=gzipSync(Buffer.from(text),{level:9});
gzip[4]=gzip[5]=gzip[6]=gzip[7]=0;gzip[9]=255;
if(JSON.stringify(JSON.parse(gunzipSync(gzip).toString()))!==JSON.stringify(document))throw new Error('gzip round-trip mismatch');
if(checkOnly){console.log(JSON.stringify({result:'checked',shipped:incidents.length,dropped,byRegion},null,2));process.exit(0)}
await mkdir(resolve(root,'public/data'),{recursive:true});
await writeFile(resolve(root,'public/data/atrocities.json'),text);
await writeFile(resolve(root,'public/data/atrocities.json.gz'),gzip);
console.log(JSON.stringify({result:'built',shipped:incidents.length,withChineseName,withoutChineseName:incidents.length-withChineseName,dropped,byRegion,byClass,gzipBytes:gzip.length,jsonBytes:Buffer.byteLength(text)},null,2));
