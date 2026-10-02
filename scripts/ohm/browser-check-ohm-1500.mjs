// Reproducible real-browser check for the 1500 central-European OHM detail layer.
// Usage: node scripts/ohm/browser-check-ohm-1500.mjs --label before --base http://127.0.0.1:8767
// Requires a server serving this checkout (python3 serve.py --port 8767) and Chrome.
import fs from 'node:fs';
import zlib from 'node:zlib';
import {launch,goto,evaluate,waitFor,mapReady,screenshot,sleep,clickPoint} from '../verification/browser.mjs';

const args=process.argv.slice(2),arg=(name,fallback)=>args.includes('--'+name)?args[args.indexOf('--'+name)+1]:fallback;
const base=arg('base','http://127.0.0.1:8767'),label=arg('label','run');
const outDir=arg('outdir','/tmp/ohm-1500'),reportPath=arg('out',outDir+'/browser-'+label+'.json');
const CAMERA='9.32,48.08,6.72,0,0',camParts=CAMERA.split(',');
// Stroke colours used by the two detail layers; counting them proves which archive painted.
const TILE_EDGE=[0x63,0x5d,0x4a],FROZEN_EDGE=[0xa4,0x55,0x2b],TOL=14;

function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
function decodePNG(buffer){
 const sig=[137,80,78,71,13,10,26,10];for(let i=0;i<8;i++)if(buffer[i]!==sig[i])throw Error('not a PNG');
 let pos=8,width=0,height=0,depth=0,type=0;const idat=[];
 while(pos<buffer.length){const length=buffer.readUInt32BE(pos),name=buffer.toString('ascii',pos+4,pos+8),data=buffer.subarray(pos+8,pos+8+length);pos+=12+length;
  if(name==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);depth=data[8];type=data[9];}
  else if(name==='IDAT')idat.push(data);else if(name==='IEND')break;}
 if(depth!==8||(type!==2&&type!==6))throw Error('unsupported PNG depth/type '+depth+'/'+type);
 const channels=type===6?4:3,raw=zlib.inflateSync(Buffer.concat(idat)),stride=width*channels,pixels=Buffer.alloc(height*stride);
 let offset=0;
 for(let y=0;y<height;y++){
  const filter=raw[offset++],line=raw.subarray(offset,offset+stride);offset+=stride;
  const out=pixels.subarray(y*stride,(y+1)*stride),prior=y?pixels.subarray((y-1)*stride,y*stride):null;
  for(let x=0;x<stride;x++){
   const a=x>=channels?out[x-channels]:0,b=prior?prior[x]:0,c=prior&&x>=channels?prior[x-channels]:0,value=line[x];
   out[x]=filter===0?value:filter===1?(value+a)&255:filter===2?(value+b)&255:filter===3?(value+((a+b)>>1))&255:filter===4?(value+paeth(a,b,c))&255:0;
  }
 }
 return {width,height,channels,pixels};
}
function countColour(image,colour,tolerance){
 const {width,height,channels,pixels}=image;let count=0,tol=tolerance===undefined?TOL:tolerance;
 for(let i=0;i<width*height;i++){const o=i*channels;
  if(Math.abs(pixels[o]-colour[0])<=tol&&Math.abs(pixels[o+1]-colour[1])<=tol&&Math.abs(pixels[o+2]-colour[2])<=tol)count++;}
 return count;
}
// Rust-hued pixels separate the frozen extract (opacity-blended #a4552b) from the neutral
// tile stroke and from the beige terrain basemap.
function rustPixels(image){
 const {width,height,channels,pixels}=image;let count=0;
 for(let i=0;i<width*height;i++){const o=i*channels,red=pixels[o],green=pixels[o+1],blue=pixels[o+2];
  if(red-blue>62&&red-green>34&&red>108)count++;}
 return count;
}
// Pixel difference restricted to the map canvas, so editorial side-panel changes cannot leak in.
function pixelDiff(left,right,rect){
 if(left.width!==right.width||left.height!==right.height)return null;
 const {width,channels}=left;let changed=0,total=0;
 const x0=Math.max(0,Math.round(rect.x)),y0=Math.max(0,Math.round(rect.y)),x1=Math.min(width,Math.round(rect.right||rect.x+rect.width)),y1=Math.min(left.height,Math.round(rect.bottom||rect.y+rect.height));
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
  const o=(y*width+x)*channels;total++;
  if(Math.abs(left.pixels[o]-right.pixels[o])>10||Math.abs(left.pixels[o+1]-right.pixels[o+1])>10||Math.abs(left.pixels[o+2]-right.pixels[o+2])>10)changed++;
 }
 return {changed,total,ratio:total?changed/total:0};
}
function edgeDensity(image){
 const {width,height,channels,pixels}=image;let edges=0;
 const at=(px,py)=>{const o=(py*width+px)*channels;return pixels[o]*.299+pixels[o+1]*.587+pixels[o+2]*.114;};
 for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
  const gx=at(x+1,y)-at(x-1,y),gy=at(x,y+1)-at(x,y-1);
  if(Math.abs(gx)+Math.abs(gy)>54)edges++;
 }
 return edges;
}

const scenarios=[
 {key:'regional-1500',year:1500,mode:'regional',click:{lng:7.7526,lat:48.5839,expect:'Strasbourg'},click2:{lng:10.3155,lat:49.2411,expect:'Franconian'}},
 {key:'auto-1500',year:1500,mode:'auto'},
 {key:'regional-1492',year:1492,mode:'regional'},
 {key:'regional-1700-control',year:1700,mode:'regional'}
];

