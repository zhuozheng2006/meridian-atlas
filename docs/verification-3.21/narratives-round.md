# 3.21 政体四栏叙述扩容报告：95 → 162 篇

任务：task-24。对照基线提交 `9a3a691f`（本轮写入前 HEAD；该提交已包含其它工作流的改动，但 narratives.json 仍是 95 篇）。所有数字来自本轮实际运行，脚本与产物都在仓库内可复现。

## 0. 结论速览

- 政体四栏叙述 **95 → 162 篇**（本轮新增 **67 篇**）；政体档案总数 1,450，覆盖率从 6.6% 提升到 11.2%。
- 新增条目按**覆盖不足地区优先**分布：非洲 12、美洲 11、南亚 10、东南亚 10、大洋洲 4、西亚 8、东亚 5、**欧洲仅 7**。
- 每篇严格沿用既有 schema 与**四栏结构**（politics / economy / culture / events），中英双语；新增来源 **每篇 2 条 https**（英文维基 + 中文维基，`checkedOn` 2026-10-03），共 134 条链接。
- 四栏中文字数：最短 63、中位 113、最长 189；英文：最短 36、中位 60、最长 98 词；每篇 2–3 条带年份的 highlights；均落在装配脚本设定的区间内。
- **疆域联系如实写入**：每篇的 editorialNotes 自动带上"本站疆域数据收录 N 条记录、年份范围 X—Y"；其中 **11 篇**记录少于 6 条或跨度不足 60 年，注记明确写"覆盖很薄，不能据本站疆域记录推断其疆域变化"。
- 验证：`validate-v2`（含"压缩叙述与可编辑源一致"与逐条 binding 检查）、`validate`、`validate-release`、`audit-language` 全部 exit 0；`narratives.json.gz` 头 mtime=0 且与 `.json` deepEqual。
- 关键前提已实测确认：`apply-enrichment-3.12.mjs` 是**按 id 合并**而不是重建，既有 95 篇（含 26 篇不在可编辑源里的早期重磅条目与 3 篇 snapshot）不会被冲掉（证据见第 5 节）。

## 1. 选点方法与依据（可复现）

脚本：`docs/verification-3.21/select-narratives-3.21.mjs` → `docs/verification-3.21/narratives-selection.json`。对 1,450 份档案逐一计算：

| 指标 | 含义 |
|---|---|
| recordCount | `public/data/fast/catalog.json.gz` 中该实体的 POLITY 疆域记录数（疆域记录最多者） |
| spanYears / yearsCovered | 这些记录的最大跨度与累计年份（跨年最长者） |
| areaMax | 单条记录最大面积（在地图上占多大） |
| mentions | 该实体名称在 events.json、battles.json、city-narratives.json 中的出现次数（用户是否会遇到） |
| citedFields | 档案中至少带 1 条参考文献的字段数（可写性） |
| region | 既有坐标框规则 + 人工复核（`regionReviewed`），多地区实体取记录多数地区 |

评分 = `0.35·min(recordCount,25) + 0.5·min(spanYears/100,20) + 0.4·min(yearsCovered/200,15) + 0.9·min(mentions,12) + 0.12·min(citedFields,25) + 1.5·地区优先级`。提及次数采用保守匹配：拉丁名整词匹配、中文名后接续字不算（避免"印度"命中"印度尼西亚"）。

在评分之上按地区配额选取（非洲/美洲/南亚/东南亚/大洋洲优先，欧洲仅 7 篇），并保证年代分布：古典 15、中世纪 18、近代早期 9、近代 7、当代 12、上古 6。落选的 1,288 个档案按地区仍待补，见第 7 节。

## 2. 新增清单（67 篇）

