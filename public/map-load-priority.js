// Give the requested historical snapshot a short head start over optional
// geographical detail. A stalled snapshot can never block the rest indefinitely.
const foreground=new Set();
export function beginMapForeground(){
 let release;const done=new Promise(resolve=>release=resolve);foreground.add(done);let ended=false;
 return ()=>{if(ended)return;ended=true;foreground.delete(done);release();};
}
export function waitForMapForeground(url,{timeout=4000}={}){
 const optional=/^data\/(?:land-50m|physical\/modern-ocean-mask|physical-spatial\/cells\/|lakes\/(?!index)|places\/historical-settlements)/.test(String(url));
 if(!optional||!foreground.size)return Promise.resolve();
 return new Promise(resolve=>{let finished=false;const finish=()=>{if(finished)return;finished=true;clearTimeout(timer);resolve();};const timer=setTimeout(finish,timeout);Promise.all([...foreground]).then(finish);});
}
