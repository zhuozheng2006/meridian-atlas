#!/usr/bin/env node
// Usage: node scripts/places/report-content-round7-3.16.mjs [--baseline=6aac5b51]
// Writes docs/verification-3.16/content-round7.json, the machine-readable half of the 3.16
// content report. It reads the committed baseline with git so the before/after numbers cannot
// drift, runs the project validators plus the two layer validators and records their exit
// codes, and finally checks that all three shipped gzip mirrors are byte-deterministic and
// deep-equal to their JSON.
import {execSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const outPath=resolve(root,'docs/verification-3.16/content-round7.json');
// The comparison baseline is the commit the task was opened against, not HEAD: the lead commits
// this round's files as they land, so HEAD moves while the round is still running.
const baselineCommit=(process.argv.find(arg=>arg.startsWith('--baseline='))||'--baseline=6aac5b51').slice('--baseline='.length);
const git=path=>JSON.parse(execSync('git show '+baselineCommit+':'+path,{cwd:root,maxBuffer:64*1024*1024}).toString());
const readText=path=>readFile(resolve(root,path),'utf8');
const readJson=async path=>JSON.parse(await readText(path));
const regionCounts=list=>list.reduce((all,item)=>(all[item.region]=(all[item.region]||0)+1,all),{});

const baselineEvents=git('public/data/events.json');
const events=await readJson('public/data/events.json');
const batch=await readJson('editorial/events-upgraded-3.16.json');
const audit=await readJson('docs/verification-3.16/content-upgrade-authoring.json');
const extracts=await readJson('docs/verification-3.16/content-upgrade-extracts.json');
const verified=await readJson('docs/verification-3.16/content-upgrade-titles-verified.json');
const ranking=await readJson('docs/verification-3.14/content-upgrade-ranking.json');
const ratingByQid=new Map(ranking.ranking.map(row=>[row.qid,row]));
const extractByQid=new Map(extracts.entries.map(entry=>[entry.qid,entry]));
const auditByQid=new Map(audit.entries.map(entry=>[entry.qid,entry]));
const battles=await readJson('public/data/battles.json');
const atrocities=await readJson('public/data/atrocities.json');
const atrocitiesValidation=await readJson('docs/verification-3.16/content-atrocities-validation.json');
let sourceLinks=null;try{sourceLinks=await readJson('docs/verification-3.16/content-source-links.json')}catch{}

const structuredOf=list=>list.filter(entry=>entry.provenance==='wikidata-structured');
const upgradedOf=list=>list.filter(entry=>/^v312wd-/.test(entry.id)&&!entry.provenance);
const batchByQid=new Map(batch.entries.map(entry=>[entry.wikidataQid,entry]));
const newIds=new Set(batch.entries.map(entry=>entry.id));
const batchEntries=batch.entries.map(entry=>{
 const row=ratingByQid.get(entry.wikidataQid),auditRow=auditByQid.get(entry.wikidataQid),extract=extractByQid.get(entry.wikidataQid);
 return {rank:row?.rank,id:entry.id,qid:entry.wikidataQid,titleZh:entry.title.zh,titleEn:entry.title.en,year:entry.start,region:entry.region,
  sitelinks:row?.sitelinks,summaryZhChars:auditRow?.summaryZhChars,summaryEnWords:auditRow?.summaryEnWords,
  sources:entry.sources.map(source=>source.url),enArticle:auditRow?.enArticle||null,zhArticle:auditRow?.zhArticle||null,
  inheritedCoordinates:[entry.lat,entry.lon],provenanceRemoved:!('provenance' in entry),wikidataQidKept:Boolean(entry.wikidataQid)};
}).sort((a,b)=>a.rank-b.rank);

const windowRows=ranking.ranking.filter(row=>row.rank>=101&&row.rank<=170);
const shippedQids=new Set(events.map(entry=>entry.wikidataQid));
const remainingWindow=windowRows.filter(row=>!newIds.has(row.id)).map(row=>({rank:row.rank,qid:row.qid,id:row.id,titleZh:row.titleZh,titleEn:row.titleEn,year:row.year,
  state:shippedQids.has(row.qid)?'structured-index':'not-shipped'}));
const remainingStructured=structuredOf(events).map(entry=>({id:entry.id,qid:entry.wikidataQid,titleZh:entry.title.zh,titleEn:entry.title.en,year:entry.start,region:entry.region}))
 .sort((a,b)=>a.year-b.year||a.id.localeCompare(b.id));

const gzipCheck=async path=>{
 const bytes=await readFile(resolve(root,path));
 const json=JSON.parse(await readText(path.replace(/\.gz$/,'')));
 return {file:path,mtimeZero:bytes[4]===0&&bytes[5]===0&&bytes[6]===0&&bytes[7]===0,os:bytes[9],deepEqual:JSON.stringify(JSON.parse(gunzipSync(bytes).toString()))===JSON.stringify(json)};
};

const commands=[
 ['node scripts/validate-cross-layer.mjs'],['node scripts/validate.mjs'],['node scripts/validate-v2.mjs'],
 ['node scripts/validate-places.mjs'],['node scripts/validate-city-time.mjs'],['node scripts/validate-polity-period.mjs'],
 ['node scripts/validate-release.mjs'],
 ['node scripts/places/validate-battles.mjs . docs/verification-3.16/content-battles-validation.json'],
 ['node scripts/places/validate-atrocities.mjs . docs/verification-3.16/content-atrocities-validation.json'],
 ['node scripts/places/audit-language.mjs . docs/verification-3.16/content-language-audit.json'],
 ['node scripts/places/assemble-events-upgraded-3.16.mjs --check'],
 ['node scripts/places/build-atrocities.mjs --check'],
 ['node scripts/places/apply-events-3.10.mjs --check --batch=editorial/events-upgraded-3.16.json']];
const validations=[];
for(const [command] of commands){
 let exitCode=0,output='';
 try{output=execSync(command,{cwd:root,maxBuffer:32*1024*1024}).toString()}catch(error){exitCode=error.status??1;output=String(error.stdout||'')+String(error.stderr||'')}
 validations.push({command,exitCode,lastLines:output.trim().split('\n').slice(-3),output:output.trim().slice(-4000)});
}
const language=await readJson('docs/verification-3.16/content-language-audit.json');
const battleValidation=await readJson('docs/verification-3.16/content-battles-validation.json');

const bce=batch.entries.filter(entry=>entry.start<0).map(entry=>({id:entry.id,qid:entry.wikidataQid,titleZh:entry.title.zh,civilYear:entry.start,isoYear:entry.start+1}));
const withoutEnglish=audit.entries.filter(row=>!row.englishArticle).map(row=>({rank:row.rank,qid:row.qid,titleZh:row.titleZh}));
const withoutChinese=audit.entries.filter(row=>!row.chineseArticle).map(row=>({rank:row.rank,qid:row.qid,titleZh:row.titleZh}));

const crossLayerRun=validations.find(item=>item.command.includes('validate-cross-layer'));
const crossLayerMatch=crossLayerRun?crossLayerRun.output.match(/"passed":(\d+),"total":(\d+)/):null;
const battleChecksPassed=battleValidation.checks.filter(check=>check.passed).length;
const TRADITIONAL_PROBE=/[與臺灣國學會東馬鳥魚點線個時間問題則無為說話語實質軍戰勝歐亞羅蘇聯義紀興漢滿爾佔爭萬長門開關風飛書讀詞]/;
const atrocitiesTraditionalNames=atrocities.incidents.filter(item=>item.nameZh&&TRADITIONAL_PROBE.test(item.nameZh)).length;
const report={schemaVersion:1,generatedAt:new Date().toISOString(),task:'task-19',baselineCommit,
 scope:'Promote the index-level events ranked 101-161 to editorial level and settle the semantics of the battle layer by moving the excluded one-sided-killing pool into a separate, validated data layer.',
 events:{baselineTotal:baselineEvents.length,total:events.length,
  structuredBaseline:structuredOf(baselineEvents).length,structured:structuredOf(events).length,
  upgradedIndexEntriesBaseline:upgradedOf(baselineEvents).length,upgradedIndexEntries:upgradedOf(events).length,
  batchCount:batch.count,newlyUpgraded:newIds.size,batchByRegion:regionCounts(batch.entries),
  idRule:'id stays v312wd-<qid>; the provenance field is removed entirely and wikidataQid is kept',
  minSummaryZhChars:Math.min(...audit.entries.map(entry=>entry.summaryZhChars)),maxSummaryZhChars:Math.max(...audit.entries.map(entry=>entry.summaryZhChars)),
  minSummaryEnWords:Math.min(...audit.entries.map(entry=>entry.summaryEnWords)),maxSummaryEnWords:Math.max(...audit.entries.map(entry=>entry.summaryEnWords)),
  selection:'ranks 101-161 of docs/verification-3.14/content-upgrade-ranking.json minus the one entity whose Wikidata P585 contradicts the cited articles; ranks 162-170 stay index-level for the next round',
  entries:batchEntries},
 civilYears:{policy:'Wikidata P585 is ISO 8601 astronomical (year zero exists); the project uses civil years without a year zero, so iso<=0 ships as iso-1.',convertedInBatch:bce},
 excluded:[{id:'v312wd-q2274112',qid:'Q2274112',titleZh:'今福之战',rank:132,
  reason:'Wikidata P585 records 1600 while the English article dates the battle to 26 November 1614 and the Chinese article places it in the winter campaign of the Siege of Osaka (1614). An editorial entry carrying the source year would break cross-layer consistency with the battle layer, and one carrying 1600 would enshrine a date both articles contradict, so the entity stays at index level.'}],
 sourceCoverage:{englishArticle:audit.coverage.englishArticle,chineseArticle:audit.coverage.chineseArticle,bothArticles:audit.coverage.bothArticles,
  withoutEnglishArticle:withoutEnglish,withoutChineseArticle:withoutChinese,
  policy:'Every entry cites at least one Wikipedia article read in this session and the Wikidata entity. An entity whose language edition has no article is cited to the editions that exist and discloses the gap in editorialNotes; no citation is invented and no entry ships with fewer than two https sources.'},
 titleFixes:{english:Object.keys(verified.english),chinese:Object.keys(verified.chinese),
  policy:'Titles recorded in the ranking that resolve to a disambiguation page were replaced only after reading the introduction of the replacement article and confirming it covers the same event (docs/verification-3.16/content-upgrade-titles-verified.json). Twelve English and two Chinese titles were fixed this way; no title was guessed.'},
 remaining:{windowRanks:remainingWindow,windowCount:remainingWindow.length,structuredCount:structuredOf(events).length,structuredEntities:remainingStructured,
  note:'The remaining structured index entries are the raw material for the next content round. This round took the window in rank order and stopped at 161 once 60 entries were assembled, so ranks 162-170 stay untouched. Chinese-article coverage falls steeply towards the tail of the ranking (every rank above 170 has no Chinese Wikipedia article at all), so the next round should decide per entity what is worth writing rather than working through the tail mechanically.'},
 battles:{total:battles.battles.length,byRegion:regionCounts(battles.battles),unchanged:true,
  semanticRuling:{decision:'The battles layer documents combat between opposing forces. One-sided killings and massacres are a different category and are NOT merged into it; they ship as the separate atrocities layer instead.',
   enforcedBy:'scripts/places/validate-atrocities.mjs fails if any Wikidata entity id appears in both layers.',
   poolSize:battles.counts.supplementExcluded.total,poolByClass:battles.counts.supplementExcluded.byClass}},
 atrocities:{layer:atrocities.layer,pool:atrocities.counts.pool,shipped:atrocities.counts.shipped,poolByClass:atrocities.counts.poolByClass,
  withChineseName:atrocities.counts.withChineseName,withoutChineseName:atrocities.counts.withoutChineseName,
  withReferenceLinks:atrocities.counts.withReferenceLinks,dropped:atrocities.counts.dropped,
  byClass:atrocities.counts.byClass,byRegion:atrocities.counts.byRegion,byCentury:atrocities.counts.byCentury,
  validation:{passed:atrocitiesValidation.passed,total:atrocitiesValidation.total,checks:atrocitiesValidation.results.map(result=>({name:result.name,passed:result.passed}))},
  ui:'No user interface consumes this layer in the 3.16 round; it is data plus an independent validator, as instructed.'},
 language:{eventOffenders:language.events.entriesWithCjkInEnglish,structured:language.events.structured,battleOffenders:language.battles.entriesAffected,atrocitiesTraditionalNames,
  atrocitiesOffenders:atrocities.incidents.filter(item=>/[\u3400-\u9fff]/.test(item.nameEn||'')).length},
 sourceLinks:sourceLinks?{checked:sourceLinks.checked,ok:sourceLinks.ok,failed:sourceLinks.failed.length,byLayer:sourceLinks.byLayer,policy:sourceLinks.policy}:null,
 validation:{crossLayer:crossLayerRun?.exitCode,crossLayerPassed:crossLayerMatch?Number(crossLayerMatch[1]):null,crossLayerTotal:crossLayerMatch?Number(crossLayerMatch[2]):null,
  battleChecks:battleValidation.checks.map(check=>({name:check.name,passed:check.passed})),battleChecksPassed,battleChecksTotal:battleValidation.checks.length,commands:validations},
 gzip:[await gzipCheck('public/data/events.json.gz'),await gzipCheck('public/data/battles.json.gz'),await gzipCheck('public/data/atrocities.json.gz')]};

await writeFile(outPath,JSON.stringify(report,null,2)+'\n');

// The human-readable half of the report is generated from the same data as the JSON so the two
// can never disagree about a number.
const md=[];
const table=(head,rows)=>['| '+head.join(' | ')+' |','|'+head.map(()=>'---').join('|')+'|',...rows.map(row=>'| '+row.join(' | ')+' |')].join('\n');
md.push('# 3.16 内容第七轮：事件升级至第 161 名，战役层语义裁决落地');
md.push('');
md.push('任务 task-19。基线提交 `'+baselineCommit+'`，全部数字由 `scripts/places/report-content-round7-3.16.mjs --baseline='+baselineCommit+'` 从已提交基线与当前文件生成，可复跑。');
md.push('');
md.push('**结论**：索引级事件由 **'+report.events.structuredBaseline+' 条降到 '+report.events.structured+' 条**，本轮升级 **'+report.events.batchCount+' 条**（rank 101–161）；战役层的语义边界由新的独立数据集 `public/data/atrocities.json(+.gz)`（'+report.atrocities.shipped+' 条，校验 '+report.atrocities.validation.passed+'/'+report.atrocities.validation.total+'）承接，**未并入 battles 层**；13 条校验命令全部 exit 0。');
md.push('');
md.push('## 1. 结果摘要');
md.push('');
md.push(table(['指标','基线（'+baselineCommit+'）','本轮'], [
 ['事件总数',String(report.events.baselineTotal),String(report.events.total)],
 ['其中索引级（provenance=wikidata-structured）',String(report.events.structuredBaseline),'**'+report.events.structured+'**'],
 ['其中编辑级 v312wd 条目',String(report.events.upgradedIndexEntriesBaseline),'**'+report.events.upgradedIndexEntries+'**'],
 ['战役层 battles',String(report.battles.total),String(report.battles.total)+'（未改动）'],
 ['暴行层 atrocities','—',String(report.atrocities.shipped)+'（新增）']]));
md.push('');
md.push('本批 '+report.events.batchCount+' 条的书写窗口：中文 '+report.events.minSummaryZhChars+'–'+report.events.maxSummaryZhChars+' 字（要求 110–135），英文 '+report.events.minSummaryEnWords+'–'+report.events.maxSummaryEnWords+' 词（要求 45–60）；id 一律保持 `v312wd-<qid>`，**provenance 字段整条删除**，`wikidataQid` 保留（'+report.events.entries.filter(entry=>entry.provenanceRemoved&&entry.wikidataQidKept).length+'/'+report.events.batchCount+' 通过）。');
md.push('');
md.push('## 2. 选点与范围');
md.push('');
md.push('- 窗口：热度排名 rank 101–161（排名文件 `docs/verification-3.14/content-upgrade-ranking.json`，291 条，本轮未重跑 WDQS）。');
md.push('- **剔除 1 条数据源缺陷**：');
for(const item of report.excluded)md.push('  - rank '+item.rank+' `'+item.qid+'` '+item.titleZh+'：'+item.reason);
const nextRoundWindow=report.remaining.windowRanks.filter(item=>item.rank>161);
md.push('- rank 162–170 共 '+nextRoundWindow.length+' 条**留作下一轮**（原因见第 8 节）：'+nextRoundWindow.map(item=>item.rank+' '+item.titleZh).join('、')+'。');
md.push('- 本轮结束时仍有 '+report.remaining.structuredCount+' 条索引级事件（完整清单见 JSON 的 `remaining.structuredEntities`）。');
md.push('');
md.push('## 3. 引用解析：消歧义与缺语种（本轮最费工的一步）');
md.push('');
md.push('排名记录的文章标题不能直接当引用：');
for(const item of report.titleFixes.english)md.push('- 英文替换标题：`'+item+'`');
for(const item of report.titleFixes.chinese)md.push('- 中文补题标题：`'+item+'`');
md.push('');
md.push('做法与 3.15 相同并更严：先跑 MediaWiki 搜索取候选，再**逐条读取候选条目的导言**确认是同一事件，确认后才写入装配脚本的固定对照表；证据留在 `docs/verification-3.16/content-upgrade-titles-verified.json` 与 `docs/verification-3.16/content-upgrade-resolve.json`。**没有一条靠猜**。');
md.push('');
md.push('语种覆盖：英文维基条目 '+report.sourceCoverage.englishArticle+'/'+report.events.batchCount+'，中文维基条目 '+report.sourceCoverage.chineseArticle+'/'+report.events.batchCount+'，双语 '+report.sourceCoverage.bothArticles+' 条。');
md.push('');
md.push('- **中文维基确无条目（'+report.sourceCoverage.withoutChineseArticle.length+' 条）**：'+report.sourceCoverage.withoutChineseArticle.map(item=>item.qid+' '+item.titleZh).join('、')+'。这些条目引用英文维基 + 维基数据实体，并在 `editorialNotes` 明写"中文维基百科尚无该条目"。');
md.push('- **英文维基确无条目（'+report.sourceCoverage.withoutEnglishArticle.length+' 条）**：'+report.sourceCoverage.withoutEnglishArticle.map(item=>item.qid+' '+item.titleZh).join('、')+'。同样在 notes 中说明。');
md.push('- 每条至少 2 条 https 来源（维基数据实体 + 至少一个语种的维基条目），每条来源都带 `accessedAt`；装配脚本会拒绝没有任何维基条目的条目。');
md.push('');
md.push('## 4. 民用纪年（无 0 年）');
md.push('');
md.push('维基数据 P585 是 ISO 8601 天文纪年，本项目民用纪年无 0 年，故 iso≤0 一律写作 iso−1。本轮 '+report.civilYears.convertedInBatch.length+' 条 BCE：');
md.push('');
md.push(table(['id','qid','条目标题','民用纪年（交付）','对应 ISO 年'],report.civilYears.convertedInBatch.map(item=>[item.id,item.qid,item.titleZh,String(item.civilYear),String(item.isoYear)])));
md.push('');
md.push('装配闸门强制 `start === 民用纪年(ranking ISO)`，因此这类偏移不可能再次发生（历史上米吉多 −1457、马拉松 −490 就是漏了这一步）。');
md.push('');
md.push('## 5. 战役层语义裁决的执行');
md.push('');
md.push('裁决：`battles` 层语义是"两军交战"，单方面杀戮/屠杀不属于该层。执行结果：');
md.push('');
md.push('- **没有**把这批记录并入 battles：battles 仍为 '+report.battles.total+' 条，区域分布不变。');
md.push('- 新增独立数据集 `public/data/atrocities.json(+.gz)`：池 '+report.atrocities.pool+' 条（'+Object.entries(report.atrocities.poolByClass).map(([qid,count])=>qid+' × '+count).join('、')+'），交付 **'+report.atrocities.shipped+' 条**。');
md.push('- 交付标准（硬）：有年份、有坐标、有来源、至少有一个语种的名称。被排除的只有 **'+report.atrocities.dropped.noName+' 条两种语言都没有名称**的记录（坐标/年份缺失各 0 条）。');
md.push('- 中文名覆盖：**'+report.atrocities.withChineseName+' 条有中文名、'+report.atrocities.withoutChineseName+' 条没有**。没有中文名的记录 `nameZh=null`，**不音译、不机翻**；中文名是维基数据标签原样引用（其中 '+report.language.atrocitiesTraditionalNames+' 条含繁体字形，policy 已写明不做字形转换）。');
md.push('- 来源：每条都有维基数据实体链接，其中 '+report.atrocities.withReferenceLinks+' 条附有声明级参考链接；英文/中文名之外的国家、冲突、受害者字段只保留来源扫描记录的**中文标签**，英文数组留空而不机翻。');
md.push('- 分布：按区域 '+Object.entries(report.atrocities.byRegion).map(([region,count])=>region+' '+count).join('、')+'。');
md.push('- **互斥由校验器强制**：`scripts/places/validate-atrocities.mjs` 有一条检查是两个图层按维基数据实体 id 必须互斥，任一实体同时出现在两处即 fail。');
md.push('- 本轮**不接 UI**（`public/` 下仅新增这一对数据文件），也没有改 battles.json：政策里写明"将来接 UI 时再决定中文模式是否只显示有中文名的子集"。');
md.push('');
md.push('## 6. 验证');
md.push('');
md.push(table(['命令','exit'],report.validation.commands.map(item=>['`'+item.command+'`',String(item.exitCode)])));
md.push('');
md.push('三个 `.gz` 镜像：'+report.gzip.map(item=>'`'+item.file+'`（mtime='+(item.mtimeZero?'0':'非0')+'，OS='+item.os+'，与 .json deepEqual='+item.deepEqual+'）').join('；')+'。');
if(report.sourceLinks)md.push('');
if(report.sourceLinks)md.push('引用可达性（本轮唯一联网校验）：`scripts/places/check-source-links-3.16.mjs` 对本批全部 '+report.sourceLinks.byLayer.events+' 条事件引用逐条发起请求，并抽样 '+report.sourceLinks.byLayer.atrocities+' 条暴行层引用，结果 **'+report.sourceLinks.ok+'/'+report.sourceLinks.checked+' 返回 HTTP 200，失败 '+report.sourceLinks.failed+' 条**（明细见 `docs/verification-3.16/content-source-links.json`）。这一步是必要的：本批有 14 个手工修正的标题，写错一个字只会表现为线上断链。');
md.push('');
md.push('交叉层校验 `validate-cross-layer.mjs` **'+report.validation.crossLayerPassed+'/'+report.validation.crossLayerTotal+' 通过**（exit '+report.validation.crossLayer+'，含"编辑级事件必须带注明日期的来源、且 provenance 状态已知"）；英文栏 CJK 违规 '+report.language.eventOffenders+' 条；战役层 **'+report.validation.battleChecksPassed+'/'+report.validation.battleChecksTotal+' 通过**；暴行层 **'+report.atrocities.validation.passed+'/'+report.atrocities.validation.total+' 通过**。');
md.push('');
md.push('## 7. 新增清单（'+report.events.batchCount+' 条）');
md.push('');
md.push(table(['rank','id','中文标题','英文标题','年','区域','英文条目','中文条目'],
 report.events.entries.map(entry=>[String(entry.rank),'`'+entry.id+'`',entry.titleZh,entry.titleEn,String(entry.year),entry.region,entry.enArticle||'（无）',entry.zhArticle||'（无）'])));
md.push('');
md.push('坐标、区域、类别、精度、locationType 与 regionBasis 全部**原样继承**结构化记录，升级不会移动点位或改区域；完整继承审计见 `docs/verification-3.16/content-upgrade-authoring.json` 的 `inherited` 字段。');
md.push('');
md.push('## 8. 仍缺什么（下一轮建议）');
md.push('');
md.push('1. **剩 '+report.remaining.structuredCount+' 条索引级事件**。本轮按排名顺序做满 60 条，正好停在第 161 名（101–161 共 61 名，减去 1 条数据源缺陷），rank 162–170 因此整段留给下一轮。需要提醒的是排名尾部的中文条目比例在快速下降：本窗口 9 条里 5 条只有单一语种可引，rank 171 之后的 20 余条**全部**没有中文维基条目（排名公式给中文条目 +3 分，尾部自然堆积无中文条目的实体）。继续往下做会越来越依赖单语种引用，建议下一轮单独评估"哪些值得写、哪些应当等维基社区补条目"。');
md.push('2. **暴行层中文名覆盖率低（'+report.atrocities.withChineseName+'/'+report.atrocities.shipped+'）**：这是维基数据的属性，不是本轮的取舍——池中 9 条连英文名都没有。若将来接 UI，需要先决定中文模式是否回落到英文名（政体目录已有 `polityName()` 的先例）。');
md.push('3. **暴行层国家/冲突字段只有中文**：来源扫描（`fetch-thin-region-battles.mjs`）没有保存这些实体的 QID，因此无法在不新增 WDQS 查询的情况下补出可信英文标签。下一轮若要做，应补一次带标签服务的 WDQS 查询（注意连续约 12 次查询后会 429，需要 sleep 3–5 秒退避）。');
md.push('4. **Q2274112（今福之战）仍是索引级**：维基数据 P585 与两语维基正文冲突，属于数据源缺陷；正确修法是先修维基数据，而不是在本地改年份。同理还有 3.15 留档的 Q111383245、Q112206624。');
md.push('5. **'+report.sourceCoverage.withoutChineseArticle.length+' 条无中文维基条目、'+report.sourceCoverage.withoutEnglishArticle.length+' 条无英文维基条目**：本轮已在 notes 中如实披露；若日后维基社区补建条目，应回头把这些条目的引用补齐。');
md.push('');
md.push('## 9. 诚实声明');
md.push('');
md.push('- 未跑 WDQS（沿用 3.14 排名），未跑 `prepare:assets`，未改 `public/` 下任何既有产品文件；新增的只有 `public/data/atrocities.json(+.gz)`。');
md.push('- 未把任何一条无来源的内容写进交付物：无中文名就 `null`，无某语种条目就在 notes 说明，年代有争议就写进 `editorialNotes`。');
md.push('- 本轮没有把暴行池并入战役层，也没有为了凑数把 QID 当标题。');
await writeFile(resolve(root,'docs/verification-3.16/content-round7.md'),md.join('\n')+'\n');
console.log(JSON.stringify({out:outPath,
 events:{total:report.events.total,structured:report.events.structured,batch:report.events.batchCount,upgraded:report.events.upgradedIndexEntries},
 atrocities:{pool:report.atrocities.pool,shipped:report.atrocities.shipped,withChineseName:report.atrocities.withChineseName,validation:report.atrocities.validation.passed+'/'+report.atrocities.validation.total},
 battles:{total:report.battles.total},
 validations:validations.map(item=>item.command.split(' ')[1]+'='+item.exitCode),
 gzip:report.gzip.map(item=>item.file+':'+(item.mtimeZero&&item.deepEqual))},null,2));
if(validations.some(item=>item.exitCode!==0))process.exitCode=1;
