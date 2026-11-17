# 经纬纪 3.67.0：首屏模块瀑布消除、坐标异常隔离与 Obsidian × Brass 界面精修

## 本版三大里程碑

1. **冷启动瀑布消除、制图对比与全视图标签防重叠（`d8db37b1`）**
   - 在 [`public/entry.js`](../public/entry.js) 的启动静态依赖预加载队列中补齐 `view-state.js`、`timeline-controls.js`、`research-view.js`、`boundary-mesh.js`、`territory-frame-cache.js`、`border-curves.js`、`country-names.js`、`map-load-priority.js`、`boundary-style.js` 与 `geometry-anchor.js` 等 10 个传递模块，将地图入口静态 ES 模块由多层串行发现折叠为单波并发加载，同时保持研究模式（`#view=research`）零地图模块污染。
   - 在 [`public/map-load-priority.js`](../public/map-load-priority.js) 扩展可选资源识别正则至 `physical/physical-overview`，确保主疆域交互优先完成。
   - 深调 [`public/map-engine.js`](../public/map-engine.js) 深海（`#091e30`）、陆地（`#d4cbb3`）、海岸与天际线（`#050c17` / `#4f758a`）制图对比度，精细化 [`public/cartography.css`](../public/cartography.css) 标签羽化光环，并将 `blockerBoxesFor()` 避让与 `600 14px Georgia, serif` 文本度量校准至与真实渲染一致；visible 标签与事件点／比例尺／控件重叠实测降至 `0`。

2. **全库坐标异常扫描隔离、二批 97 城双语地名补齐与 25 条《两唐书》引证校准（`6762d781`）**
   - 对全库 `2,040` 条都市人口观测记录及现代／古聚落数据集进行半球经纬度边界审查，确认上游 Reba/Chandler 遗漏西半球负号导致落点错入亚洲／孟加拉湾的 3 条记录：`chandler:422`（墨西哥 El Tajín `[97.3782, 20.4481]`）、`chandler:545`（加拿大 Hamilton `[79.866092, 43.250022]`）与 `chandler:1192`（美国 Richmond `[77.4667, 37.5333]`）。在不篡改原始 `.json.gz` 的前提下，于 [`public/places.js`](../public/places.js) 导出 `PLACE_COORD_QUARANTINE` 予以读取期展示与检索隔离，并在 [`scripts/validate-places.mjs`](../scripts/validate-places.mjs) 固化回归测试（`23/23` 通过）。
   - 在 `PLACE_ZH_EDITORIAL` 增补 97 项经过考证的全球历史名城、古典遗址（Pleiades `referenceCount >= 28`）与现代大都市标准中文译名（累计 `190` 条），涵盖比贾布尔、勃固、帕坦、阿帕米亚、廷尼斯、波托西、堺市、格但斯克、费奥多西亚、伊奢那补罗、扎法尔、顺化、呼和浩特、波尔图、苏黎世、科萨、大莱波蒂斯等。
   - 对 [`public/data/china-prefectures/name-audit.json`](../public/data/china-prefectures/name-audit.json) 尚缺正史文献引用的 `deferred` 州府，逐条比对仓库内保存的《旧唐书》《新唐书》地理志原始网页档，核实并补入 25 条准确卷次、条目标题、网页行号及户数原录（`51` 条 `deferred` 决策边界与原始推算记录严格保留，不作臆改）。

3. **全站 Obsidian × Brass 视觉重塑与移动端交互重构（`3.67.0`）**
   - **主地图与图层面板**：为左侧事件列表 `#eventList` 与图层选项 `.layer-options` 增加底部渐隐遮罩（`mask-image`），消除硬裁切感；将图层确认钮 `#layerClose` 从厚重亮黄块改为克制的香槟金边框玻璃按钮；桌面端 `#eraButtons` 在宽屏自动满宽均匀分布。
   - **移动端（`390×844`）防重叠重构**：将移动端 `.map-tools` 从遮挡东半球地球的竖直长条重构为紧凑双行毛玻璃药丸栏，与缩小字号／内边距后的 `.map-heading` 留出实测 `23px` 纯净间距（零横向溢出、零碰撞）。
   - **发现性与多视图统一**：为中国汉唐、CHGIS、AWMC 及欧洲 OHM 地区详图范围增加 `<6` 级时的底部图例提示（`"放大至 6 级查看地区详图"`）；为「文明 Polities」卡片增加 `-3500..2026` 时间跨度比例进度条 `.polity-span`；为「年表 Chronicle」行内标题按钮增加 `"地图定位 →"` 交互引导；消除「研究档案」版本选择与研究阶段占位符的双语文字重复（[`public/research-view.js`](../public/research-view.js)、[`public/research-reader.js`](../public/research-reader.js)）。

## v3.67.0 实测与基准

全部测量由独立无头 Chromium 进程（禁用浏览器缓存、全量 `v3.67.0` 资源戳构建后）采集，完整原始结果见 [`docs/verification-3.67/final-benchmarks.json`](verification-3.67/final-benchmarks.json)：

| 场景 | 首图交互耗时 (`3.67.0`) | `3.66.0` 对照 | 传输字节 / 请求数 | 可见标注碰撞 (`pin` / `UI`) | Console Errors |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `desktop_1492` (1440×900) | `341 ms` | `364 ms` | `3.78 MB` / `76 req` | `0` / `0` | `0` |
| `south_asia_m250` | `255 ms` | `259 ms` | `4.73 MB` / `81 req` | `0` / `0` | `0` |
| `china_742_regional` | `265 ms` | `310 ms` | `5.95 MB` / `80 req` | `0` / `0` | `0` |
| `europe_1914_cshapes` | `512 ms` | `549 ms` | `11.15 MB` / `144 req` | `0` / `0` | `0` |
| `mobile_390_1492` (390×844) | `335 ms` | `366 ms` | `3.14 MB` / `68 req` | `0` / `0` (`heading–tools +23px`) | `0` |
| `laptop_1280_compare` | `335 ms` | `361 ms` | — | `[]` / `clippedH: false` | `0` |
| `tablet_834_compare` | `319 ms` | `393 ms` | — | `[]` / `clippedH: false` | `0` |
| `mobile_390_compare` | `347 ms` | `381 ms` | — | `[]` / `clippedH: false` | `0` |

- `1.5 Mbps / 150ms RTT` 弱网独立冷启动实测：`desktop_1492` 为 `4137 ms`，`south_asia_m250` 为 `4000 ms`，`china_742_regional` 为 `5785 ms`，`europe_1914_cshapes` 为 `6354 ms`，`mobile_390_1492` 为 `4183 ms`；全程 `fullCatalogCalls: 0`。
- 全套资产与回归检查通过：`npm run prepare:assets`、`npm test`、`npm run test:http`（`14/14`）、`npm run build`。

## 后续可继续推进方向

1. 继续从一级史料对读 [`name-audit.json`](../public/data/china-prefectures/name-audit.json) 其余 `deferred` 州府与羁縻州记载，并核实可独立成立的汉代／唐代正史名称线索。
2. 对 `chandler:422`（El Tajín）、`chandler:545`（Hamilton）、`chandler:1192`（Richmond）参照 `urban-quarantine.json.gz` 规范补充结构化勘误归档条目，提供从 UI 到上游错误报告的一键可追溯说明。
3. 深化「专题 Journeys」地图导览视图的交互控制条与分步叙事卡片质感。
