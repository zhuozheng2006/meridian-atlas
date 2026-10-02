import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
if(!process.stdin.isTTY)throw Error('Use a private interactive input channel');
process.stdin.setRawMode(true);process.stdin.resume();
console.log('Ready for private Site service input (input is hidden).');
const input=await new Promise((resolve,reject)=>{let buffer='';const onData=chunk=>{buffer+=chunk;if(buffer.includes('\u0003'))reject(Error('Cancelled'));if(buffer.includes('\n')){process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();try{resolve(JSON.parse(buffer.slice(0,buffer.indexOf('\n'))));}catch{reject(Error('Invalid service input'));}}};process.stdin.on('data',onData);});
const origin=new URL(input.origin).origin;if(!origin.startsWith('https://')||typeof input.token!=='string'||!input.token)throw Error('A verified private Site service credential is required');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'build/lake-storage-manifest.json'))),base=path.join(root,'public/data/lakes');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function request(route,options={}){
 for(let attempt=0;attempt<3;attempt++){
  const r=await fetch(origin+route,{...options,redirect:'error',signal:AbortSignal.timeout(60000),headers:{...options.headers,'OAI-Sites-Authorization':'Bearer '+input.token}});
  if(r.ok)return r;
  if(attempt<2&&(r.status>=500||r.status===429)){await r.arrayBuffer();await new Promise(resolve=>setTimeout(resolve,1000*2**attempt));continue;}
  throw Error(`${options.method||'GET'} ${route}: HTTP ${r.status}`);
 }
}
const status=await (await request('/__atlas-import/status')).json();
if(status.revision!==manifest.revision||!status.assetsAvailable)throw Error('Cloud bindings or data revision do not match the build');
const previous=await (await request('/__atlas-import/inventory')).json();
const have=new Map(previous.files.map(f=>[f.file,f]));
const pending=manifest.files.filter(f=>have.get(f.file)?.sha256!==f.sha256||have.get(f.file)?.bytes!==f.bytes);
let cursor=0,uploaded=0;
console.log(`Verified cloud bindings. ${pending.length} of ${manifest.files.length} files need upload.`);
const concurrency=Number.isInteger(input.concurrency)?Math.max(1,Math.min(16,input.concurrency)):6;
const jobs=Array.from({length:concurrency},async()=>{
 while(cursor<pending.length){
  const f=pending[cursor++],bytes=fs.readFileSync(path.join(base,f.file));if(bytes.length!==f.bytes||hash(bytes)!==f.sha256)throw Error('Local asset checksum failed: '+f.file);
  const result=await (await request('/__atlas-import/'+f.file,{method:'PUT',headers:{'Content-Type':'application/octet-stream','Content-Length':String(bytes.length)},body:bytes})).json();
  if(!result.stored||result.sha256!==f.sha256||result.bytes!==f.bytes)throw Error('Storage confirmation mismatch: '+f.file);
  uploaded++;if(uploaded%100===0)console.log(`Stored and verified ${uploaded}/${pending.length} files.`);
 }
});
const outcomes=await Promise.allSettled(jobs);if(outcomes.some(x=>x.status==='rejected'))throw outcomes.find(x=>x.status==='rejected').reason;
const inventory=await (await request('/__atlas-import/inventory')).json(),stored=new Map(inventory.files.map(f=>[f.file,f]));
for(const f of manifest.files)if(stored.get(f.file)?.sha256!==f.sha256||stored.get(f.file)?.bytes!==f.bytes)throw Error('Incomplete stored inventory: '+f.file);
const samples=[manifest.files[0],manifest.files.at(-1),manifest.files.reduce((a,b)=>a.bytes>b.bytes?a:b),...['0296.bin.gz','0822.bin.gz','2472.bin.gz'].map(name=>manifest.files.find(f=>f.file===name))];
const checked=[];
for(const f of samples){const bytes=new Uint8Array(await (await request('/data/lakes/'+f.file)).arrayBuffer());if(bytes.length!==f.bytes||hash(bytes)!==f.sha256)throw Error('Read-back checksum mismatch: '+f.file);checked.push(f.file);}
const report={status:'passed',revision:manifest.revision,expectedFiles:manifest.files.length,storedFiles:stored.size,storedBytes:manifest.bytes,allUploadHashesVerified:true,allStoredMetadataMatched:true,readBackSamples:checked,readBackHashesVerified:true,completedAt:new Date().toISOString()};
fs.writeFileSync(path.join(root,'build/lake-storage-audit.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
