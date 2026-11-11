import {curvedBorders} from './border-curves.js';
import {boundaryMesh} from './boundary-mesh.js';
// Same complete-frame portrayal as 3.47; do not split by feature or alter input.
export function buildTerritoryFrame(raw,mode,phase){
 const country=mode==='country',display=mode==='curved'?curvedBorders(raw):raw;phase?.('curves');
 const lines=country?{type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'MultiLineString',coordinates:display.features.flatMap(f=>f.geometry?.type==='Polygon'?f.geometry.coordinates:f.geometry?.type==='MultiPolygon'?f.geometry.coordinates.flat():[])}}]}:boundaryMesh(display);
 phase?.('mesh');
 return {...display,features:[...display.features,...lines.features.map(f=>({...f,properties:{_atlasBoundaryLine:true}}))]};
}
