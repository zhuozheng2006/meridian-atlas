import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {polityName,polityNameGroupKey,polityChainBucket,groupPolityRecords,groupPolityIndex,searchPolityRecords,searchPolityIndex} from '../public/polity-names.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const readGz=rel=>JSON.parse(gunzipSync(fs.readFileSync(resolve(root,'public',rel))));
const readRaw=rel=>fs.readFileSync(resolve(root,'public',rel));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

// 1. Events index parity
const fullEvents=readGz('data/events.json.gz');
const slimEvents=readGz('data/fast/events-index.json.gz');
assert.equal(slimEvents.length,fullEvents.length,'events-index length must equal events.json.gz');
for(let i=0;i<fullEvents.length;i++){
 const f=fullEvents[i],s=slimEvents[i];
 assert.deepEqual(
  {id:s.id,title:s.title,start:s.start,end:s.end,lat:s.lat,lon:s.lon,region:s.region,category:s.category,precision:s.precision,locationType:s.locationType,provenance:s.provenance??null},
  {id:f.id,title:f.title,start:f.start,end:f.end,lat:f.lat,lon:f.lon,region:f.region,category:f.category,precision:f.precision,locationType:f.locationType,provenance:f.provenance??null},
  `events-index entry mismatch at index ${i} (${f.id})`
 );
}

// 2. Polity search index + sharded chain parity against catalog.json.gz
const catalogBytes=readRaw('data/fast/catalog.json.gz');
const catalogHash=sha256(catalogBytes);
const catalog=JSON.parse(gunzipSync(catalogBytes));
const searchIndexBytes=readRaw('data/fast/polity-search-index.json.gz');
const searchIndex=JSON.parse(gunzipSync(searchIndexBytes));
const manifest=JSON.parse(fs.readFileSync(resolve(root,'public/data/fast/polity-chains/manifest.json'),'utf8'));

assert.equal(searchIndex.sourceCatalogSHA256,catalogHash,'search index hash mismatch');
assert.equal(manifest.sourceCatalogSHA256,catalogHash,'manifest hash mismatch');
assert.equal(manifest.searchIndexSHA256,sha256(searchIndexBytes),'manifest searchIndexSHA256 mismatch');
assert.equal(manifest.eventsIndexSHA256,sha256(readRaw('data/fast/events-index.json.gz')),'manifest eventsIndexSHA256 mismatch');
assert.equal(manifest.files.length,searchIndex.buckets,'bucket file count mismatch');

const expectedPolities=catalog.records.filter(r=>r.type==='POLITY');
const expectedByGroup=new Map();
for(const r of expectedPolities){
 const key=polityNameGroupKey(r);
 if(!expectedByGroup.has(key))expectedByGroup.set(key,[]);
 expectedByGroup.get(key).push(r);
}
assert.equal(searchIndex.groups.length,expectedByGroup.size,'polity group count mismatch');

const seenRecordIds=new Set();
const bucketSeenGroups=new Set();
for(const entry of manifest.files){
 const rel=`data/fast/polity-chains/${entry.file}`;
 const raw=readRaw(rel);
 assert.equal(raw.length,entry.bytes,`byte size mismatch for ${rel}`);
 assert.equal(sha256(raw),entry.sha256,`sha256 mismatch for ${rel}`);
 const bundle=JSON.parse(gunzipSync(raw));
 assert.equal(bundle.sourceCatalogSHA256,catalogHash,`bundle hash mismatch in ${rel}`);
 assert.equal(bundle.bucket,entry.bucket,`bucket index mismatch in ${rel}`);
 for(const [key,recs] of Object.entries(bundle.chains)){
  assert.equal(polityChainBucket(key,searchIndex.buckets),entry.bucket,`wrong bucket for key ${key}`);
  assert(!bucketSeenGroups.has(key),`duplicate key across buckets: ${key}`);
  bucketSeenGroups.add(key);
  const expected=[...expectedByGroup.get(key)].sort((a,b)=>a.start-b.start||a.end-b.end||a.id.localeCompare(b.id));
  assert.deepEqual(recs,expected,`chain records mismatch for ${key}`);
  for(const r of recs)seenRecordIds.add(r.id);
 }
}
assert.equal(bucketSeenGroups.size,expectedByGroup.size,'total grouped keys across buckets mismatch');
assert.equal(seenRecordIds.size,expectedPolities.length,'total POLITY records across buckets mismatch');

// 3. Group & search parity across representative historical years
for(const year of [-250,2,742,1492,1900,2024]){
 const fullGroups=groupPolityRecords(catalog.records,year);
 const idxGroups=groupPolityIndex(searchIndex,year);
 assert.equal(idxGroups.length,fullGroups.length,`grouped polity count mismatch for year ${year}`);
 const idxMap=new Map(idxGroups.map(g=>[g.groupKey,g]));
 for(const fg of fullGroups){
  const k=polityNameGroupKey(fg);
  const ig=idxMap.get(k);
  assert(ig,`missing group ${k} in year ${year}`);
  assert.equal(ig.min,fg.min,`min mismatch for ${k}`);
  assert.equal(ig.max,fg.max,`max mismatch for ${k}`);
  assert.equal(ig.count,fg.count,`count mismatch for ${k}`);
  assert.equal(ig.zhName,polityName(fg,'zh',fg.labelYear),`zh name mismatch for ${k} in ${year}`);
  assert.equal(ig.enName,polityName(fg,'en',fg.labelYear),`en name mismatch for ${k} in ${year}`);
 }
}

const queries=[['ming',1492],['rome',1],['tang',742],['han',2],['ottoman',1650],['maurya',-250],['mongol',1260],['qing',1800],['inca',1492],['明',1492],['唐',742],['汉',2],['罗马',1],['奥斯曼',1650]];
for(const [q,year] of queries){
 const fullHits=searchPolityRecords(catalog.records,q,year);
 const idxHits=searchPolityIndex(searchIndex,q,year);
 assert.equal(idxHits.length,fullHits.length,`search hit count mismatch for ${q} @ ${year}`);
 if(fullHits.length){
  const fullTop=polityNameGroupKey(fullHits[0].record);
  const idxKeys=new Set(idxHits.map(x=>x.group.k));
  assert(idxKeys.has(fullTop),`top full-catalog match ${fullTop} missing from index search for "${q}" @ ${year}`);
 }
}

console.log(`Validated events index (${slimEvents.length} events), polity search index (${searchIndex.groups.length} groups), and ${manifest.files.length} chain buckets (${seenRecordIds.size} records)`);
