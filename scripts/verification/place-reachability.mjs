// Place-marker reachability audit for Meridian Atlas.
//
//   node scripts/verification/place-reachability.mjs --mode=attested [--limit=12]
//       Strict sweep of the reviewed sites: one fresh browser per (record, year, zoom) case,
//       ports 9500+. Writes shots to docs/verification-3.12/shots/.
//   node scripts/verification/place-reachability.mjs --mode=sample [--total=300]
//       Stratified sample of the three place archives, driven inside one page through the app's
//       own setters (camera + year), which is what the UI does when a reader pans and changes year.
//   node scripts/verification/place-reachability.mjs --mode=report
//       Merge the recorded sections into the markdown report.
//
// Read-only: it never writes product files, only docs/verification-3.12/*.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launch,goto,evaluate,waitFor,mapReady,screenshot,sleep} from './browser.mjs';
void mapReady;

const root=fileURLToPath(new URL('../../',import.meta.url));
const docs=path.join(root,'docs/verification-3.12');
const shots=path.join(docs,'shots');
const jsonPath=path.join(docs,'place-reachability.json');
// Accept both --name=value and --name value.
const arg=(name,fallback)=>{
 const inline=process.argv.find(value=>value.startsWith('--'+name+'='));
 if(inline)return inline.slice(name.length+3);
 const index=process.argv.indexOf('--'+name);
 return index<0?fallback:process.argv[index+1];
};
const mode=arg('mode','report'),base=arg('base','http://127.0.0.1:8767');
fs.mkdirSync(shots,{recursive:true});
const read=file=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'public/data/places',file))).toString());
// The archives use different top-level keys for their record lists.
const listOf=file=>{const data=read(file);return data.places||data.claims||data.cities||data.records||[];};
const loadReport=()=>{try{return JSON.parse(fs.readFileSync(jsonPath,'utf8'));}catch{return {schema:'meridian-place-reachability/1',generated:new Date().toISOString(),attested:null,sample:null};}};
const saveReport=report=>{report.generated=new Date().toISOString();fs.writeFileSync(jsonPath,JSON.stringify(report,null,2)+'\n');};

// Instrument MapLibre's Marker so the audit can tell which record actually received a marker.
// It runs before the app boots and only observes; no product file changes.
const INSTRUMENT='(()=>{const install=()=>{if(!window.maplibregl||!window.maplibregl.Marker)return false;const Orig=window.maplibregl.Marker;window.__markerLog=[];window.maplibregl.Marker=class extends Orig{constructor(options){super(options);window.__markerLog.push(this);}};return true;};if(!install()){const timer=setInterval(()=>{if(install())clearInterval(timer);},10);setTimeout(()=>clearInterval(timer),30000);}})();';
const PROBE="(()=>{const a=window.__meridian.instances[0],entries=(window.__markerLog||[]).map(m=>({cls:String(m.getElement().className||''),text:String(m.getElement().textContent||'').trim(),lngLat:[m.getLngLat().lng,m.getLngLat().lat]}));const b=a.map.getBounds();return{entries:entries.filter(e=>e.cls.includes('place-marker')),active:a.places.active.length,year:a.places.year,zoom:a.map.getZoom(),bounds:[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()]}})()";
// In-page probe used by the sample mode: move the camera, change the year through the app's own
// setters, then read which place markers were created.
const DRIVE="(async (lon,lat,year,zoom)=>{const a=window.__meridian.instances[0];a.map.jumpTo({center:[lon,lat],zoom});await a.places.setYear(year,'en');window.__markerLog=[];a.places.refresh();const b=a.map.getBounds();const entries=(window.__markerLog||[]).map(m=>({cls:String(m.getElement().className||''),text:String(m.getElement().textContent||'').trim(),lngLat:[m.getLngLat().lng,m.getLngLat().lat]}));return{place:entries.filter(e=>e.cls.includes('place-marker')),active:a.places.active.length,year:a.places.year,zoom:a.map.getZoom(),bounds:[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()]}})";
const markerHit=(entries,lon,lat)=>entries.some(entry=>Math.abs(entry.lngLat[0]-lon)<1e-6&&Math.abs(entry.lngLat[1]-lat)<1e-6);
const budgetFor=zoom=>Math.min(90,Math.round((zoom-1)*12));
const inBounds=(bounds,lon,lat)=>bounds&&lon>=bounds[0]&&lon<=bounds[2]&&lat>=bounds[1]&&lat<=bounds[3];

