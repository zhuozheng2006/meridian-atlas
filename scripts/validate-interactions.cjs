const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const ROOT=require('node:path').resolve(__dirname,'../public')+'/';
let researchState,polityNames;
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function context(){
 const nodes=new Map();const node=()=>({hidden:true,innerHTML:'',textContent:'',value:'',style:{},focus(){},replaceChildren(){},append(){},closest(){return null},classList:{toggle(){},add(){},remove(){},contains(){return false}},setAttribute(){},addEventListener(){},querySelector(s){return document.querySelector(s)},querySelectorAll(){return []}});
 const document={createElement:node,querySelector(s){if(!nodes.has(s))nodes.set(s,node());return nodes.get(s)},querySelectorAll(){return []},body:node(),documentElement:node(),addEventListener(){}};
 const c=vm.createContext({...researchState,...polityNames,console,document,window:{},location:{hash:''},history:{replaceState(){}},URLSearchParams,URL,setTimeout,clearTimeout,addEventListener(){},requestAnimationFrame:f=>f(),innerWidth:1200,Map,Set});
 for(const name of ['view-state.js','map-engine.js','timeline-controls.js','polity-reader.js','app.js']){const code=fs.readFileSync(ROOT+name,'utf8').replace(/^import .*$/gm,'').replace(/^export \{[^}\n]*\};?$/gm,'').replace(/\bexport (?=(?:const|function|async function|class)\b)/g,'').replace(/^init\(\);$/m,'');vm.runInContext(code,c,{filename:name});}
 vm.runInContext(`
 globalThis.actualRenderYear=renderYear;renderEvents=()=>{};renderYear=()=>{};renderBrowse=()=>{};saveURL=()=>{};showView=()=>{};
 globalThis.renderLog=[];
 const mapStub=()=>({year:1900,map:{resize(){},getCenter(){return [0,0]},getZoom(){return 1},getBearing(){return 0},getPitch(){return 0},jumpTo(){},on(){},off(){}},selectPolity(){},destroy(){this.destroyed=true},setYear:async()=>0,fly(){}});
 atlas=mapStub();atlasReady=true;mapURLRestored=true;compareMap=mapStub();catalog={records:[],metadata:{}};
 polityReader=new PolityReader({catalog:()=>catalog,language:()=>state.lang,events:()=>[],close:closeDetail});
 polityReader.render=function(){document.querySelector('#detailPanel').hidden=false;renderLog.push('polity:'+this.record.id)};
 renderEventDetail=e=>{document.querySelector('#detailPanel').hidden=false;renderLog.push('event:'+e.id)};
 globalThis.record={id:'clio-00001',name:'Test',start:1800,end:2000,type:'POLITY',verifiedWikidata:'Q1',center:[0,0],area:100};catalog.records=[record];
 globalThis.event={id:'E',start:1900,end:1900,lon:0,lat:0,locationType:'site',summary:{en:'Event',zh:'事件'},sources:[]};
 globalThis.panel=()=>document.querySelector('#detailPanel');
 `,c);return c;
}
const incomplete=()=>assert.fail('Interaction checks exited with an unresolved promise');
process.once('beforeExit',incomplete);
(async()=>{
 // Execute the real independent URL helpers; do not mock research state parsing.
 researchState=await import(require('node:url').pathToFileURL(ROOT+'research-view.js'));
 polityNames=await import(require('node:url').pathToFileURL(ROOT+'polity-names.js'));
 {
  const c=context(),search=c.document.querySelector('#search'),attributes=new Map();
  search.setAttribute=(name,value)=>attributes.set(name,value);
  vm.runInContext('renderHelp=()=>{};renderDensity=()=>{};renderLayerLabels=()=>{};',c);
  for(const [language,expected] of [['zh',/历史区划/],['en',/historical divisions/i]]){
   c.language=language;
   vm.runInContext('state.lang=language;renderLanguage();',c);
   assert.match(attributes.get('aria-label'),expected,'Search field accessible name after rendering '+language);
  }
  console.log('PASS the rendered Chinese and English search field names include historical divisions');
 }
 {
  const c=context(),input=c.document.querySelector('#search'),results=c.document.querySelector('#eventList');
  const listeners=new Map(),observers=new Set(),opened=[];
  input.addEventListener=(name,fn)=>listeners.set(name,fn);
  c.MutationObserver=class {
   constructor(callback){this.callback=callback;}
   observe(node){assert.equal(node,results);observers.add(this);}
   disconnect(){observers.delete(this);}
  };
  let first=null;
  const showResult=value=>{
   first=value?{click:()=>opened.push(value)}:null;
   for(const observer of observers)observer.callback();
  };
  let directoryGate=null;
  results.querySelector=selector=>selector==='[data-division-results]'?directoryGate:first;
  c.refreshSearch=value=>showResult(value.startsWith('wait')?null:value);
  vm.runInContext('renderEvents=()=>refreshSearch(state.search);bindLayers=()=>{};bind();',c);
  const type=value=>{input.value=value;input.oninput({target:input});};
  const key=(key,extra={})=>listeners.get('keydown')({key,preventDefault(){},...extra});
  showResult('Rome');type('唐');key('Enter');
  assert.deepEqual(opened,['唐']);
  type('wait for battle');key('Enter');showResult('battle');showResult('second match');
  assert.deepEqual(opened,['唐','battle']);
  for(const action of ['new input','blur','Escape','compositionstart']){
   type('wait for place');key('Enter');
   if(action==='new input')type('another place');else if(action==='Escape')key('Escape');else listeners.get(action)();
   showResult('late place');assert.deepEqual(opened,['唐','battle'],action);
  }
  type('wait for composition');key('Enter',{isComposing:true});showResult('partial spelling');key('Escape');
  assert.deepEqual(opened,['唐','battle']);
  directoryGate={dataset:{waitForDivision:'true'}};
  type('#742-64');key('Enter');
  assert.deepEqual(opened,['唐','battle']);
  showResult('unrelated result while the index loads');
  assert.deepEqual(opened,['唐','battle']);
  delete directoryGate.dataset.waitForDivision;
  showResult('Gui Zhou #742-64');showResult('another asynchronous result');
  assert.deepEqual(opened,['唐','battle','Gui Zhou #742-64']);
  let focused=0;
  directoryGate={dataset:{waitForDivision:'true'},querySelector:()=>({focus(){focused++;}})};
  type('Gui Zhou');key('Enter');
  directoryGate.dataset.multipleExact='true';
  delete directoryGate.dataset.waitForDivision;
  showResult('first ambiguous division');showResult('another late group');
  assert.equal(focused,1);
  assert.deepEqual(opened,['唐','battle','Gui Zhou #742-64']);
  assert.equal(observers.size,0);
  console.log('PASS search Enter opens the current query, supports later results, and cancels stale keyboard navigation');
 }
 {
  const code=fs.readFileSync(ROOT+'app.js','utf8');
  const source=code.slice(code.indexOf('async function renderMapDivisionResults('),code.indexOf('function bindMapSearch()'));
  const createRenderer=new Function('state','document','text','loadModule',
   'return '+source.replace(/import\('\.\/division-search\.js(?:\?v=[^']+)?'\)/,'loadModule()'));
  const search=await import(require('node:url').pathToFileURL(ROOT+'division-search.js'));
  const originalFetch=globalThis.fetch,reads=[];
  globalThis.fetch=async url=>{reads.push(String(url));return new Response(fs.readFileSync(ROOT+String(url).split('?')[0]));};
  const state={view:'atlas',year:1492,lang:'en',search:''};
  function node(tag) {
   return {tag,dataset:{},children:[],hidden:true,isConnected:true,
    append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},
    remove(){this.isConnected=false;},parentElement:{prepend(){},querySelector(){return null;}}};
  }
  const renderWith=load=>createRenderer(state,{createElement:node},(_zh,en)=>en,load);
  const render=renderWith(async()=>search);
  try {
   const slot=node('section');state.search='Gui Zhou';await render(slot,state.search);
   const links=slot.children.filter(child=>child.dataset.division);
   assert.equal(slot.dataset.multipleExact,'true');assert.equal(links.length,5);assert.deepEqual(links.map(link=>link.dataset.division.split('-').at(-1)),['39','64','134','145','317']);
   const gui=links[1],url=new URL(gui.href,'https://example.test/meridian-atlas/'),hash=new URLSearchParams(url.hash.slice(1));
   assert.equal(hash.get('year'),'742');assert.equal(hash.get('boundary'),'china-prefecture-742-64');assert.equal(hash.get('lang'),'en');
   assert(gui.children[1].textContent.includes('Lingnan Dao'));assert(gui.children[1].textContent.includes('Under review'));
   assert.deepEqual(reads.map(path=>path.split('?')[0]),['data/fast/division-search.json.gz']);
   const broad=node('section');state.search='zhou';await render(broad,state.search);
   assert.equal(broad.children.filter(child=>child.dataset.division).length,9);
   assert.equal(new URL(broad.children.at(-1).href,'https://example.test/meridian-atlas/').searchParams.get('divisionQuery'),'zhou');
   const none=node('section');state.search='absent-qzx';await render(none,state.search);assert.equal(none.isConnected,false);
   let release;const late=node('section'),gate=new Promise(resolve=>release=resolve);
   state.search='742-64';const old=renderWith(()=>gate)(late,state.search);
   assert.equal(late.dataset.waitForDivision,'true');
   state.search='current';release(search);await old;assert.equal(late.children.length,0);
   const failed=node('section');let tries=0;state.search='#2-33';
   await renderWith(async()=>{if(!tries++)throw Error('offline');return search;})(failed,state.search);
   assert.equal(failed.hidden,false);assert.equal(failed.dataset.waitForDivision,undefined);
   const retry=failed.children.at(-1);assert.equal(retry.tag,'button');retry.onclick();await flush();
   assert.equal(failed.children[1].dataset.division,'china-prefecture-2-33');
   assert.equal(failed.dataset.multipleExact,'false');
   for(const query of ['3','#3']){
    const numeric=node('section');state.search=query;await render(numeric,query);
    assert.equal(numeric.dataset.multipleExact,'true');
    assert.deepEqual(numeric.children.filter(child=>child.dataset.division).map(link=>link.dataset.division).sort(),
     ['china-prefecture-2-3','china-prefecture-742-3']);
   }
  }finally{globalThis.fetch=originalFetch;}
  console.log('PASS actual Han–Tang search hits use an isolated index, retain identities, link across years and retry safely');
 }
 {
  const c=context();
  vm.runInContext(`
   currentEra=()=>[0,'Era','Era'];renderRegionalStatus=()=>{};renderYear=actualRenderYear;
   const input=document.querySelector('#yearInput');
   bindTimeline({getYear:()=>state.year,getCompareYear:()=>state.compareYear,getStep:()=>10,commit:y=>{globalThis.committedDraft=y;},commitCompare(){},pause(){},isAtlas:()=>true,isDialogOpen:()=>false});
   input.value='1500';input.oninput();globalThis.release=null;atlas.setYear=()=>new Promise(r=>release=r);globalThis.yearPromise=applyYear(1945);
  `,c);
  assert.equal(vm.runInContext("document.querySelector('#yearInput').value",c),'1500');
  await flush();vm.runInContext('release(1)',c);await vm.runInContext('yearPromise',c);
  assert.equal(vm.runInContext('state.year',c),1945);
  assert.equal(vm.runInContext("document.querySelector('#yearInput').value",c),'1500');
  vm.runInContext("document.querySelector('#yearInput').onchange()",c);
  assert.equal(vm.runInContext('committedDraft',c),1500);
  assert.equal(vm.runInContext("document.querySelector('#yearInput').atlasYearDraft",c),false);
  console.log('PASS in-flight year completion preserves a newer unsubmitted input draft');
 }
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
  vm.runInContext(`globalThis.releases=[];atlas.setYear=()=>new Promise(r=>releases.push(r));globalThis.a=openEvent({...event,id:'A',start:1800});`,c);
  await flush();assert.equal(vm.runInContext('releases.length',c),1);
  vm.runInContext(`globalThis.b=openEvent({...event,id:'B',start:1900});`,c);
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
  const c=context();vm.runInContext(`globalThis.finish=null;const oldMap=compareMap;oldMap.setYear=()=>new Promise(r=>finish=r);globalThis.wait=setCompareYear(1914);`,c);
  await flush();assert.equal(vm.runInContext('typeof finish',c),'function');vm.runInContext('compareMap=mapStub();finish(1)',c);await vm.runInContext('wait',c);assert.equal(vm.runInContext('state.compareYear',c),1900);
  console.log('PASS removed comparison cannot commit a late year');
 }
 {
  const c=context();vm.runInContext(`globalThis.finish=null;globalThis.renders=0;loadNative=()=>new Promise(r=>finish=r);const subject={request:1,active:[],year:1492,catalog:{},geometryKey:'o',renderGeometry(){renders++}};globalThis.wait=AtlasMap.prototype.upgradeDetail.call(subject);subject.request=2;`,c);
  vm.runInContext('finish(new Map())',c);await vm.runInContext('wait',c);assert.equal(vm.runInContext('renders',c),0);
  vm.runInContext('globalThis.wait=AtlasMap.prototype.upgradeDetail.call(subject);finish(new Map());',c);await vm.runInContext('wait',c);assert.equal(vm.runInContext('renders',c),1);
  console.log('PASS a stale native upgrade cannot overwrite a newer year or lock future upgrades');
 }
})().then(()=>process.removeListener('beforeExit',incomplete));
