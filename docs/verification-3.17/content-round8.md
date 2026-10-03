# 3.17 内容第八轮：索引级收尾（133 → 93）与暴行层双语补强

任务 task-20。基线提交 `69d052c6`，本报告由 `scripts/places/report-content-round8-3.17.mjs --baseline=69d052c6` 从当前文件生成，可复跑。

**结论**：索引级事件由 **133 条降到 93 条**，本轮升级 **40 条**（3.17 重排后的第 1–40 名）；暴行层中文名维持 **37/293**（四条取名路线都没有找到可确认的新名，见第 5 节），英文 country/conflict/victims 数组从全空补到 **453/457 槽位**；11/11 条校验命令 exit 0。

## 1. 结果摘要

| 指标 | 基线 | 本轮 |
|---|---|---|
| 事件总数 | 709 | 709 |
| 其中索引级（provenance=wikidata-structured） | 133 | **93** |
| 其中编辑级 v312wd 条目 | 158 | **198** |
| 战役层 battles | 603 | 603（5 条年份同步修正） |
| 暴行层 atrocities | 293（中文名 37） | 293（中文名 37，英文数组已补） |

> 报告生成时 `public/data/events.json` 的索引级为 13 条：工作区里已有后续轮次（3.18）在继续升级，本报告只把 3.17 批次的 40 条记在本轮名下，`structuredAfterThisRound=93` 是本轮结束时的口径。

本批 40 条的书写窗口：中文 111–135 字（要求 110–135），英文 48–60 词（要求 45–60）；id 一律保持 `v312wd-<qid>`，provenance 字段整条删除，wikidataQid 保留。

## 2. 选点：重排剩余 133 条，并纠正上一轮的口径错误

上一轮（3.14 公式）只给中文维基条目计分，于是得出「rank 171 之后全部没有条目」的结论。本轮改用：

```
score = 3 * (has zh or en Wikipedia article) + min(sitelinks, 40) / 10 + 0.5 * (belligerents recorded) + 2 * (has Chinese Wikipedia article)
```

结果：剩余 **133/133** 条至少有一个语种的维基条目（英文 131、中文 7），旧结论是查询口径造成的假象。**「数据不存在」的判定必须先检查是不是查询口径的问题。**

## 3. 年份修正（5 条，并同步战役层）

| qid | 索引年 | 本轮采用 | 依据 |
|---|---|---|---|
| Q111383245 | 2020 | 2022–2024 | 维基数据 P585 精度为年代（2020s），索引条目因此记为 2020 年；中英文维基条目均记交火自 2022 年开始、2024 年 2 月 17 日乌军撤离，本条采用 2022–2024 年。 |
| Q112206624 | 2020 | 2022 | 维基数据 P585 精度为年代（2020s）；中文维基记2022年4月在克雷明纳的交战，英文条目（克雷明纳条目重定向至顿巴斯攻势）记攻势始于2022年4月18日。 |
| Q2274112 | 1600 | 1614 | 中英文维基条目均记为1614年11月26日；维基数据 P585 记为1600年12月26日，与该战役所属的大坂冬之阵（1614–1615年）矛盾，本条采用条目正文年份。 |
| Q1644792 | -497 | -496 | 英文维基正文指出此战年代自古不明：李维系于公元前499年，狄奥尼修斯等作前496年，现代学者另有前493、前489年之说；维基数据 P585 精度为年代（前490年代）。本条采用正文最常引用的前496年（记作 −496）。 |
| Q1036947 | -1178 | -1175 | 维基数据 P585 为 ISO 天文纪年 −1178（即公元前1179年），英文维基正文记该战役发生于约公元前1175年；本条采用正文的约数年份并记作 −1175，约数性质在 notes 中说明。 |

维基数据 P585 的问题有三类：**年代精度**（Q111383245、Q112206624 记 2020s，索引条目读成 2020）、**与两语条目矛盾的年份**（Q2274112 记 1600，条目均记 1614）、**ISO 天文纪年与正文约数不一致**（Q1036947）。Q1644792 则是正文本身有争议（李维前 499、狄奥尼修斯前 496、现代另有前 493/489），条目采用前 496 并把全部异说写进 editorialNotes。

按 Lead 裁决，这 5 条同时修正了 `public/data/battles.json` 的 year/start/end（`scripts/places/apply-battle-year-fixes-3.17.mjs`），并在战役记录 notes 保留维基数据原值作为分歧记录，否则 validate-cross-layer 会红。

## 4. 语种覆盖与引用解析

- 英文维基条目 **38/40**，中文维基条目 **7/40**，双语 5 条。
- 无中文条目的 33 条都在 editorialNotes 明写缺口，并且**逐条做了核对**：把条目的中文标签拿去 zh.wikipedia 做精确标题查询（含重定向），33/33 均不存在对应页面。
- **拒绝了一个看似匹配的中文条目**：`圖盧茲之戰` 是 1814 年图卢兹战役，不是 721 年的那一场。3.16 的候选表里就有这个标题，若照抄就会把错事件写进引用。本批按「先读候选导言确认是同一事件」的规则拒绝，Q652320 因此按「中文无条目」处理。
- 引用的英文标题一律取实体当前的 enwiki sitelink（或其重定向目标），不使用维基数据英文标签，因此不会踩「标签≠条目标题」的坑。

