# 3.17 事件升级撰写规范（AUTHORING-SPEC）

本规范用于把「经纬纪 Meridian Atlas」中仍是结构化索引级（provenance=wikidata-structured）的事件，
升级为编辑级双语条目。**硬性事实：不接受编造、不接受机翻、不接受没有来源的数字。**

## 1. 你的产出（唯一允许写的文件）

`docs/verification-3.17/authoring/part-NN.json`

不要修改任何其它文件（尤其不要碰 public/、editorial/、其它 part 文件）。
装配脚本会按 qid 把这批条目装配进 public/data/events.json，并自动生成 sources 字段——**你不要写 sources**。

## 2. 先读的研究材料

| 文件 | 用途 |
| --- | --- |
| `docs/verification-3.17/content-upgrade-ranking.json` | 你的条目清单、rank、`year`（= 索引年，民用纪年，无 0 年） |
| `docs/verification-3.17/content-upgrade-extracts.json` | 英文/中文维基**导言**（本会话读取的证据，含 `enResolvedTitle`/`zhResolvedTitle`/`enDab`/`zhDab`/`p585`） |
| `docs/verification-3.17/content-upgrade-evidence.json` | 维基数据标签（zh/zh-hans/zh-cn/en）、sitelink、P585 精度、P710、P625 |
| `docs/verification-3.17/content-upgrade-zh-search.json` | 对没有 zhwiki sitelink 的条目做过的中文维基搜索候选（含导言），用于判断是否存在未挂链的中文条目 |

导言只是研究材料，**禁止逐句照抄**；用你自己的话写。

## 3. 输出 schema（严格遵守）

```json
{
  "part": 1,
  "entries": [
    {
      "qid": "Q652320",
      "id": "v312wd-q652320",
      "rank": 3,
      "titleZh": "图卢兹战役",
      "titleEn": "Battle of Toulouse (721)",
      "start": 721,
      "end": 721,
      "yearCorrection": null,
      "languageGap": { "zhArticle": false, "enArticle": true },
      "zhArticleFound": null,
      "summaryZh": "……",
      "summaryEn": "……",
      "significanceZh": "……",
      "significanceEn": "……",
      "notesZh": "……",
      "notesEn": "……"
    }
  ]
}
```

- `id` 必须等于 `v312wd-` + qid 小写。**不要**写 `provenance`、`sources`、`wikidataQid`、坐标、region、category——装配脚本从现存索引条目原样继承，避免移动点位或改变分区。

## 4. 年份规则（最重要，前三批都在这里返工）

1. **项目一律民用纪年，没有 0 年。** 公元前 853 年写成 `-853`；公元 43 年写成 `43`。
2. 维基数据 P585 是 ISO 8601 天文纪年（有 0 年），**不要机械 -1**。判断依据是**所引导言正文写的年份**：
   - 导言写 "fought in 853 BC" → `-853`；
   - 导言写 "circa 1175 BC" → `-1175`（并在 notes 说明是约数、维基数据 P585 的年代值）；
   - 导言写 "422 BC" → `-422`。
3. 若导言年份与 ranking 的 `year` 不同，或导言只给年代/约数而你采用了导言年份，**必须**填 `yearCorrection`：
   ```json
   "yearCorrection": { "from": -497, "start": -496, "end": -496, "reason": "英文维基正文：李维记为前 499 年，狄奥尼修斯等记为前 496 年，现代作者另有前 493/489 年；维基数据 P585 精度为年代（前 490 年代）。本条目采用正文最常引用的前 496 年。" }
   ```
   `from` 必须等于 ranking 的 `year`；没有修正就不要写这个字段（或写 null）。
