# 3.18 内容第九轮：第五批索引事件升级（93 → 53）

任务 task-21。基线提交 `8fc1b746`，本报告由 `scripts/places/report-content-round9-3.18.mjs --baseline=8fc1b746` 从当前文件与命令输出生成，可复跑。

**结论**：索引级事件由 **93 条降到 53 条**，本轮升级 **40 条**（3.17 重排后的第 41–80 名，全部只有英文维基条目）；2 条年份按条目正文修正并同步战役层；12 条校验命令 exit 0（其中跨层校验 3/3、战役层 8/8）。

## 1. 结果摘要

| 指标 | 基线 | 本轮 |
|---|---|---|
| 事件总数 | 709 | 709 |
| 其中索引级（provenance=wikidata-structured） | 93 | **53** |
| 其中编辑级 v312wd 条目 | 198 | **238** |
| 战役层 battles | 603 | 603（2 条年份同步修正） |

本批 40 条：中文 112–133 字（要求 110–135），英文 45–60 词（要求 45–60）；id 保持 `v312wd-<qid>`，provenance 整条删除，wikidataQid 保留。

## 2. 选点：3.17 新排名的第 41–80 名

```
score = 3 * (has zh or en Wikipedia article) + min(sitelinks, 40) / 10 + 0.5 * (belligerents recorded) + 2 * (has Chinese Wikipedia article)
```

窗口内 **40/40 条有英文维基条目、0 条有中文条目**。这一轮因此是「英文条目 + 维基数据实体」为主体的批次，中文缺口逐条写在 editorialNotes 里。

## 3. 年份修正（2 条，并同步战役层）

| qid | 索引年 | 本轮采用 | 依据 |
|---|---|---|---|
| Q1443091 | 1504 | 1503 | 英文维基正文与维基数据P585均记1503年12月29日（精度到日），而结构化索引年为1504；本条以来源正文为准采用1503年，只保留年份精度。 |
| Q2888964 | 1185 | 1184 | 英文维基正文明确记该战役发生于1184年（源平合战期间源范赖渡海攻藤户），而索引年与维基数据P585为1185年1月10日（精度到日）；差异可能源于旧历年末与公历年初的换算。本条以条目正文为准采用1184年。 |

两条都在 `public/data/battles.json` 中有对应记录：3/3 的跨层校验要求同一实体在两个图层年份一致，因此按 3.17 的既有做法（`scripts/places/apply-battle-year-fixes-3.18.mjs`）同步了战役层的 year/start/end 与断代说明，其余字段不动。这是本轮唯一触及 battles 层的改动，已获得 Lead 事前确认。

其余 38 条与英文正文一致，但断代差异都写进了 notes，例如：Q592069 谢林伯尔（条目 10-18 / P585 10-28，旧历与新历差十天）、Q2237785 维斯克拉（682 或 683 两说）、Q1187406 格劳斯（1063 传统说，另有 1069、1070 两说）、Q1616794 阿基里斯行动（条目 3-6 开始 / P585 5-30）。

## 4. 标题与引用解析

本轮最重要的机械性风险：**排名的 `titleEn` 是维基数据英文标签，不等于英文条目标题**。40 条里有 **13 条不同**，其中多条只有括号年份才能区分：

| rank | qid | 标签（排名） | 实际条目（引用） |
|---|---|---|---|
| 43 | Q966312 | Battle of Anchialus | **Battle of Anchialus (763)** |
| 44 | Q1443091 | Battle of Garigliano | **Battle of Garigliano (1503)** |
| 46 | Q1192867 | Battle of Pułtusk | **Battle of Pułtusk (1806)** |
| 47 | Q20045970 | Battle of Marinka | **Battle of Marinka (2015)** |
| 50 | Q2750968 | Battle of Alexandria | **Battle of Alexandria (1801)** |
| 53 | Q220766 | Battle of Manzikert | **Battle of Manzikert (1915)** |
| 60 | Q2889635 | Final operations in Slovenia | **Battle of Poljana** |
| 67 | Q592069 | Battle of Sellenberk | **Battle of Șelimbăr** |
| 70 | Q936223 | Battle of Kara Killisse | **Battle of Kara Killisse (1915)** |
| 75 | Q2281774 | Battle of Marj al-Rahit | **Battle of Marj Rahit (684)** |
| 76 | Q5432157 | Fall of Kabul | **Fall of Kabul (2001)** |
| 77 | Q1747219 | Battle of Avignon | **Siege of Avignon (737)** |
| 80 | Q908888 | 1842 retreat from Kabul | **Battle of Gandamak** |

