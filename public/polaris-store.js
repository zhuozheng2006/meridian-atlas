import {SNAPSHOT,TABLES,DECODED_FILES} from './polaris-contract.js?v=3.58.0-4e6c095f36aa';
import {POLARIS_VARIABLES} from './polaris-vocabulary.js?v=3.58.0-4e6c095f36aa';
import {normalizeFilters,searchSheets,matchesObservation} from './polaris-adapter.js?v=3.58.0-4e6c095f36aa';
const KNOWN_SHEETS=Object.keys(TABLES).filter(s=>!['Variables','Polities'].includes(s));
const HASH=/^[a-f0-9]{64}$/;
const MAX_INDEX_BYTES=600000;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const fail=message=>{throw new Error('Invalid Polaris data: '+message);};
function assert(condition,message){if(!condition)fail(message);}
function abort(signal){if(signal?.aborted)throw signal.reason instanceof Error?signal.reason:new DOMException('Aborted','AbortError');}
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;}
function envelope(value){assert(object(value)&&value.schemaVersion===2&&value.datasetId===SNAPSHOT.datasetId&&value.version===SNAPSHOT.version&&value.sourceSha256===SNAPSHOT.sourceSha256,'snapshot identity');}
const arrayText=value=>Array.isArray(value)&&value.every(s=>typeof s==='string'&&s.length<=1000);
export function validatePolarisIndex(index){
 envelope(index);assert(index.recordCount===57631&&index.polityCount===626&&index.variableCount===173,'archive counts');
 assert(Array.isArray(index.polities)&&index.polities.length===626,'phase catalog');
 const ids=new Set(),numbers=new Set(),files=new Set();let rows=0,crises=0;
 for(const p of index.polities){
  assert(object(p)&&typeof p.id==='string'&&/^[A-Za-z0-9_ -]{1,96}$/.test(p.id)&&!ids.has(p.id),'phase identity');ids.add(p.id);
  assert(typeof p.sourceNumber==='string'&&/^\d+$/.test(p.sourceNumber)&&!numbers.has(p.sourceNumber),'phase number');numbers.add(p.sourceNumber);
  assert(/^polities\/p\d{3}\.json\.gz$/.test(p.file)&&Object.hasOwn(DECODED_FILES,p.file)&&!files.has(p.file),'phase file');files.add(p.file);
  assert(arrayText(p.names)&&p.names.length===1&&arrayText(p.regions)&&arrayText(p.samplingAreas),'phase labels');
  assert(Number.isInteger(p.recordCount)&&p.recordCount>=0&&p.recordCount<=1000&&Number.isInteger(p.variableCount)&&p.variableCount>=0&&p.variableCount<=173,'phase counts');
  assert(Number.isInteger(p.explicitDateCount)&&p.explicitDateCount>=0&&p.explicitDateCount<=p.recordCount&&Number.isInteger(p.crisisCount)&&p.crisisCount>=0&&p.crisisCount<=p.recordCount,'phase date/kind counts');
  assert(Number.isInteger(p.bytes)&&p.bytes>0&&p.bytes<=100000&&p.decodedBytes===DECODED_FILES[p.file][1]&&HASH.test(p.sha256),'phase integrity metadata');
  assert(Array.isArray(p.periods)&&p.periods.length===1&&p.periods.every(r=>typeof r.startRaw==='string'&&/^-?\d+$/.test(r.startRaw)&&typeof r.endRaw==='string'&&/^-?\d+$/.test(r.endRaw)&&r.sourceSheet==='Polities'&&/^\d+$/.test(r.sourceRow)),'phase periods');
  rows+=p.recordCount;crises+=p.crisisCount;
 }
 assert(rows===57631&&crises===166,'phase count conservation');
 assert(Array.isArray(index.searchFiles)&&index.searchFiles.length===6,'search file catalog');const sheets=new Set();
 for(const s of index.searchFiles){assert(object(s)&&KNOWN_SHEETS.includes(s.sourceSheet)&&!sheets.has(s.sourceSheet),'search source sheet');sheets.add(s.sourceSheet);
  assert(/^search\/s\d\.json\.gz$/.test(s.file)&&Object.hasOwn(DECODED_FILES,s.file)&&s.recordCount===TABLES[s.sourceSheet].recordCount&&s.recordKind===TABLES[s.sourceSheet].recordKind&&s.decodedBytes===DECODED_FILES[s.file][1]&&HASH.test(s.sha256),'search descriptor');
 }
 assert(index.variableMetadataFile==='metadata/variables.json.gz'&&index.polityMetadataFile==='metadata/polities.json.gz'&&index.schemaFile==='schema.json'&&index.provenanceFile==='provenance.json','metadata paths');
 return index;
}
function validateRecord(record,index,phaseById){
 assert(object(record)&&Object.hasOwn(TABLES,record.sourceSheet),'source record sheet');const schema=TABLES[record.sourceSheet];
 assert(typeof record.sourceRow==='string'&&/^\d+$/.test(record.sourceRow)&&Number(record.sourceRow)>=2&&Number(record.sourceRow)<=schema.recordCount+1,'Excel source row');
 assert(record.id===`sha256:${SNAPSHOT.sourceSha256}:${record.sourceSheet}:${record.sourceRow}`&&record.recordKind===schema.recordKind,'source row identity/kind');
 for(const prop of ['raw','cellTypes'])assert(object(record[prop])&&Object.keys(record[prop]).length===schema.headers.length&&schema.headers.every(k=>Object.hasOwn(record[prop],k)),'source headers');
 for(const key of schema.headers){const value=record.raw[key],type=record.cellTypes[key];assert(value===null||typeof value==='string'&&value.length<=10000,'lexical source value');
  assert(type===null||['n','b','s','inlineStr','str','e','d'].includes(type),'Excel cell type');assert(type!==null||value===null,'absent cell payload');
  if(type==='b')assert(value===null||value==='0'||value==='1','boolean lexical payload');
  if(type==='n')assert(value===null||/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value),'numeric lexical payload');
 }
 const raw=record.raw;
 if(record.recordKind==='variable-metadata')return;
 const phase=phaseById.get(raw.polity_id);assert(phase&&phase.sourceNumber===raw.polity_number,'source polity identity');
 if(record.recordKind==='polity-metadata'){assert(raw.long_name===phase.names[0]&&raw.start_year===phase.periods[0].startRaw&&raw.end_year===phase.periods[0].endRaw,'phase metadata values');return;}
 const v=POLARIS_VARIABLES[raw.variable_name];assert(v&&v.sheet===record.sourceSheet&&v.section===raw.section,'variable source context');
 if(record.recordKind==='crisis-consequence'){
  const related=raw.other_polity_id===null?null:phaseById.get(raw.other_polity_id);
  assert(raw.other_polity_id===null?raw.other_polity_number===null:related&&related.sourceNumber===raw.other_polity_number,'related phase identity');
 }
}
export function validatePolarisShard(value,phase,index){
 envelope(value);assert(value.polityId===phase.id&&Array.isArray(value.observations)&&value.observations.length===phase.recordCount,'phase shard count/identity');
 assert(Array.isArray(value.metadata)&&value.metadata.length===1,'phase raw metadata');
 const ids=new Set(),phaseById=new Map(index.polities.map(p=>[p.id,p]));for(const row of [...value.metadata,...value.observations]){validateRecord(row,index,phaseById);assert(row.raw.polity_id===phase.id&&!ids.has(row.id),'phase row identity/duplicates');ids.add(row.id);}
 assert(value.metadata[0].recordKind==='polity-metadata'&&value.observations.every(r=>['coded-observation','crisis-consequence'].includes(r.recordKind)),'metadata/observation separation');
 assert(new Set(value.observations.map(r=>r.raw.variable_name)).size===phase.variableCount,'phase variable count');
 assert(value.observations.filter(r=>r.recordKind==='crisis-consequence').length===phase.crisisCount&&value.observations.filter(r=>r.raw.year_from!==null||r.raw.year_to!==null).length===phase.explicitDateCount,'phase observation count details');return value;
}
export function validatePolarisSearch(value,descriptor,index){
 envelope(value);assert(value.sourceSheet===descriptor.sourceSheet&&Array.isArray(value.observations)&&value.observations.length===descriptor.recordCount,'search count/sheet');const ids=new Set(),phaseById=new Map(index.polities.map(p=>[p.id,p]));
 for(const row of value.observations){validateRecord(row,index,phaseById);assert(row.sourceSheet===descriptor.sourceSheet&&!ids.has(row.id),'search row sheet/duplicates');ids.add(row.id);}return value;
}
async function sha(bytes){if(!globalThis.crypto?.subtle)throw Error('Cryptographic verification is unavailable');return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
export async function readPolarisJSON(url,{signal,timeoutMs=20000,expectedSha256,expectedDecodedSha256,maxDecodedBytes=20000000}={}){
 const controller=new AbortController(),cancel=()=>controller.abort(signal?.reason);signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();const timer=setTimeout(()=>controller.abort(new Error('Polaris request timed out')),timeoutMs);
 try{abort(controller.signal);const response=await fetch(url,{signal:controller.signal,credentials:'same-origin',cache:'no-cache'});if(!response.ok)throw Error(`HTTP ${response.status}`);let bytes=new Uint8Array(await response.arrayBuffer());abort(controller.signal);
  if(bytes[0]===31&&bytes[1]===139){if(expectedSha256&&await sha(bytes)!==expectedSha256)throw Error('Polaris gzip checksum mismatch');if(typeof DecompressionStream==='undefined')throw Error('Gzip decoding unavailable');bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());}
  abort(controller.signal);if(bytes.length>maxDecodedBytes)throw Error('Polaris response exceeds expected size');if(expectedDecodedSha256&&await sha(bytes)!==expectedDecodedSha256)throw Error('Polaris decoded checksum mismatch');abort(controller.signal);return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
function lru(map,key,value,max){map.delete(key);map.set(key,value);while(map.size>max)map.delete(map.keys().next().value);}
export class PolarisStore {
 constructor({dataBaseUrl,readJSON=readPolarisJSON,maxCachedPolities=8,maxCachedSearchSheets=2,yieldNow=()=>new Promise(r=>setTimeout(r,0))}={}){
  if(!dataBaseUrl)throw TypeError('A fixed Polaris dataBaseUrl is required');this.base=new URL(dataBaseUrl);if(!this.base.href.endsWith('/'))throw TypeError('Polaris dataBaseUrl must end in /');this.readJSON=readJSON;this.yieldNow=yieldNow;this.index=null;this.cache=new Map();this.searchCache=new Map();this.queryIndex=null;this.searchSequence=0;this.epoch=0;this.disposed=false;
  this.maxCachedPolities=Math.max(1,Math.min(32,Math.trunc(maxCachedPolities)||8));this.maxCachedSearchSheets=Math.max(0,Math.min(6,Math.trunc(maxCachedSearchSheets)||0));this.datasetId=SNAPSHOT.datasetId;this.version=SNAPSHOT.version;
 }
 _active(signal,epoch=this.epoch){abort(signal);if(this.disposed||epoch!==this.epoch)throw new DOMException('Store request is obsolete','AbortError');}
 async _read(file,signal,expectedSha256){this._active(signal);assert(Object.hasOwn(DECODED_FILES,file),'unregistered file');const [expectedDecodedSha256,size]=DECODED_FILES[file];const epoch=this.epoch;
  const result=await this.readJSON(new URL(file,this.base),{signal,expectedSha256,expectedDecodedSha256,maxDecodedBytes:file==='index.json.gz'?MAX_INDEX_BYTES:size});this._active(signal,epoch);return result;
 }
 async loadIndex(signal,{retry=false}={}){const epoch=this.epoch;this._active(signal,epoch);if(retry){this.index=null;this.queryIndex=null;this.searchSequence++;}if(this.index)return this.index;
  const raw=await this._read('index.json.gz',signal,SNAPSHOT.indexSha256);this._active(signal,epoch);const data=validatePolarisIndex(raw);this.index=freeze(data);return this.index;
 }
 async loadPolity(polity,signal,{retry=false}={}){const epoch=this.epoch;this._active(signal,epoch);const index=await this.loadIndex(signal);this._active(signal,epoch);const id=typeof polity==='string'?polity:polity?.id,p=index.polities.find(p=>p.id===id);if(!p)throw Error('Unknown Polaris phase');if(retry)this.cache.delete(id);if(this.cache.has(id)){const data=this.cache.get(id);lru(this.cache,id,data,this.maxCachedPolities);return data;}
  const raw=await this._read(p.file,signal,p.sha256);this._active(signal,epoch);const data=validatePolarisShard(raw,p,index);freeze(data);lru(this.cache,id,data,this.maxCachedPolities);return data;
 }
 async loadSearchSheet(sheet,signal,{retry=false}={}){const epoch=this.epoch;this._active(signal,epoch);const index=await this.loadIndex(signal);this._active(signal,epoch);const d=index.searchFiles.find(p=>p.sourceSheet===sheet);if(!d)throw Error('Unknown Polaris source sheet');if(retry){this.searchCache.delete(sheet);this.queryIndex=null;this.searchSequence++;}if(this.searchCache.has(sheet)){const data=this.searchCache.get(sheet);lru(this.searchCache,sheet,data,this.maxCachedSearchSheets);return data;}
  const raw=await this._read(d.file,signal,d.sha256);this._active(signal,epoch);const data=validatePolarisSearch(raw,d,index);freeze(data);if(this.maxCachedSearchSheets)lru(this.searchCache,sheet,data,this.maxCachedSearchSheets);return data;
 }
 _searchActive(signal,epoch,sequence){this._active(signal,epoch);if(sequence!==this.searchSequence)throw new DOMException('Search request is obsolete','AbortError');}
 async _scan(filters,{signal,retry=false,offset=0,limit=24,onProgress,collect=false}={}){
  const epoch=this.epoch;this._active(signal,epoch);const f=normalizeFilters(filters);if(!Number.isInteger(offset)||offset<0||offset>57631||!Number.isInteger(limit)||limit<1||limit>500)throw RangeError('Invalid research page');
  // One completed query retains only row ordinals, at most 57,631 uint32s
  // (230,524 B). Raw source rows remain in the separately bounded sheet LRU.
  const key=JSON.stringify([f.domain,f.variable,f.query.trim().toLocaleLowerCase()]),sequence=++this.searchSequence;
  const recent=!retry&&!collect&&this.queryIndex?.key===key?this.queryIndex:null;this.queryIndex=null;
  if(retry)this.searchCache.clear();
  const active=()=>this._searchActive(signal,epoch,sequence);
  try{
   const index=await this.loadIndex(signal);active();const rows=[];
   if(recent){
    // A later page reopens only source sheets containing its selected rows.
    // The full total comes from the previously completed, verified scan.
    const end=Math.min(recent.total,offset+limit);let source=null,data=null;
    for(let i=offset;i<end;i++){
     active();const position=recent.positions[i],segment=recent.segments.find(s=>position>=s.start&&position<s.end);
     assert(segment,'cached search position');if(source!==segment.sheet){data=await this.loadSearchSheet(segment.sheet,signal);active();source=segment.sheet;}
     const row=data.observations[position-segment.start];assert(row,'cached search row');rows.push(row);
    }
    active();this.queryIndex=recent;return {datasetId:SNAPSHOT.datasetId,version:SNAPSHOT.version,rows,total:recent.total,scanned:recent.scanned,coveredSheets:recent.segments.map(s=>s.sheet),complete:true,filters:f,offset,limit};
   }
   const planned=searchSheets(f),segments=[];let capacity=0;
   for(const sheet of planned){const descriptor=index.searchFiles.find(d=>d.sourceSheet===sheet);assert(descriptor,'planned search sheet');segments.push({sheet,start:capacity,end:capacity+descriptor.recordCount});capacity+=descriptor.recordCount;}
   assert(capacity<=57631,'search index capacity');const positions=new Uint32Array(capacity),coveredSheets=[];let total=0,scanned=0;
   for(const segment of segments){active();const data=await this.loadSearchSheet(segment.sheet,signal);active();
    for(let i=0;i<data.observations.length;i++){const row=data.observations[i];if(matchesObservation(row,f)){positions[total]=segment.start+i;if(collect||total>=offset&&rows.length<limit)rows.push(row);total++;}scanned++;
     if(i%500===499){await this.yieldNow();active();}
    }
    coveredSheets.push(segment.sheet);active();onProgress?.({scanned,matches:total,coveredSheets:[...coveredSheets],plannedSheets:[...planned]});active();await this.yieldNow();active();
   }
   // Never retain a partially scanned or cancelled result. Exports deliberately
   // take the full scan path, even when the same query has a pagination index.
   active();this.queryIndex={key,positions:positions.subarray(0,total),segments,total,scanned};return {datasetId:SNAPSHOT.datasetId,version:SNAPSHOT.version,rows,total,scanned,coveredSheets,complete:true,filters:f,offset,limit};
  }catch(error){if(sequence===this.searchSequence)this.queryIndex=null;throw error;}
 }
 search(filters={},options={}){return this._scan(filters,options);}
 collectSearch(filters={},options={}){return this._scan(filters,{...options,collect:true});}
 clearCaches(){this.epoch++;this.searchSequence++;this.index=null;this.queryIndex=null;this.cache.clear();this.searchCache.clear();}
 dispose(){this.clearCaches();this.disposed=true;}
}
export {SNAPSHOT};
