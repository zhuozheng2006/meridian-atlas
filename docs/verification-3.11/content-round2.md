# 经纬纪 3.11 内容深化第二轮报告（task-4）

工作目录 /Users/zane/meridian_atlas/world-history-atlas；项目版本 3.10.0（本轮产物面向 3.11 内容轮）。服务 http://127.0.0.1:8767。本报告数字全部来自脚本产物，复现命令见第九节。

## 一、改了什么

| 项目 | 变化 | 产物 |
|---|---|---|
| 城市篇章 | 12 → **15** 篇（新增阿努拉德普勒、特奥蒂瓦坎、亨比） | editorial/city-narratives.json、public/data/places/city-narratives.json.gz |
| 篇章来源登记 | 39 → **48** 条 | 同上 |
| 绑定来源记录 | 40 → **46** 条 | 同上 |
| 根校验器计数 | entries/sources/绑定记录三处硬编码改为**从数据现算**（55 条回归用例一行未动） | scripts/validate-city-narratives.mjs |
| 历史事件 | 378 → **392**（本轮 +14，全部双语） | public/data/events.json(+.gz) |
| 空年代格 | **10 → 1**（仅剩大洋洲古典时代 前500—公元499） | docs/verification-3.11/content-balance.json |
| 薄格（少于 3 条） | 27 → 25；欧洲史前 0→3、西亚中亚史前 2→3 已补齐 | 同上 |
| 基尔瓦 | **明确排除**，理由见第四节 | 本报告、docs/verification-3.11/content-round2.json |
| 来源核验 | 54/54 有据（25 条本轮抓正文命中关键词） | docs/verification-3.11/content-sources.json |

## 二、三篇新增城市篇章与身份判定

| 篇章 | 时段 | 绑定记录 | 判定要点 |
|---|---|---|---|
| city-anuradhapura 阿努拉德普勒 | 前300—993 | pleiades:49863（分期）、chandler:73（观测 -100、622）、modelski-ancient:12（观测 -100 至 900） | 交接候选称“已有 Pleiades 条目”，核实为 pleiades:49863；只取 roman 分期（-30 至 300），同一记录中 2000—2099 的现代地名证据不用于古代展读 |
| city-teotihuacan 特奥蒂瓦坎 | 1—700 | chandler:1404（观测 -100、361、500、622）、modelski-ancient:128（观测 -900 至 -600 与 400 至 700） | **负年份观测完整保留**：sourceRecords 保留两套记录的全部原始观测年（含 -900…-600 与 -100），绑定窗口只用公元 1—700 内的年份，并在绑定规则 noteZh/noteEn 写明该处理 |
| city-hampi 亨比 | 1336—1565 | chandler:1510（观测 1300 至 1565） | 记录名为 Vijayanagar，坐标距遗址点约 2.5 公里。**不按距离绑定**：Karnataka Tourism 官方页明确 Hampi 位于 Vijayanagara、曾是维查耶纳伽尔帝国都城，据此按名称与来源身份绑定；1300 年观测完整保留，但早于 1336 年传统建国年，不进入绑定窗口 |

数据生成方式：篇章节的 sourceRecords 由 scripts/places/apply-city-narratives-3.11.mjs 从出货数据集逐字段生成（name、coordinates、periods、observationYears、sourceUrl），因此与来源记录必然一致；脚本同时做内部一致性校验（作用域、绑定规则一一覆盖、观测年在规则范围内、分期属于来源、来源 ID 存在、至少两个不同出版方），并以 mtime=0 的确定性 gzip 写出。脚本幂等：重复运行 sha256 不变。

新增来源登记：UNESCO 世界遗产条目（阿努拉德普勒 200、特奥蒂瓦坎 414、亨比 241；读取记录见交接研究文件 2026-10-03）、Central Cultural Fund（斯里兰卡，实读）、INAH（墨西哥，实读）、Karnataka Tourism（实读）、Pleiades 记录 sourceUrl、Reba/Reitsma/Seto 两套人口序列的 Figshare DOI。UNESCO 页面本会话仍 403，登记中标注为 read-recorded-in-handoff-research，未冒充本轮抓取。

## 三、根校验器三处硬编码计数改为从数据现算（55 条回归用例未动）

scripts/validate-city-narratives.mjs 的改法：

1. 篇章数与来源数：原先直接断言 entries 等于 12、sources 等于 39，改为先取 dossierCount 与 registrationCount 两个变量，再做**下限**断言（不少于 12、不少于 39）与唯一性断言；检查名称改为动态模板（两个变量插值）。既不再硬编码，又保留“已复核篇章不得被删减”的保护。
2. 绑定记录数：原先断言 counters.sourceRecords 等于 40，改为由数据求和 declaredBoundRecords（各篇 sourceRecordIds 合计）与 declaredBindingRules（各篇 bindingRules 合计），断言“遍历到的绑定记录数等于篇章声明的 sourceRecordIds 数”，且“每条声明记录恰有一条绑定规则”；检查名称同样动态化。
3. ORIGINAL_CASES 的 55 与 55 条回归用例一行未改，本轮实测仍全部通过。

