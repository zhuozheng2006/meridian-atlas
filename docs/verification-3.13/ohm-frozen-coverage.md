# 固化 OHM 快照的覆盖矩阵（中欧 + 东亚）

生成时间 2026-10-02T21:56:48.016Z；脚本 `node scripts/ohm/coverage-matrix.mjs --markdown docs/verification-3.13/ohm-frozen-coverage.md`（可复现）。

Land-sample coverage comes from each year file (24x24 grid over the window, holes excluded). Cliopatria comparison uses catalog POLITY records active that year whose centre falls inside the window; "centre covered" tests that centre against the year polygons; name matching only strips titles and common words.

## 窗口 Central Europe（中欧） bbox 4.5/44/14.5/50.5 · 快照 2026-10-02T19:22:25Z

| 年份 | 记录 | L2/L3/L4 | 顶点 | gz | 陆地采样覆盖 | 判定 | 未绘制 | Cliopatria 窗口内 | 中心点被覆盖 | 名称匹配 | 来源未收录(探针) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1000 | 21 | 6/1/14 | 116764 | 0.84 MB | 94.9% | good | 2 | 4 | 4 | 2 | Duchy of Saxony |
| 1200 | 34 | 4/3/27 | 61190 | 0.47 MB | 98.5% | good | 0 | 4 | 4 | 2 | Duchy of Saxony、Bavaria (duchy or electorate)、Württemberg、Margraviate of Baden、County of Tyrol |
| 1300 | 71 | 3/5/63 | 104374 | 0.80 MB | 32.5% | partial | 1 | 13 | 5 | 1 | Holy Roman Empire、Old Swiss Confederacy、Bavaria (duchy or electorate)、Württemberg、Margraviate of Baden、County of Tyrol |
| 1400 | 81 | 2/3/76 | 124008 | 0.96 MB | 35.3% | partial | 0 | 13 | 4 | 2 | Holy Roman Empire、Old Swiss Confederacy、Bavaria (duchy or electorate)、Württemberg、Margraviate of Baden、County of Tyrol |
| 1492 | 91 | 2/3/86 | 136049 | 1.07 MB | 41.9% | partial | 0 | 12 | 7 | 3 | Holy Roman Empire、Old Swiss Confederacy、Bavaria (duchy or electorate)、Württemberg、Margraviate of Baden、Habsburg Austria、County of Tyrol、Duchy of Milan |
| 1500 | 98 | 2/8/88 | 202009 | 1.56 MB | 53.0% | good | 0 | 12 | 9 | 4 | Holy Roman Empire、Old Swiss Confederacy、Bavaria (duchy or electorate)、Württemberg、Margraviate of Baden、Habsburg Austria、County of Tyrol |
| 1600 | 114 | 2/11/101 | 400475 | 3.03 MB | 71.1% | good | 0 | 7 | 7 | 3 | Holy Roman Empire、Old Swiss Confederacy、Württemberg、Habsburg Austria、County of Tyrol |
| 1700 | 118 | 22/11/85 | 659487 | 4.90 MB | 99.6% | good | 0 | 6 | 6 | 4 | Württemberg、Habsburg Austria、County of Tyrol |
| 1800 | 80 | 10/8/62 | 550304 | 4.09 MB | 94.3% | good | 0 | 6 | 5 | 3 | Bavaria (duchy or electorate)、Württemberg、Habsburg Austria、County of Tyrol |
| 1900 | 59 | 8/3/48 | 1068371 | 7.83 MB | 100.0% | good | 0 | 2 | 2 | 1 | — |

合计 25.5 MB；超过 8 MB 的年份：无。

每年最大的记录：
- 1000：Holy Roman Empire、Kingdom of France、Kingdom of Burgundy、Duchy of Bavaria
- 1200：Holy Roman Empire、Kingdom of Hungary、Kingdom of Burgundy、Duchy of Swabia
- 1300：Kingdom of Hungary、Kingdom of Burgundy、Papal States、Republic of Genoa
- 1400：Papal States、Duchy of Milan、Savoyard state、Duchy of Austria
- 1492：Republic of Venice、Papal States、Savoyard state、Golden Ambrosian Republic
- 1500：Saxon Circle、Republic of Venice、Bavarian Circle、Papal States
- 1600：Lands of the Bohemian Crown、Upper Saxon Circle、Austrian Circle、Republic of Venice
- 1700：Holy Roman Empire、Kingdom of France、Lands of the Bohemian Crown、Upper Saxon Circle
- 1800：French Republic、Holy Roman Empire、Kingdom of Prussia、Austrian Circle
- 1900：French Republic、Austria-Hungary、German Reich、Kingdom of Prussia

## 窗口 East Asia（东亚） bbox 95/18/150/55 · 快照 2026-10-02T21:50:07Z

