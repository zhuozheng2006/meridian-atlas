import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {curvedBorders} from '../public/border-curves.js';
const ring=points=>({type:'Polygon',coordinates:[points]});
const feature=(id,geometry)=>({type:'Feature',properties:{id,color:'#123456'},geometry});
const fc=features=>({type:'FeatureCollection',features});
const signedArea=r=>r.slice(1).reduce((a,p,i)=>a+r[i][0]*p[1]-p[0]*r[i][1],0)/2;
const a=[[0,0],[3,0],[3,1],[3.1,1],[3.1,2],[3,2],[3,3],[0,3],[0,0]];
const b=[[3,0],[6,0],[6,3],[3,3],[3,2],[3.1,2],[3.1,1],[3,1],[3,0]];
let count=0;function test(name,fn){fn();count++;console.log('PASS '+name);}
const freeze=o=>{if(o&&typeof o==='object'){Object.freeze(o);for(const v of Object.values(o))freeze(v);}return o;};
const input=freeze(fc([feature('left',ring(a)),feature('right',ring(b))]));
const result=curvedBorders(input),coords=result.features.map(f=>f.geometry.coordinates[0]);
test('Source remains immutable; results are cached and metadata retained',()=>{assert.equal(input.features[0].geometry.coordinates[0],a);assert.deepEqual(a[3],[3.1,1]);assert.equal(curvedBorders(input),result);assert.deepEqual(result.features.map(f=>f.properties),input.features.map(f=>f.properties));});
test('Shared stepped boundary gets exactly the same curve in reverse',()=>{
 const onShared=r=>r.filter(p=>p[0]>=3&&p[0]<=3.1&&p[1]>0&&p[1]<3);
 const left=onShared(coords[0]),right=onShared(coords[1]).reverse();assert(left.length>6);assert.deepEqual(left,right);
 assert(!coords[0].some(p=>p[0]===3.1&&p[1]===1),'Raster corner should be rounded');
});
test('All rings stay closed and fine outlines are not moved wholesale',()=>{for(const r of coords){assert.deepEqual(r[0],r.at(-1));assert(r.every(p=>p.every(Number.isFinite)));}assert(coords[0].some(p=>p[0]===0&&p[1]===0));});
test('Small components retain source shapes',()=>{const g=ring([[1,1],[1.001,1],[1.001,1.001],[1,1.001],[1,1]]);assert.deepEqual(curvedBorders(fc([feature('island',g)])).features[0].geometry,g);});
test('An unsplit T-junction stays pinned on the other polygon’s long edge',()=>{
 const top=ring([[0,1],[3,1],[3,3],[0,3],[0,1]]),touch=ring([[1,1],[.9,.8],[1,.7],[1.1,.8],[1,1]]);
 const after=curvedBorders(fc([feature('top',top),feature('touch',touch)])),points=after.features[1].geometry.coordinates[0];assert(points.some(p=>p[0]===1&&p[1]===1));assert(points.length>touch.coordinates[0].length,'Other safe corners are still curved');
});
test('Dateline and malformed open rings remain exactly as archived',()=>{
 for(const points of [[[179,1],[-179,1],[-179,2],[179,2],[179,1]],[[0,0],[2,0],[2,2],[0,2]]]){const g=ring(points);assert.deepEqual(curvedBorders(fc([feature('guard',g)])).features[0].geometry,g);}
});
test('Polygons with holes retain all components and ring directions',()=>{
 const g={type:'MultiPolygon',coordinates:[[a,[[1,1],[1,1.02],[1.02,1.02],[1.02,1],[1,1]]],[b]]};
 const after=curvedBorders(fc([feature('compound',g)])).features[0].geometry;assert.equal(after.coordinates.length,2);assert.equal(after.coordinates[0].length,2);
 const hole=after.coordinates[0][1],ratio=signedArea(hole)/signedArea(g.coordinates[0][1]);assert(ratio>0&&Math.abs(ratio-1)<=.02);assert(hole.every(p=>p[0]>=1&&p[0]<=1.02&&p[1]>=1&&p[1]<=1.02));
});
test('Area protection shortens a curve instead of restoring a whole rectangular staircase',()=>{
 const square=ring([[1,1],[1.02,1],[1.02,1.02],[1,1.02],[1,1]]),original=square.coordinates[0];
 const output=curvedBorders(fc([feature('small',square)])).features[0].geometry.coordinates[0];
 assert(output.length>original.length);assert(Math.abs(signedArea(output)/signedArea(original)-1)<=.02);
});
test('Narrow spaces and nonincident edge contacts remain protected',()=>{
 const obstacle=ring([[1.005,1.005],[1.015,1.005],[1.015,1.015],[1.005,1.015],[1.005,1.005]]);
 const outer=ring([[1,1],[2,1],[2,2],[1,2],[1,1]]);
 const output=curvedBorders(fc([feature('outer',outer),feature('obstacle',obstacle)]));
 assert.equal(output.features.length,2);assert(output.features[0].geometry.coordinates[0].some(p=>p[0]<1.005&&p[1]<1.005));
});
const mapFile=fileURLToPath(new URL('../public/map-engine.js',import.meta.url));
const revision=fs.readFileSync(mapFile,'utf8').match(/\?v=[a-zA-Z0-9.-]+/)?.[0]||'';
const {AtlasMap}=await import(pathToFileURL(mapFile).href+revision);
test('Switch restores exact source; fill and selection keep the same displayed polygons',()=>{
 const frames=[],atlas=Object.create(AtlasMap.prototype);Object.assign(atlas,{smoothBorders:true,boundaries:{isCountry:false},map:{getSource(id){assert.equal(id,'polities');return {setData(data){assert.equal(data.features.filter(f=>f.properties._atlasBoundaryLine).length,1);frames.push({...data,features:data.features.filter(f=>!f.properties._atlasBoundaryLine)});}};}}});
 atlas.displayTerritories(input);assert.notDeepEqual(frames.at(-1),input);atlas.setBorderCurves(false);assert.deepEqual(frames.at(-1),input);atlas.setBorderCurves(true);assert.deepEqual(frames.at(-1),result);
 atlas.boundaries.isCountry=true;atlas.displayTerritories(input);assert.deepEqual(frames.at(-1),input,'CShapes must retain original geometry');
});
console.log(`${count}/${count} border portrayal checks passed`);
