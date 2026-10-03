#!/usr/bin/env node
// Usage: node scripts/places/fetch-upgrade-extracts-3.20.mjs [--from=41] [--to=80] [--out=docs/verification-3.20/content-upgrade-extracts.json]
// Reads the 3.17 re-ranking (the ranking the 3.20 batch orders itself by) and fetches the
// English and Chinese Wikipedia introductions of the selected rank window through the
// MediaWiki API, ten titles per request. The extracts are research evidence for authoring:
// they record the year the article itself gives, whether a title resolves to a disambiguation
// page or is missing, and the resolved title a stable citation URL must use.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const arg=name=>{const hit=process.argv.find(value=>value.startsWith('--'+name+'='));return hit?hit.slice(name.length+3):null};
const from=Number(arg('from')||121);
const to=Number(arg('to')||133);
const outPath=resolve(root,arg('out')||'docs/verification-3.20/content-upgrade-extracts.json');
const UA='MeridianAtlasResearch/3.20 (source-linked world history atlas; editorial upgrade pass)';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const ranking=JSON.parse(await readFile(resolve(root,'docs/verification-3.17/content-upgrade-ranking.json'),'utf8'));
const picked=ranking.ranking.filter(row=>row.rank>=from&&row.rank<=to);
const requests=[];

const fetchBatch=async(host,titles)=>{
 const url='https://'+host+'/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=extracts&exintro=1&explaintext=1&titles='+encodeURIComponent(titles.join('|'))+(host.startsWith('zh')?'&variant=zh-cn':'');
 for(let attempt=1;attempt<=5;attempt++){
  const response=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'}});
  requests.push({host,status:response.status,count:titles.length,attempt,at:new Date().toISOString()});
  if(response.ok)return await response.json();
  if(response.status!==429&&response.status<500)throw new Error(host+' HTTP '+response.status);
  // The Chinese Wikipedia throttles bursts with 429; back off generously rather than hammering.
  await sleep(15000*attempt);
 }
 throw new Error(host+' kept returning throttling responses');
};
const extract=async(host,titles)=>{
 const texts={};
 const chunks=[];for(let i=0;i<titles.length;i+=10)chunks.push(titles.slice(i,i+10));
 for(const chunk of chunks){
  const data=await fetchBatch(host,chunk);
  const aliases=new Map();
  for(const item of data.query?.normalized||[])aliases.set(item.from,item.to);
  for(const item of data.query?.redirects||[])aliases.set(item.from,item.to);
  for(const page of data.query?.pages||[]){
   const head=page.extract||'';
   const record={extract:page.extract||null,missing:Boolean(page.missing),resolvedTitle:page.title,
    dab:/may refer to|most commonly refers to|usually refers to|can refer to|可以指|通常指|消歧义|可能指/.test(head)};
   texts[page.title]=record;
   for(const [from,to] of aliases)if(to===page.title)texts[from]=record;
  }
  await sleep(7000);
 }
 return texts;
};
const enTitles=[...new Set(picked.map(row=>row.enArticle?.title).filter(Boolean))];
const zhTitles=[...new Set(picked.map(row=>row.zhArticle?.title).filter(Boolean))];
const zh=await extract('zh.wikipedia.org',zhTitles);
const en=await extract('en.wikipedia.org',enTitles);
const limit=(text,n)=>text?text.replace(/\s+/g,' ').trim().slice(0,n):null;
const entries=picked.map(row=>{
 const enRecord=row.enArticle?en[row.enArticle.title]:null;
 const zhRecord=row.zhArticle?zh[row.zhArticle.title]:null;
 return {rank:row.rank,previousRank:row.previousRank,qid:row.qid,id:row.id,titleZh:row.titleZh,titleEn:row.titleEn,labelZh:row.labelZh,
  year:row.year,end:row.end,region:row.region,category:row.category,sitelinks:row.sitelinks,p585:row.p585,
  enTitleRequested:row.enArticle?.title||null,enResolvedTitle:enRecord?.resolvedTitle||null,enMissing:enRecord?Boolean(enRecord.missing):null,enDab:enRecord?Boolean(enRecord.dab):null,
  enIntro:limit(enRecord?.extract,1100),enFullChars:enRecord?.extract?[...enRecord.extract].length:0,
  zhTitleRequested:row.zhArticle?.title||null,zhResolvedTitle:zhRecord?.resolvedTitle||null,zhMissing:zhRecord?Boolean(zhRecord.missing):null,zhDab:zhRecord?Boolean(zhRecord.dab):null,
  zhIntro:limit(zhRecord?.extract,700)};
});
const document={schemaVersion:1,fetchedAt:new Date().toISOString(),
 policy:'Wikipedia introductions (CC BY-SA 4.0) read through the MediaWiki API as research evidence for the 3.20 authoring pass; no sentence is copied into the shipped entries. Chinese pages are requested with variant=zh-cn so the extract is simplified. The article introduction is the authority for the year of a BCE entry; the Wikidata P585 value is recorded next to it for comparison.',
 requests,count:entries.length,entries};
await mkdir(dirname(outPath),{recursive:true});
await writeFile(outPath,JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({out:outPath,count:entries.length,enMissing:entries.filter(e=>e.enMissing).length,enDab:entries.filter(e=>e.enDab).length,
 zhRequested:zhTitles.length,zhMissing:entries.filter(e=>e.zhMissing).length,
 enTitleChanged:entries.filter(e=>e.enResolvedTitle&&e.enResolvedTitle!==e.enTitleRequested).map(e=>[e.qid,e.enTitleRequested,e.enResolvedTitle]),
 dab:entries.filter(e=>e.enDab).map(e=>[e.qid,e.enTitleRequested]),requests:requests.length},null,1));