| 年份 | 记录 | L2/L3/L4 | 顶点 | gz | 陆地采样覆盖 | 判定 | 未绘制 | Cliopatria 窗口内 | 中心点被覆盖 | 名称匹配 | 来源未收录(探针) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1000 | 12 | 2/3/7 | 75002 | 0.52 MB | 1.8% | sparse | 1 | 12 | 2 | 2 | Đại Việt / Vietnam、Tibet、Khmer / Angkor |
| 1100 | 13 | 3/2/8 | 83460 | 0.59 MB | 2.1% | sparse | 0 | 11 | 2 | 2 | Tibet、Champa、Khmer / Angkor |
| 1200 | 13 | 4/1/8 | 85262 | 0.60 MB | 2.1% | sparse | 0 | 11 | 2 | 1 | Japan (shogunate)、Tibet、Champa、Khmer / Angkor |
| 1300 | 15 | 6/1/8 | 91179 | 0.65 MB | 3.5% | sparse | 1 | 8 | 3 | 1 | Yuan / Mongol Empire、Japan (shogunate)、Tibet、Champa、Khmer / Angkor |
| 1400 | 21 | 10/1/10 | 136938 | 1.01 MB | 42.9% | partial | 0 | 12 | 5 | 4 | Japan (shogunate)、Tibet、Champa、Khmer / Angkor、Siam / Ayutthaya |
| 1500 | 16 | 4/1/11 | 148025 | 1.11 MB | 43.2% | partial | 0 | 11 | 4 | 1 | Japan (shogunate)、Tibet、Ryukyu Kingdom、Champa、Khmer / Angkor、Siam / Ayutthaya |
| 1600 | 23 | 10/1/12 | 340850 | 2.66 MB | 43.2% | partial | 0 | 13 | 7 | 1 | Japan (shogunate)、Tibet、Champa、Khmer / Angkor、Manchuria |
| 1700 | 30 | 11/2/17 | 623219 | 4.92 MB | 95.6% | good | 4 | 6 | 4 | 3 | Tibet、Champa、Khmer / Angkor、Siam / Ayutthaya、Manchuria |
| 1800 | 34 | 10/6/18 | 639219 | 5.07 MB | 96.2% | good | 5 | 7 | 6 | 4 | Tibet、Champa、Khmer / Angkor、Siam / Ayutthaya、Manchuria |
| 1850 | 36 | 11/6/19 | 617206 | 4.91 MB | 96.2% | good | 4 | 6 | 5 | 4 | Tibet、Khmer / Angkor、Siam / Ayutthaya、Manchuria |
| 1900 | 38 | 18/2/18 | 886143 | 6.88 MB | 98.8% | good | 4 | 3 | 3 | 3 | Tibet、Manchuria |
| 1910 | 41 | 19/2/20 | 911372 | 7.10 MB | 99.7% | good | 3 | 3 | 3 | 3 | Tibet、Manchuria |
| 1930 | 42 | 17/3/22 | 1508604 | 11.57 MB | 99.7% | good | 2 | 5 | 5 | 3 | Manchuria |
| 1950 | 47 | 17/1/29 | 1599317 | 12.35 MB | 99.7% | good | 1 | 6 | 6 | 4 | — |

合计 59.9 MB；超过 8 MB 的年份：1930、1950。

每年最大的记录：
- 1000：Goryeo、大瞿越 Đại Cồ Việt、Nankaido、Iyo Province
- 1100：Goryeo、Đại Việt、Chŏlla-do、Nankaido
- 1200：Qara Khitai、Goryeo、Đại Việt、Chŏlla-do
- 1300：Goryeo、Lan Na Kingdom Mandala、Đại Việt、Chŏlla-do
- 1400：Great Ming、Joseon、Lan Na Kingdom Mandala、Đại Việt
- 1500：Great Ming、Joseon、Đại Việt、Lan Na Kingdom Mandala (1474-1558)
- 1600：Great Ming、New Spain (1598-1606)、Ayutthaya Kingdom、Spanish Philippines
- 1700：Tsardom of Russia、Qing、New Spain (1697-1704)、Outer Mongolia
- 1800：Russian Empire、Qing、New Spain (1795-1803)、Outer Mongolia
- 1850：Russian Empire、Qing、Yakutsk Oblast、Company Raj
- 1900：Russian Empire、Qing、United States、British Raj
- 1910：Russian Empire、Qing、United States、British Raj
- 1930：Soviet Union、Russian Soviet Federative Socialist Republic、United States、China
- 1950：Soviet Union、Russian Soviet Federative Socialist Republic、United States、People's Republic of China

## 结论：哪些年份值得切详图

- **good**（自动模式可在覆盖足够时切换详图）：central-europe 1000、central-europe 1200、central-europe 1500、central-europe 1600、central-europe 1700、central-europe 1800、central-europe 1900、east-asia 1700、east-asia 1800、east-asia 1850、east-asia 1900、east-asia 1910、east-asia 1930、east-asia 1950
- **partial**（只有用户显式选择地区详图才展示，自动模式保留概览并提示空白）：central-europe 1300、central-europe 1400、central-europe 1492、east-asia 1400、east-asia 1500、east-asia 1600
- **sparse**（自动模式一律保留概览，档案目录写明该年固化详图偏少）：east-asia 1000、east-asia 1100、east-asia 1200、east-asia 1300

## 已知边界

1. 两个窗口不重叠；窗口内是行政 2–4 级，窗口外的年份与级别仍依赖在线瓦片。
2. 记录数少不等于覆盖差（东亚 1000–1300 只有 12–15 条，陆地采样仅 2–4%：源数据本身稀疏）。
3. 东亚窗口 1930/1950 等年份单文件超过 8 MB：窗口内包含苏联、英属印度、美国（菲律宾）等巨型多边形，而几何不做裁剪也不简化。
4. “中心点被覆盖”是保守指标：Cliopatria 的中心点可能落在同年的帝国级大面内，而非其自身多边形内。
