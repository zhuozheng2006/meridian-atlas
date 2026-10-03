# 政体叙述第十四轮·第二批（3.35）：768 → 776

本批 8 篇：马里联邦、布隆迪、吉布提、叙利亚共和国、津巴布韦、赤道几内亚、几内亚比绍、莫桑比克（非洲 8）。

## 结果

- 叙述总数 **768 → 776（本批 +8）**；
- 本轮选定 100 篇，**已写 16 篇，余 84 篇**（**16/84**）；
- 绑定疆域记录 **9,356** 条；1,455 份档案中仍有 679 份无叙述。

## 链条自检（本轮起每批随报）

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
| override | `{"patched":100,"missing":0}`、`{"unconditionalSet":16,"entries":750}` |
| bindings | `{"checked":750,"batch":100,"bad":0}` |
| apply | 完成 |
| gz | `jsonBytes` 已更新 |
| verify | **VERIFY_OK**（4 项校验全绿） |

**十环齐全且十环均有输出**——这正是补环后要维持的状态：缺环会在这份名单里显形，而不是靠「偶然通过」掩盖。

## 规格与校验

| 项目 | 实测（本轮已写 16 篇） | 要求 |
|---|---|---|
| 四栏中文长度 | 50–110 字 | 50–190 |
| 四栏英文长度 | 35–90 词 | 35–150 |
| 英文栏 CJK / 繁体字 | **0 / 0** | 0 |
| 疆域联系注记 | 16/16 | 每篇 |
| 覆盖句重复（清洗后） | **0** | 0 |

validate-v2、validate、validate-release、validate-polity-period 30/30、audit-language、build --check、gz --check **全部 exit 0**；narratives.json.gz mtime 字节=0、与 .json deepEqual、**776 条**。未跑 prepare:assets。写作用域：narratives.json(+.gz)、editorial、docs/verification-3.35；未触碰 public/ 下其它文件。

## 进度与下一轮池子

- **已写 16 / 余 84**；按 8 篇一版约 11 批；
- 本轮写完后剩余可用池 **约 137**（欧洲约 71、非洲约 21、南亚约 10、东亚约 10、西亚约 9、跨区约 11、美洲约 4、东南亚约 1、大洋洲 0）；
- **第十五轮仍可支撑 100 篇**；**第十六轮开工前必须再次重跑核验**。