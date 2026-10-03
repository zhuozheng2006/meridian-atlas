#!/usr/bin/env node
// Usage: node scripts/places/check-label-titles-3.20.mjs
// The last two entries whose Wikidata English label differs from the article title the batch
// cites. Both labels were resolved against en.wikipedia and the introductions were read:
//   * "Bluff Cove Air Attacks" differs only in capitalisation, so the article title is used;
//   * "Battle of Akhalzic" is a transliteration variant that resolves to a page the introduction
//     heuristic flags as a disambiguation page, but which is in fact a short article covering
//     the 1828 offensive (this entry) and the 1829 defence of the same fortress. The assembler
//     carries a documented override for it and the entry says so in its notes.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const UA='MeridianAtlasResearch/3.20 (source-linked world history atlas; label title check)';
const extracts=JSON.parse(await readFile(resolve(root,'docs/verification-3.20/content-upgrade-extracts.json'),'utf8'));
const diff=extracts.entries.filter(entry=>entry.titleEn!==entry.enTitleRequested);
const labels=[...new Set(diff.map(entry=>entry.titleEn))];
const url='https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=extracts&exintro=1&explaintext=1&titles='+encodeURIComponent(labels.join('|'));
const response=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'}});
if(!response.ok)throw new Error('HTTP '+response.status);
const data=await response.json();
const VERDICTS={
 'Battle of Akhalzic':{verdict:'same-event-page-with-caveat',reason:'The label is a transliteration variant; the page it resolves to is flagged as a disambiguation page by the introduction heuristic but documents the 1828 offensive (this entry) and the 1829 defence of the same fortress in one short article.'},
 'Bluff Cove Air Attacks':{verdict:'same-event-article',reason:'Only the capitalisation differs from the article title; the event is the same.'}};
const aliases=new Map();
for(const item of data.query?.normalized||[])aliases.set(item.from,item.to);
for(const item of data.query?.redirects||[])aliases.set(item.from,item.to);
const pages=(data.query?.pages||[]).map(page=>{
 const head=(page.extract||'').replace(/\s+/g,' ').trim();
 const requested=[...aliases].find(([,to])=>to===page.title)?.[0]||(labels.includes(page.title)?page.title:page.title);
 return {requested,title:page.title,missing:Boolean(page.missing),
  dab:/may refer to|most commonly refers to|usually refers to|can refer to/.test(head),
  verdict:VERDICTS[requested]?.verdict||'same-event-article',verdictReason:VERDICTS[requested]?.reason||'',intro:head.slice(0,240)};
});
const document={schemaVersion:1,checkedAt:new Date().toISOString(),
 policy:'Existence, disambiguation and same-event check of the two Wikidata English labels that differ from the article titles cited by the final 3.20 batch; both introductions were read by hand.',
 checked:pages.length,pages};
await writeFile(resolve(root,'docs/verification-3.20/content-upgrade-label-title-check.json'),JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({checked:pages.length,pages:pages.map(page=>page.requested+' -> '+page.title+' ['+page.verdict+']')},null,1));
