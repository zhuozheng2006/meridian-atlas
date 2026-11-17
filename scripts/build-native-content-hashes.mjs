import fs from 'node:fs';import {createHash} from 'node:crypto';
const base=new URL('../',import.meta.url),read=file=>JSON.parse(fs.readFileSync(new URL('public/data/'+file,base)));
const native=read('native/manifest.json'),nativePairs=[],bootPairs=[],detailPairs=[],seen=new Set();
function add(pairs,file,bytes,sha256){
 if(seen.has(file)||!Number.isSafeInteger(bytes)||bytes<=0||!/^[a-f0-9]{64}$/.test(sha256))throw Error('Invalid content fingerprint: '+file);
 const b=fs.readFileSync(new URL('public/'+file,base));
 if(b.length!==bytes||createHash('sha256').update(b).digest('hex')!==sha256)throw Error('Content hash mismatch: '+file);
 seen.add(file);pairs.push([file,sha256]);
}
for(const f of native.temporalBundles){
 if(!/^temporal\/pack-\d{3}\.json\.gz$/.test(f.file))throw Error('Invalid native temporal path');
 add(nativePairs,'data/native/'+f.file,f.gzipBytes,f.gzipSha256);
}
for(const f of Object.values(native.bootstrap)){
 if(!/^year--?\d+\.json\.gz$/.test(f.file))throw Error('Invalid native bootstrap path');
 const path='data/native/'+f.file;
 add(nativePairs,path,f.gzipBytes,f.gzipSha256);
 bootPairs.push([path,f.gzipSha256]);
}
// These paths are already removed from static assets and served by the R2
// Worker. Do not include indexes or AWMC/static assets: asset-first hosting
// would bypass the fingerprint validation and cache response headers.
for(const area of ['ohm-eastasia','ohm-1500','ohm-britain'])for(const f of Object.values(read(area+'/manifest.json').years)){
 if(!/^year--?\d+\.json\.gz$/.test(f.file))throw Error('Invalid OHM path');
 add(detailPairs,'data/'+area+'/'+f.file,f.gzipBytes,f.sha256);
}
for(const f of read('ohm-transport/manifest.json').files){
 if(!/^(?:central-europe|east-asia|british-isles)--?\d+\.json\.gz$/.test(f.file))throw Error('Invalid regional transport path');
 add(detailPairs,'data/ohm-transport/'+f.file,f.bytes,f.sha256);
}
for(const [area,pattern]of [['china-prefectures',/^year-\d+-band-\d+\.json\.gz$/],['chgis',/^century--?\d+\.json\.gz$/]]){
 for(const f of read(area+'/manifest.json').files)if(pattern.test(f.file))add(detailPairs,'data/'+area+'/'+f.file,f.bytes,f.sha256);
}
for(const f of Object.values(read('cshapes/manifest.json').packs)){
 if(!/^decade-\d+\.json\.gz$/.test(f.file))throw Error('Invalid CShapes path');
 add(detailPairs,'data/cshapes/'+f.file,f.bytes,f.sha256);
}
detailPairs.sort(([a],[b])=>a.localeCompare(b));
const content=`// Generated from audited compressed bytes; only these paths use immutable caching.
export const nativeContentHashes=${JSON.stringify(Object.fromEntries(nativePairs))};
export const detailContentHashes=${JSON.stringify(Object.fromEntries(detailPairs))};
export function historicalDataRequest(url){
 const sha256=Object.hasOwn(nativeContentHashes,url)?nativeContentHashes[url]:Object.hasOwn(detailContentHashes,url)?detailContentHashes[url]:null;
 return sha256?{url:(/^data\\/native\\/year--?\\d+\\.json\\.gz$/.test(url)?url.replace('data/native/','__atlas-native/'):url)+'?sha256='+sha256,cache:'default'}:{url,cache:'no-cache'};
}
`,out=new URL('public/native-content-hashes.js',base);
const bootContent=`// Generated bootstrap year fingerprints; temporal and regional tables load on demand.
export const bootstrapContentHashes=${JSON.stringify(Object.fromEntries(bootPairs))};
export function bootstrapDataRequest(url){
 const sha256=Object.hasOwn(bootstrapContentHashes,url)?bootstrapContentHashes[url]:null;
 return sha256?{url:url.replace('data/native/','__atlas-native/')+'?sha256='+sha256,cache:'default'}:null;
}
`,bootOut=new URL('public/bootstrap-content-hashes.js',base);
if(process.argv.includes('--check')){if(fs.readFileSync(out,'utf8')!==content||fs.readFileSync(bootOut,'utf8')!==bootContent)throw Error('Historical hash table is stale');}else{fs.writeFileSync(out,content);fs.writeFileSync(bootOut,bootContent);}
console.log('PASS '+nativePairs.length+' native ('+bootPairs.length+' bootstrap) and '+detailPairs.length+' detail content fingerprints');
