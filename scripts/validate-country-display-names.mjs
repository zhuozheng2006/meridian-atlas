import assert from 'node:assert/strict';
import fs from 'node:fs';
import {countryName,countryAlias,loadCountryFrame,countryFeatures} from '../public/country-archive.js';
const root=new URL('../public/',import.meta.url),editorial=JSON.parse(fs.readFileSync(new URL('data/cshapes/name-periods.json',root)));
const originalFetch=globalThis.fetch;globalThis.fetch=async url=>new Response(fs.readFileSync(new URL(String(url),root)));
let annualCases=0;
try{
 for(const [name,years] of Object.entries(editorial.expectedJuly1))for(const [year,expected] of Object.entries(years)){
  const frame=await loadCountryFrame(+year),r=frame.records.find(r=>r.name===name);assert(r,`${year}: missing source record ${name}`);
  const before=JSON.stringify(r);assert.equal(countryName(r,'en',frame.date),expected);
  const f=countryFeatures(frame,()=> '#123456').find(f=>f.properties.id===r.id);assert.equal(f.properties.source_name,name);assert.equal(f.geometry,frame.geometries[r.geometryId]);assert.equal(JSON.stringify(r),before);annualCases++;
 }
 for(const rule of editorial.rules){
  const expected=Object.fromEntries(['sourceName','startDate','endDate','zh','en','sourceURLs'].map(k=>[k,rule[k]]));
  for(const date of [rule.startDate,rule.endDate])assert.deepEqual(countryAlias({name:rule.sourceName},date),expected);
  assert(!editorial.rules.some(other=>other!==rule&&other.sourceName===rule.sourceName&&other.startDate<=rule.endDate&&other.endDate>=rule.startDate),'Overlapping display periods');
 }
}finally{globalThis.fetch=originalFetch;}
const report={passed:true,annualCases,rules:editorial.rules.length,endpoints:editorial.rules.length*2,originalNamesAndGeometryPreserved:true};
fs.writeFileSync(new URL('../docs/verification-3.53/country-display-names.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
