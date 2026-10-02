import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),source=path.join(root,'public'),output=path.join(root,'dist');
const m=JSON.parse(fs.readFileSync(path.join(source,'data/lakes/manifest.json')));
const files=m.shards.map(s=>({file:s.file,bytes:s.gzipBytes,sha256:s.sha256}));
const revision=crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0,24);
const manifest={revision,bytes:files.reduce((n,f)=>n+f.bytes,0),files};
const split=new Set(files.map(f=>path.join(source,'data/lakes',f.file)));
for(const f of files){const b=fs.readFileSync(path.join(source,'data/lakes',f.file));if(b.length!==f.bytes||crypto.createHash('sha256').update(b).digest('hex')!==f.sha256)throw Error('Invalid lake storage asset: '+f.file);}
let importUntil=0;const option=process.argv.indexOf('--import-until');
if(option>=0){importUntil=Date.parse(process.argv[option+1]);if(!Number.isFinite(importUntil)||importUntil<=Date.now()||importUntil>Date.now()+86400000)throw Error('Import window must end within 24 hours');}
if(fs.existsSync(output))fs.rmSync(output,{recursive:true});
fs.mkdirSync(path.join(output,'server'),{recursive:true});
fs.cpSync(source,path.join(output,'client'),{recursive:true,filter:entry=>!split.has(entry)});
const worker=fs.readFileSync(path.join(root,'worker/atlas-worker.mjs'),'utf8');
fs.writeFileSync(path.join(output,'server/index.js'),worker+'\nexport default createAtlasWorker('+JSON.stringify(manifest)+','+JSON.stringify({importUntil})+');\n');
fs.mkdirSync(path.join(output,'.openai'),{recursive:true});fs.copyFileSync(path.join(root,'.openai/hosting.json'),path.join(output,'.openai/hosting.json'));
fs.mkdirSync(path.join(root,'build'),{recursive:true});fs.writeFileSync(path.join(root,'build/lake-storage-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({revision,storageFiles:files.length,storageBytes:manifest.bytes,importUntil,worker:'dist/server/index.js',staticAssets:'dist/client'}));
