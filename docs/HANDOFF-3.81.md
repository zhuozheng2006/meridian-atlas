# 经纬纪 · Meridian Atlas — 3.81 交接与验证记录

## 本阶段完成项（v3.81.0）

1. **Wave-16 历史地名全量汉化（Pleiades `ref >= 10` 100% 覆盖，`2,519` 条编辑词条）**
   - 在 [`public/places.js`](../public/places.js) 的 `PLACE_ZH_EDITORIAL` 补充全部 281 处 `referenceCount === 10` 古典与青铜时代聚落，编辑词条总数达到 **2,519** 条（全部 **1,841** 处 `Pleiades ref >= 10` 聚落实现 100% 中文覆盖，`remainingRef10PlusWithoutZh: 0`）。
   - 新增代表地标包括：**赫利奥波利斯**（Heliopolis）、**马里**（Māri）、**尼普尔**（Nippur）、**阿达卜**（Adab）、**高加米拉**（Gaugamela）、**古扎纳（哈拉夫丘）**、**比布鲁斯（朱拜勒）**、**以革伦**、**撒勒法**、**德丹（欧拉）**、**埃格拉（玛甸沙勒）**、**伊斯法罕（阿斯帕达纳）**、**设拉子**、**菲鲁扎巴德**、**第比利斯**、**辛吉杜努姆（贝尔格莱德）**、**马拉卡（马拉加）**、**米拉**、**拉泰（莱斯特）**等。
   - 在 [`scripts/validate-places.mjs`](../scripts/validate-places.mjs) 新增 12 条活跃年代校验断言，并验证零重复键、零 `ref >= 10` 遗漏。

2. **平板 / 中屏排版修复与跨表冗余清理（[`public/product.css`](../public/product.css) · [`public/cartography.css`](../public/cartography.css) · [`public/style.css`](../public/style.css)）**
   - 修复 834px 等平板视口底部 `#eraButtons` 水平溢出裁剪导致最左“早期人类”被截断为“类”的问题：在 `@media(min-width:761px) and (max-width:1149px)` 紧凑均衡排布全部 12 枚时代按钮（实测 `eraButtonsClipped: false`），并在窄屏滚动状态增加 `scroll-padding-inline` 与双侧渐隐遮罩。
   - 修复 `@media(max-width:1020px)` `.map-tools` 过早折行（`max-width:225px` 强制两行），在平板非对照模式恢复单行紧凑排列（`toolsHeight: 44`）。
   - 清理 `style.css` 对 `product.css` 的过时覆盖规则（`main{height:calc(100dvh - 282px)}`、`#contentView{height:calc(100dvh - 118px)}` -> `98px`、`.quality-counts` 旧规则、`1500px` 侧栏宽度冲突等）以及 `product.css` 重复规则。

3. **CShapes 档案按需真懒加载（[`public/boundary-controller.js`](../public/boundary-controller.js)）**
   - 移除 `boundary-controller.js` 顶层对 `country-archive.js`（及其下游 `country-names.js`）的静态导入，仅在年份处于 `1886..2023` 或显式选择 `cshapes` 时通过 `getCountryMod()` 异步加载，保留现有同步测试契约与 `validate-regional-continuity.mjs` 全量兼容性（`26/26`）。
   - 实测 1886 年之前全部首屏路由（`desktop_1492`、`south_asia_m250`、`china_742_regional`、`mobile_390_1492`、`tablet_834_1492`）均实现 **`countryArchiveLoaded: false`**，减少 2 次请求并提前 `mapInteractiveMs`。

## 验证与基准实测（`docs/verification-3.81/final-benchmarks.json`）

- **全量校验、HTTP 与构建**：`npm run prepare:assets && npm test && npm run test:http && npm run build` 全部通过（exit code `0`；`14/14` HTTP 检查）。
- **隔离冷启动性能（14 组无缓存 Chromium 进程）**：
  - `desktop_1492`：非限速首交互 **`307 ms`**（`domInteractiveMs: 12 ms`、`countryArchiveLoaded: false`、`fullCatalogRequested: false`）；1.5 Mbps / 150ms RTT 限速首交互 **`4,001 ms`**（`643,523 B`、`33` 个请求）。
  - `south_asia_m250`：非限速 **`222 ms`** / 限速 **`3,791 ms`**；`mobile_390_1492`：非限速 **`296 ms`** / 限速 **`3,996 ms`**；`europe_1914_cshapes`：正确按需加载 `countryArchiveLoaded: true`（`536 ms` / `6,013 ms`）。
  - Multi-viewport：`laptop_1280_compare` (`317 ms`)、`tablet_834_1492` (`316 ms`, `eraButtonsClipped: false`, `toolsHeight: 44`)、`tablet_834_compare` (`305 ms`)、`mobile_390_compare` (`301 ms`) 均 `overlaps: []`、`labelOverlaps: []`、`pinOverlaps: []`、`clippedH: false`、`consoleErrors: []`。
- **实机视觉与域回归检查**：
  - `megiddo_m1457_and_battles_glossary`：公元前 1457 年黎凡特地图已正常显示**赫利奥波利斯**与**马里**；`remainingNonQidEnglishInZh: []`。
  - `wave16_ref10_and_css_sizes`：`editorialCount: 2519`、`remainingRef10PlusWithoutZh: 0`；全部 3 个主样式文件合计 `104,531 B`。
  - `east_asia_1000ce_song_and_kaifeng`：北宋与开封唯一标注清晰无重叠；`#view=research`（`maplibreCssLoaded: false`、`maplibreJsLoaded: false`、羊皮纸 `rgb(255, 252, 244)`、`61,216` 字符）及 `#view=polities`（`eventsTabRenderMs: 2 ms`）均通过。

## 后续计划（v3.82.0）

- **Wave-17 历史地名全量汉化（Pleiades `ref === 9` 291 处聚落 -> `ref >= 9` 2,132 处 100% 覆盖）**：含 `Hebron`（希伯仑）、`Basra`（巴士拉）、`Larsa`（拉尔萨）、`Iathrippa`（叶斯里卜/麦地那）、`Aquae Granni`（亚琛）、`Segovia`（塞哥维亚）、`Chaeronea`（喀罗尼亚）、`Ammon`（锡瓦/阿蒙神谕地）、`Opis`（俄庇斯）等。
- **地图交互与图层 Bug 修复**：
  1. 修复 [`public/map-engine.js`](../public/map-engine.js) `setHover()` 在 CShapes 1886–2023 时期读取原始 `r.name`/`r.zhName` 而非历史分期名称（如 1914 俄罗斯帝国 / 1945 苏联）的问题；同时缓存 `refreshLabels()` 离屏测量 canvas 上下文、`reset()` 支持 `prefers-reduced-motion`、`destroy()` 一并销毁 `battles`/`atrocities` 图层。
  2. 修复 [`public/battles.js`](../public/battles.js) 与 [`public/atrocities.js`](../public/atrocities.js) `refresh()` 遗漏 `overlayBlockerBoxes`（导致战役/暴行标签可能与地图标题栏或 `.place-marker` 城市标签碰撞）及 [`public/places.js`](../public/places.js) `PlaceLayer.setModern` 在初始状态未变化时重复触发 `setYear` 的冗余开销。
