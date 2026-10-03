# 3.22 档案缺口排查与处理报告：13 个"无 profile"政体的真相

任务：task-25（排查）+ task-26（路径 B 第一步）。基线提交 `9a3a691f`。结论由脚本从仓库内数据与**钉住的 Cliopatria 源数据**重新推导，可复现（`docs/verification-3.22/report-profile-gaps-3.22.mjs`、`scripts/places/build-no-territory-profiles-3.22.mjs`）。

## 0. 结论速览（含两次更正）

1. **13 个里 7 个是误报**。卡涅姆-博尔努、刚果王国、祖鲁、室利佛逝、阿瑜陀耶、蒲甘王朝、亚齐苏丹国**一直有 profile、有疆域记录，且自 3.12 轮起就有四栏叙述**。3.21 报告用凭记忆的常见 Wikidata QID 去查，而本项目（经 Cliopatria 的 `Wikidata` 属性）用的是另一套 QID。
2. **剩下的"六个"里又有 3 个 QID 是错的**（第二次同类错误，已在 3.22 复查中改正）：任务给的 Q662922 是贵族家族 Löwenwolde、Q1740606 是一个人、Q1056778 是 Apple 的 Numbers 应用。身份改用 **Wikipedia 条目 → Wikidata 项**映射核验后，真正没有档案的是：
   - 津巴布韦王国 **Q596092**（大津巴布韦遗址是 Q209217）
   - 贝宁帝国 **Q171203**
   - 达荷美 **Q468814**
   - 基尔瓦苏丹国 **Q3107156**
   - 图依汤加帝国 **Q842390**
   - 拉帕努伊：**Wikidata 没有政体项**（只有岛屿 Q14452、人群 Q852486、王权 Q6413065），因此没有为它造档案。
3. 这 6 个在钉住的 Cliopatria 源（commit `ad28a691`，zip sha256 与 `scripts/boundaries/source.json` 一致，13,765 个 feature）中按名称、19 个别名与 QID 全文检索**均无记录**——是边界数据源的覆盖边界，不是历史判断。
4. **路径 B 第一步已落地**：为其中 5 个建立档案，schema 与既有 1,450 份同构，并新增**机器可读**的 `boundaryCoverage: "not-in-source"` 与 `boundaryCoverageEvidence`（含数据集 pin、检索方法、中英注记、≥2 条带 checkedOn 的 https 来源）；每篇档案另有配套的 `.json` 源文件，`.json.gz` 头 mtime=0、OS=255、与源 deepEqual。
5. **校验层已收紧**：`scripts/validate-v2.mjs` 不再用"档案数=1,450"这一条硬断言，而是要求**每一个档案都声明疆域覆盖状态**，并要求：`source-records` 档案必须有 ≥1 条 catalog 记录绑定、`not-in-source` 档案必须 0 条绑定且 profile 文件重复该字段并带 ≥2 条 https 来源；两者的 qid 清单必须与 `coverage.boundaryCoverage.noTerritoryQids` 完全一致，且 `source-records` 数量不得少于 1,450。
6. **reader 未改**（按你的指示单列下一步）：档案仍只能经 catalog 记录绑定打开，这 5 篇目前在 UI 里不可达；产品界面上的"本站未收录该政体疆域"提示属于下一步。

## 1. 排查方法与证据链（可复现）

| 步骤 | 做法 | 结果 |
|---|---|---|
| 1 | 按**名字**（不是 QID）在 `public/data/fast/catalog.json.gz` 里查 13 个政体 | 7 个命中，且 QID 与常见项不同 |
| 2 | 用命中的 catalog QID 反查 `profile-index.json.gz` 与 `profiles/` | 7 个全部有 profile 文件与 3.12 轮叙述 |
| 3 | 核对 `profile-index.exclusions`（403 条） | 13 个政体一条都不在排除表；排除只有 relation 385 / ambiguous_source_period 7 / no_verified_entity 11 |
| 4 | 下载并校验钉住的 Cliopatria 源 | zip 44,231,317 B，sha256 `d01ae3a2…f3370` 与 `source.json` 一致；13,765 个 feature |
| 5 | 在源里按 QID **全文检索**、按 19 个历史别名做**词边界**匹配 | 全部 0 命中（只有现代 Zimbabwe/Benin 各 3 条） |
| 6 | 身份核验改用 **en.wikipedia `pageprops.wikibase_item`** | 纠正 4 个 QID：Kingdom of Great Zimbabwe→Q596092、Kingdom of Benin→Q171203、Kilwa Sultanate→Q3107156、Tuʻi Tonga Empire→Q842390 |
| 7 | 索引对账 | 13,765 = 13,362 绑定 + 403 排除；catalog POLITY qid 1,451，其中只有 Q6000379 无档案（记录被排除） |

