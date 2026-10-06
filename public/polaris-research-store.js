import {PolarisStore} from './polaris-store.js?v=3.39.0-733d3fc8d4c0';
import {PolarisSearchClient} from './polaris-search-client.js?v=3.39.0-733d3fc8d4c0';
import {exportPayload} from './polaris-adapter.js?v=3.39.0-733d3fc8d4c0';
/** Local phases remain small; whole-library parsing, validation and export run in a worker. */
export class PolarisResearchStore extends PolarisStore {
 constructor(options={}){super(options);const supported=options.workerFactory||typeof Worker==='function';this.searchWorker=supported&&!options.readJSON?new PolarisSearchClient({dataBaseUrl:this.base,workerFactory:options.workerFactory}):null;}
 async _background(operation,filters,options,fallback){
  this._active(options?.signal);const epoch=this.epoch;
  if(this.searchWorker){try{const value=await this.searchWorker.request(operation,filters,options);this._active(options?.signal,epoch);return value;}catch(error){this._active(options?.signal,epoch);if(!error?.workerUnavailable)throw error;}}
  const value=await fallback();this._active(options?.signal,epoch);return value;
 }
 search(filters={},options={}){return this._background('search',filters,options,()=>super.search(filters,options));}
 collectSearch(filters={},options={}){return this._background('collect',filters,options,()=>super.collectSearch(filters,options));}
 serializeSearchExport(filters={},options={}){return this._background('serialize',filters,options,async()=>{const result=await super.collectSearch(filters,options),index=await this.loadIndex(options.signal),payload=exportPayload(result.rows,{filters:result.filters,scope:'cross-phase-filter'});payload.metadataScope='phase-index-context';const ids=new Set(result.rows.map(r=>r.raw.polity_id));payload.phaseContexts=index.polities.filter(p=>ids.has(p.id));return new TextEncoder().encode(JSON.stringify(payload,null,2)+'\n').buffer;});}
 clearCaches(){super.clearCaches();this.searchWorker?.clearCaches();}
 dispose(){this.searchWorker?.dispose();super.dispose();}
}
