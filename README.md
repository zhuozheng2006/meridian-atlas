# 经纬纪 · Meridian Atlas 使用指南

经纬纪把世界地图、历史疆域、事件和资料来源放在同一个阅读界面。本版收录 **251 条中英文事件**，按 **9 个地区、8 类主题**组织，并提供 **12 条专题阅读线索**。疆域采用开放项目 Cliopatria 的 **13,380 条 POLITY 时段记录**，覆盖**公元前 3400 年至公元 2024 年**；这里的记录数不是国家数，同一政体在不同时段会有多条记录。

内容兼顾政治、战争、科技、贸易、文化、宗教、社会与灾害。界面结合历史图集常见的时间播放、事件阅读和年份对照方式，使用开放疆域数据与原创双语摘要，没有复制商业图集的数据库。它适合建立通史脉络和寻找进一步阅读的入口，尚非穷尽世界史的百科，也未经过逐条学术同行审稿。部分来源在本次核查中存在访问限制，不能将“附有来源”理解为每个条目均已逐句核实。

## 启动

保持整个 `world-history-atlas` 文件夹完整。电脑需有 Python 3；在该文件夹中打开终端，运行：

```sh
python3 serve.py --open
```

浏览器会打开 `http://127.0.0.1:8766/`。macOS 也可双击“打开经纬纪.command”。若提示端口已占用，改用：

```sh
python3 serve.py --port 8767 --open
```

阅读时保持终端开启；按 `Ctrl+C` 停止服务。请通过启动器访问，不要直接双击 `dist/index.html`。地图、事件与必要资源已随项目保存，启动后核心阅读可离线使用；打开外部参考资料需要联网。使用支持 JavaScript 与 WebGL 的现代浏览器。

## 在地图里查历史

拖动底部时间轴，或直接输入年份。负数表示公元前，例如 `-221`；没有公元 0 年。时间轴分段缩放，为近现代留出更多操作空间，画面上的相同距离不一定代表相同年数。

播放可按 1、10、50 或 100 年推进；边界变化跳转按钮寻找数据实际记录的变化年份。可在地球和平面视图间切换，也可分别开关疆域、事件与地名。空格播放或暂停，左右方向键按所选步长移动，`Esc` 关闭详情。

搜索框同时查找事件和政体。地区、类别与时间窗口用于筛选事件：“所选年代”查看当前年份附近，“全部年代”显示跨时期事件，此时疆域仍对应当前年份。

点击事件可阅读摘要、历史意义、日期精度、地点说明和来源链接，并定位到该事件的起始年份。点击政体可查看原始名称、当前边界记录的适用区间及来源；该区间不一定等于政体的完整存续年代。

## 双语、对照与阅读线索

右上角可选择中文、英文或中英双语。事件具有双语标题与正文；政体优先显示已核对的中文名，缺少可靠译名时保留原名。

“年份对照”打开两个同步地图视角，分别输入年份，观察同一地区的变化。“专题”提供跨地区的连续阅读入口，可逐站前进；专题顺序是编辑选取的阅读线索，不代表实际旅行路线或唯一的因果解释。

“年表”按年代列出全部事件，可搜索、进入地图详情或导出事件数据。“资料”集中说明数据覆盖、来源版本、授权及已知问题，并提供事件、疆域目录和覆盖报告的下载。事件卡片中的来源链接用于继续核查具体事实。

“复制视图链接”可保存年份、筛选条件与所选事件等状态。本地地址只供本机访问；发送给他人前，需要对方运行同一项目，或使用实际部署后的网址。

## 怎样理解精度

- **可逐年选择，不等于逐年都有精确史料。** 同一边界可能沿用一个时间区间；程序不对缺失时代推测插值。
- **空白不等于无人居住。** 它表示数据未覆盖该地点在该年的疆域，各地与各时代的资料密度不同。地图默认显示政体疆域，联盟等关系记录另保存在完整目录中。
- **地图适合概览。** 显示用边界经过简化，海岸线采用现代概貌，不能用于精确测量、古海岸线复原或当代边界裁定。已知源数据问题保留说明。
- **点不是范围。** 事件标记可能是相关遗址，也可能只是代表地点；影响范围不能从一个点推断。“约”与“历史过程”保留日期的不确定性或跨度。
- **地图与事件来源独立。** 同年疆域不一定是该事件结束后的状态。疆域止于 2024 年，选择 2025—2026 年不会显示旧疆域冒充现状；本版事件也未补齐最新年份。

## English quick start

Run `python3 serve.py --open` inside the project folder, then keep the terminal open. If port 8766 is busy, add `--port 8767`. Core maps and event texts work offline; external references require internet access.

Enter a year or drag the timeline; negative years mean BCE. Search events and polities, filter by region or topic, and switch between Chinese, English and bilingual reading. Use **Compare years** for synchronized views, **Journeys** for guided reading, **Chronicle** for the event list, and **Sources** for coverage and attribution.

Boundary coverage is 3400 BCE–2024 CE. Blank areas mean missing coverage, and event markers may be representative points. Annual navigation does not imply annual historical certainty. This is a selective, source-linked learning atlas, not an exhaustive or individually peer-reviewed history.

## 维护与验证 / Maintenance

无前端安装依赖；地图引擎和数据均随项目保存。Node.js 18+ 环境运行 `npm test` 可检查年代、记录、来源字段与全部疆域分片哈希。

- `dist/`：可直接托管的完整静态应用。
- `dist/data/events.json`：可编辑的双语事件库。
- `dist/data/catalog.json.gz`：完整疆域目录；几何按需分片读取。
- `scripts/boundaries/`：固定源版本的数据重建流程。
- `docs/`：研究取舍、验证记录与内容核验边界。
- `ATTRIBUTIONS.md`：数据和代码分别适用的许可。

开发和数据扩充详见 [维护说明](docs/MAINTENANCE.md)。
