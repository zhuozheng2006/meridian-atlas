# 维护与复现 / Maintenance and reproduction

应用使用静态 HTML、CSS、JavaScript 和 MapLibre GL JS，不需要账户、数据库、API 密钥或构建工具。所有运行资源均在 `dist` 中。在线版仍受托管服务的访问权限控制。

## 修改事件

编辑 `dist/data/events.json`。每条记录必须有唯一 `id`，双语 `title`、`summary`、`significance`，`start`、`end`，经纬度 `lon`、`lat`，`region`、`category`、`precision`、`locationType` 以及 `sources`。

- 年份负数为 BCE、正数为 CE；禁止 0。区间包含两个端点。
- `precision`: `year`（年级节点）、`circa`（约略年代）、`range`（历史过程）。
- `locationType`: `site`（相关地点）、`representative`（代表点）。经纬度不可冒充事件完整范围。
- 地区：`east-asia`, `southeast-asia`, `south-asia`, `west-central-asia`, `europe`, `africa`, `americas`, `oceania`, `global`。
- 类别：`politics`, `war`, `culture`, `science`, `trade`, `society`, `religion`, `disaster`。
- 来源至少有 `title` 和 HTTPS `url`。核对正文支持的日期和事实；无法访问的来源应记录待核查状态。

运行 `npm test`。这会校验结构、日期、几何引用和内容完整性，不会替代历史事实审稿。改变版本、条目数或疆域来源时也需更新测试中的版本基准和审计说明。

## 重建疆域

现成资源已能运行。只有修改数据处理方式时才需要以下步骤。

在 `scripts/boundaries` 下创建 Python 环境并安装 `requirements.txt` 中固定版本。`source.json` 保存了原始项目的固定提交、下载 URL 与 SHA-256。原始约44 MB ZIP和165 MB GeoJSON未重复放进交付包。

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python download_source.py
.venv/bin/python build_assets.py
.venv/bin/python refresh_catalog_labels.py
.venv/bin/python validate_assets.py
.venv/bin/python validate_labels.py
.venv/bin/python verify_manifest.py --rebuild
.venv/bin/python verify_manifest.py
```

默认使用包内冻结的名称、文章关联与人工译名缓存。`fetch_labels.py`、`fetch_wikipedia_identity.py` 可刷新缓存，但在线结果可能变化，必须重新审核。`build_assets.py` 的初始标签未经过身份核对，**必须**紧接 `refresh_catalog_labels.py` 才可发布。

检查 `assets/production-manifest.json` 后，把清单里的文件和清单本身复制到项目 `dist/data`，不要覆盖事件库或现代海岸线。重新运行 `npm test`。构建时间会变化，所以重新构建不保证 gzip 字节完全相同；每次发布均保留对应的新清单。

## 精度与争议

上游原名、原始区间、原始身份链接、面积均保留；经核对的实体另存 `verifiedWikidata`。确认错配与待核查状态须分别展示。禁止把缺失疆域补成推测边界，也不可把现代国家图层套到古代。显示几何简化和数据结构校验，不构成史学核验。

升级到新的疆域版本时，应逐一比较新增、删除、年份、名称与几何变动，并修订已知问题清单。要达到研究级精确程度，需要区域历史专家、逐条参考文献、版本化纠错和多源边界重建；当前版本尚未达到这一标准。

## Validation commands

`npm test` runs integrity and calendar checks without network access. `python3 serve.py` serves the packaged application. Use a current browser with WebGL and DecompressionStream. Desktop and phone layouts, language switching, comparison, story navigation and coverage notices were checked in the delivered version; details are in `VALIDATION.md`.


## 2.0 数据层与重建

`dist/data/catalog.json.gz`保持源档案的完整版本；日常首屏使用`fast/catalog.json.gz`，完整记录按256条分片读取。`scripts/build_fast_assets.py`读取既有边界数据，生成0.04°概览、11个常用年份的0.02°启动几何及简体名称；放大后继续使用既有0.02°边界分片。构建依赖Shapely与OpenCC Python Reimplemented，已验证版本分别为2.0.7与0.1.7。转换前后记录ID、有效区间、类型与几何关联必须一致。概览简化导致无效形状时回退到可用输入，原有13条问题记录保留。

事件编辑完成后同时更新`events.json.gz`，推荐`gzip.compress(bytes,mtime=0,compresslevel=9)`。保持原事件ID稳定，重复主题需人工核对，新增标题、摘要与意义应成对提供中英文。对中文显示文本运行OpenCC t2s检查并人工处理术语。

国家补充数据采用`profile-index.json.gz`、`profiles/Q*.json.gz`与`narratives.json`。精确名称与QID匹配后仍需检查年代：`temporalCompatibility.status=potential_conflict`的记录屏蔽补充实体资料。文明短文同时校验QID、源名称、recordIdsOverlappingScope和当前年份是否落在scope内。主文只采用qualified/unscoped/dated_entity_fact中的有效value声明。标为“所选年代”还需明确有足够精度的起止年或匹配时间点。

运行`npm test`可检查原始档案完整性、新旧目录一致性、启动年几何、数据分片、BCE/CE日期运算、叙事时期约束及未引证声明隔离。发布前另做桌面、手机、国家分栏、事件、语言切换与年份对照的浏览器检查。`docs/VALIDATION.md`记录实测证据；静态字节减少不能直接当作所有网络环境下的加载时间倍率。


## 2.1 交互与显示层

`timeline-controls.js`集中处理年份与地图键盘，MapLibre自身键盘处理关闭。左、右地图分别保存待加载年份；地图成功返回后再提交界面年份。读区保持自身滚动、页签语义与焦点，搜索定时器在离开页面时清理。

`product.css`负责产品布局：浏览栏和地图有独立位置，桌面阅读区和地图分栏，手机阅读区覆盖主区域并禁用背后地图焦点。调整布局后仍需检查桌面、834px平板和390px手机。

`labelCenter`是仅用于显示的新字段，在有效几何最大多边形内取代表点，原始`center`保持不变。新增的50m陆地数据来自Natural Earth维护仓库，未经几何变形，仅移除无用属性并gzip；出处、文件哈希和完整性见`BASEMAP-50M.json`。0.04°概览和0.02°细节均属于展示简化，不改变历史源区间、面积或记录身份。

## 3.0 原始几何、自然地理与历史城市

`native-geometry.js`按record ID查找原始形状，避免59组旧简化ID碰撞。常用11年先读取独立年包，其他年份先出概览再进行最多6个并发的精细请求。取消切年后停止调度未开始的旧请求；已经完成的形状供后续导航复用。以下命令在项目根目录执行，原始输入由上述固定版本下载器准备：

```sh
scripts/boundaries/.venv/bin/python scripts/boundaries/build_native_assets.py \
  --source scripts/boundaries/cliopatria.geojson \
  --source-metadata scripts/boundaries/source.json \
  --source-archive scripts/boundaries/cliopatria.geojson.zip \
  --catalog dist/data/fast/catalog.json.gz \
  --display-data dist/data \
  --output build/native-shards
