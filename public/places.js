import {readJSON,formatYear,civilYear} from './map-engine.js?v=3.80.0-05032a3b9e8f';
import {placeWindow} from './view-state.js?v=3.80.0-05032a3b9e8f';
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
export async function loadPlaces(includeModern=false,onPartial=null){
 const indexP=readJSON('data/places/historical-settlements-index.json.gz');
 const fastNames=['historical-capitals','urban-observations',...(includeModern?['modern-cities']:[])];
 const fastPromises=[...fastNames.map(n=>readJSON(`data/places/${n}.json.gz`)),readJSON('data/places/attested-places.json.gz')];
 const extract=res=>res.filter(r=>r.status==='fulfilled').flatMap(r=>r.value.places||r.value.claims||r.value.cities||attestedPlaces(r.value));
 let settled=false;
 if(onPartial){
  void Promise.allSettled(fastPromises).then(fastRes=>{
   if(settled)return;
   const fastData=extract(fastRes);if(fastData.length)onPartial(fastData);
  });
 }
 const results=await Promise.allSettled([indexP,...fastPromises]);
 settled=true;
 const data=extract(results);
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
 'chandler:422',         // El Tajin, Mexico [97.3782, 20.4481] (omitted minus sign; actually -97.3782)
 'chandler:545',         // Hamilton, Canada [79.866092, 43.250022] (omitted minus sign; actually -79.866092)
 'chandler:1192',        // Richmond, United States [77.4667, 37.5333] (omitted minus sign; actually -77.4667)
 'chandler:136',         // Barrow, AK USA [-156.7887, 71.2906] (geocoded Barrow-in-Furness UK 1900 pop 56k to Alaska)
 'chandler:279',         // Changteh, China [112.9388, 28.2282] (geocoded Changde to downtown Changsha)
 'chandler:382',         // Dienne, Senegal [-16.3501, 15.0334] (Senegal coast instead of Djenne, Mali [-4.55, 13.90])
 'chandler:562',         // Haverhill, UK [0.4389, 52.0823] (geocoded Haverhill MA USA 1900 pop 37k to Suffolk village)
 'chandler:819',         // Londonderry, NH USA [-71.3740, 42.8651] (geocoded Derry N. Ireland 1900 pop 38k to New Hampshire)
 'chandler:1090',        // Pau, France [0.37, 43.30] (omitted minus sign; actually -0.37 across Pyrenees)
 'chandler:1198',        // Rochefort, Belgium [5.2216, 50.1631] (Belgium village instead of Rochefort France [-0.96, 45.94])
 'chandler:1333',        // St. Helens, OR USA [-122.8169, 45.8594] (geocoded St Helens Lancashire UK 1900 pop 83k to Oregon)
 'chandler:1341',        // Stoke, UK [-2.8667, 53.25] (Cheshire village instead of Stoke-on-Trent [-2.18, 53.00])
 'modelski-ancient:117', // Shangqi / Shangqiu [-500] [121.4581, 31.2222] (geocoded Shanghi to Shanghai Harbor instead of [115.65, 34.44])
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
 ['pleiades:462487','塞杰斯塔'],
 // Wave-6: Remaining verified Chandler / Modelski urban observations (to ~100% coverage) & classical Pleiades ref >= 20
 ['chandler:8','图尔库（奥布）'],['chandler:28','实兑（阿恰布）'],['chandler:30','奥尔德肖特'],['chandler:44','阿尔斯特'],
 ['chandler:45','阿尔滕堡'],['chandler:61','安集延'],['chandler:62','安德里亚'],['chandler:65','昂古莱姆'],
 ['chandler:86','阿拉'],['chandler:119','班贝格'],['chandler:133','巴恩斯利'],['chandler:139','勃生'],
 ['chandler:149','阿克曼（比尔霍罗德-德涅斯特罗夫斯基）'],['chandler:153','贝卢尔'],['chandler:154','宾杰里'],['chandler:161','贝尔吉施格拉德巴赫'],
 ['chandler:164','贝恩堡'],['chandler:165','贝鲁特'],['chandler:166','特威德河畔贝里克'],['chandler:170','巴克塔普尔（巴德岗）'],
 ['chandler:193','博布鲁伊斯克'],['chandler:203','滨海布洛涅'],['chandler:207','布勒伊拉'],['chandler:208','勃兰登堡'],
 ['chandler:210','布拉索夫'],['chandler:211','布拉索夫（科隆施塔特）'],['chandler:224','布罗克顿'],['chandler:236','伯恩利'],
 ['chandler:238','伯里'],['chandler:252','卡尔塔尼塞塔'],['chandler:266','卡塞尔（法国）'],['chandler:268','切里尼奥拉'],
 ['chandler:269','捷克布杰约维采'],['chandler:285','烟台（芝罘）'],['chandler:286','切尔滕纳姆'],['chandler:299','奇廉'],
 ['chandler:315','科特布里奇'],['chandler:320','科尔切斯特'],['chandler:321','科尔马'],['chandler:326','康塞普西翁'],
 ['chandler:338','克鲁'],['chandler:343','库亚巴'],['chandler:348','琴斯托霍瓦'],['chandler:357','达尔邦加'],
 ['chandler:359','达灵顿'],['chandler:360','达姆施塔特'],['chandler:375','德绍-罗斯劳'],['chandler:377','迪尤斯伯里'],
 ['chandler:381','达尔瓦德'],['chandler:385','迪夸'],['chandler:412','伊斯特本'],['chandler:420','艾森纳赫'],
 ['chandler:423','埃尔布隆格'],['chandler:440','福尔里弗'],['chandler:446','菲罗兹布尔'],['chandler:448','菲奇堡'],
 ['chandler:451','弗洛里亚诺波利斯'],['chandler:453','福克斯通'],['chandler:454','福斯特'],['chandler:459','奥得河畔法兰克福'],
 ['chandler:461','弗赖贝格'],['chandler:465','菲尔特'],['chandler:468','加拉茨'],['chandler:484','加济布尔'],
 ['chandler:490','格洛斯特'],['chandler:497','格尔利茨'],['chandler:500','哥达'],['chandler:501','哥廷根'],
 ['chandler:505','大雅茅斯'],['chandler:509','格里姆斯比'],['chandler:512','格罗兹尼'],['chandler:513','格鲁琼兹'],
 ['chandler:519','古本'],['chandler:522','贵阳（贵州省城）'],['chandler:537','哈尔伯施塔特'],['chandler:540','哈利法克斯'],
 ['chandler:541','哈雷'],['chandler:546','哈姆'],['chandler:557','哈特尔浦'],['chandler:558','黑斯廷斯'],
 ['chandler:566','海尔布隆'],['chandler:570','希尔德斯海姆'],['chandler:578','荷台达'],['chandler:579','霍德梅泽瓦沙尔海伊'],
 ['chandler:583','霍利奥克'],['chandler:590','新会'],['chandler:595','哈德斯菲尔德'],['chandler:608','伊拉德'],
 ['chandler:639','贾姆讷格尔'],['chandler:641','贾巴尔普尔'],['chandler:642','贾蒂内加拉'],['chandler:661','卡赫拉曼马拉什'],
 ['chandler:664','凯泽斯劳滕'],['chandler:678','康定'],['chandler:698','凯奇凯梅特'],['chandler:714','基尔马诺克'],
 ['chandler:718','柯科迪'],['chandler:721','基什孔费莱吉哈佐'],['chandler:726','科布伦茨'],['chandler:728','甲府'],
 ['chandler:733','科洛梅亚'],['chandler:737','科特赖克'],['chandler:739','科希策'],['chandler:745','克雷费尔德'],
 ['chandler:749','库杜斯'],['chandler:765','拉绍德封'],['chandler:769','拉斯佩齐亚'],['chandler:774','兰开斯特'],
 ['chandler:776','莱希河畔兰茨贝格'],['chandler:787','莱格尼察'],['chandler:791','莱昂（墨西哥）'],['chandler:807','林肯（英国）'],
 ['chandler:834','路德维希港'],['chandler:835','卢甘斯克'],['chandler:843','麦克尔斯菲尔德'],['chandler:844','马塞约'],
 ['chandler:854','梅德斯通'],['chandler:858','毛科'],['chandler:863','马尔默'],['chandler:875','曼苏拉'],
 ['chandler:882','马尔吉兰'],['chandler:901','梅赫伦'],['chandler:902','什未林（原注 Meckenbeuren）'],['chandler:908','梅县'],
 ['chandler:914','门戈（坎帕拉）'],['chandler:922','莫乌'],['chandler:927','梅迪尼普尔'],['chandler:936','莫达凯凯'],
 ['chandler:939','比托拉（莫纳斯提尔）'],['chandler:945','蒙吕松'],['chandler:948','蒙扎'],['chandler:954','马瑟韦尔'],
 ['chandler:955','米尔豪森（图林根）'],['chandler:956','米卢斯'],['chandler:961','明斯特'],['chandler:997','纽堡'],
 ['chandler:1000','纽波特（威尔士）'],['chandler:1001','涅任'],['chandler:1006','奈梅亨'],['chandler:1015','下塔吉尔'],
 ['chandler:1018','诺尔雪平'],['chandler:1019','北安普顿'],['chandler:1027','尼赖吉哈佐'],['chandler:1053','奥斯纳布吕克'],
 ['chandler:1054','奥斯坦德'],['chandler:1058','大津'],['chandler:1075','帕尔卡德'],['chandler:1080','巴拉那'],
 ['chandler:1092','佩奇'],['chandler:1095','北赖（威省）'],['chandler:1096','蓬莱'],['chandler:1106','彼得罗瓦拉丁'],
 ['chandler:1107','普福尔茨海姆'],['chandler:1113','彼得库夫'],['chandler:1114','皮尔马森斯'],['chandler:1118','普洛耶什蒂'],
 ['chandler:1134','西班牙港'],['chandler:1148','普热梅希尔'],['chandler:1168','拉多姆'],['chandler:1170','赖布尔'],
 ['chandler:1179','罗滕斯托尔'],['chandler:1182','雷丁（宾夕法尼亚）'],['chandler:1188','雷姆沙伊德'],['chandler:1191','朗达'],
 ['chandler:1197','罗奇代尔'],['chandler:1199','罗切斯特（肯特）'],['chandler:1207','罗瑟勒姆'],['chandler:1214','萨尔布吕肯'],
 ['chandler:1222','圣康坦'],['chandler:1236','桑伯尔'],['chandler:1244','圣塞瓦斯蒂安'],['chandler:1246','圣加仑'],
 ['chandler:1247','圣克鲁斯（特内里费）'],['chandler:1256','圣路易斯（巴西）'],['chandler:1289','希卡尔普尔'],['chandler:1316','索林根'],
 ['chandler:1320','肖普朗'],['chandler:1330','塞兰坡（斯里曼塔普尔）'],['chandler:1334','圣约翰'],['chandler:1359','汕头'],
 ['chandler:1360','斯温登'],['chandler:1368','森特什'],['chandler:1379','高崎'],['chandler:1385','坦佩雷'],
 ['chandler:1393','塔尔努夫'],['chandler:1397','汤顿（马萨诸塞）'],['chandler:1406','捷尔诺波尔'],['chandler:1421','蒂尔堡'],
 ['chandler:1422','蒂米什瓦拉'],['chandler:1438','托基'],['chandler:1447','特拉帕尼'],['chandler:1459','图库曼'],
 ['chandler:1477','乌拉尔斯克'],['chandler:1481','拉贝河畔乌斯季'],['chandler:1485','宇和岛'],['chandler:1504','韦尔维耶'],
 ['chandler:1517','弗拉季高加索'],['chandler:1523','韦克菲尔德'],['chandler:1526','沃灵顿'],['chandler:1537','威根'],
 ['chandler:1538','威尔克斯-巴里'],['chandler:1541','伍斯特（英国）'],['chandler:1573','米泽'],['chandler:1589','日托米尔'],
 ['chandler:1594','齐陶'],['chandler:1597','茨维考'],['modelski-modern:137','拉马坦萨'],['modelski-modern:214','凯马杜斯'],
 // Classical Pleiades ref >= 20 Mediterranean & Near Eastern cities
 ['pleiades:413216','穆尔洛（波焦奇维塔泰）'],['pleiades:432739','卡莱斯（坎帕尼亚）'],['pleiades:570733','图里亚'],
 ['pleiades:433147','泰莱西亚'],['pleiades:432884','因特拉姆纳·利雷纳斯'],['pleiades:442476','阿尔皮'],
 ['pleiades:422844','阿里恰'],['pleiades:422921','菲卡纳'],['pleiades:433073','萨埃皮努姆'],
 ['pleiades:452352','考洛尼亚'],['pleiades:452403','佩泰利亚'],['pleiades:570483','迈索尼'],
 ['pleiades:413013','阿米泰尔努姆'],['pleiades:422831','阿尔西乌姆'],['pleiades:422859','凯雷'],
 ['pleiades:423012','波图斯港'],['pleiades:423081','蒂布尔'],['pleiades:432985','努凯里亚·阿尔法泰尔纳'],
 ['pleiades:462251','希布拉'],['pleiades:462153','琴图里佩'],['pleiades:413045','奥克西穆姆'],
 ['pleiades:413178','纳尔河畔因特拉姆纳'],['pleiades:432700','阿尔皮努姆'],['pleiades:433052','普里韦尔努姆'],
 ['pleiades:471899','卡拉利斯（卡利亚里）'],['pleiades:785986','贝勒尼基'],['pleiades:599905','普里埃内'],
 ['pleiades:403291','韦图洛尼亚'],['pleiades:413129','法努姆·福图纳埃'],['pleiades:432618','阿贝利努姆'],
 ['pleiades:432664','阿莱特里乌姆'],['pleiades:432695','阿奎努姆'],['pleiades:432734','卡伊埃塔'],
 ['pleiades:432830','费伦蒂努姆'],['pleiades:433061','皮尔吉'],['pleiades:265855','卡斯图洛'],
 ['pleiades:187578','特吉斯特（的里雅斯特）'],['pleiades:471979','诺拉（撒丁）'],['pleiades:413124','菲耶索莱（法埃苏拉埃）'],
 ['pleiades:413163','皮克努姆的哈特里亚'],['pleiades:197389','穆尔萨'],['pleiades:98921','巴塔沃杜鲁姆（奈梅亨）'],
 ['pleiades:668261','埃梅萨（霍姆斯）'],['pleiades:913163220','库努卢亚（泰伊纳特丘）'],['pleiades:403234','卢卡'],
 ['pleiades:413044','萨图尔尼亚'],['pleiades:413076','森图姆凯莱（奇维塔韦基亚）'],['pleiades:413320','斯波莱托（斯波莱蒂乌姆）'],
 ['pleiades:423072','西格尼亚'],['pleiades:246348','鲁斯奇诺'],['pleiades:452333','赫拉克利亚（卢卡尼亚）'],
 ['pleiades:452488','埃利亚（韦利亚）'],['pleiades:570467','梅加洛波利斯'],['pleiades:177494','奥古斯塔·劳里卡'],
 ['pleiades:413014','安科纳'],['pleiades:413105','科尔菲尼乌姆'],['pleiades:570459','曼提尼亚'],
 ['pleiades:570707','泰格阿'],['pleiades:579925','埃雷特里亚'],['pleiades:462214','杰拉'],
 ['pleiades:197448','波拉（普拉）'],['pleiades:678010','阿克（托勒密斯）'],
 // Wave-7: Full classical Pleiades ref >= 20 completion + South Asia / East Africa classical emporia
 ['pleiades:413224','内佩特（内皮）'],['pleiades:413310','塞纳加利卡（塞尼加利亚）'],['pleiades:432825','新法布拉特里亚'],
 ['pleiades:433139','苏伦图姆（索伦托）'],['pleiades:433146','西迪基尼的泰阿努姆'],['pleiades:462498','索伦图姆'],
 ['pleiades:442797','西蓬图姆'],['pleiades:786010','科普托斯'],['pleiades:570740','梯林斯'],
 ['pleiades:481900','吕克尼多斯'],['pleiades:491546','贝罗亚'],['pleiades:472032','塔罗斯'],
 ['pleiades:403280','泰拉蒙'],['pleiades:413012','阿梅里亚（翁布里亚）'],['pleiades:413036','阿斯库卢姆（阿斯科利）'],
 ['pleiades:413144','卡西乌斯广场'],['pleiades:413174','伊古维乌姆（古比奥）'],['pleiades:413231','奥克里库卢姆'],
 ['pleiades:422837','安提乌姆（安齐奥）'],['pleiades:422986','诺门图姆'],['pleiades:246347','纳尔博·马尔提乌斯（纳博讷）'],
 ['pleiades:570051','艾戈斯泰纳'],['pleiades:432658','阿利法埃'],['pleiades:540755','埃拉提亚'],
 ['pleiades:462252','赫拉亚的希布拉'],['pleiades:462489','塞利努斯'],['pleiades:658465','卡赫美士'],
 ['pleiades:442796','西尔维乌姆'],['pleiades:579842','阿卡奈'],['pleiades:580044','奥罗波斯'],
 ['pleiades:462154','刻法洛埃迪乌姆（切法卢）'],['pleiades:501634','萨索斯'],['pleiades:324716','哈德鲁梅图姆（苏塞）'],
 ['pleiades:413032','阿雷提乌姆（阿雷佐）'],['pleiades:413106','科尔托纳'],['pleiades:413112','海上库普拉'],
 ['pleiades:413126','老法莱里伊'],['pleiades:413389','沃尔西尼伊'],['pleiades:912872','斯帕西努卡拉克斯'],
 ['pleiades:383584','贝德里亚库姆'],['pleiades:432927','马鲁维乌姆'],['pleiades:344282','萨布拉塔'],
 ['pleiades:501347','安菲波利斯'],['pleiades:501523','尼亚波利斯（卡瓦拉）'],['pleiades:413247','佩尔图伊努姆'],
 ['pleiades:442452','埃库姆·图蒂库姆'],['pleiades:540723','道利斯'],['pleiades:540820','希安波利斯'],
 ['pleiades:550433','安坦德罗斯'],['pleiades:648557','阿内穆里乌姆'],['pleiades:658538','莫普苏埃斯提亚'],
 ['pleiades:452361','拉奥斯'],['pleiades:403288','沃拉泰拉浅滩港'],['pleiades:413097','克卢维亚埃'],
 ['pleiades:413121','埃雷图姆'],['pleiades:413306','萨尔西纳'],['pleiades:413314','塞普滕佩达'],
 ['pleiades:422833','阿纳格尼亚（阿纳尼）'],['pleiades:422952','拉比库姆'],['pleiades:570129','阿索波斯'],
 ['pleiades:432705','阿泰拉'],['pleiades:432826','老法布拉特里亚'],['pleiades:432911','利泰尔努姆'],
 ['pleiades:433070','鲁夫拉埃'],['pleiades:433133','苏埃苏拉'],['pleiades:442642','卢皮亚埃（莱切）'],
 ['pleiades:442644','曼杜里亚'],['pleiades:541157','特拉基斯（赫拉克利亚）'],['pleiades:462234','赫洛罗斯'],
 ['pleiades:452375','梅德马'],['pleiades:452411','皮克苏斯（布克森图姆）'],['pleiades:452450','西里斯'],
 ['pleiades:452469','泰梅萨（滕普萨）'],['pleiades:462062','阿巴卡伊农'],['pleiades:609307','皮西迪亚安条克'],
 ['pleiades:570602','弗利乌斯'],['pleiades:580119','索里科斯'],['pleiades:501337','艾诺斯'],
 ['pleiades:324684','卡普萨（加夫萨）'],['pleiades:324816','苏费图拉（斯贝特拉）'],['pleiades:472024','苏尔基斯'],
 ['pleiades:413054','布莱拉'],['pleiades:413060','卡梅里努姆（卡梅里诺）'],['pleiades:413132','费伦蒂乌姆'],
 ['pleiades:413133','费斯肯尼乌姆'],['pleiades:413170','希斯佩卢姆（斯佩洛）'],['pleiades:413171','希斯托尼乌姆（瓦斯托）'],
 ['pleiades:413333','泰阿泰（基耶蒂）'],['pleiades:413356','图斯卡纳（图斯卡尼亚）'],['pleiades:413364','乌尔布斯·萨尔维亚'],
 ['pleiades:422923','菲德纳埃'],['pleiades:423117','韦莱特拉埃（韦莱特里）'],['pleiades:109153','梅迪奥拉努姆（埃夫勒）'],
 ['pleiades:109190','纳西乌姆'],['pleiades:39414','拉普塔'],['pleiades:59931','马图拉（秣菟罗）'],
 ['pleiades:59972','乌贾因（邬阇衍那）'],['pleiades:59978','华氏城（巴连弗邑）'],['pleiades:49863','阿努拉达普拉'],
 ['pleiades:50064','科尔凯'],['pleiades:50146','穆济里斯'],['pleiades:50150','那伽提波'],
 ['pleiades:50219','达拉尼科塔'],['pleiades:50221','阿里卡梅杜（波杜凯）'],
 // Wave-8: Full Pleiades ref === 19 (100% ref >= 19), 100 CE Gaul/Britain/Bengal & key ref === 18 cities
 ['pleiades:108765','阿图阿图卡（通厄伦）'],['pleiades:138169','阿吉努姆（阿让）'],['pleiades:197504','塞盖斯蒂卡（西萨克）'],
 ['pleiades:207439','塞尔迪卡（索非亚）'],['pleiades:216706','阿波罗尼亚（索佐波尔）'],['pleiades:216731','贝罗埃（旧扎戈拉）'],
 ['pleiades:216859','卡比莱'],['pleiades:216904','奥德苏斯（瓦尔纳）'],['pleiades:256058','卡尔莫（卡尔莫纳）'],
 ['pleiades:256155','埃梅里塔·奥古斯塔（梅里达）'],['pleiades:256177','加迪尔（加的斯）'],['pleiades:275740','瓦卢比利斯'],
 ['pleiades:295334','鲁苏库鲁'],['pleiades:315247','乌蒂纳'],['pleiades:324831','特韦斯特（泰贝萨）'],
 ['pleiades:383642','伊波雷迪亚（伊夫雷亚）'],['pleiades:393397','切塞纳'],['pleiades:393420','法文提亚（法恩扎）'],
 ['pleiades:413135','菲尔穆姆（费尔莫）'],['pleiades:413142','福鲁利'],['pleiades:413147','弗拉米尼乌斯广场'],
 ['pleiades:413217','穆萨尔纳'],['pleiades:413283','雷阿泰（列蒂）'],['pleiades:413293','塞纳（锡耶纳）'],
 ['pleiades:422909','科拉'],['pleiades:422922','菲库莱亚'],['pleiades:423078','苏布拉奎乌姆'],
 ['pleiades:423103','特雷布拉·苏费纳斯'],['pleiades:432738','卡拉蒂亚'],['pleiades:432772','新卡斯特鲁姆'],
 ['pleiades:432773','考迪乌姆'],['pleiades:432808','库迈（坎帕尼亚）'],['pleiades:432941','米塞努姆'],
 ['pleiades:433105','萨蒂库拉'],['pleiades:433164','巴利尼乌姆的特雷布拉'],['pleiades:442615','希德伦图姆（奥特朗托）'],
 ['pleiades:442751','鲁比（鲁沃）'],['pleiades:442815','阿普利亚的泰阿努姆'],['pleiades:442839','乌里亚（奥里亚）'],
 ['pleiades:442855','沃尔凯伊'],['pleiades:452369','洛克里（洛克里斯）'],['pleiades:462068','阿克拉埃'],
 ['pleiades:462082','阿吉里乌姆'],['pleiades:462244','希梅拉'],['pleiades:471907','科尔努斯'],
 ['pleiades:491731','斯托比'],['pleiades:491741','帖撒罗尼迦（塞萨洛尼基）'],['pleiades:501325','阿比多斯（赫勒斯滂）'],
 ['pleiades:511268','尼西亚（伊兹尼克）'],['pleiades:531013','尼科波利斯'],['pleiades:531104','斯特拉托斯'],
 ['pleiades:540642','安提基拉'],['pleiades:540801','哈利亚尔托斯'],['pleiades:540888','克鲁西斯'],
 ['pleiades:570292','赫尔米奥内'],['pleiades:570361','克莱奥奈'],['pleiades:570543','帕盖'],
 ['pleiades:570685','斯巴达'],['pleiades:579940','阿拉芬的哈莱'],['pleiades:580021','马拉松'],
 ['pleiades:589918','吕克托斯'],['pleiades:629035','马扎卡（卡帕多细亚凯撒利亚）'],['pleiades:648801','蒂亚纳'],
 ['pleiades:658378','阿纳扎尔布斯'],['pleiades:658483','塞琉西亚·皮埃里亚'],['pleiades:658636','泽乌格马'],
 ['pleiades:687839','亚实基伦'],['pleiades:687917','耶利哥'],['pleiades:716540','大卡塔巴斯穆斯'],
 ['pleiades:69539','诺伊奥杜努姆'],['pleiades:177460','奥古斯托杜努姆（欧坦）'],['pleiades:109321','萨马罗布里瓦（亚眠）'],
 ['pleiades:383564','阿尔巴·庞培亚'],['pleiades:79602','莫里杜努姆'],['pleiades:118572','弗拉维亚坛城（罗特魏尔）'],
 ['pleiades:109008','盖索里亚库姆（滨海布洛涅）'],['pleiades:383664','热那亚'],['pleiades:79436','杜罗利蓬特（剑桥）'],
 ['pleiades:138207','阿瓦里库姆（布尔日）'],['pleiades:79677','塞格洛库姆'],['pleiades:79741','维罗科尼乌姆'],
 ['pleiades:167645','安德里图姆'],['pleiades:177441','安德马图努姆（朗格勒）'],['pleiades:60027','萨拉里加'],
 ['pleiades:148127','马赛（马萨利亚）'],['pleiades:491687','佩拉（马其顿）'],['pleiades:678437','推罗（苏尔）'],
 ['pleiades:687856','伯利恒'],['pleiades:727169','瑙克拉提斯'],['pleiades:893945','亚述尔'],
 ['pleiades:658427','卡莱（哈兰）'],['pleiades:383816','维罗纳'],['pleiades:570228','埃皮达鲁斯'],
 ['pleiades:442509','布林迪西（布伦迪西乌姆）'],['pleiades:177657','贝桑松（维松蒂奥）'],['pleiades:619103','安卡拉（安基拉）'],
 ['pleiades:501482','腓立比'],['pleiades:638860','希拉波利斯（棉花堡）'],['pleiades:668290','叙利亚劳迪基亚'],
 ['pleiades:668335','叙利亚阿帕米亚'],['pleiades:961874','赫拉特（阿里亚亚历山德里亚）'],['pleiades:305090','希波（安纳巴）'],
 ['pleiades:570640','皮洛斯'],['pleiades:89175','埃布拉库姆（约克）'],
 ['pleiades:187265','阿贡图姆'],['pleiades:167716','沃孔蒂伊的迪亚（迪镇）'],
 ['pleiades:69491','孔达特（雷恩）'],['pleiades:138248','布尔迪加拉（波尔多）'],
 // Wave-9: Full Pleiades ref === 17..18 completion (100% of Pleiades ref >= 17)
 ['pleiades:108750','马蒂亚库姆温泉（威斯巴登）'],['pleiades:147993','阿普塔·尤利亚（阿普特）'],['pleiades:157802','阿尔宾蒂米利乌姆'],
 ['pleiades:177495','阿文蒂库姆（阿旺什）'],['pleiades:246380','埃卢萨（奥兹）'],['pleiades:265954','卢肯图姆（阿利坎特）'],
 ['pleiades:275666','利克苏斯'],['pleiades:29718','法拉赫（普罗夫塔西亚）'],['pleiades:315174','西米图'],
 ['pleiades:334636','蒂姆加德（塔穆加迪）'],['pleiades:344496','塔卡佩（加贝斯）'],['pleiades:383811','韦莱亚'],
 ['pleiades:393459','奥皮泰尔吉乌姆（奥德尔佐）'],['pleiades:393513','维凯蒂亚（维琴察）'],['pleiades:403248','奥尔贝泰洛'],
 ['pleiades:413024','库蒂利亚埃温泉'],['pleiades:413062','卡佩纳'],['pleiades:413200','梅瓦尼亚（贝瓦尼亚）'],
 ['pleiades:413225','纳尔尼亚（纳尔尼）'],['pleiades:413229','努尔西亚（诺尔恰）'],['pleiades:413251','法拉克里纳埃'],
 ['pleiades:413324','苏阿萨'],['pleiades:413339','蒂贝里努姆的蒂费尔努姆'],['pleiades:413350','特雷布拉·穆图埃斯卡'],
 ['pleiades:422821','埃富拉'],['pleiades:432716','巴亚（巴亚埃）'],['pleiades:432733','卡亚蒂亚'],
 ['pleiades:433185','韦纳夫鲁姆（韦纳夫罗）'],['pleiades:442495','阿莱蒂乌姆'],['pleiades:442496','班蒂亚'],
 ['pleiades:442573','格纳提亚'],['pleiades:442629','拉里努姆（拉里诺）'],['pleiades:442728','蓬泰卡尼亚诺'],
 ['pleiades:442845','瓦莱蒂乌姆'],['pleiades:452439','斯基莱蒂乌姆'],['pleiades:462126','卡马里纳'],
 ['pleiades:462197','恩泰拉'],['pleiades:462228','哈伦蒂乌姆'],['pleiades:462258','伊埃塔斯'],
 ['pleiades:462283','利帕拉（利帕里）'],['pleiades:471987','奥尔比亚（撒丁）'],['pleiades:491512','埃盖（韦尔吉纳）'],
 ['pleiades:491585','埃德萨（马其顿）'],['pleiades:491616','辛蒂卡的赫拉克利亚'],['pleiades:511384','布尔萨（普鲁萨）'],
 ['pleiades:530809','安菲洛基亚的阿尔戈斯'],['pleiades:540969','伊安泰亚'],['pleiades:541141','泰斯皮埃'],
 ['pleiades:550892','斯明泰翁'],['pleiades:570156','博伊埃'],['pleiades:570359','克莱托尔'],
 ['pleiades:570501','纳夫普利翁'],['pleiades:570653','萨米孔'],['pleiades:570715','萨拉迈'],
 ['pleiades:570756','特罗曾'],['pleiades:599616','欧罗莫斯'],['pleiades:609500','佩西努斯'],
 ['pleiades:638776','阿斯彭多斯'],['pleiades:648701','马加尔萨'],['pleiades:658409','阿勒颇（叙利亚贝罗亚）'],
 ['pleiades:668226','贝卢斯近郊卡尔基斯'],['pleiades:668291','黎巴嫩的劳迪基亚'],['pleiades:678082','卡纳塔'],
 ['pleiades:678121','多尔（多拉）'],['pleiades:687838','阿什杜德（阿佐托斯）'],['pleiades:857032','阿普萨罗斯'],
 ['pleiades:98918','哈德良广场（福尔堡）'],['pleiades:108927','迪沃杜鲁姆（梅斯）'],['pleiades:118802','劳里亚库姆（恩斯）'],
 ['pleiades:118901','奥维拉瓦（韦尔斯）'],['pleiades:167734','库拉罗（格勒诺布尔）'],['pleiades:167859','奥克托杜鲁斯（马蒂尼）'],
 ['pleiades:197207','基巴拉埃（温科夫齐）'],['pleiades:216788','代乌尔图姆'],['pleiades:246294','卡尔卡索（卡尔卡松）'],
 ['pleiades:246344','凯撒奥古斯塔（萨拉戈萨）'],['pleiades:246413','埃布罗马古斯'],['pleiades:256338','奥利西波（里斯本）'],
 ['pleiades:305142','萨尔达埃（贝贾亚）'],['pleiades:315038','比塞大（希波·迪亚里图斯）'],['pleiades:324825','泰纳埃'],
 ['pleiades:373824','哈德良堡（昔兰尼加）'],['pleiades:383589','贝加莫（贝尔戈穆姆）'],['pleiades:383633','代尔托纳（托尔托纳）'],
 ['pleiades:383680','伊里亚（沃盖拉）'],['pleiades:383717','诺瓦里亚（诺瓦拉）'],['pleiades:383808','萨巴蒂亚浅滩'],
 ['pleiades:393424','科尔内利乌斯广场（伊莫拉）'],['pleiades:413048','阿克西亚'],['pleiades:413065','卡尔苏拉埃'],
 ['pleiades:413114','库雷斯'],['pleiades:413145','克洛迪乌斯广场'],['pleiades:413184','费罗尼亚圣林'],
 ['pleiades:422898','科拉蒂亚'],['pleiades:423068','塞蒂亚（塞泽）'],['pleiades:432708','阿蒂纳'],
 ['pleiades:432855','丰迪'],['pleiades:433122','西努埃萨'],['pleiades:433126','索拉'],
 ['pleiades:442451','埃克拉努姆'],['pleiades:442511','布通图姆（比通托）'],['pleiades:442735','波滕蒂亚（波坦察）'],
 ['pleiades:452317','克罗顿（克罗托内）'],['pleiades:452466','陶里亚努姆'],['pleiades:462513','泰尔迈（泰尔米尼）'],
 ['pleiades:472096','马里亚纳（科西嘉）'],['pleiades:481715','阿曼蒂亚'],['pleiades:540630','安菲萨'],
 ['pleiades:540743','德里迈亚'],['pleiades:540915','利莱亚'],['pleiades:541063','普拉泰亚'],
 ['pleiades:550544','加尔加拉'],['pleiades:550763','米蒂利尼'],['pleiades:570065','阿利菲拉'],
 ['pleiades:570124','阿西内'],['pleiades:570354','凯里尼亚（阿哈伊亚）'],['pleiades:570424','勒拿'],
 ['pleiades:570482','迈萨纳'],['pleiades:570711','泰内阿'],['pleiades:580097','拉姆努斯'],
 ['pleiades:580107','苏尼翁'],['pleiades:59747','比吉斯（布斯特）'],['pleiades:59750','布刻法拉'],
 ['pleiades:599664','伊阿索斯'],['pleiades:599778','迈安德尔河畔马格内西亚'],['pleiades:638778','安塔利亚（阿塔利亚）'],
 ['pleiades:648548','阿达纳（萨鲁斯安条克）'],['pleiades:648789','塔尔苏斯'],['pleiades:658446','基鲁斯'],
 ['pleiades:668354','雷萨法（塞尔吉奥波利斯）'],['pleiades:678179','赫利奥波利斯（巴勒贝克）'],['pleiades:678378','斯库托波利斯（贝特谢安）'],
 ['pleiades:727082','巴比伦（福斯塔特／开罗旧城）'],['pleiades:79531','伊斯卡·杜姆诺尼奥鲁姆（埃克塞特）'],['pleiades:79739','维鲁拉米乌姆（圣奥尔本斯）'],
 ['pleiades:854687','赫尔莫纳萨'],['pleiades:857285','波勒莫尼翁（西代）'],['pleiades:874298','阿米达（迪亚巴克尔）'],
 ['pleiades:874341','埃尔比勒（阿尔贝拉）'],['pleiades:874699','辛加拉'],['pleiades:89143','卡塔拉克托尼乌姆（卡特里克）'],
 // Wave-10: Full Pleiades ref === 16 completion (100% of Pleiades ref >= 16) + 750 CE & 1960 landmarks
 ['pleiades:295279','约尔凯撒里亚（歇尔谢尔）'],['pleiades:305063','库卢（科洛）'],['pleiades:305064','西尔塔（君士坦丁）'],
 ['pleiades:148053','阿奎·塞克斯蒂亚（普罗旺斯艾克斯）'],['pleiades:157834','凯梅内卢姆（锡米耶）'],['pleiades:157836','尤利乌斯广场（弗雷瑞斯）'],
 ['pleiades:373750','巴尔卡'],['pleiades:383574','阿奎·斯塔蒂埃拉'],['pleiades:383580','奥古斯塔·陶里诺鲁姆（都灵）'],
 ['pleiades:383627','科莫（科穆姆）'],['pleiades:393427','波皮利乌斯广场（福林波波利）'],['pleiades:550924','推雅推喇'],
 ['pleiades:619164','加尔绍拉（阿克萨赖）'],['pleiades:629075','塞巴斯蒂亚（锡瓦斯）'],['pleiades:638796','考诺斯'],
 ['pleiades:857321','锡诺普'],['pleiades:305153','西蒂菲斯（塞提夫）'],['pleiades:314912','布拉·雷吉亚'],
 ['pleiades:315085','穆斯蒂'],['pleiades:678387','塞弗里斯'],['pleiades:687891','以马忤斯（尼科波利斯）'],
 ['pleiades:707519','伊达利翁'],['pleiades:736920','赫拉克利奥波利斯'],['pleiades:736948','克罗科迪洛波利斯（法尤姆）'],
 ['pleiades:589913','林多斯'],['pleiades:59672','极东亚历山大里亚（苦盏）'],['pleiades:599575','尼多斯（克尼多斯）'],
 ['pleiades:599811','明多斯'],['pleiades:432679','安蒂努姆'],['pleiades:432721','贝内文托（贝内温图姆）'],
 ['pleiades:432725','博维亚努姆'],['pleiades:432764','卡西努姆（卡西诺）'],['pleiades:432907','拜比亚尼的利古里亚区'],
 ['pleiades:438710','因努乌斯堡'],['pleiades:442471','阿奎洛尼亚'],['pleiades:442523','坎尼'],
 ['pleiades:442640','卢凯里亚'],['pleiades:442688','内雷图姆（纳尔多）'],['pleiades:442693','努米斯特罗'],
 ['pleiades:540582','阿拜（福基斯）'],['pleiades:540717','科罗尼亚'],['pleiades:540960','纳夫帕克托斯'],
 ['pleiades:541020','佩利纳（塞萨利）'],['pleiades:541044','费赖'],['pleiades:550523','埃莱亚（密细亚）'],
 ['pleiades:462247','希帕纳'],['pleiades:462259','伊马卡拉'],['pleiades:462424','芬蒂亚斯（利卡塔）'],
 ['pleiades:462527','廷达里斯'],['pleiades:648647','科尼亚（伊科尼乌姆）'],['pleiades:648702','马洛斯'],
 ['pleiades:648772','奇里乞亚塞利努斯'],['pleiades:452274','布兰达（卢卡尼亚）'],['pleiades:452304','克兰佩蒂亚'],
 ['pleiades:609538','辛纳达'],['pleiades:344377','戈莱亚（布恩杰姆）'],['pleiades:344456','奥亚（的黎波里）'],
 ['pleiades:570548','帕兰蒂翁'],['pleiades:570567','帕特雷'],['pleiades:570720','泰索阿'],
 ['pleiades:580110','斯泰里亚'],['pleiades:462225','哈莱萨'],['pleiades:256128','科尔多瓦（科尔杜巴）'],
 ['pleiades:256231','伊塔利卡'],['pleiades:530843','多多纳'],['pleiades:481808','多克莱亚'],
 ['pleiades:167718','瓦伦蒂亚（瓦朗斯）'],['pleiades:167771','塞古西亚维广场（弗尔）'],
 ['pleiades:501323','阿布德拉（色雷斯）'],['pleiades:501572','普洛蒂诺波利斯'],['pleiades:501596','萨莫色雷斯'],
 ['pleiades:501645','托佩罗斯'],['pleiades:334536','迪亚纳·韦特拉诺鲁姆'],['pleiades:334570','兰巴埃西斯'],
 ['pleiades:197312','扎达尔（亚德尔）'],['pleiades:197488','萨洛纳'],['pleiades:874502','哈桑卢丘遗址'],
 ['pleiades:471977','萨丁尼亚那波利斯'],['pleiades:678073','布斯拉'],['pleiades:678142','加达拉'],
 ['pleiades:403254','皮斯托亚'],['pleiades:413037','阿西西'],['pleiades:413074','特鲁恩图姆堡'],
 ['pleiades:413149','森普罗尼乌斯广场（福松布罗内）'],['pleiades:413228','努马纳'],['pleiades:413246','保苏拉埃'],
 ['pleiades:423026','拉鲁斯蒂卡'],['pleiades:246343','巴尔奇诺（巴塞罗那）'],['pleiades:246345','克卢尼亚'],
 ['pleiades:246459','拉克托拉（莱克图尔）'],['pleiades:89152','科里亚（科布里奇）'],['pleiades:109059','亚蒂农（莫城）'],
 ['pleiades:118580','奥古斯塔·温德利库姆（奥格斯堡）'],
 ['pleiades:818739154','威尼斯'],['pleiades:599636','哈利卡纳苏斯'],['pleiades:912986','乌鲁克'],
 ['pleiades:109169','美因茨（莫贡蒂亚库姆）'],['pleiades:893952','巴格达'],['pleiades:903088','纳哈万德'],
 ['pleiades:894178','韦赫-阿尔达希尔（塞琉西亚）'],['pleiades:874771','图什帕（凡城）'],['pleiades:942260','达姆甘（库米斯）'],
 ['pleiades:29678','扎兰季（纳迪阿里）'],['pleiades:29755','沙赫里斯兰（扎兰季）'],['pleiades:29501','巴姆'],
 ['pleiades:46154574','巴库'],['pleiades:403627900','拉利贝拉'],['pleiades:863911','佐尔'],
 ['pleiades:589772','埃莱夫塞尔纳'],['pleiades:355216649','索斯丘克'],['pleiades:893964','博尔西帕'],
 ['pleiades:894099','提克里特'],['pleiades:893941','基尔库克（阿拉法）'],['pleiades:658474','卡赫拉曼马拉什（日耳曼尼西亚）'],
 ['pleiades:854724','法纳戈里亚'],['pleiades:229277207','利奥城（梵蒂冈）'],['pleiades:550771','老士麦那'],
 ['pleiades:609305','弗里吉亚安卡拉'],['pleiades:589692','安德罗斯城'],
 // Wave-11: Full Pleiades ref === 15 completion (100% of Pleiades ref >= 15) + 1000 CE Silk Road & Iberia landmarks
 ['pleiades:266021','萨贡托（阿尔塞）'],['pleiades:295363','蒂帕萨'],['pleiades:295374','祖卡巴尔（米利亚纳）'],
 ['pleiades:157879','博尔马努斯圣林'],['pleiades:373786','欧埃斯佩里得斯（班加西古址）'],['pleiades:383706','米兰（梅迪奥拉努姆）'],
 ['pleiades:383804','特伦托（特里登图姆）'],['pleiades:393473','帕多瓦（帕塔维乌姆）'],['pleiades:570205','迪迈（阿哈伊亚）'],
 ['pleiades:845041','庞培波利斯（塞巴斯泰）'],['pleiades:638814','克雷姆纳'],['pleiades:638955','吕科斯河畔老底嘉'],
 ['pleiades:639042','帕塔拉'],['pleiades:216744','卡拉蒂斯（曼加利亚）'],['pleiades:216927','腓力波波利斯（普罗夫迪夫）'],
 ['pleiades:305068','奎库尔（杰米拉）'],['pleiades:305137','鲁西卡德（斯基克达）'],['pleiades:678324','腓立比凯撒里亚（巴尼亚斯）'],
 ['pleiades:678393','西顿'],['pleiades:727078','阿特里比斯（下埃及）'],['pleiades:727153','马雷亚（菲洛克塞尼泰）'],
 ['pleiades:756574','大赫尔莫波利斯（赫蒙努）'],['pleiades:589807','耶拉皮特纳'],['pleiades:589917','吕卡斯托斯'],
 ['pleiades:589987','费斯托斯'],['pleiades:59669','阿拉霍西亚亚历山大里亚（坎大哈古址）'],['pleiades:599550','巴尔吉利亚'],
 ['pleiades:599577','科洛丰'],['pleiades:599754','莱贝多斯'],['pleiades:423121','拉乌伦图姆奥古斯都村'],
 ['pleiades:432852','弗鲁西诺（弗罗西诺内）'],['pleiades:432890','库布泰里亚'],['pleiades:433125','西尔皮乌姆'],
 ['pleiades:433128','斯塔比亚'],['pleiades:433132','苏埃萨·奥伦卡'],['pleiades:442491','阿泽蒂乌姆'],
 ['pleiades:442515','凯利亚（阿普利亚）'],['pleiades:442536','密涅瓦堡'],['pleiades:442546','特里卡里科古城'],
 ['pleiades:442550','孔普萨'],['pleiades:442753','鲁迪埃'],['pleiades:540906','拉里姆纳'],
 ['pleiades:540907','莱瓦迪亚'],['pleiades:541008','帕诺佩乌斯'],['pleiades:541117','斯蒂拉'],
 ['pleiades:541137','弗提亚底比斯'],['pleiades:648810','泽菲里翁（梅尔辛）'],['pleiades:658455','多利克'],
 ['pleiades:658481','卡斯塔巴拉'],['pleiades:442841','乌曾图姆（乌真托）'],['pleiades:462074','阿德拉农（阿德拉诺）'],
 ['pleiades:462079','阿加蒂尔努姆'],['pleiades:462106','阿索鲁斯（阿索罗）'],['pleiades:786036','赫尔蒙提斯（阿尔曼特）'],
 ['pleiades:786059','拉托波利斯（伊斯纳）'],['pleiades:786123','西耶尼（阿斯旺）'],['pleiades:79409','库内蒂奥'],
 ['pleiades:79735','文塔·贝尔加鲁姆（温彻斯特）'],['pleiades:805630','麦罗埃'],['pleiades:609367','多里莱乌姆（埃斯基谢希尔）'],
 ['pleiades:609382','欧迈尼亚'],['pleiades:334599','阿德·马约雷斯'],['pleiades:570423','莱普雷翁'],
 ['pleiades:570596','法赖（美塞尼亚）'],['pleiades:570761','扎拉克斯'],['pleiades:579941','哈利穆斯'],
 ['pleiades:580109','斯费托斯'],['pleiades:580114','塔纳格拉'],['pleiades:481728','阿波罗尼亚（伊利里亚）'],
 ['pleiades:511375','普里阿波斯'],['pleiades:511385','基奥斯（盖姆利克）'],['pleiades:530793','阿利泽亚'],
 ['pleiades:530870','厄菲拉（伊庇鲁斯）'],['pleiades:531061','腓尼基城（伊庇鲁斯）'],['pleiades:167663','阿克西马（艾姆）'],
 ['pleiades:167719','维埃纳（维恩纳殖民地）'],['pleiades:491663','梅托内（皮埃里亚）'],['pleiades:501428','哈德良堡（埃迪尔内）'],
 ['pleiades:324665','阿迈达拉（海德拉）'],['pleiades:246694','图卢兹（托洛萨）'],['pleiades:177577','马孔（马蒂斯科）'],
 ['pleiades:187430','尤利乌姆·卡尔尼库姆（祖廖）'],['pleiades:187583','图尔尼亚'],['pleiades:197471','里济尼乌姆（里桑）'],
 ['pleiades:874418','卡尔哈'],['pleiades:472048','阿莱里亚（阿拉利亚）'],['pleiades:942276','百门城（赫卡托姆皮洛斯）'],
 ['pleiades:971886','铁尔梅兹（塔尔米塔）'],['pleiades:678185','希波斯（加利利）'],['pleiades:138255','图尔（凯撒罗杜努姆）'],
 ['pleiades:138458','梅迪奥拉努姆·桑托努姆（桑特）'],['pleiades:413017','安克萨努姆（兰恰诺）'],['pleiades:413046','阿韦亚'],
 ['pleiades:413143','奥雷利乌斯广场'],['pleiades:413148','新广场（韦斯科维奥）'],['pleiades:413151','福利尼奥（富尔吉尼亚埃）'],
 ['pleiades:413166','赫尔维亚·里基纳'],['pleiades:413189','曼利亚纳'],['pleiades:413315','塞斯蒂努姆'],
 ['pleiades:413354','图德尔（托迪）'],['pleiades:422930','弗雷杰纳埃'],['pleiades:422956','拉努维乌姆'],
 ['pleiades:246379','埃林贝鲁姆（欧什）'],['pleiades:874774','蒂格拉诺凯尔特'],['pleiades:893974','基尔凯西乌姆（布赛拉）'],
 ['pleiades:894004','哈特拉'],['pleiades:108755','阿尔根托瓦里亚'],['pleiades:109366','泰鲁阿讷（塔尔文纳）'],
 ['pleiades:430344981','大不里士'],['pleiades:641191184','马什哈德'],['pleiades:300354630','萨卜泽瓦尔'],
 ['pleiades:630721027','坎大哈古城'],['pleiades:410216618','麦迪纳·阿扎哈拉'],['pleiades:931117398','巴达霍斯'],
 ['pleiades:503948792','昆卡'],['pleiades:810796636','穆尔西亚'],['pleiades:302942693','哈恩'],
 ['pleiades:694916885','索里亚'],['pleiades:50120','曼泰'],['pleiades:59666','阿克拉（班努古址）'],
 ['pleiades:903012','迪纳瓦尔'],['pleiades:678333','贝特耶拉赫'],['pleiades:678211','乌赛斯'],
 ['pleiades:648710','梅伊丹哲克城堡'],
 // Wave-12: Full Pleiades ref === 14 completion (100% of Pleiades ref >= 14) + 1000 CE Persia/Arabia/East Africa landmarks
 ['pleiades:266066','托莱多（托莱图姆）'],['pleiades:275736','丹吉尔（廷吉）'],['pleiades:295280','伊奥姆尼乌姆（蒂格齐尔特）'],
 ['pleiades:295333','鲁苏比卡里'],['pleiades:483473194','恰塔尔休于'],['pleiades:148093','格拉努姆'],
 ['pleiades:157805','雷伊（里耶）'],['pleiades:157896','奥尔比亚（高卢/耶尔）'],['pleiades:363924','菲莱尼兄弟祭坛'],
 ['pleiades:373749','巴拉格拉埃（贝达）'],['pleiades:383578','奥古斯塔·巴吉恩诺鲁姆'],['pleiades:383602','布里克塞卢姆（布雷谢洛）'],
 ['pleiades:383648','菲登蒂亚（菲登扎）'],['pleiades:383694','利巴尔纳'],['pleiades:383798','帕维亚（提基努姆）'],
 ['pleiades:39271','阿杜利斯'],['pleiades:570027','阿比亚（麦西尼亚）'],['pleiades:570043','埃吉拉'],
 ['pleiades:570044','埃吉埃（拉科尼亚）'],['pleiades:570059','卫城科林斯（阿克罗科林托斯）'],['pleiades:844856','阿马斯特里斯（阿马斯拉）'],
 ['pleiades:844970','卡兰比斯'],['pleiades:854719','潘提卡彭（刻赤）'],['pleiades:638749','安蒂费洛斯（卡什）'],
 ['pleiades:638803','哈哲穆萨拉尔丘'],['pleiades:638936','科尔马萨'],['pleiades:639048','佩尔格'],
 ['pleiades:216800','杜罗斯托鲁姆（锡利斯特拉）'],['pleiades:216839','伊斯特里亚'],['pleiades:226546','奥尔比亚（黑海）'],
 ['pleiades:226800','提拉斯（比尔霍罗德）'],['pleiades:281718504','大阿尔布努斯（罗西亚蒙大拿）'],['pleiades:687925','雅布内（亚姆尼亚）'],
 ['pleiades:687996','安提帕特里斯'],['pleiades:707534','基蒂翁（拉纳卡）'],['pleiades:707628','塔马索斯'],
 ['pleiades:727124','赫罗恩波利斯（皮托姆）'],['pleiades:570336','卡里斯托斯'],['pleiades:570347','肯克雷亚'],
 ['pleiades:570392','基奈萨（卡拉夫里塔）'],['pleiades:570396','基帕里夏'],['pleiades:756613','帕诺波利斯（艾赫米姆）'],
 ['pleiades:589815','伊阿利索斯'],['pleiades:589901','莱本（伦塔斯）'],['pleiades:590011','普赖索斯'],
 ['pleiades:59915','马拉坎达（撒马尔罕）'],['pleiades:599476','埃吉亚莱'],['pleiades:599490','阿奈亚'],
 ['pleiades:599745','拉布劳恩达'],['pleiades:550571','伊奥利亚赫拉克利亚'],['pleiades:550756','米里纳（伊奥利亚）'],
 ['pleiades:432676','安吉提亚圣林'],['pleiades:432709','奥菲德纳（阿尔费德纳）'],['pleiades:432782','奇尔切伊（圣费利切）'],
 ['pleiades:432886','约维斯·拉雷尼'],['pleiades:442691','诺尔巴（阿普利亚）'],['pleiades:540617','阿克赖菲亚'],
 ['pleiades:540631','阿米罗斯'],['pleiades:540682','阿特拉克斯'],['pleiades:540687','阿佐罗斯'],
 ['pleiades:540823','希埃托斯'],['pleiades:540909','莱夫坎迪'],['pleiades:540921','利西马基亚（埃托利亚）'],
 ['pleiades:540984','翁凯斯托斯'],['pleiades:540987','奥尔霍迈诺斯（维奥蒂亚）'],['pleiades:540992','法拉纳'],
 ['pleiades:541081','皮拉索斯'],['pleiades:550404','埃盖（伊奥利亚）'],['pleiades:550535','埃里特赖'],
 ['pleiades:857177','新凯撒里亚（卡贝拉/尼克萨尔）'],['pleiades:462239','赫尔贝索斯'],['pleiades:462269','卡斯梅奈'],
 ['pleiades:462279','莱昂蒂尼'],['pleiades:462281','利利巴埃乌姆（马尔萨拉）'],['pleiades:462378','莫迪卡（穆图卡）'],
 ['pleiades:648555','尤穆克特佩（梅尔辛）'],['pleiades:648628','埃莱乌萨·塞巴斯泰'],['pleiades:648781','索洛伊（奇里乞亚庞培波利斯）'],
 ['pleiades:658371','伊苏斯近郊亚历山大里亚（伊斯肯德伦）'],['pleiades:786127','丹德拉（坦提拉）'],['pleiades:786132','图菲翁（托德）'],
 ['pleiades:79475','加里亚诺努姆'],['pleiades:79549','科里尼乌姆（赛伦塞斯特）'],['pleiades:79733','文塔·伊凯诺鲁姆（凯斯特）'],
 ['pleiades:609292','艾扎诺伊'],['pleiades:609302','阿莫里翁'],['pleiades:570485','米迪亚（阿尔戈利斯）'],
 ['pleiades:570558','帕奥斯'],['pleiades:570591','法里斯（拉科尼亚）'],['pleiades:570598','菲加利亚'],
 ['pleiades:570662','塞拉西亚'],['pleiades:579853','埃伊纳'],['pleiades:579855','埃克索内'],
 ['pleiades:579873','阿菲德纳'],['pleiades:579887','阿斯莫农'],['pleiades:579932','欧奥尼蒙'],
 ['pleiades:579935','加尔格托斯'],['pleiades:579971','凯法莱'],['pleiades:579972','基菲夏'],
 ['pleiades:580072','法勒隆'],['pleiades:511218','基齐库斯'],['pleiades:511354','帕里翁'],
 ['pleiades:530834','科基拉（科孚）'],['pleiades:530842','迪奥里克托斯'],['pleiades:530879','格利基斯港'],
 ['pleiades:531019','翁凯斯莫斯（萨兰达）'],['pleiades:180252821','阿佐里亚'],['pleiades:481770','布德瓦（布托埃）'],
 ['pleiades:481896','利苏斯（莱什）'],['pleiades:491519','阿洛罗斯'],['pleiades:491526','阿波罗尼亚（哈尔基迪基）'],
 ['pleiades:167650','艾克斯莱班（阿奎·阿拉奥布罗古姆）'],['pleiades:167675','贝尔金特鲁姆（圣莫里斯堡）'],['pleiades:491572','迪翁（奥林波斯山）'],
 ['pleiades:491664','米埃扎'],['pleiades:501570','兰普萨库斯'],['pleiades:167919','塞古西奥（苏萨）'],
 ['pleiades:177473','比布拉克特'],['pleiades:177516','埃帕曼杜奥杜鲁姆（芒德尔）'],['pleiades:187292','阿尔博尔·费利克斯（阿尔邦）'],
 ['pleiades:187325','布里甘提乌姆（布雷根茨）'],['pleiades:187432','尤瓦乌姆（萨尔茨堡）'],['pleiades:197130','阿昆库姆（布达佩斯）'],
 ['pleiades:197427','帕伦提乌姆（波雷奇）'],['pleiades:197501','斯卡尔班蒂亚（肖普朗前身）'],['pleiades:874361','阿塔沙特（阿尔塔克萨塔）'],
 ['pleiades:874623','尼西比斯（努赛宾）'],['pleiades:472035','图里斯·利比索尼斯（托雷斯港）'],['pleiades:922695','波斯波利斯（帕尔萨）'],
 ['pleiades:678266','莱吉奥（米吉多罗马营地）'],['pleiades:138323','达里奥里图姆（瓦讷）'],['pleiades:413179','泰拉莫（普拉埃图蒂乌姆因特拉姆尼亚）'],
 ['pleiades:413264','普莱斯蒂亚'],['pleiades:246349','塔拉科（塔拉戈纳）'],['pleiades:246352','康普卢图姆（埃纳雷斯堡）'],
 ['pleiades:246406','赫罗纳（格伦达）'],['pleiades:246410','格罗弗桑克'],['pleiades:89128','布罗科利蒂亚'],
 ['pleiades:108729','阿格丁库姆（桑斯）'],['pleiades:108776','奥古斯托马古斯（桑利斯）'],['pleiades:108788','巴加库姆（巴韦）'],
 ['pleiades:108802','贝尔吉努姆'],['pleiades:109194','内梅塔库姆（阿拉斯）'],['pleiades:109287','鲁昂（罗托马古斯）'],
 ['pleiades:109329','斯卡尔蓬纳'],
 ['pleiades:211425279','拉什特'],['pleiades:890432541','卡尚'],['pleiades:982176368','法达克'],
 ['pleiades:897829063','格迪古城'],['pleiades:903064','霍拉马巴德'],['pleiades:903102','克尔曼沙汗'],
 ['pleiades:692712721','卡尔斯'],['pleiades:296101142','希拉（巴比伦近郊）'],['pleiades:159615010','苏尔特'],
 ['pleiades:944396034','马拉盖'],['pleiades:874762','塔努里斯'],['pleiades:39300','阿特鲁拉'],
 ['pleiades:874438','巴莱萨'],['pleiades:699913','伊拉克城堡（外约旦）'],['pleiades:671109966','拉马特·拉赫勒'],
 ['pleiades:499030282','古拜拉'],
 // Wave-13: Full Pleiades ref === 13 completion (100% of Pleiades ref >= 13; 1,118 classic sites)
 ['pleiades:265928','托尔莫·德·米纳特达'],['pleiades:295221','奥齐亚（苏尔古兹兰）'],['pleiades:295276','伊科西乌姆（阿尔及尔）'],
 ['pleiades:295327','奎扎·克尼塔纳'],['pleiades:147985','阿加塔（阿格德）'],['pleiades:148121','卢特瓦（洛代夫）'],
 ['pleiades:148223','乌格尔努姆（博凯尔）'],['pleiades:148228','瓦西奥（韦宗）'],['pleiades:383651','瓦伦提努姆（瓦伦扎）'],
 ['pleiades:383669','阿斯蒂（哈斯塔）'],['pleiades:383704','曼图亚（曼托瓦）'],['pleiades:383745','波伦提亚（波伦佐）'],
 ['pleiades:39303','阿克苏姆'],['pleiades:393421','博洛尼亚（费尔西纳/波诺尼亚）'],['pleiades:393441','尤利亚·孔科尔迪亚'],
 ['pleiades:550814','佩尔佩雷内'],['pleiades:550856','罗伊泰翁'],['pleiades:550893','士麦那（欧律狄刻亚）'],
 ['pleiades:550913','忒俄斯'],['pleiades:570122','阿塞亚'],['pleiades:570134','阿斯特龙'],
 ['pleiades:638752','阿佩尔莱'],['pleiades:638761','阿利亚索斯'],['pleiades:638789','巴尔布拉'],
 ['pleiades:638888','卡拉班提亚'],['pleiades:638958','莱托翁'],['pleiades:639098','塞琉古·西德拉'],
 ['pleiades:639109','锡利翁'],['pleiades:216895','伊斯托尔河畔尼科波利斯'],['pleiades:217025','特罗埃斯米斯'],
 ['pleiades:217027','图拉真胜利碑城（亚当克利西）'],['pleiades:305082','加迪奥法拉'],['pleiades:314857','阿格比亚'],
 ['pleiades:315065','马道罗斯'],['pleiades:315220','大图布尔博'],['pleiades:678404','希克莫纳丘'],
 ['pleiades:678431','提比里亚'],['pleiades:687854','拜特古夫林（埃莱乌泰罗波利斯）'],['pleiades:687931','雅法（约帕）'],
 ['pleiades:69494','库唐斯（科塞迪亚）'],['pleiades:69538','努瓦奥杜努姆'],['pleiades:697632','拉巴特（阿雷奥波利斯）'],
 ['pleiades:697728','安曼（非拉铁非）'],['pleiades:707504','佩吉亚（圣乔治角）'],['pleiades:716524','安蒂弗赖'],
 ['pleiades:716615','帕拉埃托尼乌姆（马特鲁）'],['pleiades:727123','达曼胡尔（小赫尔莫波利斯）'],['pleiades:727149','莱托波利斯'],
 ['pleiades:727192','佩卢西乌姆'],['pleiades:570333','卡尔泰亚'],['pleiades:736983','俄克喜林库斯'],
 ['pleiades:589775','埃利罗斯'],['pleiades:589836','卡米罗斯'],['pleiades:589974','帕诺尔莫斯（克里特）'],
 ['pleiades:590003','波利雷尼亚'],['pleiades:590030','罗德城'],['pleiades:59885','喀布尔'],
 ['pleiades:599813','米乌斯'],['pleiades:550565','哈马克西托斯'],['pleiades:550667','科里法斯'],
 ['pleiades:432652','伊塞尔尼亚（埃塞尔尼亚）'],['pleiades:432720','巴乌利（巴科利）'],['pleiades:432724','博斯科特雷卡塞'],
 ['pleiades:432783','奇尔切伊（新址）'],['pleiades:433010','普尼库姆（圣玛丽内拉）'],['pleiades:433195','诺瓦努姆村'],
 ['pleiades:442465','安克西亚（安齐）'],['pleiades:442487','奥斯库卢姆（阿斯科利·萨特里亚诺）'],['pleiades:442584','福伦图姆'],
 ['pleiades:442625','加利波利（卡利波利斯）'],['pleiades:540756','埃莱乌泰赖'],['pleiades:540793','贡诺伊'],
 ['pleiades:540804','哈洛斯'],['pleiades:540817','希斯蒂埃亚'],['pleiades:540837','伊俄尔科斯'],
 ['pleiades:540849','卡利波利斯（埃托利亚）'],['pleiades:540886','克兰农'],['pleiades:540913','留克特拉'],
 ['pleiades:540939','梅德翁'],['pleiades:540998','帕加塞'],['pleiades:541015','普西洛·卡斯特罗'],
 ['pleiades:541042','法萨卢斯'],['pleiades:541077','普泰莱翁'],['pleiades:541106','斯科洛斯'],
 ['pleiades:541139','泰尔蒙'],['pleiades:541163','特里卡拉（特里卡）'],['pleiades:550500','克里萨'],
 ['pleiades:857095','本都科马纳'],['pleiades:462379','米拉埃（米拉佐）'],['pleiades:462388','内图姆（诺托）'],
 ['pleiades:462435','卡萨莱别墅（皮亚扎·阿尔梅里纳）'],['pleiades:648560','克拉古斯近郊安条克'],['pleiades:648596','凯伦德里斯'],
 ['pleiades:648651','新伊绍拉（伊绍罗波利斯）'],['pleiades:648717','纳吉多斯'],['pleiades:658368','埃盖（奇里乞亚阿亚斯）'],
 ['pleiades:452390','内鲁卢姆'],['pleiades:462069','阿克里拉埃'],['pleiades:462118','布里金尼亚埃'],
 ['pleiades:785974','埃德富（大阿波罗波利斯）'],['pleiades:786020','艾勒提亚波利斯（卡卜）'],['pleiades:79313','班纳文塔'],
 ['pleiades:79394','格洛斯特（格莱武姆殖民地）'],['pleiades:79395','林杜姆（林肯）'],['pleiades:79439','杜罗韦尔努姆（坎特伯雷）'],
 ['pleiades:79440','杜罗维古图姆（戈德曼彻斯特）'],['pleiades:79559','莱托克图姆（沃尔）'],['pleiades:79639','佩图阿里亚（布拉夫）'],
 ['pleiades:825265','戈尔吉皮亚（阿纳帕）'],['pleiades:60083','塔克西拉'],['pleiades:609484','纳科莱亚'],
 ['pleiades:570417','拉斯（拉科尼亚）'],['pleiades:570507','内斯塔内'],['pleiades:570528','奥莱诺斯'],
 ['pleiades:570590','法赖（阿哈伊亚）'],['pleiades:570741','蒂塔内'],['pleiades:579859','阿马林托斯'],
 ['pleiades:579863','阿纳吉鲁斯'],['pleiades:579866','阿纳菲斯托斯'],['pleiades:579902','科拉尔戈斯'],
 ['pleiades:579938','哈格努斯'],['pleiades:580030','米里努斯'],['pleiades:580051','帕莱内'],
 ['pleiades:256151','埃沃拉（埃博拉）'],['pleiades:256222','大伊利帕（阿尔卡拉·德尔里奥）'],['pleiades:265762','阿布德拉（阿德拉）'],
 ['pleiades:265765','阿基（瓜迪克斯）'],['pleiades:265849','新迦太基（卡塔赫纳）'],['pleiades:511194','米尔莱亚（穆达尼亚）'],
 ['pleiades:511357','佩林图斯（马尔马拉埃雷利）'],['pleiades:530798','阿纳克托里翁'],['pleiades:531093','萨迈（凯法利尼亚）'],
 ['pleiades:481818','都拉斯（迪拉基乌姆）'],['pleiades:481949','帕乌塔利亚（丘斯滕迪尔）'],['pleiades:156116232','涅斯托尔王宫（皮洛斯）'],
 ['pleiades:167629','阿尔巴（阿尔德什）'],['pleiades:167750','埃布罗杜努姆（昂布兰）'],['pleiades:501411','埃莱乌斯'],
 ['pleiades:324828','泰莱普特'],['pleiades:167885','罗阿讷（罗杜姆纳）'],['pleiades:187242','阿博迪亚库姆（埃普法赫）'],
 ['pleiades:187335','坎波杜努姆（肯普滕）'],['pleiades:187357','库尔（库里亚）'],['pleiades:187624','温特图尔（维图杜鲁姆）'],
 ['pleiades:197113','安道托尼亚（希塔列沃）'],['pleiades:197244','代尔米尼乌姆（托米斯拉夫格勒）'],['pleiades:197258','卢布尔雅那（埃莫纳）'],
 ['pleiades:197408','内维奥杜努姆（德尔诺沃）'],['pleiades:197555','特罗吉尔（特拉古里乌姆）'],['pleiades:206927','阿普卢姆（阿尔巴尤利亚）'],
 ['pleiades:874444','达拉（阿纳斯塔修波利斯）'],['pleiades:874609','摩苏尔（梅斯皮拉）'],['pleiades:874662','雷萨伊纳（拉斯艾因）'],
 ['pleiades:795348768','阿尔特纳古城'],['pleiades:472038','乌塞利斯'],['pleiades:912985','乌尔'],
 ['pleiades:922693','帕萨尔加德（巴特拉卡塔什）'],['pleiades:668182','哈马（叙利亚埃皮法尼亚）'],['pleiades:138206','欧塞尔（奥泰西奥杜鲁姆）'],
 ['pleiades:138281','奥尔良（凯纳布姆）'],['pleiades:256005','巴埃洛·克劳迪亚'],['pleiades:524143100','阿姆尼索斯'],
 ['pleiades:207395','罗穆利亚纳（加姆济格勒）'],['pleiades:207527','乌尔皮亚·图拉真·萨尔米泽盖图萨'],['pleiades:919620902','廷波内·德拉莫塔'],
 ['pleiades:138636','乌克塞洛杜努姆'],['pleiades:413030','阿尔纳（奇维泰拉达尔纳）'],['pleiades:413078','基安恰诺泰尔梅'],
 ['pleiades:413164','赫巴（马利亚诺）'],['pleiades:413181','因泰罗克里乌姆（安特罗多科）'],['pleiades:413234','奥尔托纳'],
 ['pleiades:413255','皮纳（彭内）'],['pleiades:413312','森蒂努姆（萨索费拉托）'],['pleiades:413349','特雷维（特雷比亚埃）'],
 ['pleiades:413365','乌尔维努姆·霍尔滕塞'],['pleiades:413373','奥尔维耶托（沃尔西尼伊旧城）'],['pleiades:413377','贝托纳（韦托纳）'],
 ['pleiades:413381','马特里努斯村'],['pleiades:413386','维森蒂乌姆（比森齐奥）'],['pleiades:422836','安泰姆纳埃'],
 ['pleiades:422886','卡斯特里莫埃尼乌姆（马里诺）'],['pleiades:423115','瓦里亚（维科瓦罗）'],['pleiades:236642','萨拉曼卡（萨尔曼蒂卡）'],
 ['pleiades:246369','托尔托萨（代尔托萨）'],['pleiades:903104','拉伊（拉加埃/雷伊）'],['pleiades:108844','博韦（凯撒罗马古斯）'],
 ['pleiades:108865','卡塞尔（梅纳皮乌姆堡）'],['pleiades:108908','海尔伦（科里奥瓦卢姆）'],['pleiades:108945','兰斯（杜罗科托鲁姆）'],
 ['pleiades:118569','阿奎莱亚'],
 // Wave-14: Full Pleiades ref === 12 completion (200 sites -> 100% of Pleiades ref >= 12) + Asia Silk Road landmarks
 ['pleiades:266022','萨拉里亚（乌韦达）'],['pleiades:266036','塞戈布里加'],['pleiades:275696','萨拉（舍拉）'],
 ['pleiades:295253','基西'],['pleiades:305030','蒂比利温泉城'],['pleiades:157812','安蒂波利斯（昂蒂布）'],
 ['pleiades:912845','埃里都'],['pleiades:363954','迪格迪达'],['pleiades:383542','阿凯赖（波河谷）'],
 ['pleiades:383677','因杜斯特里亚（博丁科马古姆）'],['pleiades:383791','塔内图姆'],['pleiades:383809','瓦尔达加特'],
 ['pleiades:393404','克拉西斯（拉文纳港）'],['pleiades:393425','高卢人广场城'],['pleiades:393436','阿德里亚（阿特里亚）'],
 ['pleiades:393503','塔尔维西乌姆（特雷维索）'],['pleiades:570040','埃盖（阿哈伊亚）'],['pleiades:570323','卡拉迈（卡拉马塔）'],
 ['pleiades:844879','克劳迪奥波利斯（比提尼翁/博卢）'],['pleiades:844994','克罗姆纳'],['pleiades:854695','凯波伊'],
 ['pleiades:854715','宁法伊翁'],['pleiades:619267','塔维乌姆'],['pleiades:629040','梅利泰内（马拉蒂亚）'],
 ['pleiades:638733','阿达达'],['pleiades:639105','锡德'],['pleiades:639166','克桑托斯'],
 ['pleiades:857382','泽拉'],['pleiades:216899','诺瓦埃'],['pleiades:216900','诺维奥杜努姆（伊萨克恰）'],
 ['pleiades:226658','凯尔基尼提斯'],['pleiades:305111','穆斯卢比乌姆'],['pleiades:305166','图布尔西库姆'],
 ['pleiades:305171','图布苏克图'],['pleiades:314892','克利佩阿（阿斯皮斯）'],['pleiades:315207','蒂格尼卡'],
 ['pleiades:678301','尼亚波利斯（纳布卢斯）'],['pleiades:678401','滨海凯撒利亚'],['pleiades:687953','卢德（迪奥斯波利斯）'],
 ['pleiades:69471','奥古斯托杜鲁姆（巴约）'],['pleiades:69518','阿夫朗什（因格纳）'],['pleiades:69585','沃尔吉乌姆（卡赖）'],
 ['pleiades:707462','阿马图斯'],['pleiades:707555','拉佩托斯'],['pleiades:707617','萨拉米斯（塞浦路斯）'],
 ['pleiades:716525','安蒂皮尔戈斯（图卜鲁格）'],['pleiades:716656','济格里斯'],['pleiades:727101','克利斯马（苏伊士）'],
 ['pleiades:727121','塞特罗埃（小赫拉克勒波利斯）'],['pleiades:570371','科罗内'],['pleiades:570385','克罗凯艾'],
 ['pleiades:737072','特布蒂尼斯'],['pleiades:756635','赫尔米乌托勒迈伊斯'],['pleiades:589767','德雷罗斯'],
 ['pleiades:589824','伊塔诺斯'],['pleiades:589899','拉托'],['pleiades:589922','马利亚（米诺斯遗址）'],
 ['pleiades:590097','扎戈拉'],['pleiades:59677','亚历山大港（信德）'],['pleiades:59694','阿拉科西亚亚历山大城'],
 ['pleiades:599625','格尔加'],['pleiades:599809','米拉萨'],['pleiades:599832','尼萨（阿廷布拉）'],
 ['pleiades:550633','凯布伦'],['pleiades:550678','兰波尼亚'],['pleiades:550683','布伦丘克（拉里萨）'],
 ['pleiades:432617','阿贝拉（阿韦拉）'],['pleiades:432621','阿凯赖（坎帕尼亚）'],['pleiades:432727','布卡'],
 ['pleiades:432760','卡尔西奥利'],['pleiades:432776','凯雷阿泰（马里乌斯村）'],['pleiades:432843','波皮利乌斯广场城（坎帕尼亚）'],
 ['pleiades:432963','切尔凯马焦雷萨拉切诺山遗址'],['pleiades:442436','阿凯伦蒂亚（阿切伦扎）'],['pleiades:442502','巴斯塔'],
 ['pleiades:442586','波皮利广场城（波拉）'],['pleiades:540659','阿尔古拉'],['pleiades:540792','贡福伊'],
 ['pleiades:540861','凯林托斯'],['pleiades:540867','基耶里翁'],['pleiades:540868','基拉'],
 ['pleiades:540908','莱东'],['pleiades:540916','林奈翁'],['pleiades:541004','旧法萨卢斯'],
 ['pleiades:541085','里祖斯'],['pleiades:541152','蒂托雷亚（内翁）'],['pleiades:541174','克西尼艾'],
 ['pleiades:550401','阿基莱翁（特洛阿斯）'],['pleiades:550435','安蒂萨'],['pleiades:857024','阿米索斯（萨姆松）'],
 ['pleiades:857107','狄奥斯库里亚斯（塞巴斯托波利斯）'],['pleiades:857120','尤凯塔'],['pleiades:462267','卡莱阿克泰'],
 ['pleiades:648783','锡耶德拉'],['pleiades:658410','提尔巴尔西普（贝尔西巴）'],['pleiades:442816','特吉亚努姆（泰贾诺）'],
 ['pleiades:786079','翁博斯（考姆翁布）'],['pleiades:79364','凯撒罗马古斯（切尔姆斯福德）'],['pleiades:79399','孔布雷托维乌姆'],
 ['pleiades:79534','伊斯哈利斯'],['pleiades:79590','马穆基乌姆（曼彻斯特古堡）'],['pleiades:805634','纳帕塔'],
 ['pleiades:825397','塔奈斯'],['pleiades:59993','普什卡拉瓦蒂（佩乌凯拉奥提斯）'],['pleiades:609293','阿克莫尼亚'],
 ['pleiades:609473','米代翁'],['pleiades:334632','塔布德奥斯'],['pleiades:334669','扎赖'],
 ['pleiades:344380','吉格蒂斯'],['pleiades:344439','梅宁克斯（杰尔巴）'],['pleiades:570420','莱凯翁'],
 ['pleiades:570463','马塞斯'],['pleiades:570484','梅蒂德里翁'],['pleiades:570527','奥伊蒂洛斯'],
 ['pleiades:570535','奥尔霍梅诺斯（阿卡迪亚）'],['pleiades:570575','佩拉纳'],['pleiades:570629','普拉西艾（拉科尼亚）'],
 ['pleiades:570702','泰纳隆'],['pleiades:570708','迪麦翁要塞'],['pleiades:570714','特乌特罗内'],
 ['pleiades:580090','普拉西亚（阿提卡）'],['pleiades:580123','蒂迈塔代'],['pleiades:462201','厄律克斯（埃里切）'],
 ['pleiades:256235','尤利娅特拉杜克塔'],['pleiades:256325','内尔托布里加'],['pleiades:256503','乌尔索（奥苏纳）'],
 ['pleiades:511151','伦达库斯畔阿波罗尼亚'],['pleiades:531034','帕莱罗斯'],['pleiades:531039','潘多西亚（伊庇鲁斯）'],
 ['pleiades:481939','奥里库姆'],['pleiades:481986','斯库台（斯科德拉）'],['pleiades:481987','斯库皮（斯科普里）'],
 ['pleiades:491525','阿菲蒂斯'],['pleiades:167649','阿夸塞格泰'],['pleiades:167855','诺约马古斯'],
 ['pleiades:491595','欧罗波斯（马其顿）'],['pleiades:491647','基罗斯（马其顿）'],['pleiades:491701','波提代亚（卡桑德里亚）'],
 ['pleiades:491703','彼得纳'],['pleiades:501393','达尔达诺斯'],['pleiades:501556','佩尔科特'],
 ['pleiades:501613','辛戈斯'],['pleiades:501616','塞雷斯（西拉）'],['pleiades:501628','斯特律墨'],
 ['pleiades:501649','图拉真波利斯（色雷斯）'],['pleiades:324803','鲁斯皮纳'],['pleiades:177514','埃布罗杜努姆（伊韦尔东）'],
 ['pleiades:177565','洛桑（卢松纳）'],['pleiades:187516','彭斯阿埃尼'],['pleiades:187561','苏布拉维奥内'],
 ['pleiades:197184','布尔努姆'],['pleiades:197350','莱乌萨巴'],['pleiades:197400','纳罗纳'],
 ['pleiades:197401','瑙波尔图斯'],['pleiades:197446','波埃托维奥（普图伊）'],['pleiades:771100776','古尔尼亚'],
 ['pleiades:874324','泰拉（君士坦提亚）'],['pleiades:874354','阿尔萨莫萨塔'],['pleiades:874681','萨尔德巴尔（泽尔泽万）'],
 ['pleiades:971746','德拉普萨卡'],['pleiades:677992','阿比拉（德卡波利斯）'],['pleiades:138192','阿尔让托马古斯'],
 ['pleiades:138329','卡奥尔（迪沃纳）'],['pleiades:138422','普瓦捷（利莫努姆）'],['pleiades:138496','诺维奥雷古姆'],
 ['pleiades:138579','罗德兹（塞戈杜努姆）'],['pleiades:255950','阿基尼波（旧龙达）'],['pleiades:207304','纳波卡（克卢日-纳波卡）'],
 ['pleiades:216688','阿布里图斯'],['pleiades:138606','巴尔藏（高卢罗马遗址）'],['pleiades:403269','萨莱布罗'],
 ['pleiades:413073','新堡（皮凯努姆）'],['pleiades:413186','米尼奥内河畔卢尼'],['pleiades:413194','马尔塔努姆'],
 ['pleiades:413233','奥尔克拉（诺尔基亚）'],['pleiades:413256','佩萨罗（皮萨乌鲁姆）'],['pleiades:413272','波滕蒂亚（皮凯努姆）'],
 ['pleiades:413355','图菲库姆'],['pleiades:413366','乌尔比诺（乌尔维努姆）'],['pleiades:422857','卡布姆'],
 ['pleiades:422910','科尔尼库卢姆'],['pleiades:236405','卡帕拉（卡佩拉）'],['pleiades:246321','凯尔萨'],
 ['pleiades:246383','昂塞律讷'],['pleiades:246433','埃尔讷（埃莱纳）'],['pleiades:874735','布拉克丘（纳加尔）'],
 ['pleiades:89234','卡莱尔（卢古瓦利乌姆）'],['pleiades:89303','特拉普兰劳'],['pleiades:893991','杜尔-卡特利穆'],
 ['pleiades:894019','尼姆鲁德（卡拉赫）'],['pleiades:894082','萨迈拉'],['pleiades:108772','苏瓦松（奥古斯塔·苏埃西奥努姆）'],
 ['pleiades:108778','沙特尔（奥特里库姆）'],['pleiades:108820','沃尔姆斯（博尔贝托马古斯）'],['pleiades:108903','科布伦茨（汇流城）'],
 ['pleiades:109062','伊科里吉乌姆'],['pleiades:109205','尼达（黑登海姆）'],['pleiades:109236','勒芒（苏布丁努姆）'],
 ['pleiades:109398','图尔奈（图尔纳库姆）'],['pleiades:118542','阿德卢纳姆'],
 ['pleiades:59737','巴里加扎'],['pleiades:59668','迦毕试亚历山大城'],['pleiades:59740','巴齐拉'],
 ['pleiades:59987','帕塔拉'],['pleiades:49939','普哈尔（迦维里港）'],['pleiades:50168','那伽帕蒂南'],
 ['pleiades:480040249','巴乌泰尔纳'],['pleiades:59873','憍赏弥'],['pleiades:59897','石塔（塔什库尔干）'],
 ['pleiades:60079','耽摩栗底'],['pleiades:119192778','马哈巴利普拉姆'],['pleiades:762205391','布哈拉'],
 ['pleiades:59945','沙赫里萨布兹'],['pleiades:971878','苏尔赫科塔尔'],['pleiades:961969','蒂利亚丘（黄金丘）'],
 ['pleiades:961963','萨拉赫斯'],['pleiades:59781','居鲁士城（锡尔河）'],['pleiades:377547413','焚毁之城遗址'],
 ['pleiades:839190400','甘吉布勒姆'],['pleiades:971696','阿奥尔诺斯'],['pleiades:59947','尼凯亚（兴都库什）'],
 ['pleiades:59933','明纳加拉'],
 ['pleiades:442679','塞里科山城'],['pleiades:119011','温格丹肯'],
 ['pleiades:48210385','中世纪博尔戈'],['pleiades:303732808','蒙特里焦尼'],
 // Wave-15: Full Pleiades ref === 11 completion (224 sites -> 100% of Pleiades ref >= 11)
 ['pleiades:265960','马翁（马戈）'],['pleiades:266043','西萨波'],['pleiades:266090','瓦伦蒂亚（瓦伦西亚）'],
 ['pleiades:275732','塔穆达'],['pleiades:295219','阿尔森纳里亚'],['pleiades:295228','比达'],
 ['pleiades:295332','鲁西皮西尔'],['pleiades:295359','蒂吉西'],['pleiades:305024','萨瓦自治市'],
 ['pleiades:148036','卡庞特拉（卡尔庞托拉特）'],['pleiades:148056','贝济耶（巴埃泰赖）'],['pleiades:148107','拉塔拉'],
 ['pleiades:148222','于泽斯（乌凯提亚）'],['pleiades:157868','摩纳哥（赫拉克勒斯·莫诺伊科斯港）'],['pleiades:354115','加拉马大城'],
 ['pleiades:363951','卡拉克斯（伊斯希纳）'],['pleiades:373868','帕利乌罗斯'],['pleiades:39279','奥凯利斯（阿基拉）'],
 ['pleiades:393414','耶索洛（埃奎卢姆）'],['pleiades:39379','马里卜（马里亚巴）'],['pleiades:550787','奥弗律内翁'],
 ['pleiades:550822','非拉铁非（吕底亚）'],['pleiades:550908','泰姆诺斯'],['pleiades:570058','阿克里艾'],
 ['pleiades:570125','阿西内（科罗尼）'],['pleiades:570151','贝尔米纳'],['pleiades:570166','迪亚科普托城堡遗址'],
 ['pleiades:570257','格内西翁'],['pleiades:570287','赫拉亚'],['pleiades:689046103','罗伊阿泰'],
 ['pleiades:83868','莫里杜努姆（阿克斯明斯特）'],['pleiades:844852','埃吉亚洛斯'],['pleiades:845049','普鲁西亚斯（希皮乌姆畔）'],
 ['pleiades:854696','辛梅里孔'],['pleiades:854710','米尔梅基翁'],['pleiades:854745','蒂里塔凯'],
 ['pleiades:757208100','济古里埃斯'],['pleiades:619153','埃科布里加'],['pleiades:638804','基比拉'],
 ['pleiades:638891','卡林达'],['pleiades:638933','科拉凯西翁（阿拉尼亚）'],['pleiades:638961','利米拉'],
 ['pleiades:639013','奥伊诺安达'],['pleiades:639137','特尔梅索斯'],['pleiades:236321','埃米尼乌姆（科英布拉）'],
 ['pleiades:305095','吉杰勒（伊吉尔吉利）'],['pleiades:314894','奥诺巴里'],['pleiades:314908','比西卡'],
 ['pleiades:315041','霍雷阿·卡埃利亚'],['pleiades:315121','普普特'],['pleiades:687887','阿夫达特（埃博达）'],
 ['pleiades:687890','埃卢萨'],['pleiades:687902','加沙'],['pleiades:687988','内萨纳'],
 ['pleiades:69507','法努姆·马尔蒂斯（科尔瑟勒）'],['pleiades:69540','利雪（诺维奥马古斯）'],['pleiades:570398','基凡塔'],
 ['pleiades:727241','大塔波西里斯'],['pleiades:727256','克索伊斯'],['pleiades:737053','索克诺帕伊乌·内索斯'],
 ['pleiades:746716','胡迈马（奥阿拉）'],['pleiades:756512','阿拜多斯（埃及）'],['pleiades:756593','莱科波利斯（艾斯尤特）'],
 ['pleiades:589710','阿尔卡德斯'],['pleiades:589870','基萨莫斯'],['pleiades:589886','基多尼亚（干尼亚）'],
 ['pleiades:589914','利索斯（克里特）'],['pleiades:590073','蒂诺斯城'],['pleiades:590084','蒂利索斯'],
 ['pleiades:590095','阿克索斯'],['pleiades:599489','阿米宗'],['pleiades:599626','格劳凯'],
 ['pleiades:599640','拉特莫斯赫拉克勒亚'],['pleiades:599707','凯拉莫斯'],['pleiades:599728','科斯城'],
 ['pleiades:25078867','阿尔斯兰特佩（麦利德）'],['pleiades:432723','博斯科雷阿莱'],['pleiades:432763','卡西利努姆'],
 ['pleiades:432887','尤瓦努姆'],['pleiades:433187','韦鲁莱（韦罗利）'],['pleiades:442435','阿凯罗尼亚'],
 ['pleiades:442516','凯利亚（阿普利亚）'],['pleiades:442552','科帕·内维加塔'],['pleiades:540599','阿格里尼翁'],
 ['pleiades:540629','安菲克莱亚'],['pleiades:540681','迪亚德斯雅典城'],['pleiades:540711','霍尔西艾'],
 ['pleiades:540730','德米特里阿斯（马格尼西亚）'],['pleiades:540784','欧律梅奈'],['pleiades:540787','欧特雷西斯'],
 ['pleiades:540828','希普尼亚'],['pleiades:540829','希波哈尔基斯'],['pleiades:540830','希里亚'],
 ['pleiades:540889','克里萨'],['pleiades:540905','拉里萨'],['pleiades:540927','马基内亚'],
 ['pleiades:541034','法拉拉'],['pleiades:541102','西法伊'],['pleiades:541107','斯科图萨（色萨利）'],
 ['pleiades:550463','阿索斯'],['pleiades:550533','埃雷索斯'],['pleiades:857128','加迪隆'],
 ['pleiades:857200','科蒂奥拉（奥尔杜）'],['pleiades:462381','米蒂斯特拉通'],['pleiades:462399','翁法凯'],
 ['pleiades:462423','菲洛索菲亚纳'],['pleiades:648650','伊奥塔佩'],['pleiades:658391','宁法伊奥斯阿尔萨梅亚'],
 ['pleiades:658405','巴特奈'],['pleiades:658480','希拉波利斯（叙利亚/曼比季）'],['pleiades:442801','索莱图姆'],
 ['pleiades:442849','韦斯克利乌姆'],['pleiades:452293','汉尼拔营垒城'],['pleiades:452308','科森扎（孔森蒂亚）'],
 ['pleiades:462097','阿波罗尼亚（西西里）'],['pleiades:462144','拉古萨卡斯蒂廖内'],['pleiades:786037','希拉孔波利斯（内肯）'],
 ['pleiades:786069','米奥斯·霍尔莫斯（库塞尔）'],['pleiades:79283','阿德·安萨姆'],['pleiades:79373','卡诺尼乌姆'],
 ['pleiades:79393','卡穆洛杜努姆（科尔切斯特）'],['pleiades:79435','杜罗科尔诺维乌姆'],['pleiades:795846','普塞尔希斯（达卡）'],
 ['pleiades:79622','奇切斯特（诺维奥马古斯）'],['pleiades:79623','诺维奥马古斯（不列颠）'],['pleiades:79638','彭诺克鲁基乌姆'],
 ['pleiades:79734','文塔（温彻斯特前身）'],['pleiades:79740','温多克拉迪亚'],['pleiades:805647','卡瓦（努比亚）'],
 ['pleiades:599969','泰安格拉'],['pleiades:609378','欧卡尔皮亚'],['pleiades:609447','拉加尼亚（阿纳斯塔修波利斯）'],
 ['pleiades:344341','加达梅斯（基达穆斯）'],['pleiades:344459','皮西达'],['pleiades:570438','卢索伊'],
 ['pleiades:570444','利科苏拉'],['pleiades:570508','尼萨亚'],['pleiades:570510','诺纳克里斯'],
 ['pleiades:570638','普索菲斯'],['pleiades:570642','皮里霍斯'],['pleiades:579858','阿洛佩凯'],
 ['pleiades:579870','上安基莱'],['pleiades:579876','阿拉芬'],['pleiades:579912','迪奥梅亚'],
 ['pleiades:579915','埃雷西代'],['pleiades:579916','埃泰亚'],['pleiades:579985','科洛诺斯'],
 ['pleiades:580091','普罗巴林托斯'],['pleiades:580125','特里科林托斯'],['pleiades:462187','德雷帕努姆（特拉帕尼）'],
 ['pleiades:256230','伊尔尼'],['pleiades:256322','纳布里萨'],['pleiades:475092090','奥维耶多'],
 ['pleiades:511404','萨尔米德索斯'],['pleiades:530787','埃吉尼翁'],['pleiades:530878','吉塔纳'],
 ['pleiades:530885','哈德良波利斯（伊庇鲁斯）'],['pleiades:531074','普罗诺伊'],['pleiades:481750','发罗拉（奥隆）'],
 ['pleiades:481931','乌尔齐尼（奥尔基尼乌姆）'],['pleiades:482008','斯图贝拉'],['pleiades:491705','皮蒂翁'],
 ['pleiades:491722','斯科图萨（马其顿）'],['pleiades:501515','门德'],['pleiades:419508714','德黑兰'],
 ['pleiades:334576','莱梅莱夫'],['pleiades:324653','阿霍拉'],['pleiades:324664','阿尔蒂布罗斯'],
 ['pleiades:324669','阿苏拉斯'],['pleiades:324774','马克塔里斯'],['pleiades:167954','加普（瓦平库姆）'],
 ['pleiades:177427','阿瓦隆（阿巴洛）'],['pleiades:177434','阿莱西亚'],['pleiades:177624','索洛图恩（萨洛杜鲁姆）'],
 ['pleiades:177631','塞戈博迪乌姆'],['pleiades:177639','特内多'],['pleiades:187309','贝代乌姆'],
 ['pleiades:197180','布里盖蒂奥'],['pleiades:197262','埃佩蒂乌姆'],['pleiades:197263','埃皮道鲁姆（察夫塔特）'],
 ['pleiades:197365','马格达伦斯山遗址'],['pleiades:197502','斯卡尔多纳'],['pleiades:874362','阿尔塔梅特（埃德雷米特）'],
 ['pleiades:874448','达鲁金泰'],['pleiades:942329','希萨尔丘（泰佩希萨尔）'],['pleiades:98992','卡尔克里泽（条顿堡遗址）'],
 ['pleiades:668214','拜特龙（博特里斯）'],['pleiades:668262','伊本·哈尼角'],['pleiades:668295','白港（乌加里特港）'],
 ['pleiades:668318','卡利尼库姆（拉卡）'],['pleiades:678025','阿波罗尼亚（阿尔苏夫）'],['pleiades:678224','卡皮托利亚斯'],
 ['pleiades:138203','利摩日（奥古斯托里图姆）'],['pleiades:138459','梅迪奥拉努姆（高卢贝里）'],['pleiades:207100','德罗贝塔'],
 ['pleiades:207447','西尔米乌姆'],['pleiades:216702','安希亚卢斯'],['pleiades:403230','阿切萨湖伊特鲁里亚遗址'],
 ['pleiades:403260','埃尔科莱港'],['pleiades:413082','钦戈利（金古卢姆）'],['pleiades:413093','克卢瓦纳'],
 ['pleiades:413167','赫尔维卢姆'],['pleiades:413227','努凯里亚（翁布里亚）'],['pleiades:413262','皮蒂努姆'],
 ['pleiades:413268','波利马尔蒂乌姆'],['pleiades:423114','瓦尔维肖洛'],['pleiades:236385','布里泰鲁斯山堡'],
 ['pleiades:236443','科宁布里加'],['pleiades:236493','尤利奥布里加'],['pleiades:246279','卡拉古里斯（卡拉奥拉）'],
 ['pleiades:246431','伊莱尔达（莱里达）'],['pleiades:246518','内尔托布里加（塔拉科内西斯）'],['pleiades:246539','奥斯卡（韦斯卡）'],
 ['pleiades:108774','圣康坦（奥古斯塔）'],['pleiades:108775','特鲁瓦（奥古斯托博纳）'],['pleiades:108798','贝达（比特堡）'],
 ['pleiades:108828','布罗科马古斯'],['pleiades:108872','卡图里基斯'],['pleiades:108896','克桑滕（乌尔皮亚·图拉真城）'],
 ['pleiades:109069','利勒博纳（尤利奥博纳）'],['pleiades:109224','施派尔（诺维奥马古斯）'],['pleiades:109317','萨莱蒂奥'],
 ['pleiades:109330','塞格泰温泉（加蒂奈）'],['pleiades:109396','图勒（图卢姆）']
]);
const PLACE_ZH_OVERRIDE=new Map([['chandler:659','开城']]);
const editorialPlaceZh=p=>PLACE_ZH_OVERRIDE.get(p?.id)||((!p?.nameZh&&!p?.nameTimeline?.length&&!p?.datedNames?.length&&!p?.labelEvidence)?(PLACE_ZH_EDITORIAL.get(p?.id)||''):'');
const capitalPolityLabels=p=>p?.kind==='dated-capital'&&CAPITAL_POLITY_FIX.has(p.polityQid)?{...p.polityLabels,...CAPITAL_POLITY_FIX.get(p.polityQid)}:p?.polityLabels;
export const placeName=(p,lang)=>lang==='en'?(p.displayName||p.name):(p.displayNameZh||(p?.kind==='dated-capital'?capitalZh(p):(PLACE_ZH_OVERRIDE.get(p?.id)||p.nameZh||editorialPlaceZh(p)))||p.displayName||p.name);
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
 if(p.observations){const candidates=p.observations.filter(o=>Math.abs(civilYear(o[0])-civilYear(year))<=span&&observationMatchesNamePeriod(p,o[0],year));if(!candidates.length)return null;const o=candidates.reduce((a,b)=>Math.abs(civilYear(b[0])-civilYear(year))<Math.abs(civilYear(a[0])-civilYear(year))?b:a),label=datedPlaceLabel(p,o[0]),zh=PLACE_ZH_OVERRIDE.get(p?.id)||p.nameZh||editorialPlaceZh(p);return {...p,...(zh?{nameZh:zh}:{}),observation:o,displayName:label?.name,displayNameZh:label?.nameZh,labelEvidence:label,rank:2-Math.log10(Math.max(1,o[1]||1))/10};}
 const period=p.periods?.find(([a,b])=>a<=year&&year<=b);if(!period)return null;
 const location=p.locations?.filter(l=>l.periods?.some(([a,b])=>a<=year&&year<=b)).sort((a,b)=>(a.accuracyMeters??Infinity)-(b.accuracyMeters??Infinity))[0];
 if(p.locations&&!location)return null;
 const label=datedPlaceLabel(p,year);
 const zh=p.kind==='dated-capital'?capitalZh(p):(PLACE_ZH_OVERRIDE.get(p?.id)||p.nameZh||editorialPlaceZh(p)),polityLabels=capitalPolityLabels(p);
 return {...p,...(zh?{nameZh:zh}:{}),...(polityLabels?{polityLabels}:{}),displayName:label?.name,displayNameZh:label?.nameZh,labelEvidence:label,coordinates:location?.coordinates||p.coordinates,location,period:location?.periods.find(([a,b])=>a<=year&&year<=b)||period,rank:p.kind==='dated-capital'?0:p.kind==='attested-site'?1:3-(p.referenceCount||0)/100};
}
export function nearestPlaceYear(p,year){
 if(p.observations)return p.observations.reduce((a,b)=>Math.abs(civilYear(b[0])-civilYear(year))<Math.abs(civilYear(a[0])-civilYear(year))?b:a)[0];
 if(p.periods?.length)return p.periods.reduce((best,[a,b])=>{const y=Math.max(a,Math.min(b,year));return Math.abs(civilYear(y)-civilYear(year))<Math.abs(civilYear(best)-civilYear(year))?y:best;},p.periods[0][0]);
 return year;
}
export const normalizePlaceQuery=q=>String(q||'').toLocaleLowerCase().normalize('NFD').replace(/[\p{Diacritic}\s'’‘ʼ‐‑–—-]/gu,'');
const _searchIndexCache=new WeakMap();
const placeSearchEntry=p=>{
 let entry=_searchIndexCache.get(p);
 if(!entry){
  const names=[p.name,p.kind==='dated-capital'?capitalZh(p):(PLACE_ZH_OVERRIDE.get(p?.id)||p.nameZh||editorialPlaceZh(p))].map(normalizePlaceQuery);
  const aliases=[p.otherNames,...[...(p.datedNames||[]),...(p.nameTimeline||[])].flatMap(n=>[n.name,n.nameZh]),...(p.searchAliases||[]),...(p.names||[]).map(n=>n.name)].filter(Boolean).flatMap(n=>String(n).split(/[,;|]/)).map(normalizePlaceQuery);
  entry={names,aliases};
  _searchIndexCache.set(p,entry);
 }
 return entry;
};
export async function searchPlaces(query,year,span=50){
 const q=normalizePlaceQuery(query);if(!q||q.length<2&&!/\p{Script=Han}/u.test(q))return [];
 const scored=[];
 for(const p of await loadPlaces()){
  if(p.kind==='modern-reference'||CAPITAL_DATE_QUARANTINE.has(p.id)||PLACE_COORD_QUARANTINE.has(p.id))continue;
  const {names,aliases}=placeSearchEntry(p);
  const score=names.includes(q)?0:aliases.includes(q)?1:names.some(n=>n.startsWith(q))?2:(names.some(n=>n.includes(q))||aliases.some(n=>n.includes(q)))?3:99;
  if(score<99)scored.push({p,score});
 }
 return scored.sort((a,b)=>Math.max(1,a.score)-Math.max(1,b.score)||Number(!placeAtYear(a.p,year,span))-Number(!placeAtYear(b.p,year,span))||a.score-b.score||Number(a.p.kind!=='dated-capital')-Number(b.p.kind!=='dated-capital')||a.p.name.length-b.p.name.length).slice(0,10).map(x=>x.p);
}
export class PlaceLayer {
 constructor(atlas,{onSelect,onStatus,window=50}={}){this.window=placeWindow(window);this.atlas=atlas;this.map=atlas.map;this.onSelect=onSelect;this.onStatus=onStatus;this.markers=[];this.active=[];this.enabled=true;this.modern=false;this.seq=0;this.year=atlas.year;this.lang=atlas.lang;this.move=()=>this.refresh();this.map.on('resize',this.move);this.setYear(atlas.year,atlas.lang);}
 async setYear(year,lang){
  this.year=year;this.lang=lang;const seq=++this.seq;
  const apply=places=>{
   if(this.atlas.destroyed||seq!==this.seq)return;
   this.active=places.filter(p=>p.kind!=='modern-reference'||this.modern).map(p=>placeAtYear(p,year,this.window)).filter(Boolean).sort((a,b)=>a.rank-b.rank);
   this.refresh();
  };
  try{
   const places=await loadPlaces(this.modern,apply);if(this.atlas.destroyed||seq!==this.seq)return;
   apply(places);this.onStatus?.(places.partial?'partial':'ready',this.active.length);
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
  const textPx=(s,cjk,lat)=>{if(!s)return 0;const str=String(s);let w=0;for(let i=0;i<str.length;i++){const c=str.charCodeAt(i);w+=(c>=0x3400&&c<=0x9FFF)||(c>=0xF900&&c<=0xFAFF)?cjk:lat;}return w;};
  const globeClip=map.getProjection().type==='globe'&&zoom<4.5,rad=Math.PI/180,sinC=globeClip?Math.sin(center.lat*rad):0,cosC=globeClip?Math.cos(center.lat*rad):0;
  const max=Math.min(90,Math.round((zoom-1)*12)),seen=[];
  for(const p of this.active){
   if(this.markers.length>=max)break;
   if(!bounds.contains(p.coordinates))continue;
   const modern=p.kind==='modern-reference';if(modern&&zoom<Math.max(3,(p.minZoom||4)-2))continue;
   if((p.kind==='attested-settlement'||p.kind==='attested-site')&&zoom<3.4)continue;
   if(globeClip){const [lon,lat]=p.coordinates;const dot=sinC*Math.sin(lat*rad)+cosC*Math.cos(lat*rad)*Math.cos((lon-center.lng)*rad);if(dot<.28)continue;}
   const norm=normalizePlaceQuery(placeName(p,'en')||p.name);
   if(norm&&seen.some(s=>s.norm===norm&&Math.abs(s.lon-p.coordinates[0])<.25&&Math.abs(s.lat-p.coordinates[1])<.25))continue;
   const screen=map.project(p.coordinates),name=placeName(p,this.lang),secondary=this.lang==='bi'&&(p.displayNameZh||p.nameZh)?placeName(p,'en'):'';
   const obsText=p.observation?(this.lang==='en'?'Population · ':'人口 · ')+formatYear(p.observation[0],this.lang==='en'?'en':'zh'):'';
   const width=Math.min(184,Math.max(textPx(name,12.8,7.4),textPx(secondary,11,6.4),textPx(obsText,11.2,6.3))+34),height=(secondary?48:34)+(obsText?15:0);
   // A record that exists in the data should still be visible and clickable when its
   // label cannot be placed. Try right, left, below, above (and pin-cleared vertical
   // below/above without duplicating a co-located dot), before falling back to dot alone.
   const fits=candidate=>candidate.left>=origin.left+10&&candidate.right<=origin.right-12&&candidate.top>=origin.top+12&&candidate.bottom<=origin.bottom-52&&!boxes.some(b=>overlap(candidate,b));
   const vw=Math.min(width,168),vh=height+14;
   const labelBox=side=>side==='right'
    ?{left:origin.left+screen.x-12,right:origin.left+screen.x+width,top:origin.top+screen.y-height/2,bottom:origin.top+screen.y+height/2}
    :side==='left'
     ?{left:origin.left+screen.x-width+12,right:origin.left+screen.x+12,top:origin.top+screen.y-height/2,bottom:origin.top+screen.y+height/2}
     :side==='below'
      ?{left:origin.left+screen.x-vw/2,right:origin.left+screen.x+vw/2,top:origin.top+screen.y-4,bottom:origin.top+screen.y+vh}
      :side==='above'
       ?{left:origin.left+screen.x-vw/2,right:origin.left+screen.x+vw/2,top:origin.top+screen.y-vh,bottom:origin.top+screen.y+4}
       :side==='below-clear'
        ?{left:origin.left+screen.x-vw/2,right:origin.left+screen.x+vw/2,top:origin.top+screen.y+14,bottom:origin.top+screen.y+14+height}
        :{left:origin.left+screen.x-vw/2,right:origin.left+screen.x+vw/2,top:origin.top+screen.y-14-height,bottom:origin.top+screen.y-14};
   const dotBox={left:origin.left+screen.x-7,right:origin.left+screen.x+7,top:origin.top+screen.y-7,bottom:origin.top+screen.y+7};
   let box=null,side='right',dotOnly=false,noDot=false;
   for(const [candidate,place]of [[labelBox('right'),'right'],[labelBox('left'),'left'],[labelBox('below'),'below'],[labelBox('above'),'above'],[labelBox('below-clear'),'below-clear'],[labelBox('above-clear'),'above-clear'],[dotBox,'dot']]){
    if(!fits(candidate))continue;
    box=candidate;dotOnly=place==='dot';noDot=place.endsWith('-clear');side=dotOnly?'right':place.replace('-clear','');break;
   }
   if(!box)continue;
   if(norm)seen.push({norm,lon:p.coordinates[0],lat:p.coordinates[1]});
   boxes.push({...box,left:box.left-8,right:box.right+8,top:box.top-5,bottom:box.bottom+5});
   const el=document.createElement('button');el.className='place-marker '+(modern?'modern':p.kind==='dated-capital'?'capital':'historic')+(dotOnly?' dot-only':'')+(side!=='right'?' label-'+side:'')+(noDot?' no-dot':'');
   const dot=document.createElement('i'),label=document.createElement('span');label.textContent=name;el.append(dot,label);
   if(secondary){const sub=document.createElement('small');sub.textContent=secondary;label.append(sub);}
   if(obsText){const stamp=document.createElement('small');stamp.className='place-date';stamp.textContent=obsText;label.append(stamp);}
   el.title=(modern?(this.lang==='en'?'Modern reference · ':'现代参照 · '):'')+name;el.setAttribute('aria-label',el.title);
   const meta=p.observation?(this.lang==='en'?'Population · ':'人口 · ')+Number(p.observation[1]).toLocaleString()+' · '+formatYear(p.observation[0],this.lang==='en'?'en':'zh'):p.kind==='dated-capital'?(this.lang==='en'?'Historical capital':'历史首都'):modern?(this.lang==='en'?'Present-day reference':'现代参照'):p.period?formatYear(p.period[0],this.lang==='en'?'en':'zh')+(p.period[1]!==p.period[0]?' — '+formatYear(p.period[1],this.lang==='en'?'en':'zh'):''):'';
   const showHover=()=>{this.atlas.setHoverMarker?.({primary:name,secondary,meta},el.getBoundingClientRect());};
   el.addEventListener('mouseenter',showHover);el.addEventListener('focus',showHover);
   el.addEventListener('mouseleave',()=>this.atlas.setHoverMarker?.(null));el.addEventListener('blur',()=>this.atlas.setHoverMarker?.(null));
   el.onclick=e=>{e.stopPropagation();this.atlas.setHoverMarker?.(null);this.onSelect?.(p,this.atlas);};
   const anchor=dotOnly?'center':side==='left'?'right':side==='below'?'top':side==='above'?'bottom':'left';
   const offset=dotOnly?[0,0]:side==='left'?[5,0]:side==='below'?[0,noDot?14:-3]:side==='above'?[0,noDot?-14:3]:[-5,0];
   this.markers.push(new maplibregl.Marker({element:el,anchor,offset,opacityWhenCovered:'0'}).setLngLat(p.coordinates).addTo(map));
  }
 }
 destroy(){this.seq++;this.atlas.setHoverMarker?.(null);this.selection?.remove();this.map.off('moveend',this.move);this.map.off('resize',this.move);this.markers.forEach(m=>m.remove());}
}
