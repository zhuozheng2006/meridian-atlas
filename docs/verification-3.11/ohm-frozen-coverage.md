# 固化 OHM 快照的年度覆盖矩阵

生成脚本：`node scripts/ohm/coverage-matrix.mjs --markdown docs/verification-3.11/ohm-frozen-coverage.md`（可复现）

数据快照：OpenHistoricalMap 2026-10-02T19:22:25Z；窗口 bbox 4.5/44/14.5/50.5（西/南/东/北）；级别 2–4。

“陆地采样覆盖”＝在窗口内 24×24 网格上取落在 `public/data/land.geojson` 陆地上的点，再用该年固化多边形（扣洞）做点面判定得到的比值；判定阈值：≥45% good，≥12% partial，否则 sparse（记录数 <8 一律 sparse）。

“Cliopatria 当年窗口内政体”＝catalog 中该年活动、中心点落在窗口内的 POLITY 记录；“中心点被覆盖”指该中心点落在当年的某个固化多边形内；“名称匹配”为去掉爵衔与通用词后的名称比对，仅作参考。

| 年份 | 固化记录 | 级别 2/3/4 | 顶点 | 陆地采样覆盖 | 判定 | 未绘制(源残缺) | Cliopatria 窗口内政体 | 中心点被覆盖 | 名称匹配 | 未匹配政体 | 来源未收录(探针) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1000 | 21 | 6/1/14 | 116764 | 94.9% | good | 2 | 4 | 4 | 2 | Kingdom of Arles、Republic of Venice | Duchy of Saxony |
| 1200 | 34 | 4/3/27 | 61190 | 98.5% | good | 0 | 4 | 4 | 2 | Republic of Venice、Kingdom of Arles | Duchy of Saxony、Bavaria (duchy or electorate)、Württemberg、Margraviate of Baden、County of Tyrol |
| 1300 | 71 | 3/5/63 | 104374 | 32.5% | partial | 1 | 13 | 5 | 1 | County of Savoy、Duchy of Styria、Dauphiné、Comtat Venaissin、Kingdom of Arles、Patriarchate of Aquileia、Holy Roman Empire Minor States、Duchy of Bavaria、House of Wittelsbach、Swiss Confederation、(Holy Roman Empire)、House of Luxembourg | Holy Roman Empire、Old Swiss Confederacy、Bavaria (duchy or electorate)、Württemberg、Margraviate of Baden、County of Tyrol |
| 1400 | 81 | 2/3/76 | 124008 | 35.3% | partial | 0 | 13 | 4 | 2 | Duchy of Styria、Electorate of Trier、Patriarchate of Aquileia、Comtat Venaissin、(Holy Roman Empire)、County of Savoy、Duchy of Burgundy、Swiss Confederation、House of Habsburg、Duchy of Bavaria、Holy Roman Empire Minor States | Holy Roman Empire、Old Swiss Confederacy、Bavaria (duchy or electorate)、Württemberg、Margraviate of Baden、County of Tyrol |
| 1492 | 91 | 2/3/86 | 136049 | 41.9% | partial | 0 | 12 | 7 | 3 | Duchy of Styria、Electorate of Trier、Duchy of Bavaria、County of Savoy、Comtat Venaissin、House of Habsburg、(Habsburg Monarchy)、Duchy of Milan、Swiss Confederation | Holy Roman Empire、Old Swiss Confederacy、Bavaria (duchy or electorate)、Württemberg、Margraviate of Baden、Habsburg Austria、County of Tyrol、Duchy of Milan |
| 1500 | 98 | 2/8/88 | 202009 | 53.0% | good | 0 | 12 | 9 | 4 | Electorate of Trier、Duchy of Bavaria、Comtat Venaissin、House of Habsburg、Swiss Confederation、County of Savoy、(Habsburg Monarchy)、Duchy of Styria | Holy Roman Empire、Old Swiss Confederacy、Bavaria (duchy or electorate)、Württemberg、Margraviate of Baden、Habsburg Austria、County of Tyrol |
| 1600 | 114 | 2/11/101 | 400475 | 71.1% | good | 0 | 7 | 7 | 3 | Comtat Venaissin、Electorate of Trier、Swiss Confederation、House of Savoy | Holy Roman Empire、Old Swiss Confederacy、Württemberg、Habsburg Austria、County of Tyrol |
| 1700 | 118 | 22/11/85 | 659487 | 99.6% | good | 0 | 6 | 6 | 4 | Comtat Venaissin、Swiss Confederation | Württemberg、Habsburg Austria、County of Tyrol |
| 1800 | 80 | 10/8/62 | 550304 | 94.3% | good | 0 | 6 | 5 | 3 | Duchy of Bavaria、Cispadane Republic、Kingdom of Sardinia | Bavaria (duchy or electorate)、Württemberg、Habsburg Austria、County of Tyrol |
| 1900 | 59 | 8/3/48 | 1068371 | 100.0% | good | 0 | 2 | 2 | 1 | Swiss Confederation | — |