python3 scripts/boundaries/build_small_native_assets.py \
  --input build/native-shards \
  --catalog dist/data/fast/catalog.json.gz \
  --output build/native-release
```

对照`manifest.json`后再替换`dist/data/native`；不要把旧大分片残留在新目录。原始13条无效几何继续保留和注明，构建器不静默修补历史形状。几何精度是显示保真，不能当作历史边界证据精度。

自然底图重建见`../scripts/cartography/README.md`，城市资料重建见`../scripts/places/README.md`。构建器固定来源哈希、实体版本和过滤规则。可变的上游latest地址将来可能无法恢复旧字节，应另外保留经验证的原始下载缓存。现有城市构建重跑的53个压缩文件已与发布资产逐字节比对；地理矢量/海罩重建已逐字节比对，地形瓦片完整解码检查已完成，未重复执行全部地形重投影。

`geography.js`使用三层加载：全球本地概览、区域Natural Earth细图、在线近距离海岸/河流与高程。在线源的metadata不代表瓦片可用；只有真实loaded tile才能首次确认ready。缓存视口往返用已见有效瓦片和`isSourceLoaded`收敛。错误恢复本地层，重试只重新创建失败的源；海岸、地形、现代参照独立控制。`queryRenderedFeatures`会包含透明要素，点击过滤必须与实际可见图层使用同一ready状态。

城市的文化时期、人口观测和首都关系分别保留各自意义。`places.js`按所选年选择确有依据的地点，人口观测采用±50年并显示真实记录年；`city-narratives.js`仅按明确sourceRecordId、时期和观测年份绑定原创篇章。编写新篇章时编辑`editorial/city-narratives.json`，补齐双语段落、机构来源、日期节点、空间/年代说明和绑定反例；再以确定性gzip写入`dist/data/places/city-narratives.json.gz`。

`view-state.js`保存经纬度、缩放、方位与俯仰；URL恢复必须保留左右年份与阅读对象。语言切换不能重新缩放已在阅读的地图。`startup.js`在地图引擎下载前恢复可见年份。

### 当前验证入口

`npm test`包含原有完整性检查，以及原始几何乱序/重试、城市与篇章语义、地图源失败/缓存恢复、分享与键盘状态和发布文件哈希检查。测试使用实际运行模块，在DOM、网络或渲染器边界使用受控替身；它们不能代替真实浏览器视觉验证或历史学审稿。逐文件发布预算为20,000静态文件、单文件25 MiB，换托管平台时重新核查限制。

重新执行检查并保存报告时，可设置`ATLAS_TEST_REPORT`（地理）、`NATIVE_AUDIT_REPORT`（几何）、`STATE_AUDIT_REPORT`（视图状态）。城市篇章检查的第二个位置参数为报告路径。常规测试不会在源码目录新增结果文件。


### 资源更新与城市名称

修改 `dist/` 下的应用脚本或样式后，运行 `npm run prepare:assets`。它以规范化后的全部应用脚本、样式内容计算共享版本号，再更新 HTML 与模块导入链接；`npm test` 首项检查版本是否匹配。版本号跨模块一致，避免循环依赖模块出现两份缓存。JSON 请求重新验证服务器缓存，当前页面内仍合并重复请求。

首都条目缺少可读名称时，构建器会从已锁定版本的同一 Wikidata 坐标实体补齐英文、通用语言和简体中文名称。资料库编号不会充当地名；审核结果见 `capital-label-audit.json`。

`rules/dated-place-names.json` 以精确记录 ID 绑定历史名称和机构依据。人口记录的名称按实际观测年选择；支持指定观测年份集合，不延长城市存在年代。原始研究名与坐标保留；名称说明及链接进入城市“来源”。目前校正江户、长安、君士坦丁堡与特诺奇蒂特兰的已核对记录。补充别名可供搜索，年代筛选仍独立执行。精确名称与明确别名同组排序，优先所选年代的资料，再优先首都记录；普通子串匹配排在其后。

城市篇章现与40条原始记录精确关联，包括618—904年的唐长安首都关系。所有绑定仍由实际时段或实际人口观测约束。
