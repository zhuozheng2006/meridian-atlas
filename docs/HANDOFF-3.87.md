# 3.87 验证与交接记录

**版本：3.87.0** · **日期：2026-11-18** · **上一版本：[3.86](HANDOFF-3.86.md)**

---

## 本轮核心成果

1. **Wave-22 Pleiades `ref === 4` 全量权威中文补齐 + 瑞士特万补齐（[`public/places.js`](../../public/places.js) · [`scripts/validate-places.mjs`](../../scripts/validate-places.mjs)）**
   - 结合坐标、历史分期与考古学定名，为全量剩余 **`1,089` 处 Pleiades `referenceCount === 4`** 聚落与遗址以及瑞士比尔湖畔 **`Twann`（`pleiades:878719593 -> 特万（比尔湖畔）`）** 补齐权威简体中文译名（合计 **`+1,090` 处**），包含摩亨佐-达罗、埃勃拉、修索波利斯、赫拉特（阿里亚的亚历山大城）、亚丁（阿达内）、萨那古城、温多波纳罗马市政城（维也纳）、法兰克福、阿马尔菲、卡莱（波尔图古港）、大津巴布韦石城遗址、马阿迪遗址、埃雷布尼要塞、斯卡拉布雷、科基诺巨石天文台等，并在 [`scripts/validate-places.mjs`](../../scripts/validate-places.mjs) 新增 16 条实年份回归断言。
   - `PLACE_ZH_EDITORIAL` 由 `4,779` 条增至 **`5,869` 条**；实测全量 `Pleiades referenceCount >= 4` 聚落未译遗漏数为 **`remainingRef4PlusWithoutZh: 0`**（100% 完成）。`node scripts/validate-places.mjs` **23 / 23 PASS**。

2. **OHM 冻结历史边界全量余项归零（[`public/regional-boundaries.js`](../../public/regional-boundaries.js)）**
   - 补齐 [`CITY_ZH`](../../public/regional-boundaries.js) **`Mulhouse -> 米卢斯`**（使 `Free Imperial City of Mulhouse` 自动拼合为 `米卢斯帝国自由市`）以及 [`AREA_ZH`](../../public/regional-boundaries.js) 全部剩余 **`86` 个** OHM 政区名（普鲁士王国、巴伐利亚／萨克森选侯国与王国、符腾堡、巴登、阿尔萨斯-洛林、瑞士、比利时、列支敦士登、托斯卡纳、奇萨尔皮纳共和国、大越（郑主）、西伯利亚边疆区、远东边疆区、济州岛等），实现三套冻结 OHM 档案（中欧／不列颠／东亚）未译政区 **100% 归零**。`validate-regional.mjs` **16 / 16 PASS**，`regional-continuity` **26 / 26 PASS**。

3. **苏黎世上湖 `Wangen Lachen` 与全球 58 座高曝光湖泊双语补齐（[`public/lakes.js`](../../public/lakes.js)）**
   - 为 `LAKE_ZH` 新增 **`58` 座**主要湖泊，补齐博登湖视图实测中遗漏的 **`Wangen Lachen -> 苏黎世上湖（旺根—拉亨）`**、纳沙泰尔湖外延阿尔卑斯湖泊，以及大盐湖、尼加拉瓜湖、波波湖、阿根廷湖、泰梅尔湖、恰内湖、伊曼德拉湖等欧亚非美湖泊，Chromium 1500 年瑞士东北部放大图实测 `lakes: ["博登湖（康斯坦茨湖）", "苏黎世上湖（旺根—拉亨）"]`。`validate-lakes.mjs` **17 / 17 PASS**，`validate-lake-readiness.mjs` **16 / 16 PASS**。

