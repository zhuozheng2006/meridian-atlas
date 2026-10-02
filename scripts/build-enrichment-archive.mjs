// Serve the editorial enrichment narratives compressed. The plain .json stays the
// editable source of truth; this writes the deterministic .json.gz the reader fetches.
// Run: node scripts/build-enrichment-archive.mjs   (also part of npm run prepare:assets)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const dir=path.join(root,'public/data/enrichment');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
let written=0;
for(const name of ['narratives.json']){
 const source=path.join(dir,name);
 if(!fs.existsSync(source))continue;
 const raw=fs.readFileSync(source);
 // mtime=0 and a fixed OS byte keep the archive reproducible: rebuilding unchanged
 // input must not produce a new hash, otherwise every validation rerun looks dirty.
 const gz=zlib.gzipSync(raw,{level:9,mtime:0});
 fs.writeFileSync(source+'.gz',gz);
 const round=zlib.gunzipSync(fs.readFileSync(source+'.gz'));
 if(!round.equals(raw))throw Error('Round-trip mismatch for '+name);
 console.log(`${name}: ${raw.length} -> ${gz.length} bytes (${digest(raw).slice(0,12)} -> ${digest(gz).slice(0,12)})`);
 written++;
}
if(!written)throw Error('No enrichment archives were written');
