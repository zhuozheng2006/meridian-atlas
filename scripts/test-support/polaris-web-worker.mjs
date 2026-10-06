// Node thread boundary for exercising the unchanged browser worker with audited files.
import {parentPort,workerData} from 'node:worker_threads';
import {readFile} from 'node:fs/promises';
const base=new URL('../../public/data/seshat-polaris-2026/',import.meta.url);
globalThis.self={location:{href:'https://atlas.test/polaris-search-worker.js'},postMessage:(value,transfer)=>parentPort.postMessage(value,transfer)};
globalThis.fetch=async(url,{signal}={})=>{if(signal?.aborted)throw new DOMException('Aborted','AbortError');const u=new URL(url),prefix='/data/seshat-polaris-2026/';if(u.origin!=='https://atlas.test'||!u.pathname.startsWith(prefix))throw Error('Test transport outside fixed archive');const file=u.pathname.slice(prefix.length);parentPort.postMessage({kind:'test-fetch',file});let bytes=await readFile(new URL(file,base));if(workerData.corrupt===file){bytes=Buffer.from(bytes);bytes[20]^=1;}return new Response(bytes,{status:200});};
await import(new URL('../../public/polaris-search-worker.js',import.meta.url));
parentPort.on('message',data=>self.onmessage({data}));