## 5. 暴行层双语补强

| 手段 | 命中 | 说明 |
|---|---|---|
| 3.16 已有中文名（维基数据 zh 标签） | 37 | 本轮复核后原样保留 |
| 中文标签**其他变体**（zh-hans/zh-hant/zh-cn/zh-tw/zh-hk/zh-sg/zh-my） | 0 | 本轮新查，未发现新增（37 条已全部来自 zh 标签） |
| zhwiki sitelink | 0 | 27 条有 sitelink 的都已带 zh 标签，无新增 |
| 按英文名搜索中文维基 + 读导言确认 | 0 | 完成 5/256 条（端点限流，约 2 分钟/次），2 条返回候选、0 个候选标题，读导言后无一为同一事件 |
| 英文条目的中文跨语言链接（补充路线） | 0 | 158 个不同英文条目，0 个带 zh 跨语言链接 |
| 仍为 null | 256 | 不音译不机翻，计入 counts |

英文侧字段：把 pool 里只有中文字符串的 country/conflict/victim 回溯到实体自身的 P17/P361/P710 声明实体，取**同一实体**的 en 标签填入对应槽位；因 3.15 收获时对标签做过 MediaWiki 简繁转换，先用同一转换器把实体标签转成简体再匹配。结果：

| 字段 | 槽位 | 已解析 | 未解析（保持 null） |
|---|---|---|---|
| countries | 293 | 293 | 0 |
| conflict | 159 | 156 | 3 |
| victims | 5 | 4 | 1 |

未解析的槽位保持 null，**没有一个是从中文翻译过去的**。

## 6. 校验

| 命令 | 结果 | PASS/FAIL |
|---|---|---|
| `node scripts/validate-cross-layer.mjs` | exit 0 | 3/3 |
| `node scripts/validate.mjs` | exit 0 | 10/10 |
| `node scripts/validate-v2.mjs` | exit 0 | 11/11 |
| `node scripts/validate-places.mjs` | exit 0 | 20/20 |
| `node scripts/validate-city-time.mjs` | exit 0 | 0/0 |
| `node scripts/validate-polity-period.mjs` | exit 0 | 1/1 |
| `node scripts/validate-release.mjs` | exit 0 | 4/4 |
| `node scripts/places/validate-battles.mjs` | exit 0 | 8/8 |
| `node scripts/places/validate-atrocities.mjs . docs/verification-3.17/content-atrocities-validation.json` | exit 0 | 8/8 |
| `node scripts/places/audit-language.mjs . docs/verification-3.17/content-language-audit.json` | exit 0 | 0/0 |
| `node scripts/places/verify-gz-mirrors-3.17.mjs` | exit 0 | 0/0 |

- `.gz` 归档：3 个有可编辑 .json 孪生的归档全部 mtime=0 且与 .json deepEqual，失败 0 个（另 39 个是 prepare:assets 产物，本轮未跑、未重建）。
- 简体校验：线上 9 个中文字段经 zh.wikipedia variant=zh-cn 转换比对，差异 0 个（未完成 11 个，端点限流）；全部 160 个中文字段的离线繁体字闸门 0 命中。
- 英文栏 CJK：audit-language 见校验输出（英文栏 CJK=0）。

## 7. 仍然缺什么

- 索引级在本轮结束时还剩 **93 条**（本轮只做到新排名第 40 名）；报告生成时工作区已被后续轮次继续升级到 13 条。
- 暴行层仍有 **256 条**没有中文名。四条路线都试过：中文标签变体 +0、zhwiki sitelink +0、按英文名搜索（256 条只完成 5 条，端点限流约 2 分钟/次）+0、158 个英文条目的中文跨语言链接 +0。按规则保持 null，不编造译名；完整证据见 `docs/verification-3.17/atrocities-zh-names.json` 与 `atrocities-zh-search.json`。
- 事件批次的中文维基**全文搜索**未跑完（搜索接口持续 429，退避后仍失败），本轮以「精确标题查询 + 重定向」逐条核对 33 条无中文引用条目（33/33 无对应页面）。标题无关的全文扫描留给下一轮。
- 暴行层仍未接入任何 UI（与 3.16 相同的决定），本轮只做数据与校验。

## 8. 产物清单

- 排序与证据：`docs/verification-3.17/content-upgrade-ranking.json`、`content-upgrade-evidence.json`、`content-upgrade-extracts.json`
- 撰写与装配：`docs/verification-3.17/authoring/part-0{1..4}.json`、`editorial/events-upgraded-3.17.json`、`docs/verification-3.17/content-upgrade-authoring.json`
- 交付：`public/data/events.json(+.gz)`（40 条升级）、`public/data/battles.json(+.gz)`（5 条年份同步）、`public/data/atrocities.json(+.gz)`（中文名与英文数组）
- 校验：`content-validation.json`、`content-gz-mirrors.json`、`content-simplified-check.json`、`content-atrocities-validation.json`、`content-language-audit.json`、`content-atrocities-bilingual.json`

