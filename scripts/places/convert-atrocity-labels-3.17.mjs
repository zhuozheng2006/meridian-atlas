#!/usr/bin/env node
// Usage: node scripts/places/convert-atrocity-labels-3.17.mjs
// The 3.15 sweep wrote the Chinese labels of the country/conflict/participant entities through a
// MediaWiki zh-cn conversion, so an entity whose Wikidata label exists only in traditional
// script (for example Q2889339, recorded as 英國殖民澳洲) is stored in the layer in simplified
// form (英国殖民澳洲) and cannot be matched back by string equality. This script converts every
// label variant of every referenced entity with the same Chinese Wikipedia converter
// (action=parse&variant=zh-cn) and stores the result next to the original, so the English
// alignment can match the recorded string without guessing.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const UA='MeridianAtlasResearch/3.17 (source-linked world history atlas; label conversion)';
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const path=resolve(root,'docs/verification-3.17/atrocities-evidence.json');
const evidence=JSON.parse(await readFile(path,'utf8'));
const values=new Set();
for(const label of Object.values(evidence.labels))for(const value of Object.values(label.zhVariant||{}))if(value)values.add(value);
const conversions={};
const requests=[];
for(const value of values){
 let converted=null;
 for(let attempt=1;attempt<=4;attempt++){
  const response=await fetch('https://zh.wikipedia.org/w/api.php?action=parse&format=json&formatversion=2&contentmodel=wikitext&variant=zh-cn&prop=text&text='+encodeURIComponent(value),{headers:{'user-agent':UA,accept:'application/json'}});
  requests.push({endpoint:'zh.wikipedia action=parse',status:response.status,attempt,at:new Date().toISOString()});
  if(response.ok){
   const data=await response.json();
   converted=(data.parse?.text||'').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').trim();
   break;
  }
  if(response.status!==429&&response.status<500)throw new Error('HTTP '+response.status);
  await sleep(15000*attempt);
 }
 conversions[value]=converted;
 await sleep(1100);
}
for(const label of Object.values(evidence.labels)){
 label.zhSimplifiedVariants={};
 for(const [lang,value] of Object.entries(label.zhVariant||{}))label.zhSimplifiedVariants[lang]=conversions[value]||value;
}
evidence.labelConversion={convertedAt:new Date().toISOString(),endpoint:'https://zh.wikipedia.org/w/api.php action=parse variant=zh-cn',
 policy:'Every Chinese label variant of every entity referenced by the atrocity layer through P17/P361/P710 was converted to simplified script with the Chinese Wikipedia converter, because the 3.15 sweep stored its labels converted and string equality against the raw Wikidata label fails for traditional-only labels.',
 distinctLabels:values.size,changed:[...values].filter(value=>conversions[value]&&conversions[value]!==value).length,requests};
await writeFile(path,JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({labels:values.size,changed:evidence.labelConversion.changed,requests:requests.length,
 examples:[...values].filter(value=>conversions[value]&&conversions[value]!==value).slice(0,8).map(value=>[value,conversions[value]])},null,1));
