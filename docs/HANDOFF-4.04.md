# 经纬纪 · Meridian Atlas 4.04.0 阶段交付与验证记录

## 本轮核心成果（v4.04.0）

### 1. 打通中文单字政体与战役检索（[app.js](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/app.js#L85-L113)）
- 此前 `renderEvents()` 及检索补全异步回调以 `q.length > 1` 作为门限，导致用户输入单个中文王朝名（「唐」、「汉」、「秦」、「宋」、「明」、「清」）时仅渲染古城遗迹（`renderPlaceSearch()`），跳过了 `ensureFullEventsData()`、`ensurePolitySearchIndex()` 以及政体与战役结果分组，用户不得不点击全部年代或输入两个以上字符才能找到目标朝代。
- 改为 `const isQuery = q.length > 1 || /\p{Script=Han}/u.test(q);`（同步应用于 `renderEvents()` 与异步数据加载回调 `L694`、`L703`、`L707`），保持拉丁单字母不触发全量索引的轻量化约束，同时让单汉字检索即时命中 `南唐`、`后唐`、`唐朝` 等政体、关联事件与古迹。
- 当 `state.lang === 'en'` 时省略 `.battle-hit` 卡片中重复渲染的英文副标题行，保持英语视图整洁。

### 2. 统一多分类搜索分组头部视觉体系（[product.css](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/product.css#L28-L30)）
- 将侧栏多分类检索分组头部（`.polity-results .result-heading`、`#placeResults .result-heading`、`.search-group`）统一为深海黑曜石渐变底色（`#112335 -> #0a1724`），配合 `3px` 左侧识别色条区分政体（`#dcc089`）、城市与遗址（`#82bfa9`）及历史战役（`#d58a70`），与整体冷翠曜黑卡片体系融为一体。

---

## 全量自动化验证证据（v4.04.0）

- `npm run prepare:assets && npm test && npm run test:http && npm run build` 全部通过（exit code `0`）：
  - 内容、目录与几何校验：`PASS 270 native (12 bootstrap) and 117 detail content fingerprints`、`Validated events index (709 events), polity search index (1592 groups), and 64 chain buckets (13380 records)`、`1,250 real geometry samples agree with an independent Shapely oracle`、`69/69 view-state checks passed`、`10/10 border portrayal checks passed`
  - 研究档案与分页：`33/33 passed`、`27/27 Polaris reader checks passed`、`18/18 pagination checks passed`、`15/15 research routing checks passed`、`8/8 research version checks passed`
  - 区域瓦片与边界：`24/24 HALC selection`、`13/13 HALC real-style reload`、`18/18 HALC render readiness`、`29/29 HALC lifecycle`、`17/17 checks (audited 14863 records across 59 shards)`、`15/15 HALC cache`、`30/30 HALC two-source`、`24/24 HALC continuity`、`24/24 independent frozen/live`、`26/26 regional continuity`、`10/10 OHM async`
  - 启动、地图目录与本地 HTTP：`20/20 startup overlap checks passed`、`26/26 map catalog app checks passed`、`14/14 local HTTP checks passed`
  - Worker 构建：`dist/server/index.js`、`dist/client`（`staticRevision: e3c72442369b6cbea74ff3fc9e37a7b9104cd56aac86c4d7efe337cb970516bf`、`revision: 9c6c5ea6ce8ae32936efbe41`）

---

## Chrome 无头独立进程实测基准（`docs/verification-4.04/final-benchmarks.json`）

| 场景 | 视口 | 无节流可交互 (ms) | 1.5 Mbps / 150 ms RTT 可交互 (ms) | 1.5 Mbps 传输量 | 控制台错误 / 重叠 |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `desktop_1492` | 1440×900 | `309` | `4020` | `650,527 B` | `0 / 0` |
| `south_asia_m250` | 1440×900 | `222` | `3812` | `649,755 B` | `0 / 0` |
| `china_742_regional` | 1440×900 | `275` | `5626` | `851,891 B` | `0 / 0` |
| `europe_1914_cshapes` | 1440×900 | `492` | `5955` | `986,652 B` | `0 / 0` |
| `mobile_390_1492` | 390×844 | `311` | `4046` | `650,527 B` | `0 / 0` |

- 多视口布局校验（`laptop_1280_compare` 1280×720、`tablet_834_1492` 834×1194、`tablet_834_compare` 834×1194、`mobile_390_compare` 390×844）：零元素重叠、零标签碰撞、零水平滚动溢出，控制台错误数 `0`。
- 域级实测（`liveDomainChecks`）：
  - `single_hanzi_tang_search_polities_and_places`：输入单字「唐」即时返回 `polityHits: ["南唐", "后唐", "唐朝"]` 与 `placeHits: 6`（地点分组左色条 `rgb(130, 191, 169)`）
  - `research_zero_map_assets_and_parchment`：`maplibreCssLoaded: false`, `maplibreJsLoaded: false`, `originalBodyBg: "rgb(255, 252, 244)"`, `originalTextLen: 61216`

---

## 下一阶段计划（v4.05.0+）

1. 检查暗色主题下原生 `<select>` 下拉列表对照与 `color-scheme: dark` 表现，确保 macOS/Chrome 原生弹出菜单保持深色统一。
2. 审视键盘 `:focus-visible` 焦点环、时间轴滑块悬浮年份预览气泡、移动端时代条滚动交互以及 CShapes / OHM 更多时期双语译名覆盖。
