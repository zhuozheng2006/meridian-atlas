import {readJSON,forgetJSON} from './map-engine.js?v=3.57.0-100cb4a60c31';
const ROOT='data/awmc/',YEARS=[117,200],frames=new Map();
export function awmcWindowFor(bounds,year){
 if(!YEARS.includes(year)||!bounds)return null;
 const w=bounds.getWest(),e=bounds.getEast(),s=bounds.getSouth(),n=bounds.getNorth();
 if(![w,e,s,n].every(Number.isFinite)||s>n||e<w||e-w>180)return null;
 const x=(w+e)/2,y=(s+n)/2;
 return x>=25&&x<=52&&y>=20&&y<=46?{id:'awmc-roman',zh:'西亚 · 罗马时期',en:'Western Asia · Roman period',root:ROOT,bounds:[25,20,52,46],years:YEARS}:null;
}
const file=(year,kind)=>ROOT+`roman_empire_ce_${year}_${kind}.geojson.gz`;
async function original(year,kind,type,count){
 const url=file(year,kind);try{const data=await readJSON(url);if(data?.type!=='FeatureCollection'||data.features?.length!==count||data.features.some(f=>f.geometry?.type!==type))throw Error('Invalid AWMC source');return data;}finally{forgetJSON(url);}
}
export async function readAwmcSnapshot(year){
 if(!YEARS.includes(year))throw Error('Unavailable AWMC year');
 if(!frames.has(year)){const pending=(async()=>{
  const [extent,provinces]=await Promise.all([original(year,'extent','Polygon',112),year===200?original(year,'provinces','LineString',81):null]);
  const base={archive:'awmc',type:'administrative',start_date:String(year),end_date:String(year),start_decdate:year,end_decdate:year+.9999};
  const territory={type:'Feature',properties:{...base,id:'awmc-roman-'+year,osm_id:-2100000000-year,admin_level:2,name:'Roman Empire',name_en:'Roman Empire',name_zh:'罗马帝国',source_name:'Roman imperial extent',source_fragments:112},geometry:{type:'MultiPolygon',coordinates:extent.features.map(f=>f.geometry.coordinates)}};
  const lines=(provinces?.features||[]).map((f,i)=>({type:'Feature',properties:{...base,id:`awmc-province-line-${year}-${i}`,osm_id:-2110000000-i,admin_level:4,source_line_id:f.properties.OBJECTID,geometry_kind:'province-line'},geometry:f.geometry}));
  return {type:'FeatureCollection',metadata:{source:'Ancient World Mapping Center',year,datePrecision:'publisher-labelled annual snapshot',relationCount:1,provinceLines:lines.length},features:[territory,...lines]};
 })();frames.set(year,pending);pending.catch(()=>{if(frames.get(year)===pending)frames.delete(year);});}return frames.get(year);
}
export function awmcRecordPanel(p,lang){
 const t=(zh,en)=>lang==='en'?en:zh,node=document.createElement('section'),add=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;node.append(el);return el;},year=Number(p.start_date);
 add('small','AWMC · '+t('古代世界地图中心','Ancient World Mapping Center')).className='historical-eyebrow';add('h3',t('罗马帝国','Roman Empire'));if(lang==='bi')add('p','Roman Empire');
 add('p',t(`公元 ${year} 年 · 疆域研究截面`,`${year} CE · reconstructed territorial extent`));
 add('p',t('北卡罗来纳大学教堂山分校古代世界地图中心编制。可结合地形，阅读安纳托利亚、黎凡特与帝国东部边疆。','Compiled by the Ancient World Mapping Center at UNC Chapel Hill. Explore Anatolia, the Levant and the eastern imperial frontier alongside terrain.'));
 if(year===200)add('p',t('细线显示来源所收录的行省分界。','Fine lines show the province boundaries in the source.'));
 const details=add('details',''),summary=document.createElement('summary'),note=document.createElement('p');summary.textContent=t('年代与图形来源','Dates & geometry');note.textContent=t('按发布者标明的年份展示，保留全部坐标、岛屿与内环；112 个源多边形合并为一条帝国记录。200 年的 81 条行省线保留原样，来源未附行省名。相邻年份仍使用通史概览。','Displayed only at the publisher-labelled years, preserving all coordinates, islands and inner rings. The 112 source polygons form one imperial record. The 81 province lines for 200 CE retain their original geometry; province names are not supplied. Other years use the world-history overview.');details.append(summary,note);
 const links=add('div','');links.className='historical-source-links';for(const [label,url]of [[t('项目与方法','Project & methods'),'https://awmc.unc.edu/'],[t('固定版本来源','Pinned source revision'),'https://github.com/AWMC/geodata/tree/7ecf8bccea2efe1e1e9df2daf6001942de73fb87/Cultural-Data/political_shading'],[t('下载原始疆域','Download original extent'),file(year,'extent')],...(year===200?[[t('下载原始行省线','Download original province lines'),file(year,'provinces')]]:[]),[t('来源清单','Source manifest'),ROOT+'manifest.json']]){const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);}
 add('small','AWMC · UNC Chapel Hill · ODbL 1.0').className='historical-credit';return node;
}
