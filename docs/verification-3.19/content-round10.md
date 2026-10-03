# 3.19 内容第十轮：第六批索引事件升级（53 → 13）

任务 task-22。基线提交 `7b609630`，本报告由 `scripts/places/report-content-round10-3.19.mjs --baseline=7b609630` 从当前文件与命令输出生成，可复跑。

**结论**：索引级事件由 **53 条降到 13 条**，本轮升级 **40 条**（3.17 重排后的第 81–120 名）；**1 条年份按条目正文修正并同步战役层**（卡尔德隆大桥 2000→1811）；12 条校验命令 exit 0（跨层 3/3、战役层 8/8）。

## 1. 结果摘要

| 指标 | 基线 | 本轮 |
|---|---|---|
| 事件总数 | 709 | 709 |
| 其中索引级（provenance=wikidata-structured） | 53 | **13** |
| 其中编辑级 v312wd 条目 | 238 | **278** |
| 战役层 battles | 603 | 603（1 条年份同步修正） |

本批 40 条：中文 113–134 字（要求 110–135），英文 50–60 词（要求 45–60）；id 保持 `v312wd-<qid>`，provenance 整条删除，wikidataQid 保留。

## 2. 选点与 BCE 年份核对

窗口 rank 81–120：**40/40 有英文维基条目、0 有中文条目**。本批含 **8 条公元前条目**，全部按条目正文年份核对（不机械 −1、也不机械照抄 P585）：

| qid | 民用纪年 | 条目 | 正文写法 |
|---|---|---|---|
| Q2705449 | -458 | Battle of Mount Algidus | 458 BC |
| Q1290572 | -164 | Battle of Beth Zur | October 164 BC |
| Q1268349 | -162 | Battle of Beth Zechariah | around May 162 BC |
| Q3555607 | -129 | Battle of Ecbatana | 129 BC |
| Q1268317 | -165 | Battle of Emmaus | around September 165 BC |
| Q4872472 | -647 | Battle of Susa | 647 BC |
| Q1268339 | -166 | Battle of Beth Horon (166 BC) | spring 166 to spring 165 BC |
| Q2920325 | -167 | Battle of the Ascent of Lebonah | 167 or 166 BCE |

八条全部与索引年一致，因此没有 BCE 修正；其中两条（前166、前167）条目本身给出跨年区间，已在正文与 notes 写明两说。

## 3. 年份修正（1 条，并同步战役层）

| qid | 索引年 | 本轮采用 | 依据 |
|---|---|---|---|
| Q786657 | 2000 | 1811 | 英文维基正文明确记该战役发生于1811年1月（瓜达拉哈拉以东，墨西哥独立战争），而结构化索引年与维基数据P585为2000年1月17日；该P585值显然是年份录入错误，本条以条目正文为准采用1811年，并同步修正战役层。 |

**Q786657 卡尔德隆大桥战役**是本轮最重要的一处数据缺陷：结构化索引年与维基数据 P585 都写 **2000 年 1 月 17 日**，而英文维基正文明确记该战役发生于 **1811 年 1 月**（墨西哥独立战争，瓜达拉哈拉以东）。P585 显然是年份录入错误。本条以条目正文为准采用 1811 年，并按 3.17/3.18 的既有做法同步修正战役层——该 QID 同时在 `battles.json` 中，否则跨层校验必红。

其余断代差异都写进 notes，例如：贝特霍伦（前166春至前165春）、勒波纳坡道（前167 或前166）、拉马迪 2015–2016（本条采用索引年 2016，起始 2015 在正文说明）、冬季行动 1914–1915（索引年 1914）、穆雷达（正文 1 月 21 日 / P585 1 月 24 日，同年）。

## 4. 标题解析：14 个标签里 10 个是消歧义页

排名的 `titleEn` 是维基数据标签，40 条中有 **17 条**的标签与条目标题不同（去重后共 14 个不同的标签）。把每个标签拿到 en.wikipedia 上查证（`docs/verification-3.19/content-upgrade-label-title-check.json`）：

| 标签 | 解析到 | 判定 |
|---|---|---|
| `Battle of Balikpapan` | `Battle of Balikpapan` | **消歧义页** |
| `Battle of Manila` | `Battle of Manila` | **消歧义页** |
| `Battle of Saigon` | `Battle of Saigon` | **消歧义页** |
| `Battle of Tobruk` | `Battle of Tobruk` | **消歧义页** |
| `2008 Mardakert skirmishes` | `2008 Mardakert clashes` | 同一条目 |
| `Battle of Ramadi` | `Battle of Ramadi` | **消歧义页** |
| `Battle of Orleans` | `Battle of Orléans` | **消歧义页** |
| `Battle of Beth Horon` | `Battle of Beth Horon` | **消歧义页** |
| `Battle of Jenin` | `Battle of Jenin` | **消歧义页** |
| `Battle of Ras Kamboni` | `Battle of Ras Kamboni` | **消歧义页** |
| `Battle of Givenchy` | `Winter operations 1914–1915` | 同一条目 |
| `Action at Néry` | `Affair of Néry` | 同一条目 |
| `2010 Mardakert skirmishes` | `2010 Mardakert clashes` | 同一条目 |
| `Bloody Sunday` | `Bloody Sunday` | **消歧义页** |

