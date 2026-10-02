#!/usr/bin/env node
// Usage: node scripts/places/assemble-events-upgraded-3.15.mjs [--check]
// Assembles the authored 3.15 editorial batch from docs/verification-3.15/authoring/part-*.json
// into editorial/events-upgraded-3.15.json and writes the authoring audit next to it.
//
// What is authored: title, civil years, bilingual summary, significance, dating notes and the
// citation list. What is inherited unchanged from the shipped structured entry: coordinates,
// region, category, precision, locationType and the region basis, so an upgrade can never move
// a point or silently re-region an event.
//
// Dates use the project civil-year convention (no year zero). The ranking stores Wikidata P585
// as an ISO 8601 astronomical year, so iso<=0 is written as iso-1 (ISO -489 is 490 BCE).
//
// The script refuses to emit a batch when a summary is outside the authored length window, when
// a title resolved to a Wikipedia disambiguation page, when a citation is missing, or when an
// English field contains CJK or a Chinese field contains a traditional-only character.
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const checkOnly=process.argv.includes('--check');
const CJK=/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
const TRADITIONAL=/[與臺灣國學會東車馬鳥魚點線個時間問題則無為說話語實質軍戰勝歐亞羅蘇聯義紀興漢滿爾佔爭萬長門開關風飛書讀詞]/;
const problems=[];
const fail=message=>problems.push(message);
const KEY_ORDER=['id','title','start','end','lat','lon','region','category','precision','locationType','summary','significance','sources','editorialNotes'];

const ranking=JSON.parse(await readFile(resolve(root,'docs/verification-3.14/content-upgrade-ranking.json'),'utf8')).ranking;
const byQid=new Map(ranking.map(row=>[row.qid,row]));
const extracts=JSON.parse(await readFile(resolve(root,'docs/verification-3.15/content-upgrade-extracts.json'),'utf8'));
const extractByQid=new Map(extracts.entries.map(entry=>[entry.qid,entry]));
const shipped=JSON.parse(await readFile(resolve(root,'public/data/events.json'),'utf8'));
const shippedById=new Map(shipped.map(entry=>[entry.id,entry]));

const authoringDir=resolve(root,'docs/verification-3.15/authoring');
const parts=(await readdir(authoringDir)).filter(name=>/^part-\d+\.json$/.test(name)).sort();
const authored=[];
for(const part of parts){
 const document=JSON.parse(await readFile(resolve(authoringDir,part),'utf8'));
 for(const entry of document.entries||[])authored.push({...entry,part});
}

