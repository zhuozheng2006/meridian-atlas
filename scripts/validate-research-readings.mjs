import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {READING_CATALOG as catalog} from '../public/research-reading-data.js';
import {readingsForPhase,readingLocator,readingByline,mountReadingGuide} from '../public/research-reading-guide.js';
import {SNAPSHOT} from '../public/polaris-contract.js';
const root=new URL('../public/',import.meta.url),gz=file=>JSON.parse(gunzipSync(fs.readFileSync(new URL('data/seshat-polaris-2026/'+file,root))));
const index=gz('index.json.gz'),sources={sources:catalog.sourceManifests.flatMap(file=>JSON.parse(fs.readFileSync(new URL(file,root))).sources)},sourceMap=new Map(sources.sources.map(s=>[s.sourceId,s])),rows=new Map(index.polities.filter(p=>catalog.cards.some(c=>c.phaseId===p.id)).flatMap(p=>gz(p.file).observations).map(r=>[r.id,r]));
let checks=0;function test(name,fn){fn();checks++;console.log('PASS '+name);}
class Node {constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.dataset={};this.listeners={};this._text='';}set textContent(s){this._text=String(s);this.children=[];}get textContent(){return this._text+this.children.map(n=>n.textContent).join(' ');}set innerHTML(s){throw Error('Unsafe HTML');}append(...nodes){this.children.push(...nodes);}addEventListener(name,fn){this.listeners[name]=fn;}}
const doc={createElement:tag=>new Node(tag,doc)},walk=n=>[n,...n.children.flatMap(walk)];
test('Reading leads bind exact snapshot, existing phase/variable/row IDs without altering records',()=>{assert.equal(catalog.sourceSha256,SNAPSHOT.sourceSha256);assert.equal(catalog.cards.length,35);assert.equal(new Set(catalog.cards.map(c=>c.phaseId)).size,13);assert.equal(new Set(catalog.cards.map(c=>c.id)).size,35);for(const c of catalog.cards){assert(['direct-evidence','comparative-reading','earlier-coded-version'].includes(c.relation));assert.equal(c.sourceLineageEstablished,false);assert.equal(c.allowRecordMerge,false);assert.equal(c.allowRawRewrite,false);for(const id of c.targetRowIds){const r=rows.get(id);assert(r,id);assert.equal(r.raw.polity_id,c.phaseId);assert(c.variableIds.includes(r.raw.variable_name));}}});
test('Every preserved source file retains exact bytes and SHA-256',()=>{assert.equal(sources.sources.length,15);for(const s of sources.sources){const bytes=fs.readFileSync(new URL(s.localURL,root));assert.equal(bytes.length,s.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),s.sha256);}});
test('All card source links, locators, authors and bilingual text match preserved evidence',()=>{for(const c of catalog.cards){const s=sourceMap.get(c.sourceId);assert(s);assert.equal(c.sourceSha256,s.sha256);assert.equal(c.localURL,s.localURL);assert.equal(new URL(c.url).protocol,'https:');for(const field of ['titleZh','titleEn','summaryZh','summaryEn','scopeZh','scopeEn'])assert(typeof c[field]==='string'&&c[field].trim());assert(c.authors.length);for(const page of c.locator.pdfPages||[])assert(Number.isInteger(page)&&page>=1&&page<=s.pdfPages);}});
test('Phase, domain and variable filtering use identities rather than name similarity',()=>{assert.equal(readingsForPhase('cn_ming_dyn').length,5);assert.equal(readingsForPhase('cn_ming_dyn',{domain:'scale'}).length,2);assert.equal(readingsForPhase('cn_ming_dyn',{variable:'formal_legal_code'}).length,1);assert.equal(readingsForPhase('pe_inca_emp',{domain:'crisis'}).length,2);assert.equal(readingsForPhase('Ming Dynasty').length,0);assert.equal(readingsForPhase('cn_ming_dyn',{variable:'polity_population',domain:'crisis'}).length,0);});
test('Bilingual locators distinguish PDF pages, printed pages and logical CSV records',()=>{assert.match(readingLocator({pdfPages:[71],printedPages:['69']},'zh'),/PDF 第 71 页.*书页 69/);assert.match(readingLocator({csvRecordNumberWithHeader:16},'en'),/CSV record 16 \(including header\)/);});
test('Reader renders saved originals at exact pages, independent provenance and stable folding',()=>{const before=JSON.stringify(catalog);let toggled;const panel=mountReadingGuide(doc,{phaseId:'cn_ming_dyn',filters:{variable:'polity_population'},lang:'zh',open:true,onToggle:v=>toggled=v});assert(panel.open);const nodes=walk(panel),cards=nodes.filter(n=>n.className==='research-reading-card');assert.equal(cards.length,2);const links=nodes.filter(n=>n.tagName==='a');assert(links.some(n=>n.href.endsWith('deng2003-lse.pdf#page=71')));assert.match(panel.textContent,/1502/);assert.match(panel.textContent,/SHA-256/);panel.open=false;panel.listeners.toggle();assert.equal(toggled,false);assert.equal(JSON.stringify(catalog),before);assert.equal(mountReadingGuide(doc,{phaseId:'unknown'}),null);});
test('Source text is inert and executable link protocols are rejected',()=>{const custom=structuredClone(catalog);custom.cards=custom.cards.slice(0,1);custom.cards[0].titleZh='<img src=x onerror=alert(1)>';const panel=mountReadingGuide(doc,{phaseId:'cn_ming_dyn',lang:'zh',catalog:custom});assert(panel.textContent.includes('<img'));assert(!walk(panel).some(n=>n.tagName==='img'));custom.cards[0].landingURL='javascript:alert(1)';assert.throws(()=>mountReadingGuide(doc,{phaseId:'cn_ming_dyn',catalog:custom}),/Invalid reading source URL/);});
test('Earlier Crisis coding remains a distinct snapshot and keeps its documented conflict',()=>{const older=catalog.cards.filter(c=>c.relation==='earlier-coded-version');assert.equal(older.length,5);assert(older.every(c=>c.sourceRecordId.startsWith('sha256:9f7b50a31f249bc0421c96dd958519b6e4d8aa3af56aaceb6aa1215fafc04368:csv-record:')));assert(older.some(c=>c.conflicts.length));});
test('Version conflicts remain legible in the selected language with both original codes',()=>{const panel=mountReadingGuide(doc,{phaseId:'it_roman_rep_3',filters:{domain:'crisis'},lang:'zh'}),node=walk(panel).find(n=>n.className==='research-reading-differences');assert(node);assert.match(node.textContent,/旧版码值与新版不同/);assert.match(node.textContent,/assassin: 0/);assert.match(node.textContent,/assassination: P/);assert(!node.textContent.includes('noteEn'));assert(!node.textContent.includes('The older code'));});
test('New reading collections preserve all previously reviewed cards and add exact regional associations',()=>{
 const previous=JSON.parse(fs.readFileSync(new URL('data/research-evidence/readings-3.39/catalog.json',root)));
 assert.deepEqual(catalog.cards.slice(0,previous.cards.length),previous.cards);
 for(const [phase,count] of [['ml_mali_emp',2],['in_mauryan_emp',3],['kh_angkor_2',1],['kh_angkor_3',2]])assert.equal(readingsForPhase(phase).length,count);
 assert.equal(readingsForPhase('ml_mali_emp',{variable:'article'}).length,1);
 assert.equal(readingsForPhase('ml_mali_emp',{variable:'coin'}).length,0);
 const c=catalog.cards.find(c=>c.id==='angkor-late-population--kh_angkor_3');assert.equal(c.relation,'comparative-reading');assert.match(c.scopeZh,/70万—90万/);assert.match(c.scopeZh,/150万/);
});
test('Source table row intervals remain visible rather than disappearing from the locator',()=>{const c=catalog.cards.find(c=>c.id==='angkor-classical-population--kh_angkor_2');assert.match(readingLocator(c.locator,'zh'),/1113–1180.*1181–1300/);});
test('Reviewed claim locators and original observation values remain exact',()=>{
 const evidence=JSON.parse(fs.readFileSync(new URL('data/research-evidence/readings-3.40/claim-evidence.json',root)));
 assert.equal(evidence.claims.length,8);const targetIds=new Set();
 for(const claim of evidence.claims){const card=catalog.cards.find(c=>c.id===claim.cardId);assert(card);assert.deepEqual(card.locator,claim.verifiedSourceLocator);assert.deepEqual(card.targetRowIds,claim.targets.map(r=>r.id));for(const row of claim.targets){assert.deepEqual(row,rows.get(row.id));targetIds.add(row.id);}}
 assert.equal(targetIds.size,13);assert.equal(new Set(sources.sources.map(s=>s.sourceId)).size,sources.sources.length);
});
test('Long author lists stay compact while complete authors remain available in source details',()=>{
 const card=catalog.cards.find(c=>c.sourceId==='klassen-angkor-2021');assert.equal(card.authors.length,14);
 assert.equal(readingByline(card.authors,2021,'en'),card.authors.slice(0,3).join(' · ')+' et al. · 2021');
 const panel=mountReadingGuide(doc,{phaseId:'kh_angkor_2',lang:'zh'}),nodes=walk(panel);
 const byline=nodes.find(n=>n.className==='research-reading-byline');assert(!byline.textContent.includes(card.authors[13]));assert.match(byline.textContent,/等/);
 assert(nodes.find(n=>n.className==='research-reading-provenance').textContent.includes(card.authors[13]));
});

