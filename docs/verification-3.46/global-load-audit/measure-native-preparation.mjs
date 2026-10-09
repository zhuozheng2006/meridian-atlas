import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=process.argv[2]||'/Users/zane/meridian_atlas/world-history-atlas',here=path.dirname(fileURLToPath(import.meta.url));
const {curvedBorders}=await import(pathToFileURL(path.join(root,'public/border-curves.js'))),{boundaryMesh}=await import(pathToFileURL(path.join(root,'public/boundary-mesh.js')));
const load=f=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'public',f))));
const catalog=load('data/fast/catalog.json.gz'),pack=load('data/native/year-1492.json.gz'),records=catalog.records.filter(r=>r.type==='POLITY'&&r.start<=1492&&r.end>=1492).sort((a,b)=>b.area-a.area);
const vertices=coords=>typeof coords?.[0]==='number'?1:coords.reduce((n,c)=>n+vertices(c),0),count=fc=>fc.features.reduce((n,f)=>n+vertices(f.geometry.coordinates),0),samples=[];
for(let run=0;run<3;run++){
 const raw={type:'FeatureCollection',features:records.map(r=>({type:'Feature',properties:{id:r.id,color:'#c6a16d'},geometry:pack.geometries[pack.recordIndex[r.id]]}))};
 const t0=performance.now(),display=curvedBorders(raw),t1=performance.now(),lines=boundaryMesh(display),t2=performance.now();
 const combined={...display,features:[...display.features,...lines.features.map(f=>({...f,properties:{_atlasBoundaryLine:true}}))]},serialized=JSON.stringify(combined),t3=performance.now();
 samples.push({run,rawVertices:count(raw),displayVertices:count(display),lineVertices:count(lines),geojsonFeatures:combined.features.length,serializedBytes:Buffer.byteLength(serialized),curvedBordersMs:t1-t0,boundaryMeshMs:t2-t1,stringifyMs:t3-t2,totalPreparationMs:t3-t0});
}
const report={scope:'Bounded Node CPU observations on the actual 3.45 pure cartography modules and local 1492 data. No browser, network, worker indexing, GPU, frame, or before/after performance claim. Fresh FeatureCollection identity each run; same already-parsed input geometry.',node:process.version,samples};
fs.writeFileSync(path.join(here,'native-preparation-node.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
