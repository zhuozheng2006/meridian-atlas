import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root='/Users/zane/meridian_atlas/world-history-atlas';
const out=root+'/docs/verification-3.34';
await mkdir(out+'/authoring',{recursive:true});
// 1. copy round-3.33 tooling with path rewrite
for (const name of ['fetch-polity-extracts','check-lengths','build-narratives-batch','clean-coverage-notes','write-narratives-gz','patch-editorial-sourcenames','patch-sourcenames']) {
  let t = await readFile(root+'/docs/verification-3.33/'+name+'-3.33.mjs','utf8');
  t = t.split('3.33').join('3.34');
  await writeFile(out+'/'+name+'-3.34.mjs', t);
}
// 2. plan 100 from the remaining verified pool
const cand=JSON.parse(await readFile(root+'/docs/verification-3.32/narratives-candidates.json','utf8'));
const nar=JSON.parse(await readFile(root+'/public/data/enrichment/narratives.json','utf8'));
const have=new Set(nar.entries.map(e=>e.qid));
const verified=[];
for(const e of cand.rows){
  const v=(e.verdict||'').toString();
  if(/not-?a-?polity/i.test(v)||v==='excluded'||e.polity===false) continue;
  if(!e.qid||have.has(e.qid)) continue;
  verified.push(e);
}
const QUOTA={europe:46,africa:12,'west-central-asia':10,'east-asia':8,'south-asia':8,americas:8,'southeast-asia':4,oceania:4};
const byRegion={};
for(const e of verified){const r=e.regionBox||'unknown';(byRegion[r]=byRegion[r]||[]).push(e);}
for(const r of Object.keys(byRegion)) byRegion[r].sort((a,b)=>(b.score||0)-(a.score||0));
const picked=[],used=new Set();
for(const [r,q] of Object.entries(QUOTA)) for(const e of (byRegion[r]||[]).slice(0,q)) if(!used.has(e.qid)){used.add(e.qid);picked.push(e);}
for(const r of Object.keys(byRegion)){ if(picked.length>=100) break; for(const e of byRegion[r]){ if(picked.length>=100) break; if(!used.has(e.qid)){used.add(e.qid);picked.push(e);} } }
const entries=picked.slice(0,100).map(e=>({qid:e.qid,titleZh:e.zh,titleEn:e.en,region:e.regionBox,score:e.score,recordCount:e.recordCount,spanYears:e.spanYears,scope:{start:e.firstStart,end:e.lastEnd},thin:Boolean(e.recordCount<6||e.spanYears<60),enArticle:e.enArticle,articleQid:e.articleQid,p31Labels:e.p31Labels||[]}));
const counts={}; for(const e of entries) counts[e.region]=(counts[e.region]||0)+1;
await writeFile(out+'/narratives-chosen.json',JSON.stringify({schemaVersion:1,generatedAt:new Date().toISOString(),purpose:'round-13 selection from the remaining 3.32 verified pool',target:100,count:entries.length,byRegion:counts,europeShare:Number(((counts.europe||0)/entries.length).toFixed(3)),thinCount:entries.filter(e=>e.thin).length,entries},null,2)+'\n');
console.log(JSON.stringify({pool_remaining:verified.length,picked:entries.length,byRegion:counts,europeShare:Number(((counts.europe||0)/entries.length).toFixed(3)),thin:entries.filter(e=>e.thin).length,after_this_round:verified.length-entries.length}));
