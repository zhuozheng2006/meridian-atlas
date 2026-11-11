// Additional static objects use per-file content keys. The legacy lake manifest,
// import namespace and revision-based keys remain a separate compatibility contract.
export function createStaticStorageHandler(manifest,{importUntil=0,lakeRevision=''}={}) {
 if(!manifest)return null;
 const validPath=/^data\/(?:(?:ohm-eastasia|ohm-1500)\/year--?\d+\.json\.gz|ohm-transport\/(?:central-europe|east-asia)--?\d+\.json\.gz|cshapes\/decade-\d+\.json\.gz|seshat\/sources\/code-book-4\.20\.2021\.pdf|native\/temporal\/pack-\d{3}\.json\.gz)$/;
 const entries=new Map();
 for(const f of manifest.files){
  if(!validPath.test(f.file)||entries.has(f.file)||!Number.isSafeInteger(f.bytes)||f.bytes<=0||!/^[a-f0-9]{64}$/.test(f.sha256)||f.key!==`atlas-static/sha256/${f.sha256}`||f.contentType!==(f.file.endsWith('.pdf')?'application/pdf':'application/octet-stream'))throw Error('Invalid static storage manifest');
  entries.set(f.file,f);
 }
 const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}}),fail=(message,status)=>json({error:message},status);
 const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 const prefix='/__atlas-static-import/';
 return async function handle(request,env,url){
  const pathname=url.pathname;
  if(pathname.startsWith(prefix)){
   if(!importUntil||Date.now()>importUntil)return fail('Not found',404);
   if(request.headers.has('Origin')&&request.headers.get('Origin')!==url.origin)return fail('Origin not allowed',403);
   if(!env.BUCKET)return fail('Storage unavailable',503);
   if(pathname===prefix+'status'&&request.method==='GET')return json({revision:manifest.revision,files:entries.size,bytes:manifest.bytes,assetsAvailable:!!env.ASSETS,importUntil,lakeRevision});
   if(pathname===prefix+'inventory'&&request.method==='GET'){
    if(request.headers.get('X-Atlas-Manifest')!==manifest.revision)return fail('Manifest mismatch',409);
    try{
     const files=[],pending=[...entries.values()];let cursor=0;
     await Promise.all(Array.from({length:Math.min(6,pending.length)},async()=>{while(cursor<pending.length){const f=pending[cursor++],o=await env.BUCKET.head(f.key);if(o)files.push({file:f.file,key:f.key,bytes:o.size,sha256:o.customMetadata?.sha256});}}));
     files.sort((a,b)=>a.file.localeCompare(b.file));return json({revision:manifest.revision,files});
    }catch{return fail('Storage inventory unavailable',503);}
   }
   const name=pathname.slice(prefix.length),entry=entries.get(name);
   if(!entry)return fail('Unknown asset',404);
   if(request.method!=='PUT')return fail('Method not allowed',405);
   if(request.headers.get('X-Atlas-Manifest')!==manifest.revision)return fail('Manifest mismatch',409);
   if(request.headers.get('content-type')!=='application/octet-stream')return fail('Expected binary data',415);
   const declared=request.headers.get('content-length');if(declared!==null&&Number(declared)!==entry.bytes)return fail('Size mismatch',400);
   const reader=request.body?.getReader();if(!reader)return fail('Missing asset data',400);
   const chunks=[];let size=0;
   try{for(;;){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>entry.bytes){await reader.cancel();return fail('Size mismatch',400);}chunks.push(r.value);}}catch{return fail('Asset body could not be read',400);}
   if(size!==entry.bytes)return fail('Size mismatch',400);
   const data=new Uint8Array(size);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}chunks.length=0;
   const digest=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',data)));
   if(digest!==entry.sha256)return fail('Checksum mismatch',422);
   try{
    const existing=await env.BUCKET.head(entry.key);
    if(existing?.customMetadata?.sha256===digest&&existing.size===size)return json({file:name,key:entry.key,sha256:digest,bytes:size,stored:true,reused:true});
    await env.BUCKET.put(entry.key,data,{httpMetadata:{contentType:entry.contentType},customMetadata:{sha256:digest,source:'Meridian exact static asset'}});
    return json({file:name,key:entry.key,sha256:digest,bytes:size,stored:true});
   }catch{return fail('Storage write unavailable',503);}
  }
  const name=pathname.slice(1),entry=entries.get(name);
  if(!entry){if(validPath.test(name))return fail('Not found',404);return null;}
  if(request.method!=='GET'&&request.method!=='HEAD')return fail('Method not allowed',405);
  // Stable application URLs revalidate. Generic asset ?v queries are not content
  // fingerprints. Only the explicit optional sha256 query has hash semantics.
  if(url.searchParams.has('sha256')&&url.searchParams.get('sha256')!==entry.sha256)return fail('Asset fingerprint mismatch',412);
  if(!env.BUCKET)return fail('Atlas detail temporarily unavailable',503);
  try{
   const object=request.method==='HEAD'?await env.BUCKET.head(entry.key):await env.BUCKET.get(entry.key);
   if(!object||object.size!==entry.bytes||object.customMetadata?.sha256!==entry.sha256)return fail('Atlas detail temporarily unavailable',503);
   const headers={'Content-Type':entry.contentType,'Content-Length':String(entry.bytes),'Cache-Control':'private, no-cache','ETag':`"${entry.sha256}"`,'X-Content-Type-Options':'nosniff'};
   if(request.headers.get('If-None-Match')===headers.ETag)return new Response(null,{status:304,headers});
   return new Response(request.method==='HEAD'?null:object.body,{headers});
  }catch{return fail('Atlas detail temporarily unavailable',503);}
 };
}

