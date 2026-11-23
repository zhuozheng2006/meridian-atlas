// HALC v15 codebook: Polygons / URBAN and KM2_LANDSC_0,1,2,3,4,7,8,9.
// This reader uses source attributes, not map geometry or Landscape-layer fids.
export const HALC_LANDSCAPE_CLASSES=Object.freeze([
 {code:0,zh:'可耕用地',en:'Cultivatable land',detailZh:'居住、农业等用途',detailEn:'Including residential and agricultural land',color:'#a6b38d'},
 {code:1,zh:'沙丘、沙地',en:'Dunes & sandy soils',color:'#d3bd82'},
 {code:2,zh:'滩涂、沼泽',en:'Mud flats & marshes',color:'#93aaa0'},
 {code:3,zh:'林地',en:'Forests',color:'#688d72'},
 {code:4,zh:'荒原',en:'Heath & moorland',color:'#a997a2'},
 {code:7,zh:'淡水或沿海水域',en:'Fresh or coastal water',detailZh:'小型船舶可通航',detailEn:'Navigable for small vessels',color:'#86acb7'},
 {code:8,zh:'淡水水域',en:'Fresh water',detailZh:'较大船舶可通航',detailEn:'Navigable for larger vessels',color:'#588b9f'},
 {code:9,zh:'外海',en:'Open sea',detailZh:'较大船舶可通航',detailEn:'Navigable for larger vessels',color:'#3c6f8b'}
].map(Object.freeze));

export const HALC_URBAN_CODES=Object.freeze({
 0:Object.freeze({zh:'无城镇地位',en:'No urban status',detailZh:'来源将这条地方记录归为无城镇地位。',detailEn:'The source classifies this local unit as having no urban status.'}),
 1:Object.freeze({zh:'具有特许地位的城镇',en:'Privileged urban status',detailZh:'地域范围有明确界限，如城墙或护城河。',detailEn:'The territory is demarcated, for example by an enceinte or moat.'}),
 2:Object.freeze({zh:'具有特许地位的城镇',en:'Privileged urban status',detailZh:'地域范围没有明确界限或界限不清，以建成区范围估计。',detailEn:'The territory is not demarcated or its boundary is unclear; the built-up area is estimated.'}),
 3:Object.freeze({zh:'无特许地位的城镇',en:'Non-privileged urban status',detailZh:'地域范围有明确界限，如城墙或护城河。',detailEn:'The territory is demarcated, for example by an enceinte or moat.'}),
 4:Object.freeze({zh:'无特许地位的城镇',en:'Non-privileged urban status',detailZh:'地域范围没有明确界限或界限不清，以建成区范围估计。',detailEn:'The territory is not demarcated or its boundary is unclear; the built-up area is estimated.'}),
 5:Object.freeze({zh:'保有乡村形态的特许聚落',en:'Privileged urban or liberty status',detailZh:'享有特许城镇或自由地位，未划定地域边界，仍保有乡村形态。',detailEn:'Urban or liberty status is privileged; no territory is demarcated and the rural character is maintained.'}),
 9:Object.freeze({zh:'城镇范围外',en:'Extra muros',detailZh:'城镇地域之外的部分；相关城镇范围可能有明确界限，也可能没有。',detailEn:'An area beyond a territory with demarcated or non-demarcated urban status.'})
});

function areaValue(record,key){
 const raw=record?.[key],present=!!record&&Object.hasOwn(record,key);
 if(!present||raw===null)return {status:'missing',raw,area:null};
 return typeof raw==='number'&&Number.isFinite(raw)&&raw>=0?{status:'recorded',raw,area:raw}:{status:'invalid',raw,area:null};
}
function sum(values){let total=0,error=0;for(const value of values){const y=value-error,next=total+y;error=(next-total)-y;total=next;}return total;}

