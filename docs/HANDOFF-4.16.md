# 经纬纪 4.16 交接与验证记录

## 本轮完成内容

### 1. 数据完整性与多语言地道表达（只读上游、派生映射）
- **CShapes 2.1 全量 288 / 288 首都权威简体中文覆盖**：在 [`public/country-archive.js`](../public/country-archive.js) 新增 `CAPITAL_ZH` 映射与 [`capitalName()`](../public/country-archive.js) 辅助函数，覆盖全部 **288 个**不重复的 CShapes 历史与现代首都（补全 `Danzig` → 但泽、`Calcutta` → 加尔各答、`Rangoon` → 仰光、`East Berlin` → 东柏林、`Saint Petersburg (Petrograd)` → 圣彼得堡（彼得格勒）、`Kinshasa (Léopoldville)` → 金沙萨（利奥波德维尔）、`Toyohara` → 丰原、`Hollandia` → 霍兰迪亚等 65 处缺失历史首都，并统一大陆规范译名如 `Niamey` → 尼亚美、`Riyadh` → 利雅得），在 [`public/boundary-controller.js`](../public/boundary-controller.js) 的 `openRecord()` 接入，全量 **805 / 805** CShapes 国家记录弹窗首都与统治归属均完整规范显示。
- **CHGIS V4 2,016 条府级记录 100% 纯英文与纠偏支持**：在 [`public/chgis-boundaries.js`](../public/chgis-boundaries.js) 新增 [`chgisChangeLabel()`](../public/chgis-boundaries.js) 与 [`chgisCompilerLabel()`](../public/chgis-boundaries.js)，完整翻译 26 项 `BEG_CHG_TYPE` / `END_CHG_TYPE` 变更值（含 `数据下限` → `Dataset end bound`、`日本占领` → `Japanese occupation` 等）及 7 位复旦 CHGIS 编制者姓名（`邹逸麟` → `Zou Yilin`、`满志敏` → `Man Zhimin` 等），同时修正上游 3 处繁简／笔误（`撤銷` → `撤销`、`更更名和辖区缩小` → `更名和辖区缩小`、前导空格），并在 [`public/regional-boundaries.js`](../public/regional-boundaries.js) 的 `openChgisRecord()` 接入，实现纯英文模式下 CHGIS 弹窗零中文残留。
- **暴行记录层 21 处繁体来源标签简体显示规范化**：在 [`public/atrocities.js`](../public/atrocities.js) 增加不足 700 B 的轻量显示映射 `ATRO_T2S` 与 [`atrocityDisplayZh()`](../public/atrocities.js)，将全部 21 条维基数据繁体 `nameZh`（如 `馬尼拉大屠殺` → `马尼拉大屠杀`、`泰國法政大學屠殺事件` → `泰国法政大学屠杀事件`）统一规范为简体显示；严格遵循学术原则，不改动 `data/atrocities.json.gz` 原始档案，也不对 `nameZh === null` 的条目虚构或音译名称，并同步接入 [`public/app.js`](../public/app.js) 的 `openAtrocity()` 与地图导出标题。
- **政体档案限定词（Qualifiers）中文化**：在 [`public/polity-reader.js`](../public/polity-reader.js) 的 `qualifierNotes()` 补充高频未译限定词（如 `de jure` × 17 → `法理上`、`languages of Brazil` 等），并自动回退检索 `FACT_ZH_FIX` 与 `displayPolityZh()`。

### 2. 分享直链完整性与无障碍纯英文一致
- **战役与暴行记录可分享深链闭环**：在 [`public/app.js`](../public/app.js) 的 `saveURL()` 持久化 `battle` 与 `atrocity`（含对比模式 `side=right`），在 `openAtrocity()` 补齐 `saveURL()`，并在 `restoreInitialMapView()` 增加异步竞态安全（`detailNavigation` 校验）的战役与暴行记录自动恢复逻辑，打开任意战役或暴行抽屉后复制链接刷新即可原样重开。
- **全页面纯英文 ARIA 与工具提示零残留**：在 [`public/app.js`](../public/app.js) 的 `renderLanguage()` 与 [`public/map-engine.js`](../public/map-engine.js) 的构造函数 / `setYear()` 动态本地化所有静态双语 `aria-label` 与 `title`（涵盖导航栏、搜索、筛选、地图画布 `.maplibregl-canvas`、对照关闭、时间轴与帮助窗），在 `lang=en` 下实现全 DOM 零 CJK 字符残留。

### 3. 出版级城市／首都／战役标注合成导出
- 升级 [`public/app.js`](../public/app.js) 中的 [`drawExportLabels()`](../public/app.js)：在保留政体、地区详图与湖泊标注的基础上，进一步按各子元素真实像素边界框精确合成当前视野中所有可见的 `.place-marker`（历史城镇圆点、旋转 45° 历史首都菱形、现代参照空心圆、主城名、双语副标与 `.place-date` 人口年份标签）、`.battle-marker`（朱红战役菱形与高倍缩放胶囊标签）以及 `.atrocity-marker`（紫灰三角与标签），保持与实时地图 1:1 避让位置一致、无截断无重叠。

## 自动化与实机浏览器验证

- `npm run prepare:assets`：通过（资产指纹更新为 `4.16.0-68b90e70059b`）。
- `npm test`：全部通过（含 `validate-point-layer-gate`、`validate-atrocities`、`validate-events-loading`、26/26 `validate-map-catalog-app`、709 事件与 1,592 政体索引验证）。
- `npm run test:http`：14/14 本地 HTTP 验证通过。
- `npm run build`：通过（`dist/client` + `dist/server/index.js`）。
- 无头 Chrome 实机端到端验证（`verify_416.mjs`）全部通过且零控制台/运行时异常：
  1. CShapes 1914 俄罗斯帝国弹窗：`首都／行政中心` 显示 `圣彼得堡（彼得格勒）`、`统治归属` 显示 `俄罗斯帝国`。
  2. CHGIS 1820 纯英文模式弹窗：`Chu Zhou` 显示 `Beginning change: Established`、`Ending change: Dataset end bound`、`Compiler: Zou Yilin`、`Geometry compiler: Man Zhimin`，**0 个汉字残留**。
  3. 战役分享直链往返：打开卡迭石战役 → 读取 `#...&battle=...` → 重载直链自动重开 `卡迭石战役 / Battle of Kadesh`。
  4. 暴行简体显示与分享直链往返：打开马尼拉大屠杀 → 显示规范简体 `马尼拉大屠杀 / Manila massacre`（零繁体字）→ 重载 `#...&atrocity=...` 自动重开。
  5. 罗马意大利公元 100 年 PNG 导出：实测合成 **29 处带名历史城市（共 55 个聚落点位与首都菱形）+ 政体标注**，肉眼核查成图清晰无重影。
  6. `lang=en` 全站 `[aria-label]` 与 `[title]` 扫描：**0 处中文字符残留**。
