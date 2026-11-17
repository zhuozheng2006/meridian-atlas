# 经纬纪 3.66.0：全球古今都市双语地名体系、对比年份差／互换与邻年预热优化

## 本轮成果总览

1. **主年份题签卡、双图对比交互与移动端时代居中（[`cartography.css`](../public/cartography.css)、[`app.js`](../public/app.js)）**
   - **磨砂黑曜石 `.map-heading` 年份题签卡**：为主视图顶部年份题签加入半透明磨砂玻璃质感、精细微光镶边与层级阴影，提高全球底图及浅色地形区域上的文本对比度。
   - **双图对比模式年份差与一键互换（`syncCompareControls` / `swapCompareYears`）**：新增 `#compareDelta` 准确计算跨公元零年（无公元 0 年）的左右对比间隔（如 `1492` 对照 `1900` 显示 `+408 年`，互换后转为 `−408 年`），并新增 `#compareSwap`（`⇄`）按钮实现左右年份并发对调与状态防重入。
   - **移动端 `#eraButtons` 激活年代自动居中**：在 `renderYear()` 中为时代按钮条补齐激活态居中对齐逻辑（兼容 `prefers-reduced-motion`），实测 `390×844` 移动端 `#year=1492` 首屏即把“全球相遇”置入可见区 `[152..214]` px。

2. **全球 93 处古今都市／遗址双语地名体系与盛唐 `742` 歙州・温州文献互证（[`places.js`](../public/places.js)、[`name-audit.json`](../public/data/china-prefectures/name-audit.json)、[`validate-places.mjs`](../scripts/validate-places.mjs)）**
   - **只读派生映射 `PLACE_ZH_EDITORIAL`（`editorialPlaceZh`）**：在不改动任意原始 `.json.gz` 压缩档案、且绝不覆盖既有 `datedNames` 或 `nameTimeline` 改名时序的前提下，为 **93** 处尚无上游中文标注的核心历史都市、现代百万人口城市及高被引古典聚落提供双语显示与检索支持：
     - Chandler 历史都市观测 **44 项**（含毗奢耶那伽罗 `Vijayanagar`、高尔/高达 `Gauda`、格拉纳达 `Granada`、镰仓 `Kamakura`、蒲甘 `Bagan`、马拉喀什 `Marrakech`、萨莱 `Sarai`、哈萨 `Al-Hasa`、热那亚 `Genova`、诺夫哥罗德 `Novgorod`、普雷斯拉夫 `Preslav`、特里尔 `Trier`、米利都 `Miletus`、尼姆鲁德 `Nimrud`、波斯波利斯 `Perspolis`、八剌沙衮 `Balasaghun`、隞/郑州 `Ao`、潞城 `Lucheng`、天水 `Tianshui` 等）；
     - Modelski 古代都市 **7 项**（克诺索斯 `Knossos`、二里头 `Erlitou`、摩亨佐-达罗 `Mohenjodaro`、梅里达 `Merida` 等）及现代百万人口都市 **23 项**（乌鲁木齐 `Urumqi`、杜塞尔多夫 `Dusseldorf`、东柏林 `East Berlin`、启东 `Qidong`、常熟 `Changshu`、江阴 `Jiangyin`、宿迁 `Suqian`、宜兴 `Yixing`、瑞安 `Ruian`、防城港 `Fangchenggang`、顿河畔罗斯托夫 `Rostov-on-Don`、埃卡特佩克 `Ecatepec`、戈亚尼亚 `Goiania`、卡卢坎 `Caloocan City` 等）；
     - Pleiades 高被引古典聚落（`ref ≥ 30`）**19 项**（巴尔米拉 `Palmyra`、奥斯蒂亚 `Ostia`、以弗所 `Ephesus`、科林斯 `Corinthus`、赫库兰尼姆 `Herculaneum`、杜拉-欧罗波斯 `Doura/Europos`、埃克巴坦那 `Ecbatana`、阿佛洛狄西亚 `Aphrodisias`、锡巴里斯 `Sybaris/Thurii/Copia`、普泰奥利 `Dikaiarcheia/Puteoli` 等）。
   - **盛唐 `742` 歙州（`PrefID 117`）与温州（`PrefID 90`）双志完整存照**：在 [`name-audit.json`](../public/data/china-prefectures/name-audit.json) 中为全库最后 2 条早期简注待考记录补齐 `id`、`sourcePrefNAM`、`ProvNAM`、`primaryHeading`、`sourceRecordPopulation`、`observedWebLine`、`populationInText`、`newTangPopulationInText` 及《旧唐书·卷四十》《新唐书·卷四十一》双源证据条目（歙州源录口 `249,109` vs 两唐书 `269,109`；温州源录口 `141,690` vs 旧唐 `241,694`、新唐 `241,690`）。全库 51 项待考记录现已全部具备完备对读出处，369 / 420 已核准记录保持零破坏。
   - **新增隔离与检索单测**：[`validate-places.mjs`](../scripts/validate-places.mjs) 新增测试覆盖（`22/22` 全部通过），断言冻结源对象属性零篡改且既有 `nameTimeline` / `datedNames` 城市维持分期显示契约。

