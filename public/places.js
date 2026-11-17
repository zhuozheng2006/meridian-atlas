import {readJSON,formatYear,civilYear} from './map-engine.js?v=3.69.0-e953c306ee1f';
import {placeWindow} from './view-state.js?v=3.69.0-e953c306ee1f';
// Editorially reviewed archaeological sites. They live in their own sourced
// layer: representative points of listed heritage properties, dated only to the
// period their source states, and never merged with the urban observations that
// happen to sit nearby.
const attestedCache=new WeakMap();
export function attestedPlaces(layer){
 if(!layer||typeof layer!=='object')return [];
 // Derived once per loaded layer: repeated loads must hand back the same objects,
 // otherwise callers that compare cached place lists stop matching by identity.
 if(attestedCache.has(layer))return attestedCache.get(layer);
 const list=(layer.records||[]).filter(r=>r.period&&Number.isFinite(r.period.start)&&Number.isFinite(r.period.end)&&r.location?.coordinates?.length===2).map(r=>({
  id:r.id,kind:'attested-site',source:'attested-sites',name:r.nameEn,nameZh:r.nameZh,displayName:r.nameEn,displayNameZh:r.nameZh,
  otherNames:r.aliases||[],region:r.region,coordinates:r.location.coordinates,
  periods:[[r.period.start,r.period.end]],
  sourceUrl:r.sources?.[0]?.url,referenceCount:(r.sources||[]).length,
  attested:r
 }));
 attestedCache.set(layer,list);return list;
}
export async function loadPlaces(includeModern=false){
 const names=['historical-settlements-index','historical-capitals','urban-observations',...(includeModern?['modern-cities']:[])];
 const results=await Promise.allSettled([...names.map(n=>readJSON(`data/places/${n}.json.gz`)),readJSON('data/places/attested-places.json.gz')]);
 const data=results.filter(r=>r.status==='fulfilled').flatMap(r=>r.value.places||r.value.claims||r.value.cities||attestedPlaces(r.value));
 if(!data.length)throw Error('Place archives unavailable');
 data.partial=results.some(r=>r.status==='rejected');return data;
}
export async function placeDetail(p){
 if(p.detailsShard===undefined)return p;
 const shard=await readJSON(`data/places/settlements-${String(p.detailsShard).padStart(3,'0')}.json.gz`);
 const full=shard[p.id];if(!full)throw Error('Missing place record');
 return {...full,...p,description:full.description,names:full.names,sourceUrl:full.sourceUrl,referenceUrls:full.referenceUrls,authors:full.authors,location:full.locations?.find(l=>l.coordinates[0]===p.coordinates[0]&&l.coordinates[1]===p.coordinates[1]&&l.accuracyMeters===p.location?.accuracyMeters&&JSON.stringify(l.periods)===JSON.stringify(p.location?.periods))||p.location};
}
// Quarantined Wikidata capital claims whose explicit date qualifiers exhibit
// unmistakable upstream sign flips or century-as-year encoding errors. Raw claims
// remain untouched in historical-capitals.json.gz while display is withheld.
export const CAPITAL_DATE_QUARANTINE=new Set([
 'capital:Q180568$5ac9055c-44f4-93a7-fcb7-88674c46b701', // Egyptian Empire (New Kingdom) Thebes [-1336, 1279]: +1279 sign error for -1279
 'capital:Q2980623$613b5f92-45dd-ce9b-abcd-9c5fc0145c32', // Kingdom of Bosnia Visoko [9, 1340]: +9 typo extending medieval state to antiquity
 'capital:Q3627069$d0b39cb4-4d5e-15ee-4f60-725632ee182d', // Banate of Bosnia Bobovac [14, 14]: +14 typo for 14th century
 'capital:Q83958$cf01679d-4565-d213-61db-12abfbc7b7b4', // Macedonia Aigai [808, 808]: +808 sign error for 808 BCE
]);
// Quarantined urban observations whose upstream Western Hemisphere longitudes dropped
// the leading minus sign, displacing American settlements into Asia/Bay of Bengal.
export const PLACE_COORD_QUARANTINE=new Set([
 'chandler:422',  // El Tajin, Mexico [97.3782, 20.4481] (omitted minus sign; actually -97.3782)
 'chandler:545',  // Hamilton, Canada [79.866092, 43.250022] (omitted minus sign; actually -79.866092)
 'chandler:1192', // Richmond, United States [77.4667, 37.5333] (omitted minus sign; actually -77.4667)
]);
const CAPITAL_ZH_FIX=new Map([['Q5736','阿玛尔纳']]);
const CAPITAL_ZH_EDITORIAL=new Map([
 ['Q4445604','苏扎克'],['Q12489692','克尔托'],['Q12505828','普莱雷特'],['Q3537816','内寇尔'],
 ['Q7066653','诺瓦塔'],['Q31917158','哈卡'],['Q31916975','韦斯卡'],['Q33186','博博瓦茨'],
 ['Q404200','埃盖'],['Q115738657','拉韦纳'],['Q31844059','托莱多'],['Q116170766','马德里'],
 ['Q31925679','巴利亚多利德'],['Q1017178','楚夫特卡莱'],['Q289618','曼苏里耶']
]);
const CAPITAL_POLITY_FIX=new Map([
 ['Q123027565',{zh:'克什米尔苏丹国'}],['Q23039102',{zh:'东吁第一帝国'}],['Q146246',{en:'Francia'}]
]);
const capitalZh=p=>p?.kind==='dated-capital'?(CAPITAL_ZH_FIX.get(p.qid)||p.nameZh||CAPITAL_ZH_EDITORIAL.get(p.qid)||''):p?.nameZh||'';
// Editorial Chinese exonyms for verified historical & major modern urban settlements
// lacking upstream Chinese labels in Chandler/Modelski/Pleiades. Never mutates frozen raw data
// and never overrides dated nameTimeline or datedNames epochs.
const PLACE_ZH_EDITORIAL=new Map([
 // Historical Chandler & Modelski ancient urban records
 ['chandler:1510','毗奢耶那伽罗'],['chandler:478','加里波利'],['chandler:474','高尔（高达）'],['chandler:502','格拉纳达'],
 ['chandler:670','镰仓'],['chandler:110','蒲甘'],['chandler:885','马拉喀什'],['chandler:1260','萨莱'],
 ['chandler:35','哈萨'],['modelski-ancient:5','哈萨'],['chandler:643','章普尔'],['chandler:480','热那亚'],
 ['chandler:1419','天水'],['chandler:1408','特斯科科'],['chandler:66','阿尼'],['modelski-ancient:9','阿尼'],
 ['chandler:1124','波隆纳鲁瓦'],['chandler:242','加的斯'],['chandler:533','海宁'],['chandler:1022','诺夫哥罗德'],
 ['chandler:1141','普雷斯拉夫'],['chandler:1165','库姆'],['chandler:1450','特里尔'],['modelski-ancient:137','特里尔'],
 ['chandler:12','阿卡'],['chandler:251','卡利卡特'],['chandler:588','霍尔木兹'],['chandler:831','潞城'],
 ['chandler:929','米利都'],['chandler:1008','尼姆鲁德'],['chandler:1100','波斯波利斯'],['chandler:1317','苏丹尼耶'],
 ['chandler:1392','特尔戈维什泰'],['modelski-ancient:66','克诺索斯'],['chandler:115','八剌沙衮'],['chandler:19','阿格里真托'],
 ['chandler:81','阿尔戈斯'],['chandler:83','阿尔勒'],['chandler:491','果阿'],['chandler:792','莱昂'],
 ['chandler:798','辽东'],['chandler:1033','奥赫里德'],['chandler:1070','帕多瓦'],['chandler:1560','山口'],
 ['chandler:1593','大津巴布韦'],['modelski-ancient:45','二里头'],['modelski-ancient:84','摩亨佐-达罗'],
 ['modelski-ancient:81','梅里达'],['chandler:75','隞（郑州）'],
 // Modern >=1M settlements lacking Chinese names
 ['modelski-modern:76','埃卡特佩克'],['modelski-modern:281','阳城'],['modelski-modern:238','塞提夫'],['chandler:408','杜塞尔多夫'],
 ['modelski-modern:210','启东'],['modelski-modern:87','瓜鲁柳斯'],['modelski-modern:106','桦甸'],['modelski-modern:266','乌鲁木齐'],
 ['modelski-modern:142','耒阳'],['modelski-modern:117','江阴'],['chandler:411','东柏林'],['modelski-modern:79','防城港'],
 ['modelski-modern:247','宿迁'],['modelski-modern:285','宜兴'],['modelski-modern:85','戈亚尼亚'],['modelski-modern:288','禹州'],
 ['modelski-modern:153','麻城'],['modelski-modern:225','瑞安'],['modelski-modern:262','天水'],['modelski-modern:48','常熟'],
 ['modelski-modern:93','海城'],['modelski-modern:42','卡卢坎'],['modelski-modern:119','即墨'],['modelski-modern:144','涟源'],
 ['modelski-modern:224','顿河畔罗斯托夫'],
 // High-reference Pleiades classical settlements (ref>=30)
 ['pleiades:668331','巴尔米拉'],['pleiades:422995','奥斯蒂亚'],['pleiades:599612','以弗所'],['pleiades:570182','科林斯'],
 ['pleiades:432873','赫库兰尼姆'],['pleiades:442658','梅塔蓬托'],['pleiades:893990','杜拉-欧罗波斯'],['pleiades:462086','阿格里真托'],
 ['pleiades:423013','普赖内斯特'],['pleiades:423108','图斯库卢姆'],['pleiades:462307','麦加拉·希布莱亚'],['pleiades:530824','布特林特'],
 ['pleiades:903021','埃克巴坦那'],['pleiades:638753','阿佛洛狄西亚'],['pleiades:413005','阿尔巴·富琴斯'],['pleiades:432815','普泰奥利'],
 ['pleiades:413332','塔尔奎尼亚'],['pleiades:413393','武尔奇'],['pleiades:452457','锡巴里斯'],
 // v3.67 Wave-2 verified historical, classical & global urban Chinese exonyms
 ['chandler:181','比贾布尔'],['chandler:1093','勃固'],['chandler:1083','帕坦'],['modelski-ancient:99','帕坦'],
 ['modelski-ancient:15','阿帕米亚'],['chandler:1423','廷尼斯'],['modelski-ancient:134','廷尼斯'],['chandler:1136','波托西'],
 ['chandler:1173','拉杰马哈尔'],['modelski-ancient:85','摩普绥提亚'],['modelski-ancient:136','图拉'],['chandler:380','达尔'],
 ['chandler:78','若开'],['chandler:868','曼杜'],['chandler:51','阿梅尔'],['chandler:1224','堺市'],
 ['chandler:476','格但斯克'],['chandler:443','费奥多西亚'],['chandler:614','阿瓦'],['modelski-ancient:113','萨皮努瓦'],
 ['chandler:253','坎贝'],['chandler:275','钱德里'],['chandler:108','巴达米'],['chandler:620','伊奢那补罗'],
 ['chandler:789','莱顿'],['chandler:156','贝宁城'],['chandler:410','济比尔恰尔通'],['chandler:597','胡格利-楚丘拉'],
 ['chandler:876','曼苏拉'],['chandler:11','亚齐'],['chandler:59','安巴尔'],['chandler:145','贝贾亚'],
 ['chandler:306','乔卢拉'],['chandler:862','马里'],['chandler:1016','恩加扎尔加穆'],['chandler:1072','派坦'],
 ['chandler:1078','潘杜阿'],['chandler:1163','奎隆'],['chandler:1332','斯里兰加帕特纳'],['chandler:1441','东吁'],
 ['chandler:1578','扎法尔'],['chandler:596','顺化'],['chandler:317','科钦'],['chandler:752','呼和浩特'],
 ['chandler:1374','台南'],['chandler:1318','索姆纳特'],['chandler:1403','特纳尤卡'],['chandler:17','阿加德兹'],
 ['chandler:85','阿罗尔'],['chandler:125','万丹'],
 ['chandler:1206','顿河畔罗斯托夫'],['chandler:365','代顿'],['chandler:657','华雷斯城'],['chandler:1041','波尔图'],
 ['chandler:763','科威特城'],['chandler:1583','扎波罗热'],['chandler:1596','苏黎世'],['chandler:499','哥德堡'],
 ['chandler:1028','俄克拉荷马城'],['chandler:1480','乌鲁木齐'],['chandler:1532','威斯巴登'],
 ['chandler:747','克里沃罗格'],['chandler:1431','托莱多'],['chandler:1162','魁北克城'],['chandler:41','阿伦敦'],
 ['chandler:492','戈亚尼亚'],['chandler:89','亚松森'],['chandler:308','霍茹夫'],
 ['pleiades:413107','科萨'],['pleiades:423060','萨特里库姆'],['pleiades:432846','弗雷盖拉'],['pleiades:403212','波普洛尼亚'],
 ['pleiades:422914','克鲁斯图梅里乌姆'],['pleiades:422987','诺尔巴'],['pleiades:413288','鲁塞莱'],['pleiades:422843','阿尔代亚'],
 ['pleiades:413328','苏特里乌姆'],['pleiades:432992','奥普隆提斯'],['pleiades:433143','塔拉奇纳'],['pleiades:79368','卡莱瓦'],
 ['pleiades:403292','沃拉泰拉'],['pleiades:432940','明图尔奈'],['pleiades:462372','莫尔甘蒂纳'],['pleiades:413125','法莱里伊'],
 ['pleiades:413157','格拉维斯卡'],['pleiades:736932','卡拉尼斯'],['pleiades:442603','格鲁门图姆'],['pleiades:442847','韦努西亚'],
 ['pleiades:452337','维博瓦伦蒂亚'],['pleiades:422932','加比伊'],['pleiades:403235','卢纳'],['pleiades:422960','拉维尼乌姆'],
 ['pleiades:413248','佩鲁西亚'],['pleiades:315223','图加'],['pleiades:462237','赫拉克利亚·米诺阿'],['pleiades:462506','陶罗梅尼乌姆'],
 ['pleiades:344448','大莱波蒂斯'],['pleiades:422824','阿尔巴隆加'],
 // v3.68 Wave-3 verified pre-1800 world cities, early urban hearths & classical Pleiades sites
 ['chandler:524','古马尔卡赫'],['chandler:963','穆尔希达巴德'],['chandler:49','阿马拉普拉'],['chandler:630','伊兹尼克'],
 ['chandler:983','南海'],['chandler:274','金德讷格尔'],['chandler:441','法鲁卡巴德'],['chandler:1304','锡拉'],
 ['chandler:786','里窝那'],['chandler:185','平定'],['chandler:305','奇图尔'],
 ['chandler:333','科西姆巴扎尔'],['chandler:387','第乌'],['chandler:447','菲鲁兹库赫'],['chandler:573','平泉'],
 ['chandler:667','卡林贾尔'],['chandler:793','大莱波蒂斯'],['chandler:933','米尔扎布尔'],['chandler:1305','尸罗夫'],
 ['chandler:1383','塔卢坎'],['chandler:1432','图拉'],['chandler:1446','特拉凯'],['chandler:1581','扎姆法拉'],
 ['chandler:859','马拉加'],['chandler:1047','奥尔良'],['chandler:1223','塞易斯'],['chandler:1409','塔纳'],
 ['chandler:409','德温'],['chandler:1007','尼姆'],['chandler:425','埃洛拉'],['chandler:493','戈尔康达'],
 ['chandler:881','马里卜'],['chandler:887','马都八'],['chandler:1412','特达'],['chandler:1509','维埃纳'],
 ['chandler:216','布雷西亚'],['chandler:39','阿拉达'],['chandler:201','布斯特'],['chandler:223','布罗奇'],
 ['chandler:247','卡哈马基亚'],['chandler:337','克雷莫纳'],['chandler:407','杜尔-库里加尔祖'],['chandler:622','伊什塔赫尔'],
 ['chandler:671','迦摩缕波'],['chandler:704','克久拉霍'],['chandler:720','基什'],['chandler:738','憍赏弥'],
 ['chandler:856','满者伯夷'],['chandler:915','梅里达'],['chandler:916','梅里达'],['chandler:1152','奔那伐弹那'],
 ['chandler:1468','钦聪灿'],['chandler:1491','伐腊毗'],['chandler:1558','亚兹德'],['modelski-ancient:57','伊辛'],
 ['modelski-ancient:70','拉拉克'],['modelski-ancient:71','拉尔萨'],['modelski-ancient:142','乌玛'],['chandler:76','阿帕米亚'],
 ['chandler:43','阿尔梅里亚'],['chandler:48','阿马尔菲'],['chandler:99','阿维尼翁'],['chandler:477','杰拉'],
 ['chandler:1263','萨迪斯'],['chandler:1467','推罗'],['modelski-ancient:112','三星堆'],['modelski-ancient:125','塔尼斯'],
 ['chandler:842','澳门'],['chandler:828','吕贝克'],['chandler:1065','俄克喜林库斯'],['chandler:1117','普利斯卡'],
 ['chandler:1111','皮亚琴察'],['chandler:399','敦煌'],['modelski-ancient:14','隞'],['chandler:599','赫尔河畔金斯顿'],
 ['chandler:761','屈塔希亚'],['chandler:1478','乌尔米耶'],['chandler:877','曼图亚'],['chandler:967','迈锡尼'],
 ['chandler:1011','尼普尔'],['chandler:1055','奥斯蒂亚'],['chandler:1060','瓦拉塔'],['chandler:1091','帕维亚'],
 ['chandler:1105','佩特拉'],['chandler:1310','索巴'],['chandler:1325','施派尔'],['chandler:1347','苏达克'],
 ['chandler:1387','耽摩栗底'],['chandler:1449','特雷斯萨波特斯'],['chandler:1576','伊普尔'],['chandler:1586','森波阿拉'],
 ['pleiades:462503','叙拉古'],['pleiades:570668','西库翁'],['pleiades:167717','卢格杜努姆'],['pleiades:393379','阿里米努姆'],
 ['pleiades:433075','萨勒努姆'],['pleiades:442810','塔兰托'],['pleiades:403253','比萨'],['pleiades:570106','阿尔戈斯'],
 ['pleiades:589796','戈尔廷'],['pleiades:599799','米利都'],['pleiades:658457','埃德萨'],['pleiades:570479','麦西尼'],
 ['pleiades:961886','巴克特拉（蓝氏城）'],['pleiades:207549','维米纳基乌姆'],
 ['chandler:2','亚琛'],['chandler:23','普罗旺斯地区艾克斯'],['chandler:32','亚历山德里亚'],['chandler:50','阿马尔奈'],
 ['chandler:79','阿科特'],['chandler:105','艾宰穆尔'],['chandler:109','巴埃萨'],['chandler:113','巴赫奇萨赖'],
 ['chandler:167','贝桑松'],['chandler:168','贝济耶'],['chandler:180','比哈尔谢里夫'],['chandler:189','布莱克本'],
 ['chandler:196','博尔顿'],['chandler:226','布尔诺'],['chandler:258','海地角'],['chandler:272','昌昌'],
 ['chandler:312','克莱蒙费朗'],['chandler:363','道拉塔巴德'],['chandler:367','代尔夫特'],['chandler:369','淡目'],
 ['chandler:372','德比'],['chandler:393','多德雷赫特'],['chandler:404','敦刻尔克'],['chandler:413','埃勃拉'],
 ['chandler:424','伊利斯'],['chandler:432','埃斯泰尔戈姆'],['chandler:435','埃武拉'],['chandler:442','法泰赫布尔西克里'],
 ['chandler:471','恒河胜利城'],['chandler:498','戈尔廷'],['chandler:508','锦石'],['chandler:538','哈勒比杜'],
 ['chandler:563','夏琐'],['chandler:567','赫利奥波利斯'],['chandler:571','姬路'],['chandler:602','雅西'],
 ['chandler:618','伊拉克利翁'],['chandler:633','哈恩'],['chandler:646','赫雷斯-德拉弗龙特拉'],['chandler:666','贝尼哈马德城堡'],
 ['chandler:723','克诺索斯'],['chandler:727','高知'],['chandler:742','克拉科夫'],['chandler:751','库卡瓦'],
 ['chandler:778','拉昂'],['chandler:815','洛安戈'],['chandler:830','卢卡'],['chandler:890','马苏利帕特南'],
 ['chandler:894','松前'],['chandler:897','玛雅潘'],['chandler:906','梅迪纳-德尔坎波'],['chandler:938','摩亨佐-达罗'],
 ['chandler:941','蒙托邦'],['chandler:942','阿尔班山'],['chandler:964','马斯喀特'],['chandler:972','纳加帕蒂南'],
 ['chandler:990','纳博讷'],['chandler:1012','尼什'],['chandler:1026','纽伦堡'],['chandler:1036','奥尔德姆'],
 ['chandler:1061','乌栋'],['chandler:1062','瓦加杜古'],['chandler:1063','欧鲁普雷图'],['chandler:1067','帕查卡马克'],
 ['chandler:1071','佩斯利'],['chandler:1084','帕坦（勒利德布尔）'],['chandler:1089','帕茨夸罗'],['chandler:1122','亳州'],
 ['chandler:1138','波兹南'],['chandler:1142','普雷斯顿'],['chandler:1147','普罗万'],['chandler:1220','圣马洛'],
 ['chandler:1221','圣奥梅尔'],['chandler:1233','撒马利亚'],['chandler:1242','圣路易斯波托西'],['chandler:1271','塞古'],
 ['chandler:1272','塞哥维亚'],['chandler:1293','斯库台'],['chandler:1297','西吉勒马萨'],['chandler:1300','锡利斯特拉'],
 ['chandler:1313','苏瓦松'],['chandler:1340','斯托克波特'],['chandler:1367','塞克什白堡'],['chandler:1380','大沽'],
 ['chandler:1442','图尔奈'],['chandler:1471','乌加里特'],['chandler:1490','瓦朗谢讷'],['chandler:1494','瓦尔帕莱索'],
 ['chandler:1506','维琴察'],['chandler:1507','维丁'],['chandler:1524','万县'],['chandler:1540','伍尔弗汉普顿'],
 ['chandler:1543','沃尔姆斯'],['chandler:1548','维尔茨堡'],['chandler:1563','叶尔羌（莎车）'],
 ['modelski-ancient:1','阿达布'],['modelski-ancient:2','阿卡德'],['modelski-ancient:3','阿克罗蒂里'],['modelski-ancient:4','阿克沙克'],
 ['modelski-ancient:10','安善'],['modelski-ancient:16','阿淑尔'],['modelski-ancient:20','巴德提比拉'],['modelski-ancient:23','亳'],
 ['modelski-ancient:28','卡赫美士'],['modelski-ancient:36','朵拉维拉'],['modelski-ancient:37','迪尔穆恩'],['modelski-ancient:38','杜尔-温塔什'],
 ['modelski-ancient:39','埃勃拉'],['modelski-ancient:42','象岛'],['modelski-ancient:44','埃里都'],['modelski-ancient:47','埃什努纳'],
 ['modelski-ancient:53','夏琐'],['modelski-ancient:54','赫利奥波利斯'],['modelski-ancient:55','赫尔莫波利斯'],['modelski-ancient:58','贾尔库坦'],
 ['modelski-ancient:64','基什'],['modelski-ancient:65','基蒂翁'],['modelski-ancient:86','蒙迪加克'],['modelski-ancient:87','迈锡尼'],
 ['modelski-ancient:88','纳加尔'],['modelski-ancient:89','纳马兹加-捷佩'],['modelski-ancient:92','皮洛斯'],['modelski-ancient:94','尼纳'],
 ['modelski-ancient:96','尼普尔'],['modelski-ancient:104','卡特纳'],['modelski-ancient:107','拉基加里'],['modelski-ancient:116','沙赫尔·苏赫泰'],
 ['modelski-ancient:118','舍赫纳'],['modelski-ancient:119','舒鲁帕克'],['modelski-ancient:138','特洛伊'],['modelski-ancient:139','推罗'],
 ['modelski-ancient:140','乌加里特'],['modelski-ancient:144','乌尔凯什'],['modelski-ancient:154','扎巴拉姆'],
 ['pleiades:109126','卢泰西亚（巴黎）'],['pleiades:961873','梅尔夫（安条克）'],['pleiades:697725','佩特拉'],['pleiades:912936','苏萨'],
 ['pleiades:894084','底格里斯河畔塞琉西亚'],['pleiades:857359','特拉比松'],['pleiades:108894','特里尔（奥古斯塔）'],['pleiades:108751','科隆（阿格里皮纳）'],
 ['pleiades:413138','佛罗伦萨（弗洛伦蒂亚）'],['pleiades:187290','阿奎莱亚'],['pleiades:383628','克雷莫纳'],['pleiades:383737','帕尔马'],
 ['pleiades:442500','巴里'],['pleiades:433014','那不勒斯（帕耳忒诺佩）'],['pleiades:462270','卡塔尼亚'],['pleiades:462410','巴勒莫（帕诺尔穆斯）'],
 ['pleiades:462538','墨西拿（赞克勒）'],['pleiades:452416','雷焦卡拉布里亚（雷吉翁）'],['pleiades:148217','阿尔勒（阿雷拉特）'],['pleiades:148142','尼姆（内毛苏斯）'],
 ['pleiades:256210','塞维利亚（伊斯帕利斯）'],['pleiades:599587','提洛岛'],['pleiades:570468','墨伽拉'],['pleiades:570491','迈锡尼'],
 ['pleiades:226564','赫尔松涅斯'],['pleiades:658381','叙利亚安条克'],['pleiades:678060','贝鲁特'],['pleiades:678158','杰拉什'],
 ['pleiades:315248','乌提卡'],['pleiades:315267','扎马'],
 ['chandler:9','阿波美卡拉维'],['chandler:38','阿尔卡拉瓦'],['chandler:56','阿姆罗哈'],['chandler:58','阿嫩达布尔'],
 ['chandler:104','艾瓦勒克'],['chandler:120','班达'],['chandler:158','别尔季切夫'],['chandler:173','比马瓦拉姆'],
 ['chandler:192','博巴斯特罗'],['chandler:197','邦加'],['chandler:200','博里纳日'],['chandler:240','布萨'],
 ['chandler:255','肯普隆格'],['chandler:271','查坎普通'],['chandler:273','钱德拉普尔'],['chandler:276','钱德拉吉里'],
 ['chandler:283','查塔姆'],['chandler:294','恰普拉'],['chandler:296','奇比里'],['chandler:300','奇利科西'],
 ['chandler:301','钦查'],['chandler:303','基希讷乌'],['chandler:310','丘纳尔'],['chandler:373','德拉加齐汗'],
 ['chandler:386','迪纳杰布尔'],['chandler:391','东戈'],['chandler:415','埃西哈'],['chandler:427','埃尔维拉（伊尔贝里斯）'],
 ['chandler:463','福阿'],['chandler:572','希波斯'],['chandler:601','海德拉（阿尔及尔）'],['chandler:605','伊贾耶'],
 ['chandler:606','伊克凯里'],['chandler:607','沙基（伊科索）'],['chandler:627','伊萨帕'],['chandler:673','卡姆塔布尔'],
 ['chandler:694','卡亚尔帕特纳姆'],['chandler:697','凯比'],['chandler:760','库施（纳帕塔）'],['chandler:772','拉昆迪'],
 ['chandler:824','鲁汶'],['chandler:852','马赫什瓦尔'],['chandler:853','马霍巴'],['chandler:869','曼德维'],
 ['chandler:871','马尼'],['chandler:883','马里亚纳'],['chandler:888','马塞尼亚'],['chandler:917','梅瑟蒂德菲尔'],
 ['chandler:940','蒙多维'],['chandler:959','蒙格埃尔'],['chandler:965','穆松巴'],['chandler:970','纳瓦德维帕（纳迪亚）'],
 ['chandler:973','贝德努尔（纳加拉）'],['chandler:1002','恩戈尔努'],['chandler:1167','拉巴'],['chandler:1183','雷亚尔·德·卡托尔塞'],
 ['chandler:1209','鲁贝'],['chandler:1253','蒂兰通戈'],['chandler:1259','萨普塔格拉姆'],['chandler:1266','萨塔拉'],
 ['chandler:1311','索斯特'],['chandler:1319','松加德'],['chandler:1352','苏拉梅'],['chandler:1357','斯维什托夫'],
 ['chandler:1410','塔内萨尔'],['chandler:1453','特里波利斯'],['chandler:1455','特洛伊（纽约州）'],['chandler:1466','泰恩茅斯'],
 ['modelski-ancient:127','泰勒·塔亚'],['modelski-ancient:135','蒂特里斯·霍尤克'],
 ['pleiades:148004','阿维尼翁（阿韦尼奥）'],['pleiades:148054','奥朗日（阿劳西奥）'],['pleiades:157803','阿尔本加（阿尔宾高努姆）'],['pleiades:373757','贝伦尼基（班加西）'],
 ['pleiades:383603','布雷西亚（布里克西亚）'],['pleiades:383691','洛迪（老庞培）'],['pleiades:383715','摩德纳（穆蒂纳）'],['pleiades:383741','皮亚琴察（普拉森蒂亚）'],
 ['pleiades:383755','雷焦艾米利亚（雷吉乌姆）'],['pleiades:383815','韦尔切利'],['pleiades:393374','阿尔蒂努姆'],['pleiades:393405','克拉泰尔纳'],
 ['pleiades:393448','马扎博托（凯努亚）'],['pleiades:393498','斯皮纳'],['pleiades:570049','埃伊翁'],['pleiades:570220','伊利斯'],
 ['pleiades:570268','吉雄'],['pleiades:570274','哈利埃伊斯'],['pleiades:570316','伊斯特米亚'],['pleiades:844926','甘格拉'],
 ['pleiades:638751','弗里吉亚阿帕米亚'],['pleiades:639087','萨加拉索斯'],['pleiades:236377','布拉加（奥古斯塔）'],['pleiades:315192','塔巴尔卡（塔布拉卡）'],
 ['pleiades:707586','新帕福斯'],['pleiades:727088','布巴斯提斯'],['pleiades:746700','亚喀巴（艾拉）'],['pleiades:589872','克诺索斯'],
 ['pleiades:589989','法拉萨尔纳'],['pleiades:432839','福尔米亚'],['pleiades:432981','诺拉'],['pleiades:433134','苏尔莫纳（苏尔莫）'],
 ['pleiades:442525','卡努西乌姆'],['pleiades:442613','赫尔多尼亚'],['pleiades:550403','阿德拉米蒂乌姆'],['pleiades:550434','亚历山大·特洛阿斯'],
 ['pleiades:857018','阿马西亚'],['pleiades:658587','萨莫萨塔'],['pleiades:462236','恩纳'],['pleiades:462373','莫西亚'],
 ['pleiades:462487','塞杰斯塔']
]);
const editorialPlaceZh=p=>(!p?.nameZh&&!p?.nameTimeline?.length&&!p?.datedNames?.length&&!p?.labelEvidence)?(PLACE_ZH_EDITORIAL.get(p?.id)||''):'';
const capitalPolityLabels=p=>p?.kind==='dated-capital'&&CAPITAL_POLITY_FIX.has(p.polityQid)?{...p.polityLabels,...CAPITAL_POLITY_FIX.get(p.polityQid)}:p?.polityLabels;
export const placeName=(p,lang)=>lang==='en'?(p.displayName||p.name):(p.displayNameZh||(p?.kind==='dated-capital'?capitalZh(p):(p.nameZh||editorialPlaceZh(p)))||p.displayName||p.name);
// A source observation is not a city lifespan. Name epochs constrain borrowing
// only when both dates have evidence; editorial observation aliases alone do not.
export const placeNamePeriods=(p,year)=>(p.nameTimeline||[]).filter(n=>(n.start==null||n.start<=year)&&(n.end==null||year<=n.end));
export function observationMatchesNamePeriod(p,observed,year){
 const current=placeNamePeriods(p,year),recorded=placeNamePeriods(p,observed);
 return !current.length||!recorded.length||current.some(n=>recorded.includes(n));
}
function datedPlaceLabel(p,year){
 const periods=placeNamePeriods(p,year);
 if(!periods.length)return p.datedNames?.find(n=>n.start<=year&&year<=n.end&&(!n.observationYears||n.observationYears.includes(year)));
 return {name:[...new Set(periods.map(n=>n.name))].join(' / '),nameZh:[...new Set(periods.map(n=>n.nameZh).filter(Boolean))].join('／'),sources:periods.flatMap(n=>n.sources||[n.source]),source:periods[0].source,noteZh:periods.length>1?'这一年横跨改名日期，保留前后两个名称。':'名称按记录年份所对应的时期显示，原始研究名称保留在档案中。',noteEn:periods.length>1?'This year spans a recorded renaming; both names are retained.':'The displayed name follows the record year. The original source name is retained in the archive.'};
}
export function placeAtYear(p,year,span=50){
 if(!Number.isInteger(year)||year===0)return null;
 if(p.kind==='modern-reference')return {...p,rank:4+(p.scaleRank||0)};
 if((p.kind==='dated-capital'&&CAPITAL_DATE_QUARANTINE.has(p.id))||PLACE_COORD_QUARANTINE.has(p.id))return null;
 if(p.observations){const candidates=p.observations.filter(o=>Math.abs(civilYear(o[0])-civilYear(year))<=span&&observationMatchesNamePeriod(p,o[0],year));if(!candidates.length)return null;const o=candidates.reduce((a,b)=>Math.abs(civilYear(b[0])-civilYear(year))<Math.abs(civilYear(a[0])-civilYear(year))?b:a),label=datedPlaceLabel(p,o[0]),zh=p.nameZh||editorialPlaceZh(p);return {...p,...(zh?{nameZh:zh}:{}),observation:o,displayName:label?.name,displayNameZh:label?.nameZh,labelEvidence:label,rank:2-Math.log10(Math.max(1,o[1]||1))/10};}
 const period=p.periods?.find(([a,b])=>a<=year&&year<=b);if(!period)return null;
 const location=p.locations?.filter(l=>l.periods?.some(([a,b])=>a<=year&&year<=b)).sort((a,b)=>(a.accuracyMeters??Infinity)-(b.accuracyMeters??Infinity))[0];
 if(p.locations&&!location)return null;
 const label=datedPlaceLabel(p,year);
 const zh=p.kind==='dated-capital'?capitalZh(p):(p.nameZh||editorialPlaceZh(p)),polityLabels=capitalPolityLabels(p);
 return {...p,...(zh?{nameZh:zh}:{}),...(polityLabels?{polityLabels}:{}),displayName:label?.name,displayNameZh:label?.nameZh,labelEvidence:label,coordinates:location?.coordinates||p.coordinates,location,period:location?.periods.find(([a,b])=>a<=year&&year<=b)||period,rank:p.kind==='dated-capital'?0:p.kind==='attested-site'?1:3-(p.referenceCount||0)/100};
}
export function nearestPlaceYear(p,year){
 if(p.observations)return p.observations.reduce((a,b)=>Math.abs(civilYear(b[0])-civilYear(year))<Math.abs(civilYear(a[0])-civilYear(year))?b:a)[0];
 if(p.periods?.length)return p.periods.reduce((best,[a,b])=>{const y=Math.max(a,Math.min(b,year));return Math.abs(civilYear(y)-civilYear(year))<Math.abs(civilYear(best)-civilYear(year))?y:best;},p.periods[0][0]);
 return year;
}
export const normalizePlaceQuery=q=>String(q||'').toLocaleLowerCase().normalize('NFD').replace(/[\p{Diacritic}\s'’‘ʼ‐‑–—-]/gu,'');
export async function searchPlaces(query,year,span=50){
 const q=normalizePlaceQuery(query);if(!q||q.length<2&&!/\p{Script=Han}/u.test(q))return [];
 const scored=(await loadPlaces()).filter(p=>p.kind!=='modern-reference'&&!CAPITAL_DATE_QUARANTINE.has(p.id)&&!PLACE_COORD_QUARANTINE.has(p.id)).map(p=>{
  const names=[p.name,p.kind==='dated-capital'?capitalZh(p):(p.nameZh||editorialPlaceZh(p))].map(normalizePlaceQuery),aliases=[p.otherNames,...[...(p.datedNames||[]),...(p.nameTimeline||[])].flatMap(n=>[n.name,n.nameZh]),...(p.searchAliases||[]),...(p.names||[]).map(n=>n.name)].filter(Boolean).flatMap(n=>String(n).split(/[,;|]/)).map(normalizePlaceQuery);
  const score=names.includes(q)?0:aliases.includes(q)?1:names.some(n=>n.startsWith(q))?2:[...names,...aliases].some(n=>n.includes(q))?3:99;
  return {p,score};
 });
 return scored.filter(x=>x.score<99).sort((a,b)=>Math.max(1,a.score)-Math.max(1,b.score)||Number(!placeAtYear(a.p,year,span))-Number(!placeAtYear(b.p,year,span))||a.score-b.score||Number(a.p.kind!=='dated-capital')-Number(b.p.kind!=='dated-capital')||a.p.name.length-b.p.name.length).slice(0,10).map(x=>x.p);
}
export class PlaceLayer {
 constructor(atlas,{onSelect,onStatus,window=50}={}){this.window=placeWindow(window);this.atlas=atlas;this.map=atlas.map;this.onSelect=onSelect;this.onStatus=onStatus;this.markers=[];this.active=[];this.enabled=true;this.modern=false;this.seq=0;this.year=atlas.year;this.lang=atlas.lang;this.move=()=>this.refresh();this.map.on('resize',this.move);this.setYear(atlas.year,atlas.lang);}
 async setYear(year,lang){
  this.year=year;this.lang=lang;const seq=++this.seq;
  try{const places=await loadPlaces(this.modern);if(this.atlas.destroyed||seq!==this.seq)return;
   this.active=places.filter(p=>p.kind!=='modern-reference'||this.modern).map(p=>placeAtYear(p,year,this.window)).filter(Boolean).sort((a,b)=>a.rank-b.rank);this.refresh();this.onStatus?.(places.partial?'partial':'ready',this.active.length);
  }catch{if(seq===this.seq)this.onStatus?.('error',0);}
 }
 setWindow(value){this.window=placeWindow(value);return this.setYear(this.year,this.lang);}
 setModern(v){this.modern=v;this.setYear(this.year,this.lang);}
 toggle(v){this.enabled=v;this.refresh();}
 select(place){
  this.selection?.remove();this.selection=null;if(!place||this.atlas.destroyed)return;
  const el=document.createElement('div');el.className='selected-place';el.setAttribute('aria-hidden','true');
  this.selection=new maplibregl.Marker({element:el,opacityWhenCovered:'0'}).setLngLat(place.coordinates).addTo(this.map);
 }
 refresh(){
  this.markers.forEach(m=>m.remove());this.markers=[];if(!this.enabled||this.atlas.destroyed||!this.year)return;
  const map=this.map,zoom=map.getZoom();if(zoom<2)return;
  const bounds=map.getBounds(),origin=map.getContainer().getBoundingClientRect(),center=map.getCenter();
  const boxes=[...(this.atlas.labelBoxes||[]),...(this.atlas.overlayBlockerBoxes?.('.map-legend')||[])];
  const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  const candidates=this.active.filter(p=>bounds.contains(p.coordinates));
  const max=Math.min(90,Math.round((zoom-1)*12));
  for(const p of candidates){
   if(this.markers.length>=max)break;
   const modern=p.kind==='modern-reference';if(modern&&zoom<Math.max(3,(p.minZoom||4)-2))continue;
   if((p.kind==='attested-settlement'||p.kind==='attested-site')&&zoom<3.4)continue;
   if(map.getProjection().type==='globe'&&zoom<3){const rad=Math.PI/180,[lon,lat]=p.coordinates;const dot=Math.sin(center.lat*rad)*Math.sin(lat*rad)+Math.cos(center.lat*rad)*Math.cos(lat*rad)*Math.cos((lon-center.lng)*rad);if(dot<.2)continue;}
   const screen=map.project(p.coordinates),name=placeName(p,this.lang),secondary=this.lang==='bi'&&(p.displayNameZh||p.nameZh)?placeName(p,'en'):'';
   const obsText=p.observation?(this.lang==='en'?'Population · ':'人口 · ')+formatYear(p.observation[0],this.lang==='en'?'en':'zh'):'';
   const measureLine=(s,cjk,lat)=>Array.from(String(s||'')).reduce((w,ch)=>w+(/[\u3400-\u9fff\uF900-\uFAFF]/.test(ch)?cjk:lat),0);
   const width=Math.min(184,Math.max(measureLine(name,12.8,7.4),measureLine(secondary,11,6.4),measureLine(obsText,11.2,6.3))+34),height=(secondary?48:34)+(obsText?15:0);
   // A record that exists in the data should still be visible and clickable when its
   // label cannot be placed. Try the label on the right, then on the left, then fall
   // back to the dot alone instead of dropping the record entirely.
   const fits=candidate=>candidate.left>=origin.left+10&&candidate.right<=origin.right-12&&candidate.top>=origin.top+12&&candidate.bottom<=origin.bottom-52&&!boxes.some(b=>overlap(candidate,b));
   const labelBox=side=>side==='right'
    ?{left:origin.left+screen.x-12,right:origin.left+screen.x+width,top:origin.top+screen.y-height/2,bottom:origin.top+screen.y+height/2}
    :{left:origin.left+screen.x-width+12,right:origin.left+screen.x+12,top:origin.top+screen.y-height/2,bottom:origin.top+screen.y+height/2};
   const dotBox={left:origin.left+screen.x-7,right:origin.left+screen.x+7,top:origin.top+screen.y-7,bottom:origin.top+screen.y+7};
   let box=null,side='right',dotOnly=false;
   for(const [candidate,place]of [[labelBox('right'),'right'],[labelBox('left'),'left'],[dotBox,'dot']]){
    if(!fits(candidate))continue;
    box=candidate;dotOnly=place==='dot';side=place==='dot'?'right':place;break;
   }
   if(!box)continue;
   boxes.push({...box,left:box.left-8,right:box.right+8,top:box.top-5,bottom:box.bottom+5});
   const el=document.createElement('button');el.className='place-marker '+(modern?'modern':p.kind==='dated-capital'?'capital':'historic')+(dotOnly?' dot-only':'');
   const dot=document.createElement('i'),label=document.createElement('span');label.textContent=name;el.append(dot,label);
   if(secondary){const sub=document.createElement('small');sub.textContent=secondary;label.append(sub);}
   if(obsText){const stamp=document.createElement('small');stamp.className='place-date';stamp.textContent=obsText;label.append(stamp);}
   el.title=(modern?(this.lang==='en'?'Modern reference · ':'现代参照 · '):'')+name;el.setAttribute('aria-label',el.title);
   const meta=p.observation?(this.lang==='en'?'Population · ':'人口 · ')+Number(p.observation[1]).toLocaleString()+' · '+formatYear(p.observation[0],this.lang==='en'?'en':'zh'):p.kind==='dated-capital'?(this.lang==='en'?'Historical capital':'历史首都'):modern?(this.lang==='en'?'Present-day reference':'现代参照'):p.period?formatYear(p.period[0],this.lang==='en'?'en':'zh')+(p.period[1]!==p.period[0]?' — '+formatYear(p.period[1],this.lang==='en'?'en':'zh'):''):'';
   const showHover=()=>{this.atlas.setHoverMarker?.({primary:name,secondary,meta},el.getBoundingClientRect());};
   el.addEventListener('mouseenter',showHover);el.addEventListener('focus',showHover);
   el.addEventListener('mouseleave',()=>this.atlas.setHoverMarker?.(null));el.addEventListener('blur',()=>this.atlas.setHoverMarker?.(null));
   el.onclick=e=>{e.stopPropagation();this.atlas.setHoverMarker?.(null);this.onSelect?.(p,this.atlas);};
   const anchor=dotOnly?'center':side==='left'?'right':'left',offset=dotOnly?[0,0]:side==='left'?[5,0]:[-5,0];
   this.markers.push(new maplibregl.Marker({element:el,anchor,offset,opacityWhenCovered:'0'}).setLngLat(p.coordinates).addTo(map));
  }
 }
 destroy(){this.seq++;this.atlas.setHoverMarker?.(null);this.selection?.remove();this.map.off('moveend',this.move);this.map.off('resize',this.move);this.markers.forEach(m=>m.remove());}
}
