# 经纬纪 · 4.14 交付与验证记录

版本 `4.14.0` 聚焦**战役地理分区纠偏、出版级带标注地图导出、桌面／平板双年份对照阅读防遮挡排版、政体结构化事实双语补全，以及地区区划弹窗统一 `Esc` 清空**，并在真实无头 Chrome 中完成全场景目视与断言验收。

## 核心改动

### 1. 数据完整性与准确性（零篡改原始归档）
- **60 场战役地理分区派生纠偏**（[battles.js](../public/battles.js) `battleRegion()`、[app.js](../public/app.js) `openBattle()`）：
  - 在不改动只读原始档案 `data/battles.json.gz` 的前提下，新增派生归类函数 `battleRegion(b)`，纠正上游粗粒度矩形经纬度包围盒造成的 **60 条**跨洲误标：
    - 36 场被误标为 `africa`（非洲）的西亚战役回归 `west-central-asia`（西亚与中亚），涵盖卡迭石战役、巴比伦陷落、泰西封战役、白德尔战役、吴侯德战役、纳哈万德战役、巴格达围城战、萨拉米斯海战（塞浦路斯）等；
    - 4 场被误标为 `europe`（欧洲）的突尼斯／北非战役回归 `africa`（非洲）；
    - 20 场被误标为 `europe`（欧洲）的小亚细亚／叙利亚北部战役回归 `west-central-asia`（西亚与中亚），同时严格保留色雷斯／欧洲海峡一侧战役归属 `europe`。
- **政体档案结构化事实中文化补全**（[polity-reader.js](../public/polity-reader.js) `FACT_ZH_FIX`）：
  - 针对 Wikidata 档案中 26 项高频未翻译的政体类型、宗教、货币、首都与官方语言取值（如 `absolute monarchy`、`hereditary monarchy`、`chiefdom`、`tribe`、`city-state`、`Sunni Islam`、`Shia Islam`、`Eastern Orthodoxy`、`tengrism`、`denarius`、`dirham` 等）增加派生中文显示映射，并对缺失译名的政体／实体取值自动回退至 `displayPolityZh()`。

### 2. 出版级地图导出：合图政体／区划／湖泊标注与双图角标
- **DOM 制图标注精准合图**（[app.js](../public/app.js) `drawExportLabels()`、`captureMapCanvas()`）：
  - 导出 PNG 时按设备像素比（DPR）精准读取并重绘画面中可见的政体名称（`.polity-label`）、汉唐／CHGIS／OHM／HALC 地区区划名（`.regional-label`）与湖泊名称（`.lake-label`），附带与实景地图一致的羊皮纸／深海光晕与双语副标，彻底解决 WebGL 纯画布导出缺失国名与郡县名的问题。
  - 年份对照模式（`compare=1`）导出时，在左右双图左上角自动压印黑曜石×黄铜风格年份铭牌（如 `公元 1492 年`、`公元 1914 年`）。
- **区域研究详图来源署名精确识别**（[app.js](../public/app.js) `exportSourceCredit()`）：
  - 改用 `RegionalBoundaries` 权威运行状态标志（`chinaResearchActive`、`chgisActive`、`awmcActive`）识别实际生效详图，确保盛唐 742 年等汉唐区划导出精确署名 `汉唐历史区划 · Zheng & Wu (2026)（CC BY 4.0）`，CHGIS 与 AWMC 亦各归其真实来源与许可。

### 3. 界面排版、阅读器一致性与键盘交互精修
- **修复桌面与平板「年份对照 + 详情抽屉」叠加碰撞**（[cartography.css](../public/cartography.css)）：
  - 桌面端 `.reading .comparing` 下隐藏易换行的 `.compare-era` 并保持 `.compare-heading` 单行居顶（位于 `.map-tools` 之上零重叠），同时收窄 `.map-legend` 最大宽度（`calc(50% - 76px)`）加省略号截断，杜绝与左图缩放控件 `+ / −` 碰撞。
  - 平板端（`761–1240px`）`.reading .comparing` 下精简对比年份栏标签与差值徽章、收紧输入框至 `60px` 并收起工具栏次要按钮，彻底消除右图顶栏截断及工具栏越过中轴分割线的问题。
- **战役与暴行阅读器统一体验**（[app.js](../public/app.js) `openBattle()`、`openAtrocity()`）：
  - 补齐 `bi` 双语模式下的英文导言对照段落，并新增统一 `.reader-footer` 底部信息栏与「分享此页 / Share page」快捷按钮。
- **地区区划索引框 `Esc` 清空保护**（[regional-boundaries.js](../public/regional-boundaries.js) `openIndex()`）：
  - 在 HALC / OHM / 汉唐 / CHGIS 区域索引弹窗内的 `.regional-search` 搜索框中按 `Esc` 优先清空已输入检索词并阻止冒泡，不再误关闭整个弹窗。

## 验证结果

- `npm run prepare:assets`：通过（资产指纹版本 `4.14.0-4bd34ba75977`）。
- `npm test`：全部 100+ 单元、契约与数据完整性校验通过（退出码 `0`）。
- `npm run test:http`：`14/14 local HTTP checks passed`。
- `npm run build`：`dist/server/index.js` 与 `dist/client` 构建通过。
- 无头 Chrome 端到端与目视截图验收（零控制台错误）：
  - 桌面（`1440×900`）与平板（`1024×1180`）双年份对照 + 阅读抽屉边界盒检测零重叠、零越界；
  - 导出双图对照 PNG（含左右年份角标与全部政体标注）与盛唐公元 742 年关中郡县图 PNG（含双语郡县标注及 `汉唐历史区划 · Zheng & Wu (2026)（CC BY 4.0）` 准确署名）均目视验收通过；
  - 卡迭石战役详情正确显示 `西亚与中亚` 分区、双语导言与底部「分享此页」按钮；
  - HALC 区域索引 `.regional-search` 按 `Esc` 仅清空输入且弹窗保持打开。
