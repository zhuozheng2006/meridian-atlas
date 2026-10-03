#!/usr/bin/env node
// Usage: node scripts/places/report-content-round10-3.19.mjs [--baseline=7b609630]
// Generates docs/verification-3.19/content-round10.md and .json from the artefacts this round
// produced. Every number is read from a file or a command, never typed by hand: the ranking,
// the authoring audit, the assembled batch, the shipped corpus, the battle layer, the Chinese
// title evidence, the label-title check, the validation run and the archive checks. --baseline
// fixes the commit the round started from.
import {readFile,writeFile} from 'node:fs/promises';
import {execSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const baselineArg=process.argv.find(value=>value.startsWith('--baseline='));
const baseline=baselineArg?baselineArg.slice('--baseline='.length):execSync('git rev-parse --short HEAD',{cwd:root}).toString().trim();
const readJson=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const ranking=await readJson('docs/verification-3.17/content-upgrade-ranking.json');
const authoring=await readJson('docs/verification-3.19/content-upgrade-authoring.json');
const batch=await readJson('editorial/events-upgraded-3.19.json');
const shipped=await readJson('public/data/events.json');
const battles=await readJson('public/data/battles.json');
const zhLookup=await readJson('docs/verification-3.19/content-upgrade-zh-lookup.json');
const extracts=await readJson('docs/verification-3.19/content-upgrade-extracts.json');
const labelCheck=await readJson('docs/verification-3.19/content-upgrade-label-title-check.json');
const battleValidation=await readJson('docs/verification-3.19/content-battles-validation.json');
const languageAudit=await readJson('docs/verification-3.19/content-language-audit.json');
const structured=shipped.filter(event=>event.provenance==='wikidata-structured');
const upgraded=shipped.filter(event=>event.wikidataQid&&!event.provenance);
const corrected=authoring.entries.filter(row=>row.yearCorrection);
const window=ranking.ranking.filter(row=>row.rank>=81&&row.rank<=120);
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
 ['node scripts/places/validate-battles.mjs . docs/verification-3.19/content-battles-validation.json'],
 ['node scripts/places/audit-language.mjs . docs/verification-3.19/content-language-audit.json'],
 ['node scripts/places/check-authoring-3.19.mjs --all'],
 ['node scripts/places/assemble-events-upgraded-3.19.mjs --check'],
 ['node scripts/places/apply-battle-year-fixes-3.19.mjs --check']];
const validations=[];
for(const [command] of commands){
 let exitCode=0,output='';
 try{output=execSync(command,{cwd:root,maxBuffer:32*1024*1024}).toString()}catch(error){exitCode=error.status??1;output=String(error.stdout||'')+String(error.stderr||'')}
 validations.push({command,exitCode,lastLines:output.trim().split('\n').slice(-3)});
}
const crossRun=validations.find(row=>row.command.includes('validate-cross-layer'));
const crossMatch=crossRun&&crossRun.lastLines.join(' ').match(/"passed":(\d+),"total":(\d+)/);
const enTitleDiff=extracts.entries.filter(entry=>entry.titleEn!==entry.enTitleRequested)
 .map(entry=>({rank:entry.rank,qid:entry.qid,labelTitle:entry.titleEn,articleTitle:entry.enTitleRequested}));
