# 经纬纪 3.68.0：入口级首屏数据预取、297 条古今双语地名体系与专题／资料界面重塑

## 本版三大里程碑

1. **入口级首屏数据并发预取（`ea0a50ee`）**
   - 在 [`public/entry.js`](../public/entry.js) 的 `boot()` 阶段直接并行拉取精简事件索引 `data/fast/events-index.json.gz`，并在导入仅 **1,553 字节**、零传递依赖的 [`public/bootstrap-content-hashes.js`](../public/bootstrap-content-hashes.js) 后立即按哈希地址预取当前路由年份对应的 `__atlas-native/year-<Y>.json.gz`，通过一次性共享池 `window.__meridianBootPrefetch` 移交 [`public/map-engine.js`](../public/map-engine.js) 的 `readJSON()` 消费。
   - 彻底消除了原本等待全部 ES 模块解析完毕后才发起首屏历史数据请求的 `~1.2 秒` 串行等待：在 `1.5 Mbps / 150ms RTT` 弱网实测中，`year-1492` 与 `events-index` 的首次网络请求发起时间由约 `1980–1996 ms` 提前至 `761–832 ms`（`events-index` `564–639 ms`），全程无重复下载（`eventsIndexReqs: 1`、`nativeYearReqs: 1`）且研究视图 `#view=research` 零地图数据污染。

2. **三批 106 城古今双语地名补齐（累计 297 处）与 5 条《两唐书》原始引证扩展（`ddce21a2`）**
   - 对 1800 年以前历史聚落（Chandler / Modelski）及 Pleiades `referenceCount >= 25` 遗址执行全库普查，去除重复键 `modelski-modern:266` 并在 [`public/places.js`](../public/places.js) 的 `PLACE_ZH_EDITORIAL` 增补 106 项权威中文译名（累计 **297** 条唯一条目），覆盖古马尔卡赫（Gumarcaj `chandler:524`）、敦煌（`chandler:399`）、三星堆（`modelski-ancient:112`）、米利都（`pleiades:599799`）、伊兹尼克（`chandler:630`）、穆尔希达巴德（`chandler:963`）、阿马拉普拉（`chandler:49`）、巴克特拉／蓝氏城（`pleiades:961886`）等，同时保留柯尼斯堡／加里宁格勒（`chandler:734`）按年演变的 `nameTimeline` 动态优先级与 `3` 条西半球错位坐标隔离（`PLACE_COORD_QUARANTINE`）。扩展 [`scripts/validate-places.mjs`](../scripts/validate-places.mjs) 覆盖 Wave-3 回归检查（`23/23` 通过）。
   - 继续核对仓储保存的《旧唐书·卷四十一》（`old-tang-41.html.gz`）与《新唐书·卷四十三上》（`new-tang-43a.html.gz`）地理志原文，为 [`public/data/china-prefectures/name-audit.json`](../public/data/china-prefectures/name-audit.json) 再补入 5 条 `deferred` 州府原始卷次、条目与户数录文（`742-7` 胜州、`742-8` 丰州、`742-27` 鄯州、`742-32` 甘州、`742-57` 眉州）。当前全库 `51` 条 `deferred` 条目中已有 **`46 / 51`** 附带逐字史料引证（含 369 条已核准记录共 **`415 / 420`** 有正史直接引证），其余 5 条属羁縻／贡州或待补《新唐书·卷四十三下》，严格维持 `deferred` 口径不作臆改。

