# 研究与设计取舍 / Research and design decisions

现有项目已经解决世界历史可视化的许多部分，因此本项目使用已有开放疆域数据，在此基础上实现双语阅读和综合界面。下表是设计参考，不代表把外部项目的全部功能或专有数据库搬入本站。

| 参考项目 | 本项目吸收的设计方向 | 实际实现及边界 |
|---|---|---|
| [Cliopatria / Seshat](https://github.com/Seshat-Global-History-Databank/cliopatria) | 历史政治实体、时间区间与可再利用地理数据 | 固定版本完整目录、13,380条POLITY记录、逐条来源身份提示；原数据仍有覆盖缺口 |
| [Chronosphere](https://worldbyyear.com/) | 通过地球和时间轴探索世界 | 平面/地球切换、分段时间轴、播放；没有仿造未知时期疆域 |
| [Phersu Atlas](https://www.phersu-atlas.com/) | 按年代阅读历史地理 | 年份输入、边界变化跳转、两年对照；未复制其数据库，也未承诺日级重建 |
| [Running Reality](https://www.runningreality.org/) | 把历史放进时间和空间 | 地图事件定位、区域与主题筛选；当前没有战役部队移动模拟 |
| [HistoryMaps](https://history-maps.com/timeline) | 从事件进入连续历史叙事 | 12条专题阅读线索与完整双语事件详情；路线只是阅读顺序 |
| [OpenHistoricalMap](https://www.openhistoricalmap.org/) | 来源透明、可持续补充的历史地理 | 导出、固定版本、审计说明、可复现处理；当前没有在线社区编辑或街道级历史图层 |

地图引擎采用 [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js)，底图采用 [Natural Earth](https://www.naturalearthdata.com/)。许可见项目 ATTRIBUTIONS.md。

本版的“完整”指可启动、可部署、可读、可检索、可导出的应用交付；内容是全球通史精选集，不能等同于穷尽所有事件、地区与年度的权威百科。提高历史精度需要持续的领域校审，而非仅扩大条目数。
