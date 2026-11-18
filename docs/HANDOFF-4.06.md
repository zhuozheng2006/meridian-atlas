# 经纬纪 · Meridian Atlas 4.06.0 阶段交付与验证记录

## 本轮核心成果（v4.06.0）

### 1. 消除「文明」页首屏政体卡片点击失效竞态与重绘闪烁（[app.js](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/app.js#L292-L298)）
- 在 Chrome 交互探针中复现：此前 `renderPolities()` 先将 `.polity-card` 写入 `#contentView`，再 `await import('./no-territory.js')` 并由 `loadEnrichmentIndex().then(...)` 触发整页重绘，导致用户或自动化操作在索引尚在加载期间点击「明朝 / 唐朝」等政体卡片时点击事件尚未绑定而被静默吞掉，且 `enrichmentIndex` 就绪后会整页重建 DOM 丢失焦点与滚动位置。
- 改为写入卡片骨架后立即绑定 `bindPolitiesGrid()`（时代筛选、搜索、卡片跳转全部零延迟可点击），并将无疆域索引渲染抽离为增量 `mountNoTerritory()` 追加（不销毁现有政体网格与用户交互态）。Chrome 实测「文明」页首屏立即点击「明朝」直接飞入 `1492` 年东亚并打开完整 `7` 标签政体档案。

### 2. 重塑无疆域政体说明卡容器视觉同源性（[product.css](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/product.css#L181-L185)）
- 针对 `.no-territory-article` 此前仅页眉与页脚带深色底板、正文 `padding: 0` 裸露悬浮的割裂感，统一设计为曜黑渐变双栏边框博物档案卡容器（`14px` 圆角、`2px` 鎏金顶边、内边距 `24px 28px 28px`、移动端适配 `18px 20px 22px`），与侧栏阅读器质感完全一致。

### 3. 扩大桌面端图层面板纵深视野与微距排布（[cartography.css](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/cartography.css#L63-L75)）
- 将 `.layer-panel` 上缘移至 `top: 54px`、最大高度放宽至 `min(680px, calc(100% - 62px))`，同时适度收紧开关说明 `.layer-note` 行高与 `hr` 间距，实测 `panelHeight: 511 px`、`optionsHeight: 336 px`，展示更完整的图层控制列表。

---

## 全量自动化验证证据（v4.06.0）

- `npm run prepare:assets && npm test && npm run test:http && npm run build` 全部通过（exit code `0`）：
  - 内容、目录与几何校验：`PASS 270 native (12 bootstrap) and 117 detail content fingerprints`、`Validated events index (709 events), polity search index (1592 groups), and 64 chain buckets (13380 records)`、`1,250 real geometry samples agree with an independent Shapely oracle`、`69/69 view-state checks passed`、`10/10 border portrayal checks passed`
  - 研究档案与分页：`33/33 passed`、`27/27 Polaris reader checks passed`、`18/18 pagination checks passed`、`15/15 research routing checks passed`、`8/8 research version checks passed`
  - 区域瓦片与边界：`24/24 HALC selection`、`13/13 HALC real-style reload`、`18/18 HALC render readiness`、`29/29 HALC lifecycle`、`17/17 checks (audited 14863 records across 59 shards)`、`15/15 HALC cache`、`30/30 HALC two-source`、`24/24 HALC continuity`、`24/24 independent frozen/live`、`26/26 regional continuity`、`10/10 OHM async`
  - 启动、地图目录与本地 HTTP：`20/20 startup overlap checks passed`、`26/26 map catalog app checks passed`、`14/14 local HTTP checks passed`
  - Worker 构建：`dist/server/index.js`、`dist/client`（`staticRevision: e3c72442369b6cbea74ff3fc9e37a7b9104cd56aac86c4d7efe337cb970516bf`、`revision: 9c6c5ea6ce8ae32936efbe41`）

---

## Chrome 无头独立进程实测基准（`docs/verification-4.06/final-benchmarks.json`）

| 场景 | 视口 | 无节流可交互 (ms) | 1.5 Mbps / 150 ms RTT 可交互 (ms) | 1.5 Mbps 传输量 | 控制台错误 / 重叠 |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `desktop_1492` | 1440×900 | `323` | `4027` | `650,790 B` | `0 / 0` |
| `south_asia_m250` | 1440×900 | `242` | `3812` | `650,018 B` | `0 / 0` |
| `china_742_regional` | 1440×900 | `282` | `5632` | `852,190 B` | `0 / 0` |
| `europe_1914_cshapes` | 1440×900 | `528` | `5894` | `987,008 B` | `0 / 0` |
| `mobile_390_1492` | 390×844 | `311` | `4051` | `650,790 B` | `0 / 0` |

- 多视口布局校验（`laptop_1280_compare` 1280×720、`tablet_834_1492` 834×1194、`tablet_834_compare` 834×1194、`mobile_390_compare` 390×844）：零元素重叠、零标签碰撞、零水平滚动溢出，控制台错误数 `0`。
- 域级实测（`liveDomainChecks`）：
  - `polities_immediate_click_no_race_and_places`：立即点击「明朝」直接进入 1492 地图并打开 7 标签政体档案（`["概览", "政治", "文化与经济", "疆域", "城市与聚落", "年表", "来源"]`）
  - `no_territory_card_container`：`borderRadius: "14px"`、`borderTopColor: "rgba(220, 192, 137, 0.6)"`、`bodyPaddingLeft: "28px"`
  - `layers_panel_desktop_height`：`panelHeight: 511`、`optionsHeight: 336`
  - `research_zero_map_assets_and_parchment`：`maplibreCssLoaded: false`, `maplibreJsLoaded: false`, `originalBodyBg: "rgb(255, 252, 244)"`, `originalTextLen: 61216`

---

## 下一阶段计划（v4.07.0+）

1. 深入审视政体档案「城市与聚落」标签页与历史城市人口/观测档案详情面板（`.place-stat`、`.observation-table`、`.polity-place-card`），检查点击、返回按钮与数据渲染表现。
2. 审视「专题 Journeys」漫游体验、地图缩放下战役所选卡片与街区详情弹窗样式，持续打磨整体界面的高级感与响应速度。
