# 3.86 验证与交接记录

**版本：3.86.0** · **日期：2026-11-18** · **上一版本：[3.85](HANDOFF-3.85.md)**

---

## 本轮核心成果

1. **Wave-21 Pleiades `ref === 5` 全量权威中文补齐（[`public/places.js`](../../public/places.js) · [`scripts/validate-places.mjs`](../../scripts/validate-places.mjs)）**
   - 新增全量 **`675` 处** Pleiades `referenceCount === 5` 历史聚落与遗址权威简体中文译名，并在 `validate-places.mjs` 新增 16 条实年份回归断言。
   - `PLACE_ZH_EDITORIAL` 由 `4,104` 条扩充至 **`4,779` 条**；实测全量 `Pleiades referenceCount >= 5` 聚落未译遗漏数为 **`remainingRef5PlusWithoutZh: 0`**（100% 完成）。`node scripts/validate-places.mjs` **23 / 23 PASS**。

2. **全球主要湖泊双语补齐与 `index.json.gz` 契约守护（[`public/lakes.js`](../../public/lakes.js)）**
   - 在不改动 `public/data/lakes/index.json.gz`（维持既有 24 条内建 `zh` 键以遵守校验合约）的前提下，在 [`public/lakes.js`](../../public/lakes.js) 引入 **`LAKE_ZH`（86 条）** 补齐欧亚、中国、丝路、地中海、非洲及美洲大洋洲主要湖泊（含博登湖／康斯坦茨湖、太湖、鄱阳湖、青海湖、赛里木湖、乌梁素海、加利利海／提比里亚湖、楚德湖／佩普西湖、乌尔米耶湖等），并优先尊重 `n.zh`。
   - Chromium 1500 年博登湖放大视图实测已稳定渲染 **`博登湖（康斯坦茨湖）`**（`hasBodenseeZh: true`）；同时视觉审阅发现相邻的 `Wangen Lachen`（苏黎世上湖旺根—拉亨）将在 `v3.87` 继续补齐。

3. **OHM 地区详图剩余高频区划与自由市扩展（[`public/regional-boundaries.js`](../../public/regional-boundaries.js)）**
   - 为 [`CITY_ZH`](../../public/regional-boundaries.js) 新增 **`Landau -> 兰道`**，并为 [`AREA_ZH`](../../public/regional-boundaries.js) 增补 **`45` 条**高频条目（涵盖特万、法属东京保护国、波希米亚王冠领地、巴伐利亚／上萨克森／奥地利帝国行政圈、巴伐利亚／施瓦本／帕尔马／佛罗伦萨公国、曼图亚侯国、三同盟自由邦、纳沙泰尔亲王国、耽罗、汉口英租界、桦太厅、布里亚特-蒙古苏维埃社会主义自治共和国等）。`validate-regional.mjs` **16 / 16 PASS**。

4. **首屏关键路径脚本预加载与界面视觉统一（[`public/entry.js`](../../public/entry.js) · [`public/product.css`](../../public/product.css) · [`public/cartography.css`](../../public/cartography.css)）**
   - 依据 `1.5 Mbps / 150 ms RTT` 瀑布流分析，在 [`boot()`](../../public/entry.js) 的预加载清单中新增 `./polity-display-names-data.js` 与 `./research-view.js`，消除两者等待 `app.js` 求值后的两跳串行停顿；同时维持 `#view=research` 零地图资源契约（`maplibreCssLoaded: false`、`maplibreJsLoaded: false`）。
   - 将 `#contentView > .lead` 的硬切底线升级为渐隐黄铜线性渐变边（`border-image`），恢复并精细化 `.sidebar-footer .dot` 6 px 灰绿状态指示点，并统一 `.comparing .map-heading` 顶部基准线与黄铜顶缘描边。
   - Chromium 7 组冷启与交互截图（桌面 `1492`、博登湖 `1500`、`1900` 对比模式、年表页、来源页、明朝档案抽屉、移动端 `390×844`）已完成人工逐帧视觉检查：桌面/移动端均零重叠、零横向溢出，对比视图两栏标题对齐；同步记录了 `Wangen Lachen`、`Twann` 尚待下一版翻译，以及移动端年代条右侧边缘可在 `v3.87` 增加柔和渐隐遮罩。

---

## 全量验证与实测证据

- `npm run prepare:assets && npm test && npm run test:http && npm run build` 全部以退出码 `0` 通过：
  - `validate-places.mjs`：**23 / 23 PASS**；`PLACE_ZH_EDITORIAL` 共 `4,779` 条，`remainingRef5PlusWithoutZh: 0`
  - `validate-lakes.mjs`：**17 / 17 PASS**；`validate-lake-readiness.mjs`：**16 / 16 PASS**
  - `validate-regional.mjs`：**16 / 16 PASS**
  - `validate-map-catalog-app.mjs`：**26 / 26 PASS**
  - `npm run test:http`：**14 / 14 PASS**
  - `npm run build`：`377` 静态文件 / `2,551` Worker 存储分片构建通过
- Headless Chromium 端到端实测（[`docs/verification-3.86/final-benchmarks.json`](verification-3.86/final-benchmarks.json)，`14` 次独立冷启与 `4` 项实时域检查；全部场景 `consoleErrors: []`、`clippedH: false`、`overlaps: []`、`labelOverlaps: []`、`pinOverlaps: []`）：
  - 非限速首屏：`desktop_1492` **`315 ms`**（`58` 请求，较 `v3.85` `328 ms` / `v3.84` `337 ms` 持续降低），`south_asia_m250` **`218 ms`**，`china_742_regional` **`260 ms`**（`地区详图 · 51 条区划`），`europe_1914_cshapes` **`509 ms`**，`mobile_390_1492` **`312 ms`**（`eventPinsTotal: 52`、`eventPinsVisible: 16`）
  - `1.5 Mbps / 150 ms RTT` 限速：`desktop_1492` **`4,050 ms`**，`south_asia_m250` **`3,812 ms`**，`china_742_regional` **`5,609 ms`**，`europe_1914_cshapes` **`6,109 ms`**，`mobile_390_1492` **`4,035 ms`**
  - 域与交互检查：`wave21_ref5_completion`（`editorialCount: 4779`, `remainingRef5PlusWithoutZh: 0`）、`bodensee_lake_and_ohm_bilingual`（`hasBodenseeZh: true`, `regionalCount: 10`）、`polities_ming_dossier`（`title: "明朝Ming dynasty"`, `hasSidebarDot: true`）、`research_zero_map_assets_and_parchment`（`maplibreCssLoaded: false`, `maplibreJsLoaded: false`, `originalBodyBg: "rgb(255, 252, 244)"`, `originalTextLen: 61216`）

---

## 下一步计划（v3.87.0+）

1. **Wave-22 Pleiades `ref === 4` 全量权威中文补齐（`1,089` 处）**，目标达成 `remainingRef4PlusWithoutZh: 0`（总条目 `5,868` 处），补齐高考古价值古都与商港（埃勃拉 `Ebla`、摩亨佐-达罗 `Moenjodaro`、修索波利斯 `Seuthopolis`、亚丁 `Adane`、萨那 `Sana'a`、维也纳古罗马营垒 `Vindobona`、法兰克福、阿马尔菲、大津巴布韦等）。
2. **湖泊与 OHM 细节补漏 + 移动端／内容页视觉升级**：在 `LAKE_ZH` 补充 `Wangen Lachen` 及世界高曝光湖泊，排查 `Twann` 在瑞士 OHM 视图下的显示路径，为移动端 `.era-strip` 增加右侧水平溢出渐隐遮罩并进一步打磨界面美学与冷启耗时。
