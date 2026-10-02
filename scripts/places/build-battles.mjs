#!/usr/bin/env node
// Usage: node scripts/places/build-battles.mjs [--check]
// Builds public/data/battles.json(+.gz) from the Wikidata harvest in
// editorial/battles-wikidata-source.json, with English labels for participants and
// conflicts resolved by scripts/places/fetch-entity-english-labels.mjs.
// Language rule: English fields contain Latin script only (entities without an English
// label appear as their QID); Chinese fields stay simplified. Nothing is transliterated
// or machine-translated. Coordinates, dates and participants come from source statements.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const checkOnly=process.argv.includes('--check');
const CJK=/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
const source=JSON.parse(await readFile(resolve(root,'editorial/battles-wikidata-source.json'),'utf8'));
const english=JSON.parse(await readFile(resolve(root,'editorial/entity-labels-en.json'),'utf8')).labels;
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
for(const item of source.items){
 const nameZh=(item.labelZh||'').trim();
 const nameEn=(item.enLabel||(item.labelLang==='en'?item.label:'')||'').trim();
 if(!nameZh){dropped.noChineseLabel++;continue}
 const coordinates=item.coordinates;
 if(!Array.isArray(coordinates)||coordinates.length!==2||!(coordinates[0]>=-180&&coordinates[0]<=180)||!(coordinates[1]>=-90&&coordinates[1]<=90)){dropped.badCoordinates++;continue}
 const year=item.year;
 if(!Number.isInteger(year)||year===0||year<-4000||year>2026){dropped.badYear++;continue}
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
  notes:hasReference?'坐标与年代取自维基数据实体声明，并附该声明中的参考链接。':'维基数据实体声明未附参考链接；坐标与年代以实体声明为准，发布前建议补一次文献核对。',
  notesEn:hasReference?'Coordinates and dates come from the Wikidata entity statements and their recorded reference links.':'The Wikidata entity statements carry no reference link; coordinates and dates follow the entity statements and should be checked against literature before release.',
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
const perCentury=Math.ceil(TARGET/byCentury.size);
for(const [key,items] of [...byCentury.entries()].sort((a,b)=>a[0]-b[0])){
 const sorted=items.sort((a,b)=>score(b)-score(a)||a.year-b.year||a.id.localeCompare(b.id));
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
const battles=selected.sort((a,b)=>a.year-b.year||a.id.localeCompare(b.id));
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
  dates:'Years come from the P585 statement; single-year precision is retained and no month or day is inferred.',
  outcome:'The outcome field is intentionally absent: Wikidata has no stable, sourced property for battle results, and this project does not infer victors. It can be added later where a verifiable source states the result.',
  provenance:'Every entry links its Wikidata entity; statement-level reference URLs are included when Wikidata records them.',
  region:'Regions are assigned by a documented coordinate box rule (regionBasis=coordinate-box), not by political judgement.'},
 counts:{items:source.items.length,candidates:candidates.length,shipped:battles.length,dropped,byRegion,byCentury:byCenturyOut},
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
