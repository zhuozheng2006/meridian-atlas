# 3.22 档案缺口排查报告：13 个"无 profile"政体的真相

任务：task-25。基线提交 `9a3a691f`。本报告的所有结论都由脚本从仓库内数据与**钉住的 Cliopatria 源数据**重新推导，可复现（见第 1 节与 `docs/verification-3.22/report-profile-gaps-3.22.mjs`）。

## 0. 结论速览（含对 3.21 报告的更正）

1. **13 个里 7 个是误报**。卡涅姆-博尔努、刚果王国、祖鲁、室利佛逝、阿瑜陀耶、蒲甘王朝、亚齐苏丹国**一直有 profile、有疆域记录，而且自 3.12 轮起就有四栏叙述**。3.21 报告说它们"根本没有 profile"是错的——我当时用**凭记忆的常见 Wikidata QID** 去查，而这个项目（经 Cliopatria 的 `Wikidata` 属性）用的是另外一套 QID。这正是"判定数据不存在、实际是口径问题"的第三个实例。
2. **13 个里 6 个确认上游缺失**：大津巴布韦（Q209217）、贝宁王国（Q662922）、达荷美（Q468814）、基尔瓦苏丹国（Q1740606）、汤加（Q1056778）、拉帕努伊（Q14452）。在钉住的 Cliopatria 源（commit `ad28a691`，13,765 个 feature，zip 的 sha256 与 `scripts/boundaries/source.json` 完全一致）里，这 6 个 QID **全文一次都不出现**，19 个历史别名（Great Zimbabwe / Monomotapa / Mutapa / Dahomey / Abomey / Allada / Kilwa / Quiloa / Swahili / Zanj / Tonga / Tongatapu / Rapa Nui / Rapanui / Easter Island / Edo / Ife / Benin City 等）**全部 0 命中**（只有现代国家 "Zimbabwe"、"Benin" 各 3 条）。
3. 因此本轮**没有新增任何 profile**：这 6 个政体没有边界几何，任何多边形都只能靠编造或借用邻国——两条都被任务明令禁止；而"只有 profile、没有任何疆域记录"的条目在当前 reader 里**打不开**（profile 只能通过 catalog 记录的绑定进入），且 `validate-v2` 硬断言档案数恰为 1,450。按任务第 3 条，结论与后续路径写入本报告，不硬造。
4. 顺带查清了**真实的**档案缺口，比 13 小得多：全库 13,765 条记录中只有 **18 条 POLITY 记录**被排除、**1 个 qid**（Q6000379 Hashemite Arab Federation）没有 profile，且每一条都有明确理由（见第 4 节）。

## 1. 排查方法与证据链（可复现）

| 步骤 | 做法 | 结果 |
|---|---|---|
| 1 | 按**名字**而非 QID 在 `public/data/fast/catalog.json.gz` 里查 13 个政体 | 7 个命中（QID 与常见项不同），6 个任何别名都无 |
| 2 | 用命中的 catalog QID 反查 `profile-index.json.gz` 与 `profiles/` | 7 个全部有 profile 文件（14 字段、6–12 条声明），且已在 `narratives.json` 中 |
| 3 | 核对 `profile-index.exclusions`（403 条） | 13 个政体的名字**一条都不在**排除表里；排除表只有 relation 385 / ambiguous_source_period 7 / no_verified_entity 11 |
| 4 | 下载并校验钉住的 Cliopatria 源：`scripts/boundaries/download_source.py` 的 URL 与 sha256 | zip 44,231,317 字节，sha256 `d01ae3a2…f3370` 与 `source.json` **一致**；解出 `cliopatria_polities_only.geojson` 13,765 个 feature |
| 5 | 在该源里按 6 个 QID **全文检索** | 0 次出现 |
| 6 | 在该源里按 19 个历史别名做**词边界**匹配（避免 Edo 命中 Macedonian） | 0 命中；仅现代 "Zimbabwe"/"Benin" 各 3 条 |
| 7 | 索引对账：catalog qid 数 vs profile 数 vs 绑定记录数 | 1,451 个 catalog POLITY qid / 1,450 个 profile；13,362 条绑定 + 403 条排除 = 13,765 |

复现命令：
```
cd scripts/boundaries && python3 download_source.py        # 校验 sha256 后解出 cliopatria.geojson
node docs/verification-3.22/report-profile-gaps-3.22.mjs --source=<解出的 geojson 路径>
```

## 2. 逐条结论

### 2.1 七个"误报"：档案与叙述都在（自 3.12 轮起）