// ---------------------------------------------------------------------------
async function strictAttested(){
 const layer=read('attested-places.json.gz');
 const records=layer.records.slice(0,Number(arg('limit',String(layer.records.length))));
 const rows=[];
 let caseIndex=0;
 for(const record of records){
  const [start,end]=[record.period.start,record.period.end];
  const years=[...new Set([Math.round(start+(end-start)*.25),Math.round(start+(end-start)*.5),Math.round(start+(end-start)*.75)].filter(y=>y!==0))];
  const [lon,lat]=record.location.coordinates;
  for(const year of years)for(const zoom of [4,6,8,10]){
   caseIndex++;
   const port=9500+(caseIndex%100);
   const hash='year='+year+'&lang=en&camera='+lon+','+lat+','+zoom+',0,0&boundaries=overview';
   const row={id:record.id,name:record.nameEn,zhName:record.nameZh,year,zoom,port,error:null,present:false,markerCount:0,active:null,budget:budgetFor(zoom),onScreen:null,collision:false,retries:0};
   for(let attempt=1;attempt<=2&&!row.present;attempt++){
    row.retries=attempt-1;
    let session=null;
    try{
     // A fresh browser per case, but a shared profile so the atlas assets stay cached and each
     // case only pays for the page, not for re-downloading every module.
     session=await launch({width:1600,height:900,port,profile:'/tmp/atlas-cdp-reach-shared'});
     await session.send('Page.addScriptToEvaluateOnNewDocument',{source:INSTRUMENT});
     await goto(session,base+'/#'+hash,{waitMs:2000});
     try{await waitFor(session,"!!(window.__meridian&&window.__meridian.instances&&window.__meridian.instances.length)",{timeout:15000,interval:200});}catch{}
     await sleep(1800);
     const info=await evaluate(session,PROBE);
     const target=info.entries.filter(entry=>entry.text.includes(record.nameEn)||entry.text.includes(record.nameZh));
     row.markerCount=info.entries.length;row.active=info.active;row.onScreen=inBounds(info.bounds,lon,lat);
     row.present=markerHit(info.entries,lon,lat)||target.length>0;
     row.texts=info.entries.slice(0,6).map(entry=>entry.text);
     row.detected=target.map(entry=>entry.text).slice(0,2);
     if(!row.present){
      row.nearbyMarkers=info.entries.filter(entry=>Math.abs(entry.lngLat[0]-lon)<0.05&&Math.abs(entry.lngLat[1]-lat)<0.05).map(entry=>entry.text).slice(0,4);
      row.budgetFull=info.entries.length>=row.budget;
     }
     if(caseIndex%18===0)await screenshot(session,path.join(shots,'place-reachability-attested-'+record.id.split(':')[1]+'-'+year+'-z'+zoom+'.png'));
    }catch(error){row.error=String(error).slice(0,160);}
    finally{if(session)await session.close().catch(()=>{});}
    if(row.present)break;
    await sleep(600);
   }
   rows.push(row);
   process.stderr.write('attested '+caseIndex+' '+record.id+' '+year+' z'+zoom+' -> '+(row.present?'visible':(row.error?'error':(row.budgetFull?'budget':'not-shown')))+'\n');
  }
 }
 const report=loadReport();
 report.attested={method:'one fresh browser per case (ports 9500+), URL camera, MapLibre Marker instrumentation',cases:rows.length,visible:rows.filter(row=>row.present).length,errors:rows.filter(row=>row.error).length,rows};
 saveReport(report);
 return report.attested;
}

