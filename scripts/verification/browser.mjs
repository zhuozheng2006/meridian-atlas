// Minimal Chrome DevTools Protocol driver for real-browser verification of the atlas.
// No npm dependencies: uses Node's built-in fetch and WebSocket (Node 20+ / 22+).
// Usage:
//   import { launch, goto, evaluate, waitFor, screenshot, key, click, sleep } from './browser.mjs';
//   const s = await launch({ width: 1600, height: 900 });
//   await goto(s, 'http://127.0.0.1:8766/#year=1500');
//
// The atlas reads its whole state from the URL hash:
//   #year=1500&lang=bi&camera=lon,lat,zoom,bearing,pitch&boundaries=auto|overview|regional|cshapes|halc
//   &borders=0&terrain=0&labels=0&cities=0&coast=0&reference=1&borderCurves=0&browse=0&projection=globe|mercator
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';

const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const KEY_CODES={ArrowLeft:37,ArrowRight:39,ArrowUp:38,ArrowDown:40,Enter:13,Escape:27,Tab:9,Backspace:8,Space:32,Home:36,End:35};

export async function launch({port=9333,width=1600,height=900,mobile=false,deviceScaleFactor=null,headless=true,profile=null}={}){
  const dsf=deviceScaleFactor??(mobile?2:1);
  const args=[headless?'--headless=new':'--new-window','--no-first-run','--no-default-browser-check','--enable-unsafe-swiftshader','--use-angle=swiftshader','--use-gl=angle','--hide-scrollbars',`--force-device-scale-factor=${dsf}`,'--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows',`--remote-debugging-port=${port}`,`--user-data-dir=${profile||'/tmp/atlas-cdp-'+port}`,`--window-size=${width},${height}`,'about:blank'];
  const proc=spawn(CHROME,args,{stdio:['ignore','ignore','ignore']});
  let target=null;
  for(let i=0;i<120;i++){
    try{const list=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();const page=list.find(t=>t.type==='page');if(page){target=page;break;}}catch{}
    await sleep(200);
  }
  if(!target){try{proc.kill('SIGKILL');}catch{}throw Error('CDP target not found on port '+port);}
  const ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  let id=0;const pending=new Map();const events=[];const listeners=[];
  ws.onmessage=ev=>{const msg=JSON.parse(ev.data);
    if(msg.id&&pending.has(msg.id)){const{resolve,reject}=pending.get(msg.id);pending.delete(msg.id);msg.error?reject(Error(JSON.stringify(msg.error))):resolve(msg.result);}
    else if(msg.method){events.push(msg);for(const l of listeners)l(msg);}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const mid=++id;pending.set(mid,{resolve,reject});ws.send(JSON.stringify({id:mid,method,params}));});
  const session={proc,ws,send,events,port,console:[],
    on:fn=>listeners.push(fn),
    async close(){try{ws.close();}catch{}try{proc.kill('SIGKILL');}catch{}await sleep(120);}};
  listeners.push(m=>{
    if(m.method==='Runtime.consoleAPICalled')session.console.push({type:m.params.type,text:(m.params.args||[]).map(a=>a.value??a.description).join(' ')});
    if(m.method==='Runtime.exceptionThrown')session.console.push({type:'exception',text:m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text});
    if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')session.console.push({type:'log',text:m.params.entry.text});
  });
  await send('Page.enable');await send('Runtime.enable');await send('Log.enable');await send('Network.enable');
  await send('Network.setCacheDisabled',{cacheDisabled:true});
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dsf,mobile});
  if(mobile){await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});}
  session.viewport={width,height,mobile};
  return session;
}

export async function goto(s,url,{waitMs=1500}={}){await s.send('Page.navigate',{url});await sleep(waitMs);}

export async function evaluate(s,expression){
  const r=await s.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});
  if(r.exceptionDetails)throw Error(r.exceptionDetails.text+' '+(r.exceptionDetails.exception?.description||''));
  return r.result.value;
}
export const evaluateJson=async(s,fn,...args)=>evaluate(s,`(${fn.toString()})(${args.map(a=>JSON.stringify(a)).join(',')})`);

export async function waitFor(s,expression,{timeout=30000,interval=250}={}){
  const start=Date.now();let last;
  while(Date.now()-start<timeout){try{last=await evaluate(s,expression);}catch{last=undefined;}if(last)return last;await sleep(interval);}
  throw Error('waitFor timeout: '+expression+' last='+JSON.stringify(last));
}
export const mapReady=s=>waitFor(s,"document.querySelector('#loading')?.hidden===true",{timeout:45000});
export const settle=async(s,ms=6000)=>sleep(ms);

export async function screenshot(s,path,opts={}){
  const r=await s.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,...opts});
  fs.mkdirSync(path.replace(/\/[^/]+$/,''),{recursive:true});
  fs.writeFileSync(path,Buffer.from(r.data,'base64'));return path;
}

export async function key(s,{code,key:k,text,alt=false,shift=false,ctrl=false,meta=false}){
  const modifiers=(alt?1:0)|(ctrl?2:0)|(meta?4:0)|(shift?8:0);
  const vk=KEY_CODES[code]||(k&&k.length===1?k.toUpperCase().charCodeAt(0):0);
  const base={modifiers,code,key:k,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk};
  await s.send('Input.dispatchKeyEvent',{type:text?'keyDown':'rawKeyDown',...base,...(text?{text}:{})});
  await s.send('Input.dispatchKeyEvent',{type:'keyUp',...base});
}
export const press=async(s,code,k,mods={})=>{await key(s,{code,key:k??code,...mods});await sleep(120);};

export async function rect(s,selector){
  return evaluate(s,`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return null;const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2};})()`);
}
export async function click(s,selector,{nth=0}={}){
  const box=await evaluate(s,`(()=>{const els=document.querySelectorAll(${JSON.stringify(selector)});const el=els[${nth}];if(!el)return null;const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  if(!box)throw Error('no element '+selector);
  await clickPoint(s,box.x,box.y);
}
export async function clickPoint(s,x,y){
  await s.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
  await s.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
  await s.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});
  await sleep(300);
}
export async function dragMap(s,fromX,fromY,toX,toY,steps=12){
  await s.send('Input.dispatchMouseEvent',{type:'mousePressed',x:fromX,y:fromY,button:'left',clickCount:1});
  for(let i=1;i<=steps;i++){await s.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:fromX+(toX-fromX)*i/steps,y:fromY+(toY-fromY)*i/steps,button:'left'});await sleep(20);}
  await s.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:toX,y:toY,button:'left',clickCount:1});
  await sleep(600);
}
export async function pixel(s,x,y,{w=1,h=1}={}){
  const r=await s.send('Page.captureScreenshot',{format:'png',clip:{x,y,width:w,height:h,scale:1},captureBeyondViewport:false});
  return Buffer.from(r.data,'base64');
}
export { sleep };
