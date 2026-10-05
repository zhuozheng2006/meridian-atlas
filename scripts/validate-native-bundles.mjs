// Independent disk audit: compare every shipped bundle to the original per-geometry
// assets and the dated catalog. No builder output/report is used as the oracle.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {nativeTemporalBundles} from '../public/native-temporal-index.js';
const root=new URL('../public/',import.meta.url);
const read=p=>JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL(p,root))));
const index=read('data/native/index.json.gz'),catalog=read('data/fast/catalog.json.gz');
const records=catalog.records.filter(r=>r.type==='POLITY');
const packs=Object.entries(index.temporalBundles).map(([start,p])=>({start:+start,...p})).sort((a,b)=>a.start-b.start);
assert.deepEqual(nativeTemporalBundles,packs.map(p=>[p.start,p.end,p.file]),'Runtime temporal lookup equals the complete source index');
const originals=new Map();let recordCopies=0,geometryCopies=0;
assert.equal(packs[0].start,Math.min(...records.map(r=>r.start)));
assert.equal(packs.at(-1).end,Math.max(...records.map(r=>r.end)));
for(let i=0;i<packs.length;i++){
 const p=packs[i];assert(p.start<=p.end);if(i)assert.equal(p.start,packs[i-1].end+1,'No gap or overlap between packs');
 const data=read('data/native/'+p.file);assert.equal(data.version,1);assert.equal(data.start,p.start);assert.equal(data.end,p.end);
 const expected=records.filter(r=>r.start<=p.end&&r.end>=p.start);
 assert.deepEqual(Object.keys(data.recordIndex).sort(),expected.map(r=>r.id).sort(),p.file+' exact intersecting record membership');
 const gids=new Set();
 for(const r of expected){assert.equal(data.recordIndex[r.id],index.recordIndex[r.id]);gids.add(index.recordIndex[r.id]);recordCopies++;}
 assert.deepEqual(Object.keys(data.geometries).sort(),[...gids].sort());
 for(const gid of gids){if(!originals.has(gid))originals.set(gid,read('data/native/'+index.geometryIndex[gid])[gid]);assert.deepEqual(data.geometries[gid],originals.get(gid),p.file+' '+gid);geometryCopies++;}
}
console.log(JSON.stringify({pass:true,packs:packs.length,lookupEntries:nativeTemporalBundles.length,lookupBytes:fs.statSync(new URL('native-temporal-index.js',root)).size,uniqueSourceGeometries:originals.size,recordCopies,geometryCopies,scope:'Every bundled coordinate, ring order, record ID and date inclusion equals the original assets; source geometric accuracy is unchanged.'},null,2));
