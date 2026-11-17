# 交接记录 · v3.74.0

**当前基线**：`v3.74.0` · **验证报告**：[benchmarks-3.74](verification-3.74/final-benchmarks.json)

---

## 本轮核心成果

### 1. Coastal-Water 零误差网格与比例尺智能避让（消除“印度横贯深蓝条带”与重叠）
- **根因排查**：[`public/geography.js`](../public/geography.js) 为 `coastal-water` GeoJSON 源设置了 `tolerance: .18`，在 `geojson-vt` 瓦片抽稀过程导致赤道/印度板块周边生成一条自阿拉伯海经印度中部至孟加拉湾的深蓝锯齿横贯条带（以及大西洋接缝微痕）。
- **彻底修复**：将 `coastal-water` source 抽稀容差设为 `tolerance: 0`，同步消灭印度中部 `22.5°N` 横贯蓝色误染及大西洋接缝伪影（`cwToleranceZero: true`）。
- **比例尺碰撞消除**：在 `ScaleControl` 挂载完成后立即触发 `this.atlas?.refreshLabels?.()`，将右下角 `500 km` 比例尺边界盒纳入地图标签避让管线，消除 `1800 CE` 视图中比例尺与 `(大英帝国)` 标签的重叠（`scaleOverlapLabels: []`）。

### 2. 古典名城与驿站双语覆证（Wave-9 · 累计 1,194 处 · Pleiades ref >= 17 100% 覆证）
- 在 [`public/places.js`](../public/places.js) 的 `PLACE_ZH_EDITORIAL` 扩展 **Wave-9 共 +141 处**权威双语译名（由 `1,053` 增至 **`1,194` 处**），使全局 Pleiades 文献引用数 `ref >= 17` 的古今重镇实现 **100% 中文覆盖**（包括 *Tarsus 塔尔苏斯*、*Seleucia Pieria 佩里亚塞琉古*、*Gades 加的斯*、*Saguntum 萨贡托*、*Hadrumetum 哈德鲁梅图姆*、*Thugga 杜加*、*Leontini 莱昂蒂尼*、*Pella 佩拉*、*Dura Europos 杜拉-欧罗波斯* 等），并在 [`scripts/validate-places.mjs`](../scripts/validate-places.mjs) 增补 8 项专项回归断言。

### 3. `#qualityLedger` 数据品质账本 Obsidian × Brass 重塑
- 在 [`public/product.css`](../public/product.css) 为 `#qualityLedger` 统计卡（`.quality-counts`）、过滤工具栏（`.quality-controls`）、审定记录卡（`.quality-record`）、导出与“加载更多”按钮（`[data-quality-export]` / `[data-quality-more]`）补齐统一的 Obsidian × Brass 深色调色板、金边微效与圆角层级（`ledgerRadius: 14px`、`recordRadius: 10px`、`3` 张计数卡布局）。

---

## 全量验证与基准结果

| 校验项 | 结果 | 说明 |
|---|---|---|
| `npm run prepare:assets` | PASS | 生成 `dist` 资源预备与 270 原生 / 117 详图资产哈希 |
| `npm test` | PASS | 包含 `validate-places`（含 Wave-9 8 项新断言）、`validate-polity-display-names`、`map-catalog-app`（26/26）等全套测试 |
| `npm run test:http` | PASS | **14/14** HTTP 内容协商、压缩与指纹校验通过 |
| `npm run build` | PASS | 生成完整 `dist/server/index.js` 与 `dist/client` 构建产物 |
| 无头 Chromium 全维度基准 | PASS | 13 路视口/网络冷启动 `0` 重叠、`0` 横向裁切、`consoleErrors: []`；`18` 项实境域检查全通过（桌面 `1492` 首屏交互 `323 ms`） |

> 注：`liveDomainChecks` 期间捕获的 2 条 HTTP 404 日志均源自高卢 `z=5` 边缘请求纯大西洋水域的 Mapterhorn 静态缺失瓦片，所有冷启动基线与本地资源请求 `consoleErrors: []`。
