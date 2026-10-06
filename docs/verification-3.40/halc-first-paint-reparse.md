# HALC 首次接管后仍等待的第二层原因与修复

2026-10-06。本轮生产实现已冻结，等待root最终资源戳和浏览器复验。

## 证据与判断

候选 `3.40.0-06101baf631c` 浏览器记录 `browser/halc-final.json`：自身来源loaded=4954.1 ms；controller active/render=5133.4；下一确认可query边线的render=8798.1；idle=10107.3。这个3.66秒间隔期间仍有5152.6、5163.2、5314.2等render，并且halcLoaded在接管后立刻false、6298.1再次true；地区ready随后也发生变化。它不是已证实的“单个3.66秒标签长任务”。仍不能排除小型标签开销，但资源重新解析的证据更直接。

当前捆绑MapLibre 5.6.2的真实代码：`Style.setLayoutProperty`修改visibility时调用 `_updateLayer`；后者对非raster source设置 `_updatedSources[source]='reload'` 并pause。`Style.setPaintProperty`在真实StyleLayer返回data-driven变化时也走同一路径。旧HALC在setActive后：

1. 将边线layout none→visible；
2. 将fill-opacity从常量0改成按TYPE判断的data-driven表达式；
3. 地区就绪时改含ADM1判断的line-opacity。

这让已下载、已构建的瓦片再次通过worker解析。只把visibility改opacity而仍切换data-driven表达式不能解决问题。

## 小范围修复

只改HALC样式和验证，不改几何、编码、年代与数据文件：

- 资格内所有HALC线层保持layout visible，初始常量opacity=0，在第一次源解析时建立bucket。
- 首次接管只改变常量或zoom-only opacity，依赖实际render的来源门保持不变。
- TYPE8填色alpha固定为0.05/0.24，普通alpha=1；全层fill-opacity在0与0.24间切换，旧有效water=.05、ordinary=.24，原色RGB完全保留。
- 为保留低zoom独立单元的强调，增加唯一一个 `halc-independent-edges`，与原 `halc-edges` 固定互补过滤：完整分号token `XX` 属独立单元，包括`AA;XX`；`AAXX`不会误认。两条线的opacity均只依赖zoom。
- 全部旧zoom stops保持：未有地区线时6/.04、8/.16、11/.5、15/.65；地区已到达时普通6/.015、8/.1、11/.45、15/.65，独立6/.5、8/.6、11/.45、15/.65。
- 新独立线位于selection之下；现有HALC_LAYERS[2]仍指selected，避免索引兼容问题。
- 地区线资格内同样预建，线opacity控制真正显隐；不改变地区与地方独立失败/就绪逻辑。离开资格仍layout隐藏以停止无用工作。

## 直接运行捆绑MapLibre的验证

`node scripts/validate-halc-style-reload.mjs` **13/13**，不是复制MapLibre判断：

- 加载 `public/assets/maplibre-gl.js` 导出的真实Style原型，调用真实`addLayer`构建真实StyleLayer；使用真实paint表达式编译/求值。
- 把HALC实际controller对fake map的setPaintProperty/setLayoutProperty/setFilter，同时发送到真实Style。只替代source worker、DOM和GPU。
- 正控制证明旧layout/data-driven修改会产生reload。
- 新初次地方接管、迟到地区、地区先到三种顺序都没有updatedSources或pause。
- 实际表达式求值核对water颜色及透明度、每个zoom stop、互补过滤、不完整/empty零墨色、离开资格隐藏全部图层。
- 输出 `halc-style-reload.json` 包含捆绑MapLibre SHA。

新render门 **18/18**；既有HALC lifecycle29/continuity24/regions30/cache15/landscape19全部退出0。测试中的“不可见”从只检查layout改成检查layout或实际opacity=0，避免把预建bucket误当可见墨色。无idle门仍由独立source/render测试验证。

这一测试证明接管样式不再请求来源重解析，不证明真实GPU像素时间已改善。root需要对最终戳完成浏览器source-ready→active→下一可见render记录；不能用旧候选或本地函数测试宣称最终用户等待已全部解决。选中具体locality的filter更新仍可能触发旧的source reload，未在这次首次接管修复中改写选择架构。