fs.mkdirSync(outDir,{recursive:true});
const session=await launch({width:1600,height:900,port:Number(arg('port','9351')),profile:'/tmp/atlas-cdp-ohm1500'});
const allResponses=[];
session.on(m=>{if(m.method==='Network.responseReceived'){const r=m.params.response;allResponses.push({url:r.url,status:r.status});}});
const report={label,base,camera:CAMERA,checkedAt:new Date().toISOString(),scenarios:[],console:[]};
try{
 for(const scenario of scenarios){
  const from=allResponses.length;
  await goto(session,base+'/#year='+scenario.year+'&lang=bi&camera='+CAMERA+'&boundaries='+scenario.mode,{waitMs:2500});
  let readyOk=true;try{await mapReady(session);}catch(e){readyOk=false;}
  // Wait for a stable badge: four consecutive identical reads that are not a loading caption.
  let previous=null,stable=0;
  for(let i=0;i<80&&stable<4;i++){
   const caption=await evaluate(session,"(()=>{const b=document.querySelector('.regional-badge');return b?b.textContent:null})()").catch(()=>null);
   if(caption&&caption===previous&&!/正在读取|正在补齐|Updating|loading/i.test(caption))stable++;else stable=0;
   previous=caption;await sleep(500);
  }
  await sleep(2500);
  const entries=allResponses.slice(from);
  const state=await evaluate(session,"(()=>{const badge=document.querySelector('.regional-badge'),status=document.querySelector('#regionalStatus'),canvas=document.querySelector('#map canvas');return{badge:badge?badge.textContent:null,status:status?status.textContent:null,labels:[...document.querySelectorAll('.regional-label')].map(e=>e.textContent),canvas:canvas?canvas.getBoundingClientRect().toJSON():null,dpr:window.devicePixelRatio};})()");
  const file=outDir+'/'+label+'-'+scenario.key+'.png';
  await screenshot(session,file);
  const image=decodePNG(fs.readFileSync(file));
  const unique=entries.filter((e,i,a)=>a.findIndex(x=>x.url===e.url)===i);
  const hosts=[...new Set(unique.map(e=>{try{return new URL(e.url).host}catch{return 'local'}}))];
  const compareLabel=arg('compare',null),compareFile=compareLabel?outDir+'/'+compareLabel+'-'+scenario.key+'.png':null;
  const baseline=compareFile&&fs.existsSync(compareFile)?decodePNG(fs.readFileSync(compareFile)):null;
  const result={key:scenario.key,year:scenario.year,mode:scenario.mode,readyOk,state,file,tileEdgePixels:countColour(image,TILE_EDGE),frozenEdgePixels:countColour(image,FROZEN_EDGE),rustPixels:rustPixels(image),edgePixels:edgeDensity(image),baseline:compareFile,diff:baseline&&state.canvas?pixelDiff(baseline,image,state.canvas):null,baselineRustPixels:baseline?rustPixels(baseline):null,detailRequests:unique.filter(e=>/ohm-1500/.test(e.url)),tileRequests:unique.filter(e=>/vtiles/.test(e.url)).length,hosts,requestCount:unique.length};
  if(scenario.click&&state.canvas){
   const rect=state.canvas,zoom=Number(camParts[2]);
   const project=(lng,lat)=>{const world=512*Math.pow(2,zoom);
    const x=(lng+180)/360*world,y=(1-Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))/Math.PI)/2*world;
    const cx=(Number(camParts[0])+180)/360*world,cy=(1-Math.log(Math.tan(Math.PI/4+Number(camParts[1])*Math.PI/360))/Math.PI)/2*world;
    return{x:rect.x+x-cx+rect.width/2,y:rect.y+y-cy+rect.height/2};};
   const point=project(scenario.click.lng,scenario.click.lat);
   await clickPoint(session,point.x,point.y);await sleep(1500);
   result.click={x:Math.round(point.x),y:Math.round(point.y),popup:await evaluate(session,"(()=>{const p=document.querySelector('.maplibregl-popup');return p?{text:p.textContent.slice(0,400),link:(p.querySelector('a[href*=openhistoricalmap]')||{}).href||null,hasArea:/面积|area/i.test(p.textContent)}:null})()")};
   await screenshot(session,outDir+'/'+label+'-'+scenario.key+'-click.png');
   if(scenario.click2){
    await evaluate(session,"document.querySelector('.maplibregl-popup-close-button')?.click()");await sleep(400);
    const second=project(scenario.click2.lng,scenario.click2.lat);
    await clickPoint(session,second.x,second.y);await sleep(1500);
    result.click2={x:Math.round(second.x),y:Math.round(second.y),popup:await evaluate(session,"(()=>{const p=document.querySelector('.maplibregl-popup');return p?{text:p.textContent.slice(0,400),link:(p.querySelector('a[href*=openhistoricalmap]')||{}).href||null,hasArea:/面积|area/i.test(p.textContent)}:null})()")};
    await screenshot(session,outDir+'/'+label+'-'+scenario.key+'-click2.png');
   }
  }
  report.scenarios.push(result);
 }
 report.console=session.console.filter(c=>c.type==='error'||c.type==='exception').slice(0,20);
}finally{await session.close();}
fs.mkdirSync(reportPath.replace(/\/[^/]+$/,''),{recursive:true});
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.scenarios.map(s=>({key:s.key,badge:s.state.badge,status:s.state.status,labels:s.state.labels.length,frozenEdgePixels:s.frozenEdgePixels,tileEdgePixels:s.tileEdgePixels,rustPixels:s.rustPixels,baselineRustPixels:s.baselineRustPixels,diff:s.diff,detailRequests:s.detailRequests.length,vtiles:s.tileRequests,click:s.click?s.click.popup&&s.click.popup.text.slice(0,60):null,click2:s.click2?s.click2.popup&&s.click2.popup.text.slice(0,60):null})),null,1));
console.log('report: '+reportPath);
