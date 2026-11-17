# 3.90 验证与交接记录

**版本：3.90.0** · **日期：2026-11-18** · **上一版本：[3.89](HANDOFF-3.89.md)**

---

## 本轮核心成果

1. **Wave-24 首轮：`Pleiades ref=0/1`（`152` 处）全量 100% 清零 + `ref === 2` 高价值精选 `+270` 处（[`public/places.js`](../../public/places.js) · [`scripts/validate-places.mjs`](../../scripts/validate-places.mjs)）**
   - 一次性补齐全库全部剩余 `Pleiades referenceCount === 0`（`2` 处）与 `referenceCount === 1`（`150` 处）历史聚落（包括塔勒伊卜利斯冶铜遗址、塔维兰古城、梅里姆达新石器遗址、苏丹卡拉、萨哈卜、迈达穆德、阿布萨拉比赫古遗址、洛桑纳罗马港、阿尔莫格拉等 **`152` 处**），并同步完成前 **`270` 处**高频多期 `referenceCount === 2` 重点遗址（拉塔基亚、卡尔巴拉、锡亚勒克遗址、毕达哥拉斯港、阿波洛戈斯古港、马安、赞詹、尼代、塔伊兹、乌拉卡山堡、乌普利斯齐赫、莫迪因等），合计 **`+422` 处**，使 [`PLACE_ZH_EDITORIAL`](../../public/places.js) 跃升至 **`8,134` 条**。
   - 经全库实时核验，`remainingRef4PlusWithoutZh: 0`、`remainingRef3WithoutZh: 0`、**`remainingRef1WithoutZh: 0`**、**`remainingRef0WithoutZh: 0`**；全库未译遗址仅余 `ref === 2` 分档共 **`3,800` 处**。[`scripts/validate-places.mjs`](../../scripts/validate-places.mjs) 新增 `10` 条实年份回归断言并全部通过（**23 / 23 PASS**）。

2. **移动端浏览抽屉防遮挡修复与年表移动卡片视觉升级（[`public/product.css`](../../public/product.css)）**
   - 通过 `390×844` 移动端打开「浏览」态截图审计，发现 `.maplibregl-ctrl-bottom-right`（右下角 `+ / - / i` 缩放控件）在展开 `#sidebar` 时与浮动的 `.scope`（`所选年代 / 全部年代 / ±50 年`）胶囊产生垂直重叠。本轮将移动端展开态 `#sidebar` 高度由 `166px` 微调至 **`174px`**，上移 `.maplibregl-ctrl-bottom-right` 至 `bottom: 228px; right: 8px`（保持 `browse-hidden` 态 `bottom: 10px`），实测 **`overlapScope: false`**、控件与筛选胶囊净间距 **`9 px`**，水平事件卡片底部留白从容不裁切。
   - 为 `.scope` 胶囊注入黄铜描边与层次阴影，为移动端 `.chronicle-table tr` 增加 `2px` 顶部黄铜描边与阴影，并通过 `mobile-browse-open-after.png`、`mobile-chronicle-after.png` 等 `5` 组新截图完成视觉复核。

3. **限速 `1.5 Mbps / 150 ms RTT` 首屏加载瀑布流分析验证**
   - 通过 CDP 实测拆解 `desktop_1492` 在 `1.5 Mbps / 150 ms RTT` 下的精确加载瀑布流：`assets/maplibre-gl.js`（`247,741 B` 压缩传输）与 `year-1492.json.gz`（`150,207 B`）并行占用下行带宽，其余 `16` 个小模块与 `data/land.geojson`（`51,317 B`）均已在 `2,055 ms` 内随行完成并由 `maplibre-gl.js` 抵达（`3,767 ms`）后 `103 ms` 即就绪底图、再 `146 ms` 触发 `meridian:map-interactive`。确认当前非研究态首屏架构已贴近该带宽与 RTT 物理下限，新增 `+422` 词条未增加首帧交互阻塞字节（`653,460 B`）。

---

## 全量验证与实测证据

- `npm run prepare:assets && npm test && npm run test:http && npm run build` 全部以退出码 `0` 通过：
  - `validate-places.mjs`：**23 / 23 PASS**（`PLACE_ZH_EDITORIAL` 共 `8,134` 条，`ref=0/1/3/4+` 均 `0` 缺失）
  - `validate-lakes.mjs`：**17 / 17 PASS**
  - `validate-regional.mjs`：**16 / 16 PASS**
  - `validate-polity-display-names.mjs`：**17 / 17 PASS**
  - `validate-country-display-names.mjs`：`passed: true`（`39` annualCases、`31` rules、`62` endpoints，`originalNamesAndGeometryPreserved: true`）
  - `validate-map-catalog-app.mjs`：**26 / 26 PASS**
  - `npm run test:http`：**14 / 14 PASS**
  - `build-worker.mjs`：`staticStorageFiles: 377` / `storageFiles: 2551`
- Headless Chromium 端到端实测（[`docs/verification-3.90/final-benchmarks.json`](verification-3.90/final-benchmarks.json)，`14` 次独立冷启与 `3` 项实时域检查；全部场景 `consoleErrors: []`、`clippedH: false`、`overlaps: []`、`labelOverlaps: []`、`pinOverlaps: []`）：
  - 非限速首屏：`desktop_1492` **`330 ms`**（`58` 请求），`south_asia_m250` **`221 ms`**，`china_742_regional` **`279 ms`**（`地区详图 · 51 条区划`），`europe_1914_cshapes` **`530 ms`**，`mobile_390_1492` **`310 ms`**
  - `1.5 Mbps / 150 ms RTT` 限速：`desktop_1492` **`4,021 ms`**，`south_asia_m250` **`3,811 ms`**，`china_742_regional` **`5,597 ms`**，`europe_1914_cshapes` **`6,123 ms`**，`mobile_390_1492` **`4,034 ms`**
  - 实时域检查：`wave24_ref0_ref1_zero_and_ref2_b1`（`editorialCount: 8134`, `remainingRef4PlusWithoutZh: 0`, `remainingRef3WithoutZh: 0`, `remainingRef1WithoutZh: 0`, `remainingRef0WithoutZh: 0`, `remainingRef2WithoutZh: 3800`）、`mobile_browse_zoom_zero_overlap`（`overlapScope: false`, `gapAboveScopePx: 9`, `sidebarHeight: 174`）、`research_zero_map_assets_and_parchment`（`maplibreCssLoaded: false`, `maplibreJsLoaded: false`, `originalBodyBg: "rgb(255, 252, 244)"`, `originalTextLen: 61216`）

---

## 下一步计划（v3.91.0+）

1. **Wave-24 批次二（`+400` 处 `Pleiades ref === 2` 核心名城）**：率先将已校译就绪的 **`400` 处**高权重 `ref === 2` 名城（王舍城 `Rājagṛha`、舍卫城 `Śrāvastī`、毗舍离 `Vaiśālī`、奔那罗城、泰勒莱兰 `Tell Leilan`、马扎卡 `Mazaka`、杜恩贝格、老图卢兹、波马里亚等）并入词表，将全库剩余 `ref === 2` 压降至 **`3,400` 处**以下（总词条突破 **`8,500+`**）。
2. **对照面板／专题页／图例交互体验再打磨**：持续巡检中等屏宽与深层交互细节，让地图配色、阅读质感与加载体验继续精进。
