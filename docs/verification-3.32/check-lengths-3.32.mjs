import {readFile,readdir} from 'node:fs/promises';
const dir='docs/verification-3.32/authoring';
const files=(await readdir(dir)).filter(f=>f.endsWith('.json'));
const enMin=45, zhMin=55;
const short=[];
for(const f of files){
  const doc=JSON.parse(await readFile(dir+'/'+f,'utf8'));
  for(const e of doc.entries||[]){
    for(const [k,sec] of Object.entries(e.sections||{})){
      const w=(sec.en||'').trim().split(/\s+/).filter(Boolean).length;
      const c=(sec.zh||'').replace(/\s/g,'').length;
      if(w<enMin) short.push(f+' '+e.qid+' '+e.titleZh+' '+k+'.en '+w+' words');
      if(c<zhMin) short.push(f+' '+e.qid+' '+e.titleZh+' '+k+'.zh '+c+' chars');
    }
  }
}
console.log(JSON.stringify({files:files.length,belowStandard:short.length,short},null,2));
