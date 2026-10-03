#!/usr/bin/env node
// Usage: node docs/verification-3.28/setup-round-3.28.mjs
// Prepares the sixth narratives round. The selection, candidate verification and extraction scripts
// from the 3.26 round are copied and their round paths rewritten, and the extraction step is changed
// so that it resolves every English article through the Wikidata enwiki sitelink from the start:
// rule one of this project is that an external article is reached by looking the entity up, never by
// taking the first hit of a search by name (in 3.26 that mistake produced a disambiguation page and
// an article about the concept qi).
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const from=resolve(root,'docs/verification-3.26');
const to=resolve(root,'docs/verification-3.28');
await mkdir(resolve(to,'authoring'),{recursive:true});
const wanted=['select-narratives-3.26.mjs','verify-candidates-3.26.mjs','choose-narratives-3.26.mjs','fetch-polity-extracts-3.26.mjs','verify-en-3.26.mjs','verify-zh-3.26.mjs','apply-verifications-3.26.mjs','write-narratives-gz-3.26.mjs','build-narratives-batch-3.26.mjs','clean-coverage-notes-3.26.mjs'];
const copied=[];
for(const name of wanted){
 let text=await readFile(resolve(from,name),'utf8');
 text=text.replaceAll('3.26','3.28');
 // the builder keeps reading the plans and extracts of this same round
 text=text.replaceAll('docs/verification-3.28/narratives-chosen.json','docs/verification-3.28/narratives-chosen.json');
 if(name==='fetch-polity-extracts-3.26.mjs'){
  // resolve the English article through the Wikidata sitelink instead of searching by name
  text=text.replace(/const enTitle=[^;]*;/,"const enTitle=await sitelinkFor(qid);");
 }
 await writeFile(resolve(to,name.replace('3.26','3.28')),text);
 copied.push(name.replace('3.26','3.28'));
}
console.log(JSON.stringify({copied},null,1));
