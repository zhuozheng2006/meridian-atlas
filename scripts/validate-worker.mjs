import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {uploadStatic} from './upload-static.mjs';
import {createAtlasWorker} from '../worker/atlas-worker.mjs';
const bytes=Buffer.from('verified compressed lake bytes');const hash=createHash('sha256').update(bytes).digest('hex');
const manifest={revision:'fixture',bytes:bytes.length,files:[{file:'0000.bin.gz',bytes:bytes.length,sha256:hash}]};
let puts=0;const objects=new Map();
const env={ASSETS:{fetch:async()=>new Response('Atlas HTML')},BUCKET:{head:async k=>objects.get(k),get:async k=>{const o=objects.get(k);return o&&{...o,body:o.bytes};},put:async(k,b,opts)=>{puts++;objects.set(k,{key:k,size:b.length,bytes:b.slice(),customMetadata:opts.customMetadata,httpMetadata:opts.httpMetadata});},list:async({prefix='' }={})=>({objects:[...objects.values()].filter(o=>o.key.startsWith(prefix)),truncated:false})}};
const worker=createAtlasWorker(manifest,{importUntil:Date.now()+60000}),readOnly=createAtlasWorker(manifest);
const req=(path,opts)=>new Request('https://atlas.example'+path,opts),upload=data=>worker.fetch(req('/__atlas-import/0000.bin.gz',{method:'PUT',headers:{'content-type':'application/octet-stream'},body:data}),env);
const checks=[];async function test(name,fn){await fn();checks.push(name);console.log('PASS '+name);}
await test('Existing pages delegate to the asset binding',async()=>assert.equal(await (await worker.fetch(req('/'),env)).text(),'Atlas HTML'));
await test('Missing lake objects fail recoverably without a false empty map',async()=>assert.equal((await worker.fetch(req('/data/lakes/0000.bin.gz'),env)).status,503));
await test('Unknown objects and non-binary imports are rejected',async()=>{assert.equal((await worker.fetch(req('/__atlas-import/other',{method:'PUT',body:bytes}),env)).status,404);assert.equal((await worker.fetch(req('/__atlas-import/0000.bin.gz',{method:'PUT',body:bytes}),env)).status,415);});
await test('Wrong sizes and same-sized corrupt data cannot be stored',async()=>{assert.equal((await upload(bytes.subarray(1))).status,400);assert.equal((await upload(Buffer.alloc(bytes.length))).status,422);assert.equal(puts,0);});
await test('Audited bytes upload idempotently under a versioned key',async()=>{assert.equal((await upload(bytes)).status,200);assert.equal((await upload(bytes)).status,200);assert.equal(puts,1);assert(objects.has('hydrolakes/fixture/0000.bin.gz'));});
await test('Read, HEAD and conditional requests preserve the exact encoded bytes',async()=>{const r=await worker.fetch(req('/data/lakes/0000.bin.gz'),env);assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes);assert.equal(r.headers.get('etag'),`"${hash}"`);const h=await worker.fetch(req('/data/lakes/0000.bin.gz',{method:'HEAD'}),env);assert.equal((await h.arrayBuffer()).byteLength,0);assert.equal(h.headers.get('content-length'),String(bytes.length));assert.equal((await worker.fetch(req('/data/lakes/0000.bin.gz',{headers:{'If-None-Match':`"${hash}"`}}),env)).status,304);});
await test('Final builds disable every import route while keeping lake reads',async()=>{assert.equal((await readOnly.fetch(req('/__atlas-import/status'),env)).status,404);assert.equal((await readOnly.fetch(req('/__atlas-import/0000.bin.gz',{method:'PUT',body:bytes}),env)).status,404);assert.equal((await readOnly.fetch(req('/data/lakes/0000.bin.gz'),env)).status,200);});
await test('Cross-origin browser imports and expired import windows are rejected',async()=>{assert.equal((await worker.fetch(req('/__atlas-import/status',{headers:{Origin:'https://other.example'}}),env)).status,403);const expired=createAtlasWorker(manifest,{importUntil:Date.now()-1});assert.equal((await expired.fetch(req('/__atlas-import/status'),env)).status,404);});
await test('Missing storage and missing public assets return a recoverable unavailable state',async()=>{assert.equal((await worker.fetch(req('/data/lakes/0000.bin.gz'),{})).status,503);assert.equal((await worker.fetch(req('/'),{})).status,503);});

