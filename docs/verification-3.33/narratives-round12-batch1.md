# 政体叙述第十二轮·第一批（3.33）：560 → 568

本批 8 篇：安道尔、芬兰、苏维汇王国、安条克公国、上勃艮第王国、杜勒卡迪尔、卡利亚里王国、汪达尔人（欧洲 8）。

## 结果

- 叙述总数 **560 → 568（本批 +8）**；
- 本轮选定 100 篇，**已写 8 篇，余 92 篇**（总账 **8/92**）；
- 绑定疆域记录 **7,726** 条；1,455 份档案中仍有 887 份无叙述。

## 事故与修复（本批最有价值的部分）

第一次装配在 **apply-enrichment** 处失败：新增条目缺 `sourceNames`，`source.sourceNames.includes(...)` 抛 TypeError。处置链：

1. narratives.json 未被修改（560 篇、gz mtime=0、deepEqual=true）；
2. editorial 被写入的 8 条不完整记录用 `git checkout -- editorial/enrichment-narratives-3.12.json` **恢复**，仓库回到干净状态；
3. 撰写成果（part-01.json 8 篇全文）**保留复用，未重写**；
4. 根因修复：新增 `patch-sourcenames-3.33.mjs`（从 `public/data/fast/catalog.json.gz` 按 `verifiedWikidata` 反查记录名，为 100 个计划注入 `sourceNames`，**100/100 命中、0 缺失**）与 `patch-editorial-sourcenames-3.33.mjs`（装配后回填 editorial 中缺失该字段的条目，本批回填 **8** 条）；
5. 重跑 apply → gz → 4 项校验：**全部 exit 0**，narratives **568** 篇。

## "机制优于小心"对照表（第八行，含结果）

| 经验 | 反例（"小心"） | 机制（"步骤"） | 结果 |
|---|---|---|---|
| 脚本复用 | 按目录名替换生成 3.33 构建脚本 → 丢失 `sourceNames` 注入 → apply 抛错，8 篇白写一轮 | 复用已验证脚本/只改参数；并**从 catalog 反查补齐绑定字段** | 白写 **8 篇 → 0**（撰写成果复用）；绑定字段 100/100 命中；仓库回滚 1 次、产物零污染 |

前七行（判据来源、写入前自检、字数标准、注记清洗、JSON 构造、校验/改动分离、提效方式）不变。

## 五步固定链执行记录

| 顺序 | 步骤 | 结果 |
|---|---|---|
| 1 | JSON 解析自检 | PARSE_OK（8 篇） |
| 2 | 字数检查（阈值=闸门 35/50），清零才放行 | 首轮 7 处 → 补足 → LENGTH_ZERO |
| 3 | `--check` 按输出内容判定 | GATE_PASSED（首次 0 错） |
| 4 | 清洗 → 装配 → apply → gz → 校验 | 清洗 2 处→复跑 0；apply 修复后全部 exit 0 |

## 规格与校验（本轮已写 8 篇）

| 项目 | 实测 | 要求 |
|---|---|---|
| 四栏中文长度 | 50–118 字 | 50–190 |
| 四栏英文长度 | 35–70 词 | 35–150 |
| 英文栏 CJK / 繁体字 | **0 / 0** | 0 |
| 疆域联系注记 | 8/8 | 每篇 |
| 覆盖句重复（清洗后） | **0** | 0 |

validate-v2、validate、validate-release、validate-polity-period 30/30、audit-language、build --check、gz --check **全部 exit 0**；narratives.json.gz mtime 字节=0、与 .json deepEqual、**568 条**。未跑 prepare:assets。写作用域：narratives.json(+.gz)、editorial、docs/verification-3.33；未触碰 public/ 下其它文件。

## 剩余与池子

- 剩余 **92 篇**（导言与身份核验齐备，续写 part-02.json 起，按 8 篇一版约 12 批）；
- 可用池 296，本批写完余 **288**（本轮 100 篇完成后余约 **196**）；第三轮开工前需按核验上限规则重跑选点。