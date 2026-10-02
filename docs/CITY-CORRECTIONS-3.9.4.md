# 3.9.4 地点质量复核与已整合修订

复核日期：2026-10-03；审查基线：`cfc1a432`。以下三处修订已整合到3.9.4，原始输入锁未改动。独立审查在工作目录完成，正式项目只纳入构建规则及三个发生变化的派生资产。

## 已纳入的三处修正

| 记录 | 处理 | 影响 | 审核结论 |
|---|---|---:|---|
| `chandler:1457` Tsinkiang | 地图和阅读器显示“泉州 / Quanzhou”；原字段仍为 Tsinkiang / 晋江 | 1 行，27 次人口观测 | 可纳入。依据旧城坐标、原始 Zayton/Chuanchow 别名及官方县治沿革，足以支持显示身份校正 |
| `chandler:715` Kilwa | 从活动城市层隔离，移入带来源与理由的核查档案 | 1 行，7 次人口观测 | 可纳入隔离；暂不支持迁点或将人口赋给另一聚落 |
| `chandler:245` Cahokia | 同上 | 1 行，2 次人口观测 | 可纳入隔离；暂不支持迁点、修改人口估计或合并古城与现代同名城 |

活动人口城市由 **2,042 → 2,040**，活动人口观测由 **10,348 → 10,339**；隔离档案由 **1 → 3 行**、**2 → 11 次观测**。合并活动与隔离数据后，**2,043 行、10,350 次人口观测逐值保留**。迁点 0 处，新增人口值 0 个，新造存续年代 0 段。

## 原始数据与一手证据复核

原始 `chandlerV2.csv` 的冻结 SHA256 为 `5b8df64e46988b216988eef18b46ebc2cba57ecc1adc8a5c2e1e6d5b78068031`，[研究数据 DOI](https://doi.org/10.6084/m9.figshare.2059494)，CC BY 4.0。`audit-source-rows.py` 直接读取原 CSV 的第 245、715、1457 行记录，核对 City、OtherName、Country、Certainty、经纬度和每个有效人口年份，三条共 **36 次观测**均与当前资产及新规则的 `expected` 完全一致。结果见 `verification-3.9.4/city-source-row-audit.json`。

### 泉州 / Tsinkiang

当前源点 `[118.58583,24.913889]`，原别名 `Zayton, Chinchiang, Chuanchow`。重新读取的[鲤城区党史和地方志研究室资料](https://www.qzlc.gov.cn/zjlc/lsyg/)仍记载：711 年改称泉州，718 年晋江县治设于今域。[泉州市建置沿革](https://www.quanzhou.gov.cn/zfb/zjqz/jzyg/200808/t20080827_91181.htm)明确 1949 年晋江县城对应今泉州市区，并记载 1951 年县机关迁至青阳。

[UNESCO 泉州说明](https://whc.unesco.org/en/list/1561/)将 Zayton 与 10—14 世纪泉州对应；[其 Old City 分项 `1561rev-001`](https://whc.unesco.org/en/list/1561/maps/)为 `N24 54 20.4 E118 35 24`，距源点 **1.006 km**。这组资料支持“泉州”显示名；人口数值和城市范围仍采用原研究口径。

新 `datedNames` 明确列出 742—1948 年的 **27 个已有观测年**。742 和 1948 是这条数据的首末观测，不是建城、废弃或改名年；未建立新 `nameTimeline`。不将“刺桐”扩展到全部时期，也不把现代晋江市人口合并进来。时间窗口如借用 1948 年观测，仍标明实际观测年。

### Kilwa

源点 `[38.987675,-9.149644]` 与 [UNESCO 分项 `144-001` Kilwa Kisiwani](https://whc.unesco.org/en/list/144/maps/)的 `S8 57 28.00 E39 31 22.00` 相距 **62.513 km**。[官方说明](https://whc.unesco.org/en/list/144/)将该聚落定位为岛屿港城，给出 9—19 世纪占用、13—14 世纪繁盛；还将主要兴盛于 19 世纪的 Kilwa Kivinje 另列。

定位冲突足以支持暂停空间展示。当前没有查得 Chandler 原书人口条目的确切城市范围或上游定位修正，不能仅凭遗址代表点将七次人口观测迁到岛上。下一批若独立新增 Kilwa Kisiwani，可使用官方世纪级占用与繁盛证据，保持与人口系列分离。

### Cahokia

源点 `[-90.19011,38.57088]` 距 [UNESCO 卡霍基亚土丘](https://whc.unesco.org/en/list/198/)的 `N38 39 31 W90 3 41` **14.841 km**。官方说明将土丘遗址定位于伊利诺伊州 Collinsville；[Illinois DNR](https://dnrhistoric.illinois.gov/experience/sites/site.cahokia-mounds.html)也明确这一遗址位置与考古范围。原 CSV 的 `OtherName=Missouri` 是有歧义的地点备注。[州历史学会保存的原址标牌转录](https://www.historyillinois.org/historical-markers/cahokia,-illinois)明确区分同名村庄与其东北方的土丘区。

来源年代并不完全一致：UNESCO 主描述为 800—1400，价值说明为 800—1350；DNR 给 700—1400。此批未选择一个“正确废弃年”，也未用官方 1—2 万人口估计覆盖 Chandler 的 1100 年 4 万及 1400 年 4 千。遗产代表点和原人口城市范围未获直接绑定，故采取隔离而非迁点。

官方代表点的 DMS→十进制度换算与球面距离可复算，详见 `verification-3.9.4/city-source-row-audit.json`；小数位是换算结果，不表示考古定位精度。未逐页读取原始 Chandler 印刷版是目前的证据限制。

## 已整合文件与验证

- 构建规则：`scripts/places/build.py`、`scripts/places/rules/urban-quarantine-rules.json`、`scripts/places/rules/dated-place-names.json`。显示规则绑定原始行；名称、别名、坐标或人口漂移会停止构建。
- 派生数据：`public/data/places/urban-observations.json.gz`、`urban-quarantine.json.gz`、`city-sources.json.gz`。完整重建的其他51个压缩资产逐字节一致。
- 正式回归：`scripts/validate-place-corrections.mjs`，实际调用地图与政体地点模块，11/11通过。无Git、无原始CSV的源码副本同样通过；人口、坐标、名称规则三种破坏性负例均正确失败。
- 本版完整 `npm test` 通过，日志在 `docs/verification-3.9.4/full-test.log`；城市结果在同目录 `city-corrections.json` 与 `city-runtime.json`。
- 原始行核对见同目录 `city-source-row-audit.json`，构建绑定检查见 `city-builder-guards.json`。

不需要额外渲染修改：地图、搜索与政体阅读器共用 `placeName()`，核查记录从活动城市加载中排除，原始行继续保留。此批城市修订的正式验收为实际模块测试；没有把本版地貌浏览器截图当作城市端到端视觉证据。
