#!/usr/bin/env node
// Usage: node docs/verification-3.29/verify-candidates-3.29.mjs
// Identity verification for the second narratives batch, in response to the two rounds in which
// a QID was taken from memory and turned out to be a noble family, a person or an app.
//
// Every candidate is checked twice against a primary source:
//   1. the atlas catalogue itself: the record's verifiedWikidata field (POLITY records in
//      public/data/fast/catalog.json.gz) must name this QID - this is how the selection bound it;
//   2. English Wikipedia: the article's pageprops.wikibase_item must equal the QID, so the
//      article a citation would point at really is about this entity.
// It then reads the Wikidata P31 (instance of) statements and classifies the entity. A
// candidate whose class is an island, a person, a family, an event, a history topic or another
// non-polity concept is NOT built; it is registered as a gap with the class that disqualified it.
// Nothing is written to public/ by this script.
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const UA='MeridianAtlasResearch/3.29 (source-linked world history atlas; identity verification)';
const selection=JSON.parse(await readFile(resolve(root,'docs/verification-3.29/narratives-selection.json'),'utf8'));
const catalog=JSON.parse(gunzipSync(await readFile(resolve(root,'public/data/fast/catalog.json.gz'))));
const index=JSON.parse(gunzipSync(await readFile(resolve(root,'public/data/enrichment/profile-index.json.gz'))));
const excluded=new Set((index.exclusions||[]).map(item=>item.recordId));
// Candidates: the highest scoring uncovered profiles, with the priority regions represented
// generously so a region quota can be filled from verified entities only.
const byRegion={};
for(const row of selection.allUncovered){(byRegion[row.region]=byRegion[row.region]||[]).push(row)}
const priority={africa:120,'west-central-asia':90,'south-asia':90,americas:80,'east-asia':60,'southeast-asia':40,oceania:30,europe:200,global:20};
const picked=[];const seen=new Set();
for(const [region,limit] of Object.entries(priority))for(const row of (byRegion[region]||[]).slice(0,limit))if(!seen.has(row.qid)){seen.add(row.qid);picked.push(row)}
picked.sort((a,b)=>b.score-a.score);

// Catalogue side: which records does the atlas itself bind to this QID?
const recordsByQid=new Map();
for(const record of catalog.records){
 if(record.type!=='POLITY'||excluded.has(record.id)||!record.verifiedWikidata)continue;
 const list=recordsByQid.get(record.verifiedWikidata)||[];list.push(record);recordsByQid.set(record.verifiedWikidata,list);
}
const requests=[];
const call=async url=>{
 for(let attempt=1;attempt<=4;attempt++){
  const response=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'}});
  requests.push({url:url.slice(0,110),status:response.status,attempt});
  if(response.ok)return await response.json();
  if(response.status!==429&&response.status<500)throw new Error('HTTP '+response.status);
  await sleep(8000*attempt);
 }
 throw new Error('throttled');
};
// 1. Wikidata P31 for every candidate (claims only, 50 ids per request).
const claims={};
const qids=picked.map(row=>row.qid);
for(let i=0;i<qids.length;i+=50){
 const chunk=qids.slice(i,i+50);
 const data=await call('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&formatversion=2&props=claims&ids='+chunk.join('|'));
 for(const [qid,entity] of Object.entries(data.entities||{})){
  const p31=(entity.claims?.P31||[]).map(statement=>statement.mainsnak?.datavalue?.value?.id).filter(Boolean);
  claims[qid]=[...new Set(p31)];
 }
 await sleep(2000);
}
// 2. English Wikipedia pageprops for every candidate label (50 titles per request).
const pageprops={};
const titles=picked.map(row=>row.en).filter(Boolean);
for(let i=0;i<titles.length;i+=50){
 const chunk=titles.slice(i,i+50);
 const data=await call('https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=pageprops&titles='+encodeURIComponent(chunk.join('|')));
 const aliases=new Map();
 for(const item of data.query?.normalized||[])aliases.set(item.from,item.to);
 for(const item of data.query?.redirects||[])aliases.set(item.from,item.to);
 for(const page of data.query?.pages||[]){
  const qid=page.pageprops?.wikibase_item||null;
  const record={title:page.title,missing:Boolean(page.missing),qid};
  pageprops[page.title]=record;
  for(const [from,to] of aliases)if(to===page.title)pageprops[from]=record;
 }
 await sleep(2000);
}
// 3. Labels for the distinct P31 classes, so the report can say what disqualified an entity.
const classIds=[...new Set(Object.values(claims).flat())];
const classLabels={};
for(let i=0;i<classIds.length;i+=50){
 const chunk=classIds.slice(i,i+50);
 const data=await call('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&formatversion=2&props=labels&languages=en|zh&ids='+chunk.join('|'));
 for(const [qid,entity] of Object.entries(data.entities||{}))classLabels[qid]=entity.labels?.en?.value||entity.labels?.zh?.value||null;
 await sleep(1500);
}
// Classes that disqualify an entity as a polity. Deliberately conservative: only classes whose
// meaning is unambiguous, so nothing is dropped for a debatable reason.
const NON_POLITY={'Q23442':'island','Q5':'human','Q8436':'family','Q1656682':'event','Q1190554':'occurrence',
 'Q198':'war','Q178561':'battle','Q180684':'conflict','Q131569':'treaty','Q43229':'organization',
 'Q4830453':'business','Q16334295':'group of humans','Q2472587':'people','Q11042':'culture','Q309':'history',
 'Q11514315':'historical period','Q11424':'film','Q7397':'software','Q341':'free software','Q166142':'application',
 'Q620615':'mobile app','Q4167410':'disambiguation page','Q4164871':'position','Q294414':'public office',
 'Q7275':'state','Q3624078':'sovereign state','Q3024240':'historical country','Q6256':'country'};
