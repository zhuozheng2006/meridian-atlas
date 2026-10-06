import {SAVED_TEXTS} from './research-original-text-data.js?v=3.43.0-6a6bc23b738e';
const inflight=new Map();
export function savedTextFor(item){return SAVED_TEXTS.documents.find(entry=>entry.sourceId===item.sourceId&&entry.source.sha256===item.sourceSha256&&entry.readingIds.includes(item.id))||null;}
export async function loadSavedText(entry,{fetcher=fetch,cryptoAPI=globalThis.crypto}={}){
 const key=entry.file+':'+entry.sha256;
 if(inflight.has(key))return inflight.get(key);
 const pending=(async()=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
   const url=new URL('./data/research-evidence/reading-texts-3.43/'+entry.file,import.meta.url);
   const response=await fetcher(url.href,{signal:controller.signal});if(!response.ok)throw Error('Saved text unavailable');
   const bytes=await response.arrayBuffer();if(bytes.byteLength!==entry.bytes)throw Error('Saved text length mismatch');
   const hash=[...new Uint8Array(await cryptoAPI.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
   if(hash!==entry.sha256)throw Error('Saved text identity mismatch');
   const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   if(data.schemaVersion!==1||data.sourceId!==entry.sourceId||data.source?.sha256!==entry.source.sha256||!Array.isArray(data.blocks)||data.blocks.length!==entry.counts.blocks)throw Error('Invalid saved text');
   return data;
  }finally{clearTimeout(timer);}
 })();inflight.set(key,pending);try{return await pending;}catch(error){inflight.delete(key);throw error;}
}
const controllers=new WeakMap();
const identityFor=(item,entry)=>({readingId:item.id,sourceId:entry.sourceId,sourceSha256:entry.source.sha256,documentSha256:entry.sha256});
const sameIdentity=(a,b)=>a&&Object.keys(b).every(key=>a[key]===b[key]);
const contains=(parent,node)=>{for(let n=node;n;n=n.parentElement||n.parentNode)if(n===parent)return true;return false;};

// Keep a small set of original-text views alive across research-page renders.
// Detached views can be evicted; their lightweight, source-bound positions remain.
export function createSavedTextRegistry(doc,{load=loadSavedText,maxRetained=8}={}){
 const views=new Map(),states=new Map();let focused=null,dead=false;
 const capture=()=>{focused=doc.activeElement||null;for(const [key,panel]of views){const c=controllers.get(panel);if(panel.isConnected!==false){states.set(key,c.snapshot());c.detach();}}if(![...views.values()].some(panel=>contains(panel,focused)))focused=null;};
 return {
  get(item,lang){if(dead)return null;const entry=savedTextFor(item);if(!entry)return null;const key=JSON.stringify(identityFor(item,entry));let panel=views.get(key);if(panel){views.delete(key);controllers.get(panel).setLanguage(lang);}else panel=mountSavedText(doc,{item,lang,load,initialState:states.get(key)});views.set(key,panel);return panel;},
  capture,
  resume(){if(dead)return;for(const panel of views.values())if(panel.isConnected!==false)controllers.get(panel).resume();
   // This runs synchronously with replacement. Late fetches never restore focus.
   if(focused?.isConnected!==false&&[...views.values()].some(p=>p.isConnected!==false&&contains(p,focused))&&(!doc.activeElement||doc.activeElement===doc.body||doc.activeElement===focused))focused?.focus?.({preventScroll:true});focused=null;
   for(const [key,panel]of views){if(views.size<=maxRetained)break;if(panel.isConnected===false){const c=controllers.get(panel);states.set(key,c.snapshot());c.destroy();views.delete(key);}}
  },
  destroy(){dead=true;focused=null;for(const p of views.values())controllers.get(p).destroy();views.clear();states.clear();}
 };
}

