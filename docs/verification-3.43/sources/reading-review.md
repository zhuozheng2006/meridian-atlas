# 3.43 亚洲原典导读候选

已完成有界资料补充：**2 份真实保存原件，5 张简体中文/英文导读，2 个此前没有导读的阶段，7 个唯一观察行**。未改生产文件、数据生成器、包信息或现有来源。

## 来源与保存状态

| 原件 | 保存字节 | SHA-256 | 取得状态 |
| --- | ---: | --- | --- |
| [耶鲁 Avalon《汉谟拉比法典》，L. W. King 英译](https://avalon.law.yale.edu/ancient/hamcode.asp) | 74,531 | `93410a95441d28fd498df423ec7860ae5ee821df3811989bb469838075c9eb12` | HTTP 200；原始 HTML 字节，扩展名 `.html.txt` |
| [哥伦比亚大学《大化改新诏》选段](https://afe.easia.columbia.edu/ps/japan/taika.pdf) | 156,793 | `50e07d44b8da624ff3a48bfebc3ae495636eee30941fa11b580231009f5c57de` | HTTP 200；5 页原始 PDF |

合计 **231,324 B**。两源均实际浏览核验后直接从大学网站取得，未绕过访问限制。HTML 包含序言、法条及结语；PDF 是编者 David J. Lu 1997 年《Japan: A Documentary History》27–29 页的教学选段，含导言、短选段、问题和长选段，非整本书。

Yale 页面只标明 L. W. King 译者，没有给出译本出版年；候选 `year: null`。不能把同站 Horne 导言的 1915 年、网页版权年或本次访问日期当成 King 译本年份。集成时应让 `readingByline` 省略空年份，避免界面显示 `null`。

## 准确关联

阶段身份来自当前固定 Polaris 快照 `cf60c9f76eed…`。完整源行、类型、原值与空值保存在 `claim-evidence.json`。

| 阶段/导读 | 原行（Social complexity） | 原值 | 阅读定位 | 关系 |
| --- | --- | --- | --- | --- |
| `iq_babylonia_1` 裁判与证人 | 7097 formal_legal_code；7596 judge | P；P | 法条 5、9–12；原始 HTML 63、67–70 行 | comparative-reading |
| 同阶段 水渠与邻田损失 | 8932 irrigation_system | P | 法条 53–56；HTML 112–115 行 | direct-evidence |
| 同阶段 商人与交易凭证 | 13351 written_record | P | 法条 104–107、122–124；HTML 132–135、151–153 行 | direct-evidence |
| `jp_asuka` 里坊与驿传 | 2461 administrative_level；23006 postal_station | 5–6；P | 长选段第二条，PDF 3–4 页；脚注参见第 2 页 | comparative-reading |
| 同阶段 户籍、土地与赋役 | 13418 written_record | P | 长选段第三、四条，PDF 4 页 | direct-evidence |

上述观察行的 `year_from/year_to` 全为空，保留原样。阶段行分别为 Polities 402 / sourceNumber 479 / `-2000` 至 `-1600` / Mesopotamia / Southern Mesopotamia，以及 Polities 142 / sourceNumber 146 / `538` 至 `710` / Northeast Asia / Kansai。没有用诏令的 646 年覆盖飞鸟阶段范围，也没有为汉谟拉比材料捏造精确编成日期。

关系是独立研究导读：`sourceLineageEstablished`、`allowRecordMerge`、`allowRawRewrite` 全为 false。法条或诏令能够支持读者研读所表述的制度，不能据此自动认定职业法官的专职性质、5–6 层行政结构、驿站实际建成或全国一致执行。范围说明集中保存在来源与核对信息，卡片正文采用自然的导读语言。

## 验证

`verify.py` **84/84 通过**：原件大小/哈希、2 新阶段零旧导读重叠、5 卡全部原行对象逐字段一致、阶段身份、作者/年份/来源一致、11 段短定位词以及 PDF 页码有效性。HTML 定位另外保存真实 UTF-8 字节区间和片段 SHA；PDF 定位保留页码、条款及提取文本 SHA。

PDF 1–5 页均经 Poppler 渲染并实际目视检查，原件书目、页号、第二条跨页、第三/四条以及回指脚注均确认。第 5 页确为上一页关于宫廷女侍口粮的续文，没有拿它补证另一内容。pypdf 提示 4 个旧对象偏移有误，但 5 页均可提取、渲染；未修改或修复原件字节。

复核命令（使用带 `pypdf` 的 Python）：

```sh
python3 verify.py /path/to/world-history-atlas
```

可另外传入证据目录和报告路径，复核最终复制的资产。`prepare.py` 只会在自身目录写候选，不应移入生产生成链。

## 集成边界

建议复制 `catalog.json`、`sources.json`、`claim-evidence.json`、`manifest.json`、`coverage-audit.json` 与 `sources/` 至新的 `public/data/research-evidence/readings-3.43/`。保留旧 3.39/3.40 目录逐字节不变。页图、脚本和报告是工作核验材料，可以放入 docs 核验目录。

完整集成后为 **30 卡 / 11 阶段 / 12 来源**，原始观察数不增加。应调整合并目录和相关总数断言，并验证两个新阶段的记录跳转与 PDF 页码链接。空年份渲染需处理；页内 HTML 原典抽取/阅读器接入可由根任务决定，本批尚未实现。仍不等于覆盖全部亚洲、全部法典条文的中文翻译或对 Polaris 编码细则的独立重建。