const samples=[['data/chgis/century--200.json.gz',Buffer.from([31,139,8,0,9,8,7])],['data/ohm-transport/east-asia-1300.json.gz',Buffer.from([31,139,8,0,6,7,8])],['data/native/temporal/pack-000.json.gz',Buffer.from([31,139,8,0,7,8,9])],['data/ohm-eastasia/year-1500.json.gz',Buffer.from([31,139,8,0,1,2,3])],['data/cshapes/decade-2000.json.gz',Buffer.from([31,139,8,0,4,5,6])],['data/seshat/sources/code-book-4.20.2021.pdf',Buffer.from('%PDF-1.7\nverified source')]];
const staticFiles=samples.map(([file,data])=>{const sha256=createHash('sha256').update(data).digest('hex');return {file,bytes:data.length,sha256,key:'atlas-static/sha256/'+sha256,contentType:file.endsWith('.pdf')?'application/pdf':'application/octet-stream'};}).sort((a,b)=>a.file.localeCompare(b.file));
const staticManifest={schemaVersion:1,revision:createHash('sha256').update(JSON.stringify(staticFiles)).digest('hex'),bytes:staticFiles.reduce((n,f)=>n+f.bytes,0),files:staticFiles};
const sw=createAtlasWorker(manifest,{importUntil:Date.now()+60000,staticManifest}),sf=createAtlasWorker(manifest,{staticManifest});
const sPut=(f,data,extra={})=>sw.fetch(req('/__atlas-static-import/'+f.file,{method:'PUT',headers:{'content-type':'application/octet-stream','X-Atlas-Manifest':staticManifest.revision,...extra},body:data}),env);
const sampleFor=f=>samples.find(x=>x[0]===f.file)[1];
await test('Static manifests and imports do not change the legacy lake identity or inventory',async()=>{
 const status=await (await sw.fetch(req('/__atlas-import/status'),env)).json();assert.equal(status.revision,'fixture');assert.equal(status.files,1);assert.equal(status.bytes,bytes.length);
 const inventory=await (await sw.fetch(req('/__atlas-import/inventory'),env)).json();assert.equal(inventory.files.length,1);assert.equal(inventory.files[0].file,'0000.bin.gz');
 assert.equal((await sw.fetch(req('/data/lakes/0000.bin.gz'),env)).status,200);
});
await test('Static import requires the exact manifest, listed path, binary type and bounded size',async()=>{
 const f=staticFiles[0];assert.equal((await sPut(f,sampleFor(f),{'X-Atlas-Manifest':'old'})).status,409);
 assert.equal((await sPut({...f,file:'data/cshapes/decade-1900.json.gz'},sampleFor(f))).status,404);
 assert.equal((await sPut(f,sampleFor(f),{'content-type':'application/json'})).status,415);
 assert.equal((await sPut(f,Buffer.alloc(1000000))).status,400);assert.equal((await sPut(f,sampleFor(f).subarray(1))).status,400);
 assert.equal((await sPut(f,sampleFor(f),{'content-length':'999'})).status,400);assert.equal((await sPut(f,Buffer.alloc(f.bytes))).status,422);
 assert.equal((await sw.fetch(req('/__atlas-static-import/inventory'),env)).status,409);
});
await test('Static imports use immutable per-content keys and reuse unchanged data',async()=>{
 for(const f of staticFiles){const before=puts;assert.equal((await sPut(f,sampleFor(f))).status,200);assert.equal((await sPut(f,sampleFor(f))).status,200);assert.equal(puts,before+1);assert(objects.has(f.key));}
 const changedManifest={...staticManifest,revision:'another-manifest'};const another=createAtlasWorker(manifest,{importUntil:Date.now()+60000,staticManifest:changedManifest});const f=staticFiles[0],before=puts;
 const r=await another.fetch(req('/__atlas-static-import/'+f.file,{method:'PUT',headers:{'content-type':'application/octet-stream','X-Atlas-Manifest':'another-manifest'},body:sampleFor(f)}),env);assert.equal((await r.json()).reused,true);assert.equal(puts,before);
});
await test('Unchanged client URLs serve exact gzip/PDF bytes with HEAD, ETag and no compression header',async()=>{
 for(const f of staticFiles){const r=await sf.fetch(req('/'+f.file),env);assert.deepEqual(Buffer.from(await r.arrayBuffer()),sampleFor(f));assert.equal(r.headers.get('content-type'),f.contentType);assert.equal(r.headers.get('content-encoding'),null);assert.equal(r.headers.get('cache-control'),'private, no-cache');
 const h=await sf.fetch(req('/'+f.file,{method:'HEAD'}),env);assert.equal((await h.arrayBuffer()).byteLength,0);assert.equal(h.headers.get('content-length'),String(f.bytes));assert.equal((await sf.fetch(req('/'+f.file,{headers:{'If-None-Match':`"${f.sha256}"`}}),env)).status,304);
 assert.equal((await sf.fetch(req('/'+f.file+'?v=an-older-ui'),env)).status,200);assert.equal((await sf.fetch(req('/'+f.file+'?sha256=wrong'),env)).status,412);
 }
});
await test('Missing or mismatched static objects fail 503 and unlisted data paths fail 404',async()=>{
 const f=staticFiles[0],o=objects.get(f.key);objects.delete(f.key);assert.equal((await sf.fetch(req('/'+f.file),env)).status,503);objects.set(f.key,{...o,customMetadata:{sha256:'bad'}});assert.equal((await sf.fetch(req('/'+f.file),env)).status,503);objects.set(f.key,{...o,size:o.size+1});assert.equal((await sf.fetch(req('/'+f.file),env)).status,503);objects.set(f.key,o);
 assert.equal((await sf.fetch(req('/data/ohm-eastasia/year-9999.json.gz'),env)).status,404);assert.equal(await(await sf.fetch(req('/data/cshapes/catalog.json.gz'),env)).text(),'Atlas HTML');
});
await test('Both import namespaces close in final builds and static CORS/expiration guards remain active',async()=>{
 for(const pathname of ['/__atlas-import/status','/__atlas-static-import/status','/__atlas-static-import/inventory','/__atlas-static-import/'+staticFiles[0].file])assert.equal((await sf.fetch(req(pathname),env)).status,404);
 assert.equal((await sw.fetch(req('/__atlas-static-import/status',{headers:{Origin:'https://other.example'}}),env)).status,403);
 const expired=createAtlasWorker(manifest,{importUntil:Date.now()-1,staticManifest});assert.equal((await expired.fetch(req('/__atlas-static-import/status'),env)).status,404);
 assert.equal((await readOnly.fetch(req('/__atlas-static-import/status'),env)).status,404);
});
await test('Static uploader retries transport/HTTP failures, preserves private header and verifies every file',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-static-upload-'));try{
 for(const [file,data] of samples){fs.mkdirSync(path.dirname(path.join(dir,file)),{recursive:true});fs.writeFileSync(path.join(dir,file),data);}
 for(const f of staticFiles)objects.delete(f.key);
 const reads=[],delays=[];let calls=0;
 const fetchImpl=async(url,opts)=>{assert.equal(opts.redirect,'error');assert.equal(opts.headers['OAI-Sites-Authorization'],'Bearer fixture-only');calls++;if(calls===1)throw Error('simulated reset');if(calls===2)return new Response('busy',{status:503});if(new URL(url).pathname.startsWith('/data/'))reads.push(new URL(url).pathname);return sw.fetch(new Request(url,opts),env);};
 const result=await uploadStatic({origin:'https://atlas.example',token:'fixture-only',manifest:staticManifest,publicDir:dir,fetchImpl,delay:async n=>delays.push(n)});
 assert.deepEqual(delays,[1000,2000]);assert.equal(result.uploadedFiles,samples.length);assert.equal(result.readBackFiles.length,samples.length);assert.deepEqual(reads.sort(),staticFiles.map(f=>'/'+f.file).sort());assert.equal(result.allReadBackHashesVerified,true);assert(!JSON.stringify(result).includes('fixture-only'));
 const result2=await uploadStatic({origin:'https://atlas.example',token:'fixture-only',manifest:staticManifest,publicDir:dir,fetchImpl,delay:async()=>{}});assert.equal(result2.uploadedFiles,0);assert.equal(result2.readBackFiles.length,samples.length);
 await assert.rejects(()=>uploadStatic({origin:'https://atlas.example',token:'fixture-only',manifest:{...staticManifest,revision:'stale'},publicDir:dir,fetchImpl}),/manifest identity/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
console.log(JSON.stringify({status:'passed',checks:checks.length}));
