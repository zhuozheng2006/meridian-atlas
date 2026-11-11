import fs from 'node:fs';import {gzipSync,gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {decodeRegionalTransport} from '../public/regional-transport.js';
import {OHM_WINDOWS} from '../public/regional-boundaries.js';
const root=new URL('../',import.meta.url),target=new URL('public/data/ohm-transport/',root),check=process.argv.includes('--check'),hash=x=>createHash('sha256').update(x).digest('hex');
fs.mkdirSync(target,{recursive:true});const files=[];
function encodeRing(ring){let x=0,y=0;return ring.flatMap(p=>{assert.equal(p.length,2);const a=Math.round(p[0]*1e7),b=Math.round(p[1]*1e7);assert.equal(a/1e7,p[0]);assert.equal(b/1e7,p[1]);const pair=[a-x,b-y];x=a;y=b;return pair;});}
for(const window_ of OHM_WINDOWS)for(const year of window_.years){
 const file=`${window_.id}-${year}.json.gz`,source=`${window_.root}year-${year}.json.gz`,original=fs.readFileSync(new URL('public/'+source,root)),raw=JSON.parse(gunzipSync(original));let exact=0,fallback=0;
 const features=raw.features.map(f=>{const g=f.geometry;try{const coordinates=g.type==='Polygon'?g.coordinates.map(encodeRing):g.coordinates.map(p=>p.map(encodeRing));const {geometry,...rest}=f;exact++;return {...rest,deltaGeometry:{...g,coordinates}};}catch{fallback++;return f;}});
 const encoded={...raw,features,encoding:'ohm-delta-1e7'};assert.deepEqual(decodeRegionalTransport(encoded),raw);
 const bytes=gzipSync(Buffer.from(JSON.stringify(encoded)),{level:9});
 if(check)assert.deepEqual(fs.readFileSync(new URL(file,target)),bytes);else fs.writeFileSync(new URL(file,target),bytes);
 files.push({file,window:window_.id,year,source,sourceSHA256:hash(original),sha256:hash(bytes),originalBytes:original.length,bytes:bytes.length,features:features.length,exactEncoded:exact,rawFallback:fallback,coordinateRoundTrip:'exact'});
}
const manifest={schemaVersion:1,encoding:'ohm-delta-1e7',files},json=JSON.stringify(manifest,null,2)+'\n';if(check)assert.equal(fs.readFileSync(new URL('manifest.json',target),'utf8'),json);else fs.writeFileSync(new URL('manifest.json',target),json);console.log(json);
