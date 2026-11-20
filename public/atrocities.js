import {readJSON,formatYear,civilYear} from './map-engine.js?v=4.16.0-68b90e70059b';

// A separate point layer for one-sided mass violence against non-combatants.
// It is deliberately NOT the battle layer: scripts/places/validate-atrocities.mjs
// fails if any Wikidata entity appears in both archives, and refresh() draws these
// records with their own marker class so the two can never be confused on the map.
// Names are source labels: nameZh may be null and is never transliterated or
// machine-translated; the reader falls back to the source-language name.
// OpenCC t2s display normalization for existing source Chinese labels (never invents labels where nameZh is null).
const ATRO_T2S=new Map([
 ['滑鐵盧灣大屠殺','滑铁卢湾大屠杀'],['博依德大屠殺','博依德大屠杀'],['米爾費拉大屠殺','米尔费拉大屠杀'],
 ['格拉奈大屠殺','格拉奈大屠杀'],['反錫克教暴動','反锡克教暴动'],['加爾各答黑洞','加尔各答黑洞'],
 ['潘傑瓦伊槍擊案','潘杰瓦伊枪击案'],['2014年白沙瓦學校襲擊事件','2014年白沙瓦学校袭击事件'],
 ['美宅屠殺','美宅屠杀'],['泰國法政大學屠殺事件','泰国法政大学屠杀事件'],['馬京達瑙大屠殺','马京达瑙大屠杀'],
 ['巴朗吉戛大屠殺','巴朗吉戛大屠杀'],['美萊村屠殺','美莱村屠杀'],['馬尼拉大屠殺','马尼拉大屠杀'],
 ['雙十節事件','双十节事件'],['巴里梳龍屠殺','巴里梳龙屠杀'],['謬努大屠殺','谬努大屠杀'],
 ['古達巴因大屠殺','古达巴因大屠杀'],['2018年菲律賓甘蔗田屠殺','2018年菲律宾甘蔗田屠杀'],
 ['秋巴因大屠殺','秋巴因大屠杀'],['因丁大屠殺','因丁大屠杀']
]);
export function atrocityDisplayZh(record){
 if(typeof record?.nameZh!=='string')return '';
 const s=record.nameZh.trim();
 return s?(ATRO_T2S.get(s)||s):'';
}
export async function loadAtrocities(){
 const data=await readJSON('data/atrocities.json.gz');
 return {incidents:Array.isArray(data?.incidents)?data.incidents:[],policy:data?.policy||null,counts:data?.counts||null};
}

