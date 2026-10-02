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
 const response=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'}});
 requests.push({host,status:response.status,count:titles.length});
 if(!response.ok)throw new Error(host+' HTTP '+response.status);
 return await response.json();
};
const extract=async(host,titles)=>{
 const chunks=[];for(let i=0;i<titles.length;i+=10)chunks.push(titles.slice(i,i+10));
 const texts={};
 for(const chunk of chunks){
  const data=await fetchBatch(host,chunk);
  // redirects=1 means page.title is the resolved article title, which is what a stable
  // citation URL must use when the label and the article title differ.
  const normalized=new Map();
  for(const item of data.query?.normalized||[])normalized.set(item.from,item.to);
  for(const item of data.query?.redirects||[])normalized.set(item.from,item.to);
  for(const page of data.query?.pages||[]){
   const target=normalized.get(page.title)||page.title;
   texts[target]=texts[page.title]={extract:page.extract||null,missing:Boolean(page.missing),resolvedTitle:page.title};
   if(normalized.has(page.title))texts[normalized.get(page.title)]=texts[page.title];
  }
  await sleep(4000);
 }
 return texts;
};
const zhTitles=[...new Set(picked.map(row=>row.zhArticle?.title).filter(Boolean))];
const enTitles=[...new Set(picked.map(row=>row.titleEn).filter(Boolean))];
const zh=await extract('zh.wikipedia.org',zhTitles);
const en=await extract('en.wikipedia.org',enTitles);
const limit=(text,n)=>text?text.replace(/\s+/g,' ').trim().slice(0,n):null;
const entries=picked.map(row=>({rank:row.rank,qid:row.qid,id:row.id,titleZh:row.titleZh,titleEn:row.titleEn,year:row.year,
 region:row.region,sitelinks:row.sitelinks,lat:null,
 zhUrl:row.zhArticle?.url||null,enUrl:'https://en.wikipedia.org/wiki/'+encodeURIComponent(String(row.titleEn).replace(/ /g,'_')),
 zhIntro:limit(zh[row.zhArticle?.title]?.extract,520),enIntro:limit(en[row.titleEn]?.extract,760),
 zhResolvedTitle:zh[row.zhArticle?.title]?.resolvedTitle||null,enResolvedTitle:en[row.titleEn]?.resolvedTitle||null,
 zhMissing:zh[row.zhArticle?.title]?.missing??null,enMissing:en[row.titleEn]?.missing??null}));
const document={schemaVersion:1,fetchedAt:new Date().toISOString(),
 policy:'Wikipedia introductions (CC BY-SA 4.0) read through the MediaWiki API as research evidence for authoring; no sentence is copied into the shipped entries. Chinese pages are requested with variant=zh-cn so the extract is simplified.',
 requests,count:entries.length,entries};
await writeFile(outPath,JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({out:outPath,range:[from,to],count:entries.length,missingZh:entries.filter(e=>!e.zhIntro).map(e=>e.qid),missingEn:entries.filter(e=>!e.enIntro).map(e=>e.qid),requests},null,1));