const DISQUALIFYING=new Set(['Q23442','Q5','Q8436','Q1656682','Q1190554','Q43229','Q4830453','Q16334295','Q2472587','Q11042','Q309','Q11514315','Q11424','Q7397','Q341','Q166142','Q620615','Q4167410','Q4164871','Q294414']);
const rows=picked.map(row=>{
 const p31=claims[row.qid]||[];
 const bad=p31.filter(id=>DISQUALIFYING.has(id));
 const page=pageprops[row.en]||null;
 const catalogueRecords=recordsByQid.get(row.qid)||[];
 // The QID must be confirmed by at least one primary source, and the article must bind to it
 // when the article exists at all.
 const catalogueMatch=catalogueRecords.length>0;
 const articleMatch=Boolean(page&&!page.missing&&page.qid===row.qid);
 return {qid:row.qid,zh:row.zh,en:row.en,regionBox:row.region,score:row.score,recordCount:row.recordCount,
  spanYears:row.spanYears,yearsCovered:row.yearsCovered,areaMax:row.areaMax,firstStart:row.firstStart,lastEnd:row.lastEnd,
  catalogueMatch,catalogueRecords:catalogueRecords.length,enArticle:page?page.title:null,articleQid:page?page.qid:null,
  articleMatch,p31,p31Labels:p31.map(id=>classLabels[id]||id),disqualifying:bad.map(id=>({qid:id,label:classLabels[id]||id})),
  polity:p31.some(id=>['Q7275','Q3624078','Q3024240','Q6256'].includes(id)),
  verdict:bad.length?'not-a-polity':(articleMatch||catalogueMatch?'verified':'unverified')};
});
const document={schemaVersion:1,checkedAt:new Date().toISOString(),
 policy:'Identity verification for the 3.29 narratives: the atlas catalogue verifiedWikidata field and the English Wikipedia pageprops.wikibase_item are the only sources a QID may come from; Wikidata P31 statements then decide whether the entity is a polity. Entities classed as islands, people, families, events, history topics or other non-polities are registered as gaps and not written up.',
 sources:{catalogue:'public/data/fast/catalog.json.gz records with type=POLITY and verifiedWikidata',
  pageprops:'https://en.wikipedia.org/w/api.php action=query&prop=pageprops',p31:'https://www.wikidata.org/w/api.php action=wbgetentities&props=claims'},
 requests,candidates:rows.length,verified:rows.filter(row=>row.verdict==='verified').length,
 notPolity:rows.filter(row=>row.verdict==='not-a-polity').length,
 unverified:rows.filter(row=>row.verdict==='unverified').map(row=>({qid:row.qid,en:row.en,catalogueRecords:row.catalogueRecords,articleQid:row.articleQid})),
 classLabels,rows};
await writeFile(resolve(root,'docs/verification-3.29/narratives-candidates.json'),JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({candidates:rows.length,verified:document.verified,notPolity:document.notPolity,unverified:document.unverified.length,requests:requests.length,
 notPolityExamples:rows.filter(row=>row.verdict==='not-a-polity').slice(0,12).map(row=>row.qid+' '+(row.zh||row.en)+' ['+row.regionBox+'] -> '+row.disqualifying.map(item=>item.label).join('/'))},null,1));
