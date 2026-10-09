# 3.47 城市资料候选交付

本批新增大津巴布韦、蒂瓦纳科、杰内杰诺三处独立遗址记录及简体中文、英文篇章。已完成隔离构建和真实模块回归；未修改主仓、未操作浏览器或 Sites。集成文件见 `COPY-MANIFEST.json`，仅复制其列出的 `integration/` 文件。

## 覆盖结论

审查基线为 3.46、提交 `25ba64cd5eac5a41b2e4bb6ac38f5fad959bce45`。覆盖审计读取了 10 个归档，包括 11,328 个历史地点索引、2,040 个城市人口记录、307 个首都关系、7,342 个现代参考城市、17 篇原城市篇章、14 个有据遗址、13,765 个地图政体、626 个 Polaris 阶段、373 个 Equinox 政体及 900 篇政体概览。完整命中内容与原件 SHA 见 `coverage-audit.json`。

这三个城市在原 17 篇城市篇章及 14 个有据遗址中均缺少独立阅读入口，但并非没有相关资料：

- 大津巴布韦已有 Pleiades 点，原记录分期为 1700–2100；Chandler 有 1300、1400、1450 年人口观测。Polaris 已有 `zi_great_zimbabwe`（1270–1550）。新增条目补主要建筑阶段、空间结构、生产贸易与保护实践。
- 蒂瓦纳科已有 Chandler / Modelski 人口观测，Polaris 已有 `bo_tiwanaku_2`（800–1149）。新增条目补规划城市阶段、农业与排水、公共建筑及馆藏器物比较。
- 杰内杰诺已有 Polaris 的四个阶段（起于 -250、最晚至 1300）及 Equinox 相关研究记录；地图原有现代杰内点。Chandler 的 `chandler:382` 虽含 Jenne 别名，坐标落在塞内加尔，不能据此认定同址。新增条目采用 UNESCO 的单独组成部分及城址考古报告。
- 麦罗埃已有具古代分期的 Pleiades 记录，库施政体概览也涉及它，本批优先上述三处城市阅读缺口。原资料均保留。

搜索命中只用来定位候选。现代国家名、正文提及、同音别名和相邻坐标均未据此合并身份。

## 坐标与年代

| 独立记录 | 筛选范围及含义 | 坐标证据 |
|---|---|---|
| `attested:great-zimbabwe` | 1100–1450，UNESCO 主要建筑阶段 | UNESCO 364：S20 16 16.212 E30 55 59.768 |
| `attested:tiwanaku` | 400–900，UNESCO 规划城市阶段 | UNESCO 567：S16 33 18.011 W68 40 23.801 |
| `attested:djenne-jeno` | -200–1400，麦金托什二人报告第 3 页的居住阶段 | UNESCO 116-001：N13 53 24.92 W4 32 25.6 |

所有坐标都是遗产代表点，精度保持未知；没有添加城界、首都绑定、人口插值或政体疆域。现代杰内是不同组成部分 116-004。

大津巴布韦 2025 年 Met 专文给出 11–17 世纪居住范围，与建筑阶段分开说明。蒂瓦纳科 500–900 的文化鼎盛期、400–900 城市阶段、500–1000 馆藏器物断代分开保留；克罗杯编号 1978.412.214 的馆方地点是 Bolivia or Peru，没有声称出土于本城。杰内杰诺的 UNESCO 遗产群概括和 Polaris 分期也没有被考古报告范围覆盖。

## 来源证据

核验了 UNESCO 三处遗产页面与杰内组成部分坐标表、Met 两项馆藏/研究材料、NMMZ 管理机构页面和 Rice 考古报告。公开集成目录提供 8 份带哈希的短摘录元数据、15 条字段/段落证据对应、准确 URL、阅读日期与版本信息。完整取得的表现保存在本地 `evidence/raw/`。

Rice 报告原 PDF 共 12 页，作者是 Susan Keech McIntosh 与 Roderick J. McIntosh。标题页称为 2001 年会议论文，但现存文件引文含 2003 年材料；PDF 元数据创建于 2017、修改于 2020。因此明确记作后来存档版本，没有把会议时间当作精确出版年。第 3–6 页已逐页渲染并阅读，文本抽取与原 PDF 各有独立 SHA。

实际 HTTP 原字节取得两份：Rice PDF、NMMZ HTML。UNESCO 原 HTML 返回 403、Met 返回 429，未重试绕过；两者保留可访问的 web 工具抽取结果，并明确标识“不是原始 HTML”。`verify_archive.py` 校验 8 项归档、短摘录实际存在及两份原始响应；结果见 `archive-verification.json`。

公开集成文件使用原创双语综合及有限短摘录。本地保存的全文表现、PDF 和页面图不在发布复制清单中。

## 公开竞品核查

2026-10-10 读取 [Chronosphere](https://worldbyyear.com/) 的公开 Sources 说明，看到其分别列出 Chronas、CShapes、CHGIS、historical-basemaps、Cliopatria、Wikidata 等数据来源，并说明争议和手工修订。对本批的借鉴是把数据来源及其不同时间含义清楚拆开；没有把其宣传覆盖量当作史实证据，也未测试其交互。

[Phersu Atlas 来源页](https://phersu-atlas.com/main/about/sources) 本次返回 403，已保存失败结果，未绕过，也没有根据这次受限访问声称完成对其资料覆盖的比较。

## 验证与集成

- 原有据遗址验证：13/13；记录由 14 增至 17，仍为 2 个增强、4 个延后候选，复核账目由 20 增至 23。
- 新来源及实际模块回归：7/7。检查全部旧条目保持相同、9 个旧归档原字节 SHA、源文摘录哈希、独立 DMS 运算、年份端点/BCE–CE/零年、真实 `loadPlaces` / `searchPlaces` / `attestedChapter`、中英文别名和邻近记录不继承篇章。
- 原地点模块：20/20；城市时间语义：22/22；原城市篇章：10/10。合计 72 个检查通过。
- 构建后 `--check` 通过；生成 `attested-places.json.gz` 为 32,496 B。原日志中 `chandler:245` 是既有未解析近邻提示，本批没有新增未解析项。
- 本地归档校验：8/8；2 份原始 HTTP 响应。

代码变更仅使构建器支持额外的来源目录，并更新有据遗址固定计数。旧的 `cities-3.41` 目录及其测试仍单独保留，没有改写。网站阅读器文件没有修改。

集成后，在主仓执行：

```sh
node scripts/places/build-attested-places.mjs --check
node scripts/places/validate-attested-places.mjs . docs/verification-3.47/attested-places.json
node scripts/places/validate-cities-3.47.mjs . docs/verification-3.47/cities-source-runtime.json
node scripts/validate-places.mjs
node scripts/validate-city-time.mjs
node scripts/validate-city-narratives.mjs
```

把第三条加入主仓 `package.json` 的测试链；本候选未覆盖发布代理正在修改的 package 文件。复制前按清单的 `baseSha256` 检查目标内容，复制后核对候选 `sha256`。`fixture/` 只是隔离测试夹具，其符号链接指向只读原输入，不应发布。
