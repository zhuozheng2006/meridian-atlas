# 政体叙述第九批·第一批（3.30）：385 → 397

任务 task-37（可分两批交付，**本报告为第一批**）。基线提交 `44109cbe`。

**结论**：政体叙述 **385 → 397 篇（本批 +12）**；3.29 选定的 99 篇累计写完 **36 篇**，**余 63 篇已核验待写**。绑定疆域记录 6,258 条。

## 1. 本批地区分布与规格

本批 12 篇分布：south-asia 8、americas 4。

| 项目 | 实测 | 要求 |
|---|---|---|
| 四栏中文长度 | 55–156 字 | 50–190 |
| 四栏英文长度 | 35–96 词 | 35–150 |
| 英文栏 CJK / 繁体字 | 0 / 0 | 0 |
| https 来源/篇 | 2–2 条 | ≥2 |
| 疆域联系注记 | 12/12 | 每篇 |
| 薄覆盖写明「覆盖很薄…」 | 4 篇 | 必写 |
| 覆盖句重复（清洗后） | **0** | 0 |
| 无中文来源 | 0 篇 | 允许并记录 |

注记清洗按固定流程执行（`clean-coverage-notes-3.30.mjs`），运行时清掉 **8** 处重复。

## 2. 引用规则与核验上限

本批**不需要新增选点**：撰写的是 3.29 已选定并核验的计划，因此沿用该轮的上限（**欧洲 200**，共核验候选 **680** 个、通过政体类别 **619** 个）。三条引用规则照旧：

1. 外部条目**一律从实体反查**（Wikidata sitelink / pageprops），不按名称搜索；
2. **中文导言与英文条目不符时以英文条目为准**，中文引用仅在 pageprops 与 QID 一致时保留（本批所依据的 99 篇中 **92 接受 / 7 拒绝**）；
3. QID 只从 catalog `verifiedWikidata` 与 pageprops 取；不是政体的实体不写、登记为缺口。

并沿用上轮确立的**核验上限规则**：凡"某地区已无候选"，必须写明该轮核验上限并放宽后重跑。本批英文侧核验 **99/99**。

## 3. 校验

| 命令 | exit |
|---|---|
| `node scripts/validate-v2.mjs` | 0 |
| `node scripts/validate.mjs` | 0 |
| `node scripts/validate-release.mjs` | 0 |
| `node scripts/validate-polity-period.mjs` | 0 |
| `node scripts/places/audit-language.mjs . docs/verification-3.30/narratives-language-audit.json` | 0 |
| `node docs/verification-3.30/build-narratives-batch-3.30.mjs --check` | 0 |
| `node docs/verification-3.30/write-narratives-gz-3.30.mjs --check` | 0 |

`narratives.json.gz`：mtime 字节 0/0/0/0，deepEqual = true，条目数 397。

## 4. 写作用域

本批只写：narratives.json(+.gz)、editorial 批次文件、`docs/verification-3.30/`；**未触碰** app.js / source-reader.js / atrocities.js / style.css / index.html。

## 5. 仍缺什么

1. **余 63 篇已核验待写**（3.29 选定、身份核验与导言齐备），可作第二批直接撰写；
2. **1,455 份档案中仍有 1082 份没有叙述**；欧洲已核验的合格池仍有富余（全量核查 369 份）；
3. 分片位置：`docs/verification-3.30/authoring/part-03.json`（本批），后续批次继续放在本轮目录。

## 6. 诚实声明

- 本批按"分批交付"执行：写完 12 篇即装配、校验并报告，**未把未完成部分说成完成**；
- 没有为凑数降低规格；三条引用规则与核验上限规则均照用；
- 未跑 `prepare:assets`。
