# HALC 地区轮廓与分层显示 · 3.9.1

本次改进使用现有 HALC v15 的1500年地方单位，按原始领地归属组织地图的阅读层次。远观显示地区轮廓与地区名称，放大后展开地方细线；点击地区名称进入当前视野内的地方目录。地方记录的属性、几何瓦片、独立详情和来源链接保持原样。

## 分组含义

分组键是完整的原始 `ADM1` 字符串。分号、并列成员及原顺序均保留，`AA;BB` 与 `BB;AA` 不自动合并。包含 `XX` 的地方记录和 `TYPE=8` 自然要素不参加地区合并；它们继续通过地方资料层显示。没有把小型独立领地合为一个国家，也没有把显示分组赋予新的主权含义。

共14,145个地方单位构成152组，718个单位不参加合并。每组保存所有成员的 fid、原始 ADM0 值、类别计数与重建依据分布；同一组中多个 ADM0 值保持完整。轻量索引供维护与核对，地图仅按当前视野读取显示瓦片。

## 几何与描边

各缩放级别分别从同一原始 GeoPackage 投影并量化，与原地方瓦片使用相同的全局整数网格、8192 extent 和64单位缓冲区。组多边形是该级成员的集合并集，没有人工补边或曲线平滑。保留网格坐标后清除精度模型，再作集合并集，避免反复施加精度网格造成累计面积变化。

`halc_regions` 多边形用于视野查询和地区标签。`halc_region_edges` 单独保存去重后的边线，在全局轮廓上消除重复共边，再裁剪至各瓦片；线网不加入瓦片裁剪矩形的边缘。使用统一细线，不以实线和虚线推断不同归属的法律意义。并列归属在目录和原始记录中说明。

组轮廓与原地方瓦片分别经过合并、裁剪和编码。已有三张z10样本比较显示外环一致，内部极薄缝隙和小孔产生9、19、18个网格平方单位的集合差；这来自合并与裁剪次序，不能声称两层所有顶点和微小孔洞逐点相同。放大至z10以上沿用z10瓦片，更多屏幕像素不增加历史史料精度。

## 显示与性能

- 低比例尺从地区轮廓放置标签，放大到地方尺度后从地方记录放置标签。地区名称打开分组目录，地方名称打开具体档案。
- 静止视野复用几何查询与标签排布；视角、缩放、容器尺寸、语言、遮挡控件或数据状态变化时按需重算。
- 两个数据源分别读取。地区轮廓失败时保持地方区划与正在阅读的档案，仅重试失败的轮廓源。
- 收起疆域、离开1500年或覆盖范围、启用现代参照、切换来源时，两层共同收起。迟到的网络结果不能重新开启已关闭的图层。

自动化验证包含原生命周期29项、缓存失效15项和双源交互30项。测试使用实际应用类和独立的各图层查询结果，检查源对象、请求次数、活动状态及档案保留；这些测试不代替浏览器的实际地图检查。报告分别位于 `halc-lifecycle-results.json`、`halc-cache-results.json` 与 `halc-regions-lifecycle-results.json`。

## 来源与许可

Rombert Stapel, *Historical Atlas of the Low Countries (1350–1800)*, v15， [doi:10.34894/BTKFHV](https://doi.org/10.34894/BTKFHV)。本次地区轮廓是原数据的改编，继续采用 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)。发布数据、逐文件清单和转换说明保存在 `public/data/halc-regions/`，原地方资料说明见 [HALC-1500.md](HALC-1500.md)。

这一层覆盖低地国家及邻近地区，阿尔卑斯的1500年国家轮廓仍受既有来源约束。已核查的替代资料尚未形成可直接集成、经过年代与几何验证的开放矢量成果。

English summary: this release derives 152 display groups from complete source ADM1 values, preserving shared affiliations and excluding natural units and XX-coded independent localities from dissolution. A deduplicated edge layer reduces uneven overdraw; locality records remain independently accessible. The two view-loaded sources have independent failure recovery and invalidate cached geometry and labels when the view or source changes. These derived data retain CC BY-SA 4.0 and do not extend HALC coverage to the Alps.

## 发布核验

最终数据包817个文件、6,786,176字节；814张双层瓦片共6,583,317字节，最大586,341字节。独立审计从原GPKG重新计算并核对1,919个面实例、360个线网实例，均与相应裁剪参考集合相等，未发现重复边线。抽查4张瓦片及3对相邻接缝，缓冲交集内线集相等。整数网格裁剪仍可能产生细微取整差，抽查结果不外推为所有斜线数学上绝对连续。

构建与完整审查工具见 `scripts/halc-hierarchy/README.md`；发布时的标准库校验工具为 `scripts/verify-halc-regions-data.py`，核对固定完整性表及已完成的深度审计，不重复宣称进行了新的几何审计。
