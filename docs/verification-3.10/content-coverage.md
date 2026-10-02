# 经纬纪 3.10 内容覆盖报告（P1 全球与年代均衡）

对应共享任务 task-2。本报告由脚本产物与校验结果汇总，所有数字可复现（见第九节）。

## 一、改了什么

| 项目 | 变化 | 产物 |
|---|---|---|
| 历史事件 | 343 → **378**（+35，全部双语新增） | public/data/events.json、public/data/events.json.gz |
| 事件来源核验 | 38 个新增来源 URL 全部留证 | docs/verification-3.10/content-sources.json |
| 地区×年代量化 | 新增 git 基线对比与薄格清单（33 → **27** 个薄格） | docs/verification-3.10/content-balance.json |
| 有据遗址层 | 12 条遗址记录 + 2 条既有记录增强 + 4 条留档未整合 | public/data/places/attested-places.json.gz、editorial/attested-places.json |
| 遗址层构建/校验 | 新增构建与独立校验脚本，12/12 项通过 | scripts/places/build-attested-places.mjs、scripts/places/validate-attested-places.mjs |
| 交接候选核查 | 18 个候选逐条给出结论（12 整合 / 2 增强 / 4 留档） | editorial/attested-places.json 的 reviewLedger |

事件新增明显偏向最薄的地区与年代：东亚近代早期 2→5、南亚近代早期 3→6、西亚中亚近代早期 1→4、东南亚近代早期 2→3、大洋洲近代早期 2→3、大洋洲近代 3→4；并补了此前为空的格子（南亚上古早期 1→2、南亚古典 7→8、东亚上古早期 1→2、欧洲古典 6→7、全球古典 2→3）。

## 二、按地区×年代的变化（仅列出有变化的格子）

| 地区 × 年代 | 改前 | 改后 | 变化 |
|---|---|---|---|
| africa × medieval | 19 | 22 | +3 |
| africa × early-modern | 5 | 6 | +1 |
| americas × medieval | 11 | 14 | +3 |
| east-asia × ancient-early | 1 | 2 | +1 |
| east-asia × medieval | 16 | 19 | +3 |
| east-asia × early-modern | 2 | 5 | +3 |
| europe × classical | 6 | 7 | +1 |
| europe × medieval | 12 | 13 | +1 |
| global × classical | 2 | 3 | +1 |
| oceania × early-modern | 2 | 3 | +1 |
| oceania × modern | 3 | 4 | +1 |
| south-asia × ancient-early | 1 | 2 | +1 |
| south-asia × classical | 7 | 8 | +1 |
| south-asia × medieval | 4 | 5 | +1 |
| south-asia × early-modern | 3 | 6 | +3 |
| southeast-asia × medieval | 14 | 16 | +2 |
| southeast-asia × early-modern | 2 | 3 | +1 |
| west-central-asia × classical | 2 | 3 | +1 |
| west-central-asia × medieval | 9 | 12 | +3 |
| west-central-asia × early-modern | 1 | 4 | +3 |

## 三、新增事件逐条清单（35 条）