4. **`Polities` / `Journeys` 卡片质感与移动端年代条渐隐升级（[`public/product.css`](../../public/product.css)）**
   - 为 `.polity-card` 与 `.polity-featured` 注入按时代色调驱动的左上方暖光径向渐变与顶部内高光描边，为 `.story-card` 增加顶缘细高光与层次投影，使 `Polities`、`Journeys` 与 `Atlas` 档案抽屉共享统一的手稿质感。
   - 为移动端 `.era-buttons` 补齐 `-webkit-mask-image` 与水平渐隐右侧安全区，消除窄屏年代按钮在视口边缘的硬截断感，并通过 `polities-after.png`、`journeys-after.png`、`bodensee-1500-after.png`、`mobile-390-after.png` 等 7 组截图逐一视觉复核。

---

## 全量验证与实测证据

- `npm run prepare:assets && npm test && npm run test:http && npm run build` 全部以退出码 `0` 通过：
  - `validate-places.mjs`：**23 / 23 PASS**（`PLACE_ZH_EDITORIAL` 共 `5,869` 条，`remainingRef4PlusWithoutZh: 0`）
  - `validate-lakes.mjs`：**17 / 17 PASS**；`validate-lake-readiness.mjs`：**16 / 16 PASS**
  - `validate-regional.mjs`：**16 / 16 PASS**；`regional-continuity`：**26 / 26 PASS**
  - `validate-polity-display-names.mjs`：**17 / 17 PASS**
  - `validate-map-catalog-app.mjs`：**26 / 26 PASS**
  - `npm run test:http`：**14 / 14 PASS**
  - `build-worker.mjs`：`staticStorageFiles: 377` / `storageFiles: 2551`
- Headless Chromium 端到端实测（[`docs/verification-3.87/final-benchmarks.json`](verification-3.87/final-benchmarks.json)，`14` 次独立冷启与 `4` 项实时域检查；全部场景 `consoleErrors: []`、`clippedH: false`、`overlaps: []`、`labelOverlaps: []`、`pinOverlaps: []`）：
  - 非限速首屏：`desktop_1492` **`315 ms`**（`58` 请求），`south_asia_m250` **`225 ms`**，`china_742_regional` **`276 ms`**（`地区详图 · 51 条区划`），`europe_1914_cshapes` **`485 ms`**（较 `v3.86` `509 ms` 改善），`mobile_390_1492` **`309 ms`**（`eventPinsTotal: 52`、`eventPinsVisible: 16`）
  - `1.5 Mbps / 150 ms RTT` 限速：`desktop_1492` **`4,049 ms`**，`south_asia_m250` **`3,803 ms`**，`china_742_regional` **`5,599 ms`**，`europe_1914_cshapes` **`6,158 ms`**，`mobile_390_1492` **`4,018 ms`**
  - 实时域检查：`wave22_ref4_completion`（`editorialCount: 5869`, `remainingRef4PlusWithoutZh: 0`, `twann1500: "特万（比尔湖畔）"`, `moenjodaroM2500`, `eblaM2400`, `seuthopolisM200`, `adane100`, `vindobona150`, `greatZimbabwe1800`, `sanaa1800`）、`bodensee_1500_fixed_labels`（`hasBodenseeZh: true`, `hasWangenLachenZh: true`, `regionalCount: 8`）、`polities_ming_dossier`（`title: "明朝Ming dynasty"`, `hasSidebarDot: true`）、`research_zero_map_assets_and_parchment`（`maplibreCssLoaded: false`, `maplibreJsLoaded: false`, `originalBodyBg: "rgb(255, 252, 244)"`, `originalTextLen: 61216`）

---

## 下一步计划（v3.88.0+）

1. **Cliopatria + CShapes + Chandler 人口都市全库剩余未译清零**：实测全库仅剩 **`10` 个** Cliopatria 政体 + `Bali => 巴厘省` 纠偏、**`1` 个** CShapes 政区（`Inini -> 伊尼尼领地`）及 **`13` 个** `urban-observations` 历史都市（含 `Changteh -> 常德`、`Konigsberg -> 柯尼斯堡`、`Dienne -> 杰内`、`El Tajin -> 埃尔塔欣`），一并清零达成全局政体与都市层 100% 中文覆盖。
2. **Wave-23 启动与深层交互打磨**：针对高价值 `Pleiades ref === 3` 古聚落开启新一轮权威校译，并持续优化地图微交互、加载首帧体感与阅读器细节。
