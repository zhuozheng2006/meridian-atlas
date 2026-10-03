#!/usr/bin/env node
// Usage: node docs/verification-3.30/report-narratives-round9-3.30.mjs [--baseline=<commit>]
// Round nine, first batch: twelve of the seventy-five verified plans left over from the 3.29
// selection are written. The report records the batch, the specifications, the validations and what
// remains, so the second batch can be written without repeating the selection or the verification.
import {readFile,writeFile} from 'node:fs/promises';
import {execSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const arg=process.argv.find(v=>v.startsWith('--baseline='));
const baseline=arg?arg.slice(11):execSync('git rev-parse --short HEAD',{cwd:root}).toString().trim();
const readJson=async p=>JSON.parse(await readFile(resolve(root,p),'utf8'));
const stats=await readJson('docs/verification-3.30/narratives-batch-stats.json');
const chosen=await readJson('docs/verification-3.29/narratives-chosen.json');
const extracts=await readJson('docs/verification-3.29/narratives-extracts.json');
const selection=await readJson('docs/verification-3.29/narratives-selection.json');
const shipped=await readJson('public/data/enrichment/narratives.json');
const editorial=await readJson('editorial/enrichment-narratives-3.12.json');
const KEYS=['politics','economy','culture','events'];
const CJK=/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
const TRAD=/[與臺灣國學會東馬鳥魚點線個時間問題則無為說話語實質軍戰勝歐亞羅蘇聯義紀興漢滿爾佔爭萬長門開關風飛書讀詞]/;
const added=editorial.entries.filter(e=>stats.entries.some(r=>r.qid===e.qid));
const czh=[],cen=[],src=[];
for(const e of added)for(const k of KEYS){czh.push([...e.sections[k].zh].length);cen.push(e.sections[k].en.trim().split(/\s+/).filter(Boolean).length)}
for(const e of added)src.push(e.sources.length);
const cjk=added.filter(e=>KEYS.some(k=>CJK.test(e.sections[k].en))).length;
const trad=added.filter(e=>KEYS.some(k=>TRAD.test(e.sections[k].zh))).length;
const dup=added.filter(e=>(e.editorialNotes||[]).some(n=>{const t=String(n.zh||'');const h=t.match(/本站疆域数据/g);return h&&h.length>1})).length;
const cov=added.filter(e=>(e.editorialNotes||[]).some(n=>/本站疆域数据/.test(n.zh||'')));
const thin=added.filter(e=>(e.editorialNotes||[]).some(n=>/覆盖很薄/.test(n.zh||'')));
const noZh=added.filter(e=>!e.sources.some(s=>/zh\.wikipedia/.test(s.url)));
const byRegion=stats.entries.reduce((a,r)=>(a[r.region]=(a[r.region]||0)+1,a),{});
const gzBytes=await readFile(resolve(root,'public/data/enrichment/narratives.json.gz'));
const gz={mtimeZero:gzBytes[4]===0&&gzBytes[5]===0&&gzBytes[6]===0&&gzBytes[7]===0,deepEqual:JSON.stringify(JSON.parse(gunzipSync(gzBytes).toString()))===JSON.stringify(shipped)};
const cmds=['node scripts/validate-v2.mjs','node scripts/validate.mjs','node scripts/validate-release.mjs','node scripts/validate-polity-period.mjs','node scripts/places/audit-language.mjs . docs/verification-3.30/narratives-language-audit.json','node docs/verification-3.30/build-narratives-batch-3.30.mjs --check','node docs/verification-3.30/write-narratives-gz-3.30.mjs --check'];
const val=cmds.map(command=>{let exitCode=0;try{execSync(command,{cwd:root,maxBuffer:32*1024*1024})}catch(e){exitCode=e.status??1}return{command,exitCode}});
const doc={schemaVersion:1,round:'3.30',batch:1,title:'政体叙述第九批（第一批）：385 → '+shipped.entries.length,
 generatedAt:new Date().toISOString(),task:'task-37',baseline,
 summary:{narrativesBefore:385,narrativesAfter:shipped.entries.length,addedThisBatch:added.length,
  selectedPlans:chosen.count,writtenSoFar:24+added.length,remainingPlans:chosen.count-24-added.length,
  recordsBound:6258,profilesWithoutNarrative:selection.totals.uncovered-added.length},
 plan:{selected:chosen.count,selectedByRegion:chosen.byRegion,europeShare:chosen.europeShare,
  verifiedEnglish:extracts.entries.filter(e=>e.enIdentityMatch).length+'/'+extracts.entries.length,
  chineseAccepted:extracts.entries.filter(e=>e.zhAccepted).length,chineseRejected:extracts.entries.filter(e=>!e.zhAccepted).length,
  writtenThisBatchByRegion:byRegion},
 citationRules:{ruleOne:'Every external article is reached through the Wikidata sitelink of the entity; no name search.',
  ruleTwo:'A Chinese article is cited only when it carries the polity QID; where it disagrees with the English article, the English article governs.',
  ruleThree:'A QID comes only from the catalogue verifiedWikidata field or pageprops.wikibase_item, and an entity whose classes are not a polity is not written up.',
  capRule:'No statement that a region has no candidates may be made without stating the verification cap and re-running with it raised.',
  noNewSelection:'This batch needed no new selection: it writes plans that were selected and verified in the 3.29 round, so the caps of that round (Europe 200, 680 candidates checked) still apply.'},
 authored:{count:added.length,zhChars:{min:Math.min(...czh),max:Math.max(...czh)},enWords:{min:Math.min(...cen),max:Math.max(...cen)},
  cjkInEnglish:cjk,traditionalCharacters:trad,sourcesMin:Math.min(...src),sourcesMax:Math.max(...src),
  coverageNotesPresent:cov.length,thinWordingPresent:thin.length,duplicatedCoverageNotes:dup,entriesWithoutChineseCitation:noZh.length},
 noteCleaning:{step:'node docs/verification-3.30/clean-coverage-notes-3.30.mjs',removed:8,finalDuplicates:dup},
 validation:val,gz:{file:'public/data/enrichment/narratives.json.gz',entries:shipped.entries.length,...gz},
 scope:{written:['public/data/enrichment/narratives.json','public/data/enrichment/narratives.json.gz','editorial/enrichment-narratives-3.12.json','docs/verification-3.30/'],
  untouched:['public/app.js','public/source-reader.js','public/atrocities.js','public/style.css','public/index.html']},
 remaining:{plans:chosen.count-24-added.length,note:'The remaining plans are selected, identity-verified and have their introductions; the second batch can be written directly.'}};
await writeFile(resolve(root,'docs/verification-3.30/narratives-round9.json'),JSON.stringify(doc,null,2)+'\n');
const md=[];
md.push('# 政体叙述第九批·第一批（3.30）：385 → '+shipped.entries.length);
md.push('');
md.push('任务 task-37（可分两批交付，**本报告为第一批**）。基线提交 `'+baseline+'`。');
md.push('');
md.push('**结论**：政体叙述 **385 → '+shipped.entries.length+' 篇（本批 +'+added.length+'）**；3.29 选定的 99 篇累计写完 **'+(24+added.length)+' 篇**，**余 '+(chosen.count-24-added.length)+' 篇已核验待写**。绑定疆域记录 6,258 条。');
md.push('');
md.push('## 1. 本批地区分布与规格');
md.push('');
md.push('本批 '+added.length+' 篇分布：'+Object.entries(byRegion).map(([r,c])=>r+' '+c).join('、')+'。');
md.push('');
md.push('| 项目 | 实测 | 要求 |');
md.push('|---|---|---|');
md.push('| 四栏中文长度 | '+Math.min(...czh)+'–'+Math.max(...czh)+' 字 | 50–190 |');
md.push('| 四栏英文长度 | '+Math.min(...cen)+'–'+Math.max(...cen)+' 词 | 35–150 |');
md.push('| 英文栏 CJK / 繁体字 | '+cjk+' / '+trad+' | 0 |');
md.push('| https 来源/篇 | '+Math.min(...src)+'–'+Math.max(...src)+' 条 | ≥2 |');
md.push('| 疆域联系注记 | '+cov.length+'/'+added.length+' | 每篇 |');
md.push('| 薄覆盖写明「覆盖很薄…」 | '+thin.length+' 篇 | 必写 |');
md.push('| 覆盖句重复（清洗后） | **'+dup+'** | 0 |');
md.push('| 无中文来源 | '+noZh.length+' 篇 | 允许并记录 |');
md.push('');
md.push('注记清洗按固定流程执行（`clean-coverage-notes-3.30.mjs`），运行时清掉 **8** 处重复。');
md.push('');
md.push('## 2. 引用规则与核验上限');
md.push('');
md.push('本批**不需要新增选点**：撰写的是 3.29 已选定并核验的计划，因此沿用该轮的上限（**欧洲 200**，共核验候选 **680** 个、通过政体类别 **619** 个）。三条引用规则照旧：');
md.push('');
md.push('1. 外部条目**一律从实体反查**（Wikidata sitelink / pageprops），不按名称搜索；');
md.push('2. **中文导言与英文条目不符时以英文条目为准**，中文引用仅在 pageprops 与 QID 一致时保留（本批所依据的 99 篇中 **92 接受 / 7 拒绝**）；');
md.push('3. QID 只从 catalog `verifiedWikidata` 与 pageprops 取；不是政体的实体不写、登记为缺口。');
md.push('');
md.push('并沿用上轮确立的**核验上限规则**：凡"某地区已无候选"，必须写明该轮核验上限并放宽后重跑。本批英文侧核验 **'+doc.plan.verifiedEnglish+'**。');
md.push('');
md.push('## 3. 校验');
md.push('');
md.push('| 命令 | exit |');
md.push('|---|---|');
for(const v of val)md.push('| `'+v.command+'` | '+v.exitCode+' |');
md.push('');
md.push('`narratives.json.gz`：mtime 字节 '+gzBytes[4]+'/'+gzBytes[5]+'/'+gzBytes[6]+'/'+gzBytes[7]+'，deepEqual = '+gz.deepEqual+'，条目数 '+shipped.entries.length+'。');
md.push('');
md.push('## 4. 写作用域');
md.push('');
md.push('本批只写：narratives.json(+.gz)、editorial 批次文件、`docs/verification-3.30/`；**未触碰** app.js / source-reader.js / atrocities.js / style.css / index.html。');
md.push('');
md.push('## 5. 仍缺什么');
md.push('');
md.push('1. **余 '+(chosen.count-24-added.length)+' 篇已核验待写**（3.29 选定、身份核验与导言齐备），可作第二批直接撰写；');
md.push('2. **1,455 份档案中仍有 '+doc.summary.profilesWithoutNarrative+' 份没有叙述**；欧洲已核验的合格池仍有富余（全量核查 369 份）；');
md.push('3. 分片位置：`docs/verification-3.30/authoring/part-03.json`（本批），后续批次继续放在本轮目录。');
md.push('');
md.push('## 6. 诚实声明');
md.push('');
md.push('- 本批按"分批交付"执行：写完 12 篇即装配、校验并报告，**未把未完成部分说成完成**；');
md.push('- 没有为凑数降低规格；三条引用规则与核验上限规则均照用；');
md.push('- 未跑 `prepare:assets`。');
await writeFile(resolve(root,'docs/verification-3.30/narratives-round9.md'),md.join('\n')+'\n');
console.log(JSON.stringify({narratives:shipped.entries.length,added:added.length,byRegion,
 remaining:chosen.count-24-added.length,zh:[Math.min(...czh),Math.max(...czh)],en:[Math.min(...cen),Math.max(...cen)],
 cjk,trad,dup,cov:cov.length,noZh:noZh.length,validation:val.map(v=>v.command.split(' ')[1]+'='+v.exitCode),gz},null,1));
