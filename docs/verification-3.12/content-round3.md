# 经纬纪 3.12 数据充实第三轮报告（task-8）

目标：让项目达到可用于学习与研究历史的翔实程度。本轮按「研究可用性」选活：政体分栏叙述、最薄年代格事件、有绑定的城市篇章。全部数字来自脚本产物，复现命令见第十节。

## 一、改了什么

| 项目 | 变化 | 产物 |
|---|---|---|
| 政体分栏叙述 | 26 → **54** 篇（新增 **28** 个非欧洲优先政体，四栏齐全） | public/data/enrichment/narratives.json、editorial/enrichment-narratives-3.12.json |
| 分栏绑定记录 | 新增绑定 **427** 条疆域记录（按 qid + 精确记录名 + 时段重叠解析） | 同上 |
| 历史事件 | 392 → **401**（+9，全部双语） | public/data/events.json(+.gz)、editorial/events-3.12.json |
| 城市篇章 | 15 → **17**（新增阿瑜陀耶、蒲甘/Bagan） | public/data/places/city-narratives.json.gz、editorial/city-narratives-3.12.json |
| 篇章来源登记 | 48 → **53**；绑定来源记录 46 → **48** | 同上 |
| 薄格（少于 3 条） | 25 → **20**；空年代格仍为 1（大洋洲古典） | docs/verification-3.12/content-balance.json |
| 来源核验 | 63/63 有据（33 条本轮抓正文命中关键词） | docs/verification-3.12/content-sources.json |

## 二、政体分栏：28 个新增政体与四栏结构

四栏与阅读器栏目的对应关系（读 public/polity-reader.js 确认，未改该文件）：

- 政治与传承 → sections.politics（「政治」栏，也是概览栏的叙述主体）
- 文化与社会 → sections.culture（「文化与经济」栏第一段）
- 经济与交流 → sections.economy（「文化与经济」栏第二段）
- 相关事件 → sections.events（「年表」栏顶部叙述，下面自动接相关事件列表）
- 另有 facts（历史侧记）提供 2 至 3 条带年代侧记，渲染在概览栏。

新增政体（QID ｜ 地区 ｜ 时段）：

| 政体 | QID | 地区 | 时段 |
|---|---|---|---|
| 莫卧儿帝国 | Q33296 | 南亚 | 1526—1857 |
| 德里苏丹国 | Q229411 | 南亚 | 1206—1526 |
| 朱罗王朝 | Q6806806 | 南亚 | 850—1279 |
| 马拉塔帝国 | Q83618 | 南亚 | 1674—1818 |
| 维查耶纳伽尔帝国 | Q167639 | 南亚 | 1336—1646 |
| 萨法维王朝 | Q161205 | 西亚 | 1501—1736 |
| 帖木儿帝国 | Q484195 | 中亚/西亚 | 1370—1507 |
| 马穆鲁克苏丹国 | Q282428 | 非洲/西亚 | 1250—1517 |
| 法蒂玛哈里发国 | Q160307 | 非洲/西亚 | 909—1171 |
| 阿尤布苏丹国 | Q180114 | 西亚/北非 | 1171—1260 |
| 朝鲜王朝 | Q28179 | 东亚 | 1392—1897 |
| 德川幕府 | Q205662 | 东亚 | 1603—1868 |
| 大日本帝国 | Q188712 | 东亚 | 1868—1947 |
| 阿瑜陀耶王国 | Q841364 | 东南亚 | 1351—1767 |
| 蒲甘王国 | Q888574 | 东南亚 | 849—1297 |
| 室利佛逝 | Q234197 | 东南亚 | 650—1300 |
| 马六甲苏丹国 | Q46652 | 东南亚 | 1400—1528 |
| 马打蓝苏丹国 | Q402145 | 东南亚 | 1587—1755 |
| 亚齐苏丹国 | Q1061057 | 东南亚 | 1496—1903 |
| 埃塞俄比亚帝国 | Q207521 | 非洲 | 1270—1935 |
| 卡涅姆—博尔努帝国 | Q1139762 | 非洲 | 700—1894 |
| 刚果王国 | Q796583 | 非洲 | 1390—1857 |
| 阿散蒂帝国 | Q722071 | 非洲 | 1701—1902 |
| 奥约帝国 | Q849623 | 非洲 | 1600—1836 |
| 索科托哈里发国 | Q600524 | 非洲 | 1804—1903 |
| 祖鲁王国 | Q13558877 | 非洲 | 1816—1897 |
| 奇穆帝国 | Q581741 | 美洲 | 900—1481 |
| 萨波特克文明 | Q844750 | 美洲 | 前700—1521 |

绑定契约（scripts/places/apply-enrichment-3.12.mjs 在写入前逐条校验）：

1. 每个 qid 必须在出货 profile-index 中存在档案；
2. recordIdsOverlappingScope 从 fast/catalog.json.gz 解析：type 为 POLITY、verifiedWikidata 精确等于 qid、记录名精确等于 sourceNames 之一、且记录时段与 scope 有重叠；
3. 每条 id 必须在 profile-index 的 records 映射中指向同一 qid；
4. 四栏均为双语、facts 至少两条、来源含 url/checkedOn/publisher；中文不得出现常用繁体字形。

