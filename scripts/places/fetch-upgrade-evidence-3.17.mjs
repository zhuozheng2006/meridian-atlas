#!/usr/bin/env node
// Usage: node scripts/places/fetch-upgrade-evidence-3.17.mjs [--from-raw]
// Collects, for every structured-index event still in the corpus, the evidence the 3.17
// re-ranking and the authoring pass need: the current Wikidata labels (zh / zh-hans /
// zh-cn / en), the enwiki and zhwiki sitelink titles, the P585 date claim with its
// precision, and the P710 / P361 statement counts.
//
// Why the entity API and not WDQS: wbgetentities answers 50 ids per call and is not the
// rate-limited query service; the whole remaining set fits in three calls. WDQS is only
// touched by the ranking script for the sitelink counts, which are cached from 3.14.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const outPath=resolve(root,'docs/verification-3.17/content-upgrade-evidence.json');
const UA='MeridianAtlasResearch/3.17 (source-linked world history atlas; structured-index evidence pass)';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));

const events=JSON.parse(await readFile(resolve(root,'public/data/events.json'),'utf8'));
const structured=events.filter(event=>event.provenance==='wikidata-structured'&&/^Q\d+$/.test(String(event.wikidataQid||'')));
const qids=[...new Set(structured.map(event=>event.wikidataQid))];
const shipped=new Map(structured.map(event=>[event.wikidataQid,event]));

const requests=[];
const entities={};
for(let i=0;i<qids.length;i+=50){
 const chunk=qids.slice(i,i+50);
 const url='https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&formatversion=2'
  +'&props=labels%7Csitelinks%7Cclaims&languages=zh%7Czh-hans%7Czh-cn%7Cen&sitefilter=enwiki%7Czhwiki&ids='+chunk.join('%7C');
 for(let attempt=1;attempt<=4;attempt++){
  const response=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'}});
  requests.push({endpoint:'wikidata.wbgetentities',status:response.status,count:chunk.length,attempt,at:new Date().toISOString()});
  if(response.ok){
   const data=await response.json();
   Object.assign(entities,data.entities||{});
   break;
  }
  if(response.status!==429&&response.status<500)throw new Error('Wikidata HTTP '+response.status);
  await sleep(8000*attempt);
 }
 await sleep(1500);
}

const labelOf=(entity,langs)=>{for(const lang of langs){const value=entity?.labels?.[lang]?.value;if(value&&value.trim())return value.trim()}return null};
const claimValues=(entity,property)=>(entity?.claims?.[property]||[]).map(claim=>claim.mainsnak?.datavalue?.value).filter(Boolean);
const rows=qids.map(qid=>{
 const entity=entities[qid];
 const shippedEvent=shipped.get(qid);
 const times=claimValues(entity,'P585');
 const dates=times.map(value=>({time:value.time,precision:value.precision,calendarmodel:value.calendarmodel}));
 const participants=claimValues(entity,'P710').map(value=>value.id).filter(Boolean);
 const parts=claimValues(entity,'P361').map(value=>value.id).filter(Boolean);
 const coord=(claimValues(entity,'P625')[0])||null;
 return {qid,id:shippedEvent.id,
  labelZh:labelOf(entity,['zh','zh-hans','zh-cn']),labelZhRaw:labelOf(entity,['zh']),labelZhHans:labelOf(entity,['zh-hans']),labelZhCn:labelOf(entity,['zh-cn']),
  labelEn:labelOf(entity,['en']),
  enwiki:entity?.sitelinks?.enwiki?.title||null,zhwiki:entity?.sitelinks?.zhwiki?.title||null,
  p585:dates,p585First:dates.length?dates[0]:null,
  p710:participants,p361:parts,p625:coord,
  shipped:{titleZh:shippedEvent.title.zh,titleEn:shippedEvent.title.en,start:shippedEvent.start,end:shippedEvent.end,
   lat:shippedEvent.lat,lon:shippedEvent.lon,region:shippedEvent.region,category:shippedEvent.category,
   precision:shippedEvent.precision,locationType:shippedEvent.locationType,regionBasis:shippedEvent.regionBasis,
   belligerentsZh:shippedEvent.belligerentsZh||[],conflictZh:shippedEvent.conflictZh||[]}};
});
const titleMismatch=rows.filter(row=>row.labelZh&&row.shipped.titleZh&&row.labelZh!==row.shipped.titleZh);
const noZhLabel=rows.filter(row=>!row.labelZh);
const document={schemaVersion:1,fetchedAt:new Date().toISOString(),endpoint:'https://www.wikidata.org/w/api.php (action=wbgetentities)',
 policy:'Entity-level evidence for the 3.17 upgrade pass: current labels, Wikipedia sitelinks, P585 date claims with precision, P710/P361 statement values and P625 coordinate. Read through the Wikidata Action API (50 ids per call) rather than WDQS so the query service rate limit is not involved.',
 requests,count:rows.length,
 checks:{shippedTitleZhDiffersFromCurrentZhLabel:titleMismatch.map(row=>({qid:row.qid,shipped:row.shipped.titleZh,labelZh:row.labelZh})),
  withoutZhLabel:noZhLabel.map(row=>row.qid),
  withEnwiki:rows.filter(row=>row.enwiki).length,withZhwiki:rows.filter(row=>row.zhwiki).length,
  withP585:rows.filter(row=>row.p585First).length,withP710:rows.filter(row=>row.p710.length).length},
 rows};
await mkdir(dirname(outPath),{recursive:true});
await writeFile(outPath,JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({out:outPath,count:rows.length,withEnwiki:document.checks.withEnwiki,withZhwiki:document.checks.withZhwiki,
 withP585:document.checks.withP585,titleMismatch:titleMismatch.length,withoutZhLabel:noZhLabel.length,
 mismatchSample:titleMismatch.slice(0,15),requests:requests.length},null,1));
