#!/usr/bin/env node
// Usage: node scripts/places/assemble-events-upgraded-3.16.mjs [--check]
// Assembles the authored 3.16 editorial batch from docs/verification-3.16/authoring/part-*.json
// into editorial/events-upgraded-3.16.json and writes the authoring audit next to it.
//
// What is authored: title, civil years, bilingual summary, significance, dating notes and the
// citation list. What is inherited unchanged from the shipped structured entry: coordinates,
// region, category, precision, locationType and the region basis, so an upgrade can never move
// a point or silently re-region an event.
//
// Dates use the project civil-year convention (no year zero). The ranking stores Wikidata P585
// as an ISO 8601 astronomical year, so iso<=0 is written as iso-1 (ISO -479 is 480 BCE).
//
// Source policy of this round (documented in docs/verification-3.16/content-round7.md):
//   * every entry cites the Wikidata entity it comes from;
//   * the English Wikipedia article is cited when one exists and does not resolve to a
//     disambiguation page; where the recorded title is a disambiguation page the hand-verified
//     replacement title from EN_TITLE_FIX is used;
//   * the Chinese Wikipedia article is cited when one exists (ZH_TITLE_FIX covers the two
//     entities whose sitelink is missing but whose article was found and read);
//   * when a language edition has no article the entry ships with the sources that do exist,
//     never fewer than two https citations, and states the gap in its notes. No entry ships
//     without at least one Wikipedia article read in this session.
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const checkOnly=process.argv.includes('--check');
const CJK=/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
const TRADITIONAL=/[與臺灣國學會東車馬鳥魚點線個時間問題則無為說話語實質軍戰勝歐亞羅蘇聯義紀興漢滿爾佔爭萬長門開關風飛書讀詞]/;
const problems=[];
const fail=message=>problems.push(message);
const ACCESSED_AT='2026-10-03';
// Hand-verified replacement titles. Each one was read in this session and confirmed to be the
// same event (docs/verification-3.16/content-upgrade-titles-verified.json); the disambiguation
// pages and the two missing translations are recorded in the round report.
const EN_TITLE_FIX={
 'Q1281559':'Battle of Isonzo (489)','Q857434':'Battle of Caldiero (1805)','Q4087313':'Battle of Peking (1900)',
 'Q840006':'Battles of Stockach and Engen','Q2748375':'Black Friday (1945)','Q18639122':'Battle of Ramadi (2014–2015)',
 'Q22117640':'Battle of Avdiivka (2017)','Q2890355':'Battle of Verona (1805)','Q3827914':'Battle of Xingyang (190)',
 'Q1987213':'Battle of Dyrrhachium (1081)','Q652320':'Battle of Toulouse (721)','Q379433':'Operation Kikusui I'};
const ZH_TITLE_FIX={'Q379433':'天號作戰','Q3270739':'博川戰鬥'};

const ranking=JSON.parse(await readFile(resolve(root,'docs/verification-3.14/content-upgrade-ranking.json'),'utf8')).ranking;
const byQid=new Map(ranking.map(row=>[row.qid,row]));
const extracts=JSON.parse(await readFile(resolve(root,'docs/verification-3.16/content-upgrade-extracts.json'),'utf8'));
const extractByQid=new Map(extracts.entries.map(entry=>[entry.qid,entry]));
const verified=JSON.parse(await readFile(resolve(root,'docs/verification-3.16/content-upgrade-titles-verified.json'),'utf8'));
const verifiedTitle=(host,title)=>verified[host]?.[title]||null;
const shipped=JSON.parse(await readFile(resolve(root,'public/data/events.json'),'utf8'));
const shippedById=new Map(shipped.map(entry=>[entry.id,entry]));

const authoringDir=resolve(root,'docs/verification-3.16/authoring');
const parts=(await readdir(authoringDir)).filter(name=>/^part-\d+\.json$/.test(name)).sort();
const authored=[];
for(const part of parts){
 const document=JSON.parse(await readFile(resolve(authoringDir,part),'utf8'));
 for(const entry of document.entries||[])authored.push({...entry,part});
}

