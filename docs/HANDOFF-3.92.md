# 交接与验证记录 · v3.92.0

- **版本**: `3.92.0`
- **日期**: 2026-11-18
- **主工作区**: `/Users/zane/Documents/ChatGPT/MeridianAtlas`

## 本轮核心推进

1. **Wave-25 B1+B2+B3 历史聚落大批量汉化（+1,010 处，`ref=2`）**：
   - 将 `wave25_named_b1.json`（260 处）、`wave25_named_b2.json`（500 处）与 `wave25_named_b3.json`（250 处）共 **`+1,010`** 条人工编审译名合并写入 [`public/places.js`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/places.js) 的 `PLACE_ZH_EDITORIAL`，总词条数由 `8,814` 跃升至 **`9,824`** 处。
   - 未译统计降至：`ref >= 4`: **`0`**，`ref === 3`: **`0`**，`ref === 1`: **`0`**，`ref === 0`: **`0`**；`ref === 2` 剩余由 `3,120` 降至 **`2,110`**（其中具名遗址仅余 `1,355` 处、BAtlas `Untitled` 遗址 `755` 处，均已预设分级草案，计划于 `v3.93–v3.94` 全量清零）。
   - 新增名邑含：`Barnhouse Settlement -> 巴恩豪斯新石器聚落（奥克尼哈雷湖滨遗址）`、`La Fonteta -> 拉丰特塔（塞古拉河口腓尼基殖民港城）`、`Sela -> 西拉（外约旦以东王国圣石崖壁古都）`、`Dyrta -> 迪尔塔（斯瓦特—迪尔山地亚历山大东征所至古邑）`、`Altenburg-Rheinau`、`Staré Hradisko`、`Malao`（厄立特里亚海周航记索马里兰柏培拉古大港）、`Quimper`、`[Siraf]`、`Qadissiyya`、`[Lykandos]/[Lapara]` 与 `Darabgird` 等；并在 [`scripts/validate-places.mjs`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/scripts/validate-places.mjs) 追加 12 条跨代生效断言（`-2500` 至 `1550`）。
2. **制图图层面板与档案阅读器界面重构（`public/cartography.css`、`public/product.css`）**：
   - 收敛桌面端与阅读态图层面板 `.layer-panel` 最大高度为 `max-height: min(512px, calc(100% - 140px))`（[`public/cartography.css`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/cartography.css#L63)），彻底消除此前展开图层抽屉时底部与右下角地图署名 `ⓘ` / 缩放按钮的贴边遮挡（实测保留 `10px` 净空，`overlapCtrl: false`）。
   - 为窄屏年份对照模式 `#map2` 分割线增加顶部柔和投影（`box-shadow: 0 -2px 14px rgba(0, 0, 0, .55)`），提升上下双球对比的视觉层次。
   - 升级政体/地点阅读器内元数据卡 `.fact`（顶部 `2px` 暖金强调线与右上角淡金径向微光）与历史侧记卡 `.editorial-fact`（渐变深蓝底纹、`3px` 左侧暖金边框与 `#ebd4a2` 文献外链），与文明页/资料页保持统一的黑曜石鎏金视觉语言。

## 验证结果

- **离线构建与全套测试**（`npm run prepare:assets && npm test && npm run test:http && npm run build` 退出码 `0`）：
  - `validate-places.mjs`: **23/23 PASS**；`validate-city-time.mjs`: **22/22 PASS**
  - `validate-lakes.mjs`: **17/17 PASS**；`validate-regional.mjs`: **21/21 PASS**
  - `validate-polity-display-names.mjs`: **17/17 PASS**；`validate-country-display-names.mjs`: **passed: true**（`39/31/62`）
  - `validate-startup-overlap.mjs`: **20/20 PASS**；`validate-map-catalog-app.mjs`: **26/26 PASS**
  - `polaris-worker`: **19/19 PASS**；`test:http`: **14/14 PASS**
  - `build-worker.mjs`: `staticStorageFiles: 377` / `storageFiles: 2551`
- **Chromium 实测（`docs/verification-3.92/final-benchmarks.json`）**：
  - 全局 `consoleErrors: []`，所有视口 `overlaps: []`、`labelOverlaps: []`、`pinOverlaps: []`、`clippedH: false`。
  - 未限速冷启动 `mapInteractiveMs`：`desktop_1492` **`475 ms`**、`south_asia_m250` **`313 ms`**、`china_742_regional` **`388 ms`**、`europe_1914_cshapes` **`717 ms`**、`mobile_390_1492` **`443 ms`**。
  - `1.5 Mbps / 150 ms RTT` 限速冷启动 `mapInteractiveMs`：`desktop_1492` **`4,155 ms`**、`south_asia_m250` **`3,844 ms`**、`china_742_regional` **`5,636 ms`**、`europe_1914_cshapes` **`6,205 ms`**、`mobile_390_1492` **`4,117 ms`**。
  - 实时域校验：`editorialCount: 9824`，`remainingRef4PlusWithoutZh: 0`，`remainingRef3WithoutZh: 0`，`remainingRef2WithoutZh: 2110`，`remainingRef1WithoutZh: 0`，`remainingRef0WithoutZh: 0`；图层面板间隙 `layerBottom: 628` vs `ctrlTop: 638`（`gapPx: 10`, `overlapCtrl: false`）；研究页零地图静态资源加载（`maplibreCssLoaded: false`、`maplibreJsLoaded: false`、`originalBodyBg: "rgb(255, 252, 244)"`、`originalTextLen: 61216`）。

## 后续规划（v3.93.0+）

- 在 `v3.93.0` 合并全部剩余 **1,355** 处具名 `ref === 2` 聚落（已预审并校验零英文残留），使全库具名历史聚落实现 100% 汉化；并在 `v3.94.0` 为剩余 `755` 处北非/昔兰尼加 `BAtlas Untitled` 调查聚落接入区域精准中文标签，实现全球 14,000+ 历史聚落零遗漏汉化。
- 持续视觉走查并打磨事件阅读器、城市里程碑时间线、移动浏览抽屉与加载骨架屏细节。
