# 政体叙述第十批（3.31）：403 → 409

任务 task-38。

**结论**：叙述 **403 → 409**（本批 +18）。本批 6 篇：汤都王国、森美兰、北大年苏丹国、巴布亚新几内亚、戈瓦苏丹国、淡目国。绑定疆域记录 6,330 条。

## 1. 3.29 选定 99 篇的总账（应 Lead 要求）

| 项目 | 数值 |
|---|---|
| 选定计划 | **99** |
| 各地区 | africa 15、west-central-asia 8、east-asia 8、south-asia 8、americas 6、southeast-asia 4、oceania 4、europe 46 |
| **欧洲占比** | **46.5%（目标 40%–50%，**达标**） |
| 本轮核验上限 | 欧洲 200；共核验候选 680 |
| 通过政体类别 | 619 |
| **身份规则排除**（不是政体） | **61** 个候选；另登记 **44** 个缺口 |
| 英文条目核验 | 99/99（pageprops 与 QID 一致） |
| **中文引用被拒** | **7** 条（接受 92） |
| 已写 / 待写 | **48 / 51** |

各批条数：第八轮（3.29） 24 篇；第九批第一批（3.30） 6 篇；第九批第二批（3.30b） 18 篇。

已写 48 篇的地区分布：africa 8、west-central-asia 8、east-asia 8、americas 6、southeast-asia 4、oceania 4、europe 2、south-asia 8。

## 2. 规格（已写的 48 篇合计）

| 项目 | 实测 | 要求 |
|---|---|---|
| 四栏中文长度 | 50–156 字 | 50–190 |
| 四栏英文长度 | 35–96 词 | 35–150 |
| 英文栏 CJK / 繁体字 | 0 / 0 | 0 |
| 疆域联系注记 | 48/48 | 每篇 |
| 覆盖句重复（注记清洗每轮必跑） | 0 | 0 |

## 3. 校验

| 命令 | exit |
|---|---|
| `node scripts/validate-v2.mjs` | 0 |
| `node scripts/validate.mjs` | 0 |
| `node scripts/validate-release.mjs` | 0 |
| `node scripts/validate-polity-period.mjs` | 0 |
| `node scripts/places/audit-language.mjs . docs/verification-3.31/narratives-language-audit.json` | 0 |
| `node docs/verification-3.30/build-narratives-batch-3.30.mjs --check` | 0 |
| `node docs/verification-3.30/write-narratives-gz-3.30.mjs --check` | 0 |

`narratives.json.gz`：mtime 字节 0/0/0/0，deepEqual = true，条目数 409。

## 4. 仍缺什么

1. **51 篇已核验待写**（3.29 选定中未完成部分），导言与身份核验齐备，可续写 `docs/verification-3.30/authoring/part-06.json`；
2. **1,455 份档案中仍有 1046 份没有叙述**；欧洲全量核查（369 份合格政体）仍有余量；
3. 本批分片写在 `docs/verification-3.30/authoring/part-05.json`（沿用上一轮目录，因为装配脚本读该目录；下一批可迁至本轮目录并同步改脚本路径）。

## 5. 诚实声明

- 本批只写 6 篇，**未把未完成部分说成完成**；
- 三条引用规则、核验上限规则与注记清洗固定流程均照用；
- 未跑 `prepare:assets`；只写 narratives.json(+.gz)、editorial 与 docs，未触碰 5 个 UI 文件。
