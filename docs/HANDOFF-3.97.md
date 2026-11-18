# 交接与验证记录 · v3.97.0

- **版本**: `3.97.0`
- **日期**: 2026-11-18
- **主工作区**: `/Users/zane/Documents/ChatGPT/MeridianAtlas`

## 本轮核心推进

1. **全球 HydroLAKES 简体中文名录第二波扩充至 728/1,115 与重名 ID 精准消歧（[`public/lakes.js`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/lakes.js)）**：
   - 新增基于原始 `HydroLAKES id` 的消歧映射表 `LAKE_ID_ZH`：将此前仅凭英文同名会被误判的多处全球独立湖泊彻底分开——内蒙古 **`岱海`**（`id: 14520`）与江苏 **`太湖`**（`id: 148`）、蒙古西北 **`乌列格湖`**（`1218`）与巴彦洪戈尔 **`奥罗格湖`**（`1288`）、科布多 **`哈尔乌苏湖`**（`1236`）与扎布汗 **`哈尔湖`**（`13937/13943`）、澳大利亚 **`凯里盐湖`**（`1670`）与加拿大 **`凯里湖`**（`345`）、加拿大维多利亚岛 **`塔霍湖`**（`200`）与美国 **`太浩湖`**（`792`）。
   - `LAKE_ZH` 无重扩充至 **`691`** 条（结合内建词条与 ID 映射累计覆盖 **`728/1,115`** 处实证湖泊）：全面完成**欧洲（含黑海沿岸潟湖、希腊与北欧诸湖）、西伯利亚与中亚、青藏高原（`纳乌错`、`洞错`、`恰规错`、`木纠错`、`姆错丙尼`、`兹格塘错`、`错那湖`、`泽错`、`莫里里湖`等）、非洲全境、大洋洲（含巴新、印尼与澳大利亚盐湖）、中南美洲全境（`乌尤尼盐沼`、`科伊帕萨盐沼`、`纳韦尔瓦皮湖`、`阿蒂特兰湖`等）及阿拉斯加主要名湖**，并在 [`scripts/validate-lakes.mjs`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/scripts/validate-lakes.mjs) 补充 ID 消歧与亚欧拉美名湖断言。
2. **纯英文模式（`#lang=en`）零中文残留与专题/年表 URL 别名路由（[`public/app.js`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/app.js)）**：
   - 修复 [`renderLanguage()`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/app.js#L63-L75) 中未随语言切换同步更新的左上角品牌铭牌、时间轴 `YEAR` 标签及页面 `<title>`：在 `#lang=en` 下界面 **100% 纯英文化**（`enCjkLeaks: []`，显示 `Meridian Atlas · WORLD HISTORY ATLAS` 与 `YEAR`），`#lang=zh` 下主副标题为 `经纬纪 · 世界历史地图` 与 `年份`。
   - 为导航栏 `专题 Journeys` 与 `年表 Chronicle` 补充 `#view=journeys` 与 `#view=chronicle` 哈希路由别名，直接直达对应视图。
3. **图层控制浮窗视效与触发态打磨（[`public/cartography.css`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/cartography.css)）**：
   - 为开启中的 `#layersBtn[aria-expanded="true"]` 增加鎏金激活态；放大桌面端 `.layer-panel` 最大高度（`min(640px, calc(100% - 76px))`）并移除 `.layer-options` 底部强渐隐遮罩，消除顶部可视控件文字边缘的发虚现象。

## 验证结果

- **离线构建与全套测试**（`npm run prepare:assets && npm test && npm run test:http && npm run build` 退出码 `0`）：
  - `validate-lakes.mjs`: **18/18 PASS**；`validate-lake-readiness.mjs`: **16/16 PASS**
  - `validate-places.mjs`: **23/23 PASS**；`validate-city-time.mjs`: **22/22 PASS**
  - `validate-china-prefectures.mjs`: `420` 源行 PASS；`validate-early-asia.mjs`: `unauditedNames: 0` PASS
  - `validate-polity-display-names.mjs`: **17/17 PASS**；`validate-regional-continuity.mjs`: **26/26 PASS**
  - `validate-startup-overlap.mjs`: **20/20 PASS**；`validate-map-catalog-app.mjs`: **26/26 PASS**；`validate-polaris-pagination.mjs`: **18/18 PASS**
  - `test:http`: **14/14 PASS**；`build-worker.mjs`: `staticStorageFiles: 377` / `storageFiles: 2551`
- **Chromium 实测（[`docs/verification-3.97/final-benchmarks.json`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/docs/verification-3.97/final-benchmarks.json)）**：
  - 全局 `consoleErrors: []`，所有视口 `overlaps: []`、`labelOverlaps: []`、`pinOverlaps: []`、`clippedH: false`。
  - 未限速冷启动 `mapInteractiveMs`：`desktop_1492` **`466 ms`**、`south_asia_m250` **`297 ms`**、`china_742_regional` **`397 ms`**、`europe_1914_cshapes` **`680 ms`**、`mobile_390_1492` **`421 ms`**。
  - `1.5 Mbps / 150 ms RTT` 限速冷启动 `mapInteractiveMs`：`desktop_1492` **`4,114 ms`**（33 个资源，`649,600` 字节）、`south_asia_m250` **`3,822 ms`**、`china_742_regional` **`5,652 ms`**、`europe_1914_cshapes` **`6,202 ms`**、`mobile_390_1492` **`4,123 ms`**。
  - 实时域与视觉核查：`enCjkLeaks: []`、`title: "Meridian Atlas · World History Atlas"`、`layersBtnExpanded: "true"`；`#view=journeys` 路由直达 12 主题卡片；湖泊消歧与第 2 批词库检验全部通过（`taiDaihai: "岱海"`、`taiTaihu: "太湖"`、`orogUreg: "乌列格湖"`、`orogBayan: "奥罗格湖"`、`harKharUs: "哈尔乌苏湖"`、`uyuni: "乌尤尼盐沼"`、`nahuel: "纳韦尔瓦皮湖"`、`natron: "纳特龙湖"`、`dongCo: "洞错"`、`nauCo: "纳乌错"`、`mokoyu: "木纠错"`、`mutso: "姆错丙尼"`）；研究页零地图静态资源加载（`maplibreCssLoaded: false`、`maplibreJsLoaded: false`、`originalBodyBg: "rgb(255, 252, 244)"`、`originalTextLen: 61216`）。

## 后续规划（v3.98.0+）

- 完成剩余 `385` 处北美与北极加拿大 HydroLAKES 湖泊地名中文化，冲刺 **~100% 全球湖泊地名简体覆盖**；同步规范现代参照城市（`modern-cities`）中的台湾习惯译名并在交互弹窗、时间轴对比控件等高频场景继续视觉与性能精修。
