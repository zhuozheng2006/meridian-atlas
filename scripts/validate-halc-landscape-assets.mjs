import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),pub=new URL('public/',root),checks=[];
async function test(name,fn){try{await fn();checks.push({name,pass:true});console.log('PASS '+name);}catch(error){checks.push({name,pass:false,error:error.stack});console.error('FAIL '+name+' '+error.stack);}}
const html=await fs.readFile(new URL('index.html',pub),'utf8'),revision=/src="entry\.js\?v=([^"]+)"/.exec(html)?.[1];
const moduleFiles=['halc-landscape-client.js','halc-landscape-worker.js','halc-landscape-prepare.js','halc-landscape-reader.js'];
await test('Worker entry and all static imports in its preparation graph carry the same current asset stamp',async()=>{
 assert(revision,'The checked-in entry HTML must be stamped');
 for(const [name,dependency]of [['halc-landscape.js','halc-landscape-client.js'],['halc-landscape-worker.js','halc-landscape-prepare.js'],['halc-landscape-prepare.js','halc-landscape-reader.js']]){
  const text=await fs.readFile(new URL(name,pub),'utf8'),imports=[...text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m=>new URL(m[1],new URL(name,pub))),matching=imports.filter(u=>u.pathname.endsWith('/'+dependency));assert.equal(matching.length,1);assert.equal(matching[0].search,'?v='+revision);
 }
 const {LandscapeWorkerPool}=await import(new URL('halc-landscape-client.js?v='+revision,pub));let opened;
 class FakeWorker{constructor(url){opened=new URL(url);}addEventListener(){}postMessage(){}terminate(){}}
 const pool=new LandscapeWorkerPool({Worker:FakeWorker,baseURL:'https://atlas.test/data/halc-landscape/'});try{assert.equal(opened.search,'?v='+revision);assert.equal(opened.pathname,new URL('halc-landscape-worker.js',pub).pathname);}finally{pool.close();}
});
let mime;
await test('Actual local AtlasHandler maps each module script to a JavaScript MIME type',()=>{
 const python="import importlib.util,json,sys;sys.dont_write_bytecode=True;s=importlib.util.spec_from_file_location('atlas_serve',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);h=object.__new__(m.AtlasHandler);print(json.dumps({p:h.guess_type(p) for p in sys.argv[2:]}))";
 mime=JSON.parse(execFileSync('python3',['-c',python,fileURLToPath(new URL('serve.py',root)),...moduleFiles],{encoding:'utf8'}));
 for(const name of moduleFiles)assert(['text/javascript','application/javascript'].includes(mime[name]),name+': '+mime[name]);
});
await test('Preserved upstream vendor bytes live outside the public static tree',async()=>{
 assert((await fs.stat(new URL('scripts/vendor/maplibre/maplibre-gl-5.6.2.upstream.js',root))).isFile());
 await assert.rejects(fs.stat(new URL('assets/maplibre-gl-5.6.2.upstream.js',pub)),{code:'ENOENT'});
 for(const name of moduleFiles)assert((await fs.stat(new URL(name,pub))).isFile());
});
const report={generated:new Date().toISOString(),method:'Stamped module imports and the actual client Worker URL, actual local AtlasHandler MIME mapping, and static-tree placement. Does not assert deployed headers/CSP or successful browser module-worker startup.',assetRevision:revision,mime,passed:checks.filter(c=>c.pass).length,total:checks.length,checks};
await fs.mkdir(new URL('docs/verification-3.46/',root),{recursive:true});await fs.writeFile(new URL('docs/verification-3.46/halc-landscape-assets.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,total:report.total}));if(report.passed!==report.total)process.exitCode=1;
