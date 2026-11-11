import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';
import {curvedBorders,borderChordError} from '../public/border-curves.js';import {boundaryMesh} from '../public/boundary-mesh.js';
import {AtlasMap} from '../public/map-engine.js';
const read=p=>JSON.parse(gunzipSync(fs.readFileSync('public/data/'+p))),cat=read('fast/catalog.json.gz'),results=[];
const rings=g=>g.type==='Polygon'?g.coordinates:g.coordinates.flat();
const area=r=>r.slice(1).reduce((a,p,i)=>a+r[i][0]*p[1]-p[0]*r[i][1],0)/2;
assert.deepEqual([1,3.99,4,5.99,6,7.99,8,12,undefined].map(borderChordError),[.1,.1,.02,.02,.005,.005,.002,.002,.002]);
for(const year of [1492,1500,1945]){
 const pack=read(`native/year-${year}.json.gz`),rs=cat.records.filter(r=>r.type==='POLITY'&&r.start<=year&&year<=r.end),raw={type:'FeatureCollection',features:rs.map(r=>({type:'Feature',properties:{id:r.id},geometry:pack.geometries[pack.recordIndex[r.id]]}))};const before=JSON.stringify(raw);let fineBytes;
 for(const tolerance of [.002,.005,.02,.1]){
  const start=performance.now(),out=curvedBorders(raw,tolerance),mesh=boundaryMesh(out),ms=performance.now()-start,bytes=JSON.stringify({features:[...out.features,...mesh.features]}).length;
  if(tolerance===.002)fineBytes=bytes;assert.equal(curvedBorders(raw,tolerance),out);assert.equal(JSON.stringify(raw),before);assert.equal(out.features.length,raw.features.length);
  const reverse=curvedBorders({...raw,features:[...raw.features].reverse()},tolerance);
  for(let i=0;i<out.features.length;i++){
   const original=rings(raw.features[i].geometry),derived=rings(out.features[i].geometry);assert.equal(original.length,derived.length);assert.deepEqual(out.features[i].geometry,reverse.features.find(f=>f.properties.id===out.features[i].properties.id).geometry);
   for(let j=0;j<original.length;j++){assert.deepEqual(derived[j][0],derived[j].at(-1));const a=area(original[j]),b=area(derived[j]);if(a){assert(a*b>0);assert(Math.abs(b/a-1)<=.02000001);}else assert.deepEqual(derived[j],original[j]);}
  }
  results.push({year,tolerance,ms,bytes,reductionFromFinest:1-bytes/fineBytes});
 }
 assert(results.at(-1).reductionFromFinest>.7);
 // Zoom changes must rebuild the submitted display; same-level changes reuse it.
 let zoom=1;const payloads=[],atlas={map:{getZoom:()=>zoom,getSource:()=>source},smoothBorders:true,boundaries:{isCountry:false}},source={setData:d=>payloads.push(d)};
 AtlasMap.prototype.displayTerritories.call(atlas,raw);const coarse=payloads.at(-1);zoom=8;AtlasMap.prototype.displayTerritories.call(atlas,raw);assert.notDeepEqual(coarse,payloads.at(-1));assert.deepEqual(payloads.at(-1).features.slice(0,rs.length),curvedBorders(raw).features);zoom=2;AtlasMap.prototype.displayTerritories.call(atlas,raw);assert.deepEqual(payloads.at(-1),coarse);assert.equal(atlas.rawTerritories,raw);
}
// Run every existing collision/area fixture at each new tolerance, using the actual module.
const source=fs.readFileSync('scripts/validate-border-envelopes.mjs','utf8');
for(const tolerance of [.1,.02,.005]){const code=source.replace("new URL('../public/border-curves.js',import.meta.url)","new URL('file://'+process.cwd()+'/public/border-curves.js')").replaceAll('m.curvedBorders(',`((x)=>m.curvedBorders(x,${tolerance}))(`);await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));}
fs.mkdirSync('docs/verification-3.50',{recursive:true});fs.writeFileSync('docs/verification-3.50/border-sampling.json',JSON.stringify({ok:true,scope:'Three real global frames, all four display levels, source immutability, ring closure/area, order independence, zoom restore, all existing envelope fixtures at each new level. Node timings are not browser speed.',results},null,2)+'\n');console.log('PASS adaptive border sampling',results);
