# 经纬纪 4.21 · 从主地图找区划，分享正在读的资料

2026-11-23 · [主地图](https://zhuozheng2006.github.io/meridian-atlas/) · [原典书架中的「大明律」](https://zhuozheng2006.github.io/meridian-atlas/#view=research&lang=zh&srDataset=polaris-2026&srShelf=open&srShelfQ=大明律)

## 主地图检索

在主地图的搜索框输入当年名称、旧称、来源拼写或编号，可查到公元 2 年与 742 年的全部 420 项汉唐区划。结果附上年份、编号、来源上级地区和核查状态。点击结果会切换到对应年份，高亮该区划并打开档案。

- 搜索「南陵郡」或「#742-16」，按 Enter 可直接定位春州的记录。[在主地图试搜](https://zhuozheng2006.github.io/meridian-atlas/#year=1492&lang=zh&browse=1&q=南陵郡)
- 搜索「Gui Zhou」会出现五个精确匹配。第一次 Enter 将焦点移到候选列表，使用 Tab 选定后再按 Enter 打开。结果超过九条时，可进入地名目录继续检索。
- 搜索仅按需加载 13,385 字节的压缩地名索引。选中结果后，地图再加载对应的高精度边界。

## 分享筛选结果

地名目录会把搜索词、年份和核查状态写入网址，「复制筛选链接」可生成独立访问的短链接。浏览器后退仍可恢复此前展开的考证、对照表和键盘焦点。[查看 742 年仍待考的 Chun Zhou](https://zhuozheng2006.github.io/meridian-atlas/?divisionQuery=Chun+Zhou&divisionYear=742&divisionStatus=pending#view=sources&lang=zh)

从资料页可直接进入 2026 原典书架。书架的搜索词、研究阶段和页码可以分享，刷新时会重新打开对应结果。例如，「大明律」对应两条导读，选择具体导读后仍有单篇链接。[查看两条导读](https://zhuozheng2006.github.io/meridian-atlas/#view=research&lang=zh&srDataset=polaris-2026&srShelf=open&srShelfQ=大明律)

## 地名考证

| 742 年来源记录 | 本次核查 |
| --- | --- |
| [春州（742-16）](https://zhuozheng2006.github.io/meridian-atlas/?division=742-16#view=sources&lang=zh) | 核准当年名南陵郡。新旧《唐书》均记 11,218 户，按源图注明的户数乘五，得到 56,090 人。同拼写的淳州（742-151）单独保留待考。 |
| [吉州（742-78）](https://zhuozheng2006.github.io/meridian-atlas/?division=742-78#view=sources&lang=zh) | 《旧唐书》载 237,032 口，《新唐书》及所核四库本载 337,032 口，《通典》载 229,795 口。源图为 377,032，继续待考。 |

西汉 103 项全部核准，盛唐 317 项中核准 271 项、待考 46 项。合计核准 374 项。目录及地图档案中有 229 项、242 条引文可按来源分别查看户数或口数。

## 验证

本版通过全部 128 条标准测试命令、资源指纹校验和 Worker 构建。新增回归覆盖 420 条编号与地图链接、歧义查询的键盘焦点、过期搜索结果、筛选链接的冷启动，以及原典书架分页和延迟加载时的状态恢复。14 项 HTTP 检查通过，沙盒内使用 Unix socketpair 承载原有请求和处理器。公开发布树的 12 个首屏年份别名与原数据逐字节相同。

### 4.21.1 实站复查

Chrome 在 1492 年搜出五条 Gui Zhou 后，可用键盘打开 742 年桂州，后退恢复原年的检索。目录分享、书架新标签打开、两项《大明律》导读及 PDF 第 52 页也经过实测。复查时发现地图搜索框的旧无障碍文案会覆盖新名称，4.21.1 统一了中英文的最终标签。

个人站已发布 4.21.1，公开静态分支提交为 `4b08d4ac`，个人站提交为 `9ab9bf7a`。部署后在 Chrome 中切换中英文，确认搜索框的无障碍名称均包含历史区划，并在英文界面从 1492 年用 `#742-16` 一次回车定位到 742 年南陵郡。[部署记录](https://github.com/zhuozheng2006/zhuozheng2006.github.io/actions/runs/45135559709)

完整改动保存在本地源码分支 `main`。发布审核因源码树含 RAR、PDF 和研究资料而拒绝同步完整源码树，GitHub 源码分支仍为 4.20（`6ef4ff8e`）。
