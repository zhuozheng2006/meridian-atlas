# 政体叙述第十四轮·第三批（3.35）：776 → 784

本批 8 篇：圣多美和普林西比、埃及第二十二王朝、埃及第二十三王朝、几内亚、赞德王朝、大夏、阿拉菲德王朝、巴列维王朝（非洲 4、西亚 4）。

## 结果

- 叙述总数 **776 → 784（本批 +8）**；
- 本轮选定 100 篇，**已写 24 篇，余 76 篇**（**24/76**）；
- 绑定疆域记录 **9,420** 条；1,455 份档案中仍有 671 份无叙述。

## 链条自检

```
STEPS: parse,lengths,gate,clean,build,override,bindings,apply,gz,verify
```

| 环节 | 本批输出 |
|---|---|
| parse | PARSE_OK（8 篇） |
| lengths | **首轮 0 处** |
| gate | **GATE_PASSED** |
| clean | cleaned 0 |
| build | 完成 |
| override | patched 100 / missing 0；unconditionalSet 24 / entries 758 |
| bindings | **checked 758 / bad 0** |
| apply | 完成 |
| gz | jsonBytes 已更新 |
| verify | **VERIFY_OK** |

**连续三批首轮 0 处** —— 起笔规则（现代国家关键节点段、古代王朝经济/文化段、现代非洲国家关键节点段）与前置换行检查共同作用下，混合批次不再产生集中缺陷。

## 规格与校验

| 项目 | 实测（本轮已写 24 篇） | 要求 |
|---|---|---|
| 四栏中文长度 | 50–110 字 | 50–190 |
| 四栏英文长度 | 35–90 词 | 35–150 |
| 英文栏 CJK / 繁体字 | **0 / 0** | 0 |
| 疆域联系注记 | 24/24 | 每篇 |
| 覆盖句重复（清洗后） | **0** | 0 |

validate-v2、validate、validate-release、validate-polity-period 30/30、audit-language、build --check、gz --check **全部 exit 0**；narratives.json.gz mtime 字节=0、与 .json deepEqual、**784 条**。未跑 prepare:assets。写作用域：narratives.json(+.gz)、editorial、docs/verification-3.35；未触碰 public/ 下其它文件。

## 进度与池子

- **已写 24 / 余 76**（按 8 篇一版约 10 批）；
- 本轮写完后剩余可用池 **约 137**（欧洲约 71、非洲约 21、南亚约 10、东亚约 10、西亚约 9、跨区约 11、美洲约 4、东南亚约 1、大洋洲 0）；
- **第十五轮仍可支撑 100 篇**；**第十六轮开工前必须再次重跑核验**。