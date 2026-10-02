# 3.14 内容升级报告：结构化索引事件升级与战役层地区补强

任务：task-16。基线 HEAD `ba7ca762`。所有数字来自本轮实际运行，脚本与产物都在仓库内可复现。

## 0. 结论速览

- 结构化索引条目（`provenance=wikidata-structured`）：**291 → 251**（升级 40 条，用户检索热度排名前 40）。
- 事件总数不变：**709**（编辑级 458 条 + 索引级 251 条）。
- 升级条目 id 全部保持 `v312wd-<qid>` 不变，`provenance` 字段整体删除，`wikidataQid` 保留。
- 战役层：**486 → 506** 条；大洋洲 **6 → 14**、东南亚 **16 → 28**、南亚 22（池已抽干）；欧洲仍为 199，**无法达到与欧洲同数量级**，原因见第 6 节。
- 修正一处系统性年代错误：Wikidata 的 ISO 8601 天文纪年（有 0 年）被直接写入本项目无 0 年的民用纪年，导致全部 BCE 条目偏 +1 年。事件层修正 27 条索引条目（升级的 40 条在撰写时即用民用纪年），战役层修正 70 条。
- 验证：validate / validate-v2 / validate-places / validate-city-time / validate-polity-period / validate-release 全部 exit 0；validate-battles **true/undefined PASS**；audit-language 英文栏 CJK = 0，结构化计数 = 251；两个 .gz 头 mtime=0 且与 .json deepEqual。
- 浏览器（真实 Chrome headless，经 CDP）：年表 709 行、带索引标记 251 行（= 结构化计数）；抽查 3 条升级事件均无标记，2 条未升级索引条目仍带标记。

## 1. 热度判定方法（可复现）

脚本：`scripts/places/rank-structured-events.mjs` → `docs/verification-3.14/content-upgrade-ranking.json`（原始响应与请求日志见同目录 `content-upgrade-ranking-raw.json`）。

评分公式（写入脚本与报告，未事后调整）：

    score = 3 × (有中文维基条目) + min(sitelinks, 40) / 10 + 0.5 × (维基数据记录 P710 参战方)

- 三项证据逐条记录：`zhArticle`（WDQS 简单模式查 zh.wikipedia sitelink）、`sitelinks`（**单独**发的 COUNT 查询，不与 OPTIONAL 混用，避免 504）、`hasParticipants`（P710）。
- 并列打破顺序：既有编辑叙述中的字面提及（QID 或中英文标题出现在 `public/data/enrichment/narratives.json` / `editorial/city-narratives.json`）→ 战役层重叠 → sitelinks → 年代早者 → QID。
- 请求与限速：291 个 QID 分 4 批（80/批），WDQS 共 8 次请求（每批 2 次），请求间隔 4s，429/5xx 退避 15s×attempt、最多 4 次；标题再经 Wikidata Action API（wbgetentities，50/批，6 次）交叉核对，WDQS 中文标题与 API 标题不一致 0 条。本轮未触发 429。
- 覆盖：291 条中 159 条有中文维基条目、244 条有 P710；最高 sitelinks = 88。

选取：排名前 40 条（任务要求 30–50，预留容错）。地区分布由排名客观决定：{"west-central-asia":5,"south-asia":5,"east-asia":2,"americas":2,"africa":7,"europe":19}——结构化的 291 条本身就偏欧洲（92 条），热度榜前 40 因此以欧洲、非洲、西亚为主。

## 2. 升级批次（40 条）

产物：`editorial/events-upgraded-3.14.json`，合并工具 `scripts/places/apply-events-3.10.mjs --batch=...`（先 `--check` 通过再写入）。每条包含：

- `summary.zh` 110–135 字、`summary.en` 45–60 词（脚本计量，40/40 落在区间内）；`significance` 各 1 句；`editorialNotes` 写断代/兵力争议。
- `sources` 至少 2 条 https：英文维基 + 中文维基（CC BY-SA 4.0），每条带 `accessedAt: 2026-10-03`；80 个 URL 经 MediaWiki API 逐条确认存在（en 40/40、zh 40/40，缺失 0）。
- 坐标、地区、类别、locationType 继承原结构化条目的来源值不变；`wikidataQid` 保留；`provenance` 与结构化免责语一并删除（卡片虚线框、悬停提示与年表行内标记都以 `e.provenance` 触发，删除后标记即消失）。

