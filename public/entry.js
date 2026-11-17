// The first route chooses a reader or the atlas application, without importing both.
const assetURL=name=>new URL(name+new URL(import.meta.url).search,import.meta.url).href;
export function createApplicationLoader(importModule=url=>import(url)){
 let pending=null,attempt=0;
 return function load(){
  if(!pending){let url=assetURL('./app.js');if(attempt++)url+=(url.includes('?')?'&':'?')+'retry='+attempt;pending=importModule(url).catch(error=>{pending=null;throw error;});}
  return pending;
 };
}
export async function startEntry({doc=document,win=window,loadApplication=createApplicationLoader(),loadResearch=()=>import(assetURL('./research-shell.js'))}={}){
 const research=new URLSearchParams(win.location.hash.slice(1)).get('view')==='research';
 if(research){const {mountResearchShell}=await loadResearch();return mountResearchShell({doc,win,loadApplication});}
 const module=await loadApplication(),application=module.startApplication();await application.ready;return application;
}
function boot(){
 const params=new URLSearchParams(location.hash.slice(1)),view=params.get('view');
 if(!['research','polities','stories','library','sources'].includes(view)&&typeof fetch==='function'&&location.protocol.startsWith('http')){
  window.__meridianBootLand??=fetch('data/land.geojson').then(r=>r.ok?r.json():'data/land.geojson').catch(()=>'data/land.geojson');
  const pre=window.__meridianBootPrefetch??=Object.create(null);
  pre['data/fast/events-index.json.gz']??=fetch('data/fast/events-index.json.gz',{cache:'no-cache',priority:'auto'}).catch(()=>null);
  if(typeof document!=='undefined'&&document.head){
   const ml=document.createElement('link');ml.rel='preload';ml.as='script';ml.fetchPriority='high';ml.href=assetURL('./assets/maplibre-gl.js');document.head.append(ml);
   for(const mod of ['./bootstrap-content-hashes.js','./map-engine.js','./native-geometry.js','./native-temporal-index.js','./boundary-controller.js','./country-archive.js','./polity-names.js','./polity-display-names-data.js','./map-catalog.js','./view-state.js','./timeline-controls.js','./research-view.js','./boundary-mesh.js','./territory-frame-cache.js','./border-curves.js','./country-names.js','./map-load-priority.js','./boundary-style.js','./geometry-anchor.js']){
    const link=document.createElement('link');link.rel='modulepreload';link.href=assetURL(mod);document.head.append(link);
   }
  }
  const reqYear=Number(params.get('year')??1492),bootYear=Math.max(-70000,Math.min(2026,Number.isFinite(reqYear)?Math.round(reqYear)||1:1492));
  if(bootYear>=-3400&&bootYear<=2024&&params.get('boundaries')!=='cshapes'){
   void import(assetURL('./bootstrap-content-hashes.js')).then(m=>{
    const req=m.bootstrapDataRequest(`data/native/year-${bootYear}.json.gz`);
    if(req)pre[req.url]??=fetch(req.url,{cache:req.cache,priority:'high'}).catch(()=>null);
   }).catch(()=>{});
  }
 }
 startEntry().catch(()=>{
  const doc=document,host=doc.getElementById('contentView'),en=new URLSearchParams(location.hash.slice(1)).get('lang')==='en';
  for(const id of ['atlasView','timeline','browseBtn','compareBtn'])doc.getElementById(id).hidden=true;host.hidden=false;host.replaceChildren();
  const status=doc.createElement('p');status.setAttribute('role','status');status.textContent=en?'This page could not open. Please retry.':'页面暂未打开，请重试。';
  const retry=doc.createElement('button');retry.type='button';retry.textContent=en?'Retry':'重新读取';retry.onclick=()=>location.reload();host.append(status,retry);
 });
}
if(typeof window!=='undefined'&&typeof document!=='undefined')boot();