## 每年最大的几条记录

- **1000**：Holy Roman Empire、Kingdom of France、Kingdom of Burgundy、Duchy of Bavaria、Duchy of Franconia
- **1200**：Holy Roman Empire、Kingdom of Hungary、Kingdom of Burgundy、Duchy of Swabia、Papal States
- **1300**：Kingdom of Hungary、Kingdom of Burgundy、Papal States、Republic of Genoa、County of Champagne
- **1400**：Papal States、Duchy of Milan、Savoyard state、Duchy of Austria、Republic of Venice
- **1492**：Republic of Venice、Papal States、Savoyard state、Golden Ambrosian Republic、Provence
- **1500**：Saxon Circle、Republic of Venice、Bavarian Circle、Papal States、Savoyard state
- **1600**：Lands of the Bohemian Crown、Upper Saxon Circle、Austrian Circle、Republic of Venice、Bohemia
- **1700**：Holy Roman Empire、Kingdom of France、Lands of the Bohemian Crown、Upper Saxon Circle、Austrian Circle
- **1800**：French Republic、Holy Roman Empire、Kingdom of Prussia、Austrian Circle、Upper Saxon Circle
- **1900**：French Republic、Austria-Hungary、German Reich、Kingdom of Prussia、Italy

## 结论：哪些年份适合切换详图

- **good**（1000、1200、1500、1600、1700、1800、1900）：自动模式可以在覆盖足够时切换详图。
- **partial**（1300、1400、1492）：只有用户明确选择“地区详图”才展示；自动模式保留全球概览并提示“局部详图 · 空白处未收录”。
- **sparse**（无）：自动模式一律保留概览，档案目录写明“该年固化详图偏少”。

## 已知边界

1. 只覆盖上述窗口与行政 2–4 级；窗口外、级别外仍依赖在线瓦片。
2. 只覆盖这 10 个年份；verify 脚本断言“某年没有记录的 relation 不会在别的年份出现”，不做邻近年份顶替。
3. “中心点被覆盖”是保守指标：Cliopatria 的中心点可能落在同年的帝国圈或王国大面内，而非其自身多边形内；名称匹配也无法处理古今异名（例如 Duchy of Bavaria 与 Herzogthum Baiern）。
4. 记录数少不等于覆盖差：1000/1200 年只有 21/34 条，但都是帝国级大面，陆地采样覆盖反而最高。

## 原始数据（JSON）

