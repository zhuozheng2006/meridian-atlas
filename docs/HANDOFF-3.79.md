# 经纬纪 · Meridian Atlas — 3.79 交接与验证记录

## 本阶段完成项（v3.79.0）

1. **Wave-14 历史地名全量汉化（Pleiades `ref >= 12` 100% 覆盖，`2,014` 条编辑词条）与 `开城` 纠偏**
   - 在 [`public/places.js`](../public/places.js) 的 `PLACE_ZH_EDITORIAL` 补充 200 处 `referenceCount === 12` 古典聚落、22 处亚洲丝绸之路与南亚重镇及 4 处中世纪欧洲可见站点，词条总数达到 **2,014** 条（全部 `Pleiades ref >= 12` 聚落实现 100% 中文覆盖，`remainingRef12PlusWithoutZh: 0`）。
   - 新增代表地标包括：埃里都、尼姆鲁德（卡拉赫）、萨迈拉、布拉克丘（纳加尔）、纳帕塔、滨海凯撒利亚、尼亚波利斯（纳布卢斯）、沙特尔、沃尔姆斯、科布伦茨、马穆基乌姆（曼彻斯特古堡）、巴里加扎、憍赏弥、布哈拉、塞里科山城、温格丹肯等。
   - 新增 `PLACE_ZH_OVERRIDE` 修复 `chandler:659`（Kaesong）原数据抓取残留的“开城特级”行政后缀，在历史地图与检索中规范显示为**开城**。

2. **多方向城市标注防遮挡、左向标记对齐与跨源去重（`PlaceLayer.refresh`）**
   - 修复 [`public/cartography.css`](../public/cartography.css) `.place-marker.label-left` 弹性布局方向（`flex-direction: row-reverse`），使朝左延伸的城市文字将其坐标圆点精确锚定在右侧真实城市经纬度上。
   - 增强 [`public/places.js`](../public/places.js) `PlaceLayer.refresh()`，在左右受事件点遮挡时尝试上下方向及无重复圆点防遮挡位置（如公元 1000 年**开封**在“宋朝建立”事件点正下方稳定显示），并对同一城市跨 `chandler`/`modelski` 等多来源的重叠记录去重，消除地图双标签堆叠。

3. **大国政体多点避让防吞字（`pointInGeometry` + `MapEngine.refreshLabels`）**
   - 在 [`public/geometry-anchor.js`](../public/geometry-anchor.js) 导出 `pointInGeometry()` 射线法多边形内外判定（含孔洞处理）。
   - 修改 [`public/map-engine.js`](../public/map-engine.js) `refreshLabels()`：当大国政体几何中心恰与小型事件点碰撞时（如公元 1000 年**北宋**中心与“毕升活字印刷”点轻度相交），先尝试视口裁剪内点 `interiorPoint()` 及多方向偏移，并在 `pointInGeometry()` 验证仍严格位于本国疆域内时采用无碰撞落点，恢复北宋等大国标识在地图上的清晰展示。

4. **政体关联事件预编译匹配与空摘要防护、媒体查询冗余 CSS 精简**
   - 修复并优化 [`public/polity-reader.js`](../public/polity-reader.js) `relatedEvents()`：将多别名正则匹配器移出 `709` 条事件过滤循环预编译，同时使用 `e.summary?.zh` / `e.summary?.en` 防止摘要缺失事件触发 `TypeError`。
   - 精简 [`public/style.css`](../public/style.css) `@media(max-width:760px)` 与 `@media(min-width:1500px)` 中被后续样式无条件覆盖的 96 条冗余声明，体积由 `21,103 B` 降至 **`19,138 B`**。

## 验证与基准实测（`docs/verification-3.79/final-benchmarks.json`）

- **单测、HTTP 与构建**：`npm run prepare:assets && npm test && npm run test:http && npm run build` 全部通过（exit code `0`；`14/14` HTTP 检查）。
- **隔离冷启动性能（13 组无缓存 Chromium 进程）**：
  - `desktop_1492` 非限速首交互：**`308 ms`**（`domInteractiveMs: 9 ms`、`overlaps: []`、`labelOverlaps: []`、`pinOverlaps: []`、`fullCatalogRequested: false`）。
  - `desktop_1492` 1.5 Mbps / 150ms RTT 限速首交互：`4031 ms`（`645,434 B`，`36` 个请求）。
  - 所有 13 组隔离实例与全部实时域检查 `consoleErrors: []`。
- **实机视觉与域回归检查**：
  - `east_asia_1000ce`：成功呈现**北宋 / Northern Song** 等 10 个政体标签，**开封**唯一展示（`kaifengCount: 1`），`labelHits: []`、`pinHits: []`、`noZhPlaces: []`，`.place-marker.label-left` 计算样式为 `row-reverse`。
  - `europe_1000ce` 与 `andes_1500`：均实现 `noZhPlaces: []`、`hits: []`。
  - `#view=research`（汉谟拉比法典已保存原文）：零地图脚本 CSS/JS 隔离（`false`），展开 `.research-original-body` 正常呈现温暖羊皮纸背景 `rgb(255, 252, 244)` 与 `61,216` 字符原文正文。
  - `#view=polities` 明朝档案：`eventsTabRenderMs: 1 ms`、`relatedEventsCount: 2`、`#polityFullExport` 样式正确加载。

## 后续计划（v3.80.0）

- **Pleiades `ref === 11` 224 处聚落 Wave-15 全量汉化**：覆盖 `ref >= 11`（含加沙、瓦伦西亚、马里卜、科尔切斯特、克桑滕、阿莱西亚、德黑兰、摩纳哥等）。
- **`openBattle` 与 `battles.js` / `openAtrocity` 全量中文化补完**：使 `openBattle` 正确优先使用 `belligerentsZh`、`conflictZh`、`countriesZh` 及本地化大洲地区名称，并补齐 92 条参战方/冲突/Q11655534 遗漏英文串的中文映射。
- **合并 [`public/cartography.css`](../public/cartography.css) 29 处重复声明**，进一步压低首屏 CSS 传输开销并复验全视图。
