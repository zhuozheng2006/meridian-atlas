import {readFile,readdir} from 'node:fs/promises';
const dir='docs/verification-3.34/authoring';
const only=process.argv[2];
const enMin=35, zhMin=50;
const TRAD=/[與臺灣國學會東車馬鳥魚點線個時間問題則無為說話語實質]/;
const files=(await readdir(dir)).filter(f=>f.endsWith('.json')&&(!only||f===only));
const short=[];
for(const f of files){
  const doc=JSON.parse(await readFile(dir+'/'+f,'utf8'));
  for(const e of doc.entries||[]){
    for(const [k,sec] of Object.entries(e.sections||{})){
      const w=(sec.en||'').trim().split(/\s+/).filter(Boolean).length;
      const c=(sec.zh||'').replace(/\s/g,'').length;
      if(w<enMin) short.push(f+' '+e.qid+' '+e.titleZh+' '+k+'.en '+w);
      if(c<zhMin) short.push(f+' '+e.qid+' '+e.titleZh+' '+k+'.zh '+c);
      const bad=[...new Set(((sec.zh||'').match(new RegExp(TRAD,'g'))||[]))];
      if(bad.length) short.push(f+' '+e.qid+' '+e.titleZh+' '+k+'.zh traditional: '+bad.join(''));
      const enCjk=((sec.en||'').match(/[\u4e00-\u9fff]/g)||[]);
      if(enCjk.length) short.push(f+' '+e.qid+' '+e.titleZh+' '+k+'.en contains CJK');
    }
  }
}
console.log(JSON.stringify({scope:only||'all',belowGate:short.length,issues:short}));
process.exit(short.length?1:0);