实测输出：15 dossiers and 48 institutional source registrations resolve；All 46 bound records preserve actual names, coordinates, periods and observations；All fifty-five reviewed Asia and world regression cases pass；10/10 检查通过。scripts/places/validate-city-narratives.mjs 仍为转发根校验器的 shim，未改回副本。

## 四、基尔瓦：明确排除（不是暂缓）

- 出货数据集中以 kilwa 为名的记录为 0（historical-settlements-index 11,328 条、historical-capitals 307 条、urban-observations 2,040 条、modern-cities 7,342 条）；以遗址代表点 39.5227778,-8.9577778 为中心 80 公里半径内也没有任何记录。
- 交接研究文件所列的 chandler:715 在当前出货数据集中**不存在**（该 id 属于另一份快照）；同样不存在的还有卡霍基亚近邻 chandler:245。
- 结论：无可核验的替代绑定，本轮**排除**城市篇章；不按 63 公里外或任何近距离记录建立身份。基尔瓦的遗址内容仍由 3.10 的 attested-places 独立层承载（attested:kilwa，UNESCO 144）。

## 五、本轮新增事件（14 条）

| 年代 | 地区 | 年代格 | 事件 | 来源（读取方式） |
|---|---|---|---|---|
| 前9700—前4500 | 全球 | 史前 | 农业的多中心起源与定居社会 | Wikipedia — Neolithic Revolution（本会话直读） |
| 前10000—前2000 | 东南亚 | 史前 | 和平文化：东南亚大陆的狩猎采集传统 | Wikipedia — Hoabinhian（本会话直读） |
| 前7500—前5500 | 非洲 | 史前 | 纳布塔普拉亚与努比亚沙漠的新石器社群 | Wikipedia — Nabta Playa（本会话直读） |
| 前3200—前2900 | 欧洲 | 史前 | 纽格莱奇与博因河谷的巨石墓葬 | Wikipedia — Newgrange / Brú na Bóinne（本会话直读） |
| 前3200—前2500 | 欧洲 | 史前 | 斯卡拉布雷：奥克尼的新石器村落 | Historic Environment Scotland（本会话直读） |
| 前4500—前3300 | 欧洲 | 史前 | 卡纳克巨石列与布列塔尼仪式景观 | Wikipedia — Carnac stones（lead 转述，本会话抓取复核） |
| 前7500—前5600 | 西亚中亚 | 史前 | 恰塔霍裕克：安纳托利亚的新石器聚落 | Wikipedia — Çatalhöyük（lead 转述，本会话抓取复核） |
| 前2000—公元200 | 东南亚 | 上古早期 | 班清：东南亚早期的农业与金属工艺 | Wikipedia — Ban Chiang（lead 转述，本会话抓取复核） |
| 前17000—前14000 | 美洲 | 史前 | 梅多克罗夫特岩棚与美洲早期居住证据 | Wikipedia — Meadowcroft Rockshelter（本会话直读） |
| 前3000—前1200 | 全球 | 上古早期 | 青铜时代的生产与跨区域网络 | Wikipedia — Bronze Age（本会话直读） |
| 前1200—前500 | 全球 | 上古铁器 | 冶铁技术的传播与铁器时代的展开 | Wikipedia — Iron Age（本会话直读） |
| 前1200—前500 | 南亚 | 上古铁器 | 彩绘灰陶文化：恒河平原的铁器时代聚落 | Wikipedia — Painted Grey Ware culture（本会话直读） |
| 前1000—公元100 | 东南亚 | 上古铁器 | 东山文化：红河三角洲的青铜社会 | Wikipedia — Dong Son culture（本会话直读） |
| 前1000—公元700 | 大洋洲 | 上古铁器 | 波利尼西亚人的远洋航海与岛屿定居 | Wikipedia — Polynesian navigation / Polynesian culture（本会话直读） |

每条均带 editorialNotes 说明年代争议或表述边界：班清早期热释光年代已被放射性碳修正；梅多克罗夫特 1.6 万年与 1.9 万年两种估计并列并标注 2013 年学界分歧；卡纳克不采用“德鲁伊所建”传说；恰塔霍裕克“出入多经屋顶”因未获第二来源复核而未写入正文；纳布塔普拉亚的家畜驯化争议明确保留。

## 六、地区×年代变化（相对 3.10 轮）

    非洲 × 史前: 1 → 2
    美洲 × 史前: 1 → 2
    欧洲 × 史前: 0 → 3   （已补齐）
    全球 × 史前: 0 → 1
    全球 × 上古早期: 0 → 1
    全球 × 上古铁器: 0 → 1
    大洋洲 × 上古铁器: 0 → 1
    南亚 × 上古铁器: 0 → 1
    东南亚 × 史前: 0 → 1
    东南亚 × 上古早期: 0 → 1
    东南亚 × 上古铁器: 0 → 1
    西亚中亚 × 史前: 2 → 3 （已补齐）

