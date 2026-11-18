import {readJSON,formatYear} from './map-engine.js?v=4.10.0-46343806b677';

// A separate point layer for one-sided mass violence against non-combatants.
// It is deliberately NOT the battle layer: scripts/places/validate-atrocities.mjs
// fails if any Wikidata entity appears in both archives, and refresh() draws these
// records with their own marker class so the two can never be confused on the map.
// Names are source labels: nameZh may be null and is never transliterated or
// machine-translated; the reader falls back to the source-language name.
export async function loadAtrocities(){
 const data=await readJSON('data/atrocities.json.gz');
 return {incidents:Array.isArray(data?.incidents)?data.incidents:[],policy:data?.policy||null,counts:data?.counts||null};
}

export class AtrocityLayer{
 constructor(atlas,{window=50,onSelect,onStatus,enabled=false}={}){
  this.atlas=atlas;this.map=atlas.map;this.window=window;this.onSelect=onSelect;this.onStatus=onStatus;
  this.enabled=enabled;this.year=atlas.year;this.lang=atlas.lang;this.markers=[];this.active=[];this.all=null;this.policy=null;this.counts=null;this.seq=0;
  this.move=()=>this.refresh();this.map.on('moveend',this.move);
 }
 async setYear(year,lang){
  this.year=year;this.lang=lang;const seq=++this.seq;
  try{
   if(!this.all){const data=await loadAtrocities();this.all=data.incidents;this.policy=data.policy;this.counts=data.counts;}
   if(this.atlas.destroyed||seq!==this.seq)return;
   this.active=this.all.filter(a=>a.year!=null&&Math.abs(a.year-year)<=this.window).sort((a,b)=>Math.abs(a.year-year)-Math.abs(b.year-year));
   this.refresh();this.onStatus?.('ready',this.active.length);
  }catch{if(seq===this.seq)this.onStatus?.('error',0);}
 }
 setWindow(value){this.window=value;return this.setYear(this.year,this.lang);}
 toggle(v){this.enabled=v;this.refresh();}
 hasSourceZh(record){return typeof record?.nameZh==='string'&&record.nameZh.trim().length>0;}
 // Source label, never an invented one: Chinese when the source has it, otherwise
 // the original (usually English) name. No transliteration, no machine translation.
 name(record){
  const zh=this.hasSourceZh(record)?record.nameZh.trim():'',en=typeof record?.nameEn==='string'?record.nameEn.trim():'';
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
   const secondary=this.lang!=='en'&&this.hasSourceZh(record)&&record.nameEn?record.nameEn.trim():'';
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
 destroy(){this.seq++;this.atlas.setHoverMarker?.(null);this.map.off('moveend',this.move);this.markers.forEach(m=>m.remove());this.markers=[];}
}
