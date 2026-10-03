import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root='/Users/zane/meridian_atlas/world-history-atlas';
const out=root+'/docs/verification-3.33';
await mkdir(out,{recursive:true});
const cand=JSON.parse(await readFile(root+'/docs/verification-3.32/narratives-candidates.json','utf8'));
const keys=Object.keys(cand);
console.log('candidate file keys:',JSON.stringify(keys));
let arr=null,arrKey=null;
for(const k of keys){ if(Array.isArray(cand[k])&&cand[k].length>50&&cand[k][0]&&cand[k][0].qid){arr=cand[k];arrKey=k;break;} }
console.log('array key:',arrKey,'length:',arr?arr.length:0);
if(arr){console.log('sample entry keys:',JSON.stringify(Object.keys(arr[0])));console.log('sample:',JSON.stringify(arr[0]).slice(0,300));}
const nar=JSON.parse(await readFile(root+'/public/data/enrichment/narratives.json','utf8'));
const have=new Set(nar.entries.map(e=>e.qid));
console.log('existing narratives:',nar.entries.length);
if(arr){
  const verified=new Set(), notPolity=new Set();
  for(const e of arr){
    const v=(e.verdict||e.status||'').toString();
    if(/not-?a-?polity/i.test(v)||v==='excluded') notPolity.add(e.qid); else if(e.qid) verified.add(e.qid);
  }
  const pool=[...verified].filter(q=>!have.has(q));
  const byRegion={};
  for(const q of pool){const e=arr.find(x=>x.qid===q);const r=e.region||'unknown';byRegion[r]=(byRegion[r]||0)+1;}
  console.log('verified total:',verified.size,'notPolity:',notPolity.size,'available:',pool.length);
  console.log('available by region:',JSON.stringify(byRegion));
}
