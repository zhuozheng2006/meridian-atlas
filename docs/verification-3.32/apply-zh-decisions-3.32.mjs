import {readFile,writeFile} from 'node:fs/promises';
const path='docs/verification-3.32/narratives-extracts.json';
const ex=JSON.parse(await readFile(path,'utf8'));
let accepted=0;
for(const entry of ex.entries){
 entry.zhAccepted=Boolean(entry.zhIdentityMatch);
 entry.zhRejected=entry.zhIdentityMatch?null:(entry.zhTitle?'the Chinese article does not carry this polity QID, or is missing':'the entity has no Chinese Wikipedia sitelink');
 if(entry.zhAccepted)accepted++;
}
await writeFile(path,JSON.stringify(ex,null,2)+'\n');
console.log(JSON.stringify({accepted,rejected:ex.entries.length-accepted}));
