# 经纬纪 · Meridian Atlas 3.9.0

一部可交互的中英文世界历史图集：转动地球，沿时间轴观察疆域；打开国家档案，阅读制度、文化、经济与相关事件。

## 这一版

- 新增 HALC v15 的1500年低地国家地方区划：14,863个单元、原始55项属性，按地图视野读取。细线随比例尺展开；可与全球概览分别对照。
- 点击区划打开“区划资料 / 重建与来源 / 原始字段”三栏档案，阅读领地归属、司法权、教区、重建类别及原始书目；分享链接可直接返回该条记录。档案在宽屏侧置、手机居中，键盘左右键只切换当前栏目。
- 新图层只在1500年、覆盖范围内且放大到地区时读取；切换年份、收起疆域、启用现代参照或载入失败时回到全球概览，保留一键重试与前往覆盖区的入口。
- HALC覆盖低地国家及邻近地区，不覆盖阿尔卑斯。此数据层采用有来源的细致地方轮廓；全球概览的柔化仍是独立的显示选项。详见 [HALC 数据说明](docs/HALC-1500.md)。

- 改进边界柔化：按实际相邻线段与曲线包络检查安全空间，减少阶梯边界残留的直角；小区域采用渐进收缩保护面积。曲线随弯曲程度增加采样点，填色、边线与选择高亮继续共用同一轮廓。

- 国家档案与地图年份对齐：当年资料优先呈现，其他年代、未限定完整日期的条目与百科简介可展开查阅；资料链接与完整下载保留。
- 新增1500年旧瑞士邦联、分治的巴伐利亚与洛林公国的双语篇章；页眉标明所选年份和当前边界记录区间，疆域时间线保留资料空档。洛林地区详图补充这条边界的来源与年代注记。

- 新增可切换的“边界柔化”：对全球概览的阶梯折角作有限圆整，共享国界使用同一曲线，填色与选择高亮同步贴合；保护交汇点、小岛、洞与狭窄地带。关闭后恢复原始轮廓。资料下载和城市归属查询始终采用原始几何。

- 1500年的137个政体原始轮廓合并为约151 KB的一次读取，避免逐份加载产生的等待；坐标与单独归档的原图逐条相同。

- 概览疆域改为低对比细墨线，放大时不再加粗，减少稀疏折线在地形上的生硬感。各时期保留源坐标；详细地区资料可独立阅读。
- 新增可选的 CShapes 2.1 beta（COW）国家与属地图层，覆盖1886—2023年、805段记录。按所选年年中读取，提供日期、首都、来源分类、统治归属、历次记录与独立几何下载；与全球疆域及地区详图分别对照。

- 边界新增自动、全球疆域、地区详图三种来源模式，两图可独立选择并保存链接。自动模式结合当前视野的陆地覆盖切换，局部详图保留一键入口；来源切换即时完成，避免两套轮廓交叠。补回国家级名称，改善跨瓦片地名位置，放大后展开地方区划（含已录入的美国历史县界）。

- 国家档案新增“城市与聚落”：按当前年份连接原始疆域内的地点记录及经核对的首都关系，可按名称、别名和种类筛选。点击城市阅读后，一键返回原国家栏目，保留筛选、列表长度、阅读位置与地图视角。中文输入法组词和后台资料加载互不打断。

- 新增随年份变化的历史街巷、铁路与建筑轮廓，按需读取OpenHistoricalMap。支持街区级缩放、街名标注、年代卡片与来源地图；现代参照开启时自动收起历史街区。各地覆盖密度不同，具体阅读约定集中在“资料”。

- 新增HydroLAKES精细湖岸：1,421,001个湖体、6,153万余个顶点，按视野和比例尺加载。1,115个具名湖泊提供标注，24个重要湖泊有中文译名。现代湖岸的年代与精度说明集中在“资料”。

