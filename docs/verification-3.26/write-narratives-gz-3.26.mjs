#!/usr/bin/env node
// Usage: node docs/verification-3.26/write-narratives-gz-3.26.mjs [--check]
// Writes the deterministic gzip mirror of public/data/enrichment/narratives.json: level 9, mtime
// bytes zeroed so the archive is byte-stable, and a round-trip check that the mirror decodes to
// exactly the JSON text. scripts/ is outside this round's write scope, so the step lives with the
// round's other tooling.
import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const checkOnly=process.argv.includes('--check');
const jsonPath=resolve(root,'public/data/enrichment/narratives.json');
const gzPath=resolve(root,'public/data/enrichment/narratives.json.gz');
const text=await readFile(jsonPath,'utf8');
const parsed=JSON.parse(text);
const out=gzipSync(Buffer.from(text),{level:9});
out[4]=out[5]=out[6]=out[7]=0;
const roundTrip=JSON.parse(gunzipSync(out).toString());
if(JSON.stringify(roundTrip)!==JSON.stringify(parsed))throw new Error('gzip mirror does not round-trip to the JSON file');
if(checkOnly){console.log(JSON.stringify({result:'checked',entries:parsed.entries.length,bytes:out.length},null,2));process.exit(0)}
await writeFile(gzPath,out);
console.log(JSON.stringify({result:'written',entries:parsed.entries.length,gzipBytes:out.length,jsonBytes:Buffer.byteLength(text)},null,2));
