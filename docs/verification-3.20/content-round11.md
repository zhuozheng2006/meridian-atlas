# 3.20 内容第十一轮：最后 13 条升级完毕，结构化索引归零（291 → 0）

任务 task-23。基线提交 `7b609630`，本报告由 `scripts/places/report-content-round11-3.20.mjs --baseline=7b609630` 从七批文件与命令输出生成，可复跑。

**结论**：最后 **13 条**索引事件升级完毕，`provenance=wikidata-structured` 计数 **0**——**291 条索引事件全部消化完毕**。事件总数 709 不变，编辑级 v312wd 条目 **291** 条；11 条校验命令 exit 0。

## 1. 本轮结果

| 指标 | 基线 | 本轮 |
|---|---|---|
| 事件总数 | 709 | 709 |
| 其中索引级（provenance=wikidata-structured） | 13 | **0** |
| 其中编辑级 v312wd 条目 | 278 | **291** |
| 战役层 battles | 603 | 603（本轮无年份修正） |

本批 13 条：中文 110–130 字（要求 110–135），英文 51–60 词（要求 45–60）；id 保持 `v312wd-<qid>`，provenance 整条删除，wikidataQid 保留；无 BCE 条目、无年份修正。

**一处需要说明的装配判断**：Q3486072 的记录标题 `Battle of Akhaltsikhe` 被导言启发式判为消歧义页，但读全文后它是**一条短条目**，同时记述 1828 年城下进攻战（即本条）与 1829 年同一要塞的防御战。装配脚本为此保留了**有据可查的例外**（`EN_DAB_OVERRIDE`），条目 notes 里写明该页覆盖两场战事、本条专指 1828 年。这是本轮唯一一次放行被自动标记的页面，理由与证据都在 `docs/verification-3.20/content-upgrade-label-title-check.json`。

## 2. 中文核查：本方法未确认

- 窗口内 13 条都没有 zhwiki sitelink；`scripts/places/verify-zh-absence-3.20.mjs` 用记录标签做精确标题核对：**13/13 在该标签下没有页面**。
- zh.wikipedia 全文搜索在本会话持续 429，本轮**未运行**。
- 因此措辞统一为「本方法未确认」：精确标题核对发现不了**标题不同**的中文条目，也不能证明其不存在。

## 3. 总账：291 条索引事件是怎么被消化掉的

起点是 3.14 的热度排名：**291 条**索引级事件。七批升级合计 **291 条**，与起点完全相等，收尾时索引级计数为 0。

| 批次 | 窗口 | 本批条数 | 累计 | 年份修正 | 标签≠条目标题 |
|---|---|---|---|---|---|
| 3.14 | ranks 1-40 (3.14 ranking) | 40 | 40 | 0 | 6 |
| 3.15 | ranks 41-100 minus 2 deferred | 58 | 98 | 0 | 15 |
| 3.16 | ranks 101-161 minus 1 deferred | 60 | 158 | 0 | 13 |
| 3.17 | 3.17 ranking ranks 1-40 | 40 | 198 | 5 | 10 |
| 3.18 | 3.17 ranking ranks 41-80 | 40 | 238 | 2 | 13 |
| 3.19 | 3.17 ranking ranks 81-120 | 40 | 278 | 1 | 17 |
| 3.20 | 3.17 ranking ranks 121-133 | 13 | 291 | 0 | 2 |
| **合计** |  | **291** |  | **8** | **76** |

3.15 与 3.16 两轮共 **3 条**因维基数据 P585 与条目正文冲突而暂缓（Q111383245、Q112206624、Q2274112），全部在 3.17 连同年份修正一并升级，**没有一条被丢弃**。

### 3.1 修正过的年份（共 8 条）

