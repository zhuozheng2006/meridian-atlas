// Kept for the command documented in scripts/places/README.md.
// This file used to be a stale copy of the canonical validator and drifted out of
// date; it now runs the canonical one so both entry points agree by construction.
import {fileURLToPath} from 'node:url';
await import(new URL('../validate-city-narratives.mjs',import.meta.url).href);
