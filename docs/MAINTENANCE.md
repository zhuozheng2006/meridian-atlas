# 维护与复现 / Maintenance and reproduction

应用使用静态 HTML、CSS、JavaScript 和 MapLibre GL JS，不需要账户、数据库、API 密钥或构建工具。所有运行资源均在 `dist` 中。在线版仍受托管服务的访问权限控制。

## 修改事件

编辑 `dist/data/events.json`。每条记录必须有唯一 `id`，双语 `title`、`summary`、`significance`，`start`、`end`，经纬度 `lon`、`lat`，`region`、`category`、`precision`、`locationType` 以及 `sources`。

- 年份负数为 BCE、正数为 CE；禁止 0。区间包含两个端点。
- `precision`: `year`（年级节点）、`circa`（约略年代）、`range`（历史过程）。
- `locationType`: `site`（相关地点）、`representative`（代表点）。经纬度不可冒充事件完整范围。
- 地区：`east-asia`, `southeast-asia`, `south-asia`, `west-central-asia`, `europe`, `africa`, `americas`, `oceania`, `global`。
- 类别：`politics`, `war`, `culture`, `science`, `trade`, `society`, `religion`, `disaster`。
- 来源至少有 `title` 和 HTTPS `url`。核对正文支持的日期和事实；无法访问的来源应记录待核查状态。

运行 `npm test`。这会校验结构、日期、几何引用和内容完整性，不会替代历史事实审稿。改变版本、条目数或疆域来源时也需更新测试中的版本基准和审计说明。

## 重建疆域

现成资源已能运行。只有修改数据处理方式时才需要以下步骤。

在 `scripts/boundaries` 下创建 Python 环境并安装 `requirements.txt` 中固定版本。`source.json` 保存了原始项目的固定提交、下载 URL 与 SHA-256。原始约44 MB ZIP和165 MB GeoJSON未重复放进交付包。

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python download_source.py
.venv/bin/python build_assets.py
.venv/bin/python refresh_catalog_labels.py
.venv/bin/python validate_assets.py
.venv/bin/python validate_labels.py
.venv/bin/python verify_manifest.py --rebuild
.venv/bin/python verify_manifest.py
```

默认使用包内冻结的名称、文章关联与人工译名缓存。`fetch_labels.py`、`fetch_wikipedia_identity.py` 可刷新缓存，但在线结果可能变化，必须重新审核。`build_assets.py` 的初始标签未经过身份核对，**必须**紧接 `refresh_catalog_labels.py` 才可发布。

检查 `assets/production-manifest.json` 后，把清单里的文件和清单本身复制到项目 `dist/data`，不要覆盖事件库或现代海岸线。重新运行 `npm test`。构建时间会变化，所以重新构建不保证 gzip 字节完全相同；每次发布均保留对应的新清单。

## 精度与争议

上游原名、原始区间、原始身份链接、面积均保留；经核对的实体另存 `verifiedWikidata`。确认错配与待核查状态须分别展示。禁止把缺失疆域补成推测边界，也不可把现代国家图层套到古代。显示几何简化和数据结构校验，不构成史学核验。

升级到新的疆域版本时，应逐一比较新增、删除、年份、名称与几何变动，并修订已知问题清单。要达到研究级精确程度，需要区域历史专家、逐条参考文献、版本化纠错和多源边界重建；当前版本尚未达到这一标准。

## Validation commands

`npm test` runs integrity and calendar checks without network access. `python3 serve.py` serves the packaged application. Use a current browser with WebGL and DecompressionStream. Desktop and phone layouts, language switching, comparison, story navigation and coverage notices were checked in the delivered version; details are in `VALIDATION.md`.


## 2.0 数据层与重建

`dist/data/catalog.json.gz`保持源档案的完整版本；日常首屏使用`fast/catalog.json.gz`，完整记录按256条分片读取。`scripts/build_fast_assets.py`读取既有边界数据，生成0.16°概览、11个常用年份的启动几何及简体名称；放大后继续使用既有0.02°边界分片。构建依赖Shapely与OpenCC Python Reimplemented，已验证版本分别为2.0.7与0.1.7。转换前后记录ID、有效区间、类型与几何关联必须一致。概览简化导致无效形状时回退到可用输入，原有13条问题记录保留。

事件编辑完成后同时更新`events.json.gz`，推荐`gzip.compress(bytes,mtime=0,compresslevel=9)`。保持原事件ID稳定，重复主题需人工核对，新增标题、摘要与意义应成对提供中英文。对中文显示文本运行OpenCC t2s检查并人工处理术语。

国家补充数据采用`profile-index.json.gz`、`profiles/Q*.json.gz`与`narratives.json`。精确名称与QID匹配后仍需检查年代：`temporalCompatibility.status=potential_conflict`的记录屏蔽补充实体资料。文明短文同时校验QID、源名称、recordIdsOverlappingScope和当前年份是否落在scope内。主文只采用qualified/unscoped/dated_entity_fact中的有效value声明。标为“所选年代”还需明确有足够精度的起止年或匹配时间点。

运行`npm test`可检查原始档案完整性、新旧目录一致性、启动年几何、数据分片、BCE/CE日期运算、叙事时期约束及未引证声明隔离。发布前另做桌面、手机、国家分栏、事件、语言切换与年份对照的浏览器检查。`docs/VALIDATION.md`记录实测证据；静态字节减少不能直接当作所有网络环境下的加载时间倍率。
