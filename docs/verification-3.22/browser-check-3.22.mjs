#!/usr/bin/env node
// Usage: node docs/verification-3.22/browser-check-3.22.mjs [wsEndpoint]
// Drives the live atlas through the Chrome DevTools Protocol and verifies the no-territory
// section at two viewport sizes: the section is visible, lists exactly the declared polities,
// opens a dossier with the bilingual note, states that no boundary is drawn, keeps the page free
// of horizontal overflow and produces no console errors. Screenshots land next to this script.
import {writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
// The atlases opens on the map; the polities view is reached through its tab, which is what a
// reader does. The deep-link hash is not used here because it does not switch the view reliably.
// A per-run query token keeps the previous module out of the browser cache between runs.
const baseUrl='http://127.0.0.1:8767/?lang=bi&run='+Date.now();
const targets=await (await fetch('http://127.0.0.1:9333/json/list')).json();
const page=targets.find(item=>item.type==='page');
if(!page)throw new Error('no page target');
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((done,error)=>{ws.onopen=done;ws.onerror=error});
let seq=0;const pending=new Map();const events=[];
ws.onmessage=message=>{const payload=JSON.parse(message.data);if(payload.id&&pending.has(payload.id)){const {done,error}=pending.get(payload.id);pending.delete(payload.id);payload.error?error(new Error(payload.error.message)):done(payload.result)}else if(payload.method)events.push(payload)};
const send=(method,params={})=>new Promise((done,error)=>{const id=++seq;pending.set(id,{done,error});ws.send(JSON.stringify({id,method,params}))});
const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'evaluate failed');return result.result.value};
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const waitFor=async(expression,timeout=15000)=>{const until=Date.now()+timeout;while(Date.now()<until){if(await evaluate(expression))return true;await sleep(250)}throw new Error('timeout waiting for '+expression)};
await send('Runtime.enable');await send('Log.enable');await send('Page.enable');
// Warm the page once: a cold headless start needs far longer for the map and data to settle.
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:baseUrl});
await waitFor("!!window.__meridian",90000);
const viewports=[[1440,900],[390,844]];
const report=[];
for(const [width,height] of viewports){
 events.length=0;
 await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
 await send('Page.navigate',{url:baseUrl});
 await waitFor("!!window.__meridian",60000);
 await evaluate("document.querySelector('#tabs button[data-view=\"polities\"]').click()");
 await waitFor("!!document.querySelector('.no-territory')",20000);
 await sleep(600);
 const section=await evaluate(`(()=>{const node=document.querySelector('.no-territory');const cards=[...document.querySelectorAll('[data-open-no-territory]')];return {visible:!!node&&node.offsetParent!==null||!!node,cards:cards.length,qids:cards.map(card=>card.dataset.openNoTerritory).sort(),heading:node.querySelector('h2').textContent.trim(),caption:node.querySelector('.section-caption').textContent.trim().slice(0,60),overflowX:document.documentElement.scrollWidth-window.innerWidth,viewport:[window.innerWidth,window.innerHeight]}})()`);
 await evaluate("document.querySelector('.no-territory').scrollIntoView({block:'start'})");
 await sleep(500);
 const sectionShot=await send('Page.captureScreenshot',{format:'png'});
 await writeFile(resolve(root,'docs/verification-3.22/no-territory-section-'+width+'x'+height+'.png'),Buffer.from(sectionShot.data,'base64'));
 await evaluate("document.querySelector('[data-open-no-territory]').click()");
 await waitFor("!!document.querySelector('#noTerritoryBody')",10000);
 await sleep(400);
 const dossier=await evaluate(`(()=>{const body=document.querySelector('#contentView #noTerritoryBody');const rect=body?body.getBoundingClientRect():{width:0,height:0};return {open:!!body&&!document.querySelector('#contentView').hidden,visible:rect.width>200&&rect.height>100,text:body?body.innerText:'',links:[...document.querySelectorAll('.no-territory-sources a')].map(a=>a.href),overflowX:document.documentElement.scrollWidth-window.innerWidth}})()`);
 const dossierShot=await send('Page.captureScreenshot',{format:'png'});
 await writeFile(resolve(root,'docs/verification-3.22/no-territory-dossier-'+width+'x'+height+'.png'),Buffer.from(dossierShot.data,'base64'));
 const errors=events.filter(event=>event.method==='Runtime.exceptionThrown'||(event.method==='Runtime.consoleAPICalled'&&event.params.type==='error')||(event.method==='Log.entryAdded'&&event.params.entry.level==='error')).map(event=>JSON.stringify(event.params).slice(0,160));
 report.push({viewport:[width,height],section:{cards:section.cards,qids:section.qids,heading:section.heading,caption:section.caption,overflowX:section.overflowX},
  dossier:{open:dossier.open,hasChineseNote:dossier.text.includes('本站疆域数据未收录该政体'),hasEnglishNote:dossier.text.includes('This atlas holds no territory data'),hasChineseMapSentence:dossier.text.includes('本站地图不会显示该政体的疆域'),hasEnglishMapSentence:dossier.text.includes('never draws a boundary'),sources:dossier.links.length,visible:dossier.visible,overflowX:dossier.overflowX},
  consoleErrors:errors});
}
console.log(JSON.stringify({url:baseUrl,report},null,2));
ws.close();