复现：
```
cd scripts/boundaries && python3 download_source.py
node docs/verification-3.22/report-profile-gaps-3.22.mjs --source=<解出的 geojson>
node scripts/places/build-no-territory-profiles-3.22.mjs
```

## 2. 逐条结论

### 2.1 七个"误报"：档案与叙述都在（自 3.12 轮起）

| 3.21 探的 QID | 项目实际 QID | catalog 名称 | 疆域记录 | 年份 | profile | 叙述 |
|---|---|---|---|---|---|---|
| Q1136041 | **Q1139762** | Empire of Kanem / Bornu Empire | 14 | 1072–1894 | 有 | 3.12 |
| Q477423 | **Q796583** | Kingdom of Kongo | 3 | 1440–1669 | 有 | 3.12 |
| Q249594 | **Q13558877** | Zululand | 6 | 1820–1897 | 有 | 3.12 |
| Q210400 | **Q234197** | Srivijaya | 8 | 674–1293 | 有 | 3.12 |
| Q207982 | **Q841364** | Ayutthaya Kingdom | 24 | 1352–1768 | 有 | 3.12 |
| Q1062587 | **Q888574** | Pagan Kingdom | 8 | 850–1293 | 有 | 3.12 |
| Q1052477 | **Q1061057** | Sultanate of Aceh | 16 | 1516–1959 | 有 | 3.12 |

### 2.2 六个真正缺失：源里没有，身份已核验

| 政体 | 正确 QID | 原给的 QID 实际是什么 | catalog 记录 | 源内名称命中 | 源内 QID 出现 | 3.22 处理 |
|---|---|---|---|---|---|---|
| 津巴布韦王国（大津巴布韦） | Q596092（遗址 Q209217） | Q209217 是遗址本身 | 0 | 0 | 0 | 已建 no-territory 档案 |
| 贝宁帝国 | Q171203 | **Q662922 = Löwenwolde 贵族家族** | 0 | 0 | 0 | 已建 no-territory 档案 |
| 达荷美 | Q468814 | Q468814 正确 | 0 | 0 | 0 | 已建 no-territory 档案 |
| 基尔瓦苏丹国 | Q3107156 | **Q1740606 = Khatuna Mikaberidze（人物）** | 0 | 0 | 0 | 已建 no-territory 档案 |
| 图依汤加帝国 | Q842390 | **Q1056778 = Numbers（Apple 应用）** | 0 | 0 | 0 | 已建 no-territory 档案 |
| 拉帕努伊 | 无政体项 | Q14452 是岛屿 | 0 | 0 | 0 | 不造档案，记录原因 |

对照：同一源里**有** Kingdom of Kongo、Ashanti Empire、Oyo Empire、Kingdom of Lunda、Makuria、Alodia、Zululand、Natalia Republic、Empire of Kanem/Bornu，也有 Srivijaya、Ayutthaya、Pagan、Aceh——缺失的是这 6 个实体，不是整片地区。

## 3. 路径 B 第一步的交付（已落地）

**数据层**（`scripts/places/build-no-territory-profiles-3.22.mjs` → `public/data/enrichment/`）：

- 5 篇档案：`profiles/Q596092.json(.gz)`、`Q171203`、`Q468814`、`Q3107156`、`Q842390`；每篇 5–9 个字段（instanceOf / inception / dissolution / capital / government / predecessors / successors / country / continent / officialLanguages / spokenLanguages），语句沿用既有 statement 形状（statementId、propertyLabel、referencePresence、temporal/temporalScope、displayGroup、verification、yearSelectionPolicy）。
- 新增机器可读字段 `boundaryCoverage: "not-in-source"` 与 `boundaryCoverageEvidence`（status、checkedOn、dataset pin（repo/commit/sha256/features）、method、中英 note、≥2 条 https 来源）；note 明确写"本站疆域数据未收录该政体，地图上不会显示其疆域；没有边界数据是事实，不代表该政体在历史上不存在"。
- 索引：`profile-index.json.gz` 每一条档案都带 `boundaryCoverage`（既有 1,450 条为 `source-records`，新增 5 条为 `not-in-source`），并新增 `coverage.boundaryCoverage`（policy、两类计数、`noTerritoryQids`、所校验的数据集 pin）与 `coverage.profileCount: 1455`。
- `enrichment-manifest.json` 已按目录重算涉及与新增文件的 bytes+sha256，并修正此前已过期的条目；`totalBytes` 同步。

**校验层**（`scripts/validate-v2.mjs`）：

- 原 `assert.equal(Object.keys(index.profiles).length,1450)` 改为 `assert.equal(<boundaryCoverage==='source-records' 的档案数>,1450)`；
- 新增独立检查：每个档案必须声明 `boundaryCoverage`；`source-records` 必须有 ≥1 条 catalog 记录绑定；`not-in-source` 必须 0 条绑定、profile 文件重复该字段、带 `boundaryCoverageEvidence` 与 ≥2 条 https 且带 checkedOn 的来源；`coverage.noTerritoryQids` 必须与实际集合完全一致，`sourceRecords` 不得少于 1,450。这既允许新增，也堵住"悄悄塞无疆域档案"。

