#!/usr/bin/env node
// Usage: node scripts/places/build-structured-events.mjs [--count=290] [out.json]
// Generates structured bilingual timeline events from the Wikidata battle harvest.
// Every field is a direct rendering of the source statements (name, year, coordinates,
// participants, conflict) and each entry names its entity and statement references.
// These are index entries, not editorial syntheses, and they say so in editorialNotes.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const countArg=process.argv.find(argument=>argument.startsWith('--count='));
const target=countArg?Number(countArg.slice(8)):290;
const outPath=resolve(root,process.argv.find(argument=>argument.endsWith('.json')&&!argument.startsWith('--'))||'editorial/events-wikidata-3.12.json');
const harvest=JSON.parse(await readFile(resolve(root,'editorial/battles-wikidata-source.json'),'utf8'));
const existing=JSON.parse(await readFile(resolve(root,'public/data/events.json'),'utf8'));
const existingKeys=new Set();
for(const event of existing){
 for(const value of [event.title.zh,event.title.en])if(value)existingKeys.add(value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g,''));
}
const REGIONS=['east-asia','southeast-asia','south-asia','west-central-asia','europe','africa','americas','oceania'];
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
const yearText=year=>year<0?'公元前'+Math.abs(year)+'年':'公元'+year+'年';
const yearTextEn=year=>year<0?Math.abs(year)+' BCE':year+' CE';
const pick=[];
const seen=new Set();
for(const item of harvest.items){
 const nameZh=(item.labelZh||'').trim(),nameEn=(item.enLabel||'').trim();
 // The shipped events schema requires a readable bilingual title.
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
 const key=index<0?centuries.length-1:index;
 if(!buckets.has(key))buckets.set(key,[]);
 buckets.get(key).push(item);
}
const perCentury=Math.ceil(target/buckets.size);
const selected=[];
for(const [key,items] of [...buckets.entries()].sort((a,b)=>a[0]-b[0])){
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
 const belligerents=item.belligerents||[];
 const conflict=item.parts||[];
 const refs=(item.refs||[]).filter(ref=>typeof ref==='string'&&ref.startsWith('https://'));
 const sources=[{title:'Wikidata — '+item.qid,url:'https://www.wikidata.org/wiki/'+item.qid}];
 for(const ref of refs)sources.push({title:'Wikidata statement reference',url:ref});
 const participantsZh=belligerents.length?'交战方为'+belligerents.slice(0,5).join('、')+'。':'来源未列出交战方。';
 const participantsEn=belligerents.length?'Belligerents recorded: '+belligerents.slice(0,5).join(', ')+'.':'The source does not list belligerents.';
 const conflictZh=conflict.length?'属于'+conflict.slice(0,2).join('、')+'的组成部分。':'';
 const conflictEn=conflict.length?'Part of '+conflict.slice(0,2).join(', ')+'.':'';
 return {
  id:'v312wd-'+item.qid.toLowerCase(),
  title:{zh:item.nameZh,en:item.nameEn},
  start:item.year,end:item.year,lat,lon,region:item.region,category:'war',precision:'year',locationType:'site',
  summary:{
   zh:yearText(item.year)+'，'+item.nameZh+'发生在坐标 '+Math.abs(lat).toFixed(3)+'°'+(lat<0?'S':'N')+'、'+Math.abs(lon).toFixed(3)+'°'+(lon<0?'W':'E')+' 附近。'+conflictZh+participantsZh+'本条为结构化索引条目：名称、年代、坐标与参战方直接取自维基数据实体 '+item.qid+' 的声明'+(refs.length?'及其参考链接':'')+'，未经过本项目的独立史料考订。',
   en:item.nameEn+' took place in '+yearTextEn(item.year)+' near coordinates '+Math.abs(lat).toFixed(3)+'°'+(lat<0?'S':'N')+', '+Math.abs(lon).toFixed(3)+'°'+(lon<0?'W':'E')+'. '+conflictEn+' '+participantsEn+' This is a structured index entry: names, dates, coordinates and participants come directly from Wikidata entity '+item.qid+' statements'+(refs.length?' and their reference links':'')+' and have not been independently verified against scholarship by this project.'},
  significance:{
   zh:conflict.length?('记录了'+conflict[0]+'期间的军事事件，可用于年代与地理定位。'):'记录了'+yearText(item.year)+'的一次军事事件，可用于年代与地理定位。',
   en:conflict.length?('Records a military event during '+conflict[0]+' for chronological and geographic orientation.'):('Records a military event of '+yearTextEn(item.year)+' for chronological and geographic orientation.')},
  sources,
  editorialNotes:{zh:'结构化数据条目：内容为维基数据实体声明的双语索引，不含本项目的独立叙述；断代精度为年，坐标为该实体的 P625 声明值。',en:'Structured data entry: a bilingual index of the Wikidata entity statements without independent editorial narrative; the date precision is one year and the coordinate is the entity P5 statement value.'},
  provenance:'wikidata-structured',wikidataQid:item.qid,regionBasis:'coordinate-box'
 };
});
const output={schemaVersion:1,generatedAt:new Date().toISOString(),
 note:'Structured event expansion generated from the Wikidata battle harvest for the 3.12 volume target. Each entry keeps its entity id and provenance marker so editorial review can filter or replace it later.',
 policy:{source:'Wikidata entity statements (P585 date, P625 coordinate, P710 participants, P361 conflict); statement reference URLs included when recorded.',
  editorial:'No original synthesis: the bilingual text is a rendering of the source statements; entries are marked provenance=wikidata-structured.',
  region:'Region assigned by the documented coordinate box rule (regionBasis=coordinate-box).'},
 count:entries.length,entries};
await writeFile(outPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({out:outPath,requested:target,generated:entries.length,candidates:pick.length,byRegion:entries.reduce((all,item)=>{all[item.region]=(all[item.region]||0)+1;return all},{})},null,2));
