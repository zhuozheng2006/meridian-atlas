import {buildTerritoryFrame} from './territory-frame-build.js';
import {landscapeDataURL,LANDSCAPE_DATA_PREFIX} from './halc-landscape-prepare.js';
import {TERRITORY_FRAME_PREFIX,TERRITORY_FRAME_PROTOCOL} from './territory-frame-protocol.js';
self.addEventListener('message',({data})=>{
 const {id,mode,protocol}=data||{};
 try{
  const received=performance.now(),raw=typeof data.json==='string'?JSON.parse(data.json):data.raw,inputParsed=performance.now();
  if(protocol!==TERRITORY_FRAME_PROTOCOL||!['raw','curved','country'].includes(mode)||raw?.type!=='FeatureCollection'||!Array.isArray(raw.features))throw Error('Invalid territory preparation request');
  const stages={};let previous=inputParsed;
  const startedAt=performance.now(),payload=buildTerritoryFrame(raw,mode,name=>{const now=performance.now();stages[name+'Ms']=now-previous;previous=now;}),built=performance.now(),text=JSON.stringify(payload),serialized=performance.now(),encoded=landscapeDataURL(text);
  if(!encoded.dataURL.startsWith(LANDSCAPE_DATA_PREFIX))throw Error('Unexpected GeoJSON encoding');
  const dataURL=TERRITORY_FRAME_PREFIX+encoded.dataURL.slice(LANDSCAPE_DATA_PREFIX.length),finished=performance.now();
  self.postMessage({id,protocol,dataURL,metrics:{timeOrigin:performance.timeOrigin,startedAt,receivedAt:received,inputParseMs:inputParsed-received,inputFormat:typeof data.json==='string'?'json':'object',...stages,buildMs:built-startedAt,stringifyMs:serialized-built,encodeMs:finished-serialized,totalMs:finished-received,jsonBytes:encoded.jsonBytes,dataURLChars:dataURL.length,sourceFeatures:raw.features.length,derivedFeatures:payload.features.length}});
 }catch(error){self.postMessage({id,protocol:TERRITORY_FRAME_PROTOCOL,error:{message:String(error.message||error)}});}
});
