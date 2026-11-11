import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {selectLedgerEntries} from '../public/identity-ledger.js';
import {polityName,polityNameEvidence,polityEntityAllowed} from '../public/polity-names.js';
import {periodChain} from '../public/polity-reader.js';
const gz=p=>JSON.parse(gunzipSync(fs.readFileSync(p))),data=gz('public/data/quality/identity-ledger.json.gz'),records=gz('public/data/fast/catalog.json.gz').records;
assert.equal(data.entries.length,13765);assert.equal(new Set(data.entries.map(r=>r.id)).size,13765);assert.equal(data.samples.length,30);
assert.equal(Object.values(data.counts.status).reduce((a,b)=>a+b,0),data.entries.length);
assert.equal(selectLedgerEntries(data,{samples:true}).length,30);
for(const status of ['display-corrected','needs-review','not-reviewed'])assert.equal(selectLedgerEntries(data,{status}).length,data.counts.status[status]);
assert.equal(selectLedgerEntries(data,{query:'clio-12921'}).length,1);
assert(selectLedgerEntries(data,{query:'英国'}).some(r=>r.id==='clio-12921'));
for(const s of data.samples){const r=records.find(r=>r.id===s.recordId);assert(r&&r.start<=s.year&&s.year<=r.end);assert(s.checks.geometry.review==='source-retained-not-revalidated');assert.equal(s.checks.events.verifiedParticipation,false);}
for(const [id,year,expected] of [['clio-09478',1750,'Kingdoms of Great Britain and Ireland'],['clio-10551',1800,'Britain and Ireland'],['clio-10551',1801,'Britain and Ireland'],['clio-12921',1945,'United Kingdom'],['clio-13653',2024,'United Kingdom']]){const r=records.find(r=>r.id===id);assert.equal(polityName(r,'en',year),expected);assert.equal(polityEntityAllowed(r,year),false);assert.equal(polityNameEvidence({...r,end:r.end+1},year),null);}
const france=records.find(r=>r.id==='clio-12933');assert(periodChain(records,france).every(r=>r.start===1945));
const uk=records.find(r=>r.id==='clio-12921');assert(periodChain(records,uk).every(r=>r.start>=1801));
const d=records.find(r=>r.id==='clio-11893');assert(periodChain(records,d).every(r=>r.start>=1815));
// A correction only resolves display identity, never silently closes every flag.
assert(data.entries.some(r=>r.status==='display-corrected'&&r.flags.length));
assert.equal(data.entries.find(r=>r.id==='clio-10551').flags.includes('crosses-identity-transition'),true);
const report={ok:true,records:data.entries.length,samples:data.samples.length,checks:['unique-record-coverage','status-partition','search-and-sample-filter','sample-date-scope','british-transition-guards','corrected-period-chain-isolation','open-flags-preserved']};
fs.mkdirSync('docs/verification-3.49',{recursive:true});fs.writeFileSync('docs/verification-3.49/identity-ledger.json',JSON.stringify(report,null,2)+'\n');console.log(report);
