# 3.89 验证与交接记录

**版本：3.89.0** · **日期：2026-11-18** · **上一版本：[3.88](HANDOFF-3.88.md)**

---

## 本轮核心成果

1. **Wave-23 全量清零：`Pleiades ref >= 3` 全库 100% 权威简体中文完结（[`public/places.js`](../../public/places.js) · [`scripts/validate-places.mjs`](../../scripts/validate-places.mjs)）**
   - 合入 Wave-23 批次二／三及末项余缺共 **`+1,293` 处** Pleiades `referenceCount === 3` 古聚落与遗址权威简体中文译名（含哈尔施塔特、比斯库平遗址、萨尔米泽杰图萨皇家圣城、伊本·瓦尔丹堡、希波库拉、希尔卡尼斯、皮萨、巴坦凯萨拉等），使 [`PLACE_ZH_EDITORIAL`](../../public/places.js) 增至 **`7,712` 条**。
   - 经全库逐档核验，Pleiades `referenceCount` 自 `74` 至 `3` 全部 40+ 个频次分档缺失数为 **`remainingRef4PlusWithoutZh: 0`**、**`remainingRef3WithoutZh: 0`**（100% 完结）。[`scripts/validate-places.mjs`](../../scripts/validate-places.mjs) 新增 8 条实年份回归断言并全部通过（**23 / 23 PASS**）。

2. **湖泊标签防断行修复：苏黎世上湖 `Wangen Lachen` 精简（[`public/lakes.js`](../../public/lakes.js)）**
   - 基于 `v3.88` Chromium 1500 年博登湖放大图视觉审查发现的 `"苏黎世上湖（旺根—拉\n亨）"` 折行断词，将 `Wangen Lachen` 映射精简为 **`苏黎世上湖`**（5 字单行），实测截图 `bodensee-1500-after.png` 与 `bodensee_1500_clean_lake_labels` 确认双湖标签 `["博登湖（康斯坦茨湖）", "苏黎世上湖"]` 舒展清晰无断词。

3. **全面视觉设计深化：年表 `Chronicle`、原图 `Sources`、阅读态年代条与对比视图（[`public/product.css`](../../public/product.css) · [`public/cartography.css`](../../public/cartography.css)）**
   - **年表 `Chronicle`**：为 `.chronicle-table-wrap` 增加黄铜顶缘高光与质感阴影，首列 `.library-year` 采用等宽金色数字呈现，将 `"地图定位 →"` 升级为微交互胶囊标签（悬停亮起）。
   - **资料 `Sources` 原图卡**：为 `.plate-card` 注入右上方暖光径向渐变与顶部描边内高光，并将 `.plate-open`（`"阅读馆藏高清原图 ↗"`）由纯文字链重设为边框黄铜按钮，与 `Polities`、`Journeys` 统一为一致的典藏手稿体系。
   - **阅读态时间轴与图层面板**：修复 `.reading .era-buttons` 受旧规则 `style.css:184` `mask-image` 优先级影响导致 `"当代"` 在桌面阅读态下被误渐隐的问题（实测 `eraMask: "none"`、`eraClippedInReader: false`），并适当扩高 `.reading .layer-panel`、协调对照模式下 `.compare-heading` 与 `.map-tools` 间距。通过 `desktop-1492-after.png`、`chronicle-after.png`、`sources-after.png`、`event-reader-after.png`、`bodensee-1500-after.png`、`laptop-compare-after.png`、`mobile-390-after.png` 7 组截图逐一视觉复核。

---

## 全量验证与实测证据

- `npm run prepare:assets && npm test && npm run test:http && npm run build` 全部以退出码 `0` 通过：
  - `validate-places.mjs`：**23 / 23 PASS**（`PLACE_ZH_EDITORIAL` 共 `7,712` 条，`remainingRef4PlusWithoutZh: 0`、`remainingRef3WithoutZh: 0`）
  - `validate-lakes.mjs`：**17 / 17 PASS**
  - `validate-regional.mjs`：**16 / 16 PASS**
  - `validate-polity-display-names.mjs`：**17 / 17 PASS**
  - `validate-country-display-names.mjs`：`passed: true`（`39` annualCases、`31` rules、`62` endpoints，`originalNamesAndGeometryPreserved: true`）
  - `validate-map-catalog-app.mjs`：**26 / 26 PASS**
  - `npm run test:http`：**14 / 14 PASS**
  - `build-worker.mjs`：`staticStorageFiles: 377` / `storageFiles: 2551`
- Headless Chromium 端到端实测（[`docs/verification-3.89/final-benchmarks.json`](verification-3.89/final-benchmarks.json)，`14` 次独立冷启与 `4` 项实时域检查；全部场景 `consoleErrors: []`、`clippedH: false`、`overlaps: []`、`labelOverlaps: []`、`pinOverlaps: []`）：
  - 非限速首屏：`desktop_1492` **`327 ms`**（`58` 请求），`south_asia_m250` **`244 ms`**，`china_742_regional` **`268 ms`**（`地区详图 · 51 条区划`），`europe_1914_cshapes` **`524 ms`**，`mobile_390_1492` **`316 ms`**（`eventPinsTotal: 52`、`eventPinsVisible: 16`）
  - `1.5 Mbps / 150 ms RTT` 限速：`desktop_1492` **`4,019 ms`**，`south_asia_m250` **`3,811 ms`**，`china_742_regional` **`5,645 ms`**，`europe_1914_cshapes` **`6,139 ms`**，`mobile_390_1492` **`4,029 ms`**
  - 实时域检查：`wave23_complete_ref3_zero_remaining`（`editorialCount: 7712`, `remainingRef4PlusWithoutZh: 0`, `remainingRef3WithoutZh: 0`）、`reading_mode_era_bar_unmasked`（`eraMask: "none"`, `eraClippedInReader: false`）、`bodensee_1500_clean_lake_labels`（`lakes: ["博登湖（康斯坦茨湖）", "苏黎世上湖"]`, `hasZurichUpperClean: true`）、`research_zero_map_assets_and_parchment`（`maplibreCssLoaded: false`, `maplibreJsLoaded: false`, `originalBodyBg: "rgb(255, 252, 244)"`, `originalTextLen: 61216`）

---

## 下一步计划（v3.90.0+）

1. **Wave-24 启动：`Pleiades ref <= 1`（`152` 处）全量清零 + `ref === 2` 首批校译**：先将全库 `ref=0` 与 `ref=1` 全部 **`152` 处**未译遗址一次清零，再切入 `ref === 2` 高价值古遗址批次校译。
2. **首屏关键路径测速与移动端细节再进化**：评估内联核心 CSS / 非关键字体与样式精简压缩、移动端窄屏浏览抽屉（`#sidebar` open 态）视觉核查以及阅读器内部排版微调。
