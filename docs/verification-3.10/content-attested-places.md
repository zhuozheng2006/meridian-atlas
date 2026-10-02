# 有据遗址层（attested places）交付说明

面向 lead 的集成说明：schema、完整样例、建议读取与筛选语义。数据源与编辑底稿见 editorial/attested-places.json，产物见 public/data/places/attested-places.json.gz。

## 一、状态

| 项 | 值 |
|---|---|
| 记录数 | 12（kind 均为 attested-site） |
| 既有记录增强 | 2（anuradhapura、teotihuacan，绑定 4 个既有记录 ID） |
| 留档未整合 | 4（sri-ksetra、mapungubwe、mbanza-kongo、roi-mata-residence） |
| 交接候选覆盖 | 18/18 在 reviewLedger 中各有结论 |
| 构建 | node scripts/places/build-attested-places.mjs（确定性 gzip，mtime=0/OS=255） |
| 校验 | node scripts/places/validate-attested-places.mjs → PASS 12/12 |
| 既有校验 | validate-places / validate-city-narratives / validate-v2 / validate-polity-period / validate-release 全部 PASS |
| 产品接入 | **未接入**。public/places.js 由 lead 整合；本文即交付所需的 schema 与语义。 |

记录覆盖：东亚 3（良渚、殷墟、泉州）、东南亚 2（蒲甘、阿瑜陀耶）、南亚 2（多拉维拉、亨比）、非洲 1（基尔瓦基西瓦尼）、美洲 2（卡拉尔、卡霍基亚）、大洋洲 2（南马都尔、莱武卡）。

## 二、① 数据 schema

顶层对象：

| 字段 | 类型 | 含义 |
|---|---|---|
| schemaVersion | number | 版本号，当前 1 |
| builtAt | string | 构建时间戳（可用 ATTESTED_BUILT_AT 固定） |
| layer | string | 固定 "attested-places" |
| policy | object | 层级、显示、身份、坐标、来源五条政策原文 |
| counts | object | records / enhancements / deferred / reviewedCandidates |
| regions | object | 记录的地区计数（region 取值与 events.json 相同的 9 个地区码） |
| records | array | 12 条遗址记录 |
| enhancements | array | 2 条既有记录增强 |
| deferred | array | 4 条留档未整合候选（含 reasonZh/reasonEn/nextStepZh/nextStepEn） |
| readSemantics | object | 供读取层直接使用的五条语义摘要（yearWindow/kind/identity/search/boundaries） |

records[] 记录：

| 字段 | 类型 | 含义 |
|---|---|---|
| id | string | 形如 attested:<slug>，与既有地点 ID 命名空间隔离 |
| kind | string | 固定 attested-site |
| region | string | east-asia / southeast-asia / south-asia / west-central-asia / europe / africa / americas / oceania / global |
| nameZh / nameEn | string | 简体中文名 / 英文名 |
| aliases | string[] | 仅用于检索与显示的别名（如 大城、刺桐、Zayton），不用于身份判定 |
| sources | array | 至少 1 条：{id, publisher, title, url, license, readOn, propertyId, sourceComponentId?, coordinateUrl?} |
| location | object | {coordinates:[lon,lat], sourceDMS, representativePoint:true, accuracyMeters:null, coordinateMeaningZh, coordinateMeaningEn} |
| period | object | {start, end, precision, dateQuote, sourceRange:{from,to,kind}, displayHorizon, displayHorizonReasonZh/En?, interpretationZh, interpretationEn} |
| continuousOccupationAsserted | boolean | 恒为 false（禁止逐年连续占居推断） |
| displayWindow | null | 恒为 null（不做逐年改名窗口） |
| scope | object | {spatial:{zh,en}, temporal:{zh,en}} 展读范围 |
| narrative | object | 三段双语篇章：{setting, development, legacy}，每段 {zh,en} |
| significance | object | {zh,en} 意义说明 |
| review | object | {reviewedOn, candidateReviewStatus, nearbyExistingRecords:[...], checks:[{id, statementZh, statementEn, passed}]} |