```json
[
 {
  "year": 1000,
  "coverage": {
   "ratio": 0.9488,
   "covered": 519,
   "land": 547,
   "verdict": "good"
  },
  "cliopatria": {
   "active": 4,
   "areaKm2": 1527423,
   "centerCovered": 4,
   "nameMatched": 2,
   "unmatched": [
    "Kingdom of Arles",
    "Republic of Venice"
   ]
  }
 },
 {
  "year": 1200,
  "coverage": {
   "ratio": 0.9854,
   "covered": 539,
   "land": 547,
   "verdict": "good"
  },
  "cliopatria": {
   "active": 4,
   "areaKm2": 1786461,
   "centerCovered": 4,
   "nameMatched": 2,
   "unmatched": [
    "Republic of Venice",
    "Kingdom of Arles"
   ]
  }
 },
 {
  "year": 1300,
  "coverage": {
   "ratio": 0.3254,
   "covered": 178,
   "land": 547,
   "verdict": "partial"
  },
  "cliopatria": {
   "active": 13,
   "areaKm2": 1673747,
   "centerCovered": 5,
   "nameMatched": 1,
   "unmatched": [
    "County of Savoy",
    "Duchy of Styria",
    "Dauphiné",
    "Comtat Venaissin",
    "Kingdom of Arles",
    "Patriarchate of Aquileia",
    "Holy Roman Empire Minor States",
    "Duchy of Bavaria",
    "House of Wittelsbach",
    "Swiss Confederation",
    "(Holy Roman Empire)",
    "House of Luxembourg"
   ]
  }
 },
 {
  "year": 1400,
  "coverage": {
   "ratio": 0.3528,
   "covered": 193,
   "land": 547,
   "verdict": "partial"
  },
  "cliopatria": {
   "active": 13,
   "areaKm2": 1786643,
   "centerCovered": 4,
   "nameMatched": 2,
   "unmatched": [
    "Duchy of Styria",
    "Electorate of Trier",
    "Patriarchate of Aquileia",
    "Comtat Venaissin",
    "(Holy Roman Empire)",
    "County of Savoy",
    "Duchy of Burgundy",
    "Swiss Confederation",
    "House of Habsburg",
    "Duchy of Bavaria",
    "Holy Roman Empire Minor States"
   ]
  }
 },
 {
  "year": 1492,
  "coverage": {
   "ratio": 0.4186,
   "covered": 229,
   "land": 547,
   "verdict": "partial"
  },
  "cliopatria": {
   "active": 12,
   "areaKm2": 482147,
   "centerCovered": 7,
   "nameMatched": 3,
   "unmatched": [
    "Duchy of Styria",
    "Electorate of Trier",
    "Duchy of Bavaria",
    "County of Savoy",
    "Comtat Venaissin",
    "House of Habsburg",
    "(Habsburg Monarchy)",
    "Duchy of Milan",
    "Swiss Confederation"
   ]
  }
 },
 {
  "year": 1500,
  "coverage": {
   "ratio": 0.5302,
   "covered": 290,
   "land": 547,
   "verdict": "good"
  },
  "cliopatria": {
   "active": 12,
   "areaKm2": 502179,
   "centerCovered": 9,
   "nameMatched": 4,
   "unmatched": [
    "Electorate of Trier",
    "Duchy of Bavaria",
    "Comtat Venaissin",
    "House of Habsburg",
    "Swiss Confederation",
    "County of Savoy",
    "(Habsburg Monarchy)",
    "Duchy of Styria"
   ]
  }
 },
 {
  "year": 1600,
  "coverage": {
   "ratio": 0.7112,
   "covered": 389,
   "land": 547,
   "verdict": "good"
  },
  "cliopatria": {
   "active": 7,
   "areaKm2": 209027,
   "centerCovered": 7,
   "nameMatched": 3,
   "unmatched": [
    "Comtat Venaissin",
    "Electorate of Trier",
    "Swiss Confederation",
    "House of Savoy"
   ]
  }
 },
 {
  "year": 1700,
  "coverage": {
   "ratio": 0.9963,
   "covered": 545,
   "land": 547,
   "verdict": "good"
  },
  "cliopatria": {
   "active": 6,
   "areaKm2": 215953,
   "centerCovered": 6,
   "nameMatched": 4,
   "unmatched": [
    "Comtat Venaissin",
    "Swiss Confederation"
   ]
  }
 },
 {
  "year": 1800,
  "coverage": {
   "ratio": 0.9433,
   "covered": 516,
   "land": 547,
   "verdict": "good"
  },
  "cliopatria": {
   "active": 6,
   "areaKm2": 154523,
   "centerCovered": 5,
   "nameMatched": 3,
   "unmatched": [
    "Duchy of Bavaria",
    "Cispadane Republic",
    "Kingdom of Sardinia"
   ]
  }
 },
 {
  "year": 1900,
  "coverage": {
   "ratio": 1,
   "covered": 547,
   "land": 547,
   "verdict": "good"
  },
  "cliopatria": {
   "active": 2,
   "areaKm2": 43537,
   "centerCovered": 2,
   "nameMatched": 1,
   "unmatched": [
    "Swiss Confederation"
   ]
  }
 }
]
```
