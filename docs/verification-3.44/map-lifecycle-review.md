# 3.44 首次详图与地区流程：独立审计

已读 `docs/HANDOFF-3.43.md`（3.43.0-6a6bc23b738e）以及当前 `public/halc-boundaries.js`、`public/halc-regions.js`、`public/regional-boundaries.js`、`public/map-engine.js`。本任务未改生产、未开浏览器、未访问网络。

## 本轮优先改动：地区查询先保留身份和碎片引用

生产 `halc-regions.js:45–46` 的 `settle()` 对每个查询到的地区碎片立即执行 `f.geometry`，随后才提交 `features/ready/hasFrame/revision`。因此地区就绪路径仍会展开全部地理坐标，包括标签关闭、zoom≥8实际只用地方名称、以及区域先到但主地方来源未就绪的情况。它在 `HalcRegions.afterRender()` 中执行，也会被 `HalcBoundaries.settle()` 调用，可能阻塞该帧其余JavaScript工作。

`HalcBoundaries.halcVisibleUnits()` 已采用惰性碎片，而地区侧尚未同步。性能agent的候选 `performance/halc-regions.candidate.mjs` 仅新增 `halcVisibleRegions()`，将数组位置设为一次求值getter；原事件门控和层样式不变。真实MapLibre的 `geometry` 是原型getter，`{...feature}`本身不是这处坐标展开来源；问题在显式的 `fragments.push(f.geometry)`，须准确描述。

独立审查接受此最小方案。保留：gid truthy门槛、数字与字符串gid不合并、第一次要素的属性、组的查询顺序、所有同gid碎片的顺序、原数据坐标、精确anchor、错误/年份边界和图层接管时机。不能改成按面积取样、截断碎片、将多个归属字符串合成国家，或把来源不足的全球边界补画为平滑曲线。

## 行为证据

`validate-regions-lazy-lifecycle.mjs` 和 `regions-lazy-lifecycle.json`：**12/12通过**。脚本直接导入候选完整地区类，接入生产HALC父类、真实标签调度器和既有地图事件替身。几何getter位于测试要素原型，匹配本次需要验证的访问语义。

- 分组零坐标读取；重复gid首属性及多碎片顺序、数字/字符串key独立。
- 反向访问碎片时仅求值被访问项，并且每项只求值一次。
- 完整JSON序列化与独立保留的旧eager循环相同；再次序列化不重复读取。
- 地区先到仍须自己的render；主源未就绪时无提前地区描边；metadata-only仍不可接管。
- 隐藏标签与高zoom地方标注保留零地区坐标需求。
- 低zoom标注完整遍历地区碎片，点击仍按原ADM1打开分组索引。
- 同gid新来源epoch不复用旧几何；error、切年和destroy均阻止迟到接管。

这些是受控行为验证。真实MVT解码、复杂多环边界、实际投影/裁剪和CPU测量由性能agent另行验证；真实浏览器首帧由root验证。可通过 `HALC_REGIONS_MODULE` 指向整合后的生产模块再次运行，避免把候选通过当成生产已通过。

## 必须保留的正确性边界

来源worker完成与地图真正render是两道门。不得为了首屏提前让 `isSourceLoaded=true` 或metadata事件代替content+render。地区ready只说明地区查询完成；主地方源未ready时仍不接管全球概览。现有按来源错误处理、region-only故障保留健康地方记录、同年已载入视图连续性，不应因惰性转换而变化。

惰性getter把坐标展开的时间移到精确anchor需求时，并没有改变CPU总需求或提升历史数据精度。低zoom需要地区名称时，标签scheduler仍需读取全部合格地区碎片；单个复杂地区anchor不可抢占。应保留 `maxAnchorMs`，不能以4ms片预算宣称没有长任务。高zoom或标签关闭的路径才可能永久避免无用的地区坐标展开。

## 下一步观测，而非本轮承诺

首次详图耗时至少分成：来源请求/字节、worker解析、render、queryRenderedFeatures与分组、JS坐标展开、精确anchor及碰撞。3.43已载入地图的标签更新加速不能推为冷下载或首次完整地图加速。本轮候选也不减少矢量瓦片字节或GPU解析。

建议root实测至少两条：标签关闭首次进入1500低地国家；同一视野低zoom开启地区名称。分别记录主源/地区源content→render→active，以及地区分组、最大单anchor与标签全部提交时间。若仍慢，下一优先点由这些分段记录决定；不要先降低地图坐标精度或取消事件门控。