| 批次 | qid | 索引年 | 采用 | 依据 |
|---|---|---|---|---|
| 3.17 | Q111383245 | 2020 | **2022** | 维基数据 P585 精度为年代（2020s），索引条目因此记为 2020 年；中英文维基条目均记交火自 2022 年开始、2024 年 2 月 17 日乌军撤离，本条采用 2022–2024 年。 |
| 3.17 | Q112206624 | 2020 | **2022** | 维基数据 P585 精度为年代（2020s）；中文维基记2022年4月在克雷明纳的交战，英文条目（克雷明纳条目重定向至顿巴斯攻势）记攻势始于2022年4月18日。 |
| 3.17 | Q2274112 | 1600 | **1614** | 中英文维基条目均记为1614年11月26日；维基数据 P585 记为1600年12月26日，与该战役所属的大坂冬之阵（1614–1615年）矛盾，本条采用条目正文年份。 |
| 3.17 | Q1644792 | -497 | **-496** | 英文维基正文指出此战年代自古不明：李维系于公元前499年，狄奥尼修斯等作前496年，现代学者另有前493、前489年之说；维基数据 P585 精度为年代（前490年代）。本条采用正文最常引用的前496年（记作 −496）。 |
| 3.17 | Q1036947 | -1178 | **-1175** | 维基数据 P585 为 ISO 天文纪年 −1178（即公元前1179年），英文维基正文记该战役发生于约公元前1175年；本条采用正文的约数年份并记作 −1175，约数性质在 notes 中说明。 |
| 3.18 | Q1443091 | 1504 | **1503** | 英文维基正文与维基数据P585均记1503年12月29日（精度到日），而结构化索引年为1504；本条以来源正文为准采用1503年，只保留年份精度。 |
| 3.18 | Q2888964 | 1185 | **1184** | 英文维基正文明确记该战役发生于1184年（源平合战期间源范赖渡海攻藤户），而索引年与维基数据P585为1185年1月10日（精度到日）；差异可能源于旧历年末与公历年初的换算。本条以条目正文为准采用1184年。 |
| 3.19 | Q786657 | 2000 | **1811** | 英文维基正文明确记该战役发生于1811年1月（瓜达拉哈拉以东，墨西哥独立战争），而结构化索引年与维基数据P585为2000年1月17日；该P585值显然是年份录入错误，本条以条目正文为准采用1811年，并同步修正战役层。 |

八条全部是**维基数据 P585 有缺陷**（年代精度被读成具体年份、与条目正文矛盾、或明显的年份录入错误），一律以条目正文为准，并在 `editorialNotes` 与 `yearCorrection` 中留档；**八条全部同时在 `battles.json` 中出现，已用 `apply-battle-year-fixes-3.17/3.18/3.19.mjs` 同步修正战役层（跨层校验 3/3 通过）。

### 3.2 标题修正（标签≠条目标题，共 76 条）

排名文件里的 `titleEn` 是**维基数据英文标签**，不能直接当引用标题。全部 76 条都改用**英文维基条目实际标题**（含消歧义后缀）。49 条是"标签 + 括号年份或限定词"，25 条是完全改名，2 条仅大小写或拼写差异。

为什么必须这么做，有两批的直接证据：3.18 批 `Battle of Manzikert` 是 1071 年拜占庭-塞尔柱之战（该批是 1915 年一战）、`Battle of Garigliano` 是 915 年（该批是 1503 年）；3.19 批 14 个标签里 **10 个是消歧义页**，`Battle of Ramadi` 一个标签覆盖四场同名战事而该批占了三场。

