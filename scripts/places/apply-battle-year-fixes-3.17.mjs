#!/usr/bin/env node
// Usage: node scripts/places/apply-battle-year-fixes-3.17.mjs [--check]
// Cross-layer date sync for the 3.17 content pass.
//
// validate-cross-layer.mjs requires an entity shared by the event chronicle and the battle
// layer to carry the same year in both. The 3.17 event upgrade corrected five dates whose
// Wikidata P585 value is defective (decade precision on two modern battles, a decade-precision
// BCE value, a year contradicted by both Wikipedia editions, and a P585 that disagrees with the
// article's "circa" date). Leaving the battle layer at the old value would make the two layers
// disagree about the same event, so the battle record is moved to the corrected civil year and
// its note states that the source value was kept only as a record of the disagreement.
//
// Only year/start/end and the dating sentence of notes/notesEn change. Coordinates, region,
// participants, sources and every other field stay untouched. counts.byCentury is recomputed
// with the same century table build-battles.mjs uses.
import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const checkOnly=process.argv.includes('--check');
const CENTURIES=[[-4000,-1500],[-1500,-500],[-500,1],[1,500],[500,1000],[1000,1500],[1500,1800],[1800,1900],[1900,1945],[1945,2000],[2000,2027]];
const FIXES={
 Q111383245:{from:2020,year:2022,start:2022,end:2024,
  noteZh:'维基数据 P585 记为 2020 年（精度为年代，即 2020 年代），中英文维基百科记该战役自 2022 年起、2024 年 2 月 17 日乌军撤离；本条采用条目正文年份 2022 至 2024 年，维基数据原值的作用仅作为分歧记录，3.15 报告与 3.17 事件批次均已说明。',
  noteEn:'Wikidata P585 records 2020 at decade precision, while the English and Chinese Wikipedia articles date the fighting from 2022 to the Ukrainian withdrawal of 17 February 2024; this record adopts the article years 2022-2024 and keeps the source value only as a record of the disagreement, as stated in the 3.15 report and the 3.17 event batch.'},
 Q112206624:{from:2020,year:2022,start:2022,end:2022,
  noteZh:'维基数据 P585 记为 2020 年（精度为年代，即 2020 年代），中英文维基百科记该战役发生于 2022 年 4 月；本条采用条目正文年份 2022 年，维基数据原值的作用仅作为分歧记录，3.15 报告与 3.17 事件批次均已说明。',
  noteEn:'Wikidata P585 records 2020 at decade precision, while the English and Chinese Wikipedia articles date the battle to April 2022; this record adopts the article year 2022 and keeps the source value only as a record of the disagreement, as stated in the 3.15 report and the 3.17 event batch.'},
 Q2274112:{from:1600,year:1614,start:1614,end:1614,
  noteZh:'维基数据 P585 记为 1600 年 12 月 26 日，但中英文维基百科均记该战役发生于 1614 年 11 月 26 日，且该战属 1614 至 1615 年的大坂冬之阵；本条采用条目正文年份 1614 年，维基数据原值作为分歧记录保留，3.17 事件批次同步修正。',
  noteEn:'Wikidata P585 records 26 December 1600, but both the Chinese and English Wikipedia articles date the battle to 26 November 1614, within the winter campaign of 1614-1615; this record adopts 1614 and keeps the source value as a record of the disagreement, synced with the 3.17 event batch.'},
 Q1644792:{from:-497,year:-496,start:-496,end:-496,
  noteZh:'维基数据 P585 为 ISO 天文纪年 −496（精度为年代，即前 490 年代），与民用纪年的前 496 年并非同一记法；英文维基正文指出此战年代自古不明（李维作前 499 年，狄奥尼修斯等作前 496 年，现代学者另有前 493、489 年之说）。本条采用前 496 年（记作 −496），与 3.17 事件批次一致。',
  noteEn:'Wikidata P585 is the ISO astronomical year -496 at decade precision, which is not the same notation as the civil year 496 BCE; the English article states that the year has been unclear since antiquity (Livy gives 499 BC, Dionysius and others 496 BC, some modern authors 493 or 489 BC). This record adopts 496 BCE, written -496, in line with the 3.17 event batch.'},
 Q1036947:{from:-1178,year:-1175,start:-1175,end:-1175,
  noteZh:'维基数据 P585 为 ISO 天文纪年 −1178（即公元前 1179 年），英文维基正文记该战役发生于约公元前 1175 年；本条采用正文的约数年份并记作 −1175，与 3.17 事件批次一致。',
  noteEn:'Wikidata P585 is the ISO astronomical year -1178 (1179 BCE), while the English article dates the battle to circa 1175 BC; this record adopts the article\'s approximate year, written -1175, in line with the 3.17 event batch.'}};
const dropSentences=(text,markers)=>String(text||'').split(/(?<=。)|\. /).map(part=>part.trim()).filter(Boolean).filter(part=>!markers.some(marker=>part.includes(marker))).join(text.includes('。')?'':' ');
const battles=JSON.parse(await readFile(resolve(root,'public/data/battles.json'),'utf8'));
const problems=[];
const applied=[];
for(const [qid,fix] of Object.entries(FIXES)){
 const record=battles.battles.find(battle=>battle.qid===qid);
 if(!record){problems.push('no battle record for '+qid);continue}
 if(record.year!==fix.from)problems.push(qid+': expected the shipped year '+fix.from+' but found '+record.year);
 record.year=fix.year;record.start=fix.start;record.end=fix.end;
 record.notes=dropSentences(record.notes,['P585 记为','P585 为 ISO'])+' '+fix.noteZh;
 record.notesEn=dropSentences(record.notesEn,['P585 records','P585 is the ISO'])+' '+fix.noteEn;
 applied.push({qid,id:record.id,from:fix.from,year:fix.year,start:fix.start,end:fix.end});
}
const byCenturyOut=battles.battles.reduce((all,item)=>{const century=CENTURIES.find(([from,to])=>item.year>=from&&item.year<to);const key=century?century[0]+'..'+(century[1]-1):'other';all[key]=(all[key]||0)+1;return all},{});
battles.counts.byCentury=byCenturyOut;
if(problems.length){console.error('FAIL apply-battle-year-fixes-3.17\n'+problems.join('\n'));process.exit(1)}
const text=JSON.stringify(battles,null,2)+'\n';
const gzip=gzipSync(Buffer.from(text),{level:9});
gzip[4]=gzip[5]=gzip[6]=gzip[7]=0;gzip[9]=255;
if(JSON.stringify(JSON.parse(gunzipSync(gzip).toString()))!==JSON.stringify(battles))throw new Error('gzip mirror does not round-trip');
if(checkOnly){console.log(JSON.stringify({result:'checked',applied,byCentury:byCenturyOut},null,2));process.exit(0)}
await writeFile(resolve(root,'public/data/battles.json'),text);
await writeFile(resolve(root,'public/data/battles.json.gz'),gzip);
console.log(JSON.stringify({result:'applied',applied,gzipBytes:gzip.length,jsonBytes:Buffer.byteLength(text)},null,2));
