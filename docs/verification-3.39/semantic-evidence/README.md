# 3.39 官方编码释义接入与验证

本轮更新的是独立、可追溯的显示释义。Polaris-2026 的 643 个资料文件保持原样，工作簿摘要仍为 `cf60c9f76eeda6db545521831a9201e65c64d2b74d4aeb55445cd2b564456c41`。解释资料固定到 Seshat 官方仓库 `1f847d95e224860115a3dc358165380fe5487bcd`，提交时间为 2026-09-29 12:37:09 UTC。两种版本各自保留，解释层不会把历史观察替换成另一版数据。

## 接入内容

- 21 个危机结果字段都有简体中文和英文短释义，并提供对应原件行链接、SHA-256 和本地原件路径。澄清人口衰退/崩溃、精英地位下降/被杀戮或驱逐、首都失守、宪制变化、公共福利等字段的具体范围。人口约一成和一半保留为参考或示例，而非强制阈值。
- `SU`、`DIS`、`A~P`、`P~A` 有了有据可查的说明；过渡方向保持区分，精确出现或消失时间仍不确定。`SA`、`SP` 继续保留旧导出组合和 provisional 状态，因为现行协议的 SSP 标签适用范围与旧组合不同。
- `sync_rel_pra_ind_beli` 展开为“信徒个人层面的宗教实践混融”。全称已明确，其具体编码判据仍待核对。
- “Qin Empire”显示为“秦帝国”，原编号 `250`、工作簿 `Polities` 第 `234` 行、原始公元前 `338—207` 年分期和 North China 地域绑定全部保留。626 阶段中，完整中文显示名由 368 增至 369；其余 257 阶段仍使用原名。
- 原有 18 项待核变量中，危机资料取得了完整的 21 字段说明。其余 17 项的具体判据仍为待核，包括两项已确认 WALS 分类背景的语言变量和已确认全称的宗教混融变量。

## 接口与文件

`public/polaris-vocabulary.js`：`CRISIS_FIELDS[key]` 提供 `definition:{zh,en}`、`evidence:{url,sourceVersion,lines,sha256,localPath}` 及 `sourceRefs`。`POLARIS_SEMANTIC_SOURCE` 提供解释版本、提交时间、对应观察工作簿摘要和双语版本说明。所有对象深冻结。

`public/data/research-evidence/semantic-3.39/source-manifest.json` 列出 8 个完整官方原件，共 999,437 字节。本地原件以 `.txt` 保存，HTML 模板不会作为网页执行。原件内的历史示例保留为源码上下文，没有导入为本项目已经另行核验的历史事实。

`archive-before.json` 保存接入前完整 Polaris 数据文件清单与摘要。`integration.json` 记录本批范围；其余候选文件记录研究依据和待核边界。

## 已通过的验证

1. `node scripts/validate-polaris-vocabulary.mjs`：173 变量、19 原码、21 结果字段；只允许有据的显示变更，其他词汇/单位/原标识一致；17 个待核判据、过渡方向、旧标签组合及深冻结检查通过。
2. `node scripts/validate-polaris-polity-names.mjs`：真实索引全部 626 阶段的显示、检索和注释；12 类身份/来源绑定不一致的回退检查，包括独立把秦的起始年改成前 221 年后应回退原名。
3. `POLARIS_SEMANTIC_REPORT=docs/verification-3.39/semantic-evidence/verification.json node scripts/validate-polaris-semantic-evidence.mjs`：8 原件的字节数与 SHA、91 次精确文件行引用、代码方向和完整名称文字依据、643 个原始数据文件的完整清单与 SHA 全部通过。

这些检查证明解释和原件的对应及数据保留，不证明每一条历史编码已经独立考证。网页交互、浏览器截图和全套测试由主代理汇总。
