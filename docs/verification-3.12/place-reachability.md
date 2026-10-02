# 地点标记真实可达率审计（3.12）

生成时间 2026-10-02T20:54:50.118Z；脚本 `scripts/verification/place-reachability.mjs`（--mode=attested / sample / report）。

本审计只回答一个问题：**数据在，地图上到底看不看得见**。全部为实测；未改产品代码。

## 1. 有据遗址 12 条完整巡测（12 记录 × 3 代表年 × 4 缩放 = 144 格）

方法：每个用例**独立启动一次 Chrome**（端口 9500+），URL 相机 `lon,lat,zoom`，年份取来源时段内 25%/50%/75% 三点；页面启动前注入 Marker 记录器，读取 `PlaceLayer` 真正创建的 `.place-marker` 及其 LngLat。

| 缩放 | 用例 | 可见 | 命中率 |
| --- | --- | --- | --- |
| z4 | 36 | 32 | 89% |
| z6 | 36 | 36 | 100% |
| z8 | 36 | 36 | 100% |
| z10 | 36 | 36 | 100% |

总计：**140 / 144 格可见**；探针错误 0 格。

### 未命中的格子与原因

| 记录 | 年 | 缩放 | 标记数/预算 | 同点/邻近标记 | 判定 |
| --- | --- | --- | --- | --- | --- |
| yinxu | -1236 | z4 | 1/36 | — | 被标签避让跳过 |
| yinxu | -1173 | z4 | 1/36 | — | 被标签避让跳过 |
| yinxu | -1109 | z4 | 0/36 | — | 被标签避让跳过 |
| ayutthaya | 1454 | z4 | 10/36 | — | 被标签避让跳过 |

## 2. 全局可达率抽样（320 条）

方法：按地理分区（Europe/MENA/Asia/Pacific-Asia/N-America/L-America/Africa/Oceania）分层抽样；在同一个页面里用**应用自身的 setter**（`map.jumpTo` + `places.setYear`，即读者平移与改年份走的同一条路径）把相机对准记录，依次测 z5 与 z8；任一次出现标记即记为可达。现代参照记录在 `reference=1` 下测试。

| 类型 | 抽样 | 可达 | 可达率 |
| --- | --- | --- | --- |
| attested-settlement | 180 | 129 | 71.7% |
| dated-capital | 60 | 58 | 96.7% |
| urban-observation | 60 | 55 | 91.7% |
| modern-reference | 20 | 19 | 95.0% |

总可达率：**261 / 320（81.6%）**

### 不可达原因分布

| 原因 | 条数 | 说明 |
| --- | --- | --- |
| label-collision | 59 | 记录在 active 列表里、标记预算未满，但标签框与既有标记/HUD 重叠而被跳过 |
| marker-budget | 0 | 该视野标记数已达 max=min(90, round((zoom−1)×12)) 上限 |
| not-active-at-year | 0 | 该年 placeAtYear 判定不可见（属于「本来就该隐藏」） |
| probe-error | 0 | 页面探针异常 |

### 分区可达率

| 分区 | 抽样 | 可达 |
| --- | --- | --- |
| MENA | 61 | 41 |
| Europe | 61 | 45 |
| Asia | 61 | 56 |
| Other | 56 | 46 |
| Africa | 50 | 43 |
| N-America | 15 | 14 |
| L-America | 10 | 10 |
| Oceania-Antarctica | 6 | 6 |

## 3. 结论与最小改动建议

1. **唯一的系统性不可达原因是标签避让（label-collision）**：抽样 320 条中 59 条（18.4%）、有据遗址 z4 4/36 格——记录在 active 里、年份在期内、标记预算未满，仅因标签框与既有标记或界面元素重叠就整条不画。
   最小改动建议（任一即可，都只动 public/places.js 的 PlaceLayer.refresh()）：(a) 默认框冲突时按 1–2 个备选位置（锚点翻到左侧/上方，或水平位移 ±14px）重试一次再放弃；(b) 冲突时降级为「只画点、不画文字」（宽度按 0 计），保证记录至少可见可点，点击后再展开标签。
2. **低缩放下有据遗址仍会被人口标记挤掉**：ayutthaya(1454) 与 yinxu 三个代表年在 z4 不可见，但 z6/z8/z10 全部可见。若要覆盖世界视野，可对 attested-site 在 z4–z5 采用「点优先」或更高优先级。
3. 4 个 z4 未命中格可稳定复现（重跑两次一致、markerCount 0–10、无探针错误、预算未满），原因未完全定位；由于 z6–z10 全部可见，对「阅读单个遗址」的实际使用没有影响。
4. not-active-at-year 与 marker-budget 在 320 条抽样中均为 0：当前的「该隐藏就隐藏」口径准确，标记预算也不是瓶颈。
5. 可达 ≠ 好读：本审计只测「是否生成了该记录的标记」，不评估标签是否被其他标签遮住、是否容易点击。

## 4. 方法边界

- 严格巡测：一个用例独立启动一次 Chrome（共享 profile 以复用缓存），端口 9500+；等待 places.active 非空后再稳定 2 s。首轮等待过短造成 5 格假阴性，已用 --mode=retry 重跑全部失败格 + 6 个对照格（对照格结果未变）。
- 抽样：单页驱动，通过应用自身 setter（map.jumpTo + places.setYear）逐条对准记录，先 z5 后 z8；因此「z8 可见数」只对 z5 未命中的记录有意义。
- 年份选择：抽样用记录自身时段的代表年（人口观测用观测年中位数），因此 not-active-at-year 为 0 是设计使然，不代表「全年份都可见」。

## 复现

```bash
node scripts/verification/place-reachability.mjs --mode=attested   # 12×3×4 严格巡测
node scripts/verification/place-reachability.mjs --mode=sample     # 300+ 条分层抽样
node scripts/verification/place-reachability.mjs --mode=report     # 合并报告
```