| qid | 中文标题 | 地区 | 年代 | scope | 疆域记录 | 四栏中文字数（政/经/文/事） | 来源 | 疆域池薄 |
|---|---|---|---|---|---|---|---|---|
| Q241790 | 库施王国 | africa | classical | -1000..346 | 7 | 149/102/92/76 | 2 | |
| Q829356 | 马库里亚王国 | africa | medieval | 347..1518 | 13 | 145/109/117/80 | 2 | |
| Q2320005 | 托勒密王国 | africa | classical | -331..-28 | 26 | 128/103/105/84 | 2 | |
| Q180568 | 新王国时期的埃及 | africa | ancient-iron | -1500..-801 | 7 | 146/97/108/98 | 2 | |
| Q75613 | 穆拉比特王朝 | africa | medieval | 1056..1205 | 11 | 143/102/123/77 | 2 | |
| Q199688 | 穆瓦希德王朝 | africa | medieval | 1139..1343 | 17 | 140/96/103/88 | 2 | |
| Q752662 | 哈夫斯王朝 | africa | medieval | 1236..1571 | 12 | 146/112/110/88 | 2 | |
| Q370736 | 开普殖民地 | africa | modern | 1796..1884 | 19 | 141/101/115/80 | 2 | |
| Q115 | 埃塞俄比亚 | africa | contemporary | 1942..2024 | 7 | 177/103/121/103 | 2 | |
| Q1033 | 尼日利亚 | africa | contemporary | 1961..2024 | 3 | 133/107/130/75 | 2 | 薄 |
| Q79 | 埃及 | africa | contemporary | 1953..2024 | 6 | 154/108/121/96 | 2 | |
| Q1028 | 摩洛哥 | africa | modern | 1670..2024 | 14 | 159/117/118/73 | 2 | |
| Q30 | 美国 | americas | modern | 1776..2024 | 73 | 140/120/122/98 | 2 | |
| Q96 | 墨西哥 | americas | contemporary | 1868..2024 | 9 | 147/124/114/92 | 2 | |
| Q155 | 巴西 | americas | contemporary | 1890..2024 | 12 | 141/128/115/85 | 2 | |
| Q419 | 秘鲁 | americas | modern | 1822..2024 | 14 | 152/110/117/94 | 2 | |
| Q16 | 加拿大 | americas | contemporary | 1932..2024 | 5 | 138/111/110/104 | 2 | 薄 |
| Q80702 | 西班牙帝国 | americas | early-modern | 1516..1931 | 157 | 167/124/106/93 | 2 | |
| Q200464 | 葡萄牙帝国 | americas | early-modern | 1502..1910 | 146 | 164/122/111/83 | 2 | |
| Q170604 | 新法兰西 | americas | early-modern | 1609..1791 | 37 | 175/129/127/100 | 2 | |
| Q68518 | 易洛魁联盟 | americas | early-modern | 1450..1782 | 24 | 133/115/121/85 | 2 | |
| Q172613 | 特奥蒂瓦坎 | americas | classical | -50..704 | 4 | 132/108/124/84 | 2 | 薄 |
| Q478805 | 阿那萨吉人 | americas | medieval | 850..1304 | 5 | 151/116/121/85 | 2 | 薄 |
| Q668 | 印度 | south-asia | contemporary | 1947..2024 | 12 | 160/142/133/103 | 2 | |
| Q843 | 巴基斯坦 | south-asia | contemporary | 1947..2024 | 11 | 155/119/116/89 | 2 | |
| Q42534 | 印度河流域文明 | south-asia | ancient-early | -3000..-1701 | 8 | 141/112/115/94 | 2 | |
| Q5724 | 阿努拉德普勒 | south-asia | classical | -291..1017 | 5 | 124/120/121/91 | 2 | 薄 |
| Q43100 | 克什米尔 | south-asia | medieval | 626..1343 | 29 | 133/110/121/84 | 2 | |
| Q5324 | 瞿折罗-普腊蒂哈腊王朝 | south-asia | medieval | 732..1039 | 22 | 127/110/104/70 | 2 | |
| Q249578 | 加兹尼王朝 | south-asia | medieval | 962..1209 | 18 | 128/109/121/89 | 2 | |
| Q844910 | 潘地亚王朝 | south-asia | medieval | 592..1325 | 9 | 155/102/105/83 | 2 | |
| Q266923 | 迈索尔土邦 | south-asia | early-modern | 1572..1799 | 5 | 141/111/110/81 | 2 | 薄 |
| Q837 | 尼泊尔 | south-asia | modern | 1775..2024 | 19 | 189/113/130/121 | 2 | |
| Q216786 | 占城 | southeast-asia | medieval | 207..1652 | 17 | 153/123/106/85 | 2 | |
| Q430309 | 大越 | southeast-asia | early-modern | 1683..1833 | 7 | 130/119/107/73 | 2 | |
| Q1057118 | 真腊 | southeast-asia | medieval | 555..805 | 14 | 160/115/96/74 | 2 | |
| Q867782 | 扶南 | southeast-asia | classical | 51..640 | 4 | 133/117/104/76 | 2 | 薄 |
| Q1469742 | 巽他王国 | southeast-asia | medieval | 674..1578 | 13 | 149/100/109/93 | 2 | |
| Q887803 | 汶莱苏丹国 | southeast-asia | early-modern | 1363..2024 | 18 | 152/120/119/89 | 2 | |
| Q188161 | 荷属东印度 | southeast-asia | modern | 1800..1949 | 36 | 150/133/113/109 | 2 | |
| Q252 | 印度尼西亚 | southeast-asia | contemporary | 1946..2024 | 9 | 160/126/125/86 | 2 | |
| Q928 | 菲律宾 | southeast-asia | contemporary | 1947..2024 | 2 | 144/106/112/80 | 2 | 薄 |
| Q853477 | 澜沧王国 | southeast-asia | early-modern | 1363..1708 | 20 | 136/114/109/75 | 2 | |
| Q408 | 澳大利亚 | oceania | contemporary | 1905..2024 | 6 | 131/116/115/84 | 2 | |
| Q664 | 新西兰 | oceania | contemporary | 1948..2024 | 2 | 146/105/107/86 | 2 | 薄 |
| Q156418 | 夏威夷王国 | oceania | modern | 1791..1894 | 5 | 143/117/113/94 | 2 | 薄 |
| Q12491027 | 巴厘岛王国 | oceania | medieval | 922..1686 | 7 | 128/99/107/71 | 2 | |
| Q128904 | 埃兰 | west-central-asia | ancient-early | -3200..-601 | 17 | 131/118/114/85 | 2 | |
| Q41137 | 亚述帝国 | west-central-asia | ancient-early | -1800..-901 | 12 | 156/116/120/98 | 2 | |
| Q47690 | 巴比伦尼亚 | west-central-asia | ancient-iron | -1800..-601 | 15 | 142/121/111/87 | 2 | |
| Q41642 | 腓尼基 | west-central-asia | ancient-iron | -1150..-501 | 19 | 132/111/122/78 | 2 | |
| Q1986139 | 安息帝国 | west-central-asia | classical | -239..237 | 28 | 133/115/112/90 | 2 | |
| Q83891 | 萨珊王朝 | west-central-asia | classical | 215..643 | 47 | 140/114/129/99 | 2 | |
| Q705904 | 塞琉古王朝 | west-central-asia | classical | -318..-64 | 31 | 130/110/114/63 | 2 | |
| Q208404 | 亚美尼亚王国 | west-central-asia | classical | -326..646 | 32 | 134/124/122/79 | 2 | |
| Q188836 | 匈奴 | east-asia | classical | -208..153 | 27 | 128/101/109/76 | 2 | |
| Q504759 | 楚国 | east-asia | classical | -750..-224 | 15 | 105/109/110/74 | 2 | |
| Q2431480 | 吐蕃 | east-asia | medieval | 623..849 | 25 | 127/106/113/81 | 2 | |
| Q7427 | 西夏 | east-asia | medieval | 990..1226 | 8 | 110/112/109/69 | 2 | |
| Q5066 | 金朝 | east-asia | medieval | 1126..1235 | 5 | 130/107/106/74 | 2 | 薄 |
| Q148837 | 希腊城邦 | europe | classical | -800..83 | 53 | 125/118/111/93 | 2 | |
| Q17167 | 罗马共和国 | europe | classical | -500..-32 | 50 | 144/110/101/82 | 2 | |
| Q83958 | 马其顿王国 | europe | classical | -675..-292 | 34 | 139/103/104/84 | 2 | |
| Q2429397 | 古迦太基 | europe | classical | -650..-145 | 29 | 134/113/110/77 | 2 | |
| Q146246 | 法兰克王国 | europe | medieval | 462..849 | 153 | 135/108/113/74 | 2 | |
| Q4948 | 威尼斯共和国 | europe | medieval | 705..1796 | 70 | 125/114/123/83 | 2 | |
| Q170072 | 荷兰共和国 | europe | early-modern | 1582..1795 | 84 | 136/109/120/86 | 2 | |

