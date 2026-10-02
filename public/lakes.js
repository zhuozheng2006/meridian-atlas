import {decodeLakeArchive} from './lake-codec.js?v=3.10.0-bedf722e4358';
// Contemporary lake geometry, separate from dated historical evidence.
const EMPTY_LAKES={type:'FeatureCollection',features:[]};
export const lakeTier=zoom=>zoom>=9?9:zoom>=6?6:zoom>=4?4:0;
export function intersectsLakeBounds(a,b){
 if(a[3]<b[1]||a[1]>b[3])return false;
 // MapLibre bounds can cross the antimeridian or use an unwrapped world copy.
 let east=b[2];while(east<b[0])east+=360;
 if(east-b[0]>=360)return true;
 const shift=Math.floor((b[0]-a[0])/360)*360;
 return [shift,shift+360].some(s=>a[2]+s>=b[0]&&a[0]+s<=east);
}
export function containsLakeBounds(outer,inner){
 if(!outer||inner[1]<outer[1]||inner[3]>outer[3])return false;
 const width=outer[2]-outer[0],innerWidth=inner[2]>=inner[0]?inner[2]-inner[0]:inner[2]+360-inner[0];
 if(width>=360)return true;if(innerWidth>width)return false;
 const shift=Math.ceil((outer[0]-inner[0])/360)*360;
 return inner[0]+shift>=outer[0]&&inner[0]+shift+innerWidth<=outer[2];
}
export function lakeViewport(map){const b=map.getBounds();return [b.getWest(),Math.max(-90,b.getSouth()),b.getEast(),Math.min(90,b.getNorth())];}
export function selectLakeShards(index,bounds,zoom){const tier=lakeTier(zoom);return tier?index.shards.filter(s=>s.minZoom<=tier&&intersectsLakeBounds(s.bbox,bounds)):[];}

