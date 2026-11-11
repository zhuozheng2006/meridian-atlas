import {readJSON} from './map-engine.js?v=3.49.0-21169f0d36c4';

// Editorial context is attached to an identified source record and its date.
// Nearby points and a matching modern city name never establish identity.
// Sites from the attested layer carry their own sourced chapter. The wording,
// the period and the representative point all come from that one record; nothing
// is borrowed from a nearby population observation.
export function attestedChapter(place,year){
 const r=place.attested;
 if(!r||!Number.isInteger(year)||!year||year<r.period.start||year>r.period.end)return null;
 const section=(id,titleZh,titleEn,body)=>({id,titleZh,titleEn,zh:body?.zh,en:body?.en});
 return {
  id:r.id,nameZh:r.nameZh,nameEn:r.nameEn,aliases:r.aliases||[],
  scope:{start:r.period.start,end:r.period.end,zh:r.scope?.temporal?.zh,en:r.scope?.temporal?.en,spatial:r.scope?.spatial,temporal:r.scope?.temporal},
  sections:[
   section('setting','地点与环境','Setting',r.narrative?.setting),
   section('development','沿革','Development',r.narrative?.development),
   section('legacy','遗产与延续','Legacy',r.narrative?.legacy),
  ].filter(s=>s.zh||s.en),
  milestones:[],
  sources:(r.sources||[]).map(s=>({title:s.title,publisher:s.publisher,url:s.url,accessedAt:s.readOn,access:s.license})),
  binding:{noteZh:r.period.interpretationZh,noteEn:r.period.interpretationEn},
  review:r.review,continuousOccupationAsserted:r.continuousOccupationAsserted===true,
 };
}
export function matchCityNarrative(data,place,year){
 if(!Number.isInteger(year)||!year||place.kind==='modern-reference')return null;
 if(place.kind==='attested-site')return attestedChapter(place,year);
 for(const entry of data.entries){
  if(year<entry.scope.start||year>entry.scope.end)continue;
  const rule=entry.bindingRules.find(r=>{
   if(r.sourceRecordId!==place.id||year<r.start||year>r.end)return false;
   if(place.observations||r.requiresObservation){
    const observed=place.observation?.[0];
    return Number.isInteger(observed)&&observed>=r.start&&observed<=r.end&&(!r.observationYears||r.observationYears.includes(observed));
   }
   const periods=r.sourcePeriods||r.periods||place.periods;
   return !!periods?.some(([start,end])=>start<=year&&year<=end);
  });
  if(rule)return {...entry,binding:rule,sources:data.sources.filter(s=>entry.sourceIds.includes(s.id))};
 }
 return null;
}
export async function cityNarrative(place,year){
 return matchCityNarrative(await readJSON('data/places/city-narratives.json.gz'),place,year);
}
