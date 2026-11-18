# 交接与验证记录 · v3.94.0

- **版本**: `3.94.0`
- **日期**: 2026-11-18
- **主工作区**: `/Users/zane/Documents/ChatGPT/MeridianAtlas`

## 本轮核心推进

1. **全库历史聚落 100.00% 汉化收官（Wave-27 +755 处 `Untitled` 遗址 + 全库城市补齐，总词条 11,946 处）**：
   - 将全部剩余 **`+755`** 处北非/昔兰尼加等地 `BAtlas Untitled` 区域调查聚落按行省、亚流域与罗马/希腊化/晚古罗马时期分级标注，并与此前遗留的 12 处 Chandler 城市别名一并合并至 [`public/places.js`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/places.js) 的 `PLACE_ZH_EDITORIAL`，人工编审总词条数由 `11,179` 增至 **`11,946`** 处。
   - 运行时检验全库全部 `21,034` 处地点记录（`attested-settlement` `11,328` 处、`dated-capital` `307` 处、`modern-reference` `7,342` 处、`attested-site` `17` 处、`urban-observation` `2,040` 处）：全库历史聚落各引用分级未译数已实现全面清零（`remainingRef4PlusWithoutZh: 0`、`remainingRef3WithoutZh: 0`、`remainingRef2WithoutZh: 0`、`remainingRef1WithoutZh: 0`、`remainingRef0WithoutZh: 0`、`remainingSettlementsWithoutZh: 0`、`activeNonKonigsbergUrbanMissing: 0`）。
   - 同时保留历史城市按年代切分与坐标隔离契约：`chandler:734`（柯尼斯堡/加里宁格勒）继续沿用 `nameTimeline` 在 1550 年显示 `柯尼斯堡`，坐标正负号错位记录（如 `chandler:382`）在 `placeAtYear()` 中继续保持隔离；并在 [`scripts/validate-places.mjs`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/scripts/validate-places.mjs) 新增 10 条北非—昔兰尼加代表点及柯尼斯堡年代校验。
2. **移动端浏览抽屉、检索分组语义色标与阅读器细节精修（`public/product.css`）**：
   - 修复 `@media(max-width:760px)` 下底部浏览抽屉 `#sidebar` 固定 `174px` 导致的卡片底缘裁切，调整为 `height: auto; max-height: 194px` 并补充顶部暖金斜边、半透明毛玻璃底衬与悬浮 `.scope` 胶囊（`top: -42px`、`backdrop-filter: blur(12px)`）；同时提升 `body:not(.browse-hidden) .maplibregl-ctrl-bottom-left` 层叠优先级（`bottom: 208px`）压过 `cartography.css` 同级规则，使 `3000 km` 比例尺悬浮于抽屉上方而不被遮挡（`scaleAboveSidebar: true`、`scopeBottomToSidebarTopGap: 3px`）。
   - 为搜索栏地点分组 `#placeResults .result-heading` 增加青玉绿语义标题底纹（`rgb(154, 215, 198)`），与政体检索（香槟金）、战役检索（陶土红）形成三色语义区分。
   - 为文明卡片寿命条 `.polity-span i` 增加 `min-width: 6px`，避免秦朝（公元前 218—前 209 年）等短祚核心王朝时间跨度指示条过细难以辨识；为事件详情页小节标题 `.reader-content h3` 增加 `1px` 顶部分割线；将底部载入胶囊 `.loading` 升级为磨砂黑曜石鎏金质地。

## 验证结果

- **离线构建与全套测试**（`npm run prepare:assets && npm test && npm run test:http && npm run build` 退出码 `0`）：
  - `validate-places.mjs`: **23/23 PASS**；`validate-city-time.mjs`: **22/22 PASS**
  - `validate-regional.mjs` / continuity: **26/26 PASS**；`validate-polity-display-names.mjs`: **17/17 PASS**
  - `validate-country-display-names.mjs`: **passed: true**（`39` / `31` / `62`）
  - `validate-startup-overlap.mjs`: **20/20 PASS**；`validate-map-catalog-app.mjs`: **26/26 PASS**
  - `polaris-worker`: **19/19 PASS**；`test:http`: **14/14 PASS**
  - `build-worker.mjs`: `staticStorageFiles: 377` / `storageFiles: 2551`
- **Chromium 实测（[`docs/verification-3.94/final-benchmarks.json`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/docs/verification-3.94/final-benchmarks.json)）**：
  - 全局 `consoleErrors: []`，所有视口 `overlaps: []`、`labelOverlaps: []`、`pinOverlaps: []`、`clippedH: false`。
  - 未限速冷启动 `mapInteractiveMs`：`desktop_1492` **`496 ms`**、`south_asia_m250` **`308 ms`**、`china_742_regional` **`376 ms`**、`europe_1914_cshapes` **`721 ms`**、`mobile_390_1492` **`452 ms`**。
  - `1.5 Mbps / 150 ms RTT` 限速冷启动 `mapInteractiveMs`：`desktop_1492` **`4,122 ms`**、`south_asia_m250` **`3,827 ms`**、`china_742_regional` **`5,642 ms`**、`europe_1914_cshapes` **`6,201 ms`**、`mobile_390_1492` **`4,129 ms`**。
  - 实时域与 UI 核查：`editorialCount: 11946`、`totalPlaces: 21034`、`remainingSettlementsWithoutZh: 0`、`remainingRef2WithoutZh: 0`、`activeNonKonigsbergUrbanMissing: 0`、`konigsberg1550: "柯尼斯堡"`、`quarantinedDjenneNull: true`；`search_place_heading_jade_tint: "rgb(154, 215, 198)"`、`h3BorderTopWidth: "1px"`、`spanMinWidth: "6px"`、`mobile_browse_drawer_clearance`（`sidebarHeight: 194`、`scopeBottomToSidebarTopGap: 3`、`scaleAboveSidebar: true`）；研究页零地图静态资源加载（`maplibreCssLoaded: false`、`maplibreJsLoaded: false`、`originalBodyBg: "rgb(255, 252, 244)"`、`originalTextLen: 61216`）。

## 后续规划（v3.95.0+）

- 对全库 `events`、`battles`、`atrocities` 与政体档案中文化覆盖情况开展全量审计与补全（如同源英文残留、现代参考层或地区详图边界元数据校订）。
- 持续排查并优化冷启动关键路径传输字节与地区详图/现代国界分片加载时延，继续打磨对比模式细节与长阅读体验。
