#!/usr/bin/env node
// Usage: node scripts/places/build-battles.mjs [--check]
// Builds public/data/battles.json(+.gz) from the Wikidata harvest in
// editorial/battles-wikidata-source.json. Coordinates, dates, participants and
// conflict context come from the source entity statements; nothing is invented.
// Items without a Chinese label or without usable coordinates are dropped and counted.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const checkOnly=process.argv.includes('--check');
const source=JSON.parse(await readFile(resolve(root,'editorial/battles-wikidata-source.json'),'utf8'));
const TARGET=520;
const CENTURIES=[[-4000,-1500],[-1500,-500],[-500,1],[1,500],[500,1000],[1000,1500],[1500,1800],[1800,1900],[1900,1945],[1945,2000],[2000,2027]];
const REGION_ORDER=['east-asia','southeast-asia','south-asia','west-central-asia','europe','africa','americas','oceania'];
const inBox=(lon,lat,box)=>lon>=box[0]&&lon<=box[2]&&lat>=box[1]&&lat<=box[3];
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
const candidates=[];
const dropped={noChineseLabel:0,badCoordinates:0,badYear:0,duplicate:0};
const seen=new Set();
for(const item of source.items){
 const nameZh=(item.labelZh||'').trim();
 const nameEn=(item.enLabel||(item.labelLang==='en'?item.label:'' )||'').trim();
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
 for(const ref of item.refs||[])sources.push({title:'Wikidata statement reference',url:ref});
 candidates.push({id,qid:item.qid,nameZh,nameEn,year,start:year,end:year,coordinates,region,
  belligerents:(item.belligerents||[]).slice(0,6),conflict:(item.parts||[]).slice(0,3),countries:(item.countries||[]).slice(0,3),sources,
  notes:item.refs&&item.refs.length?'坐标与年代取自维基数据实体声明，并附该声明中的参考链接。':'维基数据实体声明未附参考链接；坐标与年代以实体声明为准，发布前建议补一次文献核对。',
  regionBasis:'coordinate-box'});
}
// Spread the selection across centuries and regions so the layer is not dominated by
// one war. Within each century, prefer entries with belligerents and conflict context.
const byCentury=new Map();
for(const item of candidates){
 const century=CENTURIES.findIndex(([from,to])=>item.year>=from&&item.year<to);
 const key=century<0?CENTURIES.length-1:century;
 if(!byCentury.has(key))byCentury.set(key,[]);
 byCentury.get(key).push(item);
}
const score=item=>(item.belligerents.length?2:0)+(item.conflict.length?1:0)+(item.sources.length>1?1:0);
const selected=[];
const perCentury=Math.ceil(TARGET/byCentury.size);
for(const [century,items] of [...byCentury.entries()].sort((a,b)=>a[0]-b[0])){
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
const byRegion=battles.reduce((all,item)=>{all[item.region]=(all[item.region]||0)+1;return all},{});
const byCenturyOut=battles.reduce((all,item)=>{const c=CENTURIES.find(([from,to])=>item.year>=from&&item.year<to);const key=c?c[0]+'..'+(c[1]-1):'other';all[key]=(all[key]||0)+1;return all},{});
const document={schemaVersion:1,builtAt:'2026-10-03T00:00:00+00:00',layer:'battles',
 policy:{
  coordinates:'Points come from the Wikidata P625 statement of the battle entity; no coordinate is estimated or moved.',
  participants:'Belligerents come from P710 statements of the same entity; empty arrays mean the source does not state them and no value was invented.',
  dates:'Years come from the P585 statement; single-year precision is retained and no month or day is inferred.',
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
console.log(JSON.stringify({result:'built',shipped:battles.length,byRegion,byCentury:byCenturyOut,dropped,gzipBytes:gzip.length,jsonBytes:Buffer.byteLength(text)},null,2));
