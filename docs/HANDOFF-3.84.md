# 经纬纪 · Meridian Atlas — 3.84 交接与验证记录

## 本阶段完成项（v3.84.0）

1. **Wave-19 历史地名全量汉化（Pleiades `ref >= 7` 100% 覆盖，`3,565` 条编辑词条）**
   - 在 [`public/places.js`](../public/places.js) 新增全部 415 处 `Pleiades referenceCount === 7` 古典与近东聚落，编辑词条总数达到 **3,565** 条（全库全部 `Pleiades ref >= 7` 聚落实现 100% 中文覆盖，`remainingRef7PlusWithoutZh: 0`）。
   - 新增代表地标：**吉尔苏（泰洛）**（Girsu）、**伊辛**（Isin）、**基什**（Kish）、**库塔（易卜拉欣丘）**（Cutha）、**亚兹德**（Yazd）、**拉吉**（Lachish）、**迦克墩（卡尔克顿）**（Chalcedon）、**特尔梅索斯**（Termessos）、**羊河口（埃戈斯波塔米）**（Aigospotamos）、**代尔麦地那工匠村**（Deir el-Medina）、**阿拉贾胡尤克**（Alaca Höyük）、**恰高·赞比尔**（Tchogha Zanbil）、**布罗德加角新石器遗址**（Ness of Brodgar）、**锡拉古城（圣托里尼）**（Thera）、**斯帕拉图姆（斯普利特）**（Spalatum）、**那慕尔**（Namur）等。
   - 在 [`scripts/validate-places.mjs`](../scripts/validate-places.mjs) 新增 15 条活跃年代校验断言。

2. **概览括号重名标签去重（[`public/map-engine.js`](../public/map-engine.js)）**
   - 在 `AtlasMap.refreshLabels()` 新增去括号归一化键值 `labelKey`（过滤首尾中英文圆括号）与 `18°` 邻域去重 `placedKeys`，解决 1500 年欧洲概览视野中同一领主实体的带括号与无括号记录（如 `(Habsburg Monarchy)` 与 `Habsburg Monarchy`）并排重复标注的问题（实测 `singleHabsburgLabel: true`）。

3. **内容视图与细节控件视觉统一（[`public/product.css`](../public/product.css) · [`public/cartography.css`](../public/cartography.css)）**
   - 为 `#contentView` 统一深海薄型滚动条（替代刺眼的系统灰滚动条），并在主标题摘要 `#contentView > .lead` 下方增加铜金分割线提升版式秩序感；同步加强桌面端 `.regional-controls` 玻璃描边与移动端 `.timeline-ticks` 间距。

## 验证与基准实测（`docs/verification-3.84/final-benchmarks.json`）

- **全量校验、HTTP 与构建**：`npm run prepare:assets && npm test && npm run test:http && npm run build` 全部通过（exit code `0`；`26/26` 地图应用校验、`14/14` HTTP 检查、生产包 `377` 静态资源 / `2,551` 存储文件）。
- **隔离冷启动性能（14 组无缓存 Chromium 进程）**：
  - `desktop_1492`：非限速首交互 **`337 ms`**（`domInteractiveMs: 11 ms`、`resourceCount: 58`、`detailModulesLoaded: false`）；1.5 Mbps / 150ms RTT 限速首交互 **`3,985 ms`**（`647,911 B`、`34` 个请求）。
  - `south_asia_m250`：非限速 **`241 ms`** / 限速 **`3,794 ms`**；`china_742_regional`：非限速 **`302 ms`** / 限速 **`5,571 ms`**；`mobile_390_1492`：非限速 **`339 ms`** / 限速 **`4,035 ms`**。
  - Multi-viewport：`laptop_1280_compare` (`334 ms`)、`tablet_834_1492` (`334 ms`, `eraButtonsClipped: false`, `toolsHeight: 44`)、`tablet_834_compare` (`326 ms`)、`mobile_390_compare` (`308 ms`) 全部实现 `overlaps: []`、`labelOverlaps: []`、`pinOverlaps: []`、`clippedH: false`、`consoleErrors: []`。
- **实机视觉与域回归检查**：
  - `wave19_ref7_completion`：`editorialCount: 3565`、`remainingRef7PlusWithoutZh: 0`。
  - `europe_1500_habsburg_dedup`：`singleHabsburgLabel: true`。
  - `scratch/v384-audit/{polities-after,laptop-compare-after}.png` 视觉抽检通过；`cshapes_dated_hover_cards`、`polities_dossier_and_export_btn`、`research_zero_map_assets_and_parchment` 与 `east_asia_1000ce_song_and_kaifeng` 全部通过。

## 后续计划（v3.85.0）

- **Wave-20 历史地名汉化（Pleiades `ref === 6` 全量 539 处聚落 -> `ref >= 6` 100% 覆盖）**：包括麦加（Macoraba）、法伊拉卡（Failaka）、舒什塔尔（Shushtar）、示剑（Sychem）、基泽尔/基色（Gazara）、拉菲亚（Raphia）、希俄斯（Chios）、哈尔基斯（Chalcis）、第一查士丁尼亚（Iustiniana Prima）、卡农图姆（Carnuntum）、杜尔-库里加尔祖（Dur-Kurigalzu）、沃洛格西亚（Vologesias）、布拉格（Praha）等。
- **政体中文命名质量审计与修复**：核查 `1500` 年欧洲抽检中发现的 `立窝尼亚语`（Livonia 误译）、`萨沃伊伯爵`（Counts of Savoy）及 `Ryazan` 等政体标签来源（在 `build-polity-display-names.mjs` 规则体系内审计修复）。