机器可读版本（含每篇的来源 URL、binding 记录 id、字数、editorialNotes、eventKeywords）见 `docs/verification-3.21/narratives-round.json` 的 `entries`。

## 3. schema 与四栏结构一致性

- 没有改任何字段名。生成逻辑仍由 `scripts/places/apply-enrichment-3.12.mjs` 完成：它从可编辑源构建 `id / sourceNames / title / scope / sections / sources / editorialNotes / license / verification / facts / binding / recordIds / recordIdsOverlappingScope / eventKeywords / summary / zhCharacterCount`，其中 `summary` 由 politics + economy + culture 拼接。
- 新增 67 篇全部具备 politics / economy / culture / events 四栏与中英两栏（脚本强制，缺一栏直接失败）。
- binding 规则未变：精确 sourceNames + verifiedWikidata 相等 + scope 与记录时段重叠；本轮 67 篇共绑定 **2,704 − 1,024 = 1,680** 条新增疆域记录（全库 2,704 条，全部 162 篇都有 recordIdsOverlappingScope）。
- 装配脚本 `docs/verification-3.21/build-narratives-batch-3.21.mjs` 在写入前强制：四栏齐全、中文 50–190 字、英文 35–150 词、中文栏无繁体独用字、英文栏无 CJK、每篇 ≥2 条 highlights 与 ≥2 条 https 来源、无评价性词汇（伟大/辉煌/最强…）。`--check` 可随时复核。

