import {readJSON,formatYear} from './map-engine.js?v=3.99.0-9f4c866cff07';

const BATTLE_ZH_GLOSSARY=new Map([
 ['Canaanites','迦南人'],['Hatti','赫梯'],['ancient Greeks','古希腊各邦'],['Styra','斯蒂拉'],
 ['Aegina','埃吉纳'],['Megara','墨伽拉'],['Chalcis','哈尔基斯'],['Eretria','埃雷特里亚'],
 ['Troezen','特罗曾'],['Mindarus','明达鲁斯'],['Antiochus','安条克'],['Argos','阿尔戈斯'],
 ['Macedonian Empire','马其顿帝国'],['Gaius Sulpicius Paterculus','盖乌斯·苏尔皮基乌斯·帕特尔库鲁斯'],
 ['Chnodomarius','克诺多马里乌斯'],['Olibrones','奥利布罗内斯人'],['Syunik (historic province)','休尼克（历史行省）'],
 ['Auvergnats','奥弗涅人'],['Cadiseni','卡迪塞尼人'],['Bridei III','布里代三世'],
 ['Umayyad Army','倭马亚军队'],['Kingdom of Pamplona','潘普洛纳王国'],['Taifa of Lérida','莱里达泰法'],
 ['Armenian Principality of Cilicia','奇里乞亚亚美尼亚亲王国'],['Ayyubid Sultanate','阿尤布苏丹国'],
 ['Husayn','侯赛因'],['Catholic Monarchy','天主教君主国（西班牙）'],['Kingdom of Calicut','卡利卡特王国'],
 ['Hispanic Monarchy','西班牙君主国'],['Ivan Chelyadnin','伊万·切利亚德宁'],['Empire of Charles V','查理五世帝国'],
 ['Kingdom of Spain','西班牙王国'],['Sharifian Empire','谢里夫帝国（摩洛哥）'],['Al-Dhafir (tribe)','达菲尔部族'],
 ['Shammar','沙马尔部族'],['Conventionists','国民公会派（墨西哥）'],['Korean People’s Revolutionary Army','朝鲜人民革命军'],
 ['Claudius Miller Easley','克劳迪乌斯·米勒·伊斯利'],['Royalist Army of New Spain','新西班牙保皇军'],
 ['Khaled al-Obaidi','哈立德·奥贝迪'],['Hadi Al-Amiri','哈迪·阿米里'],['Shura Council of Mujahideen in Derna','德尔纳圣战者协商会议'],
 ['British India','英属印度'],
 ['First Achaemenid conquest of Egypt','第一次阿契美尼德征服埃及'],['Archidamian War','阿基达穆斯战争'],
 ['Fourth Sacred War','第四次神圣战争'],['Second Samnite War','第二次萨姆尼特战争'],
 ['Second War of the Diadochi','第二次继业者战争'],['Fourth War of the Diadochi','第四次继业者战争'],
 ['Fourth Syrian War','第四次叙利亚战争'],['Early Imperial campaigns in Germania','帝国早期日耳曼尼亚战役'],
 ["Shapur I's Syrio-Mesopotamian campaign",'沙普尔一世叙利亚—美索不达米亚战役'],['Campaigns of Aurelian','奥勒良征战'],
 ['Gothic War of 267–269','267–269年哥特战争'],["Julian's Persian expedition",'尤利安波斯远征'],
 ['Roman civil war of 432','432年罗马内战'],['War of the Vardanants','瓦尔达南茨战争'],
 ['Gothic War of 461–476','461–476年哥特战争'],['Ostrogothic conquest of Italy','东哥特征服意大利'],
 ['Burgundy War','勃艮第战争'],['Muslim–Quraysh War','穆斯林—古莱氏战争'],
 ['Expedition of Charlemagne of 778','778年查理曼远征'],['Almoravid conquest of al-Andalus','穆拉比特征服安达卢斯'],
 ['Crusader battles between 1101 and 1145','1101–1145年十字军战役'],['Anglo-French War','英法战争'],
 ['Byzantine–Pecheneg wars','拜占庭—佩切涅格战争'],['Byzantine–Hungarian War','拜占庭—匈牙利战争'],
 ['Crusader battles between 1149 and 1189','1149–1189年十字军战役'],['Timurid conquests and invasions','帖木儿征战'],
 ['Moroccan–Portuguese conflicts','摩洛哥—葡萄牙冲突'],['Incas in Central Chile','印加中部智利扩张'],
 ['Conquest of Tenerife','特内里费岛征服战'],['Second War of Naples','第二次那不勒斯战争'],
 ['Muscovite-Lithuanian War of 1512-1522','1512–1522年莫斯科—立陶宛战争'],
 ['Italian campaign of 1524–1525','1524–1525年意大利战役'],['Hungarian–Ottoman War','匈牙利—奥斯曼战争'],
 ['Sino-Spanish conflicts','明朝—西班牙冲突'],['Sekigahara Campaign','关原会战'],
 ['Travancore–Dutch War','特拉凡科尔—荷兰战争'],['Second Carnatic War','第二次卡纳提克战争'],
 ['Bengal War','孟加拉战争'],['Flagstaff War','旗杆战争'],['Uruguayan revolution of 1904','1904年乌拉圭革命'],
 ['Operation U-Go','乌号作战（英帕尔战役）'],['Dictatorship of Fulgencio Batista','巴蒂斯塔独裁时期武装冲突'],
 ['Operation Neptune Spear','海神之矛行动'],['Anbar campaign','安巴尔战役'],
 ['Snake Island during the 2022 Russian invasion of Ukraine','2022年俄乌战争蛇岛战役'],
 ['格奈烏斯•霍西迪烏斯•蓋塔','格奈乌斯·霍西迪乌斯·盖塔'],
 ['提圖斯•弗拉維烏斯•薩比努斯','提图斯·弗拉维乌斯·萨比努斯'],
 ['卡拉塔庫斯','卡拉塔库斯'],['謝石','谢石'],['卡倫家族','卡伦家族'],['嚈噠人','嚈哒人'],
 ['收復失地運動','收复失地运动'],['維京人','维京人'],['諾爾斯人在不列顛群島活動','诺尔斯人在不列颠群岛活动'],
 ['諾曼人','诺曼人'],['尼扎里·伊斯瑪儀王朝','尼扎里·伊斯玛仪王朝'],['佐佐木盛綱','佐佐木盛纲'],
 ['陳朝','陈朝'],['瀧川一益','泷川一益'],['井上賴次','井上赖次'],['德蘭特','德兰特'],
 ['圖皮 - 瓜拉尼人','图皮—瓜拉尼人'],['新法蘭西','新法兰西'],['埃及遠征','埃及远征'],
 ['南圻遠征','南圻远征'],['北圻遠征','北圻远征'],['西班牙波旁王朝復辟','西班牙波旁王朝复辟'],
 ['關麟徵','关麟征'],['哈斯本·金梅爾','哈斯本·金梅尔'],['二七部隊','二七部队'],['阮文舉','阮文举'],
 ['上帝之怒行動','上帝之怒行动'],['人民保護部隊','人民保护部队'],['緬甸内战','缅甸内战'],
 ['民族團結政府','民族团结政府'],['拉卡攻勢','拉卡攻势'],['2019年印巴對峙','2019年印巴对峙'],
 ['2020年9月納戈爾諾－卡拉巴赫衝突','2020年9月纳戈尔诺—卡拉巴赫冲突'],
 ['2021年塔利班攻勢','2021年塔利班攻势'],['聖城旅','圣城旅'],['Thespiae城','忒斯皮埃']
]);
const BATTLE_ZH_NAME=new Map([
 ['Mons Algidus战役','阿尔吉杜斯山战役'],
 ['斯文达克斯战役（Battle of Svindax）','斯文达克斯战役'],
 ['Haram战役','哈拉姆战役'],
 ['Broome轟炸','空袭布鲁姆'],
 ['越灭吴之战#笠泽之战','笠泽之战'],
 ['巴比倫陷落','巴比伦陷落'],['安條克之役','安条克之役'],['圍攻赫拉特','围攻赫拉特'],
 ['西維泰特之役','西维泰特之役'],['圍攻巴米揚','围攻巴米扬'],['切里尼奧拉战役','切里尼奥拉战役'],
 ['圍攻迪烏','围攻迪乌'],['迪爾菲爾德大屠殺','突袭迪尔菲尔德'],['白沙嶺事件','白沙岭事件'],
 ['鎮南關之役','镇南关之役'],['北欖事件','北榄事件'],['佔領關島','占领关岛'],
 ['法奧大登陸','法奥大登陆'],['冬季行動（1914-1915）','冬季行动（1914—1915）'],['內里事件','内里事件'],
 ['突擊雪梨港','突袭悉尼港'],['可倫坡復活節空襲','科伦坡复活节空袭'],['戳刺行動','戳刺行动'],
 ['托洛基納海角登陸','托洛基纳海角登陆'],['轟炸吉隆坡 (1945年)','吉隆坡轰炸（1945年）'],
 ['突襲洛斯巴尼奧斯拘留營','突袭洛斯巴尼奥斯拘留营'],['烏牛欄之役','乌牛栏之役'],['布爾基戰役','布尔基战役'],
 ['駝峰行動','驼峰行动'],['青春之泉行動','青春之泉行动'],['嬰兒空運行動事故','婴儿空运行动事故'],
 ['333風暴行動','333风暴行动'],['被阿根廷空襲','布拉夫湾空袭战'],['藍星行動','蓝星行动'],
 ['美格朵行動','美格朵行动'],['巴格达战爭','巴格达战争'],['進攻沙阿·瓦利噶','进攻沙阿·瓦利噶'],
 ['2012年9月巴斯申營地遇襲事件','2012年9月巴斯申营地遇袭事件'],['三寶顏危機','三宝颜危机'],
 ['2013年印度-巴基斯坦邊境衝突','2013年印巴边境冲突'],['圍攻斯拉維揚斯克','围攻斯拉维扬斯克'],
 ['昆都士醫院空襲事件','昆都士医院空袭事件'],['利劍行動','利剑行动'],['橄欖枝行動','橄榄枝行动'],
 ['奧里希夫战役','奥里希夫战役'],['攻佔喀布爾','攻占喀布尔'],['霍爾利夫卡攻勢','霍尔利夫卡攻势'],
 ['德納號巡防艦沉沒','德纳号护卫舰沉没']
]);
const IGNORED_BATTLE_LABELS=new Set(['艾連·葉卡','Eren Yeager']);
export function battleName(battle,lang='bi'){
 const rawZh=typeof battle?.nameZh==='string'?battle.nameZh.trim():'',zh=BATTLE_ZH_NAME.get(rawZh)||rawZh;
 const en=typeof battle?.nameEn==='string'?battle.nameEn.trim():'';
 return lang==='en'?(en||zh||battle?.id||''):(zh||en||battle?.id||'');
}
export function battleLabels(zhArr,enArr,lang='bi'){
 const raw=lang==='en'?(enArr?.length?enArr:zhArr):(zhArr?.length?zhArr:enArr);
 const list=(Array.isArray(raw)?raw:raw?[raw]:[]).filter(v=>v&&!IGNORED_BATTLE_LABELS.has(v)&&!/^Q\d+$/.test(v));
 if(lang==='en')return list;
 return list.map(v=>BATTLE_ZH_GLOSSARY.get(v)||v);
}

