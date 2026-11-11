# 3.48 完整疆域后台准备：独立审查

审查基线：`9a9ded84f1a89dde4544ecaf93fd8458180775f4`。日期：2026-10-10。只读主仓与 `frame-candidate`；本代理未控制浏览器、操作 Sites 或修改产品文件。

## 当前结论

方案针对真实首帧成本：把完整当前年代的曲线和线网构造、JSON 序列化与 base64 编码放入准备 Worker；MapLibre 对专门标识的内部 polities 来源保留自包含 URL，避免常规 loadData 回传完整派生几何。原始历史几何与算法保持独立。它不是简化历史边界或提前下载 53 倍大小的显示包。

首版存在确定的异步竞态，已报告并修复：新年份准备期间切曲线，会取消新年份而重交旧年份。独立原方法/真实 cache/pool 复现的失败与修复证据均已保存。当前候选的 latest-year 标记和重试方向正确。不过，后续真实 Chrome 已显示该路线首帧退步，本批不采用，详见末节路线决策。

## 1. 首帧范围与事件依赖

完整事件依赖审查见 `EVENTS-GATE.md`，可复现脚本 `probe-events-gate.mjs`。基线 ensureCoreData 同时等待 catalog/events 后才允许 new AtlasMap，这一 gate 已用实际函数证明。主代理热缓存首屏记录 coreReady 148.9 ms，但 display 253.2 ms，随后存在大主线程任务；因此本批优先后台几何路线。

主代理另外记录了 4 Mbit/s、80 ms、禁缓存的实际冷请求：catalog 3353.8 ms、events 3918 ms、coreReady 3931.5 ms，部分疆域首次可查询 5373.2 ms，当前 polities 来源准备完成后的 render 5601.7 ms，全局 idle 10019 ms。事件解耦具有后续价值，但本批不同时改 app 依赖，便于归因。以上来自实际保存的 browser JSON，非本代理亲自运行的浏览器测量。

必须分别记录：首次非空历史疆域可查询/实际像素、当前视口来源 ready 的 render、全局 idle。初始 EMPTY polities 的 load/content/ready、setData 返回和 applyYear 结束不能充当首幅有效历史地图。

## 2. 算法上下文：必须整帧计算

`curvedBorders` 的共享顶点度数、共边、原始线段碰撞、角部包络冲突与面积约束依赖整个 collection；`boundaryMesh` 也依赖整帧一致节点。准备 Worker 必须接收当前活动记录的完整 FeatureCollection，并保持 feature 顺序、properties、几何引用所指的数值、模式及曲线选项。

独立实算 1492 年 136 条活动记录：逐 feature 分别柔化时，119 个 feature 的 geometry 与整帧柔化不同。见 `probe-curve-context.mjs` / `curve-context-evidence.json`。输入前后未修改。由此不能按 geometryId 单独缓存柔化，不能把一个跨年代 native pack 的所有记录都一起柔化，也不能按视口裁掉邻国后声称结果等同原图。

候选仍使用原 border-curves / boundary-mesh，完整帧一起进入 Worker，符合这一要求。源 pack、活动记录和档案下载留在原路径；显示结果只能作为派生层。

## 3. Source 与 MapLibre 合同

补丁只额外匹配 source=`polities` 且 URL 以 `data:application/geo+json;meridian-frame=1;base64,` 开头；原 HALC 分支保留。更新的是 loadData 自动响应，不是 Worker 内保存的几何。GD/getData、filter、rewind、索引以及显式 updateData 的原对象返回逻辑未改变。

独立运行 `probe-source-contract.mjs`，实际 MapLibre 5.6.2 主线程 Source 与 Worker 构造器、原请求代码和 structuredClone 边界，5/5 通过：

- 精确 Source + MIME 组合返回 URL；其他 Source、普通 MIME、错误参数版本和不同参数排列保持原完整对象响应。
- UTF-8 中文、重音字符、代理对字符、Polygon 与线网保留；Node URL 规范化不改变该自包含字符串。
- getData、serialize、Map.getStyle 原型调用及 JSON 化 style→新 Source 重建一致。
- updateData 添加记录后 getData 和 serialize 返回新对象，不被旧 URL 锁死。
- filter、绕向标准化、getBounds 与两个实际 PBF 瓦片匹配对象路线；坏 JSON 保留 source error，无假 content 成功。

当前独立测过的 vendor SHA 为 `4bf447dce2f04a3997fc88daa8eb8e4bf03bc43db3ced7e255a03a46826148cb`。证据是 API/数据合同，不证明实际 Map.setStyle diff、浏览器 URL/CSP 或性能。完整 1492 帧和其他年/来源的 oracle 对照应保留实施代理测试，Chrome 再验 getData 哈希与 style 重建。

显式调用 getData 仍会克隆完整数据，显式 JSON.stringify(getStyle()) 仍可花费大量主线程时间；本方案消除的是常规 loadData 的自动大对象回传，不能宣传为所有读取都不再克隆。

## 4. 异步提交与已修竞态

首版真实复现：已有 1492 raw，setYear(1750) 正在等待 Worker；setBorderCurves(false) 用旧 raw 开新 preparationGeneration，同时 pool 取消 1750。结果 1750 promise=false，atlas.year=1492，提交的是 raw1492。源码快照见 `initial-race-source/`，可重跑 `probe-pending-year-race.mjs`。

