# 政体叙述第十四轮·第七批（3.35）：808 → 816

本批 8 篇：拘萨罗、诃黎王朝、布拉班特伯国、萨克森-魏玛-艾森纳赫、帕加马王国、德意志邦联、利珀亲王国、奥兰治亲王国（南亚 2、欧洲 6）。

## 结果

- 叙述总数 **808 → 816（本批 +8）**；
- 本轮选定 100 篇，**已写 56 篇，余 44 篇**（**56/44**）；
- 绑定疆域记录 **9,676** 条；1,455 份档案中仍有 639 份无叙述。

## 链条自检

```
STEPS: parse,lengths,gate,clean,build,override,bindings,apply,gz,verify
```

| 环节 | 本批输出 |
|---|---|
| parse | PARSE_OK（8 篇） |
| lengths | 首轮 **1 处**（利珀亲王国 culture.en 32）→ 补足 → 清零 |
| gate | **GATE_PASSED** |
| clean / build | cleaned 0；装配完成 |
| override / bindings | patched 100 / missing 0、unconditionalSet 56 / entries 790；**checked 790 / bad 0** |
| apply / gz / verify | 完成；**VERIFY_OK** |

**本批是结构目标与字数目标的分界样本**：8 篇中 **6 篇为欧洲中等素材邦国**（布拉班特、萨克森-魏玛-艾森纳赫、帕加马、德意志邦联、利珀、奥兰治），1 处缺陷落在 **利珀（素材最薄的那个）**、且落在 culture 栏——与第四批同型。**中等偏薄素材仍需结构目标**，本批对利珀使用了字数目标，即时被前置检查拦下。

## 规格与校验

| 项目 | 实测（本轮已写 56 篇） | 要求 |
|---|---|---|
| 四栏中文长度 | 50–110 字 | 50–190 |
| 四栏英文长度 | 35–90 词 | 35–150 |
| 英文栏 CJK / 繁体字 | **0 / 0** | 0 |
| 疆域联系注记 | 56/56 | 每篇 |
| 覆盖句重复（清洗后） | **0** | 0 |

validate-v2、validate、validate-release、validate-polity-period 30/30、audit-language、build --check、gz --check **全部 exit 0**；narratives.json.gz mtime 字节=0、与 .json deepEqual、**816 条**。未跑 prepare:assets。写作用域：narratives.json(+.gz)、editorial、docs/verification-3.35；未触碰 public/ 下其它文件。

## 进度与池子

- **已写 56 / 余 44**（按 8 篇一版约 6 批）；
- 本轮写完后剩余可用池 **约 137**（欧洲约 71、非洲约 21、南亚约 10、东亚约 10、西亚约 9、跨区约 11、美洲约 4、东南亚约 1、大洋洲 0）；
- **第十五轮仍可支撑 100 篇**；**第十六轮开工前必须再次重跑核验**。