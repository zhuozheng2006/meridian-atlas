// One keyboard route owns civil-year navigation; MapLibre keyboard handling is disabled.
export function yearKeyIntent(key,{step=1,shift=false,slider=false,number=false}={}){
 const amount=step*(shift?10:1);
 if(number)return key==='ArrowUp'?{delta:amount}:key==='ArrowDown'?{delta:-amount}:null;
 if(key==='ArrowRight'||slider&&key==='ArrowUp')return {delta:amount};
 if(key==='ArrowLeft'||slider&&key==='ArrowDown')return {delta:-amount};
 if(slider&&key==='Home')return {year:-70000};
 if(slider&&key==='End')return {year:2026};
 if(slider&&key==='PageUp')return {delta:100};
 if(slider&&key==='PageDown')return {delta:-100};
 return null;
}
export function bindTimeline({getYear,getCompareYear,getStep,commit,commitCompare,pause,isAtlas,isDialogOpen,closeReader,readerOpen,togglePlay,getMap}){
 const input=document.querySelector('#yearInput'),comparison=document.querySelector('#compareYear'),slider=document.querySelector('#yearSlider');
 const submit=(el,right=false)=>{
  const value=String(el.value).trim(),current=right?getCompareYear():getYear();
  if(!/^-?\d+$/.test(value)||!Number.isFinite(Number(value))||Number(value)===0){el.value=current;return;}
  const year=Math.max(-70000,Math.min(2026,Number(value)));
  el.value=year;if(year===current)return;pause();(right?commitCompare:commit)(year);
 };
 input.onchange=()=>submit(input);comparison.onchange=()=>submit(comparison,true);
 document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.isComposing||e.ctrlKey||e.metaKey||isDialogOpen()||!isAtlas())return;
  const target=e.target,right=target===comparison||!!target.closest?.('#map2'),number=target===input||target===comparison,isSlider=target===slider;
  const mapCanvas=target.matches?.('.maplibregl-canvas');
  if(e.altKey){if(mapCanvas&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
    e.preventDefault();e.stopPropagation();getMap(target)?.panBy([e.key==='ArrowLeft'?-80:e.key==='ArrowRight'?80:0,e.key==='ArrowUp'?-80:e.key==='ArrowDown'?80:0],{duration:120});
   }return;}
  if(number&&e.key==='Enter'){e.preventDefault();submit(target,right);return;}
  if(number&&e.key==='Escape'){e.preventDefault();target.value=right?getCompareYear():getYear();return;}
  if(e.key==='Escape'&&readerOpen()){e.preventDefault();closeReader();return;}
  if(target.closest?.('#detailPanel'))return;
  if(!number&&!isSlider&&target.closest?.('input,textarea,select,button,a,summary,[contenteditable="true"],[role="tab"]'))return;
  const intent=yearKeyIntent(e.key,{step:getStep(),shift:e.shiftKey,slider:isSlider,number});
  if(intent){e.preventDefault();e.stopPropagation();pause();const year=right?getCompareYear():getYear();
   const delta=intent.delta;let next=intent.year;
   if(delta!==undefined){const raw=year+delta;next=year<0&&raw>=0?raw+1:year>0&&raw<=0?raw-1:raw;}
   (right?commitCompare:commit)(Math.max(-70000,Math.min(2026,next)));return;
  }
  if(!number&&!isSlider&&e.code==='Space'){e.preventDefault();if(!e.repeat)togglePlay();}
  if(mapCanvas&&['+','=','-'].includes(e.key)){e.preventDefault();getMap(target)?.zoomTo(getMap(target).getZoom()+(e.key==='-'?-.5:.5),{duration:150});}
 },true);
}
