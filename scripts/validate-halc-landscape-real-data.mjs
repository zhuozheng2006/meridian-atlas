import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {LandscapeArchive} from '../public/halc-landscape-prepare.js';
import {fileURLToPath} from 'node:url';
const root=process.argv[2]||fileURLToPath(new URL('../',import.meta.url)),base=new URL('../',import.meta.url),dataRoot=root+'/public/data/halc-landscape/';
const index=JSON.parse(gunzipSync(await fs.readFile(dataRoot+'index.json.gz')));
const bytes=new Map(),decoded=new Map();for(const shard of index.shards){const raw=await fs.readFile(dataRoot+shard.file);assert.equal(createHash('sha256').update(raw).digest('hex'),shard.sha256);bytes.set(shard.file,raw);decoded.set(shard.file,JSON.parse(gunzipSync(raw)));}bytes.set('index.json.gz',await fs.readFile(dataRoot+'index.json.gz'));
// Fixed old 3.44 selection algorithm: independent of candidate exports.
function oldIntersects(a,b){if(!a||!b||a[3]<b[1]||a[1]>b[3])return false;let east=b[2];while(east<b[0])east+=360;if(east-b[0]>=360)return true;const shift=Math.floor((b[0]-a[0])/360)*360;return [shift,shift+360].some(s=>a[0]+s<=east&&a[2]+s>=b[0]);}
function oldFrame(bounds){const features=[];for(const shard of index.shards.filter(s=>oldIntersects(s.bbox,bounds)&&s.features.some(f=>oldIntersects(f.bbox,bounds)))){const ids=new Set(shard.features.filter(f=>oldIntersects(f.bbox,bounds)).map(f=>f.id));for(const f of decoded.get(shard.file).features)if(ids.has(f.id))features.push(f);}features.sort((a,b)=>a.id-b.id);return {type:'FeatureCollection',features};}
const decode=url=>JSON.parse(Buffer.from(url.slice(url.indexOf(',')+1),'base64').toString('utf8'));
const checks=[],observations=[];
async function test(name,fn){try{await fn();checks.push({name,pass:true});console.log('PASS '+name);}catch(error){checks.push({name,pass:false,error:error.stack});console.error('FAIL '+name+' '+error.stack);}}
let calls=0;const archive=new LandscapeArchive({baseURL:'https://atlas.test/data/halc-landscape/',fetch:async url=>{calls++;return new Response(bytes.get(url.split('/data/halc-landscape/')[1]));}});
const views=[[-180,-85,180,85],[-4.5,49.1,14.2,53.4],[4.6,51.8,5.0,52.1],[364.6,51.8,365.0,52.1],[130,20,140,30]];
const prepared=[];
await test('Every selected coordinate, ring, overlap, null date, property and feature order matches the independent 3.44 algorithm at five views',async()=>{
 for(const bounds of views){const result=await archive.prepare(bounds),actual=decode(result.dataURL),old=oldFrame(bounds);assert.deepEqual(actual,old);assert.deepEqual(result.records,old.features.map(({geometry,...rest})=>rest));assert(result.records.every(f=>!Object.hasOwn(f,'geometry')));prepared.push(result);observations.push({bounds,features:old.features.length,metrics:result.metrics});}
 assert.equal(prepared[0].records.length,2980);assert.equal(prepared[0].metrics.files.length,50);assert.equal(calls,50);
 const first=decode(prepared[0].dataURL);assert.equal(first.features.reduce((n,f)=>n+f.geometry.coordinates.reduce((m,r)=>m+r.length,0),0),514392);
 assert.deepEqual(first.features.filter(f=>f.properties.TIME_START===null).map(f=>f.id),[106,2477,2478]);
});
await test('HTTP-decoded gzip bodies produce the same full data, rather than being decompressed twice',async()=>{const instance=new LandscapeArchive({baseURL:'https://atlas.test/data/halc-landscape/',fetch:async url=>new Response(gunzipSync(bytes.get(url.split('/data/halc-landscape/')[1])))});const result=await instance.prepare(views[2]);assert.deepEqual(decode(result.dataURL),oldFrame(views[2]));});
await test('Cancellation after first network request cannot select, serialize or return a stale frame',async()=>{let valid=true;const instance=new LandscapeArchive({baseURL:'https://atlas.test/data/halc-landscape/',fetch:async url=>{valid=false;return new Response(bytes.get(url.split('/data/halc-landscape/')[1]));}});assert.equal(await instance.prepare(views[0],()=>valid),null);assert.equal(instance.entries.size,1);});
await test('Network error is evicted, so explicit retry requests the file again',async()=>{let fail=true;const instance=new LandscapeArchive({baseURL:'https://atlas.test/data/halc-landscape/',fetch:async url=>{if(fail)throw Error('offline');return new Response(bytes.get(url.split('/data/halc-landscape/')[1]));}});await assert.rejects(instance.prepare(views[2]));assert.equal(instance.entries.size,0);fail=false;assert.deepEqual(decode((await instance.prepare(views[2])).dataURL),oldFrame(views[2]));});
await test('Invalid index and invalid shard class are both evicted for explicit retry',async()=>{let invalidIndex=true,invalidClass=true;const instance=new LandscapeArchive({baseURL:'https://atlas.test/data/halc-landscape/',fetch:async url=>{const name=url.split('/data/halc-landscape/')[1];if(name==='index.json.gz'&&invalidIndex)return new Response(JSON.stringify({...index,snapshotYear:1600}));if(name!=='index.json.gz'&&invalidClass){const value=structuredClone(decoded.get(name));value.features[0].properties.LANDSCAPE=999;return new Response(JSON.stringify(value));}return new Response(bytes.get(name));}});await assert.rejects(instance.prepare(views[2]));assert(!instance.entries.has('index.json.gz'));invalidIndex=false;await assert.rejects(instance.prepare(views[2]));assert.equal(instance.entries.size,1);invalidClass=false;assert.deepEqual(decode((await instance.prepare(views[2])).dataURL),oldFrame(views[2]));});
await test('Base64 preserves the exact serialized UTF-8 bytes independently of JSON decoding',()=>{
 for(let n=0;n<views.length;n++){const text=JSON.stringify(oldFrame(views[n])),raw=Buffer.from(prepared[n].dataURL.split(',')[1],'base64');assert.deepEqual(raw,Buffer.from(text));assert.equal(prepared[n].metrics.jsonBytes,raw.length);assert.equal(prepared[n].dataURL.length,'data:application/geo+json;base64,'.length+4*Math.ceil(raw.length/3));}
});
const report={generated:new Date().toISOString(),method:'Real source gzip files and independent 3.44 selection oracle; exact UTF-8 base64 round trip plus coordinate/property/order equality across five views. File-backed transport times are not Chrome/network benchmarks.',passed:checks.filter(c=>c.pass).length,total:checks.length,checks,observations};await fs.mkdir(new URL('docs/verification-3.46/',base),{recursive:true});await fs.writeFile(new URL('docs/verification-3.46/halc-landscape-real-data.json',base),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,total:report.total}));if(report.passed!==report.total)process.exitCode=1;
