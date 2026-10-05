import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {citationRegistry,citationIds,narrativeScope,verifiedChineseTitle} from './places/narrative-metadata.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const editorial=JSON.parse(fs.readFileSync(path.join(root,'editorial/enrichment-narratives-3.37.json')));
const shipped=JSON.parse(fs.readFileSync(path.join(root,'public/data/enrichment/narratives.json')));
const known=citationRegistry([{id:'a'},{id:'b'}]);
assert.deepEqual(citationIds({},known),['a','b']);
assert.deepEqual(citationIds({sourceIds:['b']},known),['b']);
for(const sourceIds of [[],null,['missing'],['a','a'],[1]])assert.throws(()=>citationIds({sourceIds},known));
assert.throws(()=>citationRegistry([{id:'a'},{id:'a'}]));
const scope={start:1923,end:1956,note:{zh:'公约至最终安排',en:'Convention through final settlement'}};
assert.deepEqual(narrativeScope({scope},{start:1912,end:1957}),scope);
assert.throws(()=>narrativeScope({scope:{start:20,end:10}},{start:1,end:2}));
assert.throws(()=>narrativeScope({scope:{start:10,end:20,note:{zh:'范围'}}}));
assert.equal(verifiedChineseTitle({zhIdentityMatch:true,zhIntro:'已读正文',zhTitle:'蒙古国'}),'蒙古国');
assert.equal(verifiedChineseTitle({zhIdentityMatch:true,zhAccepted:false,zhIntro:'已读正文',zhTitle:'拒绝此条'}),null);
assert.equal(verifiedChineseTitle({zhIdentityMatch:true,zhTitle:'未读正文'}),null);
assert.equal(verifiedChineseTitle({zhAccepted:true,zhIntro:'已读正文',zhTitle:'旧格式'}),'旧格式');
for(const authored of editorial.entries){
 const actual=shipped.entries.find(e=>e.qid===authored.qid);assert(actual,authored.qid);
 assert.deepEqual(actual.scope,authored.scope);assert.deepEqual(actual.sources,authored.sources);
 for(const [key,section]of Object.entries(authored.sections))assert.deepEqual(actual.sections[key],section);
 for(const fact of authored.facts){const saved=actual.facts.find(f=>f.key===fact.key);assert.deepEqual(saved.value,fact.value);assert.deepEqual(saved.sourceIds,fact.sourceIds);}
}
console.log('PASS Authored periods, per-claim references and per-source review dates survive publication');
// Run the real assembler in a temporary fixture. A bad last entry must not
// partially publish earlier valid entries; repeated successful runs are stable.
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-editorial-'));
try{
 for(const file of ['scripts/places/apply-enrichment-3.12.mjs','scripts/places/narrative-metadata.mjs','public/data/fast/catalog.json.gz','public/data/enrichment/profile-index.json.gz','public/data/enrichment/narratives.json']){
  const dest=path.join(temp,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,file),dest);
 }
 const target=path.join(temp,'public/data/enrichment/narratives.json'),batch=path.join(temp,'selected.json');
 const original=fs.readFileSync(target),run=()=>spawnSync(process.execPath,[path.join(temp,'scripts/places/apply-enrichment-3.12.mjs'),'--batch',batch],{encoding:'utf8'});
 for(const mutate of [e=>e.sections.politics.sourceIds=['missing'],e=>e.facts[0].sourceIds=[],e=>e.scope={start:50,end:20}]){
  const invalid=structuredClone(editorial);mutate(invalid.entries.at(-1));fs.writeFileSync(batch,JSON.stringify(invalid));assert.notEqual(run().status,0);assert.deepEqual(fs.readFileSync(target),original);
 }
 fs.writeFileSync(batch,JSON.stringify(editorial));const result=run();assert.equal(result.status,0,result.stderr);assert.deepEqual(fs.readFileSync(target),original);assert.equal(run().status,0);assert.deepEqual(fs.readFileSync(target),original);
 console.log('PASS Actual assembler rejects invalid final entries without partial writes and remains idempotent');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
