import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {performance} from 'node:perf_hooks';
const root=new URL('../public/',import.meta.url),results=[],scenes=[];
const disk=async name=>JSON.parse(name.endsWith('.gz')?gunzipSync(await fs.readFile(new URL(name,root))):await fs.readFile(new URL(name,root),'utf8'));
const requests=[];let failPath=null;
globalThis.fetch=async input=>{const name=String(input);requests.push(name);if(name===failPath)return new Response('Unavailable',{status:503});try{return new Response(await fs.readFile(new URL(name,root)));}catch{return new Response('Missing',{status:404});}};
const source=await fs.readFile(new URL('polity-places.js',root),'utf8'),revision=source.match(/map-engine\.js(\?v=[^']+)/)?.[1]||'';
const api=await import(new URL('polity-places.js',root));
const {forgetJSON}=await import(new URL('map-engine.js'+revision,root));
const {prepareTerritory,territoryContains,selectedPolityPlace,filterPolityPlaces,polityPlaces}=api;
async function check(name,run){try{await run();results.push({name,passed:true});console.log('PASS',name);}catch(e){results.push({name,passed:false,error:e.stack});console.error('FAIL',name,e.message);}}
const square=prepareTerritory({type:'Polygon',coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[3,3],[7,3],[7,7],[3,7],[3,3]]]});
const record={id:'fixture',start:-100,end:200,verifiedWikidata:'Q123',capitalBindingVerified:true};
const place={id:'site:test',name:'Test',kind:'attested-settlement',coordinates:[1,1],periods:[[-100,-50],[50,150]]};
await check('Polygon holes, edges, invalid points and separate islands',()=>{
 for(const p of [[1,1],[0,0],[3,5],[10,5]])assert.equal(territoryContains(square,p),true);
 for(const p of [[5,5],[11,5],[NaN,0],[0,91],null])assert.equal(territoryContains(square,p),false);
 const islands=prepareTerritory({type:'MultiPolygon',coordinates:[[[[0,0],[2,0],[2,2],[0,2],[0,0]]],[[[20,20],[22,20],[22,22],[20,22],[20,20]]]]});
 assert(territoryContains(islands,[21,21]));assert(!territoryContains(islands,[11,11]));
});
await check('Dateline-crossing shells and holes handle both longitude conventions',()=>{
 const crossing=prepareTerritory({type:'Polygon',coordinates:[[[170,-10],[-170,-10],[-170,10],[170,10],[170,-10]],[[175,-3],[-175,-3],[-175,3],[175,3],[175,-3]]]});
 for(const p of [[172,0],[-172,0],[179,8],[-179,8],[181,8]])assert(territoryContains(crossing,p));
 for(const p of [[0,0],[179,0],[-179,0]])assert(!territoryContains(crossing,p));
});
await check('Date gaps, invalid civil years and inactive polity periods are excluded',()=>{
 for(const y of [-100,-50,50,150])assert(selectedPolityPlace(place,record,y,square));
 for(const y of [-101,-49,-1,0,1,49,151,201,Infinity,'100',100.5])assert.equal(selectedPolityPlace(place,record,y,square),null);
 assert.equal(selectedPolityPlace({...place,kind:'modern-reference'},record,100,square),null);
});
await check('Dated locations follow their own period rather than the representative point',()=>{
 const p={...place,locations:[{coordinates:[1,1],periods:[[-100,-50]]},{coordinates:[20,20],periods:[[50,150]]}]};
 assert(selectedPolityPlace(p,record,-50,square));assert.equal(selectedPolityPlace(p,record,100,square),null);
});
await check('Capital matches require verified identity, active tenure and unambiguous binding',()=>{
 const p={...place,kind:'dated-capital',polityQid:'Q123',coordinates:[50,50]};
 assert.equal(selectedPolityPlace(p,record,100,square).association,'capital-relationship');
 for(const r of [{...record,capitalBindingVerified:false},{...record,verifiedWikidata:'Q124'},{...record,nameTranslationStatus:'ambiguous_source_period'}])assert.equal(selectedPolityPlace(p,r,100,square),null);
 assert.equal(selectedPolityPlace(p,record,1,square),null);
});
await check('Population stays a dated observation, including across BCE/CE and the 50-year boundary',()=>{
 const p={...place,kind:'urban-observation',observations:[[-1,1000],[100,2000]],datedNames:[{start:100,end:100,name:'Later name',nameZh:'后期名称'}]};
 const match=selectedPolityPlace(p,record,120,square);assert.deepEqual(match.observation,[100,2000]);assert.equal(match.displayName,'Later name');
 assert.deepEqual(selectedPolityPlace(p,record,1,square).observation,[-1,1000]);
 assert(selectedPolityPlace(p,record,150,square));assert.equal(selectedPolityPlace(p,record,151,square),null);
});
await check('Name, alias and kind filters preserve source rows',()=>{
 const list=[{...place,name:'Mérida',nameZh:'梅里达',searchAliases:['Augusta Emerita']},{...place,id:'pop',kind:'urban-observation',name:'Rome',otherNames:'Roma',datedNames:[{name:'Urbs'}],names:[{name:'Ancient capital'}]}];
 assert.equal(filterPolityPlaces(list,'merida').length,1);assert.equal(filterPolityPlaces(list,'梅里达').length,1);assert.equal(filterPolityPlaces(list,'augusta emerita').length,1);assert.equal(filterPolityPlaces(list,'','urban-observation').length,1);assert.equal(filterPolityPlaces(list,'Rome','attested-settlement').length,0);assert.equal(filterPolityPlaces(list,'Roma').length,1);assert.equal(filterPolityPlaces(list,'Urbs').length,1);assert.equal(filterPolityPlaces(list,'Ancient capital').length,1);
});
const catalog=await disk('data/fast/catalog.json.gz'),index=await disk('data/native/index.json.gz'),oracle=JSON.parse(await fs.readFile(new URL('fixtures/polity-places-geometry.json',import.meta.url)));
await check('1,250 real geometry samples agree with an independent Shapely oracle',async()=>{
 assert.equal(oracle.scenes.length,5);for(const scene of oracle.scenes){const gid=index.recordIndex[scene.id],geometry=(await disk('data/native/'+index.geometryIndex[gid]))[gid],prepared=prepareTerritory(geometry);for(const sample of scene.points)assert.equal(territoryContains(prepared,sample.point),sample.inside,scene.name+JSON.stringify(sample.point));}
});
await check('Real archived polities load dated place records without modern references',async()=>{
 for(const scene of oracle.scenes){const r=catalog.records.find(r=>r.id===scene.id),start=performance.now(),data=await polityPlaces(r,scene.year);assert(!data.partial);assert(data.places.length>0);assert.equal(data.year,scene.year);assert.equal(new Set(data.places.map(p=>p.id)).size,data.places.length);for(const p of data.places){assert.notEqual(p.kind,'modern-reference');assert(p.association);if(p.kind==='dated-capital')assert.equal(p.polityQid,r.verifiedWikidata);if(p.observation)assert(p.observations.some(o=>o[0]===p.observation[0]&&o[1]===p.observation[1]));}scenes.push({name:r.name,id:r.id,year:scene.year,counts:data.counts,records:data.places.length,milliseconds:Math.round(performance.now()-start),first:data.places.slice(0,5).map(p=>({id:p.id,name:p.name,kind:p.kind}))});}
});
await check('A superseded navigation cannot return or cache results',async()=>{
 const r=catalog.records.find(r=>r.id===oracle.scenes[0].id);await assert.rejects(polityPlaces(r,101,()=>false),{name:'AbortError'});const data=await polityPlaces(r,101);assert(data.places.length>0);
});
await check('Partial source failures are visible and recover without caching incomplete results',async()=>{
 const r=catalog.records.find(r=>r.id===oracle.scenes[0].id);failPath='data/places/historical-capitals.json.gz';forgetJSON(failPath);const partial=await polityPlaces(r,102);assert.equal(partial.partial,true);assert.equal(partial.counts.capitals,0);failPath=null;const complete=await polityPlaces(r,102);assert.equal(complete.partial,false);assert(complete.places.length>=partial.places.length);
});
const report={checkedAt:new Date().toISOString(),results,scenes,requests:requests.length};await fs.writeFile(new URL('../docs/polity-places-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');if(results.some(r=>!r.passed))process.exitCode=1;
