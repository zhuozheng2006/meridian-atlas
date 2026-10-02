# 独立复核：3.10 制图与读取层改动（task-6）

只读复核。写作用域仅 `docs/verification-3.11/verify-lead-3.10.*` 与 `docs/verification-3.11/shots/verify-lead-*`；未修改 `public/`、`scripts/` 任何文件（`scripts/verification/browser.mjs` 只导入不修改）。

- 工作区：http://127.0.0.1:8767（3.10.0）
- 基线：`git archive 7ee94b4a` 导出到 `/tmp/atlas-baseline-3.9.4`，http://127.0.0.1:9473（3.9.4 交接快照）
- 复核脚本（不在仓库内，避免污染工作区）：`/tmp/verify-lead-3.10/{browser-checks,followup-checks,pixel-checks,pixel-metrics,attested-checks}.mjs`
- 结构化结果：`docs/verification-3.11/verify-lead-3.10.json`

## 结论摘要

| 检查 | 结论 |
| --- | --- |
| a) 图层顺序 / 关闭疆域同步隐藏 halo | **通过** |
| b) 与基线像素对照 | **通过（有口径限制）** |
| c) 有据遗址：时段语义 / 身份 / 阅读器来源 | **通过** |
| c) 有据遗址：地图标记与 placeAtYear 一致 | **不通过（2/4 抽样记录在常规缩放看不到标记）** |
| d) 年份步长默认 10 与 URL 覆盖 | **通过** |
| e) 手机无横向溢出 | **通过** |
| e) safe-area 非零 inset 实测 | **无法判定（本版 Chrome 无 Emulation.setSafeAreaInsets）** |

所有运行的控制台错误/异常：**0**。

## a) 图层顺序

方法：`window.__meridian.instances[0].map.getStyle().layers` 读真实顺序，9 个组合（1500/1700/1900 × overview/regional/halc），相机 `9.32,48.08,6.72,0,0`。

| 年 | 模式 | 层数 | land | relief | terrain-shade | territories | boundary-halo | boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1500 | overview | 14 | 1 | 2 | 3 | 4 | 5 | 9 |
| 1500 | regional | 21 | 1 | 2 | 3 | 4 | 5 | 16 |
| 1500 | halc | 20 | 1 | 2 | 3 | 4 | 5 | 9 |
| 1700 | overview | 14 | 1 | 2 | 3 | 4 | 5 | 9 |
| 1700 | regional | 21 | 1 | 2 | 3 | 4 | 5 | 16 |
| 1700 | halc | 14 | 1 | 2 | 3 | 4 | 5 | 9 |
| 1900 | overview | 14 | 1 | 2 | 3 | 4 | 5 | 9 |
| 1900 | regional | 21 | 1 | 2 | 3 | 4 | 5 | 16 |
| 1900 | halc | 14 | 1 | 2 | 3 | 4 | 5 | 9 |

- `relief`(2) 与 `terrain-shade`(3) 都在 `territories`(4) **之下**、在 `land`(1) 之上；`boundary-halo`(5) 紧贴 `boundary`(9/16) 之前、紧接 `territories` 之后。9 个组合完全一致（regional 模式层数变多是因为详图源插入了自己的图层，不影响上述相对关系）。
- 关闭疆域：`instances[0].toggleBorders(false)` 后 `territories / boundary-halo / boundary / selection / selection-fill` 全部 `none`；再开全部恢复 `visible`；点 UI 的「疆域」按钮结果相同（按钮文案「疆域」）。
- 详图模式不双重描边：`boundaries=regional` 时 `boundary-halo`、`boundary`、`territories` 的 line/fill opacity 均被置 **0**（visibility 仍为 visible），只有详图图层在画；overview 模式恢复为插值表达式（halo 6 级 0.48、boundary 6 级 0.92、territories 7 级 0.3）。

## b) 与基线的像素对照

