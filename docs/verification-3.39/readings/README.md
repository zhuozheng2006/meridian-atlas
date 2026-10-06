# 3.39 研究阅读资料候选包

本目录是供 Meridian Atlas 审阅和接入的资料包，完成于 2026-10-06。本轮只修改本目录，未修改生产数据、运行浏览器或发布网站。

## 内容与范围

- **17 张双语阅读卡**，覆盖明朝、印加及罗马共和国三个阶段，共 5 个阶段。卡片按阶段展开；其背后是 14 项阅读关联。
- **7 个来源**：4 份新取得的 PDF、耶鲁《十二铜表法》转录页面、2023 年危机数据 CSV，以及复用项目已有的 2021 年 Seshat 代码书。
- 5 个阶段原有 697 条观察，本包保留其中 65 条相关原始记录作为定位依据。它们均保留 Polaris 工作表名、原始行号、单元格字符串和源文件摘要。
- 2023 年危机 CSV 的 **169 条记录、22 列**完整保留，另选 5 个相关案例与 Polaris 并列研究。

读者卡分为 2 张 `direct-evidence`、10 张 `comparative-reading` 和 5 张 `earlier-coded-version`。`direct-evidence` 仅指所述制度或概念有独立文献支持；这里没有建立任何“这就是 Polaris 原行引用文献”的结论。

## 接入文件

| 文件 | 用途 |
| --- | --- |
| `reader-reading-candidates.json` | 17 张读者卡；包含 `cards`、`sourceManifest`、`overviewNoteZh` 和 `overviewNoteEn`。卡片摘要和范围说明采用自然简体中文及英文；通用阅读说明集中在顶层。 |
| `sources.json` | 7 项来源的完整元数据，包含字节数、SHA-256、获取地址及记录下来的来源说明。 |
| `source-manifest.json` | 便于构建程序复制来源文件的清单。`localSourceFile` 是本机审阅路径，生产目录应自行转换。 |
| `claim-evidence-candidates.json` | 审核用的 14 项细分关系、精确目标行及严格 `limitationZh`；不必逐项放进主阅读界面。 |
| `target-claims.json` | 65 条未经重写的 Polaris 原始观察及 5 个阶段的元数据。 |
| `crisis-related-cases.json` | 5 个旧版案例、原始字段、65 项码值比较与具体审核问题。 |
| `crisis2023-records.json` | 全部 169 条旧记录的可逆 JSON 表达；异常字节以转义的低代理码点保存，仅供原始数据处理。 |
| `crisis2023-display-cases.json` | 5 个案例的显示投影，说明见下节；可作为研究附件保留，按需取用。 |
| `encoding-audit.json` | 全文件 74 个非法 UTF-8 字节的审计记录。 |
| `verification.json` | 构建计数、相符性检查、此前完成的页面目视复核位置及来源获取结果。 |
| `validation.json` | 本轮 17/17 自动验证结果。 |

四份新 PDF 合计 5,678,307 字节；加 CSV 和原始 HTML，新来源共 **5,971,194 字节**。已有代码书为 11,149,295 字节，应复用现有文件。原始 HTML 建议以 `.html.txt` 保存并供下载，避免在网站同源下执行来源脚本。

## 旧 CSV 的编码处理

固定来源为 Seshat 仓库提交 `1f847d95e224860115a3dc358165380fe5487bcd` 中的 `CrisisConsequencesData_NavigatingPolycrisis_2023.03.csv`，原文件 SHA-256：

`9f7b50a31f249bc0421c96dd958519b6e4d8aa3af56aaceb6aa1215fafc04368`

原文件并非完整有效的 UTF-8。全文件共有 **74 个无法按 UTF-8 解码的字节**，不是 74 条记录，也不全位于这 5 个案例。选中的案例只有以下 **5 个**：

| CSV 逻辑记录号（含表头） | 字段 | 字节 |
| --- | --- | --- |
| 92 | References | `0x87` 两处 |
| 128 | References | `0xE2` 两处、`0x84` 一处 |

