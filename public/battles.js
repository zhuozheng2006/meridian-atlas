import {readJSON,formatYear} from './map-engine.js?v=3.10.0-4f89524ff74c';

// Battles are a dated point layer, not a boundary layer. Every record keeps the
// source entity it came from; outcome is deliberately absent because the upstream
// dataset has no stable property for it, and an invented winner would be worse
// than no winner at all.
export async function loadBattles(){const data=await readJSON('data/battles.json.gz');return Array.isArray(data?.battles)?data.battles:[];}

export class BattleLayer{
 constructor(atlas,{window=50,onSelect,onStatus,enabled=true}={}){
  this.atlas=atlas;this.map=atlas.map;this.window=window;this.onSelect=onSelect;this.onStatus=onStatus;
  this.enabled=enabled;this.year=atlas.year;this.lang=atlas.lang;this.markers=[];this.active=[];this.all=null;this.seq=0;
  this.move=()=>this.refresh();this.map.on('moveend',this.move);
 }
 async setYear(year,lang){
  this.year=year;this.lang=lang;const seq=++this.seq;
  try{
   if(!this.all)this.all=await loadBattles();
   if(this.atlas.destroyed||seq!==this.seq)return;
   this.active=this.all.filter(b=>b.year!=null&&Math.abs(b.year-year)<=this.window).sort((a,b)=>Math.abs(a.year-year)-Math.abs(b.year-year));
   this.refresh();this.onStatus?.('ready',this.active.length);
  }catch{if(seq===this.seq)this.onStatus?.('error',0);}
 }
 setWindow(value){this.window=value;return this.setYear(this.year,this.lang);}
 toggle(v){this.enabled=v;this.refresh();}
 refresh(){
  this.markers.forEach(m=>m.remove());this.markers=[];if(!this.enabled||this.atlas.destroyed||!this.year)return;
  const map=this.map,zoom=map.getZoom();if(zoom<3||this.atlas.regional?.detailedActive)return;
  const bounds=map.getBounds(),origin=map.getContainer().getBoundingClientRect(),max=Math.min(60,Math.round((zoom-2)*10)),boxes=[...(this.atlas.labelBoxes||[])];
  const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  for(const battle of this.active){
   if(this.markers.length>=max)break;
   const [lon,lat]=battle.coordinates||[];if(!Number.isFinite(lon)||!Number.isFinite(lat))continue;
   if(!bounds.contains([lon,lat]))continue;
   const screen=map.project([lon,lat]),el=document.createElement('button');
   el.className='battle-marker';el.type='button';
   el.title=this.name(battle)+' · '+formatYear(battle.year,this.lang==='en'?'en':'zh');
   el.setAttribute('aria-label',el.title);
   const icon=document.createElement('i');el.append(icon);
   if(zoom>=6.5){const label=document.createElement('span');label.textContent=this.name(battle);el.append(label);}
   const w=zoom>=6.5?Math.min(150,this.name(battle).length*7+30):18,h=zoom>=6.5?22:18;
   const box={left:origin.left+screen.x-w/2,right:origin.left+screen.x+w/2,top:origin.top+screen.y-h/2,bottom:origin.top+screen.y+h/2};
   if(box.left<origin.left+8||box.right>origin.right-10||box.top<origin.top+10||box.bottom>origin.bottom-48||boxes.some(b=>overlap(box,b)))continue;
   boxes.push({...box,left:box.left-7,right:box.right+7,top:box.top-4,bottom:box.bottom+4});
   el.onclick=e=>{e.stopPropagation();this.onSelect?.(battle,this.atlas);};
   this.markers.push(new maplibregl.Marker({element:el,anchor:'center',opacityWhenCovered:'0'}).setLngLat([lon,lat]).addTo(map));
  }
 }
 name(battle){return this.lang==='en'?(battle.nameEn||battle.nameZh||battle.id):(battle.nameZh||battle.nameEn||battle.id);}
 destroy(){this.seq++;this.map.off('moveend',this.move);this.markers.forEach(m=>m.remove());this.markers=[];}
}
