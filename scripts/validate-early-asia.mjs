import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {awmcWindowFor,readAwmcSnapshot} from '../public/awmc-boundaries.js';
import {regionalWindowFor,regionalVisible,RegionalBoundaries,groupRegionalFeatures,ohmLayers} from '../public/regional-boundaries.js';
import {chinaNameReviews,reviewedChinaName} from '../public/china-name-reviews.js';
import {readChinaSnapshot,chinaRecord,chinaWindowFor} from '../public/china-prefectures.js';
const root='public/data/awmc/',manifest=JSON.parse(fs.readFileSync(root+'manifest.json')),hash=b=>createHash('sha256').update(b).digest('hex'),read=f=>JSON.parse(gunzipSync(fs.readFileSync(root+f))),box=(x,y)=>({getWest:()=>x-1,getEast:()=>x+1,getSouth:()=>y-1,getNorth:()=>y+1});
for(const f of manifest.files){const b=fs.readFileSync(root+f.file),raw=gunzipSync(b);assert.equal(b.length,f.bytes);assert.equal(hash(b),f.sha256);assert.equal(raw.length,f.sourceBytes);assert.equal(hash(raw),f.sourceSHA256);assert.equal(JSON.parse(raw).features.length,f.features);}
for(const y of [116,118,199,201,-117,0,117.5,NaN]){assert.equal(awmcWindowFor(box(37,34),y),null);await assert.rejects(readAwmcSnapshot(y));}
assert.equal(awmcWindowFor(box(78,24),117),null);assert.equal(regionalWindowFor(box(37,34),200).id,'awmc-roman');
const originalFetch=fetch,requests=[];let fail=true;
globalThis.fetch=async url=>{requests.push(url);if(fail&&url.includes('200_extent'))return new Response('',{status:503});return new Response(fs.readFileSync('public/'+String(url).split('?')[0]));};
try{
 await assert.rejects(readAwmcSnapshot(200));fail=false;
 for(const year of [117,200]){const a=await readAwmcSnapshot(year),b=await readAwmcSnapshot(year),source=read(`roman_empire_ce_${year}_extent.geojson.gz`);assert.strictEqual(a,b);assert.equal(groupRegionalFeatures(a.features,year).length,1);assert.deepEqual(ohmLayers()[0].filter,['==',['geometry-type'],'Polygon']);assert.deepEqual(a.features[0].geometry.coordinates,source.features.map(f=>f.geometry.coordinates));assert.equal(a.features.length,year===117?1:82);assert(a.features.every(f=>regionalVisible(f.properties,year,4)&&!regionalVisible(f.properties,year+1,4)));if(year===200){assert.deepEqual(a.features.slice(1).map(f=>f.geometry),read('roman_empire_ce_200_provinces.geojson.gz').features.map(f=>f.geometry));assert(a.features.slice(1).every(f=>!f.properties.name));}}
 const regional=Object.create(RegionalBoundaries.prototype);Object.assign(regional,{year:200,map:{getBounds:()=>box(37,34),getSource(){throw Error('AWMC must suppress live OHM');}}});assert(regional.scholarlyActive);regional.ensure();
 const index=JSON.parse(gunzipSync(fs.readFileSync('public/data/china-prefectures/index.json.gz'))),audit=JSON.parse(fs.readFileSync('public/data/china-prefectures/name-audit.json'));
 // The source snapshot distinguishes Tang and Tanglin. Their similar names
 // previously sent both readers to the same prefecture in the historical text.
 const deferredById=new Map(audit.deferred.map(row=>[row.id,row]));
 const tang=deferredById.get('china-prefecture-742-29');
 const tanglin=deferredById.get('china-prefecture-742-7');
 assert.equal(tang.sourcePrefNAM,'Tang Zhou');
 assert.equal(tang.sourceRecordPopulation,5200);
 assert.equal(tang.populationInText,5220);
 assert.equal(tang.householdsInText,1300);
 assert(tang.sources.some(source=>source.url.endsWith('/卷184#湯泉郡')));
 assert.equal(tanglin.sourcePrefNAM,'Tanglin Zhou');
 assert(tanglin.sources.some(source=>source.url.endsWith('/卷41#福祿州')));
 assert(!tanglin.sources.some(source=>source.url.endsWith('#湯州')||source.url.endsWith('#汤州')));
 for(const row of audit.deferred){
  const source=index.records.find(record=>record.id===row.id);
  assert(source,`Unknown source row ${row.id}`);
  assert.equal(row.year,source.year);
  assert.equal(row.PrefID,source.sourceRecord.PrefID);
  assert.equal(row.sourcePrefNAM,source.sourceRecord.PrefNAM);
  assert.equal(row.ProvNAM,source.sourceRecord.ProvNAM);
  assert.equal(row.sourceRecordPopulation,source.sourceRecord.POP);
  assert(row.sources?.length>0,`Missing source for ${row.id}`);
 }
 assert.deepEqual(Object.values(chinaNameReviews),audit.records);
 const han=audit.records.filter(r=>r.year===2).length,tangCount=audit.records.filter(r=>r.year===742).length;
 assert.deepEqual([han,tangCount,audit.deferred.length],[103,267,50]);
 assert.equal(audit.records.length+audit.deferred.length,index.records.length);
 assert.deepEqual([audit.reviewScope.hanVerifiedMappings,audit.reviewScope.tangPeriodAliases,audit.reviewScope.documentedDeferred],[han,tangCount,audit.deferred.length]);
 const wue=chinaNameReviews['china-prefecture-742-10'];
 const wueOriginal=index.records.find(row=>row.id===wue.id).sourceRecord;
 const wueCheck=audit.identityChecks.find(row=>row.id===wue.id);
 assert.deepEqual([wue.sourcePrefNAM,wue.ProvNAM,wue.zh,wue.formerNameZh],["Wu'e Zhou",'Lingnan Dao','武峨郡','武峨州']);
 assert.equal(wueCheck.populationInText,wueOriginal.POP);
 const newTang=fs.readFileSync(wueCheck.captureFile);
 assert.equal(hash(newTang),wueCheck.captureSha256);
 assert(gunzipSync(newTang).toString().includes('口五千三百二十'));
 assert.deepEqual(wue.sources.map(s=>s.url.split('#').pop()),['武峨州','武峩州']);
 const composite=deferredById.get('china-prefecture-742-315');
 assert.equal(composite.sources.length,8);
 for(const ref of composite.sources){
  const volume=ref.url.match(/卷(38|39)#/)[1];
  const capture='docs/verification-3.'+(volume==='38'?'61':'62')+'/sources/old-tang-'+volume+'.html.gz';
  assert(gunzipSync(fs.readFileSync(capture)).toString().includes('id="'+ref.url.split('#')[1]+'"'));
 }
 for(const review of audit.records){const r=index.records.find(r=>r.id===review.id);assert.deepEqual(reviewedChinaName(r),review);for(const key of ['PrefID','PrefNAM','ProvNAM'])assert.equal(reviewedChinaName({...r,sourceRecord:{...r.sourceRecord,[key]:'changed'}}),null);assert.equal(reviewedChinaName({...r,year:r.year+1}),null);const w=chinaWindowFor(box((r.bounds[0]+r.bounds[2])/2,(r.bounds[1]+r.bounds[3])/2),r.year),frame=await readChinaSnapshot(w,r.year),f=frame.features.find(f=>f.properties.id===r.id);assert.equal(f.properties.name_zh,review.zh);assert.equal(f.properties.name_en,review.en);assert.equal(f.properties.source_name,r.sourceRecord.PrefNAM);const download=await chinaRecord(r.id,w,r.year);assert.deepEqual(download.record,r);assert.deepEqual(download.nameReview,review);}
 assert.equal(chinaNameReviews['china-prefecture-2-45'].en,'Zuo Pingyi');
 const report={passed:true,exactYearSnapshots:[117,200],originalFragmentsPerSnapshot:112,unnamedProvinceLines:81,allSourceBytesAndCoordinatesPreserved:true,retryAfterFailure:true,offYearExcluded:true,nameReviews:audit.records.length,han,tang:tangCount,deferredDocumented:audit.deferred.length,sourceIdentityMismatchRejected:true,sourceRecordUnchanged:true,remainingNames:audit.deferred.length,unauditedNames:0,southAsiaNewBoundaries:0};
 fs.mkdirSync('docs/verification-3.64',{recursive:true});fs.writeFileSync('docs/verification-3.64/early-asia.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}finally{globalThis.fetch=originalFetch;}
