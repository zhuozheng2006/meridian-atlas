import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createMapCatalogLoader,mapCatalogPath,mapCatalogRange} from '../public/map-catalog.js';

const root=fileURLToPath(new URL('../',import.meta.url)),sourceFile=path.join(root,'public/data/fast/catalog.json.gz'),sourceBytes=fs.readFileSync(sourceFile),source=JSON.parse(gunzipSync(sourceBytes));
const read=file=>JSON.parse(gunzipSync(fs.readFileSync(path.join(root,'public',file)))),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'public/data/fast/map-catalog/manifest.json'))),sourceHash=hash(sourceBytes),packs=new Map();
const changes=[...new Set(source.records.filter(r=>r.type==='POLITY').flatMap(r=>[r.start,r.end===-1?1:r.end+1]))].filter(y=>y&&y>=-3400&&y<=2024).sort((a,b)=>a-b);
const cases=[];async function test(name,run){await run();cases.push({name,pass:true});console.log('PASS '+name);}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
let yearsChecked=0,recordYearPairs=0;

await test('Every generated package retains exact complete source rows, geometry references, metadata and global change years',()=>{
 assert.equal(manifest.sourceCatalogSHA256,sourceHash);assert.equal(manifest.sourceRecords,source.records.length);assert.equal(manifest.sourceBytes,sourceBytes.length);assert.equal(manifest.files,218);
 for(const asset of manifest.assets){
  const file='data/fast/map-catalog/'+asset.file,bytes=fs.readFileSync(path.join(root,'public',file)),pack=read(file);packs.set(file,pack);
  assert.equal(bytes.length,asset.bytes);assert.equal(hash(bytes),asset.sha256);assert.equal(pack.mapCatalog.sourceCatalogSHA256,sourceHash);assert.equal(pack.mapCatalog.sourceRecordCount,source.records.length);assert.deepEqual(pack.mapCatalog.range,asset.range);
  const expected=asset.range?source.records.filter(r=>r.start<=asset.range[1]&&r.end>=asset.range[0]):[];
  assert.deepEqual(pack.records,expected,file);assert.deepEqual(pack.geometryIndex,Object.fromEntries(expected.map(r=>[r.geometryId,source.geometryIndex[r.geometryId]])),file);assert.deepEqual(pack.metadata,source.metadata,file);assert.deepEqual(pack.changeYears,changes,file);assert.equal(pack.version,source.version);
 }
 assert.equal(manifest.totalBytes,manifest.assets.reduce((n,a)=>n+a.bytes,0));
});
await test('All 5424 supported historical years have the same ordered active record set as the full catalog',()=>{
 for(let year=-3400;year<=2024;year++){
  if(!year)continue;const range=mapCatalogRange(year),pack=packs.get(mapCatalogPath(year));assert(range[0]<=year&&year<=range[1]);
  const expected=source.records.filter(r=>r.start<=year&&year<=r.end).map(r=>r.id),actual=pack.records.filter(r=>r.start<=year&&year<=r.end).map(r=>r.id);
  assert.deepEqual(actual,expected,String(year));yearsChecked++;recordYearPairs+=expected.length;
 }
 assert.equal(yearsChecked,5424);
});
await test('Date windows cross BCE/CE without a year zero and clamp the published range',()=>{
 assert.deepEqual(mapCatalogRange(-1),[-25,-1]);assert.deepEqual(mapCatalogRange(1),[1,25]);assert.deepEqual(mapCatalogRange(25),[1,25]);assert.deepEqual(mapCatalogRange(26),[26,50]);assert.deepEqual(mapCatalogRange(-3400),[-3400,-3376]);assert.deepEqual(mapCatalogRange(2024),[2001,2024]);
 for(const year of [0,NaN,Infinity,1.5,'742',null,undefined])assert.throws(()=>mapCatalogPath(year),RangeError);
 assert.equal(mapCatalogPath(-70000),'data/fast/map-catalog/empty.json.gz');assert.equal(mapCatalogPath(2026),'data/fast/map-catalog/empty.json.gz');
});
await test('Concurrent and repeated dates within one window share the same request and exact object',async()=>{
 const task=deferred(),requests=[],loader=createMapCatalogLoader(file=>{requests.push(file);return task.promise;}),a=loader.forYear(742),b=loader.forYear(750);
 assert.equal(a,b);await flush();assert.deepEqual(requests,[mapCatalogPath(742)]);task.resolve(packs.get(mapCatalogPath(742)));const value=await a;assert.strictEqual(await loader.forYear(726),value);assert.equal(requests.length,1);
});
await test('Different years and the shared empty package remain independent and never request the full catalog',async()=>{
 const requests=[],loader=createMapCatalogLoader(async file=>{requests.push(file);return packs.get(file);});
 const values=await Promise.all([loader.forYear(-250),loader.forYear(1492),loader.forYear(-70000),loader.forYear(2026)]);
 assert.notStrictEqual(values[0],values[1]);assert.strictEqual(values[2],values[3]);assert.equal(values[2].records.length,0);assert.deepEqual(values[2].metadata,source.metadata);assert.equal(requests.length,3);assert(requests.every(file=>file.startsWith('data/fast/map-catalog/')));
});
await test('A failed fetch is evicted and a second request can succeed',async()=>{
 let attempts=0;const forgotten=[],loader=createMapCatalogLoader(async file=>{if(!attempts++)throw Error('temporary network failure');return packs.get(file);},file=>forgotten.push(file));
 await assert.rejects(loader.forYear(1492),/temporary network/);assert.equal((await loader.forYear(1492)).mapCatalog.range[0],1476);assert.equal(attempts,2);assert.deepEqual(forgotten,[mapCatalogPath(1492)]);
});
await test('Wrong date packages and malformed rows fail explicitly and evict the underlying JSON cache',async()=>{
 for(const corrupt of [p=>{p.mapCatalog.range=[1,25];},p=>{p.records[0].start=9999;},p=>{p.geometryIndex={};},p=>{p.records.push(p.records[0]);},p=>{p.mapCatalog.sourceRecordCount=1;},p=>{p.changeYears=[-1,0,1];},p=>{p.changeYears=[1,-1];}]){
  let attempts=0;const forgotten=[],loader=createMapCatalogLoader(async file=>{attempts++;const value=structuredClone(packs.get(file));if(attempts===1)corrupt(value);return value;},file=>forgotten.push(file));
  await assert.rejects(loader.forYear(742),/catalog/);assert.equal((await loader.forYear(742)).mapCatalog.range[0],726);assert.equal(attempts,2);assert.deepEqual(forgotten,[mapCatalogPath(742)]);
 }
});
await test('Out-of-range data cannot smuggle records into an empty historical year',async()=>{
 const loader=createMapCatalogLoader(async()=>{const value=structuredClone(packs.get(mapCatalogPath(-70000)));value.records=[source.records[0]];return value;});await assert.rejects(loader.forYear(-70000),/must be empty/);
});
await test('The full catalog and original archive stay byte-for-byte untouched by map loading',async()=>{
 const archive=path.join(root,'public/data/catalog.json.gz'),before=hash(fs.readFileSync(archive));
 const loader=createMapCatalogLoader(async file=>packs.get(file));for(const year of [-3400,-250,-1,1,742,1492,2024,2026])await loader.forYear(year);
 assert.equal(hash(fs.readFileSync(sourceFile)),sourceHash);assert.equal(hash(fs.readFileSync(archive)),before);assert.equal(source.records.length,13765);
});

const report={passed:true,cases,yearsChecked,recordYearPairs,files:manifest.files,totalBytes:manifest.totalBytes,fullCatalogBytes:sourceBytes.length,sourceCatalogSHA256:sourceHash,originalRowsFieldsGeometryReferencesAndMetadataPreserved:true,globalChangeYears:changes.length,fullSearchAndReadingCatalogUnchanged:true,method:'Actual generated files compared to canonical full lean catalog for all supported years; loader failure, malformed-response, concurrency and retry tests. This is data/loader validation, not browser timing.'};
const output=process.env.MAP_CATALOG_REPORT;if(output){fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({passed:true,checks:cases.length,yearsChecked,recordYearPairs,files:manifest.files,totalBytes:manifest.totalBytes}));
