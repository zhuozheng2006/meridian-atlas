import {READING_CATALOG} from './research-reading-data.js?v=3.58.1-c7e43da44e1e';
import {label} from './polaris-adapter.js?v=3.58.1-c7e43da44e1e';
import {POLARIS_VARIABLES} from './polaris-vocabulary.js?v=3.58.1-c7e43da44e1e';
import {polarisPolityName,polarisPolitySearchText} from './polaris-polity-names.js?v=3.58.1-c7e43da44e1e';

const PAGE_SIZE=6;
export function readingForId(id,phaseId,catalog=READING_CATALOG){
 return catalog.cards.find(card=>card.id===id&&(!phaseId||card.phaseId===phaseId))||null;
}
export function readingRows(rows,card){
 const ids=new Set(card.targetRowIds);
 return rows.filter(row=>row.raw.polity_id===card.phaseId&&ids.has(row.id));
}
export function searchReadings(query='',phaseId='',phases=new Map(),catalog=READING_CATALOG){
 const words=query.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
 return catalog.cards.filter(card=>{
  if(phaseId&&card.phaseId!==phaseId)return false;
  const phase=phases.get(card.phaseId),terms=[card.id,card.phaseId,card.titleZh,card.titleEn,card.summaryZh,card.summaryEn,...card.authors,card.year===null?'':String(card.year),phase?polarisPolitySearchText(phase):'',...card.variableIds.flatMap(id=>[id,POLARIS_VARIABLES[id]?.zh,POLARIS_VARIABLES[id]?.en])].filter(Boolean).join(' ').normalize('NFKC').toLocaleLowerCase();
  return words.every(word=>terms.includes(word));
 });
}
export function mountReadingLibrary(doc,{lang='bi',phases=new Map(),initialState={},onSelect,catalog=READING_CATALOG,id='reading-library'}={}){
 const state={open:!!initialState.open,query:String(initialState.query||'').slice(0,160),phaseId:initialState.phaseId||'',page:initialState.page||0};
 const t=(zh,en)=>label({zh,en},lang),el=(tag,text='',cls='')=>{const n=doc.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
 const button=(text,action)=>{const b=el('button',text);b.type='button';b.addEventListener('click',action);return b;};
 const panel=el('details','','research-reading-library');panel.open=state.open;panel.addEventListener('toggle',()=>{state.open=panel.open;});
 panel.append(el('summary',t('原典书架','Reading library')));
 const phaseIds=[...new Set(catalog.cards.map(c=>c.phaseId))];
 panel.append(el('p',t(`${catalog.cards.length} 条导读 · ${phaseIds.length} 个研究阶段 · ${new Set(catalog.cards.map(c=>c.sourceId)).size} 份来源。由问题进入原文，再对照相关记录。`,`${catalog.cards.length} reading leads · ${phaseIds.length} research phases · ${new Set(catalog.cards.map(c=>c.sourceId)).size} sources. Start with a question, read the source, and compare the linked records.`),'research-reading-note'));
 const controls=el('div','','research-library-controls');
 function field(title,input,key){const wrapper=el('label'),caption=el('span',title);input.id=id+'-'+key;caption.id=input.id+'-label';input.setAttribute('aria-labelledby',caption.id);wrapper.htmlFor=input.id;wrapper.append(caption,input);return wrapper;}
 const query=el('input');query.type='search';query.maxLength=160;query.value=state.query;query.placeholder=t('如：马里、人口、法律、Angkor','Try Mali, population, law, Angkor');
 const select=el('select');const option=(value,title)=>{const n=el('option',title);n.value=value;select.append(n);};
 controls.append(field(t('查找原典与研究','Search texts & research'),query,'query'),field(t('导读所属阶段','Phase in this collection'),select,'phase'));panel.append(controls);
 const status=el('p','','research-library-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');const results=el('div','','research-library-grid'),nav=el('nav','','research-pagination');nav.setAttribute('aria-label',t('导读分页','Reading pagination'));panel.append(status,results,nav);
 function render(){
  const cards=searchReadings(state.query,state.phaseId,phases,catalog),pages=Math.max(1,Math.ceil(cards.length/PAGE_SIZE));state.page=Math.max(0,Math.min(state.page,pages-1));results.replaceChildren();nav.replaceChildren();
  status.textContent=t(`${cards.length} 条导读 · 第 ${state.page+1}/${pages} 页`,`${cards.length} reading leads · Page ${state.page+1}/${pages}`);
  for(const c of cards.slice(state.page*PAGE_SIZE,(state.page+1)*PAGE_SIZE)){
   const card=el('article','','research-library-card');card.dataset.readingId=c.id;const phase=phases.get(c.phaseId);
   card.append(el('p',phase?polarisPolityName(phase,lang):c.phaseId,'research-library-phase'),el('h3',t(c.titleZh,c.titleEn)),el('p',t(c.summaryZh,c.summaryEn)));
   const action=button(t(`导读与 ${c.targetRowIds.length} 条记录`,`Read with ${c.targetRowIds.length} linked ${c.targetRowIds.length===1?'record':'records'}`),()=>onSelect?.(c.id));action.disabled=!phase;card.append(action);results.append(card);
  }
  if(!cards.length){results.append(el('p',t('没有匹配的导读。试试其他词，或查看全部。','No reading leads match. Try another term or browse the collection.')));nav.append(button(t('查看全部导读','Browse all reading leads'),()=>{state.query='';state.phaseId='';state.page=0;query.value='';select.value='';render();}));}
  if(pages>1){const previous=button(t('上一页','Previous'),()=>{state.page--;render();}),next=button(t('下一页','Next'),()=>{state.page++;render();});previous.disabled=state.page===0;next.disabled=state.page===pages-1;nav.append(previous,el('span',`${state.page+1} / ${pages}`),next);}
 }
 let composing=false;const search=()=>{state.query=query.value.slice(0,160);state.page=0;render();};query.addEventListener('compositionstart',()=>{composing=true;});query.addEventListener('compositionend',()=>{composing=false;search();});query.addEventListener('input',event=>{if(!composing&&!event.isComposing)search();});select.addEventListener('change',()=>{state.phaseId=select.value;state.page=0;render();});
 function setPhases(value){phases=value;select.replaceChildren();option('',t('全部导读阶段','All reading phases'));for(const phaseId of phaseIds){const p=phases.get(phaseId);if(p)option(phaseId,polarisPolityName(p,lang));}if(!phaseIds.includes(state.phaseId))state.phaseId='';select.value=state.phaseId;render();}
 setPhases(phases);return {element:panel,setPhases,focusControl(key){const target=key==='query'?query:key==='phase'?select:null;target?.focus({preventScroll:true});return target;},getSnapshot:()=>({...state,open:panel.open})};
}