条目一律按**实际条目标题**（含消歧义后缀）写 titleEn 与引用 URL。为了确认这不是多虑，把 13 个标签标题逐个拿到 en.wikipedia 上查、并**逐条读导言分类**（`docs/verification-3.18/content-upgrade-label-title-check.json`）：

| 标签标题 | 解析到 | 判定 |
|---|---|---|
| `Final operations in Slovenia` | `Final operations in Slovenia` | 无此条目 |
| `Battle of Manzikert` | `Battle of Manzikert` | **指向另一场战役** |
| `Battle of Pułtusk` | `Battle of Pułtusk (1806)` | 同一条目 |
| `Battle of Sellenberk` | `Battle of Șelimbăr` | 同一条目 |
| `Battle of Garigliano` | `Battle of Garigliano` | **指向另一场战役** |
| `Battle of Anchialus` | `Battle of Anchialus` | 同名多场战役的概述页 |
| `Battle of Kara Killisse` | `Battle of Kara Killisse (1915)` | 同一条目 |
| `Battle of Alexandria` | `Battle of Alexandria` | 消歧义页 |
| `Battle of Marj al-Rahit` | `Battle of Marj Rahit` | 消歧义页 |
| `Battle of Marinka` | `Battle of Marinka` | 消歧义页 |
| `Battle of Avignon` | `Siege of Avignon (737)` | 同一条目 |
| `1842 retreat from Kabul` | `1842 retreat from Kabul` | 更大范围的条目 |
| `Fall of Kabul` | `Fall of Kabul` | 消歧义页 |

也就是说，照抄标签会有 **8/13 条引到错的地方**，其中最危险的不是消歧义页而是 **wrong-event**：`Battle of Manzikert` 是 1071 年拜占庭-塞尔柱之战（本批是 1915 年一战战役）、`Battle of Garigliano` 是 915 年基督徒与萨拉森人之战（本批是 1503 年）——这两条若照抄，引用会指向完全不同的历史事件，而不是仅仅格式不佳。

另有一个「标签不是名称」的案例：**Q1638751** 的中文标签是描述性短语「希姆里尼村附近爆发了血腥的战斗」。按规则原样保留并在 notes 说明，**没有为界面好看去编一个四字标题**——Lead 已确认这是唯一诚实的处理。

## 5. 中文条目核查：搜索被限流，改用精确标题核对

窗口内 40 条**都没有** zhwiki sitelink。核查分两步：

1. **全文搜索失败**：`scripts/places/search-zh-articles-3.18.mjs` 在第一个实体 Q1784785 上连续五次退避（20/40/60/80/100 秒）仍返回 429。本会话的 zh.wikipedia 正被另一条线大量占用，无法在合理时间内完成 40 条全文搜索，按 Lead 的指示不再硬等。
2. **精确标题核对（已完成）**：`scripts/places/verify-zh-absence-3.18.mjs` 用条目记录的中文标签做精确标题查询（含重定向），40 条中 **39 条不存在页面**，1 条存在但是**消歧义页**。

被拒绝的候选：**Q5432157 喀布尔战役**——中文维基同名页面是消歧义页，其中 2001 年条目为红链，另有 2021 年条目但属不同事件（2021 年塔利班接管）。因此本条不引用中文维基，并在 notes 写明原因。

**局限（写清楚而不是掩盖）**：精确标题查询只能证明「记录的中文名称下没有条目」，不能排除存在**标题不同**的中文条目。标题无关的全文扫描留给下一轮（3.17 轮同样如此处理）。

## 6. 校验

