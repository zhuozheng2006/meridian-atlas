# 经纬纪 3.65.0：研究视图与移动端卡片重构、冷启动并发调优及历史首都勘误隔离

## 本轮成果总览

1. **高发交互边界与多终端视觉打磨（[`research-reader.css`](../public/research-reader.css)、[`product.css`](../public/product.css)）**
   - **Seshat 研究视图（`#view=research`）**：修复了顶部“返回资料页 · Back to sources”按钮与 `SESHAT · RESEARCH ARCHIVE`（`span.eyebrow`）同行碰撞问题，改为黑曜石金边胶囊按钮并单独换行；修复 `background: transparent` 简写覆盖下拉箭头图标的问题，全面升级为暗色黑曜石表单与选项样式，并将 `.research-advanced-controls` 4 列网格重构为均衡 `2 × 2` 网格，彻底消除“26项优先研究变量”中英文截断。
   - **移动端世界年表卡片重构（`390×844`）**：移除了移动端下 `.table-scroll table { min-width: 550px }` 导致的事件标题半截裁切，将每条年表记录重组为全宽堆叠黑曜石卡片（金色年份页眉、无截断标题与英文副标题、地区与主题底栏、`查阅↗` 来源胶囊），实测 709 条事件全量渲染横向溢出为 `0`。
   - **双图对比副标题与使用指南弹窗（`#helpDialog`）**：放开对比模式下桌面端 `.comparing .map-heading #mapEra` 宽度限制（“全球相遇 · GLOBAL ENCOUNTERS”单行舒展展示）；为 `#helpDialog` 注入黑曜石渐变底色、毛玻璃遮罩、圆形关闭按钮与键盘快捷键调用框。

2. **冷启动渲染脚本调度与模块并行预热（[`map-runtime.js`](../public/map-runtime.js)、[`entry.js`](../public/entry.js)）**
   - 在保留静态路由隔离（`#view=research` 零地图资源加载、`startup.js` 保持单条目录 preload、`maplibre-gl` 无条件 HTML preload 为 `0`）的前提下，将 `map-runtime.js` 动态加载脚本提升至 `fetchPriority = 'high'`，并在 `entry.js` `boot()` 首屏阶段并行预热核心 9 个 ES 子模块与地图引擎脚本，避免异步低优脚本与非阻塞事件索引抢占首屏信道。
   - 经 `stamp-assets` 与全部单元测试（`validate-research-entry`、`validate-map-runtime`、`validate-bootstrap-hashes`）验证，全场景直连首帧交互耗时全面刷新：桌面 `1492` 降至 **308 ms**（较 3.64 降 17 ms），南亚 `-250` **233 ms**，唐 `742` 详图 **269 ms**，欧洲 `1914` **487 ms**，移动端 `390×844` **310 ms**（较 3.64 降 **52 ms**）。