运行时读取契约与 public/polity-reader.js 的 narrativeApplies 一致（sourceNames 精确匹配、qid 相等、年份在 scope 内、记录 id 在重叠集合内）；脚本幂等，重复运行不改变文件。


## 三、本轮新增事件（9 条）

| 年代 | 地区 | 事件 | 来源（读取方式） |
|---|---|---|---|
| 前3100—前1100 | 欧洲 | 米诺斯文明与克里特宫殿社会 | Wikipedia — Minoan civilization（本会话直读） |
| 前1200—前450 | 欧洲 | 哈尔施塔特文化：中欧的盐、铁与墓葬 | Wikipedia — Hallstatt culture（本会话直读） |
| 前1900—前1500 | 东亚 | 二里头文化与中国早期国家 | Wikipedia — Erlitou culture（本会话直读） |
| 前2700—前539 | 西亚中亚 | 埃兰：伊朗西南的古代国家 | Wikipedia — Elam（本会话直读） |
| 前1900—前1300 | 南亚 | Cemetery H 文化与印度河晚期的区域转型 | Wikipedia — Cemetery H culture（本会话直读） |
| 前800—前100 | 美洲 | 帕拉卡斯文化与安第斯纺织传统 | Wikipedia — Paracas culture（本会话直读） |
| 700—1500 | 全球 | 印度洋贸易网络的长期运行 | Wikipedia — Indian Ocean trade（本会话直读） |
| 前2000—前300 | 非洲 | 达尔蒂希特与西非早期农牧聚落 | Wikipedia — Dhar Tichitt（本会话直读） |
| 前800—前500 | 非洲 | 达马特：埃塞俄比亚高原的早期王国 | Wikipedia — D'mt（本会话直读） |

每条 editorialNotes 都写明年代争议或证据边界，例如：二里头存在约前1900—前1500与约前1750—前1500两种断代；达马特年代仅为假设且不写成阿克苏姆的直接前身；Cemetery H 的族群迁徙对应属于解释性观点。

## 四、新增城市篇章（2 篇）

| 篇章 | 时段 | 绑定记录 | 处理要点 |
|---|---|---|---|
| city-ayutthaya | 1351—1767 | chandler:103（观测 1450—1855） | 只绑定 1450—1767 的 12 次观测；1855 年观测完整保留在 sourceRecords 但不属于都城时期 |
| city-bagan | 849—1297 | chandler:110（观测 1100—1250） | 四个观测年全部绑定；note 说明 1250 年后不视为立即废弃，寺院与聚落继续使用 |

两篇各含地理、历史、人口证据三段与三条里程碑，来源为 Wikipedia（实读）+ UNESCO 世界遗产条目（交接文件读取记录）+ Figshare 人口数据集（来源记录 URL）。

## 五、地区×年代覆盖变化（相对 3.11 轮）

    非洲 × 上古早期: 2 → 3
    非洲 × 上古铁器: 3 → 4
    美洲 × 上古铁器: 1 → 2
    东亚 × 上古早期: 2 → 3
    欧洲 × 史前: 3 → 4
    欧洲 × 上古铁器: 1 → 2
    全球 × 中世纪: 2 → 3
    南亚 × 上古早期: 2 → 3
    西亚中亚 × 上古早期: 2 → 3

薄格 25 → 20；空年代格仍为 1：**大洋洲古典（前500—公元499）**。仍是 0—1 条的格子：大洋洲古典 0；欧洲上古早期 1；全球史前、上古早期、上古铁器各 1；大洋洲上古早期、上古铁器各 1；南亚史前、上古铁器各 1；东南亚史前、上古早期、上古铁器各 1；西亚中亚近代 1。

## 六、来源与许可

- 政体叙述：28 篇全部以英文 Wikipedia 条目为本会话唯一或主要来源（CC BY-SA 4.0，2026-10-03 经 MediaWiki extract API 读取），四栏与 facts 均为原创双语综述；来源条目在 sources 中登记 title/url/publisher/checkedOn/access/supports。
- 事件：9 条同样使用 Wikipedia（CC BY-SA 4.0，本会话读取）。
- 城市篇章：Wikipedia（实读）+ UNESCO 世界遗产条目（仅使用交接研究文件 2026-10-03 的读取记录，因 whc.unesco.org 仍被 Cloudflare 403 拦截，登记为 read-recorded-in-handoff-research，未冒充本轮抓取）+ Figshare 数据集 DOI。
- 来源核验脚本 scripts/places/check-event-sources.mjs 独立抓取 63 个 URL 并做关键词命中校验，63/63 通过（33 条 live-content-verified；25 条站点反爬但 URL 已在仓库或交接文件中有读取记录）。
- 发布前需把上述来源并入 ATTRIBUTIONS.md（由 lead 统一维护，本轮未改）。