### 2.1 id 对照表（id 不变，provenance 变更）

| rank | id | QID | 中文标题 | 年 | 地区 | sitelinks | 原文条 | 分数 | 来源数 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `v312wd-q200032` | Q200032 | 曼齐刻尔特战役 | 1071 | west-central-asia | 64 | 曼齐刻尔特战役 | 7.5 | 2 |
| 2 | `v312wd-q605321` | Q605321 | 第一次帕尼帕特战役 | 1526 | south-asia | 47 | 第一次帕尼帕特之戰 | 7.5 | 2 |
| 3 | `v312wd-q234188` | Q234188 | 关原之战 | 1600 | east-asia | 47 | 關原之戰 | 7.5 | 2 |
| 4 | `v312wd-q52418` | Q52418 | 珍珠港事件 | 1941 | americas | 88 | 珍珠港事件 | 7.5 | 2 |
| 5 | `v312wd-q486124` | Q486124 | 白德尔之战 | 624 | africa | 81 | 巴德尔之役 | 7.5 | 2 |
| 6 | `v312wd-q83224` | Q83224 | 黑斯廷斯战役 | 1066 | europe | 81 | 黑斯廷斯之战 | 7.5 | 2 |
| 7 | `v312wd-q31900` | Q31900 | 马拉松战役 | -490 | europe | 76 | 马拉松战役 | 7.5 | 2 |
| 8 | `v312wd-q134114` | Q134114 | 奥斯特里茨战役 | 1805 | europe | 75 | 奧斯特利茨之戰 | 7.5 | 2 |
| 9 | `v312wd-q173077` | Q173077 | 图尔战役 | 732 | europe | 69 | 圖爾戰役 | 7.5 | 2 |
| 10 | `v312wd-q178850` | Q178850 | 萨拉米斯战役 | -480 | europe | 67 | 薩拉米斯海戰 | 7.5 | 2 |
| 11 | `v312wd-q178510` | Q178510 | 第一次摩哈赤战役 | 1526 | europe | 67 | 摩哈赤战役 | 7.5 | 2 |
| 12 | `v312wd-q87779` | Q87779 | 条顿堡森林战役 | 9 | europe | 65 | 條頓堡森林之戰 | 7.5 | 2 |
| 13 | `v312wd-q179670` | Q179670 | 高加米拉战役 | -331 | west-central-asia | 64 | 高加米拉戰役 | 7.5 | 2 |
| 14 | `v312wd-q488278` | Q488278 | 乌胡德战役 | 625 | africa | 64 | 武侯德戰役 | 7.5 | 2 |
| 15 | `v312wd-q139808` | Q139808 | 沙隆战役 | 451 | europe | 59 | 沙隆之戰 | 7.5 | 2 |
| 16 | `v312wd-q192660` | Q192660 | 冲绳岛战役 | 1945 | east-asia | 58 | 沖繩島戰役 | 7.5 | 2 |
| 17 | `v312wd-q203729` | Q203729 | 卡迭石战役 | -1274 | africa | 56 | 卡迭石战役 | 7.5 | 2 |
| 18 | `v312wd-q203225` | Q203225 | 斯坦姆福德桥战役 | 1066 | europe | 55 | 斯坦福桥之战 | 7.5 | 2 |
| 19 | `v312wd-q192473` | Q192473 | 阿德里安堡战役 | 378 | europe | 51 | 阿德里安堡戰役 | 7.5 | 2 |
| 20 | `v312wd-q108102583` | Q108102583 | 攻占喀布尔 | 2021 | south-asia | 51 | 喀布爾戰役 (2021年) | 7.5 | 2 |
| 21 | `v312wd-q213074` | Q213074 | 希达斯皮斯河战役 | -326 | south-asia | 50 | 希達斯皮斯河戰役 | 7.5 | 2 |
| 22 | `v312wd-q339321` | Q339321 | 米尔维安大桥战役 | 312 | europe | 45 | 米尔维安大桥战役 | 7.5 | 2 |
| 23 | `v312wd-q332543` | Q332543 | 金字塔战役 | 1798 | africa | 45 | 金字塔之戰 | 7.5 | 2 |
| 24 | `v312wd-q1639459` | Q1639459 | 穆厄塔战役 | 629 | west-central-asia | 44 | 穆阿泰之战 | 7.5 | 2 |
| 25 | `v312wd-q504172` | Q504172 | 瓜达莱特之战 | 711 | europe | 44 | 瓜达莱特战役 | 7.5 | 2 |
| 26 | `v312wd-q957186` | Q957186 | 科瓦东加战役 | 718 | europe | 44 | 科瓦東加戰役 | 7.5 | 2 |
| 27 | `v312wd-q733364` | Q733364 | 米吉多战役 | -1457 | west-central-asia | 38 | 米吉多战役 | 7.3 | 2 |
| 28 | `v312wd-q47465940` | Q47465940 | 橄榄枝行动 | 2019 | europe | 37 | 橄欖枝行動 | 7.2 | 2 |
| 29 | `v312wd-q1233475` | Q1233475 | 龙塞斯瓦列斯山口战役 | 778 | europe | 36 | 龍塞斯瓦列斯山口戰役 (778年) | 7.1 | 2 |
| 30 | `v312wd-q1259218` | Q1259218 | 第三次帕尼帕特战役 | 1761 | south-asia | 40 | 第三次帕尼帕特之戰 | 7 | 2 |
| 31 | `v312wd-q1165502` | Q1165502 | 埃德萨战役 | 260 | europe | 35 | 埃德萨之战 | 7 | 2 |
| 32 | `v312wd-q41894` | Q41894 | 新奥尔良战役 | 1815 | americas | 35 | 新奥尔良之战 | 7 | 2 |
| 33 | `v312wd-q1121532` | Q1121532 | 三王战役 | 1578 | africa | 33 | 三王战役 | 6.8 | 2 |
| 34 | `v312wd-q2355467` | Q2355467 | 布克萨尔战役 | 1764 | south-asia | 33 | 布克萨尔战役 | 6.8 | 2 |
| 35 | `v312wd-q655777` | Q655777 | 阿利亚之战 | -387 | europe | 32 | 阿利亚之战 | 6.7 | 2 |
| 36 | `v312wd-q849653` | Q849653 | 塔普苏斯会战 | -46 | africa | 31 | 薩普蘇斯戰役 | 6.6 | 2 |
| 37 | `v312wd-q1127337` | Q1127337 | 格劳庇乌山战役 | 83 | europe | 31 | 格劳庇乌山战役 | 6.6 | 2 |
| 38 | `v312wd-q603549` | Q603549 | 纳哈凡战役 | 642 | africa | 31 | 纳哈万德战役 | 6.6 | 2 |
| 39 | `v312wd-q18071930` | Q18071930 | 科巴尼之战 | 2014 | europe | 31 | 科巴尼之戰 | 6.6 | 2 |
| 40 | `v312wd-q734700` | Q734700 | 阿瓦拉尔战役 | 451 | west-central-asia | 30 | 阿瓦拉尔战役 | 6.5 | 2 |

