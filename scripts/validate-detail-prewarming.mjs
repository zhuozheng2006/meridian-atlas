import assert from 'node:assert/strict';
import fs from 'node:fs';
import {RegionalBoundaries,readRegionalSnapshot} from '../public/regional-boundaries.js';
import {chinaWindowFor} from '../public/china-prefectures.js';
const box=x=>({getWest:()=>x-1,getEast:()=>x+1,getSouth:()=>33,getNorth:()=>37});
const requests=[],originalFetch=globalThis.fetch;
let failNext=false;
globalThis.fetch=async url=>{const path=String(url).split('?')[0];requests.push(path);if(failNext&&path.includes('band-90')){failNext=false;return new Response('offline',{status:503});}return new Response(fs.readFileSync('public/'+path));};
const owner={enabled:true,modern:false,dead:false,year:742,atlas:{showBorders:true,destroyed:false},map:{getZoom:()=>5.5},ohmWindow:chinaWindowFor(box(104),742)};
const warm=()=>RegionalBoundaries.prototype.warmDetail.call(owner);
try{
 await warm();const initial=requests.length;assert(requests.some(x=>x.includes('year-742-band-100')));
 await warm();assert.equal(requests.length,initial);
 owner.ohmWindow=chinaWindowFor(box(114),742);await warm();assert(requests.some(x=>x.includes('year-742-band-110')));assert.equal(requests.length,initial+1);
 const warmed=requests.length;const detail=await readRegionalSnapshot(owner.ohmWindow,742);assert(detail.features.length>0);assert.equal(requests.length,warmed,'visible detail must reuse preloaded bytes');
 owner.ohmWindow=chinaWindowFor(box(94),742);failNext=true;await warm();assert.equal(owner.warmURL,null);await warm();assert.equal(requests.filter(x=>x.includes('band-90')).length,2,'failed preloads remain retryable');
 owner.year=2;owner.ohmWindow=chinaWindowFor(box(104),2);await warm();assert(requests.some(x=>x.includes('year-2-band-100')));
 const before=requests.length;owner.ohmWindow=chinaWindowFor(box(124),2);
 for(const flag of ['modern','dead']){owner[flag]=true;await warm();owner[flag]=false;}
 owner.enabled=false;await warm();owner.enabled=true;owner.atlas.showBorders=false;await warm();owner.atlas.showBorders=true;owner.map.getZoom=()=>4.9;await warm();assert.equal(requests.length,before);
 const report={passed:true,differentBandsPreloaded:true,sameBandDeduplicated:true,visibleDetailReusesWarmData:true,failedPreloadRetry:true,yearSwitchIsolated:true,inactiveMapsDoNotWarm:true};
 fs.mkdirSync('docs/verification-3.59',{recursive:true});fs.writeFileSync('docs/verification-3.59/detail-prewarming.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}finally{globalThis.fetch=originalFetch;}
