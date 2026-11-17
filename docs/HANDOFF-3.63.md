# 经纬纪 3.63.0：《新唐书》双志对读、首屏瀑布流消除、悬停交互升级与南亚非线性配准审计

## 本轮成果总览

1. **《新唐书·地理志》全卷对读与唐代地名批量核准（Milestone 5 · `342 / 420`）**
   - 本地固化并校验 `SHA-256` 与永久 `oldid` 的 Wikisource《新唐书·地理志》卷 37–43 上 7 卷原文快照（`docs/verification-3.63/sources/new-tang-{37,38,39,40,41,42,43a}.html.gz`），逐条比对 148 项唐代存疑记录的天宝口数、道属及首列属县（对卷 37 独段体例补足下接属县并对照《旧唐书·卷38》核实 5 郡首县零空值）。
   - 新增核准 **78 项**天宝元年（公元 742 年）郡府称谓（包含严格年号分期保护：`咸安郡` 757 前、`安康郡` 757 前、`安化郡` 756 前、`临淄郡` 746 前、`唐州淮安郡`、`梁州汉中郡`、`恒州常山郡`、`巫州潭阳郡`、`京兆府`、`河南府`）：
     - 累计核准：**342 / 420**（**汉 95 / 唐 247**）；
     - 逐条文档化存疑：**78 / 420**（汉 8 / 唐 70，包括口数尾差/道属差异/音读与 746 年后再改称，**未核查条目为 0**）；
     - 完整证据链存于 [`docs/verification-3.63/han-tang-name-evidence.json`](verification-3.63/han-tang-name-evidence.json) 与 [`docs/verification-3.63/early-asia.json`](verification-3.63/early-asia.json)。

2. **1.5 Mbps 首屏瀑布流消除与地图/时间轴体验升级（Milestone 6）**
   - **消除静态导入瀑布流**：[`map-engine.js`](../public/map-engine.js) 通过 `_geographyStub()` 延迟加载 `geography.js`（及 `lakes.js`、`physical-grid.js`、`lake-codec.js`）；[`app.js`](../public/app.js) 按需动态加载 `polity-reader.js`（及其 `research-map-plates.js`、`polity-places.js`、`fact-period.js`）、`places.js`、`battles.js`、`atrocities.js` 与 `boundary-comparison.js`；[`index.html`](../public/index.html) 预加载 `map-runtime.js`，[`entry.js`](../public/entry.js) 对地图路线尽早并行预热 `land.geojson` 与核心中间模块，在不触碰任何测试隔离契约的前提下降低冷启动等待。
   - **统一悬停预览卡**：`AtlasMap.setHoverMarker`（搭配 `_hoverMarkerActive` 防穿透保护）让鼠标悬停或键盘聚焦**事件点、历史城市/遗址、战役与暴行点**时均实时弹出玻璃态 `.map-hover-card` 双语预览；不会被底图疆域 `mousemove` 覆盖。
   - **视角、时间轴与弹窗细节**：`focusPolity` 改为按地图容器宽高自适应内边距；`#sliderPreview` 在 `1440px` 与 `390px` 视口边界均精确钳位不裁切；`#density` 当前年份柱条及其邻近柱条动态高亮；中国历史区划弹窗 `.historical-review-sources` 采用弹性换行间距。

3. **南亚非线性板块配准实验与跨时代全球目录审计（Milestone 7）**
   - [`docs/verification-3.63/south-asia/audit_v363.py`](verification-3.63/south-asia/audit_v363.py) 对施瓦茨贝格图版 `III.B.4`（`055_b`）进行 **12-DOF 二次多项式翘曲对照**：尽管 19 个拟合边廓刻度均方根从 `7.684 km` 降至 `2.680 km`，但 9 个留出边廓刻度反而由 `3.729 km` 恶化至 `7.629 km`、巴克特里亚由 `68.84 km` 恶化至 `93.35 km`（兰伯特等角 12-DOF 下华氏城更升至 `255.62 km`），且将标准纬线由 `[12N, 26N]` 移至 `[10N, 28N]` 仅带来 `< 0.5 km` 变动，实证约 `57–69 km` 内部地标差源于原图绘制精度而非边廓翘曲。
   - 跨时代核查 **17 个核心政体**（孔雀、巽伽、百乘、贵霜、笈多、朱罗、莫卧儿、马拉他及汉/唐/明/清/罗马/阿拔斯/马里/印加/奥斯曼）均为 `0` 同名区间重叠；全部 **`709` 条事件**（含 `55` 条南亚事件）通过起止日期与 `https://` 来源检查（`0` 异常）。

## v3.63.0 实测与基准

全部测量由独立无头 Chromium 进程（禁用缓存、完整测试与 worker 构建后）执行（原始记录见 [`docs/verification-3.63/final-benchmarks.json`](verification-3.63/final-benchmarks.json)）：

| 场景 | 直连冷启动 (`map-interactive`) | 1.5 Mbps / 150ms 限速 | 首屏请求 `603 KB` 目录 | 重叠 / 控制台报错 |
| --- | --- | --- | --- | --- |
| `desktop_1492` (`1440×900`) | **444 ms** | **4,215 ms** (`729 KB`，较 3.62 `-267 ms`) | 0 次 | 0 / 0 |
| `south_asia_m250` (`-250`, 1440) | **307 ms** | **4,063 ms** (`711 KB`，较 3.62 `-211 ms`) | 0 次 | 0 / 0 |
| `china_742_regional` (`742`, Zoom 6.6) | **397 ms** | **5,583 ms** (`878 KB`，较 3.62 `-30 ms`) | 0 次 | 0 / 0 |
| `europe_1914_cshapes` (`1914`, 1440) | **730 ms** | **6,693 ms** (`1,061 KB`，较 3.62 `-465 ms`) | 0 次 | 0 / 0 |
| `mobile_390_1492` (`390×844`) | **463 ms** | **4,212 ms** (`729 KB`，较 3.62 `-241 ms`) | 0 次 | 0 / 0 |

多视口双图对照防重叠检测：`1280×720`、`834×1194`、`390×844` 均录得 **0 重叠、0 横向溢出、0 控制台错误**。
