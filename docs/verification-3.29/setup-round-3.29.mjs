#!/usr/bin/env node
// Usage: node docs/verification-3.29/setup-round-3.29.mjs
// Prepares the eighth narratives round. The scripts of the 3.28 round are copied with the round
// paths rewritten, and the per-region cap of the identity verification is raised: the previous round
// showed that the old cap (30 for Europe) was the only reason the European pool looked exhausted,
// while a full check found 369 eligible European profiles. The rule that came out of that: never
// conclude that a region has no candidates without stating the cap and re-running with it raised.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const from=resolve(root,'docs/verification-3.28');
const to=resolve(root,'docs/verification-3.29');
await mkdir(resolve(to,'authoring'),{recursive:true});
const wanted=['select-narratives-3.28.mjs','verify-candidates-3.28.mjs','choose-narratives-3.28.mjs','fetch-polity-extracts-3.28.mjs','write-narratives-gz-3.28.mjs','build-narratives-batch-3.28.mjs','clean-coverage-notes-3.28.mjs'];
const copied=[];
for(const name of wanted){
 let text=await readFile(resolve(from,name),'utf8');
 text=text.replaceAll('3.28','3.29');
 if(name==='verify-candidates-3.28.mjs'){
  // Raised caps: Europe 200 (from 30), Africa 120, South Asia 90, west-central Asia 90,
  // the Americas 80, east Asia 60, Southeast Asia 40, Oceania 30, global 20.
  text=text.replace(/const priority=\{[^}]*\};/,"const priority={africa:120,'west-central-asia':90,'south-asia':90,americas:80,'east-asia':60,'southeast-asia':40,oceania:30,europe:200,global:20};");
 }
 if(name==='choose-narratives-3.28.mjs'){
  text=text.replace(/const target=Number\(arg\('target'\)\|\|[0-9]+\);/,"const target=Number(arg('target')||99);");
  text=text.replace(/const QUOTA=\{[^}]*\};/,"const QUOTA={europe:46,africa:8,'west-central-asia':8,'east-asia':8,'south-asia':8,americas:6,'southeast-asia':4,oceania:4,global:3};");
 }
 await writeFile(resolve(to,name.replace('3.28','3.29')),text);
 copied.push(name.replace('3.28','3.29'));
}
console.log(JSON.stringify({copied},null,1));