口径：1600×900、相机 `9.32,48.08,6.72,0,0`、`boundaries=overview`，只统计地图画布矩形 `x 358–1600, y 74–746`（不含侧栏）。在 Node 中解码 PNG 后统计：某颜色阈值内的像素数、每行水平亮度差 >44（弱边缘）/>90（强边缘）的计数、区域均值 RGB、以及两版逐像素差异。截图：`shots/verify-lead-{baseline,workspace}-overview-1500.jpg`、`…-1900.jpg`。

| 场景 | 3.9.4 旧描边色 #655f4f | 深描边近似色 #4b4436 | 强边缘 | 弱边缘 | 区域均色 RGB | 逐像素差异 |
| --- | --- | --- | --- | --- | --- | --- |
| 1500 阿尔卑斯 z6.72 | 40 537 → **19 078** | 18 771 → 11 806 | 5 457 → **6 236** | 30 120 → 23 711 | 169/166/141 → 167/165/140 | **195 962（23.5%）** |
| 1900 同视野 | 37 605 → **17 759** | 15 323 → 5 763 | 7 936 → 7 194 | 34 861 → 25 731 | 168/170/144 → 164/169/143 | **169 239（20.3%）** |

能支持的结论：3.9.4 的中灰描边色在两处都大幅减少（约 −53%/−53%），画面约 1/5 像素改变，1500 场景的**强边缘增加 14%**、弱边缘减少 21%，与"更深的压线 + 浅色光晕"的改动方向一致；1900 场景强边缘略降（−9%），说明该效果与视野内容有关，不是全局恒定增强。
不能支持的结论：这些颜色近似计数受地图标签、HUD、以及**基线副本本身是 3.9.4 内容**（事件/地点更少）污染，因此**不能**用像素差反推填充不透明度或"疆域可见度"的精确变化量；图层顺序的结论应以 (a) 的程序化读取为准。

## c) 有据遗址层

1. **时段语义（Node，全量）**：导入 `public/places.js`，对 12 条记录各取 start−400…end+400 的 51–99 个年份调用 `placeAtYear`，**0 处违规**（期外不返回、期内返回）；`attestedChapter()` 同样只在期内生成，且每条章节的 sources 数与该记录的 sources 数一致（12/12），milestones 为空数组（空里程碑保护生效）。
2. **身份与重复（Node）**：12 条 id 均以 `attested:` 开头，与另外 4 个地点档案共 21 017 条记录**无 id 冲突**（无身份合并）；3 条与既有记录**同名**（Bagan/Ayutthaya/Dholavira），5 条与既有记录相距 <0.02°（Quanzhou、Ayutthaya、Dholavira 等），但 id、档案与对象都保持独立。
3. **地图标记（浏览器抽样）**：相机对准记录、年份取期内/期外：

| 记录 | 期内标记 | 期外标记 | 备注 |
| --- | --- | --- | --- |
| Nan Madol（1200–1500，1400） | ✅ z5/z8 均显示 "Nan Madol" | 无 | |
| Liangzhu（−3300…−2300，−3000） | ✅ 显示 "Liangzhu City" | 无 | |
| Cahokia（800–1400，1000） | ❌ z5、z8 无；**z10 才出现** | 无 | z5/8 只有 "St. Louis · Population · 1000 CE" |
| Quanzhou（960–1368，1200） | ❌ z5、z8、z10 均无 | 无 | 同点显示 "Quanzhou · Population · 1200 CE" |

   原因（代码定位，未改动）：`PlaceLayer.refresh()` 按 `rank` 升序逐个占位并做标签框避让；人口观测的 rank 是 `2 − log10(人口)/10`（约 1.4），而有据遗址是 `3 − 引用数/100`（2.99），因此人口标记先占位，有据遗址标记被判定为重叠而跳过。`placeAtYear` 判定本身正确（见第 1 点）。**结论：时段语义通过，"地图标记与 placeAtYear 一致"在常规缩放下不成立**（抽样 4 条中 2 条不可见）。
