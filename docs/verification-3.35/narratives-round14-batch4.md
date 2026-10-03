# 政体叙述第十四轮·第四批（3.35）：784 → 792

本批 8 篇：伽珊王国、达布依王朝、阿努什特金王朝、雅鲁布王朝、前秦、后黎朝、南明、北元（西亚 4、东亚 4）。

## 结果

- 叙述总数 **784 → 792（本批 +8）**；
- 本轮选定 100 篇，**已写 32 篇，余 68 篇**（**32/68**）；
- 绑定疆域记录 **9,484** 条；1,455 份档案中仍有 663 份无叙述。

## 链条自检

```
STEPS: parse,lengths,gate,clean,build,override,bindings,apply,gz,verify
```

| 环节 | 本批输出 |
|---|---|
| parse | PARSE_OK（8 篇） |
| lengths | 首轮 **2 处**（culture.en 字数）→ 补足 → 清零 |
| gate | **GATE_PASSED** |
| clean | cleaned 0 |
| build | 完成 |
| override | patched 100 / missing 0；unconditionalSet 32 / entries 766 |
| bindings | **checked 766 / bad 0** |
| apply / gz / verify | 完成；**VERIFY_OK** |

**本批回到 2 处**（此前连续三批为 0）：两处均落在 **culture 栏**，均为**古代伊朗系王朝**（达布依、阿努什特金）——即 3.34 第八批记录过的「古代王朝经济/文化段」组合里**文化段**的一侧。**起笔规则已覆盖该栏**，但本批两组新组合（琐罗亚斯德教山地王朝、突厥花剌子模王朝）的素材较薄，说明**规则的覆盖面足够、素材厚度不足**。修法：此类条目起笔时文化段**先写满两个分句再收尾**，不以「够门槛」为目标。

## 规格与校验

| 项目 | 实测（本轮已写 32 篇） | 要求 |
|---|---|---|
| 四栏中文长度 | 50–110 字 | 50–190 |
| 四栏英文长度 | 35–90 词 | 35–150 |
| 英文栏 CJK / 繁体字 | **0 / 0** | 0 |
| 疆域联系注记 | 32/32 | 每篇 |
| 覆盖句重复（清洗后） | **0** | 0 |

validate-v2、validate、validate-release、validate-polity-period 30/30、audit-language、build --check、gz --check **全部 exit 0**；narratives.json.gz mtime 字节=0、与 .json deepEqual、**792 条**。未跑 prepare:assets。写作用域：narratives.json(+.gz)、editorial、docs/verification-3.35；未触碰 public/ 下其它文件。

## 进度与池子

- **已写 32 / 余 68**（按 8 篇一版约 9 批）；
- 本轮写完后剩余可用池 **约 137**（欧洲约 71、非洲约 21、南亚约 10、东亚约 10、西亚约 9、跨区约 11、美洲约 4、东南亚约 1、大洋洲 0）；
- **第十五轮仍可支撑 100 篇**；**第十六轮开工前必须再次重跑核验**。