import {decodeLakeArchive} from './lake-codec.js?v=4.01.0-4e5e3216efbd';
// Contemporary lake geometry, separate from dated historical evidence.
const EMPTY_LAKES={type:'FeatureCollection',features:[]};
export const lakeTier=zoom=>zoom>=9?9:zoom>=6?6:zoom>=4?4:0;
export function intersectsLakeBounds(a,b){
 if(a[3]<b[1]||a[1]>b[3])return false;
 // MapLibre bounds can cross the antimeridian or use an unwrapped world copy.
 let east=b[2];while(east<b[0])east+=360;
 if(east-b[0]>=360)return true;
 const shift=Math.floor((b[0]-a[0])/360)*360;
 return [shift,shift+360].some(s=>a[2]+s>=b[0]&&a[0]+s<=east);
}
export function containsLakeBounds(outer,inner){
 if(!outer||inner[1]<outer[1]||inner[3]>outer[3])return false;
 const width=outer[2]-outer[0],innerWidth=inner[2]>=inner[0]?inner[2]-inner[0]:inner[2]+360-inner[0];
 if(width>=360)return true;if(innerWidth>width)return false;
 const shift=Math.ceil((outer[0]-inner[0])/360)*360;
 return inner[0]+shift>=outer[0]&&inner[0]+shift+innerWidth<=outer[2];
}
export function lakeViewport(map){const b=map.getBounds();return [b.getWest(),Math.max(-90,b.getSouth()),b.getEast(),Math.min(90,b.getNorth())];}
export function selectLakeShards(index,bounds,zoom){const tier=lakeTier(zoom);return tier?index.shards.filter(s=>s.minZoom<=tier&&intersectsLakeBounds(s.bbox,bounds)):[];}

