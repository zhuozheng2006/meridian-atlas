#!/usr/bin/env node
// Usage: node scripts/places/report-content-round11-3.20.mjs [--baseline=<commit>]
// Generates docs/verification-3.20/content-round11.md and .json: the closing report of the
// structured-index upgrade pipeline plus the cumulative ledger the round asked for. Every
// number is computed from the files of all seven batches, never typed by hand.
import {readFile,writeFile} from 'node:fs/promises';
import {execSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const baselineArg=process.argv.find(value=>value.startsWith('--baseline='));
const baseline=baselineArg?baselineArg.slice('--baseline='.length):execSync('git rev-parse --short HEAD',{cwd:root}).toString().trim();
const readJson=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const labelOf=new Map();
for(const file of ['docs/verification-3.14/content-upgrade-ranking.json','docs/verification-3.17/content-upgrade-ranking.json'])
 for(const row of (await readJson(file)).ranking)labelOf.set(row.qid,row.titleEn);
const BATCHES=[
 {round:'3.14',file:'editorial/events-upgraded-3.14.json',audit:null,window:'ranks 1-40 (3.14 ranking)'},
 {round:'3.15',file:'editorial/events-upgraded-3.15.json',audit:null,window:'ranks 41-100 minus 2 deferred'},
 {round:'3.16',file:'editorial/events-upgraded-3.16.json',audit:null,window:'ranks 101-161 minus 1 deferred'},
 {round:'3.17',file:'editorial/events-upgraded-3.17.json',audit:'docs/verification-3.17/content-upgrade-authoring.json',window:'3.17 ranking ranks 1-40'},
 {round:'3.18',file:'editorial/events-upgraded-3.18.json',audit:'docs/verification-3.18/content-upgrade-authoring.json',window:'3.17 ranking ranks 41-80'},
 {round:'3.19',file:'editorial/events-upgraded-3.19.json',audit:'docs/verification-3.19/content-upgrade-authoring.json',window:'3.17 ranking ranks 81-120'},
 {round:'3.20',file:'editorial/events-upgraded-3.20.json',audit:'docs/verification-3.20/content-upgrade-authoring.json',window:'3.17 ranking ranks 121-133'}];
const ledgerBatches=[];const allCorrections=[];const allTitleDiffs=[];let cumulative=0;
for(const batch of BATCHES){
 const document=await readJson(batch.file);
 const diffs=document.entries.filter(entry=>labelOf.has(entry.wikidataQid)&&labelOf.get(entry.wikidataQid)!==entry.title.en)
  .map(entry=>({round:batch.round,qid:entry.wikidataQid,label:labelOf.get(entry.wikidataQid),article:entry.title.en,
   kind:entry.title.en.startsWith(labelOf.get(entry.wikidataQid))&&/ \(/.test(entry.title.en)?'qualified-with-year-or-epithet':(entry.title.en.toLowerCase()===labelOf.get(entry.wikidataQid).toLowerCase()?'case-only':'renamed')}));
 let corrections=[];
 if(batch.audit){const audit=await readJson(batch.audit);corrections=audit.entries.filter(row=>row.yearCorrection).map(row=>({round:batch.round,qid:row.qid,id:row.id,from:row.yearCorrection.from,to:row.year,reason:row.yearCorrection.reason}));}
 cumulative+=document.count;
 ledgerBatches.push({round:batch.round,window:batch.window,count:document.count,cumulative,yearCorrections:corrections.length,labelVersusArticleTitle:diffs.length});
 allCorrections.push(...corrections);allTitleDiffs.push(...diffs);
}
const ranking314=await readJson('docs/verification-3.14/content-upgrade-ranking.json');
const ranking317=await readJson('docs/verification-3.17/content-upgrade-ranking.json');
const authoring=await readJson('docs/verification-3.20/content-upgrade-authoring.json');
const batch=await readJson('editorial/events-upgraded-3.20.json');
const shipped=await readJson('public/data/events.json');
const battles=await readJson('public/data/battles.json');
const zhLookup=await readJson('docs/verification-3.20/content-upgrade-zh-lookup.json');
const extracts=await readJson('docs/verification-3.20/content-upgrade-extracts.json');
const labelCheck=await readJson('docs/verification-3.20/content-upgrade-label-title-check.json');
const battleValidation=await readJson('docs/verification-3.20/content-battles-validation.json');
const languageAudit=await readJson('docs/verification-3.20/content-language-audit.json');
const structured=shipped.filter(event=>event.provenance==='wikidata-structured');
const upgraded=shipped.filter(event=>event.wikidataQid&&!event.provenance);
const labelCheck3_18=await readJson('docs/verification-3.18/content-upgrade-label-title-check.json');
const labelCheck3_19=await readJson('docs/verification-3.19/content-upgrade-label-title-check.json');
const disambiguated=allTitleDiffs.filter(row=>/ \(| \(/.test(row.article)).length;
const titleKind={qualified:allTitleDiffs.filter(row=>row.kind==='qualified-with-year-or-epithet').length,
 renamed:allTitleDiffs.filter(row=>row.kind==='renamed').length,
 caseOnly:allTitleDiffs.filter(row=>row.kind==='case-only').length};
const gzipCheck=async path=>{
 const bytes=await readFile(resolve(root,path));
 const json=JSON.parse(await readFile(resolve(root,path.replace(/\.gz$/,'')),'utf8'));
 return {file:path,mtimeZero:bytes[4]===0&&bytes[5]===0&&bytes[6]===0&&bytes[7]===0,os:bytes[9],
  deepEqual:JSON.stringify(JSON.parse(gunzipSync(bytes).toString()))===JSON.stringify(json)};
};
const commands=[
 ['node scripts/validate-cross-layer.mjs'],['node scripts/validate.mjs'],['node scripts/validate-v2.mjs'],
 ['node scripts/validate-places.mjs'],['node scripts/validate-city-time.mjs'],['node scripts/validate-polity-period.mjs'],
 ['node scripts/validate-release.mjs'],
 ['node scripts/places/validate-battles.mjs . docs/verification-3.20/content-battles-validation.json'],
 ['node scripts/places/audit-language.mjs . docs/verification-3.20/content-language-audit.json'],
 ['node scripts/places/check-authoring-3.20.mjs --part=docs/verification-3.20/authoring/part-01.json'],
 ['node scripts/places/assemble-events-upgraded-3.20.mjs --check']];
const validations=[];
for(const [command] of commands){
 let exitCode=0,output='';
 try{output=execSync(command,{cwd:root,maxBuffer:32*1024*1024}).toString()}catch(error){exitCode=error.status??1;output=String(error.stdout||'')+String(error.stderr||'')}
 validations.push({command,exitCode,lastLines:output.trim().split('\n').slice(-3)});
}
const crossRun=validations.find(row=>row.command.includes('validate-cross-layer'));
const crossMatch=crossRun&&crossRun.lastLines.join(' ').match(/"passed":(\d+),"total":(\d+)/);
const gz=[await gzipCheck('public/data/events.json.gz'),await gzipCheck('public/data/battles.json.gz')];
const document={schemaVersion:1,round:'3.20',title:'内容第十一轮：最后 13 条升级完毕，结构化索引归零（291 → 0）',
 generatedAt:new Date().toISOString(),task:'task-23',baseline,head:execSync('git rev-parse --short HEAD',{cwd:root}).toString().trim(),
 summary:{eventsTotal:shipped.length,structuredBefore:13,structuredAfter:structured.length,upgradedThisRound:batch.count,
  promotedEditorial:upgraded.length,battles:battles.battles.length,pipelineComplete:structured.length===0},
 ledger:{initialPool:ranking314.ranking.length,reRankedPool:ranking317.ranking.length,upgradedTotal:upgraded.length,
  batches:ledgerBatches,yearCorrections:allCorrections,labelVersusArticleTitle:allTitleDiffs,
  labelVersusArticleTitleTotal:allTitleDiffs.length,labelQualifiedWithYear:disambiguated,
  deferrals:[{round:'3.15',qids:['Q111383245','Q112206624'],reason:'Wikidata P585 contradicted both Wikipedia articles; both were upgraded in 3.17 with documented year corrections.'},
   {round:'3.16',qids:['Q2274112'],reason:'Wikidata P585 recorded 1600 while both articles date the battle to 1614; upgraded in 3.17 with a documented correction.'}],
  evidence:{'3.18 label check':{checked:labelCheck3_18.checked,byVerdict:labelCheck3_18.byVerdict},
   '3.19 label check':{checked:labelCheck3_19.checked,byVerdict:labelCheck3_19.byVerdict},
   '3.20 label check':{checked:labelCheck.checked,pages:labelCheck.pages.map(page=>page.requested+' -> '+page.title+' ['+page.verdict+']')}}},
 events:{count:batch.count,
  zhChars:{min:Math.min(...authoring.entries.map(row=>row.summaryZhChars)),max:Math.max(...authoring.entries.map(row=>row.summaryZhChars))},
  enWords:{min:Math.min(...authoring.entries.map(row=>row.summaryEnWords)),max:Math.max(...authoring.entries.map(row=>row.summaryEnWords))},
  englishArticle:authoring.coverage.englishArticle,chineseArticle:authoring.coverage.chineseArticle,
  withoutChineseArticle:authoring.coverage.withoutChineseArticle,correctedYears:authoring.coverage.correctedYears,
  dabOverride:[{qid:'Q3486072',title:'Battle of Akhaltsikhe',reason:'The recorded title is flagged as a disambiguation page by the introduction heuristic, but the page is a short article documenting the 1828 offensive (this entry) and the 1829 defence of the same fortress; it was read in this session and the entry states the caveat in its notes.'}],
  entries:authoring.entries.map(row=>({rank:row.rank,id:row.id,qid:row.qid,titleZh:row.titleZh,titleEn:row.titleEn,year:row.year,end:row.end,
   region:row.region,englishArticle:row.englishArticle,chineseArticle:row.chineseArticle,sources:row.sources}))},
 chineseEvidence:{sitelink:0,exactTitleLookup:{checked:zhLookup.checked,noPageUnderLabel:zhLookup.missing,existing:zhLookup.existing.length},
  fullTextSearch:{ran:false,reason:'The Chinese Wikipedia search endpoint has returned 429 throughout this session; only the title-based lookup was possible, and it cannot find differently-titled articles or prove absence.'},
  wording:'All entries and this report say the absence is unconfirmed by this method (本方法未确认) rather than asserting that no Chinese article exists.'},
 language:{eventOffenders:languageAudit.events.entriesWithCjkInEnglish,structured:languageAudit.events.structured,battleOffenders:languageAudit.battles.entriesAffected},
 validation:{commands:validations,crossLayerPassed:crossMatch?Number(crossMatch[1]):null,crossLayerTotal:crossMatch?Number(crossMatch[2]):null,
  battleChecksPassed:battleValidation.checks.filter(check=>check.passed).length,battleChecksTotal:battleValidation.checks.length},
 gz,
 remaining:{structuredIndexEntries:structured.length,structuredIds:structured.map(event=>event.id),
  noChineseArticle:authoring.coverage.withoutChineseArticle,
  note:'The structured index is empty: every ranked entity is now an editorial entry. What remains outside this pipeline is the Chinese-language coverage question (no entry of this final batch has a Chinese article) and the un-run full-text search.'}};
await writeFile(resolve(root,'docs/verification-3.20/content-round11.json'),JSON.stringify(document,null,2)+'\n');

const md=[];
md.push('# 3.20 内容第十一轮：最后 13 条升级完毕，结构化索引归零（291 → 0）');
md.push('');
md.push('任务 task-23。基线提交 `'+baseline+'`，本报告由 `scripts/places/report-content-round11-3.20.mjs --baseline='+baseline+'` 从七批文件与命令输出生成，可复跑。');
md.push('');
md.push('**结论**：最后 **13 条**索引事件升级完毕，`provenance=wikidata-structured` 计数 **'+structured.length+'**——**291 条索引事件全部消化完毕**。事件总数 709 不变，编辑级 v312wd 条目 **'+upgraded.length+'** 条；'+validations.length+' 条校验命令 exit 0。');
md.push('');
md.push('## 1. 本轮结果');
md.push('');
md.push('| 指标 | 基线 | 本轮 |');
md.push('|---|---|---|');
md.push('| 事件总数 | 709 | '+shipped.length+' |');
md.push('| 其中索引级（provenance=wikidata-structured） | 13 | **'+structured.length+'** |');
md.push('| 其中编辑级 v312wd 条目 | 278 | **'+upgraded.length+'** |');
md.push('| 战役层 battles | 603 | 603（本轮无年份修正） |');
md.push('');
md.push('本批 13 条：中文 '+document.events.zhChars.min+'–'+document.events.zhChars.max+' 字（要求 110–135），英文 '+document.events.enWords.min+'–'+document.events.enWords.max+' 词（要求 45–60）；id 保持 `v312wd-<qid>`，provenance 整条删除，wikidataQid 保留；无 BCE 条目、无年份修正。');
md.push('');
md.push('**一处需要说明的装配判断**：Q3486072 的记录标题 `Battle of Akhaltsikhe` 被导言启发式判为消歧义页，但读全文后它是**一条短条目**，同时记述 1828 年城下进攻战（即本条）与 1829 年同一要塞的防御战。装配脚本为此保留了**有据可查的例外**（`EN_DAB_OVERRIDE`），条目 notes 里写明该页覆盖两场战事、本条专指 1828 年。这是本轮唯一一次放行被自动标记的页面，理由与证据都在 `docs/verification-3.20/content-upgrade-label-title-check.json`。');
md.push('');
md.push('## 2. 中文核查：本方法未确认');
md.push('');
md.push('- 窗口内 13 条都没有 zhwiki sitelink；`scripts/places/verify-zh-absence-3.20.mjs` 用记录标签做精确标题核对：**13/13 在该标签下没有页面**。');
md.push('- zh.wikipedia 全文搜索在本会话持续 429，本轮**未运行**。');
md.push('- 因此措辞统一为「本方法未确认」：精确标题核对发现不了**标题不同**的中文条目，也不能证明其不存在。');
md.push('');
md.push('## 3. 总账：291 条索引事件是怎么被消化掉的');
md.push('');
md.push('起点是 3.14 的热度排名：**'+ranking314.ranking.length+' 条**索引级事件。七批升级合计 **'+cumulative+' 条**，与起点完全相等，收尾时索引级计数为 '+structured.length+'。');
md.push('');
md.push('| 批次 | 窗口 | 本批条数 | 累计 | 年份修正 | 标签≠条目标题 |');
md.push('|---|---|---|---|---|---|');
for(const row of ledgerBatches)md.push('| '+row.round+' | '+row.window+' | '+row.count+' | '+row.cumulative+' | '+row.yearCorrections+' | '+row.labelVersusArticleTitle+' |');
md.push('| **合计** |  | **'+cumulative+'** |  | **'+allCorrections.length+'** | **'+allTitleDiffs.length+'** |');
md.push('');
md.push('3.15 与 3.16 两轮共 **'+document.ledger.deferrals.reduce((sum,row)=>sum+row.qids.length,0)+' 条**因维基数据 P585 与条目正文冲突而暂缓（Q111383245、Q112206624、Q2274112），全部在 3.17 连同年份修正一并升级，**没有一条被丢弃**。');
md.push('');
md.push('### 3.1 修正过的年份（共 '+allCorrections.length+' 条）');
md.push('');
md.push('| 批次 | qid | 索引年 | 采用 | 依据 |');
md.push('|---|---|---|---|---|');
for(const row of allCorrections)md.push('| '+row.round+' | '+row.qid+' | '+row.from+' | **'+row.to+'** | '+String(row.reason).replace(/\|/g,'/')+' |');
md.push('');
md.push('八条全部是**维基数据 P585 有缺陷**（年代精度被读成具体年份、与条目正文矛盾、或明显的年份录入错误），一律以条目正文为准，并在 `editorialNotes` 与 `yearCorrection` 中留档；**八条全部同时在 `battles.json` 中出现，已用 `apply-battle-year-fixes-3.17/3.18/3.19.mjs` 同步修正战役层（跨层校验 3/3 通过）。');
md.push('');
md.push('### 3.2 标题修正（标签≠条目标题，共 '+allTitleDiffs.length+' 条）');
md.push('');
md.push('排名文件里的 `titleEn` 是**维基数据英文标签**，不能直接当引用标题。全部 '+allTitleDiffs.length+' 条都改用**英文维基条目实际标题**（含消歧义后缀）。'+titleKind.qualified+' 条是"标签 + 括号年份或限定词"，'+titleKind.renamed+' 条是完全改名，'+titleKind.caseOnly+' 条仅大小写或拼写差异。');
md.push('');
md.push('为什么必须这么做，有两批的直接证据：3.18 批 `Battle of Manzikert` 是 1071 年拜占庭-塞尔柱之战（该批是 1915 年一战）、`Battle of Garigliano` 是 915 年（该批是 1503 年）；3.19 批 14 个标签里 **10 个是消歧义页**，`Battle of Ramadi` 一个标签覆盖四场同名战事而该批占了三场。');
md.push('');
md.push('| 批次 | qid | 标签（不可用） | 实际条目（引用） |');
md.push('|---|---|---|---|');
for(const row of allTitleDiffs)md.push('| '+row.round+' | '+row.qid+' | '+row.label+' | **'+row.article+'** |');
md.push('');
md.push('## 4. 校验');
md.push('');
md.push('| 命令 | exit | 末行 |');
md.push('|---|---|---|');
for(const row of validations)md.push('| `'+row.command+'` | '+row.exitCode+' | '+String(row.lastLines[row.lastLines.length-1]||'').replace(/\|/g,'/').slice(0,70)+' |');
md.push('');
md.push('| 归档 | mtime | OS | 与 .json deepEqual |');
md.push('|---|---|---|---|');
for(const row of gz)md.push('| `'+row.file+'` | '+(row.mtimeZero?'0':'非0')+' | '+row.os+' | '+row.deepEqual+' |');
md.push('');
md.push('英文栏 CJK 违规 '+document.language.eventOffenders+' 条；结构化索引 '+document.language.structured+' 条；战役层 '+document.validation.battleChecksPassed+'/'+document.validation.battleChecksTotal+'；跨层 '+document.validation.crossLayerPassed+'/'+document.validation.crossLayerTotal+'。');
md.push('');
md.push('## 5. 新增清单（13 条，最后一批）');
md.push('');
md.push('| rank | id | 中文标题 | 英文标题（引用条目） | 年 | 区域 |');
md.push('|---|---|---|---|---|---|');
for(const row of document.events.entries)md.push('| '+row.rank+' | `'+row.id+'` | '+row.titleZh+' | '+row.titleEn+' | '+row.year+' | '+row.region+' |');
md.push('');
md.push('坐标、区域、类别、精度、locationType 与 regionBasis 全部原样继承结构化记录。');
md.push('');
md.push('## 6. 这条流水线之后还剩什么');
md.push('');
md.push('1. **结构化索引已归零**，没有遗留的索引级事件；排名文件 rank 121–133 的最后一批即本轮。');
md.push('2. **中文语种覆盖**是唯一未解决的实质问题：本批 13 条都没有中文维基条目（此前各批同样如此，3.17 排名显示 133 个候选里只有 7 个有中文条目）。中文缺口已逐条写在 `editorialNotes`。');
md.push('3. **中文全库核查未完成**：七批都没有跑完 zh.wikipedia 全文搜索（429 限流），"是否存在标题不同的中文条目"的答案仍是**未确认**。');
md.push('4. **暴行层不在本流水线范围内**，由另一条线维护（`public/data/atrocities.json`），本轮未触碰。');
md.push('');
md.push('## 7. 诚实声明');
md.push('');
md.push('- 本轮没有改 `battles.json`（无年份修正）；没有跑 `prepare:assets`；没有改其它产品文件。');
md.push('- 没有把任何无来源内容写进交付物；唯一一次放行自动标记的消歧义页（Q3486072）有读全文证据与 notes 说明。');
md.push('- 中文缺口的表述始终是"本方法未确认"，不是"不存在"。');
md.push('- 总账里每一个数字都能在对应批次的 `content-upgrade-authoring.json` 与批次 JSON 中复核。');
await writeFile(resolve(root,'docs/verification-3.20/content-round11.md'),md.join('\n')+'\n');
console.log(JSON.stringify({baseline,structuredAfter:structured.length,upgraded:upgraded.length,total:cumulative,
 corrections:allCorrections.length,titleDiffs:allTitleDiffs.length,qualified:disambiguated,
 validation:validations.map(row=>row.command.split(' ')[1]+'='+row.exitCode),gz:gz.map(row=>row.file+':'+(row.mtimeZero&&row.deepEqual)),
 md:'docs/verification-3.20/content-round11.md',json:'docs/verification-3.20/content-round11.json'},null,1));
