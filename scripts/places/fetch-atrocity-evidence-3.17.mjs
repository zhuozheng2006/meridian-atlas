#!/usr/bin/env node
// Usage: node scripts/places/fetch-atrocity-evidence-3.17.mjs
// Evidence pass for the atrocity layer's bilingual field work.
//
// a) Chinese names: the 3.16 build looked up the `zh` label only. This pass asks for every
//    Chinese label variant Wikidata keeps (zh, zh-hans, zh-hant, zh-cn, zh-tw, zh-hk, zh-sg,
//    zh-my) plus the zh.wikipedia sitelink, so an entity whose label lives in a regional
//    variant is not counted as having no Chinese name.
// b) English country/conflict/victim values: the shipped Chinese arrays repeat labels from the
//    3.15 sweep, which did not keep entity ids. This pass reads the entity's own P17 (country),
//    P361 (part of) and P710 (participant) statements, then resolves the Chinese AND English
//    labels of exactly those entities. An English value can therefore only be written where the
//    same statement entity produces the Chinese label already recorded - nothing is translated.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const outPath=resolve(root,'docs/verification-3.17/atrocities-evidence.json');
const UA='MeridianAtlasResearch/3.17 (source-linked world history atlas; atrocity layer bilingual pass)';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const CJK=/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
const requests=[];
const wbget=async(ids,props,langs,sitefilter)=>{
 const url='https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&formatversion=2&props='+props
  +(langs?'&languages='+langs:'')+(sitefilter?'&sitefilter='+sitefilter:'')+'&ids='+ids.join('%7C');
 for(let attempt=1;attempt<=6;attempt++){
  const response=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'}});
  requests.push({endpoint:'wikidata.wbgetentities',status:response.status,count:ids.length,attempt,at:new Date().toISOString()});
  if(response.ok)return (await response.json()).entities||{};
  if(response.status!==429&&response.status<500)throw new Error('Wikidata HTTP '+response.status);
  await sleep(20000*attempt);
 }
 throw new Error('wbgetentities kept throttling');
};
const chunks=(list,size)=>{const out=[];for(let i=0;i<list.length;i+=size)out.push(list.slice(i,i+size));return out};

const shipped=JSON.parse(await readFile(resolve(root,'public/data/atrocities.json'),'utf8'));
const incidents=shipped.incidents;
const qids=incidents.map(incident=>incident.qid);
const LANGS='zh%7Czh-hans%7Czh-hant%7Czh-cn%7Czh-tw%7Czh-hk%7Czh-sg%7Czh-my%7Cen';
const entities={};
for(const chunk of chunks(qids,25)){
 Object.assign(entities,await wbget(chunk,'labels%7Csitelinks%7Cclaims',LANGS,'zhwiki%7Cenwiki'));
 await sleep(4000);
}
const claimIds=(entity,property)=>[...new Set((entity?.claims?.[property]||[]).map(claim=>claim.mainsnak?.datavalue?.value?.id).filter(Boolean))];
const referenced=new Set();
const perIncident={};
for(const incident of incidents){
 const entity=entities[incident.qid];
 const countries=claimIds(entity,'P17'),conflict=claimIds(entity,'P361'),victims=claimIds(entity,'P710');
 for(const qid of [...countries,...conflict,...victims])referenced.add(qid);
 perIncident[incident.qid]={qid:incident.qid,countries,conflict,victims,
  zhwiki:entity?.sitelinks?.zhwiki?.title||null,enwiki:entity?.sitelinks?.enwiki?.title||null};
}
const labelEntities={};
for(const chunk of chunks([...referenced],25)){
 Object.assign(labelEntities,await wbget(chunk,'labels',LANGS,null));
 await sleep(4000);
}
const labels={};
for(const [qid,entity] of Object.entries(labelEntities)){
 labels[qid]={zh:null,en:null};
 for(const lang of ['zh','zh-hans','zh-cn','zh-sg','zh-my','zh-hant','zh-tw','zh-hk'])if(!labels[qid].zh&&entity?.labels?.[lang]?.value)labels[qid][lang==='zh'?'zh':'zh']=entity.labels[lang].value;
 labels[qid].zhVariant=Object.fromEntries(['zh','zh-hans','zh-hant','zh-cn','zh-tw','zh-hk','zh-sg','zh-my'].map(lang=>[lang,entity?.labels?.[lang]?.value||null]).filter(([,value])=>value));
 labels[qid].en=entity?.labels?.en?.value||null;
 labels[qid].cjkZh=Object.values(labels[qid].zhVariant).find(value=>CJK.test(value))||null;
}
const rows=incidents.map(incident=>{
 const record=perIncident[incident.qid];
 const entity=entities[incident.qid];
 const variants=Object.fromEntries(['zh','zh-hans','zh-hant','zh-cn','zh-tw','zh-hk','zh-sg','zh-my']
  .map(lang=>[lang,entity?.labels?.[lang]?.value||null]).filter(([,value])=>value));
 return {qid:incident.qid,id:incident.id,nameEn:incident.nameEn,nameZhShipped:incident.nameZh,
  zhVariants:variants,zhVariantCJK:Object.values(variants).find(value=>CJK.test(value))||null,
  zhwikiTitle:record.zhwiki,enwikiTitle:record.enwiki,
  countriesZh:incident.countriesZh,conflictZh:incident.conflictZh,victimsZh:incident.victimsZh,
  countries:record.countries,conflict:record.conflict,victims:record.victims};
});
const document={schemaVersion:1,fetchedAt:new Date().toISOString(),
 policy:'Wikidata Action API evidence for the atrocity layer: all Chinese label variants plus the zhwiki sitelink per incident, and the entity ids behind the country/conflict/participant statements so the English arrays can be filled from the same statement entities the Chinese labels came from. Nothing is translated.',
 requests,count:rows.length,referencedEntities:referenced.size,
 checks:{withZhVariant:rows.filter(row=>row.zhVariantCJK).length,shippedWithChineseName:rows.filter(row=>row.nameZhShipped).length,
  withZhwikiSitelink:rows.filter(row=>row.zhwikiTitle).length,withoutAnyChinese:rows.filter(row=>!row.zhVariantCJK&&!row.zhwikiTitle).length},
 labels,rows};
await mkdir(dirname(outPath),{recursive:true});
await writeFile(outPath,JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({out:outPath,count:rows.length,referencedEntities:referenced.size,checks:document.checks,requests:requests.length},null,1));
