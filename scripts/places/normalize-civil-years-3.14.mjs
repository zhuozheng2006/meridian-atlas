#!/usr/bin/env node
// Usage: node scripts/places/normalize-civil-years-3.14.mjs [--check]
// The Wikidata harvest records P585 as an ISO 8601 date, whose year numbering is
// astronomical: year 0 exists and stands for 1 BCE, so ISO -489 is 490 BCE. The shipped
// corpus uses the project's civil-year convention, which has no year zero (year -1 is
// 1 BCE, year -490 is 490 BCE), exactly like public/data/catalog.json. This script
// converts the shipped structured-index events to that convention and rewrites the
// deterministic gzip mirror. Only start/end of provenance=wikidata-structured entries
// change; everything else is left byte-identical. The script is idempotent.
import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const checkOnly=process.argv.includes('--check');
const events=JSON.parse(await readFile(resolve(root,'public/data/events.json'),'utf8'));
const harvest=JSON.parse(await readFile(resolve(root,'editorial/battles-wikidata-source.json'),'utf8'));
const isoYear=new Map(harvest.items.map(item=>[item.qid,item.year]));
const changes=[];
for(const event of events){
 if(event.provenance!=='wikidata-structured')continue;
 const iso=isoYear.get(event.wikidataQid);
 if(!Number.isInteger(iso)||iso>0)continue;
 const civil=iso-1;
 if(event.start===civil&&event.end===civil)continue;
 changes.push({id:event.id,qid:event.wikidataQid,titleZh:event.title.zh,from:[event.start,event.end],to:[civil,civil]});
 event.start=civil;event.end=civil;
}
const output=JSON.stringify(events,null,2)+'\n';
const gzip=gzipSync(Buffer.from(output),{level:9});
gzip[4]=gzip[5]=gzip[6]=gzip[7]=0;gzip[9]=255;
const roundTrip=JSON.parse(gunzipSync(gzip).toString());
if(JSON.stringify(roundTrip)!==JSON.stringify(events))throw new Error('gzip mirror does not round-trip');
const report={result:checkOnly?'checked':'normalized',policy:'Wikidata ISO 8601 astronomical years are converted to the project civil-year convention (no year zero) for provenance=wikidata-structured events; positive years are untouched.',
 changed:changes.length,examples:changes.slice(0,10),changes};
if(!checkOnly){
 await writeFile(resolve(root,'public/data/events.json'),output);
 await writeFile(resolve(root,'public/data/events.json.gz'),gzip);
}
console.log(JSON.stringify(report,null,1));
