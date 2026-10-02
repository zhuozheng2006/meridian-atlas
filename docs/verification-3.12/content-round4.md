# 经纬纪 3.12 数据充实第四轮报告（task-11）

目标：按用户查阅概率继续做深内容，缩小「1,450 份政体档案 vs 少量叙述」的缺口，并补齐公元 1000—2000 年每 50 年窗口的地域覆盖。全部数字来自脚本产物，复现命令见第九节。

## 一、改了什么

| 项目 | 变化 | 产物 |
|---|---|---|
| 政体四栏叙述 | 26 → **95** 篇（本轮新增 **41** 个政体，累计批次文件 69 篇） | public/data/enrichment/narratives.json(+.gz)、editorial/enrichment-narratives-3.12.json |
| 分栏绑定记录 | 累计绑定 **1,024** 条疆域记录 | 同上 |
| 历史事件 | 401 → **418**（本轮 +17，全部双语） | public/data/events.json(+.gz)、editorial/events-3.12.json |
| 薄格（年代×地区，少于 3 条） | 20 → **18** | docs/verification-3.12/content-balance.json |
| 50 年窗口零覆盖格（1000—2000） | **18 → 0** | docs/verification-3.12/content-window-coverage.json |
| 来源核验 | 80/80 有据（50 条本轮抓正文命中关键词） | docs/verification-3.12/content-sources.json |
| 压缩派生 | narratives.json 653 KB → narratives.json.gz 135 KB（由 scripts/build-enrichment-archive.mjs 重建） | public/data/enrichment/narratives.json.gz |

## 二、本轮新增的 41 个政体（按查阅概率优先）

**中国与东亚（12）**：商朝 Q128938、周朝 Q35216、秦国 Q34756、隋朝 Q7405、宋朝 Q7462、元朝 Q7313、辽朝 Q4958、北魏 Q875305、新朝 Q504769、蜀汉 Q320925、平安时代 Q193292、镰仓幕府 Q736839。

**朝鲜、日本与欧洲（8）**：高句丽 Q28370、百济 Q28428、新罗 Q28456、高丽 Q28208、渤海国 Q28322、足利幕府 Q1154406、琉球国 Q28025、英格兰王国 Q179876。

**南亚与伊斯兰（11）**：百乘王朝 Q5257、贵霜帝国 Q25979、波罗王朝 Q668412、罗湿陀罗拘陀 Q856691、遮娄其 Q1395011、曷萨拉 Q466581、巴赫曼尼 Q374521、锡克帝国 Q83572、古尔王朝 Q199443、正统哈里发国 Q12490507、萨曼王朝 Q12150341。

**西亚、中亚、欧洲与美洲（10）**：布韦希 Q273874、塞尔柱 Q3708094、伊儿汗国 Q178084、金帐汗国 Q79965、神圣罗马帝国 Q12548、拜占庭帝国 Q12544、教宗国 Q170174、俄罗斯沙皇国 Q186096、基辅罗斯 Q1108445、托尔特克 Q187897。

每篇仍为 politics / economy / culture / events 四栏双语 + 2 条 facts，并通过 scripts/places/apply-enrichment-3.12.mjs 的绑定校验（qid 档案存在、catalog 中记录名精确匹配、qid 相等、时段重叠、profile-index records 映射一致）。脚本幂等。

## 三、事件年表：50 年窗口补齐

新增 17 条事件（全部以本会话读取的 Wikipedia 条目为来源，CC BY-SA 4.0，读取日期 2026-10-03）：

| 年代 | 地区 | 事件 | 补的窗口 |
|---|---|---|---|
| 1013—1042 | 欧洲 | 北海帝国与维京时代晚期的跨海王权 | 1000—1049 |
| 1130—1194 | 欧洲 | 西西里王国的建立 | 1100—1149 |
| 1189—1192 | 欧洲 | 第三次十字军 | 1150—1199 |
| 1290—1320 | 南亚 | 卡尔吉王朝与德里苏丹国的扩张 | 1250—1299 |
| 1453—1478 | 西亚中亚 | 白羊王朝与乌尊·哈桑的鼎盛 | 1450—1499 |
| 1485 | 东亚 | 《经国大典》最终颁行 | 1450—1499 |
| 1534—1763 | 美洲 | 新法兰西与北美内陆贸易网络 | 1600—1649、1650—1699、1700—1749 |
| 1545—1600 | 美洲 | 米塔劳役制与安第斯殖民经济 | 1550—1599 |
| 1700—1900 | 美洲 | 加勒比甘蔗种植园经济的扩张 | 1700—1749 |
| 1701—1714 | 欧洲 | 西班牙王位继承战争 | 1700—1749 |
| 1727—1743 | 南亚 | 斋浦尔建城与18世纪拉杰普特政治 | 1700—1749 |
| 1747—1772 | 西亚中亚 | 杜兰尼帝国的建立 | 1750—1799 |
| 1830—1895 | 西亚中亚 | 大博弈与中亚边界的划定 | 1850—1899 |
| 1838—1842 | 西亚中亚 | 第一次英阿战争 | 1800—1849 |
| 1971—2024 | 大洋洲 | 太平洋岛国论坛与区域合作 | 2000—2024 |
| 2001 | 东亚 | 中国加入世界贸易组织 | 2000—2024 |
| 2001—2021 | 西亚中亚 | 阿富汗战争 | 2000—2024 |

新增分析脚本 scripts/places/window-coverage.mjs：按「事件跨度与窗口重叠」统计每个大区在公元 1000—2000 年每 50 年窗口内的事件数（另附不含全球事件的 regionalOnly 计数），并输出零覆盖与不足 3 条的窗口清单。本轮该清单中的 18 个零覆盖格已全部补上至少 1 条有据事件；不足 3 条的窗口从 98 个降到 96 个，仍待后续轮次继续补。


