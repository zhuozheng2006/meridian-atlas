import assert from 'node:assert/strict';
import fs from 'node:fs';
import {RegionalBoundaries,regionalDate,regionalVisible,regionalFilter,regionalLayers,regionalElementURL,interiorPoint,regionalName,coverageAllowsDetail,groupRegionalFeatures,regionalAnchor} from '../public/regional-boundaries.js';
const results=[];const test=(name,fn)=>{fn();results.push({name,passed:true});console.log('PASS '+name)};
const p={osm_id:-2815329,type:'administrative',admin_level:4,start_decdate:1480.00137,end_decdate:1661.16027,name_en:'Duchy of Lorraine',area:25407100000};
test('A dated midyear snapshot excludes sequential boundary phases and unknown dates',()=>{
 assert(regionalVisible(p,1492));assert(!regionalVisible(p,1661));assert(regionalDate(-1)>0&&regionalDate(-1)<1);assert.throws(()=>regionalDate(0));
 for(const extra of [{start_decdate:1492.8},{end_decdate:1492.2},{start_decdate:NaN},{start_decdate:'1480'},{admin_level:8},{type:'religious'},{end_decdate:1400},{end_decdate:undefined,end_date:'unknown'}])assert(!regionalVisible({...p,...extra},1492));
 const noEnd={...p};delete noEnd.end_decdate;assert(regionalVisible(noEnd,1492));
});
test('Every paint and selection layer uses the dated regional filter',()=>{
 for(const y of [-1,1,1492,2024])for(const l of regionalLayers(y))assert(JSON.stringify(l.filter).includes(JSON.stringify(regionalFilter(y))));
});
test('Traditional labels convert to Simplified Chinese and bilingual names keep the original English',()=>{assert.equal(regionalName({name_zh:'費拉拉公國',name_en:'Duchy of Ferrara'},'zh'),'费拉拉公国');assert.equal(regionalName({name_zh:'費拉拉公國',name_en:'Duchy of Ferrara'},'en'),'Duchy of Ferrara');assert.equal(regionalName({name_en:'Free Imperial City of Bern'},'bi'),'伯尔尼帝国自由市');});
test('Source links preserve relation versus way identity and reject invalid IDs',()=>{
 assert.equal(regionalElementURL(p),'https://www.openhistoricalmap.org/relation/2815329');assert.equal(regionalElementURL({osm_id:12}),'https://www.openhistoricalmap.org/way/12');assert.equal(regionalElementURL({osm_id:0}),null);
});
test('Interior label anchor stays outside a polygon hole',()=>{
 const g={type:'Polygon',coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[3,3],[7,3],[7,7],[3,7],[3,3]]]};const [x,y]=interiorPoint(g);assert(x>=0&&x<=10&&y>=0&&y<=10);assert(!(x>3&&x<7&&y>3&&y<7));assert.equal(interiorPoint({type:'Polygon',coordinates:[]}),null);const clipped=interiorPoint(g,[0,0,2,2]);assert(clipped[0]>=0&&clipped[0]<=2&&clipped[1]>=0&&clipped[1]<=2);
});
function make(){
 const sources=new Map(),layers=new Map(),listeners=new Map(),paint=new Map();let zoom=2,features=[],removed=0,coverage=1,calls=0;
 const node=()=>({clientWidth:900,clientHeight:600,hidden:false,textContent:'',remove(){removed++},append(){},setAttribute(){},dispatchEvent(){}});
 globalThis.document={createElement:node};globalThis.CustomEvent=class{};
 const map={on(t,f){if(!listeners.has(t))listeners.set(t,[]);listeners.get(t).push(f)},off(t,f){listeners.set(t,listeners.get(t).filter(x=>x!==f))},getContainer:node,getZoom:()=>zoom,getSource:id=>sources.get(id),addSource(id,v){sources.set(id,v)},removeSource:id=>sources.delete(id),getLayer:id=>layers.get(id),addLayer(v){layers.set(v.id,v)},removeLayer:id=>layers.delete(id),setLayoutProperty(id,k,v){layers.get(id).layout={...layers.get(id).layout,[k]:v}},setPaintProperty(id,k,v){paint.set(id+':'+k,v)},setFilter(id,v){layers.get(id).filter=v},isSourceLoaded:()=>true,isMoving:()=>false,queryRenderedFeatures(point){if(Array.isArray(point)){calls++;return [{layer:{id:'land'},properties:{}},...(calls%63<Math.round(coverage*63)?features.map(f=>({...f,layer:{id:'regional-wash'}})):[])];}return features;},getCenter:()=>({lat:0,lng:0})};
 const atlas={map,year:1492,lang:'bi',showBorders:true,showLabels:false,destroyed:false,refreshLabels(){}};
 return {atlas,sources,layers,listeners,paint,setZoom:v=>zoom=v,setFeatures:v=>{features=v;for(const f of listeners.get('sourcedataloading')||[])f({sourceId:'regional-boundaries'});for(const f of listeners.get('sourcedata')||[])f({sourceId:'regional-boundaries',sourceDataType:'content',isSourceLoaded:true});},setCoverage:v=>coverage=v,get removed(){return removed}};
}
test('World, disabled, hidden borders and modern reference do not fetch regional tiles',()=>{
 for(const options of [{},{enabled:false},{modern:true}]){const x=make();if(Object.keys(options).length)x.setZoom(8);new RegionalBoundaries(x.atlas,options);assert.equal(x.sources.size,0);}
 const x=make();x.setZoom(8);x.atlas.showBorders=false;new RegionalBoundaries(x.atlas);assert.equal(x.sources.size,0);
});
test('Actual regional records switch both fill and stroke, empty views restore original data',()=>{
 const x=make();x.setZoom(7);const l=new RegionalBoundaries(x.atlas);assert.equal(x.sources.size,1);assert.equal(x.layers.size,3);x.setFeatures([{properties:p}]);l.settle(true);assert(l.active);assert.equal(l.status,'ready');assert.equal(x.paint.get('boundary:line-opacity'),0);assert.equal(x.paint.get('territories:fill-opacity'),0);assert.equal(x.paint.get('boundary:line-opacity-transition').duration,0);assert.equal(x.paint.get('territories:fill-opacity-transition').duration,0);
 x.setFeatures([]);l.settle(true);assert(!l.active);assert.equal(l.status,'empty');assert(Array.isArray(x.paint.get('boundary:line-opacity')));
});
test('Year changes reject stale features and preserve the raw source geometry',()=>{
 const x=make();x.setZoom(7);const l=new RegionalBoundaries(x.atlas),f={properties:p,geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]}};const raw=JSON.stringify(f);x.setFeatures([f]);l.settle(true);l.setYear(1700,'en');l.settle(true);assert(!l.active);assert.equal(l.status,'empty');assert.equal(JSON.stringify(f),raw);
});
test('Failed source restores overview, hides partial tiles, retries and removes listeners',()=>{
 const x=make();x.setZoom(7);const l=new RegionalBoundaries(x.atlas);x.setFeatures([{properties:p}]);l.settle(true);for(const f of x.listeners.get('error'))f({sourceId:'regional-boundaries',error:Error('test')});assert.equal(l.status,'error');assert(!l.active);assert([...x.layers.values()].every(v=>v.layout.visibility==='none'));
 l.retry();assert(!l.failed);assert.equal(x.sources.size,1);l.destroy();assert([...x.listeners.values()].every(v=>!v.length));assert(x.removed>0);
});
test('Turning off detail or entering modern reference restores the territory overview',()=>{
 for(const action of ['toggle','setModern']){const x=make();x.setZoom(7);const l=new RegionalBoundaries(x.atlas);x.setFeatures([{properties:p}]);l.settle(true);l[action](action==='setModern');assert(!l.active);assert([...x.layers.values()].every(v=>v.layout.visibility==='none'));}
});
test('Partial auto detail appears over overview tint without competing overview strokes',()=>{
 const x=make();x.setZoom(7);x.setCoverage(.2);x.setFeatures([{properties:p}]);const r=new RegionalBoundaries(x.atlas);x.setFeatures([{properties:p}]);r.settle(true);assert.equal(r.status,'ready');assert.equal(r.active,true);assert.equal(r.overviewContext,true);assert.equal(x.paint.get('territories:fill-opacity'),.12);assert.equal(x.paint.get('boundary:line-opacity'),0);r.setMode('regional');r.settle(true);assert.equal(r.active,true);assert.equal(r.mode,'regional');r.setMode('overview');assert.equal(r.active,false);assert.equal(r.status,'overview');assert([...x.layers.values()].every(v=>v.layout.visibility==='none'));
});
test('Auto coverage uses land samples, hysteresis, quadrants and the map center',()=>{
 const samples=Array.from({length:100},(_,i)=>({land:true,covered:i<80,quadrant:i%4,central:i<9}));assert(coverageAllowsDetail(samples));samples[79].covered=false;assert(!coverageAllowsDetail(samples));assert(coverageAllowsDetail(samples,true));samples.forEach((s,i)=>s.covered=i<64);assert(!coverageAllowsDetail(samples,true));assert(!coverageAllowsDetail(samples.map(s=>({...s,land:false})),true));assert(!coverageAllowsDetail(samples.slice(0,4)),true);const center=samples.map((s,i)=>({...s,covered:i>=9}));assert(!coverageAllowsDetail(center));const quadrants=samples.map(s=>({...s,covered:s.quadrant!==0}));assert(!coverageAllowsDetail(quadrants,true));
});
test('Visible tile fragments stay attached to their exact record; national labels have priority',()=>{
 const small={type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,1],[0,0]]]},large={type:'Polygon',coordinates:[[[10,10],[20,10],[20,20],[10,20],[10,10]]]};
 const features=groupRegionalFeatures([{properties:p,geometry:small},{properties:p,geometry:large},{properties:{...p,osm_id:-99,admin_level:2},geometry:large}],1492);assert.equal(features.length,2);assert.equal(features[0].properties.admin_level,2);assert.equal(features[1].fragments.length,2);const anchor=regionalAnchor(features[1],null);assert(anchor.coordinate[0]>10);assert.equal(groupRegionalFeatures([{properties:{...p,osm_id:undefined},geometry:small}],1492).length,0);
});
test('Listing regional records keeps tile coordinate getters lazy until an anchor is needed',()=>{
 let reads=0;const f={properties:p,get geometry(){reads++;return {type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,1],[0,0]]]};}};
 const grouped=groupRegionalFeatures([f,f],1492);assert.equal(reads,0);assert.equal(grouped[0].fragments.length,2);
 regionalAnchor(grouped[0],null);assert.equal(reads,2);regionalAnchor(grouped[0],null);assert.equal(reads,2);
});
test('County-level detail appears at z8 and clears when zooming back out',()=>{
 const x=make();x.setZoom(7);const county={properties:{...p,admin_level:6}},r=new RegionalBoundaries(x.atlas,{mode:'regional'});x.setFeatures([county]);r.settle(true);assert.equal(r.features.length,0);x.setZoom(8);r.update();r.settle(true);assert.equal(r.maxLevel,6);assert.equal(r.features.length,1);x.setZoom(7);r.update();r.settle(true);assert.equal(r.maxLevel,4);assert.equal(r.features.length,0);
});
test('Errors preserve the requested mode and a successful retry clears the error',()=>{
 const x=make();x.setZoom(7);const r=new RegionalBoundaries(x.atlas,{mode:'regional'});for(const f of x.listeners.get('error'))f({sourceId:'regional-boundaries',error:Error('sample')});assert.equal(r.mode,'regional');assert.equal(r.active,false);assert.equal(r.status,'error');r.retry();assert.equal(r.lastError,null);assert.equal(r.mode,'regional');x.setFeatures([{properties:p}]);r.settle(true);assert(r.active);
});
fs.writeFileSync(new URL('../docs/regional-validation.json',import.meta.url),JSON.stringify({status:'passed',checks:results.length,results},null,2)+'\n');
console.log(JSON.stringify({status:'passed',checks:results.length}));