test('Asian source additions preserve prior cards, exact source rows and unknown edition years',()=>{
 const previous=['readings-3.39','readings-3.40'].flatMap(name=>JSON.parse(fs.readFileSync(new URL('data/research-evidence/'+name+'/catalog.json',root))).cards);
 assert.deepEqual(catalog.cards.slice(0,previous.length),previous);
 const evidence=JSON.parse(fs.readFileSync(new URL('data/research-evidence/readings-3.43/claim-evidence.json',root))),targetIds=new Set();
 assert.equal(evidence.claims.length,5);
 for(const claim of evidence.claims){const card=catalog.cards.find(c=>c.id===claim.cardId);assert.deepEqual(card.locator,claim.verifiedSourceLocator);assert.deepEqual(card.targetRowIds,claim.targets.map(r=>r.id));for(const row of claim.targets){assert.deepEqual(row,rows.get(row.id));targetIds.add(row.id);}}
 assert.equal(targetIds.size,7);assert.equal(readingsForPhase('iq_babylonia_1').length,3);assert.equal(readingsForPhase('jp_asuka').length,2);
 assert.equal(readingByline(['King'],null,'en'),'King');assert.equal(readingByline(['King'],undefined,'zh'),'King');
 const panel=mountReadingGuide(doc,{phaseId:'jp_asuka',lang:'zh'});assert(walk(panel).some(n=>n.href?.endsWith('taika-columbia.pdf#page=3')));
});
console.log(JSON.stringify({checks,passed:checks,cards:catalog.cards.length,sources:sources.sources.length}));
