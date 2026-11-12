import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {chinaWindowFor,chinaSnapshotYear,readChinaSnapshot} from '../public/china-prefectures.js';
import {regionalWindowFor,regionalVisible,RegionalBoundaries} from '../public/regional-boundaries.js';
const root='public/data/china-prefectures/',read=f=>JSON.parse(gunzipSync(fs.readFileSync(root+f))),manifest=JSON.parse(fs.readFileSync(root+'manifest.json')),index=read('index.json.gz'),hash=b=>createHash('sha256').update(b).digest('hex');
const box=(x,y=36)=>({getWest:()=>x-2,getEast:()=>x+2,getSouth:()=>y-2,getNorth:()=>y+2});
assert.equal(index.records.length,420);assert.equal(new Set(index.records.map(r=>r.id)).size,420);
assert.equal(index.records.filter(r=>r.year===2).length,103);assert.equal(index.records.filter(r=>r.year===742).length,317);
for(const y of [-2,0,1,3,741,743,1102,1820,NaN,2.1])assert.equal(chinaSnapshotYear(y),false);
assert.equal(chinaWindowFor(box(104),2).band,100);assert.equal(chinaWindowFor(box(70),742),null);
assert.equal(regionalWindowFor(box(104),742).id,'china-prefectures-100');assert.equal(regionalWindowFor(box(119,30),743).id,'chgis-prefectures');
let instances=0;
for(const f of manifest.files){const b=fs.readFileSync(root+f.file);assert.equal(b.length,f.bytes);assert.equal(hash(b),f.sha256);if(!f.file.startsWith('year-'))continue;const d=read(f.file),expected=index.records.filter(r=>r.year===d.year&&r.bounds[0]<=d.band+20&&r.bounds[2]>=d.band-10);assert.deepEqual(Object.keys(d.geometries).sort(),expected.map(r=>r.id).sort());instances+=expected.length;}
assert.equal(hash(fs.readFileSync(root+'ResearchArea-originals.zip')),manifest.sourceArchiveSHA256);
const originalFetch=globalThis.fetch,requests=[];let fail=false;
globalThis.fetch=async url=>{requests.push(url);if(fail&&url.includes('year-2-band-90'))return new Response('unavailable',{status:503});return new Response(fs.readFileSync('public/'+url));};
try{
 const a=chinaWindowFor(box(104),2),frames=await Promise.all([readChinaSnapshot(a,2),readChinaSnapshot(a,2)]);assert.equal(requests.length,2);assert.deepEqual(frames[0],frames[1]);assert(frames[0].features.every(f=>regionalVisible(f.properties,2,4)&&!regionalVisible(f.properties,3,4)));
 await readChinaSnapshot(chinaWindowFor(box(109),2),2);assert.equal(requests.length,2);
 for(const x of [110,120,100])await readChinaSnapshot(chinaWindowFor(box(x),742),742);
 const n=requests.length;await readChinaSnapshot(a,2);assert.equal(requests.length,n+1);
 fail=true;await assert.rejects(readChinaSnapshot(chinaWindowFor(box(94),2),2));fail=false;await readChinaSnapshot(chinaWindowFor(box(94),2),2);
 const regional=Object.create(RegionalBoundaries.prototype);Object.assign(regional,{year:742,map:{getBounds:()=>box(104),getSource(){throw Error('Scholarly source must suppress live OHM startup');}}});assert(regional.scholarlyActive);regional.ensure();
}finally{globalThis.fetch=originalFetch;}
const report={passed:true,sourceRows:420,years:[2,742],bandInstances:instances,files:manifest.files.length,concurrentRequestsShared:true,sameBandExtraRequests:0,threePackEviction:true,retryAfterFailure:true,exactYearsOnly:true};
fs.mkdirSync('docs/verification-3.58',{recursive:true});fs.writeFileSync('docs/verification-3.58/china-runtime.json',JSON.stringify(report,null,2)+'\n');console.log(report);
