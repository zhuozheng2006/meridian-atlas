# 经纬纪 3.69.0：Wave-4 全球早期文明地名扩展、档案／帮助窗重塑与首波并发提速

## 本版三大里程碑

1. **Wave-4 新增 163 处上古文明与古典聚落双语地名（累计 460 条，`6f980af5`）**
   - 对 1800 年以前历史城市（Chandler / `modelski-ancient`）及 Pleiades `referenceCount >= 20` 遗址开展全库核查，移除被 `chandler:734`（柯尼斯堡／加里宁格勒 `nameTimeline`）遮蔽的冗余键，并在 [`public/places.js`](../public/places.js) 新增 **163** 条权威双语映射（`PLACE_ZH_EDITORIAL` 累计 **460** 条零重复、零缺失条目），完整覆盖两河／爱琴／印度河上古城市腹地（埃里都、尼普尔、基什、阿卡德、阿淑尔、埃勃拉、乌加里特、夏琐、推罗、特洛伊、迈锡尼、摩亨佐-达罗、拉基加里、朵拉维拉、商早期都城亳）、丝路与中华近世重镇（叶尔羌／莎车、亳州、万县、大沽），以及古典地中海与西亚重镇（卢泰西亚／巴黎、梅尔夫、佩特拉、苏萨、底格里斯河畔塞琉西亚、特里尔、科隆、佛罗伦萨、阿奎莱亚、阿尔勒、塞维利亚／伊斯帕利斯、安条克、赫尔松涅斯等）。
   - 在 [`scripts/validate-places.mjs`](../scripts/validate-places.mjs) 增补 Wave-4 回归断言（`23/23` 通过），并保持 `PLACE_COORD_QUARANTINE` 3 条西半球错位坐标隔离机制不变。

2. **地点／政体阅读抽屉、快捷键帮助弹窗重塑与 `maplibre-gl.css` 通道优化（`64ecfa89`）**
   - **快捷键与指南弹窗 `#helpDialog`**：重构 [`public/app.js`](../public/app.js) `renderHelp()` 与 [`public/product.css`](../public/product.css)，将原本密集的长段落文本重排为带 `01..05` 黄铜徽章的操作步骤卡 `.help-steps` 与双列 `<kbd>` 按键胶囊面板 `.help-shortcuts`（涵盖 `← / →`、`Shift + ← / →`、`↑ / ↓`、`/`、`Space`、`Alt + 方向键 / + −`、`Esc`）。
   - **地点与政体档案全卡片化**：将 [`public/product.css`](../public/product.css) 中的周边事件按钮 `.source-link.nearby-event` 重塑为带金左饰条与 hover 微移的 Obsidian × Brass 卡片；统一美化 `.place-stat`、`.place-facts`、`.observation-table`、`.place-return` 返回胶囊、`.polity-place-card`、`.reader-event`、`.editorial-fact`、`.fact-list`、`.area-chart` 与 `#placeExport` / `#polityFullExport` 导出按钮；经 Desktop（`1440×900`）与 Mobile（`390×844`）双端实视截图验收零溢出。
   - **首波 HTTP/1.1 六通道解锁**：将阻塞 `<head>` 渲染及占用首波 6 并发连接之一的 `assets/maplibre-gl.css` 移出 [`public/index.html`](../public/index.html)，改由 [`public/entry.js`](../public/entry.js) 的 `ensureMapCSS()` 在地图入口或切换到地图时按原级联顺序（插在 `style.css` 前）加载，同时将 `bootstrap-content-hashes.js` 提前至 `boot()` 首位。实测 `map-runtime.js` 首波不再排队，推动 `maplibre-gl.js`（247 KB）在 `1.5 Mbps / 150ms RTT` 弱网下由 `~576 ms` 提前至 `433 ms` 发起，`events-index` 提前至 `522 ms`，`year-1492` 提前至 `706 ms`，且研究视图 `#view=research` 保持 `maplibreCssLoaded: false` 与 `maplibreJsLoaded: false`。

3. **全场景 Chromium 基准实测与 `v3.69.0` 正式发布**
   - 在 [`docs/verification-3.69/final-benchmarks.json`](verification-3.69/final-benchmarks.json) 新增 CShapes 与 Cliopatria 全量目录区分校验，确认全部 8 组主／对比场景 `fullCatalogCalls: 0`、`overlaps: []`、`pinOverlaps: []`、`clippedH: false` 与 `consoleErrors: []`。

## v3.69.0 实测与基准

全部测量由独立无头 Chromium 进程（禁用浏览器缓存、全量 `v3.69.0` 资源戳构建后）采集，完整原始结果见 [`docs/verification-3.69/final-benchmarks.json`](verification-3.69/final-benchmarks.json)：

| 场景 | 首图交互 (`3.69.0`) | `3.68.0` 对照 | `1.5 Mbps / 150ms` 弱网 (`maplibre` / `events` / `year` 发起) | 可见碰撞 (`pin` / `UI`) | Console Errors |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `desktop_1492` (1440×900) | **`309 ms`** | `391 ms` | `4196 ms` (`433 ms` / `522 ms` / `706 ms`) | `0` / `0` | `0` |
| `south_asia_m250` | **`237 ms`** | `254 ms` | `4042 ms` (`434 ms` / `522 ms` / —) | `0` / `0` | `0` |
| `china_742_regional` | **`253 ms`** | `311 ms` | `5829 ms` (`434 ms` / `523 ms` / —) | `0` / `0` | `0` |
| `europe_1914_cshapes` | **`489 ms`** | `573 ms` | `6372 ms` (`434 ms` / `522 ms` / `706 ms`) | `0` / `0` | `0` |
| `mobile_390_1492` (390×844) | **`333 ms`** | `392 ms` | `4209 ms` (`433 ms` / `522 ms` / `705 ms`) | `0` / `0` (`gap +23px`) | `0` |
| `laptop_1280_compare` | **`315 ms`** | `377 ms` | — | `[]` / `clippedH: false` | `0` |
| `tablet_834_compare` | **`313 ms`** | `393 ms` | — | `[]` / `clippedH: false` | `0` |
| `mobile_390_compare` | **`350 ms`** | `413 ms` | — | `[]` / `clippedH: false` | `0` |

- 全套构建与回归检查在最终提交前全部通过：`npm run prepare:assets`、`npm test`、`npm run test:http`（`14/14`）、`npm run build`。

## 后续可继续推进方向

1. 继续为尚未覆盖中文译名的现代／近代 `urban-observations` 剩余小城镇（约 `95` 条，含英国工业镇与南亚近代观测点）以及 `pleiades` `referenceCount 15–19` 遗址补充 `PLACE_ZH_EDITORIAL` 映射。
2. 对 [`name-audit.json`](../public/data/china-prefectures/name-audit.json) 最后 5 项龚胜生推算口径的盛唐羁縻／贡州条目补齐《新唐书·卷四十三下》或《通典》对应引文核实。
3. 继续审查多政体边界密集区（如中欧神圣罗马帝国与印度半岛 1492–1700 年片段）在中低缩放层级下的多边形标注抽稀与对比模式交互细节。
