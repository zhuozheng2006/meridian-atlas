#!/usr/bin/env node
// Usage: node scripts/places/assemble-events-upgraded-3.20.mjs [--check] [--expect=13]
// Assembles the authored 3.20 editorial batch from docs/verification-3.20/authoring/part-*.json
// into editorial/events-upgraded-3.20.json and writes the authoring audit next to it.
//
// The batch continues the close-out of the structured-index backlog: the 53 entries that were
// still index-level after 3.18, ordered by the same 3.17 re-ranking. This round covers ranks
// 81-120 and leaves 13. What is authored: title, civil years, bilingual summary,
// significance and the dating/language notes. What is inherited unchanged from the shipped
// structured entry: coordinates, region, category, precision, locationType and regionBasis, so
// an upgrade can never move a point or silently re-region an event.
//
// Dating: the project uses civil years without a year zero. Wikidata P585 is ISO 8601
// astronomical, and its precision is not always a year (several entries carry decade
// precision), so the authored date was checked against the article text. Where it differs from
// the index year the entry must carry a yearCorrection with the reason; four of them were
// verified by hand in this round and one by the round report (Q2274112).
//
// Sources: the Wikidata entity, plus the English article (the current enwiki sitelink, or the
// title it redirects to) and the Chinese article when one exists. Where a language edition has
// no article the entry ships without that citation and states the gap in its notes. No entry
// ships without at least one Wikipedia article read in this session.
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CJK,traditionalHits,countChars,countWords} from './lib/zh-gates.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const checkOnly=process.argv.includes('--check');
const expectArg=process.argv.find(value=>value.startsWith('--expect='));
const expect=expectArg?Number(expectArg.slice('--expect='.length)):13;
const ACCESSED_AT='2026-10-03';
// Chinese articles that are not in the Wikidata sitelink but were found by search and read in
// this session. Only a title confirmed to document the same event may be cited; each one is
// listed here by hand with the confirmation recorded in the round report.
const ZH_ARTICLE_VERIFIED={};
// One recorded English title is flagged as a disambiguation page by the introduction heuristic
// but is in fact a short article: "Battle of Akhaltsikhe" opens with "may refer to one of the
// following" and then documents the 1828 offensive under the walls of the fortress (the battle
// of this entry, 21 August / 9 August O.S. 1828) and the 1829 defence of the same place. The
// page was read in this session, and the entry states in its notes that the page covers both.
const EN_DAB_OVERRIDE={'Q3486072':'Battle of Akhaltsikhe'};
// English articles whose sitelink is a redirect to a broader article; the citation uses the
// resolved page and the note says so.
const EN_REDIRECT_NOTE={'Q112206624':'Battle of Donau (2022)'};

const ranking=JSON.parse(await readFile(resolve(root,'docs/verification-3.17/content-upgrade-ranking.json'),'utf8'));
const byQid=new Map(ranking.ranking.map(row=>[row.qid,row]));
const extracts=JSON.parse(await readFile(resolve(root,'docs/verification-3.20/content-upgrade-extracts.json'),'utf8'));
const extractByQid=new Map(extracts.entries.map(entry=>[entry.qid,entry]));
const shipped=JSON.parse(await readFile(resolve(root,'public/data/events.json'),'utf8'));
const shippedById=new Map(shipped.map(entry=>[entry.id,entry]));

const authoringDir=resolve(root,'docs/verification-3.20/authoring');
const parts=(await readdir(authoringDir)).filter(name=>/^part-\d+\.json$/.test(name)).sort();
const authored=[];
for(const part of parts){
 const document=JSON.parse(await readFile(resolve(authoringDir,part),'utf8'));
 for(const entry of document.entries||[])authored.push({...entry,part});
}
const urls={en:title=>'https://en.wikipedia.org/wiki/'+encodeURIComponent(String(title).replace(/ /g,'_')),
 zh:title=>'https://zh.wikipedia.org/wiki/'+encodeURIComponent(String(title).replace(/ /g,'_'))};
