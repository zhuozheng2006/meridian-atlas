import {readJSON,formatYear,civilYear} from './map-engine.js?v=3.65.0-134c7e79e40a';
import {placeWindow} from './view-state.js?v=3.65.0-134c7e79e40a';
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
// Quarantined Wikidata capital claims whose explicit date qualifiers exhibit
// unmistakable upstream sign flips or century-as-year encoding errors. Raw claims
// remain untouched in historical-capitals.json.gz while display is withheld.
export const CAPITAL_DATE_QUARANTINE=new Set([
 'capital:Q180568$5ac9055c-44f4-93a7-fcb7-88674c46b701', // Egyptian Empire (New Kingdom) Thebes [-1336, 1279]: +1279 sign error for -1279
 'capital:Q2980623$613b5f92-45dd-ce9b-abcd-9c5fc0145c32', // Kingdom of Bosnia Visoko [9, 1340]: +9 typo extending medieval state to antiquity
 'capital:Q3627069$d0b39cb4-4d5e-15ee-4f60-725632ee182d', // Banate of Bosnia Bobovac [14, 14]: +14 typo for 14th century
 'capital:Q83958$cf01679d-4565-d213-61db-12abfbc7b7b4', // Macedonia Aigai [808, 808]: +808 sign error for 808 BCE
]);
const CAPITAL_ZH_FIX=new Map([['Q5736','阿玛尔纳']]);
const CAPITAL_ZH_EDITORIAL=new Map([
 ['Q4445604','苏扎克'],['Q12489692','克尔托'],['Q12505828','普莱雷特'],['Q3537816','内寇尔'],
 ['Q7066653','诺瓦塔'],['Q31917158','哈卡'],['Q31916975','韦斯卡'],['Q33186','博博瓦茨'],
 ['Q404200','埃盖'],['Q115738657','拉韦纳'],['Q31844059','托莱多'],['Q116170766','马德里'],
 ['Q31925679','巴利亚多利德'],['Q1017178','楚夫特卡莱'],['Q289618','曼苏里耶']
]);
const CAPITAL_POLITY_FIX=new Map([
 ['Q123027565',{zh:'克什米尔苏丹国'}],['Q23039102',{zh:'东吁第一帝国'}],['Q146246',{en:'Francia'}]
]);
const capitalZh=p=>p?.kind==='dated-capital'?(CAPITAL_ZH_FIX.get(p.qid)||p.nameZh||CAPITAL_ZH_EDITORIAL.get(p.qid)||''):p?.nameZh||'';
// Editorial Chinese exonyms for verified historical & major modern urban settlements
// lacking upstream Chinese labels in Chandler/Modelski/Pleiades. Never mutates frozen raw data
// and never overrides dated nameTimeline or datedNames epochs.
const PLACE_ZH_EDITORIAL=new Map([
 // Historical Chandler & Modelski ancient urban records
 ['chandler:1510','毗奢耶那伽罗'],['chandler:478','加里波利'],['chandler:474','高尔（高达）'],['chandler:502','格拉纳达'],
 ['chandler:670','镰仓'],['chandler:110','蒲甘'],['chandler:885','马拉喀什'],['chandler:1260','萨莱'],
 ['chandler:35','哈萨'],['modelski-ancient:5','哈萨'],['chandler:643','章普尔'],['chandler:480','热那亚'],
 ['chandler:1419','天水'],['chandler:1408','特斯科科'],['chandler:66','阿尼'],['modelski-ancient:9','阿尼'],
 ['chandler:1124','波隆纳鲁瓦'],['chandler:242','加的斯'],['chandler:533','海宁'],['chandler:1022','诺夫哥罗德'],
 ['chandler:1141','普雷斯拉夫'],['chandler:1165','库姆'],['chandler:1450','特里尔'],['modelski-ancient:137','特里尔'],
 ['chandler:12','阿卡'],['chandler:251','卡利卡特'],['chandler:588','霍尔木兹'],['chandler:831','潞城'],
 ['chandler:929','米利都'],['chandler:1008','尼姆鲁德'],['chandler:1100','波斯波利斯'],['chandler:1317','苏丹尼耶'],
 ['chandler:1392','特尔戈维什泰'],['modelski-ancient:66','克诺索斯'],['chandler:115','八剌沙衮'],['chandler:19','阿格里真托'],
 ['chandler:81','阿尔戈斯'],['chandler:83','阿尔勒'],['chandler:491','果阿'],['chandler:792','莱昂'],
 ['chandler:798','辽东'],['chandler:1033','奥赫里德'],['chandler:1070','帕多瓦'],['chandler:1560','山口'],
 ['chandler:1593','大津巴布韦'],['modelski-ancient:45','二里头'],['modelski-ancient:84','摩亨佐-达罗'],
 ['modelski-ancient:81','梅里达'],['chandler:75','隞（郑州）'],
 // Modern >=1M settlements lacking Chinese names
 ['modelski-modern:76','埃卡特佩克'],['modelski-modern:281','阳城'],['modelski-modern:238','塞提夫'],['chandler:408','杜塞尔多夫'],
 ['modelski-modern:210','启东'],['modelski-modern:87','瓜鲁柳斯'],['modelski-modern:106','桦甸'],['modelski-modern:266','乌鲁木齐'],
 ['modelski-modern:142','耒阳'],['modelski-modern:117','江阴'],['chandler:411','东柏林'],['modelski-modern:79','防城港'],
 ['modelski-modern:247','宿迁'],['modelski-modern:285','宜兴'],['modelski-modern:85','戈亚尼亚'],['modelski-modern:288','禹州'],
 ['modelski-modern:153','麻城'],['modelski-modern:225','瑞安'],['modelski-modern:262','天水'],['modelski-modern:48','常熟'],
 ['modelski-modern:93','海城'],['modelski-modern:42','卡卢坎'],['modelski-modern:119','即墨'],['modelski-modern:144','涟源'],
 ['modelski-modern:224','顿河畔罗斯托夫'],
 // High-reference Pleiades classical settlements (ref>=30)
 ['pleiades:668331','巴尔米拉'],['pleiades:422995','奥斯蒂亚'],['pleiades:599612','以弗所'],['pleiades:570182','科林斯'],
 ['pleiades:432873','赫库兰尼姆'],['pleiades:442658','梅塔蓬托'],['pleiades:893990','杜拉-欧罗波斯'],['pleiades:462086','阿格里真托'],
 ['pleiades:423013','普赖内斯特'],['pleiades:423108','图斯库卢姆'],['pleiades:462307','麦加拉·希布莱亚'],['pleiades:530824','布特林特'],
 ['pleiades:903021','埃克巴坦那'],['pleiades:638753','阿佛洛狄西亚'],['pleiades:413005','阿尔巴·富琴斯'],['pleiades:432815','普泰奥利'],
 ['pleiades:413332','塔尔奎尼亚'],['pleiades:413393','武尔奇'],['pleiades:452457','锡巴里斯']
]);
const editorialPlaceZh=p=>(!p?.nameZh&&!p?.nameTimeline?.length&&!p?.datedNames?.length&&!p?.labelEvidence)?(PLACE_ZH_EDITORIAL.get(p?.id)||''):'';
const capitalPolityLabels=p=>p?.kind==='dated-capital'&&CAPITAL_POLITY_FIX.has(p.polityQid)?{...p.polityLabels,...CAPITAL_POLITY_FIX.get(p.polityQid)}:p?.polityLabels;
export const placeName=(p,lang)=>lang==='en'?(p.displayName||p.name):(p.displayNameZh||(p?.kind==='dated-capital'?capitalZh(p):(p.nameZh||editorialPlaceZh(p)))||p.displayName||p.name);
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
 if(p.kind==='dated-capital'&&CAPITAL_DATE_QUARANTINE.has(p.id))return null;
 if(p.observations){const candidates=p.observations.filter(o=>Math.abs(civilYear(o[0])-civilYear(year))<=span&&observationMatchesNamePeriod(p,o[0],year));if(!candidates.length)return null;const o=candidates.reduce((a,b)=>Math.abs(civilYear(b[0])-civilYear(year))<Math.abs(civilYear(a[0])-civilYear(year))?b:a),label=datedPlaceLabel(p,o[0]),zh=p.nameZh||editorialPlaceZh(p);return {...p,...(zh?{nameZh:zh}:{}),observation:o,displayName:label?.name,displayNameZh:label?.nameZh,labelEvidence:label,rank:2-Math.log10(Math.max(1,o[1]||1))/10};}
 const period=p.periods?.find(([a,b])=>a<=year&&year<=b);if(!period)return null;
 const location=p.locations?.filter(l=>l.periods?.some(([a,b])=>a<=year&&year<=b)).sort((a,b)=>(a.accuracyMeters??Infinity)-(b.accuracyMeters??Infinity))[0];
 if(p.locations&&!location)return null;
 const label=datedPlaceLabel(p,year);
 const zh=p.kind==='dated-capital'?capitalZh(p):(p.nameZh||editorialPlaceZh(p)),polityLabels=capitalPolityLabels(p);
 return {...p,...(zh?{nameZh:zh}:{}),...(polityLabels?{polityLabels}:{}),displayName:label?.name,displayNameZh:label?.nameZh,labelEvidence:label,coordinates:location?.coordinates||p.coordinates,location,period:location?.periods.find(([a,b])=>a<=year&&year<=b)||period,rank:p.kind==='dated-capital'?0:p.kind==='attested-site'?1:3-(p.referenceCount||0)/100};
}
export function nearestPlaceYear(p,year){
 if(p.observations)return p.observations.reduce((a,b)=>Math.abs(civilYear(b[0])-civilYear(year))<Math.abs(civilYear(a[0])-civilYear(year))?b:a)[0];
 if(p.periods?.length)return p.periods.reduce((best,[a,b])=>{const y=Math.max(a,Math.min(b,year));return Math.abs(civilYear(y)-civilYear(year))<Math.abs(civilYear(best)-civilYear(year))?y:best;},p.periods[0][0]);
 return year;
}
export const normalizePlaceQuery=q=>String(q||'').toLocaleLowerCase().normalize('NFD').replace(/[\p{Diacritic}\s'’‘ʼ‐‑–—-]/gu,'');
export async function searchPlaces(query,year,span=50){
 const q=normalizePlaceQuery(query);if(!q||q.length<2&&!/\p{Script=Han}/u.test(q))return [];
 const scored=(await loadPlaces()).filter(p=>p.kind!=='modern-reference'&&!CAPITAL_DATE_QUARANTINE.has(p.id)).map(p=>{
  const names=[p.name,p.kind==='dated-capital'?capitalZh(p):(p.nameZh||editorialPlaceZh(p))].map(normalizePlaceQuery),aliases=[p.otherNames,...[...(p.datedNames||[]),...(p.nameTimeline||[])].flatMap(n=>[n.name,n.nameZh]),...(p.searchAliases||[]),...(p.names||[]).map(n=>n.name)].filter(Boolean).flatMap(n=>String(n).split(/[,;|]/)).map(normalizePlaceQuery);
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
   const meta=p.observation?(this.lang==='en'?'Population · ':'人口 · ')+Number(p.observation[1]).toLocaleString()+' · '+formatYear(p.observation[0],this.lang==='en'?'en':'zh'):p.kind==='dated-capital'?(this.lang==='en'?'Historical capital':'历史首都'):modern?(this.lang==='en'?'Present-day reference':'现代参照'):p.period?formatYear(p.period[0],this.lang==='en'?'en':'zh')+(p.period[1]!==p.period[0]?' — '+formatYear(p.period[1],this.lang==='en'?'en':'zh'):''):'';
   const showHover=()=>{this.atlas.setHoverMarker?.({primary:name,secondary,meta},el.getBoundingClientRect());};
   el.addEventListener('mouseenter',showHover);el.addEventListener('focus',showHover);
   el.addEventListener('mouseleave',()=>this.atlas.setHoverMarker?.(null));el.addEventListener('blur',()=>this.atlas.setHoverMarker?.(null));
   el.onclick=e=>{e.stopPropagation();this.atlas.setHoverMarker?.(null);this.onSelect?.(p,this.atlas);};
   const anchor=dotOnly?'center':side==='left'?'right':'left',offset=dotOnly?[0,0]:side==='left'?[5,0]:[-5,0];
   this.markers.push(new maplibregl.Marker({element:el,anchor,offset,opacityWhenCovered:'0'}).setLngLat(p.coordinates).addTo(map));
  }
 }
 destroy(){this.seq++;this.atlas.setHoverMarker?.(null);this.selection?.remove();this.map.off('moveend',this.move);this.map.off('resize',this.move);this.markers.forEach(m=>m.remove());}
}
