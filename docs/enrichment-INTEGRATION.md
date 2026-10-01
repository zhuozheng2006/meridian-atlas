# 历史政体补充资料

只在本目录产出数据，不改边界年份、几何或主站。数据源是公开 Wikidata 结构化数据（CC0）和机构资料支持的原创简短概览；未复制 Phersu 数据或文章。

## 文件和读取

- `assets/profile-index.json.gz`：总索引，可在首次打开政体时延迟读取。`profiles[Qid].file` 指向 `profiles/Qxxxx.json.gz`。
- `assets/profiles/Qxxxx.json.gz`：单个实体档案。未压缩 `.json` 仅供查看；部署只需 gzip。
- `assets/narratives.json`：23 篇原创中英概览；每篇政治、经济、文化三段，中文合计 196–229 字，另有 47 条机构来源支持的 facts。
- `assets/enrichment-report.json`：实际覆盖统计。
- `assets/enrichment-manifest.json`：最后验证后生成的部署大小及 SHA-256 清单。
- `cache/`：原始实体与标签快照，仅本地复现，勿全部部署。

服务器可能自动解压 gzip，读取器应检查魔数 `1f 8b` 后决定是否再解压。

## 绑定

优先用 `index.records[record.id]`，不要只按译名或模糊名称找。绑定依据是先前核对的原 Wikipedia 文章所关联的 Qid，仍不保证原边界时间、名称与该百科实体历史范围一致。

`ambiguous_source_period`、RELATION、没有可核对 Qid 的记录不绑定。

880 条记录具有 `temporalCompatibility.status = potential_conflict`：源边界区间与实体的成立/终止日期可能冲突。它们可能来自错误文章关联、不同断代或范围差异，不能自动判定哪一方正确。原始日期依据保留。不要对这些记录填入所选年份属性；来源栏说明即可。

概览必须同时匹配 `sourceNames` 完整原名、`qid` 与 `scope`。罗马共和国与罗马帝国不混用。法兰西概览只讨论路易十四时期，大英帝国概览只从大西洋殖民史切入；这些范围已明示。`recordIdsOverlappingScope` 可辅助核验，但所选年份仍需落在 scope 内。

## 属性语义

`profile.fields` 的各值是 statement 数组：

`capital, government, officialLanguages, spokenLanguages, religion, currencies, continent, predecessors, successors, headsOfState, headsOfGovernment, inception, dissolution, instanceOf`。

实体值为 `value = {type:'wikibase-entityid', id:'Q…', label:{zh,en,...}, raw}`。时间值为 `{type:'time', time:{time,civilYear,precision,calendarmodel,before,after,...}, raw}`。未知 label 为 null，不猜测；简体字通过 OpenCC t2s 转换，保留原标签语言说明。缺中文用英文或原 Qid。

发布版本已冻结标签抓取：缓存包含 11,600 个不同实体，全部 1,029 个可展示事实值的实体均已请求。剩余 3,123 个未请求的 ID 只涉及审计陈述、背景限定或参考文献实体，记录于 `coverage.labelFetch`。源站仍可能没有相应语言标签；`Q134076227` 没有所请求的中文、英文或默认标签，保留 Qid。英文栏允许 Wikidata 的 `mul` 默认标签作为回退，使用 `enSourceLanguage` 明确标记。

`displayGroup`：

- `qualified`：有实际引用来源且有时间限定；并不等于已经独立核验。显示日期、范围及其他 qualifiers。
- `unscoped`：有引用、无时间范围，可放“档案概况”，不得称为当前历史年份的状态。
- `dated_entity_fact`：有引用的成立/终止日期，时间值本身就是事实；不能用它覆盖 Cliopatria 边界记录的起止年。
- `unreferenced`：缺少可识别引用，或只有“导入自”之类记录。保留审计，暂不显示为确认事实。
- `deprecated` / `unknown_value`：保留审计，不作为已确认具体值。

年份匹配只在明确的单一起止区间，或明确时间点，且精度至少为“年”时执行。单边开放范围不外推，多组起止日期不自动配对，约略日期不能当精确范围。辅助规则见 `profile-utils.mjs`。

时间保留 Wikibase JSON 的有符号年份，不使用 RDF 日期转换，也不使用 JS Date 重解析。原零年不会被改写为公元1年，civilYear=null。世纪等粗精度不转成某一个精确年份，历法仍保留。所有 qualifiers 原数据保留，包含“适用于某部分”等非时间限制；这些条件同样影响解释。

`verifiedWikidata` 的“核对”只表示文章交叉关联一致。`description` 是 Wikidata 实体级说明，不是已经逐句参考文献核验的简介。`rank:preferred` 也不代表在每个历史年代优先。

## 引用与许可证

每条属性包含 `statementId, sourceUrl, revisionUrl, references, qualifiersRaw`。有 lastrevid 才生成固定版本链接；缺版本号时回退实体页，附原始缓存 SHA-256 与抓取时间，绝不输出空 oldid。已引用外部资料并未逐条打开审稿，界面应使用“Wikidata 条目列有来源”等准确措辞。

references 保留书目、页码、URL、条目ID与检索日期等 snaks。长引文属性 P1683 不重复发布，标记 quotedPassageOmitted；完整原始响应仍留本地缓存供核对。

- Wikidata CC0：https://www.wikidata.org/wiki/Wikidata:Licensing
- 时间限定：https://www.wikidata.org/wiki/Help:Qualifiers
- 引证规则：https://www.wikidata.org/wiki/Help:Sources
- Wikibase JSON 数据模型：https://www.mediawiki.org/wiki/Wikibase/DataModel/JSON
- 原创中英概览及 facts：CC BY 4.0；机构文章、图片等仍受其各自版权许可约束，仅链接和原创事实摘要。

## 复现

在本目录使用 Python 3，`.venv` 已安装 `opencc-python-reimplemented==0.1.7`。

1. `python3 fetch_entities.py`（1450 目标，使用已有缓存则跳过）
2. `python3 fetch_value_labels.py`（引用值、限定值与参考文献实体标签，可恢复续抓）
3. `.venv/bin/python build_profiles.py`
4. `.venv/bin/python make_narratives.py`
5. `.venv/bin/python validate_enrichment.py`

联网会受 API 限流，应按脚本延迟与退避重试，不创建并发抓取。结构化快照是抓取时点的社区数据，字段覆盖不完整、原始陈述也可能错误。最终验证检查绑定、字段、引用、压缩文件和年代防护，不能代替历史学家审核。
