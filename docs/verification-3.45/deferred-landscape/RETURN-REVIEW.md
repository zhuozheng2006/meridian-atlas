# MapLibre 地貌完整回传审查 · 2026-10-10

**本批结论：不发布地图Worker/vendor候选。** 根线程实际Chrome三次成功测量后，整体地貌就绪没有明确改善，最大的单次晚期主线程任务反而更长。3.45仅发布已验证的阅读连续性及资料；本审查没有创建实验补丁，也没有改已集成文件或主仓库。准备Worker、fetch绑定修复、确定性Blob分派补丁和既有测试继续保存在 `../landscape-integration/`，供下一批重新评估。

## 实测判据

以下数值由根线程提供，来自其实际Chrome记录，本代理没有操作浏览器或重新计时。视图1512×543，[4.8,51.3]，zoom4.5→6.3；最终三轮均12455地方单元、133地区、2884地貌面、12标签。

- 基线地貌就绪：2723 / 4271 / 4773 ms，中位4271 ms。
- fetch修复后的候选：4521 / 4259 / 3971 ms，中位4259 ms。
- 候选主线程地貌JSON.stringify、Response.json均零。
- 候选晚期长任务：496 / 352 / 453 ms；根线程观察基线该段约230—300 ms。

12ms的中位差不足以支持整体提速结论。应用侧序列化/解析移出主线程是事实，但它没有证明体验改善。完整数据回传是已确认机制；具体晚期任务中结构克隆、垃圾回收及其他工作各占多少，仍需要浏览器归因追踪，不能直接把全部任务时长归到一个函数。

## 已核对的调用关系

审查对象为实际捆绑MapLibre 5.6.2（含前一候选的原生Blob请求分派修补），SHA256 `97f8143aff93963c028c2aca8e98ccb9770ad3682bc44b0785bc060d6100ad82`。精确源码片段、字符位置和哈希见 `source-return-evidence.json`。这是根线程恢复地图代码前的只读证据。

1. **地图Worker载入LD**：GeoJSONWorkerSource.loadData先保存 `_pendingData = loadAndProcessGeoJSON(...)`，等待完整对象，建立geojson-vt或cluster索引；随后返回 `{data:i}`，其中i是完整GeoJSON。控制对象还可能附带resourceTiming。
2. **主线程接受LD**：GeoJSONSource._updateWorkerData收到响应后把 `e.data` 赋给 `_data`，然后发metadata和content事件。实际Actor消息要跨线程，完整对象不会因为应用改成Blob输入就自动省略。
3. **显式数据API另走GD**：主线程getData()通过Actor发送GD；Worker的GD处理器调用getData()，返回独立的 `_pendingData`。getBounds()也调用getData()。所以保留Worker里的完整对象与GD行为，理论上可以不在每次LD中回传完整几何；这部分不存在必须依赖主线程 `_data` 的关系。
4. **主线程 `_data` 仍有同步用途**：实际GeoJSONSource类中有四处：构造、setData、LD响应赋值、serialize。serialize把 `_data` 作为source.data输出；删除LD响应data而不改接收逻辑会使它成为undefined。
5. **serialize并非冷门导出路径**：map.getStyle→style.serialize→每个sourceCache.serialize→GeoJSONSource.serialize。当前地貌控制器的reconcileOrder和applyOrder都调用map.getStyle().layers。
6. **source事件也序列化**：Style.addSource给SourceCache设置的父事件数据包含 `source:r.serialize()`。样式验证也传入 `style:this.serialize()`。因此“等serialize时再解析整份JSON”的惰性方案仍可能在载入事件/排序/验证时立即产生大任务，不能仅改名为lazy就认定消除了阻塞。

## 为什么不临时删掉data

- **只删返回data**：当前接收器无条件赋值，source.serialize/getStyle得到缺失data，行为破坏。
- **返回原Blob URL**：可以让显式getData/GD仍读取完整Worker数据，并保持source.data形式上是允许的URL；但当前控制器在source ready就撤销URL，serialize产物立即不可再读取。要改变这一点，必须先定义和验证URL跨更新、旧/新来源排队、重试、双图、样式保存/重用、来源移除和地图销毁的寿命。
- **保留输入值、忽略LD data**：同样遇到Blob寿命，并且updateData的差量更新后不能继续把过时的原输入当作当前可复用样式数据。普通source也不能受到全局行为变化。
- **惰性主线程重建**：同步serialize/getStyle、事件与验证不能等待异步Worker回复；现有路径还会很早触发serialize，因此需要更完整的API设计，而非安全的本批小修。

## 下一批的前置条件

任何只针对本专用source省略LD大数据的方案，都必须先给出明确的source序列化契约、可持续读取的输入表示与Blob回收规则；其他source的既有行为保持。至少核验：

- 普通对象、普通URL和专用Blob的setData；排队更新、更新失败、旧请求取消、来源移除。
- getData和getBounds在load中、ready后及更新后的数据完整性，GD只在显式请求时发生完整回传。
- serialize/map.getStyle在ready后可用；样式重用、setStyle及差量updateData不会返回丢失或过期数据。
- metadata/content及错误事件顺序、来源就绪语义；精确地貌PBF/可见几何和原字段保持。
- 两地图共享/独立状态、Blob URL不提前撤销也不无限泄漏。
- 在真实Chrome中重复相同视角，验证整体就绪和最大主线程任务都改善，明确结构克隆/GC成本；不得以内部微基准或零JSON.stringify替代端到端证据。

本批审查到此结束，不继续开发实验补丁。
