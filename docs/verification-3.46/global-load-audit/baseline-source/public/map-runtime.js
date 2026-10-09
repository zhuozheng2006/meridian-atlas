// Loading the research reader never calls this module's loader. The atlas shell can
// preload it without constructing WebGL; the first map and preloader share one request.
const runtimeKey=Symbol.for('meridian.maplibre.runtime');
const defaultAssetURL=new URL('./assets/maplibre-gl.js'+new URL(import.meta.url).search,import.meta.url).href;
// The bundled renderer defaults to one worker in Chrome. Two shared workers
// let independent detailed layers parse concurrently without allocating a pool
// per map. Keep the platform default when the core count is unknown or low,
// or the browser reports less than 4 GB of device memory.
const configuredLibraries=new WeakSet();
export function configureMapWorkers(library,navigator={}) {
 if(configuredLibraries.has(library))return;
 configuredLibraries.add(library);
 const cores=Number(navigator.hardwareConcurrency),memory=Number(navigator.deviceMemory);
 if(!Number.isFinite(cores)||cores<4||Number.isFinite(memory)&&memory>0&&memory<4)return;
 if(typeof library.getWorkerCount!=='function'||typeof library.setWorkerCount!=='function')return;
 if(library.getWorkerCount()<2)library.setWorkerCount(2);
}
export function createMapLibreLoader({document:doc,globalObject,assetURL=defaultAssetURL,timeoutMs=45000,setTimer=setTimeout,clearTimer=clearTimeout}={}) {
 let pending=null;
 const library=()=>typeof globalObject?.maplibregl?.Map==='function'?globalObject.maplibregl:null;
 return function load() {
  const ready=library();if(ready){configureMapWorkers(ready,globalObject.navigator);return Promise.resolve(ready);}
  if(pending)return pending;
  const request=new Promise((resolve,reject)=>{
   let script,timer,done=false;
   const finish=error=>{
    if(done)return;done=true;clearTimer(timer);
    if(script){script.onload=script.onerror=null;if(error)script.remove();}
    if(error)reject(error);else {const ready=library();configureMapWorkers(ready,globalObject.navigator);resolve(ready);}
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
