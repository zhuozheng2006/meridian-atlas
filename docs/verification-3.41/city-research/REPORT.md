# 3.41 城市补充：西贴与三波坡雷古

已集成两条独立的 `attested-site`，遗址层由 12 条增至 14 条。原 12 条记录及原 18 项交接审查 ledger 保持原样；新增两项使用补充审查 ledger 和版本化证据目录。中英文介绍随遗址记录内置，署名为 UNESCO World Heritage Centre。

| 条目 | 显示筛选期 | 历史含义 | 坐标来源 |
| --- | --- | --- | --- |
| 西贴古城 / Si Thep | 501—1000 | 来源所述6—10世纪陀罗钵地文化时期；未设建城或弃城年 | UNESCO 1662-001 古城组成部分代表点，N15 27 56.94 E101 9 4.01 |
| 三波坡雷古（伊奢那补罗） / Sambor Prei Kuk (Ishanapura) | 601—1100 | 来源明确的7—11世纪寺庙修缮与改建阶段 | UNESCO 1532 寺区代表点，N12 52 21 E105 2 35 |

三波坡雷古的都城背景原文只限定至6世纪末与7世纪初，因此保留在正文，没有推导建城年或都城起讫年。地图坐标代表寺区；有护城河的古城遗迹在寺区以西。两个条目均不宣称连续逐年居住，也未添加人口估算或边界几何。

## 获取与证据

- 主来源：[西贴遗产页](https://whc.unesco.org/en/list/1662/)、[西贴组成部分坐标表](https://whc.unesco.org/en/list/1662/maps/)、[三波坡雷古遗产页](https://whc.unesco.org/en/list/1532/)。
- 原始 HTML 请求返回403；未绕过。可访问的 web 工具完整提取结果已经原样保存，明确标记为“网页文字提取及工具元数据”，并非原始 HTML 字节。
- 两份已使用快照共55,323字节；每份字节数与SHA-256见生产 `public/data/research-evidence/cities-3.41/catalog.json`。7项 `claim-evidence.json` 给出来源URL、原文定位、行号、直接证据关系和语义。西贴坐标单元格的换行合并已显式注明。
- 证据复核覆盖名称、来源日期、组成部分ID、DMS转换、世纪转换、历史活动类型、来源文本和代表点范围。未获取可用PDF，因此本批没有宣称PDF页图复核。
- 另实际获取 Hall/Penny/Hamilton (2018) Koh Ker PLOS HTML，270,697字节，SHA-256 `1490d5be21572c2916ba95e5ef699163ae95ba7a8efdbeb238a05918df4d75d4`。论文中的返迁年份与UNESCO说明不一致，且取样点无法作为城市定位使用，故本轮不进入生产数据；原文件和请求状态留在工作目录。

## 原数据重合审查

五组资料共21,029条原记录（Pleiades索引11,328、人口观测2,040、历史首都307、现代城市7,342、既有遗址12）。两条候选均无名称或别名匹配，20公里内也无既有点。西贴最近记录为华富里，约93.1792公里；三波坡雷古最近为磅同，约24.4456公里。详见 `coverage-overlap.json`；近邻不用于身份合并。

## 代码与验证

- 改动：`editorial/attested-places.json`、`scripts/places/build-attested-places.mjs`、`scripts/places/validate-attested-places.mjs`、生成遗址gzip、新证据目录及原有构建报告。
- Builder分别核对旧交接研究与新仓库内证据；验证器新增快照字节/SHA、DMS、组成部分ID、来源URL、日期含义检查。原审查ledger仍为18项，补充2项，总审查20项。
- `validate-attested-places`：13/13通过；`validate-places`：20/20通过，包括实际城市模块载入、源期前后边界过滤、现代资料隔离与搜索行为。
- 生成遗址gzip为25,461字节。具体SHA与原条目不变断言见 `integration-report.json`。全站测试、版本资源指纹、浏览器验收及交接由根任务处理。
