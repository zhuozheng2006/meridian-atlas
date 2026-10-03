#!/usr/bin/env node
// Usage: node scripts/places/check-authoring-3.20.mjs --part=docs/verification-3.20/authoring/part-01.json
//        node scripts/places/check-authoring-3.20.mjs --all
//
// Offline gate for an authored part of the 3.20 batch. It is the 3.17 gate unchanged in
// substance (the batch orders itself by the same 3.17 re-ranking) with the 3.20 paths, so the
// 3.17 evidence files are never overwritten by this round. It is the same wall the 3.16 assembler
// put in front of a batch, plus the checks this round needs: a documented year correction
// instead of an exact match to the index year, and an explicit disclosure in the notes when a
// language edition has no article. Run it until it prints OK before handing the part over.
import {readFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CJK,traditionalHits,countChars,countWords} from './lib/zh-gates.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const arg=name=>{const hit=process.argv.find(value=>value.startsWith('--'+name+'='));return hit?hit.slice(name.length+3):null};
const all=process.argv.includes('--all');
const paths=all?[]:[resolve(root,arg('part')||'')];
if(all){
 const dir=resolve(root,'docs/verification-3.20/authoring');
 for(const name of (await readdir(dir)).filter(name=>/^part-\d+\.json$/.test(name)).sort())paths.push(resolve(dir,name));
}
if(!paths.length||(paths.length===1&&!arg('part'))){console.error('pass --part=<file> or --all');process.exit(2)}
const ranking=JSON.parse(await readFile(resolve(root,'docs/verification-3.17/content-upgrade-ranking.json'),'utf8'));
const extracts=JSON.parse(await readFile(resolve(root,'docs/verification-3.20/content-upgrade-extracts.json'),'utf8'));
const byQid=new Map(ranking.ranking.map(row=>[row.qid,row]));
const extractByQid=new Map(extracts.entries.map(entry=>[entry.qid,entry]));
const ZH_MISSING=['尚无','未有','没有','未设','未建立','不存在','缺'];
const EN_MISSING=['no article','does not yet','has no','no english','without an article'];
const errors=[],warnings=[],rows=[];
for(const path of paths){
 const document=JSON.parse(await readFile(path,'utf8'));
 for(const entry of document.entries||[]){
  const where=(entry.id||entry.qid||'(no id)')+' ['+path.split('/').pop()+']';
  const fail=message=>errors.push(where+': '+message);
  const warn=message=>warnings.push(where+': '+message);
  const qid=String(entry.qid||'').toUpperCase();
  if(!/^Q\d+$/.test(qid)){fail('qid must be Q<number>');continue}
  if(entry.id!=='v312wd-'+qid.toLowerCase())fail('id must be v312wd-'+qid.toLowerCase());
  const row=byQid.get(qid);
  if(!row){fail('qid is not in the 3.17 ranking');continue}
  const extract=extractByQid.get(qid);
  if(!extract)fail('no research extract for this qid');
  if(entry.rank!==row.rank)warn('rank '+entry.rank+' does not match the ranking rank '+row.rank);
  if('provenance' in entry)fail('provenance must not be present');
  for(const field of ['titleZh','titleEn','summaryZh','summaryEn','significanceZh','significanceEn','notesZh','notesEn'])if(typeof entry[field]!=='string'||!entry[field].trim())fail(field+' missing');
  if(!Number.isInteger(entry.start)||!Number.isInteger(entry.end)){fail('start/end must be integers')}
  else{
   if(entry.start===0||entry.end===0)fail('civil years have no year zero');
   if(entry.start>entry.end)fail('start must not be after end');
   if(entry.start<-4000||entry.end>2024)fail('year outside the supported range');
   const correction=entry.yearCorrection||null;
   if(correction){
    if(correction.from!==row.year)fail('yearCorrection.from '+correction.from+' must be the index year '+row.year);
    if(correction.start!==entry.start||correction.end!==entry.end)fail('yearCorrection must match start/end');
    if(typeof correction.reason!=='string'||correction.reason.trim().length<20)fail('yearCorrection.reason must explain the correction');
   }else if(entry.start!==row.year||entry.end!==row.year){
    fail('start/end '+entry.start+'..'+entry.end+' differ from the index year '+row.year+' without a yearCorrection');
   }
  }
  const zhChars=countChars(entry.summaryZh),enWords=countWords(entry.summaryEn);
  if(zhChars<110||zhChars>135)fail('summaryZh is '+zhChars+' characters, expected 110-135');
  if(enWords<45||enWords>60)fail('summaryEn is '+enWords+' words, expected 45-60');
  if(countChars(entry.titleZh)<2||countChars(entry.titleZh)>40)fail('titleZh length '+countChars(entry.titleZh));
  if(countChars(entry.significanceZh)<10)fail('significanceZh too short');
  if(countWords(entry.significanceEn)<5)fail('significanceEn too short');
  if(countChars(entry.notesZh)<40)fail('notesZh too short');
  if(countWords(entry.notesEn)<20)fail('notesEn too short');
  for(const field of ['titleEn','summaryEn','significanceEn','notesEn'])if(CJK.test(entry[field]))fail('CJK character in English field '+field);
  for(const field of ['titleZh','summaryZh','significanceZh','notesZh']){
   const hits=await traditionalHits(entry[field]);
   if(hits.length)fail('traditional-script character in '+field+': '+hits.join(' '));
  }
  const gap=entry.languageGap||{};
  if(extract){
   const realZh=Boolean(extract.zhTitleRequested)&&!extract.zhMissing;
   const realZhFound=realZh||Boolean(entry.zhArticleFound);
   const realEn=Boolean(extract.enTitleRequested)&&!extract.enMissing;
   if(Boolean(gap.zhArticle)!==realZhFound)fail('languageGap.zhArticle '+gap.zhArticle+' but the research record says '+realZhFound);
   if(Boolean(gap.enArticle)!==realEn)fail('languageGap.enArticle '+gap.enArticle+' but the research record says '+realEn);
   if(!realZhFound&&!ZH_MISSING.some(word=>String(entry.notesZh).includes(word)))fail('notesZh must state that the Chinese Wikipedia has no article for this event');
   if(!realEn&&!EN_MISSING.some(word=>String(entry.notesEn).toLowerCase().includes(word)))fail('notesEn must state that the English Wikipedia has no article for this event');
   if(!String(entry.notesZh).includes('维基'))fail('notesZh must name the source edition');
   if(!/wikipedia/i.test(String(entry.notesEn)))fail('notesEn must name the source edition');
   const years=[];
   const intro=(extract.enIntro||'')+' '+(extract.zhIntro||'');
   for(const match of intro.matchAll(/(\d{3,4})\s?(BC|BCE)\b/g))years.push(-Number(match[1]));
   for(const match of intro.matchAll(/公元前\s?(\d{1,4})\s?年/g))years.push(-Number(match[1]));
   for(const match of intro.matchAll(/\b(?:AD|CE)\s?(\d{3,4})\b/g))years.push(Number(match[1]));
   for(const year of [...new Set(years)])if(Math.abs(year-entry.start)<=2&&year!==entry.start)warn('the introduction mentions '+year+' while the entry is dated '+entry.start+' - check the dating note');
  }
  if(entry.yearNote&&typeof entry.yearNote!=='string')fail('yearNote must be a string when present');
  rows.push({part:path.split('/').pop(),qid,rank:entry.rank,id:entry.id,start:entry.start,end:entry.end,zhChars,enWords,
   zhArticle:Boolean(entry.languageGap?.zhArticle),enArticle:Boolean(entry.languageGap?.enArticle),corrected:Boolean(entry.yearCorrection)});
 }
}
console.log(JSON.stringify({parts:paths.length,entries:rows.length,errors:errors.length,warnings:warnings.length},null,1));
if(warnings.length){console.log('--- warnings ---');for(const warning of warnings)console.log('WARN '+warning)}
if(errors.length){console.log('--- errors ---');for(const error of errors)console.log('FAIL '+error);process.exitCode=1}else console.log('OK all hard gates pass');
console.log('--- entries ---');
for(const row of rows)console.log([row.part,row.id,row.rank,row.start+'..'+row.end,'zh'+row.zhChars,'en'+row.enWords,row.zhArticle?'ZH':'--',row.enArticle?'EN':'--',row.corrected?'YEARFIX':''].join(' '));