const ACCESSED_AT='2026-10-03';
const yearOf=iso=>iso<=0?iso-1:iso;
const entries=[];
const audit=[];
const seen=new Set();
for(const item of authored){
 const where=item.id||'(missing id)';
 if(seen.has(item.id))fail('duplicate id in authoring parts: '+item.id);
 seen.add(item.id);
 const qid=(item.id.match(/^v312wd-(q\d+)$/i)||[])[1]?.toUpperCase();
 if(!/^v312wd-q\d+$/i.test(item.id))fail(where+': id must stay v312wd-<qid>');
 const rankingRow=byQid.get(qid);
 if(!rankingRow)fail(where+': no ranking row for '+qid);
 const extract=extractByQid.get(qid);
 if(!extract)fail(where+': no research extract for '+qid);
 const base=shippedById.get(item.id);
 if(!base)fail(where+': no shipped entry to upgrade');
 else if(base.provenance!=='wikidata-structured')fail(where+': shipped entry is not a structured index entry');
 const iso=rankingRow?.year;
 if(!Number.isInteger(iso))fail(where+': ranking year is not an integer');
 const civil=Number.isInteger(iso)?yearOf(iso):null;
 if(Number.isInteger(civil)&&(item.start!==civil||item.end!==civil))fail(where+': authored year '+item.start+' does not match the civil year '+civil+' of ISO '+iso);
 if(!Number.isInteger(item.start)||item.start===0||item.start>item.end)fail(where+': bad year range');
 if(!Number.isInteger(item.end)||item.end>2024)fail(where+': end year outside the supported range');
 const zhLength=[...String(item.summaryZh||'')].length;
 const enWords=String(item.summaryEn||'').trim().split(/\s+/).filter(Boolean).length;
 if(zhLength<110||zhLength>135)fail(where+': summary.zh is '+zhLength+' characters, expected 110-135');
 if(enWords<45||enWords>60)fail(where+': summary.en is '+enWords+' words, expected 45-60');
 for(const [field,value] of [['summary.zh',item.summaryZh],['summary.en',item.summaryEn],['significance.zh',item.significanceZh],['significance.en',item.significanceEn],['notes.zh',item.notesZh],['notes.en',item.notesEn]]){
  if(typeof value!=='string'||value.trim().length<8)fail(where+': '+field+' missing or too short');
 }
 if([...String(item.titleZh||'')].length<2||[...String(item.titleZh||'')].length>40)fail(where+': title.zh length');
 if(CJK.test(String(item.titleEn||''))||CJK.test(String(item.summaryEn||''))||CJK.test(String(item.significanceEn||''))||CJK.test(String(item.notesEn||'')))fail(where+': CJK character in an English field');
 for(const [field,value] of [['title.zh',item.titleZh],['summary.zh',item.summaryZh],['significance.zh',item.significanceZh],['notes.zh',item.notesZh]]){
  const hit=String(value||'').match(TRADITIONAL);
  if(hit)fail(where+': traditional-only character in '+field+': '+[...new Set(hit)].join(''));
 }
 if(extract?.enDab)fail(where+': English citation resolved to a disambiguation page ('+extract.enResolvedTitle+')');
 if(extract?.zhDab)fail(where+': Chinese citation resolved to a disambiguation page ('+extract.zhResolvedTitle+')');
 if(!extract?.zhResolvedTitle)fail(where+': no resolved Chinese article title');
 const sources=[
  {title:'Wikipedia — '+extract.enTitleUsed+'（CC BY-SA 4.0，'+ACCESSED_AT+' 本会话读取）',url:'https://en.wikipedia.org/wiki/'+encodeURIComponent(String(extract.enTitleUsed).replace(/ /g,'_')),accessedAt:ACCESSED_AT},
  {title:'维基百科 — '+extract.zhResolvedTitle+'（CC BY-SA 4.0，'+ACCESSED_AT+' 本会话读取）',url:rankingRow.zhArticle.url,accessedAt:ACCESSED_AT}
 ];
 const built={id:item.id,title:{zh:item.titleZh,en:item.titleEn},start:item.start,end:item.end,lat:base.lat,lon:base.lon,
  region:base.region,category:base.category,precision:base.precision,locationType:base.locationType,
  summary:{zh:item.summaryZh,en:item.summaryEn},significance:{zh:item.significanceZh,en:item.significanceEn},sources,
  editorialNotes:{zh:item.notesZh,en:item.notesEn},wikidataQid:qid,regionBasis:base.regionBasis};
 entries.push(built);
 audit.push({part:item.part,rank:rankingRow.rank,id:item.id,qid,titleZh:item.titleZh,titleEn:item.titleEn,year:civil,
  region:base.region,inherited:{lat:base.lat,lon:base.lon,category:base.category,precision:base.precision,locationType:base.locationType,regionBasis:base.regionBasis},
  summaryZhChars:zhLength,summaryEnWords:enWords,sources:sources.map(source=>source.url),enArticle:extract.enTitleUsed,zhArticle:extract.zhResolvedTitle,
  hadProvenance:Boolean(base.provenance)});
}
entries.sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id));
if(entries.length<40||entries.length>60)fail('batch size '+entries.length+' outside the required 40-60');
if(problems.length){console.error('FAIL assemble-events-upgraded-3.15\n'+problems.join('\n'));process.exit(1)}
const output={schemaVersion:1,generatedAt:ACCESSED_AT+'T00:00:00+00:00',
 note:'Meridian Atlas 3.15 editorial upgrade of the structured-index events ranked 41 to 100. Each entry keeps the shipped id (v312wd-<qid>) and its Wikidata entity id, drops provenance=wikidata-structured, and replaces the index-style rendering with an authored bilingual summary, a significance line and dating notes cited to English and Chinese Wikipedia articles read in this session. Dates follow the project civil-year convention (no year zero), so Wikidata ISO 8601 BCE years are converted (for example -489 becomes -490). Two candidates of the window stay index-level because Wikidata records them with a year that contradicts both Wikipedia articles; see docs/verification-3.15/content-round6.md.',
 policy:{selection:'Ranks 41-100 of docs/verification-3.14/content-upgrade-ranking.json, minus the two entities whose Wikidata P585 contradicts the cited articles.',
  language:'Chinese fields stay simplified; English fields contain Latin script only and are authored, not machine translated.',
  sources:'Every entry cites the English and Chinese Wikipedia article read in this session (CC BY-SA 4.0) with the access date recorded; coordinates, region and location type are inherited unchanged from the sourced structured record.',
  dating:'Where sources disagree on a date the entry keeps year precision and states the disagreement in editorialNotes; BCE years are written in the civil convention without a year zero.'},
 count:entries.length,entries};
const report={schemaVersion:1,generatedAt:ACCESSED_AT+'T00:00:00+00:00',policy:'Authoring audit of the 3.15 editorial upgrade: length windows, civil-year conversion against the ranking ISO years, inherited coordinates and the Wikipedia articles cited.',
 parts,authored:authored.length,count:entries.length,entries:audit};
if(checkOnly){console.log(JSON.stringify({result:'checked',entries:entries.length,parts:parts.length},null,2));process.exit(0)}
await writeFile(resolve(root,'editorial/events-upgraded-3.15.json'),JSON.stringify(output,null,2)+'\n');
await writeFile(resolve(root,'docs/verification-3.15/content-upgrade-authoring.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({result:'assembled',entries:entries.length,parts:parts.length,
 zhMin:Math.min(...audit.map(a=>a.summaryZhChars)),zhMax:Math.max(...audit.map(a=>a.summaryZhChars)),
 enMin:Math.min(...audit.map(a=>a.summaryEnWords)),enMax:Math.max(...audit.map(a=>a.summaryEnWords)),
 byRegion:audit.reduce((all,a)=>(all[a.region]=(all[a.region]||0)+1,all),{})},null,2));
