import assert from 'node:assert/strict';import fs from 'node:fs';import {gzipSync} from 'node:zlib';import {randomBytes} from 'node:crypto';import {readJSON,forgetJSON} from '../public/map-engine.js';
const nativeFetch=fetch,NativeDS=DecompressionStream,checks=[],test=async(name,fn)=>{await fn();checks.push(name);};let count=0;
const url=()=>`data/native/stream-test-${++count}.json.gz`,value={text:'丝绸之路',data:[1,2,3]},gz=gzipSync(JSON.stringify(value));
const chunks=parts=>new Response(new ReadableStream({start(c){for(const p of parts)c.enqueue(p);c.close();}}));
try{
 await test('gzip magic split across individual bytes',async()=>{globalThis.fetch=async()=>chunks([gz.subarray(0,1),gz.subarray(1,2),gz.subarray(2)]);assert.deepEqual(await readJSON(url()),value);});
 await test('already decoded gzip asset and multibyte UTF-8',async()=>{const b=Buffer.from(JSON.stringify(value));globalThis.fetch=async()=>chunks([...b].map(x=>Uint8Array.of(x)));assert.deepEqual(await readJSON(url()),value);});
 await test('empty and truncated streams rejected',async()=>{for(const b of [Buffer.alloc(0),gz.subarray(0,gz.length-5)]){globalThis.fetch=async()=>chunks([b]);await assert.rejects(readJSON(url()));}});
 await test('network body failure and retry',async()=>{const u=url();globalThis.fetch=async()=>new Response(new ReadableStream({start(c){c.enqueue(gz.subarray(0,2));c.error(Error('interrupted'));}}));await assert.rejects(readJSON(u));globalThis.fetch=async()=>chunks([gz]);assert.deepEqual(await readJSON(u),value);});
 await test('concurrent consumers share one fetch',async()=>{let calls=0;globalThis.fetch=async()=>{calls++;return chunks([gz]);};const u=url(),both=await Promise.all([readJSON(u),readJSON(u)]);assert.equal(calls,1);assert.strictEqual(both[0],both[1]);forgetJSON(u);await readJSON(u);assert.equal(calls,2);});
 await test('decompression produces output before download completes',async()=>{
  const payload={text:randomBytes(180000).toString('hex')},compressed=gzipSync(JSON.stringify(payload));let input,downloadFinished=false,decodedEarly=false,first;
  const observed=new Promise(r=>first=r);globalThis.DecompressionStream=class{constructor(format){const ds=new NativeDS(format);this.writable=ds.writable;this.readable=ds.readable.pipeThrough(new TransformStream({transform(chunk,c){if(!downloadFinished){decodedEarly=true;first();}c.enqueue(chunk);}}));}};
  globalThis.fetch=async()=>new Response(new ReadableStream({start(c){input=c;c.enqueue(compressed.subarray(0,Math.floor(compressed.length/2)));}}));
  const pending=readJSON(url());let timer;try{await Promise.race([observed,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Decoder waited for entire body')),3000))]);assert(decodedEarly);downloadFinished=true;input.enqueue(compressed.subarray(Math.floor(compressed.length/2)));input.close();assert.deepEqual(await pending,payload);}finally{clearTimeout(timer);globalThis.DecompressionStream=NativeDS;}
 });
 await test('HTTP errors rejected and non-gzip JSON preserved',async()=>{globalThis.fetch=async()=>new Response('',{status:503});await assert.rejects(readJSON(url()));globalThis.fetch=async()=>new Response(JSON.stringify(value));assert.deepEqual(await readJSON('stream-plain.json'),value);});
 const report={passed:true,checks,claims:'Decoded output starts before final network chunk. No wall-clock speedup percentage inferred.'};fs.writeFileSync('docs/verification-3.57/json-streaming.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}finally{globalThis.fetch=nativeFetch;globalThis.DecompressionStream=NativeDS;}
