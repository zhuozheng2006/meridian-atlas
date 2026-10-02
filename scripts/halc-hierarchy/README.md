# HALC 1500 地区归属组与去重边界线

发布资产位于 `public/data/halc-regions/`。构建器另生成的 5,967,856 B canonical
GeoJSON.gz 仅供研究审计，不用于网页首屏；原 HALC 地方瓦片保持不变。
以下重建命令在本脚本目录运行，输出路径由参数指定。

## 发布接口

- 请求 `data/halc-regions/tiles/{z}/{x}/{y}.pbf`，z6–10，extent8192，buffer64。
- `halc_regions` 是点击/查询用面；属性 `gid, ADM1, shared, memberCount,
  ADM0Values, ADM0Codes`。最后两项是 JSON 字符串；不应把分号归属拆为一个主权国家。
- `halc_region_edges` 是统一描边用去重线网；属性 `kind=adm1-boundary,
  snapshotYear=1500`。不要对各面再描一遍边，也不要按 shared 改成虚线。
- `groups-index.json.gz` 为目录及成员表，gzip 53,105 B（JSON 134,990 B）。
  顶层 `groups[gid]` 有完整 ADM1、ADM0Values、ADM0Codes、TYPECounts、
  QUALITYCounts、fids、bounds、representativePoint、numericId。
- 地区 ID 是原完整 ADM1 字符串 SHA256 的前16位，前缀 `halc1500-adm1-`；
  面的数字 feature ID 使用前13位十六进制，保证小于2^52。共有顺序保持原样。
- `manifest.json` 列出每张瓦片及 index、NOTICE 的 SHA256。
  外置 `halc-regions.integrity.json` 再固定包括 manifest 的全部817份资产。
  每一个来源范围内的矩形瓦片坐标均存在，包括有效空瓦片。

## 实测规模

源数据14,863条；纳入14,145条，排除718条；152组，其中98组有分号归属。
TYPE8与含XX的记录仍在原地方图层。XX没有合成国家。完整面成员信息保留。

| 项目 | 结果 |
|---|---:|
| 发布文件 | 817 |
| 发布总字节 | 6,786,176 |
| 双层 MVT | 814 张 / 6,583,317 B |
| 有效空瓦片 | 449 |
| 最大瓦片 | 586,341 B |
| 地区面实例 | 1,919 |
| 去重线网实例 | 360 |
| 双层构建时间 | 93.193 秒 |

152组在z6–10每级均出现。每个非空线层只有一个线网feature。
以上时间为本机运行记录，不是终端设备加载时间保证。

## 可移植文件与推荐仓库位置

构建工具可完整放入 `scripts/halc-hierarchy/`：

`halc_geometry.py`, `build_halc_hierarchy.py`, `verify_halc_hierarchy.py`,
`halc_region_edges.py`, `build_halc_region_tiles.py`, `finalize_halc_regions.py`,
`verify_halc_region_tiles.py`, `requirements.txt`, `NOTICE.txt`。

将轻量的 `verify-halc-regions-data.py` 放在 `scripts/`；将
`halc-regions.integrity.json` 与 `tiles-edge-verification-report.json` 放在
`scripts/data-integrity/`。报告可以重命名为 `halc-regions.geometry-audit.json`，
但不要编辑其字节。报告记录完整性表 hash，防止校验仍指向旧资产。
源码与报告均无需作为网页静态资产发布。

建议 npm test 中运行（仅 Python 标准库，无 GIS 依赖）：

```sh
python3 scripts/verify-halc-regions-data.py \
  --data-dir public/data/halc-regions \
  --integrity scripts/data-integrity/halc-regions.integrity.json \
  --audit scripts/data-integrity/halc-regions.geometry-audit.json
```

可加 `--public-dir public --max-public-files <实际托管限额>` 检查总静态文件预算。
限额没有硬编码；当前批新增817份。源码完整性检查不是重新计算历史正确性。

## 重建与完整审计

Python3.9+，使用 requirements.txt 中固定版本；原始GPKG必须匹配固定来源SHA1。
`--source`、`--canonical`、`--output`、`--report`均使用显式路径，无本机绝对路径依赖。
输出目录必须新建或为空。脚本不会下载或修改源文件。

```sh
python3 build_halc_hierarchy.py --source HALC-1500.gpkg \
  --output canonical --report canonical-build.json
python3 verify_halc_hierarchy.py --source HALC-1500.gpkg \
  --publish canonical --report canonical-audit.json
python3 build_halc_region_tiles.py --source HALC-1500.gpkg \
  --canonical canonical --locality-manifest HALC-locality-manifest.json \
  --output regions --report regions-build.json
python3 verify_halc_region_tiles.py --source HALC-1500.gpkg \
  --data-dir regions --integrity halc-regions.integrity.json \
  --canonical canonical --geometry --report regions-geometry-audit.json
python3 verify-halc-regions-data.py --data-dir regions \
  --integrity halc-regions.integrity.json --audit regions-geometry-audit.json
```

`build_halc_region_tiles.py` 通过既有地方图层 manifest 读取相同source bounds与
tileRanges；`halc-regions.integrity.json` 自动写在构建report同目录。
浮点序列化不截断为6位；gzip mtime固定为0；性能计时只写外置报告，不污染资产。
NOTICE位于脚本旁，构建时复制进入资产并纳入hash。

## 几何验证与边界

每组canonical严格等于其完整成员在既有z10格点量化后、清除precision模型后
的无二次snap集合并集，其面积及边界均独立核对。分组后再合并与一次性总合并
存在6.912723761031553e-9格点平方的浮点结合性残差，报告保留严格相等false；
未为通过审计更改成员或手补源边界。源坐标量化前后的面积差逐组列于canonical
manifest，最大小组对称差为原面积0.4399975724%。这不是历史精度评价。

网页瓦片分别按每一级相同原始输入投影格量化、聚合和裁剪。union的新交点可以
为分数格点，瓦片裁剪会再量化。三张最密z10地方瓦片比较发现9/19/18格点平方
的内部细缝/小孔差异，外环离散Hausdorff均0；报告未把抽查外推为逐点全等。
低zoom本来可能丢失微小部分，放大z10不会增加源信息。

线网从全图地区边界生成再裁剪，不从裁剪后面外环提取，因而不添加瓦片框伪边。
全局union和裁剪后的去重使用显式整数格。该独立线量化可能与查询面的边界略异。
每张瓦片的规范方向重复片段数及总线长减去唯一线集合长度均验证为0。地区
归属面仍保持独立；线网合并不改变归属或把共有地区变为一个主权实体。

完整几何审计重新从GPKG计算每级地区组，并检查全部面瓦片与裁剪后参考集合和
边界相等，全部线瓦片与参考线网相等；还记录再量化面积差及离散Hausdorff。
离散Hausdorff不是连续误差上界，微小孔洞消失也可能使该数值显著变大。

## 来源与许可

Rombert Stapel, HALC v15, DataverseNL，DOI https://doi.org/10.34894/BTKFHV 。
GPKG原件 https://dataverse.nl/api/access/datafile/639014 ，代码本
https://dataverse.nl/api/access/datafile/639016 。数据与派生资产 CC BY-SA4.0。
完整署名、许可、变换、覆盖限制在发布NOTICE。1500年的低地国家地区重建不覆盖
瑞士、巴伐利亚及阿尔卑斯，不能用它声称补全用户截图的国家疆界。