4. **本批已由负责人核定过的年份修正（照抄，不要改）**：
   | qid | ranking year | 采用 | 依据 |
   | --- | --- | --- | --- |
   | Q111383245 | 2020 | start 2023, end 2024 | 维基数据 P585 精度为年代（2020s）；英文条目题为 Battle of Avdiivka (2023–2024)，2023-10-10 发动攻势，2024-02-17 乌军撤离 |
   | Q112206624 | 2020 | 2022 | P585 精度为年代（2020s）；中文条目「2022年4月在克雷明纳的交战」，英文条目（顿巴斯攻势）「began on 18 April 2022」 |
   | Q2274112 | 1600 | 1614 | 中英文条目均为 1614-11-26；维基数据 P585 1600-12-26 与两者矛盾（3.16 报告曾因此排除该条） |
   | Q1644792 | -497 | -496 | 见上方示例；正文断代争议写进 notes |
   | Q1036947 | -1178 | -1175 | 英文正文 "circa 1175 BC"；P585 -1178（= 前 1179 年）为天文纪年值 |
   其余条目一律 `start = end = ranking.year`。

## 5. 标题规则（不许自创译名）

- `titleZh`：
  - 若该事件**有中文维基条目**（`languageGap.zhArticle=true`，来自 sitelink 或 zh-search 确认）→ 用该条目标题的**简体**写法；
  - 否则 → 用维基数据中文标签的简体写法（通常等于 ranking 的 `titleZh`；若你认为 ranking.titleZh 有问题，保留它并在 notes 说明，不要换成一个没有来源的名字）。
- `titleEn`：优先用英文维基**条目**标题（`enResolvedTitle` 或 `enTitleRequested`；有消歧义后缀就保留后缀）；无英文条目时用维基数据英文标签（ranking 的 `titleEn`）。
- 英文栏只允许拉丁字母（含重音、连字符、括号、数字）。

## 6. 字段规格

| 字段 | 要求 |
| --- | --- |
| `summaryZh` | **110–135 个字符（含标点）**。叙述：谁、何时、何地、过程要点、结果与影响。 |
| `summaryEn` | **45–60 个词**。与中文同义，独立成文（不是逐句直译）。 |
| `significanceZh` / `significanceEn` | 各一句，说明这次事件在历史上的意义（对战争进程、政权或地区格局的影响）。 |
| `notesZh` | ≥40 字；`notesEn` ≥20 词。**必须包含三点**：(a) 断代依据与精度（P585 精度、与条目正文年份的差异、如有争议写明各说）；(b) 语种缺口——若中文维基百科无该条目就明写「中文维基百科尚无该条目」，若英文维基无条目同理（`languageGap` 必须与事实一致）；(c) 坐标、地区与类别沿袭结构化记录，本次升级不改动。 |
| `languageGap` | `{"zhArticle":bool,"enArticle":bool}`，必须与研究材料一致。 |
| `zhArticleFound` | 仅当通过 zh-search 找到并**读导言确认是同一事件**、但维基数据没有 sitelink 时，填该条目标题；同时在 notesZh 说明确认依据。否则 null。 |

## 7. 事实纪律

1. 只使用「导言/正文（可再取同一条目的全文）」+ 维基数据声明中的信息。**不要**引入其它来源的数字、伤亡数或评价。
2. 导言与维基数据冲突时（年份、地点、结果），以导言为准并在 notes 里写明冲突。
3. 不写没有来源的伤亡数字、不写「据说」「一般认为」这类无指涉的措辞。
4. 中文一律简体；英文栏禁止出现任何 CJK 字符。
5. 不要照抄导言的句子。

## 8. 自检（交付前必须跑到 OK）

```
node scripts/places/check-authoring-3.17.mjs --part=docs/verification-3.17/authoring/part-NN.json
```

它会逐条检查字数、年份、`yearCorrection`、`languageGap`、繁体字、英文栏 CJK、notes 的语种缺口披露。
**必须显示 "OK all hard gates pass" 才算完成**；warning 要看，但只有 error 会挡。
字数是硬门槛：先用脚本量，再增删到窗口内（例如中文目标 120–130 字，英文目标 50–56 词）。
