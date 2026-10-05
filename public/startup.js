// Restore the visible date before the larger map engine is downloaded.
(() => {
 const params=new URLSearchParams(location.hash.slice(1));
 // Start the renderer in parallel only for the default atlas route. The research
 // route can open and switch language without downloading or initializing WebGL.
 if(params.get('view')!=='research'){
  const scriptURL=new URL(document.currentScript.src,location.href);
  const catalogHint=document.createElement('link');catalogHint.rel='preload';catalogHint.as='fetch';catalogHint.crossOrigin='anonymous';
  catalogHint.href=new URL('./data/fast/catalog.json.gz',scriptURL).href;document.head.append(catalogHint);
  const runtimeURL=new URL('./map-runtime.js'+scriptURL.search,scriptURL);
  import(runtimeURL.href).then(module=>module.loadMapLibre()).catch(()=>{});
 }

 const value=params.has('year')?Number(params.get('year')):1492;
 const year=Math.max(-70000,Math.min(2026,Number.isFinite(value)?Math.round(value)||1:1492));
 const english=params.get('lang')==='en';
 const n=Math.abs(year)>=10000?Math.abs(year).toLocaleString('en-US'):String(Math.abs(year));
 const label=english?`${n} ${year<0?'BCE':'CE'}`:`${year<0?'公元前':'公元'} ${n} 年`;
 document.getElementById('bigYear').textContent=label;
 document.getElementById('yearInput').value=year;
 document.getElementById('mapEra').textContent='';
 document.getElementById('loading').textContent=(english?'Opening ':'正在翻到 ')+label+'…';
})();
