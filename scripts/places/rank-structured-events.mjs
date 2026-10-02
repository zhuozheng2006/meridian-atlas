#!/usr/bin/env node
// Usage: node scripts/places/rank-structured-events.mjs [--events=public/data/events.json]
//        [--out=docs/verification-3.14/content-upgrade-ranking.json] [--raw=...] [--from-raw]
//
// Ranks the structured-index events (provenance=wikidata-structured) by how likely a
// reader is to look them up, so the editorial upgrade pass can start from the top.
//
// Heat evidence (all three parts are recorded per entry so the ranking can be audited):
//   1. Chinese Wikipedia article presence (WDQS: ?article schema:about ?item ;
//      schema:isPartOf <https://zh.wikipedia.org/>) - a Chinese-reading search that
//      lands on Wikipedia finds an article instead of a red link.
//   2. Global sitelink count (WDQS COUNT query, sent on its own: mixing COUNT with
//      OPTIONAL is what makes WDQS answer 504).
//   3. Wikidata P710 participants recorded on the entity.
// Score = 3 * (has zh article) + min(sitelinks, 40) / 10 + 0.5 * (has participants).
// Ties break on local cross-dataset signals (mentions in the shipped editorial
// narratives, and the same entity shipping in the battle layer), then on sitelinks.
//
// WDQS answers 429 after roughly a dozen quick queries: this script sleeps 4s between
// requests and backs off 15s * attempt on 429/5xx, with four attempts per batch.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const arg=name=>{const hit=process.argv.find(value=>value.startsWith('--'+name+'='));return hit?hit.slice(name.length+3):null};
const eventsPath=resolve(root,arg('events')||'public/data/events.json');
const outPath=resolve(root,arg('out')||'docs/verification-3.14/content-upgrade-ranking.json');
const rawPath=resolve(root,arg('raw')||'docs/verification-3.14/content-upgrade-ranking-raw.json');
const fromRaw=process.argv.includes('--from-raw');
const BATCH=80;
const UA='MeridianAtlasResearch/3.14 (source-linked world history atlas; structured-index upgrade pass)';
const ENDPOINT='https://query.wikidata.org/sparql';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const requests=[];

