# 经纬纪 3.54：首次加载并行化、换年直达精细边界、联合前后详图

2026-11-12。本批继续在原网站、原访问范围发布并同步 GitHub。生产提交与版本标签、部署结果、线上文件读回证据见 verification-3.54。

## 完成内容

1. 自动模式在 CShapes 覆盖年段同时准备国家边界与概览，先显示先就绪的可用来源。国家边界先到时，不必等待概览；概览先到时，复用已开始的国家请求继续升级。任何一方失败都允许另一方接续，两方失败保留原有错误处理。
2. 同一年代包已就绪时，直接按目标年 7 月 1 日筛选记录并显示精细边界，不先闪回粗图，也不额外读取全球概览。沿用三包 LRU 上限，几何仍为相同对象；切换年份、来源、销毁地图及双地图互不干扰。
3. 修正自动国家边界的区划目录：目录、说明、搜索对象跟随实际显示来源；地区详图覆盖时仍列地区记录。更新局部覆盖模式的中英文说明。
4. 新增不列颠群岛 1706、1707、1801 年详图，分别 10、11、9 条年度记录。1706 保留英格兰、苏格兰两个王国；1707 使用大不列颠王国；1801 使用大不列颠及爱尔兰联合王国。原有年份文件保持原字节，新增文件沿用已固定的 OHM 源快照，未插值边界。

新增三份原始压缩文件共 2,831,102 字节，无损传输版 1,627,795 字节。全站地区快照共 33 份，原始压缩体积 101,921,294 字节，传输版 58,896,361 字节。所有坐标、孔洞、属性及元数据严格还原一致。新增 30 条年度记录不是 30 个新国家，也没有扩大成连续年份覆盖。

## 验证与性能证据

- 完整测试日志为 tests.log；来源几何校验 112/112，首次加载和竞态专项 21/21，目录及加载连续性 26/26，HTTP 13/13。
- 缓存检查覆盖十个年度的精确筛选、相同年代内零额外请求、三包淘汰与失败后重试。
- 保存 3.53 的实际前端文件作为本地对照，使用同一原始地图数据。在浏览器中以年份输入框从 1950 切到 1951：3.53 提交 Cliopatria 和 CShapes 两帧；3.54 只提交 CShapes 一帧。两次最终日期均为 1951-07-01，没有额外边界请求。证据见 browser/warm-comparison.json。
- browser/resource-order.json 记录本地资源顺序。对照页面的浏览器缓存状态不同，部分时间还包含自动操作开销，因此这些时间不能用于宣称生产加载提速百分比。
- 新增年份源坐标逐点核验，并核对关键政体身份的出现和消失。来源快照与原始下载摘要沿用 verification-3.53/britain-source-fetch.json；新验证见 ohm-source-verification.json、britain-chronology.json。

## 独立年代依据及后续

英国议会的[1707 年联合法案说明](https://www.parliament.uk/about/living-heritage/evolutionofparliament/legislativescrutiny/act-of-union-1707/)和[1801 年议会联合说明](https://www.parliament.uk/about/living-heritage/evolutionofparliament/legislativescrutiny/parliamentandireland/overview/parliamentary-union/)支持上述政体转换日期。它们用于年代身份核对，不充当边界顶点的独立测绘证明。

下一步仍应优先补充早期年份与亚洲覆盖缺口，并在同等网络、缓存条件下做冷启动分段测量。本轮发现 Princeton ESOC 有 [1966 年东南亚省界](https://esoc.princeton.edu/data/administrative-boundaries-southeast-asia-provinces)和[国家边界](https://esoc.princeton.edu/data/administrative-boundaries-southeast-asia-countries)候选资料；需要先核查下载内容、日期、完整范围与坐标质量，再决定接入。本轮未将这些候选资料写入地图。
