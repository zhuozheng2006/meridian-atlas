import {openResearchView,parseResearchState,writeResearchState} from './research-view.js?v=3.54.0-440274174472';
const VIEWS=new Set(['atlas','polities','stories','library','sources','research']);
const TAB_LABELS={atlas:['地图','Atlas'],polities:['文明','Polities'],stories:['专题','Journeys'],library:['年表','Chronicle'],sources:['资料','Sources']};
// This shell owns only a cold research visit. The normal app takes over once a
// non-research route is actually requested and its module is ready.
export function mountResearchShell({doc=document,win=window,loadApplication,openResearch=openResearchView}={}){
 const $=s=>doc.querySelector(s),$$=s=>[...doc.querySelectorAll(s)],host=$('#contentView');
 let params=new URLSearchParams(win.location.hash.slice(1)),snapshot=parseResearchState(params),language=['zh','en','bi'].includes(params.get('lang'))?params.get('lang'):'bi';
 let reader=null,dead=false,sequence=0,currentView='research',failure=false;const unbind=[];
 const t=(zh,en)=>language==='en'?en:language==='bi'?zh+' · '+en:zh;
 function own(node,event,handler){if(!node)return;const key='on'+event,previous=node[key];node[key]=handler;unbind.push(()=>{if(node[key]===handler)node[key]=previous;});}
 function listen(target,event,handler){target.addEventListener(event,handler);unbind.push(()=>target.removeEventListener(event,handler));}
 function remember(){if(reader)snapshot=reader.getSnapshot();}
 function save(){params=new URLSearchParams(win.location.hash.slice(1));params.set('view',currentView);params.set('lang',language);writeResearchState(params,snapshot);win.history.replaceState(null,'','#'+params);}
 function textNode(tag,text){const node=doc.createElement(tag);node.textContent=text;return node;}
 function paintHeader(){
  doc.documentElement.lang=language==='en'?'en':'zh-CN';$('#language').value=language;
  for(const node of $$('#tabs button')){const labels=TAB_LABELS[node.dataset.view];node.replaceChildren(textNode('span',language==='en'?labels[1]:labels[0]));if(language==='bi'){const second=textNode('span',' '+labels[1]);second.className='nav-en';node.append(second);}node.classList.toggle('active',node.dataset.view===(currentView==='research'?'sources':currentView));}
  for(const id of ['atlasView','timeline','browseBtn','compareBtn'])$('#'+id).hidden=true;host.hidden=false;
  const skip=$('.skip-link');skip.href='#contentView';skip.textContent=t('跳到正文','Jump to content');
  $('#helpBtn').setAttribute('aria-label',t('帮助','Help'));$('.dialog-close').setAttribute('aria-label',t('关闭','Close'));
  const help=$('#helpContent');help.replaceChildren(textNode('h2',t('阅读社会与制度资料','Reading societies and institutions')));
  const list=doc.createElement('ol');for(const pair of [
   ['先选择资料版本与研究阶段，再按领域、变量和文字查找。手机上可以展开“筛选与查找”。','Choose an archive version and research phase, then filter by field, variable and text. On mobile, expand Filters & search.'],
   ['“跨阶段检索”读取所选领域的来源记录。原始字段、行号和下载保留来源的编码。','Search across phases reads source records in the chosen field. Original fields, row numbers and downloads retain the source coding.'],
   ['资料版本各自保留分期与名称；已核对的阶段可通过明确的版本对照按钮切换。','Each archive keeps its own phases and names. Reviewed phase pairs offer an explicit version comparison.'],
   ['上方导航可以前往地图、文明、专题、年表与资料。返回资料页后可以再次打开研究阅读器。','Use the navigation for Atlas, Polities, Journeys, Chronicle and Sources. Reopen the research reader from Sources.']])list.append(textNode('li',t(...pair)));help.append(list,textNode('p',t('⌘ / Ctrl + K 聚焦查找；方向键用于当前输入框或选择框。','⌘ / Ctrl + K focuses search; arrow keys keep their normal input and select behavior.')));
 }
 function pending(){
  paintHeader();host.replaceChildren();const status=textNode('p',failure?t('页面暂未打开，请重试，或继续阅读研究资料。','This page could not open. Retry or continue reading.'):t('正在打开所选页面…','Opening the selected page…'));status.setAttribute('role','status');host.append(status);
  if(failure){const retry=textNode('button',t('重新读取','Retry'));retry.type='button';retry.onclick=()=>navigate(currentView);host.append(retry);}
  const back=textNode('button',t('继续阅读研究资料','Continue reading research'));back.type='button';back.onclick=()=>navigate('research');host.append(back);
 }
 function mountReader(){
  paintHeader();const token=sequence;
  reader=openResearch(host,{lang:language,initialState:snapshot,onStateChange:value=>{if(dead||token!==sequence)return;snapshot=value;save();},onBack:()=>navigate('sources')});
 }
 function detach(){remember();reader?.destroy();reader=null;for(const remove of unbind.splice(0))remove();}
 function handoffFailed(view){
  // The application may already own some listeners. Recover through a clean
  // document load instead of remounting this shell over partial application UI.
  const current=new URLSearchParams(win.location.hash.slice(1));if((current.get('view')||'atlas')!==view)return;failure=true;
  for(const id of ['atlasView','timeline','browseBtn','compareBtn'])$('#'+id).hidden=true;host.hidden=false;host.replaceChildren();
  const status=textNode('p',t('页面初始化未能完成，请重新打开。','This page could not finish starting. Please reload.'));status.setAttribute('role','alert');host.append(status);
  const retry=textNode('button',t('重新打开页面','Reload this page'));retry.type='button';retry.onclick=()=>win.location.reload();host.append(retry);
  const back=textNode('button',t('返回研究资料','Return to research'));back.type='button';back.onclick=()=>{const p=new URLSearchParams(win.location.hash.slice(1));p.set('view','research');writeResearchState(p,snapshot);win.history.replaceState(null,'','#'+p);win.location.reload();};host.append(back);
 }
 async function navigate(view){
  if(dead||!VIEWS.has(view))return false;let handedOff=false;const token=++sequence;remember();reader?.destroy();reader=null;currentView=view;failure=false;save();
  if(view==='research'){mountReader();return true;}pending();
  try{
   const module=await loadApplication();if(dead||token!==sequence||currentView==='research')return false;
   if(typeof module.startApplication!=='function')throw Error('Application entry unavailable');
   // No event can interleave this synchronous ownership transfer. Importing the
   // app does not render; its controlled start reads the latest complete hash.
   detach();dead=true;handedOff=true;const app=module.startApplication();await app.ready;return true;
  }catch(error){if(token!==sequence)return false;if(handedOff){handoffFailed(view);return false;}if(dead)return false;failure=true;pending();return false;}
 }
 for(const node of $$('#tabs button'))own(node,'click',()=>navigate(node.dataset.view));
 own($('#language'),'change',event=>{language=event.target.value;if(!['zh','en','bi'].includes(language))language='bi';save();paintHeader();if(reader)reader.setLanguage(language);else pending();});
 own($('#helpBtn'),'click',()=>$('#helpDialog').showModal());own($('.dialog-close'),'click',()=>$('#helpDialog').close());
 own($('.skip-link'),'click',event=>{event.preventDefault();host.focus();});
 listen(doc,'keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key?.toLowerCase()==='k'&&!$('#helpDialog').open){event.preventDefault();const input=$('#contentView .research-reading-library[open] input[type="search"]')||$('#contentView .research-field-query input:not(:disabled)')||$('#contentView .research-field-polity-search input');input?.focus();input?.select();}});
 listen(win,'hashchange',()=>{if(win.location.hash.includes('='))win.location.reload();});
 mountReader();return {ready:reader.ready,navigate,getSnapshot:()=>reader?.getSnapshot()||snapshot,getState:()=>({view:currentView,language,pending:!reader&&!failure&&!dead,failed:failure,destroyed:dead}),destroy(){if(dead)return;dead=true;sequence++;detach();}};
}