- 真实地形晕渲、河流湖泊与渐进加载的自然海岸。放大后接入精细高程；近距离自动使用精细海岸和河流轮廓，现代道路、建筑与城市保留为独立开关。
- 历史疆域档案保留固定上游版本的原始坐标；柔化显示与原始档案分开。常用年份直接打开精细地图，其他年份先显示概览，再补齐原始几何。
- 人口观测可选仅当年、前后25年或前后50年；有明确更名证据的城市按观测年命名并避免跨名称时期借样。14条来源记录补充名称沿革；一条同名城市身份冲突记录暂缓展示并保留原档案。
- 11,328条带年代的历史地名与遗址、307条明确时段的首都关系，以及2,042条城市来源记录中的10,348次人口观测。现代地名库单独提供7,342条参照。
- 新增12篇重要城市的原创双语篇章，按确切记录与年代关联：长安、罗马、君士坦丁堡、京都、德里、吴哥、撒马尔罕、巴格达、开罗、廷巴克图、特诺奇蒂特兰、库斯科。分为篇章、记录、来源三栏。
- 搜索同时查找事件、政体、城市及古地名别名。自然海岸、地形、城市、疆域与现代参照均可独立切换。
- 统一年份键盘操作；在输入框编辑年份后，上下键从当前输入继续调整。方向键与地球移动分开，前1年直接接公元1年。
- 分享链接保存年份、图层、阅读对象、投影、地图位置与缩放。切换语言保留地图视角，城市记录和国家栏目继续阅读。
- 平板与手机重新调整工具、年份刻度、搜索卡片与双语导航；地图使用较轻的疆域着色与细描边，让山川和城市成为阅读的一部分。
- 数据分片缓存、并发合并、旧请求取消调度与局部失败重试。脚本和样式使用内容版本号，避免更新后混用旧代码。在线图层不可用时保留本地地理底图。

本版收录343条双语事件（2.0版新增92条），并保留13,380条政体疆域时段记录，以及385条联盟、共主等关系记录，来源为Cliopatria。疆域年代覆盖公元前3400年至2024年。另收录1,450份Wikidata实体档案、26篇双语历史概览和50条历史侧记。330份实体档案包含带引证声明，共1,885项；各国可展示资料的密度不同。事件总数和分布见应用“资料”及 `docs/CONTENT-COVERAGE.json`。

## 打开与使用

3.3 新增地区历史区划：放大到区域时读取 OpenHistoricalMap 的带年代轮廓，按年中切片显示，支持区划档案、来源直达、简体中文标注和原始疆域对照。空白覆盖与失败回退在图层中说明。

