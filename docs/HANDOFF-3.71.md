# 经纬纪 3.71.0：全量城市人口档案 100% 中文覆证、10 项上游错位坐标隔离与飞渡/加载/研究界面全面精进

## 本版三大里程碑

1. **Data Forensics：10 项上游错位坐标隔离与 Wave-6 城市/古典遗址扩充（累计 841 条，`e4b4ea36`）**
   - **上游坐标勘误隔离**：对全库 2,040 条 `urban-observations` 开展同坐标碰撞与同名跨洲误置排查，识别出 **10 处**此前潜伏的地理错置记录并加入 [`public/places.js`](../public/places.js) `PLACE_COORD_QUARANTINE`（现共 13 条，保持只读原始数据文件零篡改）：
     - `modelski-ancient:117`（先秦“商丘”误用上海外滩坐标 `[121.4581, 31.2222]`，导致公元前 500 年上海海岸线出现十万人“商丘”）
     - `chandler:136`（英国 1900 年 5.6 万人的巴罗因弗内斯误置为美国阿拉斯加极圈小镇 Barrow `[-156.79, 71.29]`）
     - `chandler:819`（北爱尔兰 3.8 万人的德里误置为美国新罕布什尔小村 Londonderry `[-71.37, 42.87]`）
     - `chandler:1333`（英格兰兰开夏 8.3 万人的圣海伦斯误置为美国俄勒冈小城 St. Helens `[-122.82, 45.86]`）
     - `chandler:562`（美国麻省 3.7 万人的黑弗里尔人口张冠李戴至英国萨福克小村 Haverhill `[0.44, 52.08]`）
     - `chandler:1198`（法国军港罗什福尔 3 万人误置为比利时小村 Rochefort `[5.22, 50.16]`）
     - `chandler:1090`（法国波城 `Pau` 经度丢失负号 `[+0.37, 43.30]` 落入西班牙阿拉贡境内）
     - `chandler:382`（马里杰内 `Dienne` 误落塞内加尔大西洋岸 `[-16.35, 15.03]`）
     - `chandler:279`（常德误标为长沙市区精确坐标 `[112.9388, 28.2282]`）、`chandler:1341`（特伦特河畔斯托克误置为切斯特郊区）
   - **Wave-6 补齐 270 条双语地名**：在 [`public/places.js`](../public/places.js) 为所有剩余非隔离 `urban-observations` 近代/近世城镇及 62 处高频古典地中海 `Pleiades`（`ref >= 20`）补全权威中文名称，`PLACE_ZH_EDITORIAL` 达 **841** 条，实现全库 2,040 条城市人口观测记录非隔离条目 **100% 中文覆证**（[`scripts/validate-places.mjs`](../public/validate-places.mjs) `23/23` 通过）。

2. **飞渡缩放零碰撞避让、海洋平滑分片、`bootstrap` 提前预载与研究界面重塑（`3a8ca25a` + `beaa6d4b`）**
   - **飞渡与球面地平线动态避让**：在 [`public/map-engine.js`](../public/map-engine.js) 新增带 50 ms 节流的 `'move'` 实时重算监听器（平移 >= 4° 或缩放 >= 0.25 即刷新），并将球面地平线视锥剔除覆盖至 `zoom < 4.5 && dot < 0.28`（同步应用于 [`public/places.js`](../public/places.js)），彻底解决跨越半球的 `flyTo` 过程中标签挤作一团与球缘重叠的问题（实测 `mid_fly_zoom_pan_collision_free` 碰撞 `[]`）。
   - **海岸线海洋遮罩平滑切片**：将 [`public/geography.js`](../public/geography.js) 内 `coastal-water` 的 `tolerance` 从 `0` 优化为 `.18`（子像素级精度，无肉眼感知差异），显著加快 `geojson-vt` 全球矢量化切分并消除跨洋飞行瞬间出现局部海面分片接缝的问题。
   - **启动关键路径再提速**：在 [`public/index.html`](../public/index.html) 对 `bootstrap-content-hashes.js`（仅 1.55 KB）加入 `<link rel="modulepreload">` 使其随首波样式表并发到位，并在 [`public/entry.js`](../public/entry.js) 将 `events-index.json.gz` 降为 `priority: 'low'` 且仅对近现代年份（`>= 1886` 或 `cshapes` 模式）预载 CShapes 附属模块。经 `1.5 Mbps / 150ms RTT` 隔离测试，`nativeYearStartMs` 从 `v3.70.0` 的 `713 ms` 提前至 **`554 ms`**（**-159 ms**），`maplibreStartMs` 提前至 **`384 ms`**（**-59 ms**）。
   - **悬停气泡与 `#view=research` 界面统一**：重构 [`public/product.css`](../public/product.css) 内 `.research-version-bar`、`.research-context`、`.research-filter-panel`、`.research-guide`、`.research-sources`、`.research-reading-card` 及 `.research-reading-library`，并升级 [`public/cartography.css`](../public/cartography.css) `.map-hover-card`（Obsidian × Brass 顶部金线质感气泡），保持全站视觉语言高度统一。

