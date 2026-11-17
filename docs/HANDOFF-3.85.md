# 3.85 验证与交接记录

**版本：3.85.0** · **日期：2026-11-18** · **上一版本：[3.84](HANDOFF-3.84.md)**

---

## 本轮核心成果

1. **Wave-20 历史地名权威补齐（`public/places.js` · `scripts/validate-places.mjs`）**
   - 依据坐标、时代与考古文献，为全量剩余 **`539` 处 Pleiades `referenceCount === 6`** 聚落与遗址补齐权威简体中文译名（含马科拉巴／麦加 `pleiades:29652`、法伊拉卡岛遗址／伊卡罗斯 `pleiades:912851`、舒什塔尔／索斯特拉特 `pleiades:912941`、示剑 `pleiades:678403`、基泽尔／基色 `pleiades:687904`、拉菲亚 `pleiades:688015`、迦毕试 `pleiades:59759`、卡农图姆殖民地 `pleiades:128384`、第一查士丁尼亚 `pleiades:207193`、阿尼古城 `pleiades:863739`、杜尔-库里加尔祖 `pleiades:893988`、芝诺比娅／哈拉比耶 `pleiades:894185`、格劳贝格凯尔特王城 `pleiades:118701`、布拉格 `pleiades:118913`、伊斯坦布尔／君士坦丁堡 `pleiades:77402394` 等）。
   - `PLACE_ZH_EDITORIAL` 由 `3,565` 条增至 **`4,104` 条**，实测全量 `Pleiades referenceCount >= 6` 聚落未译遗漏数为 **`remainingRef6PlusWithoutZh: 0`**（100% 完成）。`node scripts/validate-places.mjs` **23 / 23 PASS**。

