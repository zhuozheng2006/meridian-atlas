#!/usr/bin/env node
// Usage: node scripts/places/rank-structured-events-3.17.mjs [--out=docs/verification-3.17/content-upgrade-ranking.json]
//
// Re-ranks the structured-index events that are still in the corpus for the 3.17 closing
// upgrade pass. The 3.14 ranking scored a Chinese Wikipedia article higher than anything
// else, which was right for the first three batches but left the tail: after rank 171 every
// remaining entity has no Chinese article, and 131 of the 133 remaining entities do have an
// English article. Scoring a Chinese *or* English article turns that tail into a workable
// candidate list while still preferring entities a Chinese reader can already find.
//
//   score = 3 * (has zh or en Wikipedia article)
//         + min(sitelinks, 40) / 10
//         + 0.5 * (belligerents recorded: Wikidata P710 or the shipped participant list)
//         + 2 * (has Chinese Wikipedia article)
//
// Sitelink counts are the 3.14 WDQS counts (cached with the request log); they are not
// re-queried, so this script makes no network calls and is deterministic. Article presence
// is read from the Wikidata sitelinks fetched for this round
// (docs/verification-3.17/content-upgrade-evidence.json), which is stronger evidence than
// the 3.14 ranking had: it is the current enwiki/zhwiki sitelink of the entity itself.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const arg=name=>{const hit=process.argv.find(value=>value.startsWith('--'+name+'='));return hit?hit.slice(name.length+3):null};
const outPath=resolve(root,arg('out')||'docs/verification-3.17/content-upgrade-ranking.json');
const events=JSON.parse(await readFile(resolve(root,'public/data/events.json'),'utf8'));
const evidence=JSON.parse(await readFile(resolve(root,'docs/verification-3.17/content-upgrade-evidence.json'),'utf8'));
const raw=JSON.parse(await readFile(resolve(root,'docs/verification-3.14/content-upgrade-ranking-raw.json'),'utf8'));
const previous=JSON.parse(await readFile(resolve(root,'docs/verification-3.14/content-upgrade-ranking.json'),'utf8'));
const previousRank=new Map(previous.ranking.map(row=>[row.qid,row.rank]));
const evidenceByQid=new Map(evidence.rows.map(row=>[row.qid,row]));
const structured=events.filter(event=>event.provenance==='wikidata-structured'&&/^Q\d+$/.test(String(event.wikidataQid||'')));

const rows=structured.map(event=>{
 const qid=event.wikidataQid;
 const record=evidenceByQid.get(qid);
 const enTitle=record?.enwiki||null;
 const zhTitle=record?.zhwiki||null;
 const sitelinks=raw.sitelinks[qid]||0;
 const participants=Boolean((record?.p710||[]).length)||Boolean((event.belligerentsZh||[]).length);
 const score=3*((enTitle||zhTitle)?1:0)+Math.min(sitelinks,40)/10+0.5*(participants?1:0)+2*(zhTitle?1:0);
 return {rank:0,qid,id:event.id,titleZh:event.title.zh,titleEn:event.title.en,labelZh:record?.labelZh||null,labelZhHans:record?.labelZhHans||null,
  year:event.start,end:event.end,region:event.region,category:event.category,
  enArticle:enTitle?{title:enTitle,url:'https://en.wikipedia.org/wiki/'+encodeURIComponent(enTitle.replace(/ /g,'_'))}:null,
  zhArticle:zhTitle?{title:zhTitle,url:'https://zh.wikipedia.org/wiki/'+encodeURIComponent(zhTitle.replace(/ /g,'_'))}:null,
  p585:record?.p585First||null,sitelinks,hasParticipants:participants,
  previousRank:previousRank.get(qid)||null,score:Number(score.toFixed(3))};
});
rows.sort((a,b)=>b.score-a.score||(Number(Boolean(b.enArticle))-Number(Boolean(a.enArticle)))||b.sitelinks-a.sitelinks||a.year-b.year||a.qid.localeCompare(b.qid));
rows.forEach((row,index)=>{row.rank=index+1});
const report={schemaVersion:1,generatedAt:'2026-10-03T00:00:00+00:00',
 purpose:'Priority order for the closing 3.17 upgrade pass over the structured-index events that are still index-level. It replaces the 3.14 ranking, whose Chinese-article-first score could not order the tail: no remaining entity above rank 171 has a Chinese article, while 131 of the 133 have an English one.',
 method:{formula:'score = 3 * (has zh or en Wikipedia article) + min(sitelinks, 40) / 10 + 0.5 * (belligerents recorded) + 2 * (has Chinese Wikipedia article)',
  changes:['An English Wikipedia article now scores like a Chinese one (3), because the upgrade can cite and read it even when no Chinese edition exists.',
   'A Chinese article keeps an extra weight of 2 on top, so entities with both editions stay ahead of English-only entities with the same footprint.',
   'Article presence comes from the entity sitelink fetched in this round (content-upgrade-evidence.json), not from the 3.14 label/API cache.',
   'Belligerents count when Wikidata P710 is recorded or the shipped entry already lists participants.'],
  sitelinks:'Cached 3.14 WDQS COUNT results (docs/verification-3.14/content-upgrade-ranking-raw.json); no new query was issued, so this ranking is deterministic and offline.',
  tieBreakers:['has an English article','sitelink count','earlier year','QID']},
 inputs:{events:structured.length,source:'public/data/events.json entries with provenance=wikidata-structured'},
 coverage:{withEnglishArticle:rows.filter(row=>row.enArticle).length,withChineseArticle:rows.filter(row=>row.zhArticle).length,
  withEither:rows.filter(row=>row.enArticle||row.zhArticle).length,withoutBoth:rows.filter(row=>!row.enArticle&&!row.zhArticle).length,
  withParticipants:rows.filter(row=>row.hasParticipants).length,
  englishOnly:rows.filter(row=>row.enArticle&&!row.zhArticle).length},
 ranking:rows};
await mkdir(dirname(outPath),{recursive:true});
await writeFile(outPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({out:outPath,count:rows.length,coverage:report.coverage,
 top:rows.slice(0,50).map(row=>[row.rank,row.previousRank,row.qid,row.year,row.region,row.sitelinks,row.zhArticle?'ZH':'--',row.enArticle?'EN':'--',row.titleZh,row.score])},null,1));
