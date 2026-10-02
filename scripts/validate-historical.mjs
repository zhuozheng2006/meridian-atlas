import assert from 'node:assert/strict';
import fs from 'node:fs';
import {historicalYearRange,datedFeatureVisible,historicalDateFilter} from '../public/historical-dates.js';
import {HistoricalDetailLayer,historyLayers,recordYear,featureName,historicalMapURL} from '../public/historical-detail.js';
const result=[];const test=(name,fn)=>{fn();result.push({name,pass:true});console.log('PASS '+name)};
test('Civil BCE/CE years convert to the OHM astronomical convention without zero',()=>{
 assert.deepEqual(historicalYearRange(-2),[-1,0]);assert.deepEqual(historicalYearRange(-1),[0,1]);assert.deepEqual(historicalYearRange(1),[1,2]);
 for(const y of [0,NaN,1.2,-70001,2027])assert.throws(()=>historicalYearRange(y));
 assert.equal(recordYear(-.2,'en'),'2 BCE');assert.equal(recordYear(.2,'en'),'1 BCE');assert.equal(recordYear(1.2,'en'),'1 CE');
 assert(historicalMapURL(-1,{lat:0,lng:0},15).endsWith('date=0000-07-01'));assert(historicalMapURL(-2,{lat:0,lng:0},15).endsWith('date=-0001-07-01'));
});
test('Annual overlap includes changes within a year and excludes future or ended records',()=>{
 assert(datedFeatureVisible({start_decdate:1950.39589},1950));assert(!datedFeatureVisible({start_decdate:1950.39589},1949));
 assert(datedFeatureVisible({start_decdate:1900,end_decdate:1950},1950));assert(!datedFeatureVisible({start_decdate:1900,end_decdate:1950},1951));
 assert(datedFeatureVisible({start_decdate:0,end_decdate:.99},-1));assert(!datedFeatureVisible({start_decdate:0,end_decdate:.99},1));
});
test('Missing, malformed, reversed and unconverted date evidence is omitted',()=>{
 for(const p of [{},{end_decdate:1900},{start_decdate:'1900'},{start_decdate:NaN},{start_decdate:-Infinity},{start_decdate:1800,end_date:'unknown'},{start_decdate:1800,end_decdate:null},{start_decdate:1900.8,end_decdate:1900.2}])assert(!datedFeatureVisible(p,1900),JSON.stringify(p));
 assert(datedFeatureVisible({start_decdate:1800},1900));
});
test('Real audited source records retain Battery Tunnel and Roman end-only date behavior',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('./fixtures/historical-records.json',import.meta.url)));
 const tunnel=data.find(x=>x.properties.name==='Battery Tunnel');assert(tunnel);assert(!datedFeatureVisible(tunnel.properties,1949));assert(datedFeatureVisible(tunnel.properties,1950));
 const via=data.find(x=>x.properties.name==='Via Lata');assert(via);assert(!datedFeatureVisible(via.properties,1));
 assert(data.some(x=>x.layer==='buildings'&&datedFeatureVisible(x.properties,-100)));
});
test('All rendered geometry layers carry the selected-year filter',()=>{
 for(const y of [-70000,-1,1,1500,1950,2026])for(const l of historyLayers(y))assert(JSON.stringify(l.filter).includes(JSON.stringify(historicalDateFilter(y))));
});
test('Missing source names stay unnamed and explicit Simplified Chinese has priority',()=>{
 assert.equal(featureName({},'bi'),'');assert.equal(featureName({name_zh:'傳統名稱',name_en:'Source English',name:'Original'},'bi'),'Source English');
 assert.equal(featureName({'name_zh-hans':'简体名称',name_en:'English'},'bi'),'简体名称');assert.equal(featureName({name_en:'English',name:'原名'},'en'),'English');
});
// A behavioral map double records public MapLibre calls. It does not evaluate
// expressions: the real browser filter harness separately checks that contract.
function make(){
 const sources=new Map(),layers=new Map(),listeners=new Map();let zoom=3,removed=0;
 const node=()=>({hidden:false,textContent:'',remove(){removed++},append(){},dispatchEvent(){},getBoundingClientRect(){return {left:0,top:0,right:1200,bottom:700}}});
 globalThis.document={createElement:node,querySelectorAll:()=>[]};globalThis.CustomEvent=class{constructor(type,options){this.type=type;this.detail=options.detail}};
 const map={on(t,f){if(!listeners.has(t))listeners.set(t,[]);listeners.get(t).push(f)},off(t,f){listeners.set(t,listeners.get(t).filter(x=>x!==f))},getContainer:node,getZoom:()=>zoom,getSource:id=>sources.get(id),addSource(id,v){sources.set(id,v)},removeSource:id=>sources.delete(id),getLayer:id=>layers.get(id),addLayer(v){layers.set(v.id,v)},removeLayer:id=>layers.delete(id),setLayoutProperty(id,k,v){layers.get(id).layout={...layers.get(id).layout,[k]:v}},setFilter(id,v){layers.get(id).filter=v},isSourceLoaded:()=>true,isMoving:()=>false,queryRenderedFeatures:()=>[],getCenter:()=>({lat:0,lng:0}),getBearing:()=>0};
 const atlas={map,year:1870,lang:'bi',showLabels:false,destroyed:false};return {atlas,sources,layers,listeners,setZoom:v=>zoom=v,get removed(){return removed}};
}
test('World views and disabled or modern-only views make no historical source requests',()=>{
 for(const [options,zoom]of [[{},3],[{enabled:false},15],[{modern:true},15]]){const x=make();x.setZoom(zoom);new HistoricalDetailLayer(x.atlas,options);assert.equal(x.sources.size,0);}
});
test('Zooming loads one source; toggles and reference changes hide its layers',()=>{
 const x=make(),l=new HistoricalDetailLayer(x.atlas);x.setZoom(15);l.update();assert.equal(x.sources.size,1);assert.equal(x.layers.size,5);l.seen=true;l.settle();assert.equal(l.status,'empty');
 l.setYear(1950,'en');assert.equal(l.year,1950);assert.equal(l.lang,'en');l.setModern(true);assert.equal(l.status,'modern');assert([...x.layers.values()].every(x=>x.layout.visibility==='none'));l.setModern(false);l.toggle(false);assert.equal(l.status,'off');
});
test('Failures remain retryable after toggling; retry recreates the source and destroy removes listeners',()=>{
 const x=make();x.setZoom(15);const l=new HistoricalDetailLayer(x.atlas);for(const fn of x.listeners.get('error'))fn({sourceId:'historical-detail'});assert.equal(l.status,'error');l.toggle(false);l.toggle(true);assert.equal(l.status,'error');l.retry();assert.equal(l.failed,false);assert.equal(l.seen,false);assert.equal(x.sources.size,1);l.destroy();assert([...x.listeners.values()].every(a=>!a.length));assert(x.removed>0);
});
fs.writeFileSync(new URL('../docs/historical-validation.json',import.meta.url),JSON.stringify({status:'passed',checks:result.length,results:result},null,2)+'\n');
console.log(JSON.stringify({status:'passed',checks:result.length}));
