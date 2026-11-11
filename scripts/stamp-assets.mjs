import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url)),dist=path.join(root,'public');
const clean=s=>s.replace(/\?v=[a-zA-Z0-9.-]+(?=["'])/g,'');
const files=fs.readdirSync(dist).filter(f=>/\.(?:js|css)$/.test(f)).sort();
const sources=new Map(files.map(f=>[f,clean(fs.readFileSync(path.join(dist,f),'utf8'))]));
const hash=crypto.createHash('sha256');
for(const [name,source] of sources)hash.update(name+'\0'+source+'\0');
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version;
const revision=version+'-'+hash.digest('hex').slice(0,12),outputs=new Map();
for(const [name,source] of sources)if(name.endsWith('.js'))outputs.set(name,source.replace(/((?:from\s+|import\s*\(\s*)['"])(\.\/[^'"?]+\.js)(['"])/g,`$1$2?v=${revision}$3`));
outputs.set('index.html',clean(fs.readFileSync(path.join(dist,'index.html'),'utf8')).replace(/((?:src|href)=["'])([^"'?:]+\.(?:js|css))(["'])/g,`$1$2?v=${revision}$3`));
const check=process.argv.includes('--check');
for(const [name,content] of outputs){const file=path.join(dist,name);if(check){if(fs.readFileSync(file,'utf8')!==content)throw Error(`Stale asset revision in ${name}; run npm run prepare:assets`);}else fs.writeFileSync(file,content);}
console.log(`${check?'PASS':'Stamped'} linked asset revision ${revision}`);
