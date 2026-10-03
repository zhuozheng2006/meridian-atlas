import {loadPlaces,placeAtYear,placeName,normalizePlaceQuery} from './places.js?v=3.10.0-76931d3559eb';
import {loadNative,nativeGeometry} from './native-geometry.js?v=3.10.0-76931d3559eb';
import {readJSON} from './map-engine.js?v=3.10.0-76931d3559eb';

const validPoint=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[1])<=90;
function prepareRing(input){
 if(!input?.length||input.some(p=>!validPoint(p)))return null;
 const points=[];let previous=input[0][0],west=Infinity,east=-Infinity,south=Infinity,north=-Infinity;
 for(const p of input){let x=p[0];while(x-previous>180)x-=360;while(x-previous< -180)x+=360;previous=x;points.push([x,p[1]]);west=Math.min(west,x);east=Math.max(east,x);south=Math.min(south,p[1]);north=Math.max(north,p[1]);}
 return {points,west,east,south,north};
}
export function prepareTerritory(geometry){
 const polygons=geometry?.type==='Polygon'?[geometry.coordinates]:geometry?.type==='MultiPolygon'?geometry.coordinates:[];
 return polygons.map(rings=>rings.map(prepareRing)).filter(rings=>rings[0]&&rings.every(Boolean));
}
function ringContains(ring,point){
 const y=point[1];if(y<ring.south||y>ring.north)return 0;
 let x=point[0],middle=(ring.west+ring.east)/2;while(x-middle>180)x-=360;while(x-middle< -180)x+=360;
 if(x<ring.west||x>ring.east)return 0;
 let inside=false;
 for(let i=0,j=ring.points.length-1;i<ring.points.length;j=i++){
  const a=ring.points[j],b=ring.points[i],dx=b[0]-a[0],dy=b[1]-a[1];
  if(Math.abs((x-a[0])*dy-(y-a[1])*dx)<=1e-10&&x>=Math.min(a[0],b[0])-1e-10&&x<=Math.max(a[0],b[0])+1e-10&&y>=Math.min(a[1],b[1])-1e-10&&y<=Math.max(a[1],b[1])+1e-10)return 2;
  if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside?1:0;
}
export function territoryContains(prepared,point){
 if(!validPoint(point))return false;
 for(const rings of prepared){const outer=ringContains(rings[0],point);if(!outer)continue;if(outer===2)return true;let hole=false;for(const ring of rings.slice(1)){const hit=ringContains(ring,point);if(hit===2)return true;if(hit){hole=true;break;}}if(!hole)return true;}
 return false;
}
export function selectedPolityPlace(place,record,year,prepared,window=50){
 if(place.kind==='modern-reference'||!Number.isInteger(year)||year===0||year<record.start||year>record.end)return null;
 const active=placeAtYear(place,year,window);if(!active||!validPoint(active.coordinates))return null;
 // Capital relationships identify a polity explicitly. Other dated place
 // records are geographical matches, not assertions of political membership.
 if(active.kind==='dated-capital'){
  if(!record.capitalBindingVerified||!record.verifiedWikidata||record.nameTranslationStatus==='ambiguous_source_period'||active.polityQid!==record.verifiedWikidata)return null;
  return {...active,association:'capital-relationship'};
 }
 return territoryContains(prepared,active.coordinates)?{...active,association:'within-source-outline'}:null;
}
const cache=new Map();
export async function polityPlaces(record,year,keepGoing=()=>true,window=50){
 const key=record.id+':'+year+':'+window;if(cache.has(key))return cache.get(key);
 const [all,,bindings]=await Promise.all([loadPlaces(),loadNative([record],year),readJSON('data/enrichment/profile-index.json.gz').catch(()=>null)]);if(!keepGoing())throw new DOMException('Navigation changed','AbortError');
 const binding=bindings?.records?.[record.id],compatibility=binding?.temporalCompatibility;
 const verifiedRecord={...record,capitalBindingVerified:!!binding&&binding.qid===record.verifiedWikidata&&binding.safeToApplyYearFacts!==false&&compatibility!=='potential_conflict'&&compatibility?.status!=='potential_conflict'};
 const geometry=nativeGeometry(record.id);if(!geometry)throw Error('Territory geometry unavailable');
 const prepared=prepareTerritory(geometry),places=[];let slice=performance.now();
 for(const p of all){
  const match=selectedPolityPlace(p,verifiedRecord,year,prepared,window);if(match)places.push(match);
  if(performance.now()-slice>8){await new Promise(resolve=>setTimeout(resolve,0));if(!keepGoing())throw new DOMException('Navigation changed','AbortError');slice=performance.now();}
 }
 places.sort((a,b)=>Number(b.association==='capital-relationship')-Number(a.association==='capital-relationship')||a.rank-b.rank||a.name.localeCompare(b.name));
 const result={recordId:record.id,year,window,places,partial:all.partial||!bindings,counts:{capitals:places.filter(p=>p.kind==='dated-capital').length,settlements:places.filter(p=>p.kind==='attested-settlement').length,observations:places.filter(p=>p.kind==='urban-observation').length}};
 if(!result.partial){cache.set(key,result);while(cache.size>8)cache.delete(cache.keys().next().value);}
 return result;
}
export function filterPolityPlaces(places,query='',kind='all',lang='bi'){
 const q=normalizePlaceQuery(query);return places.filter(p=>(kind==='all'||p.kind===kind)&&(!q||[placeName(p,lang),p.name,p.nameZh,p.displayName,p.displayNameZh,p.otherNames,...[...(p.datedNames||[]),...(p.nameTimeline||[])].flatMap(n=>[n.name,n.nameZh]),...(p.searchAliases||[]),...(p.names||[]).map(n=>n.name)].some(n=>normalizePlaceQuery(n).includes(q))));
}