review.nearbyExistingRecords[]：{id, name, nameZh, kind, dataset, found, distanceKm, recordedDistanceKm, distanceDeltaKm} 或 found:false 时带 note。**只作审查提示**，永不合并。

enhancements[]：{id, kind:"existing-record-enhancement", region, nameZh, nameEn, existingRecordIds[], sources[], attestationPeriod{...}, attestationCoordinate:[lon,lat], proposedUse{zh,en}, coordinatePolicy{zh,en}, notes{zh,en}, existingRecords:[{id, dataset, name, nameZh, coordinates, periods, observations, distanceToAttestationPointKm}]}。

deferred[]：{candidateId, region, nameZh, nameEn, dateQuote, reviewStatus, primaryUrl, reasonZh, reasonEn, nextStepZh, nextStepEn}。

## 三、② 完整样例（一条记录，取自出货 gz）

```json
{
  "id": "attested:ayutthaya",
  "kind": "attested-site",
  "region": "southeast-asia",
  "nameZh": "阿瑜陀耶",
  "nameEn": "Ayutthaya",
  "aliases": [
    "大城"
  ],
  "sources": [
    {
      "id": "ayutthaya-unesco",
      "publisher": "UNESCO World Heritage Centre",
      "title": "Historic City of Ayutthaya",
      "url": "https://whc.unesco.org/en/list/576/",
      "license": "CC BY-SA IGO 3.0 (listing description); original factual synthesis only, no source prose or images reproduced",
      "readOn": "2026-10-03",
      "propertyId": "576",
      "coordinateUrl": "https://whc.unesco.org/en/list/576/"
    }
  ],
  "location": {
    "coordinates": [
      100.56056,
      14.34778
    ],
    "sourceDMS": "N14 20 52.008 E100 33 38.016",
    "representativePoint": true,
    "accuracyMeters": null,
    "coordinateMeaningZh": "历史城区代表点；现代城市范围不构成都城边界。",
    "coordinateMeaningEn": "Representative point of the historic city; the modern urban extent is not the capital's boundary."
  },
  "period": {
    "start": 1350,
    "end": 1767,
    "precision": "circa",
    "dateQuote": "founded in 1350; 1767",
    "sourceRange": {
      "from": 1350,
      "to": 1767,
      "kind": "event-years"
    },
    "displayHorizon": null,
    "interpretationZh": "历史城区：1350年前后建立、1767年被焚毁及居民离开；简介写约1350，故保留circa。",
    "interpretationEn": "The historic city: founded around 1350 and destroyed in 1767 when its inhabitants left; the summary says about 1350, so circa precision is retained."
  },
  "continuousOccupationAsserted": false,
  "displayWindow": null,
  "scope": {
    "spatial": {
      "zh": "昭披耶河、华富里河与巴塞河交汇处的岛屿旧城及其护城河、运河与寺院遗址。",
      "en": "The island old city where the Chao Phraya, Lopburi and Pa Sak rivers meet, with its moats, canals and temple remains."
    },
    "temporal": {
      "zh": "约1350—1767年的都城时期。",
      "en": "The capital period from about 1350 to 1767."
    }
  },
  "narrative": {
    "setting": {
      "zh": "阿瑜陀耶建在三条河流交汇的岛屿上，护城河与运河网络把都城划分为街区，寺院、宫殿与水利设施沿水道布置。",
      "en": "Ayutthaya was built on an island at the confluence of three rivers, where moats and canals divided the capital into quarters and temples, palaces and waterworks lined the waterways."
    },
    "development": {
      "zh": "约1350年建立后，阿瑜陀耶成为暹罗都城和国际贸易港口，与中国、东南亚、印度、波斯及欧洲商人往来；都城持续营建寺庙与水利工程，1767年被攻陷焚毁，居民离开旧城。",
      "en": "After its foundation around 1350, Ayutthaya became the Siamese capital and an international port trading with China, Southeast Asia, India, Persia and Europe. Temples and waterworks were continually built until the city was stormed and burned in 1767 and its inhabitants left."
    },
    "legacy": {
      "zh": "旧城的砖构寺院与水利格局记录了前现代东南亚都城的规划方式；此后新都建立，旧城作为遗址保留，其名称与记忆延续至今。",
      "en": "The brick temples and water layout of the old city record how a premodern Southeast Asian capital was planned. A new capital was later founded, while the old city survives as an archaeological site whose name and memory continue."
    }
  },
  "significance": {
    "zh": "阿瑜陀耶体现了河流水利、国际贸易与都城权力的结合。",
    "en": "Ayutthaya embodies the combination of river water management, international trade and capital power."
  },
  "nearbyExistingRecords": [
    {
      "id": "chandler:103",
      "name": "Ayutthaya",
      "distanceKm": 1.2,
      "kind": "urban-observation"
    }
  ],
  "review": {
    "reviewedOn": "2026-10-03",
    "candidateReviewStatus": "property-coordinate-and-period-verified",
    "checks": [
      {
        "id": "coordinate-provenance",
        "statementZh": "坐标取自世界遗产条目所列代表点或组成部分，并保留原始度分秒；不声称古城中心的米级精度。",
        "statementEn": "The coordinate is the listed property or component representative point with its original DMS retained; no metre-level accuracy for an ancient city centre is claimed.",
        "passed": true
      },
      {
        "id": "period-source-anchored",
        "statementZh": "展读时段落在来源年代短语所覆盖的范围内，未用其他年代替换。",
        "statementEn": "The display period lies inside the range covered by the source date phrase and no other dating is substituted.",
        "passed": true
      },
      {
        "id": "no-continuous-occupation",
        "statementZh": "不主张逐年连续占居，也不把繁荣期当作城市完整寿命。",
        "statementEn": "Continuous year-by-year occupation is not asserted, and a peak phase is not treated as the city's whole lifespan.",
        "passed": true
      },
      {
        "id": "no-identity-merge",
        "statementZh": "与邻近人口记录或同名现代城市只作空间提示，不建立同一身份，不合并坐标与年代。",
        "statementEn": "Nearby population records or modern同名 cities are listed as spatial prompts only; no identity, coordinate or period merge is performed.",
        "passed": true
      },
      {
        "id": "display-window-null",
        "statementZh": "未设定显示窗口，年代以世纪或范围表达，不虚构具体月日。",
        "statementEn": "No display window is set; dates stay at century or range precision and no month or day is invented.",
        "passed": true
      },
      {
        "id": "separate-from-population-observations",
        "statementZh": "离散人口观测不用于推导连续占居；1767年为破坏与离开之年，不是人口观测年。",
        "statementEn": "Discrete population observations are not used to derive continuous occupation; 1767 marks destruction and departure, not a population observation year.",
        "passed": true
      }
    ],
    "nearbyExistingRecords": [
      {
        "id": "chandler:103",
        "name": "Ayutthaya",
        "nameZh": "阿瑜陀耶",
        "kind": "urban-observation",
        "dataset": "urban-observations",
        "found": true,
        "distanceKm": 1.1641,
        "recordedDistanceKm": 1.2,
        "distanceDeltaKm": 0.0359
      }
    ]
  },
  "handoffCandidateId": "ayutthaya"
}
```

