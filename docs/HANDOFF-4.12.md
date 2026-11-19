# 经纬纪 · 4.12 交付与验证记录

版本 `4.12.0` 围绕**数据完整性（全站 1,592 组政体 100% 规范中文显示与检索）、运行时可靠性、交互体验升级与界面视觉精修**四个维度完成深度优化。

## 核心改动

### 1. 数据完整性：1,592 / 1,592 政体全链路规范中文统一
- **统一派生政体显示映射**（[polity-names.js](../public/polity-names.js)、[map-engine.js](../public/map-engine.js)、[polity-reader.js](../public/polity-reader.js)、[app.js](../public/app.js)）：
  - 将此前仅作用于地图标注的 `POLITY_LABEL_ZH_FIX`（并清理 `'巴厘省'`、`'巴达维亚共和国 (荷兰殖民地)总督'` 重复键，新增 `Kashmir Sultanate`、`Kingdom of Namayan`、`Bima Sultanate` 三条叙事标题补齐）提升为 [polity-names.js](../public/polity-names.js) 的公共派生接口 `displayPolityZh()` 与 `displayPolityName()`，同时保持 `polityName()`、`groupPolityRecords()` 与 `groupPolityIndex()` 对原始数据的零改动与完整兼容。
  - **全站统一覆盖**：地图标签、鼠标悬停卡片、侧栏全局检索（`searchPolityRecords` 与 `searchPolityIndex` 同步支持规范中文查询与精确命中排序）、`#view=polities` 文明名录卡片与检索、`PolityReader` 档案标题（含叙事 `editorial.title.zh` 二次纠偏）、导语、相关事件匹配、完整档案导出与 PNG 地图导出标题全部对齐一致。
  - **端到端效果**：此前在目录／搜索／档案中裸露英文或 Wikidata 错译的 **71 组未译政体**（如 `东吁第一帝国`、`南吴（杨吴）`、`胡夏`、`闽国`、`北海帝国`、`格拉纳达泰法`）与 **27 组错译政体**（如 `中山国` 替代 `中山市`、`利沃尼亚邦联` 替代 `立窝尼亚语`、`切尔尼戈夫公国` 替代 `切尔尼戈夫统治者列表`）实现 **100.0%（1,592 / 1,592）** 规范中文覆盖与可检索性。
- **时间轴刻度本地化**（[app.js](../public/app.js)）：消除此前时间轴底栏硬编码的 `70000 BCE`、`10000 BCE` 英文刻度；在中文／双语模式下显示紧凑清晰的 `前7万 · 前1万 · 前3400 · 公元1 · 1500 · 1800 · 2026`，纯英文模式显示 `70,000 BCE · 10,000 BCE · 3400 BCE · 1 CE · 1500 · 1800 · 2026`。

### 2. 运行时可靠性与容错加固
- **URL 主机名安全解析**（[app.js](../public/app.js)、[polity-reader.js](../public/polity-reader.js)）：将 `sourceLinks()`、`renderPlaceDetail()` 与 `PolityReader.sources()` 中裸调的 `new URL(...).hostname` 改为带异常捕获的安全解析，防止单条异常链接中断整页档案渲染。
- **离线／缺省事件容错与弹窗防重入**（[app.js](../public/app.js)、[research-shell.js](../public/research-shell.js)）：为 `renderEventDetail()` 补齐 `sources` / `summary` / `significance` / 分类键值缺失时的优雅降级；为 `#helpDialog.showModal()` 补齐 `openDialog()` 幂等守卫，避免重复触发抛错。
- **WebGL 上下文丢失与自动恢复**（[map-engine.js](../public/map-engine.js)）：在 `webglcontextlost` 中调用 `e.preventDefault()` 允许浏览器恢复上下文，补齐 `webglcontextrestored` 自动重绘与尺寸同步，并在 `destroy()` 中安全移除画布监听器。

