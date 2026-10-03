#!/usr/bin/env node
// Copies this round's pipeline from the 3.23 scripts, rewriting the round paths so that every
// artefact of the fourth batch lives under docs/verification-3.26/, including the authoring parts
// the builder reads (docs/verification-3.26/authoring/). The only behavioural change is the region
// quota: from this round the European share is deliberately raised to 40-50 per cent, because the
// under-covered regions have been worked down in the first three batches.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const from=resolve(root,'docs/verification-3.23');
const to=resolve(root,'docs/verification-3.26');
await mkdir(to,{recursive:true});
const files=(await readdir(from)).filter(name=>/\.mjs$/.test(name));
const copied=[];
for(const name of files){
 let text=await readFile(resolve(from,name),'utf8');
 text=text.replaceAll('3.23','3.26');
 if(name==='choose-narratives-3.26.mjs'){
  text=text.replace(/const QUOTA=\{[^}]*\};/,"const QUOTA={europe:33,africa:9,americas:8,'south-asia':8,'southeast-asia':7,oceania:5};");
  text=text.replace(/const PRIORITY=\[[^\]]*\];/,"const PRIORITY=['africa','americas','south-asia','southeast-asia','oceania','europe'];");
  text=text.replace(/const europeCap=[^;]*;/,"const europeCap=Math.floor(target*0.5);");
  text=text.replace(/quotas:'[^']*'/,"quotas:'Under-covered regions first (Africa, Americas, South Asia, Southeast Asia, Oceania); from this round Europe is deliberately raised to a quota of 33 of 70 plans (about 47 per cent) and capped at 50 per cent; the rest by score'");
 }
 await writeFile(resolve(to,name),text);
 copied.push(name);
}
console.log(JSON.stringify({copied},null,1));
