# 3.16 内容第七轮：事件升级至第 161 名，战役层语义裁决落地

任务 task-19。基线提交 `6aac5b51`，全部数字由 `scripts/places/report-content-round7-3.16.mjs --baseline=6aac5b51` 从已提交基线与当前文件生成，可复跑。

**结论**：索引级事件由 **193 条降到 133 条**，本轮升级 **60 条**（rank 101–161）；战役层的语义边界由新的独立数据集 `public/data/atrocities.json(+.gz)`（293 条，校验 8/8）承接，**未并入 battles 层**；13 条校验命令全部 exit 0。

## 1. 结果摘要

| 指标 | 基线（6aac5b51） | 本轮 |
|---|---|---|
| 事件总数 | 709 | 709 |
| 其中索引级（provenance=wikidata-structured） | 193 | **133** |
| 其中编辑级 v312wd 条目 | 98 | **158** |
| 战役层 battles | 603 | 603（未改动） |
| 暴行层 atrocities | — | 293（新增） |

本批 60 条的书写窗口：中文 110–135 字（要求 110–135），英文 45–60 词（要求 45–60）；id 一律保持 `v312wd-<qid>`，**provenance 字段整条删除**，`wikidataQid` 保留（60/60 通过）。

## 2. 选点与范围

- 窗口：热度排名 rank 101–161（排名文件 `docs/verification-3.14/content-upgrade-ranking.json`，291 条，本轮未重跑 WDQS）。
- **剔除 1 条数据源缺陷**：
  - rank 132 `Q2274112` 今福之战：Wikidata P585 records 1600 while the English article dates the battle to 26 November 1614 and the Chinese article places it in the winter campaign of the Siege of Osaka (1614). An editorial entry carrying the source year would break cross-layer consistency with the battle layer, and one carrying 1600 would enshrine a date both articles contradict, so the entity stays at index level.
- rank 162–170 共 9 条**留作下一轮**（原因见第 8 节）：162 玉奥战役、163 图卢兹战役、164 拉普拉塔战役、165 巴当山之战、166 塞迪曼战役、167 卡尔卡尔之战、168 维苏威战役、169 塔吉纳战役、170 克节朗战役。
- 本轮结束时仍有 133 条索引级事件（完整清单见 JSON 的 `remaining.structuredEntities`）。

## 3. 引用解析：消歧义与缺语种（本轮最费工的一步）

排名记录的文章标题不能直接当引用：
- 英文替换标题：`Battles of Stockach and Engen`
- 英文替换标题：`Battle of Dyrrhachium (1081)`
- 英文替换标题：`Battle of Caldiero (1805)`
- 英文替换标题：`Operation Kikusui I`
- 英文替换标题：`Battle of Toulouse (721)`
- 英文替换标题：`Battle of Isonzo (489)`
- 英文替换标题：`Black Friday (1945)`
- 英文替换标题：`Battle of Peking (1900)`
- 英文替换标题：`Battle of Xingyang (190)`
- 英文替换标题：`Battle of Verona (1805)`
- 英文替换标题：`Battle of Ramadi (2014–2015)`
- 英文替换标题：`Battle of Avdiivka (2017)`
- 中文补题标题：`天號作戰`
- 中文补题标题：`博川戰鬥`
- 中文补题标题：`圖盧茲之戰`
- 中文补题标题：`第二次法蘭克-西哥德戰爭`

做法与 3.15 相同并更严：先跑 MediaWiki 搜索取候选，再**逐条读取候选条目的导言**确认是同一事件，确认后才写入装配脚本的固定对照表；证据留在 `docs/verification-3.16/content-upgrade-titles-verified.json` 与 `docs/verification-3.16/content-upgrade-resolve.json`。**没有一条靠猜**。

语种覆盖：英文维基条目 58/60，中文维基条目 55/60，双语 53 条。

- **中文维基确无条目（5 条）**：Q851504 武耶之战、Q747679 阿提密西安海战、Q383614 科希马战役、Q1113659 富尔福德战役、Q1987213 都拉斯战役 (1081年)。这些条目引用英文维基 + 维基数据实体，并在 `editorialNotes` 明写"中文维基百科尚无该条目"。
- **英文维基确无条目（2 条）**：Q15913566 乌牛栏之役、Q15928518 青树坪战役。同样在 notes 中说明。
- 每条至少 2 条 https 来源（维基数据实体 + 至少一个语种的维基条目），每条来源都带 `accessedAt`；装配脚本会拒绝没有任何维基条目的条目。

## 4. 民用纪年（无 0 年）

