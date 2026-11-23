// OHM uses astronomical years: 0 = 1 BCE, -1 = 2 BCE.
// Meridian's public year input uses civil years and excludes zero.
export function historicalYearRange(year){
 if(!Number.isInteger(year)||year===0||year< -70000||year>2026)throw Error('Invalid historical year');
 const start=year<0?year+1:year;
 return [start,start+1];
}
export function datedFeatureVisible(properties,year){
 const [start,end]=historicalYearRange(year),s=properties.start_decdate,e=properties.end_decdate;
 if(typeof s!=='number'||!Number.isFinite(s)||Math.abs(s)>=1e8||s>=end)return false;
 if(Object.hasOwn(properties,'end_decdate'))return typeof e==='number'&&Number.isFinite(e)&&Math.abs(e)<1e8&&e>=s&&e>=start;
 // A known but unconverted end date is not an indefinitely continuing feature.
 return !Object.hasOwn(properties,'end_date');
}
export function historicalDateFilter(year){
 const [start,end]=historicalYearRange(year);
 return ['all',
  ['==',['typeof',['get','start_decdate']],'number'],
  ['>', ['number',['get','start_decdate'],1e8],-1e8],
  ['<', ['number',['get','start_decdate'],1e8],end],
  ['any',
   ['all',['!', ['has','end_decdate']],['!', ['has','end_date']]],
   ['all',
    ['==',['typeof',['get','end_decdate']],'number'],
    ['<',['number',['get','end_decdate'],-1e8],1e8],
    ['>',['number',['get','end_decdate'],-1e8],-1e8],
    ['>=',['number',['get','end_decdate'],-1e8],start],
    ['>=',['number',['get','end_decdate'],-1e8],['number',['get','start_decdate'],1e8]],
   ],
  ],
 ];
}