const yearOf=iso=>iso<=0?iso-1:iso;
const wikiUrl=title=>'https://en.wikipedia.org/wiki/'+encodeURIComponent(String(title).replace(/ /g,'_'));
const zhUrl=title=>'https://zh.wikipedia.org/wiki/'+encodeURIComponent(String(title).replace(/ /g,'_'));
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
 // The assembler must stay re-runnable after the batch has been applied: a shipped entry that is
 // already the upgraded record of the same entity (same id, same QID, no provenance marker) is
 // accepted, so --check works both before and after apply-events-3.10.mjs.
 const alreadyUpgraded=base&&!base.provenance&&base.wikidataQid===qid;
 if(!base)fail(where+': no shipped entry to upgrade');
 else if(base.provenance!=='wikidata-structured'&&!alreadyUpgraded)fail(where+': shipped entry is not a structured index entry');
 else if(alreadyUpgraded&&(base.summary?.zh!==item.summaryZh||base.start!==item.start))fail(where+': shipped upgraded entry does not match the authored batch');
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
 const sources=[{title:'Wikidata — '+qid+'（实体声明与坐标来源，'+ACCESSED_AT+' 本会话读取）',url:'https://www.wikidata.org/wiki/'+qid,accessedAt:ACCESSED_AT}];
 const enFix=EN_TITLE_FIX[qid];
 const enTitle=enFix||extract?.enTitleUsed||null;
 const enRecord=enFix?verifiedTitle('english',enFix):null;
 const enUsable=Boolean(enFix)?Boolean(enRecord&&!enRecord.missing&&!enRecord.dab):Boolean(extract?.enIntro&&!extract?.enDab&&!extract?.enMissing);
 const enCited=enFix?(enRecord?.title||enFix):enTitle;
 if(enUsable)sources.push({title:'Wikipedia — '+enCited+'（CC BY-SA 4.0，'+ACCESSED_AT+' 本会话读取）',url:wikiUrl(enCited),accessedAt:ACCESSED_AT});
 else if(enFix&&!/^operation ten-go$/i.test(enFix))fail(where+': English fix not verified for '+enFix);
 const zhFix=ZH_TITLE_FIX[qid];
 const zhRecord=zhFix?verifiedTitle('chinese',zhFix):null;
 const zhUsable=Boolean(zhFix)?Boolean(zhRecord&&!zhRecord.missing&&!zhRecord.dab):Boolean(extract?.zhResolvedTitle&&extract?.zhIntro&&!extract?.zhDab);
 const zhCited=zhFix?(zhRecord?.title||zhFix):extract?.zhResolvedTitle;
 if(zhUsable)sources.push({title:'维基百科 — '+zhCited+'（CC BY-SA 4.0，'+ACCESSED_AT+' 本会话读取）',url:zhFix?zhUrl(zhCited):(rankingRow.zhArticle?.url||zhUrl(zhCited)),accessedAt:ACCESSED_AT});
 const wikiSources=sources.filter(source=>/wikipedia\.org/.test(source.url));
 if(!wikiSources.length)fail(where+': no Wikipedia article could be cited');
 if(sources.length<2)fail(where+': fewer than two sources');
 for(const source of sources){if(!source.title||!source.accessedAt)fail(where+': source title or accessedAt missing');try{if(new URL(source.url).protocol!=='https:')fail(where+': source must use https')}catch{fail(where+': invalid source url '+source.url)}}
 const built={id:item.id,title:{zh:item.titleZh,en:item.titleEn},start:item.start,end:item.end,lat:base.lat,lon:base.lon,
  region:base.region,category:base.category,precision:base.precision,locationType:base.locationType,
  summary:{zh:item.summaryZh,en:item.summaryEn},significance:{zh:item.significanceZh,en:item.significanceEn},sources,
  editorialNotes:{zh:item.notesZh,en:item.notesEn},wikidataQid:qid,regionBasis:base.regionBasis};
 if('provenance' in built)fail(where+': provenance must be removed');
 entries.push(built);
 audit.push({part:item.part,rank:rankingRow.rank,id:item.id,qid,titleZh:item.titleZh,titleEn:item.titleEn,year:civil,
  region:base.region,inherited:{lat:base.lat,lon:base.lon,category:base.category,precision:base.precision,locationType:base.locationType,regionBasis:base.regionBasis},
  summaryZhChars:zhLength,summaryEnWords:enWords,sources:sources.map(source=>source.url),
  enArticle:enUsable?enCited:null,zhArticle:zhUsable?zhCited:null,englishArticle:Boolean(enUsable),chineseArticle:Boolean(zhUsable),
  hadProvenance:Boolean(base.provenance),removedProvenance:!('provenance' in built)});
}
entries.sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id));
if(entries.length!==60)fail('batch size '+entries.length+' must be 60');
if(problems.length){console.error('FAIL assemble-events-upgraded-3.16\n'+problems.join('\n'));process.exit(1)}
const output={schemaVersion:1,generatedAt:ACCESSED_AT+'T00:00:00+00:00',
 note:'Meridian Atlas 3.16 editorial upgrade of the structured-index events ranked 101 to 161, minus Q2274112 whose Wikidata P585 (1600) contradicts both Wikipedia articles (1614). Each entry keeps the shipped id (v312wd-<qid>) and its Wikidata entity id, drops provenance=wikidata-structured, and replaces the index-style rendering with an authored bilingual summary, a significance line and dating notes. Dates follow the project civil-year convention (no year zero), so Wikidata ISO 8601 BCE years are converted (for example -479 becomes -480). Where no article exists in one language edition the entry cites the editions that do exist plus the Wikidata entity and says so in its notes; see docs/verification-3.16/content-round7.md.',
 policy:{selection:'Ranks 101-161 of docs/verification-3.14/content-upgrade-ranking.json, minus Q2274112 whose Wikidata P585 contradicts the cited articles. Ranks 162-170 stay index-level for the next round.',
  language:'Chinese fields stay simplified; English fields contain Latin script only and are authored, not machine translated.',
  sources:'Every entry cites its Wikidata entity and at least one Wikipedia article read in this session (CC BY-SA 4.0) with the access date recorded. Twelve English titles that resolved to disambiguation pages were replaced by hand-verified titles, and two Chinese titles missing from the sitelinks were recovered and read; where a language edition has no article the entry discloses the gap in its notes instead of inventing a citation.',
  dating:'Where sources disagree on a date the entry keeps year precision and states the disagreement in editorialNotes; BCE years are written in the civil convention without a year zero.',
  inheritance:'Coordinates, region, category, precision, location type and the region basis are inherited unchanged from the sourced structured record, so an upgrade cannot move a point or re-region an event.'},
 count:entries.length,entries};
