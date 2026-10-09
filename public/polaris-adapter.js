import {SNAPSHOT,PRIORITY_VARIABLE_IDS} from './polaris-contract.js?v=3.46.0-dce023e2071a';
import {POLARIS_VARIABLES,POLARIS_CODES,CRISIS_FIELDS} from './polaris-vocabulary.js?v=3.46.0-dce023e2071a';
const PRIORITY=new Set(PRIORITY_VARIABLE_IDS);
export const POLARIS_DOMAINS=Object.freeze({scale:{zh:'人口与规模',en:'Population & scale'},institutions:{zh:'行政与法律',en:'Administration & law'},economy:{zh:'生产与交换',en:'Production & exchange'},transport:{zh:'交通与通信',en:'Transport & communication'},knowledge:{zh:'文字与知识',en:'Writing & knowledge'},warfare:{zh:'军事与防御',en:'Warfare & defense'},religion:{zh:'宗教与思想',en:'Religion & ideas'},general:{zh:'政体与文化背景',en:'Polity & cultural background'},crisis:{zh:'危机与后果',en:'Crises & consequences'}});
export const label=(value,lang='bi')=>typeof value==='string'?value:lang==='en'?value?.en||value?.zh||'':lang==='zh'?value?.zh||value?.en||'':[value?.zh,value?.en].filter((v,i,a)=>v&&a.indexOf(v)===i).join(' · ');
export function normalizeFilters(input={}){
 const domain=['all','priority',...Object.keys(POLARIS_DOMAINS)].includes(input.domain)?input.domain:'priority';
 const variable=input.variable==='all'||Object.hasOwn(POLARIS_VARIABLES,input.variable)?input.variable:'all';
 const clean=(value,max)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max):'';
 return {domain,variable,query:clean(input.query,200)};
}
export function variableOptions(domain='all') {return Object.values(POLARIS_VARIABLES).filter(v=>domain==='all'||domain==='priority'&&PRIORITY.has(v.id)||domain===v.domain);}
export function searchSheets(filters={}) {const f=normalizeFilters(filters);return [...new Set(variableOptions(f.domain).filter(v=>f.variable==='all'||f.variable===v.id).map(v=>v.sheet))];}
export function matchesObservation(row,filters={}) {
 const f=normalizeFilters(filters),r=row.raw,v=POLARIS_VARIABLES[r.variable_name];if(!v)return false;
 if(f.domain!=='all'&&!(f.domain==='priority'?PRIORITY.has(v.id):f.domain===v.domain))return false;
 if(f.variable!=='all'&&f.variable!==v.id)return false;
 const q=f.query.trim().toLocaleLowerCase();
 return !q||[row.sourceSheet,row.sourceRow,...Object.values(r),v.zh,v.en,...(v.searchTerms||[])].some(value=>value!==null&&String(value).toLocaleLowerCase().includes(q));
}
export function filterObservations(rows,filters={}) {return rows.filter(row=>matchesObservation(row,filters));}
// Compare decimal source strings without rounding through Number or changing endpoints.
export function compareSourceNumbers(a,b){
 const parse=value=>{if(typeof value!=='string'||value.length>10000)return null;const m=/^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d{1,5}))?$/.exec(value);if(!m||!m[2]&&!m[3])return null;const digits=(m[2]+(m[3]||'')).replace(/^0+/,'');if(!digits)return {sign:0,digits:'0',magnitude:0};const exp=Number(m[4]||0);if(Math.abs(exp)>10000)return null;return {sign:m[1]==='-'?-1:1,digits,magnitude:digits.length-(m[3]||'').length+exp};};
 const x=parse(a),y=parse(b);if(!x||!y)return null;if(x.sign!==y.sign)return x.sign<y.sign?-1:1;if(!x.sign)return 0;
 const size=Math.max(x.digits.length,y.digits.length),cmp=x.magnitude!==y.magnitude?(x.magnitude<y.magnitude?-1:1):x.digits.padEnd(size,'0')===y.digits.padEnd(size,'0')?0:x.digits.padEnd(size,'0')<y.digits.padEnd(size,'0')?-1:1;return cmp===0?0:cmp*x.sign;
}
const sourceFlag=(raw,type)=>({raw,cellType:type,state:raw===null?'not-supplied':type==='b'&&raw==='1'?'marked':type==='b'&&raw==='0'?'not-marked':'unrecognized'});
const codeInfo=raw=>raw!==null&&Object.hasOwn(POLARIS_CODES,raw)?{raw,...POLARIS_CODES[raw]}:null;
export function phaseModel(phase){return {id:phase.id,names:phase.names,sourceNumber:phase.sourceNumber,periods:phase.periods,samplingAreas:phase.samplingAreas,regions:phase.regions,recordCount:phase.recordCount,crisisCount:phase.crisisCount};}
export function rowModel(record,phase){
 const raw=record.raw,definition=POLARIS_VARIABLES[raw.variable_name],start=raw.year_from,end=raw.year_to;
 const periods=phase?.periods||[],dateKind=start!==null||end!==null?'explicit-source-date':'phase-context';
 const outsidePhase=periods.length>0&&[start,end].some(value=>value!==null&&periods.every(p=>{const before=compareSourceNumbers(value,p.startRaw),after=compareSourceNumbers(value,p.endRaw);return before!==null&&after!==null&&(before<0||after>0);}));
 const model={recordKind:record.recordKind,sourceIdentity:record.id,sourcePolityId:raw.polity_id,sourcePolityNumber:raw.polity_number,sourceRow:record.sourceRow,sourceSheet:record.sourceSheet,definition,rawRecord:record,
  dates:{kind:dateKind,startRaw:start,endRaw:end,phaseContexts:periods,oneSided:(start===null)!==(end===null),hasSourceZero:[start,end].some(v=>v!==null&&compareSourceNumbers(v,'0')===0),outsidePhase},
  flags:{disputed:sourceFlag(raw.is_disputed,record.cellTypes.is_disputed),uncertain:sourceFlag(raw.is_uncertain,record.cellTypes.is_uncertain)},
  provenance:{datasetId:SNAPSHOT.datasetId,version:SNAPSHOT.version,sourceSha256:SNAPSHOT.sourceSha256,sourceSheet:record.sourceSheet,sourceRow:record.sourceRow,sourceURL:SNAPSHOT.sourceURL,workbookURL:SNAPSHOT.workbookURL},
  definitionReview:definition?.definitionReview||{status:'provisional-definition-needed'},evidenceStatus:'snapshot-coding-only'};
 if(record.recordKind==='crisis-consequence'){
  model.outcomes=Object.entries(CRISIS_FIELDS).map(([field,description])=>({field,rawCode:raw[field],cellType:record.cellTypes[field],description,code:codeInfo(raw[field])}));
  model.relatedPolity={id:raw.other_polity_id,sourceNumber:raw.other_polity_number};
 }else{
  const from=raw.value_from,to=raw.value_to,both=from!==null&&to!==null,comparison=both?compareSourceNumbers(from,to):null;
  model.values={fromRaw:from,toRaw:to,fromType:record.cellTypes.value_from,toType:record.cellTypes.value_to,fromCode:codeInfo(from),toCode:codeInfo(to),hasTwoValues:both,numericComparison:comparison,reversedNumericEndpoints:comparison===1,
   displayKind:both?'two-source-values':'single-source-value',rangeSemantics:'not-inferred',unit:definition?.unitZh&&[from,to].some(value=>value!==null&&compareSourceNumbers(value,'0')!==null)?{zh:definition.unitZh,en:definition.unitEn,evidence:definition.unitEvidence}:null};
 }
 return model;
}
export function exportPayload(records,{phase=null,filters={},scope='phase'}={}){
 return {dataset:SNAPSHOT.datasetId,version:SNAPSHOT.version,sourceSha256:SNAPSHOT.sourceSha256,sourceURL:SNAPSHOT.sourceURL,workbookURL:SNAPSHOT.workbookURL,
  sourceIdentityConvention:'Source SHA-256 + exact worksheet + Excel row number; not API database identifiers.',scope,phase,filters:normalizeFilters(filters),recordCount:records.length,observations:records};
}
export const PolarisAdapter=Object.freeze({rowModel,phaseModel,filterObservations,matchesObservation,exportPayload,variableOptions,normalizeFilters,searchSheets,domains:POLARIS_DOMAINS});