| 批次 | qid | 标签（不可用） | 实际条目（引用） |
|---|---|---|---|
| 3.14 | Q605321 | Battle of Panipat | **First Battle of Panipat** |
| 3.14 | Q139808 | Battle of the Maureaco Fields | **Battle of the Catalaunian Plains** |
| 3.14 | Q108102583 | Fall of Kabul | **Fall of Kabul (2021)** |
| 3.14 | Q47465940 | Turkish military operation in Afrin | **Operation Olive Branch** |
| 3.14 | Q603549 | Battle of Nahāvand | **Battle of Nahavand** |
| 3.14 | Q18071930 | Siege of Kobanî | **Siege of Kobani** |
| 3.15 | Q112016 | Battle of the Persian Gate on the Mountain | **Battle of the Persian Gate** |
| 3.15 | Q63146684 | Battles of Bedriacum | **Battle of Bedriacum** |
| 3.15 | Q2588587 | Battle of Nisibis | **Battle of Nisibis (217)** |
| 3.15 | Q602880 | Battle of Anchialus | **Battle of Anchialus (708)** |
| 3.15 | Q1887494 | Battle of Uji | **Battle of Uji (1180)** |
| 3.15 | Q1137980 | Battle of Ravenna | **Battle of Ravenna (1512)** |
| 3.15 | Q233414 | Battle of Panipat | **Second Battle of Panipat** |
| 3.15 | Q1193959 | Battle of Toba-Fushimi | **Battle of Toba–Fushimi** |
| 3.15 | Q2665626 | Battle of Beersheba | **Battle of Beersheba (1917)** |
| 3.15 | Q199371 | Battle of Megiddo | **Battle of Megiddo (1918)** |
| 3.15 | Q709333 | Battle of Changsha | **Battle of Changsha (1939)** |
| 3.15 | Q696931 | Battle of Manila | **Battle of Manila (1945)** |
| 3.15 | Q699093 | Ruhr Pocket | **Ruhr pocket** |
| 3.15 | Q1804983 | Battle of Baghdad | **Battle of Baghdad (2003)** |
| 3.15 | Q101305942 | Battle of Shusha | **Battle of Shusha (2020)** |
| 3.16 | Q3827914 | Battle of Xingyang | **Battle of Xingyang (190)** |
| 3.16 | Q1281559 | Battle of Isonzo | **Battle of Isonzo (489)** |
| 3.16 | Q851504 | Battle of Vouille | **Battle of Vouillé** |
| 3.16 | Q1987213 | Battle of Dyrrhachium | **Battle of Dyrrhachium (1081)** |
| 3.16 | Q840006 | Battle of Stockach | **Battle of Stockach (1800)** |
| 3.16 | Q2890355 | Battle of Verona | **Battle of Verona (1805)** |
| 3.16 | Q857434 | Battle of Caldiero | **Battle of Caldiero (1805)** |
| 3.16 | Q4087313 | Battle of Peking | **Battle of Peking (1900)** |
| 3.16 | Q2748375 | Black Friday | **Black Friday (1945)** |
| 3.16 | Q379433 | Operation Ten-Go | **Operation Kikusui I** |
| 3.16 | Q15913566 | Battle of O͘-gû-lân | **Battle of O-gu-lan** |
| 3.16 | Q18639122 | Battle of Ramadi | **Battle of Ramadi (2014–2015)** |
| 3.16 | Q22117640 | Battle of Avdiivka | **Battle of Avdiivka (2017)** |
| 3.17 | Q767124 | Battle of Ctesiphon | **Battle of Ctesiphon (363)** |
| 3.17 | Q639827 | Siege of Damascus | **Siege of Damascus (634)** |
| 3.17 | Q652320 | Battle of Toulouse | **Battle of Toulouse (721)** |
| 3.17 | Q382967 | Siege of Damascus | **Siege of Damascus (1148)** |
| 3.17 | Q1148862 | Battle of Fariskur | **Battle of Fariskur (1250)** |
| 3.17 | Q2888296 | Conquest of Ceuta | **Portuguese conquest of Ceuta** |
| 3.17 | Q2420811 | Battle of Mount Tabor | **Battle of Mount Tabor (1799)** |
| 3.17 | Q1420382 | Battle of Tel el-Kebir | **Battle of Tell El Kebir** |
| 3.17 | Q118445706 | Battle of La Plata | **Battle of La Plata (1957)** |
| 3.17 | Q111383245 | Battle of Avdiivka | **Battle of Avdiivka (2023–2024)** |
| 3.18 | Q2281774 | Battle of Marj al-Rahit | **Battle of Marj Rahit (684)** |
| 3.18 | Q1747219 | Battle of Avignon | **Siege of Avignon (737)** |
| 3.18 | Q966312 | Battle of Anchialus | **Battle of Anchialus (763)** |
| 3.18 | Q1443091 | Battle of Garigliano | **Battle of Garigliano (1503)** |
| 3.18 | Q592069 | Battle of Sellenberk | **Battle of Șelimbăr** |
| 3.18 | Q2750968 | Battle of Alexandria | **Battle of Alexandria (1801)** |
| 3.18 | Q1192867 | Battle of Pułtusk | **Battle of Pułtusk (1806)** |
| 3.18 | Q908888 | 1842 retreat from Kabul | **Battle of Gandamak** |
| 3.18 | Q220766 | Battle of Manzikert | **Battle of Manzikert (1915)** |
| 3.18 | Q936223 | Battle of Kara Killisse | **Battle of Kara Killisse (1915)** |
| 3.18 | Q2889635 | Final operations in Slovenia | **Battle of Poljana** |
| 3.18 | Q5432157 | Fall of Kabul | **Fall of Kabul (2001)** |
| 3.18 | Q20045970 | Battle of Marinka | **Battle of Marinka (2015)** |
| 3.19 | Q1268339 | Battle of Beth Horon | **Battle of Beth Horon (166 BC)** |
| 3.19 | Q3496783 | Battle of Beth Horon | **Battle of Beth Horon (66)** |
| 3.19 | Q2457256 | Battle of Orleans | **Battle of Orléans (463)** |
| 3.19 | Q303176 | Battle of Manila | **Battle of Manila (1898)** |
| 3.19 | Q5123963 | Bloody Sunday | **Bloody Sunday (1900)** |
| 3.19 | Q2624980 | Battle of Tobruk | **Battle of Tobruk (1911)** |
| 3.19 | Q2053030 | Battle of Givenchy | **Winter operations 1914–1915** |
| 3.19 | Q250383 | Action at Néry | **Affair of Néry** |
| 3.19 | Q4271928 | Battle of Balikpapan | **Battle of Balikpapan (1945)** |
| 3.19 | Q2889954 | Battle of Saigon | **Battle of Saigon (1968)** |
| 3.19 | Q4871330 | Battle of Jenin | **Battle of Jenin (2002)** |
| 3.19 | Q4872157 | Battle of Ramadi | **Battle of Ramadi (2004)** |
| 3.19 | Q2889747 | Battle of Ramadi | **Battle of Ramadi (2006)** |
| 3.19 | Q4872168 | Battle of Ras Kamboni | **Battle of Ras Kamboni (2007)** |
| 3.19 | Q1754030 | 2008 Mardakert skirmishes | **2008 Mardakert clashes** |
| 3.19 | Q1753755 | 2010 Mardakert skirmishes | **2010 Mardakert clashes** |
| 3.19 | Q21685887 | Battle of Ramadi | **Battle of Ramadi (2015–2016)** |
| 3.20 | Q3486072 | Battle of Akhalzic | **Battle of Akhaltsikhe** |
| 3.20 | Q4930640 | Bluff Cove Air Attacks | **Bluff Cove air attacks** |

