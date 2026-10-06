import {ADDITIONAL_VARIABLES} from './research-vocabulary.js?v=3.41.0-ded029edf830';
// Labels are editorial translations; original Equinox variable names remain the keys.
// Definitions: official Seshat Code Book, 20 April 2021, pp. 6–9 and 12–17.
export const CODEBOOK_URL='https://seshatdatabank.info/sitefiles/code-book-4.20.2021.pdf';
export const SOURCE_URL='https://github.com/seshatdb/Equinox_Data';
export const WORKBOOK_URL='https://raw.githubusercontent.com/seshatdb/Equinox_Data/main/Equinox_on_GitHub_June9_2022.xlsx';
export const DOMAINS={scale:{zh:'人口与规模',en:'Population & scale'},institutions:{zh:'行政与法律',en:'Administration & law'},economy:{zh:'生产与交换',en:'Production & exchange'},transport:{zh:'交通与通信',en:'Transport & communication'},knowledge:{zh:'文字与知识',en:'Writing & knowledge'},warfare:{zh:'军事与防御',en:'Warfare & defense'},religion:{zh:'宗教与思想',en:'Religion & ideas'},general:{zh:'政体与文化背景',en:'Polity & cultural background'},metadata:{zh:'来源整理信息',en:'Source metadata'},other:{zh:'其他原始变量',en:'Other source variables'}};
const V=(source,zh,domain,page,detailZh='',detailEn='',unit='')=>({source,zh,en:source,domain,codebookPage:page,detailZh,detailEn,unit,unitZh:({people:'人',levels:'级','km²':'平方千米'})[unit]||unit,unitEn:unit});
export const PRIORITY_VARIABLES=[
 V('Polity Population','政体人口估计','scale',12,'人口估计','Estimated population','people'),
 V('Polity territory','政体面积','scale',12,'来源面积估计','Coded territory area','km²'),
 V('Population of the largest settlement','最大聚落人口','scale',12,'按人口规模记录最大聚落','Largest settlement by population','people'),
 V('Settlement hierarchy','聚落层级','scale',12,'规模与功能层级','Settlement size and functional hierarchy','levels'),
 V('Administrative levels','行政层级','institutions',13,'官员组织层级','Hierarchy of officials','levels'),
 V('Full-time bureaucrats','专职行政人员','institutions',14,'专职行政专家','Full-time administrative specialists'),
 V('Examination system','考试选拔制度','institutions',14),
 V('Merit promotion','绩效晋升制度','institutions',14,'制度化的绩效晋升','Institutionalized performance-based promotion'),
 V('Formal legal code','正式法律体系','institutions',14,'可为成文或口传','May be written or orally transmitted'),
 V('Courts','专用审判建筑','institutions',14,'专门用于司法程序的建筑','Buildings specialized for legal proceedings'),
 V('Judges','专职法官','institutions',14,'全职专业法官','Full-time professional judges'),
 V('irrigation systems','灌溉设施','economy',14),
 V('markets','市场设施','economy',14),
 V('Roads','人工修筑道路','transport',15,'排除自然踩踏小径','Excludes paths formed through repeated use'),
 V('Bridges','桥梁','transport',15),V('Canals','运河','transport',15),
 V('Ports','港口','transport',15,'包括河港','Includes river ports'),
 V('Couriers','专职信使','transport',17,'全职专业信使','Full-time professional couriers'),
 V('Postal stations','邮驿设施','transport',17,'具有邮驿功能的专门设施','Special infrastructure for postal functions'),
 V('General postal service','面向民众的邮政','transport',17,'也为私人递送邮件','Also carries private correspondence'),
 V('Script','文字系统','knowledge',16),V('Calendar','历法','knowledge',16),
 V('Scientific literature','科学文献','knowledge',17,'含数学、自然与社会科学','Includes mathematics, natural and social sciences'),
 V('Indigenous coins','本土铸币','economy',17),V('Foreign coins','外来铸币','economy',17),
 V('Paper currency','本土纸币或法定货币','economy',17,'来源要求本土发行','Source requires indigenous production')
];
export const VARIABLE_BY_NAME=new Map([...Object.values(ADDITIONAL_VARIABLES).map(v=>({...v,domain:v.domain==='other'&&DOMAINS[v.category?.key]?v.category.key:v.domain})),...PRIORITY_VARIABLES].map(v=>[v.source,v]));
const PRIORITY_NAMES=new Set(PRIORITY_VARIABLES.map(v=>v.source));
// These labels keep source evidence categories separate. Missing values are never zero.
export const CODES={
 present:{zh:'有存在证据',en:'Evidence of presence',page:8},
 absent:{zh:'有不存在的证据',en:'Evidence of absence',page:8},
 'inferred present':{zh:'推定存在',en:'Inferred presence',page:7,detailZh:'由间接证据推断',detailEn:'Inference from indirect evidence'},
 'inferred absent':{zh:'推定不存在',en:'Inferred absence',page:7,detailZh:'由间接证据推断',detailEn:'Inference from indirect evidence'},
 unknown:{zh:'专家确认资料不足',en:'Expert-confirmed evidence gap',page:9},
 'suspected unknown':{zh:'研究助理判断资料不足',en:'Research assistant suspects an evidence gap',page:9,detailZh:'待专家确认',detailEn:'Expert confirmation pending'},
 'not applicable':{zh:'不适用',en:'Not applicable',page:9},
 uncoded:{zh:'未编码',en:'Uncoded',page:9},
 absent_to_present:{zh:'出现的过渡阶段',en:'Transition to presence',page:8},
 present_to_absent:{zh:'消失的过渡阶段',en:'Transition to absence',page:8}
};
export const VALUE_NOTES={
 simple:{zh:'单值编码',en:'Single code'},range:{zh:'取值范围',en:'Value range'},
 disputed:{zh:'专家意见存在分歧',en:'Expert disagreement'},
 uncertain:{zh:'取值不确定',en:'Uncertain value'},list:{zh:'原始列举值',en:'Source list value'}
};
export const label=(value,lang='bi')=>typeof value==='string'?value:lang==='en'?(value.en||value.zh||''):lang==='zh'?(value.zh||value.en||''):[value.zh,value.en].filter((s,i,a)=>s&&a.indexOf(s)===i).join(' · ');
export function variableDefinition(name,raw=null){const base=VARIABLE_BY_NAME.get(name)||{source:name,zh:name,en:name,domain:'other'};if(!raw||!base.contextOverrides)return base;const override=base.contextOverrides.find(c=>(!c.section||c.section===raw.Section)&&(!c.subsection||c.subsection===raw.Subsection));return override?{...base,...override}:base;}
export function observationModel(raw,polity){
 const definition=variableDefinition(raw.Variable||'',raw);
 const a=Object.hasOwn(raw,'Value.From')?raw['Value.From']:null,b=Object.hasOwn(raw,'Value.To')?raw['Value.To']:null;
 const start=raw['Date.From']??null,end=raw['Date.To']??null;
 return {raw,definition,from:a,to:b,code:a===null?null:(CODES[a]||null),valueNote:raw['Value.Note']||null,
  factType:raw['Fact.Type']||null,dateNote:raw['Date.Note']||null,start,end,
  dateKind:start!==null||end!==null?'explicit-source-date':'phase-context',phaseContexts:(polity.periods||[]).filter(p=>!raw.NGA||p.samplingArea===raw.NGA).length?(polity.periods||[]).filter(p=>!raw.NGA||p.samplingArea===raw.NGA):(polity.periods||[]),sourceRow:raw._sourceRow};
}
export function filterObservations(rows,{domain='priority',variable='all',query=''}={}){
 const q=query.trim().toLocaleLowerCase();
 return rows.filter(r=>{const d=variableDefinition(r.Variable||'',r);return (domain==='all'||domain==='priority'&&PRIORITY_NAMES.has(r.Variable)||domain===d.domain)&&(variable==='all'||r.Variable===variable)&&(!q||[r.Variable,r['Value.From'],r['Value.To'],r.NGA,r.Polity,r.Section,r.Subsection,r['Date.From'],r['Date.To'],d.zh,...(d.searchTerms||[])].some(s=>String(s??'').toLocaleLowerCase().includes(q)));});
}