## 4. 疆域联系与诚实边界

- 每篇 editorialNotes 由脚本自动生成疆域说明，例如"本站疆域数据收录该政体 26 条记录，年份范围为公元前 331 年至公元前 28 年……"；scope 就取自这些记录的年份范围，地图上在该年份区间打开该政体即会显示本篇，因此**叙述的年份范围与疆域记录一致**。
- **11 篇覆盖很薄**（记录 <6 条或跨度 <60 年）：尼日利亚(3)、加拿大(5)、特奥蒂瓦坎(4)、阿那萨吉人(5)、阿努拉德普勒(5)、迈索尔土邦(5)、扶南(4)、菲律宾(2)、新西兰(2)、夏威夷王国(5)、金朝(5)。这些条目的注记直接写明"覆盖很薄……不能据本站疆域记录推断其疆域变化"。
- 另有几篇 scope 明显窄于通史年代，已在注记中说明：大越（记录仅 1683—1833）、墨西哥（1868 起）、巴西（1890 起）、加拿大（1932 起）、埃及（1953 起）、埃塞俄比亚（1942 起）、澳大利亚（1905 起）、亚述（前 1800—前 901，新亚述帝国作为后续写入）、克什米尔（626—1343，19 世纪以后的政治归属不在范围内）。
- 中文来源的局限也如实写出：中文维基**没有马库里亚专条**，该篇中文来源采用"努比亚"条目提供地理与基督教努比亚背景，政体细节依据英文条目（已写入该篇注记）；潘地亚的中文条目只有一句概述，政治细节依据英文条目（同样写入注记）。

## 5. 合并安全性（实测证据）

`apply-enrichment-3.12.mjs` 第 24 行以线上 entries 建 Map，只对可编辑源里的 qid 做 `entries.set(id, …)`，最后以 `{...shipped, entries:[...entries.values()]}` 输出——按 id 覆盖/新增，不删除既有条目。实测（本轮写入前）：备份 narratives.json，直接跑一次 apply，结果 entries 95 → 95、LOST ids 0、不在可编辑源里的 26 篇（23 篇早期重磅 + 3 篇 snapshot）**26/26 逐字节相同**、69 篇重建差异 0 篇，文件 sha256 未变（`b1e8affa31e2e6e7`）。因此本轮把 67 篇直接并入 `editorial/enrichment-narratives-3.12.json`（该文件是 apply 读取的唯一可编辑源），没有新增批次文件、没有改动 scripts/。

## 6. 验证记录

| 命令 | 结果 |
|---|---|
| `node scripts/validate-v2.mjs` | exit 0（含"Compressed enrichment narratives equal the editable source"与逐条 narrative binding 检查） |
| `node scripts/validate.mjs` | exit 0 |
| `node scripts/validate-release.mjs` | exit 0 |
| `node scripts/places/audit-language.mjs . docs/verification-3.21/narratives-language-audit.json` | exit 0，事件层与战役层英文栏 CJK 均为 0 |
| `narratives.json.gz` | 头 mtime=0、OS=3，gunzip 后与 `.json` deepEqual=true（`scripts/build-enrichment-archive.mjs` 重建，未跑 prepare:assets） |

