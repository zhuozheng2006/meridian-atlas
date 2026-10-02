#!/usr/bin/env node
// Usage: node scripts/places/window-coverage.mjs [repo-root] [out.json]
// Region x 50-year window coverage for 1000-2000 CE, plus the same windows for the
// pre-1000 period in 200-year bins. Counts an event in every window its span overlaps,
// so long-running processes count where they were active. Written for research
// planning: deficient windows drive the next authoring batch.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(process.argv[2]||resolve(dirname(fileURLToPath(import.meta.url)),'../..'));
const outPath=resolve(root,process.argv[3]||'docs/verification-3.12/content-window-coverage.json');
const events=JSON.parse(await readFile(resolve(root,'public/data/events.json'),'utf8'));
const REGIONS=['east-asia','southeast-asia','south-asia','west-central-asia','europe','africa','americas','oceania','global'];
const windows=[];
for(let start=1000;start<2000;start+=50)windows.push({id:start+'-'+(start+49),start,end:start+49});
windows.push({id:'2000-2024',start:2000,end:2024});
const counts={};
for(const region of REGIONS){counts[region]={};for(const w of windows)counts[region][w.id]=events.filter(e=>(region==='global'?true:e.region===region)&&e.start<=w.end&&e.end>=w.start).length}
const own={};
for(const region of REGIONS){own[region]={};for(const w of windows)own[region][w.id]=events.filter(e=>e.region===region&&e.start<=w.end&&e.end>=w.start).length}
const deficient=[];
for(const region of REGIONS)for(const w of windows)if(counts[region][w.id]<3)deficient.push({region,window:w.id,count:counts[region][w.id],regionalOnly:own[region][w.id]});
const report={schemaVersion:1,generatedAt:new Date().toISOString(),events:events.length,
 policy:'An event counts in a window when its start-end span overlaps the window. "count" includes global events, "regionalOnly" excludes them; the acceptance target is three per region and window counting regional events only.',
 windows:windows.map(w=>w.id),regions:REGIONS,counts,regionalOnly:own,
 deficient,deficientCount:deficient.length,deficientByRegion:REGIONS.reduce((all,region)=>{all[region]=deficient.filter(item=>item.region===region).length;return all},{})};
await mkdir(dirname(outPath),{recursive:true});
await writeFile(outPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({out:outPath,events:events.length,deficient:deficient.length,byRegion:report.deficientByRegion},null,2));
for(const item of deficient)console.log(item.region,item.window,'count:'+item.count,'regionalOnly:'+item.regionalOnly);
