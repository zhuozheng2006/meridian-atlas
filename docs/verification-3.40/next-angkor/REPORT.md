# 吴哥 2021 补充数据追索交接

结论：**已核实正式附件的存在与名称，但本次未取得原始工作簿或补充 PDF，不能确认坐标字段、坐标系、实际行数或日期列。** 本轮不增加生产数据。

## 正式来源路径

- 论文 DOI：[10.1126/sciadv.abf8441](https://doi.org/10.1126/sciadv.abf8441)。出版页检索记录列 `abf8441_data_s1_to_s17.xlsx`（标示 2.36 MB）与 `abf8441_sm.pdf`（3.69 MB）。这是页面标示大小，尚无实测字节或 SHA。
- [PMC 正文](https://pmc.ncbi.nlm.nih.gov/articles/PMC8104873/) 与 [Europe PMC XML](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8104873/fullTextXML) 均已实际保存。XML 的两个 supplementary-material 元素都仅指向同一个 [出版社 DC1 链接](http://advances.sciencemag.org/cgi/content/full/7/19/eabf8441/DC1)，没有附件二进制地址或 media 元素。
- 出版社当前 DOI 页与上述 DC1 正式链接均返回 403，已停止该路径；没有换身份、Cookie 或参数绕过。
- [Oregon 馆藏记录](https://scholarsbank.uoregon.edu/items/4531bb7d-727f-4115-a844-1c320edbeea7/full) 只列一份主论文 PDF。已用的主论文不能替代附件。
- NCBI OA 旧元数据接口此次返回 404，未取得任何 OA 压缩包。

## 论文与表的对应

已有主论文 PDF 第 6 页可建立以下索引，具体工作簿字段仍待原件核对：

| 表 | 论文描述的用途 | 仍缺的实物核验 |
|---|---|---|
| Data S1 | 有年代的地物及测年依据，文中称 Notes 列记录方法 | 实际列名、坐标、日期类型、重复证据行 |
| Data S2 | 地物清单 | 几何编码、CRS、经纬度或投影单位 |
| Data S3 | 用于相对年代推断的地物关系 | ID 外键、同年代/先后关系的实际表示 |

`paper-mapping.json` 保存页码与待检字段清单；`inspection.json` 保存实际检查结果。论文数字与字段名称只作为作者的说明，不冒充已核验工作簿统计。

这些是寺庙、居住土丘、堤岸、水渠等考古地物。后续适合做可筛选测年依据的局部考古研究层；不能直接当成重要城市目录、吴哥帝国人口普查或国境线。

## 已保存的可复核证据

`raw/pmc-article.html.txt` 和 `raw/europe-pmc.xml` 原字节保存，`sources.json` 有实际字节数、SHA-256、URL 和取得时间。`inspect-repository.py` 可重建结构检查。没有保存伪装成 xlsx/pdf 的错误响应。

## 接续动作

优先从作者公开的正式附件镜像或其他机构馆藏继续查找完整 workbook；也可由用户在正常可访问的出版社页面下载已列附件。本任务未联系作者或发送任何消息。取得原件后先固定字节与 SHA，再检查 S1/S2/S3 的原表结构和关联，最后才考虑派生地理数据。
