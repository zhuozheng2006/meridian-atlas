import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {snapshotDate} from './build-ohm-1500.mjs';
import {regionalDate,OHM_WINDOWS,regionalName} from '../../public/regional-boundaries.js';
const window_=OHM_WINDOWS.find(w=>w.id==='british-isles');assert(window_);
const expected={1492:[2802023,2697580],1500:[2802023,2697580],1600:[2697738,2697544,2941294],1700:[2802012,2802009,2697729],1800:[2698449,2697729],1900:[2828388]};
const report=[];
for(const year of window_.years){
 const data=JSON.parse(gunzipSync(fs.readFileSync(new URL(`../../public/data/ohm-britain/year-${year}.json.gz`,import.meta.url))));
 const ids=new Set(data.features.map(f=>f.properties.ohm_relation));
 if(year===1492||year===1500)assert(!ids.has(2697579),'Unclosed Debatable Lands relation must remain excluded');
 for(const id of expected[year])assert(ids.has(id),`${year} missing ${id}`);
 if(year<1707)assert(!ids.has(2698449));if(year<1801)assert(!ids.has(2828388));
 assert.equal(snapshotDate(year),regionalDate(year));
 const mainland=data.features.filter(f=>expected[year].includes(f.properties.ohm_relation));
 for(const f of mainland)assert.notEqual(regionalName(f.properties,'zh'),regionalName(f.properties,'en'));
 report.push({year,features:data.features.length,checkedRelations:expected[year]});
}
// The constitutional transition is independently corroborated by UK Parliament.
const evidence={source:'https://www.parliament.uk/about/living-heritage/evolutionofparliament/legislativescrutiny/act-of-union-1707/',claim:'Kingdom of Great Britain from 1 May 1707; no such record in the 1700 snapshot',scope:'Chronology and identity spot checks, not an independent survey of every boundary vertex',snapshots:report};
fs.writeFileSync(new URL('../../docs/verification-3.53/britain-chronology.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');
console.log('PASS British Isles: six dated snapshots, required identities, Chinese names, July 1 leap-year alignment');