// Only the confirmed owner-private Site may enable the short import window.
// Imports accept the exact audited bytes of listed assets, never arbitrary files.
export function createAtlasWorker(manifest,{importUntil=0,staticManifest=null}={}){
 const staticStorage=createStaticStorageHandler(staticManifest,{importUntil,lakeRevision:manifest.revision});
 const entries=new Map(manifest.files.map(f=>[f.file,f]));
 const prefix=`hydrolakes/${manifest.revision}/`;
 const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
 const fail=(message,status)=>json({error:message},status);
 const key=f=>prefix+f.file;
 const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return {async fetch(request,env){
  const url=new URL(request.url),path=url.pathname;
  if(path.startsWith('/__atlas-static-import/')&&!staticStorage)return fail('Not found',404);
  if(staticStorage){const response=await staticStorage(request,env,url);if(response)return response;}
  if(path.startsWith('/__atlas-import/')){
   if(!importUntil||Date.now()>importUntil)return fail('Not found',404);
   if(request.headers.has('Origin')&&request.headers.get('Origin')!==url.origin)return fail('Origin not allowed',403);
   if(!env.BUCKET)return fail('Storage unavailable',503);
   if(path==='/__atlas-import/status'&&request.method==='GET'){
    return json({revision:manifest.revision,files:entries.size,bytes:manifest.bytes,assetsAvailable:!!env.ASSETS,importUntil});
   }
   if(path==='/__atlas-import/inventory'&&request.method==='GET'){
    let cursor;const files=[];
    do{const page=await env.BUCKET.list({prefix,limit:1000,cursor,include:['customMetadata']});for(const o of page.objects)files.push({file:o.key.slice(prefix.length),bytes:o.size,sha256:o.customMetadata?.sha256});cursor=page.truncated?page.cursor:undefined;}while(cursor);
    return json({revision:manifest.revision,files});
   }
   const name=path.slice('/__atlas-import/'.length),entry=entries.get(name);
   if(!entry)return fail('Unknown asset',404);
   if(request.method!=='PUT')return fail('Method not allowed',405);
   if(request.headers.get('content-type')!=='application/octet-stream')return fail('Expected binary data',415);
   const declared=request.headers.get('content-length');if(declared!==null&&Number(declared)!==entry.bytes)return fail('Size mismatch',400);
   const reader=request.body?.getReader();if(!reader)return fail('Missing asset data',400);
   const chunks=[];let size=0;
   while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>entry.bytes){await reader.cancel();return fail('Size mismatch',400);}chunks.push(r.value);}
   if(size!==entry.bytes)return fail('Size mismatch',400);
   const data=new Uint8Array(size);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}chunks.length=0;
   const digest=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',data)));
   if(digest!==entry.sha256)return fail('Checksum mismatch',422);
   const existing=await env.BUCKET.head(key(entry));
   if(existing?.customMetadata?.sha256===digest&&existing.size===size)return json({file:name,sha256:digest,bytes:size,stored:true,reused:true});
   await env.BUCKET.put(key(entry),data,{httpMetadata:{contentType:'application/octet-stream'},customMetadata:{sha256:digest,source:'HydroLAKES v1.0',encoding:'MLK1'}});
   return json({file:name,sha256:digest,bytes:size,stored:true});
  }
  if(path.startsWith('/data/lakes/')&&path.endsWith('.bin.gz')){
   if(request.method!=='GET'&&request.method!=='HEAD')return fail('Method not allowed',405);
   const entry=entries.get(path.slice('/data/lakes/'.length));if(!entry)return fail('Not found',404);
   if(!env.BUCKET)return fail('Lake detail temporarily unavailable',503);
   try{
    const object=request.method==='HEAD'?await env.BUCKET.head(key(entry)):await env.BUCKET.get(key(entry));
    if(!object||object.size!==entry.bytes||object.customMetadata?.sha256!==entry.sha256)return fail('Lake detail temporarily unavailable',503);
    const headers={'Content-Type':'application/octet-stream','Content-Length':String(entry.bytes),'Cache-Control':'private, max-age=86400','ETag':`"${entry.sha256}"`,'X-Content-Type-Options':'nosniff'};
    if(request.headers.get('If-None-Match')===headers.ETag)return new Response(null,{status:304,headers});
    return new Response(request.method==='HEAD'?null:object.body,{headers});
   }catch(error){console.error('Lake storage request failed',entry.file,error?.name);return fail('Lake detail temporarily unavailable',503);}
  }
  if(request.method!=='GET'&&request.method!=='HEAD')return fail('Method not allowed',405);
  return env.ASSETS?env.ASSETS.fetch(request):fail('Atlas resources temporarily unavailable',503);
 }};
}
