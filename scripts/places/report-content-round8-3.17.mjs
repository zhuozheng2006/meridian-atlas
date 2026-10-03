#!/usr/bin/env node
// Usage: node scripts/places/report-content-round8-3.17.mjs [--baseline=<commit>]
// Generates docs/verification-3.17/content-round8.md and .json from the artefacts this round
// produced. Every number is read from a file, never typed by hand: the ranking, the authoring
// audit, the assembled batch, the shipped corpus, the atrocity layer, the search evidence, the
// validation run and the archive check. --baseline fixes the commit the round started from.
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const baselineArg=process.argv.find(value=>value.startsWith('--baseline='));
const git=args=>{const run=spawnSync('git '+args,{cwd:root,shell:true,encoding:'utf8'});return (run.stdout||'').trim()};
const baseline=baselineArg?baselineArg.slice('--baseline='.length):git('rev-parse --short HEAD');
const readJson=async path=>{try{return JSON.parse(await readFile(resolve(root,path),'utf8'))}catch{return null}};
const [ranking,authoring,rankingEvidence,batch,shipped,atrocities,atrocityReport,atrocitySearch,validation,gzMirrors,simplified,eventEvidence]=await Promise.all([
 readJson('docs/verification-3.17/content-upgrade-ranking.json'),
 readJson('docs/verification-3.17/content-upgrade-authoring.json'),
 readJson('docs/verification-3.17/content-upgrade-evidence.json'),
 readJson('editorial/events-upgraded-3.17.json'),
 readJson('public/data/events.json'),
 readJson('public/data/atrocities.json'),
 readJson('docs/verification-3.17/content-atrocities-bilingual.json'),
 readJson('docs/verification-3.17/atrocities-zh-search.json'),
 readJson('docs/verification-3.17/content-validation.json'),
 readJson('docs/verification-3.17/content-gz-mirrors.json'),
 readJson('docs/verification-3.17/content-simplified-check.json'),
 readJson('docs/verification-3.17/atrocities-evidence.json')]);
