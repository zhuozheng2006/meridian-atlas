// The first route chooses a reader or the atlas application, without importing both.
const assetURL=name=>new URL(name+new URL(import.meta.url).search,import.meta.url).href;
export function createApplicationLoader(importModule=url=>import(url)){
 let pending=null,attempt=0;
 return function load(){
  if(!pending){let url=assetURL('./app.js');if(attempt++)url+=(url.includes('?')?'&':'?')+'retry='+attempt;pending=importModule(url).catch(error=>{pending=null;throw error;});}
  return pending;
 };
}
export async function startEntry({doc=document,win=window,loadApplication=createApplicationLoader(),loadResearch=()=>import(assetURL('./research-shell.js'))}={}){
 const research=new URLSearchParams(win.location.hash.slice(1)).get('view')==='research';
 if(research){const {mountResearchShell}=await loadResearch();return mountResearchShell({doc,win,loadApplication});}
 const module=await loadApplication(),application=module.startApplication();await application.ready;return application;
}
function boot(){
 startEntry().catch(()=>{
  const doc=document,host=doc.getElementById('contentView'),en=new URLSearchParams(location.hash.slice(1)).get('lang')==='en';
  for(const id of ['atlasView','timeline','browseBtn','compareBtn'])doc.getElementById(id).hidden=true;host.hidden=false;host.replaceChildren();
  const status=doc.createElement('p');status.setAttribute('role','status');status.textContent=en?'This page could not open. Please retry.':'页面暂未打开，请重试。';
  const retry=doc.createElement('button');retry.type='button';retry.textContent=en?'Retry':'重新读取';retry.onclick=()=>location.reload();host.append(status,retry);
 });
}
if(typeof window!=='undefined'&&typeof document!=='undefined')boot();
