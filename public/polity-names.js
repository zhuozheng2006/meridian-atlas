import {polityDisplayData} from './polity-display-names-data.js?v=4.18.0-0acb4e1361f6';

const byRecord=new Map();
for(const rule of polityDisplayData.rules)for(const target of rule.targets)byRecord.set(target.id,{rule,target});
const civilYear=year=>Number.isInteger(year)&&year!==0;
const inRecord=(r,year)=>civilYear(year)&&(!Number.isInteger(r.start)||r.start<=year)&&(!Number.isInteger(r.end)||year<=r.end);

// Names are a view over immutable source records, never a replacement identity.
export function polityNameEvidence(r,year){
 if(!r||!inRecord(r,year))return null;
 const found=byRecord.get(r.id);if(!found)return null;
 const {target,rule}=found;
 return ['id','name','start','end','type'].every(key=>r[key]===target[key])?rule:null;
}
export function polityName(r,lang,year){
 if(!r)return '';
 if(!inRecord(r,year))return r.name||'';
 const rule=polityNameEvidence(r,year);
 return rule?rule.display[lang==='en'?'en':'zh']:lang==='en'?(r.name||''):(r.zhName||r.name||'');
}
export function polityNameSources(r,year){return (polityNameEvidence(r,year)?.sourceIds||[]).map(id=>polityDisplayData.sources[id]);}
export function polityEntityAllowed(r,year){return polityNameEvidence(r,year)?.linkedEntityUse!=='withhold';}

