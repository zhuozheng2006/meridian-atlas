# 经纬纪 3.13 结构化条目英文混入中文的修复报告（task-15）

## 一、问题与量化（修复前）

用 scripts/places/audit-language.mjs 清点出货数据里「英文字段含 CJK 字符」的情况（审计产物 docs/verification-3.13/content-language-audit.json）：

| 层 | 受影响条目 | 字段分布 |
|---|---:|---|
| events.json（291 条 provenance=wikidata-structured） | **283 / 291** | summary.en 283 条、significance.en 249 条 |
| battles.json（486 条） | **486 / 486** | belligerents 789 个值、countries 489 个值、conflict 420 个值含中文 |

典型样本：Battle of Kadesh 的英文摘要出现「Belligerents recorded: Canaanites、卡迭石、米吉多、胡里特人、新王国时期、米坦尼」。

## 二、修复方法（全部走构建脚本，幂等）

1. **补齐英文标签**：新增 scripts/places/fetch-entity-english-labels.mjs，通过维基数据查询服务解析这 486 个战役实体的 P710（参战方）、P361（所属冲突）、P17（国家）的**英文 rdfs:label**，写入 editorial/entity-labels-en.json。结果：481 个实体至少有一个英文标签；仅 1 个实体完全没有英文标签，按规则回落为 **QID**（如 Q12345），不做音译、不做机翻。
2. **战役层构建**：scripts/places/build-battles.mjs 改为双语言字段——
   - 英文侧：nameEn、belligerents、conflict、countries、notesEn，只允许拉丁字母（无英文标签的实体写 QID）；
   - 中文侧：nameZh、belligerentsZh、conflictZh、countriesZh、notes，保持简体（沿用采集时的字形转换结果）；
   - 构建时对英文侧做 CJK 断言，命中即中止，避免回归。
3. **结构化事件构建**：scripts/places/build-structured-events.mjs 的英文摘要与英文意义说明改为只用英文标签（缺失写 QID 或整句省略），中文摘要用简体标签；生成时对每条英文文本做 CJK 断言。中文摘要模板同时压缩到 200 字以内（构建管线的既有长度约束）。
4. **管线护栏**：apply-events-3.10.mjs 新增校验——provenance=wikidata-structured 的条目，其 title.en / summary.en / significance.en / editorialNotes.en 含 CJK 即拒绝写入；同时让「结构化批次重建」按实体集合整体替换，避免重建后留下孤儿条目。
5. **校验器扩展**：validate-battles.mjs 增加第 8 项检查「English fields contain Latin script only and Chinese fields are present」，并断言 policy 里写明 QID 回落与 outcome 留空的原因。

## 三、修复后审计

同一脚本复跑（docs/verification-3.13/content-language-audit.json）：

| 层 | 条目数 | 英文字段含 CJK |
|---|---:|---:|
| events.json | 709（结构化 291） | **0** |
| battles.json | 486 | **0** |

英文侧示例（Battle of Kadesh）：Belligerents recorded: Egyptian Empire, Mitanni, Hurrians, Tel Megiddo, Kadesh, Canaanites.；中文侧保持「卡迭石、米吉多、胡里特人、新王国时期、米坦尼」等简体标签。两侧各自独立，互不混排。

## 四、数据与归档

- events.json 仍为 **709** 条，291 条结构化条目在原位替换（id 不变），events.json.gz 重新生成且 mtime=0、与未压缩 deepEqual。
- battles.json 仍为 **486** 条，新增双语数组与 notesEn，文件由 401 KB 增至 587 KB（gzip 44 KB → 56 KB）；battles.json.gz 同样 mtime=0、与未压缩一致。
- 版本化产物：docs/verification-3.13/content-language-audit.json、content-language-fix.md、content-language-fix.json、content-structured-event-bi.png。

## 五、顺带处理与下一轮事项

本轮已处理：

- **outcome 为何留空**已写入 battles.json 的 policy.outcome：维基数据没有稳定的「战役结果」属性，本项目不推断胜负；将来只有在可核验来源明确写出结果时才补该字段。
- **语言政策**已写入 policy.language：英文侧仅拉丁字母、无英文标签用 QID、中文侧保持简体、不做音译与机翻。

下一轮事项（本轮未做）：

1. **战役层地区偏斜**：欧洲 199/486，源数据本身欧洲密集；建议补入非欧洲来源（如区域性考古/军事史数据库）或对欧洲条目设更严格上限。
2. **参考链接覆盖率低**：出货层目前 7 条带 https 参考链接（此前 13 条中含 http 链接，按语言/质量政策已剔除）；建议对用户最常点开的战役补一次文献来源。
3. **结构化事件升级**：291 条仍为索引级条目，建议按检索热度逐步升级为编辑级叙述。
4. **中文侧参战方**：少量中文数组保留了拉丁原标签（如 Canaanites），属于来源未提供中文标签的情况，按「不音译」原则保留原文。

## 六、验证证据

    node scripts/places/audit-language.mjs                → 事件 0、战役 0 条英文字段含 CJK
    node scripts/places/validate-battles.mjs              → PASS 8/8（含语言检查与 policy 检查）
    node scripts/validate.mjs                             → PASS（709 条事件）
    node scripts/validate-v2.mjs                          → PASS（events.json.gz 与未压缩一致）
    node scripts/validate-places.mjs                      → PASS
    node scripts/validate-city-time.mjs                   → PASS
    node scripts/validate-city-narratives.mjs             → PASS 10/10
    node scripts/validate-polity-period.mjs               → PASS
    node scripts/validate-release.mjs                     → PASS
    幂等：apply-events 与 build-battles 重复运行后文件哈希不变

浏览器抽查（http://127.0.0.1:8767，Chrome 无头 + SwiftShader，每用例独立会话）：

- 米吉多战役 v312wd-q733364@前1456、斯科普里战役 v312wd-q1896360@1004、图卜鲁格战役 v312wd-q2624980@1911；
- lang=en 下三条详情页均**无 CJK 字符**（长度 600—652），lang=bi 下均能显示对应的中文标题；
- 截图：docs/verification-3.13/content-structured-event-bi.png。

## 七、复现命令

    node scripts/places/fetch-entity-english-labels.mjs           # 解析参战方/冲突/国家的英文标签
    node scripts/places/build-battles.mjs                         # 重建战役层（含英文侧 CJK 断言）
    node scripts/places/build-structured-events.mjs --count=320    # 重建结构化事件批次
    node scripts/places/apply-events-3.10.mjs --batch=editorial/events-3.10.json --batch=editorial/events-3.11.json --batch=editorial/events-3.12.json --batch=editorial/events-wikidata-3.12.json
    node scripts/places/audit-language.mjs                        # 语言审计
    node scripts/places/validate-battles.mjs                      # 8 项校验

