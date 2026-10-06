import {readJSON,formatYear} from './map-engine.js?v=3.38.0-5683ed6448eb';

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
  const bounds=map.getBounds(),origin=map.getContainer().getBoundingClientRect(),max=Math.min(60,Math.round((zoom-2)*10)),boxes=[...(this.atlas.labelBoxes||[])];
  const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  for(const record of this.active){
   if(this.markers.length>=max)break;
   const [lon,lat]=record.coordinates||[];if(!Number.isFinite(lon)||!Number.isFinite(lat))continue;
   if(!bounds.contains([lon,lat]))continue;
   const screen=map.project([lon,lat]),el=document.createElement('button');
   el.className='atrocity-marker';el.type='button';
   el.title=this.name(record)+' · '+formatYear(record.year,this.lang==='en'?'en':'zh');
   el.setAttribute('aria-label',el.title);
   const icon=document.createElement('i');el.append(icon);
   if(zoom>=6.5){const label=document.createElement('span');label.textContent=this.name(record);el.append(label);}
   const w=zoom>=6.5?Math.min(150,this.name(record).length*7+30):18,h=zoom>=6.5?22:18;
   const box={left:origin.left+screen.x-w/2,right:origin.left+screen.x+w/2,top:origin.top+screen.y-h/2,bottom:origin.top+screen.y+h/2};
   if(box.left<origin.left+8||box.right>origin.right-10||box.top<origin.top+10||box.bottom>origin.bottom-48||boxes.some(b=>overlap(box,b)))continue;
   boxes.push({...box,left:box.left-7,right:box.right+7,top:box.top-4,bottom:box.bottom+4});
   el.onclick=e=>{e.stopPropagation();this.onSelect?.(record,this.atlas);};
   this.markers.push(new maplibregl.Marker({element:el,anchor:'center',opacityWhenCovered:'0'}).setLngLat([lon,lat]).addTo(map));
  }
 }
 destroy(){this.seq++;this.map.off('moveend',this.move);this.markers.forEach(m=>m.remove());this.markers=[];}
}
