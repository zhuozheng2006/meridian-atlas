# 政体叙述第十二轮·第二批（3.33b）：568 → 576

本批 8 篇：梅克伦堡公国、巴登大公国、德尼亚泰法、布列塔尼王国、加卢拉王国、卡普阿公国、穆尔西亚泰法、基辅公国（欧洲 8）。

## 结果

- 叙述总数 **568 → 576（本批 +8）**；
- 本轮选定 100 篇，**已写 16 篇，余 84 篇**（总账 **16/84**）；
- 绑定疆域记录 **7,838** 条；1,455 份档案中仍有 879 份无叙述。

## 新机制生效：字段注入成为装配链的固定环节

上一批的失败（`sourceNames` 缺失）本批未再出现——装配链已固定为：

**JSON 自检 → 字数清零 → `--check` 按输出内容 → 清洗 → 装配 → `patch-editorial-sourcenames`（固定步骤）→ apply → gz → 4 项校验**

本批 `patch-editorial-sourcenames` 自动回填 **8** 条（累计 16 条），apply 一次通过。**这一步现在是链条的一部分，而不是事后救火。**

## 五步固定链执行记录

| 顺序 | 步骤 | 结果 |
|---|---|---|
| 1 | JSON 解析自检 | PARSE_OK（8 篇） |
| 2 | 字数检查（阈值=闸门 35/50） | 首轮 5 处 → 补足 → LENGTH_ZERO |
| 3 | `--check` 按输出内容判定 | GATE_PASSED（首次 0 错） |
| 4 | 清洗 → 装配 → sourceNames 补丁 → apply → gz → 校验 | 清洗 2 处→复跑 0；apply 通过；4 项校验 exit 0 |

## 规格与校验（本轮已写 16 篇）

| 项目 | 实测 | 要求 |
|---|---|---|
| 四栏中文长度 | 50–118 字 | 50–190 |
| 四栏英文长度 | 35–70 词 | 35–150 |
| 英文栏 CJK / 繁体字 | **0 / 0** | 0 |
| 疆域联系注记 | 16/16 | 每篇 |
| 覆盖句重复（清洗后） | **0** | 0 |

validate-v2、validate、validate-release、validate-polity-period 30/30、audit-language、build --check、gz --check **全部 exit 0**；narratives.json.gz mtime 字节=0、与 .json deepEqual、**576 条**。未跑 prepare:assets。写作用域：narratives.json(+.gz)、editorial、docs/verification-3.33；未触碰 public/ 下其它文件。

## 剩余与池子

- 剩余 **84 篇**（续写 part-03.json 起，8 篇一版约 11 批）；
- 可用池 296 → 本批后 **280**（本轮完成后约 **196**）；第三轮开工前需按核验上限规则重跑选点。