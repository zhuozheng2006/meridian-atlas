import {readFile,readdir} from 'node:fs/promises';
const dir='docs/verification-3.34/authoring';
const only=process.argv[2];
const enMin=35, zhMin=50;
const TRAD=/[與臺灣國學會東車馬鳥魚點線個時間問題則無為說話語實質]/;
const EVAL=/(最强大|最強|最强|最大最强|最伟大|最偉大|无与伦比|無與倫比|首屈一指|空前绝后)/;
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
      const bad=[...new Set(((sec.zh||'').match(new RegExp(TRAD,'g'))||[]))];
      if(bad.length) issues.push(f+' '+e.qid+' '+e.titleZh+' '+k+'.zh traditional: '+bad.join(''));
      if(((sec.en||'').match(/[\u4e00-\u9fff]/g)||[]).length) issues.push(f+' '+e.qid+' '+e.titleZh+' '+k+'.en contains CJK');
      const ev=((sec.zh||'').match(EVAL)||[]);
      if(ev.length) issues.push(f+' '+e.qid+' '+e.titleZh+' '+k+'.zh evaluative: '+ev.join(','));
    }
  }
}
console.log(JSON.stringify({scope:only||'all',issues:issues.length,detail:issues}));
process.exit(issues.length?1:0);
