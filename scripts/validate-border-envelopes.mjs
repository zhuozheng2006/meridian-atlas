import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const path=new URL('../public/border-curves.js',import.meta.url);
const source=await readFile(path,'utf8');
// Test the actual private predicates without modifying the checkout.
const m=await import('data:text/javascript;base64,'+Buffer.from(source+'\nexport {collide,touches,intersects,inside};').toString('base64'));
const sourceModuleSha256=createHash('sha256').update(source).digest('hex');
const results=[];function check(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.message});}}
const tri=[[0,0],[4,0],[0,4]],inner=[[.5,.5],[1,.5],[.5,1]];
check('Triangle containment is symmetric',()=>{assert(m.collide(inner,tri));assert(m.collide(tri,inner));});
check('Disjoint triangles with overlapping bounding boxes remain disjoint',()=>assert(!m.collide([[0,0],[2,0],[0,2]],[[2,2],[2,.5],[.5,2]])));
check('Envelope vertex touching is rejected',()=>assert(m.collide(tri,[[4,0],[5,0],[4,1]])));
check('Envelope collinear edge touching is rejected',()=>assert(m.collide(tri,[[1,0],[2,0],[1,-1]])));
check('An entire tiny source edge inside a corner envelope is detected',()=>assert(m.touches([.1,.1],[.11,.11],tri)));
check('An outside segment crossing the envelope is detected',()=>assert(m.touches([-1,1],[5,1],tri)));
check('A nearby noncrossing edge does not impose an artificial distance cutoff',()=>assert(!m.touches([2,2.2],[3,2.2],tri)));
const feature=(id,rings)=>({type:'Feature',properties:{id},geometry:{type:'Polygon',coordinates:rings}});
const fc=features=>({type:'FeatureCollection',features});
const area=r=>r.slice(1).reduce((a,p,i)=>a+r[i][0]*p[1]-p[0]*r[i][1],0)/2;
const tTop=[[0,1],[3,1],[3,3],[0,3],[0,1]],tDiamond=[[1,1],[.9,.8],[1,.7],[1.1,.8],[1,1]];
const fixtures=[
 {id:'unsplit-t',features:[feature('top',[tTop]),feature('diamond',[tDiamond])]},
 {id:'hole-in-corner',features:[feature('state',[[[0,0],[.5,0],[.5,.5],[0,.5],[0,0]],[[.01,.01],[.01,.012],[.012,.012],[.012,.01],[.01,.01]]])]},
 {id:'small-hole-area',features:[feature('state',[[[0,0],[.5,0],[.5,.5],[0,.5],[0,0]],[[.2,.2],[.2,.22],[.22,.22],[.22,.2],[.2,.2]]])]},
 {id:'thin-neck',features:[feature('neck',[[[0,0],[.2,0],[.2,.095],[.4,.095],[.4,0],[.6,0],[.6,.2],[.4,.2],[.4,.105],[.2,.105],[.2,.2],[0,.2],[0,0]]])]},
 {id:'close-islands',features:[feature('one',[[[0,0],[.1,0],[.1,.1],[0,.1],[0,0]]]),feature('two',[[[.102,.002],[.202,.002],[.202,.102],[.102,.102],[.102,.002]]])]},
 {id:'shared-stair',features:[feature('left',[[[0,0],[.3,0],[.3,.1],[.31,.1],[.31,.2],[.3,.2],[.3,.3],[0,.3],[0,0]]]),feature('right',[[[.3,0],[.6,0],[.6,.3],[.3,.3],[.3,.2],[.31,.2],[.31,.1],[.3,.1],[.3,0]]])]},
 {id:'subdivided-boundary',features:[feature('left',[[[0,0],[.2,0],[.2,.3],[0,.3],[0,0]]]),feature('right',[[[.2,0],[.4,0],[.4,.3],[.2,.3],[.2,.2],[.2,.1],[.2,0]]])]},
 {id:'tiny-island',features:[feature('tiny',[[[1,1],[1.001,1],[1.001,1.001],[1,1.001],[1,1]]])]}
];
const output=[];
for(const f of fixtures){
 const raw=fc(f.features),before=JSON.stringify(raw),curved=m.curvedBorders(raw);output.push({id:f.id,original:raw,curved});
 check(f.id+': source remains untouched and rings preserve direction/area',()=>{assert.equal(JSON.stringify(raw),before);for(let i=0;i<raw.features.length;i++){const a=raw.features[i].geometry.coordinates,b=curved.features[i].geometry.coordinates;assert.equal(a.length,b.length);for(let j=0;j<a.length;j++){assert(area(a[j])*area(b[j])>0);assert(Math.abs(area(b[j])/area(a[j])-1)<=.02000001);assert.deepEqual(b[j][0],b[j].at(-1));}}});
 check(f.id+': reversing feature order preserves exact per-feature geometry',()=>{const reversed=m.curvedBorders(fc([...raw.features].reverse()));for(const g of curved.features)assert.deepEqual(g.geometry,reversed.features.find(x=>x.properties.id===g.properties.id).geometry);});
 if(f.id==='unsplit-t')check('Unsplit T-junction genuinely exercises clearance on a four-vertex ring',()=>{const r=curved.features[1].geometry.coordinates[0];assert(r.some(p=>p[0]===1&&p[1]===1));assert(r.length>tDiamond.length);});
 if(f.id==='small-hole-area')check('Area fallback reduces curves instead of freezing this viable hole',()=>{assert(curved.features[0].geometry.coordinates[1].length>5);});
 if(f.id==='tiny-island')check('Sub-minimum tiny island remains exact',()=>assert.deepEqual(curved,raw));
}
const report={sourceModuleSha256,passed:results.filter(r=>r.passed).length,total:results.length,results};
console.log(JSON.stringify(report,null,2));if(report.passed!==report.total)process.exitCode=1;
