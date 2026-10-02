# 地点标记真实可达率审计（3.12）

生成时间 2026-10-02T20:37:00.423Z；脚本 `scripts/verification/place-reachability.mjs`（--mode=attested / sample / report）。

本审计只回答一个问题：**数据在，地图上到底看不看得见**。全部为实测；未改产品代码。

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

## 复现

```bash
node scripts/verification/place-reachability.mjs --mode=attested   # 12×3×4 严格巡测
node scripts/verification/place-reachability.mjs --mode=sample     # 300+ 条分层抽样
node scripts/verification/place-reachability.mjs --mode=report     # 合并报告
```
