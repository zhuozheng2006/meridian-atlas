// URL state is deliberately small and independent of the dataset and map runtime.
const RESEARCH_DOMAINS=new Set(['priority','all','scale','institutions','economy','transport','knowledge','warfare','religion','general','metadata','other']);
const RESEARCH_KEYS={polityId:'seshat',domain:'srDomain',variable:'srVariable',query:'srQ',polityQuery:'srFind',page:'srPage'};
const cleanResearchText=(value,limit)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,limit):'';
export function normalizeResearchState(value={}){
 const polityId=typeof value.polityId==='string'&&/^(?:@all|[A-Za-z0-9*_-]{1,40})$/.test(value.polityId)?value.polityId:'';
 const page=typeof value.page==='number'?value.page:/^\d{1,5}$/.test(String(value.page??''))?Number(value.page):0;
 return {polityId,domain:RESEARCH_DOMAINS.has(value.domain)?value.domain:'priority',variable:cleanResearchText(value.variable,120)||'all',query:cleanResearchText(value.query,200),polityQuery:cleanResearchText(value.polityQuery,120),page:Number.isInteger(page)&&page>=0&&page<=10000?page:0};
}
export function parseResearchState(params){return normalizeResearchState(Object.fromEntries(Object.entries(RESEARCH_KEYS).map(([key,param])=>[key,params.get(param)])));}
export function writeResearchState(params,value){const state=normalizeResearchState(value),defaults=normalizeResearchState();for(const [key,param]of Object.entries(RESEARCH_KEYS)){params.delete(param);if(state[key]!==defaults[key])params.set(param,String(state[key]));}return params;}
// Small lazy entry point. Reading the map never imports the research archive or its CSS.
const stylesByDocument=new WeakMap();
let modulePromise=null,moduleAttempt=0;
function assetURL(name){return new URL(name+new URL(import.meta.url).search,import.meta.url).href;}
export function loadResearchStyles(doc){
 if(stylesByDocument.has(doc))return stylesByDocument.get(doc);
 const promise=new Promise((resolve,reject)=>{const link=doc.createElement('link');link.rel='stylesheet';link.href=assetURL('./research-reader.css');let timer;
  const finish=error=>{clearTimeout(timer);link.onload=link.onerror=null;if(error){link.remove();stylesByDocument.delete(doc);reject(error);}else resolve();};
  link.onload=()=>finish();link.onerror=()=>finish(new Error('Research stylesheet could not load'));timer=setTimeout(()=>finish(new Error('Research stylesheet timed out')),20000);doc.head.append(link);
 });stylesByDocument.set(doc,promise);return promise;
}
function loadReader(){if(!modulePromise){let url=assetURL('./research-reader.js');if(moduleAttempt++)url+=(url.includes('?')?'&':'?')+'retry='+moduleAttempt;modulePromise=import(url).catch(error=>{modulePromise=null;throw error;});}return modulePromise;}
export function openResearchView(host,{lang='bi',initialPolityId='',initialState=null,onBack,onSelection,onStateChange,loadModule=loadReader,loadStyles=loadResearchStyles,dataBaseUrl=new URL('./data/seshat/',import.meta.url)}={}){
 let language=lang,dead=false,reader=null,attempt=0,failed=false;let snapshot=normalizeResearchState(initialState||{polityId:initialPolityId});const doc=host.ownerDocument;
 const t=(zh,en)=>language==='en'?en:language==='bi'?zh+' · '+en:zh;
 function loading(error=false){if(dead)return;host.replaceChildren();const section=doc.createElement('section');section.className='seshat-research-reader';const status=doc.createElement('p');status.setAttribute('role','status');status.textContent=error?t('研究资料未能打开，请重试。','Research archive could not open. Please retry.'):t('正在打开社会与制度资料…','Opening societies and institutions…');section.append(status);
  if(error){const retry=doc.createElement('button');retry.type='button';retry.textContent=t('重新读取','Retry');retry.onclick=start;section.append(retry);}
  if(onBack){const back=doc.createElement('button');back.type='button';back.textContent=t('返回资料页','Back to sources');back.onclick=()=>{destroy();onBack();};section.append(back);}host.append(section);
 }
 async function start(){const current=++attempt;failed=false;loading();try{const [module]=await Promise.all([loadModule(),loadStyles(doc)]);if(dead||current!==attempt)return;reader=module.mountResearchReader(host,{lang:language,dataBaseUrl,initialState:snapshot,onSelection,onStateChange:value=>{snapshot=value;onStateChange?.(value);},onBack:()=>{destroy();onBack?.();}});await reader.ready;}catch(error){if(dead||current!==attempt)return;failed=true;loading(true);}}
 function destroy(){if(dead)return;dead=true;attempt++;reader?.destroy();host.replaceChildren();}
 function setLanguage(next){language=next;if(reader)reader.setLanguage(next);else loading(failed);}
 const ready=start();return {ready,destroy,setLanguage,getSnapshot:()=>reader?.getSnapshot()||snapshot,getState:()=>({loading:!reader&&!failed,failed,destroyed:dead,reader:reader?.getState()||null})};
}