修订后 `pendingTerritoryYear` 声明新年帧的提交权。曲线开关只更新最新选项，等待中不为旧 raw 开另一个任务；当前 setYear 若因模式/表达变化失去准备结果，在 request 仍当前时重试。精度升级在 pending 新年时不争抢准备。独立 `probe-pending-year-fixed.mjs` 用同一控制顺序，最终 atlas.year=1750，提交 raw1750，通过。

准备须在 year / active / recordMap / boundary.current / geometryKey 的原子提交之前完成；否则旧多边形配新标签/点击记录会产生错误。setMode、异步精度升级、曲线开关也要以 request/generation/current raw 身份重验。提交之后各图自己的 markers/labels/selection 才对应新帧。取消旧准备不得吞掉最新有效年请求。

3.47 Source 归属证明仍须 source.loaded()：有排队 setData/updateData 时即使 serialize().data 身份相同，也不能跳过覆盖请求。旧准备只应丢弃结果，不修改 cache.entry 或显示数据。

## 5. 调度、错误与版本

当前池为一个实际 inflight，两个地图各至多一个最新 waiting；新请求替换同 owner 待办，释放一图不终止另一图。同步曲线工作无法在 Worker 正忙时被消息及时抢占，取消意味着主线程丢弃其结果，不能宣称已经中止消耗；inflight 上限避免积压很多完整克隆。最后 owner 释放需清 waiting/active/timer 并 terminate。

Worker 构造/模块加载失败、error/messageerror、协议错误、30 秒任务超时和编码失败应单次禁用该图准备路线，按原对象路径恢复；AbortError 为正常过时，不应当作全局故障。显式 deviceMemory <=4 和 Worker 不可用使用原路线。共享池失败时两个 owner 都应收到拒绝并各自完成回退，不留 pending promise。

专用 URL source 错误的回退必须确认当前 source 身份、当前 URL/entry、source 队列已 settled；只重建当前原始帧一次。同步把同一已处理错误标记给 Map 的冒泡处理器，避免已经自动恢复却留下“重新载入”警告。第二次对象路线失败仍须显示原错误。

已单独提醒实施代理覆盖：URL A 失败时 URL B 已排队，不能回退 A 覆盖 B，也不应留下过时 A 的重载警告；外部普通来源的真实错误不能因 Source 名相同被吞掉。移除/替换来源和 destroy 必须解除三个 Source 监听与回调闭包，清空 accepted/submitted/source，避免长 URL 被旧 Source 引用保留。

发布前全部新静态 import 与 Worker 入口需带同一构建戳；Worker 消息双方核验 protocol。协议号只能证明消息格式相容，不能独自替代资源版本绑定。专用 MIME 参数要在真实浏览器 request 与 fetch 路径验证。CSP 禁止 data: / worker 时必须有可用回退；不能以本地 VM 可 fetch 代替部署环境检查。

## 6. 内存与性能约束

1492 原活动 FeatureCollection 约 579 KB JSON，显示派生 JSON 18.75 MB，base64 URL 约 25.0 M 字符。后台并不会消除几何：Worker 同时可能持有原始克隆、曲线、线网、JSON 字符串、Blob 字节和编码串；主线程 Source/cache、MapLibre Worker 与 URL 解析又有各自表示。跨线程字符串也可能被复制。URL 字符数不是 JS 堆或进程常驻内存。

缓存只保留当前帧，不增加跨年强引用 LRU；被替换的 payload、raw、回调捕获、owner waiting 和任务错误都需要释放。完整 return string 仍会消耗传输与解码时间。deviceMemory 门限只是降低已报告低内存设备的额外峰值，不覆盖未知内存设备，也不是全进程上界。

真实比较应包含原同版本 JSON 控制路线与候选，至少三对交替；固定默认 1492、相机、窗口和数据。分别报告准备主线程输入 clone、Worker build/encode、最终 setData、LD/content、source-ready render、首次可见/查询、长任务与输入响应。候选增加 Worker 启动与 base64 成本，整体首帧未必与主线程长任务同时改善。

低内存真实设备未测，强制 GC 能力不可用时不能宣称 GC 后保留量减少或不存在泄漏；有限非 GC 堆观察只能作为趋势。双图和迅速年份切换是峰值场景，必须纳入验证。

## 待最终收口

等待实施代理最终文件与完整测试报告、最终版本戳，以及主代理 Chrome 的两条路线首帧配对和错误/重建检查。若最终文件改变，需要复核差异后才能把“当前方案无进一步阻断”写成最终审查结论。


## 最终实验路线决策：不采用后台疆域候选

主代理确认有效 vendor 后做了三对同版本交替 JSON / Worker 测量。本代理只读复核 `browser/valid-json-{1,2,3}.json` 与 `valid-worker-{1,2,3}.json`，六次 renderer decodedBytes 均为 937,616，排除了初轮误用旧 gzip 资源的结果。

| 指标（navigation 起算中位数） | 原对象路线 | 后台 URL 路线 |
| --- | ---: | ---: |
| 首次非空疆域可查询 | 1674.4 ms | 2509.3 ms |
| 当前 polities 来源 ready 后 render | 1958.7 ms | 2732.3 ms |
| 随后非空可见查询 | 1962.1 ms | 2735.8 ms |

该实现虽消除了主线程曲线构造和自动大对象回传，却引入输入/字符串传递、编码和 Worker 启动等代价；这组实验未实现首帧目标。因此本批不进主仓，保留候选、合同测试与竞态反例供后续研究。上述机制通过不能覆盖真实浏览器负性能结果。

根代理随后将工作转为 events 解耦，实施候选已独立写在 `../events-candidate/`，不包含任何后台疆域或 vendor 改动。其发布取舍另由真实限速 A/B 决定。
