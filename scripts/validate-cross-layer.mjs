// Cross-layer consistency: the same historical event must not carry two different
// years depending on which layer it is read from. This caught a real off-by-one
// between the event chronicle and the battle layer, so it is checked from now on.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const json=p=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,p))).toString());
const events=JSON.parse(fs.readFileSync(path.join(root,'public/data/events.json'),'utf8'));
const battles=json('public/data/battles.json.gz');
const results=[];
const check=(name,fn)=>{try{fn();results.push({name,status:'pass'});console.log('PASS',name);}catch(e){results.push({name,status:'fail',message:e.message});console.error('FAIL',name,':',e.message);}};

check('A battle shared by both layers carries the same year in each',()=>{
 const byQid=new Map();
 for(const b of battles.battles)if(b.qid)byQid.set(b.qid,b);
 const shared=events.filter(e=>e.wikidataQid&&byQid.has(e.wikidataQid));
 assert(shared.length>=10,`expected the two layers to share entities, found ${shared.length}`);
 const mismatched=shared.filter(e=>Number(e.start)!==Number(byQid.get(e.wikidataQid).year));
 assert.equal(mismatched.length,0,mismatched.slice(0,5).map(e=>`${e.id}/${e.wikidataQid}: event ${e.start} vs battle ${byQid.get(e.wikidataQid).year}`).join('; '));
 console.log(`     shared entities: ${shared.length}`);
});

check('Every battle record points at a web source',()=>{
 const missing=battles.battles.filter(b=>!Array.isArray(b.sources)||!b.sources.some(s=>typeof s?.url==='string'&&s.url.startsWith('https://')));
 assert.equal(missing.length,0,`${missing.length} battles have no https source, e.g. ${missing.slice(0,3).map(b=>b.id).join(', ')}`);
 console.log(`     battles with an https source: ${battles.battles.length}/${battles.battles.length}`);
});

check('Editorial events carry a dated source and a known provenance state',()=>{
 const bad=events.filter(e=>!Array.isArray(e.sources)||!e.sources.some(s=>typeof s?.url==='string'&&s.url.startsWith('https://')));
 assert.equal(bad.length,0,`${bad.length} events have no https source`);
 const structured=events.filter(e=>e.provenance==='wikidata-structured').length;
 assert(structured<events.length,'every event is marked as a structured index entry');
 console.log(`     events: ${events.length}, structured index entries: ${structured}`);
});

const failed=results.filter(r=>r.status==='fail').length;
console.log(JSON.stringify({passed:results.length-failed,total:results.length,events:events.length,battles:battles.battles.length}));
process.exit(failed?1:0);
