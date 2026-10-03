# 政体叙述第二批（3.23）：162 → 190

任务 task-28。基线提交 `7b609630`，本报告由 `docs/verification-3.23/report-narratives-round2-3.23.mjs --baseline=7b609630` 从本轮产物生成，可复跑。

**结论**：政体叙述由 **162 篇增至 190 篇（本轮新增 28 篇）**。目标约为 70 篇，**实际交付 28 篇**：选点、身份核验、维基百科证据与撰写规范都已跑通并留档，剩余 **42 个已选定并已核验的政体**未撰写，清单见 JSON 的 `remaining.pendingPlans`——**如实降数，不用单薄内容凑数**。

## 1. 结果摘要

| 指标 | 基线 | 本轮 |
|---|---|---|
| 叙述总数（narratives.json entries） | 162 | **190** |
| 本轮新增 | — | **28** |
| 已选定并核验、待撰写 | — | 42 |
| 1,455 份档案中仍无叙述 | 1293 | 1265 |

地区分布（本轮新增 28 篇）：africa 16、americas 12。**欧洲占 6/70 = 8.6%，低于 20% 上限**；非洲、美洲、南亚、东南亚与大洋洲优先。

## 2. 选点（复用 task-24 流水线，未重造）

- 脚本：`docs/verification-3.23/select-narratives-3.23.mjs` 沿用 3.21 的评分（疆域记录数、跨度、覆盖年数、最大面积、被 events/battles/city-narratives 提及次数、被引字段数）与地区优先级。
- 1,455 份档案中已有叙述 162 份、未覆盖 **1293 份**；未覆盖按地区：africa 201、west-central-asia 101、south-asia 113、americas 84、southeast-asia 46、europe 533、east-asia 158、global 32、oceania 25。
- 地区优先级：非洲、美洲、南亚、东南亚、大洋洲优先，欧洲占比上限 20%。选定时对**坐标箱规则做了人工复核**：七个被规则归入非洲的阿拉伯政体（示巴、希木叶尔、沙特、德拉伊耶、内志、杰贝勒沙马尔、卡塔尔）改记西亚，四个被归入非洲或美洲的欧洲宗主国（法兰西第三共和国、法兰西第二帝国、新国家体制、意大利帝国）改记欧洲——**欧洲占比按复核后的地区计算**。

## 3. 身份一手核验（本轮新增硬规则）

规则：**引用任何 QID 只能来自项目 catalog 的 `verifiedWikidata` 字段或 en.wikipedia 的 `pageprops.wikibase_item`，绝不从记忆取。**

- 候选核验脚本：`docs/verification-3.23/verify-candidates-3.23.mjs`，检查 265 个候选：catalog 绑定 + 英文条目 pageprops 反查 + Wikidata P31 类别。
- 结果：**235 个通过**、30 个因类别不是政体被排除、0 个未能核验（0 个进入批次）。
- 排除的典型：**大不列颠岛（Q23666，岛屿）**、维京人（Q12567，文化）、苏丹（Q43292，头衔）、霹雳/雪兰莪/登嘉楼苏丹（Q2649311 等，职位）、维基媒体消歧义页（Q4962 等）、西藏历史与苏美尔历史（历史主题）、奥尔梅克文明（文明）。
- 五条经手工排除并登记为缺口：Q617219（"English overseas possessions" is a description of a collection of territories, not a polity with its own records.）；Q223（Greenland is an island territory; the atlas records bound to it describe the island and its Danish autonomy rather than a sovereign polity of its own.）；Q2345840（"History of Sumer" is a history topic, not a polity.）；Q521263（"History of Tibet" is a history topic, not a polity.）；Q19951607（"French Colonial Africa" is a region, not a polity.）。
- 撰写批次的二次核验：`fetch-polity-extracts-3.23.mjs` 对每个政体实际使用的英文条目再查一次 pageprops，**70/70 条条目的 wikibase_item 与政体 QID 完全一致**，没有任何一条引用到别的实体。

## 4. 中文引用：先核验再引用