**10/14 个标签标题是消歧义页**，其中 `Battle of Ramadi` 一条标签对应 2004、2006、2014–2015、2015–2016 四场同名战事，本批就占了其中三场（2004、2006、2015–2016）；`Battle of Tobruk` 同时覆盖 1911 年与更著名的 1941 年托布鲁克围城。照抄标签不仅格式不佳，**根本无从区分是哪一场**——这正是必须用条目实际标题（含括号年份）的原因。

## 5. 中文核查：本方法未确认，不等于不存在

- 窗口内 40 条**都没有** zhwiki sitelink。
- `scripts/places/verify-zh-absence-3.19.mjs` 用记录标签做**精确标题核对**：40 条中 **39 条在该标签下没有页面**，1 条（Q2457256 奥尔良战役）存在，但页面是列举 1429 年、1870 年等历次奥尔良战役的**列表**，与 463 年之战无关，因此不予引用。
- **全文搜索未运行**：zh.wikipedia 搜索接口在本会话持续 429（上一轮五次退避均失败），本轮按 Lead 指示不再硬等。
- 因此所有条目与报告一律写「**本方法未确认**」：精确标题核对只能说明"记录的标签下没有页面"，既不能发现**标题不同**的中文条目，也不能证明其不存在。

## 6. 校验

| 命令 | exit | 末行 |
|---|---|---|
| `node scripts/validate-cross-layer.mjs` | 0 | {"passed":3,"total":3,"events":709,"battles":603} |
| `node scripts/validate.mjs` | 0 | {"result":"passed","checks":10,"events":709,"boundaryRecords":13765,"p |
| `node scripts/validate-v2.mjs` | 0 | } |
| `node scripts/validate-places.mjs` | 0 | } |
| `node scripts/validate-city-time.mjs` | 0 | } |
| `node scripts/validate-polity-period.mjs` | 0 | PASS 30/30 real polity dossier regressions |
| `node scripts/validate-release.mjs` | 0 | {"result":"passed","checks":4,"staticFiles":17732,"physicalFiles":357, |
| `node scripts/places/validate-battles.mjs . docs/verification-3.19/content-battles-validation.json` | 0 | {"passed":8,"total":8,"battles":603,"withBelligerents":423,"withConfli |
| `node scripts/places/audit-language.mjs . docs/verification-3.19/content-language-audit.json` | 0 | } |
| `node scripts/places/check-authoring-3.19.mjs --all` | 0 | part-04.json v312wd-q4871819 120 1917..1917 zh126 en60 -- EN |
| `node scripts/places/assemble-events-upgraded-3.19.mjs --check` | 0 | } |
| `node scripts/places/apply-battle-year-fixes-3.19.mjs --check` | 0 | } |

| 归档 | mtime | OS | 与 .json deepEqual |
|---|---|---|---|
| `public/data/events.json.gz` | 0 | 255 | true |
| `public/data/battles.json.gz` | 0 | 255 | true |

英文栏 CJK 违规 0 条；战役层 8/8；跨层 3/3。

## 7. 新增清单（40 条）

