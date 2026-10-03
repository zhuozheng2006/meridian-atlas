# 政体叙述第十五轮·第四批（3.36）：884 → 892

本批 8 篇：斯瓦涅季公国、萨尔巴达尔、卡西姆汗国、哈萨克斯坦、塔吉克斯坦、科尔基斯、高加索伊玛目国、伊比利亚王公国（西亚 8）。

## 结果

- 叙述总数 **884 → 892（本批 +8）**；
- 本轮选定 100 篇，**已写 32 篇，余 68 篇**（**32/68**）；
- 绑定疆域记录 **10,316** 条；1,455 份档案中仍有 563 份无叙述。

## 规则可叠加（按 Lead 要求写入规范，并给出本批数字）

> **规则可叠加**：「现代国家 → 事件段」与「薄素材 → 结构目标」同时成立时，**后者优先**——事件段也要先写满两个分句。

本批即按叠加规则执行：8 篇中 6 篇为 3–5 条疆域记录的薄素材（含现代国家哈萨克斯坦、塔吉克斯坦），**四栏一律先写满两个分句再收尾**，结果：

| 批次 | 事件段缺陷 | 说明 |
|---|---|---|
| 第三批（未叠加） | **1 处**（利比亚 rec2 events.en） | 现代国家规则已覆盖该栏，但薄素材下仍偏短 |
| **第四批（已叠加）** | **0 处** | 事件段按结构目标先写满两个分句 |

**与既往同源：不是规则错了，而是出现了既有规则的组合情形。**

## 链条自检

```
STEPS: parse,lengths,gate,clean,build,override,bindings,apply,gz,verify
```

| 环节 | 本批输出 |
|---|---|
| parse / lengths / gate | PARSE_OK；**首轮 0 处**；**GATE_PASSED** |
| clean / build | cleaned 0；装配完成 |
| override / bindings | patched 100 / missing 0、unconditionalSet 32 / entries 866；**checked 866 / bad 0** |
| apply / gz / verify | 完成；**VERIFY_OK** |

## 规格与校验

| 项目 | 实测（本轮已写 32 篇） | 要求 |
|---|---|---|
| 四栏中文长度 | 50–110 字 | 50–190 |
| 四栏英文长度 | 35–90 词 | 35–150 |
| 英文栏 CJK / 繁体字 | **0 / 0** | 0 |
| 疆域联系注记 | 32/32 | 每篇 |
| 覆盖句重复（清洗后） | **0** | 0 |

validate-v2、validate、validate-release、validate-polity-period 30/30、audit-language、build --check、gz --check **全部 exit 0**；narratives.json.gz mtime 字节=0、与 .json deepEqual、**892 条**。未跑 prepare:assets。写作用域：narratives.json(+.gz)、editorial、docs/verification-3.36；未触碰 public/ 下其它文件。

## 进度与池子

- **已写 32 / 余 68**（8 篇一版约 9 批）；
- 池子按脚本口径：本轮写完后约 **95**；**第十六轮开工前必须重跑核验**；**池子余额每次由脚本重算，不做线性外推**。