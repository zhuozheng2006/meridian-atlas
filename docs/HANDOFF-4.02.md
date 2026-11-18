# 经纬纪 · Meridian Atlas 4.02.0 阶段交付与验证记录

## 本轮核心成果（v4.02.0）

### 1. 罗马意大利（公元 117 年）奥古斯都行省与分区中文体系补全（[regional-boundaries.js](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/regional-boundaries.js#L40)）
- 依据公元 117 年地中海区域矢量瓦片实际收录记录，为 `AREA_ZH` 补齐意大利十一行政区及邻近罗马行省官方简体中文译名：
  - `Regio I` – `Regio XI`（如`第一区·拉丁姆与坎帕尼亚`、`第二区·阿普利亚与卡拉布里亚`、`第三区·卢卡尼亚与布鲁蒂乌姆`……`第十一区·外波河区`）、`Roman Italy / Italia`（罗马意大利）、`Moesia I`（第一默西亚行省）、`Alpes Graiae et Poeninae`（格拉伊埃与珀尼纳埃阿尔卑斯行省）、`Hispania Tarraconensis`（塔拉科西班牙行省）、`Britain`（不列颠行省）。
  - Chrome 实测 `#year=117&boundaries=regional&camera=14,41,6.5,0,0` 截图确认地中海详情图已稳定呈现中英双语分区标识。

### 2. 地图右下角来源信息控件（`ⓘ`）曜黑重制（[cartography.css](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/cartography.css#L218-L222)）
- 将 MapLibre GL 默认高亮实心白底 `(i)` 图标替换为透明香槟金（`#dfd0ae`）细线圆形 `ⓘ` SVG，并以曜黑毛玻璃圆底（`rgba(13,26,40,.92)`、`#dcc0893d` 细边框）与下方 `[+]` / `[−]` 缩放控件及左下角比例尺形成统一仪表视觉规范，桌面、平板与移动端全部消除左下/右下角亮白异物感。

### 3. 政体档案单年记录重复换行修复（[polity-reader.js](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/polity-reader.js#L116)）
- 修复单年边界记录（如罗马帝国公元 394 年快照）在「这段疆域」统计卡内上下重复打印两次同一年份的问题：当 `r.start === r.end && r.end !== 0` 时精简输出单行 `公元 394 年`。Chrome 实测打开罗马帝国档案确认 `.fact-grid .fact dd` 输出 `"公元 394 年"`。

---

## 全量自动化验证证据（v4.02.0）

- `export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" && npm run prepare:assets && npm test && npm run test:http && npm run build` 全部通过（exit code `0`）：
  - 内容与地理：`18/18` lake checks、`16/16` places checks、`17/17` polity display names、`15/15` battles、`1,250` real geometry Shapely agreement
  - 边界与区域瓦片：`69/69` view-state、`24/24` HALC selection、`13/13` HALC real-style reload、`18/18` HALC render readiness、`29/29` HALC lifecycle、`15/15` HALC cache、`30/30` HALC two-source、`24/24` HALC continuity、`26/26` regional continuity、`10/10` OHM async、`16/16` regional boundaries、`17/17` (14,863 records audited)
  - 阅读器与研究模式：`33/33`、`27/27` Polaris reader、`18/18` pagination、`15/15` research routing、`8/8` research version checks
  - 启动与目录索引：`20/20 startup overlap checks passed`、`26/26 map catalog app checks passed`、`14/14 local HTTP checks passed`；Worker 构建产出 `dist/server/index.js`、`dist/client`（`staticRevision: e3c72442369b6cbea74ff3fc9e37a7b9104cd56aac86c4d7efe337cb970516bf`、`revision: 9c6c5ea6ce8ae32936efbe41`）

---

## Chrome 无头独立进程实测基准（`docs/verification-4.02/final-benchmarks.json`）

| 场景 | 视口 | 无节流可交互 (ms) | 1.5 Mbps / 150 ms RTT 可交互 (ms) | 1.5 Mbps 传输量 | 控制台错误 / 重叠 |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `desktop_1492` | 1440×900 | `324` | `4039` | `650,443 B` | `0 / 0` |
| `south_asia_m250` | 1440×900 | `252` | `3812` | `649,671 B` | `0 / 0` |
| `china_742_regional` | 1440×900 | `308` | `5630` | `851,811 B` | `0 / 0` |
| `europe_1914_cshapes` | 1440×900 | `552` | `5872` | `986,570 B` | `0 / 0` |
| `mobile_390_1492` | 390×844 | `318` | `4025` | `650,443 B` | `0 / 0` |

- 多视口布局校验（`laptop_1280_compare` 1280×720、`tablet_834_1492` 834×1194、`tablet_834_compare` 834×1194、`mobile_390_compare` 390×844）：零元素重叠、零标签碰撞、零水平滚动溢出，控制台错误数 `0`。
- 域级实测（`liveDomainChecks`）：
  - `awmc_117_bilingual_regions_and_attrib`：`attribBg: "rgba(0, 0, 0, 0)"`（无白色实心底，双语意大利分区标签正常渲染）
  - `roman_394_single_year_fact_no_duplicate`：`periodFactText: "公元 394 年"`
  - `research_zero_map_assets_and_parchment`：`maplibreCssLoaded: false`, `maplibreJsLoaded: false`, `originalBodyBg: "rgb(255, 252, 244)"`, `originalTextLen: 61216`

---

## 下一步优化方向

- 同步修正 `polity-reader.js` 头部标签与 `territory` 选段按钮在 `r.start === r.end` 时的起止年冗余拼接；持续排查西班牙/高卢/小亚细亚古罗马行省双语覆盖、`Journey` / `Event` 阅读器细节美感与交互体验。
