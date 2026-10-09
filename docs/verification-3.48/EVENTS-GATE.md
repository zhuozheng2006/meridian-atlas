# 3.48 事件依赖与首屏解耦审查

基线 `9a9ded84f1a89dde4544ecaf93fd8458180775f4`，2026-10-10，只读审查。

## 已证实的依赖

`public/app.js:505–507` 的 ensureCoreData 以 Promise.all 等待 fast/catalog 与 events，完成后才同时赋值 catalog 和 events。`ensureAtlas` 在 513 行等待 ensureCoreData 和 MapLibre，再于 514 行创建地图。事件下载、解压或 JSON 解析尚未结束，地图构造就不会发生；事件错误也会使地图初始化失败，即使 catalog 和 renderer 已成功。

已运行 `probe-events-gate.mjs`：从固定 Git 提交提取原 ensureCoreData/ensureAtlas 函数，以可控 I/O promise 观察真实依赖，不重写实现。三项通过：

1. catalog 与 renderer 就绪、events 未结束：地图构造 0 次；events 结束后构造 1 次。
2. events 拒绝：地图仍为 0 次，两级失败 promise 正确清空以支持重试。
3. events 未结束时离开地图视图：完成后仍阻止过时地图构造。

此为依赖证明，不是浏览器性能数字。真实首屏是否受此显著影响，必须比较每项资源的完成时刻。当前资源大小为：catalog gzip 602,739 B / 展开 4,816,003 B；709 条 events gzip 446,517 B / 展开 1,470,967 B；1492 native gzip 150,207 B / 展开 506,889 B。不能从较小 events 文件推断其一定更早完成；优先级、连接排队和解析时机都不同。

## 建议的最小可测方案

将资源状态拆成独立的 catalog promise 和 events promise。地图只等待 catalog + MapLibre；events 同时开始获取，保持并行下载。保留 ensureCoreData 为两者聚合接口，供确实需要完整事件数据的年表、专题、资料页使用。政体列表是否也解耦可作为独立改动，不必扩大首屏补丁。

事件完成后仅更新事件相关 UI、时间密度和当前双图 marker，不再调用 applyYear / setYear；否则会重新引入地图提交、准备调度和标签计算。更新应读取完成当时的语言、筛选、年份和两图状态，不保留启动时快照。若当前在其他视图，不抢占其内容、焦点或滚动位置。地图真正可读时才能解除相关控制；事件尚在加载不应使地图年份控制继续全局禁用。

需要明确 `eventsStatus = idle/loading/ready/error` 或等价状态。以下调用现在把空数组等同于完整数据，直接拆 Promise.all 会形成错误界面：

- renderEvents 的 0 条计数、无匹配提示、地点搜索回写计数；
- renderDensity 的全空图，以及 applyYear 的 datasetStatus 中 0 条事件；
- 事件搜索工具的空结果和总计；
- PolityReader/地点卡片的相关事件（完成后需明确可刷新范围，避免重开整个正文）；
- 专题与年表里的空路线、导出空数组；资料统计与下载。

地图启动时显示简短“事件正在加载”，失败提供单独重试入口；不能把可用地图销毁并换成地图错误。独立 promise 的成功标志不能仍只靠 `if(catalog)return` 判断 core 全部就绪，否则一旦 catalog 先完成，随后调用 ensureCoreData 会漏等事件。

## 深链和用户操作边界

`restoreInitialMapView` 一进入就设 mapURLRestored=true，随后同步从 events.find 查事件。若 events 延后，这会吞掉 event 深链，且最终 saveURL 会丢原参数。必须等待 event 数据后再完成该恢复部分，并保留原 URL 参数直到恢复或确定用户已接管导航。

等待事件期间用户可能切换年份、打开地点/政体/另一事件、关闭阅读器、切语言、切视图或关闭右图。仅检查 viewRevision 不足以防止“仍在 atlas 中的用户选择”被晚到的 event 深链覆盖，需要捕获并复核 detailNavigation / 用户交互 generation；当前 compare 实例也要重新确认。不能只为等待深链而把整体地图 ready promise 留在未完成状态。

无 event 参数的普通启动无需为事件等待。含 event 参数的启动可先显示地图，再完成指定事件读取；同一事件失败重试保留分享语义。研究入口仍不创建地图、不强拉事件。

## 必要实测

先分别记录 catalog-ready、events-ready、renderer-ready、map-constructor、MapLibre load；再记录 native-ready、prepare-input / prepare-result、display / setData、polities metadata / content、source.loaded、相关 render。仅“MapLibre load”常发生于 EMPTY polities；applyYear 返回仅表示提交，二者都不是首个有效疆域帧。

用本地临时入口埋点对比相同版本的控制/候选，至少三组交替：普通 1492、延迟 events、events 失败、事件深链。延迟/失败注入明确标为机制测试，不能当实际网络收益。真实网络实验另记 cold request 与 HTTP 暖缓存新页面、视口和相机；记录输入延迟或 longtask，确认事件解析没有恰好移到首帧后的拖动操作中。

功能覆盖：加载中改变语言/年份/搜索；左/右图事件筛选；启动 event 深链恢复及用户先打开另一条资料；关闭右图；离开并返回 atlas；events 失败后重试；stories/library/sources 首次直达；research 直达保持懒加载；模型工具查询应区分未加载与零结果。

此方案尚未实现，本审查未操作浏览器。现有工具不支持 Page.addScriptToEvaluateOnNewDocument，不能声称拥有该埋点数据或通过其他能力绕过限制。

## 主代理真实浏览器补充（只读复核记录）

已读取主代理保存的 `browser/baseline-boot-1.json` 与 `browser/baseline-boot-cold-4mbps.json`。本审查代理未控制浏览器；以下是外部实测记录，不是上述 VM 的计时。

本机热缓存基线：coreReady 148.9 ms，map load 329.2 ms；displayTerritories 345.7→598.9 ms（253.2 ms），其中 setData 约 20.9 ms；此后一个 265 ms 主线程长任务，polities-ready-render 2023 ms，非空可见疆域查询 2046 ms，全图 idle 3428.4 ms。初始 EMPTY source 的 ready 不能算成历史疆域已出现。

4 Mbit/s（download 500,000 B/s）、80 ms latency、cacheDisabled=true 的冷请求：catalog responseEnd 3353.8 ms，events responseEnd 3918.0 ms，coreReady 3931.5 ms，map load 4124.4 ms；display 335.3 ms，当前视口 source-ready-render 5601.7 ms，非空可见查询 5605.0 ms，全图 idle 10019 ms。events 响应比 catalog 晚 564.2 ms，证明该依赖在限速情况下值得下一项实验；不能直接将这个差值当作已经实现的首帧节省量，catalog 解析、renderer 和其他竞争仍需控制。

本批优先评估后台完整疆域准备，不同时拆 app 数据依赖，以便分辨每项优化的实际作用。临时预览响应注入观测没有改发布文件，也没有使用不受支持的 Page.addScriptToEvaluateOnNewDocument 能力。限速/缓存设置已由主代理恢复。
