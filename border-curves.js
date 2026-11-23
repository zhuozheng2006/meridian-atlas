// A reversible cartographic portrayal, never a replacement for source geometry.
// Corners are keyed globally so neighbours reuse the exact same curve in reverse.
const cache=new WeakMap(),plans=new WeakMap(),KM=111.195,MAX_CUT=4,MIN_CUT=.02,CHORD_ERROR=.002,GRID=1;
const key=p=>p[0]+','+p[1];
const rings=g=>g?.type==='Polygon'?g.coordinates:g?.type==='MultiPolygon'?g.coordinates.flat():[];
const area=r=>{let a=0;for(let i=1;i<r.length;i++)a+=r[i-1][0]*r[i][1]-r[i][0]*r[i-1][1];return a/2;};
const distance=(a,b,c)=>Math.hypot((a[0]-b[0])*c,a[1]-b[1])*KM;
const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
const bounds=points=>{let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(let i=0;i<points.length;i++){const x=points[i][0],y=points[i][1];if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}return [x0,y0,x1,y1];};
const overlap=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
function intersects(a,b,c,d){
 const ax=a[0],ay=a[1],bx=b[0],by=b[1],cx=c[0],cy=c[1],dx=d[0],dy=d[1];
 if((ax<bx?ax:bx)>(cx>dx?cx:dx)||(ax>bx?ax:bx)<(cx<dx?cx:dx)||(ay<by?ay:by)>(cy>dy?cy:dy)||(ay>by?ay:by)<(cy<dy?cy:dy))return false;
 const ab0=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax),ab1=(bx-ax)*(dy-ay)-(by-ay)*(dx-ax);
 const eps=1e-12;
 if((ab0<ab1?ab0:ab1)>eps||(ab0>ab1?ab0:ab1)<-eps)return false;
 const cd0=(dx-cx)*(ay-cy)-(dy-cy)*(ax-cx),cd1=(dx-cx)*(by-cy)-(dy-cy)*(bx-cx);
 return (cd0<cd1?cd0:cd1)<=eps&&(cd0>cd1?cd0:cd1)>=-eps;
}
function inside(p,t){
 const s0=cross(t[0],t[1],p),s1=cross(t[1],t[2],p),s2=cross(t[2],t[0],p);
 return (s0>=-1e-12&&s1>=-1e-12&&s2>=-1e-12)||(s0<=1e-12&&s1<=1e-12&&s2<=1e-12);
}
const touches=(a,b,t)=>inside(a,t)||inside(b,t)||intersects(a,b,t[0],t[1])||intersects(a,b,t[1],t[2])||intersects(a,b,t[2],t[0]);
function collide(a,b){
 const a0=a[0],a1=a[1],a2=a[2],b0=b[0],b1=b[1],b2=b[2];
 const ax0=a0[0]<a1[0]?(a0[0]<a2[0]?a0[0]:a2[0]):(a1[0]<a2[0]?a1[0]:a2[0]);
 const ax1=a0[0]>a1[0]?(a0[0]>a2[0]?a0[0]:a2[0]):(a1[0]>a2[0]?a1[0]:a2[0]);
 const bx0=b0[0]<b1[0]?(b0[0]<b2[0]?b0[0]:b2[0]):(b1[0]<b2[0]?b1[0]:b2[0]);
 const bx1=b0[0]>b1[0]?(b0[0]>b2[0]?b0[0]:b2[0]):(b1[0]>b2[0]?b1[0]:b2[0]);
 if(ax0>bx1||ax1<bx0)return false;
 const ay0=a0[1]<a1[1]?(a0[1]<a2[1]?a0[1]:a2[1]):(a1[1]<a2[1]?a1[1]:a2[1]);
 const ay1=a0[1]>a1[1]?(a0[1]>a2[1]?a0[1]:a2[1]):(a1[1]>a2[1]?a1[1]:a2[1]);
 const by0=b0[1]<b1[1]?(b0[1]<b2[1]?b0[1]:b2[1]):(b1[1]<b2[1]?b1[1]:b2[1]);
 const by1=b0[1]>b1[1]?(b0[1]>b2[1]?b0[1]:b2[1]):(b1[1]>b2[1]?b1[1]:b2[1]);
 if(ay0>by1||ay1<by0)return false;
 return inside(b0,a)||touches(a0,a1,b)||touches(a1,a2,b)||touches(a2,a0,b);
}
function cells(box,visit){
 for(let x=Math.floor(box[0]/GRID);x<=Math.floor(box[2]/GRID);x++)for(let y=Math.floor(box[1]/GRID);y<=Math.floor(box[3]/GRID);y++)visit(x+':'+y);
}
function makeCurve(n){
 const sampleKey=n.cut+':'+n.chordError;n.samples??=new Map();
 const saved=n.samples.get(sampleKey);if(saved){n.curve=saved.curve;n.envelope=saved.envelope;n.box=saved.box;return;}
 const [a,b]=n.ends,p=n.p,c=Math.cos(p[1]*Math.PI/180),cut=n.cut;
 const start=[p[0]+(a.p[0]-p[0])*cut/n.la,p[1]+(a.p[1]-p[1])*cut/n.la],end=[p[0]+(b.p[0]-p[0])*cut/n.lb,p[1]+(b.p[1]-p[1])*cut/n.lb];
 n.envelope=[start,p,end];
 n.box=[Math.min(start[0],p[0],end[0]),Math.min(start[1],p[1],end[1]),Math.max(start[0],p[0],end[0]),Math.max(start[1],p[1],end[1])];
 // For a quadratic, the maximum deviation from each sampled chord is
 // |start - 2*control + end| / (4*segments^2). Sample in canonical direction
 // once at the selected display tolerance; the source remains untouched.
 const bend=Math.hypot((start[0]-2*p[0]+end[0])*c,start[1]-2*p[1]+end[1])*KM;
 const segments=Math.max(4,Math.ceil(Math.sqrt(bend/(4*n.chordError))));
 const curve=new Array(segments+1);
 for(let i=0;i<=segments;i++){const t=i/segments,u=1-t,uu=u*u,ut2=2*u*t,tt=t*t;curve[i]=[uu*start[0]+ut2*p[0]+tt*end[0],uu*start[1]+ut2*p[1]+tt*end[1]];}
 n.curve=curve;
 n.samples.set(sampleKey,{curve:n.curve,envelope:n.envelope,box:n.box});while(n.samples.size>2)n.samples.delete(n.samples.keys().next().value);
}
function shorten(n){n.cut*=.5;if(n.cut<MIN_CUT)n.locked=true;else makeCurve(n);}
export function borderChordError(zoom){return !Number.isFinite(zoom)?.002:zoom<4?.1:zoom<6?.02:zoom<8?.005:.002;}
// A padded, quantized view keeps fine curve sampling near the reader. Outside
// it the same curves use the world-view sampling; no source vertex is changed.
export function borderViewport(bounds,zoom){
 if(!bounds||!Number.isFinite(zoom)||zoom<4)return null;
 let w=bounds.getWest(),e=bounds.getEast();const s=bounds.getSouth(),n=bounds.getNorth();
 if(![w,e,s,n].every(Number.isFinite)||s>n)return null;
 if(e<w)e+=360;if(e-w>=180)return null;
 return [Math.floor(w/5)*5-5,Math.max(-90,Math.floor(s/5)*5-5),Math.ceil(e/5)*5+5,Math.min(90,Math.ceil(n/5)*5+5)];
}
const inViewport=(p,box)=>{if(!box)return true;const x=p[0]+360*Math.round(((box[0]+box[2])/2-p[0])/360);return x>=box[0]&&x<=box[2]&&p[1]>=box[1]&&p[1]<=box[3];};
export function curvedBorders(collection,chordError=CHORD_ERROR,viewport=null){
 if(![.002,.005,.02,.1].includes(chordError))throw new RangeError('Unsupported border display tolerance');
 const viewKey=viewport?.join(',')||'';
 const cached=cache.get(collection);if(cached?.chordError===chordError&&cached.viewKey===viewKey)return cached.result;
 // Topology and collision envelopes depend only on source coordinates. Keep
 // that plan with the immutable frame; camera changes only resample its curves.
 let plan=plans.get(collection);
 if(!plan){plan=prepareBorderPlan(collection);plans.set(collection,plan);}
 const {nodes,ringList,basis}=plan;
 for(const [n,cut,locked] of basis){
  n.cut=cut;n.locked=locked;
  if(n.curve&&!locked){n.chordError=inViewport(n.p,viewport)?chordError:.1;makeCurve(n);}
 }
 // Unchanged rings keep their sampled coordinates and signed area. A pan
 // resamples only corners whose viewport tolerance changes. Two samples per
 // corner bound retained memory; source rings are never modified.
 const render=r=>{
  const {ns,ring}=r,state=ns.map(n=>n.curve&&!n.locked?n.curve:n.p);
  if(r.renderState?.every((value,i)=>value===state[i]))return r.rendered;
  const result=[];for(let i=0;i<ns.length;i++){const n=ns[i];if(n.curve&&!n.locked){const points=ns[(i+ns.length-1)%ns.length]===n.first?n.curve:n.curve.slice().reverse();result.push(...points);}else result.push(n.p);}result.push(result[0]);
  r.renderState=state;r.rendered=ns.some(n=>n.curve&&!n.locked)?result:ring;r.renderedArea=area(r.rendered);return r.rendered;
 };
 // Keep small components and holes recognisable without turning every corner
 // of a ring back into a staircase. Shorten affected cuts together, including
 // their neighbours' copy, then recheck all rings (area changes can cancel).
 while(true){
  const pending=new Set();
  for(const r of ringList){
   if(!r.ns.some(n=>n.curve&&!n.locked))continue;
   const before=r.sourceArea;render(r);const after=r.renderedArea;
   if(!before||after*before<=0||Math.abs(after/before-1)>.02)r.ns.filter(n=>n.curve&&!n.locked).forEach(n=>pending.add(n));
  }
  if(!pending.size)break;
  // Commit each adjustment together: feature order must not affect borders.
  pending.forEach(shorten);
 }
 const rendered=new Map(ringList.map(r=>[r.ring,render(r)]));
 const features=collection.features.map(f=>{const g=f.geometry;if(!g||!['Polygon','MultiPolygon'].includes(g.type))return f;return {...f,geometry:{...g,coordinates:g.type==='Polygon'?g.coordinates.map(r=>rendered.get(r)||r):g.coordinates.map(p=>p.map(r=>rendered.get(r)||r))}};});
 const result={...collection,features};cache.set(collection,{chordError,viewKey,result});return result;
}

