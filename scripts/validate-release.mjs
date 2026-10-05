import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../public/',import.meta.url));
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>fs.readFileSync(path.join(root,p));
const json=p=>JSON.parse(p.endsWith('.gz')?zlib.gunzipSync(read(p)):read(p));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const files=walk(root);
assert(files.length<=20000,`Static asset budget exceeded: ${files.length}`);
for(const file of files)assert(fs.statSync(file).size<=25*1024*1024,`Oversize static asset: ${file}`);
console.log(`PASS Static asset budgets: ${files.length} files, no file over 25 MiB`);

const physical=json('data/physical/files.json');
for(const [file,meta] of Object.entries(physical)){
 const bytes=read('data/physical/'+file);assert.equal(bytes.length,meta.bytes,file);assert.equal(digest(bytes),meta.sha256,file);
}
const actualPhysical=walk(path.join(root,'data/physical')).map(f=>path.relative(path.join(root,'data/physical'),f)).filter(f=>f!=='files.json').sort();
assert.deepEqual(actualPhysical,Object.keys(physical).sort());
console.log(`PASS All ${actualPhysical.length} physical assets match the current release inventory`);

const native=json('data/native/manifest.json');
const pieces=[...native.shards,native.index,native.geometryAudit,...Object.values(native.bootstrap),...(native.temporalBundles||[])];
for(const meta of pieces){
 const compressed=read('data/native/'+meta.file);assert.equal(compressed.length,meta.gzipBytes,meta.file);assert.equal(digest(compressed),meta.gzipSha256,meta.file);
 const raw=zlib.gunzipSync(compressed);assert.equal(raw.length,meta.bytes,meta.file);assert.equal(digest(raw),meta.sha256,meta.file);
}
console.log(`PASS All ${pieces.length} native archive pieces retain compressed and decoded hashes`);

const cities=json('data/places/city-sources.json.gz');let checked=0;
for(const [file,meta] of Object.entries(cities.files)){
 if(!fs.existsSync(path.join(root,'data/places',file)))continue; // Raw inputs are kept in the build cache.
 const bytes=read('data/places/'+file);assert.equal(bytes.length,meta.bytes,file);assert.equal(digest(bytes),meta.sha256,file);checked++;
}
assert(checked>=48);console.log(`PASS ${checked} derived place assets match their provenance manifest`);
console.log(JSON.stringify({result:'passed',checks:4,staticFiles:files.length,physicalFiles:actualPhysical.length,nativePieces:pieces.length,cityFiles:checked}));
