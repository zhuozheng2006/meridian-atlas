import {readFile,readdir} from 'node:fs/promises';
const dir='docs/verification-3.35/authoring';
const only=process.argv[2];
const enMin=35, zhMin=50;
// single source of truth: read the traditional/evaluative patterns from the gate script itself
const gate=await readFile('docs/verification-3.35/build-narratives-batch-3.35.mjs','utf8');
function patternFrom(name){
  const m=gate.match(new RegExp('const\\s+'+name+'\\s*=\\s*(/.*?/[a-z]*)'));
  if(!m) throw new Error('cannot find '+name+' in gate script');
  return eval(m[1]);
}
const TRAD=patternFrom('TRADITIONAL');
const EVAL=patternFrom('EVALUATIVE');
const files=(await readdir(dir)).filter(f=>f.endsWith('.json')&&(!only||f===only));
const issues=[];
for(const f of files){
  const doc=JSON.parse(await readFile(dir+'/'+f,'utf8'));
  for(const e of doc.entries||[]){
    for(const [k,sec] of Object.entries(e.sections||{})){
      const w=(sec.en||'').trim().split(/\s+/).filter(Boolean).length;
      const c=(sec.zh||'').replace(/\s/g,'').length;
      if(w<enMin) issues.push(f+' '+e.qid+' '+e.titleZh+' '+k+'.en '+w);
      if(c<zhMin) issues.push(f+' '+e.qid+' '+e.titleZh+' '+k+'.zh '+c);
      const bad=[...new Set(((sec.zh||'').match(new RegExp(TRAD.source,'g'))||[]))];
      if(bad.length) issues.push(f+' '+e.qid+' '+e.titleZh+' '+k+'.zh traditional: '+bad.join(''));
      if(((sec.en||'').match(/[\u4e00-\u9fff]/g)||[]).length) issues.push(f+' '+e.qid+' '+e.titleZh+' '+k+'.en contains CJK');
      const ev=((sec.zh||'').match(EVAL)||[]);
      if(ev.length) issues.push(f+' '+e.qid+' '+e.titleZh+' '+k+'.zh evaluative: '+ev.join(','));
    }
  }
}
console.log(JSON.stringify({scope:only||'all',tradPattern:String(TRAD),evalPattern:String(EVAL),issues:issues.length,detail:issues}));
process.exit(issues.length?1:0);
