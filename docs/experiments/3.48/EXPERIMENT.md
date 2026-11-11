# 3.48 全球疆域准备实验

基线为已发布主仓 `9a9ded84f1a89dde4544ecaf93fd8458180775f4`（3.47）。本目录是独立候选，不是已发布产品。只复制 `candidate-manifest.json` 列出的普通文件；其余 public 文件是为测试引用主仓建立的符号链接，不能整目录覆盖主仓。

## 实验契约

- 仍加载原始小 native 数据包。准备 Worker 接收完整当前活动帧，运行原有 curvedBorders 与 boundaryMesh，再合并相同的面和边线。未预下载大体积派生几何，未改变原始坐标或曲线参数。
- rawTerritories、BoundaryController 当前来源记录、下载和选择仍使用原始数据。异步准备完成前不提交新年份或其标签；曲线开关和来源更改不能让旧帧废弃当前新年请求。
- 一个共享准备 Worker，一次只向其发送一个任务。主线程为每个存活地图最多保留一个最新等待任务；取消的计算可能完成，但其返回值不能提交。当前产品最多两个地图。最后一个 owner 销毁时终止 Worker。
- 3.47 当前帧缓存继续处理相同输入的复用和源数据归属；未改成跨年份缓存。
- 输出为自包含的 `data:application/geo+json;meridian-frame=1;base64,` URL。vendor 仅在 `polities` 加这个精确前缀时返回 URL，原有 HALC 特例不变，普通 polities URL/对象、其它来源和 updateData 仍沿上游行为。完整 geometry 仍留在 MapLibre Worker，可由 getData 读取，serialize/getStyle 可重建来源。
- Worker 不可用、失败、超时，或明确报告 deviceMemory ≤4 时走原始 JSON 对象分支。当前专属 URL 在地图源中失败，只回退一次；第二次 JSON 失败仍交给正常错误界面。已被新的内部 URL 取代的旧 URL 错误不覆盖新帧，也不留下过时的全局重载警告。
- 任意深层原几何原位编辑依旧需要显式 cache.invalidate；正常源存储按不可变对象使用。

## 开关和可读时标

开发测量时，在应用初始化之前设置 `window.__MERIDIAN_FRAME_TRANSPORT__='json'`，使用原有主线程对象路径；未设置时启用候选 Worker（受低内存/能力门槛限制）。这不是用户设置，不写入 URL 或存储。

候选 2 增加独立输入实验：`window.__MERIDIAN_FRAME_INPUT__='json'` 将约 579 KB 的原始帧先 JSON.stringify，再把字符串交给 Worker JSON.parse；不设置时使用原始对象的 structuredClone。两者回传的派生 URL 相同，原始源对象不变。该输入开关不是把约 18.75 MB 的派生对象在主线程重新编码。

`AtlasMap.territoryPreparationMetrics` 包含输入序列化/解析、curves、mesh、完整 build、派生 stringify、base64 编码、排队、postMessage 和往返时间；Worker 的 timeOrigin 与 startedAt/receivedAt 明确分列。`territoryPreparation.getStats()` 暴露运行中/等待任务数。指标没有放进产品界面。

## 已有验证与负结果

候选 1 的新增 14 项验证通过：真实 1492 数据与独立冻结旧算法逐字节等价，原始数据不变，实际 MapLibre getData、样式序列化/重建和三组 PBF 瓦片一致；包括最新年份、曲线/来源竞争、双 owner 有界队列、单次来源回退、第二次失败正常上报、过时错误、销毁和空帧。既有 3.47 cache 的 14 项也通过。报告分别在 `docs/verification-3.48/territory-frame-worker.json` 与候选的 `docs/verification-3.47/global-frame-cache.json`；后者只是旧脚本的报告路径，不是改写主仓报告。

1492 Node 派生 JSON 为 18,752,670 字节，SHA-256 为 `877f7cdf6aaafd53a6a69787739a68dc37a47e084d6c882ac81419aa71573949`。浏览器浮点输出略有差别，应在同一运行环境比较，不作跨引擎字节完全一致承诺。

主任务实际 Chrome 测量发现首批 overlay 仍加载了 937,511 字节的旧 vendor（未含 polities 分支），因此那组保留为错误构建诊断，不能评价完整候选。新 origin 确认加载 937,616 字节、SHA-256 `4bf447dce2f04a3997fc88daa8eb8e4bf03bc43db3ced7e255a03a46826148cb`，并确认主线程 serialize().data 仍为专属 URL 后，才形成 `../browser/valid-{json,worker}-{1,2,3}.json` 的有效组。

有效组为相同构建、1492、中心 [25,18]、缩放 1.54、地图 1512×599：原 JSON 分支完整可见疆域的中位时刻约 1962 ms，Worker 约 2736 ms。Worker 运算需 1050–1217 ms；主线程的晚期整份对象克隆已消失，但首屏整体退步。因而**当前 Worker 方案不能凭“移到后台”作为默认发布改进**。这些是主任务提供并由本代理复读的 Chrome 文件，本代理没有操作浏览器。

`buildMs` 在 Worker 模块加载、收到消息、解析输入之后才开始，单纯把模块加载提前不能解释其中的大幅退步。线程调度、JIT/数组内部表示等目前只是待检验原因，不能当作已证实结论。

候选 2 的 Node 输入实验已完成两轮 fresh Worker/同 Worker 再次准备对比，8 次完整输出 URL 哈希完全相同。对象输入 fresh build 约 292/289 ms，JSON 输入约 261/262 ms；579 KB 主线程输入 stringify 约 0.68–0.78 ms，Worker parse 约 1 ms。结果只支持本机 Node 中约几十毫秒的差异，不能解释或推翻 Chrome 的 5 倍计算差异；浏览器对该输入方案的评价由主任务完成。

## 下一步和限制

实际 CShapes 1900 与非 bootstrap 的 1600 年全帧验证已加入脚本；其最终运行状态以最终 manifest/报告为准。为避免污染主任务浏览器性能对比，重型验证只在其测量间隙执行。

浏览器验收应分别记录第一次查询到部分疆域、当前视野疆域源全部就绪后的 render、最大主线程任务和内存峰值。全地图 idle 会被其它图层影响，不替代疆域首帧时刻。不要把 Node 算法耗时拼接成浏览器首屏结果。

URL 编码会增加大字符串、Blob/UTF-8 编码的临时占用，并在主线程、地图 Worker 之间传递。源样式、当前帧和浏览器 URL 解析内部结构可能继续持有这些字符串。一个准备队列和一个当前帧的界限不等于浏览器总内存界限；目前不宣称内存下降。

若 JSON 输入实验仍无法改善真实首帧，应继续把本目录保留为实验，而不把它合并到默认发布。后续主线程构建后异步编码、进一步传输优化或准备时序改变，需要单独测量和契约检查；本文件不代表这些方案已经实现。
