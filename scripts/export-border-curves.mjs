import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
// When maintained in scripts/, the default project is its parent checkout.
// Output is always explicit so routine validation cannot overwrite data assets.
const project=resolve(process.argv[2]||fileURLToPath(new URL('../',import.meta.url)));
assert(process.argv[3],'Usage: node export-real-curves.mjs [project-root] <work-output-directory>');
const modulePath=resolve(project,'public/border-curves.js');
const sourceModuleSha256=createHash('sha256').update(await readFile(modulePath)).digest('hex');
const {curvedBorders}=await import(pathToFileURL(resolve(project,'public/border-curves.js')));
const base=pathToFileURL(resolve(project,'public/data')+'/');
const out=pathToFileURL(resolve(process.argv[3])+'/');await mkdir(out,{recursive:true});
const read=async file=>JSON.parse(gunzipSync(await readFile(new URL(file,base))));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const rings=g=>g.type==='Polygon'?g.coordinates:g.coordinates.flat();
const catalog=await read('fast/catalog.json.gz');
const results=[];
for(const year of [-3400,-221,1,500,1000,1492,1500,1750,1914,1945,1991,2024]){
 const pack=await read(`native/year-${year}.json.gz`);
 const records=catalog.records.filter(r=>r.type==='POLITY'&&r.start<=year&&year<=r.end);
 const original={type:'FeatureCollection',features:records.map(r=>({type:'Feature',properties:{id:r.id,name:r.name},geometry:pack.geometries[pack.recordIndex[r.id]]}))};
 const before=hash(original),start=performance.now(),curved=curvedBorders(original),elapsedMs=performance.now()-start;
 assert.equal(hash(original),before,'Source geometry was mutated');assert.strictEqual(curvedBorders(original),curved);
 let protectedDatelineRings=0,protectedPolarRings=0;
 for(let i=0;i<original.features.length;i++){
  const a=original.features[i],b=curved.features[i];assert.deepEqual(b.properties,a.properties);
  const ar=rings(a.geometry),br=rings(b.geometry);assert.equal(ar.length,br.length);
  for(let j=0;j<ar.length;j++){
   const dateline=ar[j].some((p,k)=>k&&Math.abs(p[0]-ar[j][k-1][0])>180),polar=ar[j].some(p=>Math.abs(p[1])>80);
   if(dateline||polar)assert.deepEqual(br[j],ar[j]);
   protectedDatelineRings+=Number(dateline);protectedPolarRings+=Number(polar);
  }
 }
 const reversed=curvedBorders({...original,features:[...original.features].reverse()});
 const reversedMap=new Map(reversed.features.map(f=>[f.properties.id,f]));
 const orderDependentIds=curved.features.filter(f=>hash(f.geometry)!==hash(reversedMap.get(f.properties.id).geometry)).map(f=>f.properties.id);
 await writeFile(new URL(`${year}-original.geojson`,out),JSON.stringify(original));
 await writeFile(new URL(`${year}-curved.geojson`,out),JSON.stringify(curved));
 const changed=curved.features.filter((f,i)=>hash(f.geometry)!==hash(original.features[i].geometry)).length;
 results.push({year,records:records.length,changed,elapsedMs,sourceModuleSha256,protectedDatelineRings,protectedPolarRings,orderDependentIds,originalSha256:before,curvedSha256:hash(curved)});
 console.log(JSON.stringify(results.at(-1)));
}
await writeFile(new URL('export-audit.json',out),JSON.stringify(results,null,2));
assert.equal(createHash('sha256').update(await readFile(modulePath)).digest('hex'),sourceModuleSha256,'Source module changed during the audit');
assert.deepEqual(results.filter(r=>r.orderDependentIds.length).map(r=>({year:r.year,ids:r.orderDependentIds})),[],'Feature order changed the derived geometry');
