#!/usr/bin/env node
// Usage: node scripts/places/content-balance.mjs [repo-root] [output.json]
// Region x era balance for events, city dossiers and (when present) attested places.
// Lives under scripts/places/ because that directory is this workstream's write scope;
// it reads public/data only and writes docs/verification-3.10/content-balance.json.
// No network, no third-party package. The baseline commit is read through git so the
// before/after delta stays reproducible from the repository itself.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(process.argv[2]||resolve(dirname(fileURLToPath(import.meta.url)),'../..'));
const outPath=resolve(root,process.argv[3]||'docs/verification-3.10/content-balance.json');
const BASELINE_REF='7ee94b4';
const read=async p=>readFile(resolve(root,p));
const gunzipJSON=async p=>JSON.parse(gunzipSync(await read(p)));
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');

// Six coarse eras used by the task brief, with three ancient sub-bins so that
// "classical" does not hide a 2,500-year internal gap. Assigning by start year is
// explicit; overlapping ranges are additionally counted per era below.
const ERAS=[
 {id:'prehistoric',zh:'史前（前3000以前）',en:'Prehistoric (before 3000 BCE)',start:-Infinity,end:-3001},
 {id:'ancient-early',zh:'上古早期（前3000—前1201）',en:'Early antiquity (3000–1201 BCE)',start:-3000,end:-1201},
 {id:'ancient-iron',zh:'上古铁器时代（前1200—前501）',en:'Iron-age antiquity (1200–501 BCE)',start:-1200,end:-501},
 {id:'classical',zh:'古典时代（前500—公元499）',en:'Classical (500 BCE–499 CE)',start:-500,end:499},
 {id:'medieval',zh:'中世纪（500—1499）',en:'Medieval (500–1499)',start:500,end:1499},
 {id:'early-modern',zh:'近代早期（1500—1799）',en:'Early modern (1500–1799)',start:1500,end:1799},
 {id:'modern',zh:'近代（1800—1945）',en:'Modern (1800–1945)',start:1800,end:1945},
 {id:'contemporary',zh:'当代（1946—）',en:'Contemporary (1946–)',start:1946,end:Infinity}
];
const COARSE={prehistoric:'prehistoric','ancient-early':'ancient','ancient-iron':'ancient',classical:'classical',medieval:'medieval','early-modern':'early-modern',modern:'modern',contemporary:'contemporary'};
const eraOf=year=>ERAS.find(e=>year>=e.start&&year<=e.end).id;

const tally=(items,keyFn)=>{const m={};for(const item of items){const k=keyFn(item);m[k]=(m[k]||0)+1}return m};
const matrix=(items,rKey,eKey)=>{const m={};for(const item of items){const r=rKey(item),e=eKey(item);(m[r]??={});m[r][e]=(m[r][e]||0)+1}return m};

const eventsBuffer=await read('public/data/events.json');
const events=JSON.parse(eventsBuffer);
const eventsGz=await gunzipJSON('public/data/events.json.gz');
const cityNarratives=await gunzipJSON('public/data/places/city-narratives.json.gz');
const profiles=await gunzipJSON('public/data/enrichment/profile-index.json.gz');
const narratives=JSON.parse(await read('public/data/enrichment/narratives.json'));

let attested=null;
try{attested=await gunzipJSON('public/data/places/attested-places.json.gz')}catch{}
let attestedEditorial=null;
try{attestedEditorial=JSON.parse(await read('editorial/attested-places.json'))}catch{}

const eventsByEra=matrix(events,e=>e.region,e=>eraOf(e.start));
const eventsByCoarseEra=matrix(events,e=>e.region,e=>COARSE[eraOf(e.start)]);
// A range event is also counted in every era its span overlaps; a point event stays single.
const overlap=matrix(events,e=>e.region,e=>ERAS.filter(x=>e.end>=x.start&&e.start<=x.end).map(x=>x.id));
const overlapFlat={};
for(const [region,eras] of Object.entries(overlap))for(const [era,n] of Object.entries(eras))overlapFlat[region+'.'+era]=n.length;

const regions=[...new Set(events.map(e=>e.region))].sort();
const THIN_THRESHOLD=3;
const thinCells=[];
for(const region of regions)for(const era of ERAS){
 const n=eventsByEra[region]?.[era.id]||0;
 const spanCount=overlapFlat[region+'.'+era.id]||0;
 if(n<THIN_THRESHOLD)thinCells.push({region,era:era.id,eraZh:era.zh,eventsByStart:n,eventsOverlappingEra:spanCount,gap:THIN_THRESHOLD-n});
}
thinCells.sort((a,b)=>a.eventsByStart-b.eventsByStart||a.region.localeCompare(b.region));

