# 3.24 战役标记与图例数量核查

结论先行：**图例缺数量是真缺陷（已修）；"标记 0" 在 Lead 给的 URL 上不是 `detailedActive` 抑制，而是逐个标记的视野/重叠过滤**。抑制逻辑本身是设计行为，未改动。

## 1. 复现 Lead 的读数（同一 URL、等待 ≥20 s）

URL：`http://127.0.0.1:8767/#year=1500&lang=bi&camera=9.32,48.08,5.2,0,0&browse=1`

| 读数 | Lead（24 s / 26 s） | 本次（22–25 s，修复前） |
|---|---|---|
| battlesBtn active | true | true |
| battles.active | 24 | 24 |
| battles.all | 603 | 603 |
| battle marker 数 | **0** | **1** |
| 图例文本 | `历史疆域 · 点击阅读档案` | 同（无数量） |
| `#battleStatus` | 未记录 | `24 条同期战役` |
| `atlas.regional.detailedActive` | 未打印 | **false** |
| `atlas.regional.mode` / `status` / `active` | 未打印 | `auto` / `zoom` / false |
| 控制台错误 | 0 | 0 |

复现成功（图例无数量、开关注入为 true、24 条 active）；标记数 0 vs 1 的差异见 §3。

## 2. 决定性实验：图例数量是可用的，只是没被重绘

`renderLayerLabels()` 是 app.js 的模块内函数，没有挂到 window；但它在 `document.addEventListener('geometry-status', …)` 里被调用，因此可以在页面里派发一次同名事件来"手动调用一次"：

```js
document.querySelector('#map').dispatchEvent(new CustomEvent('geometry-status',{bubbles:true,detail:{fine:false}}))
```

| 时刻 | 图例文本 |
|---|---|
| 等待 25 s 后（未干预） | `历史疆域 · 点击阅读档案` |
| 派发一次 geometry-status 后 | `历史疆域 · 点击阅读档案 · 24 条同期战役` |
| 改年份（触发疆域几何更新，间接重绘）后 | `… · 28 条同期战役`（active 变为 28） |

→ 数量数据一直可用，**图例停在旧状态**：`renderLayerLabels()` 在 init（renderLanguage）阶段跑过一次，那时 `battles.active` 还是空；之后它的触发点是 geometry-status / 图层开关等，**战役档案就绪（onStatus('ready')）不在其中**。这是触发时机缺陷，不是数据缺失。

## 3. 标记为 0/1 的归因：不是 detailedActive 抑制

在复现 URL 上用 `BattleLayer.refresh()` 的同一套条件复算（`max=min(60,round((zoom-2)*10))=32`，与页面实测 marker 数一致）：

| 原因 | 条数 |
|---|---:|
| 坐标无效 | 0 |
| **当前视野之外** | **17** |
| 越出容器边距（上 10 / 右 10 / 下 48 / 左 8） | 1 |
| 与既有标签盒重叠 | 5 |
| 达到 max 上限 | 0 |
| **实际绘制** | **1** |
| 合计 | 24（与 active 一致） |

对照实验：把相机移到 Bern、zoom 8（同一批 1500 年战役）→ 24 条**全部**在视野外 → 绘制 0。说明该图层的标记数对视野极其敏感；`zoom 5.2` 的中欧视野里 24 条战役大多不在框内。

**抑制分支确实是设计行为（保留）**：用 `boundaries=regional` + 相机 6.72 进入真实地区详图态，实测 `detailedActive=true`、marker=0；手动调用 `atlas.battles.refresh()` 前后都是 0（`battles.js:28` 的 `zoom<3||detailedActive` 分支按预期生效）。

## 4. 修改（仅 public/app.js，战役/图例相关）

1. **修触发时机（不轮询）**：`bindPlaceLayer` 里 BattleLayer 的 `onStatus` 回调在更新 `#battleStatus` 后调用一次 `renderLayerLabels()`（仅主图）。战役档案就绪、年份/窗口变化、加载失败都会走这里，因此图例数量始终与 `battles.active` 同步。
2. **补"何时可见"说明**：图例后缀原有 `zoom<3 →（放大地图后显示）`；新增 `detailedActive →（地区详图中隐藏）`，避免读者把"详图下没有标记"当成数据缺失。

未改 `public/battles.js`、未放开抑制、未引入轮询。

## 5. 双尺寸实测（修复后）

| 检查 | 桌面 1440×900 | 手机 390×844 |
|---|---|---|
| 复现 URL，等待 22 s，**不手动触发** | 图例 `历史疆域 · 点击阅读档案 · 24 条同期战役`，markers 1 | 同 |
| 关闭战役开关 | 图例回到 `历史疆域 · 点击阅读档案`，markers 0 | 同（真实触摸点按） |
| 再次打开 | 数量回来，markers 1 | 同 |
| 地区详图 URL（`boundaries=regional`，相机 6.72） | `detailedActive=true`，markers 0，图例 `详细历史区划 · 点击阅读年代与来源 · 24 条同期战役（地区详图中隐藏）`；手动 refresh 后仍 0 | — |
| 控制台错误 | 0 | 0 |
| 横向溢出 | scrollWidth 1440 == innerWidth 1440 | scrollWidth 390 == innerWidth 390 |

## 6. 验证

- `node scripts/validate-cross-layer.mjs` → **3/3 通过**（events 709、battles 603）。
- `node scripts/validate-v2.mjs` 以及 `package.json` test 链其余步骤：见 `battle-markers.json` 的 `testChain`（stamp 那一步按要求排除）。
- **需要 Lead 盖章**：本次改了 `public/app.js`，`stamp-assets --check` 会因未重盖章而 stale；按约定我没有运行 `prepare:assets`。

## 7. 附：为什么"标记少"不当作缺陷

- 设计：`battles.js:28` 在 `zoom<3` 或 `detailedActive` 时整体抑制，属于既定的分层策略。
- 行为：即使在可绘制状态，标记也要通过"在视野内 + 不越界 + 不与标签重叠 + 不超过数量上限"四项过滤，因此同一批战役在不同相机下的显示数量差异很大（本 URL 1 个、Bern zoom 8 下 0 个、详图态 0 个）。
- 若日后希望"标记更多"，应调整的是过滤策略（例如放宽重叠判定或提高 max），而不是去掉抑制分支——本轮未做任何此类改动。
