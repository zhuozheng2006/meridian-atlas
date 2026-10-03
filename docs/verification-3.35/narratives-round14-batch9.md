# 政体叙述第十四轮·第九批（3.35）：824 → 832

本批 8 篇：吕贝克自由市、埃德萨伯国、赫威赛、塞尔维亚和黑山、塔巴尔、塞尔维亚专制国、两西西里王国、阿尔瓦拉辛泰法（欧洲 8）。

## 结果

- 叙述总数 **824 → 832（本批 +8）**；
- 本轮选定 100 篇，**已写 72 篇，余 28 篇**（**72/28**）；
- 绑定疆域记录 **9,804** 条；1,455 份档案中仍有 623 份无叙述。

## 判定规则（可数信号）的第二次验证

本批 8 篇的纪录数区间为 **rec2–rec5**，即**全部落在「2–3 或 4–5」的边界带**，按规则统一采用**结构目标**：

| 批次 | 素材区间 | 采用目标 | 首轮问题 |
|---|---|---|---|
| 第七批 | 中等（含 rec6 利珀） | 字数目标（误用） | 1 |
| 第八批 | rec3–rec8 混合 | 按 rec 分流 | **0** |
| **第九批** | **rec2–rec5（全在边界带）** | **统一结构目标** | **0** |

**边界带条目一律走结构目标**（与「不确定时按结构目标起笔」一致），本批 0 处。

## 链条自检

```
STEPS: parse,lengths,gate,clean,build,override,bindings,apply,gz,verify
```

| 环节 | 本批输出 |
|---|---|
| parse / lengths / gate | PARSE_OK；**首轮 0 处**；**GATE_PASSED** |
| clean / build | cleaned 0；装配完成 |
| override / bindings | patched 100 / missing 0、unconditionalSet 72 / entries 806；**checked 806 / bad 0** |
| apply / gz / verify | 完成；**VERIFY_OK** |

## 规格与校验

| 项目 | 实测（本轮已写 72 篇） | 要求 |
|---|---|---|
| 四栏中文长度 | 50–110 字 | 50–190 |
| 四栏英文长度 | 35–90 词 | 35–150 |
| 英文栏 CJK / 繁体字 | **0 / 0** | 0 |
| 疆域联系注记 | 72/72 | 每篇 |
| 覆盖句重复（清洗后） | **0** | 0 |

validate-v2、validate、validate-release、validate-polity-period 30/30、audit-language、build --check、gz --check **全部 exit 0**；narratives.json.gz mtime 字节=0、与 .json deepEqual、**832 条**。未跑 prepare:assets。写作用域：narratives.json(+.gz)、editorial、docs/verification-3.35；未触碰 public/ 下其它文件。

## 进度与池子

- **已写 72 / 余 28**（按 8 篇一版：3 批 + 1 批 4 篇收口）；
- 本轮写完后剩余可用池 **约 137**（欧洲约 71、非洲约 21、南亚约 10、东亚约 10、西亚约 9、跨区约 11、美洲约 4、东南亚约 1、大洋洲 0）；
- **第十五轮仍可支撑 100 篇**；**第十六轮开工前必须再次重跑核验**。