**provenance 变更**：上述 40 条在 HEAD 中均为 `provenance=wikidata-structured`，合并后该字段不存在（既非 `editorial` 也非其它值），40/40 已核对；其余 251 条索引条目保持 `wikidata-structured` 不变。

### 2.2 标题修订（0 条，均为更准确的条目名或繁体→简体）

| id | title.zh 前 → 后 | title.en 前 → 后 |
|---|---|---|

## 3. 防回退（关键）

1. `scripts/places/build-structured-events.mjs` 现在读取 `editorial/events-upgraded-*.json` 的全部 QID 并跳过；同时跳过 `events.json` 中 id 形如 `v312wd-*` 且无 `provenance` 的实体（双保险）。
2. 干跑证据：`node scripts/places/build-structured-events.mjs --count=275 /tmp/regen-275b.json` → 生成 253 条，**升级的 40 个 QID 泄漏 0 个**（候选池 1480）。
3. 索引批次回写：新增 `scripts/places/export-structured-batch.mjs`，把线上 251 条索引条目回写成 `editorial/events-wikidata-3.12.json`（251 条，含民用纪年，不含 40 个升级 QID）。校验：线上索引集合与批次集合逐一相等 true。这样即使有人再次执行 `apply-events-3.10.mjs`，也不会把升级条目打回索引级。

