# 经纬纪 · 4.11 交付与验证记录

版本 `4.11.0` 围绕**全站双语一致性、全局检索与中文输入法体验、政体地点与时间窗口准确度、几何／点图层／本地服务运行时性能**四个维度完成深度改进与优化。

## 核心改动

### 1. 全界面动态双语同步与英文零汉字残留
- **工具条、图层窗与参照徽标即时联动**（[app.js](../public/app.js)）：在 `renderLanguage()` 中补全 `#battlesBtn`、`#exportMapBtn`、`#atrocitiesBtn` 与 `#referenceBadge` 的动态文本与提示更新，消除运行中切换 `bi` / `zh` / `en` 时按钮滞留中文的问题。
- **战役／暴行详情语言切换与导出同步**（[app.js](../public/app.js)）：追踪 `state.selectedBattle` 与 `state.selectedAtrocity`，语言切换时自动原地重绘详情抽屉并纳入地图导出标题；将 `openBattle()` 中的 `beginDetail()` 移至 `await setYear()` 之后，防止取消年份跳转时残留 `body.reading` 状态。
- **检索、详情副标题去重与英文计数补齐**（[app.js](../public/app.js)、[source-reader.js](../public/source-reader.js)、[identity-ledger.js](../public/identity-ledger.js)、[boundary-controller.js](../public/boundary-controller.js)、[no-territory.js](../public/no-territory.js)）：
  - 消除地点检索在英文模式下重复显示地名（如 `Genova` + `Genova · 1500 CE`）的问题，并为 `attested-site` 补齐“有据遗址 / Attested site”标签；修复地点详情页副标题判定，使 `PLACE_ZH_EDITORIAL` 词条在双语模式下均正确显示英文副标题。
  - 统一 `zh` 与 `bi` 模式下战役／暴行检索、悬停卡与详情页副标题策略；补齐英文模式下 `#battleStatus`、`#atrocityStatus` 与 `#mapLegend` 缺失的数量统计。
  - 在 [source-reader.js](../public/source-reader.js) 中为单方面暴力来源行补全英文翻译；在 [identity-ledger.js](../public/identity-ledger.js) 中修复英文模式下的中文顿号 `、`（改为 `, `）、双语重名去重与源终点 `0` 纪年格式化。
  - 在 [boundary-controller.js](../public/boundary-controller.js) 中统一 CShapes 双语弹窗副标题判定并修正英文时段计数多余空格；在 [no-territory.js](../public/no-territory.js) 中本地化 `not-in-source` 覆盖说明；在 [app.js](../public/app.js) 中为公元前 3400 年前史前年代提供专属图例提示。
- **冷启动研究壳与英文标题对齐**（[research-shell.js](../public/research-shell.js)）：冷打开 `#view=research&lang=en` 时同步本地化 `document.title`、`.brand b` 与 `.brand small`，补齐 `#helpDialog` 遮罩点击关闭与裸 `/` 检索快捷键，使其行为与主应用完全一致。

### 2. 交互体验、政体有据遗址归类与中文输入法保护
- **折叠态与阅读态全局搜索快捷键修复**（[app.js](../public/app.js)）：侧栏折叠（`browse=0`）、移动端或详情阅读态下按 `/` 或 `Cmd/Ctrl + K` 自动收起详情并展开侧栏后再聚焦 `#search`。
- **中文 IME 保护与原地增量更新**（[app.js](../public/app.js)、[identity-ledger.js](../public/identity-ledger.js)、[research-reader.js](../public/research-reader.js)、[polaris-reader.js](../public/polaris-reader.js)、[regional-boundaries.js](../public/regional-boundaries.js)）：
  - 世界年表（`renderLibrary`）与文明页（`renderPolities`）改为仅原地刷新结果区（`#libRows` / `#polityGrid` 及计数）并加入 `compositionstart`/`compositionend` 保护，避免键入过程重建 `<input>` 打断中文拼音输入法与引起整页闪烁。
  - 为身份核查台账、Equinox 研究阅读器（含 `setLanguage` 焦点与光标位置保留）、Polaris 阶段检索及区域区划目录搜索统一补齐 `compositionstart`/`compositionend` 保护。
- **政体「城市与聚落」页补齐有据遗址计数、筛选与来源署名**（[polity-places.js](../public/polity-places.js)、[polity-reader.js](../public/polity-reader.js)）：将 `attested-site`（如泉州古城、阿瑜陀耶等）纳入 `counts.settlements` 与 `attested-settlement` 筛选条件（修复 `全部` 与分项之和不一致及筛选后消失的问题），并在卡片中以“有据遗址 / Attested site”与规范出版机构名替代原始字符串 `attested-sites`。
- **时间窗口联动与视觉精修**（[app.js](../public/app.js)、[battles.js](../public/battles.js)、[atrocities.js](../public/atrocities.js)、[polity-reader.js](../public/polity-reader.js)、[halc-boundaries.js](../public/halc-boundaries.js)、[product.css](../public/product.css)）：
  - `#window` 时间窗口切换实时联动 `BattleLayer.setWindow()` 与 `AtrocityLayer.setWindow()`，并改用 `civilYear()`（无公元 0 年）做跨公元前／后窗口匹配。
  - `PolityReader.territory()` 疆域面积时间线 SVG 以亮金色（`#f4d593`）高亮当前时段柱条；HALC 1500 与区域目录计数采用千分位格式化（`10,543`）；移动端搜索抽屉自适应增高并切换纵向列表，桌面阅读态恢复 `.era-buttons` 右侧渐隐遮罩。

