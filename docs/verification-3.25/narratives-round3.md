# 政体叙述第三批（3.25）：190 → 231

任务 task-30。基线提交 `7b609630`，本报告由 `docs/verification-3.25/report-narratives-round3-3.25.mjs --baseline=7b609630` 从两轮产物生成，可复跑。

**结论**：政体叙述 **190 → 231 篇**（本轮 +41，连同上一轮完成 3.23 选定的 70 个计划中的 **69 个**）。1,455 份档案中无叙述者由 1,293 降至 **1224**。规格、schema、引用核验与 apply 流程全部沿用上一批，未重造流水线。

## 1. 结果摘要

| 指标 | 基线 | 本轮 |
|---|---|---|
| 叙述总数 | 190 | **231** |
| 本轮新增 | — | **41** |
| 两轮合计完成 3.23 计划 | — | 69 / 70 |
| 1,455 份档案中仍无叙述 | 1,293 | 1224 |
| 绑定疆域记录 | — | 3,522 条 |

地区分布（69 篇）：africa 16、americas 16、south-asia 14、southeast-asia 14、oceania 3、europe 6。

## 2. 身份核验硬规则的效果（Lead 要求留档）

规则：**引用任何 QID 只能来自项目 catalog 的 `verifiedWikidata` 或 en.wikipedia 的 `pageprops.wikibase_item`，绝不从记忆取；Wikidata 类别不是政体的实体不建档案，登记为缺口。**

- 共核验 **265 个候选**：235 个通过、**30 个因类别不是政体被排除**、0 个未能核验。
- 被这条规则挡下的典型（都是"看名字像政体、看实体不是"）：

| qid | 名称 | Wikidata 类别 |
|---|---|---|
| Q23666 | 大不列颠岛 | island |
| Q4962 | null | Wikimedia disambiguation page |
| Q494354 | 喀喇汗国 | historical country、nomadic confederacy、khanate、family |
| Q832554 | 阿根廷邦联 | historical period、confederation |
| Q466803 | 拔罗婆王朝之起源 | historical country、dynasty、historical period |
| Q12567 | 维京人 | historical period、culture、style、historical ethnic group |
| Q69829 | 法兰西第四共和国 | republic regime in France、historical period、historical country |
| Q177819 | 古王国时期 | era、historical country、historical period |
| Q1109279 | 墨西哥合众国 | historical period、historical country |
| Q703919 | 吴朝 | dynasty、historical period、kingdom |
| Q1155700 | 拉达那哥欣王国 | historical period、country、historical country |
| Q10914393 | 新亚述帝国 | historical country、historical period、style、empire |

- **二次核验**：撰写批次实际引用的英文条目逐条再查 pageprops，**70/70 条的 wikibase_item 与政体 QID 完全一致**——即本批 70 篇没有一条引用到别的实体。
- **本轮追加的缺口**：Q1794655 **Kutai** 类别含"Indonesian monarchy / historical country"，但其唯一的英文条目记述的是历史地区与古泰人，而不是国家；按规则**不建档案**，登记为缺口。这是 70 个计划中唯一未撰写的一条。
- 手工排除并登记的其他缺口：`Q617219`、`Q223`、`Q2345840`、`Q521263`、`Q19951607`。

## 3. 中文引用：先核验再引用

- 70 个计划中 **55 条接受中文引用、15 条拒绝**。拒绝理由逐条留档，典型如：
  - `Q4899891`：searched candidates are the Ottoman vilayet, the Eastern Crisis and unrelated biographies; none documents the Beylik of Tunis
  - `Q1709337`：no Chinese article about the Emirate of Nekor; the search returned an unrelated list and biographies
  - `Q309272`：the candidates are the Roman provinces Mauretania Caesariensis and Tingitana, not the kingdom of Mauretania
  - `Q748595`：no Chinese article about Qataban; the search returned unrelated lists
  - `Q1109279`：the candidates are the modern country and unrelated articles; none documents the First Mexican Republic
  - `Q466803`：the candidates are the Pala dynasty, Tamil people and unrelated topics, not the Pallava dynasty
- 被拒条目改用「英文条目 + 维基数据实体」两条 https 来源（本批共 15 条如此），**没有把无关中文页面当引用**。
- 需特别说明：For three entries the Chinese introduction captured in the first pass belonged to an unrelated page (Laos, a university, Islam in Indonesia); those entries were written from the English introduction and the Chinese citation is kept only because pageprops confirmed the article documents the same polity.

## 4. 规格实测（69 篇）

| 项目 | 实测 | 要求 |
|---|---|---|
| 四栏中文长度 | 50–179 字 | 50–190 |
| 四栏英文长度 | 35–95 词 | 35–150 |
| 英文栏 CJK | 0 | 0 |
| 繁体字 | 0 | 0 |
| https 来源/篇 | 2–2 条（含 checkedOn） | ≥2 |
| 疆域联系注记（"本站疆域数据收录…"） | 69/69 | 每篇 |
| 薄覆盖写明"覆盖很薄，不能据本站疆域记录推断疆域变化" | 18 篇（薄覆盖计划 18 个） | <6 条或跨度<60 年必写 |

## 5. 校验

| 命令 | exit |
|---|---|
| `node scripts/validate-v2.mjs` | 0 |
| `node scripts/validate.mjs` | 0 |
| `node scripts/validate-release.mjs` | 0 |
| `node scripts/validate-polity-period.mjs` | 0 |
| `node scripts/places/audit-language.mjs . docs/verification-3.25/narratives-language-audit.json` | 0 |
| `node docs/verification-3.23/build-narratives-batch-3.23.mjs --check` | 0 |
| `node docs/verification-3.23/write-narratives-gz-3.23.mjs --check` | 0 |

`narratives.json.gz`：mtime 字节 0/0/0/0，与 .json deepEqual = true，条目数 231。validate-v2 的"压缩叙述与可编辑源一致"和"叙述绑定到精确记录"两项均通过。

## 6. 仍缺什么

1. **Kutai（Q1794655）未撰写**：实体类别与条目主题不一致（地区/人群 vs 政体），按身份规则登记为缺口，已在第 2 节说明。
2. **1,455 份档案中仍有 1224 份没有叙述**；选点脚本与身份核验脚本可直接复用，欧洲档案受 20% 上限约束只能分批推进。
3. **15 条没有中文维基来源可引**：改用英文条目 + 维基数据实体，中文阅读体验依赖条目自身的中文叙述。
4. **三条条目的中文导言在首轮抓取中取错**（拉达那哥欣、塔鲁曼内格拉、马京达瑙）：叙述依据英文条目撰写，中文引用仅在 pageprops 核验一致后保留。若后续要做中文来源深读，应重取这三条。

## 7. 诚实声明

- 身份核验是硬门槛：不从记忆取 QID，不是政体就不建档案（Kutai 即按此处理）。
- 疆域联系如实：每篇写明本站记录数与年份范围，薄覆盖一律写明不能据此推断疆域变化。
- 没有编造引用；没有跑 `prepare:assets`；除 `public/data/enrichment/narratives.json(+.gz)` 外未改任何 public/ 产品文件。