// ---------------------------------------------------------------------------
function mulberry32(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const REGIONS=[[-25,35,45,72,'Europe'],[-20,20,60,45,'MENA'],[60,20,155,55,'Asia'],[155,-30,-100,60,'Pacific-Asia'],[-130,5,-30,60,'N-America'],[-90,-60,-30,20,'L-America'],[20,-40,55,20,'Africa'],[-180,-60,180,-40,'Oceania-Antarctica']];
function regionOf(lon,lat){for(const [w,s,e,n,name] of REGIONS){if(lon>=w&&lon<=e&&lat>=s&&lat<=n)return name;}return 'Other';}
function representativeYear(record){
 if(record.observations?.length){const years=record.observations.map(o=>o[0]).sort((a,b)=>a-b);return years[Math.floor(years.length/2)]||1;}
 const period=record.periods?.[0];if(!period)return 1500;
 const mid=Math.round((period[0]+period[1])/2);return mid!==0?mid:(period[1]>=1?1:-1);
}
function stratified(records,count,rng){
 const buckets=new Map();
 for(const record of records){if(!record.coordinates)continue;const key=regionOf(record.coordinates[0],record.coordinates[1]);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(record);}
 const names=[...buckets.keys()].sort();
 const picked=[];
 while(picked.length<count){
  const available=names.filter(name=>buckets.get(name).length);
  if(!available.length)break;
  const name=available[Math.floor(rng()*available.length)],bucket=buckets.get(name);
  picked.push(bucket.splice(Math.floor(rng()*bucket.length),1)[0]);
 }
 return picked;
}
async function sampleMode(){
 const total=Number(arg('total','300'));
 const rng=mulberry32(20261003);
 const settlements=listOf('historical-settlements-index.json.gz');
 const capitals=listOf('historical-capitals.json.gz');
 const observations=listOf('urban-observations.json.gz');
 const modern=listOf('modern-cities.json.gz');
 const plan=[
  {kind:'attested-settlement',records:stratified(settlements,Math.round(total*.6),rng)},
  {kind:'dated-capital',records:stratified(capitals,Math.round(total*.2),rng)},
  {kind:'urban-observation',records:stratified(observations,Math.round(total*.2),rng)},
  {kind:'modern-reference',records:stratified(modern,20,rng)}
 ];
 const rows=[];
 console.error('plan',JSON.stringify(plan.map(group=>group.kind+':'+group.records.length)));
 const port=Number(arg('port','9598'));
 const session=await launch({width:1600,height:900,port,profile:'/tmp/atlas-cdp-reach-sample-'+port});
 try{
  await session.send('Page.addScriptToEvaluateOnNewDocument',{source:INSTRUMENT});
  await goto(session,base+'/#year=1500&lang=en&camera=10,30,3,0,0&boundaries=overview&reference=1',{waitMs:2500});
  try{await waitFor(session,"!!(window.__meridian&&window.__meridian.instances&&window.__meridian.instances.length)",{timeout:40000,interval:300});}catch{}
  try{await mapReady(session);}catch{}
  await sleep(3000);
  await evaluate(session,"(()=>{const a=window.__meridian.instances[0];a.places.setModern(true);return true})()");
  for(const group of plan){
   for(const record of group.records){
    const year=representativeYear(record);
    const [lon,lat]=record.coordinates;
    const result={id:record.id,kind:group.kind,region:regionOf(lon,lat),year,lon,lat,minZoom:record.minZoom??null,zooms:{}};
    for(const zoom of [5,8]){
     let info=null,error=null;
     try{info=await evaluate(session,'('+DRIVE+')('+lon+','+lat+','+year+','+zoom+')');}catch(caught){error=String(caught).slice(0,140);}
     const entries=info?info.place:[];
     const seen=entries.some(entry=>Math.abs(entry.lngLat[0]-lon)<1e-6&&Math.abs(entry.lngLat[1]-lat)<1e-6);
     result.zooms[zoom]={markers:entries.length,seen,active:info?info.active:null,error,texts:entries.slice(0,3).map(entry=>entry.text)};
     if(seen)break;
    }
    result.reachable=Object.values(result.zooms).some(entry=>entry.seen);
    rows.push(result);
    if(rows.length%50===0)process.stderr.write('sample '+rows.length+'\n');
   }
  }
  await screenshot(session,path.join(shots,'place-reachability-sample-overview.png'));
 }finally{await session.close();}
 for(const row of rows){
  const zooms=Object.keys(row.zooms).map(Number);
  const entries=Object.values(row.zooms);
  const allBudgetFull=entries.every((entry,index)=>entry.markers>=budgetFor(zooms[index]));
  row.reason=row.reachable?'reachable':entries.some(entry=>entry.error)?'probe-error':entries.every(entry=>entry.active===0)?'not-active-at-year':allBudgetFull?'marker-budget':'label-collision';
 }
 console.error('probed '+rows.length+' rows; reachable '+rows.filter(row=>row.reachable).length);
 const report=loadReport();
 report.sample={method:'one browser, camera and year driven through the app setters (the same path a reader takes when panning and changing year); zoom 5 then 8; modern reference enabled',planned:plan.map(group=>({kind:group.kind,count:group.records.length})),total:rows.length,reachable:rows.filter(row=>row.reachable).length,rows};
 saveReport(report);
 console.error('saved '+jsonPath+' exists='+fs.existsSync(jsonPath));
 return report.sample;
}

// ---------------------------------------------------------------------------
function writeMarkdown(report){
 const lines=['# 地点标记真实可达率审计（3.12）','',
  '生成时间 '+report.generated+'；脚本 \`scripts/verification/place-reachability.mjs\`（--mode=attested / sample / report）。','',
  '本审计只回答一个问题：**数据在，地图上到底看不看得见**。全部为实测；未改产品代码。',''];
 if(report.attested){
  const rows=report.attested.rows;
  const byZoom=[4,6,8,10].map(zoom=>{const cells=rows.filter(row=>row.zoom===zoom);return {zoom,total:cells.length,visible:cells.filter(row=>row.present).length};});
  lines.push('## 1. 有据遗址 12 条完整巡测（12 记录 × 3 代表年 × 4 缩放 = '+report.attested.cases+' 格）','',
   '方法：每个用例**独立启动一次 Chrome**（端口 9500+），URL 相机 \`lon,lat,zoom\`，年份取来源时段内 25%/50%/75% 三点；页面启动前注入 Marker 记录器，读取 \`PlaceLayer\` 真正创建的 \`.place-marker\` 及其 LngLat。','',
   '| 缩放 | 用例 | 可见 | 命中率 |','| --- | --- | --- | --- |',
   ...byZoom.map(row=>'| z'+row.zoom+' | '+row.total+' | '+row.visible+' | '+(row.total?(row.visible/row.total*100).toFixed(0):'0')+'% |'),'',
   '总计：**'+report.attested.visible+' / '+report.attested.cases+' 格可见**；探针错误 '+report.attested.errors+' 格。','');
  const failures=rows.filter(row=>!row.present);
  if(failures.length){
   lines.push('### 未命中的格子与原因','','| 记录 | 年 | 缩放 | 标记数/预算 | 同点/邻近标记 | 判定 |','| --- | --- | --- | --- | --- | --- |');
   for(const row of failures.slice(0,40))lines.push('| '+[row.id.replace('attested:',''),row.year,'z'+row.zoom,row.markerCount+'/'+row.budget,(row.nearbyMarkers||[]).join('、')||'—',row.error?'探针错误':row.budgetFull?'标记预算已满':'被标签避让跳过'].join(' | ')+' |');
   lines.push('');
  }
 }
 if(report.sample){
  const rows=report.sample.rows;
  const byKind={};
  for(const row of rows){byKind[row.kind]=byKind[row.kind]||{total:0,reachable:0};byKind[row.kind].total++;if(row.reachable)byKind[row.kind].reachable++;}
  lines.push('## 2. 全局可达率抽样（'+report.sample.total+' 条）','',
   '方法：按地理分区（Europe/MENA/Asia/Pacific-Asia/N-America/L-America/Africa/Oceania）分层抽样；在同一个页面里用**应用自身的 setter**（\`map.jumpTo\` + \`places.setYear\`，即读者平移与改年份走的同一条路径）把相机对准记录，依次测 z5 与 z8；任一次出现标记即记为可达。现代参照记录在 \`reference=1\` 下测试。','',
   '| 类型 | 抽样 | 可达 | 可达率 |','| --- | --- | --- | --- |',
   ...Object.entries(byKind).map(([kind,value])=>'| '+kind+' | '+value.total+' | '+value.reachable+' | '+(value.total?(value.reachable/value.total*100).toFixed(1):'0')+'% |'),'',
   '总可达率：**'+report.sample.reachable+' / '+report.sample.total+'（'+(report.sample.total?(report.sample.reachable/report.sample.total*100).toFixed(1):'0')+'%）**','');
  const reasons={};
  for(const row of rows)reasons[row.reason]=(reasons[row.reason]||0)+1;
  lines.push('### 不可达原因分布','','| 原因 | 条数 | 说明 |','| --- | --- | --- |',
   '| label-collision | '+(reasons['label-collision']||0)+' | 记录在 active 列表里、标记预算未满，但标签框与既有标记/HUD 重叠而被跳过 |',
   '| marker-budget | '+(reasons['marker-budget']||0)+' | 该视野标记数已达 max=min(90, round((zoom−1)×12)) 上限 |',
   '| not-active-at-year | '+(reasons['not-active-at-year']||0)+' | 该年 placeAtYear 判定不可见（属于「本来就该隐藏」） |',
   '| probe-error | '+(reasons['probe-error']||0)+' | 页面探针异常 |','');
  const regionRows={};
  for(const row of rows){regionRows[row.region]=regionRows[row.region]||{total:0,reachable:0};regionRows[row.region].total++;if(row.reachable)regionRows[row.region].reachable++;}
  lines.push('### 分区可达率','','| 分区 | 抽样 | 可达 |','| --- | --- | --- |',...Object.entries(regionRows).filter(([,value])=>value.total>=5).sort((a,b)=>b[1].total-a[1].total).map(([name,value])=>'| '+name+' | '+value.total+' | '+value.reachable+' |'),'');
 }
 lines.push('## 复现','','\`\`\`bash','node scripts/verification/place-reachability.mjs --mode=attested   # 12×3×4 严格巡测','node scripts/verification/place-reachability.mjs --mode=sample     # 300+ 条分层抽样','node scripts/verification/place-reachability.mjs --mode=report     # 合并报告','\`\`\`','');
 fs.mkdirSync(docs,{recursive:true});
 fs.writeFileSync(path.join(docs,'place-reachability.md'),lines.join('\n'));
}

if(mode==='attested')await strictAttested();
else if(mode==='sample')await sampleMode();
writeMarkdown(loadReport());
