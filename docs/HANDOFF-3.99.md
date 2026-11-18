# 交接与验证记录 · v3.99.0

- **版本**: `3.99.0`
- **日期**: 2026-11-18
- **主工作区**: `/Users/zane/Documents/ChatGPT/MeridianAtlas`

## 本轮核心推进

1. **修复 HALC 1500 低地国家模式冷启动与深链崩溃（[`public/map-engine.js`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/map-engine.js)、[`public/app.js`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/app.js)）**：
   - 修复直接访问 `#year=1500&boundaries=halc` 等深链或在惰性详情模块加载完成前切换边界模式时因 `_regionalStub()` 内 `halc` 占位对象缺失 `title()` 方法而抛出 `TypeError: r.halc.title is not a function` 导致地图报错中断的重大缺陷：在 [`public/map-engine.js`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/map-engine.js#L216) 补齐 `halc.title()` 占位实现，并在 [`public/app.js`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/app.js#L647) `renderRegionalStatus()` 增加可选链防卫。
   - 实测 HALC 1500 低地国家历史地貌（湿地、泥炭、圩田与古河网）及 `4,156` 条地方区划单元零报错直接秒开。
2. **统一地区控制栏（`.regional-controls`）与边界检索弹窗暗金风格（[`public/cartography.css`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/cartography.css)）**：
   - 消除 `.regional-index` 与 `.regional-popup` 内残留的浅米色输入框（`#fffdf4`）和浅灰模式按钮（`#ece7d6`），统一重构为曜石黑金边控件（`#07101b` 搜索框、`#0b1725` 与鎏金激活态模式芯片及左侧金线区划卡片）。
   - 收紧底部 `.regional-controls` 高度（`min-height: 36px`）与悬停微光交互，使其在欧洲 `1500` OHM 及 HALC `1500` 画面中稳健浮于左下角比例尺之上且留白充裕（`controlsAboveScale: true`、`controlsHeight: 38`）。
3. **补充 `1441 Bong -> 崩错` 藏北高原湖泊 · 全球 HydroLAKES 达 1,114/1,115（99.91%）（[`public/lakes.js`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/lakes.js)、[`scripts/validate-lakes.mjs`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/scripts/validate-lakes.mjs)）**：
   - 依据藏北地理坐标（`31°13′N, 91°09′E`，面积 `141.3 km²`）与 `0262.bin.gz` 实测矢量轮廓（`91.165°E, 31.222°N`，面积 `144.14 km²`）交叉核实，精准补充 **`Bong -> 崩错`**，全库 1,115 处具名湖泊简体覆盖达 **`1,114/1,115（99.91%）`**，仅余 1 处待确证湖泊。

## 验证结果

- **离线构建与全套测试**（`npm run prepare:assets && npm test && npm run test:http && npm run build` 退出码 `0`）：
  - `validate-lakes.mjs`: **18/18 PASS**；`validate-places.mjs`: **23/23 PASS**；`validate-city-time.mjs`: **22/22 PASS**
  - `validate-polity-display-names.mjs`: **17/17 PASS**；`validate-startup-overlap.mjs`: **20/20 PASS**
  - `validate-map-catalog-app.mjs`: **26/26 PASS**；`validate-polaris-pagination.mjs`: **18/18 PASS**
  - `test:http`: **14/14 PASS**；`build-worker.mjs`: `staticStorageFiles: 377` / `storageFiles: 2551`
- **Chromium 实测（[`docs/verification-3.99/final-benchmarks.json`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/docs/verification-3.99/final-benchmarks.json)）**：
  - 全局 `consoleErrors: []`，所有视口 `overlaps: []`、`labelOverlaps: []`、`pinOverlaps: []`、`clippedH: false`。
  - 未限速冷启动 `mapInteractiveMs`：`desktop_1492` **`309 ms`**、`south_asia_m250` **`241 ms`**、`china_742_regional` **`281 ms`**、`europe_1914_cshapes` **`517 ms`**、`mobile_390_1492` **`300 ms`**。
  - `1.5 Mbps / 150 ms RTT` 限速冷启动 `mapInteractiveMs`：`desktop_1492` **`4,004 ms`**（33 个资源，`649,826` 字节）、`south_asia_m250` **`3,812 ms`**、`china_742_regional` **`5,626 ms`**、`europe_1914_cshapes` **`6,111 ms`**、`mobile_390_1492` **`4,014 ms`**。
  - 实时域与视觉核查：`halc_1500_deep_link_and_popup_surface` 实测 `mapErrorText: null`、`regionalStatus: "HALC · 1500 · 4156 条可见区划"`、`popupVisible: true`、`searchBg: "rgb(7, 16, 27)"`；`europe_1500_regional_controls` 实测 `controlsAboveScale: true`、`controlsHeight: 38`；`lakes_1114_bong_co`: `bong: "崩错"`；研究页零地图静态资源加载（`maplibreCssLoaded: false`、`maplibreJsLoaded: false`、`originalBodyBg: "rgb(255, 252, 244)"`、`originalTextLen: 61216`）。

## 后续规划（v4.00.0）

- 将开展全面界面与体验冲刺：清理区划弹窗细滚动条样式、针对 `CShapes / AWMC / 明代城市与聚落标签页 / 暴行与战役详情` 做端到端视觉与交互终检、查漏最后一个冷启动/切年微卡顿优化点，冲刺 **`v4.00.0`** 里程碑。
