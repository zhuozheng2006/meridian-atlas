import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {RESEARCH_POLITY_NAMES,researchPolityName,researchPolitySearchText} from '../public/research-polity-names.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const index=JSON.parse(gunzipSync(fs.readFileSync(path.join(root,'public/data/seshat/index.json.gz'))));
const phases=new Map(index.polities.map(p=>[p.id,p]));
let checks=0;
function check(name,fn){fn();checks++;console.log(`PASS ${name}`);}
check('display catalog binds only existing exact source IDs and names',()=>{
 assert.equal(Object.keys(RESEARCH_POLITY_NAMES).length,308);
 for(const [id,row]of Object.entries(RESEARCH_POLITY_NAMES)){
  const p=phases.get(id);assert(p,`unknown ${id}`);assert.deepEqual(row.names,p.names,id);assert(row.zh.trim());
  assert.equal(researchPolityName(p,'zh'),row.zh,id);assert(!('qid'in row));
 }
});
check('every East Asia phase has a Chinese display term',()=>{
 const selected=index.polities.filter(p=>p.regions.includes('EastAsia'));
 assert.equal(selected.length,40);for(const p of selected)assert(/[\u3400-\u9fff]/u.test(researchPolityName(p,'zh')),p.id);
});
check('Chinese Ming search, source-name search, IDs, areas and aliases work in the same index',()=>{
 const p=phases.get('CnMing*'),s=researchPolitySearchText(p);
 for(const query of ['明朝','明代','ming dynasty','cnming*',p.samplingAreas[0].toLowerCase()])assert(s.includes(query),query);
 assert.equal(researchPolityName(p,'zh'),'明朝');assert.equal(researchPolityName(p,'en'),'Ming Dynasty');
 assert.equal(researchPolityName(p,'bi'),'明朝 · Ming Dynasty');
});
check('late Tang and Jin preserve source-date meanings and do not bind unrelated dynasties',()=>{
 assert.equal(researchPolityName(phases.get('CnTangL'),'zh'),'唐朝后期');
 assert.equal(researchPolityName(phases.get('CnLrJin'),'zh'),'金朝（1127—1234）');
 for(const id of ['CnTangL','CnLrJin']){
  const p=structuredClone(phases.get(id));p.periods[0].startRaw='936.0';
  assert.equal(researchPolityName(p,'zh'),p.names.join(' / '));
 }
});
check('ambiguous Hmong phase segment remains available in English',()=>{
 assert.match(researchPolityName(phases.get('CnHChin'),'zh'),/Early Chinese/);
 assert.equal(RESEARCH_POLITY_NAMES.CnHChin.partial,true);
});
check('Jomon stage translations keep their distinct six source stages',()=>{
 assert.deepEqual([1,2,3,4,5,6].map(i=>researchPolityName(phases.get(`JpJomo${i}`),'zh')),['绳文时代 · 草创期','绳文时代 · 早期','绳文时代 · 前期','绳文时代 · 中期','绳文时代 · 后期','绳文时代 · 晚期']);
});
check('unreviewed source phases, unknown IDs and changed names retain original names',()=>{
 const remaining=index.polities.filter(p=>!RESEARCH_POLITY_NAMES[p.id]);assert.equal(remaining.length,65);
 for(const p of remaining)assert.equal(researchPolityName(p,'zh'),p.names.join(' / '));
 for(const id of ['Unknown','__proto__','constructor'])assert.equal(researchPolityName({id,names:['A source phase']},'zh'),'A source phase');
 const changed={...phases.get('CnMing*'),names:['A changed source interpretation']};
 assert.equal(researchPolityName(changed,'zh'),changed.names[0]);assert(!researchPolitySearchText(changed).includes('明朝'));
});
check('name helpers do not mutate source phases or original names including spaces',()=>{
 const before=JSON.stringify(index);
 for(const p of index.polities){for(const lang of ['zh','en','bi'])researchPolityName(p,lang);researchPolitySearchText(p);assert.equal(researchPolityName(p,'en'),p.names.join(' / '));}
 assert.equal(JSON.stringify(index),before);
});
check('display table and nested rows cannot be mutated',()=>{
 assert(Object.isFrozen(RESEARCH_POLITY_NAMES));
 for(const row of Object.values(RESEARCH_POLITY_NAMES)){
  assert(Object.isFrozen(row));assert(Object.isFrozen(row.names));if(row.aliases)assert(Object.isFrozen(row.aliases));
  if(row.periods){assert(Object.isFrozen(row.periods));for(const period of row.periods)assert(Object.isFrozen(period));}
 }
});
console.log(JSON.stringify({ok:true,checks,phases:index.polities.length,translated:308,englishFallback:65}));
