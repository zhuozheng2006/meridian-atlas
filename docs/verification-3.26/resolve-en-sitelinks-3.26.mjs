#!/usr/bin/env node
// Usage: node docs/verification-3.26/resolve-en-sitelinks-3.26.mjs
// The fetch step looked the English article up by name, and for five plans that produced the wrong
// page (a disambiguation page, the concept qi, and three articles about other entities). This step
// asks Wikidata for the enwiki sitelink of each polity QID - the article Wikidata itself binds to
// the entity - re-fetches the introduction where the title changed, and patches the extracts so the
// strict identity check can be re-run against the right article.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const UA='MeridianAtlasResearch/3.26 (source-linked world history atlas; sitelink resolution)';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const extracts=JSON.parse(await readFile(resolve(root,'docs/verification-3.26/narratives-extracts.json'),'utf8'));
const qids=extracts.entries.map(entry=>entry.qid);
const sitelinks={};const requests=[];
for(let i=0;i<qids.length;i+=45){
 const chunk=qids.slice(i,i+45);
 for(let attempt=1;attempt<=4;attempt++){
  const response=await fetch('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&formatversion=2&props=sitelinks&sitefilter=enwiki&ids='+chunk.join('|'),{headers:{'user-agent':UA,accept:'application/json'}});
  requests.push({status:response.status,attempt,count:chunk.length});
  if(response.ok){
   const data=await response.json();
   for(const [qid,entity] of Object.entries(data.entities||{}))sitelinks[qid]=entity.sitelinks?.enwiki?.title||null;
   break;
  }
  if(response.status!==429&&response.status<500)throw new Error('HTTP '+response.status);
  await sleep(10000*attempt);
 }
 await sleep(800);
}
const changed=[];
for(const entry of extracts.entries){
 const resolved=sitelinks[entry.qid];
 if(!resolved||resolved===entry.enTitle)continue;
 const response=await fetch('https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=extracts|pageprops&exintro=1&explaintext=1&titles='+encodeURIComponent(resolved),{headers:{'user-agent':UA,accept:'application/json'}});
 const data=await response.json();
 const page=(data.query?.pages||[])[0]||{};
 changed.push({qid:entry.qid,from:entry.enTitle,to:page.title||resolved,carriesQid:page.pageprops?.wikibase_item===entry.qid,wasDisambiguation:Boolean(page.pageprops?.disambiguation)});
 if(!page.missing&&page.extract){
  entry.enTitle=page.title||resolved;
  entry.enIntro=String(page.extract).replace(/\s+/g,' ').trim();
  entry.enResolvedFromSitelink=true;
 }
 await sleep(1200);
}
extracts.policy=String(extracts.policy||'')+' English titles were re-resolved through the Wikidata enwiki sitelink where lookup by name had produced another page (docs/verification-3.26/narratives-en-verified.json).';
await writeFile(resolve(root,'docs/verification-3.26/narratives-extracts.json'),JSON.stringify(extracts,null,2)+'\n');
console.log(JSON.stringify({requests:requests.length,changed:changed.length,changed},null,1));
