# 政体叙述第十五轮·第三批（3.36）：876 → 884

本批 8 篇：埃及第十五王朝、埃及第十六王朝、丹吉尔国际区、利比亚、也门民主人民共和国、苏苏王国、桑给巴尔人民共和国、扎伊尔（非洲 8）。

## 结果

- 叙述总数 **876 → 884（本批 +8）**；
- 本轮选定 100 篇，**已写 24 篇，余 76 篇**（**24/76**）；
- 绑定疆域记录 **10,252** 条；1,455 份档案中仍有 571 份无叙述。

## 链条自检

```
STEPS: parse,lengths,gate,clean,build,override,bindings,apply,gz,verify
```

| 环节 | 本批输出 |
|---|---|
| parse | PARSE_OK（8 篇） |
| lengths | 首轮 **1 处**（利比亚 events.en 34）→ 补足 → 清零 |
| gate | **GATE_PASSED** |
| clean / build | cleaned 0；装配完成 |
| override / bindings | patched 100 / missing 0、unconditionalSet 24 / entries 858；**checked 858 / bad 0** |
| apply / gz / verify | 完成；**VERIFY_OK** |

**本批含两个「1 条疆域记录」的最薄条目**（埃及第十五、第十六王朝），按可数判定走结构目标，均达标；唯一 1 处落在**利比亚（rec2）events 栏**，属现代国家事件段，已在起笔规则覆盖范围内——**说明该栏位在极薄素材下仍需按结构目标先写满两个分句**。

## 规格与校验

| 项目 | 实测（本轮已写 24 篇） | 要求 |
|---|---|---|
| 四栏中文长度 | 50–110 字 | 50–190 |
| 四栏英文长度 | 35–90 词 | 35–150 |
| 英文栏 CJK / 繁体字 | **0 / 0** | 0 |
| 疆域联系注记 | 24/24 | 每篇 |
| 覆盖句重复（清洗后） | **0** | 0 |

validate-v2、validate、validate-release、validate-polity-period 30/30、audit-language、build --check、gz --check **全部 exit 0**；narratives.json.gz mtime 字节=0、与 .json deepEqual、**884 条**。未跑 prepare:assets。写作用域：narratives.json(+.gz)、editorial、docs/verification-3.36；未触碰 public/ 下其它文件。

## 进度与池子

- **已写 24 / 余 76**（8 篇一版约 10 批）；
- 池子按脚本口径：本轮写完后约 **95**；**第十六轮开工前必须重跑核验**；**池子余额每次由脚本重算，不做线性外推**。