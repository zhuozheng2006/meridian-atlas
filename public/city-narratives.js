import {readJSON} from './map-engine.js?v=3.3.0-321a12f73566';

// Editorial context is attached to an identified source record and its date.
// Nearby points and a matching modern city name never establish identity.
export function matchCityNarrative(data,place,year){
 if(!Number.isInteger(year)||!year||place.kind==='modern-reference')return null;
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
