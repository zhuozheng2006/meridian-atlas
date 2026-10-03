import {readFile,writeFile} from 'node:fs/promises';
const path='docs/verification-3.28/narratives-extracts.json';
const ex=JSON.parse(await readFile(path,'utf8'));
let accepted=0;
for(const entry of ex.entries){
 // The fetch step resolved the Chinese article through the zhwiki sitelink and recorded its
 // pageprops.wikibase_item, so acceptance is a comparison, not a judgement call.
 entry.zhAccepted=Boolean(entry.zhIdentityMatch);
 entry.zhRejected=entry.zhIdentityMatch?null:(entry.zhTitle?'the Chinese article does not carry this polity QID, or is missing':'the entity has no Chinese Wikipedia sitelink');
 if(entry.zhAccepted)accepted++;
}
await writeFile(path,JSON.stringify(ex,null,2)+'\n');
console.log(JSON.stringify({accepted,rejected:ex.entries.length-accepted}));