- 中文条目命中率低且搜索结果常是**无关条目**（例如把 Beylik of Tunis 搜成「东方危机」、把 Tarumanagara 搜成「塔鲁玛迦大学」、把 Bima 苏丹国搜成「文字列表」）。因此对每个标签缺失或搜索命中的政体都**逐条读导言**判断。
- 结果：**55 条接受中文引用**（pageprops item 与政体 QID 相同，或经人工读导言确认）、**15 条拒绝**，拒绝理由逐条记录在 `narratives-zh-verified.json`。
- 被拒绝的条目改用「英文条目 + 维基数据实体」两条 https 来源（核验依据：本批 5 条如此），**没有把无关中文条目当引用来凑数**。

## 5. 撰写规格与硬闸门

| 项目 | 实测 | 要求 |
|---|---|---|
| 四栏（政治/经济/文化/大事）中文长度 | 53–179 字 | 50–190 |
| 四栏英文长度 | 35–90 词 | 35–150 |
| 英文栏 CJK 字符 | 0 | 0 |
| 繁体字 | 0 | 0 |
| 每篇 https 来源 | 2–2 条（均带 checkedOn） | ≥2 |
| 疆域联系注记（「本站疆域数据收录…」） | 28/28 | 每篇 |
| 其中写明「覆盖很薄，不能据本站疆域记录推断疆域变化」 | 8 篇（本批薄覆盖 8 篇） | 记录<6 或跨度<60 年必写 |
| 每篇 2–3 条带年份 highlights | 28/28 | ≥2 |

schema 与既有 162 篇完全一致（qid/sourceNames/title/scope/sections/sources/facts/editorialNotes/…），字段名未改。`sourceNames` 取 catalog 记录的**精确名称**（不是简介标签），因此阅读器的 exact-name + verifiedWikidata 绑定成立。

## 6. 校验

| 命令 | exit | 末行 |
|---|---|---|
| `node scripts/validate-v2.mjs` | 0 | } |
| `node scripts/validate.mjs` | 0 | {"result":"passed","checks":10,"events":709,"boundaryRecords |
| `node scripts/validate-release.mjs` | 0 | {"result":"passed","checks":4,"staticFiles":17743,"physicalF |
| `node scripts/validate-polity-period.mjs` | 0 | PASS 30/30 real polity dossier regressions |
| `node scripts/places/audit-language.mjs . docs/verification-3.23/narratives-language-audit.json` | 0 | } |
| `node docs/verification-3.23/build-narratives-batch-3.23.mjs --check` | 0 | } |
| `node docs/verification-3.23/write-narratives-gz-3.23.mjs --check` | 0 | } |

`narratives.json.gz`：mtime 字节 = 0，与 .json deepEqual = true，条目数 190。validate-v2 的「压缩叙述与可编辑源一致」与「叙述绑定到精确记录」两项均通过。

## 7. 仍缺什么

1. **42 个已选定、已核验的政体尚未撰写**（本轮计划 70 篇，实际完成 28 篇）。它们的英文/中文维基导言已在 `narratives-extracts.json` 中取好，身份已核验，下一轮可直接撰写，无需重跑选点与核验。
2. **1,455 份档案中仍有 1265 份没有叙述**，其中 533 份属欧洲（受 20% 上限约束，只能分批写）。
3. **中文覆盖**：本批 5 条没有中文维基条目可引，用「英文条目+维基数据实体」替代；中文阅读体验依赖条目自身的中文叙述，而非中文来源。

## 8. 诚实声明

- 本轮**没有**为了凑够 70 篇而降低规格：完成 28 篇，其余如实登记为待撰写。
- 身份核验是硬门槛：不从记忆取 QID；岛屿、人群、头衔、历史主题被排除并登记为缺口；每篇英文引用都通过 pageprops 反查确认。
- 疆域联系如实：每篇写明本站记录数与年份范围；薄覆盖（<6 条或跨度<60 年）一律写明不能据此推断疆域变化。
- 没有跑 `prepare:assets`；除 `public/data/enrichment/narratives.json(+.gz)` 外未改任何 public/ 产品文件。