const sparql=async query=>{
 if(fromRaw)throw new Error('--from-raw cannot issue new queries');
 for(let attempt=1;attempt<=4;attempt++){
  const response=await fetch(ENDPOINT,{method:'POST',headers:{'user-agent':UA,accept:'application/sparql-results+json','content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({query})});
  requests.push({endpoint:ENDPOINT,attempt,status:response.status,at:new Date().toISOString()});
  if(response.ok)return await response.json();
  if(attempt===4)throw new Error('WDQS HTTP '+response.status);
  const wait=response.status===429?15000*attempt:4000*attempt;
  console.error('WDQS',response.status,'retry in',wait,'ms');
  await sleep(wait);
 }
};

const values=qids=>qids.map(qid=>'wd:'+qid).join(' ');
const events=JSON.parse(await readFile(eventsPath,'utf8'));
const structured=events.filter(event=>event.provenance==='wikidata-structured'&&/^Q\d+$/.test(String(event.wikidataQid||'')));
const uniqueQids=[...new Set(structured.map(event=>event.wikidataQid))];
const chunks=[];
for(let i=0;i<uniqueQids.length;i+=BATCH)chunks.push(uniqueQids.slice(i,i+BATCH));

const raw={schemaVersion:1,collectedAt:new Date().toISOString(),endpoint:ENDPOINT,batchSize:BATCH,
 policy:'WDQS: one simple-pattern query for zh.wikipedia article titles per batch, one standalone COUNT query for sitelinks per batch; 4s sleep between requests, 15s*attempt backoff on 429. Titles are cross-checked through the Wikidata Action API (wbgetentities, 50 ids per call).',
 zhTitles:{},sitelinks:{},apiTitles:{},requests:[]};

if(!fromRaw){
 for(const chunk of chunks){
  const zh=await sparql('SELECT ?item ?title WHERE { VALUES ?item { '+values(chunk)+' } ?article schema:about ?item ; schema:isPartOf <https://zh.wikipedia.org/> ; schema:name ?title . }');
  for(const row of zh.results.bindings)raw.zhTitles[row.item.value.split('/').pop()]=row.title.value;
  await sleep(4000);
  const counts=await sparql('SELECT ?item (COUNT(DISTINCT ?sitelink) AS ?count) WHERE { VALUES ?item { '+values(chunk)+' } ?sitelink schema:about ?item . } GROUP BY ?item');
  for(const row of counts.results.bindings)raw.sitelinks[row.item.value.split('/').pop()]=Number(row.count.value);
  await sleep(4000);
  console.error('batch done',chunks.indexOf(chunk)+1,'/',chunks.length);
 }
 // English + Chinese sitelink titles straight from the entity API: this is the URL
 // evidence used by the upgrade batch, and it double-checks the WDQS zh titles.
 for(let i=0;i<uniqueQids.length;i+=50){
  const chunk=uniqueQids.slice(i,i+50);
  const url='https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&formatversion=2&props=sitelinks&sitefilter=enwiki%7Czhwiki&ids='+chunk.join('%7C');
  const response=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'}});
  requests.push({endpoint:url.split('?')[0],attempt:1,status:response.status,at:new Date().toISOString()});
  if(!response.ok)throw new Error('Wikidata API HTTP '+response.status);
  const data=await response.json();
  for(const [qid,entity] of Object.entries(data.entities||{})){
   const zh=entity.sitelinks?.zhwiki?.title||null;
   const en=entity.sitelinks?.enwiki?.title||null;
   if(zh||en)raw.apiTitles[qid]={zh,en};
  }
  await sleep(1500);
 }
 raw.requests=requests;
 await mkdir(dirname(rawPath),{recursive:true});
 await writeFile(rawPath,JSON.stringify(raw,null,2)+'\n');
}else{
 const cached=JSON.parse(await readFile(rawPath,'utf8'));
 Object.assign(raw.zhTitles,cached.zhTitles);Object.assign(raw.sitelinks,cached.sitelinks);Object.assign(raw.apiTitles,cached.apiTitles);
 raw.requests=cached.requests||[];
}

// Local cross-dataset signals kept in the repository.
const narrativeSources=['public/data/enrichment/narratives.json','editorial/city-narratives.json'];
let narrativeText='';
for(const file of narrativeSources){try{narrativeText+=await readFile(resolve(root,file),'utf8')}catch{}}
const battles=JSON.parse(await readFile(resolve(root,'public/data/battles.json'),'utf8'));
const battleQids=new Set(battles.battles.map(battle=>battle.qid));

const rows=structured.map(event=>{
 const qid=event.wikidataQid;
 const api=raw.apiTitles[qid]||{};
 const zhTitle=api.zh||raw.zhTitles[qid]||null;
 const sitelinks=raw.sitelinks[qid]||0;
 const participants=Array.isArray(event.belligerentsZh)&&event.belligerentsZh.length>0;
 const mentioned=narrativeText.includes(qid)||narrativeText.includes(event.title.zh)||narrativeText.includes(event.title.en);
 const score=3*(zhTitle?1:0)+Math.min(sitelinks,40)/10+0.5*(participants?1:0);
 return {id:event.id,qid,titleZh:event.title.zh,titleEn:event.title.en,year:event.start,region:event.region,
  zhArticle:zhTitle?{title:zhTitle,url:'https://zh.wikipedia.org/wiki/'+encodeURIComponent(zhTitle.replace(/ /g,'_'))}:null,
  zhArticleFromApi:Boolean(api.zh),sitelinks,hasParticipants:participants,
  mentionedInNarratives:mentioned,battleLayerOverlap:battleQids.has(qid),score:Number(score.toFixed(3))};
});
rows.sort((a,b)=>b.score-a.score||Number(b.mentionedInNarratives)-Number(a.mentionedInNarratives)||Number(b.battleLayerOverlap)-Number(a.battleLayerOverlap)||b.sitelinks-a.sitelinks||a.year-b.year||a.qid.localeCompare(b.qid));
rows.forEach((row,index)=>{row.rank=index+1});

const report={schemaVersion:1,generatedAt:new Date().toISOString(),
 purpose:'Heat ranking of the structured-index events so the editorial upgrade pass starts with the entries readers are most likely to open.',
 inputs:{events:eventsPath.replace(root+'/',''),structuredEvents:structured.length,uniqueQids:uniqueQids.length},
 method:{
  formula:'score = 3 * (has Chinese Wikipedia article) + min(sitelinks, 40) / 10 + 0.5 * (Wikidata P710 participants recorded)',
  reasons:['A Chinese Wikipedia article means a Chinese-reading search lands on an article instead of a red link, so the upgrade has verifiable prose sources to cite.',
   'The sitelink count is the broadest available proxy for how often an entity is looked up across languages; it is capped at 40 so a handful of very large entities cannot drown out the rest.',
   'Recorded participants mean the entity already carries structured context that an editorial paragraph can check against a narrative source.'],
  tieBreakers:['verbatim mention (QID or either title) in the shipped editorial narratives','the same entity also ships in the battle layer','sitelink count','earlier year','QID'],
  rateLimit:raw.policy,
  wdqsRequests:raw.requests.filter(item=>item.endpoint===ENDPOINT).length,
  apiRequests:raw.requests.filter(item=>item.endpoint!==ENDPOINT).length},
 coverage:{withChineseArticle:rows.filter(row=>row.zhArticle).length,withoutChineseArticle:rows.filter(row=>!row.zhArticle).length,
  withParticipants:rows.filter(row=>row.hasParticipants).length,sitelinkMax:Math.max(...rows.map(row=>row.sitelinks)),
  mentionedInNarratives:rows.filter(row=>row.mentionedInNarratives).length,battleLayerOverlap:rows.filter(row=>row.battleLayerOverlap).length,
  crossCheckZhTitleMismatch:rows.filter(row=>row.zhArticleFromApi&&raw.zhTitles[row.qid]&&raw.zhTitles[row.qid]!==row.zhArticle.title).length},
 ranking:rows};
await mkdir(dirname(outPath),{recursive:true});
await writeFile(outPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({out:outPath,raw:rawPath,structured:structured.length,top:rows.slice(0,12).map(row=>[row.rank,row.qid,row.titleZh,row.year,row.region,row.sitelinks,Boolean(row.zhArticle),row.score])},null,1));
