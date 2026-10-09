/** Real app function + real AtlasMap.setYear cancellation regressions; no DOM/network. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(process.argv[2]||resolve(here,'..'));
const source=await readFile(resolve(root,'public/app.js'),'utf8');
const {createBoundaryComparison}=await import(pathToFileURL(resolve(root,'public/boundary-comparison.js')));
const {AtlasMap}=await import(pathToFileURL(resolve(root,'public/map-engine.js')));
// Extract complete top-level bodies, preserving the real app commit/cancel logic.
function extract(name){
 const m=new RegExp('^(?:async )?function '+name+'\\(','m').exec(source);if(!m)return '';
 const start=m.index,body=source.indexOf('{',source.indexOf(')',start));
 let depth=0,quote='',comment='',escape=false;
 for(let i=body;i<source.length;i++){
  const c=source[i],next=source[i+1];
  if(comment==='//'){if(c==='\n')comment='';continue}
  if(comment==='/*'){if(c==='*'&&next==='/'){comment='';i++}continue}
  if(quote){if(escape){escape=false;continue}if(c==='\\'){escape=true;continue}if(c===quote)quote='';continue}
  if(c==='/'&&(next==='/'||next==='*')){comment=c+next;i++;continue}
  if(c==='"'||c==="'"||c==='`'){quote=c;continue}
  if(c==='{')depth++;if(c==='}'&&!--depth)return source.slice(start,i+1);
 }
 throw Error('Unclosed app function '+name);
}
const names=['setYear','applyYear','ensureAtlas','setCompareYear','closeComparison','boundaryComparisonController','openBoundaryComparison','cancelBoundaryComparison'];
const negativeControl=process.env.MERIDIAN_OLD_CANCEL==='1';
const functions=names.map(name=>negativeControl&&name==='cancelBoundaryComparison'?'function cancelBoundaryComparison(){boundaryComparison?.cancel();}':extract(name)).join('\n');
const declarations=source.slice(source.indexOf('let boundaryComparison='),source.indexOf('const params='));
assert(declarations.startsWith('let boundaryComparison='),'App declarations changed; update the harness explicitly.');
const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
function fixture(){
 const log=[];
 function makeMap(initial){
  const camera={center:[7,48],zoom:7,bearing:0,pitch:0};
  const m={year:initial,request:0,lang:'en',active:[],destroyed:false,ready:Promise.resolve(),gates:[],refreshLabels(){},upgradeLand(){},upgradeDetail(){},cleanup(){},destroy(){this.destroyed=true},
   map:{getCenter:()=>({toArray:()=>camera.center}),getZoom:()=>camera.zoom,getBearing:()=>camera.bearing,getPitch:()=>camera.pitch,jumpTo(value){log.push(['camera',initial,value]);Object.assign(camera,value)}}};
  m.regional={setYear(){},setMode(mode){m.boundaries.mode=mode;log.push(['mode',initial,mode])}};
  m.boundaries={mode:'auto',async prepare(year){const i=m.gates.findIndex(x=>x.year===year);if(i!==-1){const [g]=m.gates.splice(i,1);g.started=true;await g.promise}return {requested:this.mode,year}},commit(frame){log.push(['map-commit',initial,frame.year])}};
  m.setYear=(catalog,year,lang)=>AtlasMap.prototype.setYear.call(m,catalog,year,lang);
  m.delay=year=>{const gate={...deferred(),year,started:false};m.gates.push(gate);return gate};return m;
 }
 const left=makeMap(1500),right=makeMap(1650),nodes=new Map();
 const $=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,value:0,attributes:{},setAttribute(k,v){this.attributes[k]=v},classList:{remove(){}}});return nodes.get(id)};
 const factory=new Function('createBoundaryComparison','left','right','$','log',`
 const state={year:1500,compareYear:1650,compare:true,lang:'en',reference:false,borders:true,selectedSide:'left'};
 ${declarations}
 atlas=left;compareMap=right;catalog={records:[]};events=[];
 // This suite starts with a loaded pair. The real ensureAtlas early-ready branch
 // is exercised without entering the unrelated network/WebGL startup path.
 const atlasReady=true;let pendingInitialEvent=null,displayedPolityCount=null;

 const renderDatasetStatus=()=>{},pause=()=>{},renderYear=()=>{$('#yearInput').value=state.year},renderEvents=()=>{},renderBrowse=()=>{},renderRegionalStatus=()=>{},renderLayerLabels=()=>{},saveURL=()=>{},closeDetail=()=>{},notify=()=>{},mapError=(e)=>log.push(['error',e]),text=(a,b)=>b,yr=y=>y,normalizeYear=Number,toggleCompare=()=>{throw Error('Unexpected map creation')};
 ${functions}
 return {state,left,right,open:openBoundaryComparison,close:closeComparison,year:setYear,compareYear:setCompareYear,
  cancel:()=>{if(typeof cancelBoundaryComparison==='function')cancelBoundaryComparison();else boundaryComparison?.cancel()},
  pending:()=>({left:pendingYear,right:pendingCompareYear}),controller:()=>boundaryComparison,
  currentMaps:()=>({left:atlas,right:compareMap})};`);
 return {...factory(createBoundaryComparison,left,right,$,log),log,$};
}
const tests=[];
async function test(name,fn){try{await fn();tests.push({name,passed:true});console.log('PASS '+name)}catch(e){tests.push({name,passed:false,error:e.message});console.error('FAIL '+name+' '+e.message)}}
await test('Right-origin alignment cannot alter the left map after the user closes comparison',async()=>{
 const f=fixture(),gate=f.left.delay(1650),p=f.open('right');await tick();assert(gate.started);assert.equal(f.pending().left,1650);
 f.close();gate.resolve();assert.equal(await p,false);
 assert.equal(f.state.year,1500,'App year changed after close');assert.equal(f.left.year,1500,'Actual map year changed after close');
 assert.equal(f.state.compare,false);assert.equal(f.currentMaps().right,null);assert.equal(f.pending().left,null);
 assert.equal(f.$('#yearInput').value,1500);assert.equal(f.$('#atlasView').attributes['aria-busy'],'false');
 assert(!f.log.some(x=>x[0]==='mode'));
});
await test('Source/reference/layer cancellation prevents an outstanding secondary date commit',async()=>{
 const f=fixture(),gate=f.right.delay(1500),p=f.open('left');await tick();assert(gate.started);
 f.cancel();f.state.reference=true;gate.resolve();assert.equal(await p,false);
 assert.equal(f.state.compareYear,1650);assert.equal(f.right.year,1650);assert.equal(f.pending().right,null);
 assert.equal(f.$('#compareYear').value,1650);assert(!f.log.some(x=>x[0]==='mode'));
});
await test('A manual year request started after cancellation wins both map and app commits',async()=>{
 const f=fixture(),gate=f.right.delay(1500),p=f.open('left');await tick();assert(gate.started);
 assert.equal(await f.compareYear(1700),true);gate.resolve();assert.equal(await p,false);
 assert.equal(f.state.compareYear,1700);assert.equal(f.right.year,1700);assert.equal(f.pending().right,null);
});
await test('The old alignment finally cannot clear the sentinel for a new operation',async()=>{
 const f=fixture(),oldGate=f.right.delay(1500),old=f.open('left');await tick();assert(oldGate.started);f.cancel();
 const newGate=f.left.delay(1650),fresh=f.open('right');await tick();assert(newGate.started);
 oldGate.resolve();assert.equal(await old,false);await tick();
 f.close();newGate.resolve();assert.equal(await fresh,false);
 assert.equal(f.state.year,1500);assert.equal(f.left.year,1500);assert.equal(f.pending().left,null);
});
await test('Successful right-origin comparison still adopts the right year and reuses the pair',async()=>{
 const f=fixture(),right=f.right;assert.equal(await f.open('right'),true);
 assert.equal(f.currentMaps().right,right);assert.equal(f.state.year,1650);assert.equal(f.left.year,1650);
 assert.deepEqual(f.log.filter(x=>x[0]==='mode').map(x=>x[2]),['overview','regional']);
});
const report={checkedAt:new Date().toISOString(),negativeControl,appSha256:createHash('sha256').update(source).digest('hex'),actualFunctions:names.filter(x=>extract(x)),realMapMethod:'AtlasMap.prototype.setYear',passed:tests.filter(x=>x.passed).length,total:tests.length,tests};
if(process.argv[3])await writeFile(resolve(process.argv[3]),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(report.passed!==report.total)process.exitCode=1;
