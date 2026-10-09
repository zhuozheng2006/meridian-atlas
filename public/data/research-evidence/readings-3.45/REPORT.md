# 3.45 独立资料包：红海贸易与夏威夷宪政

本目录是待主代理整合的资料交付，未修改主项目，也未操作网站发布。资料实读与字节核验日期为 2026-10-10。

新增 5 张简体中文/英文导读，覆盖两个此前没有导读的 Polaris 阶段：`et_aksum_emp_1`（Axum I，East Africa，原表 −149—349）与 `us_hawaii_k`（Kingdom of Hawaii - Post-Kamehameha Period，Polynesia，原表 1820—1898）。保留全部阶段元数据及 11 条完整、含单元格类型的原始观察记录。

| 导读 | 原文定位 | Polaris 原行 |
|---|---|---|
| 从阿杜利斯港到内陆象牙市场 | 《厄立特里亚海航行记》第4节 | 市场设施9726（IP）、港口11868（P） |
| 货单里的交换方式：铜块、钱币与跨海贸易 | 同上第6节 | 兼作货币的实用品（Articles）19813（P）、外来钱币21066（P） |
| 一部法律如何形成：议事、签署与记录 | 1840宪法，代表机构及立法会议；印刷页13—14 | 正式法律体系7375（P）、文字记录13677（P） |
| 赋税如何逐级汇集 | 税官条款；印刷页14—15 | 行政层级2769（4—4）；专职行政人员5707（1820—1840，SA）、5708（1840—1898，P） |
| 从地方审理到最高法院 | 法官、最高法官及税官末段；印刷页14—15 | 专职法官7853（P）、专用审判建筑8304（P） |

新增覆盖优先填补非洲东北与大洋洲的空白。现有导读基线是 35 张/13 阶段/15 个来源正文；整合后为 **40 张/15 阶段/17 个来源正文**。这仍只覆盖 Polaris 626 阶段中的15个，且没有新增或改写统计观察值。

## 原件与版本

1. [福特汉姆大学托管的 Internet History Sourcebooks《航行记》](https://sourcebooks.web.fordham.edu/ancient/periplus.asp)：完整编号1—66节，页面注明 W. H. Schoff 1912 译编和 Paul Halsall October 2000 电子版。完整原始 HTML 64,323 字节；这是一份保留旧用语的历史译本，不能当作最新批判校勘本。
2. [内布拉斯加大学1840夏威夷宪法转录](https://teachinglegalhistory.unl.edu/s/oer/item/1523)：完整权利宣言、宪法条款、日期与签署人。页面书目指向 *Translation of the Constitution and Laws of the Hawaiian Islands, Established in the Reign of Kamehameha III*, Lahainaluna, 1842。HTML 48,991 字节。没有替网页补造译者姓名。
3. [夏威夷州档案馆扫描件](https://ags.hawaii.gov/wp-content/uploads/2012/09/1840E.pdf)：8页，第一张未见印刷页码，其后印刷页10—16；没有可提取文字层。已将全部8页渲染并逐页阅读，对照相关正文及上下文。PDF 472,891 字节。
4. [夏威夷大学 Punawaiola 版本说明](https://manoa.hawaii.edu/punawaiola/2018/10/09/okatoba-8-kumukanawai-o-ka-makahiki-1840/)：核对1840签署、1841夏威夷语印本与1842英译印本的区别。HTML 38,550 字节。

四份原件共 **624,755 字节**。所有 HTTP 请求实测200；第二次下载的四份正文均与首次原件字节完全相同。获取记录在 `acquisitions.json` 和 `verification/http-acquisition.json`，校验值在 `manifest.json`。保存的 HTML、PDF 及原始数据内容全部未改写；不执行来源网页代码。

## 离线正文与阅读入口

`offline/index.json` 遵循3.44版阅读器 schema，可并入 `build_saved_text_catalog.py` 的来源集合。

- 《航行记》73块，其中3个原始标题、66个完整编号段落、4个来源说明块。全部66节可通过目录访问，两张导读分别落在第4、6节。
- 夏威夷宪法66块，其中15个原始标题；正文从权利宣言到1840年10月8日署名完整保留。三张导读共5个精确标题入口。
- 新增正文共139块、64,707字符。两部完整正文均为已获取的英文版本；新增中文为5张导读，而非宣称整部原典已有完整新中译。
- 若与3.44的6份/845块完整合并，总数为 **8份、984块、16张拥有页内原典入口的导读**。
- 每一块文字都由原始 UTF-8 字节范围、片段 SHA-256 和正文 SHA-256 定位。可以独立重建全部文本并比较完整所选区域，防止只验证抽取器自己的片段而漏掉段落。

## 对读中的关键界限

卡片正文讲述历史内容；详细版本差异和证据边界放在来源/核验文件中。

- Axum I 的原表年代与未标观察年保留。《航行记》的内陆行程不会被换算成现代公路或精确国界；第6节没有列明钱币铸造地。原表市场IP没有升级成P。
- 夏威夷两条专职行政人员记录在1840年端点交叠：SA与P均完整展示。宪法的任命、职责和税收流转可以用于对读，不能单凭这些条款确定全职化或行政层数。
- 法官和法院为比较阅读关联；制度条款不能单独证明专业全职身份、独立法庭建筑或实际案件量。立法与记录簿卡片为所述制度概念的直接文本证据。
- 转录与扫描件存在编辑差异：转录为一条未编号段补上V、漏去贵族段一处“These”、含“Kamehemeha”等拼写/标点差异。来源正文各自保留原样，详见 `verification/hawaii-scan-review.json`。五张导读的实质性叙述已与相关扫描页核对。
- 所有卡片 `sourceLineageEstablished`、`allowRecordMerge`、`allowRawRewrite` 均为false。没有声称这两部原典就是 Polaris 编码者实际使用的文献。

## 复现与整合

在本目录执行（只写本目录，不改仓库）：

```sh
python3 prepare.py /Users/zane/meridian_atlas/world-history-atlas
python3 extract_texts.py /Users/zane/meridian_atlas/world-history-atlas
python3 verify.py /Users/zane/meridian_atlas/world-history-atlas
```

当前验证 **242/242** 通过：四份原件身份、精确类型原行、双1840端点、无既有阶段重复、正文完整重建、66节全目录、全部五卡入口、统一术语与可见司法范围说明，以及8页视觉核对的证据文件身份。自动验证不代替历史批判或屏幕交互验证。

整合建议：把目录复制为 `public/data/research-evidence/readings-3.45/`，登记导读与离线正文集合，增加阅读器允许的 `readings-3.45/offline` 路径，然后由主代理执行整体测试和浏览器核验。`verification/hawaii-1.png` 至 `hawaii-8.png` 是本地视觉核验渲染，可留在版本核验目录而不进入公开静态包；相应验证器在其存在时检验SHA，缺省不要求网站传送这些重复图像。原始PDF及扫描核验JSON应保留。

文件清单见 `delivery-manifest.json`。本目录没有修改站点构建代码，没有替换原始 Polaris 数据。

## 整合前独立术语复核修正

按项目已核对的 Seshat 定义，正式法律体系也可包括统一口传法律，导读不再缩译为“成文法典”；司法原行统一为“专职法官P、专用审判建筑P”，并在可见范围说明中明确宪法适合比较职权和复审程序，专职任职和专用建筑仍需其他材料。其余标签统一为“市场设施”“兼作货币的实用品”“专职行政人员”。这些修改仅调整候选导读说明，不改原典、Polaris 原行或关联关系。