4. **重复标记**：在 Nan Madol 视野内可见标记 1 个，无同名重复、无同屏幕坐标重复；4 条抽样视野里也未见两条同名标记同时渲染（重叠避让确实阻止了视觉重复，代价见上）。
5. **阅读器与来源**：点击 Nan Madol 标记打开详情面板，类型标签为「**有据遗址记录**」，标题「南马都尔 Nan Madol」；「来源」标签页列出该记录来源链接 `https://whc.unesco.org/en/list/1503/`（与数据源一致）。截图 `shots/verify-lead-reader-nan-madol.jpg`。

## d) 年份步长

| 链接 | #step 显示 | 按一次 → | 结果 |
| --- | --- | --- | --- |
| `#year=1500`（无 step） | **10** | 1500 → 1510 | 通过；重写后的 hash 仍带 `step=10` |
| `#year=1500&step=1` | 1 | 1500 → 1501 | 通过 |
| `#year=1500&step=50` | 50 | 1500 → 1550 | 通过 |

方法：全新导航后用 `document.querySelector('#step').value` 与 `#yearInput` 值读数，再用 CDP 发一次 `ArrowRight`。

## e) 手机

| 视口 | scrollWidth / innerWidth | 横向溢出 | #timeline bottom / innerHeight | #timeline padding-bottom |
| --- | --- | --- | --- | --- |
| 390×844（DPR2, mobile） | 390 / 390 | 无 | 793 / 844 | 4px |
| 360×740（DPR2, mobile） | 360 / 360 | 无 | 689 / 740 | 4px |
| 1600×900（桌面对照） | — | — | — | 10px |

- `meta viewport` 已含 `viewport-fit=cover`（index.html）；cartography.css 的 safe-area 规则确实在该断点生效：手机宽度下 padding 由 10px 变为 `calc(env(safe-area-inset-bottom) + 4px)`，env()=0 时算得 4px。
- **无法判定**：本机 Chrome（154.0.8037.98）不支持 `Emulation.setSafeAreaInsets`（`-32601 wasn't found`），因此非零刘海/home indicator inset 下 `#timeline` 与视口的关系**没有实测**，只验证了规则结构与零 inset 行为。截图 `shots/verify-lead-mobile-390x844.jpg`、`…-360x740.jpg`。

## 需要 Lead 决定的三点

1. **有据遗址标记优先级**（中）：建议让 attested-site 在标签框竞争中优先于人口观测（例如 rank 提到观测之前，或在同点冲突时保留有据记录），否则 12 条里至少 Quanzhou 在常见缩放下永远不可见；本报告未改代码。
2. **手机 padding 由 10px 变 4px**（低）：safe-area 规则用 `calc(env(...) + 4px)` 覆盖了原有 10px。若本意是"在原有留白之上再加 inset"，可写 `calc(10px + env(safe-area-inset-bottom))`。
3. **`window.__meridian` 常驻**（低）：验证句柄在生产页面同样暴露 map/places 实例；若只想给测试用，可加开关（本报告未改）。

## 复现

```bash
git archive 7ee94b4a | tar -x -C /tmp/atlas-baseline-3.9.4     # 基线副本
(cd /tmp/atlas-baseline-3.9.4 && python3 serve.py --port 9473)  # 基线服务
node /tmp/verify-lead-3.10/browser-checks.mjs  http://127.0.0.1:8767 9474   # a/c/d/e
node /tmp/verify-lead-3.10/followup-checks.mjs                              # 标记竞争/阅读器/halo
node /tmp/verify-lead-3.10/pixel-checks.mjs && node /tmp/verify-lead-3.10/pixel-metrics.mjs  # b
node /tmp/verify-lead-3.10/attested-checks.mjs                              # c 的 Node 部分
```

**环境限制**：复核期间另一成员在跑无头 Chrome 性能测试，页面加载多次超时；b 场景与 12 条记录的完整标记巡测因此各失败/中止一次（脚本含重试，最终 1900 与 1500 两场景均取得有效截图；12 条全量标记巡测中止，改用 4 条抽样 + 代码定位 + Node 全量时段扫描）。
