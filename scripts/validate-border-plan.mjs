import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {curvedBorders} from '../public/border-curves.js';
const read=p=>JSON.parse(gunzipSync(fs.readFileSync('public/data/'+p)));
const catalog=read('fast/catalog.json.gz'),results=[];
const views=[[95,20,115,45],[110,25,130,50],[65,5,95,35],[25,20,65,45],null];
for(const year of [500,1000,1492]){
 const pack=read('native/year-'+year+'.json.gz'),records=catalog.records.filter(r=>r.type==='POLITY'&&r.start<=year&&year<=r.end);
 const raw={type:'FeatureCollection',features:records.map(r=>({type:'Feature',properties:{id:r.id},geometry:pack.geometries[pack.recordIndex[r.id]]}))},original=JSON.stringify(raw);
 const warm=[],cold=[];let cases=0;
 for(const tolerance of [.002,.1,.02,.005,.002])for(const view of views){
  const before=performance.now(),actual=curvedBorders(raw,tolerance,view);warm.push(performance.now()-before);
  const clone=structuredClone(raw),start=performance.now(),expected=curvedBorders(clone,tolerance,view);cold.push(performance.now()-start);
  assert.deepEqual(actual,expected,'Camera history must not change source geometry portrayal');
  assert.equal(curvedBorders(raw,tolerance,view),actual,'Repeated exact view uses finished frame');cases++;
 }
 assert.equal(JSON.stringify(raw),original,'Source coordinates remain immutable');
 results.push({year,cases,coldMilliseconds:cold.reduce((a,b)=>a+b,0),reusedPlanMilliseconds:warm.reduce((a,b)=>a+b,0)});
}
const report={passed:true,scope:'Local Node curve preparation and sampling only; not network or browser end-to-end timing',sourceImmutable:true,historyIndependent:true,results};
fs.mkdirSync('docs/verification-3.57',{recursive:true});fs.writeFileSync('docs/verification-3.57/border-plan.json',JSON.stringify(report,null,2)+'\n');console.log(report);
