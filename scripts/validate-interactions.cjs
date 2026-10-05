const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const ROOT=require('node:path').resolve(__dirname,'../public')+'/';
let researchState;
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function context(){
 const nodes=new Map();const node=()=>({hidden:true,innerHTML:'',textContent:'',value:'',style:{},focus(){},replaceChildren(){},append(){},closest(){return null},classList:{toggle(){},add(){},remove(){},contains(){return false}},setAttribute(){},addEventListener(){},querySelector(s){return document.querySelector(s)},querySelectorAll(){return []}});
 const document={createElement:node,querySelector(s){if(!nodes.has(s))nodes.set(s,node());return nodes.get(s)},querySelectorAll(){return []},body:node(),documentElement:node(),addEventListener(){}};
 const c=vm.createContext({...researchState,console,document,window:{},location:{hash:''},history:{replaceState(){}},URLSearchParams,URL,setTimeout,clearTimeout,addEventListener(){},requestAnimationFrame:f=>f(),innerWidth:1200,Map,Set});
 for(const name of ['view-state.js','map-engine.js','timeline-controls.js','polity-reader.js','app.js']){const code=fs.readFileSync(ROOT+name,'utf8').replace(/^import .*$/gm,'').replace(/\bexport (?=(?:const|function|async function|class)\b)/g,'').replace(/^init\(\);$/m,'');vm.runInContext(code,c,{filename:name});}
 vm.runInContext(`
 renderEvents=()=>{};renderYear=()=>{};renderBrowse=()=>{};saveURL=()=>{};showView=()=>{};
 globalThis.renderLog=[];
 const mapStub=()=>({year:1900,map:{resize(){},getCenter(){return [0,0]},getZoom(){return 1},getBearing(){return 0},getPitch(){return 0},jumpTo(){},on(){},off(){}},selectPolity(){},destroy(){this.destroyed=true},setYear:async()=>0,fly(){}});
 atlas=mapStub();atlasReady=true;mapURLRestored=true;compareMap=mapStub();catalog={records:[],metadata:{}};
 polityReader=new PolityReader({catalog:()=>catalog,language:()=>state.lang,events:()=>[],close:closeDetail});
 polityReader.render=function(){document.querySelector('#detailPanel').hidden=false;renderLog.push('polity:'+this.record.id)};
 renderEventDetail=e=>{document.querySelector('#detailPanel').hidden=false;renderLog.push('event:'+e.id)};
 globalThis.record={id:'clio-00001',name:'Test',start:1800,end:2000,type:'POLITY',verifiedWikidata:'Q1',center:[0,0],area:100};catalog.records=[record];
 globalThis.event={id:'E',start:1900,end:1900,lon:0,lat:0,locationType:'site'};
 globalThis.panel=()=>document.querySelector('#detailPanel');
 `,c);return c;
}
(async()=>{
 // Execute the real independent URL helpers; do not mock research state parsing.
 researchState=await import(require('node:url').pathToFileURL(ROOT+'research-view.js'));
 for(const action of ['toggleCompare','closeDetail','eventSwitch']){
  const c=context();
  vm.runInContext(`
  globalThis.release=null;const pending=new Promise(r=>release=r);
  readJSON=url=>pending.then(()=>url.includes('profile-index')?{records:{'clio-00001':{qid:'Q1'}},profiles:{Q1:{file:'profiles/Q1.json.gz'}}}:url.includes('/profiles/')?{qid:'Q1'}:url.includes('records-')?{'clio-00001':record}:{entries:[]});
  state.compare=true;state.selectedSide='right';state.selectedPolity=record;
  globalThis.openPromise=polityReader.open(record,compareMap);
  `,c);
  if(action==='toggleCompare')await vm.runInContext('toggleCompare()',c);
  if(action==='closeDetail')vm.runInContext('closeDetail()',c);
  if(action==='eventSwitch')await vm.runInContext('openEvent(event)',c);
  const before=vm.runInContext('({hidden:panel().hidden,seq:polityReader.seq,selectedPolity:state.selectedPolity?.id})',c);
  vm.runInContext('release()',c);await vm.runInContext('openPromise',c);
  const after=vm.runInContext('({hidden:panel().hidden,seq:polityReader.seq,selectedPolity:state.selectedPolity?.id,renderLog})',c);
  if(action!=='eventSwitch')assert.equal(after.hidden,true);assert.equal(after.renderLog.filter(x=>x.startsWith('polity:')).length,1);console.log('PASS pending polity after '+action);
 }
 {
  const c=context();
  vm.runInContext(`globalThis.release=null;atlas.setYear=()=>new Promise(r=>release=r);globalThis.openPromise=openEvent(event);closeDetail();`,c);
  await flush(); // setYear now crosses the resolved lazy-ready boundary first.
  const before=vm.runInContext('({hidden:panel().hidden,selected:state.selected?.id})',c);
  vm.runInContext('release(1)',c);await vm.runInContext('openPromise',c);
  const after=vm.runInContext('({hidden:panel().hidden,selected:state.selected?.id,renderLog})',c);
  assert.equal(after.hidden,true);assert.equal(after.renderLog.length,0);console.log('PASS closing an event during map loading');
 }
 {
  const c=context();
  vm.runInContext(`globalThis.releases=[];atlas.setYear=()=>new Promise(r=>releases.push(r));globalThis.a=openEvent({...event,id:'A',start:1800});globalThis.b=openEvent({...event,id:'B',start:1900});`,c);
  await flush();
  vm.runInContext('releases[1](1)',c);await vm.runInContext('b',c);vm.runInContext('releases[0](1)',c);await vm.runInContext('a',c);
  const result=vm.runInContext('({selected:state.selected?.id,year:state.year,renderLog})',c);assert.equal(result.selected,'B');assert.equal(result.year,1900);assert.deepEqual(Array.from(result.renderLog),['event:B']);console.log('PASS out-of-order event responses');
 }
 {
  const c=context();
  vm.runInContext(`state.compare=true;compareMap.setYear=async(c,y)=>{compareMap.year=y;return 0};globalThis.openPromise=openEvent({...event,id:'prehistory',start:-48000},{whichMap:compareMap});`,c);
  await vm.runInContext('openPromise',c);
  const result=vm.runInContext('({selected:state.selected?.id,compareYear:state.compareYear,hidden:panel().hidden,renderLog})',c);assert.equal(result.compareYear,-48000);assert.equal(result.hidden,false);assert.deepEqual(Array.from(result.renderLog),['event:prehistory']);console.log('PASS prehistoric events in the comparison map');
 }
 {
  const c=context();vm.runInContext(`state.year=1492;atlas.year=1492;atlas.setYear=async()=>{throw Error('network')};`,c);
  await vm.runInContext('setYear(1914)',c);
  const r=vm.runInContext('({year:state.year,displayed:atlas.year,pending:pendingYear,error:document.querySelector("#mapError").hidden})',c);
  assert.equal(r.year,1492);assert.equal(r.displayed,1492);assert.equal(r.pending,null);assert.equal(r.error,false);
  console.log('PASS failed year keeps the displayed map and year consistent');
 }
 {
  const c=context();vm.runInContext(`globalThis.finish=null;const oldMap=compareMap;oldMap.setYear=()=>new Promise(r=>finish=r);globalThis.wait=setCompareYear(1914);compareMap=mapStub();`,c);
  vm.runInContext('finish(1)',c);await vm.runInContext('wait',c);assert.equal(vm.runInContext('state.compareYear',c),1900);
  console.log('PASS removed comparison cannot commit a late year');
 }
 {
  const c=context();vm.runInContext(`globalThis.finish=null;globalThis.renders=0;loadNative=()=>new Promise(r=>finish=r);const subject={request:1,active:[],year:1492,catalog:{},geometryKey:'o',renderGeometry(){renders++}};globalThis.wait=AtlasMap.prototype.upgradeDetail.call(subject);subject.request=2;`,c);
  vm.runInContext('finish(new Map())',c);await vm.runInContext('wait',c);assert.equal(vm.runInContext('renders',c),0);
  vm.runInContext('globalThis.wait=AtlasMap.prototype.upgradeDetail.call(subject);finish(new Map());',c);await vm.runInContext('wait',c);assert.equal(vm.runInContext('renders',c),1);
  console.log('PASS a stale native upgrade cannot overwrite a newer year or lock future upgrades');
 }
})();
