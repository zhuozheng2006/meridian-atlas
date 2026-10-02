#!/usr/bin/env node
// Usage: node scripts/places/fetch-upgrade-extracts.mjs [--top=40] [--from=41] [--to=100] [--out=/tmp/extracts.json]
// Reads the heat ranking, then fetches the English and Chinese Wikipedia introductions
// of the selected entities (10 titles per request, 4s apart). --from/--to select a rank
// window (inclusive); --top is the shorthand for the first N ranks. The extracts are
// research input for authoring the editorial upgrade batch: they are evidence, never
// text that is copied into the shipped entries.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const arg=name=>{const hit=process.argv.find(value=>value.startsWith('--'+name+'='));return hit?hit.slice(name.length+3):null};
const from=Number(arg('from')||1);
const to=Number(arg('to')||0)||Number(arg('top')||40);
const outPath=resolve(arg('out')||'/tmp/extracts.json');
const UA='MeridianAtlasResearch/3.14 (source-linked world history atlas; editorial upgrade pass)';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const ranking=JSON.parse(await readFile(resolve(root,'docs/verification-3.14/content-upgrade-ranking.json'),'utf8'));
const picked=ranking.ranking.filter(row=>row.rank>=from&&row.rank<=to);
const requests=[];
const fetchBatch=async(host,titles)=>{
 const url='https://'+host+'/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=extracts&exintro=1&explaintext=1&titles='+encodeURIComponent(titles.join('|'))+(host.startsWith('zh')?'&variant=zh-cn':'');
  // The MediaWiki API answers a rapid rerun with 429, so a call is retried with a
 // growing pause; a client error other than 429 fails immediately.
 for(let attempt=1;attempt<=4;attempt++){
  const response=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'}});
  requests.push({host,status:response.status,count:titles.length,attempt});
  if(response.ok)return await response.json();
  if(response.status!==429&&response.status<500)throw new Error(host+' HTTP '+response.status);
  await sleep(20000*attempt);
 }
 throw new Error(host+' kept returning throttling responses');
};
const extract=async(host,titles)=>{
 const chunks=[];for(let i=0;i<titles.length;i+=10)chunks.push(titles.slice(i,i+10));
 const texts={};
 for(const chunk of chunks){
  const data=await fetchBatch(host,chunk);
  // redirects=1 means page.title is the resolved article title, which is what a stable
  // citation URL must use when the label and the article title differ.
  const aliases=new Map();
  for(const item of data.query?.normalized||[])aliases.set(item.from,item.to);
  for(const item of data.query?.redirects||[])aliases.set(item.from,item.to);
  for(const page of data.query?.pages||[]){
   const head=page.extract||'';
   const record={extract:page.extract||null,missing:Boolean(page.missing),resolvedTitle:page.title,
    dab:/may refer to|most commonly refers to|usually refers to|可以指|通常指|消歧义/.test(head)};
   texts[page.title]=record;
   // A requested title that was normalized or redirected must find the page under the
   // title it was asked for, otherwise the extract looks missing.
   for(const [from,to] of aliases)if(to===page.title)texts[from]=record;
  }
  await sleep(6000);
 }
 return texts;
};
// The English label of an entity is not always the English Wikipedia article title.
// These fifteen were resolved through a MediaWiki search on 2026-10-03 and are recorded
// here so a rerun cites the same pages instead of silently missing them.
const EN_TITLE_FIX={
 'Q112016':'Battle of the Persian Gate','Q699093':'Ruhr pocket','Q1193959':'Battle of Toba–Fushimi','Q63146684':'Battle of Bedriacum',
 'Q696931':'Battle of Manila (1945)','Q233414':'Second Battle of Panipat','Q709333':'Battle of Changsha (1939)','Q199371':'Battle of Megiddo (1918)',
 'Q101305942':'Battle of Shusha (2020)','Q1137980':'Battle of Ravenna (1512)','Q1804983':'Battle of Baghdad (2003)','Q2665626':'Battle of Beersheba (1917)',
 'Q602880':'Battle of Anchialus (708)','Q2588587':'Battle of Nisibis (217)','Q1887494':'Battle of Uji (1180)'};
const enTitleOf=row=>EN_TITLE_FIX[row.qid]||row.titleEn;
const zhTitles=[...new Set(picked.map(row=>row.zhArticle?.title).filter(Boolean))];
const enTitles=[...new Set(picked.map(row=>enTitleOf(row)).filter(Boolean))];
const zh=await extract('zh.wikipedia.org',zhTitles);
const en=await extract('en.wikipedia.org',enTitles);
const limit=(text,n)=>text?text.replace(/\s+/g,' ').trim().slice(0,n):null;
const entries=picked.map(row=>({rank:row.rank,qid:row.qid,id:row.id,titleZh:row.titleZh,titleEn:row.titleEn,year:row.year,
 region:row.region,sitelinks:row.sitelinks,lat:null,
 zhUrl:row.zhArticle?.url||null,enUrl:'https://en.wikipedia.org/wiki/'+encodeURIComponent(String(enTitleOf(row)).replace(/ /g,'_')),
 zhIntro:limit(zh[row.zhArticle?.title]?.extract,520),enIntro:limit(en[enTitleOf(row)]?.extract,760),
 zhResolvedTitle:zh[row.zhArticle?.title]?.resolvedTitle||null,enResolvedTitle:en[enTitleOf(row)]?.resolvedTitle||null,
 zhMissing:zh[row.zhArticle?.title]?.missing??null,enMissing:en[enTitleOf(row)]?.missing??null,enTitleUsed:enTitleOf(row),enDab:en[enTitleOf(row)]?.dab??null,zhDab:zh[row.zhArticle?.title]?.dab??null}));
const document={schemaVersion:1,fetchedAt:new Date().toISOString(),
 policy:'Wikipedia introductions (CC BY-SA 4.0) read through the MediaWiki API as research evidence for authoring; no sentence is copied into the shipped entries. Chinese pages are requested with variant=zh-cn so the extract is simplified.',
 requests,count:entries.length,entries};
await writeFile(outPath,JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({out:outPath,range:[from,to],count:entries.length,missingZh:entries.filter(e=>!e.zhIntro).map(e=>e.qid),missingEn:entries.filter(e=>!e.enIntro).map(e=>e.qid),requests},null,1));
