# 交接文件（PAUSE-HANDOFF）——政体叙述第十五轮（docs/verification-3.36）

暂停时点：**叙述 892 篇**，本轮 3.36 **已写 32 / 剩余 68**；全部已提交，npm test 全绿，7 项校验 exit 0。

---

## 1. 已写 / 剩余，以及余下 68 篇的素材位置

| 项目 | 数值 |
|---|---|
| 本轮已写 | **32 / 100** |
| **剩余** | **68 篇** |
| 已交付批次 | `part-01.json` ~ `part-04.json`（各 8 篇） |
| **下一批起点** | **`docs/verification-3.36/authoring/part-05.json`** |
| 计划节奏 | 8 篇一版，约 **9 批**（8×8 + 4） |

**素材位置（余下 68 篇的计划与导言已全部就绪，无需重新取数）**：

| 文件 | 内容 |
|---|---|
| `docs/verification-3.36/narratives-extracts.json` | **100 篇计划的英文导言 + 中文判定 + region + recordCount + thin 标记**（本轮全部素材已在此） |
| `docs/verification-3.36/narratives-chosen.json` | 本轮选点结果（100 条，含地区与评分） |
| `docs/verification-3.36/narratives-batch-stats.json` | 已写 32 篇的 qid 名单与 `pendingCount` |

**取下一批计划的命令**（自动排除已写）：

```bash
node -e 'const fs=require("fs");const st=JSON.parse(fs.readFileSync("docs/verification-3.36/narratives-batch-stats.json","utf8"));const done=new Set(st.entries.map(r=>r.qid));const ex=JSON.parse(fs.readFileSync("docs/verification-3.36/narratives-extracts.json","utf8"));for(const e of ex.entries.filter(x=>!done.has(x.qid)).slice(0,8))console.log(e.qid,e.titleZh||"(no zh)",e.titleEn,"["+e.region+"] rec"+e.recordCount,"thin:"+e.thin)'
```

**已写 32 篇的四批**：

| 批次 | 条目 |
|---|---|
| part-01 | 乍得、埃及第三十王朝、祖拉伊王朝、马西纳帝国、埃及赫迪夫领、图伦王朝、马吉尔廷苏丹国、北塞浦路斯土耳其共和国 |
| part-02 | 安哥拉、多哥、刚果共和国、也门、南苏丹、塔希尔王朝、德属喀麦隆、埃及第十七王朝 |
| part-03 | 埃及第十五王朝、埃及第十六王朝、丹吉尔国际区、利比亚、也门民主人民共和国、苏苏王国、桑给巴尔人民共和国、扎伊尔 |
| part-04 | 斯瓦涅季公国、萨尔巴达尔、卡西姆汗国、哈萨克斯坦、塔吉克斯坦、科尔基斯、高加索伊玛目国、伊比利亚王公国 |

---

## 2. 池子数字（脚本口径）与第十六轮开工前必做事项

**脚本口径（禁止线性外推）**：

| 时点 | 可用量 | 说明 |
|---|---|---|
| 本轮开工前 | **175** | 按 3.35 重跑核验的 **580 条通过量**减去当时已写篇数逐条比对 |
| **本轮写完后** | **约 95** | 欧洲 49、非洲 11、西亚 9、东亚 6、南亚 4、跨区 11、美洲 4、东南亚 1、大洋洲 0 |

> **铁律：池子余额每次由脚本重算。** 线性外推的基数会过期，而**「新增通过核验的候选」不会出现在外推里**（本轮旧估 137/37 与实际 175/95 的差异即由此产生）。

**第十六轮开工前必须做（已两次出现「假见底」：战役池 23→841、欧洲上限 19→369）**：

1. **重跑核验并提高上限**——确认 **东亚（6）、南亚（4）、非洲（11）** 是否**假见底**；
2. **按可用量校准地区配额**——避免第十六轮被动集中在欧洲（届时欧洲 49 占比过高）；
3. **美洲 4 / 东南亚 1 / 大洋洲 0 按真见底处理**，不强凑；
4. 池子真正用尽时**如实报告「可用候选已用尽」**，不制造内容——595 份无叙述档案中相当部分是**未通过政体身份核验的实体**，这个数字本身就是诚实的答案。

