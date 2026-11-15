import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import {gunzipSync} from 'node:zlib';
import {nativeContentHashes,detailContentHashes,historicalDataRequest} from '../public/native-content-hashes.js';
import {readJSON,forgetJSON} from '../public/map-engine.js';import {createStaticStorageHandler} from '../worker/atlas-worker.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),read=file=>JSON.parse(fs.readFileSync('public/data/'+file));
// Independent expected inventory; do not trust the generated request map.
const expected=[];
for(const area of ['ohm-eastasia','ohm-1500','ohm-britain'])for(const f of Object.values(read(area+'/manifest.json').years))expected.push({file:'data/'+area+'/'+f.file,bytes:f.gzipBytes,sha256:f.sha256});
for(const f of read('ohm-transport/manifest.json').files)expected.push({file:'data/ohm-transport/'+f.file,bytes:f.bytes,sha256:f.sha256});
for(const [area,pattern]of [['china-prefectures',/^year-\d+-band-\d+\.json\.gz$/],['chgis',/^century--?\d+\.json\.gz$/]])for(const f of read(area+'/manifest.json').files)if(pattern.test(f.file))expected.push({file:'data/'+area+'/'+f.file,bytes:f.bytes,sha256:f.sha256});
for(const f of Object.values(read('cshapes/manifest.json').packs))expected.push({file:'data/cshapes/'+f.file,bytes:f.bytes,sha256:f.sha256});
assert.equal(expected.length,117);assert.equal(Object.keys(nativeContentHashes).length,270);
assert.deepEqual(Object.keys(detailContentHashes).sort(),expected.map(f=>f.file).sort());
const counts={};
for(const f of expected){
 const body=fs.readFileSync('public/'+f.file);assert.equal(body.length,f.bytes);assert.equal(hash(body),f.sha256);assert.equal(detailContentHashes[f.file],f.sha256);
 assert.deepEqual(historicalDataRequest(f.file),{url:f.file+'?sha256='+f.sha256,cache:'default'});
 assert.equal(Object.hasOwn(nativeContentHashes,f.file),false);const region=f.file.split('/')[1];counts[region]=(counts[region]||0)+1;
}
for(const file of ['data/awmc/roman_empire_ce_200_extent.geojson.gz','data/china-prefectures/index.json.gz','data/chgis/index.json.gz','data/chgis/century-0.json.gz?sha256=wrong','https://outside.example/data/chgis/century-0.json.gz','data/chgis/../chgis/century-0.json.gz','__proto__','constructor'])assert.deepEqual(historicalDataRequest(file),{url:file,cache:'no-cache'});
const manifest={revision:'detail-cache-test',files:expected.map(f=>({...f,key:'atlas-static/sha256/'+f.sha256,contentType:'application/octet-stream'}))};
const handler=createStaticStorageHandler(manifest),byKey=new Map(manifest.files.map(f=>[f.key,f]));
const env={BUCKET:{get:async key=>{const f=byKey.get(key);return f?{size:f.bytes,customMetadata:{sha256:f.sha256},body:fs.readFileSync('public/'+f.file)}:null;},head:async key=>{const f=byKey.get(key);return f?{size:f.bytes,customMetadata:{sha256:f.sha256}}:null;}}};
const fetchWorker=async(file,{method='GET',suffix='?sha256='+detailContentHashes[file],headers={}}={})=>{const request=new Request('https://atlas.example/'+file+suffix,{method,headers});return handler(request,env,new URL(request.url));};
const samples=Object.keys(counts).map(area=>expected.filter(f=>f.file.split('/')[1]===area).sort((a,b)=>a.bytes-b.bytes)[0]);
for(const f of samples){
 const response=await fetchWorker(f.file);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, max-age=31536000, immutable');assert.equal(hash(Buffer.from(await response.arrayBuffer())),f.sha256);
 const head=await fetchWorker(f.file,{method:'HEAD'});assert.equal(head.status,200);assert.equal(Number(head.headers.get('content-length')),f.bytes);assert.equal((await head.arrayBuffer()).byteLength,0);
 const cached=await fetchWorker(f.file,{headers:{'If-None-Match':'"'+f.sha256+'"'}});assert.equal(cached.status,304);assert.equal((await cached.arrayBuffer()).byteLength,0);
 assert.equal((await fetchWorker(f.file,{suffix:'?sha256='+'0'.repeat(64)})).status,412);
 assert.equal((await fetchWorker(f.file,{suffix:''})).headers.get('cache-control'),'private, no-cache');
 const missing=new Request('https://atlas.example/'+f.file+'?sha256='+f.sha256);assert.equal((await handler(missing,{},new URL(missing.url))).status,503);
}
// Real readJSON: concurrent sharing, decoding and explicit memory eviction.
// This is not a simulated browser disk-cache hit or a load-time measurement.
const previous=globalThis.fetch,requests=[];
try{
 globalThis.fetch=async(url,options)=>{requests.push({url,cache:options.cache});const request=new Request('https://atlas.example/'+url,{signal:options.signal});return handler(request,env,new URL(request.url));};
 for(const area of ['china-prefectures','chgis','ohm-transport']){
  const f=samples.find(f=>f.file.split('/')[1]===area),before=requests.length;forgetJSON(f.file);
  const [a,b]=await Promise.all([readJSON(f.file),readJSON(f.file)]);assert.strictEqual(a,b);assert.equal(requests.length,before+1);assert.deepEqual(a,JSON.parse(gunzipSync(fs.readFileSync('public/'+f.file))));
  assert.deepEqual(requests.at(-1),historicalDataRequest(f.file));forgetJSON(f.file);await readJSON(f.file);assert.equal(requests.length,before+2);assert.equal(requests.at(-1).cache,'default');forgetJSON(f.file);
 }
}finally{globalThis.fetch=previous;}
const report={passed:true,newDetailFingerprints:117,totalFingerprints:387,regions:counts,sourceBytesUnchanged:true,workerHTTP:{testedFamilies:samples.length,checks:['exact gzip bytes','private immutable response','HEAD','conditional 304','wrong fingerprint 412','stable URL revalidation','missing storage 503']},realReadJSON:{concurrentSharing:true,exactDecodedData:true,evictionUsesBrowserDefaultCache:true},excluded:'Static indexes, AWMC, archives, external URLs and unrecognized/query-bearing paths retain prior policy',measurement:'Request policy and data integrity; no end-to-end speed or actual browser disk-cache hit measured',suggestedLivePaths:samples.map(f=>f.file)};
fs.mkdirSync('docs/verification-3.59',{recursive:true});fs.writeFileSync('docs/verification-3.59/detail-content-cache.json',JSON.stringify(report,null,2)+'\n');console.log(report);
