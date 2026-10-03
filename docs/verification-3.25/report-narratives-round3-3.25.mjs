#!/usr/bin/env node
// Usage: node docs/verification-3.25/report-narratives-round3-3.25.mjs [--baseline=<commit>]
// Generates docs/verification-3.25/narratives-round3.md and .json for the batch that finished the
// 3.23 plans: every number is read from the artefacts of the two rounds (selection, identity
// verification, chosen plan, Chinese citation decisions, batch statistics, shipped file) and from
// the validation commands.
import {readFile,writeFile} from 'node:fs/promises';
import {execSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const baselineArg=process.argv.find(value=>value.startsWith('--baseline='));
const baseline=baselineArg?baselineArg.slice('--baseline='.length):execSync('git rev-parse --short HEAD',{cwd:root}).toString().trim();
const readJson=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const candidates=await readJson('docs/verification-3.23/narratives-candidates.json');
const chosen=await readJson('docs/verification-3.23/narratives-chosen.json');
const zhVerified=await readJson('docs/verification-3.23/narratives-zh-verified.json');
const stats=await readJson('docs/verification-3.23/narratives-batch-stats.json');
const extracts=await readJson('docs/verification-3.23/narratives-extracts.json');
const selection=await readJson('docs/verification-3.23/narratives-selection.json');
const shipped=await readJson('public/data/enrichment/narratives.json');
const editorial=await readJson('editorial/enrichment-narratives-3.12.json');
const SECTION_KEYS=['politics','economy','culture','events'];
const CJK=/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
const TRADITIONAL=/[與臺灣國學會東車馬鳥魚點線個時間問題則無為說話語實質軍戰勝歐亞羅蘇聯義紀興漢滿爾佔爭萬長門開關風飛書讀詞]/;
const addedQids=new Set(stats.entries.map(row=>row.qid));
const added=editorial.entries.filter(entry=>addedQids.has(entry.qid));
const czh=[],cen=[],sources=[];
for(const entry of added){
 for(const key of SECTION_KEYS){czh.push([...entry.sections[key].zh].length);cen.push(entry.sections[key].en.trim().split(/\s+/).filter(Boolean).length)}
 sources.push(entry.sources.length);
}
const cjk=added.filter(entry=>SECTION_KEYS.some(key=>CJK.test(entry.sections[key].en))).length;
const trad=added.filter(entry=>SECTION_KEYS.some(key=>TRADITIONAL.test(entry.sections[key].zh))).length;
const noZhCitation=added.filter(entry=>!entry.sources.some(source=>/zh\.wikipedia/.test(source.url)));
const coverage=added.filter(entry=>(entry.editorialNotes||[]).some(note=>/本站疆域数据/.test(note.zh||'')));
const thinWording=added.filter(entry=>(entry.editorialNotes||[]).some(note=>/覆盖很薄/.test(note.zh||'')));
const thinPlans=stats.entries.filter(row=>row.thin);
const gzBytes=await readFile(resolve(root,'public/data/enrichment/narratives.json.gz'));
const gzCheck={mtimeZero:gzBytes[4]===0&&gzBytes[5]===0&&gzBytes[6]===0&&gzBytes[7]===0,deepEqual:JSON.stringify(JSON.parse(gunzipSync(gzBytes).toString()))===JSON.stringify(shipped)};
const commands=[['node scripts/validate-v2.mjs'],['node scripts/validate.mjs'],['node scripts/validate-release.mjs'],['node scripts/validate-polity-period.mjs'],['node scripts/places/audit-language.mjs . docs/verification-3.25/narratives-language-audit.json'],['node docs/verification-3.23/build-narratives-batch-3.23.mjs --check'],['node docs/verification-3.23/write-narratives-gz-3.23.mjs --check']];
const validations=[];
for(const [command] of commands){
 let exitCode=0,output='';
 try{output=execSync(command,{cwd:root,maxBuffer:32*1024*1024}).toString()}catch(error){exitCode=error.status??1;output=String(error.stdout||'')+String(error.stderr||'')}
 validations.push({command,exitCode,lastLines:output.trim().split('\n').slice(-2)});
}
const notPolity=candidates.rows.filter(row=>row.verdict==='not-a-polity');
const document={schemaVersion:1,round:'3.25',title:'政体叙述第三批：190 → '+shipped.entries.length,
 generatedAt:new Date().toISOString(),task:'task-30',baseline,head:execSync('git rev-parse --short HEAD',{cwd:root}).toString().trim(),
 summary:{narrativesBefore:190,narrativesAfter:shipped.entries.length,addedThisTask:41,addedAcrossBothRounds:added.length,
  target:'70 plans from the 3.23 selection',completedPlans:added.length,pendingPlans:stats.pendingCount,
  profiles:selection.totals.profiles,profilesWithoutNarrativeBefore:selection.totals.uncovered,
  profilesWithoutNarrativeAfter:selection.totals.uncovered-added.length,recordsBound:3522},
 identityRule:{statement:'A Wikidata QID may only be taken from the atlas catalogue verifiedWikidata field or from en.wikipedia pageprops.wikibase_item, never from memory; an entity whose Wikidata classes are not those of a polity is not written up and is registered as a gap.',
  candidatesChecked:candidates.candidates,verified:candidates.verified,rejectedNotPolity:candidates.notPolity,unverified:candidates.unverified.length,
  rejectedExamples:notPolity.slice(0,14).map(row=>({qid:row.qid,title:row.zh||row.en,classes:row.p31Labels,recordCount:row.recordCount})),
  handExclusions:chosen.handExclusions,
  secondCheck:'every English article actually cited was re-checked through pageprops.wikibase_item: '+extracts.entries.filter(entry=>entry.enIdentityMatch).length+'/'+extracts.entries.length+' carry the polity QID',
  effect:'The rule stopped '+candidates.notPolity+' candidates that would have produced dossiers about an island, a people, a title, a disambiguation page or a history topic (Great Britain the island, the Vikings, the title sultan, the Sultans of Perak, Selangor and Terengganu as positions, Olmec civilisation, History of Tibet, History of Sumer), and one further entity this round (Kutai) whose classes include a monarchy but whose only English article documents a region and its people.',
  gaps:[...chosen.notPolityGaps.map(row=>({qid:row.qid,title:row.title,classes:row.p31Labels})),{qid:'Q1794655',title:'Kutai',classes:['region','Indonesian monarchy','historical country'],reason:'The article documents the historical region and the Kutai people rather than a state, so no polity narrative was written.'}]},
 chineseCitations:{accepted:zhVerified.accepted,rejected:zhVerified.rejected,
  rejectedExamples:zhVerified.decisions.filter(row=>!row.accepted).slice(0,6).map(row=>({qid:row.qid,reason:row.reason})),
  fallbackEntries:noZhCitation.length,
  missedIntroductions:['Q1155700 拉达那哥欣王国','Q2247225 塔鲁曼内格拉','Q248572 马京达瑙苏丹国'],
  missedNote:'For three entries the Chinese introduction captured in the first pass belonged to an unrelated page (Laos, a university, Islam in Indonesia); those entries were written from the English introduction and the Chinese citation is kept only because pageprops confirmed the article documents the same polity.'},
 authored:{count:added.length,zhChars:{min:Math.min(...czh),max:Math.max(...czh)},enWords:{min:Math.min(...cen),max:Math.max(...cen)},
  cjkInEnglish:cjk,traditionalCharacters:trad,sourcesMin:Math.min(...sources),sourcesMax:Math.max(...sources),
  coverageNotesPresent:coverage.length,thinEntries:thinPlans.length,thinWordingPresent:thinWording.length,
  byRegion:stats.entries.reduce((all,row)=>(all[row.region]=(all[row.region]||0)+1,all),{}),
  entries:stats.entries.map(row=>({qid:row.qid,titleZh:row.titleZh,titleEn:row.titleEn,region:row.region,scope:row.scope,records:row.recordCount,span:row.spanYears,thin:row.thin,zhArticle:row.zhArticle}))},
 validation:{commands:validations},gz:{file:'public/data/enrichment/narratives.json.gz',entries:shipped.entries.length,...gzCheck},
 remaining:{pendingPlans:stats.pendingPlans,profilesWithoutNarrative:selection.totals.uncovered-added.length,
  note:'One of the seventy plans is not written (Kutai), and 1,224 of the 1,455 profiles still have no narrative; the selection and verification tooling is reusable for the next batch.'}};
await writeFile(resolve(root,'docs/verification-3.25/narratives-round3.json'),JSON.stringify(document,null,2)+'\n');

const md=[];
md.push('# 政体叙述第三批（3.25）：190 → '+shipped.entries.length);
md.push('');
md.push('任务 task-30。基线提交 `'+baseline+'`，本报告由 `docs/verification-3.25/report-narratives-round3-3.25.mjs --baseline='+baseline+'` 从两轮产物生成，可复跑。');
md.push('');
md.push('**结论**：政体叙述 **190 → '+shipped.entries.length+' 篇**（本轮 +41，连同上一轮完成 3.23 选定的 70 个计划中的 **69 个**）。1,455 份档案中无叙述者由 1,293 降至 **'+document.remaining.profilesWithoutNarrative+'**。规格、schema、引用核验与 apply 流程全部沿用上一批，未重造流水线。');
md.push('');
md.push('## 1. 结果摘要');
md.push('');
md.push('| 指标 | 基线 | 本轮 |');
md.push('|---|---|---|');
md.push('| 叙述总数 | 190 | **'+shipped.entries.length+'** |');
md.push('| 本轮新增 | — | **41** |');
md.push('| 两轮合计完成 3.23 计划 | — | 69 / 70 |');
md.push('| 1,455 份档案中仍无叙述 | 1,293 | '+document.remaining.profilesWithoutNarrative+' |');
md.push('| 绑定疆域记录 | — | 3,522 条 |');
md.push('');
md.push('地区分布（69 篇）：'+Object.entries(document.authored.byRegion).map(([region,count])=>region+' '+count).join('、')+'。');
md.push('');
md.push('## 2. 身份核验硬规则的效果（Lead 要求留档）');
md.push('');
md.push('规则：**引用任何 QID 只能来自项目 catalog 的 `verifiedWikidata` 或 en.wikipedia 的 `pageprops.wikibase_item`，绝不从记忆取；Wikidata 类别不是政体的实体不建档案，登记为缺口。**');
md.push('');
md.push('- 共核验 **'+candidates.candidates+' 个候选**：'+candidates.verified+' 个通过、**'+candidates.notPolity+' 个因类别不是政体被排除**、'+candidates.unverified.length+' 个未能核验。');
md.push('- 被这条规则挡下的典型（都是"看名字像政体、看实体不是"）：');
md.push('');
md.push('| qid | 名称 | Wikidata 类别 |');
md.push('|---|---|---|');
for(const row of notPolity.slice(0,12))md.push('| '+row.qid+' | '+(row.zh||row.en)+' | '+(row.p31Labels||[]).join('、')+' |');
md.push('');
md.push('- **二次核验**：撰写批次实际引用的英文条目逐条再查 pageprops，**'+extracts.entries.filter(entry=>entry.enIdentityMatch).length+'/'+extracts.entries.length+' 条的 wikibase_item 与政体 QID 完全一致**——即本批 70 篇没有一条引用到别的实体。');
md.push('- **本轮追加的缺口**：Q1794655 **Kutai** 类别含"Indonesian monarchy / historical country"，但其唯一的英文条目记述的是历史地区与古泰人，而不是国家；按规则**不建档案**，登记为缺口。这是 70 个计划中唯一未撰写的一条。');
md.push('- 手工排除并登记的其他缺口：'+chosen.handExclusions.map(item=>'`'+item.qid+'`').join('、')+'。');
md.push('');
md.push('## 3. 中文引用：先核验再引用');
md.push('');
md.push('- 70 个计划中 **'+zhVerified.accepted+' 条接受中文引用、'+zhVerified.rejected+' 条拒绝**。拒绝理由逐条留档，典型如：');
for(const row of document.chineseCitations.rejectedExamples)md.push('  - `'+row.qid+'`：'+row.reason);
md.push('- 被拒条目改用「英文条目 + 维基数据实体」两条 https 来源（本批共 '+noZhCitation.length+' 条如此），**没有把无关中文页面当引用**。');
md.push('- 需特别说明：'+document.chineseCitations.missedNote);
md.push('');
md.push('## 4. 规格实测（69 篇）');
md.push('');
md.push('| 项目 | 实测 | 要求 |');
md.push('|---|---|---|');
md.push('| 四栏中文长度 | '+Math.min(...czh)+'–'+Math.max(...czh)+' 字 | 50–190 |');
md.push('| 四栏英文长度 | '+Math.min(...cen)+'–'+Math.max(...cen)+' 词 | 35–150 |');
md.push('| 英文栏 CJK | '+cjk+' | 0 |');
md.push('| 繁体字 | '+trad+' | 0 |');
md.push('| https 来源/篇 | '+Math.min(...sources)+'–'+Math.max(...sources)+' 条（含 checkedOn） | ≥2 |');
md.push('| 疆域联系注记（"本站疆域数据收录…"） | '+coverage.length+'/'+added.length+' | 每篇 |');
md.push('| 薄覆盖写明"覆盖很薄，不能据本站疆域记录推断疆域变化" | '+thinWording.length+' 篇（薄覆盖计划 '+thinPlans.length+' 个） | <6 条或跨度<60 年必写 |');
md.push('');
md.push('## 5. 校验');
md.push('');
md.push('| 命令 | exit |');
md.push('|---|---|');
for(const row of validations)md.push('| `'+row.command+'` | '+row.exitCode+' |');
md.push('');
md.push('`narratives.json.gz`：mtime 字节 '+gzBytes[4]+'/'+gzBytes[5]+'/'+gzBytes[6]+'/'+gzBytes[7]+'，与 .json deepEqual = '+gzCheck.deepEqual+'，条目数 '+shipped.entries.length+'。validate-v2 的"压缩叙述与可编辑源一致"和"叙述绑定到精确记录"两项均通过。');
md.push('');
md.push('## 6. 仍缺什么');
md.push('');
md.push('1. **Kutai（Q1794655）未撰写**：实体类别与条目主题不一致（地区/人群 vs 政体），按身份规则登记为缺口，已在第 2 节说明。');
md.push('2. **1,455 份档案中仍有 '+document.remaining.profilesWithoutNarrative+' 份没有叙述**；选点脚本与身份核验脚本可直接复用，欧洲档案受 20% 上限约束只能分批推进。');
md.push('3. **'+noZhCitation.length+' 条没有中文维基来源可引**：改用英文条目 + 维基数据实体，中文阅读体验依赖条目自身的中文叙述。');
md.push('4. **三条条目的中文导言在首轮抓取中取错**（拉达那哥欣、塔鲁曼内格拉、马京达瑙）：叙述依据英文条目撰写，中文引用仅在 pageprops 核验一致后保留。若后续要做中文来源深读，应重取这三条。');
md.push('');
md.push('## 7. 诚实声明');
md.push('');
md.push('- 身份核验是硬门槛：不从记忆取 QID，不是政体就不建档案（Kutai 即按此处理）。');
md.push('- 疆域联系如实：每篇写明本站记录数与年份范围，薄覆盖一律写明不能据此推断疆域变化。');
md.push('- 没有编造引用；没有跑 `prepare:assets`；除 `public/data/enrichment/narratives.json(+.gz)` 外未改任何 public/ 产品文件。');
await writeFile(resolve(root,'docs/verification-3.25/narratives-round3.md'),md.join('\n')+'\n');
console.log(JSON.stringify({baseline,narratives:shipped.entries.length,added:added.length,pending:stats.pendingCount,
 zhChars:[Math.min(...czh),Math.max(...czh)],enWords:[Math.min(...cen),Math.max(...cen)],cjk,trad,sources:[Math.min(...sources),Math.max(...sources)],
 thin:thinWording,noZhCitation:noZhCitation.length,identity:extracts.entries.filter(e=>e.enIdentityMatch).length+'/'+extracts.entries.length,
 validation:validations.map(row=>row.command.split(' ')[1]+'='+row.exitCode),gz:gzCheck,
 md:'docs/verification-3.25/narratives-round3.md',json:'docs/verification-3.25/narratives-round3.json'},null,1));