在线版：[经纬纪](https://meridian-world-history.zhuozheng2006.chatgpt.site)。沿用原有私有访问范围。

本地版保持整个文件夹完整，在此目录运行：

```sh
python3 serve.py --open
```

macOS也可双击“打开经纬纪.command”。浏览器打开 `http://127.0.0.1:8766/`；端口占用时可用 `python3 serve.py --port 8767 --open`。阅读时保持服务窗口开启，结束后按Ctrl+C。通过启动器访问，而不是直接双击HTML。核心地图、地形晕渲、城市与正文可离线使用；在线精细高程、近距离海岸与河流、现代矢量参照、历史街区及外部来源链接需要网络。

底部输入年份或拖动时间轴，负数表示公元前。播放支持1、10、50、100年步长。地图或时间轴聚焦时，左右键按所选步长移动年份（默认1年），Shift加速10倍；年份输入框用上下键，Enter确认，Esc撤回未提交输入。地图聚焦时Alt+方向键移动视角，+ / −缩放；空格播放与暂停，Esc关闭详情。正文里的空格保留滚动行为，国家栏目支持左右键切换。点击“浏览”显示或收起搜索与事件卡片。

点击地图上的疆域，或从“文明”查找国家，进入分栏档案。疆域栏的面积图按原始时段展示，年份按钮定位对应记录。“城市与聚落”查看这个年代已收录的地点、首都与人口观测；“年表”查看该政体相关事件；“来源”可追溯档案依据及下载完整JSON。

“专题”串联相关历史，“年表”按年代检索全部事件。“年份对照”提供两张同步视角的地图。“分享此页”保留年份、语言、图层、阅读对象及地图位置与缩放；本机地址仅供本机使用，跨设备分享请使用在线版。

## HALC 数据许可

HALC v15（Rombert Stapel）数据集与本项目分发的转换数据遵循 CC BY-SA 4.0。原始数据、代码本、方法和转换说明见 [HALC 数据说明](docs/HALC-1500.md) 与 `public/data/halc/NOTICE.txt`。该许可独立于应用代码的 MIT 许可。原始地方名、复合归属、重建类别及书目原文均保留。

## CShapes 数据许可

应用原创代码采用MIT许可；随项目分发的数据按各自来源许可使用。public/data/cshapes/中的CShapes 2.1 beta（COW版）档案及其转换数据采用CC BY-NC-SA 4.0，包含非商业和相同方式共享要求，不纳入代码的MIT授权。若将项目用于商业用途，应另获该数据授权，或从分发包与部署资源中移除这一数据及其衍生成果；仅在界面关闭图层不会移除已分发的数据。来源、完整署名、转换步骤与文件哈希见CShapes清单及ATTRIBUTIONS.md。

Original application code is MIT-licensed. Bundled datasets retain their individual source licenses. CShapes 2.1 beta (COW edition) in public/data/cshapes/ and its transformed data remain under CC BY-NC-SA 4.0, including noncommercial and share-alike requirements, and are outside the code’s MIT grant. For commercial use, obtain separate data permission or remove this dataset and its derivatives from distributed packages and deployed assets; disabling a visible layer does not remove bundled data. The CShapes manifest and ATTRIBUTIONS.md provide source links, full attribution, transformations and hashes.

## 来源与阅读约定

地图的时间区间、事件的日期和国家资料的时代范围各有依据。年份选择可以精确到一年，同一条源疆域记录也可能覆盖多年。程序沿用源区间，不对缺失年代插值；公元前1年后直接进入公元1年。

疆域留白表示资料未覆盖当地当时的政治地理。地理底图使用现代海岸线；事件标记对应遗址或代表地点。事件库与文明概览为来源导向的精选编写，尚未穷尽世界史，也未逐条经过独立学术同行审稿。

国家结构化条目有年代时按其范围阅读；无年代条目属于实体概况。主文选取附引证的有效声明，并核对来源身份与可能的年代冲突。有效但未附引证的条目放在默认折叠的“百科补充”中，供交叉核对；废弃与未知值保存在下载档案中。明确发现可能时代不符的关联实体暂缓显示补充内容。

中国译名统一为简体；原始档案名称和来源快照另行保留。地图与实体资料更新至项目保存的固定版本，完整来源、许可证与具体限制见应用“资料”、`ATTRIBUTIONS.md`和`docs/`。

## English quick start

Run `python3 serve.py --open` in this folder, keeping the server window open. Bundled maps, relief, places and texts work offline. Fine online elevation, close-zoom coasts and rivers, modern vector reference, historical street detail and external links need internet access. The hosted edition is linked above.

Choose Chinese, English or bilingual reading. Explore the globe and timeline, open a polity’s six-section dossier, compare years, follow thematic journeys, or search the full chronicle. Share links preserve the year, filters, language, layers, historical record and camera position. Explore 11,328 attested historical places, dated capitals, population observations and 12 original bilingual city chapters.

The atlas retains 13,380 polity territory records, 1,450 entity dossiers and 26 original historical overviews. Cited structured statements are displayed with temporal qualifiers where available. Sources centralizes coverage, provenance and editorial conventions; record-specific notes remain in individual dossiers.

## 维护

前端保持静态 HTML、CSS 和 JavaScript，本地运行无需安装前端依赖。在线版使用轻量 Worker 与同一私有站点的对象存储分发精细湖岸；完整本地数据保留在 `public/`。

```sh
npm run prepare:assets
npm test
npm run build
```

- `public/`：可托管、可离线启动的应用。
- `public/data/events.json`：可编辑事件；浏览器读取其压缩副本。
- `public/data/fast/`：首屏目录、概览几何、常用年代和完整记录分片。
- `public/data/enrichment/`：实体档案索引、分片与双语文明概览。
- `public/data/native/`：按原始几何独立分片的精细疆域与保真清单。
- `public/data/physical/`：本地晕渲、海岸、水系与逐文件来源清单。
- `public/data/lakes/`：精细湖岸空间分片、具名湖泊索引与完整转换清单。
- `public/data/places/`：年代地名、人口、首都、城市篇章和来源。
- `editorial/city-narratives.json`：可编辑的原创双语城市篇章。
- `scripts/`：重建与验证脚本。
- `worker/`：精细湖岸的在线读取与校验逻辑；默认构建关闭数据导入入口。
- `dist/`：生成的在线发布包，包含页面资源与 Worker，不包含湖岸大数据分片。
- `docs/`：来源研究、内容覆盖、转换记录与测试结果。

数据更新与重建方法详见 `docs/MAINTENANCE.md`；在线数据分发与导入校验见 `docs/DATA-STORAGE-v3.1.md`。

本次实际验证、仍需深化的范围与截图说明见 `docs/VALIDATION-v3.5.md`。竞品研究基线保留在 `docs/BENCHMARK-BASELINE-2.1.md`。
