// Choose resources before the body arrives; the initial HTML remains neutral.
(() => {
 const scriptURL=new URL(document.currentScript.src,location.href),params=new URLSearchParams(location.hash.slice(1));
 const research=params.get('view')==='research';
 if(!research){
  // This is an import-only warmup. app.js has no rendering side effects; entry.js
  // starts its controller after the document is ready and shares this same URL.
  const appURL=new URL('./app.js'+scriptURL.search,scriptURL);
  import(appURL.href).catch(()=>{});
  const catalogHint=document.createElement('link');catalogHint.rel='preload';catalogHint.as='fetch';catalogHint.crossOrigin='anonymous';
  const requested=Number(params.get('year')??1492),year=Math.max(-70000,Math.min(2026,Number.isFinite(requested)?Math.round(requested)||1:1492));
  const view=params.get('view'),mapView=!['polities','stories','library','sources'].includes(view);
  let catalogPath=view==='polities'||view==='sources'?'data/fast/polity-search-index.json.gz':view==='library'?'data/events.json.gz':view==='stories'?'data/fast/events-index.json.gz':'data/fast/catalog.json.gz';
  if(mapView){
   const civil=year>0?year-1:year,start=Math.floor(civil/25)*25,end=Math.min(start+24,2023),label=n=>n>=0?n+1:n;
   catalogPath=year< -3400||year>2024?'data/fast/map-catalog/empty.json.gz':`data/fast/map-catalog/years-${label(start)}-${label(end)}.json.gz`;
  }
  catalogHint.href=new URL('./'+catalogPath,scriptURL).href;document.head.append(catalogHint);
  if(!['polities','stories','library','sources'].includes(params.get('view'))){
   const runtimeURL=new URL('./map-runtime.js'+scriptURL.search,scriptURL);
   import(runtimeURL.href).then(module=>module.loadMapLibre()).catch(()=>{});
  }
 }
 function paint(){
  const current=new URLSearchParams(location.hash.slice(1)),atlas=!['research','polities','stories','library','sources'].includes(current.get('view'));
  const value=current.has('year')?Number(current.get('year')):1492;
  const year=Math.max(-70000,Math.min(2026,Number.isFinite(value)?Math.round(value)||1:1492));
  const english=current.get('lang')==='en',n=Math.abs(year)>=10000?Math.abs(year).toLocaleString('en-US'):String(Math.abs(year));
  const label=english?`${n} ${year<0?'BCE':'CE'}`:`${year<0?'公元前':'公元'} ${n} 年`;
  for(const id of ['atlasView','timeline','browseBtn','compareBtn'])document.getElementById(id).hidden=!atlas;
  document.getElementById('contentView').hidden=atlas;
  document.getElementById('bigYear').textContent=label;document.getElementById('yearInput').value=year;document.getElementById('mapEra').textContent='';
  document.getElementById('loading').textContent=(english?'Opening ':'正在翻到 ')+label+'…';
  const boot=document.getElementById('bootStatus');if(boot)boot.textContent=english?'Opening Meridian Atlas…':'正在打开经纬纪…';
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',paint,{once:true});else paint();
})();