维基数据 P585 是 ISO 8601 天文纪年，本项目民用纪年无 0 年，故 iso≤0 一律写作 iso−1。本轮 7 条 BCE：

| id | qid | 条目标题 | 民用纪年（交付） | 对应 ISO 年 |
|---|---|---|---|---|
| v312wd-q2313318 | Q2313318 | 城濮之战 | -632 | -631 |
| v312wd-q747679 | Q747679 | 阿提密西安海战 | -480 | -479 |
| v312wd-q914210 | Q914210 | 笠泽之战 | -478 | -477 |
| v312wd-q2005185 | Q2005185 | 马陵之战 | -342 | -341 |
| v312wd-q3270429 | Q3270429 | 巨鹿之战 | -207 | -206 |
| v312wd-q847402 | Q847402 | 彭城之战 | -205 | -204 |
| v312wd-q722331 | Q722331 | 马邑之谋 | -133 | -132 |

装配闸门强制 `start === 民用纪年(ranking ISO)`，因此这类偏移不可能再次发生（历史上米吉多 −1457、马拉松 −490 就是漏了这一步）。

## 5. 战役层语义裁决的执行

裁决：`battles` 层语义是"两军交战"，单方面杀戮/屠杀不属于该层。执行结果：

- **没有**把这批记录并入 battles：battles 仍为 603 条，区域分布不变。
- 新增独立数据集 `public/data/atrocities.json(+.gz)`：池 302 条（Q3199915 × 298、Q645883 × 1、Q2380335 × 1、Q97368680 × 2），交付 **293 条**。
- 交付标准（硬）：有年份、有坐标、有来源、至少有一个语种的名称。被排除的只有 **9 条两种语言都没有名称**的记录（坐标/年份缺失各 0 条）。
- 中文名覆盖：**37 条有中文名、256 条没有**。没有中文名的记录 `nameZh=null`，**不音译、不机翻**；中文名是维基数据标签原样引用（其中 7 条含繁体字形，policy 已写明不做字形转换）。
- 来源：每条都有维基数据实体链接，其中 3 条附有声明级参考链接；英文/中文名之外的国家、冲突、受害者字段只保留来源扫描记录的**中文标签**，英文数组留空而不机翻。
- 分布：按区域 oceania 138、south-asia 111、east-asia 14、southeast-asia 30。
- **互斥由校验器强制**：`scripts/places/validate-atrocities.mjs` 有一条检查是两个图层按维基数据实体 id 必须互斥，任一实体同时出现在两处即 fail。
- 本轮**不接 UI**（`public/` 下仅新增这一对数据文件），也没有改 battles.json：政策里写明"将来接 UI 时再决定中文模式是否只显示有中文名的子集"。

## 6. 验证

| 命令 | exit |
|---|---|
| `node scripts/validate-cross-layer.mjs` | 0 |
| `node scripts/validate.mjs` | 0 |
| `node scripts/validate-v2.mjs` | 0 |
| `node scripts/validate-places.mjs` | 0 |
| `node scripts/validate-city-time.mjs` | 0 |
| `node scripts/validate-polity-period.mjs` | 0 |
| `node scripts/validate-release.mjs` | 0 |
| `node scripts/places/validate-battles.mjs . docs/verification-3.16/content-battles-validation.json` | 0 |
| `node scripts/places/validate-atrocities.mjs . docs/verification-3.16/content-atrocities-validation.json` | 0 |
| `node scripts/places/audit-language.mjs . docs/verification-3.16/content-language-audit.json` | 0 |
| `node scripts/places/assemble-events-upgraded-3.16.mjs --check` | 0 |
| `node scripts/places/build-atrocities.mjs --check` | 0 |
| `node scripts/places/apply-events-3.10.mjs --check --batch=editorial/events-upgraded-3.16.json` | 0 |

三个 `.gz` 镜像：`public/data/events.json.gz`（mtime=0，OS=255，与 .json deepEqual=true）；`public/data/battles.json.gz`（mtime=0，OS=255，与 .json deepEqual=true）；`public/data/atrocities.json.gz`（mtime=0，OS=255，与 .json deepEqual=true）。

引用可达性（本轮唯一联网校验）：`scripts/places/check-source-links-3.16.mjs` 对本批全部 173 条事件引用逐条发起请求，并抽样 12 条暴行层引用，结果 **185/185 返回 HTTP 200，失败 0 条**（明细见 `docs/verification-3.16/content-source-links.json`）。这一步是必要的：本批有 14 个手工修正的标题，写错一个字只会表现为线上断链。

