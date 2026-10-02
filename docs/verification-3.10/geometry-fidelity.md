# 1500 年中欧边界：源、简化与渲染的分层核查 · 3.10

日期：2026-10-03。对象：用户截图里 1500 年瑞士、洛林、巴伐利亚一带的“粗稀折线与锯齿”。
可复现证据：`node scripts/verification/audit-geometry-fidelity.mjs` → `docs/verification-3.10/geometry-fidelity.json`。

## 一、三个阶段各自的实测结果

| 阶段 | 做了什么 | 对用户所见轮廓的影响 |
|---|---|---|
| 源数据 | Cliopatria polys only，固定提交 `ad28a691`；`public/data/native/` 逐字段保留原始坐标，`simplification/quantization/rounding/repairs` 全为 false | **这是锯齿的来源** |
| 构建期简化 | `geometries-*.json.gz` 一次 `simplify(0.02°, preserve_topology)`；`fast/overview-*.json.gz` 再 `simplify(0.04°)` | 非 bootstrap 年份**首帧**偏最多约 4.4 km，随后被原生几何替换 |
| 渲染 | `polities` 源以 `tolerance:0` 建立（MapLibre 不再简化）；线网与填色共用同一坐标；“边界柔化”是可逆的转角圆整，原始顶点全部保留为控制点 | 3.10 之前**边框几乎不可见**（地形晕渲压在疆域层之上），已修复 |

## 二、用户截图里那三条记录的实测（源几何）

| 记录 | 年份 | 顶点数 | 线段中位长 | 完全轴对齐段 | 面积 |
|---|---|---:|---:|---:|---:|
| Duchy of Bavaria | 1459–1506 | 55 | 19.0 km | 11 / 54 | 36,100 km² |
| Swiss Confederation | 1497–1501 | 68 | 14.6 km | 20 / 65 | 22,745 km² |
| Duchy of Lorraine | 1497–1501 | 102 | 14.1 km | 32 / 95 | 17,186 km² |

55 个顶点覆盖 3.6 万平方千米，即平均每 650 平方千米一个顶点，且五分之一以上的边严格水平或垂直——这正是肉眼看到的“台阶”。**这不是简化造成的，也不是渲染造成的**；任何平滑都只能改变外观，不能恢复源里不存在的转折。

跨年代跨地区抽样 36 条政体：源顶点中位数 412，0.04° 概览快照相对源的最大偏移中位 3.84 km、P90 4.26 km、最大 4.41 km；0.02° 显示派生物最大 2.22 km。

## 三、稳态其实已经是原始几何（真实浏览器复核）

在 `#year=1503`（非 bootstrap 年、相机 9.32,48.08,6.72）实测：页面稳定后 137 条活动记录**全部**由 `data/native` 原始坐标绘制（geometry key 全部以 `n` 结尾），代价是 208 次网络响应、约 12 秒。1500 年本身属于 native bootstrap 年，首帧即原始几何。

结论：构建期简化只影响**非 bootstrap 年份的首帧**，不构成长期误差；它是可以继续减小代价的工程问题，不是精度问题。

## 四、这一轮实际改了什么

1. **把地形晕渲移到疆域层之下**（`public/geography.js`：`relief`、`terrain-shade` 改为插在 `territories` 之前）。此前 0.82 不透明度的晕渲栅格压在疆域填充之上，是中欧 1500 视图“几乎看不见国界”的直接原因。
2. **历史界线改为双层描边**（`public/boundary-style.js` 新增 `boundaryHaloPaint`，`public/map-engine.js` 新增 `boundary-halo` 图层）：浅色晕圈把历史界线从现代地形上分离出来，深色细线承载真实源坐标。仅像素样式，不动坐标。
3. **疆域填充透明度按缩放重新标定**（0.53→0.30 区间），让政体在 4–10 级缩放都读得出色块，而不是被底图吃掉。
4. 三个设置可见性的模块（`boundary-controller.js`、`map-engine.js` 的 `toggleBorders`）同步到新图层，关闭疆域或切换到地区详图时晕圈一并消失。

## 五、仍未解决

- 源本身的分辨率不会因为渲染改进而提高。瑞士、巴伐利亚在 1500 年仍然只有 55–102 个顶点。
- OpenHistoricalMap 在 1500 年的阿尔卑斯没有巴伐利亚公国、瑞士邦联、符腾堡、巴登、哈布斯堡、蒂罗尔的面；详图模式在该区域本体上是空白，只能如实标注“未收录”。
- IEG Map 602 提取候选（CC BY-NC 4.0）仍是研究级，控制点留一误差约 4.5 km，且瑞士/洛林落在控制点凸包之外，未接入生产图层。
- 非 bootstrap 年份首帧的 0.04° 概览仍偏约 4.4 km；减小它需要重建 `catalog.json.gz` 与其哈希链（native manifest 记录了 catalog sha256），本轮未做。