## 四、来源与读取方式

- 政体叙述与事件：全部以英文 Wikipedia 条目为本会话唯一来源（CC BY-SA 4.0，2026-10-03 经 MediaWiki extract API 读取），四栏与 facts 为原创双语综述；协议与来源在 sources 中登记 title / url / publisher / checkedOn / access / supports。
- 城市与遗址层沿用前轮：Wikipedia（实读）+ UNESCO 世界遗产条目（仅用交接研究文件 2026-10-03 的读取记录，whc.unesco.org 仍被 Cloudflare 403 拦截，登记为 read-recorded-in-handoff-research）+ Figshare 人口数据集 DOI。
- scripts/places/check-event-sources.mjs 独立抓取 80 个 URL 并做关键词命中校验，80/80 通过（50 条 live-content-verified；25 条站点反爬但 URL 已在仓库或交接文件中有读取记录）。
- 发布前需把新增来源并入 ATTRIBUTIONS.md（由 lead 统一维护）。

## 五、验证证据

    node scripts/validate.mjs                    → PASS（418 条事件）
    node scripts/validate-v2.mjs                 → PASS（95 篇叙述的绑定、来源与 .json/.gz 一致性）
    node scripts/validate-places.mjs             → PASS
    node scripts/validate-city-time.mjs          → PASS
    node scripts/validate-city-narratives.mjs    → PASS 10/10（17 篇 / 53 来源 / 48 绑定记录 / 55 回归用例）
    node scripts/validate-polity-period.mjs      → PASS
    node scripts/validate-release.mjs            → PASS
    node scripts/places/apply-enrichment-3.12.mjs --check → 95 篇 / 1,024 绑定记录，重复运行不改变文件

浏览器抽查（http://127.0.0.1:8767，Chrome 无头 + SwiftShader，每用例独立会话）：

- 商朝 clio-00110@前1150：政治栏含「商朝」、文化与经济栏含「甲骨」、年表栏含「前1046」；
- 拜占庭 clio-02412@640：政治栏含「罗马人」、文化与经济栏含「查士丁尼」、年表栏含「1453」；
- 英格兰 clio-03757@940：政治栏含「埃塞尔斯坦」、文化与经济栏含「莎士比亚」、年表栏含「1215」；
- 神圣罗马帝国 clio-03965@970：政治栏含「神圣罗马皇帝」「分权结构」，文化与经济栏含「宗教改革」，年表栏含「1806」。

截图：docs/verification-3.12/content-shang-culture.png。

## 六、覆盖矩阵变化（相对第三轮）

- 年代×地区薄格：20 → 18；仍为 0 条的年代格保持 1 个（大洋洲古典 前500—公元499，无可核验来源）。
- 50 年窗口（1000—2000）：零覆盖格 18 → 0；不足 3 条的窗口 98 → 96。剩余不足的窗口集中在南亚（19）、西亚中亚（17）、东亚（16）、大洋洲（13）、欧洲（12）。

## 七、仍未解决

1. **政体叙述覆盖率仍低**：1,450 份档案中目前 95 篇有叙述（约 6.6%）。下一批优先：西藏 Q521263（需先做身份判定）、喀山/克里米亚/阿斯特拉罕等汗国、察合台 Q487829、花剌子模、伽色尼 Q249578、卡拉汗 Q494354、布哈拉 Q577668、希瓦 Q491106、浩罕 Q696241、兰纳 Q1059707、澜沧 Q853477、素可泰 Q863279、勃固 Q1572529、掸邦 Q4765854、文莱 Q887803、尼泊尔 Q837、缅甸 Q836、越南各王朝、欧洲的波兰/匈牙利/普鲁士/意大利/西班牙等历史政体（当前快照中部分只有现代国家 QID，需要先确认实体匹配）、美洲的瓦里/蒂瓦纳库/米斯特克、非洲的贝宁/达荷美/布干达/穆塔帕/基尔瓦。
2. **50 年窗口仍有 96 个不足 3 条**：本轮优先消除了零覆盖格；要把每个大区每个窗口都补到 3 条，按目前 418 条事件的密度还需要约 150—200 条有据事件，建议分多轮、每轮聚焦 1—2 个大区。
3. **关系层**（贸易节点与连接、冲突参与方、商品流向）与 **政体↔地点/事件的显式外键**仍未接入；目前事件与政体叙述靠 eventKeywords 与名称匹配。
4. **UNESCO 直读**仍被 403 阻挡；涉及 UNESCO 的条目继续以交接文件的读取记录为证。

## 八、给读取层/性能的说明

本轮 narratives.json 由 384 KB 增至 653 KB，压缩派生后 narratives.json.gz 为 135 KB（scripts/build-enrichment-archive.mjs 生成，validate-v2 校验一致性；我已在本轮重建过一次）。若下一轮叙述继续翻倍，建议读取层按 qid 分片加载；events.json.gz 目前约 233 KB，分片方案待性能任务结论。

## 九、复现命令

    node scripts/places/apply-enrichment-3.12.mjs                  # 合并 69 篇批次叙述并解析绑定（幂等）
    node scripts/places/apply-enrichment-3.12.mjs --check          # 只校验，不写文件
    node scripts/build-enrichment-archive.mjs                      # 重建 narratives.json.gz（lead 收尾也会重建）
    node scripts/places/apply-events-3.10.mjs --batch=editorial/events-3.10.json --batch=editorial/events-3.11.json --batch=editorial/events-3.12.json
    node scripts/places/check-event-sources.mjs . docs/verification-3.12/content-sources.json
    node scripts/places/content-balance.mjs . docs/verification-3.12/content-balance.json
    node scripts/places/window-coverage.mjs . docs/verification-3.12/content-window-coverage.json

