// Run the whole P1/P2 verification baseline sequentially (one browser at a time, so
// timings are comparable) and write docs/verification-3.10/verify-summary.json.
//
//   node scripts/verification/run-all.mjs            # everything
//   node scripts/verification/run-all.mjs --quick    # skips the throttling profiles
//   node scripts/verification/run-all.mjs --only perf-baseline.mjs
import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import * as C from './lib/common.mjs';

const args = C.parseArgs();
const ALL = ['perf-baseline.mjs', 'keyboard-focus.mjs', 'mobile-check.mjs', 'offline-weaknet.mjs'];
const scripts = args.only ? String(args.only).split(',').map(s => s.endsWith('.mjs') ? s : s + '.mjs') : ALL;
const reports = {
  'perf-baseline.mjs': 'docs/verification-3.10/perf-baseline.json',
  'keyboard-focus.mjs': 'docs/verification-3.10/keyboard-focus.json',
  'mobile-check.mjs': 'docs/verification-3.10/mobile-check.json',
  'offline-weaknet.mjs': 'docs/verification-3.10/network-resilience.json'
};
const results = [];
for (const script of scripts) {
  const extra = args.quick && script === 'offline-weaknet.mjs' ? ['--quick'] : [];
  C.log('running', script, extra.join(' '));
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(C.HERE, script), ...extra], { cwd: C.ROOT, stdio: 'inherit' });
  const entry = { script, exitCode: r.status, wallMs: Date.now() - t0, reportPath: reports[script] || null, checks: null };
  const file = reports[script] ? path.join(C.ROOT, reports[script]) : null;
  if (file && fs.existsSync(file)) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      const checks = data.checks || [];
      entry.checks = { total: checks.length, passed: checks.filter(c => c.pass === true).length, failed: checks.filter(c => c.pass === false).length, notMeasured: checks.filter(c => c.pass !== true && c.pass !== false).length };
      entry.fatal = data.fatal || null;
      entry.generatedAt = data.generatedAt;
      entry.provenance = data.meta && data.meta.provenance ? { gitHead: data.meta.provenance.gitHead, assetVersion: data.meta.provenance.assetVersion } : null;
    } catch (e) { entry.checks = { error: String(e.message || e) }; }
  }
  results.push(entry);
  C.log(script, 'exit', r.status, entry.checks ? JSON.stringify(entry.checks) : '');
}
const summary = {
  generatedAt: C.nowIso(),
  command: 'node scripts/verification/run-all.mjs' + (process.argv.slice(2).length ? ' ' + process.argv.slice(2).join(' ') : ''),
  meta: { provenance: C.provenance(), systemAtEnd: C.systemLoad() },
  results,
  failedScripts: results.filter(r => r.exitCode !== 0).map(r => r.script),
  conclusion: results.every(r => r.exitCode === 0)
    ? 'All verification scripts completed with every measured assertion passing.'
    : 'At least one script reported a failing assertion or a script error; read the per-report checks before drawing conclusions.'
};
const file = C.writeJSON('docs/verification-3.10/verify-summary.json', summary);
C.log('wrote', file);
process.exitCode = summary.failedScripts.length ? 2 : 0;