## 四、③ 建议读取与筛选语义

1. **加载**：与既有地点同层读取（git 压缩资产），失败可重试；本层缺失不应让 places 整体失败——建议与 historical-capitals 一样作为可降级分片，partial 标记沿用现有机制。
2. **年份筛选**：某年是否可见 = period.start ≤ year ≤ period.end。不要使用人口观测的前后窗口逻辑，也不要在 period 内插值；跨空白不推断。对 displayHorizon 非空且来源为开放起点的记录（如莱武卡 1820 年起），UI 文案应写成“1820年代起（本图显示至 1900）”，不写成“1820—1900年存续”。
3. **kind 区分**：新增 kind="attested-site"。建议在搜索结果、详情页与图层样式上使用独立标签（如“考古遗址/attested site”），不与 urban-observation（离散人口观测）或 attested-settlement（Pleiades 时期证据）混算“城市数”。
4. **合并与去重**：attested: 前缀天然不与既有 ID 冲突；合并列表时按 id 求并集即可。**禁止**根据 name/aliases 或距离把记录与 chandler/modelski/pleiades 记录做 sameAs 合并。若同一屏幕同时出现两处证据（例如泉州古城与 1 公里外的 chandler:1457 Tsinkiang），并列展示并各自标注证据类型，由读者判断。
5. **检索**：索引 nameZh、nameEn、aliases。aliases 只在 period 内用于显示与检索（刺桐/Zayton 不应用于全部时段）。
6. **坐标与地图**：location.coordinates 为世界遗产代表点，accuracyMeters=null；只作点位标记，**不得**用于边界裁剪、缓冲区推断或“古城范围”绘制。可沿用现有“代表点≠城市边界”的通用说明。
7. **增强条目**：把 attestationPeriod 作为遗址级时间带附加到 existingRecordIds；**不得**改写这些记录的 coordinates、periods 或 observations。注意 modelski-ancient:128（特奥蒂瓦坎）带有公元前 900 年起的人口观测，早于世界遗产条目所述建设期，属于独立来源序列，建议在详情中并列显示而不是裁剪。
8. **缺口展示**：deferred 的 4 条可作为“资料缺口/待核验”列表显示（来源、原因、下一步），符合项目“覆盖诚实性”的要求。
9. **统计与文档**：建议把 records/enhancements/deferred 计数纳入发布报告；本层与 city-narratives（12 篇）是两类不同资产，不可互相替代计数。

