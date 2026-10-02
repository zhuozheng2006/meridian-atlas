# 3.15 第六轮内容报告：41–100 名索引事件升级与战役层薄地区补采

任务：task-17。对照基线提交 `a7784a02`（本轮开始时 HEAD；期间 Lead 已把事件部分提交为 `b3ad0bf6`，因此本报告一律以 `a7784a02` 为准，脚本 `report-content-round6-3.15.mjs` 也用 `--baseline=` 固定该提交）。所有数字来自本轮实际运行，脚本与产物都在仓库内可复现。

## 0. 结论速览

- 事件层：结构化索引条目（`provenance=wikidata-structured`）**251 → 193**（本轮升级 58 条，取热度排名 41–100 区间）；事件总数 **709 不变**；已升级的索引条目 40 → **98**。
- 58 条 id 全部保持 `v312wd-<qid>`，`provenance` 字段**整个删除**，`wikidataQid` 保留；中文 110–130 字、英文 46–60 词；每条 2 条 https 来源（en + zh 维基，`accessedAt` 2026-10-03）。
- 民用纪年（无 0 年）：本批 6 条 BCE 条目全部按民用纪年撰写，与战役层同年份一一相符（第 2 节）。
- 排除 2 条：Q111383245 阿夫迪伊夫卡战役、Q112206624 克列缅纳亚战役——维基数据 P585 记为 2020，中英维基记为该战役自 2022 年起；两条仍留索引级，战役层的对应记录已在 notes 中披露矛盾（第 5 节）。
- 战役层：**506 → 603**；大洋洲 **14 → 30**、南亚 **22 → 57**、东南亚 **28 → 49**；欧洲 **199 不变**（补采只增不减，不再被配额挤压）。
- 验证：任务列出的 9 项脚本全部 exit 0；`validate-battles` **8/8**；`validate-cross-layer` **3/3**（共享实体 291，年份不一致 0）；`audit-language` 事件层与战役层英文栏 CJK **0**；两个 `.gz` 头 mtime=0、OS=255，且与 `.json` deepEqual=true。

## 1. 事件升级（58 条）

### 1.1 选取与规格

- 候选：`docs/verification-3.14/content-upgrade-ranking.json` 的 rank 41–100 共 60 条。实测 60/60 仍是索引级，60/60 与战役层同 QID，换算民用纪年后与战役层年份 60/60 一致。
- 撰写产物：`editorial/events-upgraded-3.15.json`（58 条）。装配脚本 `scripts/places/assemble-events-upgraded-3.15.mjs` 从 `docs/verification-3.15/authoring/part-01..06.json` 汇总，并在写出前强制：
  - `summary.zh` 110–135 字、`summary.en` 45–60 词（实测 110–130 / 46–60）；
  - 年份必须等于排名 ISO 年换算出的民用纪年（iso ≤ 0 → iso−1）；
  - 坐标、地区、类别、`precision`、`locationType`、`regionBasis` 从原结构化条目**原样继承**，升级不会移动任何点；
  - 英文栏出现 CJK、中文栏出现繁体独用字、引用的英维条目标题落到消歧义页时直接拒绝写出。
- 合并工具仍是 `scripts/places/apply-events-3.10.mjs`（先 `--check` 再写入）。合并结果：新增/替换 58 条，总数 709 不变。
- 地区分布（本批）：europe 16、africa 11、west-central-asia 10、east-asia 9、americas 5、southeast-asia 3、south-asia 3、oceania 1；年代分布：ancient-iron 1、classical 14、medieval 14、early-modern 7、modern 16、contemporary 6。

### 1.2 id 对照表（id 不变，provenance 删除，年份为项目民用纪年）

