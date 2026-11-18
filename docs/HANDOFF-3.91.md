# 交接与验证记录 · v3.91.0

- **版本**: `3.91.0`
- **日期**: 2026-11-18
- **主工作区**: `/Users/zane/Documents/ChatGPT/MeridianAtlas`

## 本轮核心推进

1. **Wave-24 B2+B3 历史聚落全汉化补充（+680 处，`ref=2`）**：
   - 将 `wave24_ref2_b2.json`（400 处）与 `wave24_ref2_b3.json`（280 处）合并写入 [`public/places.js`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/places.js) 的 `PLACE_ZH_EDITORIAL`，人工编审词条由 `8,134` 增至 **`8,814`** 处。
   - 未译统计降至：`ref >= 4`: **`0`**，`ref === 3`: **`0`**，`ref === 1`: **`0`**，`ref === 0`: **`0`**；`ref === 2` 剩余由 `3,800` 降至 **`3,120`**。
   - 新增重点古都与名城译名包括：`Rājagṛha -> 王舍城（罗阅祇 · 摩揭陀早期都城）`、`Śrāvastī -> 舍卫城（室罗伐悉底 · 憍萨罗名都）`、`Vaiśālī -> 毗舍离古城（跋耆联邦名都）`、`Puṇḍranagara -> 奔那罗城（摩哈斯坦 · 孟加拉莫卧儿前古代大名都）`、`Virāta`、`Vidiśā`、`Tripuri`、`Śibipura`、`Tell Leilan`、`Mazaka`、`Pomaria`、`Eruandashat`、`Brugge`、`Dhahran`、`Mitanni` 与 `Contrebia Leucada` 等，并在 [`scripts/validate-places.mjs`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/scripts/validate-places.mjs) 新增 10 条生效年份断言（`-200`、`-1800`、`-100`、`200`）。
2. **界面与研究页视觉微调（`public/product.css`）**：
   - `.library-controls .tag` 统一为 `height: 40px` 暖金描边计数胶囊（与搜索框及筛选行齐平）。
   - 提升 `.research-filter-panel, .research-guide, .research-sources` 内边距（`padding: 10px 20px 16px`），并为 `.research-reading-library` 增加顶部暖金细边线与立体阴影。

## 验证结果

- **离线构建与全套测试**（`npm run prepare:assets && npm test && npm run test:http && npm run build` 退出码 `0`）：
  - `validate-places.mjs`: **23/23 PASS**
  - `validate-lakes.mjs`: **17/17 PASS**
  - `validate-regional.mjs`: **16/16 PASS**
  - `validate-polity-display-names.mjs`: **17/17 PASS**
  - `validate-country-display-names.mjs`: **passed: true**（`39` period entries / `31` names / `62` checks）
  - `validate-map-catalog-app.mjs`: **26/26 PASS**
  - `polaris-worker`: **19/19 PASS**
  - `test:http`: **14/14 PASS**
  - `build-worker.mjs`: `staticStorageFiles: 377` / `storageFiles: 2551`
- **Chromium 实测（`docs/verification-3.91/final-benchmarks.json`）**：
  - 全局 `consoleErrors: []`，所有视口 `overlaps: []`、`labelOverlaps: []`、`pinOverlaps: []`、`clippedH: false`。
  - 未限速冷启动 `mapInteractiveMs`：`desktop_1492` **`490 ms`**、`south_asia_m250` **`306 ms`**、`china_742_regional` **`372 ms`**、`europe_1914_cshapes` **`746 ms`**、`mobile_390_1492` **`489 ms`**。
  - `1.5 Mbps / 150 ms RTT` 限速冷启动 `mapInteractiveMs`：`desktop_1492` **`4,128 ms`**、`south_asia_m250` **`3,827 ms`**、`china_742_regional` **`5,681 ms`**、`europe_1914_cshapes` **`6,204 ms`**、`mobile_390_1492` **`4,115 ms`**。
  - 实时域校验：`editorialCount: 8814`，`remainingRef4PlusWithoutZh: 0`，`remainingRef3WithoutZh: 0`，`remainingRef2WithoutZh: 3120`，`remainingRef1WithoutZh: 0`，`remainingRef0WithoutZh: 0`；研究页零地图静态资源加载（`maplibreCssLoaded: false`、`maplibreJsLoaded: false`、`originalBodyBg: "rgb(255, 252, 244)"`、`originalTextLen: 61216`）。

## 后续规划（v3.92.0+）

- 继续按 `v3.92`、`v3.93`、`v3.94` 批次清理剩余 `2,358` 处具名 `ref === 2` 聚落与 `762` 处 `BAtlas Untitled` 区域聚落（`v3.95`），最终实现全部 Pleiades / Chandler 历史聚落 100% 汉化清零。
- 持续实测多视角（高倍缩放城市详图、城市档案阅读器、移动对比时间轴等）并优化界面美学与交互质感。