## 七、验证证据

    node scripts/validate.mjs                    → PASS（401 条事件 schema/双语/年代/坐标/来源）
    node scripts/validate-v2.mjs                 → PASS（含 54 篇 enrichment 叙述的绑定与来源校验）
    node scripts/validate-places.mjs             → PASS
    node scripts/validate-city-time.mjs          → PASS
    node scripts/validate-city-narratives.mjs    → PASS 10/10（17 篇 / 53 来源 / 48 绑定记录 / 55 回归用例）
    node scripts/validate-place-corrections.mjs  → PASS
    node scripts/validate-polity-period.mjs      → PASS
    node scripts/validate-release.mjs            → PASS
    幂等性：apply-enrichment-3.12.mjs 与 apply-events 重复运行后文件哈希不变

浏览器抽查（http://127.0.0.1:8767，Chrome 无头 + SwiftShader，每用例独立会话）：

- 莫卧儿 clio-07995@1530：政治栏含「帕尼帕特」、文化与经济栏含「扎吉尔」「细密画」、年表栏含「1739」；
- 萨法维 clio-07698@1504：政治栏含「伊斯梅尔」、文化与经济栏含「丝织」、年表栏含「1598」，并渲染「历史侧记」；
- 阿散蒂 clio-09434@1720：政治栏含「金凳子」、文化与经济栏含「库马西」、年表栏含「1900」。

截图：docs/verification-3.12/content-mughal-politics.png。首次加载因底图与档案并行会较慢（阿散蒂首次超时、重试后正常），属于加载性能问题，见第八节。


## 八、加载性能影响与给 lead 的读取层需求

本轮新增内容体积：

- public/data/enrichment/narratives.json：现为 **384 KB**（未压缩，随每次打开政体档案整体加载）；
- public/data/places/city-narratives.json.gz：40.5 KB → 44.1 KB（+3.6 KB）；
- public/data/events.json.gz：随三轮累计增长到 **232.5 KB**。

建议（均需读取层配合，属于 lead 的 public/ 写作用域，本轮未擅自修改）：

1. narratives.json 改为 gzip（如 narratives.json.gz）并在读取层解压，或按 qid 分片为 enrichment/narratives/<qid>.json，只在打开对应政体时加载；384 KB 未压缩文本在慢网下会明显拖慢档案打开。
2. events.json.gz 已 232 KB：若继续扩容，可考虑按年代分片（如 events/era-*.json.gz），或把 summary 的英文部分按语言惰性加载。
3. 政体档案打开是串行请求（recordDetail → profile → narratives.json）：narratives 可与其他请求并行预取。

## 九、仍未解决

1. **大洋洲古典格（前500—公元499）** 仍为 0 条：可读来源中拉皮塔文化止于约前500年，波利尼西亚定居时代被概括为约前1800—公元700年（已由 v311-polynesian-voyaging 覆盖上古铁器格），暂无可核验来源单独支撑该窗口；未用推测性条目填充。
2. **1 条的薄格**（欧洲上古早期，全球史前/上古早期/上古铁器，大洋洲上古早期/上古铁器，南亚史前/上古铁器，东南亚史前/上古早期/上古铁器，西亚中亚近代）各需 2 条以上有据事件才能达标；本轮已用完可直读来源的优先项，下一轮建议先补机构来源再写。
3. **政体叙述仍有大量空缺**：出货 profile 索引中有 1,450 份档案，本轮覆盖 54 篇。优先候选：西藏 Q521263（记录名与时段需先做身份判定）、伊儿汗国 Q178084、金帐汗国 Q79965、察合台汗国 Q487829、喀山与克里米亚等汗国、布哈拉 Q577668、希瓦 Q491106、浩罕 Q696241、萨曼 Q12150341、布韦希 Q273874、伽色尼 Q249578、塞尔柱 Q3708094、花剌子模、兰纳 Q1059707、澜沧 Q853477、素可泰 Q863279、勃固 Q1572529、掸邦 Q4765854、文莱 Q887803、尼泊尔 Q837、缅甸 Q836、锡克帝国 Q83572、阿富汗诸政权。
4. **关系层**（印度洋贸易节点与连接、冲突参与方、贸易商品）与 **政体与地点联动** 仍未接入，沿用前两轮交接审查结论。
5. 事件与政体叙述之间目前通过 eventKeywords 与名称匹配关联，尚未建立显式外键关系。

## 十、复现命令

    node scripts/places/apply-enrichment-3.12.mjs                  # 合并 28 篇政体叙述并解析绑定（幂等）
    node scripts/places/apply-enrichment-3.12.mjs --check          # 只校验，不写文件
    node scripts/places/apply-city-narratives-3.11.mjs --batch=editorial/city-narratives-3.12.json
    node scripts/places/apply-events-3.10.mjs --batch=editorial/events-3.10.json --batch=editorial/events-3.11.json --batch=editorial/events-3.12.json
    node scripts/places/check-event-sources.mjs . docs/verification-3.12/content-sources.json
    node scripts/places/content-balance.mjs . docs/verification-3.12/content-balance.json

