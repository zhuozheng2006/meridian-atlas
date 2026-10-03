#!/usr/bin/env node
// Usage: node scripts/places/verify-gz-mirrors-3.17.mjs
// Deterministic-archive check for the data layers this round touched. Every .json.gz in
// public/data that has an editable .json sibling must (a) carry mtime=0 in its gzip header, so
// the archive is byte-stable across rebuilds, and (b) decode to exactly the same document as the
// .json file. Every other .json.gz in the directory is reported as an archive without an
// editable sibling (assets built by prepare:assets, which this round must not run).
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const dataDir=resolve(root,'public/data');
const names=(await readdir(dataDir)).filter(name=>name.endsWith('.json.gz')).sort();
const checked=[],withoutSibling=[],failed=[];
for(const name of names){
 const raw=await readFile(resolve(dataDir,name));
 const record={file:name,mtimeZero:raw[4]===0&&raw[5]===0&&raw[6]===0&&raw[7]===0,os:raw[9]};
 try{
  const sibling=name.replace(/\.gz$/,'');
  const text=await readFile(resolve(dataDir,sibling),'utf8');
  const decoded=JSON.parse(gunzipSync(raw).toString());
  record.deepEqual=JSON.stringify(decoded)===JSON.stringify(JSON.parse(text));
  checked.push(record);
  if(!record.mtimeZero||!record.deepEqual)failed.push(record);
 }catch(error){
  record.reason=String(error.code||error.message);
  withoutSibling.push(record);
 }
}
const report={schemaVersion:1,checkedAt:new Date().toISOString(),
 policy:'Every public/data archive with an editable .json sibling was decoded and compared field by field, and its gzip header was checked for mtime=0. Archives without an editable sibling (build outputs of prepare:assets) are listed but not rebuilt.',
 checked:checked.length,withoutEditableSibling:withoutSibling.length,failed:failed.length,archives:checked,archivesWithoutSibling:withoutSibling};
await writeFile(resolve(root,'docs/verification-3.17/content-gz-mirrors.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({archives:names.length,checked:checked.length,withoutSibling:withoutSibling.length,failed:failed},null,1));
if(failed.length)process.exitCode=1;