// Battles are a dated point layer, not a boundary layer. Every record keeps the
// source entity it came from; outcome is deliberately absent because the upstream
// dataset has no stable property for it, and an invented winner would be worse
// than no winner at all.
export async function loadBattles(){const data=await readJSON('data/battles.json.gz');return Array.isArray(data?.battles)?data.battles:[];}

export class BattleLayer{
 constructor(atlas,{window=50,onSelect,onStatus,enabled=true}={}){
  this.atlas=atlas;this.map=atlas.map;this.window=window;this.onSelect=onSelect;this.onStatus=onStatus;
  this.enabled=enabled;this.year=atlas.year;this.lang=atlas.lang;this.markers=[];this.active=[];this.all=null;this.seq=0;
  this.move=()=>this.refresh();this.map.on('moveend',this.move);
 }
 async setYear(year,lang){
  this.year=year;this.lang=lang;const seq=++this.seq;
  try{
   if(!this.all)this.all=await loadBattles();
   if(this.atlas.destroyed||seq!==this.seq)return;
   this.active=this.all.filter(b=>b.year!=null&&Math.abs(b.year-year)<=this.window).sort((a,b)=>Math.abs(a.year-year)-Math.abs(b.year-year));
   this.refresh();this.onStatus?.('ready',this.active.length);
  }catch{if(seq===this.seq)this.onStatus?.('error',0);}
 }
 setWindow(value){this.window=value;return this.setYear(this.year,this.lang);}
 toggle(v){this.enabled=v;this.refresh();}
 refresh(){
  this.markers.forEach(m=>m.remove());this.markers=[];if(!this.enabled||this.atlas.destroyed||!this.year)return;
  const map=this.map,zoom=map.getZoom();if(zoom<3||this.atlas.regional?.detailedActive)return;
  const bounds=map.getBounds(),origin=map.getContainer().getBoundingClientRect(),center=map.getCenter(),max=Math.min(60,Math.round((zoom-2)*10)),boxes=[...(this.atlas.labelBoxes||[]),...(this.atlas.overlayBlockerBoxes?.('.map-legend,.place-marker:not(.dot-only)')||[])];
  const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  const textWidth=s=>Array.from(String(s||'')).reduce((w,ch)=>w+(/[\u3400-\u9fff\uF900-\uFAFF]/.test(ch)?12.4:7.2),0);
  for(const battle of this.active){
   if(this.markers.length>=max)break;
   const [lon,lat]=battle.coordinates||[];if(!Number.isFinite(lon)||!Number.isFinite(lat))continue;
   if(map.getProjection().type==='globe'&&zoom<4.5){const rad=Math.PI/180;const dot=Math.sin(center.lat*rad)*Math.sin(lat*rad)+Math.cos(center.lat*rad)*Math.cos(lat*rad)*Math.cos((lon-center.lng)*rad);if(dot<.28)continue;}
   if(!bounds.contains([lon,lat]))continue;
   const screen=map.project([lon,lat]),el=document.createElement('button');
   el.className='battle-marker';el.type='button';
   el.title=this.name(battle)+' · '+formatYear(battle.year,this.lang==='en'?'en':'zh');
   el.setAttribute('aria-label',el.title);
   const icon=document.createElement('i');el.append(icon);
   const titleText=this.name(battle);
   if(zoom>=6.5){const label=document.createElement('span');label.textContent=titleText;el.append(label);}
   const w=zoom>=6.5?Math.min(180,textWidth(titleText)+32):18,h=zoom>=6.5?24:18;
   const box={left:origin.left+screen.x-w/2,right:origin.left+screen.x+w/2,top:origin.top+screen.y-h/2,bottom:origin.top+screen.y+h/2};
   if(box.left<origin.left+8||box.right>origin.right-10||box.top<origin.top+10||box.bottom>origin.bottom-48||boxes.some(b=>overlap(box,b)))continue;
   boxes.push({...box,left:box.left-7,right:box.right+7,top:box.top-4,bottom:box.bottom+4});
   const zhTitle=battleName(battle,'zh'),secondary=this.lang!=='en'&&zhTitle&&battle.nameEn&&zhTitle!==battle.nameEn?battle.nameEn:'';
   const conflict=battleLabels(battle.conflictZh,battle.conflict,this.lang).join(' · ');
   const meta=formatYear(battle.year,this.lang==='en'?'en':'zh')+(conflict?' · '+conflict:'');
   const showHover=()=>{this.atlas.setHoverMarker?.({primary:this.name(battle),secondary,meta},el.getBoundingClientRect());};
   el.addEventListener('mouseenter',showHover);el.addEventListener('focus',showHover);
   el.addEventListener('mouseleave',()=>this.atlas.setHoverMarker?.(null));el.addEventListener('blur',()=>this.atlas.setHoverMarker?.(null));
   el.onclick=e=>{e.stopPropagation();this.atlas.setHoverMarker?.(null);this.onSelect?.(battle,this.atlas);};
   this.markers.push(new maplibregl.Marker({element:el,anchor:'center',opacityWhenCovered:'0'}).setLngLat([lon,lat]).addTo(map));
  }
 }
 name(battle){return battleName(battle,this.lang);}
 destroy(){this.seq++;this.atlas.setHoverMarker?.(null);this.map.off('moveend',this.move);this.markers.forEach(m=>m.remove());this.markers=[];}
}
