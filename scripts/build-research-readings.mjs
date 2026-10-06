import fs from 'node:fs';
const root=new URL('../public/',import.meta.url),output=new URL('research-reading-data.js',root);
const collections=['readings-3.39','readings-3.40','readings-3.43','readings-3.44'].map(name=>JSON.parse(fs.readFileSync(new URL('data/research-evidence/'+name+'/catalog.json',root),'utf8')));
const [base]=collections,ids=new Set();
for(const collection of collections){
 if(collection.datasetId!==base.datasetId||collection.sourceSha256!==base.sourceSha256||collection.version!==base.version)throw Error('Reading collections refer to different observation snapshots');
 for(const card of collection.cards){if(ids.has(card.id))throw Error('Duplicate reading identity: '+card.id);ids.add(card.id);}
}
const catalog={...base,sourceManifests:collections.map(c=>c.sourceManifest),cards:collections.flatMap(c=>c.cards)};
const code='// Reading leads are a separate sourced overlay, never replacements for workbook rows.\nconst freeze=value=>{if(value&&typeof value===\'object\'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};\nexport const READING_CATALOG=freeze('+JSON.stringify(catalog)+');\n';
if(process.argv.includes('--check')){if(fs.readFileSync(output,'utf8')!==code)throw Error('Stale reading catalog module');console.log('PASS Reading catalog matches its reviewed JSON');}else{fs.writeFileSync(output,code);console.log('Built '+catalog.cards.length+' sourced reading leads');}
