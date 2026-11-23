import {countryAlias} from './country-names.js?v=4.19.1-3bac421450c1';
export {countryAlias} from './country-names.js?v=4.19.1-3bac421450c1';
// CShapes data is independently licensed CC BY-NC-SA 4.0; see data/cshapes/.
const ROOT='data/cshapes/',pending=new Map(),COUNTRY_ZH_FIX=new Map([['Inini','伊尼尼领地'],['Belarus (Byelorussia)','白俄罗斯'],['Myanmar (Burma)','缅甸'],['Cambodia (Kampuchea)','柬埔寨']]);
const CAPITAL_ZH=new Map([
 ['(East) Jerusalem','（东）耶路撒冷'],['Abidjan','阿比让'],['Abu Dhabi','阿布扎比'],['Abuja','阿布贾'],['Accra','阿克拉'],
 ['Addis Ababa','亚的斯亚贝巴'],['Adelaide','阿德莱德'],['Aden','亚丁'],['Algiers','阿尔及尔'],['Almaty','阿拉木图'],
 ['Amman','安曼'],['Amsterdam','阿姆斯特丹'],['Andorra la Vella','安道尔城'],['Ankara','安卡拉'],['Antananarivo','塔那那利佛'],
 ['Apia','阿皮亚'],['Ashgabat','阿什哈巴德'],['Asmara','阿斯马拉'],['Assab','阿萨布'],['Astana','阿斯塔纳'],
 ['Asuncion','亚松森'],['Athens','雅典'],['Baghdad','巴格达'],['Baguida','巴吉达'],['Baku','巴库'],
 ['Bamako','巴马科'],['Bandar Seri Begawan','斯里巴加湾市'],['Bangkok','曼谷'],['Bangui','班吉'],['Banjul','班珠尔'],
 ['Basse-Terre','巴斯特尔'],['Basseterre','巴斯特尔'],['Beijing','北京'],['Beirut','贝鲁特'],['Belgrade','贝尔格莱德'],
 ['Belize City','伯利兹城'],['Belmopan','贝尔莫潘'],['Berbera','柏培拉'],['Berlin','柏林'],['Bern','伯尔尼'],
 ['Bingerville','班热维尔'],['Bishkek','比什凯克'],['Bissau','比绍'],['Bloemfontein','布隆方丹'],['Bogota','波哥大'],
 ['Bolama','博拉马'],['Boma','博马'],['Bonn','波恩'],['Brasilia','巴西利亚'],['Bratislava','布拉迪斯拉发'],
 ['Brazzaville','布拉柴维尔'],['Bridgetown','布里奇顿'],['Brisbane','布里斯班'],['Brussels','布鲁塞尔'],['Bucharest','布加勒斯特'],
 ['Budapest','布达佩斯'],['Buea','布埃亚'],['Buenos Aires','布宜诺斯艾利斯'],['Bujumbura','布琼布拉'],['Bukarest','布加勒斯特'],
 ['Bukhara','布哈拉'],['Cairo','开罗'],['Calcutta','加尔各答'],['Canberra','堪培拉'],['Cape Town','开普敦'],
 ['Caracas','加拉加斯'],['Castries','卡斯特里'],['Cayenne','卡宴'],['Cetinje','采蒂涅'],['Chipata (Fort Jameson)','奇帕塔（詹姆斯森堡）'],
 ['Chisinau','基希讷乌'],['Colombo','科伦坡'],['Conakry','科纳克里'],['Copenhagen','哥本哈根'],['Dakar','达喀尔'],
 ['Damascus','大马士革'],['Danzig','但泽'],['Dhaka','达卡'],['Dili','帝力'],['Djibouti','吉布提'],
 ['Dodoma','多多马'],['Doha','多哈'],['Duala','杜阿拉'],['Dublin','都柏林'],['Durres','都拉斯'],
 ['Dushanbe','杜尚别'],['East Berlin','东柏林'],['East Jerusalem','东耶路撒冷'],['El Aaiun','阿尤恩'],['Finschhafen','芬什港'],
 ['Fort-de-France','法兰西堡'],['Freetown','弗里敦'],['Friedrich-Wilhelmshafen','弗里德里希-威廉港（马当）'],['Funafuti','富纳富提'],['Gaborone','哈博罗内'],
 ['Gaza','加沙'],['Georgetown','乔治敦'],['Gilgit','吉尔吉特'],['Grand Bassam','大巴萨姆'],['Guatemala City','危地马拉城'],
 ['Hanoi','河内'],['Harare','哈拉雷'],['Havana','哈瓦那'],['Helsinki','赫尔辛基'],['Ho','霍城'],
 ['Hobart','霍巴特'],['Hollandia','霍兰迪亚（查亚普拉）'],['Honiara','霍尼亚拉'],['Honolulu','火奴鲁鲁（檀香山）'],['Hue','顺化'],
 ['Iasi','雅西'],['Islamabad','伊斯兰堡'],['Istanbul','伊斯坦布尔'],['Jakarta','雅加达'],['Jerusalem','耶路撒冷'],
 ['Johor Bahru','新山'],['Juba','朱巴'],['Juneau','朱诺'],['Kabul','喀布尔'],['Kampala','坎帕拉'],
 ['Karachi','卡拉奇'],['Kathmandu','加德满都'],['Kaunas','考纳斯'],['Khartoum','喀土穆'],['Khiva','希瓦'],
 ['Kieta','基埃塔'],['Kiev','基辅'],['Kigali','基加利'],['Kingston','金斯顿'],['Kingstown','金斯敦'],
 ['Kinshasa (Léopoldville)','金沙萨（利奥波德维尔）'],['Kokopo','科科波'],['Koror','科罗尔'],['Kuala Lumpur','吉隆坡'],['Kuching','古晋'],
 ['Kuwait','科威特城'],['La Paz','拉巴斯'],['Lagos','拉各斯'],['Lhasa','拉萨'],['Libreville','利伯维尔'],
 ['Lilongwe','利隆圭'],['Lima','利马'],['Lisbon','里斯本'],['Livingstone','利文斯顿'],['Ljubljana','卢布尔雅那'],
 ['Lokoja','洛科贾'],['Lome','洛美'],['London','伦敦'],['Luanda','罗安达'],['Lusaka','卢萨卡'],
 ['Luxembourg','卢森堡'],['Madrid','马德里'],['Majuro','马朱罗'],['Malabo','马拉博'],['Male','马累'],
 ['Managua','马那瓜'],['Manama','麦纳麦'],['Manila','马尼拉'],['Maputo','马普托'],['Maseru','马塞卢'],
 ['Masqat','马斯喀特'],['Mbabane','姆巴巴纳'],['Melbourne','墨尔本'],['Melekeok','梅莱凯奥克'],['Mexico City','墨西哥城'],
 ['Minsk','明斯克'],['Mogadishu','摩加迪沙'],['Mombasa','蒙巴萨'],['Monaco','摩纳哥'],['Monrovia','蒙罗维亚'],
 ['Montevideo','蒙得维的亚'],['Moroni','莫洛尼'],['Moscow','莫斯科'],['Mostar','莫斯塔尔'],['Mukalla','穆卡拉'],
 ["N'Djamena",'恩贾梅纳'],['Nairobi','内罗毕'],['Nassau','拿骚'],['Naypyidaw','内比都'],['New Delhi (Delhi)','新德里（德里）'],
 ['Niamey','尼亚美'],['Nicosia','尼科西亚'],['Nouakchott','努瓦克肖特'],['Nouméa','努美阿'],["Nuku'alofa",'努库阿洛法'],
 ['Old Calabar (Calabar)','卡拉巴尔（旧卡拉巴尔）'],['Oslo','奥斯陆'],['Ottawa','渥太华'],['Ouagadougou','瓦加杜古'],['Palikir','帕利基尔'],
 ['Panama City','巴拿马城'],["Pape'ete",'帕皮提'],['Paramaribo','帕拉马里博'],['Paris','巴黎'],['Pekan','北根'],
 ['Perth','珀斯'],['Phnom Penh','金边'],['Pietermatritzburg','彼得马里茨堡'],['Podgorica','波德戈里察'],['Port Louis','路易港'],
 ['Port Moresby','莫尔兹比港'],['Port-Vila','维拉港'],['Port-au-Prince','太子港'],['Port-of-Spain','西班牙港'],['Porto-Novo','波多诺伏'],
 ['Prague','布拉格'],['Praia','普拉亚'],['Pretoria','比勒陀利亚'],['Pristina','普里什蒂纳'],['Pyongyang','平壤'],
 ['Quezon City','奎松市'],['Quito','基多'],['Rabaul (Simpsonhafen)','拉包尔（辛普森港）'],['Rabat','拉巴特'],['Rangoon','仰光'],
 ['Rawalpindi','拉瓦尔品第'],['Reykjavik','雷克雅未克'],['Riga','里加'],['Rio de Janeiro','里约热内卢'],['Riyadh','利雅得'],
 ['Rome','罗马'],['Roseau','罗索'],['Saigon','西贡'],["Saint George's",'圣乔治'],['Saint Petersburg (Petrograd)','圣彼得堡（彼得格勒）'],
 ['Saint-Denis','圣但尼'],['Saint-Elie','圣埃利'],['Saint-Louis','圣路易'],['San Jose','圣何塞'],['San Juan','圣胡安'],
 ['San Marino','圣马力诺'],['San Salvador','圣萨尔瓦多'],["Sana'a",'萨那'],['Sandakan (Elopura)','山打根'],['Santiago','圣地亚哥'],
 ['Santo Domingo','圣多明各'],['Sao Tome','圣多美'],['Sarajevo','萨拉热窝'],['Sebe','塞贝'],['Seoul','首尔'],
 ['Singapore City','新加坡'],['Skopje','斯科普里'],['Sofia','索非亚'],['Srinagar','斯利那加'],["St. John's",'圣约翰斯'],
 ['Stockholm','斯德哥尔摩'],['Suva','苏瓦'],['Sydney','悉尼'],["T'bilisi",'第比利斯'],['Taipei','台北'],
 ['Taiping','太平'],['Tallinn','塔林'],['Tarawa','塔拉瓦'],['Tarfaya','塔尔法亚'],['Tashkent','塔什干'],
 ['Tegucigalpa','特古西加尔巴'],['Tehran','德黑兰'],['Tetuan','得土安'],['Thimphu','廷布'],['Tirane','地拉那'],
 ['Tokyo','东京'],['Toyohara','丰原（南萨哈林）'],['Tripoli','特里波利'],['Tulaghi','图拉吉'],['Tunis','突尼斯'],
 ['Ulan Bator','乌兰巴托'],['Usumbura','乌松布拉（布琼布拉）'],['Vaduz','瓦杜兹'],['Valletta','瓦莱塔'],['Victoria','维多利亚'],
 ['Vienna','维也纳'],['Vientiane','万象'],['Villa Cisneros','西斯内罗斯城（达赫拉）'],['Vilnius','维尔纽斯'],['Vlore','发罗拉'],
 ['Vryburg','弗雷堡'],['Warsaw','华沙'],['Washington','华盛顿'],['Wellington','惠灵顿'],['Windhoek','温得和克'],
 ['Yamoussoukro','亚穆苏克罗'],['Yaounde','雅温得'],['Yaren','亚伦'],['Yerevan','埃里温'],['Zagreb','萨格勒布'],
 ['Zanzibar City','桑给巴尔市'],['Zinder','津德尔'],['Zungeru','宗格鲁']
]);
export const capitalName=(capital,lang)=>!capital?'—':lang==='en'?capital:(CAPITAL_ZH.get(capital)||capital);
let catalogPromise,catalogValue;
export const countrySnapshot=year=>Number.isInteger(year)&&year>=1886&&year<=2023?`${year}-07-01`:null;
export const countryVisible=(r,date)=>typeof date==='string'&&r.startDate<=date&&date<=r.endDate;
export const countryName=(r,lang,date)=>{const alias=countryAlias(r,date);return lang==='en'?(alias?.en||r.name):(alias?.zh||COUNTRY_ZH_FIX.get(r?.name)||(r?.zhName&&r.zhName!==r.name?r.zhName:'')||r.zhName||r.name);};
export const countryStatus=(value,lang)=>({independent:['独立国家','Independent state'],colony:['殖民地','Colony'],protectorate:['保护国','Protectorate'],occupied:['被占领地区','Occupied territory'],mandate:['委任统治地','Mandated territory']}[value]||['未记载','Not recorded'])[lang==='en'?1:0];
async function readArchive(file,priority='auto'){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{const r=await fetch(ROOT+file,{signal:controller.signal,priority});if(!r.ok)throw Error('CShapes '+r.status);const b=new Uint8Array(await r.arrayBuffer());return b[0]===31&&b[1]===139?await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).json():JSON.parse(new TextDecoder().decode(b));}
 finally{clearTimeout(timer);}
}
export function loadCountryCatalog(priority='auto'){
 if(!catalogPromise)catalogPromise=readArchive('catalog.json.gz',priority).then(c=>{if(!Array.isArray(c.records)||!Array.isArray(c.packs)||c.range?.[0]!==1886||c.range?.[1]!==2023)throw Error('Invalid CShapes catalog');catalogValue=c;return c;}).catch(e=>{catalogPromise=null;throw e;});return catalogPromise;
}
function loadPack(file,priority='auto'){
 if(pending.has(file)){const entry=pending.get(file);pending.delete(file);pending.set(file,entry);return entry.promise;}
 const entry={data:null,promise:null};entry.promise=readArchive(file,priority).then(data=>{entry.data=data;return data;});pending.set(file,entry);entry.promise.catch(()=>{if(pending.get(file)===entry)pending.delete(file);});while(pending.size>3)pending.delete(pending.keys().next().value);return entry.promise;
}
function datedFrame(catalog,geometries,date){
 const records=catalog.records.filter(r=>countryVisible(r,date));
 if(!records.length||records.some(r=>!r.id||!['Polygon','MultiPolygon'].includes(geometries[r.geometryId]?.type)))throw Error('Incomplete CShapes frame');
 return {catalog,date,records,geometries};
}
// Reuse the same three-pack LRU, never a second geometry cache or another year's frame.
export function cachedCountryFrame(year){
 const date=countrySnapshot(year);if(!date||!catalogValue)return null;
 const pack=catalogValue.packs.find(p=>p.decade===Math.floor(year/10)*10),entry=pack&&pending.get(pack.file);
 if(!entry?.data)return null;
 try{const frame=datedFrame(catalogValue,entry.data,date);pending.delete(pack.file);pending.set(pack.file,entry);return frame;}catch{return null;}
}
export async function loadCountryFrame(year,{priority='auto'}={}){
 const date=countrySnapshot(year);if(!date)throw Error('CShapes date outside coverage');
 const catalog=await loadCountryCatalog(priority),decade=Math.floor(year/10)*10,pack=catalog.packs.find(p=>p.decade===decade);if(!pack)throw Error('CShapes decade missing');
 return datedFrame(catalog,await loadPack(pack.file,priority),date);
}
export function countryFeatures(frame,color){return frame.records.map(r=>({type:'Feature',properties:{id:r.id,record_id:r.id,archive:'cshapes',name:countryName(r,'en',frame.date),source_name:r.name,name_en:countryName(r,'en',frame.date),name_zh:countryName(r,'zh',frame.date),start_date:r.startDate,end_date:r.endDate,color:color(r.name)},geometry:frame.geometries[r.geometryId]}));}