| 年代 | 地区 | 年代格 | 事件 | 主要来源 | 本轮核验方式 |
|---|---|---|---|---|---|
| -3000–-1500 | 南亚 | 上古早期 | 多拉维拉：印度河城市的水利与规划 | UNESCO World Heritage Centre — Dholavira: a Harappan City | 站点反爬，用交接文件既有读取证据 |
| -1300–-1046 | 东亚 | 上古早期 | 殷墟：晚商都城与甲骨档案 | UNESCO World Heritage Centre — Yin Xu | 站点反爬，用交接文件既有读取证据 |
| -300–993 | 南亚 | 古典 | 阿努拉德普勒：佛教圣城的兴衰 | UNESCO World Heritage Centre — Sacred City of Anuradhapura | 站点反爬，用交接文件既有读取证据 |
| -200–1400 | 西亚中亚 | 古典 | 丝绸之路廊道上的跨洲交换 | UNESCO World Heritage Centre — Silk Roads: Chang'an–Tianshan Corridor | 站点反爬，用仓库既有来源记录 |
| -100–800 | 全球 | 古典 | 佛教沿丝绸之路的传播 | The Metropolitan Museum of Art — Buddhism along the Silk Road | 站点反爬，用仓库既有来源记录 |
| 80 | 欧洲 | 古典 | 罗马斗兽场落成与公共娱乐 | Parco archeologico del Colosseo — Blood and the Arena | 本轮不可达，用仓库既有来源记录 |
| 634–663 | 东亚 | 中世纪 | 大明宫与唐长安宫城 | Xi'an Municipal Government — Daming Palace scenic spot | 本轮抓取正文并命中关键词 |
| 700–1400 | 非洲 | 中世纪 | 跨撒哈拉黄金贸易网络 | The Metropolitan Museum of Art — The Trans-Saharan Gold Trade | 站点反爬，用仓库既有来源记录 |
| 750–850 | 西亚中亚 | 中世纪 | 八世纪巴格达的天文翻译与观测 | UNESCO Silk Roads Programme — Evolution of Astronomy along the Silk Roads | 本轮抓取正文并命中关键词 |
| 794–900 | 东亚 | 中世纪 | 平安京的营建与都市格局 | Agency for Cultural Affairs, Japan — Historic Monuments of Ancient Kyoto | 本轮抓取正文并命中关键词 |
| 836–892 | 西亚中亚 | 中世纪 | 萨迈拉：阿拔斯王朝的新都 | Met — The Art of the Abbasid Period；UNESCO — Samarra | 站点反爬，用仓库既有来源记录 |
| 900–1500 | 美洲 | 中世纪 | 后古典期玛雅城邦与抄本传统 | Met — Maya Codex-Style Ceramics (Journal 51) | 本轮抓到页面（PDF） |
| 960–1368 | 东亚 | 中世纪 | 泉州：宋元时期的海洋贸易枢纽 | UNESCO — Quanzhou: Emporium of the World in Song-Yuan China | 站点反爬，用交接文件既有读取证据 |
| 1176–1200 | 非洲 | 中世纪 | 萨拉丁与开罗城堡 | Egyptian Ministry of Tourism and Antiquities — Cairo Citadel | 本轮抓到页面（未解析正文） |
| 1181–1219 | 东南亚 | 中世纪 | 阇耶跋摩七世与圣剑寺 | APSARA National Authority — Preah Khan | 站点反爬，用仓库既有来源记录 |
| 1200–1438 | 美洲 | 中世纪 | 库斯科王国的早期扩张 | Smithsonian NMAI — Inka: Creation Stories | 站点反爬，用仓库既有来源记录 |
| 1204–1261 | 欧洲 | 中世纪 | 第四次十字军与拉丁帝国 | Met — Byzantium (ca. 330–1453) | 站点反爬，用仓库既有来源记录 |
| 1250–1517 | 非洲 | 中世纪 | 马穆鲁克时期开罗的城市扩张 | Egyptian Ministry of Tourism and Antiquities — Historical Cairo | 本轮抓取正文并命中关键词 |
| 1300–1431 | 东南亚 | 中世纪 | 吴哥核心区的十四世纪转型 | University of Sydney — Angkor's collapse research | 本轮抓取正文并命中关键词 |
| 1336–1565 | 南亚 | 中世纪 | 维查耶纳伽尔与亨比都城 | UNESCO — Hampi | 站点反爬，用交接文件既有读取证据 |
| 1370–1405 | 西亚中亚 | 中世纪 | 帖木儿定都撒马尔罕与工匠迁移 | Met — The Art of the Timurid Period | 站点反爬，用仓库既有来源记录 |
| 1428 | 美洲 | 中世纪 | 阿兹特克三邦同盟的形成 | British Museum — The Aztecs: educational resource | 本轮抓到页面（PDF） |
| 1500–1644 | 东亚 | 近代早期 | 十六至十七世纪明代瓷器与全球贸易 | Smithsonian Libraries — Ming: porcelain for a globalised trade | 站点反爬，用仓库既有来源记录 |
| 1500–1600 | 西亚中亚 | 近代早期 | 十六世纪奥斯曼宫廷与帝国文化 | Met — The Art of the Ottomans before 1600 | 站点反爬，用仓库既有来源记录 |
| 1500–1722 | 西亚中亚 | 近代早期 | 萨法维丝织与宫廷赞助 | Met — Persian Silks；Encyclopaedia Iranica — Safavids | 站点反爬 + 本轮抓取命中 |
| 1511 | 东南亚 | 近代早期 | 马六甲陷落与葡萄牙海上据点 | UNESCO — Melaka and George Town | 站点反爬，用仓库既有来源记录 |
| 1556–1605 | 南亚 | 近代早期 | 阿克巴时期的帝国整合与宫廷文化 | Met — The Art of the Mughals before 1600 | 交接审查已核验，站点本轮反爬 |
| 1565–1570 | 南亚 | 近代早期 | 胡马雍陵与莫卧儿纪念建筑 | UNESCO — Humayun's Tomb, Delhi | 站点反爬，用仓库既有来源记录 |
| 1598–1629 | 西亚中亚 | 近代早期 | 阿巴斯一世与伊斯法罕 | Encyclopaedia Iranica — Safavid dynasty | 本轮抓取正文并命中关键词 |
| 1600–1700 | 大洋洲 | 近代早期 | 曼加斯与罗伊·马塔的酋长权威 | UNESCO — Chief Roi Mata's Domain | 站点反爬，用交接文件既有读取证据 |
| 1600–1800 | 非洲 | 近代早期 | 廷巴克图手稿传统与十八世纪学术活动 | Library of Congress — Timbuktu manuscripts；UNESCO — Timbuktu | 本轮抓取正文并命中关键词 |
| 1603–1867 | 东亚 | 近代早期 | 二条城与幕府在京都的权威 | City of Kyoto / Nijō-jo Castle — Chronology | 本轮抓取正文并命中关键词 |
| 1639–1648 | 南亚 | 近代早期 | 沙贾汗纳巴德与红堡营建 | PIB, Ministry of Culture, India — Red Fort；UNESCO — Red Fort | 本轮抓取正文并命中关键词 |
| 1662–1795 | 东亚 | 近代早期 | 清代宫廷绘画与帝国文化整合 | Met — The Qing Dynasty (1644–1911): Painting | 站点反爬，用仓库既有来源记录 |
| 1820–1900 | 大洋洲 | 近代 | 莱武卡与十九世纪太平洋港镇 | UNESCO — Levuka Historical Port Town | 站点反爬，用交接文件既有读取证据 |

