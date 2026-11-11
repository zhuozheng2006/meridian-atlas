import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cachedCountryFrame,loadCountryFrame} from '../public/country-archive.js';
const root=new URL('../public/',import.meta.url),requests=[],originalFetch=globalThis.fetch;let fail=false;
globalThis.fetch=async url=>{requests.push(String(url));if(fail&&String(url).includes('1990'))throw Error('synthetic offline');return new Response(fs.readFileSync(new URL(String(url),root)))};
try{
 assert.equal(cachedCountryFrame(1950),null);
 const first=await loadCountryFrame(1950),before=requests.length,cached=cachedCountryFrame(1951);
 assert(cached);assert.equal(cached.date,'1951-07-01');assert.equal(cached.geometries,first.geometries);assert.equal(requests.length,before);
 assert.deepEqual(cached.records,first.catalog.records.filter(r=>r.startDate<='1951-07-01'&&r.endDate>='1951-07-01'));
 for(let year=1950;year<=1959;year++){const warm=cachedCountryFrame(year),ordinary=await loadCountryFrame(year);assert.deepEqual(warm,ordinary)}
 assert.equal(requests.length,before,'Same decade changes need no extra downloads');
 await loadCountryFrame(1900);await loadCountryFrame(1910);assert(cachedCountryFrame(1950));await loadCountryFrame(1920);
 assert.equal(cachedCountryFrame(1900),null,'Least recently used pack evicted');assert(cachedCountryFrame(1910));assert(cachedCountryFrame(1950));assert(cachedCountryFrame(1920));
 for(const year of [1885,2024,0,1950.5])assert.equal(cachedCountryFrame(year),null);
 fail=true;await assert.rejects(loadCountryFrame(1990),/offline/);assert.equal(cachedCountryFrame(1990),null);fail=false;await loadCountryFrame(1990);assert(cachedCountryFrame(1991));
 const report={passed:true,exactDates:10,initialRequests:before,warmDecadeAdditionalRequests:0,retainedPackLimit:3,evictionAndRetryVerified:true};
 fs.writeFileSync(new URL('../docs/verification-3.54/country-cache.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{globalThis.fetch=originalFetch;}
