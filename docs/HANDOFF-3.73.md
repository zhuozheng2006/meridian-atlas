# 交接记录 · v3.73.0

**当前基线**：`v3.73.0` · **验证报告**：[benchmarks-3.73](verification-3.73/final-benchmarks.json)

---

## 本轮核心成果

### 1. 视口内裁切政体标注引擎（彻底修复局部放大“空白无国名”盲区）
- **根因排查**：[`public/map-engine.js`](../public/map-engine.js) 的 `refreshLabels()` 此前仅依据全局单一预设点 `r.labelCenter || r.center` 筛除视口外政体（导致在高卢／不列颠局部视角 `100 CE z=5` 时，整片被“罗马帝国”覆盖却因罗马/地中海质心位于屏外而显示 **0 个政体标注**；同样导致 `1250 CE 波斯` 缺少 `蒙古帝国`、百年前东亚缺少 `北匈奴/鲜卑` 标注）。
- **视口几何回退机制**：在 `displayTerritories()` 缓存当前展示几何 `displayedGeometries`，并在 [`public/map-engine.js`](../public/map-engine.js) 引入 [`public/geometry-anchor.js`](../public/geometry-anchor.js) 的 `interiorPoint(geom, viewBox)`：当政体面积达标但其预设中心不在当前屏幕安全框内（或落在球面背面）时，利用 Sutherland–Hodgman 矩形裁切将实际显示多边形裁切至当前视口内最宽水平扫描线中点重新落标，兼顾大视图零开销与区域缩放下的连续可读性。
  - **实测对照**：高卢 `100 CE (z=5)` 由 **`0` 条政体标签**恢复为 **`["罗马帝国 / Roman Empire"]`**；波斯 `1250 CE (z=4)` 自动补出 **`"蒙古帝国 / Mongol Empire"`**；东亚 `100 CE (z=4)` 同步补出 **`"匈奴 / Xiongnu"`** 与 **`"鲜卑 / Xianbei"`**。

### 2. 地名与事件双语完备度（Wave-8 · 累计 1,053 处）
- **古典地名 `Pleiades ref >= 19` 100% 覆证 + 高卢／不列颠 `100 CE` 100% 覆证**：在 [`public/places.js`](../public/places.js) 新增 **108 处**权威译名（`PLACE_ZH_EDITORIAL` 达 **1,053 处**）：全面覆盖此前遗漏的全部 `69` 处 `ref === 19` 地中海重镇（*Sparta 斯巴达*、*Marathon 马拉松*、*Jericho 耶利哥*、*Thessalonica 帖撒罗尼迦*、*Nicaea 尼西亚*、*Volubilis 瓦卢比利斯*、*Emerita Augusta 梅里达* 等）、可见 `100 CE` 高卢／不列颠／孟加拉城市（*Burdigala 波尔多*、*Condate Redonum 雷恩*、*Augustodunum 欧坦*、*Samarobriva 亚眠*、*Genua 热那亚*、*Duroliponte 剑桥* 等 **22/22 全部中文可见**）以及 `19` 处重要 `ref === 18` 名城（*Massalia 马赛*、*Tyrus 推罗*、*Ancyra 安卡拉*、*Verona 维罗纳*、*Philippi 腓立比*、*Bethlehem 伯利恒* 等）。
- **混合英文事件标题清洗**：修正 [`public/data/events.json`](../public/data/events.json) 与 `.json.gz` 中 3 条中英混杂标题：`-458 Mons Algidus战役` → `阿尔吉杜斯山战役`、`-1900  cemetery H 文化…` → `H墓地文化与印度河晚期的区域转型`、`1022 斯文达克斯战役（Battle of Svindax）` → `斯文达克斯战役`；同步重新构建 `events-index.json.gz`。
- **政体显示校验说明**：已审计 Cliopatria 剩余无 `zhName` 条目（含 *Later Zhou* 历史同名避让、*Lohara Dynasty* 等）；按 [`scripts/validate-polity-display-names.mjs`](../scripts/validate-polity-display-names.mjs) 契约锁定，未受审定证据条款保持源字段不变。

### 3. 制图对比度与帮助弹窗视觉重塑
- **海洋／岛屿政体标签锐利光晕**：在 [`public/cartography.css`](../public/cartography.css) 为 `.polity-label` 与子标签升级多向 `1px` 羊皮纸浅色实边＋柔光外晕（`#f6f0dc`），显著提升诸如 *希腊城邦 Greek City-States*、*日本战国时期 Warring States Japan* 等跨越深蓝海域及破碎群岛时的辨识度，同时在浅米色陆地上保持克制雅致。
- **帮助弹窗零滚动溢出重排**：收紧 [`public/product.css`](../public/product.css) 中 `dialog#helpDialog`、`help-steps` 与 `help-shortcuts` 内外距并启用 `max-height: 88dvh; scrollbar-gutter: stable`，消除 `1440×900` 桌面端顶部右上角金边处的多余原生滚动条切口（实测 **`scrollOverflowPx: 0`**）。

---

## 全量验证与基准结果

| 校验项 | 结果 | 说明 |
|---|---|---|
| `npm run prepare:assets` | PASS | 重新编译快速事件索引（709 事件）与 270/117 资产版本指纹 |
| `npm test` | PASS | 含 `validate-places` 23/23、`validate-polity-display-names` 17/17、`validate-startup-overlap` 20/20 等全数通过 |
| `npm run test:http` | PASS | **14/14** HTTP 内容协商、PBF 压缩及指纹校验通过 |
| `npm run build` | PASS | 生成 `dist/server/index.js` 与 `dist/client` 产物 |
| 无头 Chromium 全维度基准 | PASS | 13 路冷启动 `consoleErrors: []`、`0` UI/标签/图钉重叠；高卢 `100 CE` `22/22` 中文与 `罗马帝国` 落标全部实证 |

> 注：`liveDomainChecks` 捕获的 2 条 HTTP 404 日志均来自巴黎／高卢 `z=5` 视图边缘访问 `https://tiles.mapterhorn.com/5/14/10.webp`（北大西洋纯海域稀疏高程瓦片缺失，上游静态托管惯例，应用层已静默容错）。
