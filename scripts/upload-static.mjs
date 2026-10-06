import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const routeBase='/__atlas-static-import/';
export async function uploadStatic({origin,token,manifest,publicDir,concurrency=2,fetchImpl=fetch,delay=ms=>new Promise(r=>setTimeout(r,ms)),timeoutMs=120000,onProgress=()=>{}}){
 const parsed=new URL(origin);origin=parsed.origin;
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||typeof token!=='string'||!token)throw Error('A verified private Site service credential is required');
 if(manifest.schemaVersion!==1||!Array.isArray(manifest.files)||manifest.revision!==hash(JSON.stringify(manifest.files))||manifest.bytes!==manifest.files.reduce((n,f)=>n+f.bytes,0))throw Error('Local manifest identity mismatch');
 const paths=new Set();
 for(const f of manifest.files){
  if(!/^data\/(?:(?:ohm-eastasia|ohm-1500)\/year--?\d+\.json\.gz|cshapes\/decade-\d+\.json\.gz|seshat\/sources\/code-book-4\.20\.2021\.pdf|native\/temporal\/pack-\d{3}\.json\.gz)$/.test(f.file)||paths.has(f.file)||f.key!==`atlas-static/sha256/${f.sha256}`)throw Error('Invalid local manifest path/key');paths.add(f.file);
  const data=fs.readFileSync(path.join(publicDir,f.file));if(data.length!==f.bytes||hash(data)!==f.sha256)throw Error('Local asset checksum failed: '+f.file);
 }
 async function request(route,options={},binary=false){
  for(let attempt=0;attempt<3;attempt++){
   try{
    const response=await fetchImpl(origin+route,{...options,redirect:'error',signal:AbortSignal.timeout(timeoutMs),headers:{...options.headers,'X-Atlas-Manifest':manifest.revision,'OAI-Sites-Authorization':'Bearer '+token}});
    if(response.ok)return binary?new Uint8Array(await response.arrayBuffer()):await response.json();
    await response.arrayBuffer();const error=Error(`${options.method||'GET'} ${route}: HTTP ${response.status}`);error.retryable=response.status>=500||response.status===429;throw error;
   }catch(error){if(error.retryable===false||attempt===2)throw Error(error.retryable!==undefined?error.message:`${options.method||'GET'} ${route}: request failed`);await delay(1000*2**attempt);}
  }
 }
 const status=await request(routeBase+'status');
 if(status.revision!==manifest.revision||status.files!==manifest.files.length||status.bytes!==manifest.bytes||!status.assetsAvailable||!Number.isFinite(status.importUntil)||status.importUntil<=Date.now())throw Error('Cloud bindings, import window or static manifest do not match this build');
 const previous=await request(routeBase+'inventory');if(previous.revision!==manifest.revision||!Array.isArray(previous.files))throw Error('Cloud inventory manifest mismatch');
 const have=new Map(previous.files.map(f=>[f.file,f]));
 const pending=manifest.files.filter(f=>have.get(f.file)?.sha256!==f.sha256||have.get(f.file)?.bytes!==f.bytes||have.get(f.file)?.key!==f.key);
 let cursor=0,uploaded=0;const workers=Number.isInteger(concurrency)?Math.max(1,Math.min(2,concurrency)):2;
 onProgress({phase:'verified',pending:pending.length,total:manifest.files.length});
 const jobs=Array.from({length:workers},async()=>{while(cursor<pending.length){const f=pending[cursor++],data=fs.readFileSync(path.join(publicDir,f.file));if(data.length!==f.bytes||hash(data)!==f.sha256)throw Error('Local asset changed during upload: '+f.file);
  const result=await request(routeBase+f.file,{method:'PUT',headers:{'Content-Type':'application/octet-stream','Content-Length':String(data.length)},body:data});
  if(!result.stored||result.key!==f.key||result.file!==f.file||result.sha256!==f.sha256||result.bytes!==f.bytes)throw Error('Storage confirmation mismatch: '+f.file);uploaded++;onProgress({phase:'stored',completed:uploaded,total:pending.length});
 }});
 const outcomes=await Promise.allSettled(jobs);const failed=outcomes.find(x=>x.status==='rejected');if(failed)throw failed.reason;
 const inventory=await request(routeBase+'inventory');if(inventory.revision!==manifest.revision)throw Error('Cloud inventory revision changed');const stored=new Map(inventory.files.map(f=>[f.file,f]));
 for(const f of manifest.files)if(stored.get(f.file)?.key!==f.key||stored.get(f.file)?.sha256!==f.sha256||stored.get(f.file)?.bytes!==f.bytes)throw Error('Incomplete stored inventory: '+f.file);
 // Verify EVERY selected asset through its unchanged application URL; do not
 // count a successful PUT or storage metadata as a complete read-back audit.
 cursor=0;const checked=[];
 const reads=Array.from({length:workers},async()=>{while(cursor<manifest.files.length){const f=manifest.files[cursor++],data=await request('/'+f.file,{headers:{'Cache-Control':'no-cache'}},true);if(data.length!==f.bytes||hash(data)!==f.sha256)throw Error('Read-back checksum mismatch: '+f.file);checked.push(f.file);onProgress({phase:'read-back',completed:checked.length,total:manifest.files.length});}});
 const readOutcomes=await Promise.allSettled(reads);const readFailed=readOutcomes.find(x=>x.status==='rejected');if(readFailed)throw readFailed.reason;
 return {status:'passed',revision:manifest.revision,expectedFiles:manifest.files.length,uploadedFiles:uploaded,reusedFiles:manifest.files.length-uploaded,storedBytes:manifest.bytes,allUploadHashesVerified:true,allStoredMetadataMatched:true,readBackFiles:checked.sort(),allReadBackHashesVerified:true,completedAt:new Date().toISOString()};
}
async function privateInput(){
 if(!process.stdin.isTTY)throw Error('Use a private interactive input channel');
 process.stdin.setRawMode(true);process.stdin.resume();console.log('Ready for private Site service input (input is hidden).');
 try{return await new Promise((resolve,reject)=>{let buffer='';const onData=chunk=>{buffer+=chunk;if(buffer.includes('\u0003')){process.stdin.off('data',onData);buffer='';reject(Error('Cancelled'));return;}if(buffer.length>65536){process.stdin.off('data',onData);buffer='';reject(Error('Service input too large'));return;}if(buffer.includes('\n')){process.stdin.off('data',onData);try{const parsed=JSON.parse(buffer.slice(0,buffer.indexOf('\n')));buffer='';resolve(parsed);}catch{buffer='';reject(Error('Invalid service input'));}}};process.stdin.on('data',onData);});}
 finally{process.stdin.setRawMode(false);process.stdin.pause();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const input=await privateInput(),manifest=JSON.parse(fs.readFileSync(path.join(root,'build/static-storage-manifest.json')));
  const report=await uploadStatic({...input,manifest,publicDir:path.join(root,'public'),onProgress:p=>console.log(JSON.stringify(p))});
  fs.writeFileSync(path.join(root,'build/static-storage-audit.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
