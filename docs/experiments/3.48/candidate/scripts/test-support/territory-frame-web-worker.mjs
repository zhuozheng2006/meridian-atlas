import {parentPort,workerData} from 'node:worker_threads';
globalThis.self={addEventListener(type,fn){if(type==='message')parentPort.on('message',data=>fn({data}));},postMessage:data=>parentPort.postMessage(data)};
await import(workerData.entry);