3. **邻年步进、播放与悬停聚焦预热优化（[`app.js`](../public/app.js)）**
   - 新增 `warmYearTarget` 与 `warmNextStep`，严格门控于 `atlasReady === true` 且 `pendingYear === null`（完全不介入冷启动首屏信道与 `#view=research` 静态隔离）。
   - 用户交互就绪后，在年份步进提交后（`120 ms` 播放间隔／`220 ms` 步进闲时）及指针悬停／键盘聚焦 `#prevYear`、`#nextYear`、`#playBtn` 时，仅预热下一目标年对应的 25 年疆域目录包与原生时序帧（非 CShapes 模式下）。

## v3.66.0 实测与基准

全部测量由独立无头 Chromium 进程（禁用浏览器缓存、全量 `v3.66.0` 资源戳构建后）采集（完整数据见 [`docs/verification-3.66/final-benchmarks.json`](verification-3.66/final-benchmarks.json)）：

| 场景 | 直连冷启动 (`map-interactive`) | 1.5 Mbps / 150ms 限速 | 首屏请求 `native-content-hashes.js` / 全目录 | 重叠 / 控制台报错 |
| --- | --- | --- | --- | --- |
| `desktop_1492` (`1440×900`) | **364 ms** | **4,118 ms** (`720,145 B`) | `false` / `0` 次 | 0 / 0 |
| `south_asia_m250` (`-250`, 1440) | **259 ms** | **3,994 ms** (`719,471 B`) | 按需读取 / `0` 次 | 0 / 0 |
| `china_742_regional` (`742`, Zoom 6.6) | **310 ms** | **5,765 ms** (`891,552 B`) | 按需读取 / `0` 次 | 0 / 0 |
| `europe_1914_cshapes` (`1914`, 1440) | **549 ms** | **6,348 ms** (`1,052,109 B`) | `false` / `0` 次 | 0 / 0 |
| `mobile_390_1492` (`390×844`) | **366 ms** | **4,132 ms** (`720,145 B`) | `false` / `0` 次 | 0 / 0 |

多端对比视图防重叠复核（`1280×720` `361 ms`、`834×1194` `393 ms`、`390×844` `381 ms`，`overlaps=0`、`clippedH=false`）、线上功能校验与性能对比全部通过且 **0 控制台报错**：
- 双图对比一键互换：`beforeDelta="+408 年"` -> 点击 `#compareSwap` -> `afterDelta="−408 年"`（左 `1900`、右 `1492`）；
- `1492` 年地图 `Gauda`（`chandler:474`）显示 `高尔（高达）`，随后连续 `#nextYear` 暖切换耗时 `1502: 161 ms`、`1512: 158 ms`、`1522: 150 ms`（`1.5 Mbps` 下预热跨目录边界 `1522 -> 1532` 步进由 `5.6s` 级别降至 **1,566 ms**）；
- 公元 `200` 年 `Palmyra`（`pleiades:668331`）显示 `巴尔米拉`；`-1345` `阿玛尔纳` 无 `尼托斯` 残留；`742` 无 `Q101583`（底比斯）错误残留；`1570` `马德里` 正常显示；
- `390×844` 移动端 `#eraButtons` 自动居中“全球相遇”（`[152..214]`），移动端年表 709 行 `clippedH=false`。