| 命令 | exit | 末行 |
|---|---|---|
| `node scripts/validate-cross-layer.mjs` | 0 | {"passed":3,"total":3,"events":709,"battles":603} |
| `node scripts/validate.mjs` | 0 | {"result":"passed","checks":10,"events":709,"boundaryRecords":13765,"polityRecor |
| `node scripts/validate-v2.mjs` | 0 | } |
| `node scripts/validate-places.mjs` | 0 | } |
| `node scripts/validate-city-time.mjs` | 0 | } |
| `node scripts/validate-polity-period.mjs` | 0 | PASS 30/30 real polity dossier regressions |
| `node scripts/validate-release.mjs` | 0 | {"result":"passed","checks":4,"staticFiles":17732,"physicalFiles":357,"nativePie |
| `node scripts/places/validate-battles.mjs . docs/verification-3.18/content-battles-validation.json` | 0 | {"passed":8,"total":8,"battles":603,"withBelligerents":423,"withConflict":545,"w |
| `node scripts/places/audit-language.mjs . docs/verification-3.18/content-language-audit.json` | 0 | } |
| `node scripts/places/check-authoring-3.18.mjs --all` | 0 | part-04.json v312wd-q908888 80 1842..1842 zh118 en46 -- EN |
| `node scripts/places/assemble-events-upgraded-3.18.mjs --check` | 0 | } |
| `node scripts/places/apply-battle-year-fixes-3.18.mjs --check` | 0 | } |

| 归档 | mtime | OS | 与 .json deepEqual |
|---|---|---|---|
| `public/data/events.json.gz` | 0 | 255 | true |
| `public/data/battles.json.gz` | 0 | 255 | true |

英文栏 CJK 违规 0 条；战役层校验 8/8；跨层校验 3/3。

## 7. 新增清单（40 条）

