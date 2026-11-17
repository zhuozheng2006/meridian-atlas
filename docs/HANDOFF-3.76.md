# 交接记录 · v3.76.0

**当前基线**：`v3.76.0` · **验证报告**：[benchmarks-3.76](verification-3.76/final-benchmarks.json)

---

## 本轮核心成果

### 1. Pleiades `ref >= 15` 100% 中文覆证与丝路地名增补（Wave-11 · 累计 1,437 处）
- 在 [`public/places.js`](../public/places.js) 的 `PLACE_ZH_EDITORIAL` 增补 **Wave-11 共 +124 处**（累计 **`1,437` 处**，`0` 重复），使全局 `Pleiades referenceCount >= 15` 全部 `771` 处古代名城实现 **100% 中文覆盖**（`remainingRef15PlusWithoutZh: 0`）。
- 重点新增：**Milan** *米兰（梅迪奥拉努姆）*、**Patavium** *帕多瓦（帕塔维乌姆）*、**Tolosa** *图卢兹（托洛萨）*、**Col. Vienna** *维埃纳（维恩纳殖民地）*、**Caesarodunum** *图尔（凯撒罗杜努姆）*、**Saguntum** *萨贡托（阿尔塞）*、**Sidon** *西顿*、**Meroe** *麦罗埃*、**Syene** *西耶尼（阿斯旺）*、**Hermopolis Magna** *大赫尔莫波利斯*、**Hatra** *哈特拉*、**Tigranocerta** *蒂格拉诺凯尔特*、**Hecatompylos** *百门城（赫卡托姆皮洛斯）*、**Tarmita/Termez** *铁尔梅兹*、**Phaistos** *费斯托斯*、**Laodicea ad Lycum** *吕科斯河畔老底嘉*、**Patara** *帕塔拉*、**Philippopolis** *腓力波波利斯*、**Hadrianoupolis** *哈德良堡（埃迪尔内）*、**Stabiae** *斯塔比亚*，以及公元 1000 年丝路／安达卢西亚名城 **Tabrīz** *大不里士*、**Mašhad** *马什哈德*、**Sabzevār** *萨卜泽瓦尔*、**Old Kandahar citadel** *坎大哈古城*、**Medina Azahara** *麦迪纳·阿扎哈拉*、**Badajoz** *巴达霍斯*、**Murcia** *穆尔西亚*、**Mantai** *曼泰* 等。
- 同步在 [`scripts/validate-places.mjs`](../scripts/validate-places.mjs) 增补 10 项 Wave-11 回归测试断言。

### 2. 地名检索 `WeakMap` 惰性索引加速（14.4 ms → 2.9 ms）与样式表内联去重
- **地名全文检索加速**：在 [`public/places.js`](../public/places.js) 为 `searchPlaces()` 增加模块级 `_searchIndexCache`（`WeakMap`），仅首次检索时对 `20,700+` 地点执行 `NFD` 规范化与别名分词（不修改、不破坏 `Object.freeze` 源记录）；后续连续键入实测检索耗时降至 **`2.9 ms`**（首轮冷检 `14.4 ms`）。
- **样式冗余合并与可访问关闭按钮**：合并 [`public/product.css`](../public/product.css) 内 `.stat-card` / `.sources-actions` / `#openResearch` 的同文件后置覆写（净削减 12 条自覆写声明），合并 [`public/cartography.css`](../public/cartography.css) 内 `.map-hover-card` 的前后重复规则（削减 40 条自覆写声明），并将历史详图弹窗关闭按钮恢复为舒适的 `34×34 px` 触控热区。

---

## 全量验证与基准结果

| 校验项 | 结果 | 说明 |
|---|---|---|
| `npm run prepare:assets` | PASS | 重新生成 270 原生 / 117 详图资产指纹与地图分年包 |
| `npm test` | PASS | 含 `validate-places`（Wave-11 10 项新断言）、`validate-polity-display-names`、`map-catalog-app`（26/26）全套通过 |
| `npm run test:http` | PASS | **14/14** HTTP 内容协商、压缩与缓存验证通过 |
| `npm run build` | PASS | 生成 `dist/server/index.js` 与 `dist/client` 构建产物 |
| 无头 Chromium 全维度基准 | PASS | 13 路冷启动 `0` 重叠、`0` 裁切、`consoleErrors: []`；`22` 项实境域检查全通过（检索缓存在 20,700+ 地名中耗时 **`2.9 ms`**） |

> 注：`liveDomainChecks` 期间捕获的 2 条 HTTP 404 日志均源自高卢 `z=5` 边缘请求纯大西洋水域的 Mapterhorn 静态缺失瓦片；此外在 `1000 CE 波斯`（`persia_1000ce_silk_road_and_search_speed`）截图审计中新定位到 *Rašt*、*Kāšān*、*Padakku/Fadak* 三处低引文（ref < 15）节点，已排入 `v3.77.0` 清理。
