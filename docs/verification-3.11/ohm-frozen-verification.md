# 固化 OHM 快照扩展到 10 个年份：数据与验证

> **后续更新（task-13，3.13）**：冻结数据现在是两个窗口（中欧 + 东亚，24 个窗口×年份快照）。中欧在 task-13 里从缓存重放了一次，**几何逐字节不变**，但每年文件因新增 `window` 元数据而换了 gzip sha256（例如 1500 年由 `73b705c067da28e0…` 变为 `9feec7f4a12dffa2…`）。当前数据、覆盖矩阵与多窗口接入见
> [docs/verification-3.13/ohm-eastasia.md](../verification-3.13/ohm-eastasia.md) 与 [ohm-frozen-coverage.md](../verification-3.13/ohm-frozen-coverage.md)。
> 本文的验证方法与诚实口径仍然有效，哈希表以 manifest.json 为准。

承接 task-1（1492/1500）。本轮把同一窗口中欧窗口（bbox 4.5/44/14.5/50.5，行政 2–4 级）的固化 OpenHistoricalMap 快照扩到 **1000、1200、1300、1400、1492、1500、1600、1700、1800、1900** 共 10 个年份。
覆盖矩阵与"哪些年份值得切详图"的结论见 [ohm-frozen-coverage.md](ohm-frozen-coverage.md)。

## 1. 数据清单

来源：OpenHistoricalMap Overpass `https://overpass-api.openhistoricalmap.org/api/interpreter`，快照 `2026-10-02T19:22:25Z`，许可 CC0 1.0（见 `public/data/ohm-1500/NOTICE.md`）。原始响应 sha256：tags `10ca55038666b5ba…`、geometry `b6914aa804fe38c1…`（`manifest.json.queries`）。

| 年份 | 记录 | L2/L3/L4 | 顶点 | gz 体积 | gzip sha256(前12) | 陆地采样覆盖 | 判定 | 源残缺未绘制 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1000 | 21 | 6/1/14 | 116 764 | 0.84 MB | `79b6ed87db8e` | 94.9% | good | 2 |
| 1200 | 34 | 4/3/27 | 61 190 | 0.47 MB | `37e3099d14f4` | 98.5% | good | 0 |
| 1300 | 71 | 3/5/63 | 104 374 | 0.80 MB | `8d64536cab85` | 32.5% | partial | 1 |
| 1400 | 81 | 2/3/76 | 124 008 | 0.96 MB | `0fc120c9ac66` | 35.3% | partial | 0 |
| 1492 | 91 | 2/3/86 | 136 049 | 1.07 MB | `2fededb80ef5` | 41.9% | partial | 0 |
| 1500 | 98 | 2/8/88 | 202 009 | 1.56 MB | `73b705c067da` | 53.0% | good | 0 |
| 1600 | 114 | 2/11/101 | 400 475 | 3.03 MB | `f0223103c6ad` | 71.1% | good | 0 |
| 1700 | 118 | 22/11/85 | 659 487 | 4.90 MB | `26da39152017` | 99.6% | good | 0 |
| 1800 | 80 | 10/8/62 | 550 304 | 4.09 MB | `16729afedf6f` | 94.3% | good | 0 |
| 1900 | 59 | 8/3/48 | 1 068 371 | 7.83 MB | `f8ace2b851da` | 100.0% | good | 0 |

合计 767 条（relation×年份）、25.54 MB gzip、333 个不同 relation。构建方式与 task-1 相同：成员 way 按原顺序串环、坐标零改动、无简化/量化/取整/布尔修补，孔洞与多面保留；面积仍为球面地面面积。缓存重放（不加 `--fetch`）字节一致，`generated` 时间戳在重放时保持不变。

## 2. 每年内容抽样（面积最大的几条）

