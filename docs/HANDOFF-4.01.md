# 经纬纪 · Meridian Atlas 4.01.0 阶段交付与验证记录

## 本轮核心成果（v4.01.0）

### 1. 全球天然湖泊 100.0% 简体中文完备覆盖（`1,115 / 1,115`）（[lakes.js](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/lakes.js#L303-L313) · [validate-lakes.mjs](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/scripts/validate-lakes.mjs#L73-L103)）
- 通过解析 `public/data/lakes/0262.bin.gz` 确认 HydroLAKES `1427`（`Dogen`，中心 `[91.169196, 31.69483]`，外包框 `[91.088476, 31.584721, 91.215968, 31.805886]`，面积 `134.17 km²`）对应西藏那曲安多县**懂错**（`31°41′N 91°09′E`），补入 `LAKE_ID_ZH`（`['1427', '懂错']`）。
- 在 [validate-lakes.mjs](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/scripts/validate-lakes.mjs#L98-L103) 增设全库循环断言，逐条验证 `public/data/lakes/index.json.gz` 全部 `1,115` 个命名水体均通过 `lakeZh()` 解析为非纯 ASCII 中文地名。

### 2. 近现代年份冷启动下载优先级治理（[country-archive.js](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/country-archive.js#L9-L38) · [boundary-controller.js](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/boundary-controller.js#L20-L51) · [entry.js](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/entry.js#L32-L35)）
- `country-archive.js` 支持按请求传入 HTTP `priority` 提示：`BoundaryController.prepare()` 在 `auto` 冷启动路径为背景升级的 CShapes `catalog.json.gz` / `decade-*.json.gz` 传入 `{ priority: 'low' }`，显式选择 `cshapes` 模式保留 `{ priority: 'high' }`；`entry.js` 将 `data/land.geojson` 标为 `high` 优先级，并仅在 `#boundaries=cshapes` 时预载 CShapes JS 模块，避免与核心地图引擎和 Cliopatria 年度包抢占冷启动带宽。
- `1.5 Mbps / 150 ms RTT` 下 `europe_1914_cshapes` 可交互耗时由 `v4.00.0` 的 `6146 ms` 降至 **`5844 ms`**（无节流 `513 ms -> 507 ms`）。

### 3. 古代地名标注防截断与全视图暗金滚动条统一（[places.js](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/places.js#L4140-L4177) · [cartography.css](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/cartography.css#L219-L224) · [app.js](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/app.js#L292)）
- 在 `PlaceLayer.refresh()` 中，对 Pleiades 等多斜杠复合古地名（总长 `> 22` 字符或包含两处及以上 `/`）在地图标注气泡上精简展示首项主称（如 `Herdoniae/Ardaneae/Civitas S...` → **`Herdoniae`**、`Sybaris/Thurii/Copia` → **`Sybaris`**、`Hipponion/Vibo Valentia` → **`Hipponion`**），悬停浮卡与详情面板仍保留完整学术名称。Chrome 实测意大利公元 117 年视图 `55` 个地名标注截断数为 **`0`**。
- 将 `5px` 暗青黄铜圆角细滚动条统一拓展至 `#contentView`、`.reader-content`、`.table-scroll`、`.event-list` 与 `.map-notice`，消除「文明」「专题」「年表」「资料」右侧原生宽滚动条；并将「文明」目录总数文案格式化为 `1,592 个名称`。

---

## 全量自动化验证证据（v4.01.0）

- `export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" && npm run prepare:assets && npm test && npm run test:http && npm run build` 全部通过（exit code `0`）：
  - `validate-lakes.mjs`：`{"status":"passed","checks":18}`（含全部 `1,115` 湖泊中文校验与 `1427 Dogen -> 懂错`）
  - 内容与显示名称：`16/16 places checks`, `17/17 polity display names checks`, `15/15 battles checks`, `3/3` events & battles (`709` events, `603` battles)
  - 边界与区域瓦片：`24/24 HALC selection`, `13/13 HALC real-style reload`, `18/18 HALC render readiness`, `29/29 HALC lifecycle`, `15/15 HALC cache`, `30/30 HALC two-source`, `24/24 HALC continuity`, `26/26 regional continuity`, `10/10 OHM async requests`, `16/16 regional boundaries`
  - 资产与目录：`PASS 270 native (12 bootstrap) and 117 detail content fingerprints`, `20/20 startup overlap checks passed`, `26/26 map catalog app checks passed`（5,424 年 / 254,592 条年度政权对、709 事件、1,592 政权检索组、64 链分片）
  - 本地 HTTP 与 Worker 构建：`14/14 local HTTP checks passed`；`dist/server/index.js`、`dist/client` 构建通过（`staticRevision: e3c72442369b6cbea74ff3fc9e37a7b9104cd56aac86c4d7efe337cb970516bf`, `revision: 9c6c5ea6ce8ae32936efbe41`）

---

## Chrome 无头独立进程实测基准（`docs/verification-4.01/final-benchmarks.json`）

| 场景 | 视口 | 无节流可交互 (ms) | 1.5 Mbps / 150 ms RTT 可交互 (ms) | 1.5 Mbps 传输量 | 控制台错误 / 重叠 |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `desktop_1492` | 1440×900 | `323` | `4062` | `650,076 B` | `0 / 0` |
| `south_asia_m250` | 1440×900 | `217` | `3812` | `649,304 B` | `0 / 0` |
| `china_742_regional` | 1440×900 | `273` | `5628` | `851,005 B` | `0 / 0` |
| `europe_1914_cshapes` | 1440×900 | `507` | `5844` | `986,208 B` | `0 / 0` |
| `mobile_390_1492` | 390×844 | `318` | `4034` | `650,076 B` | `0 / 0` |

- 多视口布局校验（`laptop_1280_compare` 1280×720、`tablet_834_1492` 834×1194、`tablet_834_compare` 834×1194、`mobile_390_compare` 390×844）：零元素重叠、零标签碰撞、零水平滚动溢出，控制台错误数 `0`。
- 域级实测（`liveDomainChecks`）：
  - `awmc_117_compact_place_labels`：`totalMarkers: 55`, `truncated: []`
  - `polities_count_and_scrollbar`：`tagText: "1,592 个名称"`, `contentScrollbarWidth: "thin"`
  - `research_zero_map_assets_and_parchment`：`maplibreCssLoaded: false`, `maplibreJsLoaded: false`, `originalBodyBg: "rgb(255, 252, 244)"`, `originalTextLen: 61216`

---

## 下一步优化方向

- 检查「文明档案」详情抽屉三标签页（「概览 / 沿革 / 来源」）、时间轴连续切年帧延迟与对比模式下地图交互质感，进一步提升高频交互体验与视觉精致度。
