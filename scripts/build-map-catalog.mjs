import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {mapCatalogRange,mapCatalogPath} from '../public/map-catalog.js';

const root=fileURLToPath(new URL('../',import.meta.url)),sourceFile=path.join(root,'public/data/fast/catalog.json.gz');
const sourceBytes=fs.readFileSync(sourceFile),source=JSON.parse(gunzipSync(sourceBytes)),hash=bytes=>createHash('sha256').update(bytes).digest('hex'),sourceHash=hash(sourceBytes);
const check=process.argv.includes('--check'),folder=path.join(root,'public/data/fast/map-catalog');
const changeYears=[...new Set(source.records.filter(r=>r.type==='POLITY').flatMap(r=>[r.start,r.end===-1?1:r.end+1]))].filter(y=>y&&y>=-3400&&y<=2024).sort((a,b)=>a-b);
const ranges=new Map([[mapCatalogPath(-70000),null]]);
for(let year=-3400;year<=2024;year++){if(!year)continue;const range=mapCatalogRange(year);ranges.set(mapCatalogPath(year),range);}
const assets=[];
function output(file,bytes){if(check){if(!fs.existsSync(file)||!fs.readFileSync(file).equals(bytes))throw Error(`Stale map catalog asset: ${path.relative(root,file)}`);}else{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);}}
for(const [relative,range] of ranges){
 const records=range?source.records.filter(r=>r.start<=range[1]&&r.end>=range[0]):[];
 const geometryIndex=Object.fromEntries(records.map(r=>[r.geometryId,source.geometryIndex[r.geometryId]]));
 const catalog={version:source.version,records,geometryIndex,metadata:source.metadata,changeYears,mapCatalog:{schemaVersion:1,range,sourceRecordCount:source.records.length,sourceCatalogSHA256:sourceHash}};
 const raw=Buffer.from(JSON.stringify(catalog)),bytes=gzipSync(raw,{level:9});output(path.join(root,'public',relative),bytes);
 assets.push({file:path.basename(relative),range,records:records.length,bytes:bytes.length,sha256:hash(bytes)});
}
const expected=new Set(assets.map(a=>a.file));for(const file of fs.existsSync(folder)?fs.readdirSync(folder):[])if(file.endsWith('.json.gz')&&!expected.has(file))throw Error(`Unexpected obsolete map catalog asset: ${file}`);
const manifest={schemaVersion:1,method:'25 civil-year windows, without year zero; original complete records, geometry references and metadata preserved. Full catalog remains separate.',sourceCatalog:'data/fast/catalog.json.gz',sourceCatalogSHA256:sourceHash,sourceBytes:sourceBytes.length,sourceRecords:source.records.length,globalChangeYears:changeYears.length,files:assets.length,totalBytes:assets.reduce((n,a)=>n+a.bytes,0),assets};
output(path.join(folder,'manifest.json'),Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
console.log(JSON.stringify({check,files:manifest.files,totalBytes:manifest.totalBytes,sourceBytes:sourceBytes.length,samples:[-250,2,742,1492,1914,2024].map(year=>({year,...assets.find(a=>a.file===path.basename(mapCatalogPath(year)))}))},null,2));