let baseline=null,delta=null;
try{
 const baselineEvents=JSON.parse(execFileSync('git',['show',BASELINE_REF+':public/data/events.json'],{cwd:root,maxBuffer:64*1024*1024}).toString());
 const baselineMatrix=matrix(baselineEvents,e=>e.region,e=>eraOf(e.start));
 const cellDelta={};
 for(const region of [...new Set([...regions,...baselineEvents.map(e=>e.region)])].sort())
  for(const era of ERAS){const before=baselineMatrix[region]?.[era.id]||0,after=eventsByEra[region]?.[era.id]||0;if(before||after)cellDelta[region+'.'+era.id]={before,after,delta:after-before};}
 baseline={ref:BASELINE_REF,total:baselineEvents.length,byRegion:tally(baselineEvents,e=>e.region),byEra:tally(baselineEvents,e=>eraOf(e.start)),byRegionEra:baselineMatrix};
 delta={total:events.length-baselineEvents.length,byRegionEra:cellDelta};
}catch(error){baseline={ref:BASELINE_REF,error:String(error.message).slice(0,200)};delta=null}

const cityRegions=tally(cityNarratives.entries,e=>e.region||'unassigned');
const report={
 schemaVersion:1,
 generatedAt:new Date().toISOString(),
 generator:'scripts/places/content-balance.mjs',
 purpose:'Quantify region x era content density before and after the 3.10 content expansion; thin cells drive the next authoring batch.',
 baselineRef:BASELINE_REF,
 inputs:{
  events:{path:'public/data/events.json',sha256:sha(eventsBuffer),count:events.length},
  eventsGz:{path:'public/data/events.json.gz',sha256:sha(await read('public/data/events.json.gz')),matchesUncompressed:JSON.stringify(eventsGz)===JSON.stringify(events)},
  cityNarratives:{path:'public/data/places/city-narratives.json.gz',sha256:sha(await read('public/data/places/city-narratives.json.gz')),entries:cityNarratives.entries.length,sources:cityNarratives.sources.length},
  enrichmentProfiles:{path:'public/data/enrichment/profile-index.json.gz',count:Object.keys(profiles.profiles).length},
  enrichmentNarratives:{path:'public/data/enrichment/narratives.json',entries:narratives.entries.length},
  attestedPlaces:attested?{path:'public/data/places/attested-places.json.gz',sha256:sha(await read('public/data/places/attested-places.json.gz')),records:attested.records?.length??null}:null
 },
 eras:ERAS.map(e=>({id:e.id,zh:e.zh,en:e.en,coarse:COARSE[e.id],start:e.start===-Infinity?null:e.start,end:e.end===Infinity?null:e.end})),
 events:{
  total:events.length,
  byRegion:tally(events,e=>e.region),
  byCoarseEra:tally(events,e=>COARSE[eraOf(e.start)]),
  byEra:tally(events,e=>eraOf(e.start)),
  byRegionEra:eventsByEra,
  overlappingRangesByRegionEra:overlapFlat,
  byCategory:tally(events,e=>e.category),
  byPrecision:tally(events,e=>e.precision),
  byLocationType:tally(events,e=>e.locationType),
  bySourceCount:tally(events,e=>String(e.sources.length)),
  distinctSourceHosts:Object.keys(tally(events.flatMap(e=>e.sources.map(s=>{try{return new URL(s.url).host}catch{return 'invalid'}})),h=>h)).sort(),
  withEditorialNotes:events.filter(e=>e.editorialNotes).length
 },
 thinCells:{threshold:THIN_THRESHOLD,cells:thinCells},
 cityNarratives:{entries:cityNarratives.entries.length,sources:cityNarratives.sources.length,byRegion:cityRegions,publishers:[...new Set(cityNarratives.sources.map(s=>s.publisher))].sort()},
 enrichment:{profiles:Object.keys(profiles.profiles).length,narratives:narratives.entries.length},
 attestedPlaces:attested?{records:attested.records.length,byRegion:tally(attested.records,r=>r.region),byEra:tally(attested.records,r=>eraOf(r.period.start)),quarantined:attested.quarantined?.length??0,reviewedCandidates:attestedEditorial?.entries?.length??null}:null,
 baseline,
 delta
};
await mkdir(dirname(outPath),{recursive:true});
await writeFile(outPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({result:'written',out:outPath,events:report.events.total,baseline:baseline.total??null,delta:delta?.total??null,thinCells:thinCells.length,eventsGzMatches:report.inputs.eventsGz.matchesUncompressed},null,2));
if(!report.inputs.eventsGz.matchesUncompressed)process.exitCode=1;
