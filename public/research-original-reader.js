import {SAVED_TEXTS} from './research-original-text-data.js?v=3.42.0-6de1d2485233';
const inflight=new Map();
export function savedTextFor(item){return SAVED_TEXTS.documents.find(entry=>entry.sourceId===item.sourceId&&entry.source.sha256===item.sourceSha256&&entry.readingIds.includes(item.id))||null;}
export async function loadSavedText(entry,{fetcher=fetch,cryptoAPI=globalThis.crypto}={}){
 const key=entry.file+':'+entry.sha256;
 if(inflight.has(key))return inflight.get(key);
 const pending=(async()=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
   const url=new URL('./data/research-evidence/reading-texts-3.42/'+entry.file,import.meta.url);
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
export function mountSavedText(doc,{item,lang='bi',load=loadSavedText}={}){
 const entry=savedTextFor(item);if(!entry)return null;
 const t=(zh,en)=>lang==='en'?en:lang==='bi'?zh+' · '+en:zh;
 const el=(tag,text='',cls='')=>{const n=doc.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
 const panel=el('details','','research-original'),summary=el('summary',t('阅读已保存原文','Read saved text'));
 const content=el('div','','research-original-content');panel.append(summary,content);
 let loading=false,loaded=false,generation=0,positioned=false,initialPosition=()=>{};
 const watchedAncestors=new WeakSet();
 const expanded=()=>panel.open&&!panel.closest?.('details:not([open])');
 function visibilityChanged(){if(expanded())return start();generation++;loading=false;}
 function watchAncestors(){for(let node=panel.parentElement||panel.parentNode;node;node=node.parentElement||node.parentNode){if(node.tagName?.toLowerCase()==='details'&&!watchedAncestors.has(node)){watchedAncestors.add(node);node.addEventListener('toggle',visibilityChanged);}}}
 function jump(body,nodes,id,{focus=true}={}){const node=nodes.get(id);if(!node)return;body.scrollTop+=node.getBoundingClientRect().top-body.getBoundingClientRect().top-body.clientTop-16;if(focus)node.focus({preventScroll:true});}
 function render(data){
  content.replaceChildren();const tools=el('div','','research-original-tools'),label=el('label',t('原文目录','Contents'));
  const select=el('select');select.setAttribute?.('aria-label',t('原文目录','Contents'));label.append(select);tools.append(label);
  const note=el('p',t('按来源英文阅读；点击章节可定位到导读相关段落。','Read the source in English; use the section links to locate the passages discussed.'),'research-original-note');content.append(note);
  const related=el('div','','research-original-related'),body=el('div','','research-original-body');body.tabIndex=0;body.lang=data.language;
  body.setAttribute?.('aria-label',t('原文正文','Source text'));const nodes=new Map();
  for(const block of data.blocks){const node=el(block.type==='heading'?'h3':'p',block.text,block.role==='article'?'':'research-original-source-note');node.tabIndex=-1;node.dataset.sourceBlock=block.id;nodes.set(block.id,node);body.append(node);}
  for(const section of data.toc){const option=el('option',section.title);option.value=section.id;select.append(option);}
  select.addEventListener('change',()=>jump(body,nodes,select.value));
  const anchors=data.readingAnchors.find(a=>a.readingId===item.id)?.anchors||[];
  for(const anchor of anchors){const button=el('button',anchor.sourceHeading);button.type='button';button.addEventListener('click',()=>{select.value=anchor.blockId;jump(body,nodes,anchor.blockId);});related.append(button);}
  if(anchors.length)tools.append(related);content.append(tools,body);
  const provenance=el('details','','research-original-provenance');provenance.append(el('summary',t('文本整理与出处','Text preparation & provenance')),el('p',t('原文的段落、注释与书目信息保留；移除了网页导航，统一空白与换行。原始文件可通过上方链接下载。','Source paragraphs, notes and bibliography are retained. Site navigation is removed and whitespace normalized. The original file remains available above.')),el('p','SHA-256: '+data.source.sha256));content.append(provenance);
  // Layout is available after this frame. Guard a closed/replaced reader.
  const frame=doc.defaultView?.requestAnimationFrame||((fn)=>setTimeout(fn,0));
  initialPosition=()=>{if(positioned)return;const token=generation;frame(()=>{if(positioned||token!==generation||!expanded()||panel.isConnected===false)return;const target=anchors[0]?.blockId||data.toc[0]?.id;if(target){select.value=target;jump(body,nodes,target,{focus:false});}positioned=true;});};initialPosition();
 }
 async function start(){
  watchAncestors();if(!expanded()||loading||panel.isConnected===false)return;if(loaded){initialPosition();return;}loading=true;const token=++generation;
  const status=el('p',t('正在打开原文…','Opening saved text…'));status.setAttribute?.('role','status');content.replaceChildren(status);
  try{const data=await load(entry);if(token!==generation||!expanded()||panel.isConnected===false)return;render(data);loaded=true;}
  catch{if(token!==generation||panel.isConnected===false)return;const error=el('p',t('原文暂未载入。可以重试，或下载上方的来源文件。','The saved text could not load. Retry or download the original file above.'));error.setAttribute?.('role','status');const retry=el('button',t('重新读取','Retry'));retry.type='button';retry.addEventListener('click',start);content.replaceChildren(error,retry);}
  finally{if(token===generation)loading=false;}
 }
 panel.addEventListener('toggle',()=>{watchAncestors();return visibilityChanged();});return panel;
}
