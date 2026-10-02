// Build docs/verification-3.10/verify-baseline.md from the JSON reports.
// Reproduce: node scripts/verification/build-report-md.mjs
// The markdown is generated, never hand-edited: every number comes from a report file.
import fs from 'node:fs';
import path from 'node:path';
import * as C from './lib/common.mjs';

const args = C.parseArgs();
const OUT = String(args.out || 'docs/verification-3.10/verify-baseline.md');
const FENCE = String.fromCharCode(96).repeat(3);
const TICK = String.fromCharCode(96);
const REPORTS = [
  ['perf-baseline.json', '性能基线（首屏、年份步进、拖动、图层重试、双图对照）'],
  ['keyboard-focus.json', '键盘与焦点（方向键 / Alt 平移 / 输入框 / 阅读器 / Tab / 输入法）'],
  ['mobile-check.json', '手机两档（390×844、360×740：溢出、画布、图层面板、阅读器、触摸、safe-area）'],
  ['network-resilience.json', '弱网 / 404 / 断网与恢复'],
  ['verify-boundary-review.json', '独立复核：边界呈现、OHM 1500 与可发布性证据']
];
const short = (v, n = 200) => { const s = typeof v === 'string' ? v : JSON.stringify(v); return (s || '').length > n ? s.slice(0, n) + '…' : (s || ''); };
const cell = s => String(s == null ? '' : s).replace(/[|]/g, '\\|').replace(/\n/g, ' ');
const loaded = [];
for (const [file, title] of REPORTS) {
  const p = path.join(C.DOCS, file);
  if (!fs.existsSync(p)) { C.log('missing report', file); continue; }
  try { loaded.push({ file, title, data: JSON.parse(fs.readFileSync(p, 'utf8')) }); } catch (e) { loaded.push({ file, title, error: String(e.message || e) }); }
}
const L = [];
const prov = (loaded[0] && loaded[0].data.meta && loaded[0].data.meta.provenance) || {};
L.push('# 3.10 验证基线 · 独立实测报告');
L.push('');
L.push('生成时间：' + new Date().toISOString() + '。本文件由 ' + TICK + 'node scripts/verification/build-report-md.mjs' + TICK + ' 从各 JSON 报告生成，请勿手工编辑。');
L.push('');
L.push('- git HEAD：' + (prov.gitHead || '?') + (prov.dirtyPaths ? '（工作区另有 ' + prov.dirtyPaths.length + ' 个未提交路径）' : ''));
L.push('- 资源版本号：' + (prov.assetVersion || '?') + '；Node ' + (prov.node || '?') + '；平台 ' + (prov.platform || '?'));
L.push('- 驱动说明：' + (prov.driverNote || '?'));
L.push('- 关键文件 sha256（前 16 位）：' + Object.entries(prov.files || {}).map(([k, v]) => k.replace('public/', '') + '=' + v).join('、'));
L.push('');
L.push('## 0. 复现命令');
L.push('');
L.push(FENCE + 'bash');
L.push('# 前置：本地服务已在 http://127.0.0.1:8767 指向本工作目录（python3 serve.py --port 8767）');
L.push('node scripts/verification/perf-baseline.mjs        # → docs/verification-3.10/perf-baseline.json');
L.push('node scripts/verification/keyboard-focus.mjs       # → docs/verification-3.10/keyboard-focus.json');
L.push('node scripts/verification/mobile-check.mjs         # → docs/verification-3.10/mobile-check.json + shots/');
L.push('node scripts/verification/offline-weaknet.mjs      # → docs/verification-3.10/network-resilience.json');
L.push('node scripts/verification/independent-review.mjs   # → docs/verification-3.10/verify-boundary-review.json');
L.push('node scripts/verification/build-report-md.mjs      # → 本文件');
L.push('# 串行跑全部（一次只开一个浏览器）：node scripts/verification/run-all.mjs');
L.push('# 只汇总已有报告：node scripts/verification/run-all.mjs --summary-only');
L.push(FENCE);
L.push('');
L.push('所有报告遵循同一约定：' + TICK + 'checks[]' + TICK + ' 每条含 expected/observed/pass；' + TICK + 'pass: null' + TICK + ' 表示未测到（绝不当作通过）；' + TICK + 'limitations[]' + TICK + ' 记录本环境测不到的内容。');
L.push('');
L.push('## 1. 总览');
L.push('');
L.push('| 报告 | 断言通过 | 失败 | 未测 | 报告文件 |');
L.push('|---|---:|---:|---:|---|');
for (const r of loaded) {
  const checks = (r.data && r.data.checks) || [];
  const pass = checks.filter(c => c.pass === true).length;
  const fail = checks.filter(c => c.pass === false).length;
  const none = checks.length - pass - fail;
  L.push('| ' + cell(r.title) + ' | ' + pass + ' | ' + fail + ' | ' + none + ' | docs/verification-3.10/' + r.file + ' |');
}
L.push('');
const allFail = loaded.flatMap(r => (((r.data || {}).checks) || []).filter(c => c.pass === false).map(c => c.id));
L.push('失败断言：' + (allFail.length ? allFail.map(id => TICK + id + TICK).join('、') : '无') + '。');
L.push('');
let n = 2;
for (const r of loaded) {
  const d = r.data || {};
  L.push('## ' + (n++) + '. ' + r.title);
  L.push('');
  L.push('报告：docs/verification-3.10/' + r.file + '；生成于 ' + (d.generatedAt || '?') + '；命令 ' + TICK + (d.command || '?') + TICK + '。');
  if (d.fatal) { L.push(''); L.push('> **本次运行提前中止**：' + short(d.fatal, 400)); }
  if (d.conclusions && d.conclusions.length) { L.push(''); L.push('实测结论：'); for (const c of d.conclusions) L.push('- ' + c); }
  const checks = d.checks || [];
  if (checks.length) {
    L.push('');
    L.push('| 断言 | 结果 | 实测 |');
    L.push('|---|---|---|');
    for (const c of checks) L.push('| ' + TICK + c.id + TICK + ' | ' + (c.pass === true ? '通过' : c.pass === false ? '**失败**' : '未测到') + ' | ' + cell(short(c.observed, 230)) + ' |');
  }
  if (d.findings && d.findings.length) { L.push(''); L.push('发现：'); for (const f of d.findings) L.push('- ' + f); }
  if (d.notes && d.notes.length) { L.push(''); L.push('说明：'); for (const x of d.notes) L.push('- ' + x); }
  if (d.limitations && d.limitations.length) { L.push(''); L.push('本环境测不到 / 不适用：'); for (const x of d.limitations) L.push('- ' + x); }
  L.push('');
}
if (fs.existsSync(C.SHOTS)) {
  L.push('## 截图证据');
  L.push('');
  const files = fs.readdirSync(C.SHOTS).sort().filter(f => /^(perf|mobile|keyboard|network|review)-.*[.](png|jpg)$/.test(f));
  L.push('目录 docs/verification-3.10/shots/（本次脚本产生的 ' + files.length + ' 个）：');
  L.push('');
  for (const f of files) L.push('- [' + f + '](shots/' + f + ')');
  L.push('');
}
L.push('## 需要 Lead 决策的问题');
L.push('');
for (const r of loaded) { for (const f of ((r.data || {}).findings || [])) L.push('- （' + r.file + '）' + f); }
for (const r of loaded) { for (const c of (((r.data || {}).checks) || []).filter(c => c.pass === false)) L.push('- （' + r.file + '）失败断言 ' + TICK + c.id + TICK + '：' + short(c.observed, 300)); }
L.push('');
const file = path.isAbsolute(OUT) ? OUT : path.join(C.ROOT, OUT);
C.ensureDirs(path.dirname(file));
fs.writeFileSync(file, L.join('\n') + '\n');
C.log('wrote', file, L.length, 'lines');
