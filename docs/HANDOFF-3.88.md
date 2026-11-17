# 3.88 验证与交接记录

**版本：3.88.0** · **日期：2026-11-18** · **上一版本：[3.87](HANDOFF-3.87.md)**

---

## 本轮核心成果

1. **Cliopatria 概览政体与 CShapes 近现代政区 100% 中文覆盖清零（[`public/map-engine.js`](../../public/map-engine.js) · [`public/country-archive.js`](../../public/country-archive.js)）**
   - 在 [`public/map-engine.js`](../../public/map-engine.js) `POLITY_LABEL_ZH_FIX` 中补齐最后 **`10` 个**未译 Cliopatria 政体名（`Taifa of Niebla`、`Namayan`、`Taifa of Morón`、`County of Pallars Jussà`、`Kingdom of Dunoting`、`Taifa of Ronda`、`Taifa of Ceuta`、`Kingdom of Powys Fadog`、`Hashemite Arab Federation`、`Taifa of Tejada`），并修复 **`6` 处**上游机翻瑕疵（`巴厘省 -> 巴厘王国`、`巴达维亚共和国 (荷兰殖民地)总督 -> 巴达维亚共和国`、`墨西哥人 (墨西哥合众国) -> 墨西加诸部（阿兹特克）`、`那不勒斯王国 (1806年－1815年) -> 那不勒斯王国（拿破仑时期）`、`查谟-克什米尔 (土邦) -> 查谟-克什米尔土邦`、`克里特州 (奥斯曼帝国) -> 克里特国（自治邦）`）。
   - 在 [`public/country-archive.js`](../../public/country-archive.js) `countryName()` 中新增 `COUNTRY_ZH_FIX`（`Inini -> 伊尼尼领地`），在不改动源档案契约（[`public/data/cshapes/name-periods.json`](../../public/data/cshapes/name-periods.json)）的前提下，使 `1886–2023` 年 CShapes 全库未译政区归 **`0`**。

2. **Wave-23 批次一：`+550` 处 Pleiades `ref === 3` 古典与古代聚落权威译名（[`public/places.js`](../../public/places.js) · [`scripts/validate-places.mjs`](../../scripts/validate-places.mjs)）**
   - 为 **`550` 处** Pleiades `referenceCount === 3` 古聚落与遗址补齐权威简体中文译名（`PLACE_ZH_EDITORIAL` 由 `5,869` 条增至 **`6,419` 条**，剩余 `Pleiades ref === 3` 降至 **`1,293` 处**），覆盖纳巴达古城（泰勒·贝达尔）、埃布苏斯（伊维萨腓尼基古港）、萨尔遗址（巴林迪尔蒙古城与神庙）、白沙瓦（布路沙布逻）、示罗古城等，并在 [`scripts/validate-places.mjs`](../../scripts/validate-places.mjs) 新增 7 条实年份回归断言。
   - 核验全部 `603` 场战役 `missing nameZh: 0`、`modern-cities` 未译 `0`、活跃 `urban-observations` 未译 `0`、`Pleiades ref >= 4` 未译 `0`。

3. **工具按钮激活态与档案 KPI 指标卡视觉精细打磨（[`public/cartography.css`](../../public/cartography.css) · [`public/product.css`](../../public/product.css)）**
   - 升级地图右上 `.map-tools button.active` 的黄铜渐变、细光晕与悬停交互反馈，并增强 `.fact` KPI 数据卡的衬底对比度、内高光与柔和投影，提升档案抽屉（如明朝档案）数据卡片的信息层级感；通过 `6` 组 Chromium 新截图视觉审查并记录细节打磨项（如博登湖旁 `Wangen Lachen` 换行断词可在 `v3.89.0` 进一步精简）。

---

## 全量验证与实测证据

- `npm run prepare:assets && npm test && npm run test:http && npm run build` 全部以退出码 `0` 通过：
  - `validate-places.mjs`：**23 / 23 PASS**（`PLACE_ZH_EDITORIAL` 共 `6,419` 条）
  - `validate-lakes.mjs`：**17 / 17 PASS**；`validate-lake-readiness.mjs`：**16 / 16 PASS**
  - `validate-regional.mjs`：**16 / 16 PASS**
  - `validate-polity-display-names.mjs`：**17 / 17 PASS**
  - `validate-country-display-names.mjs`：`passed: true`（`39` annualCases、`31` rules、`62` endpoints，`originalNamesAndGeometryPreserved: true`）
  - `validate-map-catalog-app.mjs`：**26 / 26 PASS**
  - `npm run test:http`：**14 / 14 PASS**
  - `build-worker.mjs`：`staticStorageFiles: 377` / `storageFiles: 2551`
- Headless Chromium 端到端实测（[`docs/verification-3.88/final-benchmarks.json`](verification-3.88/final-benchmarks.json)，`14` 次独立冷启与 `4` 项实时域检查；全部场景 `consoleErrors: []`、`clippedH: false`、`overlaps: []`、`labelOverlaps: []`、`pinOverlaps: []`）：
  - 非限速首屏：`desktop_1492` **`328 ms`**（`58` 请求），`south_asia_m250` **`223 ms`**，`china_742_regional` **`281 ms`**（`地区详图 · 51 条区划`），`europe_1914_cshapes` **`500 ms`**，`mobile_390_1492` **`335 ms`**（`eventPinsTotal: 52`、`eventPinsVisible: 16`）
  - `1.5 Mbps / 150 ms RTT` 限速：`desktop_1492` **`4,038 ms`**，`south_asia_m250` **`3,817 ms`**，`china_742_regional` **`5,599 ms`**，`europe_1914_cshapes` **`6,099 ms`**，`mobile_390_1492` **`4,039 ms`**
  - 实时域检查：`global_chinese_completion_and_wave23_b1`（`editorialCount: 6419`, `remainingRef4PlusWithoutZh: 0`, `remainingRef3WithoutZh: 1293`, `modernCitiesUntranslated: 0`, `urbanObsActiveUntranslated: 0`, `cshapesUntranslated: 0`, `ininiZh: "伊尼尼领地"`, `konigsberg1900: "柯尼斯堡"`）、`europe_1808_batavia_naples_fixes`（`hasBataviaClean: true`）、`polities_ming_dossier`（`title: "明朝Ming dynasty"`, `hasSidebarDot: true`）、`research_zero_map_assets_and_parchment`（`maplibreCssLoaded: false`, `maplibreJsLoaded: false`, `originalBodyBg: "rgb(255, 252, 244)"`, `originalTextLen: 61216`）

---

## 下一步计划（v3.89.0+）

1. **Wave-23 批次二／三：全量剩余 `1,293` 处 `Pleiades ref === 3` 古聚落 100% 清零**：将 [`public/places.js`](../../public/places.js) 中 `PLACE_ZH_EDITORIAL` 推进至 **`7,712` 条**，实现全库 `Pleiades referenceCount >= 3` 未译清零（`remainingRef3WithoutZh: 0`）。
2. **界面重设计深化与排版／性能打磨**：优化 `Wangen Lachen` 湖泊标签短名防折行断字，深化年表 `Chronicle` / 专题 `Journeys` / 阅读器排版与视觉质感，并继续排查冷启动渲染关键路径压缩空间。
