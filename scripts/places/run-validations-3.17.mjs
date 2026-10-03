#!/usr/bin/env node
// Usage: node scripts/places/run-validations-3.17.mjs
// Runs every validator the 3.17 round promises in its report and records the exact result, so
// the report quotes machine output rather than a hand-written claim. The validators are run as
// child processes; a non-zero exit is recorded, not hidden.
import {spawnSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const COMMANDS=[
 ['validate-cross-layer','node scripts/validate-cross-layer.mjs'],
 ['validate','node scripts/validate.mjs'],
 ['validate-v2','node scripts/validate-v2.mjs'],
 ['validate-places','node scripts/validate-places.mjs'],
 ['validate-city-time','node scripts/validate-city-time.mjs'],
 ['validate-polity-period','node scripts/validate-polity-period.mjs'],
 ['validate-release','node scripts/validate-release.mjs'],
 ['validate-battles','node scripts/places/validate-battles.mjs'],
 ['validate-atrocities','node scripts/places/validate-atrocities.mjs . docs/verification-3.17/content-atrocities-validation.json'],
 ['audit-language','node scripts/places/audit-language.mjs . docs/verification-3.17/content-language-audit.json'],
 ['verify-gz-mirrors','node scripts/places/verify-gz-mirrors-3.17.mjs']];
const results=[];
for(const [name,command] of COMMANDS){
 const run=spawnSync(command,{cwd:root,shell:true,encoding:'utf8'});
 const output=(run.stdout||'')+(run.stderr||'');
 const lines=output.trim().split('\n');
 results.push({name,command,exitCode:run.status,passed:run.status===0,summary:lines.slice(-3).join(' | ').slice(0,400),
  passLines:lines.filter(line=>/^PASS/.test(line)).length,failLines:lines.filter(line=>/^FAIL/.test(line)).length});
 console.log((run.status===0?'PASS ':'FAIL ')+name+' — '+lines.slice(-2).join(' | ').slice(0,200));
}
const report={schemaVersion:1,ranAt:new Date().toISOString(),
 policy:'Each validator was executed as a child process from the repository root; the exit code, PASS/FAIL line counts and the final output line are recorded verbatim so the round report can be checked against the commands.',
 total:results.length,passed:results.filter(result=>result.passed).length,results};
await writeFile(resolve(root,'docs/verification-3.17/content-validation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total,failed:results.filter(r=>!r.passed).map(r=>r.name)},null,1));
if(report.passed!==report.total)process.exitCode=1;