### 3. 几何计算、点图层与本地服务运行时性能优化
- **边界柔化与共边网络热路径零分配加速**（[border-curves.js](../public/border-curves.js)、[boundary-mesh.js](../public/boundary-mesh.js)）：
  - 以标量几何运算与缓存节点包围盒 `n.box` 取代 `intersects`/`inside`/`touches`/`collide`/`bounds` 内的大量临时数组分配，消除 `while` 循环内的 `[...near]` 拷贝，同时保持所有年份输出字节**100% 逐字节一致**（`1945 @ 0.002` 计算耗时由 `740 ms` 降至 `552 ms`，`1492 @ 0.002` 由 `289 ms` 降至 `220 ms`）。
  - `boundaryMesh()` 对 2D 坐标采用直拼键与直接有限值检查，避免数十万顶点的 `JSON.stringify` 与 `.every()` 回调分配（`validate-border-sampling` + `validate-boundary-mesh` 总耗时由 `27 s` 缩短至 `8 s`）。
- **视口裁切、原始几何校验与空间检索提速**（[geometry-anchor.js](../public/geometry-anchor.js)、[native-geometry.js](../public/native-geometry.js)、[polity-places.js](../public/polity-places.js)、[polity-names.js](../public/polity-names.js)、[research-reader.js](../public/research-reader.js)）：
  - `clipRing()` 增加包围盒快速拒斥／全含直通，跳过多岛屿 MultiPolygon 90% 以上无效 Sutherland–Hodgman 裁切。
  - `validGeometry()` 改用无闭包嵌套 `for` 循环；`territoryContains()` 消除每多边形 `rings.slice(1)` 分配并将时间切片检查降频至每 64 项一次；`searchPolityIndex()` 以 `WeakMap` 记忆化 1,592 组政体检索文本；Equinox 研究阅读器以 `polityById` `Map` 实现跨阶段卡片 `O(1)` 查找。
- **消除点图层双重刷新与湖泊／街区标注精度提升**（[places.js](../public/places.js)、[battles.js](../public/battles.js)、[atrocities.js](../public/atrocities.js)、[lakes.js](../public/lakes.js)、[historical-detail.js](../public/historical-detail.js)、[regional-boundaries.js](../public/regional-boundaries.js)、[map-engine.js](../public/map-engine.js)）：
  - `loadPlaces()` 按底层归档对象引用记忆化非故障结果并记录已完成索引（`_resolvedIndices`），消除每次换年触发 `onPartial` 导致 `PlaceLayer.refresh()` 双重 DOM 重建与 25,000+ 条目 `flatMap` 重分配；`searchPlaces()` 预计算 `placeAtYear` 命中态。
  - `BattleLayer` 与 `AtrocityLayer` 将重复的 `moveend` 监听改为 `resize`（统一由 `AtlasMap.refreshLabels()` 在标签避让后驱动刷新）。
  - `LakeLayer` 预排序 `this.named` 并将标记遮挡查询限定在所属地图容器；`HistoricalDetailLayer` 补齐中文街名宽度估算及湖泊／区划／战役／暴行避让；`RegionalBoundaries.openIndex()` 缓存 `available` 列表签名，避免在 10,543 条 HALC 记录中键入时反复调用 `regionalPeriod()`。
  - `AtlasMap.setHover()` 规范单年与源终点 `0` 纪年格式，`focusPolity()` 改为迭代扫描包围盒避免大顶点多边形 `Math.min(...lons)` 栈溢出，`destroy()` 清理 `_labelFrame`。
- **本地服务并发缓存优化**（[serve.py](../serve.py)）：将 `COMPRESS_CACHE` 升级为带 `threading.Lock` 的 `OrderedDict` LRU 缓存，并对 `data/native/manifest.json` 增加 `(mtime_ns, size)` 缓存。

## 验证结果

- `npm run prepare:assets`：通过（`270` 份 native + `117` 份 detail 内容指纹与资源戳更新）。
- `npm test`：全部校验脚本通过（退出码 `0`），包含边界曲线 `10/10`、包络 `26/26`、边界网格 `20/20`、地点 `23/23`、政体地点 `11/11`、事件加载 `15/15`、身份台账 `13,765` 条、HALC 连续性 `24/24`、区域连续性 `26/26`、全库映射 `9/9`（`5,424` 年 / `254,592` 对）、地图目录应用集成 `26/26` 及全部 Polaris / Equinox / OHM / CHGIS / CShapes 校验。
- `npm run test:http`：`14/14 local HTTP checks passed`。
- `npm run build`：`dist/server/index.js` 与 `dist/client` 构建通过（`377` 静态存储对象 / `2,551` Worker 文件）。
- 无头 Chrome 端到端实测（桌面 `1440×900` 与移动 `390×844`，零控制台错误、零布局重叠、零横向溢出）：
  - 动态三语切换（`bi -> en -> zh`）：工具条按钮、图层开关、参照徽标与已打开战役详情（`卡迭石战役` ↔ `Battle of Kadesh`）均即时切换。
  - 冷打开 `#view=research&lang=en`：标题、品牌及 `/` 检索快捷键均正确就绪。
  - 英文资料页与身份台账：`#view=sources&lang=en` 与 `#qualityLedger` 均零汉字／中文顿号残留。
  - 宋代 `1200 CE` 政体地点页：`全部 13` = `首都 0` + `聚落与遗址 1` + `人口记录 12`，筛选“聚落与遗址”正确呈现“泉州古城”（`UNESCO World Heritage Centre`）。
  - HALC `1500` 详图与检索：徽标显示 `HALC · 1500 · 10,543 visible units`，目录内检索 `Antwerp` 瞬时过滤至 `2 source records`。
  - 折叠侧栏 `/` 快捷键、英文地点去重、时间窗口联动战役计数、年表／文明页输入法 DOM 保活、单次镜头跳转点图层 `1` 次刷新、明朝疆域 SVG 当前期高亮及移动英文常规／对比模式均通过验证。
