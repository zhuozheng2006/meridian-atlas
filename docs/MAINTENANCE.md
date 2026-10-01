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