| 年份 | 主要记录 |
| --- | --- |
| 1000 | Holy Roman Empire、Kingdom of France、Kingdom of Burgundy、Duchy of Bavaria、Duchy of Franconia、Duchy of Swabia |
| 1200 | Holy Roman Empire、Kingdom of Hungary、Kingdom of Burgundy、Duchy of Swabia |
| 1300 | Kingdom of Hungary、Kingdom of Burgundy、Papal States、Republic of Genoa、County of Champagne |
| 1400 | Papal States、Duchy of Milan、Savoyard state、Duchy of Austria、Republic of Venice |
| 1600 | Lands of the Bohemian Crown、Upper Saxon Circle、Austrian Circle、Republic of Venice、Bohemia |
| 1700 | Holy Roman Empire、Kingdom of France、Lands of the Bohemian Crown、Upper Saxon Circle、Austrian Circle |
| 1800 | French Republic、Holy Roman Empire、Kingdom of Prussia、Austrian Circle、Upper Saxon Circle |
| 1900 | French Republic、Austria-Hungary、German Reich、Kingdom of Prussia、Italy、Cisleithania |

## 3. 运行时的年份策略

- 固化年份列表集中在 `public/regional-boundaries.js` 的 `OHM_YEARS`（10 年）；只有该年 + 视野进入窗口时才加载对应 `year-<年>.json.gz`，窗口外年份、其它年份一律走在线瓦片，不用邻近年份顶替。
- **覆盖判定进入年份选择**：每年的 `metadata.coverage` 带 24×24 陆地采样比值与 `good/partial/sparse` 判定（阈值 ≥45% good、≥12% partial，记录 <8 一律 sparse）。自动模式下 `sparse` 年份不会被详图接管（保留全球概览），徽标显示"该年固化详图偏少 · N 条"；`partial` 年份沿用原有诚实口径（"局部详图 · N 条 · 空白处未收录"）；用户显式选择"地区详图"时仍如实展示已有记录。
- 档案目录的说明文字按年给出"OHM 固化详图（<年> 年 · N 条 · 陆地采样覆盖 P%）与在线瓦片合并显示；两来源都没有记录的地方留白"，并对 sparse 年份补一句"覆盖不足，自动模式仍用概览"。
- "未收录"折叠区按年呈现：探针改为**带年代区间**的 15 个政体（神圣罗马帝国 962–1806、施瓦本公国 922–1268、勃艮第王国 933–1378、萨克森公国 804–1296、旧瑞士联邦 1291–1798、巴伐利亚 900–1806、符腾堡 1083–1806、巴登 1112–1803、哈布斯堡奥地利 1278–1867、蒂罗尔 1140–1918、威尼斯 697–1797、米兰 1395–1797、德意志帝国 1871–1918、奥匈帝国 1867–1918、瑞士联邦 1848– ），只在与该年相关时才评估；同名的"帝国圈"等不同实体单列为 `excludedMatches`，在弹窗里写成"同年来源另有 Austrian Circle，属不同实体"而不是含糊的"未收录"。
- 修正一处旧行为：记录面积行现在只对固化记录显示（球面地面面积）；瓦片记录的 `area` 疑似 Web-Mercator 投影面积，两个口径不再混用。

## 4. 验证

### 4.1 指定校验

```
node scripts/validate-regional.mjs              → {"status":"passed","checks":15}
node scripts/validate-regional-continuity.mjs   → 24/24 regional continuity checks passed
node scripts/validate-halc-continuity.mjs       → 24/24 HALC continuity checks passed
node scripts/ohm/verify-ohm-1500.mjs            → passed 39 / failed 0
```

### 4.2 verify 脚本的关键证据（39 项）

- **3 423 031 个坐标全部在 Overpass 原始响应中逐位命中**（10 个年份合计，0 个被移动/取整/新增）。
- 每份文件 gzip 与解码 sha256 与 manifest 一致；十进日期仍与 OHM 瓦片值一致（1480.00137 / 1661.16027）。
- 每要素闭合、落在窗口内（允许跨出，最多 25.02°：1900 年的法国含海外/殖民几何）、面积为正、在自身年份可见。
- **跨年零泄漏**：某年独有的 relation 在其它年份的可见性断言下全部为 0 条——不存在"借用邻年几何"。
- 孔洞全部包含在所属外环内（10 年合计 3 005 个孔、8 542 个环）。
- 瓦片过滤精确排除 333 个固化 relation id；空排除表时过滤条件逐字节不变。
- 3 条源数据自身无法闭合成环的 relation（Neder-Lotharingen 1000、Ducatus Bohemiæ 1000、Dominium Mediolani 1300）**未被绘制**，且逐年在 `metadata.undrawable` 中列出。
- 每年 coverage 判定与采样数据自洽（脚本用文档化阈值重算并比对）。