3. **「专题 Journeys」导览控制条、档案阅读抽屉与「资料 Sources」视觉重构（`3.68.0`）**
   - **专题导览控制条 `.story-bar`**：重塑 [`public/app.js`](../public/app.js) `renderEventDetail` 与 [`public/product.css`](../public/product.css) 的导览条结构，将原本折行散落的文字标题与进度改为左标题＋右胶囊计数 `.story-step-badge`（如 `1 / 18`），下方新增细腻流金进度条 `.story-track`，并将 `#storyNext` 提升为主视觉香槟金引导按钮、#storyExit 柔化为次级幽灵钮，桌面与移动（`390×844`）均贴合顺滑。
   - **档案细节与地图悬浮提示盒**：将 `.map-notice` 升级为圆角黑曜石×黄铜毛玻璃胶囊提示盒；重构事件／来源抽屉内的 `.source-link` 为独立圆角考证卡、`.evidence` 为黄铜左饰引证框、`#eventExport` 与 `.reader-footer button` 为统一胶囊控件，完善 `.reader-tabs` 激活底线与高对比反馈。
   - **「资料 Sources」系统化升级**：将 `.stat-grid` 统计卡升级为带顶部黄铜饰边的玻璃态遥测卡片，将 `.sources-actions` 按钮群以 `#openResearch` 香槟主钮统领，并为数据源清单表 `.table-scroll` 赋予与年表一致的黑曜石表头与行悬停高亮质感。

## v3.68.0 实测与基准

全部测量由独立无头 Chromium 进程（禁用浏览器缓存、全量 `v3.68.0` 资源戳构建后）采集，完整原始结果见 [`docs/verification-3.68/final-benchmarks.json`](verification-3.68/final-benchmarks.json)：

| 场景 | 首图交互耗时 (`3.68.0`) | 事件索引 / 年包发起时刻 (`unthrottled`) | 传输字节 / 请求数 | 可见标注碰撞 (`pin` / `UI`) | Console Errors |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `desktop_1492` (1440×900) | `391 ms` | `23 ms` / `76 ms` | `3.78 MB` / `76 req` | `0` / `0` | `0` |
| `south_asia_m250` | `254 ms` | `21 ms` / — | `4.74 MB` / `81 req` | `0` / `0` | `0` |
| `china_742_regional` | `311 ms` | `19 ms` / — | `5.96 MB` / `80 req` | `0` / `0` | `0` |
| `europe_1914_cshapes` | `573 ms` | `24 ms` / `63 ms` | `10.52 MB` / `133 req` | `0` / `0` | `0` |
| `mobile_390_1492` (390×844) | `392 ms` | `14 ms` / `52 ms` | `3.14 MB` / `68 req` | `0` / `0` (`heading–tools +23px`) | `0` |
| `laptop_1280_compare` | `377 ms` | `13 ms` / `47 ms` | `3.92 MB` / `77 req` | `[]` / `clippedH: false` | `0` |
| `tablet_834_compare` | `393 ms` | `21 ms` / `62 ms` | `4.26 MB` / `80 req` | `[]` / `clippedH: false` | `0` |
| `mobile_390_compare` | `413 ms` | `21 ms` / `61 ms` | `3.53 MB` / `71 req` | `[]` / `clippedH: false` | `0` |

- `1.5 Mbps / 150ms RTT` 弱网独立冷启动实测：
  - `desktop_1492`：`4188 ms`（`events-index` 发起于 **`639 ms`**、`year-1492` 发起于 **`832 ms`**）
  - `south_asia_m250`：`4003 ms`（`events-index` 发起于 **`633 ms`**）
  - `china_742_regional`：`5797 ms`（`events-index` 发起于 **`632 ms`**）
  - `europe_1914_cshapes`：`6320 ms`（`events-index` 发起于 **`585 ms`**、`year-1914` 发起于 **`784 ms`**）
  - `mobile_390_1492`：`4281 ms`（`events-index` 发起于 **`561 ms`**、`year-1492` 发起于 **`768 ms`**）
- 全套构建与校验通过：`npm run prepare:assets`、`npm test`、`npm run test:http`（`14/14`）、`npm run build`。

## 后续可继续推进方向

1. 继续核补 [`name-audit.json`](../public/data/china-prefectures/name-audit.json) 尚缺正史引证的最后 5 项盛唐羁縻／贡州条目（需参考《新唐书·卷四十三下》及《通典》对应条目）。
2. 为 `71` 个尚无中文定名的高频政体组（含东亚／东南亚政权与部分欧洲早期王国）逐条补充百科实体或一手文献考证映射，并接入 `polity-names.js` 验证体系。
3. 为 `PLACE_COORD_QUARANTINE` 中的 3 条 Chandler 西半球错位城市及「文明 Polities」抽屉内的关联城市／时间轴交互增加轻量勘误外链与悬停微交互反馈。
