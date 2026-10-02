#!/usr/bin/env node
// Usage: node scripts/places/verify-upgrade-titles-3.16.mjs
// Third and last title pass: two batched MediaWiki lookups (no search, so no throttling) that
// confirm the exact English replacement titles and the Chinese candidates proposed from the
// search evidence, and return their introductions for hand verification.
import {writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const UA='MeridianAtlasResearch/3.16 (source-linked world history atlas; title verification)';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const EN_TITLES=['Battle of Isonzo (489)','Battle of Caldiero (1805)','Battle of Peking (1900)','Battle of Stockach (1800)',
 'Battles of Stockach and Engen','Black Friday (1945)','Battle of Ramadi (2014–2015)','Battle of Verona (1805)',
 'Battle of Xingyang (190)','Battle of Dyrrhachium (1081)','Battle of Toulouse (721)','Battle of Avdiivka (2017)','Operation Ten-Go'];
const ZH_TITLES=['天號作戰','圖盧茲之戰','博川戰鬥','第二次法蘭克-西哥德戰爭'];
const requests=[];
const lookup=async(host,titles)=>{
 const url='https://'+host+'/w/api.php?action=query&format=json&formatversion=2&prop=extracts&exintro=1&explaintext=1&redirects=1'+(host.startsWith('zh')?'&variant=zh-cn':'')+'&titles='+encodeURIComponent(titles.join('|'));
 for(let attempt=1;attempt<=4;attempt++){
  const response=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'}});
  requests.push({host,status:response.status,count:titles.length,attempt});
  if(response.ok)return await response.json();
  if(response.status!==429&&response.status<500)throw new Error(host+' HTTP '+response.status);
  await sleep(8000*attempt);
 }
 throw new Error(host+' throttled');
};
const shape=data=>{
 const out={};
 for(const page of data.query?.pages||[]){
  const head=(page.extract||'').replace(/\s+/g,' ').trim();
  out[page.title]={missing:Boolean(page.missing),dab:/may refer to|most commonly refers to|usually refers to|可以指|通常指|消歧义/.test(head),extract:head.slice(0,420)};
 }
 return out;
};
const en=shape(await lookup('en.wikipedia.org',EN_TITLES));
await sleep(5000);
const zh=shape(await lookup('zh.wikipedia.org',ZH_TITLES));
const document={schemaVersion:1,checkedAt:new Date().toISOString(),
 policy:'Batched title verification: the introductions of the proposed English replacement titles and Chinese candidate titles, read to confirm that each article is about the same event before a fix is accepted.',
 requests,english:en,chinese:zh};
await writeFile(resolve(root,'docs/verification-3.16/content-upgrade-titles-verified.json'),JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({en:Object.fromEntries(Object.entries(en).map(([t,r])=>[t,r.missing?'MISSING':(r.dab?'DAB':'ok')])),
 zh:Object.fromEntries(Object.entries(zh).map(([t,r])=>[t,r.missing?'MISSING':(r.dab?'DAB':'ok')]))},null,1));
