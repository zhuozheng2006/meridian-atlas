# 经纬纪 · 4.13 交付与验证记录

版本 `4.13.0` 进一步补齐**数据源实时状态同步、出版级地图导出署名与双图对照拼图导出，以及全站搜索框统一键盘清空体验**，完成从数据完整性、可靠性到用户体验与视觉细节的全面闭环。

## 核心改动

### 1. 出版级地图导出：动态实际数据源署名与双年份对照拼图
- **动态按实际在显图层署名**（[app.js](../public/app.js) `exportSourceCredit()`）：消除此前导出图片一律硬编码 `Cliopatria / Seshat` 的问题，改为精确识别当前实际渲染的边界数据源：
  - `HALC · 1500 低地国家区划与历史地貌`
  - `汉唐历史区划（公元 2、742 年）` / `CHGIS V4 历史府级区划` / `AWMC 罗马帝国疆域（ODbL 1.0）` / `OpenHistoricalMap 历史区划（CC0）`
  - `CShapes 2.1 · Schvitz et al.（CC BY-NC-SA 4.0）`
  - `Natural Earth 史前自然底图`（公元前 3400 年以前）
  - `Cliopatria / Seshat（CC BY 4.0）`
- **双年份对照并排高清 PNG 导出**（[app.js](../public/app.js) `captureMapCanvas()` / `exportMapImage()` / `downloadMapImage()`）：在年份对照模式（`compare=1`）下点击“导出”时，并行捕获左右两张 WebGL 画布，以暗金双线画框与中央黄铜分割线合成为双图并排对比图（标题 `公元 1492 年 ⇄ 公元 1914 年`，文件名 `meridian-1492-vs-1914.png`），并自动并列署名左右两侧的实际来源。
- **纯英文导出零汉字水印**（[app.js](../public/app.js)）：`lang=en` 下右下角角标切换为 `◎ MERIDIAN ATLAS` / `Historical World Atlas`，实现纯英文导出与纯英文全站界面的 100% 一致。

### 2. 侧栏底部数据源状态实时同步
- **与实际在显数据源一致**（[app.js](../public/app.js) `renderDatasetStatus()` / `handleGeometryStatus()`）：
  - 当 CShapes 国家边界接管画面时，侧栏底栏即时更新为 `147 个国家与属地 · 709 条事件`（英文 `147 states & territories · 709 events`），不再停留在已隐藏的 Cliopatria 政体计数。
  - 当时间轴位于公元前 3400 年以前史前年代时，显示 `史前自然底图 · 709 条事件`（英文 `Prehistoric base · 709 events`），消除 `0 个当年政体` 的生硬提示。

### 3. 全站检索框统一 `Esc` 键盘交互
- **一致的防误关清空体验**（[polity-reader.js](../public/polity-reader.js)、[research-reader.js](../public/research-reader.js)、[polaris-reader.js](../public/polaris-reader.js)、[research-reading-library.js](../public/research-reading-library.js)、[identity-ledger.js](../public/identity-ledger.js)）：
  - 在政体档案「城市与聚落」搜索框 `#polityPlaceSearch` 中按 `Esc` 优先清空已输入的筛选词并阻断事件冒泡，不再误关整个国家档案抽屉。
  - 在 Equinox 研究阅读器、Polaris 2026 研究阅读器、原典书架与历史身份核查台账的所有检索输入框中统一加入 `Esc` 一键清空（空值时失焦），与主地图、世界年表和文明名录保持完全一致的键盘习惯。

## 全维度审计汇总（v4.11 – v4.13）

- **数据完整性**：全球 1,592 组政体（100%）、603 场战役与参战方/冲突/国家（100%）、805 条 CShapes 现代国家记录（100%）、1,115 处全球湖泊（100%）、2,040 条城市人口观测（100%）、307 处历史首都（100%）、7,342 处现代城市（100%）、1,246 条 OHM 区域详图要素（100%）均实现规范中文覆盖且原始档案零静默篡改；纯英文模式全站 7 大界面零汉字泄漏。
- **可靠性与性能**：全部 100+ 单元／契约／数据完整性测试与 `14/14` HTTP 测试零失败；WebGL 上下文丢失恢复、URL 安全解析、离线事件降级、热路径零分配几何计算与 LRU 并发缓存均就绪。
- **用户体验与视觉美观性**：桌面（`1440×900`）、平板（`900×1024`）与移动端（`390×844`）全视图实拍目视验收通过，零横向溢出、零控制台报错、全站下拉控件与 Obsidian × Brass 视觉语言高度统一。

## 验证结果

- `npm run prepare:assets`：通过。
- `npm test`：全部 100+ 校验脚本通过（退出码 `0`）。
- `npm run test:http`：`14/14 local HTTP checks passed`。
- `npm run build`：`dist/server/index.js` 与 `dist/client` 构建通过。
- 无头 Chrome 端到端与导出图像目视验收（零控制台错误）：
  - CShapes `1914` 侧栏状态栏：`147 个国家与属地 · 709 条事件`。
  - 史前 `-48000` 侧栏状态栏：`史前自然底图 · 709 条事件`。
  - 政体地点搜索 `#polityPlaceSearch` 按 `Esc` 仅清空检索词、档案抽屉保持打开。
  - 导出 `1492 ⇄ 1914` 双图对照 PNG（`468 KB`）与纯英文 CShapes `1914` PNG（`252 KB`）均排版精良、来源署名准确、零汉字泄漏。
