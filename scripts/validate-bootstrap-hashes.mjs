import assert from 'node:assert/strict';
import fs from 'node:fs';
import {bootstrapContentHashes,bootstrapDataRequest} from '../public/bootstrap-content-hashes.js';
import {nativeContentHashes} from '../public/native-content-hashes.js';
import {readJSON,forgetJSON} from '../public/map-engine.js';

const native=JSON.parse(fs.readFileSync('public/data/native/manifest.json'));
const expected=Object.values(native.bootstrap).map(f=>['data/native/'+f.file,f.gzipSha256]);
assert.equal(Object.keys(bootstrapContentHashes).length,12);
assert.deepEqual(Object.entries(bootstrapContentHashes).sort(),expected.sort());

for(const [file,sha256] of expected){
 assert.equal(nativeContentHashes[file],sha256);
 assert.deepEqual(bootstrapDataRequest(file),{url:file.replace('data/native/','__atlas-native/')+'?sha256='+sha256,cache:'default'});
}
for(const nonBoot of ['data/native/temporal/pack-000.json.gz','data/china-prefectures/year-742-band-70.json.gz','data/chgis/century-0.json.gz','__proto__']){
 assert.equal(bootstrapDataRequest(nonBoot),null);
}

const origFetch=globalThis.fetch,requests=[];
try{
 globalThis.fetch=async(url,opt)=>{
  requests.push({url,cache:opt.cache});
  const local='public/'+url.split('?')[0].replace(/^__atlas-native\//,'data/native/');
  return new Response(fs.readFileSync(local));
 };
 const bootFile='data/native/year-1492.json.gz';
 forgetJSON(bootFile);
 const bootData=await readJSON(bootFile);
 assert(bootData && typeof bootData==='object');
 assert.equal(requests.length,1);
 assert.deepEqual(requests[0],bootstrapDataRequest(bootFile));
 const detailFile='data/china-prefectures/year-742-band-70.json.gz';
 forgetJSON(detailFile);
 await readJSON(detailFile);
 assert.equal(requests.length,2);
 assert.equal(requests[1].cache,'default');
 assert(requests[1].url.startsWith(detailFile+'?sha256='));
}finally{
 globalThis.fetch=origFetch;
}
const rawBootBytes=fs.statSync('public/bootstrap-content-hashes.js').size;
const rawFullBytes=fs.statSync('public/native-content-hashes.js').size;
assert(rawBootBytes<2500,'Bootstrap hash module must remain tiny (~1.5 KB)');
assert(rawFullBytes>rawBootBytes*10);
console.log({passed:true,bootstrapKeys:Object.keys(bootstrapContentHashes).length,rawBootBytes,rawFullBytes});
