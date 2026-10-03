# 政体叙述第六批（3.28）：301 → 337

任务 task-34。基线提交 `7b609630`，本报告由 `docs/verification-3.28/report-narratives-round6-3.28.mjs --baseline=7b609630` 生成，可复跑。

**结论**：政体叙述 **301 → 337 篇（本轮 +36）**。本轮重新选点 60 篇，完成 36 篇，**24 篇待写**（身份核验与导言已就绪）。绑定疆域记录 5,440 条。

## 1. 结果

| 指标 | 基线 | 本轮 |
|---|---|---|
| 叙述总数 | 301 | **337** |
| 本轮新增 | — | **36** |
| 本轮选定 / 待写 | 60 | 24 待写 |
| 1,455 份档案中仍无叙述 | 1,154 | 1118 |

本轮已写 36 篇的地区分布：africa 8、west-central-asia 6、east-asia 6、south-asia 5、americas 4、southeast-asia 2、oceania 2、europe 3。

## 2. 欧洲配额：**目标未达成，原因是结构性的**

任务要求本轮按 **40%–50%** 的欧洲配额选点。实测：**选定的 60 篇中欧洲只有 19 篇（31.7%）**，低于区间。这不是配额被忽略，而是**欧洲的合格候选池已经见底**：

- 把选点脚本的目标放宽到 400 篇重跑，**全部合格候选只有 167 篇，其中欧洲仅 19 篇**（占 11.4%），且这 19 篇已全部进入本批；
- 也就是说 **19 篇就是当前的上限**，不是"少选了"。要在保持身份规则（catalog 绑定 + pageprops + P31 为政体）的前提下提高欧洲占比，只能等新增可核验的欧洲政体档案；
- 实际写出的 36 篇里欧洲只有 3 篇，因为撰写顺序先写欠覆盖地区，欧洲计划排在后面，剩余 24 篇（多为欧洲）已核验待写。

各批对比：

| 批次 | 欧洲占比 | 地区分布 |
|---|---|---|
| 3.23 选定 70 篇 | 8.6% | africa 16、americas 16、south-asia 14、southeast-asia 14、oceania 4、europe 6 |
| 3.25 写 41 篇 | 8.7% | africa 16、americas 16、south-asia 14、southeast-asia 14、oceania 3、europe 6 |
| 3.26 写 36 篇 | 0.0% | africa 9、west-central-asia 8、east-asia 7、south-asia 6、americas 5、southeast-asia 1 |
| 3.27 写 34 篇 | 82.4% | southeast-asia 1、oceania 1、europe 28、west-central-asia 4 |
| 3.28 重新选点 60 篇 | 31.7% | africa 8、west-central-asia 9、east-asia 6、south-asia 5、americas 4、southeast-asia 2、oceania 2、europe 19、global 5 |
| 3.28 本轮写 36 篇 | 8.3% | africa 8、west-central-asia 6、east-asia 6、south-asia 5、americas 4、southeast-asia 2、oceania 2、europe 3 |

## 3. 三条引用规则：本轮由构造执行

1. **凡引用外部条目一律从实体反查**：本轮抓取只用**一次 Wikidata 请求**取回每个计划 QID 的 enwiki / zhwiki **sitelink**，再抓这些页面本身，并记录每页的 `pageprops.wikibase_item`。**全程没有按名称搜索**，因此不会出现 3.26 那类"晋朝→消歧义页、齐国→「气」"的错误。
2. **中文导言与英文不符时以英文条目为准**：中文条目同样按 sitelink 取得并核验，本轮 **57 条接受、3 条拒绝**（3 个实体没有中文 sitelink）。
3. **QID 只从实体取、不是政体不写**：候选核验 255 个，通过 225 个、**因不是政体排除 30 个**，另有 22 个登记为缺口。

英文侧核验：**60/60** 的英文条目 pageprops 与政体 QID 一致。

## 4. 注记清洗（固定流程）

手写注记只写附加说明，覆盖句由装配脚本写入；`clean-coverage-notes-3.28.mjs` 作为固定步骤保留，实测**重复 0 条**。

## 5. 规格实测（36 篇）

| 项目 | 实测 | 要求 |
|---|---|---|
| 四栏中文长度 | 51–163 字 | 50–190 |
| 四栏英文长度 | 35–97 词 | 35–150 |
| 英文栏 CJK | 0 | 0 |
| 繁体字 | 0 | 0 |
| https 来源/篇 | 2–2 条 | ≥2 |
| 疆域联系注记 | 36/36 | 每篇 |
| 薄覆盖写明「覆盖很薄…」 | 12 篇（薄覆盖计划 12 个） | 必写 |
| 覆盖句重复 | 0 | 0 |
| 无中文来源（改用英文条目+维基数据实体） | 1 篇 | 允许并记录 |

## 6. 校验

| 命令 | exit |
|---|---|
| `node scripts/validate-v2.mjs` | 0 |
| `node scripts/validate.mjs` | 0 |
| `node scripts/validate-release.mjs` | 0 |
| `node scripts/validate-polity-period.mjs` | 0 |
| `node scripts/places/audit-language.mjs . docs/verification-3.28/narratives-language-audit.json` | 0 |
| `node docs/verification-3.28/build-narratives-batch-3.28.mjs --check` | 0 |
| `node docs/verification-3.28/write-narratives-gz-3.28.mjs --check` | 0 |

`narratives.json.gz`：mtime 字节 0/0/0/0，与 .json deepEqual = true，条目数 337。

## 7. 撰写分片位置

分片在 **`docs/verification-3.28/authoring/part-01..03.json`**（本轮报告目录）；装配脚本从本轮目录读分片、计划与导言，统计也写在本轮目录。

## 8. 仍缺什么

1. **24 篇已核验待写**（本轮选定未完成的部分，多为欧洲）；
2. **1,455 份档案中仍有 1118 份没有叙述**；欧洲的合格候选池已见底，需要先补充可核验的欧洲政体条目；
3. **3 个实体没有中文维基条目**，相关条目以「英文条目 + 维基数据实体」呈现。

## 9. 诚实声明

- 欧洲配额未达标，报告给出可核验的原因（合格池上限 19 篇）与测量方法，不掩饰、不强行凑比例。
- 本轮选定 60 篇完成 36 篇，其余如实登记为待写；没有为凑数降低规格。
- 三条引用规则由流程保证；未跑 `prepare:assets`；除 `public/data/enrichment/narratives.json(+.gz)` 外未改任何 public/ 产品文件，**未触碰 app.js / source-reader.js**。
