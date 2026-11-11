import {readJSON,formatYear,civilYear} from './map-engine.js?v=3.52.0-a7bea3fb619c';
import {placeWindow} from './view-state.js?v=3.52.0-a7bea3fb619c';
// Editorially reviewed archaeological sites. They live in their own sourced
// layer: representative points of listed heritage properties, dated only to the
// period their source states, and never merged with the urban observations that
// happen to sit nearby.
const attestedCache=new WeakMap();
export function attestedPlaces(layer){
 if(!layer||typeof layer!=='object')return [];
 // Derived once per loaded layer: repeated loads must hand back the same objects,
 // otherwise callers that compare cached place lists stop matching by identity.
 if(attestedCache.has(layer))return attestedCache.get(layer);
 const list=(layer.records||[]).filter(r=>r.period&&Number.isFinite(r.period.start)&&Number.isFinite(r.period.end)&&r.location?.coordinates?.length===2).map(r=>({
  id:r.id,kind:'attested-site',source:'attested-sites',name:r.nameEn,nameZh:r.nameZh,displayName:r.nameEn,displayNameZh:r.nameZh,
  otherNames:r.aliases||[],region:r.region,coordinates:r.location.coordinates,
  periods:[[r.period.start,r.period.end]],
  sourceUrl:r.sources?.[0]?.url,referenceCount:(r.sources||[]).length,
  attested:r
 }));
 attestedCache.set(layer,list);return list;
}
export async function loadPlaces(includeModern=false){
 const names=['historical-settlements-index','historical-capitals','urban-observations',...(includeModern?['modern-cities']:[])];
 const results=await Promise.allSettled([...names.map(n=>readJSON(`data/places/${n}.json.gz`)),readJSON('data/places/attested-places.json.gz')]);
 const data=results.filter(r=>r.status==='fulfilled').flatMap(r=>r.value.places||r.value.claims||r.value.cities||attestedPlaces(r.value));
 if(!data.length)throw Error('Place archives unavailable');
 data.partial=results.some(r=>r.status==='rejected');return data;
}
export async function placeDetail(p){
 if(p.detailsShard===undefined)return p;
 const shard=await readJSON(`data/places/settlements-${String(p.detailsShard).padStart(3,'0')}.json.gz`);
 const full=shard[p.id];if(!full)throw Error('Missing place record');
 return {...full,...p,description:full.description,names:full.names,sourceUrl:full.sourceUrl,referenceUrls:full.referenceUrls,authors:full.authors,location:full.locations?.find(l=>l.coordinates[0]===p.coordinates[0]&&l.coordinates[1]===p.coordinates[1]&&l.accuracyMeters===p.location?.accuracyMeters&&JSON.stringify(l.periods)===JSON.stringify(p.location?.periods))||p.location};
}
export const placeName=(p,lang)=>lang==='en'?(p.displayName||p.name):(p.displayNameZh||p.nameZh||p.displayName||p.name);
// A source observation is not a city lifespan. Name epochs constrain borrowing
// only when both dates have evidence; editorial observation aliases alone do not.
export const placeNamePeriods=(p,year)=>(p.nameTimeline||[]).filter(n=>(n.start==null||n.start<=year)&&(n.end==null||year<=n.end));
export function observationMatchesNamePeriod(p,observed,year){
 const current=placeNamePeriods(p,year),recorded=placeNamePeriods(p,observed);
 return !current.length||!recorded.length||current.some(n=>recorded.includes(n));
}
function datedPlaceLabel(p,year){
 const periods=placeNamePeriods(p,year);
 if(!periods.length)return p.datedNames?.find(n=>n.start<=year&&year<=n.end&&(!n.observationYears||n.observationYears.includes(year)));
 return {name:[...new Set(periods.map(n=>n.name))].join(' / '),nameZh:[...new Set(periods.map(n=>n.nameZh).filter(Boolean))].join('／'),sources:periods.flatMap(n=>n.sources||[n.source]),source:periods[0].source,noteZh:periods.length>1?'这一年横跨改名日期，保留前后两个名称。':'名称按记录年份所对应的时期显示，原始研究名称保留在档案中。',noteEn:periods.length>1?'This year spans a recorded renaming; both names are retained.':'The displayed name follows the record year. The original source name is retained in the archive.'};
}
export function placeAtYear(p,year,span=50){
 if(!Number.isInteger(year)||year===0)return null;
 if(p.kind==='modern-reference')return {...p,rank:4+(p.scaleRank||0)};
 if(p.observations){const candidates=p.observations.filter(o=>Math.abs(civilYear(o[0])-civilYear(year))<=span&&observationMatchesNamePeriod(p,o[0],year));if(!candidates.length)return null;const o=candidates.reduce((a,b)=>Math.abs(civilYear(b[0])-civilYear(year))<Math.abs(civilYear(a[0])-civilYear(year))?b:a),label=datedPlaceLabel(p,o[0]);return {...p,observation:o,displayName:label?.name,displayNameZh:label?.nameZh,labelEvidence:label,rank:2-Math.log10(Math.max(1,o[1]||1))/10};}
 const period=p.periods?.find(([a,b])=>a<=year&&year<=b);if(!period)return null;
 const location=p.locations?.filter(l=>l.periods?.some(([a,b])=>a<=year&&year<=b)).sort((a,b)=>(a.accuracyMeters??Infinity)-(b.accuracyMeters??Infinity))[0];
 if(p.locations&&!location)return null;
 const label=datedPlaceLabel(p,year);
 return {...p,displayName:label?.name,displayNameZh:label?.nameZh,labelEvidence:label,coordinates:location?.coordinates||p.coordinates,location,period:location?.periods.find(([a,b])=>a<=year&&year<=b)||period,rank:p.kind==='dated-capital'?0:p.kind==='attested-site'?1:3-(p.referenceCount||0)/100};
}
export function nearestPlaceYear(p,year){
 if(p.observations)return p.observations.reduce((a,b)=>Math.abs(civilYear(b[0])-civilYear(year))<Math.abs(civilYear(a[0])-civilYear(year))?b:a)[0];
 if(p.periods?.length)return p.periods.reduce((best,[a,b])=>{const y=Math.max(a,Math.min(b,year));return Math.abs(civilYear(y)-civilYear(year))<Math.abs(civilYear(best)-civilYear(year))?y:best;},p.periods[0][0]);
 return year;
}
export const normalizePlaceQuery=q=>String(q||'').toLocaleLowerCase().normalize('NFD').replace(/[\p{Diacritic}\s'’‘ʼ‐‑–—-]/gu,'');
export async function searchPlaces(query,year,span=50){
 const q=normalizePlaceQuery(query);if(!q||q.length<2&&!/\p{Script=Han}/u.test(q))return [];
 const scored=(await loadPlaces()).filter(p=>p.kind!=='modern-reference').map(p=>{
  const names=[p.name,p.nameZh].map(normalizePlaceQuery),aliases=[p.otherNames,...[...(p.datedNames||[]),...(p.nameTimeline||[])].flatMap(n=>[n.name,n.nameZh]),...(p.searchAliases||[]),...(p.names||[]).map(n=>n.name)].filter(Boolean).flatMap(n=>String(n).split(/[,;|]/)).map(normalizePlaceQuery);
  const score=names.includes(q)?0:aliases.includes(q)?1:names.some(n=>n.startsWith(q))?2:[...names,...aliases].some(n=>n.includes(q))?3:99;
  return {p,score};
 });
 return scored.filter(x=>x.score<99).sort((a,b)=>Math.max(1,a.score)-Math.max(1,b.score)||Number(!placeAtYear(a.p,year,span))-Number(!placeAtYear(b.p,year,span))||a.score-b.score||Number(a.p.kind!=='dated-capital')-Number(b.p.kind!=='dated-capital')||a.p.name.length-b.p.name.length).slice(0,10).map(x=>x.p);
}
export class PlaceLayer {
 constructor(atlas,{onSelect,onStatus,window=50}={}){this.window=placeWindow(window);this.atlas=atlas;this.map=atlas.map;this.onSelect=onSelect;this.onStatus=onStatus;this.markers=[];this.active=[];this.enabled=true;this.modern=false;this.seq=0;this.year=atlas.year;this.lang=atlas.lang;this.move=()=>this.refresh();this.map.on('resize',this.move);this.setYear(atlas.year,atlas.lang);}
 async setYear(year,lang){
  this.year=year;this.lang=lang;const seq=++this.seq;
  try{const places=await loadPlaces(this.modern);if(this.atlas.destroyed||seq!==this.seq)return;
   this.active=places.filter(p=>p.kind!=='modern-reference'||this.modern).map(p=>placeAtYear(p,year,this.window)).filter(Boolean).sort((a,b)=>a.rank-b.rank);this.refresh();this.onStatus?.(places.partial?'partial':'ready',this.active.length);
  }catch{if(seq===this.seq)this.onStatus?.('error',0);}
 }
 setWindow(value){this.window=placeWindow(value);return this.setYear(this.year,this.lang);}
 setModern(v){this.modern=v;this.setYear(this.year,this.lang);}
 toggle(v){this.enabled=v;this.refresh();}
 select(place){
  this.selection?.remove();this.selection=null;if(!place||this.atlas.destroyed)return;
  const el=document.createElement('div');el.className='selected-place';el.setAttribute('aria-hidden','true');
  this.selection=new maplibregl.Marker({element:el,opacityWhenCovered:'0'}).setLngLat(place.coordinates).addTo(this.map);
 }
 refresh(){
  this.markers.forEach(m=>m.remove());this.markers=[];if(!this.enabled||this.atlas.destroyed||!this.year)return;
  const map=this.map,zoom=map.getZoom();if(zoom<2)return;
  const bounds=map.getBounds(),origin=map.getContainer().getBoundingClientRect(),center=map.getCenter(),boxes=[...(this.atlas.labelBoxes||[])];
  for(const el of document.querySelectorAll('.map-heading,.map-tools,.layer-panel,.compare-heading,.map-notice'))if(el.getClientRects().length)boxes.push(el.getBoundingClientRect());
  const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  const candidates=this.active.filter(p=>bounds.contains(p.coordinates));
  const max=Math.min(90,Math.round((zoom-1)*12));
  for(const p of candidates){
   if(this.markers.length>=max)break;
   const modern=p.kind==='modern-reference';if(modern&&zoom<Math.max(3,(p.minZoom||4)-2))continue;
   if((p.kind==='attested-settlement'||p.kind==='attested-site')&&zoom<3.4)continue;
   if(map.getProjection().type==='globe'&&zoom<3){const rad=Math.PI/180,[lon,lat]=p.coordinates;const dot=Math.sin(center.lat*rad)*Math.sin(lat*rad)+Math.cos(center.lat*rad)*Math.cos(lat*rad)*Math.cos((lon-center.lng)*rad);if(dot<.2)continue;}
   const screen=map.project(p.coordinates),name=placeName(p,this.lang),secondary=this.lang==='bi'&&(p.displayNameZh||p.nameZh)?placeName(p,'en'):'';
   const width=Math.min(172,Math.max(name.length*(p.nameZh&&this.lang!=='en'?12:6.5),secondary.length*6)+30),height=(secondary?46:32)+(p.observation?14:0);
   // A record that exists in the data should still be visible and clickable when its
   // label cannot be placed. Try the label on the right, then on the left, then fall
   // back to the dot alone instead of dropping the record entirely.
   const fits=candidate=>candidate.left>=origin.left+10&&candidate.right<=origin.right-12&&candidate.top>=origin.top+12&&candidate.bottom<=origin.bottom-52&&!boxes.some(b=>overlap(candidate,b));
   const labelBox=side=>side==='right'
    ?{left:origin.left+screen.x-12,right:origin.left+screen.x+width,top:origin.top+screen.y-height/2,bottom:origin.top+screen.y+height/2}
    :{left:origin.left+screen.x-width+12,right:origin.left+screen.x+12,top:origin.top+screen.y-height/2,bottom:origin.top+screen.y+height/2};
   const dotBox={left:origin.left+screen.x-7,right:origin.left+screen.x+7,top:origin.top+screen.y-7,bottom:origin.top+screen.y+7};
   let box=null,side='right',dotOnly=false;
   for(const [candidate,place]of [[labelBox('right'),'right'],[labelBox('left'),'left'],[dotBox,'dot']]){
    if(!fits(candidate))continue;
    box=candidate;dotOnly=place==='dot';side=place==='dot'?'right':place;break;
   }
   if(!box)continue;
   boxes.push({...box,left:box.left-8,right:box.right+8,top:box.top-5,bottom:box.bottom+5});
   const el=document.createElement('button');el.className='place-marker '+(modern?'modern':p.kind==='dated-capital'?'capital':'historic')+(dotOnly?' dot-only':'');
   const dot=document.createElement('i'),label=document.createElement('span');label.textContent=name;el.append(dot,label);
   if(secondary){const sub=document.createElement('small');sub.textContent=secondary;label.append(sub);}
   if(p.observation){const stamp=document.createElement('small');stamp.className='place-date';stamp.textContent=(this.lang==='en'?'Population · ':'人口 · ')+formatYear(p.observation[0],this.lang==='en'?'en':'zh');label.append(stamp);}
   el.title=(modern?(this.lang==='en'?'Modern reference · ':'现代参照 · '):'')+name;el.setAttribute('aria-label',el.title);
   el.onclick=e=>{e.stopPropagation();this.onSelect?.(p,this.atlas);};
   const anchor=dotOnly?'center':side==='left'?'right':'left',offset=dotOnly?[0,0]:side==='left'?[5,0]:[-5,0];
   this.markers.push(new maplibregl.Marker({element:el,anchor,offset,opacityWhenCovered:'0'}).setLngLat(p.coordinates).addTo(map));
  }
 }
 destroy(){this.seq++;this.selection?.remove();this.map.off('moveend',this.move);this.map.off('resize',this.move);this.markers.forEach(m=>m.remove());}
}