export class AtrocityLayer{
 constructor(atlas,{window=50,onSelect,onStatus,enabled=false}={}){
  this.atlas=atlas;this.map=atlas.map;this.window=window;this.onSelect=onSelect;this.onStatus=onStatus;
  this.enabled=enabled;this.year=atlas.year;this.lang=atlas.lang;this.markers=[];this.active=[];this.all=null;this.policy=null;this.counts=null;this.seq=0;
  this.move=()=>this.refresh();this.map.on('resize',this.move);
 }
 async setYear(year,lang){
  this.year=year;this.lang=lang;const seq=++this.seq;
  try{
   if(!this.all){const data=await loadAtrocities();this.all=data.incidents;this.policy=data.policy;this.counts=data.counts;}
   if(this.atlas.destroyed||seq!==this.seq)return;
   const target=civilYear(year);
   this.active=this.all.filter(a=>a.year!=null&&Math.abs(civilYear(a.year)-target)<=this.window).sort((a,b)=>Math.abs(civilYear(a.year)-target)-Math.abs(civilYear(b.year)-target));
   this.refresh();this.onStatus?.('ready',this.active.length);
  }catch{if(seq===this.seq)this.onStatus?.('error',0);}
 }
 setWindow(value){this.window=value;return this.setYear(this.year,this.lang);}
 toggle(v){this.enabled=v;this.refresh();}
 hasSourceZh(record){return typeof record?.nameZh==='string'&&record.nameZh.trim().length>0;}
 // Source label, never an invented one: Chinese when the source has it, otherwise
 // the original (usually English) name. No transliteration, no machine translation.
 name(record){
  const zh=atrocityDisplayZh(record),en=typeof record?.nameEn==='string'?record.nameEn.trim():'';
  return this.lang==='en'?(en||zh||record.id):(zh||en||record.id);
 }
 refresh(){
  this.markers.forEach(m=>m.remove());this.markers=[];if(!this.enabled||this.atlas.destroyed||!this.year)return;
  const map=this.map,zoom=map.getZoom();if(zoom<3||this.atlas.regional?.detailedActive)return;
  const bounds=map.getBounds(),origin=map.getContainer().getBoundingClientRect(),center=map.getCenter(),max=Math.min(60,Math.round((zoom-2)*10)),boxes=[...(this.atlas.labelBoxes||[]),...(this.atlas.overlayBlockerBoxes?.('.map-legend,.place-marker:not(.dot-only)')||[])];
  const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  const textWidth=s=>Array.from(String(s||'')).reduce((w,ch)=>w+(/[\u3400-\u9fff\uF900-\uFAFF]/.test(ch)?12.4:7.2),0);
  for(const record of this.active){
   if(this.markers.length>=max)break;
   const [lon,lat]=record.coordinates||[];if(!Number.isFinite(lon)||!Number.isFinite(lat))continue;
   if(map.getProjection().type==='globe'&&zoom<4.5){const rad=Math.PI/180;const dot=Math.sin(center.lat*rad)*Math.sin(lat*rad)+Math.cos(center.lat*rad)*Math.cos(lat*rad)*Math.cos((lon-center.lng)*rad);if(dot<.28)continue;}
   if(!bounds.contains([lon,lat]))continue;
   const screen=map.project([lon,lat]),el=document.createElement('button');
   el.className='atrocity-marker';el.type='button';
   el.title=this.name(record)+' · '+formatYear(record.year,this.lang==='en'?'en':'zh');
   el.setAttribute('aria-label',el.title);
   const icon=document.createElement('i');el.append(icon);
   const titleText=this.name(record);
   if(zoom>=6.5){const label=document.createElement('span');label.textContent=titleText;el.append(label);}
   const w=zoom>=6.5?Math.min(180,textWidth(titleText)+32):18,h=zoom>=6.5?24:18;
   const box={left:origin.left+screen.x-w/2,right:origin.left+screen.x+w/2,top:origin.top+screen.y-h/2,bottom:origin.top+screen.y+h/2};
   if(box.left<origin.left+8||box.right>origin.right-10||box.top<origin.top+10||box.bottom>origin.bottom-48||boxes.some(b=>overlap(box,b)))continue;
   boxes.push({...box,left:box.left-7,right:box.right+7,top:box.top-4,bottom:box.bottom+4});
   const secondary=this.lang==='bi'&&this.hasSourceZh(record)&&record.nameEn&&record.nameEn.trim()!==record.nameZh.trim()?record.nameEn.trim():'';
   const rawConflict=this.lang==='en'?(record.conflict?.length?record.conflict:record.conflictZh):(record.conflictZh?.length?record.conflictZh:record.conflict);
   const conflict=Array.isArray(rawConflict)?rawConflict.filter(Boolean).join(' · '):(rawConflict||'');
   const meta=formatYear(record.year,this.lang==='en'?'en':'zh')+(conflict?' · '+conflict:'');
   const showHover=()=>{this.atlas.setHoverMarker?.({primary:this.name(record),secondary,meta},el.getBoundingClientRect());};
   el.addEventListener('mouseenter',showHover);el.addEventListener('focus',showHover);
   el.addEventListener('mouseleave',()=>this.atlas.setHoverMarker?.(null));el.addEventListener('blur',()=>this.atlas.setHoverMarker?.(null));
   el.onclick=e=>{e.stopPropagation();this.atlas.setHoverMarker?.(null);this.onSelect?.(record,this.atlas);};
   this.markers.push(new maplibregl.Marker({element:el,anchor:'center',opacityWhenCovered:'0'}).setLngLat([lon,lat]).addTo(map));
  }
 }
 destroy(){this.seq++;this.atlas.setHoverMarker?.(null);this.map.off('resize',this.move);this.markers.forEach(m=>m.remove());this.markers=[];}
}