### 4.3 真实浏览器前后对照

脚本：`node scripts/ohm/browser-check-ohm-1500.mjs --label after --base http://127.0.0.1:8767 --years 1000,1500,1700 --control 1750 --compare before --port 9445`
"前"用本轮改动前的提交版本（`git show HEAD:public/regional-boundaries.js`）在同一相机（`9.32,48.08,6.72,0,0`，1600×900，Chrome 无头 + SwiftShader）下拍摄；"后"为本轮实现。截图见 `docs/verification-3.11/shots/ohm-frozen-{before,after}-{1000,1500,1700}.jpg`。

| 场景 | 徽标（后） | 铁锈色描边像素 前→后 | 瓦片描边色像素 前→后 | 地图画布变化像素 | ohm-1500 请求 |
| --- | --- | --- | --- | --- | --- |
| year=1000 regional | 地区详图 · 13 条区划 | **0 → 6 566** | 7 529 → 1 907 | 565 917（67.8%） | 1（200） |
| year=1500 regional | 局部详图 · 61 条 · 空白处未收录 | 20 964 → 20 964 | 14 201 → 14 201 | **0** | 1（200） |
| year=1700 regional | 地区详图 · 75 条区划 | **52 → 32 405** | 18 416 → 9 262 | 315 368（37.8%） | 1（200） |
| year=1000 auto | 地区详图 · 13 条区划 | **0 → 6 566** | 7 529 → 1 907 | 565 917（67.8%） | 1（200） |
| year=1750 regional（对照，非固化年） | 地区详图 · 79 条区划 | 60 → 60 | 19 237 → 19 237 | **0** | **0** |

- 1500 年两次拍摄逐像素相同（0 变化）→ 扩展没有扰动已有年份；1750 年对照同样 0 变化且不请求固化数据。
- 瓦片描边像素在 1000（7 529→1 907）与 1700（18 416→9 262）显著下降，正是"已固化的 relation 从瓦片过滤中剔除"的直接像素证据：同一条边界不会被画两遍。
- 真实点击：1000 年点中 **Duchy of Franconia（0939-10-02 – 1168，64 785 km²，球面面积）**；1500 年点中罗斯海姆帝国自由市（1303 – 1679-02-05，31 km²，relation/2831336）——弹窗里的面积行只可能来自固化记录。
- 浏览器控制台错误/异常：**0**。全部场景首次即通过健康检查（attempts=1），无重试。

## 5. 已知边界与未解决问题

1. **窗口与级别**：只覆盖 bbox 4.5/44/14.5/50.5、行政 2–4 级；窗口外与 5–6 级（z≥8 的县乡）仍依赖在线瓦片。
2. **年份**：只有这 10 年有固化数据；其它年份没有，也不做邻近年份回退。
3. **体积**：`public/data/ohm-1500/` 现在 25.5 MB（1900 年单文件 7.8 MB gzip / 107 万顶点，因为 1900 年边界本身细）。运行时按年加载，但 1900 年是明显的一次性下载成本；若要压小，只能改成分级/分片文件（会改变加载路径），本轮未做。
4. **源数据残缺**：3 条 relation 无法闭合成环，如实列为"未绘制"而不是补画；另有 16 条（relation×年、涉及 12 个 relation）只闭合成部分环，以虚线圈、无填充、不进标签的方式呈现。
5. **覆盖不等同于正确**：1000/1200 年记录数少但都是帝国级大面，陆地采样覆盖最高；这与"Cliopatria 当年政体中心点被覆盖"的结论一致（1000/1200 各 4/4）。反之 1300/1400/1492 只有 32–42%，属于 partial。
6. 详情目录里的名称匹配只是参考（Cliopatria 与 OHM 古今异名），因此矩阵同时给出"中心点被覆盖"这一几何指标。
