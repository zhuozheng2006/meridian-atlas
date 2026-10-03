import {readFile,writeFile} from 'node:fs/promises';
const root='/Users/zane/meridian_atlas/world-history-atlas';
const p=root+'/docs/verification-3.33/narratives-extracts.json';
const ex=JSON.parse(await readFile(p,'utf8'));
let accepted=0;
for(const e of ex.entries){ e.zhAccepted=Boolean(e.zhIdentityMatch); if(e.zhAccepted) accepted++; }
await writeFile(p,JSON.stringify(ex,null,2)+'\n');
console.log(JSON.stringify({accepted,rejected:ex.entries.length-accepted}));
