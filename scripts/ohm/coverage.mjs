// Land-sampling coverage for the frozen OHM extract. The atlas draws land from
// public/data/land.geojson, so the same mask decides how much of the window a year really covers.
// A point counts as covered when it falls inside a frozen polygon (outside its holes).
export const COVERAGE_VERDICTS=['good','partial','sparse'];
export function ringContains(point,ring){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const [xi,yi]=ring[i],[xj,yj]=ring[j];
  if((yi>point[1])!==(yj>point[1])&&point[0]<(xj-xi)*(point[1]-yi)/(yj-yi)+xi)inside=!inside;
 }
 return inside;
}
export function geometryContains(point,polygons){
 for(const polygon of polygons){
  if(!polygon.length)continue;
  const outer=polygon[0];
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const [x,y] of outer){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
  if(point[0]<minX||point[0]>maxX||point[1]<minY||point[1]>maxY)continue;
  if(!ringContains(point,outer))continue;
  let inHole=false;
  for(const hole of polygon.slice(1))if(ringContains(point,hole)){inHole=true;break;}
  if(!inHole)return true;
 }
 return false;
}
export function preparePiercing(features){
 return features.map(feature=>{
  const geometry=feature.geometry,polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
  const solids=polygons.map(polygon=>{
   const outer=polygon[0];let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
   for(const [x,y] of outer){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
   return {outer,holes:polygon.slice(1),minX,maxX,minY,maxY};
  });
  return {properties:feature.properties,solids};
 });
}
export function covers(prepared,point){
 for(const entry of prepared){
  for(const solid of entry.solids){
   if(point[0]<solid.minX||point[0]>solid.maxX||point[1]<solid.minY||point[1]>solid.maxY)continue;
   if(!ringContains(point,solid.outer))continue;
   let inHole=false;
   for(const hole of solid.holes)if(ringContains(point,hole)){inHole=true;break;}
   if(!inHole)return true;
  }
 }
 return false;
}
export function landMask(land,bounds){
 const solids=[];
 for(const feature of land.features||[]){
  const geometry=feature.geometry;
  if(!geometry)continue;
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];
  for(const polygon of polygons){if(!polygon.length)continue;
   const outer=polygon[0];let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
   for(const [x,y] of outer){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
   if(maxX<bounds[0]||minX>bounds[2]||maxY<bounds[1]||minY>bounds[3])continue;
   solids.push({outer,holes:polygon.slice(1),minX,maxX,minY,maxY});
  }
 }
 return solids;
}
export function sampleGrid(bounds,steps=24){
 const points=[];
 for(let row=0;row<steps;row++)for(let column=0;column<steps;column++){
  points.push([bounds[0]+(bounds[2]-bounds[0])*(column+.5)/steps,bounds[1]+(bounds[3]-bounds[1])*(row+.5)/steps]);
 }
 return points;
}
export function pointOnLand(solids,point){
 for(const solid of solids){
  if(point[0]<solid.minX||point[0]>solid.maxX||point[1]<solid.minY||point[1]>solid.maxY)continue;
  if(!ringContains(point,solid.outer))continue;
  let inHole=false;
  for(const hole of solid.holes)if(ringContains(point,hole)){inHole=true;break;}
  if(!inHole)return true;
 }
 return false;
}
// Verdict thresholds are deliberately coarse; they only decide whether auto mode is allowed to
// leave the global overview for a year, never whether a real record may be drawn.
export function coverageVerdict(ratio,records){
 if(!Number.isFinite(ratio)||records<8)return 'sparse';
 return ratio>=.45?'good':ratio>=.12?'partial':'sparse';
}
export function coverageOf(land,features,bounds,steps=24){
 const mask=landMask(land,bounds),prepared=preparePiercing(features),points=sampleGrid(bounds,steps);
 let landPoints=0,covered=0;const samples=[];
 for(const point of points){
  if(!pointOnLand(mask,point))continue;
  landPoints++;
  if(covers(prepared,point)){covered++;samples.push(point);}
 }
 const ratio=landPoints?covered/landPoints:0;
 return {grid:steps,landSamples:landPoints,covered,ratio,verdict:coverageVerdict(ratio,features.length)};
}
