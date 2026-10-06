// Small URL state and lazy entry point; neither the map nor the full archives
// are imported merely to select a research version.
const RESEARCH_DOMAINS=new Set(['priority','all','scale','institutions','economy','transport','knowledge','warfare','religion','general','metadata','other','crisis']);
const RESEARCH_KEYS={dataset:'srDataset',polityId:'seshat',domain:'srDomain',variable:'srVariable',query:'srQ',polityQuery:'srFind',page:'srPage',readingId:'srReading'};
const DATASETS=new Set(['equinox','polaris-2026']);
const cleanResearchText=(value,limit)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,limit):'';
export function normalizeResearchState(value={}){
 const dataset=DATASETS.has(value.dataset)?value.dataset:'equinox';
 const pattern=dataset==='polaris-2026'?/^(?:@all|[A-Za-z0-9* _-]{1,96})$/:/^(?:@all|[A-Za-z0-9*_-]{1,40})$/;
 const polityId=typeof value.polityId==='string'&&pattern.test(value.polityId)?value.polityId:'';
 const page=typeof value.page==='number'?value.page:/^\d{1,5}$/.test(String(value.page??''))?Number(value.page):0;
 const domain=RESEARCH_DOMAINS.has(value.domain)&&!(dataset==='equinox'&&value.domain==='crisis')?value.domain:dataset==='equinox'?'priority':'all';
 const readingId=dataset==='polaris-2026'&&typeof value.readingId==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value.readingId)?value.readingId:'';
 return {dataset,polityId,domain,variable:cleanResearchText(value.variable,120)||'all',query:cleanResearchText(value.query,200),polityQuery:cleanResearchText(value.polityQuery,120),page:Number.isInteger(page)&&page>=0&&page<=10000?page:0,...(readingId?{readingId}:{})};
}
export function parseResearchState(params){return normalizeResearchState(Object.fromEntries(Object.entries(RESEARCH_KEYS).map(([key,param])=>[key,params.get(param)])));}
export function writeResearchState(params,value){const state=normalizeResearchState(value),defaults=normalizeResearchState();for(const [key,param]of Object.entries(RESEARCH_KEYS)){params.delete(param);if(state[key]!==defaults[key])params.set(param,String(state[key]));}return params;}
const stylesByDocument=new WeakMap(),modulePromises=new Map(),moduleAttempts=new Map();
function assetURL(name){return new URL(name+new URL(import.meta.url).search,import.meta.url).href;}
export function loadResearchStyles(doc){
 if(stylesByDocument.has(doc))return stylesByDocument.get(doc);
 const promise=new Promise((resolve,reject)=>{const link=doc.createElement('link');link.rel='stylesheet';link.href=assetURL('./research-reader.css');let timer;
  const finish=error=>{clearTimeout(timer);link.onload=link.onerror=null;if(error){link.remove();stylesByDocument.delete(doc);reject(error);}else resolve();};
  link.onload=()=>finish();link.onerror=()=>finish(new Error('Research stylesheet could not load'));timer=setTimeout(()=>finish(new Error('Research stylesheet timed out')),20000);doc.head.append(link);
 });stylesByDocument.set(doc,promise);return promise;
}
function loadReader(dataset='equinox'){
 if(!modulePromises.has(dataset)){
  let url=assetURL(dataset==='polaris-2026'?'./polaris-reader.js':'./research-reader.js');
  const attempt=moduleAttempts.get(dataset)||0;moduleAttempts.set(dataset,attempt+1);
  if(attempt)url+=(url.includes('?')?'&':'?')+'retry='+(attempt+1);
  modulePromises.set(dataset,import(url).catch(error=>{modulePromises.delete(dataset);throw error;}));
 }
 return modulePromises.get(dataset);
}
export function openResearchView(host,{lang='bi',initialPolityId='',initialState=null,onBack,onSelection,onStateChange,loadModule=loadReader,loadStyles=loadResearchStyles,dataBaseUrl=new URL('./data/seshat/',import.meta.url),polarisDataBaseUrl=new URL('./data/seshat-polaris-2026/',import.meta.url)}={}){
 let language=lang,dead=false,reader=null,attempt=0,failed=false;
 let snapshot=normalizeResearchState(initialState||{polityId:initialPolityId});const doc=host.ownerDocument;
 const t=(zh,en)=>language==='en'?en:language==='bi'?zh+' · '+en:zh;
 const shell=doc.createElement('section');shell.className='research-version-shell';
 const bar=doc.createElement('div');bar.className='research-version-bar';
 const versionLabel=doc.createElement('label'),caption=doc.createElement('span'),select=doc.createElement('select');
 versionLabel.append(caption,select);bar.append(versionLabel);const note=doc.createElement('p');bar.append(note);
 const body=doc.createElement('div');body.className='research-version-body';shell.append(bar,body);host.replaceChildren(shell);
 function renderVersion(){
  caption.textContent=t('资料版本','Archive version');select.setAttribute('aria-label',caption.textContent);
  select.replaceChildren();for(const [value,zh,en]of [['equinox','Equinox · 2022快照','Equinox · 2022 snapshot'],['polaris-2026','Polaris · 2026快照','Polaris · 2026 snapshot']]){const option=doc.createElement('option');option.value=value;option.textContent=t(zh,en);select.append(option);}
  select.value=snapshot.dataset;note.textContent=t('分别查阅两个版本，追溯原始资料。','Browse each version and trace its original records.');
 }
 function loading(error=false){
  if(dead)return;body.replaceChildren();const section=doc.createElement('section');section.className='seshat-research-reader';const status=doc.createElement('p');status.setAttribute('role','status');status.textContent=error?t('研究资料未能打开，请重试。','Research archive could not open. Please retry.'):t('正在打开社会与制度资料…','Opening societies and institutions…');section.append(status);
  if(error){const retry=doc.createElement('button');retry.type='button';retry.textContent=t('重新读取','Retry');retry.onclick=start;section.append(retry);}
  if(onBack){const back=doc.createElement('button');back.type='button';back.textContent=t('返回资料页','Back to sources');back.onclick=()=>{destroy();onBack();};section.append(back);}body.append(section);
 }
 async function start(){
  const current=++attempt,dataset=snapshot.dataset;reader?.destroy();reader=null;failed=false;loading();
  try{
   const [module]=await Promise.all([loadModule(dataset),loadStyles(doc)]);if(dead||current!==attempt)return;
   const instance=module.mountResearchReader(body,{lang:language,dataBaseUrl:dataset==='polaris-2026'?polarisDataBaseUrl:dataBaseUrl,initialState:snapshot,onVersionRequest:(next,phase)=>{if(!dead&&current===attempt)return selectDataset(next,phase);},onSelection:id=>{if(!dead&&current===attempt)onSelection?.(id);},onStateChange:value=>{if(dead||current!==attempt)return;snapshot=normalizeResearchState({...value,dataset});onStateChange?.(snapshot);},onBack:()=>{destroy();onBack?.();}});
   reader=instance;await instance.ready;
  }catch(error){if(dead||current!==attempt)return;reader?.destroy();reader=null;failed=true;loading(true);}
 }
 async function selectDataset(dataset,polityId=''){
  if(dead||!DATASETS.has(dataset)||dataset===snapshot.dataset)return;
  // IDs and variable definitions belong to their source version. Version
  // comparison is explicit; changing this control never guesses an identity.
  snapshot=normalizeResearchState({dataset,polityId,polityQuery:snapshot.polityQuery});select.value=dataset;onStateChange?.(snapshot);onSelection?.(snapshot.polityId);return start();
 }
 select.addEventListener('change',()=>selectDataset(select.value));
 function destroy(){if(dead)return;dead=true;attempt++;reader?.destroy();reader=null;host.replaceChildren();}
 function setLanguage(next){language=next;renderVersion();if(reader)reader.setLanguage(next);else loading(failed);}
 renderVersion();const ready=start();return {ready,destroy,setLanguage,selectDataset,getSnapshot:()=>normalizeResearchState({...snapshot,...reader?.getSnapshot?.(),dataset:snapshot.dataset}),getState:()=>({dataset:snapshot.dataset,loading:!reader&&!failed,failed,destroyed:dead,reader:reader?.getState()||null})};
}