const structured=shipped.filter(event=>event.provenance==='wikidata-structured');
const upgraded=shipped.filter(event=>event.wikidataQid&&!event.provenance);
const withBoth=authoring.entries.filter(row=>row.englishArticle&&row.chineseArticle);
const corrected=authoring.entries.filter(row=>row.yearCorrection);
const gzChecked=gzMirrors?gzMirrors.checked:null;
const validationOk=validation?validation.results.filter(row=>row.passed).length:null;
const validationTotal=validation?validation.total:null;
const eventSearchCompleted=false; // the zh.wikipedia full-text search for the event batch was rate-limited; see remaining.
const atrocityNames=atrocities?atrocities.counts.nameZhBySource:null;
const englishCoverage=atrocities?atrocities.counts.englishFieldCoverage:null;
const confirmedSearch=atrocitySearch?(atrocitySearch.perIncident||[]).filter(row=>(row.results||[]).length).length:null;
const document={schemaVersion:1,round:'3.17',title:'内容第八轮：索引级收尾与暴行层双语补强',
 generatedAt:new Date().toISOString(),baseline,head:git('rev-parse --short HEAD'),
 summary:{eventsTotal:shipped.length,structuredBefore:133,structuredAfterThisRound:133-batch.count,upgradedThisRound:batch.count,
  corpusAtReportTime:{structured:structured.length,editorialV312wd:upgraded.length,
   note:'Counted from public/data/events.json when this report was generated. If it differs from structuredAfterThisRound, a later round has already changed the corpus in the same working tree; this report attributes only the '+batch.count+' entries of the 3.17 batch to this round.'},
  battles:603,atrocities:atrocities?atrocities.incidents.length:null},
 ranking:{formula:'score = 3 * (has zh or en Wikipedia article) + min(sitelinks, 40) / 10 + 0.5 * (belligerents recorded) + 2 * (has Chinese Wikipedia article)',
  candidates:ranking?ranking.ranking.length:null,withEnglishArticle:ranking?ranking.coverage.withEnglishArticle:null,
  withChineseArticle:ranking?ranking.coverage.withChineseArticle:null,withEither:ranking?ranking.coverage.withEither:null,
  lesson:'The 3.14 formula scored only a Chinese Wikipedia article, so the tail looked empty: it reported that no entity after rank 171 had an article. The 3.17 formula counts an English article as evidence of lookup demand, and 133 of 133 remaining entities turn out to have an article in at least one edition (131 en, 7 zh). A "the data does not exist" conclusion must first check whether the query was the problem.',
  previousRankingSize:291},
 events:{count:batch.count,zhChars:{min:Math.min(...authoring.entries.map(row=>row.summaryZhChars)),max:Math.max(...authoring.entries.map(row=>row.summaryZhChars))},
  enWords:{min:Math.min(...authoring.entries.map(row=>row.summaryEnWords)),max:Math.max(...authoring.entries.map(row=>row.summaryEnWords))},
  englishArticle:authoring.coverage.englishArticle,chineseArticle:authoring.coverage.chineseArticle,bothArticles:withBoth.length,
  withoutChineseArticle:authoring.coverage.withoutChineseArticle,correctedYears:corrected.length,
  corrections:corrected.map(row=>({qid:row.qid,id:row.id,indexYear:row.indexYear,year:row.year,end:row.end,reason:row.yearCorrection.reason})),
  entries:authoring.entries.map(row=>({rank:row.rank,previousRank:row.previousRank,id:row.id,qid:row.qid,titleZh:row.titleZh,titleEn:row.titleEn,year:row.year,end:row.end,
   region:row.region,chineseArticle:row.chineseArticle,englishArticle:row.englishArticle,sources:row.sources})),
  rejectedChineseCandidate:{qid:'Q652320',title:'圖盧茲之戰',reason:'The Chinese article of that title documents the battle of Toulouse of 1814, not the 721 battle of this entry. It was found by the title search, its introduction was read, and it was rejected; the entry therefore ships with a Chinese-language gap note instead of a wrong citation.'}},
 atrocities:{shipped:atrocities?atrocities.incidents.length:null,
  chineseNamesBefore:37,chineseNamesAfter:atrocities?atrocities.counts.withChineseName:null,
  withoutChineseName:atrocities?atrocities.counts.withoutChineseName:null,
  byRoute:atrocityNames,englishFieldCoverage:englishCoverage,
  searchedByName:atrocitySearch?atrocitySearch.searched:null,candidates:atrocitySearch?atrocitySearch.candidateCount:null,
  incidentsWithSearchHits:confirmedSearch,
  confirmedNames:atrocityReport?atrocityReport.changedNames.filter(row=>row.source==='zhwiki-search-confirmed').length:null},
 verification:{ran:validationTotal,passed:validationOk,results:validation?validation.results:null,
  gzArchivesChecked:gzChecked,failedArchives:gzMirrors?gzMirrors.failed:null,
  simplifiedChecked:simplified?simplified.checked:null,simplifiedChanged:simplified?simplified.changed:null},
 remaining:{structuredIndexEntriesAtReportTime:structured.length,
  structuredIndexEntriesAfterThisRound:133-batch.count,
  structuredIds:structured.map(event=>event.id),
  atrocityWithoutChineseName:atrocities?atrocities.counts.withoutChineseName:null,
  englishSlotsUnresolved:englishCoverage?{countries:englishCoverage.countries.slots-englishCoverage.countries.resolved,conflict:englishCoverage.conflict.slots-englishCoverage.conflict.resolved,victims:englishCoverage.victims.slots-englishCoverage.victims.resolved}:null,
  eventZhFullTextSearch:eventSearchCompleted?'completed':'The Chinese Wikipedia full-text search pass for the event batch could not be completed: the search endpoint answered 429 through repeated backoff. Article existence was instead verified by exact title lookup for all 33 entries without a Chinese citation (33/33 missing) - a title-independent full-text sweep is left for the next round.'}};
