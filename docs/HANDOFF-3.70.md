# 经纬纪 3.70.0：Wave-5 111 城历史地名、多图层零重叠避让引擎、检索分级与地区浮窗重塑

## 本版三大里程碑

1. **Wave-5 新增 111 处 1900 年前历史城镇与古典遗址双语地名（累计 571 条，`7af77096`）**
   - 核查并补全 Chandler / Modelski 1900 年前历史城市及 `pleiades` 高频古典遗址（含鲁汶 `chandler:824`、基希讷乌 `chandler:303`、索斯特 `chandler:1311`、库施/纳帕塔 `chandler:760`、弗里吉亚阿帕米亚 `pleiades:638751`、克诺索斯 `pleiades:589872` 等共 **111** 条），[`public/places.js`](../public/places.js) 内 `PLACE_ZH_EDITORIAL` 累计达到 **571** 条权威中文映射（零重复、零缺失、零 timeline 遮蔽），并对经纬度错位的上游条目继续保持排除保护；在 [`scripts/validate-places.mjs`](../public/validate-places.mjs) 新增 Wave-5 回归断言并通过。

2. **多图层零重叠避让引擎、检索层级重排与地区浮窗 / 比例尺视觉重塑（`2ebac228`）**
   - **三行宽精确避让与跨层同步**：修复 [`public/places.js`](../public/places.js) `PlaceLayer.refresh()` 忽略第三行人口年份标尺（`人口 · 公元 YYYY 年`）及 CJK 字符真实像素宽度导致的欧洲密集城点重叠问题，改用按字符 Script 分段估算宽度的 `measureLine(...)` 并综合三行最大宽度；同时扩大 [`public/map-engine.js`](../public/map-engine.js) 内 `blockerBoxesFor()` 对事件圆点与战役/暴行菱形图标的安全边距、为 `.polity-label` 碰撞盒增加安全缓冲，并在 `AtlasMap.refreshLabels()` 结尾同步触发 `this.battles?.refresh()` 与 `this.atrocities?.refresh()`。经无头 Chromium 实测，欧洲 `1492`（17 处可见标注）与 `1914 CShapes`（14 处可见标注）双视角均实现 `labelOverlaps: []`、`pinOverlaps: []` 零重叠。
   - **侧栏统一检索分层重排**：移除 [`public/app.js`](../public/app.js) `renderEvents()` 中冗余的 `runPlaces` 重复区块，并将 `renderPlaceSearch()` 插入位置改为紧随 `.polity-results` 之后（若无政体匹配则置顶），同时精选展示前 6 项匹配地点（显示 `6/总数` 指示）；检索 `"罗马"` 时，“政体检索”稳定居于首位（`polityIdx: 0`, `placeIdx: 1`, `duplicatePlaceHitCount: 0`）。配套在 [`public/product.css`](../public/product.css) 为 `.polity-results`（黄铜左饰条）、`#placeResults`（青碧左饰条）、`.search-group`（战史赤铜头栏）、`.battle-hit` 及 `#eventList .empty` 统一 Obsidian × Brass 卡片体系。
   - **比例尺、地区控制条与 `.historical-popup` 重塑**：优化 [`public/cartography.css`](../public/cartography.css) 内 `.maplibregl-ctrl-scale`（Obsidian 磨砂圆角胶囊）、桌面端 `.regional-controls` 垂直错层布局（`bottom: 78px`，彻底远离 `bottom: 44px` 比例尺与底栏图例），以及 `.historical-popup` / `.regional-popup`（Obsidian × Brass 顶部金线卡片、分区数据网格与 `.historical-source-links a` 胶囊按钮）。实测中国 `742` 年地区详图三控件零交叠、弹窗完整清晰。

3. **全场景冷启动 Chromium 基准实测与 `v3.70.0` 正式发布**
   - 所有 8 组主视角／对比视角及 12 项功能域实时校验全部保存于 [`docs/verification-3.70/final-benchmarks.json`](verification-3.70/final-benchmarks.json)，全程 `fullCatalogCalls: 0`、`overlaps: []`、`labelOverlaps: []`、`pinOverlaps: []`、`clippedH: false` 与 `consoleErrors: []`。

## v3.70.0 实测与基准

全部测量由独立无头 Chromium 进程（禁用浏览器缓存、全量 `v3.70.0` 资源戳构建后）采集，完整原始结果见 [`docs/verification-3.70/final-benchmarks.json`](verification-3.70/final-benchmarks.json)：

| 场景 | 首图交互 (`3.70.0`) | `3.69.0` 对照 | `1.5 Mbps / 150ms` 弱网 (`maplibre` / `events` / `year` 发起) | 标签 / 点位 / UI 重叠 | Console Errors |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `desktop_1492` (1440×900) | **`314 ms`** | `309 ms` | `4204 ms` (`443 ms` / `532 ms` / `713 ms`) | `0` / `0` / `0` | `0` |
| `south_asia_m250` | **`229 ms`** | `237 ms` | `4022 ms` (`434 ms` / `523 ms` / —) | `0` / `0` / `0` | `0` |
| `china_742_regional` | **`258 ms`** | `253 ms` | `5835 ms` (`433 ms` / `522 ms` / —) | `0` / `0` / `0` | `0` |
| `europe_1914_cshapes` | **`494 ms`** | `489 ms` | `6374 ms` (`384 ms` / `523 ms` / `706 ms`) | `0` / `0` / `0` | `0` |
| `mobile_390_1492` (390×844) | **`334 ms`** | `333 ms` | `4213 ms` (`434 ms` / `522 ms` / `706 ms`) | `0` / `0` / `0` (`gap +23px`) | `0` |
| `laptop_1280_compare` | **`322 ms`** | `315 ms` | — | `[]` / `clippedH: false` | `0` |
| `tablet_834_compare` | **`313 ms`** | `313 ms` | — | `[]` / `clippedH: false` | `0` |
| `mobile_390_compare` | **`332 ms`** | `350 ms` | — | `[]` / `clippedH: false` | `0` |

- 全套构建与回归检查在最终提交前全部通过：`npm run prepare:assets`、`npm test`、`npm run test:http`（`14/14`）、`npm run build`。

## 后续可继续推进方向

1. 继续为尚未覆盖中文译名的少量英国工业期／近代 `urban-observations`（如 `Rhondda` 等）及 `pleiades` `referenceCount 15–19` 遗址补充 `PLACE_ZH_EDITORIAL` 映射，并扩展至南美／非洲近代观测站。
2. 对 [`name-audit.json`](../public/data/china-prefectures/name-audit.json) 最后 5 项盛唐羁縻／贡州条目补齐正史文献引证核实。
3. 审查多视口缩放时城市点位与邻近战役菱形图标、以及南亚／中欧多边形在中等缩放级下的抽稀阈值与对比模式长文本换行细节，进一步压降首包资源传输字节数。
