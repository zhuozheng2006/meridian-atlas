const fs=require('fs'),path=require('path'),vm=require('vm'),zlib=require('zlib'),crypto=require('crypto'),assert=require('node:assert/strict');
const candidates=process.argv[2]?[path.resolve(process.argv[2],'public'),path.resolve(process.argv[2])]:[process.env.ATLAS_DIST,path.resolve(process.cwd(),'public'),path.resolve(__dirname,'../public')].filter(Boolean);
const ROOT=candidates.find(p=>fs.existsSync(path.join(p,'app.js')));
if(!ROOT)throw Error('Run from the atlas checkout, place this test in scripts/, provide its root argument, or set ATLAS_DIST to its public directory');
const files=['view-state.js','map-engine.js','places.js','timeline-controls.js','polity-reader.js','regional-boundaries.js','app.js'];
const snapshots=Object.fromEntries(files.map(n=>[n,fs.readFileSync(path.join(ROOT,n),'utf8')]));
const readData=n=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ROOT,'data',n+'.json.gz'))));
const realCatalog=readData('fast/catalog'),realEvents=readData('events');
const realEvent=realEvents.find(e=>e.id==='anc-columbus');
const realPolity=realCatalog.records.filter(r=>r.name==='Qin Dynasty').sort((a,b)=>a.start-b.start)[0];
const realPlace=readData('places/urban-observations').cities.find(p=>p.id==='chandler:1202');
assert(realEvent&&realPolity&&realPlace,'Required real historical fixtures exist');
const flush=()=>new Promise(r=>setImmediate(r));
let researchState,polityNames,chgis,china,awmc,mapCatalogModule;
function context(hash=''){
 const nodes=new Map(),keyListeners=[],eventListeners=new Map();
 const node=()=>({hidden:true,innerHTML:'',textContent:'',value:'',style:{},dataset:{},isConnected:true,scrollTop:0,focus(){},replaceChildren(){},append(){},insertAdjacentHTML(){},closest(){return null},matches(){return false},click(){this.onclick?.({target:this})},classList:{toggle(){},add(){},remove(){},contains(){return false}},setAttribute(k,v){this[k]=v},addEventListener(){},querySelector(s){return document.querySelector(s)},querySelectorAll(){return []}});
 const document={createElement:node,querySelector(s){if(!nodes.has(s))nodes.set(s,node());return nodes.get(s)},querySelectorAll(){return []},body:node(),documentElement:node(),addEventListener(type,fn){if(type==='keydown')keyListeners.push(fn);if(!eventListeners.has(type))eventListeners.set(type,[]);eventListeners.get(type).push(fn)}};
 const location={hash,href:'https://example.test/'+hash};
 const c=vm.createContext({...mapCatalogModule,readMapCatalog:url=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ROOT,url)))),...researchState,...polityNames,...chgis,...china,...awmc,console,document,window:{},location,history:{replaceState(a,b,url){location.hash=url;location.href='https://example.test/'+url;}},URLSearchParams,URL,setTimeout,clearTimeout,addEventListener(){},requestAnimationFrame:f=>f(),innerWidth:1200,Map,Set,realCatalog,realEvents,realEvent,realPolity,realPlace,keyListeners,eventListeners,cityNarrative:async()=>null,prefetchNativeFrame:async()=>false});
 for(const name of files){const code=snapshots[name].replace(/^import .*$/gm,'').replace(/^export \{[^}\n]*\};?$/gm,'').replace(/\bexport (?=(?:const|function|async function|class)\b)/g,'').replace(/^init\(\);$/m,'');vm.runInContext(code,c,{filename:name});}
 vm.runInContext(`
 globalThis.renderLog=[];globalThis.focusLog=[];globalThis.readerOptions=[];globalThis.originalBindLayers=bindLayers;globalThis.originalRenderYear=renderYear;
 const makeMap=()=>({year:1492,lang:state.lang,geometryKey:'o',active:[],map:{camera:{center:[25,18],zoom:2,bearing:0,pitch:0},resize(){},getCenter(){const a=this.camera.center;return {lng:a[0],lat:a[1],toArray(){return a}}},getZoom(){return this.camera.zoom},getBearing(){return this.camera.bearing},getPitch(){return this.camera.pitch},jumpTo(camera){const center=camera.center;this.camera={...this.camera,...camera,...(center?{center:Array.isArray(center)?center:[center.lng,center.lat]}:{})}},on(){},off(){}},places:{select(p){this.selected=p},toggle(){},setModern(){},setYear(){}},geography:{toggle(){},alignCoast(){},setReference(){}},selectPolity(){},refreshLabels(){},toggleBorders(){},projection(){},setEvents(){},destroy(){this.destroyed=true},async setYear(c,y,lang){this.year=y;this.lang=lang;return 1},fly(lon,lat,zoom){this.map.camera={...this.map.camera,center:[lon,lat],zoom}},focusPolity(r){focusLog.push(r.id);this.map.camera={...this.map.camera,center:r.center||[10,20],zoom:3}}});
 atlas=makeMap();atlasReady=true;mapURLRestored=true;compareMap=null;catalog=realCatalog;events=realEvents;eventsStatus='ready';
 polityReader={seq:0,open(r,m,opts){document.querySelector('#detailPanel').hidden=false;renderLog.push('polity:'+r.id);readerOptions.push(opts)}};
 renderEvents=()=>{};renderYear=()=>saveURL();renderBrowse=()=>{};renderLanguage=()=>{};renderPolities=()=>{};bindLayers=()=>{};
 renderEventDetail=e=>{beginDetail();document.querySelector('#detailPanel').hidden=false;renderLog.push('event:'+e.id)};
 renderPlaceDetail=p=>{document.querySelector('#detailPanel').hidden=false;renderLog.push('place:'+p.id)};
 placeDetail=async p=>p;
 globalThis.panel=()=>document.querySelector('#detailPanel');
 globalThis.prepareInit=()=>{
  // Real boot and URL restoration run from a cold state; renderer/network remain fixture boundaries.
  atlas=null;atlasReady=false;mapURLRestored=false;catalog=undefined;events=[];catalogDataPromise=null;eventsDataPromise=null;eventsStatus='idle';pendingInitialEvent=null;displayedPolityCount=null;atlasBootPromise=null;
  loadMapLibre=async()=>({});renderDensity=()=>{};renderYear=originalRenderYear;
  AtlasMap=class{constructor(container,options){const m=makeMap();m.year=options.year;if(options.camera)m.map.jumpTo(options.camera);Object.assign(this,m)}startGeography(){return Promise.resolve(true);}};
  PolityReader=class{constructor(){this.seq=0}open(r,m,opts){renderLog.push('polity:'+r.id);readerOptions.push(opts)}};
  readJSON=async url=>url.includes('map-catalog/')?readMapCatalog(url):url.includes('catalog')?realCatalog:url.includes('events')?realEvents:[];
  loadPlaces=async()=>[realPlace];bind=()=>{};bindPlaceLayer=()=>{};
 };
 `,c);return c;
}
function value(c,code){return vm.runInContext(code,c)}
const results=[];
async function test(name,fn){try{await fn();results.push({name,pass:true});console.log('PASS '+name)}catch(e){results.push({name,pass:false,error:e.stack});console.error('FAIL '+name+'\n'+e.message)}}
async function run(){
 mapCatalogModule=await import(require('node:url').pathToFileURL(path.join(ROOT,'map-catalog.js')));
 researchState=await import(require('node:url').pathToFileURL(path.join(ROOT,'research-view.js')));
 awmc=await import(require('node:url').pathToFileURL(path.join(ROOT,'awmc-boundaries.js')));
 china=await import(require('node:url').pathToFileURL(path.join(ROOT,'china-prefectures.js')));
 chgis=await import(require('node:url').pathToFileURL(path.join(ROOT,'chgis-boundaries.js')));
 polityNames=await import(require('node:url').pathToFileURL(path.join(ROOT,'polity-names.js')));
 for(const side of ['left','right'])await test(`city to polity navigation opens the ${side} dossier`,async()=>{
  const c=context();value(c,`state.selectedPlace=realPlace;state.selectedSide='${side}';state.view='polities';panel().hidden=false;${side==='right'?"state.compare=true;compareMap=makeMap();state.compareYear=1492;":''}`);
  await value(c,`jumpPolity(realPolity,${side==='right'?'compareMap':'atlas'})`);
  assert.equal(value(c,side==='right'?'state.compareYear':'state.year'),realPolity.start);
  assert.equal(value(c,'state.selectedPolity?.id'),realPolity.id);assert.equal(value(c,'panel().hidden'),false);assert.equal(value(c,'state.selectedPlace'),null);assert.equal(value(c,'state.selectedSide'),side);
 });
 for(const side of ['left','right'])for(const saved of [true,false])await test(`event share restores ${side} year ${saved?'with':'without'} a saved camera`,async()=>{
  const c=context();if(side==='right')value(c,'state.compare=true;compareMap=makeMap();state.compareYear=1900;');
  await value(c,`openEvent(realEvent,{whichMap:${side==='right'?'compareMap':'atlas'}})`);await value(c,side==='right'?'setCompareYear(1800)':'setYear(1800)');
  value(c,'atlas.map.jumpTo({center:[72.12345,34.56789],zoom:6.125,bearing:-37.25,pitch:42.5});saveURL()');
  const camera=value(c,'encodeCamera(atlas.map)'),params=new URLSearchParams(value(c,'location.hash').slice(1));if(!saved)params.delete('camera');
  const recipient=context('#'+params);value(recipient,'prepareInit()');await value(recipient,'init()');
  assert.equal(value(recipient,side==='right'?'state.compareYear':'state.year'),1800);assert.equal(value(recipient,'state.selected?.id'),realEvent.id);assert.equal(value(recipient,'state.selectedSide'),side);
  if(saved){assert.equal(value(recipient,'encodeCamera(atlas.map)'),camera);if(side==='right')assert.equal(value(recipient,'encodeCamera(compareMap.map)'),camera);}
 });
 function errorBox(c){
  const box=value(c,"$('#mapError')");
  box.replaceChildren=()=>{for(const child of box.children||[])child.parentNode=null;box.children=[];};
  box.append=(...children)=>{box.children=children;for(const child of children)child.parentNode=box;};
  return box;
 }
 const savedCamera='12.5,41.9,7.25,-20,35';
 for(const [kind,dataset,collection,selected,loader] of [
  ['battle','battles','battles','selectedBattle','loadBattles'],
  ['atrocity','atrocities','incidents','selectedAtrocity','loadAtrocities']
 ]){
  const module=await import(require('node:url').pathToFileURL(path.join(ROOT,dataset+'.js')));
  const data=readData(dataset),record=data[collection][0],loaded=kind==='battle'?data.battles:data;
  async function sharedPoint({right=false,id=record.id}={}){
   const params=new URLSearchParams({year:1492,lang:'en',camera:savedCamera,[kind]:id});
   if(right){params.set('compare','1');params.set('compareYear','1900');params.set('side','right');}
   const c=context('#'+params);
   Object.assign(c,module);
   let resolve,reject,reads=0;
   c[loader]=()=>{reads++;return new Promise((yes,no)=>{resolve=yes;reject=no;});};
   const box=errorBox(c);
   value(c,'prepareInit()');
   const opening=value(c,'init()');
   await flush();
   assert.equal(reads,1,'the link must have started its data request');
   return {c,box,opening,resolve:()=>resolve(loaded),reject:()=>reject(Error('record data offline')),
    get reads(){return reads;},selection:()=>value(c,'state.'+selected+'?.id'),hash:()=>new URLSearchParams(c.location.hash.slice(1))};
  }
  for(const right of [false,true])await test(kind+' share restores the '+(right?'right':'left')+' record and saved camera',async()=>{
   const h=await sharedPoint({right});
   value(h.c,'saveURL()');
   assert.equal(h.hash().get(kind),record.id);
   h.resolve();await h.opening;
   assert.equal(h.selection(),record.id);
   assert.equal(value(h.c,'state.selectedSide'),right?'right':'left');
   assert.equal(value(h.c,'encodeCamera(atlas.map)'),savedCamera);
   assert.equal(value(h.c,right?'state.compareYear':'state.year'),right?1900:1492);
  });
  for(const [action,navigate] of [
   ['change year','setYear(1700)'],['change comparison year','setCompareYear(1914)'],['close comparison','closeComparison()'],
   ['open another detail','openEvent(realEvent,{whichMap:atlas,preserveYear:true})']
  ])await test(kind+' pending share yields to '+action,async()=>{
   const h=await sharedPoint({right:true});
   await value(h.c,navigate);h.resolve();await h.opening;
   assert.equal(h.selection(),undefined);assert.equal(h.hash().has(kind),false);
   if(action==='open another detail')assert.equal(h.hash().get('event'),realEvent.id);
  });
  await test(kind+' failed share preserves its link and retries only the record',async()=>{
   const h=await sharedPoint({right:true});h.reject();await h.opening;
   assert.equal(value(h.c,'atlasReady'),true);assert.equal(h.box.hidden,false);
   assert.match(h.box.children[0].textContent,kind==='battle'?/battle/i:/mass.violence/i);
   assert.equal(h.hash().get(kind),record.id);
   const retry=h.box.children[1].onclick();await flush();assert.equal(h.reads,2);
   h.resolve();await retry;assert.equal(h.selection(),record.id);assert.equal(h.box.hidden,true);
   assert.equal(value(h.c,'state.selectedSide'),'right');
  });
  await test(kind+' unknown shared ID reports a missing record and leaves the map ready',async()=>{
   const h=await sharedPoint({id:'missing-record'});h.resolve();await h.opening;
   assert.equal(h.selection(),undefined);assert.equal(h.hash().has(kind),false);assert.equal(h.box.hidden,true);
   assert.match(value(h.c,"$('#toast').textContent"),/could not be found/);
  });
  await test(kind+' old retry cannot reopen a record after choosing another one',async()=>{
   const h=await sharedPoint();h.reject();await h.opening;
   const retry=h.box.children[1].onclick;
   await value(h.c,'openEvent(realEvent,{whichMap:atlas,preserveYear:true})');
   await retry();assert.equal(h.box.hidden,true);assert.equal(h.reads,1);
   assert.equal(h.hash().has(kind),false);assert.equal(h.hash().get('event'),realEvent.id);
  });
  await test(kind+' superseded network failure cannot show an error or re-arm the link',async()=>{
   const h=await sharedPoint();await value(h.c,'setYear(1700)');
   h.reject();await h.opening;
   assert.equal(h.box.hidden,true);assert.equal(h.hash().has(kind),false);
   await value(h.c,"showView('atlas')");assert.equal(h.reads,1);
  });
 }
 const divisions=readData('china-prefectures/index').records;
 const tang=divisions.find(r=>r.id==='china-prefecture-742-29');
 assert(tang,'The shared Tang record must exist in the shipped data');
 async function sharedDivision({side='left',id=tang.id}={}){
  const right=side==='right',params=new URLSearchParams({year:right?2:742,boundaries:'regional',lang:'en',boundary:id});
  if(right){params.set('compare','1');params.set('compareYear','742');params.set('side',side);}
  const c=context('#'+params),box=errorBox(c),opened=[];
  let reads=0,resolve,reject,close;
  c.stubRegional=(map,options)=>{
   map.ensureDetailLayers=async()=>true;
   map.regional={mode:'regional',enabled:true,setModern(){},closePopup(){close?.();},async restoreChinaRecord(recordId,current){
    reads++;await new Promise((yes,no)=>{resolve=yes;reject=no;});
    if(!current()||!divisions.some(row=>row.id===recordId&&row.year===map.year))return false;
    options.onBoundarySelection(recordId);opened.push(recordId);
    close=()=>{close=null;options.onBoundarySelection(null,recordId);};
    return true;
   }};
  };
  value(c,`bind();prepareInit();AtlasMap=class extends AtlasMap{
   constructor(container,options){super(container,options);stubRegional(this,options);}
  }`);
  const opening=value(c,'init()');await flush();
  assert.equal(reads,1,'the cold link should request the regional record');
  return {c,box,opening,opened,close:()=>close(),resolve:()=>resolve(),reject:()=>reject(Error('China archive offline')),
   get reads(){return reads;},hash:()=>new URLSearchParams(c.location.hash.slice(1))};
 }
 for(const side of ['left','right'])await test('shared division opens on the '+side+' map and closing the popup clears its link',async()=>{
  const h=await sharedDivision({side});
  value(h.c,'saveURL()');assert.equal(h.hash().get('boundary'),tang.id);
  h.resolve();await h.opening;
  assert.deepEqual(h.opened,[tang.id]);assert.equal(value(h.c,'state.selectedBoundary.side'),side);
  assert.equal(h.hash().get('boundary'),tang.id);assert.equal(h.hash().get('side'),side==='right'?side:null);
  value(h.c,`boundarySelection(null,${side==='right'?'compareMap':'atlas'},'china-prefecture-742-8')`);
  assert.equal(h.hash().get('boundary'),tang.id,'Dismissing a previous popup must keep the new record link');
  h.close();assert.equal(value(h.c,'state.selectedBoundary'),null);assert.equal(h.hash().has('boundary'),false);
 });
 await test('failed division keeps its link and retries the archive on the same map',async()=>{
  const h=await sharedDivision();h.reject();await h.opening;
  assert.equal(value(h.c,'atlasReady'),true);assert.equal(h.box.hidden,false);
  assert.equal(h.hash().get('boundary'),tang.id);const map=value(h.c,'atlas');
  const retry=h.box.children[1].onclick();await flush();assert.equal(h.reads,2);h.resolve();await retry;
  assert.deepEqual(h.opened,[tang.id]);assert.equal(value(h.c,'atlas'),map);assert.equal(h.box.hidden,true);
 });
 await test('a superseded division retry cannot replace the newly opened record',async()=>{
  const h=await sharedDivision();h.reject();await h.opening;
  const retry=h.box.children[1].onclick;
  await value(h.c,'openEvent(realEvent,{whichMap:atlas,preserveYear:true})');
  await retry();assert.equal(h.reads,1);assert.deepEqual(h.opened,[]);
  assert.equal(h.box.hidden,true);assert.equal(h.hash().has('boundary'),false);assert.equal(h.hash().get('event'),realEvent.id);
 });
 await test('a missing division clears its link without opening a different record',async()=>{
  const h=await sharedDivision({id:'china-prefecture-742-999'});h.resolve();await h.opening;
  assert.deepEqual(h.opened,[]);assert.equal(h.hash().has('boundary'),false);
  assert.match(value(h.c,"$('#toast').textContent"),/division.*unavailable.*year/i);
 });
 for(const [action,navigate] of [
  ['new year','setYear(1700)'],['new record','openEvent(realEvent,{whichMap:atlas,preserveYear:true})'],
  ['map pointer','for(const f of eventListeners.get("pointerdown"))f({target:{closest:s=>s.includes("maplibregl-canvas")?{}:null}})']
 ])await test('pending division yields to '+action,async()=>{
  const h=await sharedDivision();await value(h.c,navigate);h.resolve();await h.opening;
  assert.deepEqual(h.opened,[]);assert.equal(h.hash().has('boundary'),false);assert.equal(h.box.hidden,true);
  if(action==='new record')assert.equal(h.hash().get('event'),realEvent.id);
 });
 for(const side of ['left','right'])await test(`polity language switch keeps ${side} camera and reader tab`,async()=>{
  const c=context();value(c,`state.year=realPolity.start;atlas.year=state.year;${side==='right'?"state.compare=true;compareMap=makeMap();state.compareYear=realPolity.start;compareMap.year=state.compareYear;":''}openPolity(realPolity,${side==='right'?'compareMap':'atlas'});${side==='right'?'compareMap':'atlas'}.map.jumpTo({center:[75,35],zoom:7});bind();`);
  const before=value(c,`encodeCamera(${side==='right'?'compareMap':'atlas'}.map)`),count=value(c,'focusLog.length');value(c,"document.querySelector('#language').onchange({target:{value:'en'}})");await flush();
  assert.equal(value(c,`encodeCamera(${side==='right'?'compareMap':'atlas'}.map)`),before);assert.equal(value(c,'focusLog.length'),count);assert.equal(value(c,'state.selectedPolity.id'),realPolity.id);assert.equal(value(c,'state.selectedSide'),side);assert(value(c,'readerOptions.slice(1).every(o=>o?.keepTab)'));
 });
 for(const side of ['left','right'])for(const [draft,key,expected] of [['1700','ArrowUp',1701],['1700','ArrowDown',1699],['-1','ArrowUp',1],['1','ArrowDown',-1],['2026','ArrowUp',2026],['-70000','ArrowDown',-70000]])await test(`${side} draft ${draft} ${key} yields ${expected}`,async()=>{
  const c=context();if(side==='right')value(c,'state.compare=true;compareMap=makeMap();state.compareYear=1900;');const selector=side==='right'?'#compareYear':'#yearInput';
  value(c,`bind();document.querySelector('#step').value='1';document.querySelector('${selector}').value='${draft}';globalThis.e={target:document.querySelector('${selector}'),key:'${key}',code:'${key}',preventDefault(){},stopPropagation(){}};for(const fn of keyListeners)fn(e);`);await flush();
  assert.equal(value(c,side==='right'?'state.compareYear':'state.year'),expected);assert.equal(+value(c,`document.querySelector('${selector}').value`),expected);
 });
 await test('comparison input waits for initial map readiness before accepting year edits',async()=>{
  const c=context();value(c,`bindPlaceLayer=()=>{};AtlasMap=class{constructor(){Object.assign(this,makeMap());this.ready=new Promise(resolve=>globalThis.resolveComparisonReady=resolve);}};`);
  const pending=value(c,'toggleCompare()');assert.equal(value(c,"document.querySelector('#compareYear').disabled"),true);
  value(c,'resolveComparisonReady()');await pending;assert.equal(value(c,"document.querySelector('#compareYear').disabled"),false);
 });
 const cameraContext=context();
 for(const camera of ['0,0,0.2,0,0','180,85.051129,18,180,60','-180,-85.051129,0.2,-180,0','25.12345,-30.98765,6.125,-47.5,42'])await test('decode accepts camera boundary '+camera,()=>assert(value(cameraContext,`decodeCamera(${JSON.stringify(camera)})`)));
 for(const camera of [null,undefined,'','0,0,1,0','0,0,1,0,0,1','0,,1,0,0','0,0,NaN,0,0','Infinity,0,1,0,0','181,0,1,0,0','0,85.1,1,0,0','0,0,.199,0,0','0,0,18.001,0,0','0,0,1,180.001,0','0,0,1,0,60.001','0,0,1,0,-.001'])await test('decode rejects invalid camera '+String(camera),()=>assert.equal(value(cameraContext,`decodeCamera(${JSON.stringify(camera)??'undefined'})`),null));
 await test('encode wraps longitude and bearing without changing position',()=>{
  value(cameraContext,'atlas.map.jumpTo({center:[540,-12.345678],zoom:4.12345,bearing:540,pitch:20.1234})');const encoded=value(cameraContext,'encodeCamera(atlas.map)');assert.equal(encoded,'-180,-12.345678,4.123,-180,20.123');assert(value(cameraContext,`decodeCamera(${JSON.stringify(encoded)})`));
 });
 for(const lat of [-85.051129,85.051129])await test('encode round-trip retains valid extreme latitude '+lat,()=>{
  value(cameraContext,`atlas.map.jumpTo({center:[0,${lat}],zoom:2,bearing:0,pitch:0})`);const encoded=value(cameraContext,'encodeCamera(atlas.map)');assert(encoded,'A valid decode boundary must not be rounded out of range by encode');const decoded=value(cameraContext,`decodeCamera(${JSON.stringify(encoded)})`);assert(decoded);assert(Math.abs(decoded.center[1]-lat)<.00001);
 });
 for(const lat of [NaN,Infinity])await test('encode rejects nonfinite latitude '+lat,()=>{value(cameraContext,`atlas.map.jumpTo({center:[0,${lat}],zoom:2,bearing:0,pitch:0})`);assert.equal(value(cameraContext,'encodeCamera(atlas.map)'),null)});
 await test('URL initial loading labels use the requested BCE year before data arrives',async()=>{
  const c=context('#year=-221&lang=en');value(c,`globalThis.release=null;const gate=new Promise(r=>release=r);prepareInit();const originalRead=readJSON;readJSON=u=>gate.then(()=>originalRead(u));globalThis.loadingPromise=init()`);
  assert.equal(+value(c,"document.querySelector('#yearInput').value"),-221);assert(value(c,"document.querySelector('#bigYear').textContent.includes('221')"));assert(!value(c,"document.querySelector('#loading').textContent.includes('1492')"));value(c,'release()');await value(c,'loadingPromise');
 });
 for(const hash of ['#year=1800&camera=bad','#year=0&camera=0,0,1,0,0','#year=-999999&camera=0,0,1,0,0','#year=999999&camera=0,0,1,0,0'])await test('invalid or extreme URL inputs restore safely '+hash,async()=>{
  const c=context(hash);value(c,'prepareInit()');await value(c,'init()');const y=value(c,'state.year');assert(Number.isInteger(y)&&y!==0&&y>=-70000&&y<=2026);assert(value(c,'encodeCamera(atlas.map)'));assert.equal(value(c,'restoringView'),false);
 });
 for(const side of ['left','right'])await test(`city URL retains ${side} selection, year and camera`,async()=>{
  const params=new URLSearchParams({year:1500,lang:'en',place:realPlace.id,camera:'12.5,41.9,7.25,-20,35'});if(side==='right'){params.set('compare','1');params.set('compareYear','1600');params.set('side','right')}
  const c=context('#'+params);value(c,'prepareInit()');await value(c,'init()');assert.equal(value(c,'state.selectedPlace?.id'),realPlace.id);assert.equal(value(c,'state.selectedSide'),side);assert.equal(value(c,'state.year'),1500);if(side==='right')assert.equal(value(c,'state.compareYear'),1600);assert.equal(value(c,'encodeCamera(atlas.map)'),'12.5,41.9,7.25,-20,35');assert.equal(value(c,'state.selectedPlace.observation[0]'),side==='right'?1600:1500);
 });
 for(const [hash,left,right] of [['#boundaries=halc&boundaries2=overview','halc','overview'],['#boundaries=overview&boundaries2=halc','overview','halc'],['#boundaries=halc','halc','halc'],['#year=1492&boundaries=halc','halc','halc'],['#boundaries=regional&boundaries2=overview','regional','overview'],['#boundaries=overview','overview','overview'],['#regional=0','overview','overview'],['#boundaries=bad&boundaries2=bad','auto','auto']])await test('Boundary archive choices restore and share independently '+hash,()=>{const c=context(hash);assert.equal(value(c,'state.boundaryMode'),left);assert.equal(value(c,'state.compareBoundaryMode'),right);value(c,'state.compare=true;saveURL()');const restored=context(value(c,'location.hash'));assert.equal(value(restored,'state.boundaryMode'),left);assert.equal(value(restored,'state.compareBoundaryMode'),right)});
 for(const [hash,expected] of [['#borderCurves=0',false],['#borderCurves=1',true],['#year=1500',true]])await test('Border portrayal restores and shares '+hash,()=>{const c=context(hash);assert.equal(value(c,'state.borderCurves'),expected);value(c,'saveURL()');const restored=context(value(c,'location.hash'));assert.equal(value(restored,'state.borderCurves'),expected);});
 // Actual event binding and RegionalBoundaries.setMode run against deferred map loading.
 // A new source choice must win even when the user leaves HALC and then returns.
 for(const side of ['left','right'])for(const action of ['normal','overview','away-and-back'])await test(`HALC Explore ${side}: ${action} preserves the newest source intent`,async()=>{
  const c=context('#boundaries=halc&boundaries2=halc');
  value(c,`state.compare=true;compareMap=makeMap();globalThis.exploreTarget=${side==='right'?'compareMap':'atlas'};
   globalThis.flyLog=[];globalThis.yearCallCount=0;
   exploreTarget.regional=Object.assign(Object.create(RegionalBoundaries.prototype),{mode:'halc',atlas:exploreTarget,closePopup(){},update(){},settle(){}});
   exploreTarget.boundaries={setMode(){}};
   exploreTarget.fly=(...args)=>flyLog.push(args);
   exploreTarget.setYear=(catalog,year)=>{yearCallCount++;return new Promise(resolve=>{globalThis.finishExploreYear=()=>{exploreTarget.year=year;resolve(1)}})};
   originalBindLayers();globalThis.exploreHandler=eventListeners.get('halc-explore')[0];
  `);
  const pending=value(c,`exploreHandler({target:{id:'${side==='right'?'map2':'map'}'}})`);
  await flush();
  assert.equal(value(c,'yearCallCount'),1,'The actual handler should begin loading the requested year');
  assert.equal(value(c,'flyLog.length'),0,'The camera must wait for the year load');
  if(action!=='normal')value(c,"exploreTarget.regional.setMode('overview')");
  if(action==='away-and-back')value(c,"exploreTarget.regional.setMode('halc')");
  const revision=value(c,'exploreTarget.regional.modeRevision');
  value(c,'finishExploreYear()');await pending;
  assert.equal(value(c,'exploreTarget.year'),1500);
  assert.equal(value(c,'exploreTarget.regional.mode'),action==='overview'?'overview':'halc');
  if(action==='normal'){
   assert.equal(value(c,'flyLog.length'),1);
   assert.equal(value(c,'JSON.stringify(flyLog[0])'),JSON.stringify([4.8,51.3,7]));
  }else{
   assert.equal(value(c,'flyLog.length'),0,'An older Explore request overrode a newer source choice');
   assert.equal(value(c,'exploreTarget.regional.modeRevision'),revision,'An older Explore request wrote the source mode again');
  }
 });
 const report={checkedAt:new Date().toISOString(),method:'Actual repository functions executed in Node VM; DOM, renderer and network boundaries stubbed; no browser visual verification.',snapshots:Object.fromEntries(files.map(n=>[n,{sha256:crypto.createHash('sha256').update(snapshots[n]).digest('hex')}])),pass:results.filter(r=>r.pass).length,fail:results.filter(r=>!r.pass).length,results};
 if(process.env.STATE_AUDIT_REPORT)fs.writeFileSync(process.env.STATE_AUDIT_REPORT,JSON.stringify(report,null,2)+'\n');
 console.log(`${report.pass}/${results.length} view-state checks passed`);if(report.fail)process.exitCode=1;
}
run().catch(e=>{console.error(e);process.exitCode=1});