**reader 层**：未改。这 5 篇在 UI 中暂不可达，已单列下一步。

## 4. 顺带查清的真实缺口（18 条记录 + 1 个 qid）

- 13,765 = 13,362 绑定 + 403 排除；403 = relation 385 + ambiguous_source_period 7 + no_verified_entity 11。
- 被排除的 18 条 POLITY 记录：Later Zhou 5 条（源年代错写 -750..-257，另有正确的 960 记录）、Hashemite Arab Federation 2 条（源里 wiki 指向 "Arab Iraq"）、Timurid 4 条（源 feature 无 Wikidata 属性）、Cambodia 3 条 / Sambaliung 2 条 / Uryankhay 2 条（身份无法核验）。
- 源里只有 5 个 feature 完全没有 Wikidata 属性（4 条 Timurid + 1 条 relation）。
- **Q6000379 是唯一有 catalog 记录却没有档案的 qid**（2 条记录都被 ambiguous_source_period 排除）。

## 5. 影响与后续

1. 6 个政体**在本站没有疆域数据**，地图上不会显示其疆域，也不会有绑定型四栏叙述。5 篇 no-territory 档案已把这一事实变成机器可读字段；拉帕努伊因缺少政体实体暂不建档案（建议等 reader 支持"无疆域档案"时，用岛屿 Q14452 建一篇岛屿社会档案，或单列覆盖说明）。
2. **下一步（reader）**：为 polity 视图增加不依赖 catalog 记录的入口，显示 `boundaryCoverageEvidence.note` 的中英文案；需同步 validate-v2 对"档案可达性"的检查。
3. **路径 A（第二套疆域源）**仍按决定不做；许可证、管线与精度口径要单独评估。
4. **流程教训**（本会话第三次"判数据不存在、实为口径/身份问题"）：结论必须附查询口径与证据；先按名称在 catalog 定位实体，再用 `verifiedWikidata` 反查档案；跨库引用 QID 前必须用 `pageprops.wikibase_item` 之类的一手映射核验，不从记忆取 ID。3.21 报告与 task-25 描述已按此更正。

## 6. 验证记录

| 命令 | 结果 |
|---|---|
| `node scripts/validate.mjs` | exit 0 |
| `node scripts/validate-v2.mjs` | exit 0（含新的"每个档案声明疆域覆盖状态"检查） |
| `node scripts/validate-release.mjs` | exit 0 |
| `node scripts/places/audit-language.mjs . docs/verification-3.22/profile-language-audit.json` | exit 0（事件/战役英文栏 CJK 0） |
| 新增/改动的 `.gz` | 5 篇 `profiles/QID.json.gz`：mtime=0、OS=255、与 `.json` deepEqual=true；`profile-index.json.gz`：mtime=0、OS=255、gunzip 后与写入内容一致；`narratives.json.gz` 未改动，mtime=0 且 deepEqual=true |
| `enrichment-manifest.json` | 已重算涉及与新增文件的 bytes+sha256，`totalBytes` 同步 |

未跑 `prepare:assets`；`scripts/` 只改了 `validate-v2.mjs` 与本轮新增的 `scripts/places/build-no-territory-profiles-3.22.mjs`。

## 7. 变更文件

- 新增档案：`public/data/enrichment/profiles/{Q596092,Q171203,Q468814,Q3107156,Q842390}.json(.gz)`
- 修改：`public/data/enrichment/profile-index.json.gz`、`public/data/enrichment/enrichment-manifest.json`
- 修改：`scripts/validate-v2.mjs`、`docs/verification-3.21/narratives-round.md/.json`（7 个政体更正 + 流程教训）
- 新增：`scripts/places/build-no-territory-profiles-3.22.mjs`、`editorial/no-territory-entities-3.22.json`、`docs/verification-3.22/no-territory-profiles.json`、`docs/verification-3.22/profile-gaps.md/.json`、`docs/verification-3.22/report-profile-gaps-3.22.mjs`
- 任务板：task-25 描述已更正（13 → 7 误报 + 6 缺失）；task-26 记录本轮路径 B 第一步

## 8. 仍缺什么

1. **reader 入口**：5 篇 no-territory 档案在 UI 中不可达（下一步）。
2. **拉帕努伊**：无政体实体，档案与展示方式待定。
3. **路径 A**：第二套可引用疆域源（许可证、管线、精度口径）未评估。
4. Cliopatria 自身的数据问题仍在：5 条 Later Zhou 年代错误、2 条 Hashemite Arab Federation 身份错配、9 条身份无法核验；需要在源头或核验规则层处理。
5. 已服务但未叙述的政体：这 5 个新政体以及 1,288 个无叙述档案仍待下一轮写作。
