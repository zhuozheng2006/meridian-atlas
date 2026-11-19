// Interior label point: intersect a horizontal scanline with polygon rings,
// then use the midpoint of the widest inside interval (including holes).
function clipRing(ring,box){
 if(ring.length<4)return [];
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(let i=0;i<ring.length-1;i++){const x=ring[i][0],y=ring[i][1];if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
 if(maxX<box[0]||minX>box[2]||maxY<box[1]||minY>box[3])return [];
 if(minX>=box[0]&&maxX<=box[2]&&minY>=box[1]&&maxY<=box[3])return ring;
 let points=ring.slice(0,-1);
 for(const [axis,edge,sign] of [[0,box[0],1],[0,box[2],-1],[1,box[1],1],[1,box[3],-1]]){
  const next=[];if(!points.length)break;
  for(let i=0;i<points.length;i++){
   const a=points[(i+points.length-1)%points.length],b=points[i],ain=(a[axis]-edge)*sign>=0,bin=(b[axis]-edge)*sign>=0;
   if(ain!==bin){const t=(edge-a[axis])/(b[axis]-a[axis]);next.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
   if(bin)next.push(b);
  }
  points=next;
 }
 return points.length>=3?[...points,points[0]]:[];
}
export function interiorAnchor(geometry,box=null){
 const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];
 let best=null,score=0;
 for(const original of polygons){
  const rings=box?original.map(r=>clipRing(r,box)).filter(r=>r.length):original;
  const outer=rings[0];if(!outer?.length)continue;
  let lo=Infinity,hi=-Infinity;for(const p of outer){lo=Math.min(lo,p[1]);hi=Math.max(hi,p[1]);}
  for(const ratio of [.5,.35,.65]){
   const y=lo+(hi-lo)*ratio,xs=[];
   for(const ring of rings)for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i];if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}
   xs.sort((a,b)=>a-b);
   for(let i=0;i+1<xs.length;i+=2){const width=xs[i+1]-xs[i],area=width*(hi-lo);if(area>score){score=area;best=[(xs[i]+xs[i+1])/2,y];}}
  }
 }
 return best?{coordinate:best,score}:null;
}
export const interiorPoint=(geometry,box=null)=>interiorAnchor(geometry,box)?.coordinate||null;
const ringContains=([x,y],ring)=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;};
export function pointInGeometry(point,geometry){
 if(!point||!geometry)return false;
 const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];
 for(const poly of polygons){if(!poly.length||!ringContains(point,poly[0]))continue;let inHole=false;for(let r=1;r<poly.length;r++)if(ringContains(point,poly[r])){inHole=true;break;}if(!inHole)return true;}
 return false;
}