## 四、来源与许可

- 新增事件只使用两类来源：① 仓库出货数据与审计文档中已记录的机构来源 URL；② 交接研究文件「经纬纪-AI交接/研究资料/全球覆盖审查/settlement-candidates.json」中已逐页读取并记录读取日期（2026-10-03）的 UNESCO 世界遗产条目页。没有凭记忆新造 URL。
- 机构包括 UNESCO 世界遗产中心与教科文组织丝路项目、大都会艺术博物馆、史密森学会（含美国印第安人国家博物馆与史密森图书馆）、大英博物馆、美国国会图书馆、埃及旅游与文物部、日本文化厅、京都市、西安市人民政府、印度新闻信息局、伊朗百科全书、悉尼大学、Colosseo 考古公园、APSARA 国家管理局等。
- 许可：UNESCO 世界遗产条目 Description 为 **CC BY-SA IGO 3.0**；本轮只保存短语级事实与原创双语综述，未复制网页正文、照片或地图。博物馆与大学页面按各自条款仅作事实核对与引用。仓库代码仍为 MIT；日后发布需按 ATTRIBUTIONS.md 既有格式补齐上述来源与许可，并逐项核对第三方提名文件与图像。按写作用域要求，本清单留在文档层，未改动 ATTRIBUTIONS.md。
- 简体中文：新增正文全部为简体；构建与校验脚本内置常用繁体字形拦截，写入或校验时拒绝繁体。

## 五、来源核验模式（content-sources.json）

- 本轮抓取正文并命中关键词：9 个（伊朗百科全书、美国国会图书馆、日本文化厅、西安市、二条城、印度新闻信息局、埃及文物部、悉尼大学、UNESCO 丝路项目）。
- 本轮抓到页面但为 PDF 或未解析正文：3 个（大都会博物馆期刊 PDF、大英博物馆 PDF、埃及文物部另一页）。
- 站点反爬（UNESCO 403、大都会 429、史密森 403 等）：25 个，改用仓库出货数据或交接文件的既有读取记录作为证据，并明确标注，不冒充本轮抓取。
- 本轮不可达：1 个（colosseo.it），同样以仓库既有来源记录为证据。
- 结论：38/38 至少有一条独立证据记录，0 条无据。

## 六、仍有缺口（下一轮优先）

