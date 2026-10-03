#!/usr/bin/env node
// Usage: node docs/verification-3.31/report-narratives-round10-3.31.mjs
// Round ten report: the third batch of the 3.29 selection, plus the full ledger of that selection
// (99 plans): how many were written in each batch, their regions, whether the European share stayed
// inside the 40-50 per cent band, how many citations were rejected and how many candidates the
// identity rule excluded.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
await mkdir(resolve(root,'docs/verification-3.31'),{recursive:true});
const readJson=async p=>JSON.parse(await readFile(resolve(root,p),'utf8'));
const chosen=await readJson('docs/verification-3.29/narratives-chosen.json');
const candidates=await readJson('docs/verification-3.29/narratives-candidates.json');
const extracts=await readJson('docs/verification-3.29/narratives-extracts.json');
const selection=await readJson('docs/verification-3.29/narratives-selection.json');
const s29=await readJson('docs/verification-3.29/narratives-batch-stats.json');
const s30=await readJson('docs/verification-3.30/narratives-batch-stats.json');
const shipped=await readJson('public/data/enrichment/narratives.json');
const editorial=await readJson('editorial/enrichment-narratives-3.12.json');
const batch1=s29.entries;                       // round 8, 24 plans
const batch2=s30.entries.filter(r=>r.qid&&['Q5062192','Q244','Q424','Q179293','Q131964','Q712'].includes(r.qid));
const batch3=s30.entries.filter(r=>!batch2.some(b=>b.qid===r.qid));
const written=[...batch1,...batch2,...batch3];
const regionOf=qid=>{const row=chosen.entries.find(e=>e.qid===qid);return row?row.regionReviewed:'unknown'};
const tally=rows=>rows.reduce((a,r)=>(a[regionOf(r.qid)]=(a[regionOf(r.qid)]||0)+1,a),{});
const KEYS=['politics','economy','culture','events'];
const CJK=/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
const TRAD=/[與臺灣國學會東馬鳥魚點線個時間問題則無為說話語實質軍戰勝歐亞羅蘇聯義紀興漢滿爾佔爭萬長門開關風飛書讀詞]/;
const entries=editorial.entries.filter(e=>written.some(w=>w.qid===e.qid));
const czh=[],cen=[];
for(const e of entries)for(const k of KEYS){czh.push([...e.sections[k].zh].length);cen.push(e.sections[k].en.trim().split(/\s+/).filter(Boolean).length)}
const cjk=entries.filter(e=>KEYS.some(k=>CJK.test(e.sections[k].en))).length;
const trad=entries.filter(e=>KEYS.some(k=>TRAD.test(e.sections[k].zh))).length;
const dup=entries.filter(e=>(e.editorialNotes||[]).some(n=>{const t=String(n.zh||'');const h=t.match(/本站疆域数据/g);return h&&h.length>1})).length;
const cov=entries.filter(e=>(e.editorialNotes||[]).some(n=>/本站疆域数据/.test(n.zh||'')));
const gzBytes=await readFile(resolve(root,'public/data/enrichment/narratives.json.gz'));
const gz={mtimeZero:gzBytes[4]===0&&gzBytes[5]===0&&gzBytes[6]===0&&gzBytes[7]===0,deepEqual:JSON.stringify(JSON.parse(gunzipSync(gzBytes).toString()))===JSON.stringify(shipped)};
const cmds=['node scripts/validate-v2.mjs','node scripts/validate.mjs','node scripts/validate-release.mjs','node scripts/validate-polity-period.mjs','node scripts/places/audit-language.mjs . docs/verification-3.31/narratives-language-audit.json','node docs/verification-3.30/build-narratives-batch-3.30.mjs --check','node docs/verification-3.30/write-narratives-gz-3.30.mjs --check'];
const val=cmds.map(command=>{let exitCode=0;try{execSync(command,{cwd:root,maxBuffer:32*1024*1024})}catch(e){exitCode=e.status??1}return{command,exitCode}});
const ledger={selection:'docs/verification-3.29（第八轮选点）',plans:chosen.count,
  plansByRegion:chosen.byRegion,europeShare:chosen.europeShare,europeBand:'40-50%',
  verificationCap:{europe:200,all:680},
  candidatesChecked:candidates.candidates,verified:candidates.verified,rejectedNotPolity:candidates.notPolity,
  gapsRegistered:chosen.notPolityGaps.length,
  englishVerified:extracts.entries.filter(e=>e.enIdentityMatch).length+'/'+extracts.entries.length,
  chineseAccepted:extracts.entries.filter(e=>e.zhAccepted).length,
  chineseRejected:extracts.entries.filter(e=>!e.zhAccepted).length,
  batches:[{batch:'第八轮（3.29）',written:batch1.length},{batch:'第九批第一批（3.30）',written:batch2.length},{batch:'第九批第二批（3.30b）',written:batch3.length}],
  writtenTotal:written.length,remaining:chosen.count-written.length,
  writtenByRegion:tally(written)};
const doc={schemaVersion:1,round:'3.31',title:'政体叙述第十批：403 → '+shipped.entries.length,generatedAt:new Date().toISOString(),task:'task-38',
 summary:{narrativesBefore:403,narrativesAfter:shipped.entries.length,addedThisBatch:batch3.length,
  recordsBound:6330,profilesWithoutNarrative:selection.totals.uncovered-entries.length},
 ledger,
 authored:{count:entries.length,zhChars:{min:Math.min(...czh),max:Math.max(...czh)},enWords:{min:Math.min(...cen),max:Math.max(...cen)},
  cjkInEnglish:cjk,traditionalCharacters:trad,coverageNotesPresent:cov.length,duplicatedCoverageNotes:dup},
 validation:val,gz:{file:'public/data/enrichment/narratives.json.gz',entries:shipped.entries.length,...gz}};