export function halcLandscapeModel(record={}){
 record=record&&typeof record==='object'?record:{};
 const entries=HALC_LANDSCAPE_CLASSES.map(type=>({...type,key:'KM2_LANDSC_'+type.code,...areaValue(record,'KM2_LANDSC_'+type.code)}));
 const recorded=entries.filter(e=>e.status==='recorded'),totalArea=recorded.length?sum(recorded.map(e=>e.area)):null;
 const finiteTotal=totalArea!==null&&Number.isFinite(totalArea),hasComposition=finiteTotal&&totalArea>0;
 for(const entry of entries)entry.share=hasComposition&&entry.status==='recorded'?entry.area/totalArea:null;
 const polygonArea=areaValue(record,'KM2'),difference=finiteTotal&&polygonArea.status==='recorded'?totalArea-polygonArea.area:null;
 const rawUrban=record?.URBAN,knownUrban=Number.isInteger(rawUrban)&&Object.hasOwn(HALC_URBAN_CODES,rawUrban);
 return {entries,totalArea:finiteTotal?totalArea:null,hasComposition,totalStatus:!recorded.length?'missing':finiteTotal?'recorded':'invalid',recordedCount:recorded.length,missingCount:entries.filter(e=>e.status==='missing').length,invalidCount:entries.filter(e=>e.status==='invalid').length,
  complete:recorded.length===entries.length&&finiteTotal,polygonArea,difference,areaMismatch:difference!==null&&Math.abs(difference)>.01,
  urban:knownUrban?{status:'recorded',code:rawUrban,...HALC_URBAN_CODES[rawUrban]}:{status:!Object.hasOwn(record,'URBAN')||rawUrban===null?'missing':'unknown',code:rawUrban}};
}

const tr=(lang,zh,en)=>lang==='en'?en:zh;
const make=(doc,tag,text,cls)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
function bilingual(doc,tag,zh,en,lang,cls){
 const node=make(doc,tag,tr(lang,zh,en),cls);if(lang==='bi'&&en!==zh){const secondary=make(doc,'span',en,'halc-environment-en');secondary.lang='en';node.append(secondary);}return node;
}
function formatArea(value,lang){return new Intl.NumberFormat(lang==='en'?'en':'zh-CN',{maximumFractionDigits:4}).format(value)+' km²';}
function formatPercent(share,lang){if(share===null)return null;if(share>0&&share<.001)return '<0.1%';return new Intl.NumberFormat(lang==='en'?'en':'zh-CN',{style:'percent',maximumFractionDigits:1}).format(share);}