## 4. 民用纪年修正（发现的系统性错误）

**问题**：`editorial/battles-wikidata-source.json` 的年份直接取自 Wikidata P585，而 WDQS 返回 ISO 8601 天文纪年（存在 0 年，ISO -489 = 公元前 490 年）；本项目（含 `public/data/catalog.json`，如阿契美尼德 -550）使用无 0 年的民用纪年，`formatYear(-221)` 输出 “221 BCE”。两者相差 1 年，全部 BCE 条目受影响。

**修正**：

- `build-structured-events.mjs`、`build-battles.mjs` 均加 `isoYear<=0 ? isoYear-1 : isoYear` 转换；新增 `scripts/places/normalize-civil-years-3.14.mjs` 修正已发布数据（幂等，`--check` 可只读）。
- 事件层：升级的 40 条在撰写时即用民用纪年（马拉松 -490、萨拉米斯 -480、高加米拉 -331、卡迭石 -1274、米吉多 -1457…）；其余索引条目修正 27 条（如三角洲之战 -1177→-1178、卡尔卡尔之战 -852→-853）。
- 战役层：70 条 BCE 全部 -1（例：米吉多 -1456→-1457、卡迭石 -1273→-1274、马拉松 -489→-490），40 条与事件层同源的实体**年份差 0**（跨层一致）。

## 5. 事件层确证数字

| 指标 | HEAD | 现在 |
|---|---|---|
| 事件总数 | 709 | 709 |
| wikidata-structured | 251 | 251 |
| 编辑级（无 provenance） | 458 | 458 |
| 升级批次数 | — | 40 |
| 索引批次条目数 | 251 | 251 |

`public/data/events.json.gz`：gzip 头 mtime=0、OS=255，gunzip 后与 .json deepEqual = true。

## 6. 战役层地区补强（含诚实边界）

改动：

- `build-battles.mjs` 新增**薄地区保底**：大洋洲、南亚、东南亚三个坐标框内凡满足「有坐标 + 有年代 + 有中文名」的实体全部收录，不再被每世纪配额与 9 条/地区上限挤掉；该规则只增不减。
- 保底补入 20 条（大洋洲 +8、东南亚 +12），全部来自可核验来源（Wikidata P625 坐标、P585 年代、中文标签），中文名来源 `wikidata-zh-label` 506/506。
- 新增 `scripts/places/fetch-thin-region-battles.mjs`：对三个坐标框做宽类目扫描（battle 及其子类、naval battle、siege、military operation、massacre），类目 QID 逐条记录以便审计；坐标与年代仍是硬标准。

| 地区 | HEAD | 现在 | 可核验池（有坐标+年代） | 其中有中文名 | 说明 |
|---|---|---|---|---|---|
| 大洋洲 | 6 | 14 | 23 | 14 | 池本身只有 23 条；9 条无中文名，其中 0 条有中文维基条目 |
| 南亚 | 22 | 22 | 60 | 22 | 有中文名的 22 条已全部收录，池已抽干 |
| 东南亚 | 16 | 28 | 62 | 28 | 保底补入 12 条此前被配额挤掉的条目 |
| 欧洲 | 199 | 199 | 1738 | 899 | 参照系 |

**为什么做不到「与欧洲可比」**：Wikidata 的 battle 类实体中，欧洲有 1738 条满足坐标+年代，大洋洲只有 23 条、南亚 60 条、东南亚 62 条——这不是选取策略问题，而是来源池的客观差距。三条硬标准（坐标来自 P625、年代来自 P585、必须有中文名）一条都没有放宽：三个地区共 81 条实体因没有任何中文名被排除（Wikidata 无中文标签且无 zh.wikipedia 条目，实测可回退恢复 0 条）。因此本轮的答案是：把池里合格的全部收录（大洋洲 14、南亚 22、东南亚 28），并在报告里给出池的规模，而不是用估算坐标或无来源条目凑数。