5 个案例的 `Notes` 都能按 UTF-8 解码。CSV 含带引号字段，记录号指解析后的逻辑记录，不应当作文本编辑器行号。

采用三层保留方式：

1. `raw/crisis2023-github.csv` 保持逐字节不变，是核验和下载的原件。
2. `crisis2023-records.json` 使用 Python `surrogateescape` 解码，再以 ASCII 转义 JSON 写出；重新解析并按同一策略编码，可恢复每个字段的字节。**勿把包含低代理码点的字符串直接交给 DOM、Blob 或 TextEncoder**，这些 API 可能将它们替换成 U+FFFD。
3. `crisis2023-display-cases.json` 的每个 `fields.Notes` / `fields.References` 同时保存：
   - `text`：显示用字符串，异常字节明确显示成 `[0x87]` 等标记；其余字符保持原样。用 `textContent` 或框架默认文本转义显示，不用 `innerHTML`。
   - `decodedFieldBytesBase64`：CSV 解析后的**字段值字节**，可无损解码；它不是带引号及分隔符的 CSV 片段。
   - `decodedFieldBytes`、`decodedFieldSha256`：字段字节长度及摘要。
   - `undecodableByteCount`、`undecodableBytes`：各异常字节的十六进制值、字段字节偏移、Unicode 码点偏移及显示字符串码点偏移。

所有偏移从 0 开始。码点偏移不是 JavaScript UTF-16 代码单元下标；如需定位，使用 `Array.from(text)`。显示层没有猜测字符集、修复重音符号或替换作者姓名。编码提示可在附件说明中集中展示，只在存在异常的字段旁显示状态。

## 需要保留的具体差异

- **明代人口**：Deng 表格中 1393 年为 60,545,812，1403 年为 66,598,337，1502 年为 50,908,672。Polaris 分别使用 1400 年区间及 1500 年的四舍五入数字。卡片保留登记年份、精度和统计口径；未把两次登记解释为估计误差范围。
- **印加**：Radiocarbon 论文导言采用约 1530 年、1,000 万至 1,400 万人的估计，Polaris 相关行是 1532 年、600 万至 1,400 万。论文导言引用的 2018 年专著尚未取得；不能据此补齐原行出处或范围端点。
- **罗马人口**：Scheidel 讨论公民普查和意大利人口，需与整行政体人口分开读。
- **《大明律》和《十二铜表法》**：可支持成文法典的概念。1397 年版本和公元前 451—450 年传统编纂年代均明示，未自动扩展为整个阶段连续存在的观察。
- **危机旧案例**：65 项字段比较中，CSV 记录 93 的 `assassin=0` 与 Polaris 的 `assassination=P` 不同，旧 `Notes` 又确有凯撒遇刺叙述。这一冲突完整保留。
- **明末旧说明**：原文将三藩之乱平定和 1683 年连写，卡片保留具体年代复核提示；原文不作改写。
- **印加旧说明**：记录 127 的 `References` 只有个人通信，其他书名页码散见 `Notes`；笔记中的 Rowe 2015 与相邻书目 Rowe 2006 存在差异；“秘鲁 900 万”的地域范围也保留。

这些差异在审核层逐项保留；读者卡聚焦阅读内容与具体版本、日期、范围，避免重复通用免责声明。

## 重建与验证

在本目录运行：

```sh
python3 build-evidence.py
python3 validate-evidence.py
```

构建仅读本机文件，无网络动作。它依赖相邻 `semantic-evidence/raw` 中的固定 CSV 及获取日志，以及当前项目 `public/data` 下的 Polaris 和现有码书。来源 PDF 和 HTML 已在 `raw/` 内保留；原始来源 URL、获取日志和摘要见清单。

当前 **17/17** 检查通过，包括所有来源摘要和长度、精确行/阶段/变量关联、169 条原字段一致性、74 个异常字节保留、5 个案例的 10 个字段字节往返、显示标记位置，以及错误摘要、错误阶段、危险 URL、伪造来源身份和静默改字的拒绝用例。自动检查证明文件及关联的一致性，不代替历史解释或每一项书目原文的复核。
