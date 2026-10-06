import fs from 'node:fs';
const input=new URL('../public/data/research-evidence/readings-3.39/catalog.json',import.meta.url),output=new URL('../public/research-reading-data.js',import.meta.url);
const catalog=JSON.parse(fs.readFileSync(input,'utf8'));
const code='// Reading leads are a separate sourced overlay, never replacements for workbook rows.\nconst freeze=value=>{if(value&&typeof value===\'object\'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};\nexport const READING_CATALOG=freeze('+JSON.stringify(catalog)+');\n';
if(process.argv.includes('--check')){if(fs.readFileSync(output,'utf8')!==code)throw Error('Stale reading catalog module');console.log('PASS Reading catalog matches its reviewed JSON');}else{fs.writeFileSync(output,code);console.log('Built '+catalog.cards.length+' sourced reading leads');}