export function mountSavedText(doc,{item,lang='bi',load=loadSavedText,initialState}={}){
 const entry=savedTextFor(item);if(!entry)return null;
 const identity=identityFor(item,entry),seed=sameIdentity(initialState,identity)?initialState:null;
 let language=lang,texts=new Map();
 const t=(zh,en)=>language==='en'?en:language==='bi'?zh+' · '+en:zh;
 const el=(tag,text='',cls='')=>{const n=doc.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
 const local=(tag,zh,en,cls='')=>{const n=el(tag,t(zh,en),cls);texts.set(n,{zh,en});return n;};
 const aria=(n,zh,en)=>{n.setAttribute?.('aria-label',t(zh,en));texts.set(n,{zh,en,attribute:'aria-label'});};
 const panel=el('details','','research-original'),summary=local('summary','阅读已保存原文','Read saved text'),content=el('div','','research-original-content');panel.append(summary,content);panel.open=seed?.open===true;
 let loading=false,loaded=false,dead=false,generation=0,positioned=false,body=null,select=null,provenance=null,nodes=new Map(),ordered=[],anchors=[];
 let position=seed?.position||null,selected=seed?.selected||'',provenanceOpen=seed?.provenanceOpen===true;
 const watchedAncestors=new Map(),expanded=()=>panel.open&&!panel.closest?.('details:not([open])');
 const frame=fn=>(doc.defaultView?.requestAnimationFrame||((fn)=>setTimeout(fn,0)))(fn);
 function watchAncestors(){const current=new Set();for(let node=panel.parentElement||panel.parentNode;node;node=node.parentElement||node.parentNode)if(node.tagName?.toLowerCase()==='details')current.add(node);
  for(const [node,handler]of watchedAncestors)if(!current.has(node)){node.removeEventListener?.('toggle',handler);watchedAncestors.delete(node);}
  for(const node of current)if(!watchedAncestors.has(node)){node.addEventListener('toggle',visibilityChanged);watchedAncestors.set(node,visibilityChanged);}
 }
 function rememberPosition(){
  if(!body||!positioned||!expanded()||panel.isConnected===false)return;
  const rect=body.getBoundingClientRect();if(rect.height===0||!ordered.length)return;
  const top=rect.top+body.clientTop+16;let lo=0,hi=ordered.length-1;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(ordered[mid].getBoundingClientRect().top<=top)lo=mid;else hi=mid-1;}
  const node=ordered[lo],offset=top-node.getBoundingClientRect().top;
  if(Number.isFinite(offset))position={blockId:node.dataset.sourceBlock,offset};
 }
 function snapshot(){rememberPosition();if(select)selected=select.value;if(provenance)provenanceOpen=provenance.open;return {...identity,open:panel.open,position:position?{...position}:null,selected,provenanceOpen};}
 function jump(id,{focus=true,offset=0}={}){const node=nodes.get(id);if(!body||!node)return false;const nodeRect=node.getBoundingClientRect(),bodyRect=body.getBoundingClientRect();const within=Number.isFinite(offset)?Math.max(-16,Math.min(offset,Number.isFinite(nodeRect.height)?Math.max(0,nodeRect.height-1):offset)):0;
  body.scrollTop+=nodeRect.top-bodyRect.top-body.clientTop-16+within;positioned=true;rememberPosition();if(focus)node.focus({preventScroll:true});return true;
 }
 function restorePosition(){const token=generation;frame(()=>{if(dead||token!==generation||!expanded()||panel.isConnected===false||!body)return;const restore=position&&nodes.has(position.blockId)?position:null,target=restore?.blockId||anchors[0]?.blockId||ordered[0]?.dataset.sourceBlock;
   if(target)jump(target,{focus:false,offset:restore?.offset||0});if(selected&&nodes.has(selected))select.value=selected;else if(target){select.value=anchors[0]?.blockId||target;selected=select.value;}
  });}
 function visibilityChanged(){if(dead)return;if(expanded())return start();generation++;loading=false;positioned=false;}
 function clear(){content.replaceChildren();texts=new Map([[summary,{zh:'阅读已保存原文',en:'Read saved text'}]]);}
 function render(data){
  clear();const tools=el('div','','research-original-tools'),label=el('label');select=el('select');label.append(local('span','原文目录','Contents'),select);aria(select,'原文目录','Contents');tools.append(label);
  content.append(local('p','按来源英文阅读；点击章节可定位到导读相关段落。','Read the source in English; use the section links to locate the passages discussed.','research-original-note'));
  const related=el('div','','research-original-related');body=el('div','','research-original-body');body.tabIndex=0;body.lang=data.language;aria(body,'原文正文','Source text');nodes=new Map();ordered=[];
  for(const block of data.blocks){const heading=block.type==='heading',level=heading?Math.min(6,4+(Number(block.level)||1)):0,node=el(heading?'h'+level:'p',block.text,[heading?'research-original-heading':'',block.role==='article'?'':'research-original-source-note'].filter(Boolean).join(' '));node.tabIndex=-1;node.dataset.sourceBlock=block.id;nodes.set(block.id,node);ordered.push(node);body.append(node);}
  for(const section of data.toc){const option=section.anchorBasis==='source-clause-number'?local('option','法条 '+section.clauseNumber,'Law '+section.clauseNumber):el('option',section.title);option.value=section.id;select.append(option);}select.addEventListener('change',()=>{selected=select.value;jump(selected);});
  anchors=data.readingAnchors.find(a=>a.readingId===item.id)?.anchors||[];
  for(const anchor of anchors){const button=anchor.anchorBasis==='source-clause-number'?local('button','法条 '+anchor.clauseNumber,'Law '+anchor.clauseNumber):el('button',anchor.sourceHeading);button.type='button';button.addEventListener('click',()=>{selected=anchor.blockId;select.value=selected;jump(selected);});related.append(button);}if(anchors.length)tools.append(related);content.append(tools,body);
  body.addEventListener('scroll',rememberPosition,{passive:true});
  provenance=el('details','','research-original-provenance');provenance.open=provenanceOpen;provenance.append(local('summary','文本整理与出处','Text preparation & provenance'),local('p','原文的段落、注释与书目信息保留；移除了网页导航，统一空白与换行。原始文件可通过上方链接下载。','Source paragraphs, notes and bibliography are retained. Site navigation is removed and whitespace normalized. The original file remains available above.'),el('p','SHA-256: '+data.source.sha256));content.append(provenance);restorePosition();
 }
 async function start(){
  watchAncestors();if(dead||!expanded()||loading||panel.isConnected===false)return;if(loaded){if(!positioned)restorePosition();return;}loading=true;const token=++generation;
  clear();const status=local('p','正在打开原文…','Opening saved text…');status.setAttribute?.('role','status');content.append(status);
  try{const data=await load(entry);if(dead||token!==generation||!expanded()||panel.isConnected===false)return;render(data);loaded=true;}
  catch{if(dead||token!==generation||!expanded()||panel.isConnected===false)return;clear();const error=local('p','原文暂未载入。可以重试，或下载上方的来源文件。','The saved text could not load. Retry or download the original file above.');error.setAttribute?.('role','status');const retry=local('button','重新读取','Retry');retry.type='button';retry.addEventListener('click',start);content.append(error,retry);}
  finally{if(token===generation)loading=false;}
 }
 panel.addEventListener('toggle',()=>{watchAncestors();return visibilityChanged();});
 controllers.set(panel,{
  snapshot,
  detach(){positioned=false;for(const [node,handler]of watchedAncestors)node.removeEventListener?.('toggle',handler);watchedAncestors.clear();panel.remove?.();},
  setLanguage(value){language=value;for(const [node,{zh,en,attribute}]of texts)if(attribute)node.setAttribute?.(attribute,t(zh,en));else node.textContent=t(zh,en);},
  resume(){watchAncestors();if(loaded&&expanded())restorePosition();else void start();},
  destroy(){dead=true;generation++;for(const [node,handler]of watchedAncestors)node.removeEventListener?.('toggle',handler);watchedAncestors.clear();}
 });return panel;
}
