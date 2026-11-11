// A transport encoding only: every coordinate must round-trip exactly.
// Original OHM snapshots remain the research/download source.
export const REGIONAL_COMPACT_YEARS=new Set([1492,1500]);
export function regionalTransportURL(window_,year){return window_.id==='central-europe'&&REGIONAL_COMPACT_YEARS.has(Number(year))?`data/ohm-transport/central-europe-${year}.json.gz`:null;}
export function decodeRegionalTransport(data){
 if(data?.encoding!=='ohm-delta-1e7')return data;
 function ring(values){
  if(!Array.isArray(values)||values.length<8||values.length%2)throw Error('Invalid regional coordinate sequence');
  let x=0,y=0;const out=[];
  for(let i=0;i<values.length;i+=2){if(!Number.isSafeInteger(values[i])||!Number.isSafeInteger(values[i+1]))throw Error('Invalid regional coordinate delta');x+=values[i];y+=values[i+1];if(Math.abs(x)>180e7||Math.abs(y)>90e7)throw Error('Regional coordinate outside world');out.push([x/1e7,y/1e7]);}
  return out;
 }
 const features=data.features.map(f=>{
  if(!f.deltaGeometry)return f;
  const {deltaGeometry,...rest}=f,g=deltaGeometry;
  if(!['Polygon','MultiPolygon'].includes(g.type))throw Error('Invalid regional geometry type');
  const coordinates=g.type==='Polygon'?g.coordinates.map(ring):g.coordinates.map(p=>p.map(ring));
  return {...rest,geometry:{...g,coordinates}};
 });
 const {encoding,...rest}=data;return {...rest,features};
}
