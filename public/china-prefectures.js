import {chinaNameReviews,reviewedChinaName} from './china-name-reviews.js?v=3.57.0-100cb4a60c31';
import {readJSON,forgetJSON} from './map-engine.js?v=3.57.0-100cb4a60c31';
import {chinaPrefectureBounds} from './china-prefecture-catalog.js?v=3.57.0-100cb4a60c31';
const ROOT='data/china-prefectures/',packs=new Map();let indexPromise;
const names={'Jingzhao Yin':'京兆尹','Jingzhao Fu':'京兆府','Longxi Jun':'陇西郡','Wuwei Jun':'武威郡','Jiuquan Jun':'酒泉郡','Zhangye Jun':'张掖郡','Dunhuang Jun':'敦煌郡','Shuofang Jun':'朔方郡','Yuyang Jun':'渔阳郡','Taiyuan Jun':'太原郡','Taiyuan Fu':'太原府','Henan Fu':'河南府','Hanzhong Jun':'汉中郡','Shang Jun':'上郡','Beidi Jun':'北地郡','Tianshui Jun':'天水郡','Anding Jun':'安定郡','Hongnong Jun':'弘农郡','Zuo Pingyi':'左冯翊','You Fufeng':'右扶风','Jincheng Jun':'金城郡','Yunzhong Jun':'云中郡','Wuyuan Jun':'五原郡','Dai Jun':'代郡','Yanmen Jun':'雁门郡','Shanggu Jun':'上谷郡','Youbeiping Jun':'右北平郡','Liaoxi Jun':'辽西郡','Liaodong Jun':'辽东郡','Shu Jun':'蜀郡','Ba Jun':'巴郡','Hedong Jun':'河东郡','Henan Jun':'河南郡','Henei Jun':'河内郡'};
export const chinaSnapshotYear=y=>Object.hasOwn(chinaPrefectureBounds,String(y));
export function chinaWindowFor(bounds,year){
 if(!bounds||!chinaSnapshotYear(year))return null;
 const w=bounds.getWest(),e=bounds.getEast(),s=bounds.getSouth(),n=bounds.getNorth();
 if(![w,e,s,n].every(Number.isFinite)||s>n||Math.abs(e-w)>180)return null;
 const x=((w+e)/2+180)%360-180,y=(s+n)/2,b=chinaPrefectureBounds[year];
 if(x<b[0]||x>b[2]||y<b[1]||y>b[3])return null;
 const band=Math.floor(x/10)*10;
 return {id:'china-prefectures-'+band,zh:'中国历史区划 · '+year+' 年截面',en:'Chinese historical divisions · '+year+' snapshot',root:ROOT,band,bounds:b,years:[2,742]};
}
export async function readChinaIndex(){
 if(!indexPromise)indexPromise=readJSON(ROOT+'index.json.gz').then(d=>{if(d?.schemaVersion!==1||d.records?.length!==420)throw Error('Invalid China research index');return d;}).catch(e=>{indexPromise=null;forgetJSON(ROOT+'index.json.gz');throw e;});return indexPromise;
}
export async function readChinaSnapshot(window_,year){
 if(!chinaSnapshotYear(year)||!Number.isInteger(window_?.band)||window_.band%10)throw Error('Invalid China snapshot');
 const file='year-'+year+'-band-'+window_.band+'.json.gz',url=ROOT+file;let pending=packs.get(url);
 if(!pending){pending=readJSON(url).then(d=>{if(d?.schemaVersion!==1||d.year!==year||d.band!==window_.band||!d.geometries)throw Error('Wrong China snapshot');return d;}).finally(()=>forgetJSON(url));packs.set(url,pending);pending.catch(()=>{if(packs.get(url)===pending)packs.delete(url);});}
 packs.delete(url);packs.set(url,pending);while(packs.size>3)packs.delete(packs.keys().next().value);
 const [index,pack]=await Promise.all([readChinaIndex(),pending]);
 const features=index.records.filter(r=>r.year===year&&Object.hasOwn(pack.geometries,r.id)).map(r=>{const review=reviewedChinaName(r);return {type:'Feature',properties:{id:r.id,osm_id:-2000000000-r.row,archive:'china-prefectures',type:'administrative',admin_level:4,name:review?.en||r.sourceRecord.PrefNAM,name_en:review?.en||r.sourceRecord.PrefNAM,name_zh:review?.zh||names[r.sourceRecord.PrefNAM]||'',source_name:r.sourceRecord.PrefNAM,name_review_id:review?.id||'',province:r.sourceRecord.ProvNAM,source_id:r.sourceRecord.PrefID,source_row:r.row,start_date:String(year),end_date:String(year),start_decdate:year,end_decdate:year+.9999},geometry:pack.geometries[r.id]};});
 return {type:'FeatureCollection',metadata:{source:'Zheng & Wu (2026)',year,datePrecision:'exact-year snapshot',window:window_,relationCount:features.length},features};
}
export async function chinaRecord(id,window_,year){const [index,frame]=await Promise.all([readChinaIndex(),readChinaSnapshot(window_,year)]);return {source:index.metadata,record:index.records.find(r=>r.id===id),nameReview:reviewedChinaName(index.records.find(r=>r.id===id))||null,geometry:frame.features.find(f=>f.properties.id===id)?.geometry};}
export function chinaRecordPanel(p,lang,download){
 const t=(zh,en)=>lang==='en'?en:zh,node=document.createElement('section'),add=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;node.append(el);return el;};
 add('small',t('中国历史区划 · 研究截面','Chinese historical divisions · research snapshot')).className='historical-eyebrow';add('h3',lang==='en'?p.name_en:p.name_zh||p.name_en);if(lang==='bi'&&p.name_zh)add('p',p.name_en);
 const dl=document.createElement('dl');for(const [key,value]of [[t('截面年份','Snapshot year'),p.start_date],[t('上级地区（来源原名）','Parent region (source name)'),p.province],[t('来源原名','Original source name'),p.source_name||p.name_en],[t('来源编号','Source ID'),p.source_id],[t('研究作者','Researchers'),'Zheng & Wu (2026)']]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;dl.append(dt,dd);}node.append(dl);
 const review=chinaNameReviews[p.name_review_id];if(review){const details=add('details',''),summary=document.createElement('summary'),note=document.createElement('p');summary.textContent=t('名称考证','Name review');note.textContent=t(review.evidence,review.year===742?'Period name checked against the first-year Tianbao renaming in Old Book of Tang, juan 40. The source label is retained above.':'Name checked against Book of Han, juan 28. The original source label is retained above.');details.append(summary,note);for(const source of review.sources){const a=document.createElement('a');a.href=source.url;a.textContent=t(source.title,source.url.includes('zdic.net')?'Dictionary · historical pronunciation':review.year===742?'Old Book of Tang · juan 40':'Book of Han · juan 28')+(source.section?' · '+source.section:'');a.target='_blank';a.rel='noopener noreferrer';details.append(a);}}
 const links=add('div','');links.className='historical-source-links';for(const [label,url]of [[t('研究论文','Research paper'),'https://doi.org/10.1038/s41597-026-07086-6'],[t('原始数据与方法','Dataset & methods'),'https://doi.org/10.6084/m9.figshare.30518417.v2'],[t('下载原始区划文件','Original boundary files'),ROOT+'ResearchArea-originals.zip']]){const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);}
 const details=add('details',''),summary=document.createElement('summary'),note=document.createElement('p');summary.textContent=t('来源说明','Source notes');note.textContent=t('图层依据《中国历史地图集》重建，本批展示公元 2 年与 742 年两个截面。经核对的名称采用当年名称，原名与考证另列；保留合并单元。部分边疆、水面在研究区之外。原始 Albers 坐标按其椭球反投影，未推定基准转换。人口估算用的模拟县界未纳入此图。原始属性中的 Source、RECORDS 描述人口依据。','Reconstructed from The Historical Atlas of China for the two displayed snapshots, 2 and 742 CE. Reviewed names use period labels, with original names and evidence preserved; merged units remain intact; some frontier areas and water surfaces fall outside the study area. Albers coordinates are inverse-projected on the source ellipsoid without an inferred datum shift. Simulated county boundaries are excluded. Source and RECORDS fields describe population evidence.');details.append(summary,note);
 add('small','CC BY 4.0 · ResearchArea').className='historical-credit';const button=add('button',t('下载这条记录','Download this record'));button.className='regional-dossier';button.onclick=async()=>{button.disabled=true;try{await download();}catch{button.textContent=t('读取失败，点击重试','Could not load; retry');}finally{button.disabled=false;}};return node;
}
