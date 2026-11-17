# 经纬纪 · Meridian Atlas — 3.78 交接与验证记录

## 本阶段完成项（v3.78.0）

1. **Wave-13 历史地名全量汉化覆盖（Pleiades `ref >= 13` 达到 100%）**
   - 在 [`public/places.js`](../public/places.js) 的 `PLACE_ZH_EDITORIAL` 补充 190 处古典时期聚落中文译名，词条总数达到 **1,788** 条（全部 `1,118` 处 `referenceCount >= 13` Pleiades 聚落实现 100% 中文覆盖，`remainingRef13PlusWithoutZh: 0`）。
   - 新增代表条目包括：帕萨尔加德（巴特拉卡塔什）、乌尔、塔克西拉、阿克苏姆、博洛尼亚（费尔西纳/波诺尼亚）、新迦太基（卡塔赫纳）、阿奎莱亚、都拉斯（迪拉基乌姆）、拉伊（拉加埃/雷伊）、法萨卢斯、林杜姆（林肯）、萨拉曼卡（萨尔曼蒂卡）等。
   - 在 [`scripts/validate-places.mjs`](../scripts/validate-places.mjs) 补充 12 条 Wave-13 回归断言并更正 `pleiades:912985`（乌尔）年代断言点至其真实索引时段 `[-750, -330]` 内的 `-500`。

2. **地图边缘悬停浮窗智能翻转（`_renderHoverCard` Edge-Flipping）**
   - 修改 [`public/map-engine.js`](../public/map-engine.js) `_renderHoverCard()`：当指针靠近视口右缘或下缘时，悬停浮窗向指针左方（`point.x - 14 - sz.w`）或上方（`point.y - 14 - sz.h`）翻转，避免浮窗跨遮被悬停地标。

3. **政体档案导出按钮与历史关联按钮视觉统一**
   - 修改 [`public/product.css`](../public/product.css)，使 `#polityFullExport` 及 `.reader-content > button[data-chain]` 采用与 `#eventExport` 一致的 Obsidian × Brass 边框与字体规范。

## 验证与基准实测（`docs/verification-3.78/final-benchmarks.json`）

- **资源生成、单测、HTTP 压缩与 Worker 构建**：
  - `npm run prepare:assets && npm test && npm run test:http && npm run build` 全部通过（exit code `0`）。
  - `test:http` `14/14` 本地 HTTP/gzip/HEAD 校验通过。
- **隔离冷启动性能与布局无重叠基准**（`node scratch/v378_benchmark.mjs`，共 13 组隔离 Chromium 实例）：
  - `desktop_1492` 非限速首交互：`335 ms`（`domInteractiveMs: 12 ms`、`fullCatalogRequested: false`、`overlaps: []`、`labelOverlaps: []`、`pinOverlaps: []`）。
  - `desktop_1492` 1.5 Mbps / 150ms RTT 限速首交互：`4006 ms`（传输 `645,300 B`，`36` 个请求）。
  - 多视口对比模式（1280×720 / 834×1194 / 390×844）与所有路由均无重叠与水平溢出，`consoleErrors: []`。
  - 实时域检查验证 `editorialCount: 1788`、边缘悬停左翻/上翻（`flippedRight: true`、`flippedBottom: true`）、LayerPanel 点击外部及 `Escape` 关闭、`east_asia_1000ce` 无缺失中文地名（`noZhPlaces: []`）。

## 后续计划（v3.79.0）

- **Pleiades `ref === 12` 200 处聚落 Wave-14 全量覆盖**：补全埃里都、萨迈拉、尼姆鲁德、纳帕塔、布拉克丘、沙特尔、索瓦松、沃尔姆斯、科布伦茨、马穆基乌姆（曼彻斯特古堡）等 200 处遗址中文译名，实现全量 `ref >= 12` 100% 汉化。
- **`PolityReader.relatedEvents()` 性能优化**：避免在 709 条事件过滤循环内重复编译正则。
- **`1000 CE` 东亚视图（北宋标注排查）与精简 `@media` 冗余 CSS**，并在 Chromium 中完整打开检验已保存原文羊皮纸阅读面板及美洲/欧洲等典型历史视口。
