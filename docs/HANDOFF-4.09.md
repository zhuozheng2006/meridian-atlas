# 经纬纪 · 4.09 交付与验证记录

版本 `4.09.0` 聚焦地图标注避让、研究截面与公元前区划纪年规范化，以及地图档案弹窗的信息层级与可读性提升。

## 核心改动

1. **中国研究截面与 HALC 纪年表达统一**
   - 在 [china-prefectures.js](../public/china-prefectures.js) 的 `chinaWindowFor()` 与 `chinaRecordPanel()` 中引入 `formatYear`，将截面面板中的裸年份（如 `742`）统一格式为“公元 742 年 / 742 CE”，使研究截面弹窗、窗口标题与 CHGIS、AWMC 保持一致。
   - 在 [halc-boundaries.js](../public/halc-boundaries.js) 的档案面板中，将“资料年份 / Snapshot year”从裸数字 `'1500'` 统一为“公元 1500 年 / 1500 CE”。
2. **区划索引与弹窗公元前 / 单年纪年规范化**
   - 在 [regional-boundaries.js](../public/regional-boundaries.js) 中新增 `regionalDateText()`，对整年字符串（含 `CHGIS` 公元前负数年份如 `-202`）自动通过 `formatYear()` 格式为“公元前 202 年 / 202 BCE”；同时让 `regionalPeriod()` 对单年研究截面合并去重（如显示“公元 742 年”而非“742 — 742”），并同步更新 `ohmNote()` 与 `openFeature()` 起止日期格式。
3. **湖泊名称与府级区划标注双向避让**
   - 在 [lakes.js](../public/lakes.js) 的 `LakeLayer.refreshLabels()` 遮挡检测选择器中补全 `.regional-label`、`.historical-label`、`.regional-controls`、`.compare-heading`、`.map-legend`、`.historical-browse`、`.battle-marker` 与 `.atrocity-marker`，消除异步湖泊水名（如 `1820` 年安徽巢湖）与 CHGIS 府级标注（`庐州府`）相互重叠的问题。
   - 在 [places.js](../public/places.js) 中通过 `overlayBlockerBoxes('.map-legend,.lake-label')` 让城邑标注同样避让水名标注。
4. **地图历史档案弹窗排版精修**
   - 在 [cartography.css](../public/cartography.css) 中优化 `.historical-popup dl` 的双列网格基线对齐与长字段换行，并为弹窗内 `.historical-popup details`（名称考证、来源说明折叠块）增加玄曜金框卡片样式与焦点环。

## 验证结果

- `npm run prepare:assets`：通过（`270` 份 native 打包指纹 + `117` 份 detail 内容指纹与清单完成重建与资源戳更新）。
- `npm test`：全部校验通过（退出码 `0`）：
  - Polaris 阅读器 `27/27`、分页 `18/18`、视图状态 `69/69`、研究路由 `15/15`、研究版本 `8/8`、边框描绘 `10/10`、启动重叠检查 `20/20`
  - HALC 选区 `24/24`、实景样式重载 `13/13`、渲染就绪 `18/18`、生命周期 `29/29`、缓存 `15/15`、双源并发 `30/30`、连续性 `24/24`
  - 区域边界连续性 `26/26`、冻结/在线独立性 `24/24`、OHM 异步请求 `10/10`
  - 全库目录映射 `9/9`（覆盖 `5,424` 年、`254,592` 条政体-年份对）、地图目录应用集成 `26/26`、事件索引 `709` 条 / 政体分组 `1,592` 组 / `64` 个分片桶（`13,380` 条记录）
- `npm run test:http`：`14/14 local HTTP checks passed`。
- `npm run build`：`dist/server/index.js` 与 `dist/client` 构建通过（`377` 个静态存储对象 / `2,551` 个 Worker 资源文件）。
- 无头 Chrome 独立冷进程验证（见 [final-benchmarks.json](verification-4.09/final-benchmarks.json)）：
  - 桌面 `1492`：直连 `322 ms` / `1.5 Mbps + 150ms RTT` `4,022 ms`（传输 `651,227 B`），全量目录请求 `0` 次
  - 移动 `390×844` `1492`：直连 `338 ms` / `1.5 Mbps + 150ms RTT` `4,014 ms`；移动对比 `390×844`：`317 ms`，顶部工具栏高度 `36 px`
  - 真机域内验证：公元 `742` 年“太原府”截面年份显示 `公元 742 年`；公元前 `100` 年 CHGIS 索引显示 `公元前 114 年 — 公元 13 年 · chgis-prefecture-1825`；公元 `1820` 年巢湖周边区域标注与湖名碰撞计数 `collisions: []`；全部 14 组页面零横向溢出、零重叠、零控制台报错（`consoleErrors: []`）。
