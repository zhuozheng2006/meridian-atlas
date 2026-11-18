# 交接与验证记录 · v3.93.0

- **版本**: `3.93.0`
- **日期**: 2026-11-18
- **主工作区**: `/Users/zane/Documents/ChatGPT/MeridianAtlas`

## 本轮核心推进

1. **Wave-26 全部剩余具名历史聚落清零汉化（+1,355 处，`ref=2`）**：
   - 合并 [`public/places.js`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/places.js) 中全部剩余具名 `ref === 2` 历史聚落共 **`+1,355`** 处，`PLACE_ZH_EDITORIAL` 人工编审词条由 `9,824` 跃升至 **`11,179`** 处。
   - 经真实运行时 `placeAtYear()` / `placeName()` 检验，当前全库 **`ref >= 4`、`ref === 3`、`ref === 1`、`ref === 0` 及全部具名聚落（`remainingNamedWithoutZh`）未译数均已清零（`0`）**；全库未译条目仅剩 `755` 处北非/昔兰尼加等地 `BAtlas Untitled` 调查遗址点（计划于 `v3.94.0` 清零）。
   - 代表性新增译名涵盖：`Lothal`（洛塔尔古船坞遗址）、`Wahshushana`（瓦胡舒沙纳）、`Kinneret`（基内雷特）、`Heuneburg/Hohenasperg`（霍恩阿斯佩格）、`Kampyrtepa`（坎皮尔丘）、`Amaravati`（阿马拉瓦蒂大佛塔古都）、`Sisupalgarh`（西苏帕尔加尔）、`Helgö`（海尔戈）、`Qasr-e Shirin`（卡斯尔希林）、`Nydam`（尼达姆）、`Stari Ras`（旧拉斯城）、`Ghadames`（加达梅斯古城）与 `Vix/Mont Lassois`（拉苏瓦山城），并在 [`scripts/validate-places.mjs`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/scripts/validate-places.mjs) 追加 13 条跨代生效断言（`-2500` 至 `1800`）。
2. **城市档案、历史年表与浮层提示 UI 精修（`public/cartography.css`、`public/product.css`）**：
   - 在 [`public/cartography.css`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/cartography.css#L104-L119) 中为城市篇章年份摘要 `.city-chapter-intro p` 升级鎏金胶囊徽标样式（`border-radius: 999px`、`display: inline-block`），并为 `.city-milestones` 城市时间刻度节点新增悬浮微光圆环（`box-shadow` 暖金光晕）与 `8px` 圆角高亮交互卡片。
   - 在 [`public/product.css`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/product.css#L77) 中为世界历史年表 `.chronicle-table` 增添偶数行深蓝微弱斑马条纹（`#0c192759`）与行悬停左侧 `3px` 暖金强调线，并在表尾追加黑曜石毛玻璃质感 `#toast` 全局轻提示浮窗，消除旧式扁平纯色底框割裂感。

## 验证结果

- **离线构建与全套测试**（`npm run prepare:assets && npm test && npm run test:http && npm run build` 退出码 `0`）：
  - `validate-polity-display-names.mjs`: **17/17 PASS**；`validate-country-display-names.mjs`: **passed: true**（`39` / `31` / `62`）
  - `validate-startup-overlap.mjs`: **20/20 PASS**；`validate-map-catalog-app.mjs`: **26/26 PASS**
  - `polaris-worker`: **19/19 PASS**；`test:http`: **14/14 PASS**
  - `build-worker.mjs`: `staticStorageFiles: 377` / `storageFiles: 2551`
- **Chromium 实测（[`docs/verification-3.93/final-benchmarks.json`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/docs/verification-3.93/final-benchmarks.json)）**：
  - 全局 `consoleErrors: []`，所有视口 `overlaps: []`、`labelOverlaps: []`、`pinOverlaps: []`、`clippedH: false`。
  - 未限速冷启动 `mapInteractiveMs`：`desktop_1492` **`631 ms`**、`south_asia_m250` **`482 ms`**、`china_742_regional` **`572 ms`**、`europe_1914_cshapes` **`690 ms`**、`mobile_390_1492` **`440 ms`**。
  - `1.5 Mbps / 150 ms RTT` 限速冷启动 `mapInteractiveMs`：`desktop_1492` **`4,171 ms`**、`south_asia_m250` **`3,898 ms`**、`china_742_regional` **`5,754 ms`**、`europe_1914_cshapes` **`6,270 ms`**、`mobile_390_1492` **`4,119 ms`**。
  - 实时域与 UI 核查：`editorialCount: 11179`，`remainingNamedWithoutZh: 0`，`remainingRef2WithoutZh: 755`；长安城市档案（`#year=800&place=chandler%3A1552`）胶囊徽标与 3 枚里程碑节点渲染正常（`pillRadius: "999px"`、`milestoneBorderRadius: "8px"`、`toastBgCheck: true`）；年表表格 709 行渲染偶数行底色 `rgba(12, 25, 39, 0.35)`；专题导读进度条正常；研究页零地图静态资源加载（`maplibreCssLoaded: false`、`maplibreJsLoaded: false`、`originalBodyBg: "rgb(255, 252, 244)"`、`originalTextLen: 61216`）。

## 后续规划（v3.94.0+）

- 合并全部剩余 **`755`** 处 `BAtlas Untitled` 区域调查聚落（按行省与亚流域/时代分级标注，已预审备妥于草案），实现全库 **`100%`（0 遗漏）** 历史聚落双语覆盖。
- 继续走查并优化事件阅读器、搜素筛选标签、导出弹框与冷启动关键路径体积。