交叉层校验 `validate-cross-layer.mjs` **3/3 通过**（exit 0，含"编辑级事件必须带注明日期的来源、且 provenance 状态已知"）；英文栏 CJK 违规 0 条；战役层 **8/8 通过**；暴行层 **8/8 通过**。

## 7. 新增清单（60 条）

| rank | id | 中文标题 | 英文标题 | 年 | 区域 | 英文条目 | 中文条目 |
|---|---|---|---|---|---|---|---|
| 101 | `v312wd-q2397117` | 采石之战 | Battle of Caishi | 1161 | east-asia | Battle of Caishi | 采石之戰 (1161年) |
| 102 | `v312wd-q650507` | 富士川之战 | Battle of Fujigawa | 1180 | east-asia | Battle of Fujigawa | 富士川之戰 |
| 103 | `v312wd-q657502` | 埃尔兴根之战 | Battle of Elchingen | 1805 | europe | Battle of Elchingen | 埃爾興根之戰 |
| 104 | `v312wd-q2663279` | 八里桥之战 | Battle of Palikao | 1860 | east-asia | Battle of Palikao | 八里橋之戰 |
| 105 | `v312wd-q1281559` | 伊松佐河之战 | Battle of Isonzo (489) | 489 | europe | Battle of Isonzo (489) | 伊松佐河戰役 (489年) |
| 106 | `v312wd-q2237381` | 粟津之战 | Battle of Awazu | 1184 | east-asia | Battle of Awazu | 粟津之戰 |
| 107 | `v312wd-q348998` | 伊斯利之战 | Battle of Isly | 1844 | africa | Battle of Isly | 伊斯利之戰 |
| 108 | `v312wd-q949635` | 坎布拉战役 | Battle of Kambula | 1879 | africa | Battle of Kambula | 坎布拉战役 |
| 109 | `v312wd-q2313318` | 城濮之战 | Battle of Chengpu | -632 | east-asia | Battle of Chengpu | 城濮之战 |
| 110 | `v312wd-q494058` | 天安号沉没事件 | ROKS Cheonan sinking | 2010 | east-asia | ROKS Cheonan sinking | 天安号沉没事件 |
| 111 | `v312wd-q1064989` | 严岛之战 | Battle of Miyajima | 1555 | east-asia | Battle of Miyajima | 嚴島之戰 |
| 112 | `v312wd-q857434` | 卡尔迪耶罗之战 | Battle of Caldiero (1805) | 1805 | europe | Battle of Caldiero (1805) | 卡爾迪耶羅之戰 (1805年) |
| 113 | `v312wd-q4087313` | 北京之战 (1900年) | Battle of Peking (1900) | 1900 | east-asia | Battle of Peking (1900) | 北京之战 (1900年) |
| 114 | `v312wd-q543075` | 荷兰港战役 | Battle of Dutch Harbor | 1942 | americas | Battle of Dutch Harbor | 荷蘭港戰役 |
| 115 | `v312wd-q4871254` | 虎牢之战 | Battle of Hulao | 621 | east-asia | Battle of Hulao | 虎牢之戰 |
| 116 | `v312wd-q2338569` | 奥林太坦坡战役 | Battle of Ollantaytambo | 1537 | americas | Battle of Ollantaytambo | 奧林太坦坡戰役 |
| 117 | `v312wd-q840006` | 施托卡赫-恩根之战 | Battle of Stockach (1800) | 1800 | europe | Battles of Stockach and Engen | 施托卡赫-恩根之戰 |
| 118 | `v312wd-q575510` | 普天堡战斗 | Battle of Pochonbo | 1937 | east-asia | Battle of Pochonbo | 普天堡戰鬥 |
| 119 | `v312wd-q2748375` | 黑色星期五 (1945年) | Black Friday (1945) | 1945 | europe | Black Friday (1945) | 黑色星期五 (1945年) |
| 120 | `v312wd-q18639122` | 拉马迪之战 (2014-2015年) | Battle of Ramadi (2014–2015) | 2014 | africa | Battle of Ramadi (2014–2015) | 拉馬迪之戰 (2014年至2015年) |
| 121 | `v312wd-q1374378` | 卡尔斯战役 | Battle of Kars | 1877 | west-central-asia | Battle of Kars | 卡爾斯戰役 |
| 122 | `v312wd-q4871437` | 乞力马扎罗山战役 | Battle of Kilimanjaro | 1914 | africa | Battle of Kilimanjaro | 吉力馬札羅山戰役 |
| 123 | `v312wd-q289102` | 朝鲜海峡海战 | Battle of Korea Strait | 1950 | east-asia | Battle of Korea Strait | 朝鮮海峽海戰 |
| 124 | `v312wd-q4870849` | 达斯曼宫战役 | Battle of Dasman Palace | 1990 | africa | Battle of Dasman Palace | 達斯曼宮戰役 |
| 125 | `v312wd-q22117640` | 阿夫迪伊夫卡战役 (2017年) | Battle of Avdiivka (2017) | 2017 | europe | Battle of Avdiivka (2017) | 阿夫迪伊夫卡戰役 (2017年) |
| 126 | `v312wd-q851504` | 武耶之战 | Battle of Vouillé | 507 | europe | Battle of Vouille | （无） |
| 127 | `v312wd-q1151692` | 下邳之战 | Battle of Xiapi | 199 | east-asia | Battle of Xiapi | 下邳之戰 |
| 128 | `v312wd-q1330310` | 长坂坡之战 | Battle of Changban | 208 | east-asia | Battle of Changban | 长坂坡之战 |
| 129 | `v312wd-q588774` | 同帅战役 | Battle of Dong Xoai | 1965 | southeast-asia | Battle of Dong Xoai | 同帥戰役 |
| 130 | `v312wd-q123058059` | 苏法战役 | Battle of Sufa | 2023 | west-central-asia | Battle of Sufa | 蘇法戰役 |
| 131 | `v312wd-q379433` | 天号作战 | Operation Kikusui I | 1945 | east-asia | Operation Kikusui I | 天號作戰 |
| 133 | `v312wd-q2274135` | 鴫野之战 | Battle of Shigino | 1614 | east-asia | Battle of Shigino | 鴫野之戰 |
| 134 | `v312wd-q4273438` | 昆嵩战役 | Battle of Kontum | 1972 | southeast-asia | Battle of Kontum | 崑嵩戰役 |
| 135 | `v312wd-q3272217` | 昆阳之战 | Battle of Kunyang | 23 | east-asia | Battle of Kunyang | 昆陽之戰 |
| 136 | `v312wd-q2890355` | 维罗纳战役 (1805年) | Battle of Verona (1805) | 1805 | europe | Battle of Verona (1805) | 維羅納之戰 |
| 137 | `v312wd-q4872697` | 弗尔巴尼亚桥之战 | Battle of Vrbanja Bridge | 1995 | europe | Battle of Vrbanja Bridge | 弗尔巴尼亚桥之战 |
| 138 | `v312wd-q123290408` | 加沙围城战 | Siege of Gaza City | 2023 | west-central-asia | Siege of Gaza City | 加沙圍城戰 |
| 139 | `v312wd-q1617667` | 马塔基托战役 | Battle of Mataquito | 1557 | americas | Battle of Mataquito | 马塔基托战役 |
| 140 | `v312wd-q860789` | 折上原之战 | Battle of Suriagehara | 1589 | east-asia | Battle of Suriagehara | 摺上原之戰 |
| 141 | `v312wd-q4870995` | 菲拉卡岛战役 | Battle of Failaka | 1990 | africa | Battle of Failaka | 菲拉卡島戰役 |
| 142 | `v312wd-q2005185` | 马陵之战 | Battle of Maling | -342 | east-asia | Battle of Maling | 馬陵之戰 |
| 143 | `v312wd-q3270429` | 巨鹿之战 | Battle of Julu | -207 | east-asia | Battle of Julu | 巨鹿之战 |
| 144 | `v312wd-q11211553` | 攻打蒙卡达兵营行动 | Attack on the Moncada Barracks | 1953 | americas | Attack on the Moncada Barracks | 攻打蒙卡達兵營行動 |
| 145 | `v312wd-q747679` | 阿提密西安海战 | Battle of Artemisium | -480 | europe | Battle of Artemisium | （无） |
| 146 | `v312wd-q722331` | 马邑之谋 | Battle of Mayi | -133 | east-asia | Battle of Mayi | 马邑之谋 |
| 147 | `v312wd-q3780302` | 阳城之战 | Battle of Yangcheng | 191 | east-asia | Battle of Yangcheng | 阳城之战 |
| 148 | `v312wd-q1047091` | 沥涔吹蔑之战 | Battle of Rạch Gầm-Xoài Mút | 1785 | southeast-asia | Battle of Rạch Gầm-Xoài Mút | 瀝涔吹蔑之戰 |
| 149 | `v312wd-q491188` | 大青岛海战 | Battle of Daecheong | 2009 | east-asia | Battle of Daecheong | 大青島海戰 |
| 150 | `v312wd-q3270739` | 博川战斗 | Battle of Pakchon | 1950 | east-asia | Battle of Pakchon | 博川戰鬥 |
| 151 | `v312wd-q383614` | 科希马战役 | Battle of Kohima | 1944 | global | Battle of Kohima | （无） |
| 152 | `v312wd-q3827914` | 荥阳之战 (190年) | Battle of Xingyang (190) | 190 | east-asia | Battle of Xingyang (190) | 荥阳之战 (190年) |
| 153 | `v312wd-q5778565` | 阿莱格里亚德皮奥战役 | Battle of Alegría de Pío | 1956 | americas | Battle of Alegría de Pío | 阿莱格里亚德皮奥战役 |
| 154 | `v312wd-q1113659` | 富尔福德战役 | Battle of Fulford | 1066 | europe | Battle of Fulford | （无） |
| 155 | `v312wd-q1073429` | 白藤江之战 (981年) | Battle of Bạch Đằng | 981 | east-asia | Battle of Bạch Đằng | 白藤江之战 (981年) |
| 156 | `v312wd-q2339983` | 马乌莱河战役 | Battle of the Maule | 1471 | americas | Battle of the Maule | 马乌莱河战役 |
| 157 | `v312wd-q15913566` | 乌牛栏之役 | Battle of O-gu-lan | 1947 | east-asia | （无） | 烏牛欄之役 |
| 158 | `v312wd-q15928518` | 青树坪战役 | Battle of Qingshuping | 1949 | east-asia | （无） | 青树坪战役 |
| 159 | `v312wd-q1987213` | 都拉斯战役 (1081年) | Battle of Dyrrhachium (1081) | 1081 | europe | Battle of Dyrrhachium (1081) | （无） |
| 160 | `v312wd-q914210` | 笠泽之战 | Battle of Lize | -478 | east-asia | Battle of Lize | 越灭吴之战 |
| 161 | `v312wd-q847402` | 彭城之战 | Battle of Pengcheng | -205 | east-asia | Battle of Pengcheng | 彭城之戰 |

