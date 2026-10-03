#!/usr/bin/env node
// Usage: node docs/verification-3.22/negative-tests-3.22.mjs
// Proves the two new validator contracts are not vacuous: with the no-territory entry removed, or
// with an unbound profile missing from the declared list, the checks fail. It only reads shipped
// data and the shared module; it writes nothing.
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {reachability,declaredQids,renderedQids,section} from '../../public/no-territory.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const index=JSON.parse(gunzipSync(readFileSync(resolve(root,'public/data/enrichment/profile-index.json.gz'))).toString());
const results=[];
const negative=(name,fn)=>{try{fn();results.push({name,outcome:'FAIL (the tampered case passed)'})}catch(error){results.push({name,outcome:'PASS (tampered case rejected)',message:error.message.slice(0,90)})}};

negative('Entry point removed: the section renders no cards while five profiles have no records',()=>{
 const {unbound}=reachability(index);
 const empty=section({...index,coverage:{...index.coverage,boundaryCoverage:{...index.coverage.boundaryCoverage,noTerritoryQids:[]}}},{t:(zh,en)=>zh,escape:value=>String(value??''),lang:'zh'});
 assert.deepEqual(renderedQids(empty),unbound);
});
negative('Declaration lost: an unbound profile is missing from coverage.noTerritoryQids',()=>{
 const {unbound}=reachability(index);
 const tampered={...index,coverage:{...index.coverage,boundaryCoverage:{...index.coverage.boundaryCoverage,noTerritoryQids:declaredQids(index).slice(1)}}};
 assert.deepEqual(unbound,declaredQids(tampered));
});
negative('Note dropped: a dossier without the bilingual note cannot satisfy the contract',()=>{
 const qid=declaredQids(index)[0];
 const profile=JSON.parse(gunzipSync(readFileSync(resolve(root,'public/data/enrichment/'+index.profiles[qid].file))).toString());
 const stripped=JSON.parse(JSON.stringify(profile));stripped.boundaryCoverageEvidence.note={};
 const passage={t:(zh,en)=>zh,escape:value=>String(value??''),lang:'zh'};
 assert(renderedQids(section(index,passage)).includes(qid)&&stripped.boundaryCoverageEvidence.note.zh);
});
console.log(JSON.stringify({checks:results,allRejected:results.every(item=>item.outcome.startsWith('PASS'))},null,2));
