import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {chinaWindowFor,chinaSnapshotYear,readChinaSnapshot,readChinaFeature,chinaRecord,chinaRecordPanel,createChinaReviewDetails} from '../public/china-prefectures.js';
import {interiorPoint,pointInGeometry} from '../public/geometry-anchor.js';
import {regionalWindowFor,regionalVisible,RegionalBoundaries} from '../public/regional-boundaries.js';
const root='public/data/china-prefectures/',read=f=>JSON.parse(gunzipSync(fs.readFileSync(root+f))),manifest=JSON.parse(fs.readFileSync(root+'manifest.json')),index=read('index.json.gz'),hash=b=>createHash('sha256').update(b).digest('hex');
const box=(x,y=36)=>({getWest:()=>x-2,getEast:()=>x+2,getSouth:()=>y-2,getNorth:()=>y+2});
assert.equal(index.records.length,420);assert.equal(new Set(index.records.map(r=>r.id)).size,420);
assert.equal(index.records.filter(r=>r.year===2).length,103);assert.equal(index.records.filter(r=>r.year===742).length,317);
for(const y of [-2,0,1,3,741,743,1102,1820,NaN,2.1])assert.equal(chinaSnapshotYear(y),false);
assert.equal(chinaWindowFor(box(104),2).band,100);assert.equal(chinaWindowFor(box(70),742),null);
assert.equal(regionalWindowFor(box(104),742).id,'china-prefectures-100');assert.equal(regionalWindowFor(box(119,30),743).id,'chgis-prefectures');
let instances=0;
for(const f of manifest.files){const b=fs.readFileSync(root+f.file);assert.equal(b.length,f.bytes);assert.equal(hash(b),f.sha256);if(!f.file.startsWith('year-'))continue;const d=read(f.file),expected=index.records.filter(r=>r.year===d.year&&r.bounds[0]<=d.band+20&&r.bounds[2]>=d.band-10);assert.deepEqual(Object.keys(d.geometries).sort(),expected.map(r=>r.id).sort());instances+=expected.length;}
assert.equal(hash(fs.readFileSync(root+'ResearchArea-originals.zip')),manifest.sourceArchiveSHA256);
const originalFetch=globalThis.fetch,requests=[];let fail=false,failAudit=false;
globalThis.fetch=async url=>{requests.push(url);if((fail&&url.includes('year-2-band-90'))||(failAudit&&url.endsWith('name-audit.json')))return new Response('unavailable',{status:503});return new Response(fs.readFileSync('public/'+String(url).split('?')[0]));};
try{
 const a=chinaWindowFor(box(104),2),frames=await Promise.all([readChinaSnapshot(a,2),readChinaSnapshot(a,2)]);assert.equal(requests.length,2);assert.deepEqual(frames[0],frames[1]);assert(frames[0].features.every(f=>regionalVisible(f.properties,2,4)&&!regionalVisible(f.properties,3,4)));
 await readChinaSnapshot(chinaWindowFor(box(109),2),2);assert.equal(requests.length,2);
 for(const x of [110,120,100])await readChinaSnapshot(chinaWindowFor(box(x),742),742);
 const bands742=await Promise.all([90,100,110,120,130].map(band=>readChinaSnapshot({band},742)));
 const byId742=new Map(bands742.flatMap(f=>f.features.map(x=>[x.properties.id,x.properties])));
 assert.equal(byId742.size,317);
 for(const [id,p] of byId742)assert(p.name_zh&&!/[A-Za-z]/.test(p.name_zh),id+' missing name_zh: '+p.name_zh);
 assert.equal(byId742.get('china-prefecture-742-314')?.name_zh,'仪州');
 assert.equal(byId742.get('china-prefecture-742-315')?.name_zh,'夏胜丰灵宥盐六州及单于·安北大都护府');
 const n=requests.length;await readChinaSnapshot(a,2);assert.equal(requests.length,n+1);
 fail=true;await assert.rejects(readChinaSnapshot(chinaWindowFor(box(94),2),2));fail=false;await readChinaSnapshot(chinaWindowFor(box(94),2),2);
 // Drive the same disclosure from a clicked feature and from the searchable list.
 const makeNode=tag=>({
  tag,children:[],label:'',listeners:{},open:false,
  append(...children){this.children.push(...children);},
  replaceChildren(...children){this.label='';this.children=children;},
  set textContent(value){this.label=String(value);this.children=[];},
  get textContent(){return [this.label,...this.children.map(el=>el.textContent)].join(' ');},
  addEventListener(event,listener){this.listeners[event]=listener;}
 });
 const priorDocument=globalThis.document;
 globalThis.document={createElement:makeNode};
 try{
  const record=index.records.find(r=>r.id==='china-prefecture-742-117');
  const audit=JSON.parse(fs.readFileSync(root+'name-audit.json'));
  const evidence=audit.deferred.find(row=>row.id===record.id);
  const panel=chinaRecordPanel(byId742.get(record.id),'zh',()=>{});
  const details=panel.children.find(el=>el.className==='historical-review-details');
  assert.match(details.textContent,/当年名称待核/);
  assert.match(panel.textContent,/She Zhou/);
  const auditRequests=()=>requests.filter(url=>url.endsWith('name-audit.json')).length;
  assert.equal(auditRequests(),0,'Map and closed popup should not fetch the review ledger');
  details.open=true;failAudit=true;await details.listeners.toggle();
  assert.match(details.textContent,/考证记录未能载入/);
  const retry=details.children[1].children.find(el=>el.tag==='button');
  failAudit=false;
  const listDetails=createChinaReviewDetails(record,null,'en');listDetails.open=true;
  await Promise.all([retry.onclick(),listDetails.listeners.toggle()]);
  assert.match(details.textContent,/249109/);assert.match(details.textContent,/269109/);
  assert.equal(listDetails.children[1].children[0].textContent.trim(),evidence.reasonEn);
  assert(evidence.reasonEn,'This deferred record should explain the discrepancy in English');
  assert.deepEqual(details.children[1].children.at(-1).children.map(a=>a.href),evidence.sources.map(source=>source.url));
  for(const key of ['PrefID','PrefNAM','ProvNAM']){
   const mismatch=createChinaReviewDetails({...record,sourceRecord:{...record.sourceRecord,[key]:'other'}},null,'en');
   mismatch.open=true;await mismatch.listeners.toggle();assert.match(mismatch.textContent,/No review matches/);
  }
  const downloaded=await chinaRecord(record.id,{band:110},742);
  assert.equal(downloaded.nameReview,null);assert.deepEqual(downloaded.deferredNameReview,evidence);
  assert.deepEqual(downloaded.record,record);assert(downloaded.geometry);
  assert.equal(auditRequests(),2,'One failed ledger request and one shared successful retry');
  const han=frames[0].features.find(f=>f.properties.name_review_id);
  const verified=chinaRecordPanel(han.properties,'en',()=>{}).children.find(el=>el.className==='historical-review-details');
  assert.match(verified.textContent,/Period name reviewed/);assert(verified.children.at(-1).children[0].href);

  // Use real source geometry for every shared ID, including composite and offshore units.
  const mid=r=>[(r.bounds[0]+r.bounds[2])/2,(r.bounds[1]+r.bounds[3])/2];
  const byYearAndBand=(a,b)=>a.year-b.year||mid(a)[0]-mid(b)[0];
  let outside=0;
  for(const row of [...index.records].sort(byYearAndBand)){
   const {feature,band}=await readChinaFeature(row.id,row.year);
   assert.equal(feature.properties.id,row.id);assert.equal(feature.properties.source_row,row.row);
   assert.equal(feature.properties.source_name,row.sourceRecord.PrefNAM);assert.equal(band,Math.floor(mid(row)[0]/10)*10);
   assert(pointInGeometry(interiorPoint(feature.geometry),feature.geometry),row.id);
   if(!pointInGeometry(mid(row),feature.geometry))outside++;
  }
  assert(outside>0,'Some bounding-box centres miss the source polygon entirely');
  for(const [id,year] of [['china-prefecture-2-1',742],['china-prefecture-742-1x',742],['china-prefecture-742-999',742]]){
   assert.equal(await readChinaFeature(id,year),null);
  }
  for(const id of ['china-prefecture-2-1','china-prefecture-742-8','china-prefecture-742-315']){
   const row=index.records.find(r=>r.id===id),{feature}=await readChinaFeature(id,row.year);
   const region=Object.create(RegionalBoundaries.prototype),selected=[],filters=[],jumps=[],closed=[];
   let center=mid(row),zoom=6.5,layerReady=false,popupPoint,node;
   Object.assign(region,{year:row.year,lang:'en',mode:'regional',maxLevel:4,markers:[],active:false,
    atlas:{showBorders:true,onBoundarySelection:(...args)=>selected.push(args)},
    map:{getCenter:()=>({toArray:()=>center}),getZoom:()=>zoom,getBounds:()=>box(...center),
     jumpTo:camera=>{jumps.push(camera);center=camera.center;zoom=camera.zoom;},
     getSource:()=>null,getLayer:key=>layerReady&&key==='ohm-frozen-selected',removeLayer:()=>{layerReady=false;},
     setFilter:(layer,filter)=>filters.push([layer,filter])},
    visibility(){},update(){},
    popupAt(el,point){node=el;popupPoint=point;this.popup={on:(_,fn)=>closed.push(fn),remove:()=>closed.splice(0).forEach(fn=>fn())};}
   });
   assert.equal(await region.restoreChinaRecord(id,()=>false),false);
   assert.equal(jumps.length,0);assert.equal(selected.length,0);
   assert.equal(await region.restoreChinaRecord(id,()=>true),true);
   assert.equal(jumps.length,pointInGeometry(mid(row),feature.geometry)?0:1);
   assert(pointInGeometry(popupPoint,feature.geometry));
   assert.equal(filters.length,0,'The popup can open before the worker installs the source layer');
   layerReady=true;region.applyFilters();
   assert.deepEqual(filters.at(-1),['ohm-frozen-selected',['==',['get','osm_id'],feature.properties.osm_id]]);
   assert.deepEqual(selected.at(-1),[id]);
   const links=node.children.find(el=>el.className==='historical-source-links');
   assert.equal(links.children[0].href,'./?division='+id.slice('china-prefecture-'.length)+'#view=sources&lang=en');
   region.setYear(row.year+1,'en');
   assert.deepEqual(selected.at(-1),[null,id]);assert.equal(region.selectedId,null);
  }
 }finally{
  if(priorDocument)globalThis.document=priorDocument;else delete globalThis.document;
 }
 const regional=Object.create(RegionalBoundaries.prototype);Object.assign(regional,{year:742,map:{getBounds:()=>box(104),getSource(){throw Error('Scholarly source must suppress live OHM startup');}}});assert(regional.scholarlyActive);regional.ensure();
}finally{globalThis.fetch=originalFetch;}
const report={passed:true,sourceRows:420,years:[2,742],bandInstances:instances,files:manifest.files.length,concurrentRequestsShared:true,sameBandExtraRequests:0,threePackEviction:true,retryAfterFailure:true,exactYearsOnly:true};
fs.mkdirSync('docs/verification-3.59',{recursive:true});fs.writeFileSync('docs/verification-3.59/china-runtime.json',JSON.stringify(report,null,2)+'\n');console.log(report);
