# 政体叙述第十五轮·第二批（3.36）：868 → 876

本批 8 篇：安哥拉、多哥、刚果共和国、也门、南苏丹、塔希尔王朝、德属喀麦隆、埃及第十七王朝（非洲 8）。

## 结果

- 叙述总数 **868 → 876（本批 +8）**；
- 本轮选定 100 篇，**已写 16 篇，余 84 篇**（**16/84**）；
- 绑定疆域记录 **10,188** 条；1,455 份档案中仍有 579 份无叙述。

## 链条自检

```
STEPS: parse,lengths,gate,clean,build,override,bindings,apply,gz,verify
```

| 环节 | 本批输出 |
|---|---|
| parse / lengths / gate | PARSE_OK；**首轮 0 处**；**GATE_PASSED** |
| clean / build | cleaned 0；装配完成 |
| override / bindings | patched 100 / missing 0、unconditionalSet 16 / entries 850；**checked 850 / bad 0** |
| apply / gz / verify | 完成；**VERIFY_OK** |

**连续两批首轮 0 处**。本批含**最薄素材**（埃及第十七王朝仅 1 条疆域记录，也门、塔希尔王朝等仅 2 条），按**可数判定 → 结构目标**起笔，全部达标。

## 规格与校验

| 项目 | 实测（本轮已写 16 篇） | 要求 |
|---|---|---|
| 四栏中文长度 | 50–110 字 | 50–190 |
| 四栏英文长度 | 35–90 词 | 35–150 |
| 英文栏 CJK / 繁体字 | **0 / 0** | 0 |
| 疆域联系注记 | 16/16 | 每篇 |
| 覆盖句重复（清洗后） | **0** | 0 |

validate-v2、validate、validate-release、validate-polity-period 30/30、audit-language、build --check、gz --check **全部 exit 0**；narratives.json.gz mtime 字节=0、与 .json deepEqual、**876 条**。未跑 prepare:assets。写作用域：narratives.json(+.gz)、editorial、docs/verification-3.36；未触碰 public/ 下其它文件。

## 进度与池子

- **已写 16 / 余 84**（8 篇一版约 11 批）；
- 池子按脚本口径：本轮写完后约 **95**（欧洲 49、非洲 11、西亚 9、东亚 6、南亚 4、跨区 11、美洲 4、东南亚 1、大洋洲 0）；
- **第十六轮开工前必须重跑核验**（确认东亚/南亚/非洲是否假见底并校准配额）；**池子余额每次由脚本重算，不做线性外推**。