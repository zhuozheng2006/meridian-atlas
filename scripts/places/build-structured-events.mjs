#!/usr/bin/env node
// Usage: node scripts/places/build-structured-events.mjs [--count=320] [out.json]
// Generates structured bilingual timeline events from the Wikidata battle harvest.
// Language rule: the English summary uses English labels resolved by
// scripts/places/fetch-entity-english-labels.mjs (an entity without an English label is
// written as its QID, or the sentence is dropped); the Chinese summary uses the
// simplified labels from the harvest. No transliteration and no machine translation.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const CJK=/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
const countArg=process.argv.find(argument=>argument.startsWith('--count='));
const target=countArg?Number(countArg.slice(8)):320;
const outPath=resolve(root,process.argv.find(argument=>argument.endsWith('.json')&&!argument.startsWith('--'))||'editorial/events-wikidata-3.12.json');
const harvest=JSON.parse(await readFile(resolve(root,'editorial/battles-wikidata-source.json'),'utf8'));
const english=JSON.parse(await readFile(resolve(root,'editorial/entity-labels-en.json'),'utf8')).labels;
const existing=JSON.parse(await readFile(resolve(root,'public/data/events.json'),'utf8'));
const existingKeys=new Set();
// Only editorial entries participate in the name de-duplication: regenerating the
// structured batch must reproduce the same entity set instead of shifting it.
for(const event of existing){if(event.provenance==='wikidata-structured')continue;for(const value of [event.title.zh,event.title.en])if(value)existingKeys.add(value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g,''));}
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
const englishList=(qid,key)=>(english[qid]?.[key]||[]).map(item=>item.label&&item.label.trim()?item.label.trim():item.qid);
const yearText=year=>year<0?'公元前'+Math.abs(year)+'年':'公元'+year+'年';
const yearTextEn=year=>year<0?Math.abs(year)+' BCE':year+' CE';
const pick=[];
const seen=new Set();
for(const item of harvest.items){
 const nameZh=(item.labelZh||'').trim(),nameEn=(item.enLabel||'').trim();
 if(nameZh.length<4||nameEn.length<4)continue;
 const key=nameEn.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g,'');
 const keyZh=nameZh.replace(/[^a-z0-9\u4e00-\u9fff]/g,'');
 if(existingKeys.has(key)||existingKeys.has(keyZh)||seen.has(item.qid))continue;
 seen.add(item.qid);
 const year=item.year;
 if(!Number.isInteger(year)||year===0||year<-4000||year>2026)continue;
 const coordinates=item.coordinates;
 if(!Array.isArray(coordinates)||coordinates.length!==2)continue;
 pick.push({...item,nameZh,nameEn,region:regionOf(coordinates),year});
}
const score=item=>(item.belligerents?.length?2:0)+(item.parts?.length?1:0)+((item.refs||[]).length?1:0);
const centuries=[[-4000,-1000],[-1000,-1],[1,500],[500,1000],[1000,1500],[1500,1800],[1800,1900],[1900,1945],[1945,2000],[2000,2027]];
const buckets=new Map();
for(const item of pick){
 const index=centuries.findIndex(([from,to])=>item.year>=from&&item.year<to);
 const bucket=index<0?centuries.length-1:index;
 if(!buckets.has(bucket))buckets.set(bucket,[]);
 buckets.get(bucket).push(item);
}
const perCentury=Math.ceil(target/buckets.size);
const selected=[];
for(const [bucket,items] of [...buckets.entries()].sort((a,b)=>a[0]-b[0])){
 const sorted=items.sort((a,b)=>score(b)-score(a)||a.year-b.year||a.qid.localeCompare(b.qid));
 const regionCounts={};
 const picked=[];
 for(const item of sorted){
  const used=regionCounts[item.region]||0;
  if(used>=7&&picked.length<perCentury)continue;
  picked.push(item);regionCounts[item.region]=used+1;
  if(picked.length>=perCentury)break;
 }
 for(const item of sorted)if(picked.length<perCentury&&!picked.includes(item))picked.push(item);
 selected.push(...picked);
}
const entries=selected.sort((a,b)=>a.year-b.year||a.qid.localeCompare(b.qid)).map(item=>{
 const [lon,lat]=item.coordinates;
 const belligerentsZh=(item.belligerents||[]).slice(0,4);
 const conflictZh=(item.parts||[]).slice(0,2);
 const belligerentsEn=englishList(item.qid,'belligerents').slice(0,5);
 const conflictEn=englishList(item.qid,'conflict').slice(0,2);
 const refs=(item.refs||[]).filter(ref=>typeof ref==='string'&&ref.startsWith('https://'));
 const sources=[{title:'Wikidata — '+item.qid,url:'https://www.wikidata.org/wiki/'+item.qid}];
 for(const ref of refs)sources.push({title:'Wikidata statement reference',url:ref});
 const participantsZh=belligerentsZh.length?'交战方为'+belligerentsZh.join('、')+'。':'来源未列出交战方。';
 const participantsEn=belligerentsEn.length?'Belligerents recorded: '+belligerentsEn.join(', ')+'.':'The source does not list belligerents.';
 const conflictTextZh=conflictZh.length?'属于'+conflictZh.join('、')+'的组成部分。':'';
 const conflictTextEn=conflictEn.length?'Part of '+conflictEn.join(', ')+'.':'';
 const summaryZh=yearText(item.year)+'，'+item.nameZh+'位于坐标 '+Math.abs(lat).toFixed(3)+'°'+(lat<0?'S':'N')+'、'+Math.abs(lon).toFixed(3)+'°'+(lon<0?'W':'E')+' 附近。'+conflictTextZh+participantsZh+'结构化索引条目，取自维基数据 '+item.qid+' 声明'+(refs.length?'及参考链接':'')+'，未经独立史料考订。';
 const summaryEn=item.nameEn+' took place in '+yearTextEn(item.year)+' near coordinates '+Math.abs(lat).toFixed(3)+'°'+(lat<0?'S':'N')+', '+Math.abs(lon).toFixed(3)+'°'+(lon<0?'W':'E')+'. '+conflictTextEn+' '+participantsEn+' This is a structured index entry: names, dates, coordinates and participants come directly from Wikidata entity '+item.qid+' statements'+(refs.length?' and their reference links':'')+' and have not been independently verified against scholarship by this project.';
 const significanceEn=conflictEn.length?('Records a military event during '+conflictEn[0]+' for chronological and geographic orientation.'):('Records a military event of '+yearTextEn(item.year)+' for chronological and geographic orientation.');
 if(CJK.test(summaryEn)||CJK.test(significanceEn))throw new Error('CJK in English text for '+item.qid);
 return {
  id:'v312wd-'+item.qid.toLowerCase(),
  title:{zh:item.nameZh,en:item.nameEn},
  start:item.year,end:item.year,lat,lon,region:item.region,category:'war',precision:'year',locationType:'site',
  summary:{zh:summaryZh,en:summaryEn},
  significance:{zh:conflictZh.length?('记录了'+conflictZh[0]+'期间的军事事件，可用于年代与地理定位。'):('记录了'+yearText(item.year)+'的一次军事事件，可用于年代与地理定位。'),en:significanceEn},
  sources,
  editorialNotes:{zh:'结构化数据条目：内容为维基数据实体声明的双语索引，不含本项目的独立叙述；断代精度为年，坐标为实体的 P625 声明值。',en:'Structured data entry: a bilingual index of the Wikidata entity statements without an independent editorial narrative; the date precision is one year and the coordinate is the entity statement value.'},
  provenance:'wikidata-structured',wikidataQid:item.qid,regionBasis:'coordinate-box',
  belligerentsEn,conflictEn,belligerentsZh,conflictZh
 };
});
for(const entry of entries)for(const field of ['summary','significance','editorialNotes'])if(CJK.test(entry[field].en))throw new Error('CJK in English field '+entry.id);
const output={schemaVersion:1,generatedAt:new Date().toISOString(),
 note:'Structured event expansion generated from the Wikidata battle harvest for the 3.12 volume target. Each entry keeps its entity id and provenance marker so editorial review can filter or replace it later. English fields use English labels only; entities without an English label appear as their QID.',
 policy:{source:'Wikidata entity statements (P585 date, P625 coordinate, P710 participants, P361 conflict); statement reference URLs included when recorded.',
  language:'English text uses English labels only (QID fallback); Chinese text uses simplified labels; no transliteration or machine translation.',
  editorial:'No original synthesis: the bilingual text is a rendering of the source statements; entries are marked provenance=wikidata-structured.',
  region:'Region assigned by the documented coordinate box rule (regionBasis=coordinate-box).'},
 count:entries.length,entries};
await writeFile(outPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({out:outPath,requested:target,generated:entries.length,candidates:pick.length,byRegion:entries.reduce((all,item)=>{all[item.region]=(all[item.region]||0)+1;return all},{})},null,2));
