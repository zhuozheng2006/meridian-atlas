#!/usr/bin/env node
// Usage: node scripts/places/check-authoring-3.16.mjs
// Pre-flight check for the 3.16 authoring parts. It applies the same hard gates as the
// assembler (length windows, civil-year conversion, CJK and traditional-character bans,
// id shape) plus the extra source-resolution rule of this round, so a part can be corrected
// before the batch is assembled.
import {readFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const CJK=/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
const TRADITIONAL=/[與臺灣國學會東車馬鳥魚點線個時間問題則無為說話語實質軍戰勝歐亞羅蘇聯義紀興漢滿爾佔爭萬長門開關風飛書讀詞]/;
const ranking=JSON.parse(await readFile(resolve(root,'docs/verification-3.14/content-upgrade-ranking.json'),'utf8')).ranking;
const byQid=new Map(ranking.map(row=>[row.qid,row]));
const shipped=JSON.parse(await readFile(resolve(root,'public/data/events.json'),'utf8'));
const shippedById=new Map(shipped.map(entry=>[entry.id,entry]));
const dir=resolve(root,'docs/verification-3.16/authoring');
const parts=(await readdir(dir)).filter(name=>/^part-\d+\.json$/.test(name)).sort();
let bad=0,total=0;
const seen=new Set();
for(const part of parts){
 const document=JSON.parse(await readFile(resolve(dir,part),'utf8'));
 for(const item of document.entries){
  total++;
  const problems=[];
  const qid=(item.id.match(/^v312wd-(q\d+)$/i)||[])[1]?.toUpperCase();
  if(!/^v312wd-q\d+$/i.test(item.id))problems.push('id shape');
  if(seen.has(item.id))problems.push('duplicate id');
  seen.add(item.id);
  const row=byQid.get(qid);
  if(!row)problems.push('no ranking row');
  const civil=row?(row.year<=0?row.year-1:row.year):null;
  if(Number.isInteger(civil)&&(item.start!==civil||item.end!==civil))problems.push('year '+item.start+' != civil '+civil);
  const base=shippedById.get(item.id);
  if(!base)problems.push('no shipped entry');
  else if(base.provenance!=='wikidata-structured')problems.push('not structured');
  const zh=[...String(item.summaryZh||'')].length;
  const en=String(item.summaryEn||'').trim().split(/\s+/).filter(Boolean).length;
  if(zh<110||zh>135)problems.push('zh '+zh);
  if(en<45||en>60)problems.push('en '+en);
  for(const [field,value] of [['summaryZh',item.summaryZh],['significanceZh',item.significanceZh],['notesZh',item.notesZh],['summaryEn',item.summaryEn],['significanceEn',item.significanceEn],['notesEn',item.notesEn]])
   if(typeof value!=='string'||value.trim().length<8)problems.push(field+' short');
  if(typeof item.titleZh!=='string'||[...item.titleZh].length<2)problems.push('titleZh short');
  if(typeof item.titleEn!=='string'||item.titleEn.trim().length<4)problems.push('titleEn short');
  if(CJK.test([item.titleEn,item.summaryEn,item.significanceEn,item.notesEn].join(' ')))problems.push('CJK in English');
  const hit=[item.titleZh,item.summaryZh,item.significanceZh,item.notesZh].join(' ').match(TRADITIONAL);
  if(hit)problems.push('traditional '+[...new Set(hit)].join(''));
  if([...String(item.titleZh||'')].length>40)problems.push('titleZh long');
  if(problems.length){bad++;console.log('FAIL',part,item.id,problems.join(' | '))}
  else console.log('ok  ',part,item.id,'zh='+zh,'en='+en,'year='+item.start);
 }
}
console.log(JSON.stringify({parts:parts.length,entries:total,failed:bad}));
process.exitCode=bad?1:0;
