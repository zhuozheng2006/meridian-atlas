# 3.44：笈多与阿兹特克原典导读候选

已冻结 5 张双语卡、2 个此前零导读阶段、8 条唯一原始观察行。只在本工作目录准备，未改生产数据、代码或部署。

## 交付入口

- `catalog.json`、`sources.json`、`claim-evidence.json`：与 3.43 相同的卡片契约；逐行保留 typed cells、原始值、空观察年和完整身份。
- `manifest.json`、`acquisitions.json`：6 个 HTTP 200 原件，合计 98,601 bytes，逐文件 SHA-256；正文是 3 个独立载荷、2 部作品，正文载荷共 74,407 bytes。
- `offline/index.json` 与 3 个阅读文档：既有 saved-text schema，`language: en`，共 78 blocks；5 卡全部有明确段落入口。对应 `.txt` 方便人工审阅。
- `offline/faxian-*.zh-Hans-review.json`：两章共 50 个完整简体中文原段，保留原文用字，无新译文或静默修字。
- `verification/faxian-segments.json`：两章全部 200 条英文、简中、繁中、拼音赋值，逐条原 JS 行号、UTF-8 byte 区间和片段 SHA。源 JavaScript 从未执行。
- `verification.json`：352/352 自动身份、原字节、全文重建和覆盖检查通过。

## 内容与来源

| 阶段 | 卡片 | 原行 | 关系 |
|---|---|---|---|
| `in_gupta_emp`，320—550 | 赋税与刑罚 | 7084 `formal_legal_code=P` | comparative-reading |
| 同上 | 寺院供养与铁券 | 13333 `written_record=P` | direct-evidence：文本记述的实践 |
| 同上 | 巴连弗求律、口传与抄本 | 13333 `written_record=P`；16888 `religious_literature=P` | direct-evidence：文本记述的实践 |
| `mx_aztec_emp`，1427—1526 | 市场与裁断 | 7703 `judge=P`；9896 `market=P` | comparative-reading |
| 同上 | 纸面贡赋记录 | 12766 `mnemonic_device=P`；13079 `nonwritten_record=P`；13478 `written_record=A` | comparative-reading |

法显来源为 UCSD 托管的 David K. Jordan 教学修订版第 16、36 章，基于 Legge 1886 年译本；章节页标注创建于 2012-11-24，导言说明英译、注释、罗马化和简体转换的处理。实际正文在章节 HTML 明确引用的公开 `Faashean16Data.js` / `Faashean36Data.js` 中，已获取真实字节并惰性解析。原站阅读入口在 `landingURL`，原始 JS 与派生可读文本身份分开。

科尔特斯来源为 Fordham IHSP 的 1520 年第二封信选段，原页面明确来源是 Thatcher 编《The Library of Original Sources》1907 年卷 V、317—326 页，并说明 Arkenberg 扫描及现代化处理。这里不使用另一套 MacNutt 1908 年译本的署名。

## 审查重点与已处理问题

1. 法显写的是“铁券书录”，英译泛称金属板；卡片明确保留两者差别，没有改成铜券。
2. 刑罚英文有 repeated attempts 与 right hands；摘要已根据独立审查收紧为“反复谋反者被截右手”，相邻段落一起定位。
3. 文中“中国”是印度中部；没有把此处地理词误读为现代国家。
4. 法显年代采用导言 399—414 年的旅行背景；没有推造三年停留的精确起讫年，也没有让原始空观察年变成新日期。对应笈多仅为年代、地理上的阅读语境，原文并未点名笈多君主。
5. 市场“六万人”没有导入城市人口，裁断人员没有自动推定为专业全职法官；阿兹特克 1526 年阶段终点严格保留工作簿原值。
6. 纸面符号图像与 `written_record=A` 用于比较编码分类；不宣称证明该行错误，不改值、不合并记录。
7. 所有卡片 `sourceLineageEstablished`、`allowRecordMerge`、`allowRawRewrite` 都是 false。两项 direct-evidence 指已取得文本直接叙述实践，不是取得铭刻实物，也不是证明工作簿书目来源。

## 阅读文本保真范围

- 法显两章英文 38+12 段完整保留；章节标题沿用 `ChaptTitle`。每块来源是原 JS 的带引号字符串字节，转换链为 JSON 字符串解码、惰性 HTML 文本提取、空白规范化。引号、括注、拼写均保留。
- 两章简中 38+12 段作为独立审阅资产完整提供；繁中与拼音保留在全部赋值解析和原件中，未伪称英文阅读体包含全部四语。
- Cortés 文档保留所取得选段的全部正文、标题、原版来源、电子整理者、使用说明与版权说明；网站菜单和通用站点页脚不放入正文。独立抽取整个选择区文本，与全部阅读块逐字去空白对照相等。

## 集成与复验

`sources.json` / `catalog.json` 的本地路径前缀已指向 `./data/research-evidence/readings-3.44/`。将证据文件保留在该路径后，root 可把 `offline` 中三个文档另行包装进新阅读索引；旧版三个已发布阅读文本的字节无需改变。不要把 `sourceSpans.kind=javascript-string-literal` 当成直接 HTML 文本切片：它包含原始带引号 JSON 兼容字符串，核验时先解码，再提取 HTML 文本。

只读复验：

```sh
python3 work/release-344/sources/verify.py /Users/zane/meridian_atlas/world-history-atlas
```

重新生成候选：先 `prepare.py REPO`，后 `extract_texts.py REPO`，再 `verify.py REPO`。提取器复用生产目录现有 HTML Reader，`extraction.helperScriptSha256` 记录具体版本；本轮全部输出都位于工作目录。

合入后覆盖将由 30 卡 / 11 阶段 / 12 来源变为 35 卡 / 13 阶段 / 15 来源，原始观察数变化为 0。独立内容与原行复核报告见 `review-final.md/json`、`review-rows-independent.json`；54/54 独立字节与行身份检查通过，五卡无遗留问题。所有导读段落入口也已加入阅读目录，保持正文顺序，段落类型不变。本批不再扩展候选。