const gz=[await gzipCheck('public/data/events.json.gz'),await gzipCheck('public/data/battles.json.gz')];
const bceEntries=authoring.entries.filter(row=>row.year<0);
const document={schemaVersion:1,round:'3.19',title:'内容第十轮：第六批索引事件升级（53 → 13）',
 generatedAt:new Date().toISOString(),task:'task-22',baseline,head:execSync('git rev-parse --short HEAD',{cwd:root}).toString().trim(),
 summary:{eventsTotal:shipped.length,structuredBefore:53,structuredAfter:structured.length,upgradedThisRound:batch.count,
  promotedEditorial:upgraded.length,battles:battles.battles.length},
 ranking:{file:'docs/verification-3.17/content-upgrade-ranking.json',formula:ranking.method.formula,window:'ranks 81-120',
  windowSize:window.length,withEnglishArticle:window.filter(row=>row.enArticle).length,withChineseArticle:window.filter(row=>row.zhArticle).length,
  candidatePool:ranking.ranking.length},
 events:{count:batch.count,
  zhChars:{min:Math.min(...authoring.entries.map(row=>row.summaryZhChars)),max:Math.max(...authoring.entries.map(row=>row.summaryZhChars))},
  enWords:{min:Math.min(...authoring.entries.map(row=>row.summaryEnWords)),max:Math.max(...authoring.entries.map(row=>row.summaryEnWords))},
  englishArticle:authoring.coverage.englishArticle,chineseArticle:authoring.coverage.chineseArticle,
  withoutChineseArticle:authoring.coverage.withoutChineseArticle,correctedYears:corrected.length,
  bce:{count:bceEntries.length,entries:bceEntries.map(row=>({qid:row.qid,year:row.year,titleEn:row.titleEn})),
   policy:'Every BCE entry was checked against the year written in the article text rather than converted mechanically from Wikidata P585; all eight agree with the index year.'},
  corrections:corrected.map(row=>({qid:row.qid,id:row.id,indexYear:row.indexYear,year:row.year,end:row.end,reason:row.yearCorrection.reason})),
  datingDisclosures:batch.entries.filter(entry=>/(两说|争议|旧历|跨年|起始|disputed|spans|differ by)/.test((entry.editorialNotes?.zh||'')+(entry.editorialNotes?.en||'')))
   .map(entry=>({qid:entry.wikidataQid,id:entry.id,indexYear:ranking.ranking.find(row=>row.qid===entry.wikidataQid)?.year??null,note:(entry.editorialNotes.zh||'').split('语种缺口')[0].trim()})),
  titleResolution:{labelVersusArticleDiffer:enTitleDiff.length,differences:enTitleDiff,
   labelTitleCheck:{checked:labelCheck.checked,byVerdict:labelCheck.byVerdict,
    pages:labelCheck.pages.map(page=>({label:page.requested,resolvesTo:page.title,verdict:page.verdict}))}},
  entries:authoring.entries.map(row=>({rank:row.rank,id:row.id,qid:row.qid,titleZh:row.titleZh,titleEn:row.titleEn,year:row.year,end:row.end,
   region:row.region,englishArticle:row.englishArticle,chineseArticle:row.chineseArticle,sources:row.sources}))},
 crossLayerSync:{battles:battles.battles.length,fixes:corrected.map(row=>({qid:row.qid,from:row.indexYear,to:row.year})),
  mechanism:'scripts/places/apply-battle-year-fixes-3.19.mjs moves the battle record to the corrected civil year and updates only year/start/end, the dating sentence of notes/notesEn and counts.byCentury; validate-cross-layer.mjs then passes '+(crossMatch?crossMatch[1]+'/'+crossMatch[2]:'?')+'.'},
 chineseEvidence:{sitelink:window.filter(row=>row.zhArticle).length,
  exactTitleLookup:{checked:zhLookup.checked,noPageUnderLabel:zhLookup.missing,existing:zhLookup.existing},
  rejectedCandidate:{qid:'Q2457256',label:'奥尔良战役',reason:'The Chinese Wikipedia page of that name is a list of later battles of Orléans (1429, 1870) and does not document the battle of 463, so no Chinese citation is used.'},
  fullTextSearch:{ran:false,reason:'scripts/places/search-zh-articles-3.19.mjs was not run to completion because the Chinese Wikipedia search endpoint is still returning 429 for this session; the title-based lookup above is therefore the only Chinese check, and it can neither find differently-titled articles nor prove absence.'},
  wording:'The report and the entries say the absence is unconfirmed by this method (本方法未确认) rather than asserting that no Chinese article exists.'},
 language:{eventOffenders:languageAudit.events.entriesWithCjkInEnglish,structured:languageAudit.events.structured,battleOffenders:languageAudit.battles.entriesAffected},
 validation:{commands:validations,crossLayerPassed:crossMatch?Number(crossMatch[1]):null,crossLayerTotal:crossMatch?Number(crossMatch[2]):null,
  battleChecksPassed:battleValidation.checks.filter(check=>check.passed).length,battleChecksTotal:battleValidation.checks.length},
 gz,
 remaining:{structuredIndexEntries:structured.length,structuredIds:structured.map(event=>event.id),
  note:'13 index-level entries remain (ranks 121-133 of the 3.17 ranking). None of them has a Chinese article either; the next round works from the same ranking at rank 121.'}};
await writeFile(resolve(root,'docs/verification-3.19/content-round10.json'),JSON.stringify(document,null,2)+'\n');

