# 经纬纪 · Meridian Atlas 2.1

一部可交互的中英文世界历史图集：转动地球，沿时间轴观察疆域；打开国家档案，阅读制度、文化、经济与相关事件。

## 这一版

- 中文界面、地图译名与新增资料统一使用简体，保留英文和双语阅读模式。
- 重新整理正文，把通用地图约定和证据说明集中到“资料”及各条目的“来源”。
- 深色地球与金色时间轴、紧凑浏览栏、真正分开的地图与阅读面板，适配桌面与手机。
- 国家档案分为概览、政治、文化与经济、疆域、年表和来源六栏，可查看面积变化、跳转疆域时段、追溯参考资料并下载完整档案。
- 保留年份对照、时间播放、搜索筛选、12条专题阅读路线与视图分享。
- 统一键盘操作：方向键只控制所属地图年份，输入框上下键跳过公元0年；Shift加速，Alt+方向键移动地图。读区、按钮与搜索框保留原生行为。
- 年份与地图在数据成功加载后一起更新；失败保留原图并提供重试，支持快速连续切年和对照视图。
- 11个常用年份直接采用既有0.02°展示几何；其他年份使用0.04°概览，放大后补充细节。默认1492年疆域文件79,710字节，首屏目录602,739字节。详细海岸线、完整国家档案异步加载并缓存。
- 地名锚点放在最大疆域组成部分内部，远景减少重叠；边界使用抗锯齿、细描边和随缩放变化的线宽。

本版收录343条双语事件（2.0版新增92条），并保留13,380条政体疆域时段记录，以及385条联盟、共主等关系记录，来源为Cliopatria。疆域年代覆盖公元前3400年至2024年。另收录1,450份Wikidata实体档案、23篇重要文明双语概览和47条历史侧记。330份实体档案包含带引证声明，共1,885项；各国可展示资料的密度不同。事件总数和分布见应用“资料”及 `docs/CONTENT-COVERAGE.json`。

## 打开与使用

在线版：[经纬纪](https://meridian-world-history.zhuozheng2006.chatgpt.site)。沿用原有私有访问范围。

本地版保持整个文件夹完整，在此目录运行：

```sh
python3 serve.py --open
```

macOS也可双击“打开经纬纪.command”。浏览器打开 `http://127.0.0.1:8766/`；端口占用时可用 `python3 serve.py --port 8767 --open`。阅读时保持服务窗口开启，结束后按Ctrl+C。通过启动器访问，而不是直接双击HTML。核心地图与正文可离线使用；外部来源链接需要网络。

底部输入年份或拖动时间轴，负数表示公元前。播放支持1、10、50、100年步长。地图或时间轴聚焦时，左右键按所选步长移动年份（默认1年），Shift加速10倍；年份输入框用上下键，Enter确认，Esc撤回未提交输入。地图聚焦时Alt+方向键移动视角，+ / −缩放；空格播放与暂停，Esc关闭详情。正文里的空格保留滚动行为，国家栏目支持左右键切换。点击“浏览”显示或收起搜索与事件卡片。

点击地图上的疆域，或从“文明”查找国家，进入分栏档案。疆域栏的面积图按原始时段展示，年份按钮定位对应记录。“年表”查看该政体相关事件；“来源”可追溯档案依据及下载完整JSON。

“专题”串联相关历史，“年表”按年代检索全部事件。“年份对照”提供两张同步视角的地图。“分享此页”保留年份、语言和选中的国家或事件；本机地址仅供本机使用，跨设备分享请使用在线版。

## 来源与阅读约定

地图的时间区间、事件的日期和国家资料的时代范围各有依据。年份选择可以精确到一年，同一条源疆域记录也可能覆盖多年。程序沿用源区间，不对缺失年代插值；公元前1年后直接进入公元1年。

疆域留白表示资料未覆盖当地当时的政治地理。地理底图使用现代海岸线；事件标记对应遗址或代表地点。事件库与文明概览为来源导向的精选编写，尚未穷尽世界史，也未逐条经过独立学术同行审稿。

国家结构化条目有年代时按其范围阅读；无年代条目属于实体概况。主文选取附引证的有效声明，并核对来源身份与可能的年代冲突。有效但未附引证的条目放在默认折叠的“百科补充”中，供交叉核对；废弃与未知值保存在下载档案中。明确发现可能时代不符的关联实体暂缓显示补充内容。

中国译名统一为简体；原始档案名称和来源快照另行保留。地图与实体资料更新至项目保存的固定版本，完整来源、许可证与具体限制见应用“资料”、`ATTRIBUTIONS.md`和`docs/`。

## English quick start

Run `python3 serve.py --open` in this folder, keeping the server window open. Core maps and texts work offline; external references need internet access. The hosted edition is linked above.

Choose Chinese, English or bilingual reading. Explore the globe and timeline, open a polity’s six-section dossier, compare years, follow thematic journeys, or search the full chronicle. Share links preserve the selected year, filters, language and historical record.

The atlas retains 13,380 polity territory records, 1,450 entity dossiers and 23 original civilization overviews. Cited structured statements are displayed with temporal qualifiers where available. Sources centralizes coverage, provenance and editorial conventions; record-specific notes remain in individual dossiers.

## 维护

应用为静态项目，运行不需要安装前端依赖。

```sh
npm test
```

- `dist/`：可托管、可离线启动的应用。
- `dist/data/events.json`：可编辑事件；浏览器读取其压缩副本。
- `dist/data/fast/`：首屏目录、概览几何、常用年代和完整记录分片。
- `dist/data/enrichment/`：实体档案索引、分片与双语文明概览。
- `scripts/`：重建与验证脚本。
- `docs/`：来源研究、内容覆盖、转换记录与测试结果。

数据更新与重建方法详见 `docs/MAINTENANCE.md`。
