#!/usr/bin/env node
// Usage: node scripts/places/verify-simplified-3.17.mjs
// Simplified-script verification for the 3.17 authored Chinese fields. Every Chinese string the
// batch ships is sent through the Chinese Wikipedia variant converter
// (action=parse&variant=zh-cn) and compared with the authored text: if the converter changes a
// field, that field was not simplified. This is the same converter the project used for the
// 3.14 conversion record, so the check does not depend on a hand-written character list.
// The check leaves the repository; the result is cached next to the batch for the assembler.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const UA='MeridianAtlasResearch/3.17 (source-linked world history atlas; simplified-script check)';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const batch=JSON.parse(await readFile(resolve(root,'editorial/events-upgraded-3.17.json'),'utf8'));
const targets=[];
for(const entry of batch.entries){
 const fields=[['title.zh',entry.title.zh],['summary.zh',entry.summary.zh],['significance.zh',entry.significance.zh],['editorialNotes.zh',entry.editorialNotes.zh]];
 for(const [field,text] of fields)targets.push({id:entry.id,qid:entry.wikidataQid,field,text});
}
const unique=[...new Map(targets.map(item=>[item.text,item])).values()];
const results=[];
for(const item of unique){
 let converted=null;
 for(let attempt=1;attempt<=4;attempt++){
  const response=await fetch('https://zh.wikipedia.org/w/api.php?action=parse&format=json&formatversion=2&contentmodel=wikitext&variant=zh-cn&prop=text&text='+encodeURIComponent(item.text),{headers:{'user-agent':UA,accept:'application/json'}});
  if(response.ok){
   const data=await response.json();
   converted=(data.parse?.text||'').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').trim();
   break;
  }
  if(response.status!==429&&response.status<500)throw new Error('HTTP '+response.status);
  await sleep(15000*attempt);
 }
 results.push({id:item.id,qid:item.qid,field:item.field,text:item.text,converted,identical:converted===null?null:converted===item.text});
 await sleep(1200);
}
const changed=results.filter(item=>item.identical===false);
const unknown=results.filter(item=>item.identical===null);
const report={schemaVersion:1,checkedAt:'2026-10-03T00:00:00+00:00',
 policy:'Every Chinese field of the 3.17 batch was converted with the Chinese Wikipedia variant converter (zh-cn) and compared with the authored text. A difference means the field was not already simplified; the conversion is recorded so the finding can be reviewed rather than hidden.',
 converter:'https://zh.wikipedia.org/w/api.php action=parse variant=zh-cn',
 checked:results.length,changed:changed.length,unavailable:unknown.length,results};
await writeFile(resolve(root,'docs/verification-3.17/content-simplified-check.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checked:results.length,changed:changed.length,unavailable:unknown.length,
 changedExamples:changed.slice(0,8).map(item=>[item.id,item.field,item.text.slice(0,40),String(item.converted).slice(0,40)])},null,1));
