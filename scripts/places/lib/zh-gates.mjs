// Shared language gates for the 3.17 content pass.
// CJK blocks are the same set the earlier rounds used. The traditional-script set is derived
// from the conversion pairs this repository already accumulated in
// docs/simplified-chinese-conversion.json (equal-length before/after pairs: a differing
// character is a traditional form that must not appear in a shipped Chinese field), plus the
// hand list the 3.16 assembler used.
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

export const CJK=/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
const HAND_LIST='與臺灣國學會東車馬鳥魚點線個時間問題則無為說話語實質軍戰勝歐亞羅蘇聯義紀興漢滿爾佔爭萬長門開關風飛書讀詞';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
let cached=null;
export const traditionalChars=async()=>{
 if(cached)return cached;
 const set=new Set([...HAND_LIST]);
 try{
  const rows=JSON.parse(await readFile(resolve(root,'docs/simplified-chinese-conversion.json'),'utf8'));
  for(const row of rows){
   const before=[...String(row.before||'')],after=[...String(row.after||'')];
   if(before.length!==after.length)continue;
   for(let index=0;index<before.length;index++)if(before[index]!==after[index])set.add(before[index]);
  }
 }catch{}
 cached=set;
 return set;
};
export const traditionalHits=async(text)=>{
 const set=await traditionalChars();
 return [...new Set([...String(text||'')].filter(char=>set.has(char)))];
};
export const countChars=text=>[...String(text||'')].length;
export const countWords=text=>String(text||'').trim().split(/\s+/).filter(Boolean).length;
