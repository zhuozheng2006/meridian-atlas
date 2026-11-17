# 经纬纪 · Meridian Atlas — 3.83 交接与验证记录

## 本阶段完成项（v3.83.0）

1. **Wave-18 历史地名全量汉化（Pleiades `ref >= 8` 100% 覆盖，`3,150` 条编辑词条）+ OHM 欧洲区划双语扩展**
   - 在 [`public/places.js`](../public/places.js) 新增全部 335 处 `Pleiades referenceCount === 8` 聚落与 5 处青铜时代黎凡特/塞浦路斯及两河重要站点（共 340 条），编辑词条总数达到 **3,150** 条（全库 `Pleiades ref >= 8` 聚落实现 100% 中文覆盖，`remainingRef8PlusWithoutZh: 0`）。
   - 新增代表地标：**恩科米**（Enkomi）、**阿沙尔奈**（Asharne）、**埃什努纳**（Eshnunna）、**温马**（Umma）、**西帕尔**（Sippar）、**努齐**（Nuzi）、**内沙布尔（沙普尔新城）**（Nishapur）、**比沙普尔**（Bishapur）、**纳伊苏斯（尼什）**（Naissus）、**日内瓦（热那瓦）**（Genava）、**苏黎世（图里库姆）**（Turicum）、**努曼西亚**（Numantia）、**歌罗西**（Colossae）、**塞斯托斯**（Sestos）、**达斯库莱翁**（Daskyleion）、**米吉多（米吉杜）**（Magidû）等；在 [`scripts/validate-places.mjs`](../scripts/validate-places.mjs) 新增 15 条活跃年代断言（`23/23` 通过）。
   - 在 [`public/regional-boundaries.js`](../public/regional-boundaries.js) `AREA_ZH` 增补 31 个中西欧中世纪/近代早期区划实体中文名（如 **列日采邑主教区**、**埃诺伯国**、**那慕尔伯国**、**科隆选侯国**、**布拉班特公国**、**佛兰德伯国**、**荷兰伯国**、**神圣罗马帝国** 等），实测 1500 年低地/中欧详图视图可直接双语呈现。

2. **3D 地球与移动端事件图钉智能疏密与球缘裁剪（[`public/map-engine.js`](../public/map-engine.js)）**
   - 在 `AtlasMap` 新增 `refreshEventMarkers()` 并接入 `setEvents()` 与 `refreshLabels()`：在 3D 球面缩放 `< 4.5` 时裁剪靠近地球边缘的图钉（`dot < 0.16`），避让顶部标题卡/工具条/图例等浮层区域，并按“当前选中 → 精选事件 → 索引事件”优先级施加屏幕最小间距约束（低缩放最高 `26px`，放大后逐步展开至全量显示），同步消除隐藏图钉对政体/城市标签放置造成的无效碰撞阻挡。
   - 实机验证：`desktop_1492` 从 `52` 个原始事件点疏密整理为 `19` 个无重叠可见图钉（最小间距 `31.6 px`）；`mobile_390_1492` 从 `52` 个整理为 `16` 个均匀分布图钉（最小间距 `29.1 px`），彻底解决此前欧洲与西非圆点重叠遮挡地图及球缘溢出现象。

3. **详情图层真按需启动与 `research-reader.css` 冗余清理**
   - [`public/map-engine.js`](../public/map-engine.js) `startGeography()` 仅在 `zoom >= 4.5` 或处于显式 `regional` / `halc` 等非概览模式时预先拉取详图模块；默认全局概览路由（`desktop_1492`、`south_asia_m250`、`europe_1914_cshapes`、`mobile_390_1492`）首屏冷启动实测 `detailModulesLoaded: false`，总请求数由 `74` 降至 `58`（`desktop_1492`），而详图路由 `china_742_regional`（`detailModulesLoaded: true`）保持自动秒开。
   - 清理 [`public/research-reader.css`](../public/research-reader.css) 与 `@container(max-width:700px)` 完全重复的 `@media(max-width:700px)` 规则。

