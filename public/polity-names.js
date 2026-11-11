import {polityDisplayData} from './polity-display-names-data.js?v=3.54.0-440274174472';

const byRecord=new Map();
for(const rule of polityDisplayData.rules)for(const target of rule.targets)byRecord.set(target.id,{rule,target});
const civilYear=year=>Number.isInteger(year)&&year!==0;
const inRecord=(r,year)=>civilYear(year)&&(!Number.isInteger(r.start)||r.start<=year)&&(!Number.isInteger(r.end)||year<=r.end);

// Names are a view over immutable source records, never a replacement identity.
export function polityNameEvidence(r,year){
 if(!r||!inRecord(r,year))return null;
 const found=byRecord.get(r.id);if(!found)return null;
 const {target,rule}=found;
 return ['id','name','start','end','type'].every(key=>r[key]===target[key])?rule:null;
}
export function polityName(r,lang,year){
 if(!r)return '';
 if(!inRecord(r,year))return r.name||'';
 const rule=polityNameEvidence(r,year);
 return rule?rule.display[lang==='en'?'en':'zh']:lang==='en'?(r.name||''):(r.zhName||r.name||'');
}
export function polityNameSources(r,year){return (polityNameEvidence(r,year)?.sourceIds||[]).map(id=>polityDisplayData.sources[id]);}
export function polityEntityAllowed(r,year){return polityNameEvidence(r,year)?.linkedEntityUse!=='withhold';}

// All-period lists choose and expose a real year before asking for a name.
export function polityReferenceYear(r,desired){
 if(!Number.isInteger(r?.start)||!Number.isInteger(r?.end)||r.start>r.end)return null;
 const year=civilYear(desired)?Math.max(r.start,Math.min(r.end,desired)):r.start;
 return year===0?(r.start<0?-1:r.end>0?1:null):year;
}
export function polityNameGroupKey(r){
 const rule=polityNameEvidence(r,polityReferenceYear(r));
 return JSON.stringify([r.name,rule?.id||'source']);
}
export function politySearchText(r,year){
 const rule=polityNameEvidence(r,year);
 return [r.name,polityName(r,'zh',year),polityName(r,'en',year),...(rule?[]:[r.enName])].filter(Boolean).join(' ').toLowerCase();
}
export function representativePolityRecord(records,r,year){
 const key=polityNameGroupKey(r),distance=x=>Math.abs((polityReferenceYear(x,year)??year)-year);
 return records.filter(x=>x.type==='POLITY'&&polityNameGroupKey(x)===key).reduce((best,x)=>distance(x)<distance(best)?x:best,r);
}
export function searchPolityRecords(records,query,year,limit=12){
 const q=query.trim().toLowerCase();if(!q)return [];
 const matches=records.filter(r=>r.type==='POLITY').map(record=>({record,year:polityReferenceYear(record,year)})).filter(x=>x.year!==null&&politySearchText(x.record,x.year).includes(q));
 const exact=x=>[polityName(x.record,'zh',x.year),polityName(x.record,'en',x.year)].some(n=>n.toLowerCase()===q)?0:1;
 matches.sort((a,b)=>Math.abs(a.year-year)-Math.abs(b.year-year)||exact(a)-exact(b)||b.record.area-a.record.area||a.record.id.localeCompare(b.record.id));
 const seen=new Set();return matches.filter(x=>{const key=polityNameGroupKey(x.record);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,limit);
}
export function groupPolityRecords(records,year){
 const groups=new Map();
 for(const r of records){
  if(r.type!=='POLITY')continue;
  const key=polityNameGroupKey(r),g=groups.get(key),labelYear=polityReferenceYear(r,year);
  if(labelYear===null)continue;
  if(!g){groups.set(key,{...r,min:r.start,max:r.end,count:1,labelYear});continue;}
  const min=Math.min(g.min,r.start),max=Math.max(g.max,r.end),count=g.count+1;
  groups.set(key,Math.abs(labelYear-year)<Math.abs(g.labelYear-year)?{...r,min,max,count,labelYear}:{...g,min,max,count});
 }
 return [...groups.values()];
}
