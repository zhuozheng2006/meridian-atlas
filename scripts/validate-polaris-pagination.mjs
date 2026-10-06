import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {PolarisStore} from '../public/polaris-store.js';
import {searchSheets,matchesObservation,normalizeFilters} from '../public/polaris-adapter.js';
const dataBase=new URL('../public/data/seshat-polaris-2026/',import.meta.url),index=JSON.parse(gunzipSync(await readFile(new URL('index.json.gz',dataBase))));
const sources=new Map();for(const d of index.searchFiles)sources.set(d.sourceSheet,JSON.parse(gunzipSync(await readFile(new URL(d.file,dataBase)))).observations);
const expected=filters=>searchSheets(filters).flatMap(s=>sources.get(s)).filter(row=>matchesObservation(row,filters));
const all={domain:'all'},allRows=expected(all),planned=searchSheets(all),fileFor=sheet=>index.searchFiles.find(d=>d.sourceSheet===sheet).file;
const tasks=[],fixtures=new Map(),originalFetch=globalThis.fetch;
let nextId=0;
function fixture(options={}){
 const origin=`https://pagination-${++nextId}.invalid`,calls=[];
 const f={calls,hook:null,origin,store:new PolarisStore({dataBaseUrl:origin+'/data/seshat-polaris-2026/',yieldNow:async()=>{},...options})};fixtures.set(origin,f);return f;
}
// This executes the production gzip transport, both pinned SHA-256 checks,
// decoding, structural validation, filtering and cache implementation.
globalThis.fetch=async(url,{signal}={})=>{
 const u=new URL(url),f=fixtures.get(u.origin);assert(f,'Unregistered test transport');const file=u.pathname.split('/seshat-polaris-2026/')[1];assert(file&&!file.includes('..'));f.calls.push(file);
 const body=await readFile(new URL(file,dataBase));const result=f.hook?await f.hook(file,body,signal):null;return new Response(result??body);
};
const tick=()=>new Promise(r=>setImmediate(r));
async function waitUntil(fn){for(let i=0;i<10000;i++){if(fn())return;await tick();}throw Error('Fixture did not reach its controlled boundary');}
async function test(name,fn){try{await fn();tasks.push({name,passed:true});console.log('PASS '+name);}catch(error){tasks.push({name,passed:false,error:error.stack});console.error('FAIL '+name+'\n'+error.stack);}}
const ids=rows=>rows.map(r=>r.id);
try{
 await test('Full source scan retains one bounded ordinal index, exact total and source row order',async()=>{
  const f=fixture(),r=await f.store.search(all);assert.equal(r.total,57631);assert.equal(r.scanned,57631);assert.deepEqual(r.rows,allRows.slice(0,24));assert.deepEqual(r.coveredSheets,planned);assert.equal(f.calls.length,7);
  const q=f.store.queryIndex;assert(q.positions instanceof Uint32Array);assert.equal(q.positions.length,57631);assert.equal(q.positions.byteLength,230524);assert.equal(q.positions.buffer.byteLength,230524);assert.deepEqual(Object.keys(q).sort(),['key','positions','scanned','segments','total']);assert.equal(f.store.searchCache.size,2);f.store.dispose();
 });
 await test('Second page reopens only its target source sheet after normal LRU eviction',async()=>{
  const f=fixture();await f.store.search(all);const prior=f.calls.length,r=await f.store.search(all,{offset:24});assert.deepEqual(r.rows,allRows.slice(24,48));assert.equal(r.total,57631);assert.deepEqual(f.calls.slice(prior),[fileFor(allRows[24].sourceSheet)]);assert.equal(f.store.searchCache.size,2);f.store.dispose();
 });
 await test('A page spanning two sheets returns their precise source rows and loads only those sheets',async()=>{
  const f=fixture({maxCachedSearchSheets:0}),offset=sources.get(planned[0]).length-7;await f.store.search(all);const prior=f.calls.length,r=await f.store.search(all,{offset,limit:24});assert.deepEqual(r.rows,allRows.slice(offset,offset+24));assert.equal(new Set(ids(r.rows)).size,24);assert.deepEqual(f.calls.slice(prior),[fileFor(planned[0]),fileFor(planned[1])]);f.store.dispose();
 });
 await test('Equivalent normalized filters reuse the index while a changed query replaces it',async()=>{
  const f=fixture({maxCachedSearchSheets:0}),query={domain:'all',query:' CN_MING_DYN '};const a=await f.store.search(query),cache=f.store.queryIndex;const prior=f.calls.length,b=await f.store.search({domain:'all',query:'cn_ming_dyn'},{offset:24});assert.equal(f.store.queryIndex,cache);assert.deepEqual(b.rows,expected(query).slice(24,48));assert(f.calls.length-prior<=new Set(b.rows.map(r=>r.sourceSheet)).size);assert.equal(b.filters.query,'cn_ming_dyn');assert(a.total>24);
  const before=f.calls.length,c=await f.store.search({domain:'all',query:'zzzz_no_such_source_value_zzzz'});assert.equal(c.total,0);assert.notEqual(f.store.queryIndex,cache);assert.equal(f.calls.length-before,6);f.store.dispose();
 });
 await test('A complete zero-match query pages without reopening any source table',async()=>{
  const f=fixture({maxCachedSearchSheets:0}),filters={domain:'all',query:'zzzz_no_such_source_value_zzzz'};await f.store.search(filters);assert.equal(f.store.queryIndex.positions.length,0);const prior=f.calls.length,r=await f.store.search(filters,{offset:24});assert.equal(r.total,0);assert.deepEqual(r.rows,[]);assert.equal(r.scanned,57631);assert.equal(f.calls.length,prior);f.store.dispose();
 });
 await test('An incompatible domain and variable produces an empty completed plan',async()=>{
  const f=fixture(),filters={domain:'crisis',variable:'polity_population'},r=await f.store.search(filters);assert.equal(r.total,0);assert.equal(r.scanned,0);assert.deepEqual(r.coveredSheets,[]);assert.deepEqual(f.calls,['index.json.gz']);assert.equal(f.store.queryIndex.positions.buffer.byteLength,0);f.store.dispose();
 });
 await test('Different page sizes and the end boundary keep total stable without scanning again',async()=>{
  const f=fixture({maxCachedSearchSheets:0});await f.store.search(all,{limit:1});let prior=f.calls.length;const end=await f.store.search(all,{offset:57631,limit:500});assert.deepEqual(end.rows,[]);assert.equal(end.total,57631);assert.equal(f.calls.length,prior);const r=await f.store.search(all,{offset:57620,limit:500});assert.deepEqual(r.rows,allRows.slice(57620));assert.deepEqual(normalizeFilters(r.filters),normalizeFilters(all));await assert.rejects(f.store.search(all,{offset:57632}),RangeError);f.store.dispose();
 });
 await test('Explicit collection scans every source table and exports every exact original row',async()=>{
  const f=fixture({maxCachedSearchSheets:0});await f.store.search(all);const prior=f.calls.length,r=await f.store.collectSearch(all,{offset:24,limit:1});assert.deepEqual(r.rows,allRows);assert.equal(r.total,57631);assert.deepEqual(f.calls.slice(prior),planned.map(fileFor));f.store.dispose();
 });
 await test('Retry invalidates pagination and rereads every planned table even with a warm sheet cache',async()=>{
  const f=fixture({maxCachedSearchSheets:6});await f.store.search(all);const cache=f.store.queryIndex,prior=f.calls.length,r=await f.store.search(all,{offset:24,retry:true});assert.deepEqual(r.rows,allRows.slice(24,48));assert.deepEqual(f.calls.slice(prior),planned.map(fileFor));assert.notEqual(f.store.queryIndex,cache);f.store.dispose();
 });
 await test('A failed replacement query never commits partial positions or revives the previous index',async()=>{
  const f=fixture({maxCachedSearchSheets:0});await f.store.search({domain:'crisis'});f.hook=file=>{if(file===fileFor(planned[1]))throw Error('transport offline');};await assert.rejects(f.store.search(all),/transport offline/);assert.equal(f.store.queryIndex,null);f.hook=null;const r=await f.store.search(all);assert.equal(r.total,57631);f.store.dispose();
 });
 await test('Cancellation during a complete scan discards partial positions and stops before the next table',async()=>{
  const f=fixture(),c=new AbortController();let steps=0;await assert.rejects(f.store.search(all,{signal:c.signal,onProgress:()=>{steps++;c.abort();}}),e=>e.name==='AbortError');assert.equal(steps,1);assert.equal(f.store.queryIndex,null);assert.equal(f.calls.length,2);const r=await f.store.search(all);assert.equal(r.total,57631);f.store.dispose();
 });
 await test('Cancelling a cached-page transport cannot restore its index when transport ignores the signal',async()=>{
  const f=fixture({maxCachedSearchSheets:0});await f.store.search(all);let resume;f.hook=()=>new Promise(r=>resume=r);const c=new AbortController(),p=f.store.search(all,{offset:24,signal:c.signal});await waitUntil(()=>resume);c.abort();resume();await assert.rejects(p,e=>e.name==='AbortError');assert.equal(f.store.queryIndex,null);f.store.dispose();
 });
 await test('clearCaches invalidates a suspended page and neither its rows nor index can repopulate caches',async()=>{
  const f=fixture({maxCachedSearchSheets:0});await f.store.search(all);let resume;f.hook=()=>new Promise(r=>resume=r);const p=f.store.search(all,{offset:24});await waitUntil(()=>resume);f.store.clearCaches();resume();await assert.rejects(p,e=>e.name==='AbortError');assert.equal(f.store.queryIndex,null);assert.equal(f.store.index,null);assert.equal(f.store.searchCache.size,0);f.hook=null;assert.equal((await f.store.search({domain:'crisis'})).total,166);f.store.dispose();
 });
 await test('A newer search supersedes an older suspended scan and the late scan cannot overwrite its index',async()=>{
  let resume,pause=true;const f=fixture({yieldNow:()=>pause?(pause=false,new Promise(r=>resume=r)):Promise.resolve()});const old=f.store.search(all);await waitUntil(()=>resume);const latest=await f.store.search({domain:'crisis'}),cache=f.store.queryIndex;assert.equal(latest.total,166);resume();await assert.rejects(old,e=>e.name==='AbortError');assert.equal(f.store.queryIndex,cache);assert.equal(cache.total,166);f.store.dispose();
 });
 await test('Direct index and source-sheet retries invalidate a previously completed query index',async()=>{
  for(const method of ['index','sheet']){const f=fixture();await f.store.search({domain:'crisis'});assert(f.store.queryIndex);if(method==='index')await f.store.loadIndex(undefined,{retry:true});else await f.store.loadSearchSheet('CrisisDB - Crisis consequences',undefined,{retry:true});assert.equal(f.store.queryIndex,null);f.store.dispose();}
 });
 await test('Disposal discards positions and permanently rejects later cached pages',async()=>{
  const f=fixture();await f.store.search({domain:'crisis'});f.store.dispose();assert.equal(f.store.queryIndex,null);await assert.rejects(f.store.search({domain:'crisis'},{offset:24}),e=>e.name==='AbortError');
 });
 await test('A corrupt reopened table fails its original checksum and cannot reuse old query metadata',async()=>{
  const f=fixture({maxCachedSearchSheets:0});await f.store.search(all);f.hook=(file,bytes)=>{const bad=Buffer.from(bytes);bad[20]^=1;return bad;};await assert.rejects(f.store.search(all,{offset:24}),/checksum/);assert.equal(f.store.queryIndex,null);f.hook=null;assert.equal((await f.store.search(all,{retry:true})).total,57631);f.store.dispose();
 });
 await test('A progress callback failure cannot commit otherwise complete or partial results',async()=>{
  const f=fixture();await assert.rejects(f.store.search({domain:'crisis'},{onProgress(){throw Error('consumer failure');}}),/consumer failure/);assert.equal(f.store.queryIndex,null);assert.equal((await f.store.search({domain:'crisis'})).total,166);f.store.dispose();
 });
}finally{globalThis.fetch=originalFetch;for(const f of fixtures.values())f.store.dispose();}
const report={method:'Production PolarisStore and readPolarisJSON execute against actual pinned gzip bytes; both SHA-256 checks, original source rows, lifecycle gates and network-request counts are asserted. No browser performance claim.',passed:tasks.filter(t=>t.passed).length,total:tasks.length,checks:tasks};
if(process.env.POLARIS_PAGINATION_REPORT)await writeFile(process.env.POLARIS_PAGINATION_REPORT,JSON.stringify(report,null,2)+'\n');console.log(`${report.passed}/${report.total} pagination checks passed`);if(report.passed!==report.total)process.exitCode=1;