| rank | id | 中文标题 | 英文标题（引用条目） | 年 | 区域 |
|---|---|---|---|---|---|
| 81 | `v312wd-q2624980` | 图卜鲁格战役 | Battle of Tobruk (1911) | 1911 | africa |
| 82 | `v312wd-q2363420` | 边境支援 | 2011 southern Israel cross-border attacks | 2011 | west-central-asia |
| 83 | `v312wd-q2705449` | Mons Algidus战役 | Battle of Mount Algidus | -458 | europe |
| 84 | `v312wd-q1290572` | 祖尔堡战役 | Battle of Beth Zur | -164 | west-central-asia |
| 85 | `v312wd-q1268349` | 杰卡里亚堡战役 | Battle of Beth Zechariah | -162 | west-central-asia |
| 86 | `v312wd-q3555607` | 埃克巴坦那战役 | Battle of Ecbatana | -129 | africa |
| 87 | `v312wd-q2457256` | 奥尔良战役 | Battle of Orléans (463) | 463 | europe |
| 88 | `v312wd-q2599844` | 克列茨克战役 | Battle of Kletsk | 1506 | europe |
| 89 | `v312wd-q1888562` | 1804年10月5日海战 | Action of 5 October 1804 | 1804 | europe |
| 90 | `v312wd-q654722` | 穆雷达战役 | Battle of Mulayda | 1891 | west-central-asia |
| 91 | `v312wd-q2889954` | 西贡战役 | Battle of Saigon (1968) | 1968 | southeast-asia |
| 92 | `v312wd-q2889747` | 2006年拉马迪战役 | Battle of Ramadi (2006) | 2006 | africa |
| 93 | `v312wd-q4871330` | 杰宁战役 | Battle of Jenin (2002) | 2002 | west-central-asia |
| 94 | `v312wd-q1268317` | 伊茅斯战役 | Battle of Emmaus | -165 | west-central-asia |
| 95 | `v312wd-q2890073` | 苏帕洽战役 | Battle of Suipacha | 1810 | americas |
| 96 | `v312wd-q1416369` | 克莱斯勒农场战役 | Battle of Crysler's Farm | 1813 | americas |
| 97 | `v312wd-q177470` | 斯托尼河战役 | Battle of Stoney Creek | 1813 | americas |
| 98 | `v312wd-q303176` | 马尼拉战役 | Battle of Manila (1898) | 1898 | southeast-asia |
| 99 | `v312wd-q786657` | 卡尔德隆大桥战役 | Battle of Calderón Bridge | 1811 | americas |
| 100 | `v312wd-q21685887` | 拉马迪之战 (2015-16) | Battle of Ramadi (2015–2016) | 2016 | africa |
| 101 | `v312wd-q4872472` | 苏萨战役 | Battle of Susa | -647 | africa |
| 102 | `v312wd-q1268339` | 霍伦堡战役 | Battle of Beth Horon (166 BC) | -166 | west-central-asia |
| 103 | `v312wd-q1243260` | 戈尔佩赫拉战役 | Battle of Golpejera | 1072 | europe |
| 104 | `v312wd-q932519` | 姆波柔惹战役 | Battle of Mbororé | 1641 | americas |
| 105 | `v312wd-q2888406` | 钻石山战役 | Battle of Diamond Hill | 1900 | africa |
| 106 | `v312wd-q2889668` | 白杨树丛战役 | Battle of Poplar Grove | 1900 | africa |
| 107 | `v312wd-q2026028` | 卷发作战 | Operation Crimp | 1966 | southeast-asia |
| 108 | `v312wd-q4872157` | 拉马迪战役 | Battle of Ramadi (2004) | 2004 | africa |
| 109 | `v312wd-q4872168` | 拉斯坎坡里战役 | Battle of Ras Kamboni (2007) | 2007 | africa |
| 110 | `v312wd-q3496783` | 伯和仑战役 | Battle of Beth Horon (66) | 66 | west-central-asia |
| 111 | `v312wd-q4271928` | 巴厘巴板海战 | Battle of Balikpapan (1945) | 1945 | oceania |
| 112 | `v312wd-q1754030` | 2008年玛达克冲突 | 2008 Mardakert clashes | 2008 | west-central-asia |
| 113 | `v312wd-q1753755` | 2010年马尔达凯特冲突 | 2010 Mardakert clashes | 2010 | west-central-asia |
| 114 | `v312wd-q604356` | 塔迈尔战役 | Battle of Tamai | 1884 | africa |
| 115 | `v312wd-q5123963` | 血腥星期日 (1900年) | Bloody Sunday (1900) | 1900 | africa |
| 116 | `v312wd-q2053030` | 冬季行动（1914-1915） | Winter operations 1914–1915 | 1914 | europe |
| 117 | `v312wd-q250383` | 内里事件 | Affair of Néry | 1914 | europe |
| 118 | `v312wd-q2920325` | 马尔列弗纳战役 | Battle of the Ascent of Lebonah | -167 | west-central-asia |
| 119 | `v312wd-q4871718` | 莫克雷德斯伯恩战役 | Battle of Mercredesburne | 485 | europe |
| 120 | `v312wd-q4871819` | 莫卧儿岭战役 | Battle of Mughar Ridge | 1917 | west-central-asia |

坐标、区域、类别、精度、locationType 与 regionBasis 全部原样继承结构化记录；逐条继承审计见 `docs/verification-3.19/content-upgrade-authoring.json`。

## 8. 仍缺什么

1. **索引级还剩 13 条**（rank 121–133，清单见 JSON 的 `remaining.structuredIds`）。这 13 条同样没有中文条目，下一轮从第 121 名起即可收尾。
2. **中文全库核查仍未完成**：本轮只有精确标题核对，全文搜索受 429 限制未跑；「是否存在标题不同的中文条目」这一问题的答案是**未确认**。
3. **本批 40 条没有中文维基条目**：全部在 notes 明写缺口与"本方法未确认"，只引用英文条目 + 维基数据实体，没有编造引用、没有音译标题。
4. **标签用词不准的三处**按来源原样保留：巴厘巴板"海战"（实为两栖登陆）、2008/2010 同一地名两种译法（玛达克 / 马尔达凯特）。界面层面如何处理由 Lead 判断。

## 9. 诚实声明

- 本轮只有一处触及 `public/data/battles.json`（Q786657 年份同步），任务书写作用域已包含该文件。
- 年份一律以条目正文为准：1 条与索引年冲突的已留档 `yearCorrection` 并同步跨层，8 条 BCE 全部逐条核对正文写法。
- 没有把任何无来源内容写进交付物；中文缺口的表述是"本方法未确认"，不是"不存在"。