2. **上游政体机翻纠偏与未译主要政体双语补齐（`public/map-engine.js`）**
   - 在不修改 `editorial/polity-display-names.json` 与 `polityName()` 核心合约的前提下，于地图概览与悬停层新增 [`overviewPolityName()`](../../public/map-engine.js#L60-L69) 及 [`POLITY_LABEL_ZH_FIX`](../../public/map-engine.js#L17-L59)：
     - 修正 `26` 处上游维基词条/机翻错讹（例如 `立窝尼亚语 -> 利沃尼亚邦联`、`切尔尼戈夫统治者列表 -> 切尔尼戈夫公国`、`也门伊玛目列表 -> 也门伊玛目国`、战国 `中山市 -> 中山国`、`梁赞大公 -> 梁赞公国`、`维捷布斯克公爵 -> 维捷布斯克公国`、`大波兰公爵 -> 大波兰公国`、`塞尔维亚大王子 -> 塞尔维亚大公国`、`萨沃伊伯爵 -> 萨伏伊伯国`、`安茹伯爵 -> 安茹伯国`、`阿奎莱亚宗主教 -> 阿奎莱亚宗主教区`、`迪斯蒙伯爵 -> 德斯蒙德伯国`、`阿尔斯特伯爵 -> 阿尔斯特伯国`、`莱格尼察公爵 -> 莱格尼察公国`、`奥索纳伯爵 -> 奥索纳伯国`、`比托姆公爵 -> 比托姆公国`、`施瓦茨堡统治者列表 -> 施瓦茨堡-松德斯豪森侯国`、`瓦尔德克统治者列表 -> 瓦尔德克-皮尔蒙特侯国`、`凯法利尼亚与扎金索斯公爵领地 -> 托科家族领地`、`文奇察省 -> 文奇察公国`、`匈牙利皇冠领地波士尼亚省 -> 波斯尼亚总督区`、`阿尔马尼亚克行省 -> 阿尔马尼亚克伯国` 等）。
     - 按朝代分期准确消歧（公元前 `Later Zhou` -> `东周` 且公元 `960` 年仍保留 `后周`；`410–438 CE` `Xia` -> `胡夏`；`911–946 CE` `Min` -> `闽国`），并补齐 `Mahameghavahana Dynasty -> 大云车王朝`、`First Toungoo Empire -> 东吁第一帝国`、`(Carolingian Empire) -> （加洛林帝国）`、`Gothia -> 哥特兰（哥特诸部）`、`Old Kingdom of Norway -> 挪威王国`、`Southern Wu -> 南吴（杨吴）`、`Muzaffarids -> 穆扎法尔王朝`、`Denmark-England -> 北海帝国（丹麦—英格兰）`、`Samo's Empire -> 萨莫斯拉夫邦联`、`Jaunpur Sultanate -> 章普尔苏丹国` 等 **61 个**高频未译政体名。

3. **OHM 地区详图德意志／意大利／东亚双语扩展（`public/regional-boundaries.js`）**
   - 扩充 [`CITY_ZH`](../../public/regional-boundaries.js#L39) **`17` 座**帝国自由市（纽伦堡、奥格斯堡、沃尔姆斯、施派尔、雷根斯堡、罗腾堡、海尔布隆、埃斯林根、罗伊特林根、魏森堡等）与 [`AREA_ZH`](../../public/regional-boundaries.js#L40) **`47` 个**高频区域单元（涵盖德意志诸采邑主教区／修道院领／帝国行政圈、卢卡共和国、奥兰治亲王国、波希米亚、日本南海道、朝鲜汉城府、江户幕府、菲律宾都督府、法属安南保护国等）。
   - Chromium 实测 1500 年德奥地区缩放视图下可见 **14 / 14 条**区划实现 100% 简体中文双语标注（`zhCount: 14`）。

4. **Obsidian × Brass 界面微精修（`public/product.css` · `public/cartography.css`）**
   - 为侧栏选中事件卡 `.event-card.selected:before` 增加黄铜辉光竖条，统一 `#sidebar .event-list`、`#contentView` 与 `.reader-content` 的 WebKit 6 px 圆角深色滚动条。
   - 为 `.map-heading` 增添左侧黄铜暖光径向渐变，为双图对比分隔线 `#map2` 与 `.compare-heading` 补充黄铜高光与顶缘金线，使单图与对比模式保持一致视觉重心。

---

## 全量验证与实测证据

- `npm run prepare:assets && npm test && npm run test:http && npm run build` 全部以退出码 `0` 通过：
  - `validate-places.mjs`：**23 / 23 PASS**；`PLACE_ZH_EDITORIAL` 共 `4,104` 条，`remainingRef6PlusWithoutZh: 0`
  - `validate-polity-display-names.mjs`：**17 / 17 PASS**
  - `validate-startup-overlap.mjs`：**20 / 20 PASS**
  - `validate-map-catalog-app.mjs`：**26 / 26 PASS**
  - `npm run test:http`：**14 / 14 PASS**
  - `npm run build`：`377` 静态文件 / `2,551` Worker 存储分片构建通过
- Headless Chromium 端到端实测（`docs/verification-3.85/final-benchmarks.json`，全部 `14` 次独立冷进程及实时域检查 `consoleErrors: []`，桌面与移动端 `clippedH: false`、`overlaps: []`、`labelOverlaps: []`、`pinOverlaps: []`）：
  - `desktop_1492`：非限速 **`328 ms`**（较 `v3.84` `337 ms` 继续微降），`1.5 Mbps / 150 ms RTT` **`4,017 ms`**，`detailModulesLoaded: false`
  - `south_asia_m250`：非限速 **`221 ms`**，`1.5 Mbps` **`3,805 ms`**
  - `europe_1500_overview_fixes`：地图标签与悬停卡片均为 **`利沃尼亚邦联`**、**`萨伏伊伯国`**，`singleHabsburgLabel: true`，`badArtifacts: []`
  - `warring_states_and_later_zhou_fix`：战国悬停 **`中山国`**、**`东周`**，公元 960 年保留 **`后周`**
  - `ohm_1500_germany_bilingual`：`regionalCount: 14`，`zhCount: 14`

---

## 下一步计划（v3.86.0+）

1. **Wave-21 Pleiades `ref === 5` 全量权威中文补齐（`675` 条，已抽样并提取全量坐标与分期）**，同步补齐瑞士 OHM 湖泊与地方地名（如 `Twann`／`Constance`）。
2. **首屏关键路径再压缩与交互打磨**：继续评估 `land.geojson`／地图冷启并行度，并进一步优化内容页与图面交互细节。
