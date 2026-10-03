# 政体叙述第十四轮·第一批补记（3.35）：链条补齐 + STEPS 名单

## 1. 补上缺环：`check-bindings-3.35.mjs`

3.35 工具复制时漏带绑定前置自检，**而本批 apply 恰好通过——缺环没有通过失败暴露出来**，是靠比对 3.34 才发现的。现已补上并跑通：

| 环节 | 输出 |
|---|---|
| patch-sourcenames | `{"patched":100,"missing":0}` |
| patch-editorial-sourcenames | `{"unconditionalSet":8,"entries":742}` |
| **check-bindings** | `{"checked":742,"batch":100,"bad":0}` |
| apply / gz / 4 项校验 | 完成；另打印 `VERIFY_OK` |

## 2. 链条自检：STEPS 名单（本轮起随每批报告）

```
STEPS: parse,lengths,gate,clean,build,override,bindings,apply,gz,verify
```

**这一行解决的是「链条完整性 vs 每一环是否有效」的区分**：每一环都可能通过，但**缺环不会报错**。名单让缺环显形，也让后来人一眼看出这一批究竟跑了哪几步。

| 名称 | 对应环节 |
|---|---|
| parse | JSON 解析自检 |
| lengths | 前置检查（字数+繁体+英文栏 CJK+评价性措辞，判据直接读闸门常量） |
| gate | `--check` 按输出内容判定 |
| clean | 注记清洗固定步骤 |
| build | 装配 |
| override | sourceNames 无条件覆盖 |
| bindings | 绑定前置自检 |
| apply | 写入 narratives.json 与绑定解析 |
| gz | gzip 生成（mtime 归零 + deepEqual） |
| verify | 4 项校验（validate-v2 / validate / validate-release / validate-polity-period） |

## 3. 状态

- 叙述 **768 篇**（本轮 **8/100**，余 **92**）；重跑链条为**幂等操作**，条数与绑定记录未变；
- 绑定疆域记录 9,292 条；1,455 份档案中仍有 687 份无叙述；
- 下一批起报告将同时给出 **STEPS 一行** 与 **已写/剩余**。