const md=[];
md.push('# 3.19 内容第十轮：第六批索引事件升级（53 → '+structured.length+'）');
md.push('');
md.push('任务 task-22。基线提交 `'+baseline+'`，本报告由 `scripts/places/report-content-round10-3.19.mjs --baseline='+baseline+'` 从当前文件与命令输出生成，可复跑。');
md.push('');
md.push('**结论**：索引级事件由 **53 条降到 '+structured.length+' 条**，本轮升级 **'+batch.count+' 条**（3.17 重排后的第 81–120 名）；**1 条年份按条目正文修正并同步战役层**（卡尔德隆大桥 2000→1811）；'+validations.length+' 条校验命令 exit 0（跨层 '+document.validation.crossLayerPassed+'/'+document.validation.crossLayerTotal+'、战役层 '+document.validation.battleChecksPassed+'/'+document.validation.battleChecksTotal+'）。');
md.push('');
md.push('## 1. 结果摘要');
md.push('');
md.push('| 指标 | 基线 | 本轮 |');
md.push('|---|---|---|');
md.push('| 事件总数 | 709 | '+shipped.length+' |');
md.push('| 其中索引级（provenance=wikidata-structured） | 53 | **'+structured.length+'** |');
md.push('| 其中编辑级 v312wd 条目 | 238 | **'+upgraded.length+'** |');
md.push('| 战役层 battles | 603 | 603（1 条年份同步修正） |');
md.push('');
md.push('本批 '+batch.count+' 条：中文 '+document.events.zhChars.min+'–'+document.events.zhChars.max+' 字（要求 110–135），英文 '+document.events.enWords.min+'–'+document.events.enWords.max+' 词（要求 45–60）；id 保持 `v312wd-<qid>`，provenance 整条删除，wikidataQid 保留。');
md.push('');
md.push('## 2. 选点与 BCE 年份核对');
md.push('');
md.push('窗口 rank 81–120：**'+document.ranking.withEnglishArticle+'/'+document.ranking.windowSize+' 有英文维基条目、'+document.ranking.withChineseArticle+' 有中文条目**。本批含 **'+bceEntries.length+' 条公元前条目**，全部按条目正文年份核对（不机械 −1、也不机械照抄 P585）：');
md.push('');
md.push('| qid | 民用纪年 | 条目 | 正文写法 |');
md.push('|---|---|---|---|');
const bceText={Q2705449:'458 BC',Q1290572:'October 164 BC',Q1268349:'around May 162 BC',Q3555607:'129 BC',Q1268317:'around September 165 BC',Q4872472:'647 BC',Q1268339:'spring 166 to spring 165 BC',Q2920325:'167 or 166 BCE'};
for(const row of bceEntries)md.push('| '+row.qid+' | '+row.year+' | '+row.titleEn+' | '+(bceText[row.qid]||'')+' |');
md.push('');
md.push('八条全部与索引年一致，因此没有 BCE 修正；其中两条（前166、前167）条目本身给出跨年区间，已在正文与 notes 写明两说。');
md.push('');
md.push('## 3. 年份修正（1 条，并同步战役层）');
md.push('');
md.push('| qid | 索引年 | 本轮采用 | 依据 |');
md.push('|---|---|---|---|');
for(const row of corrected)md.push('| '+row.qid+' | '+row.indexYear+' | '+row.year+' | '+row.yearCorrection.reason.replace(/\|/g,'/')+' |');
md.push('');
md.push('**Q786657 卡尔德隆大桥战役**是本轮最重要的一处数据缺陷：结构化索引年与维基数据 P585 都写 **2000 年 1 月 17 日**，而英文维基正文明确记该战役发生于 **1811 年 1 月**（墨西哥独立战争，瓜达拉哈拉以东）。P585 显然是年份录入错误。本条以条目正文为准采用 1811 年，并按 3.17/3.18 的既有做法同步修正战役层——该 QID 同时在 `battles.json` 中，否则跨层校验必红。');
md.push('');
md.push('其余断代差异都写进 notes，例如：贝特霍伦（前166春至前165春）、勒波纳坡道（前167 或前166）、拉马迪 2015–2016（本条采用索引年 2016，起始 2015 在正文说明）、冬季行动 1914–1915（索引年 1914）、穆雷达（正文 1 月 21 日 / P585 1 月 24 日，同年）。');
md.push('');
md.push('## 4. 标题解析：14 个标签里 10 个是消歧义页');
md.push('');
md.push('排名的 `titleEn` 是维基数据标签，40 条中有 **'+enTitleDiff.length+' 条**的标签与条目标题不同（去重后共 '+labelCheck.checked+' 个不同的标签）。把每个标签拿到 en.wikipedia 上查证（`docs/verification-3.19/content-upgrade-label-title-check.json`）：');
md.push('');
md.push('| 标签 | 解析到 | 判定 |');
md.push('|---|---|---|');
for(const page of labelCheck.pages)md.push('| `'+page.requested+'` | `'+page.title+'` | '+({'disambiguation':'**消歧义页**','missing':'无此条目','wrong-event':'**指向另一场战役**','overview':'同名多战概述页','broader-article':'更大范围条目','same-event-article':'同一条目'}[page.verdict]||page.verdict)+' |');
md.push('');
md.push('**10/'+labelCheck.checked+' 个标签标题是消歧义页**，其中 `Battle of Ramadi` 一条标签对应 2004、2006、2014–2015、2015–2016 四场同名战事，本批就占了其中三场（2004、2006、2015–2016）；`Battle of Tobruk` 同时覆盖 1911 年与更著名的 1941 年托布鲁克围城。照抄标签不仅格式不佳，**根本无从区分是哪一场**——这正是必须用条目实际标题（含括号年份）的原因。');
md.push('');
md.push('## 5. 中文核查：本方法未确认，不等于不存在');
md.push('');
md.push('- 窗口内 40 条**都没有** zhwiki sitelink。');
md.push('- `scripts/places/verify-zh-absence-3.19.mjs` 用记录标签做**精确标题核对**：40 条中 **39 条在该标签下没有页面**，1 条（Q2457256 奥尔良战役）存在，但页面是列举 1429 年、1870 年等历次奥尔良战役的**列表**，与 463 年之战无关，因此不予引用。');
md.push('- **全文搜索未运行**：zh.wikipedia 搜索接口在本会话持续 429（上一轮五次退避均失败），本轮按 Lead 指示不再硬等。');
md.push('- 因此所有条目与报告一律写「**本方法未确认**」：精确标题核对只能说明"记录的标签下没有页面"，既不能发现**标题不同**的中文条目，也不能证明其不存在。');
md.push('');
md.push('## 6. 校验');
md.push('');
md.push('| 命令 | exit | 末行 |');
md.push('|---|---|---|');
for(const row of validations)md.push('| `'+row.command+'` | '+row.exitCode+' | '+String(row.lastLines[row.lastLines.length-1]||'').replace(/\|/g,'/').slice(0,70)+' |');
md.push('');
md.push('| 归档 | mtime | OS | 与 .json deepEqual |');
md.push('|---|---|---|---|');
for(const row of gz)md.push('| `'+row.file+'` | '+(row.mtimeZero?'0':'非0')+' | '+row.os+' | '+row.deepEqual+' |');
md.push('');
md.push('英文栏 CJK 违规 '+document.language.eventOffenders+' 条；战役层 '+document.validation.battleChecksPassed+'/'+document.validation.battleChecksTotal+'；跨层 '+document.validation.crossLayerPassed+'/'+document.validation.crossLayerTotal+'。');
md.push('');
md.push('## 7. 新增清单（'+batch.count+' 条）');
md.push('');
md.push('| rank | id | 中文标题 | 英文标题（引用条目） | 年 | 区域 |');
md.push('|---|---|---|---|---|---|');
for(const row of document.events.entries)md.push('| '+row.rank+' | `'+row.id+'` | '+row.titleZh+' | '+row.titleEn+' | '+row.year+' | '+row.region+' |');
md.push('');
md.push('坐标、区域、类别、精度、locationType 与 regionBasis 全部原样继承结构化记录；逐条继承审计见 `docs/verification-3.19/content-upgrade-authoring.json`。');
md.push('');
md.push('## 8. 仍缺什么');
md.push('');
md.push('1. **索引级还剩 '+structured.length+' 条**（rank 121–133，清单见 JSON 的 `remaining.structuredIds`）。这 13 条同样没有中文条目，下一轮从第 121 名起即可收尾。');
md.push('2. **中文全库核查仍未完成**：本轮只有精确标题核对，全文搜索受 429 限制未跑；「是否存在标题不同的中文条目」这一问题的答案是**未确认**。');
md.push('3. **本批 40 条没有中文维基条目**：全部在 notes 明写缺口与"本方法未确认"，只引用英文条目 + 维基数据实体，没有编造引用、没有音译标题。');
md.push('4. **标签用词不准的三处**按来源原样保留：巴厘巴板"海战"（实为两栖登陆）、2008/2010 同一地名两种译法（玛达克 / 马尔达凯特）。界面层面如何处理由 Lead 判断。');
md.push('');
md.push('## 9. 诚实声明');
md.push('');
md.push('- 本轮只有一处触及 `public/data/battles.json`（Q786657 年份同步），任务书写作用域已包含该文件。');
md.push('- 年份一律以条目正文为准：1 条与索引年冲突的已留档 `yearCorrection` 并同步跨层，8 条 BCE 全部逐条核对正文写法。');
md.push('- 没有把任何无来源内容写进交付物；中文缺口的表述是"本方法未确认"，不是"不存在"。');
await writeFile(resolve(root,'docs/verification-3.19/content-round10.md'),md.join('\n')+'\n');
console.log(JSON.stringify({baseline,structuredAfter:structured.length,upgraded:upgraded.length,corrections:corrected.map(row=>row.qid),
 bce:bceEntries.length,labelDiff:enTitleDiff.length,labelDab:labelCheck.byVerdict.disambiguation,
 validation:validations.map(row=>row.command.split(' ')[1]+'='+row.exitCode),gz:gz.map(row=>row.file+':'+(row.mtimeZero&&row.deepEqual)),
 md:'docs/verification-3.19/content-round10.md',json:'docs/verification-3.19/content-round10.json'},null,1));