说明：`audit-language` 审的是事件层与战役层（本轮均为 0）；四栏叙述的英文栏由装配脚本把关（出现 CJK 直接拒绝写出），因此新 67 篇英文栏必然无 CJK。

## 7. 变更文件

- `public/data/enrichment/narratives.json`(+.gz)：95 → 162 篇（新增 67 篇，绑定疆域记录 2,704 条）
- `editorial/enrichment-narratives-3.12.json`：可编辑源 69 → 136 篇（新增 67 篇）
- `docs/verification-3.21/`：`narratives-round.md/.json`、`narratives-selection.json`（1,355 个未覆盖档案的评分与逐项证据）、`narratives-chosen.json`（67 篇的绑定计划）、`narratives-extracts.json`（67 篇中英维基导言证据）、`narratives-batch-stats.json`、`narratives-language-audit.json`、`authoring/part-01..07.json`（本轮撰写分片）、以及 4 个脚本（select / fetch / build / report）
- 未改动 `public/` 下其它产品文件；未运行 `prepare:assets`

## 8. 仍缺什么

1. **还有 1,288 个档案没有叙述**，覆盖率 11.2%。按地区：欧洲仍是最大的未覆盖池，其次是非洲、东亚、南亚；下一轮应继续按地区配额而非"谁大补谁"。
2. **地区文化缺口的更正（3.22 复查）**：本节原先把 13 个政体写成"根本没有档案"，**其中 7 个是错的**——卡涅姆-博尔努、刚果王国、祖鲁、室利佛逝、阿瑜陀耶、蒲甘王朝、亚齐苏丹国一直有 profile 与自 3.12 轮起的四栏叙述，只是本项目经 Cliopatria 的 Wikidata 属性使用的 QID 与凭记忆写下的常见 QID 不同：

   | 政体 | 本项目 QID | 疆域记录 |
   |---|---|---|
   | 卡涅姆-博尔努 | Q1139762 | 14 |
   | 刚果王国 | Q796583 | 3 |
   | 祖鲁（Zululand） | Q13558877 | 6 |
   | 室利佛逝（Srivijaya） | Q234197 | 8 |
   | 阿瑜陀耶 | Q841364 | 24 |
   | 蒲甘王朝 | Q888574 | 8 |
   | 亚齐苏丹国 | Q1061057 | 16 |

   真正没有档案的是 6 个（3.22 复查后的身份）：津巴布韦王国 Q596092（大津巴布韦遗址为 Q209217）、贝宁帝国 Q171203、达荷美 Q468814、基尔瓦苏丹国 Q3107156、图依汤加帝国 Q842390、拉帕努伊（Wikidata 只有岛屿 Q14452、人群 Q852486、王权 Q6413065，没有政体项）。它们在钉住的 Cliopatria 数据集（13,765 个 feature）中按名称、别名与 QID 检索均无对应记录，属于**边界数据源的覆盖边界**；3.22 已为其中 5 个建立带 `boundaryCoverage: "not-in-source"` 的档案，详见 `docs/verification-3.22/profile-gaps.md`。

   **流程教训**：结论必须附查询口径与证据。本报告与 3.22 任务描述里的"根本没有档案"都来自未经验证的 QID 假设；查证时应先用名称在 catalog 中定位实体，再用该实体的 `verifiedWikidata` 反查档案，而不是从记忆里取 QID。
3. **来源层次偏薄**：本轮每篇仍以 2 条维基百科条目为依据，没有引入机构或一手来源；少量条目（马库里亚、潘地亚）受中文维基缺条或残条限制，已在注记与报告中标明。
4. **四栏以外的结构**：既有 schema 只有四栏，缺少"社会/宗教"等独立栏目；若将来扩展 schema，需要同步 reader 与 validate-v2 的检查。
5. **断代精度**：叙述按年份写，未逐条给出月份或精确年份，争议以"约"或区间处理并写入注记；若需要更细的断代，需要引用专门研究而非百科条目。

---

产物对照：机器可读版本 `docs/verification-3.21/narratives-round.json`（新增清单、选点证据、字数/来源统计、schema 与 binding 说明、验证结果、仍缺什么）；本文件为叙述版本。