// Verified Chinese display labels for upstream Cliopatria/Wikidata records whose
// raw zhName is missing, an English fallback, or a ruler-list/language/modern-province
// Wikidata label. Kept separate from polityName() so immutable source-name views stay intact.
const POLITY_LABEL_ZH_FIX=new Map([
 ['切尔尼戈夫统治者列表','切尔尼戈夫公国'],['立窝尼亚语','利沃尼亚邦联'],['也门伊玛目列表','也门伊玛目国'],
 ['中山市','中山国'],['梁赞大公','梁赞公国'],['维捷布斯克公爵','维捷布斯克公国'],['大波兰公爵','大波兰公国'],
 ['塞尔维亚大王子','塞尔维亚大公国'],['萨沃伊伯爵','萨伏伊伯国'],['安茹伯爵','安茹伯国'],
 ['阿奎莱亚宗主教','阿奎莱亚宗主教区'],['迪斯蒙伯爵','德斯蒙德伯国'],['阿尔斯特伯爵','阿尔斯特伯国'],
 ['莱格尼察公爵','莱格尼察公国'],['奥索纳伯爵','奥索纳伯国'],['比托姆公爵','比托姆公国'],
 ['施瓦茨堡统治者列表','施瓦茨堡-松德斯豪森侯国'],['瓦尔德克统治者列表','瓦尔德克-皮尔蒙特侯国'],
 ['凯法利尼亚与扎金索斯公爵领地','托科家族领地'],['文奇察省','文奇察公国'],
 ['匈牙利皇冠领地波士尼亚省','波斯尼亚总督区'],['阿尔马尼亚克行省','阿尔马尼亚克伯国'],
 ['米却肯州','米却肯王国'],['玻璃市州','吉打—玻璃市领地'],
 ['Mahameghavahana Dynasty','大云车王朝'],['First Toungoo Empire','东吁第一帝国'],
 ['(Carolingian Empire)','（加洛林帝国）'],['Gothia','哥特兰（哥特诸部）'],
 ['Old Kingdom of Norway','挪威王国'],['Southern Wu','南吴（杨吴）'],
 ['Muzaffarids','穆扎法尔王朝'],['Lohara Dynasty','罗哈拉王朝（克什米尔）'],
 ['Cundinamarca','昆迪纳马卡自由邦'],['Denmark-England','北海帝国（丹麦—英格兰）'],
 ["Samo's Empire",'萨莫斯拉夫邦联'],['Jaunpur Sultanate','章普尔苏丹国'],
 ['Republic of Uryankhay','乌梁海共和国'],['Zayyanid dynasty','扎扬王朝'],
 ['Kapisa','迦毕试王国'],['Nawab of Awadh','阿瓦德纳瓦卜领国'],
 ['Principality of Minsk','明斯克公国'],['Asir','阿西尔伊德里斯酋长国'],
 ['Thracian Kingdom','色雷斯王国'],['Sulayhid Dynasty','苏莱希德王朝'],
 ['Balasagan','巴拉萨干'],['Principality of Terebovlia','捷列博夫利亚公国'],
 ['Thuringian states','图林根诸邦'],['Kingdom of Thuringia','图林根王国'],
 ['Kingdom of Africa','西西里非洲王国'],['Angevins','安茹帝国'],
 ['Taifa of Granada','格拉纳达泰法'],['County of Poitou','普瓦图伯国'],
 ['Taifa of Almería','阿尔梅里亚泰法'],['Principality of Drutsk','德鲁茨克公国'],
 ['County of Périgord','佩里戈尔伯国'],['Ryazan','梁赞公国'],
 ['Duchy of Tuscia','图西亚公国'],['Rugiland','鲁吉兰（鲁吉人王国）'],
 ['Sultanate of Sambaliung','桑巴利翁苏丹国'],['Qataban','卡塔班王国'],
 ['Taifa of Carmona','卡尔莫纳泰法'],['Despotate of Arta','阿尔塔专制国'],
 ['Principality of Beloozero','白湖公国'],['Taifa of Algeciras','阿尔赫西拉斯泰法'],
 ['Taifa of Albarracín','阿尔瓦拉辛泰法'],['Duchy of Kuyavia','库亚维亚公国'],
 ['County of Besalú','贝萨卢伯国'],['Taifa of Silves','西尔维什泰法'],
 ['Kampili Kingdom','坎皮利王国'],['Kingdom of Dambadeniya','丹巴德尼亚王国'],
 ['Thebans','底比斯城邦'],['Taifa of Arcos','阿尔科斯泰法'],
 ['Janapada of Gandhāra','犍陀罗国'],['Taifa of Saltés and Huelva','萨尔特斯—韦尔瓦泰法'],
 ['Janapada of Cedī','支提国'],['County of Aragon','阿拉贡伯国'],
 ['Zurayid dynasty','祖赖伊德王朝'],['County of Pallars Sobirà','上帕利亚尔斯伯国'],
 ['Taifa of Alpuente','阿尔蓬特泰法'],['Kingdom of Powys Wenwynwyn','波伊斯温温温王国'],
 ['Sultanate of Mempawah','喃吧哇苏丹国'],['Duchy of Kalisz','卡利什公国'],
 ['Principality of Svaneti','斯瓦涅季公国'],['Texcoco','特斯科科'],
 ['Taifa of Santa Maria do Algarve','阿尔加维泰法'],['Taifa of Niebla','涅夫拉泰法'],
 ['Namayan','纳马延王国'],['Kingdom of Namayan','纳马延王国'],['Kashmir Sultanate','克什米尔苏丹国'],['Bima Sultanate','比马苏丹国'],['Taifa of Morón','莫龙泰法'],
 ['County of Pallars Jussà','下帕利亚尔斯伯国'],['Kingdom of Dunoting','杜诺廷王国'],
 ['Taifa of Ronda','龙达泰法'],['Taifa of Ceuta','休达泰法'],
 ['Kingdom of Powys Fadog','法多格波伊斯王国'],['Hashemite Arab Federation','阿拉伯联邦（哈希姆）'],
 ['Taifa of Tejada','特哈达泰法'],['巴厘省','巴厘王国'],
 ['巴达维亚共和国 (荷兰殖民地)总督','巴达维亚共和国'],['墨西哥人 (墨西哥合众国)','墨西加诸部（阿兹特克）'],
 ['那不勒斯王国 (1806年－1815年)','那不勒斯王国（拿破仑时期）'],['查谟-克什米尔 (土邦)','查谟-克什米尔土邦'],
 ['克里特州 (奥斯曼帝国)','克里特国（自治邦）']
]);
export function displayPolityZh(raw,range){
 if(!raw)return '';
 const mapped=POLITY_LABEL_ZH_FIX.get(raw);
 if(mapped)return mapped;
 const start=range?.start??range?.min,end=range?.end??range?.max;
 if(raw==='Later Zhou'&&Number.isFinite(start)&&start<0)return '东周';
 if(raw==='Xia'&&Number.isFinite(start)&&Number.isFinite(end)&&start>=400&&end<=450)return '胡夏';
 if(raw==='Min'&&Number.isFinite(start)&&Number.isFinite(end)&&start>=900&&end<=950)return '闽国';
 return raw;
}
export function displayPolityName(r,lang,year){
 const raw=polityName(r,lang,year);
 return lang==='en'||!r?raw:displayPolityZh(raw,r);
}

