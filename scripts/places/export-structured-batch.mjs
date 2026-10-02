#!/usr/bin/env node
// Usage: node scripts/places/export-structured-batch.mjs [out.json]
// Materialises the shipped structured-index events (provenance=wikidata-structured) back
// into an editorial batch document. Running it after an editorial upgrade pass makes the
// batch file match what is live: the exported batch no longer contains the upgraded
// entities, so re-applying it with scripts/places/apply-events-3.10.mjs reproduces the
// shipped index set instead of undoing authored work.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const outPath=resolve(root,process.argv.find(argument=>argument.endsWith('.json')&&!argument.startsWith('--'))||'editorial/events-wikidata-3.12.json');
const KEY_ORDER=['id','title','start','end','lat','lon','region','category','precision','locationType','summary','significance','sources','editorialNotes'];
const order=entry=>{const built={};for(const key of KEY_ORDER)if(entry[key]!==undefined)built[key]=entry[key];for(const key of Object.keys(entry))if(!(key in built))built[key]=entry[key];return built};
const events=JSON.parse(await readFile(resolve(root,'public/data/events.json'),'utf8'));
const entries=events.filter(event=>event.provenance==='wikidata-structured').map(order);
const editorial=events.filter(event=>!event.provenance&&/^v312wd-/.test(event.id)).map(event=>event.id);
const document={schemaVersion:1,generatedAt:new Date().toISOString(),
 note:'Materialised snapshot of the shipped structured-index events. It is exported from public/data/events.json after the 3.14 editorial upgrade pass, so the entities that were replaced by authored entries are absent and re-applying this batch reproduces the live index set. Dates follow the project civil-year convention (no year zero).',
 policy:{source:'Wikidata entity statements (P585 date, P625 coordinate, P710 participants, P361 conflict); statement reference URLs included when recorded.',
  language:'English text uses English labels only (QID fallback); Chinese text uses simplified labels; no transliteration or machine translation.',
  editorial:'No original synthesis: the bilingual text is a rendering of the source statements; entries are marked provenance=wikidata-structured.',
  region:'Region assigned by the documented coordinate box rule (regionBasis=coordinate-box).'},
 count:entries.length,upgradedIdsNotInBatch:editorial,entries};
await writeFile(outPath,JSON.stringify(document,null,2)+'\n');
console.log(JSON.stringify({out:outPath,entries:entries.length,upgradedIdsNotInBatch:editorial.length},null,1));