| 3.21 里探的 QID | 项目实际 QID | catalog 名称 | 疆域记录 | 年份范围 | profile 文件 | 叙述 |
|---|---|---|---|---|---|---|
| Q1136041 | **Q1139762** | Empire of Kanem / Bornu Empire | 14 | 1072–1894 | `profiles/Q1139762.json.gz`（加涅姆-博尔努帝国） | 3.12 |
| Q477423 | **Q796583** | Kingdom of Kongo | 3 | 1440–1669 | `profiles/Q796583.json.gz`（刚果王国） | 3.12 |
| Q249594 | **Q13558877** | Zululand | 6 | 1820–1897 | `profiles/Q13558877.json.gz`（祖鲁兰） | 3.12 |
| Q210400 | **Q234197** | Srivijaya | 8 | 674–1293 | `profiles/Q234197.json.gz`（三佛齐） | 3.12 |
| Q207982 | **Q841364** | Ayutthaya Kingdom | 24 | 1352–1768 | `profiles/Q841364.json.gz`（大城王国） | 3.12 |
| Q1062587 | **Q888574** | Pagan Kingdom | 8 | 850–1293 | `profiles/Q888574.json.gz`（蒲甘王国） | 3.12 |
| Q1052477 | **Q1061057** | Sultanate of Aceh | 16 | 1516–1959 | `profiles/Q1061057.json.gz`（亚齐苏丹国） | 3.12 |

这些条目在地图上可以点开、有 profile 字段、也有四栏叙述；**3.21 报告的"根本没有 profile"必须按此更正**。需要做的只是把这条更正通知给下游（Lead 已验收的 narratives 报告与 task-25 描述里引用了旧结论）。

### 2.2 六个确认缺失：上游源里没有这些政体

| 政体 | Wikidata QID | catalog 记录 | profile | 源内名称命中 | 源内 QID 出现 |
|---|---|---|---|---|---|
| 大津巴布韦 | Q209217 | 0 | 无 | 0（含 Monomotapa/Mutapa 等别名） | 0 |
| 贝宁王国 | Q662922 | 0 | 无 | 0（仅现代 Republic of Benin 3 条） | 0 |
| 达荷美 | Q468814 | 0 | 无 | 0（含 Abomey/Allada/Whydah） | 0 |
| 基尔瓦苏丹国 | Q1740606 | 0 | 无 | 0（含 Swahili/Zanj/Sofala/Mombasa） | 0 |
| 汤加 | Q1056778 | 0 | 无 | 0（含 Tuʻi Tonga/Tongatapu） | 0 |
| 拉帕努伊 | Q14452 | 0 | 无 | 0（含 Easter Island/Rapanui） | 0 |

对照组说明这不是"非洲/大洋洲整体缺失"：同一源里**有** Kingdom of Kongo、Ashanti Empire、Oyo Empire、Kingdom of Lunda、Makuria、Alodia、Zululand、Natalia Republic、Empire of Kanem / Bornu Empire，也有 Srivijaya、Ayutthaya、Pagan、Aceh。缺失的是这 6 个具体实体，而不是整个地区。

## 3. 为什么本轮不新建 profile（不硬造的理由）

1. **没有几何可用**：6 个政体在钉住的源里没有任何 feature，本站其它图层（HALC/CShapes/OHM）也没有对应边界。任何多边形都将是编造；借用相邻政体或其它年份的几何被任务与项目原则明确禁止。
2. **加进去也打不开**：`public/polity-reader.js` 的 `loadProfile` 先取 `profile-index.records[record.id]` 得到 qid，再取 `profiles[qid].file`。没有 catalog 记录就没有入口，档案在 UI 里不可达。
3. **会破坏验证**：`scripts/validate-v2.mjs` 断言 `Object.keys(index.profiles).length === 1450`，并检查每个 profile 与记录一一对应；新增无记录档案会让 `npm test` 变红。`scripts/` 中除 `scripts/places/` 外不在本轮写作用域。
4. **任务的明确指令**：查证后确认无法补就不要硬造，写结论、证据、影响与路径。

## 4. 顺带查清的真实缺口（18 条记录 + 1 个 qid）

- 全库 `catalog.records` 13,765 条 = 13,380 POLITY + 385 RELATION；`profile-index.records` 绑定 13,362 条；`exclusions` 403 条 = relation 385 + ambiguous_source_period 7 + no_verified_entity 11。
- 被排除的 **18 条 POLITY 记录**（就是 7 + 11）逐条有理由：
  - **5 条 Later Zhou（Q1154556，前 750—前 257）**：源数据年代明显错误（Later Zhou 是 951—960 年；源里确实另有一条正确的 960 记录 `clio-03861`），被判 `ambiguous_source_period`；
  - **2 条 Hashemite Arab Federation（Q6000379，1415—1439）**：源里该 feature 的 Wikipedia 指向 "Arab Iraq"，名称与年代互不相符，同样 `ambiguous_source_period`；
  - **4 条 Timurid Empire（1507—1528）**：源 feature **没有 Wikidata 属性**，判 `no_verified_entity`；
  - **3 条 Cambodia（1700—1802）**、**2 条 Sultanate of Sambaliung**、**2 条 Republic of Uryankhay**：源里的 Wikipedia/Wikidata 身份无法通过核验（"Cambodia Middle Period"、id.wikipedia 链接等），判 `no_verified_entity`。