3. **历史首都数据全量勘误、中文校译与唐天宝《通典》互证（[`places.js`](../public/places.js)、[`validate-places.mjs`](../scripts/validate-places.mjs)、[`name-audit.json`](../public/data/china-prefectures/name-audit.json)）**
   - **隔离 4 项上游 Wikidata 严重正负号/世纪错位首都宣称**（遵循“原始归档文件保持字节原样与校验哈希不变、展示层从严隔离不臆改年份”原则，`CAPITAL_DATE_QUARANTINE` 见 [`places.js`](../public/places.js)）：
     - `capital:Q180568$5ac9055c-44f4-93a7-fcb7-88674c46b701`：埃及新王国时期底比斯 `[-1336, 1279]`（`+1279` 正负号误录，跨跃至元初 2615 年之久，与同条下接培尔—拉美西斯 `[-1279, -1213]` 自相矛盾）；
     - `capital:Q2980623$613b5f92-45dd-ce9b-abcd-9c5fc0145c32`：波斯尼亚王国维索科 `[9, 1340]`（`+9` 年误录，使中世纪政权误落入奥古斯都罗马时期）；
     - `capital:Q3627069$d0b39cb4-4d5e-15ee-4f60-725632ee182d`：匈牙利波斯尼亚省博博瓦茨 `[14, 14]`（将“14 世纪”误录为公元 14 年）；
     - `capital:Q83958$cf01679d-4565-d213-61db-12abfbc7b7b4`：古马其顿王国埃盖 `[808, 808]`（将公元前 `808` 年误录为公元 `+808` 年，唐宪宗与查理曼时代误现古马其顿首都）。
   - **修正错译与补齐 15 项无中文名历史首都及 3 项政权标签**：修正阿赫那顿故都 `Amarna`（`Q5736`）原误译“尼托斯”为 **“阿玛尔纳”**；补齐西班牙三迁首都（`托莱多`、`马德里`、`巴利亚多利德`）、西罗马 `拉韦纳`、阿拉贡（`哈卡`、`韦斯卡`）、波斯尼亚 `博博瓦茨`、古马其顿 `埃盖`、克里米亚汗国 `楚夫特卡莱`、法蒂玛王朝 `曼苏里耶`、哈萨克汗国 `苏扎克`、马打兰国（`克尔托`、`普莱雷特`）、内寇尔 `内寇尔` 与克什米尔 `诺瓦塔`；补全 `Kashmir Sultanate -> 克什米尔苏丹国`、`First Toungoo Empire -> 东吁第一帝国` 并订正 `Franciaf -> Francia`。
   - **唐 742 年淮南道 `742-158 沔州` 三书复核存照**：在 [`name-audit.json`](../public/data/china-prefectures/name-audit.json) 中为 `china-prefecture-742-158`（`Mian Zhou`, `Huainan Dao`）补齐《通典·卷一八三》（“汉阳郡：户六千二百五十二，口三万八千一百二十九，沔州今理汉阳县”）、《新唐书·卷四十一》（“本沔州汉阳郡”）与《旧唐书·卷四十》（太和七年并入鄂州注）文献互证；因源记录 `POP = 38000` 标为 `Estimation from Gong (2019)` 估算值，维持全库 51 项待考区的从严口径不作自动改名。

## v3.65.0 实测与基准

全部测量由独立无头 Chromium 进程（禁用缓存、全量构建 `v3.65.0` Worker 后）执行（完整结果见 [`docs/verification-3.65/final-benchmarks.json`](verification-3.65/final-benchmarks.json)）：

| 场景 | 直连冷启动 (`map-interactive`) | 1.5 Mbps / 150ms 限速 | 首屏请求 `native-content-hashes.js` / 全目录 | 重叠 / 控制台报错 |
| --- | --- | --- | --- | --- |
| `desktop_1492` (`1440×900`) | **308 ms** (较 3.64 `-17 ms`) | **4,155 ms** (`717,286 B`) | `false` / `0` 次 | 0 / 0 |
| `south_asia_m250` (`-250`, 1440) | **233 ms** (较 3.64 `-3 ms`) | **3,974 ms** (`716,612 B`) | 按需读取 / `0` 次 | 0 / 0 |
| `china_742_regional` (`742`, Zoom 6.6) | **269 ms** (较 3.64 `-18 ms`) | **5,752 ms** (`888,699 B`) | 按需读取 / `0` 次 | 0 / 0 |
| `europe_1914_cshapes` (`1914`, 1440) | **487 ms** (较 3.64 `-32 ms`) | **6,320 ms** (`1,049,250 B`，较 3.64 `-80 ms`) | `false` / `0` 次 | 0 / 0 |
| `mobile_390_1492` (`390×844`) | **310 ms** (较 3.64 `-52 ms`) | **4,166 ms** (`717,286 B`) | `false` / `0` 次 | 0 / 0 |

多视口双图对照防重叠检测（`1280×720` `303 ms`、`834×1194` `318 ms`、`390×844` `310 ms`）以及实机 Chromium 领域校验（`-1345 阿玛尔纳` 无 `尼托斯`、公元 `742` 年无新王国底比斯残留、`14` 年无波斯尼亚首都残留、`808` 年无古马其顿埃盖残留、`1570` 年展现“马德里”、`390×844` 年表 709 行零横向溢出）全部通过且 **0 控制台错误**。