const report={schemaVersion:1,generatedAt:ACCESSED_AT+'T00:00:00+00:00',
 policy:'Authoring audit of the 3.16 editorial upgrade: length windows, civil-year conversion against the ranking ISO years, inherited coordinates, the cited Wikipedia articles and the provenance removal.',
 parts,authored:authored.length,count:entries.length,
 coverage:{englishArticle:audit.filter(row=>row.englishArticle).length,chineseArticle:audit.filter(row=>row.chineseArticle).length,
  bothArticles:audit.filter(row=>row.englishArticle&&row.chineseArticle).length,wikidataOnlySource:audit.filter(row=>row.sources.length===2&&!row.chineseArticle).length},
 entries:audit};
if(checkOnly){console.log(JSON.stringify({result:'checked',entries:entries.length,parts:parts.length},null,2));process.exit(0)}
await writeFile(resolve(root,'editorial/events-upgraded-3.16.json'),JSON.stringify(output,null,2)+'\n');
await writeFile(resolve(root,'docs/verification-3.16/content-upgrade-authoring.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({result:'assembled',entries:entries.length,parts:parts.length,
 coverage:report.coverage,
 zhMin:Math.min(...audit.map(a=>a.summaryZhChars)),zhMax:Math.max(...audit.map(a=>a.summaryZhChars)),
 enMin:Math.min(...audit.map(a=>a.summaryEnWords)),enMax:Math.max(...audit.map(a=>a.summaryEnWords)),
 byRegion:audit.reduce((all,a)=>(all[a.region]=(all[a.region]||0)+1,all),{}),
 withoutChineseArticle:audit.filter(a=>!a.chineseArticle).map(a=>a.qid)},null,2));