function prepareBorderPlan(collection){
 const nodes=new Map(),edges=new Map(),ringList=[];
 const get=p=>{const id=key(p);if(!nodes.has(id))nodes.set(id,{id,p,neighbours:new Set(),locked:false});return nodes.get(id);};
 for(const f of collection.features)for(const ring of rings(f.geometry)){
  if(ring.length<4)continue;
  const ns=ring.slice(0,-1).map(get),closed=key(ring[0])===key(ring.at(-1));ringList.push({ring,ns,sourceArea:area(ring)});
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
  Object.assign(n,{first:a,ends:[a,b],cut,la,lb,chordError:CHORD_ERROR});makeCurve(n);
 }
 // Each curve lies entirely inside its corner triangle. Permit broad, flowing
 // corners only where that entire envelope is free of other original edges.
 // Unlike a nearest-distance rule this does not unnecessarily shorten a curve
 // just because the next edge lies safely outside the triangle.
 const candidates=[...nodes.values()].filter(n=>n.curve),envelopes=new Map();
 for(const n of candidates){
  const near=new Set(long);cells(n.box,k=>{const cell=grid.get(k);if(cell)for(let i=0;i<cell.length;i++)near.add(cell[i]);});
  while(!n.locked){
   let hit=false;const env=n.envelope;
   for(const e of near)if(e.a!==n&&e.b!==n&&touches(e.a.p,e.b.p,env)){hit=true;break;}
   if(!hit)break;shorten(n);
  }
  if(!n.locked)cells(n.box,k=>{let cell=envelopes.get(k);if(!cell){cell=[];envelopes.set(k,cell);}cell.push(n);});
 }
 // Two individually safe corner triangles must also be disjoint. Shortening
 // only shrinks these envelopes, so this index remains a conservative superset.
 while(true){
  const pending=new Set();
  for(let i=0;i<candidates.length;i++){
   const n=candidates[i];if(n.locked)continue;
   const near=new Set();cells(n.box,k=>{const cell=envelopes.get(k);if(cell)for(let j=0;j<cell.length;j++)near.add(cell[j]);});
   for(const other of near)if(n.id<other.id&&!other.locked&&overlap(n.box,other.box)&&collide(n.envelope,other.envelope)){pending.add(n);pending.add(other);}
  }
  if(!pending.size)break;pending.forEach(shorten);
 }
 return {nodes,ringList,basis:[...nodes.values()].map(n=>[n,n.cut,n.locked])};
}
