import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {yearKeyIntent,bindTimeline} from '../dist/timeline-controls.js';
import {stepYear} from '../dist/map-engine.js';
let checks=0;const pass=name=>{checks++;console.log('PASS '+name)};
for(const year of [-70000,-1,1,1492,1800,1900,2000]){
 assert.equal(yearKeyIntent('ArrowRight',{slider:true}).delta,1);
 assert.equal(stepYear(year,yearKeyIntent('ArrowRight',{slider:true}).delta),year===-1?1:year+1);
}
assert.equal(yearKeyIntent('ArrowLeft',{number:true}),null);
assert.equal(yearKeyIntent('ArrowDown',{number:true}).delta,-1);
assert.equal(yearKeyIntent('ArrowRight',{step:10,shift:true}).delta,100);
assert.equal(yearKeyIntent('Home',{slider:true}).year,-70000);
assert.equal(yearKeyIntent('End',{slider:true}).year,2026);
pass('Timeline keys use civil-year steps regardless of nonlinear slider scale');
const nodes=new Map(),listeners={};const node=(id,interactive=false)=>({id,value:'',matches:selector=>id==='canvas'&&selector==='.maplibregl-canvas',closest:selector=>interactive&&selector.startsWith('input,')?{}:null});
for(const id of ['yearInput','compareYear','yearSlider'])nodes.set('#'+id,node(id,true));
globalThis.document={querySelector:s=>nodes.get(s),addEventListener:(name,fn)=>listeners[name]=fn};
let year=1492,comp=1900,commits=0,plays=0,pans=0,steps=1;
bindTimeline({getYear:()=>year,getCompareYear:()=>comp,getStep:()=>steps,commit:y=>{year=y;commits++},commitCompare:y=>comp=y,pause(){},isAtlas:()=>true,isDialogOpen:()=>false,closeReader(){},readerOpen:()=>false,togglePlay:()=>plays++,getMap:()=>({panBy:()=>pans++})});
const fire=(key,target,extra={})=>{let prevented=false;listeners.keydown({key,code:key===' '?'Space':key,target,preventDefault(){prevented=true},stopPropagation(){},...extra});return prevented;};
const canvas=node('canvas');fire('ArrowRight',canvas);assert.equal(year,1493);assert.equal(pans,0);
fire('ArrowLeft',canvas,{altKey:true});assert.equal(pans,1);assert.equal(year,1493);
fire('ArrowRight',canvas,{ctrlKey:true});assert.equal(year,1493);
fire('ArrowRight',node('search',true));assert.equal(year,1493);
fire(' ',node('button',true));assert.equal(plays,0);fire(' ',canvas);assert.equal(plays,1);
pass('Map arrows change years once; Alt pans; native controls and modified keys stay isolated');
const input=nodes.get('#yearInput');year=1;fire('ArrowDown',input);assert.equal(year,-1);
input.value='';fire('Enter',input);assert.equal(year,-1);assert.equal(input.value,-1);
input.value='0';fire('Enter',input);assert.equal(year,-1);
const before=commits;input.value='1914';fire('Enter',input);input.onchange();assert.equal(commits,before+1);
pass('Year fields cross BCE correctly, reject empty/zero, and commit Enter only once');
const root=new URL('../dist/',import.meta.url);const jsonGzip=path=>JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL(path,root))));
const catalog=jsonGzip('data/fast/catalog.json.gz');const shards=new Map();
for(const year of [-3400,-221,1,500,1000,1492,1750,1914,1945,1991,2024]){
 const boot=jsonGzip(`data/fast/year-${year}.json.gz`);
 for(const [id,geometry]of Object.entries(boot)){
  const file=catalog.geometryIndex[id];if(!shards.has(file))shards.set(file,jsonGzip('data/'+file+'.gz'));
  assert.deepEqual(geometry,shards.get(file)[id]);
 }
}
pass('All eleven bootstrap maps exactly retain canonical 0.02-degree display geometry');
const report=JSON.parse(fs.readFileSync(new URL('data/fast/build-report.json',root)));
assert.equal(report.overviewToleranceDegrees,.04);assert.equal(report.overviewInvalidGeometries,13);
const land=jsonGzip('data/land-50m.json.gz');assert.equal(land.features.length,1420);
pass('Finer overview introduces no extra invalid shapes and detailed coastlines are packaged');
console.log(JSON.stringify({result:'passed',checks}));
