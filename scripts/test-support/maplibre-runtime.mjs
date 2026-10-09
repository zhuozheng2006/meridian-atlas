import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
// Executes the actual bundle with observed transport boundaries. This harness
// does not pretend to provide a browser renderer or Chrome timing measurements.
export async function maplibreRuntime(file,{fetcher=fetch}={}){
 let bundle=await fs.readFile(file,'utf8');
 for(const marker of ['    modules.index(maplibregl, sharedModule);','class X extends t.E','class se{constructor(t){this.self=t,'])assert.equal(bundle.split(marker).length,2);
 bundle=bundle.replace('    modules.index(maplibregl, sharedModule);','modules.index(maplibregl, sharedModule); modules.worker(sharedModule); globalThis.RealMap=maplibregl.Map;').replace('class X extends t.E','globalThis.RealGeoJSONSource=H;class X extends t.E').replace('class se{constructor(t){this.self=t,','globalThis.RealGeoJSONWorkerSource=oe;class se{constructor(t){this.self=t,');
 const log={stringify:0,fetch:[],parse:0,forward:[],requests:[],returns:[]};
 class WorkerGlobalScope{};const self=new WorkerGlobalScope();self.worker={referrer:'https://atlas.test/',actor:{sendAsync:async r=>{log.forward.push(r);throw Error('Unexpected main-thread fetch');}}};
 const context=vm.createContext({console,performance,setTimeout,clearTimeout,TextEncoder,TextDecoder,AbortController,URL,Blob,Response,Request,Headers,WorkerGlobalScope,self:{},navigator:{userAgent:'Chrome',hardwareConcurrency:8},document:{documentElement:{style:{}},createElement:()=>({set href(v){this.url=new URL(v,'https://atlas.test/').href},get href(){return this.url}})},JSON:{parse:JSON.parse,stringify:(...args)=>{log.stringify++;return JSON.stringify(...args);}},fetch:async req=>{log.fetch.push({url:req.url,signal:req.signal});const r=await fetcher(req),read=r.json.bind(r);r.json=async()=>{log.parse++;return read()};return r;}});
 vm.runInContext(bundle,context,{displayErrors:false});context.self=self;context.window={location:{protocol:'https:',href:'https://atlas.test/'}};
 async function load(input,{id='halc-landscape',...extra}={}){
  const worker=new context.RealGeoJSONWorkerSource({}, {}, []),pending=[],errors=[],events=[];
  const actor={sendAsync:request=>{log.requests.push(request);let p;if(request.type==='GD')p=worker.getData();else if(request.type==='LD')p=worker.loadData(request.data);else throw Error('Unexpected message '+request.type);const answer=Promise.resolve(p).then(result=>{log.returns.push({type:request.type,dataType:typeof result?.data});return structuredClone(result)});pending.push(answer);return answer;}};
  const source=new context.RealGeoJSONSource(id,{type:'geojson',data:input,tolerance:0,maxzoom:14,...extra},{getActor:()=>actor});
  source.map={_requestManager:{transformRequest:url=>({url})}};
  source.on('error',e=>errors.push(e.error));for(const name of ['dataloading','data','dataabort'])source.on(name,e=>events.push({type:name,sourceDataType:e.sourceDataType}));
  await source.load();
  return {source,worker,errors,events,async settle(){for(let i=0;i<100&&!source.loaded();i++)await new Promise(r=>setTimeout(r,0));assert(source.loaded());}};
 }
 return {context,log,load};
}
