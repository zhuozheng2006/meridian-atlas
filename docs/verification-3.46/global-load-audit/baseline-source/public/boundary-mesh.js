// A display-only line network. Coordinates and every original segment are
// retained exactly; only coincident copies and degree-two path breaks vanish.
// No polygon union, tolerance, snapping, simplification or inferred closure.
const cache=new WeakMap();
const rings=g=>g?.type==='Polygon'?g.coordinates:g?.type==='MultiPolygon'?g.coordinates.flat():[];
const compare=(a,b)=>a<b?-1:a>b?1:0;
export function boundaryMesh(collection){
 if(cache.has(collection))return cache.get(collection);
 if(!Array.isArray(collection?.features))throw TypeError('Expected a GeoJSON FeatureCollection');
 const nodes=new Map(),positions=new WeakMap();
 const node=point=>{
  if(point&&typeof point==='object'&&positions.has(point))return positions.get(point);
  if(!Array.isArray(point)||point.length<2||!point.every(Number.isFinite))throw TypeError('Boundary position must contain finite coordinates');
  const key=JSON.stringify(point);
  if(!nodes.has(key))nodes.set(key,{key,point,edges:[],neighbours:new Set(),self:false});
  const result=nodes.get(key);positions.set(point,result);return result;
 };
 for(const feature of collection.features)for(const ring of rings(feature.geometry)){
  for(let i=1;i<ring.length;i++){
   let a=node(ring[i-1]),b=node(ring[i]);if(compare(a.key,b.key)>0)[a,b]=[b,a];
   if(a.neighbours.has(b))continue;a.neighbours.add(b);b.neighbours.add(a);
   const edge={a,b,used:false};
   // Preserve a degenerate source segment once, but do not let it interrupt
   // an otherwise continuous boundary through this position.
   if(a!==b){a.edges.push(edge);b.edges.push(edge);}else a.self=true;
  }
 }
 const ordered=[...nodes.values()].sort((a,b)=>compare(a.key,b.key));
 const orderedEdges=n=>n.edges.slice().sort((a,b)=>compare((a.a===n?a.b:a.a).key,(b.a===n?b.b:b.a).key));
 const lines=[];
 function walk(start,first){
  const line=[start.point.slice()];let here=start,edge=first;
  while(edge&&!edge.used){
   edge.used=true;const next=edge.a===here?edge.b:edge.a;line.push(next.point.slice());
   if(next===start||next.edges.length!==2)break;
   const onward=next.edges[0]===edge?next.edges[1]:next.edges[0];here=next;edge=onward;
  }
  lines.push(line);
 }
 // Every open path ends at a junction or an endpoint. Start there, so no
 // arbitrary split can make the same border look like disconnected strokes.
 for(const n of ordered){
  if(n.edges.length===2)continue;
  for(const e of orderedEdges(n))if(!e.used)walk(n,e);
 }
 // Any edges left belong to closed degree-two loops (or zero-length edges).
 // Canonical node/neighbour order makes output independent of feature/ring
 // direction without sorting every finely sampled curve segment.
 for(const n of ordered){
  if(n.edges.some(e=>!e.used))for(const e of orderedEdges(n))if(!e.used)walk(n,e);
  if(n.self)lines.push([n.point.slice(),n.point.slice()]);
 }
 const result={type:'FeatureCollection',features:lines.length?[{type:'Feature',properties:{},geometry:{type:'MultiLineString',coordinates:lines}}]:[]};
 cache.set(collection,result);return result;
}
