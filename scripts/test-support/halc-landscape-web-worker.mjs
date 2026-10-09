// Test adapter only: real worker_threads executes the browser worker module.
import {parentPort,workerData} from 'node:worker_threads';
import fs from 'node:fs/promises';
const listeners=[];
globalThis.self={location:{href:'https://atlas.test/halc-landscape-worker.js',origin:'https://atlas.test'},addEventListener(type,fn){if(type==='message')listeners.push(fn);},postMessage(data){parentPort.postMessage(data);}};
globalThis.fetch=async function(url,options){if(this!==globalThis)throw TypeError('Illegal invocation: WorkerGlobalScope.fetch receiver');if(options.signal.aborted)throw Error('Aborted');const file=new URL(url).pathname.split('/data/halc-landscape/')[1];return new Response(await fs.readFile(new URL(file,workerData.dataRoot)));};
await import(workerData.entry);
parentPort.on('message',data=>{for(const fn of listeners)fn({data});});
