import {readJSON,formatYear,civilYear} from './map-engine.js?v=3.6.0-8e0c6ac31e93';
export async function loadPlaces(includeModern=false){
 const names=['historical-settlements-index','historical-capitals','urban-observations',...(includeModern?['modern-cities']:[])];
 const results=await Promise.allSettled(names.map(n=>readJSON(`data/places/${n}.json.gz`)));
 const data=results.filter(r=>r.status==='fulfilled').flatMap(r=>r.value.places||r.value.claims||r.value.cities);
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
export function placeAtYear(p,year,span=50){
 if(!Number.isInteger(year)||year===0)return null;
 if(p.kind==='modern-reference')return {...p,rank:4+(p.scaleRank||0)};
 if(p.observations){const o=p.observations.reduce((a,b)=>Math.abs(civilYear(b[0])-civilYear(year))<Math.abs(civilYear(a[0])-civilYear(year))?b:a);const label=p.datedNames?.find(n=>n.start<=o[0]&&o[0]<=n.end&&(!n.observationYears||n.observationYears.includes(o[0])));return Math.abs(civilYear(o[0])-civilYear(year))<=span?{...p,observation:o,displayName:label?.name,displayNameZh:label?.nameZh,labelEvidence:label,rank:2-Math.log10(Math.max(1,o[1]||1))/10}:null;}
 const period=p.periods?.find(([a,b])=>a<=year&&year<=b);if(!period)return null;
 const location=p.locations?.filter(l=>l.periods?.some(([a,b])=>a<=year&&year<=b)).sort((a,b)=>(a.accuracyMeters??Infinity)-(b.accuracyMeters??Infinity))[0];
 if(p.locations&&!location)return null;
 const label=p.datedNames?.find(n=>n.start<=year&&year<=n.end);
 return {...p,displayName:label?.name,displayNameZh:label?.nameZh,labelEvidence:label,coordinates:location?.coordinates||p.coordinates,location,period:location?.periods.find(([a,b])=>a<=year&&year<=b)||period,rank:p.kind==='dated-capital'?0:3-(p.referenceCount||0)/100};
}
export function nearestPlaceYear(p,year){
 if(p.observations)return p.observations.reduce((a,b)=>Math.abs(civilYear(b[0])-civilYear(year))<Math.abs(civilYear(a[0])-civilYear(year))?b:a)[0];
 if(p.periods?.length)return p.periods.reduce((best,[a,b])=>{const y=Math.max(a,Math.min(b,year));return Math.abs(civilYear(y)-civilYear(year))<Math.abs(civilYear(best)-civilYear(year))?y:best;},p.periods[0][0]);
 return year;
}
export const normalizePlaceQuery=q=>String(q||'').toLocaleLowerCase().normalize('NFD').replace(/[\p{Diacritic}\s'’‘ʼ‐‑–—-]/gu,'');
export async function searchPlaces(query,year){
 const q=normalizePlaceQuery(query);if(!q||q.length<2&&!/\p{Script=Han}/u.test(q))return [];
 const scored=(await loadPlaces()).filter(p=>p.kind!=='modern-reference').map(p=>{
  const names=[p.name,p.nameZh].map(normalizePlaceQuery),aliases=[p.otherNames,...(p.datedNames||[]).flatMap(n=>[n.name,n.nameZh]),...(p.searchAliases||[]),...(p.names||[]).map(n=>n.name)].filter(Boolean).flatMap(n=>String(n).split(/[,;|]/)).map(normalizePlaceQuery);
  const score=names.includes(q)?0:aliases.includes(q)?1:names.some(n=>n.startsWith(q))?2:[...names,...aliases].some(n=>n.includes(q))?3:99;
  return {p,score};
 });
 return scored.filter(x=>x.score<99).sort((a,b)=>Math.max(1,a.score)-Math.max(1,b.score)||Number(!placeAtYear(a.p,year))-Number(!placeAtYear(b.p,year))||a.score-b.score||Number(a.p.kind!=='dated-capital')-Number(b.p.kind!=='dated-capital')||a.p.name.length-b.p.name.length).slice(0,10).map(x=>x.p);
}
export class PlaceLayer {
 constructor(atlas,{onSelect,onStatus}={}){this.atlas=atlas;this.map=atlas.map;this.onSelect=onSelect;this.onStatus=onStatus;this.markers=[];this.active=[];this.enabled=true;this.modern=false;this.seq=0;this.year=atlas.year;this.lang=atlas.lang;this.move=()=>this.refresh();this.map.on('resize',this.move);this.setYear(atlas.year,atlas.lang);}
 async setYear(year,lang){
  this.year=year;this.lang=lang;const seq=++this.seq;
  try{const places=await loadPlaces(this.modern);if(this.atlas.destroyed||seq!==this.seq)return;
   this.active=places.filter(p=>p.kind!=='modern-reference'||this.modern).map(p=>placeAtYear(p,year)).filter(Boolean).sort((a,b)=>a.rank-b.rank);this.refresh();this.onStatus?.(places.partial?'partial':'ready',this.active.length);
  }catch{if(seq===this.seq)this.onStatus?.('error',0);}
 }
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
   if(p.kind==='attested-settlement'&&zoom<3.4)continue;
   if(map.getProjection().type==='globe'&&zoom<3){const rad=Math.PI/180,[lon,lat]=p.coordinates;const dot=Math.sin(center.lat*rad)*Math.sin(lat*rad)+Math.cos(center.lat*rad)*Math.cos(lat*rad)*Math.cos((lon-center.lng)*rad);if(dot<.2)continue;}
   const screen=map.project(p.coordinates),name=placeName(p,this.lang),secondary=this.lang==='bi'&&(p.displayNameZh||p.nameZh)?placeName(p,'en'):'';
   const width=Math.min(172,Math.max(name.length*(p.nameZh&&this.lang!=='en'?12:6.5),secondary.length*6)+30),height=(secondary?46:32)+(p.observation&&p.observation[0]!==this.year?14:0);
   const box={left:origin.left+screen.x-12,right:origin.left+screen.x+width,top:origin.top+screen.y-height/2,bottom:origin.top+screen.y+height/2};
   if(box.left<origin.left+10||box.right>origin.right-12||box.top<origin.top+12||box.bottom>origin.bottom-52||boxes.some(b=>overlap(box,b)))continue;
   boxes.push({...box,left:box.left-8,right:box.right+8,top:box.top-5,bottom:box.bottom+5});
   const el=document.createElement('button');el.className='place-marker '+(modern?'modern':p.kind==='dated-capital'?'capital':'historic');
   const dot=document.createElement('i'),label=document.createElement('span');label.textContent=name;el.append(dot,label);
   if(secondary){const sub=document.createElement('small');sub.textContent=secondary;label.append(sub);}
   if(p.observation&&p.observation[0]!==this.year){const stamp=document.createElement('small');stamp.className='place-date';stamp.textContent=(this.lang==='en'?'recorded ':'记录于 ')+formatYear(p.observation[0],this.lang==='en'?'en':'zh');label.append(stamp);}
   el.title=(modern?(this.lang==='en'?'Modern reference · ':'现代参照 · '):'')+name;el.setAttribute('aria-label',el.title);
   el.onclick=e=>{e.stopPropagation();this.onSelect?.(p,this.atlas);};
   this.markers.push(new maplibregl.Marker({element:el,anchor:'left',offset:[-5,0],opacityWhenCovered:'0'}).setLngLat(p.coordinates).addTo(map));
  }
 }
 destroy(){this.seq++;this.selection?.remove();this.map.off('moveend',this.move);this.map.off('resize',this.move);this.markers.forEach(m=>m.remove());}
}