空年代格从 10 个降到 1 个：仅剩 **大洋洲古典时代（前500—公元499）**。剩余 1—2 条的薄格集中在：全球史前、东南亚史前与上古各 1、南亚史前与上古早期各 1、东亚史前/上古早期/上古铁器各 2、欧洲上古早期与铁器各 1、非洲史前 2 与上古早期 2、美洲史前 2 与上古铁器 1、西亚中亚上古早期 2 与当代 2。

## 七、来源与许可

- 新增 14 条事件的来源：Historic Environment Scotland 1 条（实读）；English Wikipedia 15 个页面（3 条经 lead 转述，其余本会话直读；全部 CC BY-SA 4.0，2026-10-03 读取）。来源标题显式标注 Wikipedia 与读取方式。
- 城市篇章新增来源：UNESCO 世界遗产条目（CC BY-SA IGO 3.0，读取记录来自交接研究文件）、Central Cultural Fund（斯里兰卡）、INAH（墨西哥）、Karnataka Tourism（卡纳塔克邦政府）、Pleiades（ISAW/NYU）、Figshare 数据集 DOI。
- scripts/places/check-event-sources.mjs 独立抓取全部 54 个 URL 并做关键词命中校验（54/54 通过，25 条 live-content-verified）；lead 转述的 3 条同样被独立抓取命中，转述与实际页面一致。
- UNESCO whc 页面 403（Cloudflare 挑战）无法直读，凡引用处均标注 read-recorded-in-handoff-research。ATTRIBUTIONS.md 由 lead 统一维护，本轮未改动。

## 八、验证证据

    node scripts/validate.mjs                  → PASS（392 条事件 schema/双语/年代/坐标/来源）
    node scripts/validate-v2.mjs               → PASS（events.json.gz 与未压缩 deepEqual）
    node scripts/validate-places.mjs           → PASS
    node scripts/validate-city-time.mjs        → PASS
    node scripts/validate-city-narratives.mjs  → PASS 10/10（15 篇 / 48 来源 / 46 绑定记录 / 55 回归用例）
    node scripts/validate-place-corrections.mjs→ PASS
    node scripts/validate-polity-period.mjs    → PASS
    node scripts/validate-release.mjs          → PASS

浏览器抽查（http://127.0.0.1:8767，Chrome 无头 + SwiftShader，每个用例独立会话，CDP 端口 9440—9443）：chandler:73@622、modelski-ancient:12@200、chandler:1404@500、chandler:1510@1500 四处均显示城市篇章，且 city-chapter-section 为 3、city-milestones button 为 3；“阿努拉德普勒/上座部佛教”“人口证据”“特奥蒂瓦坎/亡者大道”“亨比/维查耶纳伽尔”等预期文本全部命中。截图：docs/verification-3.11/content-teotihuacan-chapter.png。说明：同一浏览器会话连续多次整页导航会触发本机静态服务器的连接重置，故改为每个用例独立启动一次浏览器；这是验证方法问题，不是产品行为。

## 九、复现命令

    node scripts/places/apply-city-narratives-3.11.mjs            # 合并三篇篇章并重建 gz（幂等）
    node scripts/validate-city-narratives.mjs                     # 15 篇 / 48 来源 / 46 绑定记录 / 55 回归
    node scripts/places/apply-events-3.10.mjs --batch=editorial/events-3.10.json --batch=editorial/events-3.11.json
    node scripts/places/check-event-sources.mjs . docs/verification-3.11/content-sources.json
    node scripts/places/content-balance.mjs . docs/verification-3.11/content-balance.json

## 十、仍未解决

1. **大洋洲古典时代（前500—公元499）** 仍为 0 条：可读来源中，拉皮塔文化年代为约前1600—前500（已由 anc-lapita 覆盖），波利尼西亚定居时代被概括为约前1800—公元700（本轮已用 v311-polynesian-voyaging 覆盖上古铁器格），尚无能把前500—公元499单独支撑起来的可核验来源；未用推测性条目填充。
2. 其余 1—2 条的薄格见第六节，多数缺少可直读的机构来源，本轮只用能实际读到的来源。
3. 基尔瓦无绑定记录，明确排除（第四节）；chandler:715 与 chandler:245 在当前出货数据集中不存在，已在 3.10 报告标记 unresolved。
4. 亨比的身份绑定依据 Karnataka Tourism 页面所述身份；若需升级为学术认定，建议再补一份考古或学术来源复核。
5. 政体分栏篇章与关系层（莫卧儿/萨法维/蒲甘/阿瑜陀耶/大津巴布韦档案、印度洋贸易节点—连接、UCDP 冲突数据）仍未接入，沿用前轮交接审查结论。
6. UNESCO 直读仍被 403 阻挡，涉及 UNESCO 的来源继续以既有读取记录为证。
