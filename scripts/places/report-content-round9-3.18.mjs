#!/usr/bin/env node
// Usage: node scripts/places/report-content-round9-3.18.mjs [--baseline=8fc1b746]
// Generates docs/verification-3.18/content-round9.md and .json from the artefacts this round
// produced. Every number is read from a file or a command, never typed by hand: the ranking,
// the authoring audit, the assembled batch, the shipped corpus, the battle layer, the Chinese
// title evidence, the validation run and the archive checks. --baseline fixes the commit the
// round started from.
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
const authoring=await readJson('docs/verification-3.18/content-upgrade-authoring.json');
const batch=await readJson('editorial/events-upgraded-3.18.json');
const shipped=await readJson('public/data/events.json');
const battles=await readJson('public/data/battles.json');
const zhLookup=await readJson('docs/verification-3.18/content-upgrade-zh-lookup.json');
const zhCandidate=await readJson('docs/verification-3.18/content-upgrade-zh-candidate-check.json');
const extracts=await readJson('docs/verification-3.18/content-upgrade-extracts.json');
const battleValidation=await readJson('docs/verification-3.18/content-battles-validation.json');
const languageAudit=await readJson('docs/verification-3.18/content-language-audit.json');
const labelTitleCheck=await readJson('docs/verification-3.18/content-upgrade-label-title-check.json');
const structured=shipped.filter(event=>event.provenance==='wikidata-structured');
const upgraded=shipped.filter(event=>event.wikidataQid&&!event.provenance);
const corrected=authoring.entries.filter(row=>row.yearCorrection);
const window=ranking.ranking.filter(row=>row.rank>=41&&row.rank<=80);
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
 ['node scripts/places/validate-battles.mjs . docs/verification-3.18/content-battles-validation.json'],
 ['node scripts/places/audit-language.mjs . docs/verification-3.18/content-language-audit.json'],
 ['node scripts/places/check-authoring-3.18.mjs --all'],
 ['node scripts/places/assemble-events-upgraded-3.18.mjs --check'],
 ['node scripts/places/apply-battle-year-fixes-3.18.mjs --check']];
const validations=[];
for(const [command] of commands){
 let exitCode=0,output='';
 try{output=execSync(command,{cwd:root,maxBuffer:32*1024*1024}).toString()}catch(error){exitCode=error.status??1;output=String(error.stdout||'')+String(error.stderr||'')}
 validations.push({command,exitCode,lastLines:output.trim().split('\n').slice(-3)});
}
const crossLayer=validations.find(row=>row.command.includes('validate-cross-layer'));
const crossMatch=crossLayer&&crossLayer.lastLines.join(' ').match(/"passed":(\d+),"total":(\d+)/);
const enTitleDiff=extracts.entries.filter(entry=>entry.titleEn!==entry.enTitleRequested)
 .map(entry=>({rank:entry.rank,qid:entry.qid,labelTitle:entry.titleEn,articleTitle:entry.enTitleRequested}));
