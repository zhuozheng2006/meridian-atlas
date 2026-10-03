# 3.22 步骤2：政体视图的「本站疆域数据未收录的政体」入口

任务：task-27（承接 task-26 的路径 B 第一步）。范围严格限定为：政体视图新增分区、打开档案说明、校验层可达性契约、双尺寸实测；**未改地图、未改搜索、未加任何几何**。

## 1. 交付内容

| 文件 | 改动 |
|---|---|
| `public/no-territory.js`（新增） | 纯函数模块：`reachability(index)`、`declaredQids(index)`、`section(index,{t,escape,lang})`、`dossier(profile,{t,escape,lang})`、`renderedQids/countEntries`。不访问 DOM、不 import app.js，因此 Node 校验器与浏览器视图跑的是同一份代码。 |
| `public/app.js` | 引入模块；`renderPolities()` 末尾插入分区并绑定卡片；`openNoTerritory(qid)` 把说明**渲染在政体视图内部**（`#contentView` 里的一篇文章，带「返回政体列表」按钮）。之所以不用详情面板：`#detailPanel` 位于地图视图内，在政体视图下 measured 尺寸为 0×0（实测），说明面板渲染了却看不见；改为在视图内渲染后 `getBoundingClientRect()` 有实际尺寸。全程不移动地图、不创建几何。 |
| `public/style.css` | 追加 `.no-territory`（分区、虚线卡片）与 `.no-territory-article`（文章视图）样式。 |
| `scripts/validate-v2.mjs` | 新增可达性契约（见第 2 节）。 |

分区文案与结构：
- 标题：「本站疆域数据未收录的政体 / Polities with no mapped territory」
- 说明（中英双语）：「以下政体在钉住的边界数据集中没有对应记录，因此地图上不会显示它们的疆域；没有边界数据是事实，不代表这些政体在历史上不存在。」
- 卡片：5 张，数量与 `coverage.boundaryCoverage.noTerritoryQids` 完全一致（Q596092、Q171203、Q468814、Q3107156、Q842390）。
- 打开后：该档案 `boundaryCoverageEvidence.note` 的中英文案 + 「本站地图不会显示该政体的疆域，也没有用相邻政体或其它年份的几何代替。」（中英）+ 来源列表 + 核对数据集 pin（Cliopatria commit ad28a691b7c0 · 13765 features · 2026-10-03）+ 返回按钮。

## 2. 可达性契约（validate-v2）

新增检查「Every enrichment profile is reachable through the catalogue or the no-territory view」：

1. `reachability(index).unbound`（没有任何 catalog 记录绑定的档案）必须与 `coverage.boundaryCoverage.noTerritoryQids` 完全相等；
2. 用**视图同一个 `section()` 函数**渲染出的卡片 qid 集合必须与上述清单完全相等——"入口存在且条目数一致"是被断言的；
3. 每个 no-territory 档案必须有中英 note，且 `dossier()` 在 zh / en 两种语言下都能渲染出对应 note。

配套（步骤 1 的契约继续生效）：每个档案必须声明 `boundaryCoverage`；`source-records` 必须 ≥1 条 catalog 绑定；`not-in-source` 必须 0 条绑定并带 ≥2 条 https+checkedOn 来源；`noTerritoryQids` 与实际集合一致；`sourceRecords` 不得少于 1,450。

**负例测试**（`docs/verification-3.22/negative-tests-3.22.mjs`，输出存 `no-territory-negative-tests.json`）：

| 篡改 | 结果 |
|---|---|
| 把分区条目清空（等价于"移除入口"） | 契约失败（rendered=[] ≠ unbound 五项）✔ |
| 从 `noTerritoryQids` 里删掉一项 | 契约失败（unbound 五项 ≠ 声明四项）✔ |
| 去掉档案的中英 note | 契约失败（dossier 渲染不出 note）✔ |

## 3. 双尺寸浏览器实测（真实 Chrome headless + CDP）

脚本 `docs/verification-3.22/browser-check-3.22.mjs`（原始输出 `no-territory-browser-check.json`；截图 `no-territory-section-1440x900.png`、`no-territory-dossier-1440x900.png`、`no-territory-section-390x844.png`、`no-territory-dossier-390x844.png`）。流程：打开站点 → 等待应用就绪 → 点击「文明 Polities」标签 → 断言分区 → 滚动到分区截图 → 点击第一张卡片 → 断言文章可见并截图。每次运行带 `run=<timestamp>` 查询参数避免模块缓存。

| 检查项 | 1440×900 | 390×844 |
|---|---|---|
| 分区可见 | ✔ | ✔ |
| 卡片数 = 声明数 | 5 / 5 | 5 / 5 |
| qid 集合 | Q171203, Q3107156, Q468814, Q596092, Q842390 | 同左 |
| 档案可打开且**实际可见**（rect>200×100） | ✔ | ✔ |
| 中文 note 显示 | ✔ | ✔ |
| 英文 note 显示 | ✔ | ✔ |
| 中文"地图不会显示疆域"句 | ✔ | ✔ |
| 英文"never draws a boundary"句 | ✔ | ✔ |
| 来源链接数 | 2 | 2 |
| 横向溢出（scrollWidth−innerWidth，分区与文章各测一次） | 0 / 0 | 0 / 0 |
| 控制台错误（exception + console.error + Log error） | 0 | 0 |

## 4. 测试状态（npm test 与 validate-v2）

- `node scripts/validate-v2.mjs`：**全部 PASS**（13 项检查，含新契约）。
- 按 `package.json` 的 `test` 脚本顺序逐条执行（跳过 `stamp-assets --check`）：**37 步，0 failures**。
- `npm test`：**exit 1，停在第一步** `stamp-assets.mjs --check` → `Stale asset revision in app.js; run npm run prepare:assets`。这是本轮修改 `public/app.js`、`public/style.css`、新增 `public/no-territory.js` 的必然结果；**盖章按你的分工留给你**，盖章后重跑 `npm test` 应全绿。

## 5. 观察（未修，超出本轮范围）

用 `#view=polities` 深链打开时，应用初始化后仍停在 Atlas 视图（`#contentView` 为空且 hidden），点击「文明」标签则正常。这是既有的视图深链行为，与本轮改动无关（未触及 `showView`/URL 处理）；浏览器测试因此像读者一样点击标签。若要修深链，建议另开一轮并覆盖 URL 解析与 `saveURL` 的交互。

## 6. 边界与承诺

- 未创建任何几何、未移动地图、未改动搜索、未改动 catalog/疆域数据。
- 5 篇档案保持 `boundaryCoverage: "not-in-source"`；拉帕努伊按裁决**不建档案**，缺口已在 `coverage.boundaryCoverage` 与 3.22 报告中显式登记。
- 改动文件：`public/no-territory.js`（新）、`public/app.js`、`public/style.css`、`scripts/validate-v2.mjs`、`docs/verification-3.22/`（本文件、browser-check 脚本与 JSON、negative-tests 脚本与 JSON、四张截图）。
