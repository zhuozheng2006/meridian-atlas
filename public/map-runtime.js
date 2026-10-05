// Loading the research reader never calls this module's loader. The atlas shell can
// preload it without constructing WebGL; the first map and preloader share one request.
const runtimeKey=Symbol.for('meridian.maplibre.runtime');
const defaultAssetURL=new URL('./assets/maplibre-gl.js'+new URL(import.meta.url).search,import.meta.url).href;
export function createMapLibreLoader({document:doc,globalObject,assetURL=defaultAssetURL,timeoutMs=45000,setTimer=setTimeout,clearTimer=clearTimeout}={}) {
 let pending=null;
 const library=()=>typeof globalObject?.maplibregl?.Map==='function'?globalObject.maplibregl:null;
 return function load() {
  const ready=library();if(ready)return Promise.resolve(ready);
  if(pending)return pending;
  const request=new Promise((resolve,reject)=>{
   let script,timer,done=false;
   const finish=error=>{
    if(done)return;done=true;clearTimer(timer);
    if(script){script.onload=script.onerror=null;if(error)script.remove();}
    if(error)reject(error);else resolve(library());
   };
   try {
    if(!doc?.createElement||!doc.head)throw Error('Map renderer requires a document');
    const pageURL=new URL(globalObject?.location?.href||doc.URL||doc.baseURI);
    const url=new URL(assetURL,pageURL);
    if(url.origin!==pageURL.origin)throw Error('Map renderer must be a same-origin asset');
    script=doc.createElement('script');script.src=url.href;script.async=true;
    script.dataset.mapRuntime='maplibre';
    script.onload=()=>finish(library()?null:new Error('Map renderer did not initialize'));
    script.onerror=()=>finish(new Error('Map renderer could not load'));
    timer=setTimer(()=>finish(new Error('Map renderer load timed out')),timeoutMs);
    doc.head.append(script);
   } catch(error) {finish(error);}
  });
  pending=request;
  // A failed optional preload remains handled and may be retried on explicit navigation.
  request.catch(()=>{if(pending===request)pending=null;});
  return request;
 };
}
export function loadMapLibre() {
 const host=globalThis.window||globalThis;
 // Share even if two callers resolve this module with differing asset query strings.
 if(!host[runtimeKey])Object.defineProperty(host,runtimeKey,{value:createMapLibreLoader({document:host.document,globalObject:host}),configurable:true});
 return host[runtimeKey]();
}