// Shared between comparison maps, with failed requests evicted and bounded LRU.
export function decodeLakeFeature(feature){
 const g=feature.geometry;if(g.coordinates)return feature; // audited float fallback
 const polygons=g.deltas.map(polygon=>polygon.map(deltas=>{
  const ring=[];let x=0,y=0;
  for(let i=0;i<deltas.length;i+=2){x+=deltas[i];y+=deltas[i+1];ring.push([x/1e6,y/1e6]);}
  return ring;
 }));
 return {...feature,geometry:{type:g.type,coordinates:g.type==='Polygon'?polygons[0]:polygons}};
}
export class LakeCache {
 constructor(fetchJSON,vertexLimit=800000){this.fetchJSON=fetchJSON;this.limit=vertexLimit;this.entries=new Map();this.vertices=0;}
 async get(meta){
  let entry=this.entries.get(meta.file);
  if(entry){this.entries.delete(meta.file);this.entries.set(meta.file,entry);return entry.promise;}
  entry={vertices:0};this.entries.set(meta.file,entry);
  entry.promise=this.fetchJSON('data/lakes/'+meta.file).then(data=>{
   if(data.encoding!=='delta-1e6'||!Array.isArray(data.features)||data.features.length!==meta.count)throw Error('Invalid lake shard');
   entry.vertices=meta.vertices;this.vertices+=entry.vertices;
   for(const [key,value] of this.entries){if(this.vertices<=this.limit)break;if(value.vertices){this.entries.delete(key);this.vertices-=value.vertices;}}
   return data;
  }).catch(error=>{if(this.entries.get(meta.file)===entry)this.entries.delete(meta.file);throw error;});
  return entry.promise;
 }
}
async function fetchLakeJSON(url){
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),20000);
 try{const r=await fetch(url,{signal:abort.signal,cache:'no-cache'});if(!r.ok)throw Error('Lake archive '+r.status);let bytes=new Uint8Array(await r.arrayBuffer());if(bytes[0]===31&&bytes[1]===139)bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());return url.endsWith('.bin.gz')?decodeLakeArchive(bytes):JSON.parse(new TextDecoder().decode(bytes));}finally{clearTimeout(timer);}
}
const cache=new LakeCache(fetchLakeJSON);
let indexPromise;
function lakeIndex(){return indexPromise??=(fetchLakeJSON('data/lakes/index.json.gz').then(data=>{if(data.schemaVersion!==1||!Array.isArray(data.shards))throw Error('Invalid lake index');return data;}).catch(e=>{indexPromise=null;throw e;}));}
export class LakeLayer {
 constructor(geography,{getIndex=lakeIndex,getShard=s=>cache.get(s)}={}){
  this.geo=geography;this.map=geography.map;this.atlas=geography.atlas;this.getIndex=getIndex;this.getShard=getShard;this.seq=0;this.ready=false;this.status='overview';this.count=0;this.renderSeq=-1;this.labels=[];this.named=[];this.labelKey='';
  this.map.addSource('lake-detail',{type:'geojson',data:EMPTY_LAKES,tolerance:0,maxzoom:14,attribution:'<a href="https://www.hydrosheds.org/products/hydrolakes" target="_blank" rel="noopener">HydroLAKES · Messager et al. (2016) · CC BY 4.0</a>'});
  this.map.addLayer({id:'lake-detail',type:'fill',source:'lake-detail',minzoom:4,paint:{'fill-color':'#466b7d','fill-opacity':0,'fill-antialias':true}},'boundary');
  this.start=()=>{++this.seq;};
  this.move=()=>{if(this.ready&&(!containsLakeBounds(this.coverage,lakeViewport(this.map))||this.coverageTier!==lakeTier(this.map.getZoom()))){this.ready=false;this.sync();}};
  this.end=()=>this.update();this.idle=()=>this.reconcile();
  this.error=e=>{if(e.sourceId==='lake-detail'&&!this.atlas.destroyed){this.ready=false;this.status='error';this.sync();}};
  this.map.on('movestart',this.start);this.map.on('move',this.move);this.map.on('moveend',this.end);this.map.on('idle',this.idle);this.map.on('error',this.error);
 }
 get enabled(){return this.geo.enabled&&!this.geo.reference&&lakeTier(this.map.getZoom())>0;}
 sync(){if(this.atlas.destroyed)return;this.map.setPaintProperty('lake-detail','fill-opacity',this.enabled&&this.ready?1:0);this.geo.referenceVisibility(this.geo.reference);this.geo.syncStatus();this.refreshLabels();}
 reconcile(){this.refreshLabels();if(this.atlas.destroyed||!this.enabled||this.ready||this.status!=='rendering'||this.renderSeq!==this.seq)return;if(this.map.isSourceLoaded('lake-detail')){this.ready=true;this.status='ready';this.sync();}}
 async update(){
  if(this.enabled&&this.ready&&this.coverageTier===lakeTier(this.map.getZoom())&&containsLakeBounds(this.coverage,lakeViewport(this.map))){this.refreshLabels();return;}
  const seq=++this.seq;this.ready=false;
  if(!this.enabled){this.status='overview';this.sync();return;}
  this.status='loading';this.sync();const visible=lakeViewport(this.map),zoom=this.map.getZoom();let east=visible[2];while(east<visible[0])east+=360;const padX=(east-visible[0])*.2,padY=(visible[3]-visible[1])*.2,bounds=[visible[0]-padX,Math.max(-90,visible[1]-padY),east+padX,Math.min(90,visible[3]+padY)];
  const current=()=>!this.atlas.destroyed&&seq===this.seq&&this.enabled;
  try{
   const index=await this.getIndex();if(!current())return;
   const shards=selectLakeShards(index,bounds,zoom),features=[];let cursor=0;
   const workers=Array.from({length:Math.min(4,shards.length)},async()=>{
    while(cursor<shards.length&&current()){const shard=shards[cursor++],data=await this.getShard(shard);if(!current())return;features.push(...data.features.filter(f=>intersectsLakeBounds(f.bbox,bounds)).map(decodeLakeFeature));}
   });
   const outcomes=await Promise.allSettled(workers);if(!current())return;
   if(outcomes.some(o=>o.status==='rejected'))throw Error('Lake detail temporarily unavailable');
   this.named=features.filter(f=>index.names?.[f.id]).map(f=>({id:f.id,bbox:f.bbox,area:f.properties.area,...index.names[f.id]}));this.coverage=bounds;this.coverageTier=lakeTier(zoom);this.count=features.length;this.status='rendering';this.renderSeq=seq;
   this.map.getSource('lake-detail').setData({type:'FeatureCollection',features});
   // MapLibre 5.6 setData returns the source, not a completion promise. Wait
   // for idle + sourceLoaded before replacing the usable overview.
  }catch{if(current()){this.status='error';this.sync();}}
 }
 refreshLabels(){
  if(this.atlas.destroyed)return;
  const lang=this.atlas.lang||'bi',visible=this.ready&&this.enabled&&this.atlas.showLabels!==false;
  const blockers=visible&&this.named.length?[...document.querySelectorAll('.map-heading,.map-tools,.layer-panel,.place-marker,.polity-label,.event-marker')].filter(el=>{const style=getComputedStyle(el);return el.getClientRects().length&&style.visibility!=='hidden'&&Number(style.opacity)>.05;}).map(el=>el.getBoundingClientRect()):[];
  const landscape=this.atlas.regional?.halc?.landscape;
  const key=[visible,lang,this.renderSeq,landscape?.revision,landscape?.eligible,this.map.getZoom(),this.map.getCenter?.().lng,this.map.getCenter?.().lat,...blockers.flatMap(r=>[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)])].join(':');
  if(key===this.labelKey)return;this.labelKey=key;
  for(const marker of this.labels)marker.remove();this.labels=[];if(!visible||!this.named.length)return;
  const container=this.map.getContainer(),origin=container.getBoundingClientRect(),bounds=lakeViewport(this.map),placed=[];
  const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  for(const n of [...this.named].sort((a,b)=>b.area-a.area)){
   if(landscape?.covers(n.center))continue;
   if(this.labels.length>=8)break;if(!intersectsLakeBounds([n.center[0],n.center[1],n.center[0],n.center[1]],bounds))continue;
   const a=this.map.project([n.bbox[0],n.bbox[1]]),b=this.map.project([n.bbox[2],n.bbox[3]]);
   if(Math.abs(b.x-a.x)<85||Math.abs(b.y-a.y)<45)continue;
   const p=this.map.project(n.center),box={left:origin.left+p.x-80,right:origin.left+p.x+80,top:origin.top+p.y-18,bottom:origin.top+p.y+18};
   if(box.left<origin.left+10||box.right>origin.right-10||box.top<origin.top+30||box.bottom>origin.bottom-30||[...blockers,...placed].some(r=>overlap(box,r)))continue;
   const el=document.createElement('div');el.className='lake-label';el.textContent=lang==='en'?n.name:n.zh||n.name;
   if(lang==='bi'&&n.zh){const small=document.createElement('small');small.textContent=n.name;el.append(small);}
   this.labels.push(new maplibregl.Marker({element:el,opacityWhenCovered:'0'}).setLngLat(n.center).addTo(this.map));placed.push(box);
  }
 }
 destroy(){++this.seq;for(const marker of this.labels)marker.remove();this.labels=[];for(const [event,fn]of [['movestart',this.start],['move',this.move],['moveend',this.end],['idle',this.idle],['error',this.error]])this.map.off(event,fn);}
}