// All-period lists choose and expose a real year before asking for a name.
export function polityReferenceYear(r,desired){
 if(!Number.isInteger(r?.start)||!Number.isInteger(r?.end)||r.start>r.end)return null;
 const year=civilYear(desired)?Math.max(r.start,Math.min(r.end,desired)):r.start;
 return year===0?(r.start<0?-1:r.end>0?1:null):year;
}
export function polityNameGroupKey(r){
 const rule=polityNameEvidence(r,polityReferenceYear(r));
 return JSON.stringify([r.name,rule?.id||'source']);
}
export function politySearchText(r,year){
 const rule=polityNameEvidence(r,year);
 const zh=polityName(r,'zh',year),dispZh=displayPolityZh(zh,r);
 return [r.name,zh,dispZh!==zh?dispZh:'',polityName(r,'en',year),...(rule?[]:[r.enName])].filter(Boolean).join(' ').toLowerCase();
}
export function representativePolityRecord(records,r,year){
 const key=polityNameGroupKey(r),distance=x=>Math.abs((polityReferenceYear(x,year)??year)-year);
 return records.filter(x=>x.type==='POLITY'&&polityNameGroupKey(x)===key).reduce((best,x)=>distance(x)<distance(best)?x:best,r);
}
export function searchPolityRecords(records,query,year,limit=12){
 const q=query.trim().toLowerCase();if(!q)return [];
 const matches=records.filter(r=>r.type==='POLITY').map(record=>({record,year:polityReferenceYear(record,year)})).filter(x=>x.year!==null&&politySearchText(x.record,x.year).includes(q));
 const exact=x=>[polityName(x.record,'zh',x.year),displayPolityName(x.record,'zh',x.year),polityName(x.record,'en',x.year)].some(n=>n&&n.toLowerCase()===q)?0:1;
 matches.sort((a,b)=>Math.abs(a.year-year)-Math.abs(b.year-year)||exact(a)-exact(b)||b.record.area-a.record.area||a.record.id.localeCompare(b.record.id));
 const seen=new Set();return matches.filter(x=>{const key=polityNameGroupKey(x.record);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,limit);
}
export function groupPolityRecords(records,year){
 const groups=new Map();
 for(const r of records){
  if(r.type!=='POLITY')continue;
  const key=polityNameGroupKey(r),g=groups.get(key),labelYear=polityReferenceYear(r,year);
  if(labelYear===null)continue;
  if(!g){groups.set(key,{...r,min:r.start,max:r.end,count:1,labelYear});continue;}
  const min=Math.min(g.min,r.start),max=Math.max(g.max,r.end),count=g.count+1;
  groups.set(key,Math.abs(labelYear-year)<Math.abs(g.labelYear-year)?{...r,min,max,count,labelYear}:{...g,min,max,count});
 }
 return [...groups.values()];
}
export function polityChainBucket(key,buckets=64){
 let h=2166136261;
 for(let i=0;i<key.length;i++)h=Math.imul(h^key.charCodeAt(i),16777619);
 return (h>>>0)%buckets;
}
export function polityChainPath(r){
 const key=typeof r==='string'?r:polityNameGroupKey(r);
 return `data/fast/polity-chains/b-${String(polityChainBucket(key)).padStart(2,'0')}.json.gz`;
}
function spanReference(g,desired){
 let bestYear=null,bestSpan=null,bestDist=Infinity;
 for(const sp of g.s){
  const [s,e]=sp;
  let y=civilYear(desired)?Math.max(s,Math.min(e,desired)):s;
  if(y===0)y=s<0?-1:e>0?1:null;
  if(y===null)continue;
  const dist=civilYear(desired)?Math.abs(y-desired):0;
  if(dist<bestDist){bestDist=dist;bestYear=y;bestSpan=sp;}
 }
 return bestYear===null?null:{year:bestYear,zh:bestSpan[2]??g.zh,en:bestSpan[3]??g.en};
}
const _polityIndexHay=new WeakMap();
export function searchPolityIndex(index,query,year,limit=12){
 const q=query.trim().toLowerCase();if(!q||!index?.groups)return [];
 const matches=[];
 for(const g of index.groups){
  let hay=_polityIndexHay.get(g);
  if(hay===undefined){
   const dispZh=displayPolityZh(g.zh,g),spanDisp=g.s.map(sp=>sp[2]?displayPolityZh(sp[2],{start:sp[0],end:sp[1]}):'');
   hay=[g.n,g.zh,dispZh!==g.zh?dispZh:'',g.en,...g.s.flatMap(sp=>sp.slice(2)),...spanDisp,...(g.x||[])].filter(Boolean).join(' ').toLowerCase();
   _polityIndexHay.set(g,hay);
  }
  if(!hay.includes(q))continue;
  const ref=spanReference(g,year);
  if(!ref)continue;
  const dispRefZh=displayPolityZh(ref.zh,g);
  const exact=[ref.zh,dispRefZh,ref.en,g.n].some(n=>n&&n.toLowerCase()===q)?0:1;
  matches.push({group:g,year:ref.year,zh:ref.zh,en:ref.en,exact});
 }
 matches.sort((a,b)=>Math.abs(a.year-year)-Math.abs(b.year-year)||a.exact-b.exact||b.group.a-a.group.a||a.group.id.localeCompare(b.group.id));
 return matches.slice(0,limit);
}
export function groupPolityIndex(index,year){
 if(!index?.groups)return [];
 return index.groups.map(g=>{
  const ref=spanReference(g,year);
  return {id:g.id,name:g.n,zhName:ref?.zh??g.zh,enName:ref?.en??g.en,min:g.min,max:g.max,count:g.c,labelYear:ref?.year??g.min,groupKey:g.k,bucket:g.b,area:g.a};
 });
}
