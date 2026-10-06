/** Real bundled worker parser and shipped vector bytes, without browser/GPU. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {halcLayers} from '../public/halc-boundaries.js';
const root=resolve(process.argv[2]||'.'),bundle=await fs.readFile(resolve(root,'public/assets/maplibre-gl.js'),'utf8');
// Expose private constructors only in this isolated copy. Their grouping,
// geometry parsing, program configurations and population code remain intact.
const bridge='modules.shared(sharedModule);',bootstrap='return e.i(self)&&(self.worker=new se(self)),se';
assert.equal(bundle.split(bridge).length,2,'Bundled shared-module hook changed; review this fixture');
const sandbox=vm.createContext({console,setTimeout,clearTimeout,performance,TextDecoder,TextEncoder,URL,AbortController,Blob});
vm.runInContext(bundle.replace(bridge,bridge+'globalThis.shared=sharedModule;globalThis.workerFactory=modules.worker;'),sandbox);
const factory=sandbox.workerFactory.toString();assert.equal(factory.split(bootstrap).length,2,'Bundled worker hook changed; review this fixture');
const {StyleLayerIndex,WorkerTile}=vm.runInContext('('+factory.replace(bootstrap,'return {StyleLayerIndex:t,WorkerTile:o}')+')',sandbox)(sandbox.shared);
const tilePath=process.env.HALC_BUCKET_TILE||'6/32/20',parts=tilePath.split('/').map(Number);assert(parts.length===3&&parts.every(Number.isInteger));
const [z,x,y]=parts,bytes=await fs.readFile(resolve(root,'public/data/halc/tiles/'+tilePath+'.pbf'));
const sourceTile=new sandbox.shared.cL(new sandbox.shared.cM(bytes)),rawLayer=sourceTile.layers.halc_localities;
const visibleLayers=()=>halcLayers().map(layer=>({...layer,layout:{...layer.layout,visibility:'visible'}}));
const checks=[];const test=async(name,fn)=>{try{await fn();checks.push({name,pass:true});console.log('PASS '+name);}catch(error){checks.push({name,pass:false,error:error.message});console.error('FAIL '+name+'\n'+error.message);}};
async function parse(layers){
 const index=new StyleLayerIndex(layers),worker=new WorkerTile({tileID:{overscaledZ:z,wrap:0,canonical:{z,x,y}},zoom:z,uid:'halc-shared-bucket-fixture',pixelRatio:1,tileSize:512,source:'halc-boundaries',promoteId:{halc_localities:'fid'},globalState:{}});
 const granularity={getGranularityForZoomLevel:()=>1},start=performance.now();
 const result=await worker.parse(sourceTile,index,[],{sendAsync(){throw Error('Unexpected external tile dependency');}},{fill:granularity,line:granularity});
 return {...result,index,parseMs:performance.now()-start};
}
const candidate=await parse(visibleLayers());
// Exact preceding candidate: a separate unfiltered full selection line layer.
const preceding=visibleLayers().filter(l=>l.id!=='halc-independent-selected').map(l=>{if(l.id!=='halc-selected')return l;const copy={...l};delete copy.filter;return copy;});
const previous=await parse(preceding);
const bucket=(result,id)=>result.buckets.find(b=>b.layerIds.includes(id));
const digest=array=>createHash('sha256').update(Buffer.from(array.arrayBuffer,0,array.length*array.bytesPerElement)).digest('hex');
const geometry=(result,id)=>{const b=bucket(result,id);return {vertices:b.layoutVertexArray.length,triangles:b.indexArray.length,vertexSha256:digest(b.layoutVertexArray),indexSha256:digest(b.indexArray)};};
await test('Real worker groups ordinary and independent selected layers with their respective base layers',()=>{
 const families=candidate.index.familiesBySource['halc-boundaries'].halc_localities.map(f=>Array.from(f,l=>l.id));
 assert.deepEqual(Array.from(families),[['halc-wash'],['halc-edges','halc-selected'],['halc-independent-edges','halc-independent-selected']]);
});
await test('Real populated bucket objects and geometry arrays are identical for each base/selection pair',()=>{
 for(const [base,selected]of [['halc-edges','halc-selected'],['halc-independent-edges','halc-independent-selected']]){
  const normal=bucket(candidate,base),highlight=bucket(candidate,selected);assert(normal&&normal.layoutVertexArray.length>0);assert.equal(normal,highlight);assert.equal(normal.layoutVertexArray,highlight.layoutVertexArray);assert.equal(normal.indexArray,highlight.indexArray);assert(normal.stateDependentLayerIds.includes(selected));assert(normal.programConfigurations.get(selected));
 }
 assert.equal(candidate.buckets.filter(b=>b.layers[0].type==='line').length,2);assert.equal(previous.buckets.filter(b=>b.layers[0].type==='line').length,3);
});
await test('Sharing leaves every ordinary and independent geometry vertex and triangle byte unchanged',()=>{
 for(const id of ['halc-edges','halc-independent-edges'])assert.deepEqual(geometry(candidate,id),geometry(previous,id));
});
await test('Every shipped tile feature matches exactly one selected layer, including XX composites',()=>{
 const ordinary=candidate.index._layers['halc-selected']._featureFilter.filter,independent=candidate.index._layers['halc-independent-selected']._featureFilter.filter;
 let a=0,b=0;for(let i=0;i<rawLayer.length;i++){const feature=rawLayer.feature(i),one=ordinary({zoom:z},feature),two=independent({zoom:z},feature);assert.notEqual(one,two);assert.equal(Boolean(two),String(feature.properties.ADM1||'').split(';').includes('XX'));one?a++:b++;}assert(a>0&&b>0);
});
await test('Both selected passes retain original color, width, opacity and state dependency',()=>{
 for(const id of ['halc-selected','halc-independent-selected']){
  const layer=candidate.index._layers[id],paint=layer._transitionablePaint._values;
  for(const zoom of [6,8,12,15]){const on=paint['line-color'].value.expression.evaluate({zoom},{properties:{}},{halcSelected:true}),off=paint['line-color'].value.expression.evaluate({zoom},{properties:{}},{});assert.equal(on.a,1);assert.equal(off.a,0);assert(Math.abs(on.r-169/255)<1e-12);assert(Math.abs(on.g-105/255)<1e-12);assert(Math.abs(on.b-38/255)<1e-12);}
  assert.deepEqual(Array.from(layer.getPaintProperty('line-width')),['interpolate',['linear'],['zoom'],6,1.5,12,2.3]);assert.equal(layer.getPaintProperty('line-opacity'),0);
 }
});
const sum=result=>result.buckets.filter(b=>b.layers[0].type==='line').reduce((n,b)=>n+b.layoutVertexArray.length,0);
const report={checkedAt:new Date().toISOString(),method:'Production MapLibre v5.6.2 private StyleLayerIndex and WorkerTile.parse exposed in an isolated runtime; original source parser/grouping/bucket code, real shipped PBF, fixed subdivision granularity 1. No network or GPU; isolated parse timings are observations, not browser latency claims.',maplibreSha256:createHash('sha256').update(bundle).digest('hex'),tile:{path:tilePath+'.pbf',bytes:bytes.length,features:rawLayer.length,sha256:createHash('sha256').update(bytes).digest('hex')},preceding:{lineBuckets:3,lineVertices:sum(previous),parseMs:previous.parseMs},candidate:{lineBuckets:2,lineVertices:sum(candidate),parseMs:candidate.parseMs,ordinary:geometry(candidate,'halc-edges'),independent:geometry(candidate,'halc-independent-edges')},pass:checks.filter(c=>c.pass).length,fail:checks.filter(c=>!c.pass).length,checks};
console.log(JSON.stringify({pass:report.pass,fail:report.fail,precedingLineVertices:report.preceding.lineVertices,sharedLineVertices:report.candidate.lineVertices}));if(process.env.HALC_BUCKET_REPORT)await fs.writeFile(process.env.HALC_BUCKET_REPORT,JSON.stringify(report,null,2)+'\n');if(report.fail)process.exitCode=1;
