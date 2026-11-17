# 经纬纪 · Meridian Atlas — 3.82 交接与验证记录

## 本阶段完成项（v3.82.0）

1. **Wave-17 历史地名全量汉化（Pleiades `ref >= 9` 2,132 处 100% 覆盖，`2,810` 条编辑词条）**
   - 在 [`public/places.js`](../public/places.js) 补充全部 291 处 `Pleiades referenceCount === 9` 古典与古代聚落，编辑词条总数达到 **2,810** 条（全库全部 `2,132` 处 `Pleiades ref >= 9` 聚落实现 100% 中文覆盖，`remainingRef9PlusWithoutZh: 0`）。
   - 新增代表地标包括：**巴士拉**（Basra）、**拉尔萨**（Larsa）、**希伯仑**（Hebron）、**叶斯里卜（麦地那旧名）**（Iathrippa / Yathrib）、**阿蒙（锡瓦）**（Ammon）、**阿瓦里斯（比兰塞旧址）**（Avaris / Pi-Ramesse）、**库里昂**（Kourion）、**喀罗尼亚**（Chaeronea）、**卡吕冬**（Calydon）、**俄庇斯**（Opis）、**亚琛（格拉努斯温泉）**（Aquae Granni）、**塞哥维亚**（Segovia）、**庞佩洛（潘普洛纳）**（Pompaelo）、**蒂斯德鲁斯（艾尔·杰姆）**（Thysdrus）、**萨瓦里亚（松博特海伊）**（Savaria）。
   - 在 [`scripts/validate-places.mjs`](../scripts/validate-places.mjs) 新增 15 条 Wave-17 活跃年代校验断言，并验证零重复键与全量 `ref >= 9` 零遗漏。

2. **CShapes 历史分期悬停读数修复与图元渲染性能/无障碍优化**
   - [`public/boundary-controller.js`](../public/boundary-controller.js) 新增 `countryLabel(r, lang)`，结合当前年份解析 `_countryMod.countryName(r, lang, frame.date)`；[`public/map-engine.js`](../public/map-engine.js) `setHover()` 改用 `this.boundaries.countryLabel(...)`，修复 1886–2023 年 CShapes 时期悬停卡片显示原始现代国名的问题（实测 1914 年悬停显示 **俄罗斯帝国 / Russian Empire · 1914-04-17 — 1917-12-05**，1945 年显示 **苏联 / Soviet Union**）。
   - `AtlasMap.refreshLabels()` 缓存共享 `_measureCtx` 测量上下文，消除每帧重复创建离屏 `<canvas>` 的开销；`AtlasMap.reset()` 遵循 `prefers-reduced-motion`；`AtlasMap.destroy()` 同步销毁 `battles` 与 `atrocities` 图层。
   - [`public/battles.js`](../public/battles.js) 与 [`public/atrocities.js`](../public/atrocities.js) 的 `refresh()` 将 `overlayBlockerBoxes('.map-legend,.place-marker:not(.dot-only)')` 纳入碰撞箱计算，避免战役/暴行标签与图例或可见城市标注重叠。
   - [`public/places.js`](../public/places.js) `PlaceLayer.setModern(v)` 增加 `if (this.modern === next) return` 防抖，消除初始化阶段的重复 `loadPlaces`/`setYear` 调用；[`public/app.js`](../public/app.js) 优化 `placeEventsHTML()` 循环外提升 `cosLat` 计算，并清理 `renderRegionalStatus()` 冗余 `!map.showBorders` 判断。

## 验证与基准实测（`docs/verification-3.82/final-benchmarks.json`）

- **全量校验、HTTP 与构建**：`npm run prepare:assets && npm test && npm run test:http && npm run build` 全部通过（exit code `0`；`26/26` 地图应用校验、`14/14` HTTP 检查、生产构建 `377` 个静态资源/`2,551` 条存储文件）。
- **隔离冷启动性能（14 组无缓存 Chromium 进程）**：
  - `desktop_1492`：非限速首交互 **`312 ms`**（`domInteractiveMs: 10 ms`、`countryArchiveLoaded: false`、`fullCatalogRequested: false`）；1.5 Mbps / 150ms RTT 限速首交互 **`4,021 ms`**（`644,577 B`、`34` 个请求）。
  - `south_asia_m250`：非限速 **`221 ms`** / 限速 **`3,811 ms`**；`china_742_regional`：非限速 **`268 ms`** / 限速 **`5,573 ms`**；`mobile_390_1492`：非限速 **`299 ms`** / 限速 **`4,030 ms`**；`europe_1914_cshapes`：按需加载 `countryArchiveLoaded: true`（`500 ms` / `6,052 ms`）。
  - Multi-viewport：`laptop_1280_compare` (`341 ms`)、`tablet_834_1492` (`332 ms`, `eraButtonsClipped: false`, `toolsHeight: 44`)、`tablet_834_compare` (`360 ms`, `eraButtonsClipped: false`, `toolsHeight: 44`)、`mobile_390_compare` (`362 ms`) 全部实现 `overlaps: []`、`labelOverlaps: []`、`pinOverlaps: []`、`clippedH: false`、`consoleErrors: []`。
- **实机视觉与域回归检查**：
  - `cshapes_dated_hover_cards`（实机截图检查）：1914 年悬停俄罗斯显示 `俄罗斯帝国` / `Russian Empire`（`1914-04-17 — 1917-12-05`），1945 年显示 `苏联` / `Soviet Union`，地图标签与战役图钉零重叠。
  - `wave17_ref9_completion`：`editorialCount: 2810`、`remainingRef9PlusWithoutZh: 0`。
  - `research_zero_map_assets_and_parchment`（`maplibreCssLoaded: false`、`maplibreJsLoaded: false`、`rgb(255, 252, 244)`、`61,216` 字符）、`east_asia_1000ce_song_and_kaifeng`（北宋、唯一开封标注、`noZhPlaces: []`、`labelHits: []`）、`polities_dossier_and_export_btn`（`eventsTabRenderMs: 1.2`、`hasExportBtn: true`）全部通过。

## 后续计划（v3.83.0）

- **Wave-18 历史地名汉化（Pleiades `ref === 8` 335 处聚落 + 青铜时代地中海东岸增补）**：覆盖全部 `Pleiades ref >= 8` 古典与近东聚落，并补全公元前 1457 年美吉多战役视野下的恩科米（Enkomi）、阿沙尔奈（Asharne）、贝特米尔西姆丘（Tell Beit Mirsim）等站点。
- **样式冗余清理与首屏脚本调度审计**：清理 `public/research-reader.css` 冗余 `@media(max-width:700px)` 规则，评估 `simplified-chinese.js` 与详细地理图层在首屏 `startGeography()` 中的按需延迟加载策略，以及多视图细节打磨。
