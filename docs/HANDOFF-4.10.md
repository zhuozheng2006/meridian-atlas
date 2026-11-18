# 经纬纪 · 4.10 交付与验证记录

版本 `4.10.0` 根据真机多视口截图复核，解决区域详图弹窗遮挡右上角工具栏、移动端专题主标题孤字换行，以及世界史年表静态计数的按钮化误导等视觉细节问题。

## 核心改动

1. **桌面端区域详图弹窗避让工具栏**
   - 在 [cartography.css](../public/cartography.css) 中将 `@media(min-width:761px)` 下 `.regional-popup:not(.regional-index)` 从垂直居中改为固定于工具栏下方（`top: 66px; transform: none`，双图对照模式下为 `top: 114px`），并相应约束弹窗内容最大高度（`calc(var(--regional-panel-height, 70dvh) - 62px)`），确保查阅 HALC、AWMC、CHGIS 与中国研究截面弹窗时右上角地图工具条保持完整可见与可点击。
2. **HALC 档案卡选项卡悬停反馈**
   - 在 [cartography.css](../public/cartography.css) 中为 `.halc-tabs button` 补充 `color` / `background` 过渡与 `:hover` 状态，使其反馈手感与详情阅读器 `.reader-tabs button` 一致。
3. **移动端专题主标题防孤字换行与年表计数去按钮化**
   - 在 [product.css](../public/product.css) `@media(max-width:760px)` 中将 `#contentView h1` 字号调整为 `clamp(24px, 6.8vw, 28px)` 并启用 `text-wrap: balance`，消除 `390×844` 窄屏下“沿着一条线索，穿过世界 / 史”的末尾孤字折行，同时补充 `#contentView` 底部留白（`padding-bottom: 36px`）。
   - 将 `#view=library` `.library-controls .tag` 改为右对齐纯金字排版计数（移除边框与按钮底色），使“导出完整事件数据”成为筛选栏唯一的胶囊操作按钮。

## 验证结果

- `npm run prepare:assets`：通过（`270` 份 native + `117` 份 detail 内容指纹与资源戳更新）。
- `npm test`：全部校验通过（退出码 `0`），包含 Polaris `27/27`、分页 `18/18`、视图状态 `69/69`、研究路由 `15/15`、研究版本 `8/8`、边框描绘 `10/10`、启动重叠 `20/20`、HALC 选区 `24/24` / 重载 `13/13` / 渲染 `18/18` / 生命周期 `29/29` / 缓存 `15/15` / 双源 `30/30` / 连续性 `24/24`、区域边界连续性 `26/26` / 冻结独立性 `24/24` / OHM `10/10`、全库映射 `9/9`（`5,424` 年 / `254,592` 对）、地图目录应用集成 `26/26`。
- `npm run test:http`：`14/14 local HTTP checks passed`。
- `npm run build`：`dist/server/index.js` 与 `dist/client` 构建通过（`377` 静态存储对象 / `2,551` Worker 文件）。
- 无头 Chrome 独立冷进程验证（见 [final-benchmarks.json](verification-4.10/final-benchmarks.json)）：
  - 桌面 `1492`：直连 `334 ms` / `1.5 Mbps + 150ms RTT` `4,018 ms`（传输 `651,352 B`）
  - 移动 `390×844` `1492`：直连 `331 ms` / `1.5 Mbps + 150ms RTT` `4,037 ms`；移动对比 `319 ms`，顶部工具栏高度 `36 px`
  - 真机域内校验：HALC `1500` 地理环境弹窗 `popupTop: 124` > `toolsBottom: 116`（`popupToolsOverlap: false`, `popupBottomOverlap: false`）；AWMC `200 CE` “罗马帝国”弹窗 `popupToolsOverlap: false`；`#view=library` 计数 `709 条事件` 背景透明；移动端 `390×844` `#view=stories` 主标题 `height: 38px`（`linesEstimate: 1`）零孤字折行；全部页面零控制台错误（`consoleErrors: []`）。
