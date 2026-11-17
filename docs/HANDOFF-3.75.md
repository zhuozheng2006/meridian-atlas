# 交接记录 · v3.75.0

**当前基线**：`v3.75.0` · **验证报告**：[benchmarks-3.75](verification-3.75/final-benchmarks.json)

---

## 本轮核心成果

### 1. 古典及中世地名全量覆证（Wave-10 · 累计 1,313 处 · Pleiades ref >= 16 100% 覆证）
- 在 [`public/places.js`](../public/places.js) 的 `PLACE_ZH_EDITORIAL` 增补 **Wave-10 共 119 处**权威双语地名（去重后累计 **`1,313` 处**），使全局 Pleiades 文献引用数 `ref >= 16` 的 `654` 处重镇实现 **100% 中文覆盖**（包括 *Cannae 坎尼*、*Corduba 科尔多瓦*、*Col. Barcino 巴尔奇诺（巴塞罗那）*、*Iconium 科尼亚*、*Sinope 锡诺普*、*Salona 萨洛纳*、*Bostra 布斯拉*、*Gadara 加达拉*、*Alexandria Eschate 极东亚历山大里亚（苦盏）*、*Cirta 西尔塔（君士坦丁）* 等）。
- 同步在 `750 CE` 中东／丝路／高加索与 `1960 CE` 非洲实境巡检中补齐全数可见的 **26 处**中世及跨时代地标（*Venice 威尼斯*、*Bagdata 巴格达*、*Uruk 乌鲁克*、*Nemavand 纳哈万德*、*Veh Ardashir 韦赫-阿尔达希尔（塞琉西亚）*、*Damghan 达姆甘（库米斯）*、*Nad-i Ali/Zarang? 扎兰季*、*Bam 巴姆*、*Baku 巴库*、*Lalibela 拉利贝拉*、*Eleutherna 埃莱夫塞尔纳*、*Sos Höyük 索斯丘克*、*Tzon/Tzur 佐尔* 等）；实测高卢 `100 CE`（`22/22`）、中东 `750 CE`（`12/12`）与非洲 `1960`（`5/5`）全部地标零遗漏、100% 中文可读；并在 [`scripts/validate-places.mjs`](../scripts/validate-places.mjs) 增补 10 项回归断言。

### 2. 海域地名对比光晕、样式表去重与交互帧流畅度优化
- **海域／海岸城市可读性跃升**：在 [`public/cartography.css`](../public/cartography.css) 为 `.place-marker` 及其英文副标、人口年份标注升级四向 `#f7f0dc` 羊皮纸实边光晕＋外层晕染，彻底解决 *巴士拉 Basra*、*开罗 Cairo*、*阿比让 Abidjan*、*萨尔瓦多 Salvador* 等跨海岸地名在深海蓝色底图上的字迹发虚问题（`hasCrispHalo: true`）。
- **`style.css` 冗余级联清理**：精确剔除 [`public/style.css`](../public/style.css) 中被 [`public/product.css`](../public/product.css) 与 [`public/cartography.css`](../public/cartography.css) 顶层无条件覆写的 `373` 条阴影视图声明（含 `34` 条空规则），文件由 `28,221 B` 降至 **`21,103 B`**，消减渲染阻塞样式体积与级联覆盖冲突。
- **零重排滑块预览、悬浮卡复用与无分配地名筛选**：
  - [`public/app.js`](../public/app.js)：将 `#yearSlider` 拖动手柄预览的 DOM 写入与宽度读取合并到 `requestAnimationFrame`（并缓存轨宽），并将 `renderYear()` 密度柱更新从全量 `130` 节点（260 次切换）缩减为前后高亮区间最多 `6` 节点（`meanInputMs: 15.7 ms`, `maxInputMs: 17.1 ms`）。
  - [`public/map-engine.js`](../public/map-engine.js)：`_renderHoverCard()` 按当前悬浮实体键值缓存已建 DOM 子树与尺寸（`hoverReused: true`），在同国境或同点位内移动鼠标时仅更新坐标，避免反复重建节点与同步 `offsetWidth` 重排。
  - [`public/places.js`](../public/places.js)：在 `PlaceLayer.refresh()` 中将地球投影背面剔除常量外提，并以零堆分配字符遍历与内联视口过滤取代每帧 `filter` 新数组和 `Array.from` 拆分。

---

## 全量验证与基准结果

| 校验项 | 结果 | 说明 |
|---|---|---|
| `npm run prepare:assets` | PASS | 生成 `dist` 预备资源与 270 原生 / 117 详图资产指纹 |
| `npm test` | PASS | 包含 `validate-places`（含 Wave-10 10 项新断言）、`validate-polity-display-names`、`map-catalog-app`（26/26）全数通过 |
| `npm run test:http` | PASS | **14/14** HTTP 内容协商、PBF 压缩及指纹校验通过 |
| `npm run build` | PASS | 生成完整 `dist/server/index.js` 与 `dist/client` 构建产物 |
| 无头 Chromium 全维度基准 | PASS | 13 路视口/网络冷启动 `0` 重叠、`0` 裁切、`consoleErrors: []`；`21` 项实境域检查全通过（桌面 `1492` 首屏交互 **`307 ms`**，`domInteractiveMs: 11 ms`） |

> 注：`liveDomainChecks` 期间捕获的 2 条 HTTP 404 日志均源自高卢 `z=5` 边缘请求纯大西洋水域的 Mapterhorn 静态缺失瓦片，所有冷启动基线与本地资源请求 `consoleErrors: []`。