/** Append an independent reader to parent; return the model and root for callers/tests. */
export function renderHalcLandscape(parent,record,lang='bi'){
 const doc=parent.ownerDocument||globalThis.document,model=halcLandscapeModel(record),root=make(doc,'section',undefined,'halc-environment');
 root.append(bilingual(doc,'h4','景观构成','Landscape composition',lang));
 const summary=model.totalArea===null?bilingual(doc,'p','来源未记载可用的分类面积。','No usable classified areas are recorded.',lang,'halc-environment-summary'):bilingual(doc,'p','分类面积合计 · '+formatArea(model.totalArea,lang),'Classified area total · '+formatArea(model.totalArea,'en'),lang,'halc-environment-summary');root.append(summary);
 const caption=model.hasComposition?(model.complete?['比例以八类面积合计为分母。','Proportions use the sum of all eight classified areas.']:['比例以已记载的有效分类面积合计为分母。','Proportions use the sum of the valid recorded classified areas.']):model.totalStatus==='invalid'?['分类面积合计待核对，暂不计算比例。','The classified-area total needs review; proportions are not calculated.']:model.recordedCount?['分类面积合计为零，暂不计算比例。','The recorded classified areas total zero; proportions are not calculated.']:['各项保留来源的记载状态。','Each category retains its source recording status.'];
 if(!model.complete||!model.hasComposition)root.append(bilingual(doc,'p',...caption,lang,'halc-environment-caption'));
 if(model.hasComposition){const bar=make(doc,'div',undefined,'halc-environment-stack');bar.setAttribute('aria-hidden','true');for(const entry of model.entries)if(entry.share>0){const part=make(doc,'span');part.style.setProperty('width',String(entry.share*100)+'%');part.style.setProperty('--landscape-color',entry.color);part.dataset.landscapeCode=String(entry.code);bar.append(part);}root.append(bar);}
 const list=make(doc,'ul',undefined,'halc-environment-areas'),zeroList=make(doc,'ul',undefined,'halc-environment-areas');let zeroCount=0;
 for(const entry of model.entries){
  const row=make(doc,'li',undefined,'halc-environment-area');row.dataset.landscapeCode=String(entry.code);row.dataset.valueState=entry.status;
  const swatch=make(doc,'span',undefined,'halc-environment-swatch');swatch.setAttribute('aria-hidden','true');swatch.style.setProperty('--landscape-color',entry.color);
  const text=make(doc,'div',undefined,'halc-environment-label');text.append(bilingual(doc,'span',entry.zh,entry.en,lang));if(entry.detailZh)text.append(bilingual(doc,'small',entry.detailZh,entry.detailEn,lang));
  const amount=make(doc,'span',entry.status==='recorded'?formatArea(entry.area,lang):tr(lang,entry.status==='missing'?'未记载':'待核对',entry.status==='missing'?'Not recorded':'Needs review'),'halc-environment-amount');
  const percent=formatPercent(entry.share,lang);if(percent!==null)amount.append(make(doc,'small',percent,'halc-environment-percent'));
  row.append(swatch,text,amount);if(entry.status==='recorded'&&entry.area===0){zeroCount++;zeroList.append(row);}else list.append(row);
 }root.append(list);
 if(zeroCount){const zeros=make(doc,'details',undefined,'halc-environment-zeros');zeros.append(bilingual(doc,'summary',`其余 ${zeroCount} 类 · 0 km²`,`${zeroCount} other categories · 0 km²`,lang),zeroList);root.append(zeros);}
 const urban=make(doc,'section',undefined,'halc-environment-urban');urban.append(bilingual(doc,'h4','聚落地位','Settlement status',lang));
 if(model.urban.status==='recorded'){urban.append(bilingual(doc,'p',model.urban.zh,model.urban.en,lang,'halc-environment-urban-title'));urban.append(bilingual(doc,'p',model.urban.detailZh,model.urban.detailEn,lang,'halc-environment-caption'));}
 else urban.append(bilingual(doc,'p',model.urban.status==='missing'?'未记载聚落地位。':'来源中的聚落代码待核对：'+String(model.urban.code),model.urban.status==='missing'?'Settlement status is not recorded.':'Source settlement code needs review: '+String(model.urban.code),lang));
 root.append(urban);
 const details=make(doc,'details',undefined,'halc-environment-source');details.append(bilingual(doc,'summary','面积与分类说明','Area & classification notes',lang));
 details.append(bilingual(doc,'p','面积取自这条地方记录的八个 KM2_LANDSC 字段，单位为平方千米。图形面积 KM2 单独保留；条形比例按分类面积合计计算。','Areas come from this locality record’s eight KM2_LANDSC fields in square kilometres. Polygon area KM2 is retained separately; bar proportions use the classified-area total.',lang));
 if(model.polygonArea.status==='recorded')details.append(bilingual(doc,'p','来源图形面积 · '+formatArea(model.polygonArea.area,lang),'Source polygon area · '+formatArea(model.polygonArea.area,'en'),lang));
 if(model.areaMismatch)details.append(bilingual(doc,'p','分类面积合计与图形面积相差 '+formatArea(Math.abs(model.difference),lang)+'，这里分别保留两项数值。','The classified-area total and polygon area differ by '+formatArea(Math.abs(model.difference),'en')+'; both source values are retained.',lang,'halc-environment-difference'));
 details.append(bilingual(doc,'p','0 表示来源记录为零；未记载项单列。面积保留来源的小数精度，比例仅供阅读。水域类别沿用来源的通航分类。','Zero means a recorded zero; unrecorded categories remain separate. Area decimals retain source precision, while percentages aid reading. Water categories retain the source’s navigability classification.',lang));
 details.append(bilingual(doc,'p','URBAN 记录这条地方单元的城镇地位与地域形态。“特许地位”是来源的地位分类，取得地位或建城年代需另查年代资料。','URBAN records the urban status and territorial form of this local unit. Privileged status is a source classification; dates of that status or of foundation require separate chronological evidence.',lang));
 if(model.invalidCount){const invalid=make(doc,'ul',undefined,'halc-environment-invalid');for(const entry of model.entries.filter(e=>e.status==='invalid'))invalid.append(make(doc,'li',entry.key+' = '+String(entry.raw)));details.append(invalid);}
 const link=make(doc,'a',tr(lang,'查阅 HALC 字段与代码手册','Read the HALC codebook'));link.href='https://dataverse.nl/api/access/datafile/639016';link.target='_blank';link.rel='noopener noreferrer';details.append(link);root.append(details);parent.append(root);return {model,root};
}
