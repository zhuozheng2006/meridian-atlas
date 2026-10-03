# 政体叙述第九批·第二批（3.30b）：397 → 403

承接 task-37 第二批（Lead 指示"继续写余下的 63 篇"）。基线提交 `44109cbe`。

## 结果

- 叙述总数 **397 → 403（本批 +6）**；
- 3.29 选定的 99 篇累计写完 **42 篇**，**余 57 篇已核验待写**；
- 绑定疆域记录 6,311 条；1,455 份档案中仍有 1,052 份无叙述。

本批 6 篇：墨西哥共和国极权政府（americas）、巴巴多斯（americas）、柬埔寨（southeast-asia）、卡斯蒂利亚王国（europe）、奥地利帝国（europe）、斐济（oceania）。

## 规格与流程

| 项目 | 实测 | 要求 |
|---|---|---|
| 四栏中文长度 | 53–156 字 | 50–190 |
| 四栏英文长度 | 35–96 词 | 35–150 |
| 英文栏 CJK / 繁体字 | **0 / 0** | 0 |
| https 来源/篇 | 2 条 | ≥2 |
| 疆域联系注记 | 6/6 | 每篇 |
| 覆盖句重复（清洗后） | **0** | 0 |

- **注记清洗按固定流程已跑**（`clean-coverage-notes-3.30.mjs`）：运行时清掉 **8** 处重复，最终 0。
- **三条引用规则 + 核验上限规则**照用；本批无需新增选点，沿用 3.29 已核验的 99 篇（英文侧 99/99，中文 92 接受 / 7 拒绝）。
- 分片：`docs/verification-3.30/authoring/part-03.json`（第一批 12 篇）、`part-04.json`（本批 6 篇）。

## 校验

validate-v2、validate、validate-release、validate-polity-period 30/30、audit-language、build --check、gz --check **全部 exit 0**；`narratives.json.gz` mtime 字节 = 0，与 .json deepEqual，**403 条**。未跑 `prepare:assets`。

## 写作用域

只写 narratives.json(+.gz)、editorial 批次文件与 `docs/verification-3.30/`；**未触碰** app.js / source-reader.js / atrocities.js / style.css / index.html（按 Lead 澄清：冲突时以任务写作用域为准）。

## 仍缺什么

1. **57 篇已核验待写**（导言按 sitelink 取好，可直接撰写，不必重跑选点与核验）；
2. **1,455 份档案中仍有 1,052 份没有叙述**；欧洲全量核查仍有 369 份合格政体可供后续批次；
3. 分片继续放在 `docs/verification-3.30/authoring/`，下一批可直接续写 `part-05.json`。

## 诚实声明

- 本批只写 6 篇（上一批发 12 篇），**未把未完成部分说成完成**；
- 没有为凑数降低规格；三条引用规则与核验上限规则照用；注记清洗每轮必跑。