## 五、构建、校验与复现

```sh
node scripts/places/build-attested-places.mjs            # 写 public/data/places/attested-places.json.gz + 构建报告
node scripts/places/build-attested-places.mjs --check    # 只校验编辑底稿，不写文件
node scripts/places/validate-attested-places.mjs         # 独立校验出货 gz（12 项）
```

构建报告：docs/verification-3.10/content-attested-places-build.json（含近邻记录解析结果、距离重算差异、增强绑定记录）。当前结果：10/11 近邻 id 解析成功且与交接文件记录距离一致（无 >0.2 km 偏差），1 个未解析（chandler:245）。编辑底稿在交接文件存在时会逐条比对 dateQuote、coordinates、propertyId、sourcePageReadOn；交接文件缺失时自动降级为“只对编辑底稿校验”，校验器会明确记录 handoffAvailable=false。

## 六、发布清单注意

- public/data/places/city-sources.json.gz 内的 files 清单**不包含**新增的 attested-places.json.gz。scripts/validate-release.mjs 只校验清单内列出的文件并要求至少 48 个，因此当前仍然 PASS（本次实测 53 个）。要让新资产进入该清单，需要重跑 scripts/places/build.py（依赖约 200 MB 原始输入与 opencc 环境，本轮不具备）或按既有格式手工追加 {bytes, sha256} 条目；**不要**通过放宽校验来绕过。
- 许可：记录来源为 UNESCO 世界遗产条目（Description 为 CC BY-SA IGO 3.0），本层只含短语级事实与原创双语综述。发布前请把 UNESCO 及既有博物馆/大学来源并入 ATTRIBUTIONS.md（本轮按写作用域未改动该文件）。
- 简体中文：records 与 deferred 的中文均为简体；校验器会拒绝常用繁体字形。

## 七、已知边界

1. 4 个候选因年代或坐标未拆分而留档（室利差呾罗、马蓬古布韦、姆班扎刚果、曼加斯居所），未以“六区各 3 条”为目标提前填充。
2. chandler:245（Cahokia 近邻）在当前出货数据集中不存在，标记 unresolved，未做猜测性映射。
3. UNESCO（403）、大都会博物馆（429）、史密森学会（403）等站点本轮不可抓取；相关记录的来源证据来自仓库既有出货数据与交接文件的读取记录（读取日期 2026-10-03），未声称本轮抓取。
4. 本层**未**接入产品读取与 UI；接入与浏览器验收由 lead 在整合时执行。
