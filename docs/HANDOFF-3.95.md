# 交接与验证记录 · v3.95.0

- **版本**: `3.95.0`
- **日期**: 2026-11-18
- **主工作区**: `/Users/zane/Documents/ChatGPT/MeridianAtlas`

## 本轮核心推进

1. **公元 742 年唐代中国历史区划全量 420/420 简体中文覆盖（[`public/china-prefectures.js`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/china-prefectures.js)）**：
   - 在保持既定 `public/china-name-reviews.js`（369 条考订）与 `public/data/china-prefectures/name-audit.json`（51 条暂缓对读清单）完全只读不变、`validate-early-asia.mjs` 全项契约不受任何影响的前提下，于 [`public/china-prefectures.js`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/china-prefectures.js) 按记录 `id` 补充全部剩余 **`51`** 处公元 742 年唐代州府区划（如 `仪州 Yi Zhou`、`夏胜丰灵宥盐六州及单于·安北大都护府`、`安东都护府`、岭南 `春州` vs `淳州`、`桂州` vs `巂州`、河南 `济州` 等）的简体中文显示标签。
   - 彻底消除了此前公元 742 年区域详图画面中北部边疆与东南多州混杂纯拼音英文的断层感；并在 [`scripts/validate-china-prefectures.mjs`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/scripts/validate-china-prefectures.mjs) 新增全分片 317 条 `742 CE` 区划简体中文完备性断言。
2. **603 条历史战役全量简体中文规范化与 Wikidata 恶搞/裸 QID 防护（[`public/battles.js`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/battles.js)、[`public/app.js`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/app.js)）**：
   - 审核并清除 [`public/battles.js`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/battles.js) 渲染管线中的上游 Wikidata 破坏词条（移除 1945 年冲绳岛战役 `battle-q192660` 参战方中误入的动漫角色 `"艾連·葉卡"` / `"Eren Yeager"`）及关原之战 `battle-q234188` 裸 QID 残留（`Q11655534`），同时修复全库战役名称中的英文混杂与维基锚点片段（`Mons Algidus战役 -> 阿尔吉杜斯山战役`、`斯文达克斯战役（Battle of Svindax） -> 斯文达克斯战役`、`Haram战役 -> 哈拉姆战役`、`Broome轟炸 -> 空袭布鲁姆`、`越灭吴之战#笠泽之战 -> 笠泽之战`）及港台繁体/译名（`突擊雪梨港 -> 突袭悉尼港`、`可倫坡復活節空襲 -> 科伦坡复活节空袭`、`德納號巡防艦沉沒 -> 德纳号护卫舰沉没`等），并扩展 `BATTLE_ZH_GLOSSARY` 覆盖参战方/冲突/现代位置字段。
   - 新增导出统一规范化函数 `battleName(battle, lang)` 并接入 `BattleLayer`、侧边栏搜索（[`public/app.js`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/app.js#L100-L108)）与战役详情页 [`openBattle()`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/app.js#L468-L473)。

## 验证结果

- **离线构建与全套测试**（`npm run prepare:assets && npm test && npm run test:http && npm run build` 退出码 `0`）：
  - `validate-china-prefectures.mjs`: `420` 源行 / `1329` 分片实例与新增 `317/317` 公元 742 年简体中文检查全通；`validate-early-asia.mjs`: PASS
  - `validate-places.mjs`: **23/23 PASS**；`validate-city-time.mjs`: **22/22 PASS**
  - `validate-regional.mjs` / continuity: **26/26 PASS**；`validate-polity-display-names.mjs`: **17/17 PASS**
  - `validate-country-display-names.mjs`: **passed: true**（`39` / `31` / `62`）
  - `validate-startup-overlap.mjs`: **20/20 PASS**；`validate-map-catalog-app.mjs`: **26/26 PASS**
  - `polaris-worker`: **19/19 PASS**；`test:http`: **14/14 PASS**
  - `build-worker.mjs`: `staticStorageFiles: 377` / `storageFiles: 2551`
- **Chromium 实测（[`docs/verification-3.95/final-benchmarks.json`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/docs/verification-3.95/final-benchmarks.json)）**：
  - 全局 `consoleErrors: []`，所有视口 `overlaps: []`、`labelOverlaps: []`、`pinOverlaps: []`、`clippedH: false`。
  - 未限速冷启动 `mapInteractiveMs`：`desktop_1492` **`798 ms`**、`south_asia_m250` **`539 ms`**、`china_742_regional` **`539 ms`**、`europe_1914_cshapes` **`730 ms`**、`mobile_390_1492` **`493 ms`**。
  - `1.5 Mbps / 150 ms RTT` 限速冷启动 `mapInteractiveMs`：`desktop_1492` **`4,925 ms`**、`south_asia_m250` **`3,824 ms`**、`china_742_regional` **`5,639 ms`**、`europe_1914_cshapes` **`6,307 ms`**、`mobile_390_1492` **`5,050 ms`**。
  - 实时域与视觉核查：`total742: 317`、`missingZhCount: 0`、`yiZhou742_314: "仪州"`、`northernHexa742_315: "夏胜丰灵宥盐六州及单于·安北大都护府"`、`totalBattles: 603`、`asciiOrHashInZhName: 0`、`hasErenYeagerInOkinawaPanel: false`、`sekigaharaQidFiltered: true`、`leuctraCountries: ["忒斯皮埃", "希腊"]`；研究页零地图静态资源加载（`maplibreCssLoaded: false`、`maplibreJsLoaded: false`、`originalBodyBg: "rgb(255, 252, 244)"`、`originalTextLen: 61216`）。

## 后续规划（v3.96.0+）

- 对全库湖泊名称覆盖、现代地理参照城市及 CHGIS/OHM 边界元数据开展新一轮核查，并持续优化高频交互视图细节与冷启动传输包体。
