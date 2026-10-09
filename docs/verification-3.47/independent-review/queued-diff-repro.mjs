import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {maplibreRuntime} from '/Users/zane/meridian_atlas/world-history-atlas/scripts/test-support/maplibre-runtime.mjs';
const candidate=new URL('../global-frame-candidate/public/territory-frame-cache.js',import.meta.url);
const code=await fs.readFile(candidate,'utf8');
assert(code.includes('this.observable&&source.loaded()&&this.submitted'));
const {TerritoryFrameCache:Current}=await import(candidate);
// Reproduce the initial candidate's one removed guard in memory; no candidate edit.
const initialCode=code.replace('this.observable&&source.loaded()&&this.submitted','this.observable&&this.submitted');
const {TerritoryFrameCache:Initial}=await import('data:text/javascript;base64,'+Buffer.from(initialCode).toString('base64'));
const vendor=pathToFileURL('/Users/zane/meridian_atlas/world-history-atlas/public/assets/maplibre-gl.js');
const raw={type:'FeatureCollection',features:[{type:'Feature',id:1,properties:{name:'intended frame'},geometry:{type:'Point',coordinates:[0,0]}}]};
const diff={add:[{type:'Feature',id:2,properties:{name:'external diff'},geometry:{type:'Point',coordinates:[1,1]}}]};
const results=[];
for(const [variant,Cache] of [['baseline-always-submit',null],['initial-candidate-without-loaded-guard',Initial],['current-candidate',Current]]){
 const r=await maplibreRuntime(vendor),s=await r.load({type:'FeatureCollection',features:[]},{id:'polities'}),cache=Cache?new Cache():null;
 const commit=()=>cache?cache.submit(raw,'raw',s.source,x=>x):(s.source.setData(raw),true);
 commit();s.source.updateData(diff);const secondSubmitted=commit();await s.settle();
 results.push({variant,secondSubmitted,finalIds:(await s.source.getData()).features.map(f=>f.id),cache:cache?.getStats(),errors:s.errors.map(e=>e.message)});cache?.destroy();
}
assert.deepEqual(results[0].finalIds,[1]);assert.deepEqual(results[1].finalIds,[1,2]);assert.deepEqual(results[2].finalIds,[1]);
const report={method:'Actual main/worker MapLibre 5.6.2 and structuredClone Actor adapter; controlled pending operations. No browser/render/performance claim.',candidateSha256:createHash('sha256').update(code).digest('hex'),initialVariant:'Current standalone module evaluated with only source.loaded() removed, restoring the reviewed initial skip guard; no product edits.',scenario:'own setData(A) in flight -> external updateData(add id2) queued -> same frame A submitted again',results};
await fs.writeFile(new URL('queued-diff-repro.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
