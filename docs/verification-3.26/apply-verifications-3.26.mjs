import {readFile,writeFile} from 'node:fs/promises';
const ex=JSON.parse(await readFile('docs/verification-3.26/narratives-extracts.json','utf8'));
const en=JSON.parse(await readFile('docs/verification-3.26/narratives-en-verified.json','utf8'));
const zh=JSON.parse(await readFile('docs/verification-3.26/narratives-zh-verified.json','utf8'));
const enBy=new Map(en.decisions.map(row=>[row.qid,row]));
const zhBy=new Map(zh.decisions.map(row=>[row.qid,row]));
let updated=0;
for(const entry of ex.entries){
 const e=enBy.get(entry.qid);
 if(e){entry.enIdentityMatch=Boolean(e.accepted);entry.enVerifiedTitle=e.title;entry.enIdentityReason=e.reason;if(e.accepted&&e.title)entry.enTitle=e.title}
 const z=zhBy.get(entry.qid);
 if(z){entry.zhAccepted=Boolean(z.accepted);entry.zhRejected=z.accepted?null:z.reason;if(z.accepted&&z.title)entry.zhTitle=z.title}
 updated++;
}
await writeFile('docs/verification-3.26/narratives-extracts.json',JSON.stringify(ex,null,2)+'\n');
console.log(JSON.stringify({updated,enAccepted:ex.entries.filter(e=>e.enIdentityMatch).length,zhAccepted:ex.entries.filter(e=>e.zhAccepted).length}));