坐标、区域、类别、精度、locationType 与 regionBasis 全部**原样继承**结构化记录，升级不会移动点位或改区域；完整继承审计见 `docs/verification-3.16/content-upgrade-authoring.json` 的 `inherited` 字段。

## 8. 仍缺什么（下一轮建议）

1. **剩 133 条索引级事件**。本轮按排名顺序做满 60 条，正好停在第 161 名（101–161 共 61 名，减去 1 条数据源缺陷），rank 162–170 因此整段留给下一轮。需要提醒的是排名尾部的中文条目比例在快速下降：本窗口 9 条里 5 条只有单一语种可引，rank 171 之后的 20 余条**全部**没有中文维基条目（排名公式给中文条目 +3 分，尾部自然堆积无中文条目的实体）。继续往下做会越来越依赖单语种引用，建议下一轮单独评估"哪些值得写、哪些应当等维基社区补条目"。
2. **暴行层中文名覆盖率低（37/293）**：这是维基数据的属性，不是本轮的取舍——池中 9 条连英文名都没有。若将来接 UI，需要先决定中文模式是否回落到英文名（政体目录已有 `polityName()` 的先例）。
3. **暴行层国家/冲突字段只有中文**：来源扫描（`fetch-thin-region-battles.mjs`）没有保存这些实体的 QID，因此无法在不新增 WDQS 查询的情况下补出可信英文标签。下一轮若要做，应补一次带标签服务的 WDQS 查询（注意连续约 12 次查询后会 429，需要 sleep 3–5 秒退避）。
4. **Q2274112（今福之战）仍是索引级**：维基数据 P585 与两语维基正文冲突，属于数据源缺陷；正确修法是先修维基数据，而不是在本地改年份。同理还有 3.15 留档的 Q111383245、Q112206624。
5. **5 条无中文维基条目、2 条无英文维基条目**：本轮已在 notes 中如实披露；若日后维基社区补建条目，应回头把这些条目的引用补齐。

## 9. 诚实声明

- 未跑 WDQS（沿用 3.14 排名），未跑 `prepare:assets`，未改 `public/` 下任何既有产品文件；新增的只有 `public/data/atrocities.json(+.gz)`。
- 未把任何一条无来源的内容写进交付物：无中文名就 `null`，无某语种条目就在 notes 说明，年代有争议就写进 `editorialNotes`。
- 本轮没有把暴行池并入战役层，也没有为了凑数把 QID 当标题。
