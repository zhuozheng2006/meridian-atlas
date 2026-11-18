# 经纬纪 · Meridian Atlas 4.07.0 阶段交付与验证记录

## 本轮核心成果（v4.07.0）

### 1. 打通「战役检索 / 暴行记录」时空联动与相机定位（[app.js](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/app.js#L482-L542)）
- 此前在地图侧栏搜索并点击「赤壁之战」（公元 `208` 年）等战役卡片时，`openBattle()` 既不切换地图年份也不移动相机，导致用户在阅读赤壁之战详情时地图画面仍停留在 `1492` 年非洲海域。
- 改为与历史事件点击一致的时空同步体验：从全局检索点开战役卡时自动切换时间轴至该战役发生年份（如从 `1492` 年一键跳回 `208` 年三国鼎立东亚疆域），同时平滑 `flyTo` 至战场坐标（`[lon, lat]`，缩放不低于 `3.8`）；从地图已有战役菱形标记直接点开时则传入 `{preserveYear: true}` 保留用户当前对比年代并平滑居中；同期为暴行记录详单 `openAtrocity()` 补充坐标居中。

### 2. 精修「社会与制度研究阅读器」深色控件间距与返回导航层次（[product.css](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/product.css#L82-L108)）
- 为 `#view=research` 顶部返回资料页胶囊按钮补充 `← ` 方向引导与 `16px` 下间距（避免紧贴 `SESHAT · RESEARCH ARCHIVE` 页眉）。
- 放大 `.research-controls` 上下留白（`margin: 18px 0 16px`），将 `.research-field` 与 `.research-version-bar label` 升级为暖金标签配 `8px` 纵距（彻底消除「来源政体阶段」标签上下粘连感），与全站深色曜金下拉体系保持统一。

---

## 全量自动化验证证据（v4.07.0）

- `npm run prepare:assets && npm test && npm run test:http && npm run build` 全部通过（exit code `0`）：
  - 内容、目录与几何校验：`PASS 270 native (12 bootstrap) and 117 detail content fingerprints`、`Validated events index (709 events), polity search index (1592 groups), and 64 chain buckets (13380 records)`、`1,250 real geometry samples agree with an independent Shapely oracle`、`69/69 view-state checks passed`、`10/10 border portrayal checks passed`
  - 研究档案与分页：`33/33 passed`、`27/27 Polaris reader checks passed`、`18/18 pagination checks passed`、`15/15 research routing checks passed`、`8/8 research version checks passed`
  - 区域瓦片与边界：`24/24 HALC selection`、`13/13 HALC real-style reload`、`18/18 HALC render readiness`、`29/29 HALC lifecycle`、`17/17 checks (audited 14863 records across 59 shards)`、`15/15 HALC cache`、`30/30 HALC two-source`、`24/24 HALC continuity`、`24/24 independent frozen/live`、`26/26 regional continuity`、`10/10 OHM async`
  - 启动、地图目录与本地 HTTP：`20/20 startup overlap checks passed`、`26/26 map catalog app checks passed`、`14/14 local HTTP checks passed`
  - Worker 构建：`dist/server/index.js`、`dist/client`（`staticRevision: e3c72442369b6cbea74ff3fc9e37a7b9104cd56aac86c4d7efe337cb970516bf`、`revision: 9c6c5ea6ce8ae32936efbe41`）

---

## Chrome 无头独立进程实测基准（`docs/verification-4.07/final-benchmarks.json`）

| 场景 | 视口 | 无节流可交互 (ms) | 1.5 Mbps / 150 ms RTT 可交互 (ms) | 1.5 Mbps 传输量 | 控制台错误 / 重叠 |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `desktop_1492` | 1440×900 | `336` | `4019` | `651,074 B` | `0 / 0` |
| `south_asia_m250` | 1440×900 | `253` | `3802` | `650,302 B` | `0 / 0` |
| `china_742_regional` | 1440×900 | `316` | `5643` | `852,468 B` | `0 / 0` |
| `europe_1914_cshapes` | 1440×900 | `563` | `5880` | `987,290 B` | `0 / 0` |
| `mobile_390_1492` | 390×844 | `341` | `4060` | `651,074 B` | `0 / 0` |

- 多视口布局校验（`laptop_1280_compare` 1280×720、`tablet_834_1492` 834×1194、`tablet_834_compare` 834×1194、`mobile_390_compare` 390×844）：零元素重叠、零标签碰撞、零水平滚动溢出，控制台错误数 `0`。
- 域级实测（`liveDomainChecks`）：
  - `battle_search_jumps_year_and_centers`：在 `1492` 年搜索「赤壁」并点击「赤壁之战」，`yearInputAfterClick: "208"`、`hashCamera: "113.62028,29.869722,3.8,0,0"`
  - `research_polaris_spacing_and_back_arrow`：`backMarginBottom: "16px"`、`fieldRowGap: "8px"`、`controlsMarginTop: "18px"`
  - `research_zero_map_assets_and_parchment`：`maplibreCssLoaded: false`, `maplibreJsLoaded: false`, `originalBodyBg: "rgb(255, 252, 244)"`, `originalTextLen: 61216`

---

## 下一阶段计划（v4.08.0+）

1. 检查悬停高亮浮窗 `.map-hover-card`（疆域、历史地点与区域边界悬停预览）在高倍缩放与暗底地图上的视觉可读性，并审查桌面/移动端时间轴滑块拖拽预览气泡 `#sliderPreview`、城市人口详单（`.place-stat` + `.observation-table`）及「资料」页导出/台账交互细节。
2. 持续比对历史事实准确性、边界数据完整度与前端加载/交互速度，逐轮消除细微瑕疵。
