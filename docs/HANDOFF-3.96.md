# 交接与验证记录 · v3.96.0

- **版本**: `3.96.0`
- **日期**: 2026-11-18
- **主工作区**: `/Users/zane/Documents/ChatGPT/MeridianAtlas`

## 本轮核心推进

1. **全球天然湖泊简体中文地名库大规模扩充至 375 席（[`public/lakes.js`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/lakes.js)）**：
   - 在保持既定 `public/data/lakes/index.json.gz`（1,115 条实证名称索引与 24 条内建条目）完全只读不变的前提下，于 [`public/lakes.js`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/lakes.js) 将前端运行期映射表 `LAKE_ZH` 由 `144` 条无重扩充至 **`375`** 条（新增 **`231`** 个去重校验湖泊译名）。
   - 系统补全中国（如 `Dongting 洞庭湖`、`Chao 巢湖`、`Dian Chi 滇池`、`Fuxian 抚仙湖`、`Erh 洱海`、`Yangcheng 阳澄湖`、`Luoma 骆马湖`、`Hong 洪湖`、`Liangzi 梁子湖`、`Jili 吉力湖`、`Manas 玛纳斯湖`）、青藏高原（`Yamdrok 羊卓雍措`、`Hoh Xil 可可西里湖`、`Lixi'Oidain 勒斜武担湖`、`Lumajangdong 鲁玛江东错`）以及欧亚、土耳其、非洲、大洋洲与北美主要名湖。
   - 新增统一导出辅助函数 [`lakeZh()`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/lakes.js#L123)，并在 [`scripts/validate-lakes.mjs`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/scripts/validate-lakes.mjs) 中增加中亚/青藏及国际主要湖泊覆盖单元测试断言。
2. **典藏级暗金画框高清地图导出排版（[`public/app.js`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/app.js)）**：
   - 升级 [`exportMapImage()`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/app.js#L369-L396)：导出 PNG 不再输出裸画布，而是装裱为深海曜石黑底衬与香槟金双框典藏版画（Museum Print Plate），自动合成当期**年份 · 时代 · 激活政权/事件/地点主题标题**、底图与文献来源署名，并在右下角渲染金色徽章 **`◎ 经纬纪 · MERIDIAN ATLAS`**（支持中英双语导出）。

## 验证结果

- **离线构建与全套测试**（`npm run prepare:assets && npm test && npm run test:http && npm run build` 退出码 `0`）：
  - `validate-lakes.mjs`: **18/18 PASS**（含中亚、青藏及国际主要湖泊覆核单元测试）；`validate-lake-readiness.mjs`: **16/16 PASS**
  - `validate-places.mjs`: **23/23 PASS**；`validate-city-time.mjs`: **22/22 PASS**
  - `validate-china-prefectures.mjs`: `420` 源行 / `1,329` 分片实例全通；`validate-early-asia.mjs`: `nameReviews: 369` / `deferredDocumented: 51` / `unauditedNames: 0` PASS
  - `validate-startup-overlap.mjs`: **20/20 PASS**；`validate-map-catalog-app.mjs`: **26/26 PASS**；`validate-map-catalog.mjs`: **5,424** 年全检验通过
  - `validate-polaris-worker.mjs`: **19/19 PASS**；`test:http`: **14/14 PASS**
  - `build-worker.mjs`: `staticStorageFiles: 377` / `storageFiles: 2551`
- **Chromium 实测（[`docs/verification-3.96/final-benchmarks.json`](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/docs/verification-3.96/final-benchmarks.json)）**：
  - 全局 `consoleErrors: []`，所有视口 `overlaps: []`、`labelOverlaps: []`、`pinOverlaps: []`、`clippedH: false`。
  - 未限速冷启动 `mapInteractiveMs`：`desktop_1492` **`511 ms`**、`south_asia_m250` **`315 ms`**、`china_742_regional` **`374 ms`**、`europe_1914_cshapes` **`704 ms`**、`mobile_390_1492` **`439 ms`**。
  - `1.5 Mbps / 150 ms RTT` 限速冷启动 `mapInteractiveMs`：`desktop_1492` **`4,122 ms`**（34 个资源，`659,435` 字节）、`south_asia_m250` **`3,821 ms`**、`china_742_regional` **`5,630 ms`**、`europe_1914_cshapes` **`6,203 ms`**、`mobile_390_1492` **`4,117 ms`**。
  - 实时域与视觉核查：`dongting: "洞庭湖"`、`chao: "巢湖"`、`dianChi: "滇池"`、`yamdrok: "羊卓雍措"`、`hohXil: "可可西里湖"`、`yangcheng: "阳澄湖"`、`taupo: "陶波湖"`、`tahoe: "太浩湖"`、`beysehir: "贝伊谢希尔湖"`；典藏版画导出生成实测 PNG（`exportedPngGenerated: true`，`exportedByteLength: 3,264,467` 字节）经目视核查版式居中利落；研究页零地图静态资源加载（`maplibreCssLoaded: false`、`maplibreJsLoaded: false`、`originalBodyBg: "rgb(255, 252, 244)"`、`originalTextLen: 61216`）。

## 后续规划（v3.97.0+）

- 继续推进剩余全球 740 处 HydroLAKES 湖泊地名中文化（第二波全面覆盖欧亚、非洲与大洋洲剩余湖泊并推进美洲高纬湖区），开展纯英文模式（`#lang=en`）、资料来源总账与时间轴回放体验的精细审校。