### 3. 交互体验升级
- **自然公元前／后年份输入**（[timeline-controls.js](../public/timeline-controls.js)、[index.html](../public/index.html)）：新增 `parseYearInput()`，主时间轴与对照年份框现支持自然输入 `-221`、`前221`、`公元前 221 年`、`221 BCE`、`221 BC`、`1492 CE`、`公元 1492 年`、`1,492` 等格式，同时严格拒斥 `0`、`0 BCE`、小数及无效文本。
- **可点击交互式疆域面积柱状图**（[polity-reader.js](../public/polity-reader.js)、[app.js](../public/app.js)、[product.css](../public/product.css)）：
  - 政体档案「疆域」页 SVG 面积时间线新增虚线参考网与峰值面积标注（如 `6,272,929 km²`），每根柱条均支持鼠标点击与键盘 `Enter`/`Space` 聚焦跳转至对应疆域时期。
  - 修复 `jumpPolity()` 未返回 `openPolity()` Promise 导致切换时段后标签页重置回「概览」的异步时序缺陷，点击柱条或时段胶囊现稳定停留在「疆域」页。
- **键盘检索快跳与时间轴悬停预览**（[app.js](../public/app.js)、[product.css](../public/product.css)）：
  - 侧栏搜索框按 `Enter` 直跳首条匹配结果，按 `Esc` 一键清空或失焦（年表与文明页搜索框同步支持 `Esc` 清空）；聚焦或输入时 `.search-kbd` 提示徽标平滑隐去，不再遮挡原生清除图标。
  - 桌面端鼠标在底部时间轴滑轨上悬停（`pointermove`）即可实时预览对应年份与历史分期，先看后点更精准。
  - 同步更新 `#helpDialog` 指南与快捷键速查表。

### 4. 界面美观性精修
- **全站 `<select>` 下拉箭头统一恢复**（[research-reader.css](../public/research-reader.css)、[product.css](../public/product.css)）：修复 4 处 CSS 简写 `background:` 覆盖 `product.css` 下拉箭头 SVG 的问题（研究阅读器版本切换框 `.research-version-bar select`、原典书架阶段选择框 `.research-library-controls select`、原文工具条 `.research-original-tools select` 与身份核查台账状态筛选 `.quality-controls select`），确保全站所有下拉控件交互可见性一致。
- **移动端地图工具栏对称精排**（[cartography.css](../public/cartography.css)）：为 `≤760px` 视口下的 `.map-tools button` 增加独立磨砂胶囊底面与 `flex: 1 1 auto` 自适应均衡填充，彻底消除双行工具栏左侧空洞与悬浮散乱感。

## 验证结果

- `npm run prepare:assets`：通过（`270` 份 native + `117` 份 detail 内容指纹与资源戳更新）。
- `npm test`：全部 100+ 校验脚本通过（退出码 `0`），包括 `validate-polity-display-names`（`17/17`）、`validate-polity-search-index`（`1,592` 组 / `13,380` 条）、`validate-map-catalog-app`（`26/26`）、`validate-startup-overlap`（`20/20`）、`validate-city-reader-navigation`、`validate-interactions`、`validate-v3`、`validate-view-state` 及全部 Polaris / Equinox / HALC / OHM / CHGIS / CShapes 校验。
- `npm run test:http`：`14/14 local HTTP checks passed`。
- `npm run build`：`dist/server/index.js` 与 `dist/client` 构建通过（`377` 静态存储对象 / `2,551` Worker 文件）。
- 真实无头 Chrome 端到端与视觉截图验收（桌面 `1440×900` + 移动 `390×844`，零控制台／页面错误）：
  - 时间轴中文刻度（`前7万 … 公元1 … 2026`）、自然公元前／后年份输入（`前221`、`1492 CE`、`0 BCE` 拒绝回退）全部通过。
  - 侧栏搜索 `东吁第一帝国` → `Enter` 直跳 → 档案标题一致显示 `东吁第一帝国 / First Toungoo Empire`；`#view=polities` 检索 `中山国` 正确显示 `中山国` 且零 `中山市` 残留。
  - 明朝「疆域」页交互式 SVG 图表（`27` 根可点击柱条、峰值 `6,272,929 km²`）点击末期柱条成功切换至 `公元 1642 年` 且保持停留在「疆域」标签页。
  - 实拍目视验收：研究阅读器版本与原典书架下拉箭头、身份核查台账下拉箭头、图层窗、帮助窗、专题页、资料页及移动端对称工具栏均排版工整、无遮挡、无溢出。
