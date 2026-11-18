# 经纬纪 · Meridian Atlas 4.05.0 阶段交付与验证记录

## 本轮核心成果（v4.05.0）

### 1. CShapes 与随附 OHM 地区详图实现 100% 纯简体中文标注（[country-archive.js](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/country-archive.js#L4) · [regional-boundaries.js](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/regional-boundaries.js#L40)）
- 补全 `COUNTRY_ZH_FIX` 运行时简体中文修正，覆盖 `Belarus (Byelorussia)`（`白俄罗斯`）、`Myanmar (Burma)`（`缅甸`）与 `Cambodia (Kampuchea)`（`柬埔寨`），彻底消除 1995 年等现代地图与国家档案标题中残留的 `缅甸（Burma）` 等中英混写后缀，在保持 `public/data/cshapes/catalog.json.gz` 只读原貌及 `source_name` 的前提下，全库 `273` 个独立国家/属地名称实现 `100%` 纯简体中文映射。
- 扫描全部 33 份随附 OHM 区域快照，在 `AREA_ZH` 补充 `維多利亞城 City of Victoria` → `维多利亚城`，实现本地内置 OHM 区域详图 `100%` 简体中文名称覆盖。

### 2. 「资料」页双分割线消重、图版脚注呼吸感与「文明」单年卡片一致化（[product.css](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/product.css#L179-L181) · [app.js](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/app.js#L292)）
- 通过 `#contentView > .lead + .research-plates` 去除紧邻页面导语下方的重复上边框分割线，使金色渐变导语分割线自然衔接「施瓦茨贝格南亚历史地图集」专题版块；同时为 `.plate-card small` 补充 `10px` 顶距与右对齐排版，并新增 `summary:focus-visible` 金色焦点环。
- 修复 `#view=polities` 中 `20` 个单年存在政体卡片日期显示为 `公元 1791 年 — 公元 1791 年` 的问题（现统一显示为 `公元 1791 年`），与政体详情全视图 `PolityReader.range()` 保持完全一致。

### 3. 移动端「年份对照」工具条紧凑横排优化（[cartography.css](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/cartography.css#L207-L211)）
- 取消 `@media (max-width: 600px)` 下 `.comparing .map-tools` 强制 `flex-direction: column` 导致「图层 / 战役 / 导出」竖排撑高至 `102 px` 挤压上侧对照地球的问题，改为 `flex-direction: row` 紧凑横排自适应折行（实测 `mobile_390_compare` 下 `toolsHeight` 由 `102 px` 降至 `36 px`，零重叠、零溢出）。

---

## 全量自动化验证证据（v4.05.0）

- `npm run prepare:assets && npm test && npm run test:http && npm run build` 全部通过（exit code `0`）：
  - 内容、目录与几何校验：`PASS 270 native (12 bootstrap) and 117 detail content fingerprints`、`Validated events index (709 events), polity search index (1592 groups), and 64 chain buckets (13380 records)`、`1,250 real geometry samples agree with an independent Shapely oracle`、`69/69 view-state checks passed`、`10/10 border portrayal checks passed`
  - 研究档案与分页：`33/33 passed`、`27/27 Polaris reader checks passed`、`18/18 pagination checks passed`、`15/15 research routing checks passed`、`8/8 research version checks passed`
  - 区域瓦片与边界：`24/24 HALC selection`、`13/13 HALC real-style reload`、`18/18 HALC render readiness`、`29/29 HALC lifecycle`、`17/17 checks (audited 14863 records across 59 shards)`、`15/15 HALC cache`、`30/30 HALC two-source`、`24/24 HALC continuity`、`24/24 independent frozen/live`、`26/26 regional continuity`、`10/10 OHM async`
  - 启动、地图目录与本地 HTTP：`20/20 startup overlap checks passed`、`26/26 map catalog app checks passed`、`14/14 local HTTP checks passed`
  - Worker 构建：`dist/server/index.js`、`dist/client`（`staticRevision: e3c72442369b6cbea74ff3fc9e37a7b9104cd56aac86c4d7efe337cb970516bf`、`revision: 9c6c5ea6ce8ae32936efbe41`）

---

## Chrome 无头独立进程实测基准（`docs/verification-4.05/final-benchmarks.json`）

| 场景 | 视口 | 无节流可交互 (ms) | 1.5 Mbps / 150 ms RTT 可交互 (ms) | 1.5 Mbps 传输量 | 控制台错误 / 重叠 |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `desktop_1492` | 1440×900 | `323` | `4007` | `650,601 B` | `0 / 0` |
| `south_asia_m250` | 1440×900 | `239` | `3802` | `649,829 B` | `0 / 0` |
| `china_742_regional` | 1440×900 | `291` | `5599` | `851,997 B` | `0 / 0` |
| `europe_1914_cshapes` | 1440×900 | `531` | `5896` | `986,818 B` | `0 / 0` |
| `mobile_390_1492` | 390×844 | `317` | `4021` | `650,601 B` | `0 / 0` |

- 多视口布局校验（`laptop_1280_compare` 1280×720、`tablet_834_1492` 834×1194、`tablet_834_compare` 834×1194、`mobile_390_compare` 390×844）：零元素重叠、零标签碰撞、零水平滚动溢出，控制台错误数 `0`；其中 `mobile_390_compare` 工具条高度由 `102 px` 降至 `36 px`。
- 域级实测（`liveDomainChecks`）：
  - `cshapes_1995_pure_simplified_chinese`：地图实时标签为 `["中国", "印度", "缅甸", "泰国", "马来西亚", "菲律宾", "老挝", "尼泊尔"]`，`hasRawEnglishMyanmar: false`，`hasCleanMyanmar: true`
  - `sources_single_divider_and_plates`：`platesBorderTopWidth: "0px"`，`plateSmallMarginTop: "10px"`
  - `single_year_polity_card_in_directory`：`yearsText: "公元 1791 年"`
  - `research_zero_map_assets_and_parchment`：`maplibreCssLoaded: false`, `maplibreJsLoaded: false`, `originalBodyBg: "rgb(255, 252, 244)"`, `originalTextLen: 61216`

---

## 下一阶段计划（v4.06.0+）

1. 优化「文明」页中无疆域档案详情文章 `.no-territory-article` 的曜黑金边阅读卡片容器与页脚排版，使其与地图侧栏阅读器视觉完全同源。
2. 全面视觉审查政体详情面板（`#detailPanel`「概览 / 年代与边界 / 相关事件 / 政体地点」）、历史地点卡片（`.place-stat`）与 `1.5 Mbps` 首屏关键路径传输字节预算，持续探索可削减的非关键开销与体验细节。
