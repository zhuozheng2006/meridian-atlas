import {readJSON,forgetJSON,formatYear} from './map-engine.js?v=4.19.0-f36674756582';
import {chinaPrefectureBounds} from './china-prefecture-catalog.js?v=4.19.0-f36674756582';
let reviewsModPromise=null,reviewsMod=null;
async function ensureChinaReviews(){
 if(reviewsMod)return reviewsMod;
 if(!reviewsModPromise)reviewsModPromise=import('./china-name-reviews.js?v=4.19.0-f36674756582').then(m=>{reviewsMod=m;return m;}).catch(e=>{reviewsModPromise=null;throw e;});
 return reviewsModPromise;
}
const ROOT='data/china-prefectures/',packs=new Map();let indexPromise;
const names={'Jingzhao Yin':'京兆尹','Jingzhao Fu':'京兆府','Longxi Jun':'陇西郡','Wuwei Jun':'武威郡','Jiuquan Jun':'酒泉郡','Zhangye Jun':'张掖郡','Dunhuang Jun':'敦煌郡','Shuofang Jun':'朔方郡','Yuyang Jun':'渔阳郡','Taiyuan Jun':'太原郡','Taiyuan Fu':'太原府','Henan Fu':'河南府','Hanzhong Jun':'汉中郡','Shang Jun':'上郡','Beidi Jun':'北地郡','Tianshui Jun':'天水郡','Anding Jun':'安定郡','Hongnong Jun':'弘农郡','Zuo Pingyi':'左冯翊','You Fufeng':'右扶风','Jincheng Jun':'金城郡','Yunzhong Jun':'云中郡','Wuyuan Jun':'五原郡','Dai Jun':'代郡','Yanmen Jun':'雁门郡','Shanggu Jun':'上谷郡','Youbeiping Jun':'右北平郡','Liaoxi Jun':'辽西郡','Liaodong Jun':'辽东郡','Shu Jun':'蜀郡','Ba Jun':'巴郡','Hedong Jun':'河东郡','Henan Jun':'河南郡','Henei Jun':'河内郡'};
const deferredZh={
 'china-prefecture-742-1':'爱州','china-prefecture-742-2':'长州','china-prefecture-742-3':'武安州',
 'china-prefecture-742-5':'交州（安南都督府）','china-prefecture-742-6':'罗伏州','china-prefecture-742-7':'唐林州',
 'china-prefecture-742-8':'崖·儋·振·万安州','china-prefecture-742-10':'武峨州','china-prefecture-742-13':'高州',
 'china-prefecture-742-16':'春州','china-prefecture-742-17':'恩州','china-prefecture-742-24':'封州',
 'china-prefecture-742-25':'瀼州','china-prefecture-742-26':'笼州','china-prefecture-742-27':'禺州',
 'china-prefecture-742-29':'汤州','china-prefecture-742-30':'山州','china-prefecture-742-31':'冈州',
 'china-prefecture-742-32':'平琴州','china-prefecture-742-33':'新州','china-prefecture-742-46':'藤州',
 'china-prefecture-742-57':'浔州','china-prefecture-742-59':'连州','china-prefecture-742-64':'桂州',
 'china-prefecture-742-66':'姚州','china-prefecture-742-67':'郴州','china-prefecture-742-78':'吉州',
 'china-prefecture-742-90':'温州','china-prefecture-742-117':'歙州','china-prefecture-742-140':'绣州',
 'china-prefecture-742-141':'田州','china-prefecture-742-142':'梧州','china-prefecture-742-143':'容州',
 'china-prefecture-742-145':'巂州','china-prefecture-742-151':'淳州','china-prefecture-742-152':'安南中都护府',
 'china-prefecture-742-153':'环州','china-prefecture-742-154':'矩州','china-prefecture-742-155':'应州',
 'china-prefecture-742-156':'充州','china-prefecture-742-157':'珍州','china-prefecture-742-158':'沔州',
 'china-prefecture-742-164':'柘州','china-prefecture-742-166':'茂州','china-prefecture-742-169':'剑州',
 'china-prefecture-742-241':'郓州','china-prefecture-742-301':'福禄州','china-prefecture-742-313':'济州',
 'china-prefecture-742-314':'仪州','china-prefecture-742-315':'夏胜丰灵宥盐六州及单于·安北大都护府','china-prefecture-742-316':'安东都护府'
};
export function chinaDisplayName(record,review){
 const sourceName=record.sourceRecord.PrefNAM;
 return {zh:review?.zh||names[sourceName]||deferredZh[record.id]||'',en:review?.en||sourceName};
}
export const chinaSnapshotYear=y=>Object.hasOwn(chinaPrefectureBounds,String(y));
export function chinaWindowFor(bounds,year){
 if(!bounds||!chinaSnapshotYear(year))return null;
 const w=bounds.getWest(),e=bounds.getEast(),s=bounds.getSouth(),n=bounds.getNorth();
 if(![w,e,s,n].every(Number.isFinite)||s>n||Math.abs(e-w)>180)return null;
 const x=((w+e)/2+180)%360-180,y=(s+n)/2,b=chinaPrefectureBounds[year];
 if(x<b[0]||x>b[2]||y<b[1]||y>b[3])return null;
 const band=Math.floor(x/10)*10;
 return {id:'china-prefectures-'+band,zh:'中国历史区划 · 公元 '+year+' 年截面',en:'Chinese historical divisions · '+year+' CE snapshot',root:ROOT,band,bounds:b,years:[2,742]};
}
export async function readChinaIndex(){
 if(!indexPromise)indexPromise=readJSON(ROOT+'index.json.gz').then(d=>{if(d?.schemaVersion!==1||d.records?.length!==420)throw Error('Invalid China research index');return d;}).catch(e=>{indexPromise=null;forgetJSON(ROOT+'index.json.gz');throw e;});return indexPromise;
}
export async function readChinaSnapshot(window_,year){
 if(!chinaSnapshotYear(year)||!Number.isInteger(window_?.band)||window_.band%10)throw Error('Invalid China snapshot');
 const file='year-'+year+'-band-'+window_.band+'.json.gz',url=ROOT+file;let pending=packs.get(url);
 if(!pending){pending=readJSON(url).then(d=>{if(d?.schemaVersion!==1||d.year!==year||d.band!==window_.band||!d.geometries)throw Error('Wrong China snapshot');return d;}).finally(()=>forgetJSON(url));packs.set(url,pending);pending.catch(()=>{if(packs.get(url)===pending)packs.delete(url);});}
 packs.delete(url);packs.set(url,pending);while(packs.size>3)packs.delete(packs.keys().next().value);
 const [index,pack,reviews]=await Promise.all([readChinaIndex(),pending,ensureChinaReviews()]);
 const features=index.records.filter(r=>r.year===year&&Object.hasOwn(pack.geometries,r.id)).map(r=>{const review=reviews.reviewedChinaName(r),label=chinaDisplayName(r,review);return {type:'Feature',properties:{id:r.id,osm_id:-2000000000-r.row,archive:'china-prefectures',type:'administrative',admin_level:4,name:label.en,name_en:label.en,name_zh:label.zh,source_name:r.sourceRecord.PrefNAM,name_review_id:review?.id||'',province:r.sourceRecord.ProvNAM,source_id:r.sourceRecord.PrefID,source_row:r.row,start_date:String(year),end_date:String(year),start_decdate:year,end_decdate:year+.9999},geometry:pack.geometries[r.id]};});
 return {type:'FeatureCollection',metadata:{source:'Zheng & Wu (2026)',year,datePrecision:'exact-year snapshot',window:window_,relationCount:features.length},features};
}
export async function readChinaFeature(id,year){
 const match=/^china-prefecture-(2|742)-[1-9]\d{0,2}$/.exec(id);
 if(!match||Number(match[1])!==year)return null;
 const index=await readChinaIndex(),record=index.records.find(r=>r.id===id&&r.year===year);
 if(!record)return null;
 // Every band overlapping the record carries its complete source geometry.
 const [west,,east]=record.bounds,longitude=(west+east)/2,band=Math.floor(longitude/10)*10;
 const frame=await readChinaSnapshot({band},year);
 const feature=frame.features.find(f=>f.properties.id===id);
 if(!feature?.geometry)throw Error('Missing geometry for '+id);
 return {feature,band};
}
async function deferredNameReview(record){
 const audit=await readJSON(ROOT+'name-audit.json'),source=record.sourceRecord;
 return audit.deferred.find(row=>row.id===record.id&&row.year===record.year&&
  row.PrefID===source.PrefID&&row.sourcePrefNAM===source.PrefNAM&&row.ProvNAM===source.ProvNAM)||null;
}
export async function chinaRecord(id,window_,year){
 const [index,frame,reviews]=await Promise.all([readChinaIndex(),readChinaSnapshot(window_,year),ensureChinaReviews()]);
 const record=index.records.find(row=>row.id===id),feature=frame.features.find(f=>f.properties.id===id);
 const nameReview=reviews.reviewedChinaName(record)||null;
 const result={source:index.metadata,record,nameReview,geometry:feature?.geometry};
 if(record&&!nameReview)result.deferredNameReview=await deferredNameReview(record);
 return result;
}
function reviewSourceLinks(sources,lang,year){
 const box=document.createElement('div');
 box.className='historical-review-sources';
 for(const source of sources||[]){
  const link=document.createElement('a');
  const title=lang==='en'?(source.titleEn||(source.url.includes('zdic.net')?'Dictionary · historical pronunciation':year===742?'Old Book of Tang':'Book of Han · juan 28')):source.title;
  const section=lang==='en'?source.sectionEn:source.section;
  link.textContent=section?title+' · '+section:title;
  link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';
  box.append(link);
 }
 return box;
}
export function createChinaReviewDetails(record,review,lang){
 const t=(zh,en)=>lang==='en'?en:zh;
 const details=document.createElement('details'),summary=document.createElement('summary');
 details.className='historical-review-details';
 details.append(summary);
 if(review){
  const note=document.createElement('p');
  const source=review.sources?.[0]?.titleEn?.split(' · ').slice(0,2).join(', ')||'Old Book of Tang';
  summary.textContent=t('当年名称已核 · 查看考证','Period name reviewed · view evidence');
  note.textContent=t(review.evidence,review.evidenceEn||(review.year===742
   ?`Period name checked against ${source} (742 CE).`
   :'Name checked against Book of Han, juan 28.'));
  details.append(note);
  if(lang==='bi'&&review.evidenceEn){
   const translation=document.createElement('p');translation.lang='en';translation.textContent=review.evidenceEn;details.append(translation);
  }
  details.append(reviewSourceLinks(review.sources,lang,review.year));
  return details;
 }
 summary.textContent=t('当年名称待核 · 查看考证','Period name unresolved · view evidence');
 const body=document.createElement('div');details.append(body);
 let pending=false,ready=false;
 async function load(){
  if(!details.open||pending||ready)return;
  pending=true;
  body.textContent=t('正在读取考证记录…','Loading the review…');
  try{
   const entry=await deferredNameReview(record);
   body.replaceChildren();
   const note=document.createElement('p');
   note.textContent=entry?t(entry.reason,entry.reasonEn||'The source label is provisional for this year.'):t('尚无与此来源记录匹配的考证。','No review matches this source record.');
   body.append(note);
   if(lang==='bi'&&entry?.reasonEn){
    const translation=document.createElement('p');translation.lang='en';translation.textContent=entry.reasonEn;body.append(translation);
   }
   if(entry?.sources?.length)body.append(reviewSourceLinks(entry.sources,lang,entry.year));
   ready=true;
  }catch{
   body.textContent=t('考证记录未能载入。','The review could not be loaded.');
   const retry=document.createElement('button');retry.type='button';retry.textContent=t('重试','Retry');retry.onclick=load;body.append(retry);
  }finally{pending=false;}
 }
 details.addEventListener('toggle',load);
 return details;
}
export function chinaRecordPanel(p,lang,download){
 const t=(zh,en)=>lang==='en'?en:zh,node=document.createElement('section'),add=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;node.append(el);return el;};
 add('small',t('中国历史区划 · 研究截面','Chinese historical divisions · research snapshot')).className='historical-eyebrow';add('h3',lang==='en'?p.name_en:p.name_zh||p.name_en);if(lang==='bi'&&p.name_zh)add('p',p.name_en);
 const snapYear=Number(p.start_date),snapLabel=Number.isFinite(snapYear)&&snapYear!==0?formatYear(snapYear,lang==='en'?'en':'zh'):p.start_date;
 const dl=document.createElement('dl');for(const [key,value]of [[t('截面年份','Snapshot year'),snapLabel],[t('上级地区（来源原名）','Parent region (source name)'),p.province],[t('来源原名','Original source name'),p.source_name||p.name_en],[t('来源编号','Source ID'),p.source_id],[t('研究作者','Researchers'),'Zheng & Wu (2026)']]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;dl.append(dt,dd);}node.append(dl);
 const record={id:p.id,year:snapYear,sourceRecord:{PrefID:Number(p.source_id),PrefNAM:p.source_name,ProvNAM:p.province}};
 node.append(createChinaReviewDetails(record,reviewsMod?.reviewedChinaName(record),lang));
 const links=add('div','');links.className='historical-source-links';
 const ledger=document.createElement('a');ledger.textContent=t('在地名考证目录中查看','Read this entry in the place-name index');
 ledger.href='./?division='+encodeURIComponent(p.id.replace(/^china-prefecture-/,''))+'#'+new URLSearchParams({view:'sources',lang});links.append(ledger);
 for(const [label,url]of [[t('研究论文','Research paper'),'https://doi.org/10.1038/s41597-026-07086-6'],[t('原始数据与方法','Dataset & methods'),'https://doi.org/10.6084/m9.figshare.30518417.v2'],[t('下载原始区划文件','Original boundary files'),ROOT+'ResearchArea-originals.zip']]){const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);}
 const details=add('details',''),summary=document.createElement('summary'),note=document.createElement('p');summary.textContent=t('来源说明','Source notes');note.textContent=t('图层依据《中国历史地图集》重建，本批展示公元 2 年与 742 年两个截面。经核对的名称采用当年名称，原名与考证另列；保留合并单元。部分边疆、水面在研究区之外。原始 Albers 坐标按其椭球反投影，未推定基准转换。人口估算用的模拟县界未纳入此图。原始属性中的 Source、RECORDS 描述人口依据。','Reconstructed from The Historical Atlas of China for the two displayed snapshots, 2 and 742 CE. Reviewed names use period labels, with original names and evidence preserved; merged units remain intact; some frontier areas and water surfaces fall outside the study area. Albers coordinates are inverse-projected on the source ellipsoid without an inferred datum shift. Simulated county boundaries are excluded. Source and RECORDS fields describe population evidence.');details.append(summary,note);
 add('small','CC BY 4.0 · ResearchArea').className='historical-credit';const button=add('button',t('下载这条记录','Download this record'));button.className='regional-dossier';button.onclick=async()=>{button.disabled=true;try{await download();}catch{button.textContent=t('读取失败，点击重试','Could not load; retry');}finally{button.disabled=false;}};return node;
}
