# 政体叙述第十四轮·第十批（3.35）：832 → 840

本批 8 篇：南斯拉夫社会主义联邦共和国、阿拉贡伯国、西奥多罗公国、德国、青帐汗国、保加利亚、科马基尼王国、埃塞克斯王国（欧洲 8）。

## 结果

- 叙述总数 **832 → 840（本批 +8）**；
- 本轮选定 100 篇，**已写 80 篇，余 20 篇**（**80/20**）；
- 绑定疆域记录 **9,868** 条；1,455 份档案中仍有 615 份无叙述。

## 边界带默认选择：连续两批 0 处

本批纪录数为 **rec2–rec5**，与上一批同属边界带，仍统一按结构目标起笔：

| 批次 | 素材区间 | 采用目标 | 首轮问题 |
|---|---|---|---|
| 第七批 | 含 rec6 中等素材 | 字数目标（误用） | 1 |
| 第八批 | rec3–rec8 | 按 rec 分流 | **0** |
| 第九批 | rec2–rec5 | 统一结构目标 | **0** |
| **第十批** | **rec2–rec5** | **统一结构目标** | **0** |

**「不确定时按结构目标起笔」在边界带连续两批（16 篇）零问题**，而第七批同一区间误用字数目标时是 1 处。规则无需再调整。

## 链条自检

```
STEPS: parse,lengths,gate,clean,build,override,bindings,apply,gz,verify
```

| 环节 | 本批输出 |
|---|---|
| parse / lengths / gate | PARSE_OK；**首轮 0 处**；**GATE_PASSED** |
| clean / build | cleaned 0；装配完成 |
| override / bindings | patched 100 / missing 0、unconditionalSet 80 / entries 814；**checked 814 / bad 0** |
| apply / gz / verify | 完成；**VERIFY_OK** |

## 规格与校验

| 项目 | 实测（本轮已写 80 篇） | 要求 |
|---|---|---|
| 四栏中文长度 | 50–110 字 | 50–190 |
| 四栏英文长度 | 35–90 词 | 35–150 |
| 英文栏 CJK / 繁体字 | **0 / 0** | 0 |
| 疆域联系注记 | 80/80 | 每篇 |
| 覆盖句重复（清洗后） | **0** | 0 |

validate-v2、validate、validate-release、validate-polity-period 30/30、audit-language、build --check、gz --check **全部 exit 0**；narratives.json.gz mtime 字节=0、与 .json deepEqual、**840 条**。未跑 prepare:assets。写作用域：narratives.json(+.gz)、editorial、docs/verification-3.35；未触碰 public/ 下其它文件。

## 进度与池子

- **已写 80 / 余 20**（8 篇 + 8 篇 + 4 篇三批收口）；
- 本轮写完后剩余可用池 **约 137**（欧洲约 71、非洲约 21、南亚约 10、东亚约 10、西亚约 9、跨区约 11、美洲约 4、东南亚约 1、大洋洲 0）；
- **第十五轮仍可支撑 100 篇**；**第十六轮开工前必须再次重跑核验**。