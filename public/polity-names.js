import {polityDisplayData} from './polity-display-names-data.js?v=4.02.0-b6a85fad9fb7';

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
export function polityChainBucket(key,buckets=64){
 let h=2166136261;
 for(let i=0;i<key.length;i++)h=Math.imul(h^key.charCodeAt(i),16777619);
 return (h>>>0)%buckets;
}
export function polityChainPath(r){
 const key=typeof r==='string'?r:polityNameGroupKey(r);
 return `data/fast/polity-chains/b-${String(polityChainBucket(key)).padStart(2,'0')}.json.gz`;
}
function spanReference(g,desired){
 let bestYear=null,bestSpan=null,bestDist=Infinity;
 for(const sp of g.s){
  const [s,e]=sp;
  let y=civilYear(desired)?Math.max(s,Math.min(e,desired)):s;
  if(y===0)y=s<0?-1:e>0?1:null;
  if(y===null)continue;
  const dist=civilYear(desired)?Math.abs(y-desired):0;
  if(dist<bestDist){bestDist=dist;bestYear=y;bestSpan=sp;}
 }
 return bestYear===null?null:{year:bestYear,zh:bestSpan[2]??g.zh,en:bestSpan[3]??g.en};
}
export function searchPolityIndex(index,query,year,limit=12){
 const q=query.trim().toLowerCase();if(!q||!index?.groups)return [];
 const matches=[];
 for(const g of index.groups){
  const hay=[g.n,g.zh,g.en,...g.s.flatMap(sp=>sp.slice(2)),...(g.x||[])].filter(Boolean).join(' ').toLowerCase();
  if(!hay.includes(q))continue;
  const ref=spanReference(g,year);
  if(!ref)continue;
  const exact=[ref.zh,ref.en,g.n].some(n=>n&&n.toLowerCase()===q)?0:1;
  matches.push({group:g,year:ref.year,zh:ref.zh,en:ref.en,exact});
 }
 matches.sort((a,b)=>Math.abs(a.year-year)-Math.abs(b.year-year)||a.exact-b.exact||b.group.a-a.group.a||a.group.id.localeCompare(b.group.id));
 return matches.slice(0,limit);
}
export function groupPolityIndex(index,year){
 if(!index?.groups)return [];
 return index.groups.map(g=>{
  const ref=spanReference(g,year);
  return {id:g.id,name:g.n,zhName:ref?.zh??g.zh,enName:ref?.en??g.en,min:g.min,max:g.max,count:g.c,labelYear:ref?.year??g.min,groupKey:g.k,bucket:g.b,area:g.a};
 });
}
