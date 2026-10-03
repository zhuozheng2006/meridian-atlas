#!/usr/bin/env node
// Usage: node scripts/places/apply-battle-year-fixes-3.18.mjs [--check]
// Cross-layer date sync for the 3.18 content pass, the same mechanism the 3.17 round used.
//
// validate-cross-layer.mjs requires an entity shared by the event chronicle and the battle
// layer to carry the same year in both. Two entries of the 3.18 batch were dated from the
// article text rather than from the structured index year, and both are also battle records:
//   Q1443091 Battle of Garigliano - index 1504, but the English article and the Wikidata P585
//            statement both give 29 December 1503.
//   Q2888964 Battle of Kojima     - index 1185 (P585 10 January 1185), but the English article
//            states that the battle took place in 1184.
// Leaving the battle layer at the old value would make the two layers contradict each other
// about the same event, so the battle record moves to the corrected civil year and its note
// states that the source value is kept only as a record of the disagreement.
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
 Q1443091:{from:1504,year:1503,start:1503,end:1503,
  noteZh:'维基数据 P585 记为 1503 年 12 月 29 日（精度到日），英文维基正文亦记该日为战事发生日，而结构化索引年为 1504；本条采用条目正文与 P585 一致的 1503 年，索引原值的作用仅作为分歧记录，3.18 事件批次同步修正。',
  noteEn:'Wikidata P585 records 29 December 1503 at day precision and the English article dates the fighting to the same day, while the structured index year was 1504; this record adopts 1503 in line with the article and the source statement, keeping the index value only as a record of the disagreement, synced with the 3.18 event batch.'},
 Q2888964:{from:1185,year:1184,start:1184,end:1184,
  noteZh:'英文维基正文明确记该战役发生于 1184 年，而结构化索引年与维基数据 P585 为 1185 年 1 月 10 日（精度到日），差异可能源于旧历年末与公历年初的换算；本条采用条目正文的 1184 年，索引原值作为分歧记录保留，3.18 事件批次同步修正。',
  noteEn:'The English article states that the battle took place in 1184, while the structured index year and the Wikidata P585 statement give 10 January 1185 at day precision, a difference that may come from the turn of the old lunisolar year; this record adopts 1184 from the article and keeps the index value as a record of the disagreement, synced with the 3.18 event batch.'}};
const dropSentences=(text,markers)=>String(text||'').split(/(?<=。)|. /).map(part=>part.trim()).filter(Boolean).filter(part=>!markers.some(marker=>part.includes(marker))).join(text.includes('。')?'':' ');
const battles=JSON.parse(await readFile(resolve(root,'public/data/battles.json'),'utf8'));
const events=JSON.parse(await readFile(resolve(root,'public/data/events.json'),'utf8'));
const problems=[];
const applied=[];
for(const [qid,fix] of Object.entries(FIXES)){
 const record=battles.battles.find(battle=>battle.qid===qid);
 if(!record){problems.push('no battle record for '+qid);continue}
 // The script must stay re-runnable after it has been applied: a record already carrying the
 // corrected year is accepted, and only a third value is an error.
 const alreadyFixed=record.year===fix.year&&record.start===fix.start&&record.end===fix.end;
 if(record.year!==fix.from&&!alreadyFixed)problems.push(qid+': expected the shipped year '+fix.from+' but found '+record.year);
 const event=events.find(item=>item.wikidataQid===qid);
 if(!event)problems.push(qid+': no event record to be consistent with');
 else if(event.start!==fix.year)problems.push(qid+': the event record is dated '+event.start+' but the fix expects '+fix.year);
 if(!alreadyFixed){
  record.year=fix.year;record.start=fix.start;record.end=fix.end;
  record.notes=dropSentences(record.notes,['P585 记为','P585 为 ISO'])+' '+fix.noteZh;
  record.notesEn=dropSentences(record.notesEn,['P585 records','P585 is the ISO'])+' '+fix.noteEn;
 }
 applied.push({qid,id:record.id,from:fix.from,year:fix.year,start:fix.start,end:fix.end});
}
const byCenturyOut=battles.battles.reduce((all,item)=>{const century=CENTURIES.find(([from,to])=>item.year>=from&&item.year<to);const key=century?century[0]+'..'+(century[1]-1):'other';all[key]=(all[key]||0)+1;return all},{});
battles.counts.byCentury=byCenturyOut;
if(problems.length){console.error('FAIL apply-battle-year-fixes-3.18\n'+problems.join('\n'));process.exit(1)}
const text=JSON.stringify(battles,null,2)+'\n';
const gzip=gzipSync(Buffer.from(text),{level:9});
gzip[4]=gzip[5]=gzip[6]=gzip[7]=0;gzip[9]=255;
if(JSON.stringify(JSON.parse(gunzipSync(gzip).toString()))!==JSON.stringify(battles))throw new Error('gzip mirror does not round-trip');
if(checkOnly){console.log(JSON.stringify({result:'checked',applied,byCentury:byCenturyOut},null,2));process.exit(0)}
await writeFile(resolve(root,'public/data/battles.json'),text);
await writeFile(resolve(root,'public/data/battles.json.gz'),gzip);
console.log(JSON.stringify({result:'applied',applied,gzipBytes:gzip.length,jsonBytes:Buffer.byteLength(text)},null,2));
