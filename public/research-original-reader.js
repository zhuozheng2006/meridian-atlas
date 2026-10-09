import {SAVED_TEXTS} from './research-original-text-data.js?v=3.46.0-dce023e2071a';
const inflight=new Map();
export function savedTextFor(item){return SAVED_TEXTS.documents.find(entry=>entry.sourceId===item.sourceId&&entry.source.sha256===item.sourceSha256&&entry.readingIds.includes(item.id))||null;}
export async function loadSavedText(entry,{fetcher=fetch,cryptoAPI=globalThis.crypto}={}){
 const collection=entry.collection||'reading-texts-3.43';
 if(!/^(reading-texts-3\.43|readings-3\.(44|45)\/offline)$/.test(collection))throw Error('Unknown saved-text collection');
 const key=collection+':'+entry.file+':'+entry.sha256;
 if(inflight.has(key))return inflight.get(key);
 const pending=(async()=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
   const url=new URL('./data/research-evidence/'+collection+'/'+entry.file,import.meta.url);
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
 let layout=null,resizeObserver=null,observing=false,pendingRestore=null,writtenScrollTop=null;
 const visible=()=>!dead&&expanded()&&panel.isConnected!==false&&body;
 const dimensions=()=>{const rect=body.getBoundingClientRect();return {width:rect.width,height:rect.height};};
 const changed=(size)=>layout&&(size.width!==layout.width||size.height!==layout.height);
 function cancelRestore(){pendingRestore=null;}
 // Text nodes are created from one source block each. A character anchor keeps
 // the same line in view when wrapping changes, including within long paragraphs.
 function characterRect(node,index){const text=node.firstChild;if(!text||text.nodeType!==3||!doc.createRange||!Number.isInteger(index)||index<0||index>=text.length)return null;const range=doc.createRange();range.setStart(text,index);range.setEnd(text,index+1);const rect=range.getBoundingClientRect();return rect.height>0?rect:null;}
 function textPosition(node,top){const text=node.firstChild;if(!text||text.nodeType!==3||!text.length||!doc.createRange)return null;let lo=0,hi=text.length-1;
  while(lo<hi){const mid=Math.floor((lo+hi)/2),rect=characterRect(node,mid);if(!rect)return null;if(rect.bottom<=top)lo=mid+1;else hi=mid;}
  const rect=characterRect(node,lo);return rect?{textOffset:lo,textOffsetY:top-rect.top}:null;
 }
 function observeLayout(){if(observing||!body)return;observing=true;const Observer=doc.defaultView?.ResizeObserver;if(Observer){resizeObserver??=new Observer(layoutChanged);resizeObserver.observe(body);}else doc.defaultView?.addEventListener?.('resize',layoutChanged);}
 function stopObserving(){observing=false;resizeObserver?.disconnect();doc.defaultView?.removeEventListener?.('resize',layoutChanged);cancelRestore();}
 function layoutChanged(){if(!visible()||!positioned)return;const size=dimensions();if(size.height>0&&changed(size))restorePosition({reflow:true});}
 function userScrollIntent(event){if(event.type==='keydown'&&!['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' ','Spacebar'].includes(event.key))return;if(event.defaultPrevented||!visible())return;
  // A deliberate gesture wins over a pending automatic restore. Record using
  // the new layout, then let the browser perform its normal scrolling action.
  cancelRestore();writtenScrollTop=null;layout=dimensions();positioned=true;rememberPosition();observeLayout();
 }
 function watchAncestors(){const current=new Set();for(let node=panel.parentElement||panel.parentNode;node;node=node.parentElement||node.parentNode)if(node.tagName?.toLowerCase()==='details')current.add(node);
  for(const [node,handler]of watchedAncestors)if(!current.has(node)){node.removeEventListener?.('toggle',handler);watchedAncestors.delete(node);}
  for(const node of current)if(!watchedAncestors.has(node)){node.addEventListener('toggle',visibilityChanged);watchedAncestors.set(node,visibilityChanged);}
 }
 function rememberPosition(){
  if(!body||!positioned||!expanded()||panel.isConnected===false)return;
  const rect=body.getBoundingClientRect();if(rect.height===0||!ordered.length)return;
  if(changed(rect)){restorePosition({reflow:true});return;}layout={width:rect.width,height:rect.height};
  // Keep the exact text anchor through repeated resizes. The new line can start
  // earlier in the paragraph; recapturing our own scroll would drift backwards.
  if(writtenScrollTop!==null&&body.scrollTop===writtenScrollTop)return;writtenScrollTop=null;
  const top=rect.top+body.clientTop+16;let lo=0,hi=ordered.length-1;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(ordered[mid].getBoundingClientRect().top<=top)lo=mid;else hi=mid-1;}
  const node=ordered[lo],offset=top-node.getBoundingClientRect().top;
  const nodeRect=node.getBoundingClientRect();
  if(Number.isFinite(offset))position={blockId:node.dataset.sourceBlock,offset,relativeOffset:nodeRect.height>0?offset/nodeRect.height:0,...(offset>=0&&offset<nodeRect.height?textPosition(node,top):null)};
 }
 function snapshot(){rememberPosition();if(select)selected=select.value;if(provenance)provenanceOpen=provenance.open;return {...identity,open:panel.open,position:position?{...position}:null,selected,provenanceOpen};}
 function jump(id,{focus=true,offset=0,textOffset,textOffsetY,relativeOffset,reflow=false}={}){const node=nodes.get(id);if(!visible()||!node)return false;cancelRestore();writtenScrollTop=null;const nodeRect=node.getBoundingClientRect(),bodyRect=body.getBoundingClientRect(),textRect=characterRect(node,textOffset);
  if(reflow&&!textRect&&Number.isFinite(relativeOffset))offset=relativeOffset*nodeRect.height;
  const within=Number.isFinite(offset)?Math.max(-16,Math.min(offset,Number.isFinite(nodeRect.height)?Math.max(0,nodeRect.height-1):offset)):0;
  const target=textRect&&Number.isFinite(textOffsetY)?textRect.top+textOffsetY:nodeRect.top+within;
  const requested=body.scrollTop+target-bodyRect.top-body.clientTop-16;
  layout={width:bodyRect.width,height:bodyRect.height};body.scrollTop=requested;positioned=true;
  if(textRect&&Number.isFinite(textOffsetY)&&Math.abs(body.scrollTop-requested)<1)position={blockId:id,offset:target-nodeRect.top,relativeOffset:nodeRect.height>0?(target-nodeRect.top)/nodeRect.height:0,textOffset,textOffsetY};else rememberPosition();writtenScrollTop=body.scrollTop;observeLayout();if(focus)node.focus({preventScroll:true});return true;
 }
 function restorePosition({reflow=false}={}){if(pendingRestore)return;const task={generation,position:position?{...position}:null};pendingRestore=task;positioned=false;frame(()=>{if(pendingRestore!==task)return;pendingRestore=null;if(!visible()||task.generation!==generation)return;const restore=task.position&&nodes.has(task.position.blockId)?task.position:null,target=restore?.blockId||anchors[0]?.blockId||ordered[0]?.dataset.sourceBlock;
   if(target)jump(target,{...restore,focus:false,reflow});if(selected&&nodes.has(selected))select.value=selected;else if(target){select.value=anchors[0]?.blockId||target;selected=select.value;}observeLayout();
  });}
 function visibilityChanged(){if(dead)return;if(expanded())return start();generation++;loading=false;positioned=false;stopObserving();}
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
  for(const type of ['wheel','touchstart','pointerdown','keydown'])body.addEventListener(type,userScrollIntent,{passive:true});
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
  detach(){positioned=false;stopObserving();for(const [node,handler]of watchedAncestors)node.removeEventListener?.('toggle',handler);watchedAncestors.clear();panel.remove?.();},
  setLanguage(value){language=value;for(const [node,{zh,en,attribute}]of texts)if(attribute)node.setAttribute?.(attribute,t(zh,en));else node.textContent=t(zh,en);},
  resume(){watchAncestors();if(loaded&&expanded())restorePosition();else void start();},
  destroy(){dead=true;generation++;stopObserving();for(const [node,handler]of watchedAncestors)node.removeEventListener?.('toggle',handler);watchedAncestors.clear();}
 });return panel;
}
