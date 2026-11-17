# 经纬纪 · Meridian Atlas — 3.80 交接与验证记录

## 本阶段完成项（v3.80.0）

1. **Wave-15 历史地名全量汉化（Pleiades `ref >= 11` 100% 覆盖，`2,238` 条编辑词条）**
   - 在 [`public/places.js`](../public/places.js) 的 `PLACE_ZH_EDITORIAL` 补充 224 处 `referenceCount === 11` 古典聚落，编辑词条总数达到 **2,238** 条（全部 **1,542** 处 `Pleiades ref >= 11` 聚落实现 100% 中文覆盖）。
   - 新增代表地标包括：加沙、瓦伦蒂亚（瓦伦西亚）、摩纳哥（赫拉克勒斯·莫诺伊科斯港）、马里卜（马里亚巴）、德黑兰、卡穆洛杜努姆（科尔切斯特）、阿莱西亚、西尔米乌姆、德罗贝塔、克桑滕（乌尔皮亚·图拉真城）、卡尔克里泽（条顿堡遗址）、白港（乌加里特港）等。
   - 在 [`scripts/validate-places.mjs`](../scripts/validate-places.mjs) 新增 12 条活跃年代校验断言并全量通过。

2. **战役标注与档案面板全量双语补完（`BATTLE_ZH_GLOSSARY` + `battleLabels()` + `openBattle()` / `openAtrocity()`）**
   - 在 [`public/battles.js`](../public/battles.js) 新增 `BATTLE_ZH_GLOSSARY`（87 条缺失英文参战方、冲突、国家实体中文映射，如 `Canaanites -> 迦南人`、`Hatti -> 赫梯`、`Archidamian War -> 阿基达穆斯战争`、`Sekigahara Campaign -> 关原会战`、`British India -> 英属印度`，严格保留如 `Q11655534` 等未标注 Wikidata 实体原样），并导出 `battleLabels(zhArr, enArr, lang)` 复用函数。
   - 修复 [`public/app.js`](../public/app.js) `openBattle()`：切换为按 `state.lang === 'en'` 优先展示主标题、通过 `getBattlesMod().battleLabels()` 本地化 `参战方`/`所属冲突`/`涉及国家`、非空冲突防空白 `<dt>所属冲突</dt>` 行，以及按 `REGIONS` 映射本地化大洲/地区名；同步修复 `openAtrocity()` 的 `region` 字段中文映射（遵守 `validate-atrocities.mjs` 不虚构事件音译标题的规范）。

3. **清理 [`public/cartography.css`](../public/cartography.css) 顶层重复样式声明**
   - 合并 [`public/cartography.css`](../public/cartography.css) 中 29 处顶层同属性覆盖重复声明，体积由 `35,475 B` 降至 **`34,907 B`**。

## 验证与基准实测（`docs/verification-3.80/final-benchmarks.json`）

- **全量校验、HTTP 与构建**：`npm run prepare:assets && npm test && npm run test:http && npm run build` 全部通过（exit code `0`；`14/14` HTTP 检查；Worker `dist/server/index.js` + `dist/client` 构建成功）。
- **隔离冷启动性能（13 组无缓存 Chromium 进程）**：
  - `desktop_1492` 非限速首交互：**`321 ms`**（`domInteractiveMs: 18 ms`、`nativeYearStartMs: 53 ms`、`overlaps: []`、`labelOverlaps: []`、`pinOverlaps: []`、`clippedH: false`、`fullCatalogRequested: false`）。
  - `desktop_1492` 1.5 Mbps / 150ms RTT 限速首交互：**`4,026 ms`**（`647,280 B`、`35` 个请求）。
  - `mobile_390_1492` 非限速 `312 ms` / 限速 `4,050 ms`；`laptop_1280_compare` `316 ms`、`tablet_834_compare` `334 ms`、`mobile_390_compare` `318 ms`，全部 13 组实例与域回归均零重叠、零水平溢出且 `consoleErrors: []`。
- **实机视觉与域回归检查**：
  - `battles_bilingual_dossier_and_glossary`（公元前 1457 年米吉多战役，`603` 条战役）：实测 `remainingNonQidEnglishInZh: []`，详情页 `米吉多战役` 展示完整中文参战方（`迦南人 · 卡迭石 · 米吉多 · 胡里特人 · 新王国时期 · 米坦尼`）与地区（`西亚与中亚`），无空白冲突行。
  - `east_asia_1000ce_song_and_kaifeng`：公元 1000 年正常展示**北宋**等 10 个政体标签、**开封**唯一展示（`kaifengCount: 1`），`noZhPlaces: []`、`labelHits: []`。
  - `#view=research`（汉谟拉比法典已保存原文）：`maplibreCssLoaded: false`、`maplibreJsLoaded: false`，羊皮纸背景 `rgb(255, 252, 244)`、`61,216` 字符原文正文正常；`#view=polities` `eventsTabRenderMs: 1.2 ms`、`hasExportBtn: true`。

## 后续计划（v3.81.0）

- **Wave-16 历史地名全量汉化（Pleiades `ref === 10` 全 281 处聚落 -> `ref >= 10` 1,841 处 100% 覆盖）**：含 `Heliopolis`（赫利奥波利斯）、`Māri`（马里）、`Nippur`（尼普尔）、`Ateste`、`Malaca`（马拉加）、`Byblos`（比布鲁斯）、`Tanis`（塔尼斯）、`Singidunum`（辛吉杜努姆）、`Myra`（米拉）等。
- **跨表冗余与中屏平板布局修复（`style.css` × `product.css` × `cartography.css`）**：消除 `style.css` 对 `product.css` 在 `.quality-counts`、`@media(min-width:1500px)` 与 `@media(max-width:760px)` 的被覆盖规则，修复 `761..1000px` 视口中 `style.css` `main{height:calc(100dvh - 282px)}` 与 `--header-height:98px` 不一致引起的纵向裁切/留白问题，并继续挖掘首帧与交互渲染提速点。
