// A reversible cartographic portrayal, never a replacement for source geometry.
// Corners are keyed globally so neighbours reuse the exact same curve in reverse.
const cache=new WeakMap(),KM=111.195,MAX_CUT=4,MIN_CUT=.02,CHORD_ERROR=.002,GRID=1;
const key=p=>p[0]+','+p[1];
const rings=g=>g?.type==='Polygon'?g.coordinates:g?.type==='MultiPolygon'?g.coordinates.flat():[];
const area=r=>{let a=0;for(let i=1;i<r.length;i++)a+=r[i-1][0]*r[i][1]-r[i][0]*r[i-1][1];return a/2;};
const distance=(a,b,c)=>Math.hypot((a[0]-b[0])*c,a[1]-b[1])*KM;
const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
const bounds=points=>[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
const overlap=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
function intersects(a,b,c,d){
 if(!overlap(bounds([a,b]),bounds([c,d])))return false;
 const ab=[cross(a,b,c),cross(a,b,d)],cd=[cross(c,d,a),cross(c,d,b)],eps=1e-12;
 return Math.min(...ab)<=eps&&Math.max(...ab)>=-eps&&Math.min(...cd)<=eps&&Math.max(...cd)>=-eps;
}
function inside(p,t){
 const signs=t.map((a,i)=>cross(a,t[(i+1)%3],p));
 return Math.min(...signs)>=-1e-12||Math.max(...signs)<=1e-12;
}
const touches=(a,b,t)=>inside(a,t)||inside(b,t)||t.some((p,i)=>intersects(a,b,p,t[(i+1)%3]));
const collide=(a,b)=>overlap(bounds(a),bounds(b))&&(inside(b[0],a)||a.some((p,i)=>touches(p,a[(i+1)%3],b)));
function cells(box,visit){
 for(let x=Math.floor(box[0]/GRID);x<=Math.floor(box[2]/GRID);x++)for(let y=Math.floor(box[1]/GRID);y<=Math.floor(box[3]/GRID);y++)visit(x+':'+y);
}
function makeCurve(n){
 const [a,b]=n.ends,p=n.p,c=Math.cos(p[1]*Math.PI/180),cut=n.cut;
 const start=[p[0]+(a.p[0]-p[0])*cut/n.la,p[1]+(a.p[1]-p[1])*cut/n.la],end=[p[0]+(b.p[0]-p[0])*cut/n.lb,p[1]+(b.p[1]-p[1])*cut/n.lb];
 n.envelope=[start,p,end];
 // For a quadratic, the maximum deviation from each sampled chord is
 // |start - 2*control + end| / (4*segments^2). Sample in canonical direction
 // once at the selected display tolerance; the source remains untouched.
 const bend=Math.hypot((start[0]-2*p[0]+end[0])*c,start[1]-2*p[1]+end[1])*KM;
 const segments=Math.max(4,Math.ceil(Math.sqrt(bend/(4*n.chordError))));
 n.curve=Array.from({length:segments+1},(_,i)=>{const t=i/segments,u=1-t;return [u*u*start[0]+2*u*t*p[0]+t*t*end[0],u*u*start[1]+2*u*t*p[1]+t*t*end[1]];});
}
function shorten(n){n.cut*=.5;if(n.cut<MIN_CUT)n.locked=true;else makeCurve(n);}
export function borderChordError(zoom){return !Number.isFinite(zoom)?.002:zoom<4?.1:zoom<6?.02:zoom<8?.005:.002;}
export function curvedBorders(collection,chordError=CHORD_ERROR){
 if(![.002,.005,.02,.1].includes(chordError))throw new RangeError('Unsupported border display tolerance');
 const cached=cache.get(collection);if(cached?.chordError===chordError)return cached.result;
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
 // Index original edges, including ones with different subdivisions.
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
  const cut=Math.min(MAX_CUT,la*.45,lb*.45);
  if(cut<MIN_CUT)continue;
  Object.assign(n,{first:a,ends:[a,b],cut,la,lb,chordError});makeCurve(n);
 }
 // Each curve lies entirely inside its corner triangle. Permit broad, flowing
 // corners only where that entire envelope is free of other original edges.
 // Unlike a nearest-distance rule this does not unnecessarily shorten a curve
 // just because the next edge lies safely outside the triangle.
 const candidates=[...nodes.values()].filter(n=>n.curve),envelopes=new Map();
 for(const n of candidates){
  const near=new Set(long);cells(bounds(n.envelope),k=>{for(const e of grid.get(k)||[])near.add(e);});
  while(!n.locked&&[...near].some(e=>e.a!==n&&e.b!==n&&touches(e.a.p,e.b.p,n.envelope)))shorten(n);
  if(!n.locked)cells(bounds(n.envelope),k=>{if(!envelopes.has(k))envelopes.set(k,[]);envelopes.get(k).push(n);});
 }
 // Two individually safe corner triangles must also be disjoint. Shortening
 // only shrinks these envelopes, so this index remains a conservative superset.
 while(true){
  const pending=new Set();
  for(const n of candidates){
   if(n.locked)continue;
   const near=new Set();cells(bounds(n.envelope),k=>{for(const other of envelopes.get(k)||[])near.add(other);});
   for(const other of near)if(n.id<other.id&&!other.locked&&collide(n.envelope,other.envelope)){pending.add(n);pending.add(other);}
  }
  if(!pending.size)break;pending.forEach(shorten);
 }
 const render=({ns,ring})=>{
  if(!ns.some(n=>n.curve&&!n.locked))return ring;
  const result=[];for(let i=0;i<ns.length;i++){const n=ns[i];if(n.curve&&!n.locked){const points=ns[(i+ns.length-1)%ns.length]===n.first?n.curve:n.curve.slice().reverse();result.push(...points);}else result.push(n.p);}result.push(result[0]);return result;
 };
 // Keep small components and holes recognisable without turning every corner
 // of a ring back into a staircase. Shorten affected cuts together, including
 // their neighbours' copy, then recheck all rings (area changes can cancel).
 while(true){
  const pending=new Set();
  for(const r of ringList){
   if(!r.ns.some(n=>n.curve&&!n.locked))continue;
   const before=area(r.ring),after=area(render(r));
   if(!before||after*before<=0||Math.abs(after/before-1)>.02)r.ns.filter(n=>n.curve&&!n.locked).forEach(n=>pending.add(n));
  }
  if(!pending.size)break;
  // Commit each adjustment together: feature order must not affect borders.
  pending.forEach(shorten);
 }
 const rendered=new Map(ringList.map(r=>[r.ring,render(r)]));
 const features=collection.features.map(f=>{const g=f.geometry;if(!g||!['Polygon','MultiPolygon'].includes(g.type))return f;return {...f,geometry:{...g,coordinates:g.type==='Polygon'?g.coordinates.map(r=>rendered.get(r)||r):g.coordinates.map(p=>p.map(r=>rendered.get(r)||r))}};});
 const result={...collection,features};cache.set(collection,{chordError,result});return result;
}
