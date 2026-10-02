// Coordinates existing maps; it neither creates maps nor changes geometry.
// snapshot(): {primary, secondary, year, compareYear, compareOpen,
//              camera, compareCamera}. Map identity objects may expose destroyed.
// ensureComparison({year,isCurrent}): idempotently open/await the second map;
//                                    resolve false if creation failed.
// alignYear({side,map,year,isCurrent}): resolve true only after the real map AND
//                                      app year commit; preserve map request guards.
// setModes({primary,secondary,year,camera}): synchronous final commit to
//                                         overview / regional, then camera.
// Call cancel() before external close/year/source/layer/reference changes.
// cancel() blocks future phases; an injected year loader must also keep its
// own request-generation guard. Already committed dates are not rolled back.
export function createBoundaryComparison({snapshot,ensureComparison,alignYear,setModes,onError=()=>{}}){
 let generation=0,inFlight=null;
 const cancel=()=>{generation++;inFlight=null;};
 function open(side='left'){
  if(inFlight)return inFlight;
  if(!['left','right'].includes(side))return Promise.resolve(false);
  const initial=snapshot(),origin=side==='right'?initial.secondary:initial.primary;
  const year=side==='right'?initial.compareYear:initial.year;
  if(!origin||origin.destroyed||!Number.isInteger(year)||year===0||side==='right'&&!initial.compareOpen)return Promise.resolve(false);
  const selectedCamera=side==='right'?initial.compareCamera:initial.camera;
  const camera=selectedCamera?structuredClone(selectedCamera):null;
  const token=++generation;
  const current=()=>{
   const s=snapshot();return token===generation&&!origin.destroyed
    &&(side==='right'?s.compareOpen&&s.secondary===origin&&s.compareYear===year:s.primary===origin&&s.year===year);
  };
  let task;
  task=(async()=>{
   try{
    const opened=await ensureComparison({year,isCurrent:current});
    if(!current())return false;
    if(opened===false)throw Error('Comparison could not open');
    const pair=snapshot(),primary=pair.primary,secondary=pair.secondary;
    const valid=()=>{const s=snapshot();return current()&&s.compareOpen&&s.primary===primary&&s.secondary===secondary&&!primary?.destroyed&&!secondary?.destroyed;};
    if(!primary||!secondary||!valid())return false;
    for(const [target,map,key] of [['left',primary,'year'],['right',secondary,'compareYear']]){
     if(snapshot()[key]===year)continue;
     const ok=await alignYear({side:target,map,year,isCurrent:valid});
     if(!valid())return false;
     if(ok!==true||snapshot()[key]!==year)throw Error('Comparison year did not finish loading');
    }
    if(!valid())return false;
    const final=snapshot();if(final.year!==year||final.compareYear!==year)return false;
    setModes({primary,secondary,year,camera});
    return true;
   }catch(error){if(current())onError(error);return false;}
   finally{if(inFlight===task)inFlight=null;}
  })();
  inFlight=task;return task;
 }
 return {open,cancel,get busy(){return inFlight!==null;}};
}
