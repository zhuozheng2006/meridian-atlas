// Actual commit path and application handler, with the shipped point-layer classes.
// Only the renderer/network boundary is replaced; no browser is automated here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),publicDir=path.join(root,'public');
const source=fs.readFileSync(path.join(publicDir,'app.js'),'utf8'),revision=source.match(/\?v=[a-zA-Z0-9.-]+/)[0];
const mod=async name=>import(pathToFileURL(path.join(publicDir,name)).href+revision);
const {AtlasMap}=await mod('map-engine.js'),{BoundaryController}=await mod('boundary-controller.js'),{PlaceLayer}=await mod('places.js'),{BattleLayer}=await mod('battles.js'),{AtrocityLayer}=await mod('atrocities.js');
const requests=[];let allowReads;const reading=new Promise(r=>allowReads=r);
globalThis.fetch=async url=>{requests.push(String(url));await reading;return new Response(fs.readFileSync(path.join(publicDir,String(url))));};
const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);};
const globals={atlas:null,compareMap:null,PlaceLayer,BattleLayer,AtrocityLayer,state:{lang:'bi',placeWindow:50,span:50,cities:true,reference:false,battles:true,atrocities:false},$:node,text:(zh,en)=>en,openPlace(){},openBattle(){},openAtrocity(){},renderLayerLabels(){}};
const ctx=vm.createContext(globals);vm.runInContext(source.slice(source.indexOf('function handleGeometryStatus('),source.indexOf('\nconst placeSourceName')),ctx);
const catalog={records:[]},empty={type:'FeatureCollection',features:[]};
const frame=(year,key='n',origin='cliopatria')=>({year,source:origin,requested:'auto',key,data:empty,records:[],reason:null});
function subject(){
 const m=Object.create(AtlasMap.prototype),container={dispatchEvent:event=>ctx.handleGeometryStatus({target:container,type:event.type})};
 Object.assign(m,{request:0,active:[],year:1492,lang:'bi',catalog,geometryKey:'',ready:Promise.resolve(),frames:[],destroyed:false,map:{on(){},setPaintProperty(){},getZoom:()=>0,getContainer:()=>container,getSource:()=>({setData:data=>m.frames.push(data)})},refreshLabels(){},upgradeLand(){},upgradeDetail(){}});
 m.boundaries=new BoundaryController(m,{mode:'auto'});m.boundaries.prepare=async year=>frame(year);return m;
}
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
await test('No point-layer construction or network before a successful frame',async()=>{const m=subject();globals.atlas=m;ctx.handleGeometryStatus({target:m.map.getContainer()});assert(!m.pointLayersBound);assert.equal(requests.length,0);let release;m.boundaries.prepare=()=>new Promise(r=>release=r);const pending=m.setYear(catalog,1450);await Promise.resolve();assert(!m.pointLayersBound);assert.equal(requests.length,0);release(frame(1450));await pending;assert(m.pointLayersBound);assert.equal(m.places.year,1450);assert.equal(requests.length,6);assert(requests.every(u=>u.startsWith('data/places/')||u==='data/battles.json.gz'||u==='data/atrocities.json.gz'));});
await test('Repeated commit/upgrade events keep the same layer instances',async()=>{const m=globals.atlas,layers=[m.places,m.battles,m.atrocities];m.boundaries.prepare=async year=>frame(year);ctx.handleGeometryStatus({target:m.map.getContainer()});await m.setYear(catalog,1666);assert.deepEqual([m.places,m.battles,m.atrocities],layers);assert.equal(m.places.year,1666);assert.equal(m.battles.year,1666);assert.equal(m.atrocities.year,1666);assert.equal(requests.length,6);});
await test('Overview fallback and CShapes frames both enable point layers',async()=>{for(const [key,origin]of [['o','cliopatria'],['cshapes:1900-07-01','cshapes']]){const m=subject();globals.atlas=m;m.boundaries.prepare=async year=>frame(year,key,origin);await m.setYear(catalog,1900);assert(m.pointLayersBound);assert.equal(m.boundaries.current.source,origin);assert.equal(m.places.year,1900);}});
await test('A failed first attempt can retry and initialize once after success',async()=>{const m=subject();globals.atlas=m;m.boundaries.prepare=async()=>{throw Error('offline');};await assert.rejects(()=>m.setYear(catalog,1450),/offline/);assert(!m.pointLayersBound);m.boundaries.prepare=async year=>frame(year);await m.setYear(catalog,1500);assert(m.pointLayersBound);assert.equal(m.places.year,1500);});
await test('Old-year arrival cannot initialize before the current frame commits',async()=>{const m=subject();globals.atlas=m;let release;m.boundaries.prepare=year=>year===1450?new Promise(r=>release=r):Promise.resolve(frame(year));const old=m.setYear(catalog,1450);await Promise.resolve();await m.setYear(catalog,1666);const p=m.places;release(frame(1450));assert.equal(await old,false);assert.equal(m.places,p);assert.equal(m.places.year,1666);assert.equal(m.frames.length,1);});
await test('Comparison commit initializes only its own map; removed maps stay unbound',async()=>{const left=subject(),right=subject();globals.atlas=left;globals.compareMap=right;await right.setYear(catalog,1900);assert(right.pointLayersBound);assert(!left.pointLayersBound);const stale=subject();globals.compareMap=stale;globals.compareMap=null;await stale.setYear(catalog,1500);assert(!stale.pointLayersBound);});
await test('Destroyed maps never create point layers from a late event or attempt',async()=>{const m=subject();globals.atlas=m;m.destroyed=true;m.boundaries.current=frame(1500);ctx.handleGeometryStatus({target:m.map.getContainer()});assert(!m.pointLayersBound);assert.equal(await m.setYear(catalog,1500),false);});
await test('Real deferred point data finishes through the existing retry/load paths',async()=>{allowReads();const m=subject();globals.atlas=m;await m.setYear(catalog,1500);await Promise.all([m.places.setYear(1500,'bi'),m.battles.setYear(1500,'bi'),m.atrocities.setYear(1500,'bi')]);assert.equal(m.placeLoadStatus,'ready');assert.equal(m.battleLoadStatus,'ready');assert.equal(m.atrocityLoadStatus,'ready');assert(m.places.active.length>0);assert.equal(requests.length,6);});
console.log(JSON.stringify({passed,failed:0,shippedDataRequests:requests.length}));
