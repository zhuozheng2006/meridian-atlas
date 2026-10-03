#!/usr/bin/env node
// Usage: node docs/verification-3.25/restore-language-notes-3.25.mjs
// The coverage-note cleanup removed the language caveat from entries whose scope note carried it
// in the same sentence as the coverage warning. For every entry that has no Chinese Wikipedia
// citation (zhAccepted false in the round evidence) the caveat is restored as its own scope note,
// so the reader still sees that the essay rests on the English article and the Wikidata entity.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const extracts=JSON.parse(await readFile(resolve(root,'docs/verification-3.23/narratives-extracts.json'),'utf8'));
const noZh=new Set(extracts.entries.filter(entry=>!entry.zhAccepted).map(entry=>entry.qid));
const dir=resolve(root,'docs/verification-3.23/authoring');
const files=(await readdir(dir)).filter(name=>/^part-\d+\.json$/.test(name)).sort();
let added=0;
for(const file of files){
 const path=resolve(dir,file);
 const document=JSON.parse(await readFile(path,'utf8'));
 let touched=false;
 for(const entry of document.entries){
  if(!noZh.has(entry.qid)||entry.scopeNoteZh)continue;
  entry.scopeNoteZh='中文维基百科没有该政体的独立条目，叙述依据英文维基百科条目与维基数据实体。';
  entry.scopeNoteEn='Chinese Wikipedia has no separate article on this polity, so the essay rests on the English article and the Wikidata entity.';
  added++;touched=true;
 }
 if(touched)await writeFile(path,JSON.stringify(document,null,2)+'\n');
}
console.log(JSON.stringify({entriesWithRestoredNote:added},null,1));