## 4. 校验

| 命令 | exit | 末行 |
|---|---|---|
| `node scripts/validate-cross-layer.mjs` | 0 | {"passed":3,"total":3,"events":709,"battles":603} |
| `node scripts/validate.mjs` | 0 | {"result":"passed","checks":10,"events":709,"boundaryRecords":13765,"p |
| `node scripts/validate-v2.mjs` | 0 | } |
| `node scripts/validate-places.mjs` | 0 | } |
| `node scripts/validate-city-time.mjs` | 0 | } |
| `node scripts/validate-polity-period.mjs` | 0 | PASS 30/30 real polity dossier regressions |
| `node scripts/validate-release.mjs` | 0 | {"result":"passed","checks":4,"staticFiles":17732,"physicalFiles":357, |
| `node scripts/places/validate-battles.mjs . docs/verification-3.20/content-battles-validation.json` | 0 | {"passed":8,"total":8,"battles":603,"withBelligerents":423,"withConfli |
| `node scripts/places/audit-language.mjs . docs/verification-3.20/content-language-audit.json` | 0 | } |
| `node scripts/places/check-authoring-3.20.mjs --part=docs/verification-3.20/authoring/part-01.json` | 0 | part-01.json v312wd-q4871076 133 2009..2009 zh116 en51 -- EN |
| `node scripts/places/assemble-events-upgraded-3.20.mjs --check` | 0 | } |

