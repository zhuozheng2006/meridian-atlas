// Classify the date evidence of one statement, not the lifetime of its entity.
// Open bounds, uncertain dates and multiple bounds remain in the wider archive.
export function classifyStatement(s, year, field) {
 if(s.rank==='deprecated'||s.snakType&&s.snakType!=='value')return 'excluded';
 if(!Number.isInteger(year)||year===0)return 'context';
 const t=s.temporal||{},start=t.start||[],end=t.end||[],point=t.point||[];
 const certain=d=>Number.isInteger(d?.civilYear)&&d.civilYear!==0&&d.precision>=9&&!(d.before||d.after);
 if((s.qualifiers||[]).some(q=>q.property==='P1480'||q.property==='P5102'&&q.value?.id==='Q5727902')||s.qualifiersRaw?.P1480?.length||s.qualifiersRaw?.P5102?.some(q=>q.datavalue?.value?.id==='Q5727902')||t.earliest?.length||t.latest?.length)return 'context';
 if(['inception','dissolution'].includes(field)||['P571','P576'].includes(s.property)) {
  const d=s.value?.time;
  return certain(d)?d.civilYear===year?'selected':'other':'context';
 }
 if(start.length>1||end.length>1||point.length>1||![...start,...end,...point].every(certain))return 'context';
 if(point.length) {
  if(start.length||end.length)return 'context';
  return point[0].civilYear===year?'selected':'other';
 }
 const a=start[0]?.civilYear,b=end[0]?.civilYear;
 if(a!==undefined&&b!==undefined) {
  if(a>b)return 'context';
  return a<=year&&year<=b?'selected':'other';
 }
 if(a!==undefined&&year<a||b!==undefined&&year>b)return 'other';
 return 'context';
}
export const statementApplies=(s,year)=>classifyStatement(s,year)==='selected';

// Dates in the source are inclusive civil years, with no year zero.
const nextYear=y=>y===-1?1:y+1;
const previousYear=y=>y===1?-1:y-1;
export function recordGaps(records) {
 const list=records.filter(r=>Number.isInteger(r.start)&&Number.isInteger(r.end)&&r.start&&r.end&&r.start<=r.end).slice().sort((a,b)=>a.start-b.start);
 const gaps=[];let end=list[0]?.end;
 for(const r of list.slice(1)) {if(r.start>nextYear(end))gaps.push([nextYear(end),previousYear(r.start)]);end=Math.max(end,r.end);}
 return gaps;
}
