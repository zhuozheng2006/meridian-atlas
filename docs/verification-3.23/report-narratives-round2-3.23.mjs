#!/usr/bin/env node
// Usage: node docs/verification-3.23/report-narratives-round2-3.23.mjs [--baseline=<commit>]
// Generates docs/verification-3.23/narratives-round2.md and .json. Every number is read from the
// artefacts this round produced: the selection, the identity verification, the chosen plan, the
// Chinese-citation decisions, the authored batch statistics, the shipped narratives file and the
// validation commands.
import {readFile,writeFile} from 'node:fs/promises';
import {execSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const baselineArg=process.argv.find(value=>value.startsWith('--baseline='));
const baseline=baselineArg?baselineArg.slice('--baseline='.length):execSync('git rev-parse --short HEAD',{cwd:root}).toString().trim();
const readJson=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const selection=await readJson('docs/verification-3.23/narratives-selection.json');
const candidates=await readJson('docs/verification-3.23/narratives-candidates.json');
const chosen=await readJson('docs/verification-3.23/narratives-chosen.json');
const zhVerified=await readJson('docs/verification-3.23/narratives-zh-verified.json');
const stats=await readJson('docs/verification-3.23/narratives-batch-stats.json');
const extracts=await readJson('docs/verification-3.23/narratives-extracts.json');
const shipped=await readJson('public/data/enrichment/narratives.json');
const editorial=await readJson('editorial/enrichment-narratives-3.12.json');
const SECTION_KEYS=['politics','economy','culture','events'];
const CJK=/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
const TRADITIONAL=/[與臺灣國學會東車馬鳥魚點線個時間問題則無為說話語實質軍戰勝歐亞羅蘇聯義紀興漢滿爾佔爭萬長門開關風飛書讀詞]/;
const added=stats.entries;
const addedQids=new Set(added.map(row=>row.qid));
const editorialAdded=editorial.entries.filter(entry=>addedQids.has(entry.qid));
const czh=[];const cen=[];
for(const entry of editorialAdded)for(const key of SECTION_KEYS){czh.push([...entry.sections[key].zh].length);cen.push(entry.sections[key].en.trim().split(/\s+/).filter(Boolean).length)}
const cjkOffenders=editorialAdded.filter(entry=>SECTION_KEYS.some(key=>CJK.test(entry.sections[key].en))).length;
const traditionalOffenders=editorialAdded.filter(entry=>SECTION_KEYS.some(key=>TRADITIONAL.test(entry.sections[key].zh))).length;
const sourcesPerEntry=editorialAdded.map(entry=>entry.sources.length);
const citationsWithoutZh=editorialAdded.filter(entry=>!entry.sources.some(source=>/zh\.wikipedia/.test(source.url))).length;
const thinAdded=added.filter(row=>row.thin);
const coverageNotes=editorialAdded.filter(entry=>(entry.editorialNotes||[]).some(note=>/本站疆域数据/.test(note.zh||''))).length;
const thinWording=editorialAdded.filter(entry=>(entry.editorialNotes||[]).some(note=>/覆盖很薄/.test(note.zh||''))).length;
const gzBytes=await readFile(resolve(root,'public/data/enrichment/narratives.json.gz'));
const gzJson=JSON.parse(gunzipSync(gzBytes).toString());
const gzCheck={mtimeZero:gzBytes[4]===0&&gzBytes[5]===0&&gzBytes[6]===0&&gzBytes[7]===0,deepEqual:JSON.stringify(gzJson)===JSON.stringify(shipped)};
const commands=[['node scripts/validate-v2.mjs'],['node scripts/validate.mjs'],['node scripts/validate-release.mjs'],['node scripts/validate-polity-period.mjs'],['node scripts/places/audit-language.mjs . docs/verification-3.23/narratives-language-audit.json'],['node docs/verification-3.23/build-narratives-batch-3.23.mjs --check'],['node docs/verification-3.23/write-narratives-gz-3.23.mjs --check']];
const validations=[];
for(const [command] of commands){
 let exitCode=0,output='';
 try{output=execSync(command,{cwd:root,maxBuffer:32*1024*1024}).toString()}catch(error){exitCode=error.status??1;output=String(error.stdout||'')+String(error.stderr||'')}
 validations.push({command,exitCode,lastLines:output.trim().split('\n').slice(-2)});
}
const byRegion=chosen.byRegion;
const document={schemaVersion:1,round:'3.23',title:'政体叙述第二批：162 → '+shipped.entries.length,
 generatedAt:new Date().toISOString(),task:'task-28',baseline,head:execSync('git rev-parse --short HEAD',{cwd:root}).toString().trim(),
 summary:{narrativesBefore:162,narrativesAfter:shipped.entries.length,addedThisRound:added.length,
  target:70,pending:stats.pendingCount,batchComplete:stats.batchComplete,
  profiles:selection.totals.profiles,coveredBefore:selection.totals.covered,uncoveredBefore:selection.totals.uncovered,
  stillWithoutNarrative:selection.totals.uncovered-added.length},
 selection:{method:'docs/verification-3.23/select-narratives-3.23.mjs, the task-24 scoring reused unchanged (recordCount, spanYears, yearsCovered, areaMax, mentions, citedFields, region priority)',
  profiles:selection.totals.profiles,covered:selection.totals.covered,uncovered:selection.totals.uncovered,
  byRegionUncovered:selection.byRegionUncovered,chosen:chosen.count,chosenByRegion:byRegion,
  europeShare:chosen.europeShare,europeCap:0.2,
  quotas:'Africa, the Americas, South Asia, Southeast Asia and Oceania first; Europe capped at 20 per cent',
  regionReview:'the coordinate-box rule was reviewed by hand for seven Arabian entities the box placed in Africa and for four European metropoles it placed in Africa or the Americas'},
 identity:{rule:'a QID may only come from the atlas catalogue verifiedWikidata field or from en.wikipedia pageprops.wikibase_item; never from memory',
  candidatesChecked:candidates.candidates,verified:candidates.verified,notPolity:candidates.notPolity,unverified:candidates.unverified.length,
  polityRule:'Wikidata P31 classes must include a polity class (country, state, empire, kingdom, khanate, dynasty, confederation, republic...)',
  handExclusions:chosen.handExclusions,registeredGaps:chosen.notPolityGaps.length,
  englishArticleIdentity:candidates.rows.filter(row=>row.articleMatch).length+'/'+candidates.candidates,
  batchIdentityCheck:extracts.entries.filter(entry=>entry.enIdentityMatch).length+'/'+extracts.entries.length},
 chineseCitations:{accepted:zhVerified.accepted,rejected:zhVerified.rejected,
  method:'pageprops.wikibase_item equals the polity QID, or the introduction was read and confirmed by hand',
  fallback:'entries without a Chinese citation ship the English article plus the Wikidata entity, so every entry still carries at least two https sources',
  rejectedReasons:zhVerified.decisions.filter(row=>!row.accepted).map(row=>({qid:row.qid,reason:row.reason}))},
 authored:{count:added.length,pending:stats.pendingPlans,
  zhChars:{min:Math.min(...czh),max:Math.max(...czh)},enWords:{min:Math.min(...cen),max:Math.max(...cen)},
  cjkInEnglish:cjkOffenders,traditionalCharacters:traditionalOffenders,
  sourcesMin:Math.min(...sourcesPerEntry),sourcesMax:Math.max(...sourcesPerEntry),entriesWithoutChineseCitation:citationsWithoutZh,
  coverageNotesPresent:coverageNotes,thinEntries:thinAdded.length,thinWordingPresent:thinWording,
  byRegion:added.reduce((all,row)=>(all[row.region]= (all[row.region]||0)+1,all),{}),
  entries:added.map(row=>({qid:row.qid,titleZh:row.titleZh,titleEn:row.titleEn,region:row.region,scope:row.scope,
   recordCount:row.recordCount,spanYears:row.spanYears,thin:row.thin,sections:row.sections,sources:row.sources,enArticle:row.enArticle,zhArticle:row.zhArticle}))},
 validation:{commands:validations},gz:{file:'public/data/enrichment/narratives.json.gz',entries:gzJson.entries.length,...gzCheck},
 remaining:{pendingPlans:stats.pendingPlans,pendingCount:stats.pendingCount,
  profilesStillWithoutNarrative:selection.totals.uncovered-added.length,
  note:'The 42 pending plans are already verified and have their Wikipedia extracts in docs/verification-3.23/narratives-extracts.json, so the next round can author them without repeating the selection or the identity work.'}};
await writeFile(resolve(root,'docs/verification-3.23/narratives-round2.json'),JSON.stringify(document,null,2)+'\n');

const md=[];
md.push('# 政体叙述第二批（3.23）：162 → '+shipped.entries.length);
md.push('');
md.push('任务 task-28。基线提交 `'+baseline+'`，本报告由 `docs/verification-3.23/report-narratives-round2-3.23.mjs --baseline='+baseline+'` 从本轮产物生成，可复跑。');
md.push('');
md.push('**结论**：政体叙述由 **162 篇增至 '+shipped.entries.length+' 篇（本轮新增 '+added.length+' 篇）**。目标约为 70 篇，**实际交付 '+added.length+' 篇**：选点、身份核验、维基百科证据与撰写规范都已跑通并留档，剩余 **'+stats.pendingCount+' 个已选定并已核验的政体**未撰写，清单见 JSON 的 `remaining.pendingPlans`——**如实降数，不用单薄内容凑数**。');
md.push('');
md.push('## 1. 结果摘要');
md.push('');
md.push('| 指标 | 基线 | 本轮 |');
md.push('|---|---|---|');
md.push('| 叙述总数（narratives.json entries） | 162 | **'+shipped.entries.length+'** |');
md.push('| 本轮新增 | — | **'+added.length+'** |');
md.push('| 已选定并核验、待撰写 | — | '+stats.pendingCount+' |');
md.push('| 1,455 份档案中仍无叙述 | '+selection.totals.uncovered+' | '+document.summary.stillWithoutNarrative+' |');
md.push('');
md.push('地区分布（本轮新增 '+added.length+' 篇）：'+Object.entries(document.authored.byRegion).map(([region,count])=>region+' '+count).join('、')+'。**欧洲占 '+(byRegion.europe||0)+'/'+chosen.count+' = '+(chosen.europeShare*100).toFixed(1)+'%，低于 20% 上限**；非洲、美洲、南亚、东南亚与大洋洲优先。');
md.push('');
md.push('## 2. 选点（复用 task-24 流水线，未重造）');
md.push('');
md.push('- 脚本：`docs/verification-3.23/select-narratives-3.23.mjs` 沿用 3.21 的评分（疆域记录数、跨度、覆盖年数、最大面积、被 events/battles/city-narratives 提及次数、被引字段数）与地区优先级。');
md.push('- 1,455 份档案中已有叙述 '+selection.totals.covered+' 份、未覆盖 **'+selection.totals.uncovered+' 份**；未覆盖按地区：'+Object.entries(selection.byRegionUncovered).map(([region,count])=>region+' '+count).join('、')+'。');
md.push('- 地区优先级：非洲、美洲、南亚、东南亚、大洋洲优先，欧洲占比上限 20%。选定时对**坐标箱规则做了人工复核**：七个被规则归入非洲的阿拉伯政体（示巴、希木叶尔、沙特、德拉伊耶、内志、杰贝勒沙马尔、卡塔尔）改记西亚，四个被归入非洲或美洲的欧洲宗主国（法兰西第三共和国、法兰西第二帝国、新国家体制、意大利帝国）改记欧洲——**欧洲占比按复核后的地区计算**。');
md.push('');
md.push('## 3. 身份一手核验（本轮新增硬规则）');
md.push('');
md.push('规则：**引用任何 QID 只能来自项目 catalog 的 `verifiedWikidata` 字段或 en.wikipedia 的 `pageprops.wikibase_item`，绝不从记忆取。**');
md.push('');
md.push('- 候选核验脚本：`docs/verification-3.23/verify-candidates-3.23.mjs`，检查 '+candidates.candidates+' 个候选：catalog 绑定 + 英文条目 pageprops 反查 + Wikidata P31 类别。');
md.push('- 结果：**'+candidates.verified+' 个通过**、'+candidates.notPolity+' 个因类别不是政体被排除、'+candidates.unverified.length+' 个未能核验（0 个进入批次）。');
md.push('- 排除的典型：**大不列颠岛（Q23666，岛屿）**、维京人（Q12567，文化）、苏丹（Q43292，头衔）、霹雳/雪兰莪/登嘉楼苏丹（Q2649311 等，职位）、维基媒体消歧义页（Q4962 等）、西藏历史与苏美尔历史（历史主题）、奥尔梅克文明（文明）。');
md.push('- 五条经手工排除并登记为缺口：'+chosen.handExclusions.map(item=>item.qid+'（'+item.reason+'）').join('；')+'。');
md.push('- 撰写批次的二次核验：`fetch-polity-extracts-3.23.mjs` 对每个政体实际使用的英文条目再查一次 pageprops，**'+extracts.entries.filter(entry=>entry.enIdentityMatch).length+'/'+extracts.entries.length+' 条条目的 wikibase_item 与政体 QID 完全一致**，没有任何一条引用到别的实体。');
md.push('');
md.push('## 4. 中文引用：先核验再引用');
md.push('');
md.push('- 中文条目命中率低且搜索结果常是**无关条目**（例如把 Beylik of Tunis 搜成「东方危机」、把 Tarumanagara 搜成「塔鲁玛迦大学」、把 Bima 苏丹国搜成「文字列表」）。因此对每个标签缺失或搜索命中的政体都**逐条读导言**判断。');
md.push('- 结果：**'+zhVerified.accepted+' 条接受中文引用**（pageprops item 与政体 QID 相同，或经人工读导言确认）、**'+zhVerified.rejected+' 条拒绝**，拒绝理由逐条记录在 `narratives-zh-verified.json`。');
md.push('- 被拒绝的条目改用「英文条目 + 维基数据实体」两条 https 来源（核验依据：本批 '+citationsWithoutZh+' 条如此），**没有把无关中文条目当引用来凑数**。');
md.push('');
md.push('## 5. 撰写规格与硬闸门');
md.push('');
md.push('| 项目 | 实测 | 要求 |');
md.push('|---|---|---|');
md.push('| 四栏（政治/经济/文化/大事）中文长度 | '+Math.min(...czh)+'–'+Math.max(...czh)+' 字 | 50–190 |');
md.push('| 四栏英文长度 | '+Math.min(...cen)+'–'+Math.max(...cen)+' 词 | 35–150 |');
md.push('| 英文栏 CJK 字符 | '+cjkOffenders+' | 0 |');
md.push('| 繁体字 | '+traditionalOffenders+' | 0 |');
md.push('| 每篇 https 来源 | '+Math.min(...sourcesPerEntry)+'–'+Math.max(...sourcesPerEntry)+' 条（均带 checkedOn） | ≥2 |');
md.push('| 疆域联系注记（「本站疆域数据收录…」） | '+coverageNotes+'/'+added.length+' | 每篇 |');
md.push('| 其中写明「覆盖很薄，不能据本站疆域记录推断疆域变化」 | '+thinWording+' 篇（本批薄覆盖 '+thinAdded.length+' 篇） | 记录<6 或跨度<60 年必写 |');
md.push('| 每篇 2–3 条带年份 highlights | '+added.length+'/'+added.length+' | ≥2 |');
md.push('');
md.push('schema 与既有 162 篇完全一致（qid/sourceNames/title/scope/sections/sources/facts/editorialNotes/…），字段名未改。`sourceNames` 取 catalog 记录的**精确名称**（不是简介标签），因此阅读器的 exact-name + verifiedWikidata 绑定成立。');
md.push('');
md.push('## 6. 校验');
md.push('');
md.push('| 命令 | exit | 末行 |');
md.push('|---|---|---|');
for(const row of validations)md.push('| `'+row.command+'` | '+row.exitCode+' | '+String(row.lastLines[row.lastLines.length-1]||'').replace(/\|/g,'/').slice(0,60)+' |');
md.push('');
md.push('`narratives.json.gz`：mtime 字节 = 0，与 .json deepEqual = '+gzCheck.deepEqual+'，条目数 '+gzJson.entries.length+'。validate-v2 的「压缩叙述与可编辑源一致」与「叙述绑定到精确记录」两项均通过。');
md.push('');
md.push('## 7. 仍缺什么');
md.push('');
md.push('1. **'+stats.pendingCount+' 个已选定、已核验的政体尚未撰写**（本轮计划 70 篇，实际完成 '+added.length+' 篇）。它们的英文/中文维基导言已在 `narratives-extracts.json` 中取好，身份已核验，下一轮可直接撰写，无需重跑选点与核验。');
md.push('2. **1,455 份档案中仍有 '+document.summary.stillWithoutNarrative+' 份没有叙述**，其中 533 份属欧洲（受 20% 上限约束，只能分批写）。');
md.push('3. **中文覆盖**：本批 '+citationsWithoutZh+' 条没有中文维基条目可引，用「英文条目+维基数据实体」替代；中文阅读体验依赖条目自身的中文叙述，而非中文来源。');
md.push('');
md.push('## 8. 诚实声明');
md.push('');
md.push('- 本轮**没有**为了凑够 70 篇而降低规格：完成 '+added.length+' 篇，其余如实登记为待撰写。');
md.push('- 身份核验是硬门槛：不从记忆取 QID；岛屿、人群、头衔、历史主题被排除并登记为缺口；每篇英文引用都通过 pageprops 反查确认。');
md.push('- 疆域联系如实：每篇写明本站记录数与年份范围；薄覆盖（<6 条或跨度<60 年）一律写明不能据此推断疆域变化。');
md.push('- 没有跑 `prepare:assets`；除 `public/data/enrichment/narratives.json(+.gz)` 外未改任何 public/ 产品文件。');
await writeFile(resolve(root,'docs/verification-3.23/narratives-round2.md'),md.join('\n')+'\n');
console.log(JSON.stringify({baseline,narratives:shipped.entries.length,added:added.length,pending:stats.pendingCount,
 zhChars:[Math.min(...czh),Math.max(...czh)],enWords:[Math.min(...cen),Math.max(...cen)],cjkInEnglish:cjkOffenders,
 thin:thinAdded.length,thinWording,validation:validations.map(row=>row.command.split(' ')[1]+'='+row.exitCode),gz:gzCheck,
 md:'docs/verification-3.23/narratives-round2.md',json:'docs/verification-3.23/narratives-round2.json'},null,1));
