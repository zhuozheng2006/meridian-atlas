import {READING_CATALOG} from './research-reading-data.js?v=3.56.0-2d8a9f8e737a';
import {label,variableOptions} from './polaris-adapter.js?v=3.56.0-2d8a9f8e737a';
import {mountSavedText} from './research-original-reader.js?v=3.56.0-2d8a9f8e737a';
const RELATIONS=Object.freeze({'direct-evidence':{zh:'原典与史料',en:'Primary text & evidence'},'comparative-reading':{zh:'比较阅读',en:'Comparative reading'},'earlier-coded-version':{zh:'早期编码资料',en:'Earlier coded source'}});
export function readingsForPhase(phaseId,{domain='all',variable='all'}={},catalog=READING_CATALOG){
 const allowed=new Set(variableOptions(domain).map(v=>v.id));return catalog.cards.filter(c=>c.phaseId===phaseId&&c.variableIds.some(id=>allowed.has(id)&&(variable==='all'||id===variable)));
}
export function readingLocator(locator={},lang='bi'){
 const t=(zh,en)=>label({zh,en},lang),parts=[];
 if(locator.pdfPages?.length)parts.push(t('PDF 第 '+locator.pdfPages.join('、')+' 页','PDF pages '+locator.pdfPages.join(', ')));
 if(locator.printedPages?.length)parts.push(t('书页 '+locator.printedPages.join('、'),'printed pages '+locator.printedPages.join(', ')));
 if(locator.csvRecordNumberWithHeader)parts.push(t('CSV 第 '+locator.csvRecordNumberWithHeader+' 条记录（含表头）','CSV record '+locator.csvRecordNumberWithHeader+' (including header)'));
 if(locator.table)parts.push(locator.table);if(locator.rows?.length)parts.push(t('表中行：','Table rows: ')+locator.rows.join('; '));if(locator.htmlSection)parts.push(locator.htmlSection);if(locator.section)parts.push(locator.section);return parts.join(' · ');
}
export function readingByline(authors,year,lang='bi'){
 const names=authors.length>3?authors.slice(0,3).join(' · ')+label({zh:' 等',en:' et al.'},lang):authors.join(' · ');
 return year===null||year===undefined||year===''?names:names+' · '+year;
}
export function mountReadingGuide(doc,{phaseId,filters={},lang='bi',open=false,onToggle,onSelectReading,originalReaders,catalog=READING_CATALOG}={}){
 const cards=readingsForPhase(phaseId,filters,catalog).filter(card=>!filters.readingId||card.id===filters.readingId);if(!cards.length)return null;
 const t=(zh,en)=>label({zh,en},lang),el=(tag,text='',className='')=>{const n=doc.createElement(tag);n.textContent=text;if(className)n.className=className;return n;};
 const link=(text,url)=>{const node=el('a',text);const value=new URL(url,import.meta.url);if(!['https:','http:','file:'].includes(value.protocol))throw Error('Invalid reading source URL');node.href=value.href;node.target='_blank';node.rel='noopener noreferrer';return node;};
 const panel=el('details','','research-readings');panel.open=open;panel.addEventListener('toggle',()=>onToggle?.(panel.open));panel.append(el('summary',t(`相关研究与原典 · ${cards.length} 条阅读线索`,`Research & primary texts · ${cards.length} reading ${cards.length===1?'lead':'leads'}`)));
 panel.append(el('p',t('循着篇章、法条与页码查阅原文，对照不同年代与统计口径。','Follow chapters, clauses and page references to compare dates, coverage and methods.'),'research-reading-note'));
 const list=el('div','','research-reading-list');for(const item of cards){
  const card=el('article','','research-reading-card');card.dataset.readingId=item.id;card.append(el('span',label(RELATIONS[item.relation],lang),'research-reading-kind'),el('h4',t(item.titleZh,item.titleEn)));
  card.append(el('p',readingByline(item.authors,item.year,lang),'research-reading-byline'),el('p',t(item.summaryZh,item.summaryEn)),el('p',t(item.scopeZh,item.scopeEn),'research-reading-scope'));
  card.append(el('p',readingLocator(item.locator,lang),'research-reading-locator'));
  const actions=el('div','','research-source-links');if(item.localURL){const local=new URL(item.localURL,import.meta.url);if(item.locator.pdfPages?.length)local.hash='page='+item.locator.pdfPages[0];actions.append(link(item.localURL.endsWith('.pdf')?t('阅读已保存原文','Read saved original'):t('下载来源文件','Download source file'),local.href));}
  actions.append(link(t('来源网站','Source website'),item.landingURL||item.url));if(item.doi)actions.append(link('DOI','https://doi.org/'+item.doi));if(onSelectReading&&!filters.readingId){const related=el('button',t(`查看关联的 ${item.targetRowIds.length} 条记录`,`View ${item.targetRowIds.length} linked records`));related.type='button';related.addEventListener('click',()=>onSelectReading(item.id));actions.append(related);}card.append(actions);
  const saved=originalReaders?originalReaders.get(item,lang):mountSavedText(doc,{item,lang});if(saved)card.append(saved);
  const provenance=el('details','','research-reading-provenance');provenance.append(el('summary',t('版本与核对信息','Version & review details')),el('p',t('作者与编译者：','Authors, translators & editors: ')+item.authors.join(' · ')),el('p',t('来源版本：','Source version: ')+item.sourceSnapshot),el('p','SHA-256: '+item.sourceSha256),el('p',t('相关工作簿原行：','Related workbook rows: ')+item.targetRowIds.map(id=>id.slice(id.indexOf(':',7)+1)).join('; ')));
  if(item.sourceRecordId)provenance.append(el('p',item.sourceRecordId));if(item.conflicts?.length){const differences=el('div','','research-reading-differences');differences.append(el('h5',t('对读时留意','Points to compare')));for(const conflict of item.conflicts){differences.append(el('p',t(conflict.noteZh,conflict.noteEn)));if(conflict.kind==='code-difference')differences.append(el('p',t('旧版','Earlier version')+' '+conflict.olderField+': '+conflict.olderValue+' · Polaris '+conflict.polarisField+': '+conflict.polarisValue));}provenance.append(differences);}card.append(provenance);list.append(card);
 }
 const method=el('details','','research-reading-method');method.append(el('summary',t('关于这些阅读线索','About these reading leads')),el('p',t(catalog.overviewNoteZh||catalog.policyZh,catalog.overviewNoteEn||catalog.policyEn)));panel.append(list,method);return panel;
}
