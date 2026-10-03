#!/usr/bin/env node
// Usage: node docs/verification-3.25/clean-coverage-notes-3.25.mjs
// The 3.23 builder already writes the required coverage sentence (record count, year range, and
// the thin-coverage warning) into editorialNotes. The authored scopeNote fields repeated it, so
// the shipped notes carried the same sentence twice. This step keeps only the part of an authored
// scope note that the builder does not write itself - the language-gap and source-capture caveats -
// and drops the duplicated coverage sentence.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const dir=resolve(root,'docs/verification-3.23/authoring');
const files=(await readdir(dir)).filter(name=>/^part-\d+\.json$/.test(name)).sort();
let changed=0;
for(const file of files){
 const path=resolve(dir,file);
 const document=JSON.parse(await readFile(path,'utf8'));
 let touched=false;
 for(const entry of document.entries){
  if(entry.scopeNoteZh){
   const text=String(entry.scopeNoteZh);
   const kept=text.startsWith('本站疆域数据')?text.replace(/^本站疆域数据[^。]*。\s*/,'').trim():text;
   if(kept)entry.scopeNoteZh=kept;else delete entry.scopeNoteZh;
   touched=true;
  }
  if(entry.scopeNoteEn){
   const text=String(entry.scopeNoteEn);
   const kept=text.startsWith('The atlas holds')?text.replace(/^The atlas holds[^.]*\.\s*/,'').trim():text;
   if(kept)entry.scopeNoteEn=kept;else delete entry.scopeNoteEn;
   touched=true;
  }
 }
 if(touched){await writeFile(path,JSON.stringify(document,null,2)+'\n');changed++}
}
console.log(JSON.stringify({parts:files.length,changed},null,1));