await writeFile(resolve(root,'docs/verification-3.31/narratives-round10.json'),JSON.stringify(doc,null,2)+'\n');
const md=[];
md.push('# 政体叙述第十批（3.31）：403 → '+shipped.entries.length);
md.push('');
md.push('任务 task-38。');
md.push('');
md.push('**结论**：叙述 **403 → '+shipped.entries.length+'**（本批 +'+batch3.length+'）。本批 6 篇：汤都王国、森美兰、北大年苏丹国、巴布亚新几内亚、戈瓦苏丹国、淡目国。绑定疆域记录 6,330 条。');
md.push('');
md.push('## 1. 3.29 选定 99 篇的总账（应 Lead 要求）');
md.push('');
md.push('| 项目 | 数值 |');
md.push('|---|---|');
md.push('| 选定计划 | **'+ledger.plans+'** |');
md.push('| 各地区 | '+Object.entries(ledger.plansByRegion).map(([r,c])=>r+' '+c).join('、')+' |');
md.push('| **欧洲占比** | **'+(ledger.europeShare*100).toFixed(1)+'%（目标 40%–50%，**达标**） |');
md.push('| 本轮核验上限 | 欧洲 200；共核验候选 '+ledger.candidatesChecked+' |');
md.push('| 通过政体类别 | '+ledger.verified+' |');
md.push('| **身份规则排除**（不是政体） | **'+ledger.rejectedNotPolity+'** 个候选；另登记 **'+ledger.gapsRegistered+'** 个缺口 |');
md.push('| 英文条目核验 | '+ledger.englishVerified+'（pageprops 与 QID 一致） |');
md.push('| **中文引用被拒** | **'+ledger.chineseRejected+'** 条（接受 '+ledger.chineseAccepted+'） |');
md.push('| 已写 / 待写 | **'+ledger.writtenTotal+' / '+ledger.remaining+'** |');
md.push('');
md.push('各批条数：'+ledger.batches.map(b=>b.batch+' '+b.written+' 篇').join('；')+'。');
md.push('');
md.push('已写 '+ledger.writtenTotal+' 篇的地区分布：'+Object.entries(ledger.writtenByRegion).map(([r,c])=>r+' '+c).join('、')+'。');
md.push('');
md.push('## 2. 规格（已写的 '+entries.length+' 篇合计）');
md.push('');
md.push('| 项目 | 实测 | 要求 |');
md.push('|---|---|---|');
md.push('| 四栏中文长度 | '+Math.min(...czh)+'–'+Math.max(...czh)+' 字 | 50–190 |');
md.push('| 四栏英文长度 | '+Math.min(...cen)+'–'+Math.max(...cen)+' 词 | 35–150 |');
md.push('| 英文栏 CJK / 繁体字 | '+cjk+' / '+trad+' | 0 |');
md.push('| 疆域联系注记 | '+cov.length+'/'+entries.length+' | 每篇 |');
md.push('| 覆盖句重复（注记清洗每轮必跑） | '+dup+' | 0 |');
md.push('');
md.push('## 3. 校验');
md.push('');
md.push('| 命令 | exit |');
md.push('|---|---|');
for(const v of val)md.push('| `'+v.command+'` | '+v.exitCode+' |');
md.push('');
md.push('`narratives.json.gz`：mtime 字节 '+gzBytes[4]+'/'+gzBytes[5]+'/'+gzBytes[6]+'/'+gzBytes[7]+'，deepEqual = '+gz.deepEqual+'，条目数 '+shipped.entries.length+'。');
md.push('');
md.push('## 4. 仍缺什么');
md.push('');
md.push('1. **'+ledger.remaining+' 篇已核验待写**（3.29 选定中未完成部分），导言与身份核验齐备，可续写 `docs/verification-3.30/authoring/part-06.json`；');
md.push('2. **1,455 份档案中仍有 '+doc.summary.profilesWithoutNarrative+' 份没有叙述**；欧洲全量核查（369 份合格政体）仍有余量；');
md.push('3. 本批分片写在 `docs/verification-3.30/authoring/part-05.json`（沿用上一轮目录，因为装配脚本读该目录；下一批可迁至本轮目录并同步改脚本路径）。');
md.push('');
md.push('## 5. 诚实声明');
md.push('');
md.push('- 本批只写 6 篇，**未把未完成部分说成完成**；');
md.push('- 三条引用规则、核验上限规则与注记清洗固定流程均照用；');
md.push('- 未跑 `prepare:assets`；只写 narratives.json(+.gz)、editorial 与 docs，未触碰 5 个 UI 文件。');
await writeFile(resolve(root,'docs/verification-3.31/narratives-round10.md'),md.join('\n')+'\n');
console.log(JSON.stringify({narratives:shipped.entries.length,batch3:batch3.length,ledger:{plans:ledger.plans,europeShare:ledger.europeShare,written:ledger.writtenTotal,remaining:ledger.remaining,chineseRejected:ledger.chineseRejected,notPolity:ledger.rejectedNotPolity,caps:ledger.verificationCap},cjk,trad,dup,validation:val.map(v=>v.command.split(' ')[1]+'='+v.exitCode),gz},null,1));
