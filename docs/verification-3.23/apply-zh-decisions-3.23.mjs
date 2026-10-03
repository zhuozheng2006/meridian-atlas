#!/usr/bin/env node
// Usage: node docs/verification-3.23/apply-zh-decisions-3.23.mjs
// Merges the Chinese citation decisions into narratives-extracts.json so the builder reads one
// evidence file: zhAccepted, zhTitle (the accepted article title) and zhRejected (the reason).
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const extracts=JSON.parse(await readFile(resolve(root,'docs/verification-3.23/narratives-extracts.json'),'utf8'));
const verified=JSON.parse(await readFile(resolve(root,'docs/verification-3.23/narratives-zh-verified.json'),'utf8'));
const byQid=new Map(verified.decisions.map(row=>[row.qid,row]));
for(const entry of extracts.entries){
 const decision=byQid.get(entry.qid);
 if(!decision){entry.zhAccepted=false;entry.zhRejected='no decision recorded';continue}
 entry.zhAccepted=decision.accepted;
 entry.zhRejected=decision.accepted?null:decision.reason;
 if(decision.accepted)entry.zhTitle=decision.title;
}
extracts.policy=extracts.policy+' Chinese citations were then checked against pageprops.wikibase_item and, where the label article was missing, against hand-read search candidates (docs/verification-3.23/narratives-zh-verified.json): 55 of 70 entries cite a Chinese article whose item equals the polity QID, 15 do not and ship with an English citation plus the Wikidata entity instead.';
await writeFile(resolve(root,'docs/verification-3.23/narratives-extracts.json'),JSON.stringify(extracts,null,2)+'\n');
console.log(JSON.stringify({entries:extracts.entries.length,zhAccepted:extracts.entries.filter(entry=>entry.zhAccepted).length,
 zhRejected:extracts.entries.filter(entry=>!entry.zhAccepted).length},null,1));
