# 经纬纪 · Meridian Atlas 4.08.0 阶段交付与验证记录

## 本轮核心成果（v4.08.0）

### 1. 「历史身份核查台账」公元前与单年纪年规范化（[identity-ledger.js](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/identity-ledger.js#L7-L12)）
- 修复台账条目标题直接输出 `-3400 — -3201`、`1791 — 1791` 等负号数字与同起止年份冗余的问题：引入 `fmtYr()` 与 `fmtRange()`，将 `r.start`、`r.end` 与 `s.year` 规范格式化为 `公元前 3400 年 — 公元前 3201 年`（英文 `3400 BCE — 3201 BCE`）与单年 `公元 1791 年`（英文 `1791 CE`），并补齐 `仅看 30 份代表档案` 中文空格排版。

### 2. 城市人口档案「当前观测年份」金色高亮行（[app.js](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/app.js#L626) · [product.css](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/product.css#L130)）
- 在多世纪城市人口表（`.observation-table`）中，为当前观测年份条目自动标记 `.current` 与 `aria-current="true"`（如北京 `1492` 年 `669,033`），配合鎏金左竖线与暖金字色，帮助读者跨越千年人口序列一眼定位所选年份。

### 3. 悬停卡片对比度与时间轴拖拽预览气泡精修（[product.css](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/product.css#L56) · [cartography.css](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/cartography.css#L34)）
- 增强 `#sliderPreview` 底部鎏金指引边与字距排版，同时微调 `.map-hover-card small` 纪年文本亮度（`#dfc38a`），提升暗海底图上的阅读辨识度。

---

## 全量自动化验证证据（v4.08.0）

- `npm run prepare:assets && npm test && npm run test:http && npm run build` 全部通过（exit code `0`）：
  - 内容、目录与几何校验：`PASS 270 native (12 bootstrap) and 117 detail content fingerprints`、`Validated events index (709 events), polity search index (1592 groups), and 64 chain buckets (13380 records)`、`1,250 real geometry samples agree with an independent Shapely oracle`、`69/69 view-state checks passed`、`10/10 border portrayal checks passed`
  - 研究档案与分页：`33/33 passed`、`27/27 Polaris reader checks passed`、`18/18 pagination checks passed`、`15/15 research routing checks passed`、`8/8 research version checks passed`
  - 区域瓦片与边界：`24/24 HALC selection`、`13/13 HALC real-style reload`、`18/18 HALC render readiness`、`29/29 HALC lifecycle`、`17/17 checks (audited 14863 records across 59 shards)`、`15/15 HALC cache`、`30/30 HALC two-source`、`24/24 HALC continuity`、`24/24 independent frozen/live`、`26/26 regional continuity`、`10/10 OHM async`
  - 启动、地图目录与本地 HTTP：`20/20 startup overlap checks passed`、`26/26 map catalog app checks passed`、`14/14 local HTTP checks passed`
  - Worker 构建：`dist/server/index.js`、`dist/client`（`staticRevision: e3c72442369b6cbea74ff3fc9e37a7b9104cd56aac86c4d7efe337cb970516bf`、`revision: 9c6c5ea6ce8ae32936efbe41`）

---

## Chrome 无头独立进程实测基准（`docs/verification-4.08/final-benchmarks.json`）

| 场景 | 视口 | 无节流可交互 (ms) | 1.5 Mbps / 150 ms RTT 可交互 (ms) | 1.5 Mbps 传输量 | 控制台错误 / 重叠 |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `desktop_1492` | 1440×900 | `342` | `4042` | `651,137 B` | `0 / 0` |
| `south_asia_m250` | 1440×900 | `228` | `3808` | `650,365 B` | `0 / 0` |
| `china_742_regional` | 1440×900 | `290` | `5625` | `852,536 B` | `0 / 0` |
| `europe_1914_cshapes` | 1440×900 | `526` | `5889` | `987,355 B` | `0 / 0` |
| `mobile_390_1492` | 390×844 | `329` | `4023` | `651,137 B` | `0 / 0` |

- 多视口布局校验（`laptop_1280_compare` 1280×720、`tablet_834_1492` 834×1194、`tablet_834_compare` 834×1194、`mobile_390_compare` 390×844）：零元素重叠、零标签碰撞、零水平滚动溢出，控制台错误数 `0`。
- 域级实测（`liveDomainChecks`）：
  - `identity_ledger_bce_and_single_year_format`：`firstBceSummary: "公元前 3400 年 — 公元前 3201 年 · 待核查"`、`singleYrSummary: "公元 1791 年 · 待核查"`
  - `urban_observation_current_row_highlight`：`currentText: "公元 1492 年 669,033"`、`ariaCurrent: "true"`
  - `research_zero_map_assets_and_parchment`：`maplibreCssLoaded: false`, `maplibreJsLoaded: false`, `originalBodyBg: "rgb(255, 252, 244)"`, `originalTextLen: 61216`

---

## 下一阶段计划（v4.09.0+）

1. 深度审计 HALC `1500` 低地国家详图弹窗与双语标签、汉唐区划截面（公元 `2` 年与 `742` 年）、以及 CHGIS `1820` 清代府级区划弹窗与搜索交互体验。
2. 探索移动端事件阅读面板（`#detailPanel` on `390×844`）、时间轴播放/步进视觉微效及地图初始首屏可优化细节。
