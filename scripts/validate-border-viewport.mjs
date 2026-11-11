import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';
import {borderViewport,curvedBorders} from '../public/border-curves.js';import {boundaryMesh} from '../public/boundary-mesh.js';
const bounds=(w,s,e,n)=>({getWest:()=>w,getEast:()=>e,getSouth:()=>s,getNorth:()=>n});
assert.equal(borderViewport(bounds(-180,-80,180,80),8),null);assert.equal(borderViewport(bounds(115,20,125,35),3),null);assert.deepEqual(borderViewport(bounds(170,-10,-175,10),6),[165,-15,190,15]);
const read=p=>JSON.parse(gunzipSync(fs.readFileSync('public/data/'+p))),catalog=read('fast/catalog.json.gz'),results=[];
const rings=g=>g.type==='Polygon'?g.coordinates:g.coordinates.flat(),count=g=>rings(g).reduce((n,r)=>n+r.length,0),area=r=>r.slice(1).reduce((n,p,i)=>n+r[i][0]*p[1]-p[0]*r[i][1],0)/2;
for(const year of [500,1000,1492]){
 const pack=read('native/year-'+year+'.json.gz'),records=catalog.records.filter(r=>r.type==='POLITY'&&r.start<=year&&year<=r.end),raw={type:'FeatureCollection',features:records.map(r=>({type:'Feature',properties:{id:r.id},geometry:pack.geometries[pack.recordIndex[r.id]]}))},original=JSON.stringify(raw),box=borderViewport(bounds(116,27,123,34),8),full=curvedBorders(raw,.002),focused=curvedBorders(raw,.002,box);
 assert.equal(curvedBorders(raw,.002,box),focused);assert.equal(JSON.stringify(raw),original);assert.equal(focused.features.length,full.features.length);
 let points=0,fullPoints=0;for(let i=0;i<focused.features.length;i++){const a=rings(raw.features[i].geometry),b=rings(focused.features[i].geometry);assert.equal(a.length,b.length);points+=count(focused.features[i].geometry);fullPoints+=count(full.features[i].geometry);for(let j=0;j<a.length;j++){assert.deepEqual(b[j][0],b[j].at(-1));const before=area(a[j]),after=area(b[j]);if(before){assert(before*after>0);assert(Math.abs(after/before-1)<.0200001);}}}
 const bytes=x=>JSON.stringify({features:[...x.features,...boundaryMesh(x).features]}).length;results.push({year,fullPoints,focusedPoints:points,fullBytes:bytes(full),focusedBytes:bytes(focused)});assert(points<fullPoints*.6);assert.deepEqual(curvedBorders(raw,.002),full);
}
fs.writeFileSync('docs/verification-3.55/border-viewport.json',JSON.stringify({passed:true,scope:'Derived display vertices and renderer payload; not download speed or historical positional accuracy',results},null,2)+'\n');console.log(results);
