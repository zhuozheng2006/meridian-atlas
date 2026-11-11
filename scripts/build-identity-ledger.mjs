import fs from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>JSON.parse(p.endsWith('.gz')?gunzipSync(fs.readFileSync(path.join(root,p))):fs.readFileSync(path.join(root,p),'utf8'));
const records=read('public/data/catalog.json.gz').records, fast=read('public/data/fast/catalog.json.gz').records;
const audit=read('docs/verification-3.48/name-display-audit.json'), names=read('editorial/polity-display-names.json');
const index=read('public/data/enrichment/profile-index.json.gz'), narratives=read('public/data/enrichment/narratives.json').entries;
const flags=new Map(),add=(id,tag)=>{if(!flags.has(id))flags.set(id,new Set());flags.get(id).add(tag);};
for(const group of audit.labelCollisionGroups)for(const r of group.records)add(r.id,'label-collision');
for(const [field,tag] of [['topicAssociationCandidates','topic-link'],['directionalSourceNames','directional-name'],['existingTemporalConflictFlags','period-conflict']])for(const r of audit[field])add(r.id,tag);
const overrides=new Map(names.rules.flatMap(rule=>rule.targets.map(t=>[t.id,rule])));
const cases=[
 ['Roman Empire',117,'europe'],['Eastern Roman Empire',600,'europe'],['French Fourth Republic',1945,'europe'],['Denmark-Norway',1900,'europe'],['Kingdom of Great Britain',1945,'europe'],
 ['Han Dynasty',100,'east-asia'],['Qing Dynasty',1800,'east-asia'],['Tokugawa Shogunate',1800,'east-asia'],['Eastern Göktürks',620,'central-asia'],['Western Göktürks',620,'central-asia'],
 ['Maurya Empire',-250,'south-asia'],['Gupta Empire',400,'south-asia'],['Mughal Empire',1600,'south-asia'],
 ['Abbasid Caliphate',800,'west-asia'],['Ottoman Empire',1500,'west-asia'],['Safavid Dynasty',1600,'west-asia'],
 ['Khmer Empire',1300,'southeast-asia'],['Srivijaya',800,'southeast-asia'],['Majapahit',1400,'southeast-asia'],
 ['Kingdom of Axum',550,'africa'],['Mali Empire',1300,'africa'],['Songhai Empire',1550,'africa'],['Kingdom of Kongo',1500,'africa'],['Ethiopian Empire',1900,'africa'],['British Africa',1900,'africa'],
 ['Inca Empire',1500,'americas'],['Aztec Triple Alliance',1500,'americas'],['Later Mayan City-States',1400,'americas'],['United States of America',1900,'americas'],["Republic of Hawai'i",1896,'oceania']
];
const samples=cases.map(([name,year,region])=>{
 const r=records.find(r=>r.name===name&&r.start<=year&&r.end>=year);assert(r,`${name} ${year}`);
 const b=index.records[r.id],profile=b&&index.profiles[b.qid]?read('public/data/enrichment/'+index.profiles[b.qid].file):null;
 const fieldSummary=k=>(profile?.fields[k]||[]).map(s=>({statementId:s.statementId,displayGroup:s.displayGroup,hasReferences:!!s.references?.length,sourceUrl:s.sourceUrl,qualifiers:s.qualifiers}));
 const n=narratives.filter(n=>n.sourceNames?.includes(name)&&n.recordIdsOverlappingScope?.includes(r.id));
 const correction=overrides.get(r.id),f=fast.find(f=>f.id===r.id);assert(['id','name','start','end','type','verifiedWikidata'].every(k=>f[k]===r[k]));
 return {id:`sample:${r.id}:${year}`,recordId:r.id,name,year,region,reviewScope:'Record identity, date, binding and evidence inventory; not an independent validation of all historical claims.',status:correction?'display-corrected':'needs-source-review',checks:{identity:{sourceQid:r.verifiedWikidata||null,sourceTitle:r.wikipediaCanonicalTitle||r.wikipedia||null,bindingQid:b?.qid||null,correction:correction?.id||null},period:{start:r.start,end:r.end,selectedYearInsideRecord:true,compatibility:b?.temporalCompatibility||null},geometry:{geometryId:r.geometryId,extent:r.bbox,review:'source-retained-not-revalidated'},capitals:fieldSummary('capital'),rulers:fieldSummary('headsOfState'),succession:[...fieldSummary('predecessors'),...fieldSummary('successors')],events:{association:'name-and-period-discovery',verifiedParticipation:false}},sources:[...(correction?.sourceIds.map(id=>names.sources.find(s=>s.id===id))||[]),...n.flatMap(n=>n.sources||[])].map(s=>({title:s.title,url:s.url})),followUp:correction?'Review geometry and dated relations separately.':'Verify the linked entity and date-qualified relations against independent sources.'};
});
const entries=records.map(r=>{const correction=overrides.get(r.id),tags=[...(flags.get(r.id)||[])];if(correction?.id==='britain-union-transition')tags.push('crosses-identity-transition');return {id:r.id,sourceName:r.name,nameZh:correction?.display.zh||r.zhName||r.name,nameEn:correction?.display.en||r.name,start:r.start,end:r.end,type:r.type,sourceEntity:r.verifiedWikidata||null,status:correction?'display-corrected':tags.length?'needs-review':'not-reviewed',flags:tags,correctionId:correction?.id||null,sourceIds:correction?.sourceIds||[],linkedEntityUse:correction?.linkedEntityUse||'existing-guarded-binding'};});
const statusCounts=Object.fromEntries(['display-corrected','needs-review','not-reviewed'].map(s=>[s,entries.filter(r=>r.status===s).length]));
const output={schemaVersion:1,version:'3.49.0',reviewedOn:'2026-11-11',scope:'Cliopatria catalog only. Regional layers, all historical facts and all geometry are outside this audit.',policy:{flags:'Screening leads, not confirmed errors. A display correction does not close geometry or fact review.',identity:'Record IDs remain source identifiers. Encyclopedia QIDs remain candidate associations; no new authoritative polity identity is inferred.',samples:'Thirty representative dossiers have reproducible six-part evidence inventories. Unverified claims remain pending, including samples with no screening flag.'},baseline:{path:'docs/verification-3.48/name-display-audit.json',sha256:createHash('sha256').update(fs.readFileSync(path.join(root,'docs/verification-3.48/name-display-audit.json'))).digest('hex')},counts:{records:entries.length,polities:entries.filter(r=>r.type==='POLITY').length,status:statusCounts,flaggedRecords:entries.filter(r=>r.flags.length).length,flagOccurrences:entries.reduce((n,r)=>n+r.flags.length,0),sampleDossiers:samples.length},sources:Object.fromEntries(names.sources.map(s=>[s.id,{title:s.title,url:s.url,publisher:s.publisher,readOn:s.readOn}])),entries,samples};
const dest=path.join(root,'public/data/quality/identity-ledger.json.gz'),bytes=gzipSync(JSON.stringify(output),{level:9});
if(process.argv.includes('--check'))assert.deepEqual(read('public/data/quality/identity-ledger.json.gz'),output);else{fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);}
console.log(JSON.stringify({ok:true,...output.counts,bytes:bytes.length}));