const problems=[];
const fail=message=>problems.push(message);
const entries=[];
const audit=[];
const seen=new Set();
for(const item of authored){
 const where=item.id||'(missing id)';
 if(seen.has(item.id))fail('duplicate id in authoring parts: '+item.id);
 seen.add(item.id);
 const qid=String(item.qid||'').toUpperCase();
 if(!/^v312wd-q\d+$/i.test(String(item.id||'')))fail(where+': id must stay v312wd-<qid>');
 if(item.id!=='v312wd-'+qid.toLowerCase())fail(where+': id does not match qid '+qid);
 const row=byQid.get(qid);
 if(!row)fail(where+': no 3.17 ranking row for '+qid);
 const extract=extractByQid.get(qid);
 if(!extract)fail(where+': no research extract for '+qid);
 const base=shippedById.get(item.id);
 const alreadyUpgraded=base&&!base.provenance&&base.wikidataQid===qid;
 if(!base)fail(where+': no shipped entry to upgrade');
 else if(base.provenance!=='wikidata-structured'&&!alreadyUpgraded)fail(where+': shipped entry is not a structured index entry');
 else if(alreadyUpgraded&&(base.summary?.zh!==item.summaryZh||base.start!==item.start))fail(where+': shipped upgraded entry does not match the authored batch');
 if('provenance' in item)fail(where+': provenance must not be present');
 if(!Number.isInteger(item.start)||!Number.isInteger(item.end)||item.start===0||item.end===0)fail(where+': bad civil year');
 else{
  if(item.start>item.end)fail(where+': start after end');
  if(item.start<-4000||item.end>2024)fail(where+': year outside the supported range');
  const correction=item.yearCorrection||null;
  if(correction){
   if(correction.from!==row.year)fail(where+': yearCorrection.from must be the index year '+row.year);
   if(correction.start!==item.start||correction.end!==item.end)fail(where+': yearCorrection does not match start/end');
   if(typeof correction.reason!=='string'||correction.reason.trim().length<20)fail(where+': yearCorrection.reason too short');
  }else if(item.start!==row.year||item.end!==row.year)fail(where+': dates differ from the index year '+row.year+' without a yearCorrection');
 }
 const zhChars=countChars(item.summaryZh),enWords=countWords(item.summaryEn);
 if(zhChars<110||zhChars>135)fail(where+': summary.zh is '+zhChars+' characters, expected 110-135');
 if(enWords<45||enWords>60)fail(where+': summary.en is '+enWords+' words, expected 45-60');
 for(const [field,value] of [['summary.zh',item.summaryZh],['summary.en',item.summaryEn],['significance.zh',item.significanceZh],['significance.en',item.significanceEn],['notes.zh',item.notesZh],['notes.en',item.notesEn]]){
  if(typeof value!=='string'||value.trim().length<8)fail(where+': '+field+' missing or too short');
 }
 if(countChars(item.titleZh)<2||countChars(item.titleZh)>40)fail(where+': title.zh length');
 if(!/^[\p{Script=Latin}\p{Nd}][\p{Script=Latin}\p{Nd} .,'()\u2013\u2014\/&:-]*$/u.test(String(item.titleEn||'')))fail(where+': title.en must be Latin script');
 for(const field of ['titleEn','summaryEn','significanceEn','notesEn'])if(CJK.test(String(item[field]||'')))fail(where+': CJK character in English field '+field);
 for(const field of ['titleZh','summaryZh','significanceZh','notesZh']){
  const hits=await traditionalHits(item[field]);
  if(hits.length)fail(where+': traditional-only character in '+field+': '+hits.join(''));
 }
 // Citations: the current enwiki sitelink (resolved) and, when one exists, the Chinese article.
 const enOverrideTitle=EN_DAB_OVERRIDE[qid];
 if(enOverrideTitle&&!extract?.enDab)fail(where+': English dab override is set but the recorded title is not a disambiguation page');
 const enTitle=extract?.enTitleRequested&&!extract.enMissing&&(!extract.enDab||enOverrideTitle)?(enOverrideTitle||extract.enResolvedTitle||extract.enTitleRequested):null;
 const zhFromSitelink=extract?.zhTitleRequested&&!extract.zhMissing&&!extract.zhDab?(extract.zhResolvedTitle||extract.zhTitleRequested):null;
 const zhVerified=item.zhArticleFound?ZH_ARTICLE_VERIFIED[qid]:null;
 if(item.zhArticleFound&&!zhVerified)fail(where+': zhArticleFound '+item.zhArticleFound+' is not in the hand-verified list');
 const zhTitle=zhFromSitelink||(zhVerified?zhVerified.title:null);
 const gap=item.languageGap||{};
 if(Boolean(gap.zhArticle)!==Boolean(zhTitle))fail(where+': languageGap.zhArticle does not match the citation evidence');
 if(Boolean(gap.enArticle)!==Boolean(enTitle))fail(where+': languageGap.enArticle does not match the citation evidence');
 if(!zhTitle&&!enTitle)fail(where+': no Wikipedia article could be cited');
 const sources=[{title:'Wikidata — '+qid+'（实体声明与坐标来源，'+ACCESSED_AT+' 本会话读取）',url:'https://www.wikidata.org/wiki/'+qid,accessedAt:ACCESSED_AT}];
 if(enTitle)sources.push({title:'Wikipedia — '+enTitle+'（CC BY-SA 4.0，'+ACCESSED_AT+' 本会话读取）',url:urls.en(enTitle),accessedAt:ACCESSED_AT});
 if(zhTitle)sources.push({title:'维基百科 — '+zhTitle+'（CC BY-SA 4.0，'+ACCESSED_AT+' 本会话读取）',url:urls.zh(zhTitle),accessedAt:ACCESSED_AT});
 if(sources.length<2)fail(where+': fewer than two sources');
 for(const source of sources){if(!source.title||!source.accessedAt)fail(where+': source title or accessedAt missing');try{if(new URL(source.url).protocol!=='https:')fail(where+': source must use https')}catch{fail(where+': invalid source url '+source.url)}}
 const built={id:item.id,title:{zh:item.titleZh,en:item.titleEn},start:item.start,end:item.end,lat:base.lat,lon:base.lon,
  region:base.region,category:base.category,precision:base.precision,locationType:base.locationType,
  summary:{zh:item.summaryZh,en:item.summaryEn},significance:{zh:item.significanceZh,en:item.significanceEn},sources,
  editorialNotes:{zh:item.notesZh,en:item.notesEn},wikidataQid:qid,regionBasis:base.regionBasis};
 entries.push(built);
 audit.push({part:item.part,rank:row.rank,previousRank:row.previousRank,id:item.id,qid,titleZh:item.titleZh,titleEn:item.titleEn,
  year:item.start,end:item.end,indexYear:row.year,yearCorrection:item.yearCorrection||null,region:base.region,
  inherited:{lat:base.lat,lon:base.lon,category:base.category,precision:base.precision,locationType:base.locationType,regionBasis:base.regionBasis},
  summaryZhChars:zhChars,summaryEnWords:enWords,englishArticle:Boolean(enTitle),chineseArticle:Boolean(zhTitle),
  enArticleRedirected:Boolean(enTitle&&extract?.enTitleRequested!==enTitle),
  sources:sources.map(source=>source.url),hadProvenance:Boolean(base.provenance),removedProvenance:!('provenance' in built)});
}
entries.sort((a,b)=>a.start-b.start||a.end-b.end||a.id.localeCompare(b.id));
if(entries.length!==expect)fail('batch size '+entries.length+' must be '+expect);
if(problems.length){console.error('FAIL assemble-events-upgraded-3.20\n'+problems.join('\n'));process.exit(1)}
const output={schemaVersion:1,generatedAt:ACCESSED_AT+'T00:00:00+00:00',
 note:'Meridian Atlas 3.20 editorial upgrade of the structured-index events ranked 41 to 80 by the 3.17 re-ranking (docs/verification-3.17/content-upgrade-ranking.json). Each entry keeps the shipped id (v312wd-<qid>) and its Wikidata entity id, drops provenance=wikidata-structured, and replaces the index rendering with an authored bilingual summary, a significance line and dating/language notes. Dates follow the civil-year convention (no year zero); where the article text and the Wikidata P585 value disagree the entry carries the documented correction and states the disagreement in its notes. Where a language edition has no article the entry cites the editions that do exist plus the Wikidata entity and says so in its notes. See docs/verification-3.20/content-round9.md.',
 policy:{selection:'The 93 structured-index events that were still index-level after 3.17, ordered by the 3.17 re-ranking, which counts a Chinese or an English article as evidence of lookup demand. This batch covers ranks 121-133, the last index-level entries: after it the structured index is empty and every one of the 291 ranked entities is editorial.',
  language:'Chinese fields stay simplified; English fields contain Latin script only and are authored from the cited article, not machine translated.',
  sources:'Every entry cites its Wikidata entity and at least one Wikipedia article read in this session (CC BY-SA 4.0) with the access date recorded. English citations use the current enwiki sitelink (or the page it redirects to); Chinese citations exist for the entities that have a Chinese article, and where a language edition has no article the entry discloses the gap in its notes instead of inventing a citation.',
  dating:'Wikidata P585 is ISO 8601 astronomical and is not always year precision; the authored date was checked against the article text. One entry carries a documented correction verified by hand in this round (Q786657, whose Wikidata P585 records the year 2000 for a battle of January 1811) and every disagreement between the index year and the article is stated in editorialNotes.',
  inheritance:'Coordinates, region, category, precision, location type and the region basis are inherited unchanged from the sourced structured record, so an upgrade cannot move a point or re-region an event.'},
 count:entries.length,entries};
const report={schemaVersion:1,generatedAt:ACCESSED_AT+'T00:00:00+00:00',
 policy:'Authoring audit of the 3.20 editorial upgrade: length windows, civil years against the index year and the documented corrections, inherited coordinates, the cited Wikipedia articles and the provenance removal.',
 parts,authored:authored.length,count:entries.length,
 coverage:{englishArticle:audit.filter(row=>row.englishArticle).length,chineseArticle:audit.filter(row=>row.chineseArticle).length,
  bothArticles:audit.filter(row=>row.englishArticle&&row.chineseArticle).length,withoutChineseArticle:audit.filter(row=>!row.chineseArticle).length,
  correctedYears:audit.filter(row=>row.yearCorrection).length},
 entries:audit};
if(checkOnly){console.log(JSON.stringify({result:'checked',entries:entries.length,parts:parts.length,coverage:report.coverage},null,2));process.exit(0)}
await mkdir(authoringDir,{recursive:true});
await writeFile(resolve(root,'editorial/events-upgraded-3.20.json'),JSON.stringify(output,null,2)+'\n');
await writeFile(resolve(root,'docs/verification-3.20/content-upgrade-authoring.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({result:'assembled',entries:entries.length,parts:parts.length,coverage:report.coverage,
 zhMin:Math.min(...audit.map(row=>row.summaryZhChars)),zhMax:Math.max(...audit.map(row=>row.summaryZhChars)),
 enMin:Math.min(...audit.map(row=>row.summaryEnWords)),enMax:Math.max(...audit.map(row=>row.summaryEnWords)),
 byRegion:audit.reduce((all,row)=>(all[row.region]=(all[row.region]||0)+1,all),{}),
 corrections:audit.filter(row=>row.yearCorrection).map(row=>[row.qid,row.indexYear,row.year,row.end]),
 withoutChineseArticle:audit.filter(row=>!row.chineseArticle).length},null,2));