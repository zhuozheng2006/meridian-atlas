# 经纬纪 · Meridian Atlas 4.03.0 阶段交付与验证记录

## 本轮核心成果（v4.03.0）

### 1. 消除区域详图启动预取 404 静默错误（[app.js](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/app.js#L758)）
- 在 Chrome 实测西欧/中欧 `1914` 年高倍视野（`#year=1914&camera=4.5,50.5,5.8,0,0`）时发现：`ensureAtlas()` 在 `camera.zoom >= 5` 预取区域快照时，调用 `regionalWindowFor(bounds, year)` 返回了覆盖该经纬度的 OHM 窗口（`central-europe`），但未检查该窗口 `years` 列表是否包含目标 `year`，从而向不存在的 `data/ohm-1500/year-1914.json.gz` 发起请求并报出 404 控制台错误。
- 增加 `window_?.years?.includes?.(Number(year))` 守卫（兼容数组年份列表与 `CHGIS` 函数式判断），复测确认全部 14 组路由、多视口与深度交互检查 `consoleErrors` 严格归零（`[]`）。

### 2. 统一政体档案全视图单年起止区间格式（[polity-reader.js](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/polity-reader.js#L28-L152)）
- 新增 `PolityReader.range(start, end)`，统一用于页眉「边界记录」标签、「概览」统计卡片、面积时间轴 SVG `<title>` 悬浮提示及「疆域」底部 `.change-pills` 选段按钮。
- 对单年快照记录（如罗马帝国公元 394 年）统一简化为单一 `公元 394 年`，不再出现 `公元 394 年 — 公元 394 年` 的冗余拼接，同时保留 `end === 0`（`源终点 0`）原样警示。Chrome 实测 `headerBoundaryTag`、`periodFactText` 与 `activePillText` 均为 `"公元 394 年"`。

### 3. 图层控制面板纵深紧凑排布与史前文案排版微调（[cartography.css](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/cartography.css#L63-L73) · [app.js](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/app.js#L84)）
- 收紧 `.layer-panel` 与 `.layer-options` 内部内边距、行间距与按钮最小高度（`.layer-options` 可视高度提升至 `320 px`），并补充 `公元前 3400 年` / `2024 年` 提示横幅中的数字空格排版。

---

## 全量自动化验证证据（v4.03.0）

- `export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" && npm run prepare:assets && npm test && npm run test:http && npm run build` 全部通过（exit code `0`）：
  - 内容、几何与视图：`18/18` lakes、`16/16` places、`17/17` polity display names、`15/15` battles、`1,250` real geometry Shapely oracle、`69/69` view-state、`20/20` border portrayal & mesh
  - 区域瓦片：`24/24` HALC selection、`13/13` HALC real-style reload、`18/18` HALC render readiness、`29/29` HALC lifecycle、`15/15` HALC cache、`30/30` HALC two-source、`24/24` HALC continuity、`26/26` regional continuity、`10/10` OHM async、`16/16` regional boundaries、`17/17` (14,863 records)
  - 阅读器与目录索引：`20/20 startup overlap checks passed`、`26/26 map catalog app checks passed`、`14/14 local HTTP checks passed`
  - Worker 构建：`dist/server/index.js`、`dist/client`（`staticRevision: e3c72442369b6cbea74ff3fc9e37a7b9104cd56aac86c4d7efe337cb970516bf`、`revision: 9c6c5ea6ce8ae32936efbe41`）

---

## Chrome 无头独立进程实测基准（`docs/verification-4.03/final-benchmarks.json`）

| 场景 | 视口 | 无节流可交互 (ms) | 1.5 Mbps / 150 ms RTT 可交互 (ms) | 1.5 Mbps 传输量 | 控制台错误 / 重叠 |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `desktop_1492` | 1440×900 | `304` | `4024` | `650,462 B` | `0 / 0` |
| `south_asia_m250` | 1440×900 | `237` | `3843` | `649,690 B` | `0 / 0` |
| `china_742_regional` | 1440×900 | `277` | `5613` | `851,834 B` | `0 / 0` |
| `europe_1914_cshapes` | 1440×900 | `494` | `5898` | `986,589 B` | `0 / 0` |
| `mobile_390_1492` | 390×844 | `319` | `4053` | `650,462 B` | `0 / 0` |

- 多视口布局校验（`laptop_1280_compare` 1280×720、`tablet_834_1492` 834×1194、`tablet_834_compare` 834×1194、`mobile_390_compare` 390×844）：零元素重叠、零标签碰撞、零水平滚动溢出，控制台错误数 `0`。
- 域级实测（`liveDomainChecks`）：
  - `polity_single_year_range_uniform`：`headerBoundaryTag: "边界记录 · 公元 394 年"`、`periodFactText: "公元 394 年"`、`activePillText: "公元 394 年"`
  - `layer_panel_and_battle_1914`：`optsH: 320`，`1914` 欧洲 `z=5.8` 无 404 请求
  - `research_zero_map_assets_and_parchment`：`maplibreCssLoaded: false`, `maplibreJsLoaded: false`, `originalBodyBg: "rgb(255, 252, 244)"`, `originalTextLen: 61216`

---

## 下一步优化方向

- 进一步排查西班牙/高卢/小亚细亚古罗马行省、近东/东亚历史政权及战役弹窗细节，并持续精雕界面光影层次、英文模式排版一致性与移动端触控体验。