| rank | id | QID | 中文标题 | 年 | 地区 | sitelinks | 中文字/英词 | 英文维基条目 |
|---|---|---|---|---|---|---|---|---|
| 41 | `v312wd-q14303815` | Q14303815 | 伊特尔堡之战 | 1945 | europe | 30 | 124/52 | [Battle of Castle Itter](https://en.wikipedia.org/wiki/Battle_of_Castle_Itter) |
| 42 | `v312wd-q696931` | Q696931 | 马尼拉战役 (1945年) | 1945 | southeast-asia | 30 | 110/50 | [Battle of Manila (1945)](https://en.wikipedia.org/wiki/Battle_of_Manila_(1945)) |
| 43 | `v312wd-q233414` | Q233414 | 第二次帕尼帕特战役 | 1556 | south-asia | 34 | 112/55 | [Second Battle of Panipat](https://en.wikipedia.org/wiki/Second_Battle_of_Panipat) |
| 44 | `v312wd-q112016` | Q112016 | 波斯门战役 | -330 | africa | 29 | 116/55 | [Battle of the Persian Gate](https://en.wikipedia.org/wiki/Battle_of_the_Persian_Gate) |
| 45 | `v312wd-q630781` | Q630781 | 拉菲亚战役 | -217 | west-central-asia | 29 | 121/51 | [Battle of Raphia](https://en.wikipedia.org/wiki/Battle_of_Raphia) |
| 46 | `v312wd-q776215` | Q776215 | 阿劳西奥战役 | -105 | europe | 29 | 112/51 | [Battle of Arausio](https://en.wikipedia.org/wiki/Battle_of_Arausio) |
| 47 | `v312wd-q929265` | Q929265 | 纳伊苏斯战役 | 268 | europe | 29 | 112/46 | [Battle of Naissus](https://en.wikipedia.org/wiki/Battle_of_Naissus) |
| 48 | `v312wd-q385604` | Q385604 | 达拉战役 | 530 | west-central-asia | 29 | 115/54 | [Battle of Dara](https://en.wikipedia.org/wiki/Battle_of_Dara) |
| 49 | `v312wd-q888904` | Q888904 | 阿杰纳达因战役 | 634 | west-central-asia | 29 | 117/54 | [Battle of Ajnadayn](https://en.wikipedia.org/wiki/Battle_of_Ajnadayn) |
| 50 | `v312wd-q289492` | Q289492 | 扎卜河战役 | 750 | africa | 29 | 113/56 | [Battle of the Zab](https://en.wikipedia.org/wiki/Battle_of_the_Zab) |
| 51 | `v312wd-q1192616` | Q1192616 | 迪德格里战役 | 1121 | west-central-asia | 29 | 116/56 | [Battle of Didgori](https://en.wikipedia.org/wiki/Battle_of_Didgori) |
| 52 | `v312wd-q1137302` | Q1137302 | 恩图曼战役 | 1898 | africa | 29 | 111/51 | [Battle of Omdurman](https://en.wikipedia.org/wiki/Battle_of_Omdurman) |
| 54 | `v312wd-q349422` | Q349422 | 桶狭间之战 | 1560 | east-asia | 28 | 118/51 | [Battle of Okehazama](https://en.wikipedia.org/wiki/Battle_of_Okehazama) |
| 55 | `v312wd-q1421082` | Q1421082 | 阿伯里图斯战役 | 251 | europe | 27 | 110/54 | [Battle of Abritus](https://en.wikipedia.org/wiki/Battle_of_Abritus) |
| 56 | `v312wd-q1127353` | Q1127353 | 阿德底斯姆战役 | 533 | europe | 27 | 110/50 | [Battle of Ad Decimum](https://en.wikipedia.org/wiki/Battle_of_Ad_Decimum) |
| 57 | `v312wd-q994316` | Q994316 | 麦塞隆战役 | 1920 | west-central-asia | 27 | 110/56 | [Battle of Maysalun](https://en.wikipedia.org/wiki/Battle_of_Maysalun) |
| 58 | `v312wd-q699093` | Q699093 | 鲁尔包围战 | 1945 | europe | 26 | 117/53 | [Ruhr pocket](https://en.wikipedia.org/wiki/Ruhr_pocket) |
| 59 | `v312wd-q30041564` | Q30041564 | 马拉维危机 | 2017 | southeast-asia | 26 | 116/56 | [Siege of Marawi](https://en.wikipedia.org/wiki/Siege_of_Marawi) |
| 60 | `v312wd-q128996` | Q128996 | 阿克洛伊农战役 | 740 | europe | 25 | 115/51 | [Battle of Akroinon](https://en.wikipedia.org/wiki/Battle_of_Akroinon) |
| 61 | `v312wd-q1300742` | Q1300742 | 弗洛登战役 | 1513 | europe | 25 | 124/54 | [Battle of Flodden](https://en.wikipedia.org/wiki/Battle_of_Flodden) |
| 62 | `v312wd-q1788393` | Q1788393 | 城山之战 | 1877 | east-asia | 25 | 110/48 | [Battle of Shiroyama](https://en.wikipedia.org/wiki/Battle_of_Shiroyama) |
| 63 | `v312wd-q709333` | Q709333 | 第一次长沙战役 | 1939 | east-asia | 25 | 110/51 | [Battle of Changsha (1939)](https://en.wikipedia.org/wiki/Battle_of_Changsha_(1939)) |
| 64 | `v312wd-q1330136` | Q1330136 | 第二次费卢杰战役 | 2004 | africa | 25 | 116/49 | [Second Battle of Fallujah](https://en.wikipedia.org/wiki/Second_Battle_of_Fallujah) |
| 65 | `v312wd-q1333898` | Q1333898 | 淝水之战 | 383 | east-asia | 24 | 117/60 | [Battle of Fei River](https://en.wikipedia.org/wiki/Battle_of_Fei_River) |
| 66 | `v312wd-q61100` | Q61100 | 奇维塔特战役 | 1053 | europe | 24 | 113/58 | [Battle of Civitate](https://en.wikipedia.org/wiki/Battle_of_Civitate) |
| 67 | `v312wd-q1425362` | Q1425362 | 卡哈马卡战役 | 1532 | americas | 24 | 111/53 | [Battle of Cajamarca](https://en.wikipedia.org/wiki/Battle_of_Cajamarca) |
| 68 | `v312wd-q383067` | Q383067 | 萨拉加希之战 | 1897 | south-asia | 24 | 127/57 | [Battle of Saragarhi](https://en.wikipedia.org/wiki/Battle_of_Saragarhi) |
| 69 | `v312wd-q602880` | Q602880 | 安基阿卢斯战役 (708年) | 708 | europe | 23 | 129/46 | [Battle of Anchialus (708)](https://en.wikipedia.org/wiki/Battle_of_Anchialus_(708)) |
| 70 | `v312wd-q2726734` | Q2726734 | 第二次霍姆斯战役 | 1281 | africa | 23 | 112/51 | [Second Battle of Homs](https://en.wikipedia.org/wiki/Second_Battle_of_Homs) |
| 71 | `v312wd-q199371` | Q199371 | 米吉多战役 (1918年) | 1918 | west-central-asia | 23 | 117/57 | [Battle of Megiddo (1918)](https://en.wikipedia.org/wiki/Battle_of_Megiddo_(1918)) |
| 72 | `v312wd-q791185` | Q791185 | 阿帕兰战役 | 1918 | west-central-asia | 23 | 119/53 | [Battle of Abaran](https://en.wikipedia.org/wiki/Battle_of_Abaran) |
| 73 | `v312wd-q1414998` | Q1414998 | 泰纳鲁河战役 | 1942 | oceania | 23 | 112/52 | [Battle of the Tenaru](https://en.wikipedia.org/wiki/Battle_of_the_Tenaru) |
| 74 | `v312wd-q101305942` | Q101305942 | 舒沙战役 (2020年) | 2020 | west-central-asia | 23 | 122/53 | [Battle of Shusha (2020)](https://en.wikipedia.org/wiki/Battle_of_Shusha_(2020)) |
| 75 | `v312wd-q1476042` | Q1476042 | 森蚺行动 | 2002 | south-asia | 22 | 125/56 | [Operation Anaconda](https://en.wikipedia.org/wiki/Operation_Anaconda) |
| 76 | `v312wd-q1137980` | Q1137980 | 拉文纳战役 (1512年) | 1512 | europe | 21 | 126/57 | [Battle of Ravenna (1512)](https://en.wikipedia.org/wiki/Battle_of_Ravenna_(1512)) |
| 77 | `v312wd-q379346` | Q379346 | 蒂珀卡努战役 | 1811 | americas | 21 | 112/51 | [Battle of Tippecanoe](https://en.wikipedia.org/wiki/Battle_of_Tippecanoe) |
| 78 | `v312wd-q1057910` | Q1057910 | 官渡之战 | 200 | east-asia | 25 | 115/57 | [Battle of Guandu](https://en.wikipedia.org/wiki/Battle_of_Guandu) |
| 79 | `v312wd-q1193959` | Q1193959 | 鸟羽伏见之战 | 1868 | east-asia | 25 | 119/54 | [Battle of Toba–Fushimi](https://en.wikipedia.org/wiki/Battle_of_Toba%E2%80%93Fushimi) |
| 80 | `v312wd-q28169617` | Q28169617 | 巴比伦陷落 | -539 | africa | 20 | 117/46 | [Fall of Babylon](https://en.wikipedia.org/wiki/Fall_of_Babylon) |
| 81 | `v312wd-q2588587` | Q2588587 | 尼西比斯之战 (217年) | 217 | west-central-asia | 20 | 114/49 | [Battle of Nisibis (217)](https://en.wikipedia.org/wiki/Battle_of_Nisibis_(217)) |
| 82 | `v312wd-q1804983` | Q1804983 | 巴格达之战 (2003年) | 2003 | africa | 20 | 115/55 | [Battle of Baghdad (2003)](https://en.wikipedia.org/wiki/Battle_of_Baghdad_(2003)) |
| 83 | `v312wd-q16394378` | Q16394378 | 围攻斯拉维扬斯克 | 2014 | europe | 20 | 130/53 | [Siege of Sloviansk](https://en.wikipedia.org/wiki/Siege_of_Sloviansk) |
| 84 | `v312wd-q524828` | Q524828 | 莫农加希拉河战役 | 1755 | americas | 19 | 114/51 | [Battle of the Monongahela](https://en.wikipedia.org/wiki/Battle_of_the_Monongahela) |
| 85 | `v312wd-q2665626` | Q2665626 | 贝尔谢巴战役 | 1917 | west-central-asia | 19 | 121/51 | [Battle of Beersheba (1917)](https://en.wikipedia.org/wiki/Battle_of_Beersheba_(1917)) |
| 86 | `v312wd-q2887977` | Q2887977 | 霍尔木兹甘战役 | 224 | africa | 18 | 115/50 | [Battle of Hormozdgan](https://en.wikipedia.org/wiki/Battle_of_Hormozdgan) |
| 87 | `v312wd-q2394344` | Q2394344 | 萨明之战 | 1115 | africa | 18 | 117/52 | [Battle of Sarmin](https://en.wikipedia.org/wiki/Battle_of_Sarmin) |
| 88 | `v312wd-q1887494` | Q1887494 | 以仁王举兵 | 1180 | east-asia | 18 | 122/60 | [Battle of Uji (1180)](https://en.wikipedia.org/wiki/Battle_of_Uji_(1180)) |
| 89 | `v312wd-q200682` | Q200682 | 昆士顿高地战役 | 1812 | americas | 18 | 116/60 | [Battle of Queenston Heights](https://en.wikipedia.org/wiki/Battle_of_Queenston_Heights) |
| 90 | `v312wd-q762458` | Q762458 | 鲁斯皮纳战役 | -46 | africa | 17 | 114/52 | [Battle of Ruspina](https://en.wikipedia.org/wiki/Battle_of_Ruspina) |
| 91 | `v312wd-q1424076` | Q1424076 | 穆尔萨战役 | 351 | europe | 17 | 120/54 | [Battle of Mursa Major](https://en.wikipedia.org/wiki/Battle_of_Mursa_Major) |
| 92 | `v312wd-q2661859` | Q2661859 | 槟城海战 | 1914 | southeast-asia | 17 | 121/56 | [Battle of Penang](https://en.wikipedia.org/wiki/Battle_of_Penang) |
| 93 | `v312wd-q1267656` | Q1267656 | 贝纳库斯湖战役 | 268 | europe | 16 | 114/53 | [Battle of Lake Benacus](https://en.wikipedia.org/wiki/Battle_of_Lake_Benacus) |
| 94 | `v312wd-q939358` | Q939358 | 第一次霍姆斯战役 | 1260 | africa | 16 | 112/51 | [First Battle of Homs](https://en.wikipedia.org/wiki/First_Battle_of_Homs) |
| 96 | `v312wd-q2237622` | Q2237622 | 弘安之役 | 1281 | east-asia | 15 | 121/57 | [Battle of Kōan](https://en.wikipedia.org/wiki/Battle_of_K%C5%8Dan) |
| 97 | `v312wd-q2346041` | Q2346041 | 博塞茹尔堡战役 | 1755 | americas | 15 | 115/48 | [Battle of Fort Beauséjour](https://en.wikipedia.org/wiki/Battle_of_Fort_Beaus%C3%A9jour) |
| 98 | `v312wd-q1349891` | Q1349891 | 垓下之战 | -202 | east-asia | 19 | 114/60 | [Battle of Gaixia](https://en.wikipedia.org/wiki/Battle_of_Gaixia) |
| 99 | `v312wd-q63146684` | Q63146684 | 贝德里亚库姆战役 | 69 | europe | 14 | 113/52 | [Battle of Bedriacum](https://en.wikipedia.org/wiki/Battle_of_Bedriacum) |
| 100 | `v312wd-q2237567` | Q2237567 | 科皮德纳顿战役 | 788 | europe | 14 | 113/46 | [Battle of Kopidnadon](https://en.wikipedia.org/wiki/Battle_of_Kopidnadon) |

### 1.3 来源与英维条目标题修正

- 研究证据：`docs/verification-3.15/content-upgrade-extracts.json` —— 60 条候选的中英维基导言（zh 60/60、en 60/60），经 MediaWiki Action API 读取，中文页用 `variant=zh-cn` 取简体。
- 维基数据的英文标签并不总等于英维条目标题：本轮有 15 个实体解析到歧义页或错误页（马尼拉 1945、第二次帕尼帕特、长沙 1939、米吉多 1918、舒沙 2020、拉文纳 1512、巴格达 2003、贝尔谢巴 1917、安基阿卢斯 708、尼西比斯 217、宇治 1180、波斯门、鲁尔 pocket、托巴–伏见、贝德里亚库姆）。`fetch-upgrade-extracts.mjs` 内置修正表并在重跑时复现，装配脚本对歧义页直接报错。
- 每条 2 条来源：英维条目 + 中维条目，标题里注明 CC BY-SA 4.0 与读取日期 `2026-10-03`（本地日期；UTC 为 2026-10-02T23:17Z）。
- 逐条对照可在 `docs/verification-3.15/content-round6.json` 的 `events.entries` 中查（含每条的 rank、年份、地区、sitelinks、中文字数、英文词数、两条 URL、继承坐标、provenance 是否已删除）。

## 2. 民用纪年（无 0 年）

维基数据 P585 是 ISO 8601 天文纪年（有 0 年），本项目民用纪年无 0 年，故 iso ≤ 0 一律写成 iso−1。本批 6 条 BCE 条目均按民用纪年撰写，并与战役层同实体年份一致：

| id | 中文标题 | 维基数据 ISO 年 | 本项目民用纪年 | 战役层年份 |
|---|---|---|---|---|
| `v312wd-q28169617` | 巴比伦陷落 | -538 | -539 | -539 |
| `v312wd-q112016` | 波斯门战役 | -329 | -330 | -330 |
| `v312wd-q630781` | 拉菲亚战役 | -216 | -217 | -217 |
| `v312wd-q1349891` | 垓下之战 | -201 | -202 | -202 |
| `v312wd-q776215` | 阿劳西奥战役 | -104 | -105 | -105 |
| `v312wd-q762458` | 鲁斯皮纳战役 | -45 | -46 | -46 |

其中垓下之战另有断代分歧（英维作公元前 203 年 12 月，中维与本项目作公元前 202 年），已写入该条的 `editorialNotes`。

## 3. 防回退

1. `scripts/places/build-structured-events.mjs` 读取 `editorial/events-upgraded-*.json` 的全部 QID 并跳过，同时跳过线上 `v312wd-*` 且无 `provenance` 的条目（双保险）。
2. 干跑证据：`node scripts/places/build-structured-events.mjs --count=275 /tmp/regen-3.15.json` → 生成 253 条，**98 个已升级 QID 泄漏 0 个**。
3. 索引批次 `editorial/events-wikidata-3.12.json`（251 条，不含升级 QID）保持可用：即使有人再执行 `apply-events-3.10.mjs`，也不会把升级条目打回索引级。

## 4. 战役层补采（大洋洲/南亚/东南亚）

### 4.1 方法变更：WDQS 504 → 子类枚举 + 自拆分分块

第一次 3.15 补采沿用原脚本的单条坐标框查询（`?class wdt:P279* ?root` 与坐标 join 同时求值），大洋洲与南亚两个框在 3 次重试（每次 110 s 超时 + 12/24 s 退避）后仍以 504 失败，只有部分框可跑。改为两步策略后本轮跑完：

1. 先按 5 个类目根（battle Q178561、naval battle Q1261499、siege Q188055、military operation Q645883、massacre Q3199915）**单独枚举子类树**（无地理 join 的轻查询），得到 309 个具体类；实测 5 次查询全部成功（`classEnumeration.ok=true`）。
2. 再按坐标框对具体类用 `VALUES` 分块查询，每块 60 个类；**块失败就二分重试**（最小 24 类），日志逐块记录。结果：三个框 `failedChunks=0`，`usedFallback=false`，无需回退到原查询。
3. 标签与中维回退仍走 Action API；参战方/所属冲突/国家原本用 WDQS 的 in-query label service，本轮该服务返回空，故新增 `scripts/places/enrich-thin-region-details.mjs`：用不含 label service 的普通 OPTIONAL 查询取实体链接，再用 Action API 取中英标签（繁体经 zh.wikipedia `variant=zh-cn` 转简体），英文标签并入 `editorial/entity-labels-en.json`。

### 4.2 池规模与地区前后对比

补采池（有 P625 坐标 + 有 P585 年代）共 **841** 条：大洋洲 225、南亚 369、东南亚 247；其中有中文名（维基数据 zh 标签或 zh.wikipedia 条目标题）**214** 条：大洋洲 37、南亚 63、东南亚 114。

| 地区 | a7784a02 | 现在 | 增减 |
|---|---|---|---|
| west-central-asia | 60 | 60 | +0 |
| africa | 75 | 75 | +0 |
| east-asia | 71 | 96 | +25 |
| europe | 199 | 199 | +0 |
| south-asia | 22 | 57 | +35 |
| americas | 33 | 33 | +0 |
| southeast-asia | 28 | 49 | +21 |
| global | 4 | 4 | +0 |
| oceania | 14 | 30 | +16 |

- 新增 97 条薄地区记录（去重后）：南亚 +35、东亚洲 +25、东南亚 +21、大洋洲 +16。东亚洲的 +25 来自坐标落在补采框内、但按既有 `regionBasis=coordinate-box` 规则被划入 east-asia 的条目（如白藤江之战、屯门海战、穿鼻之战、顺化战役等），这也解释了为什么补采同时抬高了 east-asia。
- 构成（按维基数据具体类）：battle 27、naval battle 22、military operation 16、siege 9、offensive 5、airstrike 4、military raid 3、invasion 2、bombardment 2、ambush 2、military campaign 1、aerial bombing of a city 1、punitive expedition 1、drone strike 1、torpedo attack 1。
- **只增不减**：补采条目不再参与每世纪配额竞争（配额是全球采集的公平规则；干跑中让补采参与配额会挤掉 24 条欧洲记录）。因此欧洲 199、非洲 75、西亚 60、美洲 33 全部保持基线值，补采净增 97 条。

### 4.3 被排除的池：屠杀与警方突袭（诚实边界）

三条硬标准（P625 坐标、P585 年代、中文名）一条都没有放宽，但**不是所有合格条目都适合进入「战役」层**。本轮把以下 302 条排除在战役层之外，并逐条记录理由（`public/data/battles.json` 的 `counts.supplementExcluded`，原始池仍在 `editorial/battles-thin-regions-3.15.json`）：

- 298 条维基数据类目为**屠杀**（Q3199915）的记录：这是单方面杀戮，不是交战，放进战役层会把该层变成暴行索引；其中 34 条有中文名（美莱村屠杀、马尼拉大屠杀、圣克鲁斯大屠杀、尼泊尔王室枪击事件、反锡克教暴动、加尔各答黑洞等）。
- 2 条类目为**警方突袭**（Q97368680）的记录，其中苹果日报大楼被搜查事件（2020）不是武装冲突。
- 2 条由维基数据归入其他类目、但条目本身描述单方面杀戮平民的记录：阿姆利则血案（1919，类目为军事作战）、格拉奈大屠杀（2009，类目为空袭）。

被排除的 302 条仍以原始池形式保存在 `editorial/battles-thin-regions-3.15.json`，报告与 JSON 里给出数量、类目与中文名样例，可供将来做独立的「暴行/屠杀」图层；本轮不写入，也不为凑数放宽标准。

### 4.4 名称与参战方

- 中文名 603/603 来自维基数据 zh 标签（`nameSource=wikidata-zh-label`），无一条回退到 zh.wikipedia 条目标题，也无一条使用音译或机器翻译。
- 参战方/所属冲突/国家：中英两栏各 **594/603** 有值；新增 97 条中 94 条有值，3 条（白藤江之战 (938年)、西草湾之战、戳刺行动）维基数据未记录 P710/P361/P17，按层策略保留空数组、不编造。
- 全层 9/603 条带维基数据声明级参考链接，其余以实体链接为来源（层策略已写明）。
- 层内仍有 9 组中文重名（不同实体/年份），例如马尼拉战役（1898/1899/1945）、白藤江之战（938/1288）、马尼拉之战（1570/1574）；本轮只记录，不做合并。

## 5. 数据源缺陷：两层一致但都错

**事实（用 Action API 实测）**：Q111383245 阿夫迪伊夫卡战役与 Q112206624 克列缅纳亚战役在维基数据的 P585 都是 `+2020-00-00`（精度=年）；而中维条目分别写作 2022 年—2024 年、2022 年 4 月，英维条目（Battle of Avdiivka / Battle of Donbas (2022)）同样记为 2022 年起。战役层由同一份采集生成，因此这两条战役记录的年份也是 2020。

**处理**（按 Lead 裁决，选 (a)+(b)）：

- (a) 事件层：这两条**不升级**，仍留索引级；不把已知错误的年份写进编辑级条目。
- (b) 战役层：两条记录保留来源原值 2020，但在 `notes`/`notesEn` 里写明「维基数据 P585 记为 2020 年，而中英文维基百科记该战役自 2022 年起；本条保留来源原值，矛盾已在 3.15 报告中记录」，并写入层策略 `policy.dates`。地图/搜索里点开这两场战役即可看到矛盾，而不是一个没有提示的错误年份。

**校验边界**：`scripts/validate-cross-layer.mjs` 只比较两层共享实体的年份是否一致，**发现不了「两层一致但都错」**——上面两条正是这种情况：事件 2020（现已留索引级）、战役 2020，校验会通过。本轮是靠逐条阅读中英维基导言人工比出来的。这条已写入 `content-round6.json` 的 `crossLayer.limitation`，建议后续为「来源互相矛盾」增加独立的来源一致性检查，而不仅是跨层一致性检查。

## 6. 验证记录

| 命令 | 结果 |
|---|---|
| `node scripts/validate.mjs` | exit 0 |
| `node scripts/validate-v2.mjs` | exit 0 |
| `node scripts/validate-places.mjs` | exit 0 |
| `node scripts/validate-city-time.mjs` | exit 0 |
| `node scripts/validate-polity-period.mjs` | exit 0 |
| `node scripts/validate-release.mjs` | exit 0 |
| `node scripts/validate-cross-layer.mjs` | exit 0，3/3（共享实体 291，年份不一致 0） |
| `node scripts/places/validate-battles.mjs . docs/verification-3.15/content-battles-validation.json` | exit 0，8/8（603 条战役，中文名 603/603） |
| `node scripts/places/audit-language.mjs . docs/verification-3.15/content-language-audit.json` | exit 0（事件英文栏 CJK 0，战役英文栏 CJK 0，结构化计数 193） |

- gzip 镜像：`public/data/events.json.gz` 与 `public/data/battles.json.gz` 头 4 字节 mtime=0、OS=255，gunzip 后与对应 `.json` deepEqual=true。
- 本轮未运行 `npm test`、未运行 `npm run prepare:assets`（按任务分工由 Lead 统一盖章；`stamp-assets` 只涉及 `public/*.js|css`，本轮未改这些文件）。
- 上述 9 条命令与结果由 `scripts/places/report-content-round6-3.15.mjs` 现场执行并写入 `content-round6.json` 的 `validation`（可直接重跑复核）。

## 7. 变更文件

新增：
- `editorial/events-upgraded-3.15.json`（58 条编辑级事件批次）
- `editorial/battles-thin-regions-3.15.json`（841 条原始补采池，含类目枚举与请求日志）
- `scripts/places/assemble-events-upgraded-3.15.mjs`、`scripts/places/report-content-round6-3.15.mjs`、`scripts/places/enrich-thin-region-details.mjs`
- `docs/verification-3.15/`：`content-round6.md`、`content-round6.json`、`content-upgrade-extracts.json`、`content-upgrade-authoring.json`、`content-battles-validation.json`、`content-language-audit.json`、`authoring/part-01..06.json`

修改：
- `public/data/events.json`(+.gz)：58 条升级合并（251 → 193 索引级）
- `public/data/battles.json`(+.gz)：补采 97 条 + 排除池记录 + 两条日期矛盾披露（506 → 603）
- `editorial/entity-labels-en.json`：为新增战役实体解析英文标签（604 实体，595 有至少一条英文标签）
- `scripts/places/fetch-upgrade-extracts.mjs`（`--from/--to` 区间、英维条目标题修正表、消歧义标记、429 退避重试）
- `scripts/places/fetch-thin-region-battles.mjs`（子类枚举 + 分块自拆分）
- `scripts/places/build-battles.mjs`（多份 `battles-thin-regions-*.json` 合并、补采只增不减、排除规则、日期矛盾披露）

## 8. 回滚

- 只回滚数据层：`git checkout a7784a02 -- public/data/events.json public/data/events.json.gz public/data/battles.json public/data/battles.json.gz`，再删除 `editorial/events-upgraded-3.15.json`（或保留但不要执行 apply）。
- 重新生成事件层：`node scripts/places/build-structured-events.mjs` + `apply-events-3.10.mjs`（索引批次已排除升级 QID，不会打回）。
- 重新生成战役层：`node scripts/places/build-battles.mjs`；若 `editorial/battles-thin-regions-3.15.json` 被删除，则回到纯基础采集的 506 条版本。

## 9. 仍缺什么

1. **事件层还有 193 条索引级**。热度排名只覆盖 291 条；rank 101–291 以及未入排名的实体仍未撰写编辑级叙述。
2. **阿夫迪伊夫卡与克列缅纳亚仍是指标性缺陷**：事件层留索引级，战役层仍显示来源原值 2020（已在 notes 披露）。彻底修好需要有人核对来源后修正维基数据 P585 或在本项目加一条有来源的更正记录。
3. **34 条有中文名的单方面杀戮事件未进任何图层**（另有 268 条无中文名）：池已留档，适合做成独立的「暴行/屠杀」图层，而不是塞进战役层。
4. **战役层的地区不均衡仍未消除**：欧洲 199 仍是最大地区，大洋洲 30 仍是最小；补采框内大洋洲有坐标+年代的实体 225 条，但只有 37 条有中文名——瓶颈是中文名，而不是选取策略。
5. **类目覆盖只到 5 个根**：war、rebellion、invasion 等若作为根单独扫，可能还有合格实体；本轮未做。
6. **层内数据完整性**：3 条新增记录无参战方，仅 9/603 条带声明级参考链接；9 组中文重名未消歧。
7. **跨层校验的边界**已知（见第 5 节），建议新增「来源互相矛盾」检查。

---

产物对照：机器可读版本 `docs/verification-3.15/content-round6.json`（新增清单、id 对照、逐条字数、战役地区前后、池规模、排除原因、验证结果）；本文件为叙述版本。