| rank | id | 中文标题 | 英文标题（引用条目） | 年 | 区域 |
|---|---|---|---|---|---|
| 41 | `v312wd-q1784785` | 蒙斯·塞琉古战役 | Battle of Mons Seleucus | 353 | europe |
| 42 | `v312wd-q762717` | 波伦蒂亚战役 | Battle of Pollentia | 402 | europe |
| 43 | `v312wd-q966312` | 安基阿卢斯战役 | Battle of Anchialus (763) | 763 | europe |
| 44 | `v312wd-q1443091` | 加里利亚诺河之战 | Battle of Garigliano (1503) | 1503 | europe |
| 45 | `v312wd-q2095678` | 阿瑟耶战役 | Battle of Assaye | 1803 | south-asia |
| 46 | `v312wd-q1192867` | 普乌图斯克会战 | Battle of Pułtusk (1806) | 1806 | europe |
| 47 | `v312wd-q20045970` | 马林卡战役 | Battle of Marinka (2015) | 2015 | europe |
| 48 | `v312wd-q2237785` | 维斯克拉战役 | Battle of Vescera | 682 | africa |
| 49 | `v312wd-q1113509` | 天目山之战 | Battle of Tenmokuzan | 1582 | east-asia |
| 50 | `v312wd-q2750968` | 亚历山大战役 | Battle of Alexandria (1801) | 1801 | africa |
| 51 | `v312wd-q1288821` | 阿布·科里亚之战 | Battle of Abu Klea | 1885 | africa |
| 52 | `v312wd-q2720985` | 柯克基利斯之战 | Battle of Kirk Kilisse | 1912 | europe |
| 53 | `v312wd-q220766` | 马拉兹吉尔特战役 | Battle of Manzikert (1915) | 1915 | west-central-asia |
| 54 | `v312wd-q2091385` | 阿拉威战役 | Battle of Arawe | 1943 | oceania |
| 55 | `v312wd-q2665461` | 巴巴利索斯战役 | Battle of Barbalissos | 252 | europe |
| 56 | `v312wd-q1855781` | 尼基乌战役 | Battle of Nikiou | 646 | africa |
| 57 | `v312wd-q1896360` | 斯科普里战役 | Battle of Skopje | 1004 | europe |
| 58 | `v312wd-q2237386` | 第一次元日战争 | Battle of Bun'ei | 1274 | east-asia |
| 59 | `v312wd-q604175` | 伊里海战 | Battle of Elli | 1912 | europe |
| 60 | `v312wd-q2889635` | 波利亚纳战役 | Battle of Poljana | 1945 | europe |
| 61 | `v312wd-q2664174` | 卡姆代什战役 | Battle of Kamdesh | 2009 | south-asia |
| 62 | `v312wd-q1132306` | 特兹拉卢姆之战 | Battle of Tzirallum | 313 | europe |
| 63 | `v312wd-q532544` | 斯文达克斯战役（Battle of Svindax） | Battle of Svindax | 1022 | west-central-asia |
| 64 | `v312wd-q1187406` | 格劳斯战役 | Battle of Graus | 1063 | europe |
| 65 | `v312wd-q541564` | 埃尔斯特河战役 | Battle on the Elster | 1080 | europe |
| 66 | `v312wd-q1319855` | 基里纳战役 | Battle of Kirina | 1235 | africa |
| 67 | `v312wd-q592069` | 谢林伯尔战役 | Battle of Șelimbăr | 1599 | europe |
| 68 | `v312wd-q2557155` | 塞奇高沼之战 | Battle of Sedgemoor | 1685 | europe |
| 69 | `v312wd-q1286106` | 法奥大登陆 | Fao Landing | 1914 | africa |
| 70 | `v312wd-q936223` | 卡拉基利塞战役 | Battle of Kara Killisse (1915) | 1915 | west-central-asia |
| 71 | `v312wd-q1616794` | 阿基里斯行动 | Operation Achilles | 2007 | south-asia |
| 72 | `v312wd-q1638751` | 希姆里尼村附近爆发了血腥的战斗 | Battle of Shirimni | 1021 | west-central-asia |
| 73 | `v312wd-q2888964` | 藤户之战 | Battle of Kojima | 1184 | east-asia |
| 74 | `v312wd-q743889` | 瓦乌战役 | Battle of Wau | 1943 | oceania |
| 75 | `v312wd-q2281774` | 迈尔季·拉希特战役 | Battle of Marj Rahit (684) | 684 | west-central-asia |
| 76 | `v312wd-q5432157` | 喀布尔战役 | Fall of Kabul (2001) | 2001 | south-asia |
| 77 | `v312wd-q1747219` | 阿维尼翁战役 | Siege of Avignon (737) | 737 | europe |
| 78 | `v312wd-q3046548` | 迪尔菲尔德大屠杀 | Raid on Deerfield | 1704 | americas |
| 79 | `v312wd-q1752783` | 沙托盖战役 | Battle of the Chateauguay | 1813 | americas |
| 80 | `v312wd-q908888` | 甘大麦战役 | Battle of Gandamak | 1842 | south-asia |

坐标、区域、类别、精度、locationType 与 regionBasis 全部原样继承结构化记录，升级不移动点位、不改分区；逐条继承审计见 `docs/verification-3.18/content-upgrade-authoring.json`。

## 8. 仍缺什么

1. **索引级还剩 53 条**（清单见 JSON 的 `remaining.structuredIds`）。3.17 排名里 133 个候选中只有 7 个有中文条目，本窗口为 0；下一轮从第 81 名起做，中文引用会持续稀缺。
2. **中文维基全文搜索未完成**（429 限流）：本轮以精确标题核对替代，只能覆盖记录标签。若下一轮限流缓解，应补一次全文扫描，确认是否存在标题不同的中文条目。
3. **本批 40 条没有中文维基条目**：全部在 notes 明写「中文维基百科尚无该条目」并只引用英文条目 + 维基数据实体，没有编造引用、没有音译标题。
4. **Q1638751 之类的描述性标签**：数据如实保留，界面层面是否回落英文名由 Lead 判断。

## 9. 诚实声明

- 本轮只有两处触及 `public/data/battles.json`（年份同步），已获 Lead 事前确认；没有跑 `prepare:assets`，没有改其它产品文件。
- 年份一律以条目正文为准：2 条与索引年不符的全部留档为 `yearCorrection` 并同步跨层，其余 38 条与正文一致。
- 没有把任何无来源内容写进交付物：无中文条目就写明缺口，标签有问题就保留原样并说明。
