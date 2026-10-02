# 地区详图连续浏览 · 3.9.2

此前，已经显示的地区详图只要请求新的图块，就会关闭自身并切回全球概览。放大或平移时因此出现两套不同来源边界来回切换。实际浏览器中暂停新图块请求后，可以持续观察到这一状态。

本版将“保持已载入地图可见”和“当前视野已完整读取”分开处理。同一年、同一来源且持续处在有效覆盖范围内时，地图保留已经载入的地方边界与地区轮廓，新图块继续补入。状态文字显示“正在补齐视野”，直到完整读取后才更新可见区划数量和标签。

## 阅读与切换

- 已打开的地方档案保持可读，选择高亮继续沿当前已载入的几何显示。
- 已打开的目录保留上次成功载入的记录、搜索内容和阅读位置，计数明确标注为“上次载入的地方记录”。仅改变加载说明时不重建列表按钮，避免丢失键盘焦点。
- 更新期间点击已载入的区划直接打开该条记录；地区分组目录在完整视野恢复后继续可用。
- 地区轮廓与地方记录分别更新。仅地区轮廓出错时保留地方图，并可单独重试；地方图本身出错仍回退到概览。
- 离开1500年、覆盖范围或地区比例尺，切换来源，收起疆域，或开启现代参照时，保留状态立即失效。迟到的网络结果不会重新打开旧地图。

保留的几何由地图自身的图块缓存继续绘制，没有复制另一套静态多边形，也没有把上一次视野的记录数量当作新视野的完整数量。尚未载入的位置可暂时只显示地理底图。

## 核验

浏览器测试使用开发工具暂停两个 HALC 数据源的新图块请求，在等待期间检查边线、状态文字和已打开档案，再放行并确认新视野完整恢复。测试结束后取消全部拦截，恢复正常网络行为。

自动化测试针对实际应用类，覆盖连续显示、首次加载、记录保留、数据源完成顺序、六类退出条件、错误与重试、缓存失效、独立双图及销毁后的迟到回调。测试报告随源码保存。数据资产与历史资料范围未因这一显示改进改变。

English summary: panning or zooming no longer hides a successful HALC view while new tiles load. Existing boundaries, the open record and previously loaded directory records remain available. The interface distinguishes an updating view from complete coverage. Leaving the valid year, source or coverage invalidates the retained state, and late responses cannot reactivate it.

## OpenHistoricalMap 与档案连续阅读

同样的连续显示规则用于 OpenHistoricalMap：已有详图请求新图块时，边线与档案保留，目录计数注明为上次载入的区划。完整视野读取后才重新计算覆盖率，自动模式由此决定是否切回全球概览。首次加载仍从概览开始，来源出错、年份改变或离开详图范围时立即撤销旧状态。

放大到县级资料开始出现的比例尺，或缩小离开这一比例尺，只改变地图上的区划层级。正在阅读的 OHM 或 CShapes 档案保持打开；OHM 高亮仍遵守当前日期和显示层级。已切换来源后，旧 OHM 请求的迟到错误不会关闭新来源的档案。

The same continuity rules apply to OpenHistoricalMap. Zoom-level changes update the map filter while preserving an open OHM or CShapes record. A late error from an inactive OHM source cannot close the newer archive.

所有地区档案统一采用地图内的阅读面板：宽屏靠右，手机居中，高亮保留地理对应。调整窗口或开启双图时，面板高度随所属地图更新，内容在面板内滚动，避免长档案随地理锚点移出视野。
