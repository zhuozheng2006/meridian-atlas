# 3.10 验证与交付记录

日期：2026-10-03。版本：3.10.0。基线：3.9.4（提交 `c9c678f` 的交接快照，本仓库基线提交 `7ee94b4a`）。

## 一、这一批做了什么

| 方向 | 改动 | 证据 |
|---|---|---|
| P0 制图 | 地形晕渲移到疆域层之下；历史界线改为「浅色晕圈 + 深色细线」双层描边；填充透明度按缩放重标定 | 前后对照见 `docs/verification-3.10/shots/`；仅像素样式，坐标未动 |
| P0 几何保真 | 把「源 / 构建期简化 / 渲染」三段分别量化；确认真实浏览器稳态下每一年都使用原始坐标 | `geometry-fidelity.json`、`geometry-fidelity.md` |
| P0 中欧 1500 | 固化 OHM 1500 年 98 条 / 1492 年 91 条行政边界（CC0），空白如实标注 | `ohm-1500.md`，`node scripts/ohm/verify-ohm-1500.mjs` 13/13 |
| P1 内容 | 事件 343→378（+35 双语）；薄格 33→27；有据遗址层 12 条 + 2 条增强 + 4 条留档 | `content-balance.json`、`content-coverage.md`、`content-attested-places.md` |
| P1 产品 | 手机 safe-area 适配；年份步长默认与页面标注一致（10 年）；浏览器验证驱动纳入仓库 | `scripts/verification/browser.mjs` |
| P1 验证 | 性能、键盘焦点、手机、弱网四类可重跑基线 | `perf-baseline.json`、`keyboard-focus.json`、`mobile-check.json`、`network-resilience.json` |

## 二、自动化验证

`npm test` 全量通过（退出码 0，无 FAIL）。整合期修复的三处回归：

1. `scripts/validate-places.mjs`：地点层新增有据遗址后，档案计数断言需随数据现算，并新增「遗址只在其来源时段内出现」的检查。
2. `scripts/validate-city-time.mjs`：夹具表缺 `attested-places`，导致 `loadPlaces()` 被判为 partial、缓存断言失败。
3. `scripts/validate-halc-continuity.mjs`：新接口 `ohmGapNotice()` 未绑定到测试用的 owner 桩，`openIndex` 抛错。

另外 `scripts/places/validate-places.mjs` 与 `scripts/places/validate-city-narratives.mjs` 原为根校验器的过期副本且已产生假失败，现改为转发到根校验器，消除两份实现漂移。

## 三、复现命令

```sh
python3 serve.py --port 8767            # 本地站点
node scripts/verification/audit-geometry-fidelity.mjs
node scripts/ohm/verify-ohm-1500.mjs
node scripts/verification/perf-baseline.mjs
node scripts/verification/keyboard-focus.mjs
node scripts/verification/mobile-check.mjs
node scripts/verification/offline-weaknet.mjs
npm run prepare:assets && npm test
```

## 四、仍未解决（如实记录）

- 1500 年瑞士、巴伐利亚的源轮廓只有 55–102 个顶点，任何渲染改进都不能提高其史料精度；OHM 在 1500 年确实没有这些政体，应用如实列出「未收录」。
- 非 bootstrap 年份首帧仍使用 0.04° 概览（抽样最大偏移 4.41 km），随后被原始几何替换；消除它需要重建 `catalog.json.gz` 及其哈希链。
- OHM 固化数据只覆盖 1492/1500 两年与行政 2–4 级；更近的县界仍依赖在线瓦片。
- 双图对照的堆内存开销约 336 MB（无头 SwiftShader 实测），未做优化。
- IEG Map 602 提取候选仍为研究级（控制点留一误差约 4.5 km），未接入生产图层。