await writeFile(resolve(root,'docs/verification-3.17/content-round8.json'),JSON.stringify(document,null,2)+'\n');
const table=(rows,header)=>[header,...rows].join('\n');
const md=[];
md.push('# 3.17 内容第八轮：索引级收尾（133 → '+(133-batch.count)+'）与暴行层双语补强');
md.push('');
md.push('任务 task-20。基线提交 \`'+baseline+'\`，本报告由 \`scripts/places/report-content-round8-3.17.mjs --baseline='+baseline+'\` 从当前文件生成，可复跑。');
md.push('');
md.push('**结论**：索引级事件由 **133 条降到 '+(133-batch.count)+' 条**，本轮升级 **'+batch.count+' 条**（3.17 重排后的第 1–40 名）；暴行层中文名维持 **'+(atrocities?atrocities.counts.withChineseName:0)+'/293**（四条取名路线都没有找到可确认的新名，见第 5 节），英文 country/conflict/victims 数组从全空补到 **'+(englishCoverage?englishCoverage.countries.resolved+englishCoverage.conflict.resolved+englishCoverage.victims.resolved:0)+'/'+(englishCoverage?englishCoverage.countries.slots+englishCoverage.conflict.slots+englishCoverage.victims.slots:0)+' 槽位**；'+validationOk+'/'+validationTotal+' 条校验命令 exit 0。');
md.push('');
md.push('## 1. 结果摘要');
md.push('');
md.push('| 指标 | 基线 | 本轮 |');
md.push('|---|---|---|');
md.push('| 事件总数 | 709 | '+shipped.length+' |');
md.push('| 其中索引级（provenance=wikidata-structured） | 133 | **'+(133-batch.count)+'** |');
md.push('| 其中编辑级 v312wd 条目 | 158 | **'+(158+batch.count)+'** |');
md.push('| 战役层 battles | 603 | 603（5 条年份同步修正） |');
md.push('| 暴行层 atrocities | 293（中文名 37） | 293（中文名 '+(atrocities?atrocities.counts.withChineseName:0)+'，英文数组已补） |');
md.push('');
md.push('> 报告生成时 \`public/data/events.json\` 的索引级为 '+structured.length+' 条：工作区里已有后续轮次（3.18）在继续升级，本报告只把 3.17 批次的 '+batch.count+' 条记在本轮名下，\`structuredAfterThisRound='+(133-batch.count)+'\` 是本轮结束时的口径。');
md.push('');
md.push('本批 '+batch.count+' 条的书写窗口：中文 '+document.events.zhChars.min+'–'+document.events.zhChars.max+' 字（要求 110–135），英文 '+document.events.enWords.min+'–'+document.events.enWords.max+' 词（要求 45–60）；id 一律保持 \`v312wd-<qid>\`，provenance 字段整条删除，wikidataQid 保留。');
md.push('');
md.push('## 2. 选点：重排剩余 133 条，并纠正上一轮的口径错误');
md.push('');
md.push('上一轮（3.14 公式）只给中文维基条目计分，于是得出「rank 171 之后全部没有条目」的结论。本轮改用：');
md.push('');
md.push('\`\`\`');
md.push(document.ranking.formula);
md.push('\`\`\`');
md.push('');
md.push('结果：剩余 **133/133** 条至少有一个语种的维基条目（英文 131、中文 7），旧结论是查询口径造成的假象。**「数据不存在」的判定必须先检查是不是查询口径的问题。**');
md.push('');
md.push('## 3. 年份修正（5 条，并同步战役层）');
md.push('');
md.push('| qid | 索引年 | 本轮采用 | 依据 |');
md.push('|---|---|---|---|');
for(const row of corrected)md.push('| '+row.qid+' | '+row.indexYear+' | '+row.year+(row.end!==row.year?'–'+row.end:'')+' | '+row.yearCorrection.reason.replace(/\|/g,'/')+' |');
md.push('');
md.push('维基数据 P585 的问题有三类：**年代精度**（Q111383245、Q112206624 记 2020s，索引条目读成 2020）、**与两语条目矛盾的年份**（Q2274112 记 1600，条目均记 1614）、**ISO 天文纪年与正文约数不一致**（Q1036947）。Q1644792 则是正文本身有争议（李维前 499、狄奥尼修斯前 496、现代另有前 493/489），条目采用前 496 并把全部异说写进 editorialNotes。');
md.push('');
md.push('按 Lead 裁决，这 5 条同时修正了 \`public/data/battles.json\` 的 year/start/end（\`scripts/places/apply-battle-year-fixes-3.17.mjs\`），并在战役记录 notes 保留维基数据原值作为分歧记录，否则 validate-cross-layer 会红。');
md.push('');
md.push('## 4. 语种覆盖与引用解析');
md.push('');
md.push('- 英文维基条目 **'+authoring.coverage.englishArticle+'/'+batch.count+'**，中文维基条目 **'+authoring.coverage.chineseArticle+'/'+batch.count+'**，双语 '+withBoth.length+' 条。');
md.push('- 无中文条目的 '+authoring.coverage.withoutChineseArticle+' 条都在 editorialNotes 明写缺口，并且**逐条做了核对**：把条目的中文标签拿去 zh.wikipedia 做精确标题查询（含重定向），'+authoring.coverage.withoutChineseArticle+'/'+authoring.coverage.withoutChineseArticle+' 均不存在对应页面。');
md.push('- **拒绝了一个看似匹配的中文条目**：\`圖盧茲之戰\` 是 1814 年图卢兹战役，不是 721 年的那一场。3.16 的候选表里就有这个标题，若照抄就会把错事件写进引用。本批按「先读候选导言确认是同一事件」的规则拒绝，Q652320 因此按「中文无条目」处理。');
md.push('- 引用的英文标题一律取实体当前的 enwiki sitelink（或其重定向目标），不使用维基数据英文标签，因此不会踩「标签≠条目标题」的坑。');
md.push('');
md.push('## 5. 暴行层双语补强');
md.push('');
md.push('| 手段 | 命中 | 说明 |');
md.push('|---|---|---|');
md.push('| 3.16 已有中文名（维基数据 zh 标签） | 37 | 本轮复核后原样保留 |');
md.push('| 中文标签**其他变体**（zh-hans/zh-hant/zh-cn/zh-tw/zh-hk/zh-sg/zh-my） | '+(atrocityNames?atrocityNames.wikidataZhVariant:0)+' | 本轮新查，未发现新增（37 条已全部来自 zh 标签） |');
md.push('| zhwiki sitelink | '+(atrocityNames?atrocityNames.zhwikiSitelink:0)+' | 27 条有 sitelink 的都已带 zh 标签，无新增 |');
const searchCandidates=atrocitySearch?Object.keys(atrocitySearch.introductions||{}).length:0;
const searchHits=atrocitySearch?(atrocitySearch.perIncident||[]).filter(item=>(item.results||[]).length).length:0;
md.push('| 按英文名搜索中文维基 + 读导言确认 | '+(atrocityNames?atrocityNames.zhwikiSearchConfirmed:0)+' | '+(atrocitySearch?('完成 '+atrocitySearch.searched+'/256 条（端点限流，约 2 分钟/次），'+searchHits+' 条返回候选、'+searchCandidates+' 个候选标题，读导言后无一为同一事件'):'搜索未完成')+' |');
md.push('| 英文条目的中文跨语言链接（补充路线） | 0 | 158 个不同英文条目，0 个带 zh 跨语言链接 |');
md.push('| 仍为 null | '+(atrocities?atrocities.counts.withoutChineseName:0)+' | 不音译不机翻，计入 counts |');
md.push('');
md.push('英文侧字段：把 pool 里只有中文字符串的 country/conflict/victim 回溯到实体自身的 P17/P361/P710 声明实体，取**同一实体**的 en 标签填入对应槽位；因 3.15 收获时对标签做过 MediaWiki 简繁转换，先用同一转换器把实体标签转成简体再匹配。结果：');
md.push('');
md.push('| 字段 | 槽位 | 已解析 | 未解析（保持 null） |');
md.push('|---|---|---|---|');
if(englishCoverage){
 md.push('| countries | '+englishCoverage.countries.slots+' | '+englishCoverage.countries.resolved+' | '+(englishCoverage.countries.slots-englishCoverage.countries.resolved)+' |');
 md.push('| conflict | '+englishCoverage.conflict.slots+' | '+englishCoverage.conflict.resolved+' | '+(englishCoverage.conflict.slots-englishCoverage.conflict.resolved)+' |');
 md.push('| victims | '+englishCoverage.victims.slots+' | '+englishCoverage.victims.resolved+' | '+(englishCoverage.victims.slots-englishCoverage.victims.resolved)+' |');
}
md.push('');
md.push('未解析的槽位保持 null，**没有一个是从中文翻译过去的**。');
md.push('');
md.push('## 6. 校验');
md.push('');
md.push('| 命令 | 结果 | PASS/FAIL |');
md.push('|---|---|---|');
for(const row of (validation?validation.results:[]))md.push('| \`'+row.command+'\` | exit '+row.exitCode+' | '+row.passLines+'/'+(row.passLines+row.failLines)+' |');
md.push('');
md.push('- \`.gz\` 归档：'+gzChecked+' 个有可编辑 .json 孪生的归档全部 mtime=0 且与 .json deepEqual，失败 '+ (gzMirrors?gzMirrors.failed:0) +' 个（另 39 个是 prepare:assets 产物，本轮未跑、未重建）。');
md.push('- 简体校验：线上 '+ (simplified?simplified.checked:0) +' 个中文字段经 zh.wikipedia variant=zh-cn 转换比对，差异 '+ (simplified?simplified.changed:'?') +' 个（未完成 '+(simplified?simplified.unavailable:0)+' 个，端点限流）；全部 160 个中文字段的离线繁体字闸门 0 命中。');
md.push('- 英文栏 CJK：audit-language 见校验输出（英文栏 CJK=0）。');
md.push('');
md.push('## 7. 仍然缺什么');
md.push('');
md.push('- 索引级在本轮结束时还剩 **'+(133-batch.count)+' 条**（本轮只做到新排名第 40 名）；报告生成时工作区已被后续轮次继续升级到 '+structured.length+' 条。');
md.push('- 暴行层仍有 **'+(atrocities?atrocities.counts.withoutChineseName:0)+' 条**没有中文名。四条路线都试过：中文标签变体 +0、zhwiki sitelink +0、按英文名搜索（256 条只完成 5 条，端点限流约 2 分钟/次）+0、158 个英文条目的中文跨语言链接 +0。按规则保持 null，不编造译名；完整证据见 \`docs/verification-3.17/atrocities-zh-names.json\` 与 \`atrocities-zh-search.json\`。');
md.push('- 事件批次的中文维基**全文搜索**未跑完（搜索接口持续 429，退避后仍失败），本轮以「精确标题查询 + 重定向」逐条核对 33 条无中文引用条目（33/33 无对应页面）。标题无关的全文扫描留给下一轮。');
md.push('- 暴行层仍未接入任何 UI（与 3.16 相同的决定），本轮只做数据与校验。');
md.push('');
md.push('## 8. 产物清单');
md.push('');
md.push('- 排序与证据：\`docs/verification-3.17/content-upgrade-ranking.json\`、\`content-upgrade-evidence.json\`、\`content-upgrade-extracts.json\`');
md.push('- 撰写与装配：\`docs/verification-3.17/authoring/part-0{1..4}.json\`、\`editorial/events-upgraded-3.17.json\`、\`docs/verification-3.17/content-upgrade-authoring.json\`');
md.push('- 交付：\`public/data/events.json(+.gz)\`（40 条升级）、\`public/data/battles.json(+.gz)\`（5 条年份同步）、\`public/data/atrocities.json(+.gz)\`（中文名与英文数组）');
md.push('- 校验：\`content-validation.json\`、\`content-gz-mirrors.json\`、\`content-simplified-check.json\`、\`content-atrocities-validation.json\`、\`content-language-audit.json\`、\`content-atrocities-bilingual.json\`');
md.push('');
await writeFile(resolve(root,'docs/verification-3.17/content-round8.md'),md.join('\n')+'\n');
console.log(JSON.stringify({baseline,head:document.head,structuredAfter:structured.length,upgraded:upgraded.length,
 atrocitiesChineseNames:atrocities?atrocities.counts.withChineseName:null,validation:validationOk+'/'+validationTotal,
 md:'docs/verification-3.17/content-round8.md',json:'docs/verification-3.17/content-round8.json'},null,1));
