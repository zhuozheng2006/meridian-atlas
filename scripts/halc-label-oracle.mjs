// Frozen exact 3.42 refreshLabels body from 353f95e9; independent synchronous oracle.
// Only its function wrapper and injected name/DOM helpers differ from the source.
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
export const LEGACY_LABEL_ORACLE_SHA256='b794ed125e3b8ee6d52a0624609bc77248285191a41dbb243177b314e13cf260';
export function createLegacyLabelOracle({halcName,halcMembership}){
 const t=(lang,zh,en)=>lang==='en'?en:zh;
 const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;};
 return function legacyRefreshLabels(){
  if(!this.active||this.loading||!this.atlas.showLabels||!this.anchor){this.clearLabels();return;}
  const bounds=this.map.getBounds(),box=[bounds.getWest(),bounds.getSouth(),bounds.getEast(),bounds.getNorth()],root=this.map.getContainer().getBoundingClientRect();
  const boxes=[...document.querySelectorAll('.map-heading,.map-tools,.compare-heading,.map-legend,.layer-panel,.event-marker,.regional-controls,.lake-label')].filter(el=>el.getClientRects().length).map(el=>el.getBoundingClientRect());
  const key=[this.featureEpoch,this.regions.revision,this.viewportKey(),this.lang,root.left,root.top,...boxes.flatMap(b=>[b.left,b.top,b.right,b.bottom])].join(':');
  if(key===this.labelKey){this.atlas.labelBoxes=this.labelBoxes;return;}this.clearLabels();this.labelKey=key;
  const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top,names=new Set(),local=this.map.getZoom()>=8;
  const candidates=!local&&this.regions.ready?this.regions.features:this.features;
  const ranked=candidates.filter(f=>f.properties.TYPE!==8&&(local||f.properties.ADM1&&f.properties.ADM1!=='XX'&&!f.properties.ADM1.includes(';'))).map(f=>({f,anchor:this.anchor(f,box[0]<box[2]?box:null)})).filter(x=>x.anchor).sort((a,b)=>b.anchor.score-a.anchor.score);
  for(const {f,anchor}of ranked){
   if(this.markers.length>=12)break;const p=f.properties,name=local||p.ADM1==='XX'?halcName(p,this.labels,this.lang):halcMembership(p.ADM1,'ADM1',this.labels,this.lang);if(!name||names.has(name))continue;
   const english=local?halcName(p,this.labels,'en'):halcMembership(p.ADM1,'ADM1',this.labels,'en'),bilingual=this.lang==='bi'&&english!==name;
   const point=this.map.project(anchor.coordinate),w=Math.min(190,Math.max(80,name.length*12+16,bilingual?english.length*6+16:0)),height=bilingual?44:32,r={left:root.left+point.x-w/2,right:root.left+point.x+w/2,top:root.top+point.y-height/2,bottom:root.top+point.y+height/2};
   if(r.left<root.left+12||r.right>root.right-12||r.top<root.top+85||r.bottom>root.bottom-75||boxes.some(b=>overlaps(r,b)))continue;
   const el=make('button',name,'regional-label halc-label');el.setAttribute('aria-label',name);if(bilingual)el.append(make('span',english));el.style.maxWidth=w+'px';el.title=local?t(this.lang,'查看地方单元：','Read local unit: ')+p.NAME:t(this.lang,'浏览这一归属下的地方单元','Browse local units with this attribution');el.onclick=e=>{e.stopPropagation();if(local)this.openRecord(p.fid,{lng:anchor.coordinate[0],lat:anchor.coordinate[1]});else this.openGroup(p.ADM1);};
   this.markers.push(new maplibregl.Marker({element:el,opacityWhenCovered:'0'}).setLngLat(anchor.coordinate).addTo(this.map));boxes.push(r);names.add(name);
  }
  this.labelBoxes=boxes;this.atlas.labelBoxes=boxes;this.atlas.places?.refresh();
 }
}
// Capture the exact production request handle, not a stand-in task or artificial
// idle event. This works before/after the optional controller.labelJob hook.
export function observeLabelJobs(controller){
 const request=controller.labelScheduler.request.bind(controller.labelScheduler);
 const observed={last:null,requests:0};
 controller.labelScheduler.request=args=>{const job=request(args);observed.last=job;observed.requests++;return job;};
 return observed;
}
export async function finishLabelJobs(controller,observed,{expectCommit=true,timeoutMs=3000}={}){
 const started=performance.now();let turns=0;
 while(true){
  assert(++turns<1000,'label jobs failed to settle');
  const job=observed?.last||controller.labelJob;
  if(job?.status==='pending'){
   let timer;try{await Promise.race([job.promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('label job timeout')),Math.max(1,timeoutMs-(performance.now()-started))))]);}finally{clearTimeout(timer);}
  }
  await Promise.resolve();
  assert(performance.now()-started<timeoutMs,'label jobs failed to settle within timeout');
  if(controller.labelScheduler.getState().pendingKey===null&&(observed?.last||controller.labelJob)===job)break;
  await delay(0);
 }
 if(expectCommit){
  assert(controller.labelKey,'expected committed label key, not an empty asynchronous pass');
  assert.equal(controller.labelScheduler.getState().cachedKey,controller.labelKey,'current production job must supply the committed labels');
  assert.equal(controller.labelScheduler.getState().pendingKey,null);
  const job=observed?.last||controller.labelJob;assert(job,'expected a real production scheduler request');
  assert.equal(job.stats.canceled,false);assert.equal(job.stats.error,undefined);assert.equal(job.stats.commitError,undefined);
  assert.equal(job.stats.computed,job.stats.candidates,'all candidate anchors must finish before comparison');
 }
}
