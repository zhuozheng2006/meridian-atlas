import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {decodeLakeArchive} from '../dist/lake-codec.js';
import {LakeCache,LakeLayer,lakeTier,containsLakeBounds,intersectsLakeBounds,selectLakeShards,decodeLakeFeature} from '../dist/lakes.js';
const results=[];const test=async(name,fn)=>{await fn();results.push(name);console.log('PASS '+name);};
const bbox=[134,34,137,37],feature={type:'Feature',id:1,bbox,properties:{id:1,type:3,area:673.48,name:'Biwa'},geometry:{type:'Polygon',deltas:[[[135000000,35000000,1000000,0,0,1000000,-1000000,0,0,-1000000]]]}};
const shard={file:'one.json.gz',minZoom:4,bbox,count:1,vertices:5};const data={encoding:'delta-1e6',features:[feature]},index={schemaVersion:1,shards:[shard]};
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
await test('Fixed binary fixture decodes area, identity and every unchanged coordinate delta',()=>{
 const bytes=Buffer.from('4d4c4b31014a03948e04febedf8001febab021c2843dc2843d01010105020280897a000080897aff887a0000ff887a','hex');
 const f=decodeLakeArchive(bytes).features[0];assert.equal(f.id,37);assert.deepEqual(f.properties,{id:37,type:3,area:673.48});assert.deepEqual(f.geometry,feature.geometry);
 assert(f.bbox[0]<135&&f.bbox[1]<35&&f.bbox[2]>136&&f.bbox[3]>36);
});
await test('Corrupt, truncated and oversized binary lake data fail without a partial result',()=>{
 const b=Buffer.from('4d4c4b31014a03948e04febedf8001febab021c2843dc2843d01010105020280897a000080897aff887a0000ff887a','hex');
 for(let i=0;i<b.length;i++)assert.throws(()=>decodeLakeArchive(b.subarray(0,i)));
 assert.throws(()=>decodeLakeArchive(Buffer.concat([b,Buffer.from([0])])));
 assert.throws(()=>decodeLakeArchive(Buffer.from('4d4c4b31ffffffffffffffff7f','hex')));
 assert.throws(()=>decodeLakeArchive(Buffer.from('4d4c4b31d10f','hex')));
});
function environment(options={}){
 const events={},writes=[],paints=[];let zoom=10,bounds=[135,35,136,36],loaded=false;
 const atlas={destroyed:false};
 const map={getZoom:()=>zoom,getBounds:()=>({getWest:()=>bounds[0],getSouth:()=>bounds[1],getEast:()=>bounds[2],getNorth:()=>bounds[3]}),addSource(){},addLayer(){},on:(t,f)=>(events[t]??=[]).push(f),off:(t,f)=>events[t]=events[t].filter(x=>x!==f),getSource:()=>({setData:d=>{loaded=false;writes.push(d);}}),isSourceLoaded:()=>loaded,setPaintProperty:(...args)=>paints.push(args)};
 const geo={map,atlas,enabled:true,reference:false,referenceVisibility(){},syncStatus(){}};
 const layer=new LakeLayer(geo,{getIndex:async()=>index,getShard:async()=>data,...options});
 return {layer,map,geo,atlas,writes,paints,emit:(t,d)=>{for(const f of events[t]||[])f(d);},zoom:v=>zoom=v,bounds:v=>bounds=v,loaded:v=>loaded=v};
}
await test('Area tiers change only at declared zoom thresholds',()=>assert.deepEqual([3.99,4,5.99,6,8.99,9,14].map(lakeTier),[0,4,4,6,6,9,9]));
await test('Spatial selection includes date-line crossings and repeated world copies',()=>{
 for(const b of [[178,-10,182,10],[178,-10,-178,10],[538,-10,542,10]])assert(intersectsLakeBounds([-180,-5,-179,5],b));
 assert(!intersectsLakeBounds([10,-5,20,5],[178,-10,182,10]));assert(!intersectsLakeBounds([0,50,20,60],[-180,-10,180,10]));
 assert.equal(selectLakeShards(index,[135,35,136,36],3).length,0);assert.equal(selectLakeShards(index,[135,35,136,36],4).length,1);
});
await test('Delta decoding preserves closed rings and polygon holes',()=>{
 const d=decodeLakeFeature(feature);assert.deepEqual(d.geometry.coordinates[0],[[135,35],[136,35],[136,36],[135,36],[135,35]]);
 const m=decodeLakeFeature({...feature,geometry:{type:'MultiPolygon',deltas:[feature.geometry.deltas[0],feature.geometry.deltas[0]]}});assert.equal(m.geometry.coordinates.length,2);
 assert.equal(decodeLakeFeature(d),d);
});
await test('Concurrent comparison maps share one request',async()=>{let calls=0;const d=defer(),c=new LakeCache(()=>{calls++;return d.promise;});const a=c.get(shard),b=c.get(shard);d.resolve(data);assert.deepEqual(await a,await b);assert.equal(calls,1);});
await test('Failed and malformed shards leave the cache retryable',async()=>{let calls=0;const c=new LakeCache(async()=>{calls++;if(calls===1)throw Error('offline');if(calls===2)return {encoding:'wrong',features:[]};return data;});await assert.rejects(c.get(shard));await assert.rejects(c.get(shard));assert.equal((await c.get(shard)).features.length,1);assert.equal(calls,3);});
await test('Completed LRU entries stay within the vertex budget',async()=>{const c=new LakeCache(async()=>data,7);await c.get(shard);await c.get({...shard,file:'two'});assert.equal(c.entries.size,1);assert.equal(c.vertices,5);});
await test('The overview survives decoding and worker loading until the current tiles are ready',async()=>{const e=environment();await e.layer.update();assert.equal(e.layer.ready,false);assert.equal(e.layer.status,'rendering');e.emit('idle');assert.equal(e.layer.ready,false);e.loaded(true);e.emit('idle');assert.equal(e.layer.ready,true);assert.equal(e.layer.count,1);});
await test('Moving invalidates readiness and prevents a stale response from drawing',async()=>{const d=defer(),e=environment({getShard:()=>d.promise});const job=e.layer.update();await tick();e.emit('movestart');d.resolve(data);await job;assert.equal(e.writes.length,0);assert.equal(e.layer.ready,false);});
await test('A late earlier viewport cannot replace a newer one',async()=>{const d=defer();let calls=0;const e=environment({getShard:()=>++calls===1?d.promise:Promise.resolve(data)});const old=e.layer.update();await tick();await e.layer.update();d.resolve(data);await old;assert.equal(e.writes.length,1);e.loaded(true);e.emit('idle');assert(e.layer.ready);});
await test('Small pans within the loaded margin retain fine shores without another fetch',async()=>{let requests=0;const e=environment({getShard:async()=>{requests++;return data;}});await e.layer.update();e.loaded(true);e.emit('idle');assert(e.layer.ready);e.emit('movestart');e.bounds([135.05,35,136.05,36]);e.emit('move');assert(e.layer.ready);await e.layer.update();assert.equal(requests,1);e.bounds([140,35,141,36]);e.emit('move');assert.equal(e.layer.ready,false);assert(containsLakeBounds([178,-5,184,5],[-180,-2,-179,2]));});
await test('A failed shard retains the overview and retry succeeds',async()=>{let n=0;const e=environment({getShard:async()=>{if(n++===0)throw Error('offline');return data;}});await e.layer.update();assert.equal(e.layer.status,'error');assert.equal(e.layer.ready,false);assert.equal(e.writes.length,0);await e.layer.update();e.loaded(true);e.emit('idle');assert(e.layer.ready);});
await test('Modern reference and disabled geography do not request natural lake detail',async()=>{let n=0;const e=environment({getIndex:async()=>{n++;return index;}});e.geo.reference=true;await e.layer.update();e.geo.reference=false;e.geo.enabled=false;await e.layer.update();assert.equal(n,0);});
await test('Late work after map destruction never mutates the removed map',async()=>{const d=defer(),e=environment({getShard:()=>d.promise});const pending=e.layer.update();await tick();const before=e.paints.length;e.atlas.destroyed=true;e.layer.destroy();d.resolve(data);await pending;assert.equal(e.writes.length,0);assert.equal(e.paints.length,before);});
await test('Invisible globe-side event markers do not suppress lake names; visible markers keep priority',async()=>{
 let opacity='0',removed=0;const rect={x:500,y:130,left:500,top:130,right:620,bottom:180,width:120,height:50};
 globalThis.document={querySelectorAll:()=>[{getClientRects:()=>[rect],getBoundingClientRect:()=>rect}],createElement:()=>({append(){}})};
 globalThis.getComputedStyle=()=>({visibility:'visible',opacity});
 globalThis.maplibregl={Marker:class{setLngLat(){return this;}addTo(){return this;}remove(){removed++;}}};
 try{const e=environment({getIndex:async()=>({...index,names:{1:{name:'Biwa',zh:'琵琶湖',center:[135.5,35.5]}}})});
  e.map.getContainer=()=>({getBoundingClientRect:()=>({left:0,top:0,right:1000,bottom:700})});e.map.project=([x,y])=>({x:(x-135)*120+500,y:(36-y)*100+100});
  await e.layer.update();e.loaded(true);e.emit('idle');assert.equal(e.layer.labels.length,1);
  opacity='1';e.layer.refreshLabels();assert.equal(e.layer.labels.length,0);assert.equal(removed,1);
 }finally{delete globalThis.document;delete globalThis.getComputedStyle;delete globalThis.maplibregl;}
});
await test('All archive shards have valid hashes, counts, class exclusions and coordinate encoding',()=>{
 const root=new URL('../dist/data/lakes/',import.meta.url),m=JSON.parse(fs.readFileSync(new URL('manifest.json',root)));let records=0,vertices=0;const ids=new Set();
 for(const meta of m.shards){const packed=fs.readFileSync(new URL(meta.file,root));assert.equal(packed.length,meta.gzipBytes);assert.equal(crypto.createHash('sha256').update(packed).digest('hex'),meta.sha256);const raw=zlib.gunzipSync(packed);assert.equal(raw.length,meta.bytes);const s=meta.file.endsWith('.bin.gz')?decodeLakeArchive(raw):JSON.parse(raw);assert.equal(s.encoding,'delta-1e6');assert.equal(s.features.length,meta.count);let count=0;
  for(const f of s.features){assert(!ids.has(f.id));ids.add(f.id);assert([1,3].includes(f.properties.type));assert(f.bbox[0]>=-180&&f.bbox[2]<=180&&f.bbox[1]>=-90&&f.bbox[3]<=90);const g=decodeLakeFeature(f);const ps=g.geometry.type==='Polygon'?[g.geometry.coordinates]:g.geometry.coordinates;for(const p of ps)for(const r of p){assert(r.length>=4);assert.deepEqual(r[0],r.at(-1));count+=r.length;}records++;}
  assert.equal(count,meta.vertices);vertices+=count;
 }
 assert.equal(records,1421001);assert.equal(records,m.includedRecords);assert.equal(vertices,m.vertices);assert.equal(m.sourceTypes['2'],6687);
 const indexBytes=fs.readFileSync(new URL('index.json.gz',root));assert.equal(indexBytes.length,m.index.gzipBytes);assert.equal(crypto.createHash('sha256').update(indexBytes).digest('hex'),m.index.sha256);const idx=JSON.parse(zlib.gunzipSync(indexBytes));assert.equal(Object.keys(idx.names).length,1115);assert.equal(Object.values(idx.names).filter(n=>n.zh).length,24);assert.equal(idx.shards.length,m.shards.length);for(let i=0;i<idx.shards.length;i++)for(const key of ['file','bbox','minZoom','count','vertices'])assert.deepEqual(idx.shards[i][key],m.shards[i][key]);
});
fs.writeFileSync(new URL('../docs/lake-validation-results.json',import.meta.url),JSON.stringify({status:'passed',checks:results.length,results},null,2));
console.log(JSON.stringify({status:'passed',checks:results.length}));