| 归档 | mtime | OS | 与 .json deepEqual |
|---|---|---|---|
| `public/data/events.json.gz` | 0 | 255 | true |
| `public/data/battles.json.gz` | 0 | 255 | true |

英文栏 CJK 违规 0 条；结构化索引 0 条；战役层 8/8；跨层 3/3。

## 5. 新增清单（13 条，最后一批）

| rank | id | 中文标题 | 英文标题（引用条目） | 年 | 区域 |
|---|---|---|---|---|---|
| 121 | `v312wd-q2888378` | 太古之战 | Battle of Taegu | 1950 | east-asia |
| 122 | `v312wd-q2889338` | 米尔巴特之战 | Battle of Mirbat | 1972 | west-central-asia |
| 123 | `v312wd-q4930640` | 被阿根廷空袭 | Bluff Cove air attacks | 1982 | americas |
| 124 | `v312wd-q2890373` | 瓦纳特战役 | Battle of Wanat | 2008 | south-asia |
| 125 | `v312wd-q2889133` | 列里方丹战役 | Battle of Leliefontein | 1900 | africa |
| 126 | `v312wd-q4438362` | 奥科塔尔战役 | Battle of Ocotal | 1927 | americas |
| 127 | `v312wd-q4872743` | 无线岭战役 | Battle of Wireless Ridge | 1982 | americas |
| 128 | `v312wd-q1273257` | 拉拉古纳战役 | Battle of Aguere | 1494 | africa |
| 129 | `v312wd-q13423520` | 奥德河-尼萨河战役 | Battle of the Oder–Neisse | 1945 | europe |
| 130 | `v312wd-q3486072` | 阿哈尔齐赫之战 | Battle of Akhaltsikhe | 1828 | west-central-asia |
| 131 | `v312wd-q1497922` | 库里沃夫卡战役 | Battle of Kuryłówka | 1945 | europe |
| 132 | `v312wd-q2896424` | 亚德莫迪凯战役 | Battle of Yad Mordechai | 1948 | west-central-asia |
| 133 | `v312wd-q4871076` | 甘加尔之战 | Battle of Ganjgal | 2009 | south-asia |

坐标、区域、类别、精度、locationType 与 regionBasis 全部原样继承结构化记录。

## 6. 这条流水线之后还剩什么

1. **结构化索引已归零**，没有遗留的索引级事件；排名文件 rank 121–133 的最后一批即本轮。
2. **中文语种覆盖**是唯一未解决的实质问题：本批 13 条都没有中文维基条目（此前各批同样如此，3.17 排名显示 133 个候选里只有 7 个有中文条目）。中文缺口已逐条写在 `editorialNotes`。
3. **中文全库核查未完成**：七批都没有跑完 zh.wikipedia 全文搜索（429 限流），"是否存在标题不同的中文条目"的答案仍是**未确认**。
4. **暴行层不在本流水线范围内**，由另一条线维护（`public/data/atrocities.json`），本轮未触碰。

## 7. 诚实声明

- 本轮没有改 `battles.json`（无年份修正）；没有跑 `prepare:assets`；没有改其它产品文件。
- 没有把任何无来源内容写进交付物；唯一一次放行自动标记的消歧义页（Q3486072）有读全文证据与 notes 说明。
- 中文缺口的表述始终是"本方法未确认"，不是"不存在"。
- 总账里每一个数字都能在对应批次的 `content-upgrade-authoring.json` 与批次 JSON 中复核。
