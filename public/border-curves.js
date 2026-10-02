// A reversible cartographic portrayal, never a replacement for source geometry.
// Corners are keyed globally so neighbours reuse the exact same curve in reverse.
const cache=new WeakMap(),KM=111.195,MAX_CUT=4,GRID=1;
const key=p=>p[0]+','+p[1];
const rings=g=>g?.type==='Polygon'?g.coordinates:g?.type==='MultiPolygon'?g.coordinates.flat():[];
const area=r=>{let a=0;for(let i=1;i<r.length;i++)a+=r[i-1][0]*r[i][1]-r[i][0]*r[i-1][1];return a/2;};
const distance=(a,b,c)=>Math.hypot((a[0]-b[0])*c,a[1]-b[1])*KM;
function segmentDistance(p,a,b,c){
 const ax=(a[0]-p[0])*c,ay=a[1]-p[1],bx=(b[0]-p[0])*c,by=b[1]-p[1],dx=bx-ax,dy=by-ay;
 const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));
 return Math.hypot(ax+t*dx,ay+t*dy)*KM;
}
function cells(box,visit){
 for(let x=Math.floor(box[0]/GRID);x<=Math.floor(box[2]/GRID);x++)for(let y=Math.floor(box[1]/GRID);y<=Math.floor(box[3]/GRID);y++)visit(x+':'+y);
}
export function curvedBorders(collection){
 if(cache.has(collection))return cache.get(collection);
 const nodes=new Map(),edges=new Map(),ringList=[];
 const get=p=>{const id=key(p);if(!nodes.has(id))nodes.set(id,{id,p,neighbours:new Set(),locked:false});return nodes.get(id);};
 for(const f of collection.features)for(const ring of rings(f.geometry)){
  if(ring.length<4)continue;
  const ns=ring.slice(0,-1).map(get),closed=key(ring[0])===key(ring.at(-1));ringList.push({ring,ns});
  const unsafe=!closed||ns.length<4||new Set(ns).size!==ns.length||ring.some((p,i)=>Math.abs(p[1])>80||(i&&Math.abs(p[0]-ring[i-1][0])>180));
  if(unsafe)ns.forEach(n=>n.locked=true);
  for(let i=0;i<ns.length;i++){
   const a=ns[i],b=ns[(i+1)%ns.length];if(a===b)continue;a.neighbours.add(b);b.neighbours.add(a);
   const forward=a.id<b.id,id=forward?a.id+'|'+b.id:b.id+'|'+a.id;
   if(!edges.has(id))edges.set(id,forward?{a,b}:{a:b,b:a});
  }
 }
 // Index original edges, including ones with different subdivisions. A corner
 // cannot curve through a T-junction, another shore, an enclave or a narrow neck.
 const grid=new Map(),long=[];
 for(const e of edges.values()){
  const [a,b]=[e.a.p,e.b.p],box=[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])];
  if((box[2]-box[0]+1)*(box[3]-box[1]+1)>100){long.push(e);continue;}
  cells(box,k=>{if(!grid.has(k))grid.set(k,[]);grid.get(k).push(e);});
 }
 for(const n of nodes.values()){
  if(n.locked||n.neighbours.size!==2)continue;
  const [a,b]=[...n.neighbours].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),p=n.p,c=Math.cos(p[1]*Math.PI/180),la=distance(p,a.p,c),lb=distance(p,b.p,c);
  // Leave straight survey-like runs and near-reversals alone.
  const cosine=((a.p[0]-p[0])*(b.p[0]-p[0])*c*c+(a.p[1]-p[1])*(b.p[1]-p[1]))/(la*lb/(KM*KM));
  if(!la||!lb||cosine<-.985||cosine>.85||(la>80&&lb>80))continue;
  let cut=Math.min(MAX_CUT,la*.45,lb*.45);
  const radius=cut/(.3*KM),near=new Set(long);cells([p[0]-radius/c,p[1]-radius,p[0]+radius/c,p[1]+radius],k=>{for(const e of grid.get(k)||[])near.add(e);});
  for(const e of near){if(e.a===n||e.b===n)continue;cut=Math.min(cut,segmentDistance(p,e.a.p,e.b.p,c)*.3);}
  if(cut<.02)continue;
  const start=[p[0]+(a.p[0]-p[0])*cut/la,p[1]+(a.p[1]-p[1])*cut/la],end=[p[0]+(b.p[0]-p[0])*cut/lb,p[1]+(b.p[1]-p[1])*cut/lb];
  n.first=a;n.curve=Array.from({length:7},(_,i)=>{const t=i/6,u=1-t;return [u*u*start[0]+2*u*t*p[0]+t*t*end[0],u*u*start[1]+2*u*t*p[1]+t*t*end[1]];});
 }
 const render=({ns,ring})=>{
  if(!ns.some(n=>n.curve&&!n.locked))return ring;
  const result=[];for(let i=0;i<ns.length;i++){const n=ns[i];if(n.curve&&!n.locked){const points=ns[(i+ns.length-1)%ns.length]===n.first?n.curve:n.curve.slice().reverse();result.push(...points);}else result.push(n.p);}result.push(result[0]);return result;
 };
 // Keep small components and holes recognisable. Lock their shared nodes too,
 // then repeat so neighbouring rings cannot diverge after a local fallback.
 while(true){
  const pending=new Set();
  for(const r of ringList){
   if(!r.ns.some(n=>n.curve&&!n.locked))continue;
   const before=area(r.ring),after=area(render(r));
   if(!before||after*before<=0||Math.abs(after/before-1)>.02)r.ns.forEach(n=>pending.add(n));
  }
  if(!pending.size)break;
  // Commit each fallback round together: feature order must not affect borders.
  pending.forEach(n=>n.locked=true);
 }
 const rendered=new Map(ringList.map(r=>[r.ring,render(r)]));
 const features=collection.features.map(f=>{const g=f.geometry;if(!g||!['Polygon','MultiPolygon'].includes(g.type))return f;return {...f,geometry:{...g,coordinates:g.type==='Polygon'?g.coordinates.map(r=>rendered.get(r)||r):g.coordinates.map(p=>p.map(r=>rendered.get(r)||r))}};});
 const result={...collection,features};cache.set(collection,result);return result;
}
