import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createBoundaryComparison} from '../public/boundary-comparison.js';
const root=[process.argv[2],process.cwd(),resolve(dirname(fileURLToPath(import.meta.url)),'..')].filter(Boolean).map(p=>resolve(p)).find(p=>existsSync(resolve(p,'public/map-engine.js')));
assert(root,'Supply the atlas checkout root, or run from that checkout');
const modulePath=resolve(root,'public/map-engine.js');
const {AtlasMap}=await import(pathToFileURL(modulePath));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const catalog={records:[]};
function fixture({open=false,left=1500,right=1900}={}){
 const log=[],errors=[],cameras={left:{center:[7,48],zoom:7,bearing:0,pitch:0},right:{center:[8.8,48.1],zoom:8,bearing:12,pitch:0}};
 function map(year){
  const a={year,request:0,lang:'en',ready:Promise.resolve(),active:[],destroyed:false,refreshLabels(){},upgradeLand(){},upgradeDetail(){}};
  a.boundaries={mode:'auto',async prepare(y){const gate=a.gate;a.gate=null;if(gate)await gate.promise;return {requested:this.mode,year:y};},commit(frame){log.push(['map-commit',a===state.primary?'left':'right',frame.year]);}};
  a.setYear=year=>AtlasMap.prototype.setYear.call(a,catalog,year,'en');
  a.destroy=()=>{a.destroyed=true;a.request++;};return a;
 }
 const state={primary:null,secondary:null,year:left,compareYear:right,compareOpen:open};state.primary=map(left);if(open)state.secondary=map(right);
 let ensureGate=null,yearGate=null,ensureFailure=false,yearFalse=false;
 const controller=createBoundaryComparison({
  snapshot:()=>({...state,camera:cameras.left,compareCamera:cameras.right}),
  async ensureComparison({isCurrent}){log.push(['ensure']);if(ensureGate)await ensureGate.promise;if(!isCurrent())return false;if(ensureFailure)return false;if(!state.compareOpen){state.compareOpen=true;state.secondary=map(state.compareYear);log.push(['create']);}return true;},
  async alignYear({side,map,year,isCurrent}){log.push(['align',side,year]);if(yearFalse)return false;if(yearGate){map.gate=yearGate;yearGate=null;}const count=await map.setYear(year);if(!isCurrent()||count===false)return false;state[side==='left'?'year':'compareYear']=year;return true;},
  setModes(value){log.push(['modes',value]);value.primary.boundaries.mode='overview';value.secondary.boundaries.mode='regional';},onError:error=>errors.push(error.message)
 });
 return {state,log,errors,cameras,controller,ensureDelay(){return ensureGate=deferred();},yearDelay(){return yearGate=deferred();},failEnsure(){ensureFailure=true;},falseYear(){yearFalse=true;},close(){controller.cancel();state.secondary?.destroy();state.secondary=null;state.compareOpen=false;},modes:()=>log.filter(x=>x[0]==='modes')};
}
const results=[];
async function test(name,fn){try{await fn();results.push({name,pass:true});console.log('PASS '+name);}catch(e){results.push({name,pass:false,error:e.stack});console.error('FAIL '+name+': '+e.message);}}
await test('New comparison creates once, loads the target year through actual AtlasMap.setYear, then changes sources',async()=>{const f=fixture();assert(await f.controller.open('left'));assert.equal(f.log.filter(x=>x[0]==='create').length,1);assert.equal(f.state.secondary.year,1500);assert.equal(f.state.compareYear,1500);assert.equal(f.modes().length,1);assert.deepEqual(f.modes()[0][1].camera,f.cameras.left);assert(f.log.findIndex(x=>x[0]==='map-commit')<f.log.findIndex(x=>x[0]==='modes'));});
await test('Existing comparison is reused rather than toggled closed',async()=>{const f=fixture({open:true});const map=f.state.secondary;assert(await f.controller.open());assert.equal(f.state.secondary,map);assert.equal(f.log.filter(x=>x[0]==='create').length,0);});
await test('Opening from the right adopts the right map year and camera',async()=>{const f=fixture({open:true,left:1500,right:1650});assert(await f.controller.open('right'));assert.equal(f.state.year,1650);assert.equal(f.state.primary.year,1650);assert.deepEqual(f.log.filter(x=>x[0]==='align').map(x=>x.slice(1)),[['left',1650]]);assert.deepEqual(f.modes()[0][1].camera,f.cameras.right);});
await test('Already matching years need no year reload',async()=>{const f=fixture({open:true,right:1500});assert(await f.controller.open());assert.equal(f.log.filter(x=>x[0]==='align').length,0);});
await test('Repeated clicks share one in-flight operation',async()=>{const f=fixture(),gate=f.ensureDelay(),a=f.controller.open(),b=f.controller.open();assert.equal(a,b);assert(f.controller.busy);gate.resolve();assert(await a);assert(!f.controller.busy);assert.equal(f.modes().length,1);});
await test('Closing while creation is pending prevents a late map creation and source write',async()=>{const f=fixture(),gate=f.ensureDelay(),a=f.controller.open();f.close();gate.resolve();assert.equal(await a,false);assert.equal(f.state.secondary,null);assert.equal(f.modes().length,0);assert.equal(f.errors.length,0);});
await test('Closing during the real map year request prevents its commit and late source writes',async()=>{const f=fixture({open:true}),gate=f.yearDelay(),a=f.controller.open();await tick();const old=f.state.secondary;f.close();gate.resolve();assert.equal(await a,false);assert.equal(old.year,1900);assert.equal(f.modes().length,0);assert.equal(f.errors.length,0);});
await test('A rejected real year load retains the last year and never switches sources',async()=>{const f=fixture({open:true}),gate=f.yearDelay(),a=f.controller.open();await tick();gate.reject(Error('fixture data error'));assert.equal(await a,false);assert.equal(f.state.secondary.year,1900);assert.equal(f.state.compareYear,1900);assert.equal(f.modes().length,0);assert.equal(f.errors.length,1);});
await test('A false year result cannot count as successful alignment',async()=>{const f=fixture({open:true});f.falseYear();assert.equal(await f.controller.open(),false);assert.equal(f.modes().length,0);assert.equal(f.errors.length,1);});
await test('Failed comparison creation does not align dates or change sources',async()=>{const f=fixture();f.failEnsure();assert.equal(await f.controller.open(),false);assert.equal(f.log.filter(x=>x[0]==='align').length,0);assert.equal(f.errors.length,1);});
await test('Origin year changes during creation invalidate the old request even without cancel',async()=>{const f=fixture(),gate=f.ensureDelay(),a=f.controller.open();f.state.year=1600;gate.resolve();assert.equal(await a,false);assert.equal(f.modes().length,0);});
await test('Manual source changes cancel pending source coordination',async()=>{const f=fixture({open:true}),gate=f.yearDelay(),a=f.controller.open();await tick();f.controller.cancel();f.state.primary.boundaries.mode='cshapes';gate.resolve();assert.equal(await a,false);assert.equal(f.state.primary.boundaries.mode,'cshapes');assert.equal(f.modes().length,0);});
await test('A later manual year request wins the real AtlasMap generation race',async()=>{const f=fixture({open:true}),gate=f.yearDelay(),a=f.controller.open();await tick();f.controller.cancel();const secondary=f.state.secondary;assert.notEqual(await secondary.setYear(1700),false);f.state.compareYear=1700;gate.resolve();assert.equal(await a,false);assert.equal(secondary.year,1700);assert.equal(f.state.compareYear,1700);assert.equal(f.modes().length,0);});
await test('Replacing a comparison while pending cannot write to the new pair',async()=>{const f=fixture({open:true}),gate=f.yearDelay(),a=f.controller.open();await tick();f.state.secondary={year:1800,destroyed:false};gate.resolve();assert.equal(await a,false);assert.equal(f.modes().length,0);});
await test('Camera is captured by value before layout changes',async()=>{const f=fixture(),gate=f.ensureDelay(),a=f.controller.open();f.cameras.left.center[0]=88;f.cameras.left.zoom=3;gate.resolve();assert(await a);assert.deepEqual(f.modes()[0][1].camera.center,[7,48]);assert.equal(f.modes()[0][1].camera.zoom,7);});
await test('Missing right-side origin and year zero are rejected without mutation',async()=>{const f=fixture();assert.equal(await f.controller.open('right'),false);f.state.year=0;assert.equal(await f.controller.open(),false);assert.deepEqual(f.log,[]);});
const report={checkedAt:new Date().toISOString(),actualYearMethod:'AtlasMap.prototype.setYear',mapEngineSha256:createHash('sha256').update(await readFile(modulePath)).digest('hex'),passed:results.filter(x=>x.pass).length,total:results.length,results};
if(process.argv[3])await writeFile(resolve(process.argv[3]),JSON.stringify(report,null,2)+'\n');
console.log(`${report.passed}/${report.total}`);assert.equal(report.passed,report.total);
