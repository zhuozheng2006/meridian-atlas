#!/usr/bin/env node
// Usage: node scripts/places/resolve-upgrade-titles-3.16.mjs
// Second, targeted pass. The first sweep spent its budget on broad searches; this pass asks
// only the questions the batch still needs:
//   1. for every rank 101-170 candidate whose Wikidata entity has no zh.wikipedia sitelink it
//      searches zh.wikipedia on the recorded label and on the conventional Chinese name, so a
//      human can confirm whether an article about the same event exists;
//   2. it reads the exact English titles proposed as disambiguation fixes and reports whether
//      they exist, whether they are disambiguation pages and what their introductions say.
// Nothing is accepted automatically: the fix maps in the assembler are written by hand from
// this evidence.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const UA='MeridianAtlasResearch/3.16 (source-linked world history atlas; targeted title resolution)';
const requests=[];
const get=async url=>{
 for(let attempt=1;attempt<=3;attempt++){
  const response=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'}});
  requests.push({url:url.slice(0,110),status:response.status,attempt});
  if(response.ok)return await response.json();
  if(response.status!==429&&response.status<500)throw new Error('HTTP '+response.status);
  await sleep(4000*attempt);
 }
 throw new Error('throttled '+url.slice(0,80));
};
const api=(host,params)=>'https://'+host+'/w/api.php?action=query&format=json&formatversion=2&'+params;
const search=async term=>{
 const data=await get(api('zh.wikipedia.org','list=search&srlimit=5&srsearch='+encodeURIComponent(term)));
 return (data.query?.search||[]).map(hit=>hit.title);
};
const intro=async(host,titles)=>{
 const out={};
 for(let i=0;i<titles.length;i+=10){
  const chunk=titles.slice(i,i+10);
  const data=await get(api(host,'prop=extracts&exintro=1&explaintext=1&redirects=1'+(host.startsWith('zh')?'&variant=zh-cn':'')+'&titles='+encodeURIComponent(chunk.join('|'))));
  const aliases=new Map();
  for(const item of data.query?.normalized||[])aliases.set(item.from,item.to);
  for(const item of data.query?.redirects||[])aliases.set(item.from,item.to);
  for(const page of data.query?.pages||[]){
   const head=(page.extract||'').replace(/\s+/g,' ').trim();
   const record={title:page.title,missing:Boolean(page.missing),dab:/may refer to|most commonly refers to|usually refers to|可以指|通常指|消歧义/.test(head),extract:head.slice(0,420)};
   out[page.title]=record;
   for(const [from,to] of aliases)if(to===page.title)out[from]=record;
  }
  await sleep(3000);
 }
 return out;
};
// Chinese names tried in addition to the recorded label, one line per entity, written from the
// established Chinese names of these battles.
const ZH_EXTRA={
 Q851504:['武耶战役'],Q379433:['天号作战'],Q747679:['阿提密西翁海战','阿尔忒弥西翁海战'],Q3270739:['博川战斗'],
 Q383614:['科希马战役'],Q1113659:['富尔福德战役'],Q1987213:['底拉西乌姆战役'],Q652320:['图卢兹战役'],
 Q595320:['巴顿山之战'],Q849474:['卡尔卡战役'],Q1137764:['拉克塔里乌斯山战役'],Q769358:['塔吉那会战']};
// English titles proposed as disambiguation fixes, plus the two entities with no English article.
const EN_FIX={
 Q1281559:'Battle of Isonzo (489)',Q857434:'Battle of Caldiero (1805)',Q4087313:'Battle of Peking (1900)',
 Q840006:'Battle of Stockach (1800)',Q2748375:'Black Friday (1945)',Q18639122:'Battle of Ramadi (2014–2015)',
 Q22117640:'Battle of Avdiivka (2017)',Q2890355:'Battle of Verona (1805)',Q3827914:'Battle of Xingyang (190)',
 Q1987213:'Battle of Dyrrhachium (1081)',Q652320:'Battle of Toulouse (721)',Q379433:'Operation Ten-Go',
 Q11211553:'Attack on the Moncada Barracks',Q15913566:'Battle of Ogonran',Q15928518:'Battle of Qingshuping',Q2890079:'Battle of Sediman',Q112725430:'Battle of Namka Chu'};

const extracts=JSON.parse(await readFile(resolve(root,'docs/verification-3.16/content-upgrade-extracts.json'),'utf8'));
const zhMissing=extracts.entries.filter(entry=>!entry.zhIntro);
const zhSearch={};
for(const entry of zhMissing){
 const terms=[entry.titleZh,...(ZH_EXTRA[entry.qid]||[])];
 const hits=[];
 for(const term of terms){hits.push(...await search(term));await sleep(2500);}
 zhSearch[entry.qid]={rank:entry.rank,terms,hits:[...new Set(hits)]};
}
const zhTitles=[...new Set(Object.values(zhSearch).flatMap(item=>item.hits))];
const zhIntros=await intro('zh.wikipedia.org',zhTitles);
const enTitles=[...new Set(Object.values(EN_FIX))];
const enIntros=await intro('en.wikipedia.org',enTitles);
const document={schemaVersion:1,fetchedAt:new Date().toISOString(),
 policy:'Targeted MediaWiki lookups (CC BY-SA 4.0): zh.wikipedia search results for the entities without a Chinese sitelink, and the introductions of the proposed English replacement titles. Evidence for hand-written fix maps, not an automatic resolver.',
 requests,zhMissing:zhMissing.map(entry=>({rank:entry.rank,qid:entry.qid,titleZh:entry.titleZh,titleEn:entry.titleEn,year:entry.year})),
 zhSearch,zhIntros,proposedEnglishTitles:EN_FIX,enIntros};
await writeFile(resolve(root,'docs/verification-3.16/content-upgrade-resolve.json'),JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({zhMissing:zhMissing.length,zhSearches:requests.length,
 enProposed:Object.entries(enIntros).map(([title,record])=>[title,record.missing?'MISSING':(record.dab?'DAB':'ok')])},null,1));
