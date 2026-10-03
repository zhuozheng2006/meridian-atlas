import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const root='/Users/zane/meridian_atlas/world-history-atlas';
const from=resolve(root,'docs/verification-3.29');
const to=resolve(root,'docs/verification-3.32');
await mkdir(resolve(to,'authoring'),{recursive:true});
const wanted=['select-narratives-3.29.mjs','verify-candidates-3.29.mjs','choose-narratives-3.29.mjs','fetch-polity-extracts-3.29.mjs','build-narratives-batch-3.30.mjs','clean-coverage-notes-3.30.mjs','write-narratives-gz-3.30.mjs'];
for(const name of wanted){
 let text=await readFile(resolve(root,'docs/'+(name.includes('3.30')?'verification-3.30':'verification-3.29'),name),'utf8');
 const target=name.replace('3.29','3.32').replace('3.30','3.32');
 text=text.replaceAll('3.29','3.32').replaceAll('3.30','3.32');
 // plans and extracts come from the fresh selection made in this round
 text=text.replaceAll('docs/docs/verification-3.32/narratives-chosen.json','docs/docs/verification-3.32/narratives-chosen.json');
 if(name.startsWith('verify-candidates')){
  text=text.replace(/const priority=\{[^}]*\};/,"const priority={europe:250,africa:120,'west-central-asia':90,'south-asia':90,americas:80,'east-asia':60,'southeast-asia':40,oceania:30,global:20};");
 }
 if(name.startsWith('choose')){
  text=text.replace(/const target=Number\(arg\('target'\)\|\|[0-9]+\);/,"const target=Number(arg('target')||100);");
  text=text.replace(/const QUOTA=\{[^}]*\};/,"const QUOTA={europe:46,africa:12,'west-central-asia':10,'east-asia':8,'south-asia':8,americas':0,americas:8,'southeast-asia':4,oceania':0,oceania:4,global':0,global:4};".replace(/',0,/,','));
  text=text.replace(/const QUOTA=\{[^}]*\};/,"const QUOTA={europe:46,africa:12,'west-central-asia':10,'east-asia':8,'south-asia':8,americas:8,'southeast-asia':4,oceania:4};");
 }
 if(name.startsWith('build-narratives-batch')){
  text=text.replaceAll('docs/docs/verification-3.32/authoring','docs/docs/verification-3.32/authoring');
 }
 await writeFile(resolve(to,target),text);
 // rename to this round's number for clarity
 await writeFile(resolve(to,target.replace(/\.mjs$/,'.mjs')),text);
}
console.log('setup done in docs/verification-3.32');
