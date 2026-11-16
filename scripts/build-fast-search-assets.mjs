import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {polityNameGroupKey,polityName,polityNameEvidence,polityReferenceYear} from '../public/polity-names.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const check=process.argv.includes('--check');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

function output(rel,bytes){
 const file=path.join(root,'public',rel);
 if(check){
  if(!fs.existsSync(file)||!fs.readFileSync(file).equals(bytes))throw Error(`Stale fast search asset: public/${rel}; run npm run prepare:assets`);
 }else{
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,bytes);
 }
}

// 1. Slim events index for fast boot, timeline density, map markers and title search.
const eventsBytes=fs.readFileSync(path.join(root,'public/data/events.json.gz'));
const events=JSON.parse(gunzipSync(eventsBytes));
const slimEvents=events.map(e=>{
 const item={id:e.id,title:e.title,start:e.start,end:e.end,lat:e.lat,lon:e.lon,region:e.region,category:e.category,precision:e.precision,locationType:e.locationType};
 if(e.provenance)item.provenance=e.provenance;
 return item;
});
const eventsIndexGz=gzipSync(Buffer.from(JSON.stringify(slimEvents)),{level:9});
output('data/fast/events-index.json.gz',eventsIndexGz);

// 2. All-period polity search index + 64 sharded period-chain bundles.
const catalogBytes=fs.readFileSync(path.join(root,'public/data/fast/catalog.json.gz'));
const catalogHash=hash(catalogBytes);
const catalog=JSON.parse(gunzipSync(catalogBytes));

const BUCKETS=64;
const bucketIndex=key=>{
 let h=2166136261;
 for(let i=0;i<key.length;i++)h=Math.imul(h^key.charCodeAt(i),16777619);
 return (h>>>0)%BUCKETS;
};

const groups=new Map();
for(const r of catalog.records){
 if(r.type!=='POLITY')continue;
 const k=polityNameGroupKey(r);
 if(!groups.has(k))groups.set(k,[]);
 groups.get(k).push(r);
}

const buckets=Array.from({length:BUCKETS},()=>({}));
const searchGroups=[];

for(const [k,recs] of groups){
 recs.sort((a,b)=>a.start-b.start||a.end-b.end||a.id.localeCompare(b.id));
 const b=bucketIndex(k);
 buckets[b][k]=recs;

 // Merge contiguous/overlapping intervals (within 1 year) when they share the same
 // resolved display names so year-dependent disambiguations (e.g. Later Zhou BCE vs CE)
 // stay exact without shipping all 13k rows.
 const spans=[];
 for(const r of recs){
  const ry=polityReferenceYear(r,r.start),rzh=polityName(r,'zh',ry),ren=polityName(r,'en',ry);
  const last=spans.at(-1);
  if(!last||r.start>last.e+1||last.zh!==rzh||last.en!==ren)spans.push({s:r.start,e:r.end,zh:rzh,en:ren});
  else last.e=Math.max(last.e,r.end);
 }
 const min=spans[0].s,max=spans.at(-1).e;
 const rep=recs.reduce((best,r)=>r.area>best.area?r:best,recs[0]);
 const refYear=polityReferenceYear(rep,rep.start);
 const rule=polityNameEvidence(rep,refYear);
 const zh=polityName(rep,'zh',refYear);
 const en=polityName(rep,'en',refYear);
 const compactSpans=spans.map(sp=>sp.zh===zh&&sp.en===en?[sp.s,sp.e]:[sp.s,sp.e,sp.zh,sp.en]);
 const extraNames=new Set();
 for(const r of recs){
  if(r.name&&r.name!==en&&r.name!==rep.name)extraNames.add(r.name);
  if(r.zhName&&r.zhName!==zh&&!rule)extraNames.add(r.zhName);
  if(r.enName&&r.enName!==en&&!rule)extraNames.add(r.enName);
 }
 const entry={k,b,id:rep.id,n:rep.name,zh,en,min,max,c:recs.length,a:Math.round(rep.area),s:compactSpans};
 if(rule)entry.rule=rule.id;
 if(extraNames.size)entry.x=[...extraNames];
 searchGroups.push(entry);
}

const searchIndex={
 schemaVersion:1,
 sourceCatalogSHA256:catalogHash,
 sourceRecordCount:catalog.records.length,
 metadata:catalog.metadata,
 buckets:BUCKETS,
 groups:searchGroups
};
const searchIndexGz=gzipSync(Buffer.from(JSON.stringify(searchIndex)),{level:9});
output('data/fast/polity-search-index.json.gz',searchIndexGz);

const bucketMeta=[];
const folder=path.join(root,'public/data/fast/polity-chains');
const expectedFiles=new Set();
for(let i=0;i<BUCKETS;i++){
 const file=`b-${String(i).padStart(2,'0')}.json.gz`;
 expectedFiles.add(file);
 const payload={schemaVersion:1,bucket:i,sourceCatalogSHA256:catalogHash,chains:buckets[i]};
 const bytes=gzipSync(Buffer.from(JSON.stringify(payload)),{level:9});
 output(`data/fast/polity-chains/${file}`,bytes);
 bucketMeta.push({file,bucket:i,groups:Object.keys(buckets[i]).length,bytes:bytes.length,sha256:hash(bytes)});
}
expectedFiles.add('manifest.json');
if(check&&fs.existsSync(folder)){
 for(const file of fs.readdirSync(folder))if(!expectedFiles.has(file))throw Error(`Unexpected obsolete polity-chain asset: ${file}`);
}
const manifest={
 schemaVersion:1,
 sourceCatalogSHA256:catalogHash,
 groups:searchGroups.length,
 buckets:BUCKETS,
 searchIndexBytes:searchIndexGz.length,
 searchIndexSHA256:hash(searchIndexGz),
 eventsIndexBytes:eventsIndexGz.length,
 eventsIndexSHA256:hash(eventsIndexGz),
 chainTotalBytes:bucketMeta.reduce((n,x)=>n+x.bytes,0),
 files:bucketMeta
};
output('data/fast/polity-chains/manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
console.log(JSON.stringify({
 check,
 events:slimEvents.length,
 eventsFullBytes:eventsBytes.length,
 eventsIndexBytes:eventsIndexGz.length,
 polityGroups:searchGroups.length,
 catalogFullBytes:catalogBytes.length,
 searchIndexBytes:searchIndexGz.length,
 chainBucketAvgBytes:Math.round(manifest.chainTotalBytes/BUCKETS)
},null,2));
