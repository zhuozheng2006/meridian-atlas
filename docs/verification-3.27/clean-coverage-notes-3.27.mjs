#!/usr/bin/env node
// Usage: node docs/verification-3.27/clean-coverage-notes-3.27.mjs
// Two entries repeated the builder's coverage sentence in their authored scope note. The builder
// writes the record count, the year range and the thin-coverage warning itself, so the authored
// note keeps only the caveats it does not write.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const dir=resolve(root,'docs/verification-3.27/authoring');
const files=(await readdir(dir)).filter(name=>/^part-\d+\.json$/.test(name)).sort();
let cleaned=0;
for(const file of files){
 const path=resolve(dir,file);
 const document=JSON.parse(await readFile(path,'utf8'));
 let touched=false;
 for(const entry of document.entries){
  for(const [field,prefix] of [['scopeNoteZh','本站疆域数据'],['scopeNoteEn','The atlas holds']]){
   const text=entry[field];
   if(!text||!String(text).startsWith(prefix))continue;
   const kept=String(text).replace(field==='scopeNoteZh'?/^本站疆域数据[^。]*。\s*/:/^The atlas holds[^.]*\.\s*/,'').trim();
   if(kept)entry[field]=kept;else delete entry[field];
   touched=true;cleaned++;
  }
 }
 if(touched)await writeFile(path,JSON.stringify(document,null,2)+'\n');
}
console.log(JSON.stringify({cleaned}));