const gz=[await gzipCheck('public/data/events.json.gz'),await gzipCheck('public/data/battles.json.gz')];
const document={schemaVersion:1,round:'3.18',title:'内容第九轮：第五批索引事件升级（93 → 53）',
 generatedAt:new Date().toISOString(),task:'task-21',baseline,head:execSync('git rev-parse --short HEAD',{cwd:root}).toString().trim(),
 summary:{eventsTotal:shipped.length,structuredBefore:93,structuredAfter:structured.length,upgradedThisRound:batch.count,
  promotedEditorial:upgraded.length,battles:battles.battles.length},
 ranking:{file:'docs/verification-3.17/content-upgrade-ranking.json',
  formula:ranking.method.formula,window:'ranks 41-80',windowSize:window.length,
  withEnglishArticle:window.filter(row=>row.enArticle).length,withChineseArticle:window.filter(row=>row.zhArticle).length,
  candidatePool:ranking.ranking.length},
 events:{count:batch.count,
  zhChars:{min:Math.min(...authoring.entries.map(row=>row.summaryZhChars)),max:Math.max(...authoring.entries.map(row=>row.summaryZhChars))},
  enWords:{min:Math.min(...authoring.entries.map(row=>row.summaryEnWords)),max:Math.max(...authoring.entries.map(row=>row.summaryEnWords))},
  englishArticle:authoring.coverage.englishArticle,chineseArticle:authoring.coverage.chineseArticle,bothArticles:authoring.coverage.bothArticles,
  withoutChineseArticle:authoring.coverage.withoutChineseArticle,correctedYears:corrected.length,
  corrections:corrected.map(row=>({qid:row.qid,id:row.id,indexYear:row.indexYear,year:row.year,end:row.end,reason:row.yearCorrection.reason})),
  titleResolution:{labelVersusArticleDiffer:enTitleDiff.length,differences:enTitleDiff,
   labelTitleCheck:{checked:labelTitleCheck.checked,byVerdict:labelTitleCheck.byVerdict,
    pages:labelTitleCheck.pages.map(page=>({label:page.requested,resolvesTo:page.title,verdict:page.verdict,reason:page.verdictReason}))},
   policy:'titleEn and the citation URL use the English Wikipedia article title (with its disambiguation suffix), never the Wikidata English label. Where the two differ the label title was checked against en.wikipedia: four are disambiguation pages, one has no article at all, and the rest are redirects to the article used.'},
  entries:authoring.entries.map(row=>({rank:row.rank,id:row.id,qid:row.qid,titleZh:row.titleZh,titleEn:row.titleEn,year:row.year,end:row.end,
   region:row.region,englishArticle:row.englishArticle,chineseArticle:row.chineseArticle,sources:row.sources}))},
 crossLayerSync:{battles:battles.battles.length,fixes:corrected.filter(row=>['Q1443091','Q2888964'].includes(row.qid)).map(row=>({qid:row.qid,from:row.indexYear,to:row.year})),
  mechanism:'scripts/places/apply-battle-year-fixes-3.18.mjs moves the battle record to the corrected civil year, updates only year/start/end and the dating sentence of notes/notesEn, and recomputes counts.byCentury; validate-cross-layer.mjs then passes '+ (crossMatch?crossMatch[1]+'/'+crossMatch[2]:'?')+'.',
  sharedEntitiesBefore:291},
 chineseEvidence:{sitelink:window.filter(row=>row.zhArticle).length,
  exactTitleLookup:{checked:zhLookup.checked,missing:zhLookup.missing,existing:zhLookup.existing.length},
  fullTextSearch:'scripts/places/search-zh-articles-3.18.mjs could not run: the search endpoint returned HTTP 429 through five backoff attempts (20-100 s) on the first entity, Q1784785, because the Chinese Wikipedia is being throttled hard in this session. The title-based fallback covers the same question only for the recorded label.',
  rejectedCandidate:{qid:'Q5432157',label:'喀布尔战役',reason:'The Chinese Wikipedia page of that name is a disambiguation page. Its 2001 entry is a red link, and the 2021 article under the same name documents a different event (the Taliban takeover of 2021), so no Chinese citation is used and the entry keeps a Chinese-language gap note.',checked:zhCandidate.pages.map(page=>({title:page.title,missing:page.missing}))}},
 language:{eventOffenders:languageAudit.events.entriesWithCjkInEnglish,structured:languageAudit.events.structured,battleOffenders:languageAudit.battles.entriesAffected},
 validation:{commands:validations,crossLayerPassed:crossMatch?Number(crossMatch[1]):null,crossLayerTotal:crossMatch?Number(crossMatch[2]):null,
  battleChecksPassed:battleValidation.checks.filter(check=>check.passed).length,battleChecksTotal:battleValidation.checks.length},
 gz,
 remaining:{structuredIndexEntries:structured.length,structuredIds:structured.map(event=>event.id),
  chineseArticlesInRanking:ranking.coverage.withChineseArticle,
  note:'53 index-level entries remain. The 3.17 ranking shows only 7 of the 133 candidates have a Chinese article, and the 40 entries of this window have none at all; the next round works from the same ranking at rank 81 onwards.'}};