- 源里只有 **5 个 feature 完全没有 Wikidata 属性**（4 条 Timurid + 1 条 relation），其余 9 条被排除的 POLITY 记录都有 QID，是**身份核验**没过关，而不是源里没有实体。
- `Q6000379` 是**唯一有 catalog 记录却没有 profile 的 qid**（它的 2 条记录都被排除）；其余 1,450 个 qid 全部有档案。因此"档案缺口"在本项目里基本已经闭合，剩下的都是**源数据本身**的问题（年代错、身份无法核验、实体未收录）。

## 5. 影响与后续路径

**影响**：大津巴布韦、贝宁王国、达荷美、基尔瓦苏丹国、汤加、拉帕努伊在本站**没有疆域数据**，地图上不会显示它们的疆域，也无法为它们写绑定型四栏叙述。这是**边界数据源的覆盖边界，不是历史判断**；产品与文档在提到这些政体时应明确说明"本站疆域数据未收录"。

**路径 A（推荐）**：引入第二套可引用的疆域来源（例如 Seshat 的非洲政体数据、学术 GIS 或区域专题数据集），沿用现有身份核验管线（`scripts/boundaries/fetch_wikipedia_identity.py` 那套 exact-name + Wikidata 核验），把来源哈希像 `source.json` 一样钉住，再建 catalog 记录 → profile → 叙述。绝不为凑覆盖率手工画多边形。
**路径 B**：若确实需要"无疆域档案"，需要产品侧同步改动——reader 增加一个不依赖 catalog 记录的入口、profile-index 增加 `territoryCoverage: "none"` 之类的标记、`validate-v2` 的 1,450 断言改为"1,450 有疆域档案 + N 个无疆域档案"，并在条目正文写清"本站未收录该政体疆域，地图上不会显示"，避免空白被读成"历史上不存在"。这需要 Lead 决策与 `scripts/` 写权限。
**路径 C（立刻可做，无需新数据）**：把 6 个政体登记进覆盖说明（例如政体视图的覆盖注记或 docs），说明其缺失原因；并在下一轮叙述作者培训/流程里记录"先查 catalog 名称与 QID，再下结论"的教训。

## 6. 验证记录

| 命令 | 结果 |
|---|---|
| `node scripts/validate.mjs` | exit 0 |
| `node scripts/validate-v2.mjs` | exit 0（档案数 1,450、逐条 binding 检查通过） |
| `node scripts/validate-release.mjs` | exit 0（public/data 的 bytes+sha256 全部未变） |
| `node scripts/places/audit-language.mjs . docs/verification-3.22/profile-language-audit.json` | exit 0（事件/战役英文栏 CJK 0） |
| `narratives.json.gz` | mtime=0，与 `.json` deepEqual=true |
| `profile-index.json.gz` | mtime=0（该档案没有同名 .json，gz 即发布形态） |

**本轮没有修改任何产品数据文件**，因此 `validate-release` 的字节与哈希清单无需同步；`.gz` 也只是复核了既有镜像的可复现性。

## 7. 变更文件

- 新增：`docs/verification-3.22/profile-gaps.md`、`docs/verification-3.22/profile-gaps.json`（机器可读：索引对账、13 条结论、源数据校验结果、验证结果）、`docs/verification-3.22/report-profile-gaps-3.22.mjs`（可复跑）、`docs/verification-3.22/profile-language-audit.json`
- 未改动 `public/` 下任何文件；未改动 `scripts/`；未运行 `prepare:assets`
- 上游源数据只下载到 `/tmp`（44 MB zip + 165 MB geojson），**没有入库**

## 8. 仍缺什么

1. 6 个政体仍然没有疆域与档案，需要第二套来源才能补（第 5 节路径 A/B）。
2. Cliopatria 本身的 3 类数据问题仍在：5 条年代明显错误的 Later Zhou、2 条身份错配的 Hashemite Arab Federation、9 条身份无法核验的记录；这些需要在上游或核验规则层面处理，而不是在 catalog 里手改。
3. 3.21 报告与 task-25 描述里的错误结论需要随本报告更正（7 个政体其实一直有档案与叙述）。
4. 覆盖说明（"本站未收录"）尚未进入产品界面；在路径 A/B 落地前，读者仍可能把空白读成"历史上不存在"。