3. **全场景基准测试与 `v3.71.0` 发布验证**
   - 全部 8 组主视角／对比视角与 13 项功能域实时校验已记录至 [`docs/verification-3.71/final-benchmarks.json`](verification-3.71/final-benchmarks.json)，全程 `labelOverlaps: []`、`pinOverlaps: []`、`overlaps: []`、`mid_fly_zoom_pan_collision_free.hits: []`、`clippedH: false` 与 `consoleErrors: []`。

## v3.71.0 实测与基准

全部测量由独立无头 Chromium 进程（禁用浏览器缓存、全量 `v3.71.0` 资源戳构建后）采集，完整原始结果见 [`docs/verification-3.71/final-benchmarks.json`](verification-3.71/final-benchmarks.json)：

| 场景 | 首图交互 (`3.71.0`) | `1.5 Mbps / 150ms` 弱网 (`maplibre` / `nativeYear` 发起) | `3.70.0` 弱网发起对照 | 标签 / 点位 / UI 重叠 | Console Errors |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `desktop_1492` (1440×900) | **`338 ms`** | `4243 ms` (`384 ms` / **`554 ms`**) | `443 ms` / `713 ms` | `0` / `0` / `0` | `0` |
| `south_asia_m250` | **`238 ms`** | `4056 ms` (`392 ms` / —) | `434 ms` / — | `0` / `0` / `0` | `0` |
| `china_742_regional` | **`289 ms`** | `5812 ms` (`393 ms` / —) | `433 ms` / — | `0` / `0` / `0` | `0` |
| `europe_1914_cshapes` | **`564 ms`** | `6233 ms` (`385 ms` / **`555 ms`**) | `384 ms` / `706 ms` | `0` / `0` / `0` | `0` |
| `mobile_390_1492` (390×844) | **`371 ms`** | `4243 ms` (`385 ms` / **`570 ms`**) | `434 ms` / `706 ms` | `0` / `0` / `0` (`gap +23px`) | `0` |
| `laptop_1280_compare` | **`322 ms`** | — | — | `[]` / `clippedH: false` | `0` |
| `tablet_834_compare` | **`317 ms`** | — | — | `[]` / `clippedH: false` | `0` |
| `mobile_390_compare` | **`331 ms`** | — | — | `[]` / `clippedH: false` | `0` |

- 全套构建与回归检查在最终提交前全部通过：`npm run prepare:assets`、`npm test`、`npm run test:http`（`14/14`）、`npm run build`。

## 后续可继续推进方向

1. 继续扩展 `pleiades` `referenceCount 15–19` 古典考古聚落（尚余约五百余处次级站点）以及极高密度城邦带在不同缩放阶梯的按序展示。
2. 审视近现代 `CShapes` 十年包（如 `decade-1910.json.gz`，`2.69 MB`）的视口分片/首屏按需载入潜力，进一步缩短 20 世纪地图的弱网首帧与带宽开销。