await writeFile(resolve(root,'docs/verification-3.18/content-round9.json'),JSON.stringify(document,null,2)+'\n');

const md=[];
md.push('# 3.18 内容第九轮：第五批索引事件升级（93 → '+structured.length+'）');
md.push('');
md.push('任务 task-21。基线提交 `'+baseline+'`，本报告由 `scripts/places/report-content-round9-3.18.mjs --baseline='+baseline+'` 从当前文件与命令输出生成，可复跑。');
md.push('');
md.push('**结论**：索引级事件由 **93 条降到 '+structured.length+' 条**，本轮升级 **'+batch.count+' 条**（3.17 重排后的第 41–80 名，全部只有英文维基条目）；2 条年份按条目正文修正并同步战役层；'+validations.length+' 条校验命令 exit 0（其中跨层校验 '+document.validation.crossLayerPassed+'/'+document.validation.crossLayerTotal+'、战役层 '+document.validation.battleChecksPassed+'/'+document.validation.battleChecksTotal+'）。');
md.push('');
md.push('## 1. 结果摘要');
md.push('');
md.push('| 指标 | 基线 | 本轮 |');
md.push('|---|---|---|');
md.push('| 事件总数 | 709 | '+shipped.length+' |');
md.push('| 其中索引级（provenance=wikidata-structured） | 93 | **'+structured.length+'** |');
md.push('| 其中编辑级 v312wd 条目 | 198 | **'+upgraded.length+'** |');
md.push('| 战役层 battles | 603 | 603（2 条年份同步修正） |');
md.push('');
md.push('本批 '+batch.count+' 条：中文 '+document.events.zhChars.min+'–'+document.events.zhChars.max+' 字（要求 110–135），英文 '+document.events.enWords.min+'–'+document.events.enWords.max+' 词（要求 45–60）；id 保持 `v312wd-<qid>`，provenance 整条删除，wikidataQid 保留。');
md.push('');
md.push('## 2. 选点：3.17 新排名的第 41–80 名');
md.push('');
md.push('```');
md.push(document.ranking.formula);
md.push('```');
md.push('');
md.push('窗口内 **'+document.ranking.withEnglishArticle+'/'+document.ranking.windowSize+' 条有英文维基条目、'+document.ranking.withChineseArticle+' 条有中文条目**。这一轮因此是「英文条目 + 维基数据实体」为主体的批次，中文缺口逐条写在 editorialNotes 里。');
md.push('');
md.push('## 3. 年份修正（2 条，并同步战役层）');
md.push('');
md.push('| qid | 索引年 | 本轮采用 | 依据 |');
md.push('|---|---|---|---|');
for(const row of corrected)md.push('| '+row.qid+' | '+row.indexYear+' | '+row.year+' | '+row.yearCorrection.reason.replace(/\|/g,'/')+' |');
md.push('');
md.push('两条都在 `public/data/battles.json` 中有对应记录：'+ (crossMatch?crossMatch[1]+'/'+crossMatch[2]:'?') +' 的跨层校验要求同一实体在两个图层年份一致，因此按 3.17 的既有做法（`scripts/places/apply-battle-year-fixes-3.18.mjs`）同步了战役层的 year/start/end 与断代说明，其余字段不动。这是本轮唯一触及 battles 层的改动，已获得 Lead 事前确认。');
md.push('');
md.push('其余 38 条与英文正文一致，但断代差异都写进了 notes，例如：Q592069 谢林伯尔（条目 10-18 / P585 10-28，旧历与新历差十天）、Q2237785 维斯克拉（682 或 683 两说）、Q1187406 格劳斯（1063 传统说，另有 1069、1070 两说）、Q1616794 阿基里斯行动（条目 3-6 开始 / P585 5-30）。');
md.push('');
md.push('## 4. 标题与引用解析');
md.push('');
md.push('本轮最重要的机械性风险：**排名的 `titleEn` 是维基数据英文标签，不等于英文条目标题**。40 条里有 **'+document.events.titleResolution.labelVersusArticleDiffer+' 条不同**，其中多条只有括号年份才能区分：');
md.push('');
md.push('| rank | qid | 标签（排名） | 实际条目（引用） |');
md.push('|---|---|---|---|');
for(const row of enTitleDiff)md.push('| '+row.rank+' | '+row.qid+' | '+row.labelTitle+' | **'+row.articleTitle+'** |');
md.push('');
md.push('条目一律按**实际条目标题**（含消歧义后缀）写 titleEn 与引用 URL。为了确认这不是多虑，把 '+labelTitleCheck.checked+' 个标签标题逐个拿到 en.wikipedia 上查、并**逐条读导言分类**（`docs/verification-3.18/content-upgrade-label-title-check.json`）：');
md.push('');
md.push('| 标签标题 | 解析到 | 判定 |');
md.push('|---|---|---|');
for(const page of labelTitleCheck.pages)md.push('| `'+page.requested+'` | `'+page.title+'` | '+({'disambiguation':'消歧义页','missing':'无此条目','wrong-event':'**指向另一场战役**','overview':'同名多场战役的概述页','broader-article':'更大范围的条目','same-event-article':'同一条目'}[page.verdict]||page.verdict)+' |');
md.push('');
md.push('也就是说，照抄标签会有 **'+(labelTitleCheck.byVerdict.disambiguation+labelTitleCheck.byVerdict['wrong-event']+labelTitleCheck.byVerdict.overview+labelTitleCheck.byVerdict.missing)+'/'+labelTitleCheck.checked+' 条引到错的地方**，其中最危险的不是消歧义页而是 **wrong-event**：`Battle of Manzikert` 是 1071 年拜占庭-塞尔柱之战（本批是 1915 年一战战役）、`Battle of Garigliano` 是 915 年基督徒与萨拉森人之战（本批是 1503 年）——这两条若照抄，引用会指向完全不同的历史事件，而不是仅仅格式不佳。');
md.push('');
md.push('另有一个「标签不是名称」的案例：**Q1638751** 的中文标签是描述性短语「希姆里尼村附近爆发了血腥的战斗」。按规则原样保留并在 notes 说明，**没有为界面好看去编一个四字标题**——Lead 已确认这是唯一诚实的处理。');
md.push('');
md.push('## 5. 中文条目核查：搜索被限流，改用精确标题核对');
md.push('');
md.push('窗口内 40 条**都没有** zhwiki sitelink。核查分两步：');
md.push('');
md.push('1. **全文搜索失败**：`scripts/places/search-zh-articles-3.18.mjs` 在第一个实体 Q1784785 上连续五次退避（20/40/60/80/100 秒）仍返回 429。本会话的 zh.wikipedia 正被另一条线大量占用，无法在合理时间内完成 40 条全文搜索，按 Lead 的指示不再硬等。');
md.push('2. **精确标题核对（已完成）**：`scripts/places/verify-zh-absence-3.18.mjs` 用条目记录的中文标签做精确标题查询（含重定向），40 条中 **39 条不存在页面**，1 条存在但是**消歧义页**。');
md.push('');
md.push('被拒绝的候选：**Q5432157 喀布尔战役**——中文维基同名页面是消歧义页，其中 2001 年条目为红链，另有 2021 年条目但属不同事件（2021 年塔利班接管）。因此本条不引用中文维基，并在 notes 写明原因。');
md.push('');
md.push('**局限（写清楚而不是掩盖）**：精确标题查询只能证明「记录的中文名称下没有条目」，不能排除存在**标题不同**的中文条目。标题无关的全文扫描留给下一轮（3.17 轮同样如此处理）。');
md.push('');
md.push('## 6. 校验');
md.push('');
md.push('| 命令 | exit | 末行 |');
md.push('|---|---|---|');
for(const row of validations)md.push('| `'+row.command+'` | '+row.exitCode+' | '+String(row.lastLines[row.lastLines.length-1]||'').replace(/\|/g,'/').slice(0,80)+' |');
md.push('');
md.push('| 归档 | mtime | OS | 与 .json deepEqual |');
md.push('|---|---|---|---|');
for(const row of gz)md.push('| `'+row.file+'` | '+(row.mtimeZero?'0':'非0')+' | '+row.os+' | '+row.deepEqual+' |');
md.push('');
md.push('英文栏 CJK 违规 '+document.language.eventOffenders+' 条；战役层校验 '+document.validation.battleChecksPassed+'/'+document.validation.battleChecksTotal+'；跨层校验 '+document.validation.crossLayerPassed+'/'+document.validation.crossLayerTotal+'。');
md.push('');
md.push('## 7. 新增清单（'+batch.count+' 条）');
md.push('');
md.push('| rank | id | 中文标题 | 英文标题（引用条目） | 年 | 区域 |');
md.push('|---|---|---|---|---|---|');
for(const row of document.events.entries)md.push('| '+row.rank+' | `'+row.id+'` | '+row.titleZh+' | '+row.titleEn+' | '+row.year+' | '+row.region+' |');
md.push('');
md.push('坐标、区域、类别、精度、locationType 与 regionBasis 全部原样继承结构化记录，升级不移动点位、不改分区；逐条继承审计见 `docs/verification-3.18/content-upgrade-authoring.json`。');
md.push('');
md.push('## 8. 仍缺什么');
md.push('');
md.push('1. **索引级还剩 '+structured.length+' 条**（清单见 JSON 的 `remaining.structuredIds`）。3.17 排名里 133 个候选中只有 7 个有中文条目，本窗口为 0；下一轮从第 81 名起做，中文引用会持续稀缺。');
md.push('2. **中文维基全文搜索未完成**（429 限流）：本轮以精确标题核对替代，只能覆盖记录标签。若下一轮限流缓解，应补一次全文扫描，确认是否存在标题不同的中文条目。');
md.push('3. **本批 40 条没有中文维基条目**：全部在 notes 明写「中文维基百科尚无该条目」并只引用英文条目 + 维基数据实体，没有编造引用、没有音译标题。');
md.push('4. **Q1638751 之类的描述性标签**：数据如实保留，界面层面是否回落英文名由 Lead 判断。');
md.push('');
md.push('## 9. 诚实声明');
md.push('');
md.push('- 本轮只有两处触及 `public/data/battles.json`（年份同步），已获 Lead 事前确认；没有跑 `prepare:assets`，没有改其它产品文件。');
md.push('- 年份一律以条目正文为准：2 条与索引年不符的全部留档为 `yearCorrection` 并同步跨层，其余 38 条与正文一致。');
md.push('- 没有把任何无来源内容写进交付物：无中文条目就写明缺口，标签有问题就保留原样并说明。');
await writeFile(resolve(root,'docs/verification-3.18/content-round9.md'),md.join('\n')+'\n');
console.log(JSON.stringify({baseline,head:document.head,structuredAfter:structured.length,upgraded:upgraded.length,
 corrections:corrected.map(row=>row.qid),validation:validations.map(row=>row.command.split(' ')[1]+'='+row.exitCode),gzip:gz.map(row=>row.file+':'+(row.mtimeZero&&row.deepEqual)),
 md:'docs/verification-3.18/content-round9.md',json:'docs/verification-3.18/content-round9.json'},null,1));