1. **完全为空的格子**（改后仍为 0 条）：欧洲史前、大洋洲上古铁器与古典、南亚上古铁器、东南亚史前与上古早期、东南亚上古铁器、全球史前与上古早期。这些格子缺少当前可核验的机构来源，本轮没有用无年代条目填充。
2. **仅 1–2 条的格子**：非洲史前 1、美洲史前 1、美洲上古铁器 1、欧洲上古早期 1、欧洲上古铁器 1、大洋洲上古早期 1、南亚史前 1、西亚中亚近代 1、非洲上古早期 2、东亚史前 2、东亚上古早期 2、东亚上古铁器 2、全球中世纪 2、南亚上古早期 2、西亚中亚史前 2、西亚中亚上古早期 2、西亚中亚当代 2。
3. **政体篇章缺口**（沿用交接审查结论，本轮未解决）：莫卧儿、萨法维、蒲甘、阿瑜陀耶、大津巴布韦等政体仍缺少按期分栏的当期档案叙述；本轮只补了事件层与遗址层。
4. **关系层缺口**：印度洋贸易专题的节点—连接模型、UCDP 冲突年与参与方数据均未接入。
5. **遗址层未接入产品**：public/places.js 的读取与 UI 由 lead 整合；本轮交付数据层、schema 与读取语义（见 content-attested-places.md）。
6. **4 个候选留档未整合**：室利差呾罗（需单城年代核验）、马蓬古布韦（需单城拆分）、姆班扎刚果（需城市与王国分期）、曼加斯居所（缺组成部分级坐标）。原因与下一步写在 editorial/attested-places.json 的 deferred 段。
7. **一处未解析的既有记录引用**：交接文件列出 Cahokia 近邻 chandler:245，该 id 不存在于当前出货的城市数据集，已标记 unresolved，未做猜测性映射。
8. **资产戳未更新**：node scripts/stamp-assets.mjs --check 当前失败，原因是其他成员正在修改 public/*.js（boundary-controller.js、boundary-style.js、geography.js、map-engine.js、regional-boundaries.js）；本轮只改数据与脚本，未运行 prepare:assets，以免把在途文件盖章。Lead 统一跑 npm test 前需先跑 prepare:assets。

## 七、校验证据

```
node scripts/places/apply-events-3.10.mjs        → 幂等合并，343→378，gzip mtime=0/OS=255
node scripts/validate.mjs                        → PASS（含事件双语/年代/坐标/来源 schema 校验，events=378）
node scripts/validate-v2.mjs                     → PASS（events.json.gz 与未压缩内容 deepEqual）
node scripts/validate-places.mjs                 → PASS
node scripts/validate-city-narratives.mjs        → PASS（未改动：12 篇 / 39 来源 / 40 绑定记录）
node scripts/validate-polity-period.mjs          → PASS
node scripts/validate-release.mjs                → PASS（53 个既有 places 资产与出处清单一致）
node scripts/places/validate-attested-places.mjs → PASS 12/12
```

浏览器抽查（http://127.0.0.1:8767，Chrome 无头 + SwiftShader）：东亚@1600 返回 5 条，含新增“二条城”“清代宫廷绘画”“明代瓷器”；南亚@1650 返回 5 条，含“沙贾汗纳巴德”“胡马雍陵”“阿克巴”；西亚中亚@1600 返回 3 条，含“阿巴斯一世”“萨法维丝织”“奥斯曼宫廷”；大洋洲@1700±250 返回 12 条，含“罗伊·马塔”“莱武卡”。截图：docs/verification-3.10/content-events-east-asia-1600.png。

## 八、为什么没有新增 city-narratives 篇章

任务步骤 4 的“薄弱地区城市/遗址篇章”以 **attested-places 独立层**交付（12 篇遗址双语篇章，每篇含设置/发展/遗产三段、空间与时段范围、意义说明、逐条核查记录），理由：

- 根校验器 scripts/validate-city-narratives.mjs 要求每篇篇章精确绑定 historical-settlements / historical-capitals / urban-observations / modern-cities 中的记录 ID，并按观测年与来源分期逐条校验；本轮 12 个候选遗址（良渚、殷墟、泉州、多拉维拉、亨比、莱武卡等）多数在这些数据集中没有记录，无法在不虚构来源记录的前提下满足绑定规则。
- 交接研究建议的接入方式本身就是新建独立编辑层（新建 editorial/attested-places.json，与 Pleiades 记录并列读取，不改 Pleiades 原始记录）。
- 因此根校验器的 entries=12 / sources=39 / 绑定记录=40 三个硬编码计数**保持未改**（lead 已授权可改，本轮无必要），避免改动 npm test 使用的文件。
- 若下一轮要为有源记录的遗址（如阿努拉德普勒、特奥蒂瓦坎、亨比、基尔瓦）补 city-narratives 篇章，需先确认绑定记录与观测年，再同步更新根校验器计数常量。

## 九、复现方法

```sh
node scripts/places/content-balance.mjs           # 量化（读 git 基线 7ee94b4 对比，写 content-balance.json）
node scripts/places/apply-events-3.10.mjs         # 合并事件并重生成 gz（幂等）
node scripts/places/check-event-sources.mjs       # 来源核验报告（需公网；反爬站点记为 blocked）
node scripts/places/build-attested-places.mjs     # 构建遗址层
node scripts/places/validate-attested-places.mjs  # 独立校验遗址层
```

## 十、收尾结论（task-2）

**状态：已完成并自测通过，lead 已开始整合。** 本任务按“先量化、再扩充、来源可核验”的顺序交付了四类产物：

| 类别 | 产物 | 核验 |
|---|---|---|
| 量化 | docs/verification-3.10/content-balance.json、scripts/places/content-balance.mjs | git 7ee94b4 基线对比；薄格 33→27；events 343→378 |
| 事件 | editorial/events-3.10.json → public/data/events.json(+gz) | 基线 343 条逐字段零改动；新增 35 条幂等、gz deepEqual、mtime=0 |
| 来源 | docs/verification-3.10/content-sources.json、scripts/places/check-event-sources.mjs | 38/38 有据（9 条本轮抓正文命中关键词、25 条反爬用仓库/交接读取记录、1 条不可达、3 条抓到未解析） |
| 遗址层 | editorial/attested-places.json → public/data/places/attested-places.json.gz | 12 条记录 + 2 条增强 + 4 条留档；18/18 候选有结论；自建校验 12/12 PASS |

指定校验（validate-city-narratives、validate-places、validate-v2、validate-polity-period）与 validate.mjs / validate-release / validate-native / validate-v3 / validate-historical / validate-fact-period / validate-geography / validate-interactions 全部通过；浏览器抽查 8767 四个地区筛选均命中新增条目。产品接入（public/places.js、public/city-narratives.js、public/app.js）由 lead 完成，本轮未改这些文件。

**遗留与边界（不隐瞒）**

1. 交接研究引用的 `chandler:715`（基尔瓦位置冲突）与 `chandler:245`（卡霍基亚近邻）在当前出货数据集中**均不存在**，说明该研究文件的部分近邻 ID 来自另一份快照；两条都只作 unresolved 标记，未做猜测性映射。
2. 4 个候选按研究结论留档：室利差呾罗（三城合计年代）、马蓬古布韦（聚落景观多城）、姆班扎刚果（城市与王国分期）、曼加斯居所（缺组成部分级坐标）。
3. UNESCO（403）、大都会博物馆（429）、史密森学会（403）等站点本轮不可抓取，相关来源以仓库既有读取记录为证据并在报告中标注。
4. 未改动根 scripts/validate-city-narratives.mjs 的 entries=12 / sources=39 / 绑定记录=40 三个硬编码计数（本轮以 attested-places 承载城市/遗址篇章）。

**下一轮若补 city-narratives 篇章（可行性已核查）**

| 候选 | 可绑定记录 | 结论 |
|---|---|---|
| 阿努拉德普勒 | chandler:73（观测 -100、622）、modelski-ancient:12（观测 -100…900） | 可直接绑定，观测年规则现成 |
| 特奥蒂瓦坎 | chandler:1404（观测 -100…622）、modelski-ancient:128（观测 -900…700） | 可绑定，但须并列保留 modelski 序列中早于建设期的负年份观测，不裁剪 |
| 亨比 | 无同名记录；最近为 chandler:1510「Vijayanagar」（观测 1300…1565，约 2 km） | 需先做“维查耶纳伽尔政体都城 vs 亨比遗址”的编辑身份判定，禁止按距离绑定 |
| 基尔瓦 | 出货数据集中无记录（研究文件所指 chandler:715 不存在） | 需新增可核验来源记录或明确排除，本轮无法绑定 |

若要推进，建议同时把根校验器那三个计数改为从数据现算（entries/sources/绑定记录集合大小），55 条回归用例保持不动；这属于跨文件改动，需 lead 确认后我再动手。