4. **黑曜青铜制图主题视觉精修（[`public/product.css`](../public/product.css) · [`public/cartography.css`](../public/cartography.css) · [`public/map-engine.js`](../public/map-engine.js)）**
   - 精修地球大气层与深海配色（`horizon-color: #567e96`、`ocean: #081d2f`）、桌面端浮层胶囊图例（`border-radius: 999px`）与高光铜边标题/工具卡。
   - 将左侧边栏 `.event-card` 升级为带微立体间隔的卡片单元；在双语阅读抽屉为 `.reader-content p.secondary` 增加细铜色左引导线并强化层次；重构时间轴滑块铜质罗盘旋钮与轨道质感；修复移动端 `390px` 详情抽屉多页签右侧（“来源”）硬截断问题（渐隐遮罩 + 右侧留白）。

## 验证与基准实测（`docs/verification-3.83/final-benchmarks.json`）

- **全量校验、HTTP 与构建**：`npm run prepare:assets && npm test && npm run test:http && npm run build` 全部通过（exit code `0`；`23/23` 地名校验、`15/15` HALC 缓存检查、`26/26` 地图应用校验、`14/14` HTTP 检查；生产包 `377` 静态资源 / `2,551` 存储文件）。
- **隔离冷启动性能（14 组无缓存 Chromium 进程）**：
  - `desktop_1492`：非限速首交互 **`386 ms`**（`domInteractiveMs: 13 ms`、`resourceCount: 58`、`detailModulesLoaded: false`）；1.5 Mbps / 150ms RTT 限速首交互 **`3,986 ms`**（`647,750 B`、`34` 个请求）。
  - `south_asia_m250`：非限速 **`249 ms`** / 限速 **`3,779 ms`**；`china_742_regional`：非限速 **`287 ms`** / 限速 **`5,574 ms`**（`detailModulesLoaded: true`、`地区详图 · 51 条区划`）；`mobile_390_1492`：非限速 **`332 ms`** / 限速 **`4,001 ms`**。
  - Multi-viewport：`laptop_1280_compare` (`293 ms`)、`tablet_834_1492` (`319 ms`, `eraButtonsClipped: false`, `toolsHeight: 44`)、`tablet_834_compare` (`337 ms`)、`mobile_390_compare` (`319 ms`) 均实现 `overlaps: []`、`labelOverlaps: []`、`pinOverlaps: []`、`clippedH: false`、`consoleErrors: []`。
- **实机视觉与域回归检查**：
  - `wave18_ref8_completion`：`editorialCount: 3150`、`remainingRef8PlusWithoutZh: 0`。
  - `ohm_1500_europe_bilingual`（`scratch/v383-audit/ohm-1500-zh-after.png`）：实机呈现 `列日采邑主教区`、`埃诺伯国`、`科隆选侯国`、`那慕尔伯国`。
  - `desktop-1492-after.png`、`mobile-390-after.png`、`mobile-390-dossier-after.png` 视觉抽检通过，事件图钉疏密、手机端标签页遮罩与卡片排版改善明显。
  - `cshapes_dated_hover_cards`（1914 俄罗斯帝国 / 1945 苏联）、`research_zero_map_assets_and_parchment`（羊皮纸 `rgb(255, 252, 244)` / `61,216` 字符）、`east_asia_1000ce_song_and_kaifeng` 与 `polities_dossier_and_export_btn`（`eventsTabRenderMs: 1.3 ms`、`hasExportBtn: true`）全部通过。

## 后续计划（v3.84.0）

- **Wave-19 历史地名汉化（Pleiades `ref === 7` 全量 415 处聚落 -> `ref >= 7` 100% 覆盖）**：包括吉尔苏（Girsu）、伊辛（Isin）、基什（Kish）、库塔（Cutha）、亚兹德（Yazd）、拉吉（Lachish）、迦克墩（Chalcedon）、代尔麦地那工匠村（Deir el-Medina）、阿拉贾胡尤克（Alaca Höyük）、恰高·赞比尔（Tchogha Zanbil）、布罗德加角（Ness of Brodgar）、锡拉古城（Thera）、斯帕拉图姆（Spalatum）等。
- **持续性能与界面优化**：进一步评估事件密度直方图与侧栏筛选交互质感、以及更多地区疆域/历史事件视图打磨。