**本轮地区构成**：欧洲 46、非洲 24、南亚 12、东亚 10、西亚 8（**欧洲 46.0%**，40%–50% 达标）；地区构成的变化是**由池子结构决定的有意选择，不是漂移**。

---

## 3. 可复用的方法清单

### 3.1 十环链（每批执行，**每批随报告打印名单与各环输出**）

```
STEPS: parse,lengths,gate,clean,build,override,bindings,apply,gz,verify
```

| 名称 | 环节 | 要点 |
|---|---|---|
| parse | JSON 解析自检 | 写入后立即 `JSON.parse`，失败即停 |
| lengths | 前置检查（四类） | 字数 + 繁体字 + 英文栏 CJK + 评价性措辞；**判据直接读闸门脚本常量** |
| gate | `--check` | **按输出内容判定**（`case "$OUT" in *FAIL*`），不可只看退出码 |
| clean | 注记清洗 | 固定步骤，每批执行并记录条数 |
| build | 装配 | 校验通过后才装配 |
| override | sourceNames 无条件覆盖 | 从 extracts 覆盖 editorial，避免遗漏 |
| bindings | 绑定前置自检 | 装配前确认 sourceNames 非空且与 catalog 匹配 |
| apply | 写入 + 绑定解析 | `scripts/places/apply-enrichment-3.12.mjs` |
| gz | 压缩 | mtime 字节归零 + 与 .json deepEqual |
| verify | 4 项校验 | validate-v2 / validate / validate-release / validate-polity-period |

**链条自检的意义**：每一环都可能通过，但**缺环不会报错**（3.35 曾漏带 `check-bindings` 而恰好通过）——名单让缺环显形。

**批量命令模板**（把 `PART` 换成 part-XX.json）：

```bash
node docs/verification-3.36/check-lengths-3.36.mjs PART   # 必须 0 处才继续
OUT=$(node docs/verification-3.36/build-narratives-batch-3.36.mjs --check 2>&1); case "$OUT" in *FAIL*) echo GATE_FAILED; exit 0;; esac
node docs/verification-3.36/clean-coverage-notes-3.36.mjs
node docs/verification-3.36/build-narratives-batch-3.36.mjs
node docs/verification-3.36/patch-sourcenames-3.36.mjs
node docs/verification-3.36/patch-editorial-sourcenames-3.36.mjs
node docs/verification-3.36/check-bindings-3.36.mjs
node scripts/places/apply-enrichment-3.12.mjs
node docs/verification-3.36/write-narratives-gz-3.36.mjs
node scripts/validate-v2.mjs && node scripts/validate.mjs && node scripts/validate-release.mjs && node scripts/validate-polity-period.mjs
echo "STEPS: parse,lengths,gate,clean,build,override,bindings,apply,gz,verify"
```

**禁止**：不要运行 `prepare:assets`。

### 3.2 起笔规则（撰写侧方法：**先定位缺陷落在哪一栏，再把那一栏写进起笔规则**）

| 条目类型 | 规则 |
|---|---|
| 现代国家 | **事件段**先写足 |
| 古代王朝 | **经济段与文化段**先写足 |
| 现代非洲国家 | **事件段**先写足 |
| 薄素材（任何类型） | **用结构目标，不用字数目标** |

### 3.3 可数判定（避免「凭感觉」）

> **能换成可数判据的，就不该留在「感觉」层。**

- **素材厚薄 → 看「可写事实数」**（以 `recordCount` 为信号）：
  - **2–3 个事实 → 结构目标**；**4 个以上 → 字数目标**；**不确定 → 按结构目标起笔**（代价只是多写一个分句，而字数目标的代价是返工）。
- **实测**：第七批边界带误用字数目标 → 1 处；第八至十五批按可数判定 → **连续 0 处**（含 rec1 的最薄条目）。

### 3.4 结构目标（薄素材的具体做法）

> **最薄弱的一栏先写满两个完整分句**（每句含主语、时间或地点、动作），**再收尾**；不以「达到 35 词 / 50 字」为停止条件。

- **实测**：culture 栏 2 → **0**；最薄素材（rec1–3）连续多批 0 处。
- **另**：中文每栏 ≥ ~65 字、英文每栏 ≥ ~50 词起笔，可留出安全余量。