// Shared between comparison maps, with failed requests evicted and bounded LRU.
export function decodeLakeFeature(feature){
 const g=feature.geometry;if(g.coordinates)return feature; // audited float fallback
 const polygons=g.deltas.map(polygon=>polygon.map(deltas=>{
  const ring=[];let x=0,y=0;
  for(let i=0;i<deltas.length;i+=2){x+=deltas[i];y+=deltas[i+1];ring.push([x/1e6,y/1e6]);}
  return ring;
 }));
 return {...feature,geometry:{type:g.type,coordinates:g.type==='Polygon'?polygons[0]:polygons}};
}
export class LakeCache {
 constructor(fetchJSON,vertexLimit=800000){this.fetchJSON=fetchJSON;this.limit=vertexLimit;this.entries=new Map();this.vertices=0;}
 async get(meta){
  let entry=this.entries.get(meta.file);
  if(entry){this.entries.delete(meta.file);this.entries.set(meta.file,entry);return entry.promise;}
  entry={vertices:0};this.entries.set(meta.file,entry);
  entry.promise=this.fetchJSON('data/lakes/'+meta.file).then(data=>{
   if(data.encoding!=='delta-1e6'||!Array.isArray(data.features)||data.features.length!==meta.count)throw Error('Invalid lake shard');
   entry.vertices=meta.vertices;this.vertices+=entry.vertices;
   for(const [key,value] of this.entries){if(this.vertices<=this.limit)break;if(value.vertices){this.entries.delete(key);this.vertices-=value.vertices;}}
   return data;
  }).catch(error=>{if(this.entries.get(meta.file)===entry)this.entries.delete(meta.file);throw error;});
  return entry.promise;
 }
}
async function fetchLakeJSON(url){
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),20000);
 try{const r=await fetch(url,{signal:abort.signal,cache:'no-cache'});if(!r.ok)throw Error('Lake archive '+r.status);let bytes=new Uint8Array(await r.arrayBuffer());if(bytes[0]===31&&bytes[1]===139)bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());return url.endsWith('.bin.gz')?decodeLakeArchive(bytes):JSON.parse(new TextDecoder().decode(bytes));}finally{clearTimeout(timer);}
}
const LAKE_ZH=new Map([
 ['Constance','博登湖（康斯坦茨湖）'],['Zurich','苏黎世湖'],['Luzern','卢塞恩湖'],['Neuchatel','纳沙泰尔湖'],
 ['Como','科莫湖'],['Maggiore','马焦雷湖'],['Garda','加尔达湖'],['Trasimeno','特拉西梅诺湖'],['Bolsena','博尔塞纳湖'],
 ['Balaton','巴拉顿湖'],['Neusiedl','新锡德尔湖'],['Ijsselmeer','艾瑟尔湖'],['Chiemsee','基姆湖'],['Starnberger See','施塔恩贝格湖'],
 ['Ohrid','奥赫里德湖'],['Prespa','普雷斯帕湖'],['Scutari','斯库台湖'],['Peipsi','楚德湖（佩普西湖）'],['Ilmen','伊尔门湖'],
 ['Vanern','维纳恩湖'],['Vattern','韦特恩湖'],['Malaren','梅拉伦湖'],['Hjalmaren','耶尔马伦湖'],
 ['Saimaa','塞马湖'],['Paijanne','派延奈湖'],['Inari','伊纳里湖'],['Lomond','洛蒙德湖'],['Ness','尼斯湖'],['Neagh','内伊湖'],
 ['Iznik','伊兹尼克湖'],['Tuz','图兹湖'],['Sevan','塞凡湖'],['Urmia','乌尔米耶湖'],['Tiberias','加利利海（提比里亚湖）'],
 ['Kara-Bogaz-Gol','卡拉博加兹戈尔湾'],['Sarygamysh','萨雷卡梅什湖'],['Aydar','艾达尔库尔湖'],['Tengiz','田吉兹湖'],['Zaysan','斋桑泊'],['Alakol','阿拉湖'],
 ['Khovsgol','库苏古尔湖'],['Uvs','乌布苏湖'],['Hulun','呼伦湖'],['Buir','贝尔湖'],['Khanka','兴凯湖'],
 ['Ulungur','乌伦古湖'],['Ebi','艾比湖'],['Sai li-mu','赛里木湖'],['Bosten','博斯腾湖'],['Wu-liang-su','乌梁素海'],
 ['Qinghai','青海湖'],['Ngoring','鄂陵湖'],['Gyaring','扎陵湖'],['Dongping','东平湖'],['Weishan','微山湖'],['Kaoyu','高邮湖'],
 ['Tai','太湖'],['Poyang','鄱阳湖'],['Siling','色林错'],['Nam','纳木错'],['Zhari Namco','扎日南木错'],
 ['Tangra','当惹雍错'],["Ma-p'ang yung-ts'o",'玛旁雍错'],['La-ang','拉昂错'],['Pangong','班公错'],['Bangong','班公错'],
 ['Inawashiro ko','猪苗代湖'],['Kasumigaura','霞浦'],['Toba','多巴湖'],['Chilika','奇利卡湖'],
 ['Turkana','图尔卡纳湖'],['Albert','艾伯特湖'],['Edward','爱德华湖'],['Kivu','基伍湖'],['Rukwa','鲁夸湖'],['Mweru','姆韦鲁湖'],['Bangweulu','班韦乌卢湖'],['Mai-Ndombe','马伊恩东贝湖'],
 ['Eyre','艾尔湖'],['Torrens','托伦斯湖'],['Great Bear','大熊湖'],['Great Slave','大奴湖'],['Winnipeg','温尼伯湖'],['Winnipegosis','温尼伯戈西斯湖'],['Manitoba','马尼托巴湖'],['Athabasca','阿萨巴斯卡湖'],['Champlain','尚普兰湖'],
 ['Wangen Lachen','苏黎世上湖'],['Kloentalersee','克伦塔尔湖'],['Traunsee','特劳恩湖'],['Iseo','伊塞奥湖'],['Valli di Comacchio','科马基奥泻湖'],['Berre','贝尔泻湖'],['Vaccares','瓦卡雷斯湖'],
 ['Syvash','锡瓦什湖（腐海）'],['Imandra','伊曼德拉湖'],['Vygozero','维戈泽罗湖'],['Iso-Kallan','卡拉维西湖'],['Beloye','白湖（沃洛格达）'],['Taymyr','泰梅尔湖'],['Chany','恰内湖'],['Oulu','奥卢湖'],['Tornetrask','托尔讷湖'],
 ['Khyargas','吉尔吉斯湖（蒙古）'],['Khar Us','哈尔乌苏湖'],['Kaydak','凯达克盐沼'],['Buhayrat ath Tharthar','萨尔萨尔湖'],['Goud-e-Zareh','戈德扎雷盐沼'],
 ['Abaya','阿巴亚湖'],['Kyoga','基奥加湖'],['Eyasi','埃亚西湖'],['Mweru wa Ntipa','姆韦鲁万蒂帕湖'],['Chilwa','奇尔瓦湖'],['Ntwetwe Pan','恩特韦特韦盐沼'],
 ['Great Salt','大盐湖'],['Saint Clair','圣克莱尔湖'],['Pontchartrain','庞恰特雷恩湖'],['Okeechobee','奥基乔比湖'],['Chapala','查帕拉湖'],['Nicaragua','尼加拉瓜湖'],['Managua','马那瓜湖'],
 ['Poopo','波波湖'],['Salinas Grandes','大盐沼（阿根廷）'],['Chiquita','马尔奇基塔湖'],['Mirim','米林泻湖'],['Buenos Aires','布宜诺斯艾利斯湖（卡雷拉将军湖）'],['San Martin','圣马丁湖（奥希金斯湖）'],['Viedma','别德马湖'],['Argentino','阿根廷湖'],
 ['Woods','伍兹湖'],['Nipigon','尼皮贡湖'],['Saint-Jean','圣让湖'],['Mistassini','米斯塔西尼湖'],['Reindeer','驯鹿湖'],['Iliamna','伊利亚姆纳湖'],['Becharof','贝查罗夫湖'],['Lesser Slave','小奴湖'],['La Ronge','拉朗日湖'],['Manicouagan Reservoir','马尼夸根水库'],['Melville','梅尔维尔湖'],['Netilling','内蒂灵湖'],['Amadjuak','阿马朱阿克湖'],['Wollaston','沃拉斯顿湖'],['Dubawnt','杜邦特湖'],['Baker','贝克湖'],
 ['Dongting','洞庭湖'],['Chao','巢湖'],['Dian Chi','滇池'],['Fuxian','抚仙湖'],['Erh','洱海'],['Yamdrok','羊卓雍措'],
 ['P\'u-mo-ts\'o','普莫雍措'],['P\'ei-k\'u t\'so','佩枯措'],['Hoh Xil','可可西里湖'],['Hoh Sai','库赛湖'],['Zonag','卓乃湖'],
 ['Xijir Ulan','西金乌兰湖'],['Dogai Coring','多格错仁'],['Dogaicoring Quang','多格错仁强错'],['Lixi\'Oidain','勒斜武担湖'],
 ['Lumajangdong','鲁玛江东错'],['Gyeze Caka','结则茶卡'],['Migriggyangzham','米格尔姜占错'],['Yaggain Canco','雅岗错'],
 ['Dorge','多尔吉错'],['Donggi Cona','冬给措纳湖'],['Toson','托素湖'],['Dabsan','达布逊湖'],['Bei Hulsan','北霍鲁逊湖'],
 ['Hala','哈拉湖'],['Suhai','苏干湖'],['Gas Hure','尕斯库勒湖'],['Ayakkum','阿牙克库木湖'],['Aqqikkol','阿其克库勒湖'],
 ['Barkol','巴里坤湖'],['Manas','玛纳斯湖'],['Jili','吉力湖'],['Xiaoxihaiz Shuiku','小海子水库'],['Aksayquin','阿克赛钦湖'],
 ['Dalai','达里诺尔'],['Ch\'a-han no-erh','查干诺尔'],['Huang-ch\'i','黄旗海'],['Quagan','查干湖'],['Yueliang Pao','月亮泡'],
 ['Luoma','骆马湖'],['Yangcheng','阳澄湖'],['Nanyi','南漪湖'],['Shijiu','石臼湖'],['Ge','滆湖'],['Chang Dang','长荡湖'],
 ['Wabu','瓦埠湖'],['Chengdong','城东湖'],['Hong','洪湖'],['Liangzi','梁子湖'],['Chang','长湖'],['Futou','斧头湖'],
 ['Daye','大冶湖'],['Zhangdu','涨渡湖'],['Po','泊湖'],['Daguan','大官湖'],['Longgan','龙感湖'],['Junshan','军山湖'],['Ch\'eng','程海'],
 ['Ngangla Ringco','昂拉仁措'],['Dagze','达则措'],['Ngoin','鄂雅错'],['Bangkog','班戈错'],['Pa-Mu-Ts\'o','巴木错'],['P\'eng-Ts\'o','蓬错'],
 ['Cha-pu-yeh ch\'a-k\'a','扎布耶茶卡'],['Jen-ch\'ing hsiu-pu-ts\'o','仁青休布错'],['T\'a-jo','塔若错'],['Hsu-ju','许如错'],
 ['Kuo-mang','果忙错'],['Ang-tzu','昂孜错'],['Ta-tse','达则措（格仁错）'],['P\'a-lung','帕龙错'],['Ko-jen','格仁错'],
 ['Bangdag','邦达错'],['Aru','阿鲁错'],['Memar','美马错'],['Gozha','郭扎错'],['Bairab','拜惹布错'],['Dorsoidong','多尔索洞错'],
 ['Arkatag','阿喀塔格湖'],['Lung Mu','龙木错'],['Orba','阿翁错'],['Lagkor','拉果错'],['Cam','仓木错'],['Tajo-Tzo','塔若措'],
 ['Chuzenjiko','中禅寺湖'],['Wular','乌勒尔湖'],['Bay','内湖（菲律宾）'],['Taal','塔阿尔湖'],['Naujan','瑙汉湖'],
 ['Indawngy','因道支湖'],['Thale Luang','宋卡湖'],['Bueng Boraphet','波拉佩湖'],['Nong Han Lake','农汉湖'],
 ['Danau Singkarak','辛卡拉克湖'],['Danau Manindjau','马宁焦湖'],['Danau Poso','波索湖'],['Danau Sentarum','森塔伦湖'],
 ['Danau Tawar','塔瓦尔湖'],['Danau Sentani','森塔尼湖'],['Djenpang','詹庞湖'],['Melintang','默林塘湖'],
 ['Song-kel','颂湖'],['Chatyr-kel\'','查提尔湖'],['Karakul','喀拉库勒湖'],['Sarezskoye','萨雷兹湖'],['Sasykkol','萨瑟克湖'],
 ['Torey Lakes','托雷湖群'],['Har','哈尔湖'],['Dorgon','德尔根湖'],['Achit','阿奇特湖'],['Orog','奥罗格湖'],
 ['Boon Tsagaan','本查干湖'],['Sangiyn Dalay','桑金达赖湖'],['Telmen','特尔门湖'],['Dayan','达彦湖'],['Tolbo','托勒博湖'],
 ['Gusinoye','古西诺耶湖'],['Baunt','鲍恩特湖'],['Teletskoye','捷列茨科耶湖'],['Kronotskoye','克罗诺茨基湖'],
 ['Pyasino','皮亚西诺湖'],['Lama','拉马湖'],['Khantayskoye','汉泰卡湖'],['Keta','克塔湖'],['Yessey','耶谢伊湖'],
 ['Lovozero','洛沃泽罗湖'],['Umbozero','温博泽罗湖'],['Topozero','托波泽罗湖'],['Vodlozero','沃德洛泽罗湖'],
 ['Kubenskoye','库边斯科耶湖'],['Vozhe','沃热湖'],['Lacha','拉恰湖'],['Seg','谢戈泽罗湖'],['Manych-Gudilo','马内奇古季洛湖'],
 ['El\'ton','埃利顿湖'],['Inder','因德尔湖'],['Shalkar','沙尔卡尔湖'],['Kushmurun','库什穆伦湖'],['Markakol\'','马尔卡科尔湖'],
 ['Beysehir','贝伊谢希尔湖'],['Egridir','埃伊尔迪尔湖'],['Burdur','布尔杜尔湖'],['Aksehir','阿克谢希尔湖'],['Eber','埃贝尔湖'],
 ['Cildir','奇尔德尔湖'],['Ercek','埃尔切克湖'],['Hazar','哈扎尔湖'],['Kus','库什湖（马尼亚斯湖）'],['Ulubat','乌鲁阿巴特湖'],
 ['Bakhtegan','巴赫特甘湖'],['Hamun-E Saberi','萨贝里哈蒙湖'],['Habbaniyah','哈巴尼亚湖'],['Great Bitter','大苦湖'],['Qarun','加龙湖'],
 ['Lake Kivu','基伍湖'],['Naivasha','奈瓦沙湖'],['Baringo','巴林戈湖'],['Awasa','阿瓦萨湖'],['Ziway','兹怀湖'],['Langano','兰加诺湖'],
 ['Tumba','通巴湖'],['Fitri','菲特里湖'],['Iro','伊罗湖'],['Guiers','盖尔湖'],['Debo','德博湖'],['Ichkeul','伊什克尔湖'],
 ['Sua Pan','苏阿盐沼'],['Malombe','马隆贝湖'],['Chiuta','丘塔湖'],['Alaotra','阿劳特拉湖'],['St. Lucia','圣卢西亚湖'],
 ['Mjosa','米约萨湖'],['Randsfjorden','兰兹峡湾湖'],['Tyrifjorden','蒂里峡湾湖'],['Femunden','费蒙湖'],['Siljan','锡利扬湖'],
 ['Storsjon','斯图尔湖'],['Hornavan','霍尔纳万湖'],['Uddjaur','乌德尧尔湖'],['Sommen','索门湖'],['Bolmen','博尔门湖'],
 ['Stora Lulevatten','大吕勒水库'],['Akkajaure','阿卡水库'],['Pielinen','皮埃利宁湖'],['Nasijarvi','奈西湖'],['Keitele','凯泰莱湖'],
 ['Kemijarvi','凯米湖'],['Puulavesi','普拉湖'],['Pyhajarvi','皮海湖'],['Muritz','米里茨湖'],['Sniardwy','希尼亚尔德维湖'],
 ['Vortis-Jarv','沃尔茨湖'],['Thingvallavain','辛格瓦德拉湖'],['Corrib','科里布湖'],['Ree','里湖'],['Lough Derg','德格湖'],['Erne','厄恩湖'],
 ['Frome','弗罗姆湖'],['Gairdner','盖尔德纳湖'],['Amadeus','阿马迪厄斯湖'],['Carnegie','卡内基湖'],['Carey','凯里湖'],
 ['Alexandrina','亚历山德里纳湖'],['Taupo','陶波湖'],['Te Anau','蒂阿瑙湖'],['Wakatipu','瓦卡蒂普湖'],['Wanaka','瓦纳卡湖'],
 ['Hawea','哈威亚湖'],['Pukaki','普卡基湖'],['Manapouri','马纳普里湖'],['Tekapo','蒂卡普湖'],['Rotoaira','罗托艾拉湖'],
 ['Selawik','塞拉维克湖'],['Takiyuak','塔基尤阿克湖'],['Contwoyto','康特沃伊托湖'],['Aberdeen','阿伯丁湖'],['Martre','拉马特尔湖'],
 ['Yathkyed','亚斯凯德湖'],['Nueltin','纽埃尔廷湖'],['Kasba','卡斯巴湖'],['Claire','克莱尔湖'],['Cree','克里湖'],
 ['Southern Indian','南印第安湖'],['Lac a L\'Eau Claire','克利尔沃特湖（水清湖）'],['Gods','戈兹湖'],['Moose','穆斯湖'],
 ['Seul','苏尔湖'],['Bras d\'Or','布拉多尔湖'],['Tahoe','太浩湖'],
 // Wave-2 Eurasian & Arctic Russian / Tibetan / Central Asian lakes
 ['Dong','洞错'],['Nau','纳乌错'],['Bong','崩错'],['Ch\'a-erh-ku-t\'e','恰规错'],['Mo-k\'o-yu','木纠错'],['Mu-ts\'o-ping-ni','姆错丙尼'],
 ['Namru','兹格塘错'],['Na','错那湖'],['Chem','泽错'],['Morari','莫里里湖'],
 ['Kungasalakh','昆加萨拉赫湖'],['Portnyagino','波特尼亚吉诺湖'],['Kokora','科科拉湖'],['Nadudoturku','纳杜多图尔库湖'],
 ['Bustakh','布斯塔赫湖'],['Ferguson','弗格森湖'],['Mogotoyeyo','莫戈托耶沃湖'],['Soluntakh','索伦塔赫湖'],
 ['Periptaveto','佩里普塔韦托湖'],['Yambuto','扬布托湖'],['Ilergytgyn','伊莱尔格特根湖'],['Mayato and Neyto','马亚托-涅伊托湖'],
 ['Neyato','涅亚托湖'],['Bol\'shoye Morskoye','大莫尔斯科耶湖'],['Chukoch\'ye','丘科奇耶湖'],['Nerpich\'ye','涅尔皮奇耶湖'],
 ['Glubokoye','格卢博科耶湖'],['Ozhogino','奥若吉诺湖'],['Sobach\'ye','索巴奇耶湖'],['Peschanoye','佩夏诺耶湖'],
 ['Pavylon','帕维隆湖'],['Vtoroye','弗托罗耶湖'],['Golodnaya Guba','戈洛德纳亚湾'],['Pervoye','佩尔沃耶湖'],
 ['Eloygytgyn','埃利格吉特根湖'],['Agata','阿加塔湖'],['Kovitskoye','科维茨科耶湖'],['Paduskoye More','帕杜斯科耶湖'],
 ['Temchi','捷姆奇湖'],['Vivi','维维湖'],['Tikshe','季克舍湖'],['Shuryshkarskiy','舒雷什卡尔斯基湾'],
 ['Pya','皮亚湖'],['Keret','克列季湖'],['Sredneye Kuyto','中奎托湖'],['Leksozero','列克索泽罗湖'],
 ['Nedzheli','涅杰利湖'],['Kozhozero','科若泽罗湖'],['Pal\u2019yeozero','帕利耶泽罗湖'],['Janis Yarvi','亚尼斯亚尔维湖'],
 ['Yam','亚姆湖'],['Piltanlor','皮尔坦洛尔湖'],['Tormemtor','托尔梅姆托尔湖'],['Bolshoy Uvat','大乌瓦特湖'],
 ['Saltaim','萨尔塔伊姆湖'],['Ubinskoye','乌宾斯科耶湖'],['Argazinskoye','阿尔加济水库'],['Saitlan','萨伊特兰湖'],
 ['Malyye Chany','小恰内湖'],['Ul\'ken-karoy','乌尔肯卡罗伊湖'],['Kilibek','基利别克湖'],['Orel\'','奥列利湖'],
 ['Seletyteniz','谢列特坚吉兹湖'],['Kulundinskoye','库伦达湖'],['Zhalauly','扎拉乌雷湖'],['Kuchukskoye','库丘克湖'],
 ['Bol\'sho Yeravnoye','大叶拉夫诺耶湖'],['Gor\'koye','戈尔科耶湖'],['Udyl\'','乌德利湖'],['Chukchagirskoye','丘克恰吉尔湖'],
 ['Evoron','埃沃龙湖'],['Bolon\'','博隆湖'],['Karasor','卡拉索尔湖'],['Sor Khaki','哈基盐沼'],
 ['Shalkarteniz','沙尔卡尔坚吉兹湖'],['Kamyshlybas','卡梅什雷巴什湖'],['Kuyumazarskoye','库尤马扎尔水库'],['Tudakol\u2019','图达库尔湖'],
 ['Kiyeng-Kyuyel\'','基延-克尤耶利湖'],['Tonskoye','通斯科耶湖'],['Sagarych\'ye','萨加雷奇耶湖'],['Melkoye','梅尔科耶湖'],
 ['Ayan','阿扬湖'],['Myakshinga','米亚克申加湖'],['Vyalozero','维亚洛泽罗湖'],['Sergazero','谢尔加泽罗湖'],
 ['Munduyskoye','蒙杜伊斯科耶湖'],['Gimol Skoye','吉莫尔斯科耶湖'],['Syrkovoye','瑟尔科沃耶湖'],['Tursuntskiy Tuman','图尔孙特湖沼'],
 ['Bul\'shoye Toko','大托科湖'],['Ik','伊克湖'],['Shchuch\'ye','休奇耶湖'],['Uvil\'dy','乌维尔德湖'],
 ['Tavolzhan','塔沃尔然湖'],['Ebeyty','埃贝特湖'],['Kishi\'karoy','基希卡罗伊湖'],['Kuril\'skoye','千岛湖（堪察加库里尔湖）'],
 ['Akkol\'','阿克科尔湖'],['Horgon','霍尔贡湖'],['Uyaly','乌亚雷湖'],['Biylikol','比利科尔湖'],
 ['Molochnoye','莫洛奇内湾'],['Beysugskty','贝苏格河口湾'],['Kiziliashskiy','基济尔塔什河口湾'],['Khanskoye','汉斯科耶湖'],
 ['Akhtanizovskiy','阿赫塔尼佐夫斯基河口湾'],['Pechenezhkoye','佩切涅吉水库'],['Daryacheh-ye Howz Soltan','霍兹苏丹盐湖'],['Chah-e Khorasan','呼罗珊盐沼'],
 ['Acigol','阿哲湖'],['Mainit','迈尼特湖'],['Lano','拉瑙湖'],['Semajang','塞马扬湖'],
 ['Danau Romberbai','龙贝拜湖'],['Danau Matano','马塔诺湖'],['Towuti','托武蒂湖'],['Danau Paniai','帕尼亚伊湖'],['Danau Ranau','拉瑙湖（苏门答腊）'],
 // Black Sea lagoons, Balkans, Greece, France & Scandinavia
 ['Tiligul\'skiy','季利古尔河口湾'],['Khadzhideyskiy','哈吉别伊河口湾'],['Dnestrovskyi','德涅斯特河口湾'],['Shagany','沙加内湾'],
 ['Yalpug','亚尔普格湖'],['Razelm','拉泽姆湖'],['Sinoe','西诺埃湖'],['Kuyal\'nitskiy','库亚利尼克河口湾'],
 ['Thau','托潟湖'],['Vigorritis','维戈里蒂斯湖'],['Volvi','沃尔维湖'],['Ioannina','约阿尼纳湖（帕姆沃蒂斯湖）'],['Trikhonis','特里霍尼达湖'],
 ['Virihaure','维里豪雷湖'],['Parkijaure','帕尔基亚乌雷湖'],['Vastenjaure','瓦斯滕亚乌雷湖'],['Satisjaure','萨蒂斯亚乌雷湖'],
 ['Randijaure','兰迪亚乌雷湖'],['Yli -Kitka','上基特卡湖'],['Rossvatnet','勒斯湖'],['Kianta','基安塔湖'],
 ['Flasjon','弗拉湖'],['Ontojarvi','翁托湖'],['Snasvatnet','斯诺萨湖'],['Lappajarvi','拉帕湖'],
 ['Kolmajarvi','科尔马湖'],['Kivijarvi','基维湖'],['Nilakka','尼拉卡湖'],['Hoytiainen','霍伊蒂艾宁湖'],
 ['Koitere','科伊泰雷湖'],['Virmasvesi','维尔马斯韦西湖'],['Minijarvi','米尼湖'],['Juojarvi','尤奥湖'],
 ['Keuruunselka','凯乌鲁塞尔凯湖'],['Suonne','苏翁内湖'],['Visohisarvi','维索希湖'],['Langelmavesi','兰盖尔迈韦西湖'],
 ['Vanajanselka','瓦纳亚塞尔凯湖'],['Vesijarvi','韦西湖'],['Stora Le','斯图拉莱湖'],['Storovan','斯托尔阿万湖'],
 ['Bastuselet','巴斯图塞莱特水库'],['Lagarfljoi','拉加尔河湖'],['Stor Blasjon','大布洛湖'],['Tunnssjoon','通湖'],
 ['Limingen','利明根湖'],['Jormvattnet','约姆湖'],['Kvarnbergsvattnet','夸恩贝里湖'],['Nesjoen','内斯湖'],
 ['Nakten','纳克滕湖'],['Norra Dellen','北德伦湖'],['Kyrosjarvi','屈勒斯湖'],['Amungen','阿蒙根湖'],
 ['Lohjanjarvi','洛赫亚湖'],['Lake Oyeren','厄耶伦湖'],['Fryken','弗吕肯湖'],['Blasjo','布洛舍水库'],
 ['Glafsfj','格拉夫斯峡湾湖'],['Nisser','尼塞尔湖'],['Toke','托克湖'],['Unden','温登湖'],
 ['Glan','格兰湖'],['Roxen','罗克森湖'],['Asnen','奥斯嫩湖'],['Skjerkavatn','谢尔卡湖'],
 // Africa
 ['Toshka  1','托什卡 1 号湖'],['Toshka  2','托什卡 2 号湖'],['Afrera ye\'ch\'ew','阿夫雷拉盐湖'],['Abhe Bid','阿贝湖'],
 ['Aougoundou','奥贡杜湖'],['Yardi','亚尔迪湖'],['Abayata','阿比亚塔湖'],['Shala','沙拉湖'],
 ['Piso','皮索湖'],['Lagos Lagoon','拉各斯潟湖'],['Nokoue','诺奎湖'],['Ch\'Amo','查莫湖'],
 ['Ebrie Lagoon','埃布里耶潟湖'],['Bisina','比西纳湖'],['George','乔治湖（乌干达）'],['Onangue','奥南盖湖'],
 ['Burigi','布里吉湖'],['Rweru','鲁韦鲁湖'],['Natron','纳特龙湖'],['Manyara','曼雅拉湖'],
 ['Sulunga','苏伦加盐沼'],['Kabamba','卡班巴湖'],['Zimbambo','津班博湖'],['Kisale','基萨莱湖'],
 ['Upemba','乌彭巴湖'],['Kabele','卡贝莱湖'],['Kampolombo','坎波隆博湖'],['Kinkony','金科尼湖'],
 ['Ihotry','伊霍特里湖'],['Bosumtwi','博苏姆推湖'],['Nakuwa','纳库瓦湖'],['Kachira','卡奇拉湖'],
 ['Ihema','伊赫马湖'],['Kitangiri','基坦吉里湖'],['Kabwe','卡布韦湖'],['Poelela','波埃莱拉湖'],['Sibayi','西巴伊湖'],
 // Oceania
 ['Chambri','钱布里湖'],['Murray','默里湖（巴新）'],['Karumba Plains','卡伦巴平原'],['Disappointment','失望湖'],
 ['Lefroy','勒弗罗伊盐湖'],['Cowan','考恩盐湖'],['Minindee','梅宁迪湖'],['Hindmarsh','欣德马什湖'],
 ['Wellington','惠灵顿湖'],['Corangamite','科兰加迈特湖'],['Pedder','佩德湖'],['Wisdom','威兹德姆湖（隆岛火山湖）'],
 ['Kutubu','库图布湖'],['Narran','纳兰湖'],
 // South & Central America
 ['Atitla','阿蒂特兰湖'],['Yojoa','约霍阿湖'],['Guajaro','瓜哈罗水库'],['Valencia','巴伦西亚湖'],
 ['Zapatosa','萨帕托萨沼泽湖'],['Novo','诺沃湖'],['Baia do Caxiuana','卡希瓦纳湾'],['Lago Grande Do Curuai','大库鲁阿伊湖'],
 ['Amana','阿马纳湖'],['Grande de Manacapuru','大马纳卡普鲁湖'],['Tefe','特费湖'],['Badajos','巴达若斯湖'],
 ['Biarini','比亚里尼湖'],['Mamia','马米亚湖'],['Coari','科阿里湖'],['Aiapua','阿亚普阿湖'],
 ['Taciula','塔西乌拉湖'],['Arapa','阿拉帕湖'],['Mandiora','曼迪奥拉湖'],['Lago Coipasa','科伊帕萨盐沼'],
 ['Salar de Uyuni','乌尤尼盐沼'],['Feia','费亚湖'],['Araruama','阿拉鲁阿马潟湖'],['Punta Negra','蓬塔内格拉盐沼'],
 ['Itapeva','伊塔佩瓦湖'],['Dos Ouadros','多斯夸德罗斯湖'],['Lagoa Mangueira','曼盖拉湖'],['Negra','内格拉潟湖'],
 ['Llancanelo','良卡内洛湖'],['Monte','蒙特湖'],['Epecuen','埃佩昆湖'],['Pelegrini','佩莱格里尼湖'],
 ['Villarrica','比利亚里卡湖'],['Calafquem','卡拉夫肯湖'],['Huechulafquen','韦丘拉夫肯湖'],['Ranguipulli','兰吉普利湖'],
 ['Ranco','兰科湖'],['Puyehue','普耶韦湖'],['Rupanco','鲁潘科湖'],['Nahuel Huapi','纳韦尔瓦皮湖'],
 ['Todos los Santos','托多斯洛斯桑托斯湖'],['Llanquihue','延基韦湖'],['Yelcho','耶尔乔湖'],['General Vintter','温特将军湖'],
 ['Musters','穆斯特斯湖'],['Colhue Huapi','科卢埃瓦皮湖'],['Presidente Rios','里奥斯总统湖'],['Cochrane','科克伦湖（普埃雷东湖）'],
 ['Cardiel','卡尔迭尔湖'],['Toro','托罗湖'],['Blanca','布兰卡湖'],['Blanc','布兰科湖'],
 ['Fagnano','法尼亚诺湖'],['Arari','阿拉里湖'],['Parinacocha','帕里纳科查湖'],['Baia Grande','大巴亚湖'],
 ['Gaiba','盖巴湖'],['Juparana','茹帕拉纳湖'],['Pozuelos','波苏埃洛斯湖'],['Vilama','维拉马湖'],
 ['Laj','拉哈湖'],['Rinihue','里尼韦湖'],['Gran Laguna Salada','大萨拉达湖'],['Plata','拉普拉塔湖'],
 ['Fontana','丰塔纳湖'],['Strobel','斯特罗贝尔湖'],['Sarmiento','萨米恩托湖'],
 // Major Alaska Lakes
 ['Teshekpuk','特谢克普克湖'],['Tustumena Lake','图斯图梅纳湖'],['Lake Clark','克拉克湖'],['Naknek','纳克内克湖'],
 ['Lake Grosvenor','格罗夫纳湖'],['Skilak Lake','斯基拉克湖'],['Lake Brooks','布鲁克斯湖'],['Lake Minchumina','明丘米纳湖'],
 ['Lake Nerka','纳卡湖'],['Lake Beverley','贝弗利湖'],['Lake Aleknagik','阿莱克纳吉克湖'],['Chakachamna Lake','查卡查姆纳湖'],
 ['Upper Ugashik Lake','上乌加希克湖'],['Lower Ugashik Lake','下乌加希克湖'],['Imuruk Lake','伊穆鲁克湖'],['Imuruk Basin','伊穆鲁克盆地'],
 // Wave-3 Remaining Arctic Canada, Canadian Shield, Mainland US & Mesoamerica/Caribbean lakes
 ['Hazen','黑曾湖'],['Crooked','克鲁克德湖'],['Zeta','泽塔湖'],['Angajurjualuk','安加茹尔茹阿鲁克湖'],
 ['Quartz','夸茨湖'],['Tahiryuak','塔希尔尤阿克湖'],['Namaycush','纳迈库什湖'],['Nina Bang','尼娜·邦湖'],
 ['Erichsen','埃里克森湖'],['Neergaure','内尔高雷湖'],['Washburn','沃什伯恩湖'],['Quunnguq','库温古克湖'],
 ['Jayko','杰科湖'],['Jekyll','杰基尔湖'],['Eskimo North','爱斯基摩北湖'],['Surrey','萨里湖'],
 ['Labaz','拉巴兹湖（加拿大）'],['Pangnikto','庞尼克托湖'],['Netsilik','内齐利克湖'],['Eskimo Southern','爱斯基摩南湖'],
 ['Lady Melville','梅尔维尔夫人湖'],['Hall','霍尔湖'],['Bluenose','蓝鼻湖'],['Sitidgi','西蒂德吉湖'],
 ['Horton','霍顿湖'],['Maunoir','莫努瓦湖'],['MacNaughton','麦克诺顿湖'],['Aubry','奥布里湖'],
 ['Colville','科尔维尔湖'],['Bois','布瓦湖'],['Belot','贝洛湖'],['Curtis','柯蒂斯湖'],
 ['McAlpine Lane','麦卡尔平莱恩湖'],['Inland Lake','内陆湖'],['Garry (Lower)','下加里湖'],['Rockinghorse','摇马湖'],
 ['Garry( Upper)','上加里湖'],['Pelly','佩利湖'],['Deep Rose','深玫瑰湖'],['Hansine','汉西内湖'],
 ['Itchen','伊琴湖'],['Mahony','马奥尼湖'],['Nose','诺斯湖'],['Hottah','霍塔湖'],
 ['Tehek','特赫克湖'],['Yamba','扬巴湖'],['Hardish','哈迪什湖'],['Luran','卢兰湖'],
 ['Schultz','舒尔茨湖'],['Mingo','明戈湖'],['Birch','伯奇湖'],['Beverly','贝弗利湖（奴南武特）'],
 ['Point','波因特湖'],['Gras','格拉湖'],['Whitehills','怀特希尔斯湖'],['Marjorie','马乔里湖'],
 ['Blackwater','黑水湖'],['Mackay','麦凯湖'],['Ingray','英格雷湖'],['Aylmer','艾尔默湖'],
 ['Keller','凯勒湖'],['Wharton','沃顿湖'],['Pitz','皮茨湖'],['Mallery','马勒里湖'],
 ['Grandin','格兰丁湖'],['Faber','费伯湖'],['Princess Mary','玛丽公主湖'],['Tebesjuak','特贝斯朱阿克湖'],
 ['Enemy, lake of the','敌之湖'],['Clinton Colden','克林顿-科尔登湖'],['Ford','福特湖'],['Fletcher','弗莱彻湖'],
 ['Walmsley','沃姆斯利湖'],['Campbell','坎贝尔湖'],['Tulemalu','图莱马卢湖'],['Fish','菲什湖'],
 ['Tyrrell','蒂勒尔湖'],['Gordon','戈登湖'],['Nutarawit','努塔拉维特湖'],['Artillery','阿蒂勒里湖'],
 ['Bulmer','布尔默湖'],['Kaminuriak','卡米努里亚克湖'],['White Fish','白鱼湖（加拿大）'],['Kamilukuak','卡米卢夸克湖'],
 ['Mosquito','莫斯基托湖'],['Mary','玛丽湖'],['Kaminak','卡米纳克湖'],['Nowleye','诺利湖'],
 ['Aggikani','阿吉卡尼湖'],['Sid','锡德湖'],['Angikuni','安吉库尼湖'],['Willow','威洛湖'],
 ['Barlow','巴洛湖'],['Tazlina Lake','塔兹利纳湖'],['Boyd','博伊德湖'],['North Henik','北赫尼克湖'],
 ['Nonacho','诺纳乔湖'],['Maguse','马古斯湖'],['Kluane','克卢恩湖'],['Laberge','拉伯格湖'],
 ['Firedrake','法尔德雷克湖'],['Hicks','希克斯湖'],['Aishihik','艾希希克湖'],['Ennadai','埃纳代湖'],
 ['Watterson','沃特森湖'],['South Henik','南赫尼克湖'],['Kayigyalik Lake','卡伊格亚利克湖'],['Aropuk Lake','阿罗普克湖'],
 ['Nantais','南泰湖'],['Kagalurpak Lake','卡加卢尔帕克湖'],['Nunavakpak Lake','努纳瓦克帕克湖'],['Wholdaia','沃尔代亚湖'],
 ['Tatinnai','塔廷奈湖'],['Tathlina','塔特利纳湖'],['Teslin','特斯林湖'],['Snowbird','斯诺伯德湖'],
 ['Buffalo','布法罗湖'],['Dall Lake','达尔湖'],['Lakes Nuyakuk, Tikchik, Chauekuktuli','努亚库克-蒂克奇克湖群'],['Baralzon','巴拉尔宗湖'],
 ['Selwyn','塞尔温湖'],['Scott','斯科特湖'],['Tazin','塔津湖'],['Bistcho','比斯乔湖'],
 ['Atlin','阿特林湖'],['Nejanilini','内贾尼利尼湖'],['Payne','佩恩湖'],['Black','布莱克湖'],
 ['Kukaklek Lake','库卡克莱克湖'],['Riou','里乌湖'],['Nonvianuk Lake','农维阿努克湖'],['Faribault','法里博湖'],
 ['Davy','戴维湖'],['Tadouie','塔杜伊湖'],['Hatchett','哈切特湖'],['Brochet','布罗谢湖'],
 ['Pasfield','帕斯菲尔德湖'],['Big Sand','大沙湖'],['Minto','明托湖'],['Gauer','高尔湖'],
 ['Barrington','巴林顿湖'],['Lwe Moyne','勒穆瓦讷湖'],['Notigi Reservoir','诺蒂吉水库'],['Baldock','鲍尔多克湖'],
 ['Wasekamio and Turnor','瓦塞卡米奥-特纳湖'],['Waskaiowaka','瓦斯凯奥瓦卡湖'],['Granville','格兰维尔湖'],['Castignon','卡斯蒂尼翁湖'],
 ['Loche','洛什湖'],['Split','斯普利特湖'],['Guillaume-Delisle','纪尧姆-德利勒湖'],['North Wabasca','北瓦巴斯卡湖'],
 ['Otelnuc','奥特尔努克湖'],['Ile-a-la-Crosse','伊尔-阿-拉-克罗斯湖'],['Utikuma','乌蒂库马湖'],['Peter Pond','彼得·庞德湖'],
 ['Churchill','丘吉尔湖（萨斯喀彻温）'],['Pinehouse','派恩豪斯湖'],['Winefred','温尼弗雷德湖'],['Besnard','贝斯纳德湖'],
 ['Utik','乌蒂克湖'],['Babine','巴宾湖'],['Sipiwesk','西皮韦斯克湖'],['Canoe','卡努湖'],
 ['Knee','尼湖'],['Calling','考灵湖'],['Plonge','普隆日湖'],['Bear','熊湖'],
 ['Egg','埃格湖'],['Takla','塔克拉湖'],['Bienville','比安维尔湖'],['Biche','比什湖'],
 ['Oxford','牛津湖'],['Wapawekka','瓦帕韦卡湖'],['Wekusko','韦库斯科湖'],['Primrose','普里姆罗斯湖'],
 ['Deschambault','德尚博湖'],['Burton','伯顿湖'],['Edmund','埃德蒙湖'],['Walker','沃克湖'],
 ['Smoothstone','斯穆思斯通湖'],['Dore','多雷湖'],['Reed','里德湖'],['Cold','科尔德湖'],
 ['Athapapuskow','阿萨帕普斯科湖'],['Kiskittogisu','基斯基托吉苏湖'],['Montreal','蒙特利尔湖（萨斯喀彻温）'],['Stuart','斯图尔特湖'],
 ['Amisk','阿米斯克湖'],['Goose','鹅湖（萨斯喀彻温）'],['Julian','朱利安湖'],['Beaver Hill','比弗希尔湖'],
 ['Kiskitto','基斯基托湖'],['Molson','莫尔森湖'],['Red Sucker','红吸盘鱼湖'],['Cormorant','科莫兰特湖'],
 ['Talbot','塔尔博特湖'],['Clearwater','克利尔沃特湖（萨斯喀彻温）'],['Little Sachigo','小萨奇戈湖'],['Nipishich','尼皮希奇湖'],
 ['Crean','克里恩湖'],['Delarondo','德拉龙多湖'],['Island','岛湖（马尼托巴）'],['Rocky','洛矶湖'],
 ['Playgreen','普莱格林湖'],['Cumberland','坎伯兰湖'],['Stevenson','史蒂文森湖'],['William','威廉湖'],
 ['Sachigo','萨奇戈湖'],['Candle','坎德尔湖'],['Big Trout','大鳟鱼湖'],['Big Stone','大石湖'],
 ['Beaverhill','比弗希尔湖（艾伯塔）'],['Sakami','萨卡米湖'],['Opiscoteq','奥皮斯科特克湖'],['Eutsuk','尤特苏克湖'],
 ['Nichicun','尼希昆湖'],['Wabush','瓦布什湖'],['Sandy','桑迪湖'],['Ashuanipi','阿舒阿尼皮湖'],
 ['Atikonak','阿蒂科纳克湖'],['Naococane','纳奥科卡内湖'],['Weagamow','韦阿加莫湖'],['Red Deer','红鹿湖'],
 ['North Caribou','北驯鹿湖'],['Swan','斯旺湖'],['Quesnel','克内尔湖'],['Pelican','佩利肯湖'],
 ['MacDowell','麦克道尔湖'],['Fleur de May','五朔节之花湖'],['Waterhen','水鸡湖'],['St. Martin','圣马丁湖'],
 ['Chilko','奇尔科湖'],['Pletipi','普莱蒂皮湖'],['Dauphin','多芬湖'],['St. Joseph','圣约瑟夫湖'],
 ['Albaniel','阿尔巴涅尔湖'],['Evans','埃文斯湖'],['Red','红湖（安大略）'],['Adams','亚当斯湖'],
 ['Shuswap','舒斯瓦普湖'],['Last Mountain','末山湖'],['Savant','萨万特湖'],['Assinica','阿西尼卡湖'],
 ['Kesagami','凯萨加米湖'],['Poncheville','蓬什维尔湖'],['Umfreville','昂弗雷维尔湖'],['Sturgeon','斯特金湖'],
 ['Matagami','马塔加米湖'],['Minnitaki','明尼塔基湖'],['Chibougamau','希布加莫湖'],['Goeland','戈埃朗湖'],
 ['Wabigoon','瓦比贡湖'],['Eagle','鹰湖（安大略）'],['Waswanipi','瓦斯瓦尼皮湖'],['Okanagan','奥卡纳干湖'],
 ['Kootenay','库特尼湖'],['Harrison','哈里森湖'],['Abitibi','阿比蒂比湖'],['Parent','帕朗湖'],
 ['Dog','多格湖'],['Rainy','雷尼湖'],['Nighthawk','夜鹰湖'],['Malartic','马拉尔蒂克湖'],
 ['Preissac','普雷萨克湖'],['Lac La Croix','拉克鲁瓦湖'],['Vermilion Lake','朱砂湖'],['Devils Lake','魔鬼湖'],
 ['Quinze','坎兹湖'],['Kempt','肯普特湖'],['Timiskaming','蒂米斯卡明湖'],['Temagam','特马加米湖'],
 ['Wanapitei','瓦纳皮泰湖'],['Canyon Ferry Lake','峡谷渡口湖'],['St. Peter','圣皮埃尔湖'],['Nipissing','尼皮辛湖'],
 ['Manitou','马尼图湖'],['St. Francis','圣弗朗西斯湖'],['Muskoka','马斯科卡湖'],['Simcoe','锡姆科湖'],
 ['Yellowstone Lake','黄石湖'],['Winnebago','温尼贝戈湖'],['Malheur Lake','马卢尔湖'],['Oneida Lake','奥奈达湖'],
 ['Harney Lake','哈尼湖'],['Seneca Lake','塞内卡湖'],['Summer Lake','萨默湖'],['Lake Abert','阿伯特湖'],
 ['Bear Lake','贝尔湖（犹他-爱达荷）'],['Goose Lake','鹅湖（俄勒冈-加州）'],['Bonneville Salt Flat','邦纳维尔盐沼'],['Eagle Lake','伊格尔湖（加州）'],
 ['Honey Lake','霍尼湖'],['Pyramid Lake','金字塔湖'],['Sevier','塞维尔湖'],['Clear Lake','克利尔湖（加州）'],
 ['Walker Lake','沃克湖'],['Mono Lake','莫诺湖'],['Lake Mattamuskeet','马塔马斯基特湖'],['Salton','索尔顿湖'],
 ['Laguna Salada','萨拉达潟湖'],['Aguas Termales','阿瓜斯·特尔马莱斯盐沼'],['Lake Maurepas','莫雷帕湖'],['Grand Lake','大湖（路易斯安那）'],
 ['Calcasieu Lake','卡尔克苏湖'],['Lake Salvador','萨尔瓦多湖'],['Lake George','乔治湖（佛罗里达）'],['Lake Apopka','阿波普卡湖'],
 ['Windsor','温莎湖（伊纳瓜岛）'],['Cuitzeo','库伊特塞奥湖'],['Saumatre','索马特尔湖'],['Enriquillo','恩里基约湖'],
 ['Peten Itza','佩滕伊察湖'],['Izabal','伊萨瓦尔湖'],['Brown','布朗湖'],['St. Therese','圣特蕾莎湖'],
 ['Tetlin Lake','泰特林湖'],['Lake Louise','路易丝湖（阿拉斯加）'],['Nunavakanuk Lake','努纳瓦卡努克湖'],['Klutina Lake','克卢蒂纳湖'],
 ['Arhymot Lake','阿尔希莫特湖'],['Kgun Lake','克贡湖'],['Nuigalak Lake','努伊加拉克湖'],['Whitefish Lake','白鱼湖（阿拉斯加）'],
 ['Takslesluk Lake','塔克斯莱斯卢克湖'],['Nunavakanukakslak Lake','努纳瓦卡努卡克斯拉克湖'],['Kenai Lake','基奈湖'],['Kegum Kagati Lake','凯古姆-卡加蒂湖'],
 ['Chikuminuk Lake','奇库米努克湖'],['Couture','库图尔湖'],['Nunavaugaluk Lake','努纳瓦加卢克湖'],['Tasiataq','塔西亚塔克湖'],
 ['Kamuchawie','卡穆查维湖'],['Sisipuk','西西普克湖'],['Keeley','基利湖'],['Kistigan','基斯蒂甘湖'],
 ['Wabamun','瓦巴蒙湖'],['Pigeon','皮金湖'],['Charlotte','夏洛特湖'],['Lake Minnewanka','明尼万卡湖'],
 ['Seton Lake','西顿湖'],['Waconich','瓦科尼希湖'],['Grasset','格拉塞特湖'],['Deer','迪尔湖'],
 ['Osoyoos Lake','奥索尤斯湖'],['Priest Lake','普里斯特湖'],['Basswood Lake','巴斯伍德湖'],['Lake Washington','华盛顿湖'],
 ['Cass Lake','卡斯湖'],['Mullet Lake','马利特湖'],['Burt Lake','伯特湖'],['Lake Charlevoix','沙勒沃伊湖'],
 ['Memphremegog','门弗雷梅戈格湖'],['Torch Lake','火炬湖'],['Houghton Lake','霍顿湖（密歇根）'],['Rice','赖斯湖（安大略）'],
 ['Saratoga Lake','萨拉托加湖'],['Crater Lake','火山口湖'],['Carlyle Lake','卡莱尔湖'],['Phelps Lake','菲尔普斯湖'],
 ['Richard B. Russell Lake','理查德·拉塞尔湖'],['Palestine','帕莱斯廷湖（得克萨斯）'],['Catahoula Lake','卡塔胡拉湖'],['Lac des Allemands','阿勒芒湖'],
 ['Lake Verret','韦雷特湖'],['Crescent Lake','新月湖（佛罗里达）'],['Lake Eustis','尤斯蒂斯湖'],['Lake Harris','哈里斯湖'],
 ['Istokpoga Lake','伊斯托克波加湖'],['Caimane','凯马内潟湖'],['Tames','塔梅斯潟湖'],['Corte','科尔特斯湖'],
 ['Catemaco','卡特马科湖'],['Long Lake','长湖（安大略）']
]);
const LAKE_ID_ZH=new Map([
 ['14520','岱海'],['1218','乌列格湖'],['1288','奥罗格湖'],
 ['1236','哈尔乌苏湖'],['13937','哈尔湖'],['13943','哈尔湖'],
 ['200','塔霍湖（维多利亚岛）'],['1670','凯里盐湖'],
 ['592','大湖（拉布拉多）'],['702','格兰德湖（纽芬兰）'],['748','格兰德湖（新不伦瑞克）'],
 ['617','约瑟夫湖（拉布拉多）'],['756','约瑟夫湖（马斯科卡）'],
 ['705','拉克德米勒拉克湖（安大略）'],['746','米勒拉克斯湖（明尼苏达）'],
 ['846','白湖（路易斯安那）'],['8278','白湖（安大略）'],
 ['386','特劳特湖（西北地区）'],['646','特劳特湖（安大略）'],
 ['1427','懂错']
]);
export const lakeZh=(name,builtInZh='',id='')=>builtInZh||LAKE_ID_ZH.get(String(id))||LAKE_ZH.get(name)||'';
const cache=new LakeCache(fetchLakeJSON);
let indexPromise;
function lakeIndex(){return indexPromise??=(fetchLakeJSON('data/lakes/index.json.gz').then(data=>{if(data.schemaVersion!==1||!Array.isArray(data.shards))throw Error('Invalid lake index');return data;}).catch(e=>{indexPromise=null;throw e;}));}
export class LakeLayer {
 constructor(geography,{getIndex=lakeIndex,getShard=s=>cache.get(s)}={}){
  this.geo=geography;this.map=geography.map;this.atlas=geography.atlas;this.getIndex=getIndex;this.getShard=getShard;this.seq=0;this.ready=false;this.status='overview';this.count=0;this.renderSeq=-1;this.contentSeq=-1;this.renderPending=false;this.dead=false;this.labels=[];this.named=[];this.labelKey='';
  this.map.addSource('lake-detail',{type:'geojson',data:EMPTY_LAKES,tolerance:0,maxzoom:14,attribution:'<a href="https://www.hydrosheds.org/products/hydrolakes" target="_blank" rel="noopener">HydroLAKES · Messager et al. (2016) · CC BY 4.0</a>'});
  this.map.addLayer({id:'lake-detail',type:'fill',source:'lake-detail',minzoom:4,paint:{'fill-color':'#466b7d','fill-opacity':0,'fill-antialias':true}},'boundary');
  this.start=()=>{++this.seq;};
  this.move=()=>{if(this.ready&&(!containsLakeBounds(this.coverage,lakeViewport(this.map))||this.coverageTier!==lakeTier(this.map.getZoom()))){this.ready=false;this.sync();}};
  this.end=()=>this.update();this.idle=()=>this.reconcile();
  this.data=e=>{
   if(e.sourceId!=='lake-detail'||this.dead||this.atlas.destroyed)return;
   // A queued setData keeps GeoJSONSource.loaded() false even while the older
   // update emits content. Only the completed current submission opens this gate.
   if(e.sourceDataType==='content'&&this.status==='rendering'&&this.renderSeq===this.seq&&this.map.getSource('lake-detail')?.loaded())this.contentSeq=this.renderSeq;
   if(this.contentSeq===this.renderSeq&&e.isSourceLoaded){this.renderPending=true;this.map.triggerRepaint();}
  };
  this.render=()=>{if(!this.renderPending)return;this.renderPending=false;this.reconcile();};
  this.error=e=>{if(e.sourceId==='lake-detail'&&!this.dead&&!this.atlas.destroyed){this.ready=false;this.status='error';this.sync();}};
  this.map.on('movestart',this.start);this.map.on('move',this.move);this.map.on('moveend',this.end);this.map.on('idle',this.idle);this.map.on('error',this.error);this.map.on('sourcedata',this.data);this.map.on('render',this.render);
 }
 get enabled(){return !this.dead&&this.geo.enabled&&!this.geo.reference&&lakeTier(this.map.getZoom())>0;}
 sync(){if(this.dead||this.atlas.destroyed)return;this.map.setPaintProperty('lake-detail','fill-opacity',this.enabled&&this.ready?1:0);this.geo.referenceVisibility(this.geo.reference);this.geo.syncStatus();this.refreshLabels();}
 reconcile(){this.refreshLabels();if(this.dead||this.atlas.destroyed||!this.enabled||this.ready||this.status!=='rendering'||this.renderSeq!==this.seq||this.contentSeq!==this.renderSeq||this.map.isMoving?.()||this.coverageTier!==lakeTier(this.map.getZoom())||!containsLakeBounds(this.coverage,lakeViewport(this.map)))return;if(this.map.isSourceLoaded('lake-detail')){this.ready=true;this.status='ready';this.sync();}}
 async update(){
  if(this.dead||this.atlas.destroyed)return;
  if(this.enabled&&this.ready&&this.coverageTier===lakeTier(this.map.getZoom())&&containsLakeBounds(this.coverage,lakeViewport(this.map))){this.refreshLabels();return;}
  const seq=++this.seq;this.ready=false;
  if(!this.enabled){this.status='overview';this.sync();return;}
  this.status='loading';this.sync();const visible=lakeViewport(this.map),zoom=this.map.getZoom();let east=visible[2];while(east<visible[0])east+=360;const padX=(east-visible[0])*.2,padY=(visible[3]-visible[1])*.2,bounds=[visible[0]-padX,Math.max(-90,visible[1]-padY),east+padX,Math.min(90,visible[3]+padY)];
  const current=()=>!this.atlas.destroyed&&seq===this.seq&&this.enabled;
  try{
   const index=await this.getIndex();if(!current())return;
   const shards=selectLakeShards(index,bounds,zoom),features=[];let cursor=0;
   const workers=Array.from({length:Math.min(4,shards.length)},async()=>{
    while(cursor<shards.length&&current()){const shard=shards[cursor++],data=await this.getShard(shard);if(!current())return;features.push(...data.features.filter(f=>intersectsLakeBounds(f.bbox,bounds)).map(decodeLakeFeature));}
   });
   const outcomes=await Promise.allSettled(workers);if(!current())return;
   if(outcomes.some(o=>o.status==='rejected'))throw Error('Lake detail temporarily unavailable');
   this.named=features.filter(f=>index.names?.[f.id]).map(f=>({id:f.id,bbox:f.bbox,area:f.properties.area,...index.names[f.id]}));this.coverage=bounds;this.coverageTier=lakeTier(zoom);this.count=features.length;this.status='rendering';this.renderSeq=seq;this.contentSeq=-1;this.renderPending=false;
   this.map.getSource('lake-detail').setData({type:'FeatureCollection',features});
   // Source content plus loaded viewport tiles is enough; an unrelated DEM or
   // regional request must not hold ready lakes behind the map's global idle.
  }catch{if(current()){this.status='error';this.sync();}}
 }
 refreshLabels(){
  if(this.dead||this.atlas.destroyed)return;
  const lang=this.atlas.lang||'bi',visible=this.ready&&this.enabled&&this.atlas.showLabels!==false;
  const blockers=visible&&this.named.length?[...document.querySelectorAll('.map-heading,.map-tools,.layer-panel,.place-marker,.polity-label,.event-marker')].filter(el=>{const style=getComputedStyle(el);return el.getClientRects().length&&style.visibility!=='hidden'&&Number(style.opacity)>.05;}).map(el=>el.getBoundingClientRect()):[];
  const landscape=this.atlas.regional?.halc?.landscape;
  const key=[visible,lang,this.renderSeq,landscape?.revision,landscape?.eligible,this.map.getZoom(),this.map.getCenter?.().lng,this.map.getCenter?.().lat,...blockers.flatMap(r=>[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)])].join(':');
  if(key===this.labelKey)return;this.labelKey=key;
  for(const marker of this.labels)marker.remove();this.labels=[];if(!visible||!this.named.length)return;
  const container=this.map.getContainer(),origin=container.getBoundingClientRect(),bounds=lakeViewport(this.map),placed=[];
  const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  for(const n of [...this.named].sort((a,b)=>b.area-a.area)){
   if(landscape?.covers(n.center))continue;
   if(this.labels.length>=8)break;if(!intersectsLakeBounds([n.center[0],n.center[1],n.center[0],n.center[1]],bounds))continue;
   const a=this.map.project([n.bbox[0],n.bbox[1]]),b=this.map.project([n.bbox[2],n.bbox[3]]);
   if(Math.abs(b.x-a.x)<85||Math.abs(b.y-a.y)<45)continue;
   const p=this.map.project(n.center),box={left:origin.left+p.x-80,right:origin.left+p.x+80,top:origin.top+p.y-18,bottom:origin.top+p.y+18};
   if(box.left<origin.left+10||box.right>origin.right-10||box.top<origin.top+30||box.bottom>origin.bottom-30||[...blockers,...placed].some(r=>overlap(box,r)))continue;
   const zh=lakeZh(n.name,n.zh,n.id);
   const el=document.createElement('div');el.className='lake-label';el.textContent=lang==='en'?n.name:zh||n.name;
   if(lang==='bi'&&zh){const small=document.createElement('small');small.textContent=n.name;el.append(small);}
   this.labels.push(new maplibregl.Marker({element:el,opacityWhenCovered:'0'}).setLngLat(n.center).addTo(this.map));placed.push(box);
  }
 }
 destroy(){this.dead=true;++this.seq;this.renderPending=false;for(const marker of this.labels)marker.remove();this.labels=[];for(const [event,fn]of [['movestart',this.start],['move',this.move],['moveend',this.end],['idle',this.idle],['error',this.error],['sourcedata',this.data],['render',this.render]])this.map.off(event,fn);}
}
