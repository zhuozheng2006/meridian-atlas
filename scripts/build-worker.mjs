import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),source=path.join(root,'public'),output=path.join(root,'dist');
const m=JSON.parse(fs.readFileSync(path.join(source,'data/lakes/manifest.json')));
const files=m.shards.map(s=>({file:s.file,bytes:s.gzipBytes,sha256:s.sha256}));
const revision=crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0,24);
const manifest={revision,bytes:files.reduce((n,f)=>n+f.bytes,0),files};
const split=new Set(files.map(f=>path.join(source,'data/lakes',f.file)));
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const staticFiles=[];
function addStatic(file,expected){
 const b=fs.readFileSync(path.join(source,file)),sha256=digest(b);
 if(expected&&(b.length!==expected.bytes||sha256!==expected.sha256))throw Error('Invalid audited static asset: '+file);
 staticFiles.push({file,bytes:b.length,sha256,key:'atlas-static/sha256/'+sha256,contentType:file.endsWith('.pdf')?'application/pdf':'application/octet-stream'});split.add(path.join(source,file));
}
for(const area of ['ohm-eastasia','ohm-1500','ohm-britain']){
 const data=JSON.parse(fs.readFileSync(path.join(source,'data',area,'manifest.json')));
 for(const f of Object.values(data.years)){if(!/^year--?\d+\.json\.gz$/.test(f.file))throw Error('Invalid OHM snapshot path');addStatic('data/'+area+'/'+f.file,{bytes:f.gzipBytes,sha256:f.sha256});}
}
const regionalTransport=JSON.parse(fs.readFileSync(path.join(source,'data/ohm-transport/manifest.json')));
for(const f of regionalTransport.files){
 if(!/^(?:central-europe|east-asia|british-isles)--?\d+\.json\.gz$/.test(f.file))throw Error('Invalid regional transport path');
 addStatic('data/ohm-transport/'+f.file,{bytes:f.bytes,sha256:f.sha256});
}
const chgis=JSON.parse(fs.readFileSync(path.join(source,'data/chgis/manifest.json')));
for(const f of chgis.files){if(!/^century--?\d+\.json\.gz$/.test(f.file))continue;addStatic('data/chgis/'+f.file,{bytes:f.bytes,sha256:f.sha256});}
const cshapes=JSON.parse(fs.readFileSync(path.join(source,'data/cshapes/manifest.json')));
for(const f of Object.values(cshapes.packs)){if(!/^decade-\d+\.json\.gz$/.test(f.file))throw Error('Invalid CShapes pack path');addStatic('data/cshapes/'+f.file,{bytes:f.bytes,sha256:f.sha256});}
const seshat=JSON.parse(fs.readFileSync(path.join(source,'data/seshat/provenance.json')));
const pdf='data/seshat/sources/code-book-4.20.2021.pdf';addStatic(pdf,{bytes:fs.statSync(path.join(source,pdf)).size,sha256:seshat.codebookSha256});
const native=JSON.parse(fs.readFileSync(path.join(source,'data/native/manifest.json')));
for(const f of native.temporalBundles){
 if(!/^temporal\/pack-\d{3}\.json\.gz$/.test(f.file))throw Error('Invalid native temporal path');
 addStatic('data/native/'+f.file,{bytes:f.gzipBytes,sha256:f.gzipSha256});
}
staticFiles.sort((a,b)=>a.file.localeCompare(b.file));
const staticManifest={schemaVersion:1,revision:digest(JSON.stringify(staticFiles)),bytes:staticFiles.reduce((n,f)=>n+f.bytes,0),files:staticFiles};
for(const f of files){const b=fs.readFileSync(path.join(source,'data/lakes',f.file));if(b.length!==f.bytes||crypto.createHash('sha256').update(b).digest('hex')!==f.sha256)throw Error('Invalid lake storage asset: '+f.file);}
let importUntil=0;const option=process.argv.indexOf('--import-until');
if(option>=0){importUntil=Date.parse(process.argv[option+1]);if(!Number.isFinite(importUntil)||importUntil<=Date.now()||importUntil>Date.now()+86400000)throw Error('Import window must end within 24 hours');}
if(fs.existsSync(output))fs.rmSync(output,{recursive:true});
fs.mkdirSync(path.join(output,'server'),{recursive:true});
fs.cpSync(source,path.join(output,'client'),{recursive:true,filter:entry=>path.basename(entry)!=='.DS_Store'&&!split.has(entry)});
const worker=fs.readFileSync(path.join(root,'worker/atlas-worker.mjs'),'utf8');
fs.writeFileSync(path.join(output,'server/index.js'),worker+'\nexport default createAtlasWorker('+JSON.stringify(manifest)+','+JSON.stringify({importUntil,staticManifest})+');\n');
fs.mkdirSync(path.join(output,'.openai'),{recursive:true});fs.copyFileSync(path.join(root,'.openai/hosting.json'),path.join(output,'.openai/hosting.json'));
fs.mkdirSync(path.join(root,'build'),{recursive:true});fs.writeFileSync(path.join(root,'build/lake-storage-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(root,'build/static-storage-manifest.json'),JSON.stringify(staticManifest,null,2)+'\n');
console.log(JSON.stringify({staticRevision:staticManifest.revision,staticStorageFiles:staticFiles.length,staticStorageBytes:staticManifest.bytes,revision,storageFiles:files.length,storageBytes:manifest.bytes,importUntil,worker:'dist/server/index.js',staticAssets:'dist/client'}));