### 3.5 规则可叠加

> **规则可叠加**：「现代国家 → 事件段」与「薄素材 → 结构目标」同时成立时，**后者优先**——**事件段也要先写满两个分句**。

- **实测**：第三批（未叠加）事件段 1 处 → 第四批（已叠加）**0 处**。
- 与既往同源：**不是规则错了，而是出现了既有规则的组合情形**；每遇新组合，按同一方法扩栏位。

### 3.6 判据唯一来源（质检侧方法：**先定位缺陷在哪一步暴露，再把该类别并入最靠前的那一步**）

> **同一判据不要维护两份**——两份就会漂移，**漂移的方向永远是「早的那份更旧」**。

- 前置检查的四类判据**直接读取闸门脚本的常量**（`TRADITIONAL` / `EVALUATIVE`），不再手抄；
- **实测**：手抄副本漂移为**两处系统性出错**——繁体表漏 20 余字（爾、軍、戰、勝、歐、亞、羅、蘇、聯…）、评价表用繁体而闸门用简体（**一直在漏判**）；改为单一来源后漂移 **→ 0**。

### 3.7 「机制优于小心」对照表（九行，均有可度量结果）

| 经验 | 反例（小心） | 机制（步骤） | 结果 |
|---|---|---|---|
| 判据来源 | `--check` 接 tail，退出码来自 tail，FAIL 被当成功 | 按输出内容判定 | 掩盖 FAIL 1 → 0 |
| 写入前自检 | 变量名错误致整批作废 | 写入后立即 JSON.parse | 作废 1 → 0 |
| 字数标准 | 意图标准 45→55 词（无效） | 阈值 = 闸门 + 清零再装配 | 首次报错 4 → 0 |
| 注记清洗 | 5 次失败，机制化后又犯 2 次 | 装配前固定跑清洗并记录条数 | 手工 4→13→22；机制化后归零 |
| JSON 构造 | 手写大 payload 3 次语法错误 | `JSON.stringify` 生成 | 语法返工 3 → 0 |
| 校验/改动分离 | 串联修补 + 装配 | 先 `--check` 再单独装配 | 返工 2 → 0 |
| 提效方式 | 凭感觉一次多写 | 小批验证流程后再放大 | 每篇调用 1.2 → 0.6 |
| 脚本复用 | 按目录名替换脚本丢字段 | 复用已验证脚本 / 从源头反查 | 白写 8 篇 → 0 |
| **判据唯一来源** | 手工摘抄检字表 | 读取闸门脚本的判据常量 | 两份表漂移 → 0 |
| **链条自检** | 漏带一环却恰好通过 | 每批打印 STEPS 名单与各环输出 | 缺环显形；连续 13 批十环齐全 |
| **池子余额脚本重算** | 线性外推（基数过期） | 每次由脚本逐条比对 | 旧估 137/37 → 实际 **175/95** |

---

## 4. 三条引用规则与规格（照旧，未变）

1. **QID 只取自** catalog 的 `verifiedWikidata` 或 en.wikipedia `pageprops.wikibase_item`，**绝不凭记忆**；
2. **外部条目只能通过实体反查**（Wikidata sitelink / pageprops），**不得按名称搜索**；
3. **中文介绍与英文条目冲突时，以英文条目为准**。

**规格（本轮 32 篇实测）**：中文四栏 50–110 字、英文四栏 35–90 词、英文栏 CJK **0**、繁体字 **0**、疆域联系注记 32/32、覆盖句重复 **0**。

**写作用域**：`public/data/enrichment/narratives.json(+.gz)`、`editorial/enrichment-narratives-3.12.json`、`docs/verification-3.36/`。**不得触碰** `public/app.js`、`public/source-reader.js`、`public/atrocities.js`、`public/style.css`、`public/index.html`。

---

## 5. 恢复工作时的一句话流程

从 `part-05.json` 起写 8 篇（素材取 `narratives-extracts.json` 排除已写）→ 跑 3.1 的批量命令 → 报告 `STEPS` 一行 + 已写/剩余 + 各环输出 → 循环至 **100/0** 才标记完成。