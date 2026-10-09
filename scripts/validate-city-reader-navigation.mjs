#!/usr/bin/env node
// Exercise the shipped reader handlers and year transitions, with only DOM/map
// transport replaced. No browser or network; original place dates stay intact.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import vm from 'node:vm';
import {attestedPlaces,placeAtYear,nearestPlaceYear,placeName} from '../public/places.js';
import {attestedChapter} from '../public/city-narratives.js';
import {polityName} from '../public/polity-names.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const app=await readFile(resolve(root,'public/app.js'),'utf8'),results=[];
const section=(start,end)=>{const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert(a>=0&&b>a,start);return app.slice(a,b);};
const shipped=[section('async function setYear(','function pause('),section('async function setCompareYear(','function closeComparison('),section('const placeSourceName=','let placeSearchSequence='),section('async function jumpPlace(','function openPolityPlace('),section('function placeEventsHTML(','function renderGeographyStatus('),section('function eventLoadMessage(','function renderDensity('),section('function eventDate(','function searchText('),section('function sourceLinks(','async function openEvent(')].join('\n');
const actualOpen=section('async function openPlace(','function placeEventsHTML(');
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function harness({side='left',lang='en',realOpen=false}={}){
 const calls={opens:[],years:[],close:0,errors:[],notices:[],fly:[],focus:[],downloads:[],saves:0},nodes=new Map();let tabs=[],cityButtons=[],observationButtons=[],placeEventHosts=[];
 const node=(id='',dataset={})=>({id,dataset,hidden:false,scrollTop:0,_html:'',classList:{active:false,contains(name){return name==='active'&&this.active;},toggle(name,on){if(name==='active')this.active=on;}},contains:()=>false,querySelectorAll(){return []},setAttribute(){},addEventListener(type,fn){this['on'+type]=fn;},click(){return this.onclick?.();},focus(){calls.focus.push({id,dataset});},insertAdjacentHTML(_where,html){this._html+=html;},get innerHTML(){return this._html;},set innerHTML(html){this._html=html;if(id==='detailPanel'){
  tabs=[...html.matchAll(/<button[^>]*data-place-tab="([^"]+)"/g)].map(m=>node('',{placeTab:m[1]}));if(tabs[0])tabs[0].classList.active=true;
  const body=html.split('<div class="reader-content" id="placeBody">')[1]?.split('</div><div class="reader-footer">')[0]||'';get('placeBody').innerHTML=body;
 }if(id==='placeBody'){placeEventHosts=html.includes('<section data-place-events>')?[node('placeEvents')]:[];cityButtons=[...html.matchAll(/data-city-year="([^"]+)"/g)].map(m=>node('',{cityYear:m[1]}));observationButtons=[...html.matchAll(/data-place-year="([^"]+)"/g)].map(m=>node('',{placeYear:m[1]}));}}});
 const get=id=>{if(!nodes.has(id))nodes.set(id,node(id));return nodes.get(id);};
 const query=selector=>{if(selector==='[data-place-tab].active')return tabs.find(t=>t.classList.active);const match=selector.match(/^\[data-place-tab="([^"]+)"\]$/);if(match)return tabs.find(t=>t.dataset.placeTab===match[1]);const year=selector.match(/^\[data-(city|place)-year="([^"]+)"\]$/);if(year)return (year[1]==='city'?cityButtons:observationButtons).find(t=>t.dataset[year[1]+'Year']===year[2]);if(selector==='#detailPanel .reader-content')return get('placeBody');return get(selector.replace(/^[#.]/,''));};
 const queryAll=selector=>selector==='[data-place-tab]'?tabs:selector==='[data-city-year]'?cityButtons:selector==='[data-place-year]'?observationButtons:selector==='[data-place-events]'?placeEventHosts:[];
 const mkMap=name=>({name,year:1500,destroyed:false,places:{select(){}},selectPolity(){},fly(...args){calls.fly.push([name,args]);},map:{stop(){},jumpTo(){}},async setYear(_catalog,year){calls.years.push([name,year]);const answer=await this.wait?.promise;if(answer===false)return false;this.year=year;return 1;}});
 const left=mkMap('left'),right=mkMap('right');
 const context={state:{year:1500,compareYear:1500,selectedSide:side,view:'atlas',lang,placeWindow:0,selectedPlace:null,selectedPolity:null},atlas:left,compareMap:right,atlasReady:true,updateId:0,compareGeneration:0,pendingYear:null,pendingCompareYear:null,detailNavigation:10,placeReturn:null,restoringView:false,catalog:{},events:[],eventsStatus:'ready',pendingInitialEvent:null,displayedPolityCount:null,polityReader:{seq:0},document:{activeElement:null},$:query,$$:queryAll,URL,Number,Math,Set,setTimeout,clearTimeout,
  escape:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),text:(zh,en)=>lang==='en'?en:zh,bilingual:v=>lang==='en'?v.en:v.zh,yr:y=>String(y),formatYear:y=>String(y),placeAtYear,nearestPlaceYear,placeName,normalizeYear:y=>y,activeRecords:()=>[],ensureAtlas:async()=>true,cancelBoundaryComparison(){},renderYear(){},renderEvents(){},pause(){},notify:message=>calls.notices.push(message),mapError:message=>calls.errors.push(message),saveURL(){calls.saves++;},showView:async()=>true,beginDetail(){},bindReaderTabs(){},bindDetailClose(){},copyView(){},downloadJSON(record,name){calls.downloads.push({record,name});},returnToPolity(){},polityName,
  closeDetail(){calls.close++;context.detailNavigation++;context.placeReturn=null;context.state.selectedPlace=null;get('detailPanel').hidden=true;},
  openPlace:async(p,map,options)=>{calls.opens.push({p,map,options});context.state.selectedPlace=p;context.placeReturn=options.origin;},placeDetail:async p=>p,cityNarrative:async()=>null};
 vm.createContext(context);vm.runInContext(shipped+(realOpen?'\n'+actualOpen:''),context);
 return {context,calls,left,right,map:side==='right'?right:left,node:get,tabs:()=>tabs,cityButtons:()=>cityButtons,observationButtons:()=>observationButtons};
}
const source={id:'test:dated',kind:'attested-settlement',source:'pleiades',sourceUrl:'https://pleiades.stoa.org/places/1',name:'Test source city',coordinates:[12,45],periods:[[1400,1600]]};
const chapter={nameZh:'测试城',nameEn:'Test source city',scope:{start:1400,end:1600,spatial:{zh:'地点范围',en:'Place scope'},temporal:{zh:'来源年代',en:'Source dates'}},binding:{},sections:[{titleZh:'沿革',titleEn:'History',zh:'史料',en:'Evidence'}],sources:[{title:'Evidence',url:source.sourceUrl}],milestones:[{year:1550,date:{zh:'1550年',en:'1550'},zh:'里程碑',en:'A milestone'}]};
const population={id:'chandler:test',kind:'urban-observation',source:'chandler',sourceUrl:'https://example.org/population',name:'Observed city',coordinates:[12,45],observations:[[1500,1200],[1550,2000]],observation:[1500,1200],narrative:chapter};
async function check(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS',name);}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL',name,error.message);}}
for(const side of ['left','right']){
 await check(`A ${side} city milestone keeps the same dated city, reader and origin`,async()=>{
  const h=harness({side}),p={...source,narrative:chapter},origin={record:{name:'Origin polity'},whichMap:h.map,year:1500};h.context.state.selectedPlace=p;h.context.placeReturn=origin;h.context.renderPlaceDetail(p);
  assert.equal(h.cityButtons().length,1);await h.cityButtons()[0].click();
  assert.equal(h.calls.close,0);assert.equal(h.map.year,1550);assert.equal(h.calls.opens.length,1);const open=h.calls.opens[0];assert.equal(open.p.id,p.id);assert.equal(open.map,h.map);assert.equal(open.options.origin,origin);assert.equal(open.options.keepFocus,true);assert.equal(open.options.keepView,true);
 });
 await check(`A ${side} population-row click preserves origin and actual observation year`,async()=>{
  const h=harness({side}),origin={record:{name:'Origin polity'},whichMap:h.map,year:1500};h.context.state.selectedPlace=population;h.context.placeReturn=origin;h.context.renderPlaceDetail(population);h.tabs().find(t=>t.dataset.placeTab==='records').click();
  await h.observationButtons()[1].click();const open=h.calls.opens[0];assert.equal(open.p.id,population.id);assert.equal(open.p.observation[0],1550);assert.equal(open.options.origin,origin);assert.equal(h.calls.close,0);
 });
 await check(`An external ${side} year change still dismisses the old city`,async()=>{
  const h=harness({side});h.context.state.selectedPlace=source;await (side==='right'?h.context.setCompareYear(1550):h.context.setYear(1550));assert.equal(h.calls.close,1);
 });
 await check(`A failed ${side} year load retains current city and reading origin`,async()=>{
  const h=harness({side}),origin={year:1500};h.context.placeReturn=origin;h.context.state.selectedPlace=source;h.map.wait=deferred();const jump=h.context.jumpPlace(source,h.map,1550,{origin});h.map.wait.resolve(false);await jump;
  assert.equal(h.calls.opens.length,0);assert.equal(h.calls.close,0);assert.equal(h.map.year,1500);assert.equal(h.context.state.selectedPlace,source);assert.equal(h.context.placeReturn,origin);
 });
}
await check('Invalid, absent or non-integer dates leave the current map and archive unchanged',async()=>{
 const h=harness();h.context.state.selectedPlace=source;for(const year of [0,1700,1399,1500.2,Infinity,-70001,2027])assert.equal(await h.context.jumpPlace(source,h.map,year),false);assert.equal(h.calls.years.length,0);assert.equal(h.calls.opens.length,0);assert.equal(h.calls.notices.length,7);assert.equal(h.context.state.selectedPlace,source);
});
await check('A dated-location gap prevents navigation even inside the overall attestation period',async()=>{
 const h=harness(),p={...source,locations:[{coordinates:[12,45],periods:[[1400,1450]]}]};assert.equal(await h.context.jumpPlace(p,h.map,1500),false);assert.equal(h.calls.years.length,0);
});
await check('A population gap obeys the selected exact-year window rather than reusing an old row',async()=>{
 const h=harness();assert.equal(await h.context.jumpPlace(population,h.map,1525),false);assert.equal(h.calls.years.length,0);h.context.state.placeWindow=25;await h.context.jumpPlace(population,h.map,1525);assert.equal(h.calls.opens[0].p.observation[0],1500);assert.equal(h.calls.opens[0].map.year,1525);
});
for(const action of ['close','leave','replace-map','destroy-map'])await check(`Late city-year loading cannot reopen a reader after ${action}`,async()=>{
 const h=harness({side:'right'});h.context.state.selectedPlace=source;h.map.wait=deferred();const jump=h.context.jumpPlace(source,h.map,1550);if(action==='close')h.context.closeDetail();if(action==='leave'){h.context.state.view='research';h.context.detailNavigation++;}if(action==='replace-map')h.context.compareMap=null;if(action==='destroy-map')h.map.destroyed=true;h.map.wait.resolve();await jump;assert.equal(h.calls.opens.length,0);
});
await check('A newer city jump defeats the older jump even when both finish',async()=>{
 const h=harness();h.context.state.selectedPlace=source;const first=deferred(),second=deferred();let count=0;h.map.setYear=async(_cat,year)=>{await (++count===1?first:second).promise;h.map.year=year;return 1;};
 const old=h.context.jumpPlace(source,h.map,1510);await Promise.resolve();await Promise.resolve();const latest=h.context.jumpPlace(source,h.map,1550);await Promise.resolve();await Promise.resolve();first.resolve();await old;assert.equal(h.calls.opens.length,0);second.resolve();await latest;assert.equal(h.calls.opens.length,1);assert.equal(h.calls.opens[0].map.year,1550);
});
await check('The real asynchronous reader keeps the Records tab and scroll through a city jump',async()=>{
 const h=harness({realOpen:true}),pending=deferred();h.context.state.selectedPlace=population;h.context.renderPlaceDetail(population);h.tabs().find(t=>t.dataset.placeTab==='records').click();h.node('placeBody').scrollTop=213;h.context.document.activeElement=h.observationButtons()[1];h.context.cityNarrative=()=>pending.promise;
 const updated=placeAtYear(population,1550,0),opening=h.context.openPlace(updated,h.map,{keepFocus:true,keepView:true});assert.equal(h.tabs().find(t=>t.classList.active).dataset.placeTab,'records');assert.equal(h.node('placeBody').scrollTop,213);pending.resolve(chapter);await opening;
 assert.equal(h.tabs().find(t=>t.classList.active).dataset.placeTab,'records');assert.equal(h.node('placeBody').scrollTop,213);assert.equal(h.calls.fly.length,0);assert.equal(h.context.state.selectedPlace.observation[0],1550);assert.equal(h.calls.focus.at(-1).dataset.placeYear,'1550');
});
const layer=JSON.parse(gunzipSync(await readFile(resolve(root,'public/data/places/attested-places.json.gz'))));
await check('Every shipped attested site retains its own publishers, links and license attribution',()=>{
 const places=attestedPlaces(layer);assert(places.length>=12);for(const p of places){const h=harness();h.context.renderPlaceDetail(p);h.tabs().find(t=>t.dataset.placeTab==='sources').click();const html=h.node('placeBody').innerHTML;assert.equal(p.source,'attested-sites');for(const s of p.attested.sources){assert(html.includes(s.url),p.id+' source URL');assert(html.includes(s.title.replace(/&/g,'&amp;')),p.id+' source title');assert(html.includes(s.publisher),p.id+' publisher');assert(html.includes(s.license.replace(/&/g,'&amp;')),p.id+' exact source credit');}assert(!html.includes('Reba, Reitsma &amp; Seto'),p.id);assert(!html.includes('Historical urban population data'),p.id);assert(h.node('detailPanel').innerHTML.includes('UNESCO World Heritage Centre'),p.id+' reader footer');}
});
for(const [id,zh,en]of [['attested:si-thep','公元6—10世纪','6th–10th centuries CE'],['attested:sambor-prei-kuk','公元7—11世纪','7th–11th centuries CE']])await check(`${id} displays its source centuries in both languages without rewriting raw years`,()=>{
 const original=attestedPlaces(layer).find(p=>p.id===id);assert(original,id);const before=JSON.stringify(original),[start,end]=original.periods[0];
 for(const [lang,expected]of [['zh',zh],['en',en]]){
  const h=harness({lang}),p={...original,narrative:attestedChapter(original,start)},snapshot=JSON.stringify(p);h.context.renderPlaceDetail(p);
  assert(h.node('detailPanel').innerHTML.includes(`<span class="tag">${expected}</span>`),`${id} ${lang} date badge`);
  assert(h.node('placeBody').innerHTML.includes(`<p>${expected}</p>`),`${id} ${lang} chapter introduction`);
  h.tabs().find(t=>t.dataset.placeTab==='records').click();assert(h.node('placeBody').innerHTML.includes(expected),`${id} ${lang} place record`);
  h.tabs().find(t=>t.dataset.placeTab==='sources').click();assert(h.node('placeBody').innerHTML.includes(`<p>${expected}</p>`),`${id} ${lang} all attested periods`);
  h.node('placeExport').click();assert.equal(h.calls.downloads.length,1);assert.deepEqual(h.calls.downloads[0].record.periods,[[start,end]]);assert.deepEqual(h.calls.downloads[0].record.attested.period,original.attested.period);assert.equal(JSON.stringify(p),snapshot,`${id} rendering/export retain all source fields`);
  // Full-century-looking numerical endpoints alone do not authorize a century label.
  for(const candidate of [
   {...original,attested:{...original.attested,period:{...original.attested.period,precision:'year'}}},
   {...original,attested:{...original.attested,period:{...original.attested.period,sourceRange:{...original.attested.period.sourceRange,from:start+1}}}},
   {...original,periods:[[start+1,end]],attested:{...original.attested,period:{...original.attested.period,sourceRange:{...original.attested.period.sourceRange,from:start+1}}}},
   {...original,attested:undefined}
  ]){const exact=harness({lang});exact.context.renderPlaceDetail(candidate);const [a,b]=candidate.periods[0];assert(exact.node('detailPanel').innerHTML.includes(`<span class="tag">${a} — ${b}</span>`),`${id} ${lang}: unverified or exact endpoints retain year labels`);}
  const exactSite=attestedPlaces(layer).find(p=>p.id==='attested:ayutthaya');assert(exactSite);const exact=harness({lang});exact.context.renderPlaceDetail(exactSite);const [a,b]=exactSite.periods[0];assert(exact.node('detailPanel').innerHTML.includes(`<span class="tag">${a} — ${b}</span>`),'existing precisely dated Ayutthaya retains original year labels');
 }
 assert.equal(JSON.stringify(original),before);
});
await check('Urban, ancient-place and capital attributions remain source-specific',()=>{
 for(const [p,credit]of [[population,'Reba, Reitsma &amp; Seto'],[source,'Pleiades · CC BY 3.0'],[{...source,kind:'dated-capital',source:'wikidata-capitals',polityQid:'Q1'},'Wikidata · CC0']]){const h=harness();h.context.renderPlaceDetail(p);h.tabs().find(t=>t.dataset.placeTab==='sources').click();assert(h.node('placeBody').innerHTML.includes(credit),credit);}
});
const report={suite:'city reader navigation and source attribution',passed:results.filter(x=>x.passed).length,total:results.length,attestedSites:layer.records.length,results};console.log(JSON.stringify(report,null,2));if(process.env.CITY_READER_REPORT)await writeFile(resolve(process.env.CITY_READER_REPORT),JSON.stringify(report,null,2)+'\n');if(report.passed!==report.total)process.exitCode=1;