宽类目扫描的现状：类目侧子类遍历查询在 WDQS 上多次 504/超时，本轮**未完成**，因此上面数字仅来自 battle 类（含其子类；naval battle 本身是 battle 的子类）。一次 COUNT 探针显示大洋洲坐标框内 4 个宽类目有 159 条带坐标+年代的实体，是明确的后续增量方向，但其中有多少具备中文名未知，本轮不写入数据。脚本已就绪，WDQS 空闲时可重跑 `node scripts/places/fetch-thin-region-battles.mjs`，`build-battles.mjs` 会自动合并。

## 7. 验证记录

全部为实际执行结果：

- `node scripts/validate.mjs` → PASS（9 项检查，events 709）；`validate-v2.mjs` → PASS 9 项；`validate-places.mjs` → PASS 20 项；`validate-city-time.mjs` → PASS；`validate-polity-period.mjs` → PASS 30/30；`validate-release.mjs` → PASS 4 项（17730 静态文件、357 物理资产、11307 原生分片）
- `node scripts/places/validate-battles.mjs . docs/verification-3.14/content-battles-validation.json` → **true/undefined PASS**（506 条，带参考链接 7 条）
- `node scripts/places/audit-language.mjs . docs/verification-3.14/content-language-audit.json` → 英文栏 CJK = 0（events）、受影响战役条目 0 条
- gz 校验：`events.json.gz` / `battles.json.gz` 头 mtime=0、OS=255，gunzip 与 .json deepEqual true
- 浏览器（Chrome/154.0.8037.98 headless，CDP，`http://127.0.0.1:8767/#view=library`）：年表 709 行，带 `structured-index` 标记 251 行（= 251）；抽查 `v312wd-q733364`（米吉多战役）、`v312wd-q83224`（黑斯廷斯战役）、`v312wd-q52418`（珍珠港事件）→ marked=false、无索引提示；对照 `v312wd-q1036947`、`v312wd-q849474`（未升级）→ marked=true、提示文字为「结构化索引条目 · 取自维基数据声明，未经独立考订」。地图侧栏 1066 年窗口：48 张卡片、9 张带标记，黑斯廷斯卡片 structured=false 且 title 为空。

## 8. 变更文件

新增脚本：`scripts/places/rank-structured-events.mjs`、`fetch-upgrade-extracts.mjs`、`fetch-thin-region-battles.mjs`、`normalize-civil-years-3.14.mjs`、`export-structured-batch.mjs`。
修改脚本：`build-structured-events.mjs`（跳过已升级 QID + 民用纪年）、`build-battles.mjs`（合并薄地区批次 + 保底 + 民用纪年 + 名字来源统计）。
数据：`editorial/events-upgraded-3.14.json`（新）、`editorial/events-wikidata-3.12.json`（回写为 251 条）、`public/data/events.json(+.gz)`、`public/data/battles.json(+.gz)`。
报告与证据：`docs/verification-3.14/` 下 `content-upgrade.md/.json`、`content-upgrade-ranking.json(-raw.json)`、`content-language-audit.json`、`content-battles-validation.json`。
未触碰：`public/` 下产品代码（app.js、index.html、style.css 等）；未运行 `npm run prepare:assets`。

## 9. 回滚

- 事件层：`git checkout HEAD -- public/data/events.json public/data/events.json.gz`（可选加 `editorial/events-wikidata-3.12.json`）。
- 战役层：`git checkout HEAD -- public/data/battles.json public/data/battles.json.gz`。
- 只回滚纪年修正：对 `normalize-civil-years-3.14.mjs` 的产物执行上面的 checkout；脚本不再运行即不再生效。
- 脚本改动（防回退 + 纪年转换）如不同意，可单独 revert 对应补丁。

## 10. 遗留与建议

1. 宽类目战役扫描未完成（WDQS 504）：脚本已就绪，建议 WDQS 空闲时重跑并重跑 `build-battles.mjs`，预计可再补一批大洋洲/东南亚条目（探针显示大洋洲 4 个宽类目有 159 条候选）。
2. 仍有 132 条结构化事件没有中文维基条目（升级价值最低），本轮未升级；下一轮可按同一排名继续取 41–80 名。
3. `npm test` 的 `stamp-assets --check` 取决于 `public/app.js` 的当前内容；本轮未改任何 public 产品文件，若其他同伴的 app.js 改动尚未盖章，需要 Lead 统一跑 `npm run prepare:assets`。

