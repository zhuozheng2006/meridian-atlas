# 3.46 地貌 data URL 独立审查

审查日期：2026-10-10。审查者：reader_345。只读候选、实际 MapLibre 5.6.2 和既有应用代码；只写本目录。未操作浏览器、主仓库、Sites，也未部署。

**最终复核结论：已只读检查主仓 3.46.0-082c97964103；自动回退、立即释放旧 Source 监听器、低内存门限及湖泊独立就绪逻辑未发现实质阻断。** 根线程提供的实际 Chrome 记录已复读并独立计算，但本代理没有操作浏览器；下方原接口分析仍适用，新增回退与浏览器结果见末节。 相比 3.45 的 Blob URL，完整数据 URL 消除了撤销后样式无法重建的生命周期问题；它仍有编码、字符串传递和 URL 解析成本。真实大载荷和交互测量由根线程完成。

## 核对版本与补丁范围

- 原始 MapLibre 5.6.2：937395 bytes，SHA-256 `1525f971223d81f169f049f1ce50083e6f1643aa6b0ea0716653a550d2d57fc2`。
- 候选：937511 bytes，SHA-256 `ce1a6e48007792219265ead1fc233089e591128b6a1e538ea538d208ddc3850c`。
- 独立逐字比较确认：候选等于原件仅替换一次 `this.loaded={};const s={data:i};`，没有继承 3.45 的 Blob 请求路由补丁。
- 分支仅在 `source === "halc-landscape"` 且 `request.url` 精确以 `data:application/geo+json;base64,` 开头时返回原 URL。普通对象、HTTP URL、其他来源、非规范 MIME/前缀、无 request 的差量更新均保留原完整对象回复。
- 具体源码片段、字符位置和文件哈希见 [evidence.json](evidence.json)。字符位置依据冻结初版候选，不是源码行号。

## 接口与状态审查

| 项目 | 实际 5.6.2 的调用关系与判断 | 收口验证 |
| --- | --- | --- |
| `getData` / `getBounds` | GD 单独请求 Worker 的 `_pendingData`；后者仍保存完整处理后 GeoJSON，`getBounds` 调用 GD。此次补丁没有触碰这条路径。显式调用时仍会回传完整对象。 | ready 后及更新后检查原几何和 bounds。 |
| `serialize` / `getStyle` | 主线程 LD 仍给 `_data` 赋值，随后 serialize 将字符串作为合法 source.data 输出。完整 URL 可持久解码，无需 Blob URL 生命周期。不要再假定 `getStyle().sources[id].data.features` 存在。 | 对保存样式中的 data 解码，与 getData 的规范化结果核对。 |
| `setStyle` / source 重建 | URL 包含未改写的选中原几何；新 Source 重新解析、rewind、filter。相同选项应生成等价来源。相对网络地址、已撤销 Blob、外部缓存均不再是依赖。 | 用实际 `map.setStyle(savedStyle)` 验证完整重建；新建 Source 的 VM 检查不能替代这一项。 |
| filter / rewind / promoteId | Worker 原加载、可更新 ID 映射、rewind、filter 和索引均未改。URL 保留的是处理前原文，GD 返回处理后对象；不可直接要求这两种表示在过滤/环向处理前字节相等。 | 使用有 filter 和反向 polygon 的样例比较重建结果、PBF 与基线。 |
| `updateData` | 差量参数只有 `dataDiff`，没有 request，所以 LD 返回更新后的完整对象，并让 serialize 反映更新值。不会一直保存旧 URL。 | 增删改之后 getData、serialize 再重建；后续 setData URL 再次恢复 URL 分支。 |
| metadata/content / source 事件 | LD 成功后仍按原顺序赋 `_data`、发 metadata、content；style 的父事件载荷也会调用 serialize，现在 data 是 URL 字符串。事件不是完整几何通知契约。 | 源就绪状态与事件序列；普通 source 对照。 |
| 连续 setData / 排队 | 主线程已有 `_isUpdatingWorker` 和 pending data/diff 合并；补丁只改变已完成 LD 的 data 表示，未改变排队策略。旧完成值暂时赋 `_data` 是上游已有行为，不能把 pending 最新值误认为已索引完成。 | 延迟旧请求→新 setData/差量→最终只显示最新帧；记录错误不覆盖后续成功。 |
| 取消 / 来源移除 | 原 abort、abandoned、removed、dataabort 分支保留；准备 Worker 按 owner/id 忽略过期回复。同步 stringify/base64 过程中不能及时处理 cancel，但完成后的主线程 pending 已删除，过期结果不能交给地图。 | 编码前后快速移动、移除 source/地图、双地图一个退出而另一个继续。 |
| 失败 / 重试 | 最终版除准备 Worker 不可用降级外，当前 data URL Source 错误也会释放本图租约、禁用此控制器的准备 Worker、移除来源并走旧 JSON 路线一次；再次错误保留显式重试。 | 根线程实际 LD 注入一次错误后恢复 JSON ready，记录已复读；详细时序见末节。 |

本审查的静态结论表示调用关系保持，不表示上表所有浏览器验证已经通过。

## URL、编码与浏览器限制

1. 规范 base64 内容没有冒号，整个 URL 不含 `://`。实际 5.6.2 的非 HTTP 协议分派仅在 `/:\/\//` 命中时发生，因此该规范数据 URL 直接走 Worker fetch，不需要 addProtocol 或 Blob 路由修补。实际主线程先通过共用 `<a>.href` 规范化，仍需大载荷实测这一整条路径。
2. FileReaderSync 从 `application/geo+json` Blob 生成 UTF-8 数据 URL；备选 `TextEncoder` + `toBase64` / 分块 btoa 的逻辑保留相同字节。btoa 的 stride 是 24576，为 3 的倍数，分块后拼接不会引入中段 padding。中文、emoji 和跨块情况见下方独立检查。不要向 URL 尾部附加版本 query/hash，也不要先 decodeURIComponent 再使用；当前候选没有这样做。
3. Chromium Mojo 的 URL 类型明确限制跨该接口传递的 URL 为 2097152 字节；这**不能直接证明** 26 MB 的常规 data fetch 失败。Blink 的常规 data 子资源路径使用 `CanHandleDataURLRequestLocally`，在异步请求入口排队 `HandleDataUrl` 并本地 `ParseDataURL`，避免常规网络 loader；DownloadToBlob 等情况例外。该官方源码支持继续实验，不能替代当前安装 Chrome 的验证。[Mojo URL 源码](https://chromium.googlesource.com/chromium/src/+/master/url/mojom/url.mojom)、[Blink ResourceLoader 源码](https://chromium.googlesource.com/chromium/src/+/81c9e08554271836d8c2bc93a9f5e48a0cdf0b5e/third_party/blink/renderer/platform/loader/fetch/resource_loader.cc)。
4. CSP 的 connect-src 管理 fetch，未设置时还可能由 default-src 限制；仅允许 self 不等于允许 data。捆绑 MapLibre 使用 Blob 创建 Worker，策略继承也需要考虑。项目 Worker/构建入口未检出显式 CSP，不代表部署平台响应没有策略。应检查最终页面/Worker 响应策略和 CSP violation，而不是只检查本地服务。[W3C CSP](https://www.w3.org/TR/CSP/)。

## 内存和性能判断边界

- 这是减少**完整几何对象的自动回传**，并非零复制，也并非免解析。准备 Worker 仍缓存完整源分片，并生成 JSON 文本、UTF-8 Blob/bytes、base64 URL；MapLibre Worker 再解析同一数据并建立索引。
- base64 长度为 `33 + 4 * ceil(UTF8Bytes / 3)`，较 JSON 字节至少膨胀约三分之一。准备→主线程→地图 Worker→主线程仍传长字符串；字符串的物理复制或共享属于引擎实现，不能据 JavaScript 引用数推导已分配内存。
- 当前视图、正在处理的旧视图、排队新视图、两个地图来源及保存的 style 都可能并存。全局 URL 解析用的 `<a>` 会保留最后 href；从保存 style 建立 Source 时 `_options.data` 也可能保留初始 URL，即使 `_data` 已更新。这不是无限泄漏的证据，但不能宣称所有旧 URL 都会马上释放。
- collectResourceTiming 开启后，长 URL 可能再进入 timing name；当前常用路径未启用。调试日志、异常文本和 JSON.stringify(getStyle()) 也会复制大量字符，应避免完整打印。
- 相同视角、相同数据条件下比较整体就绪时间及晚期最长主线程任务；3.45 已证明“主线程 JSON 解析为零”不足以说明用户体验改善。本代理未做浏览器计时、内存峰值或低内存移动端测试。

## 本代理独立验证与发现

- 直接读实际候选与上游，核对精确单点补丁、上述调用关系和控制器失败路径。
- 对生产编码函数执行 4 个原生 Node 例：空串、混合中文/emoji/数学补充字符、孤立代理字符、跨块文本；独立 Buffer UTF-8 比较、URL/Request 保持和 fetch 解码均通过。
- 强制禁用 Uint8Array.toBase64，直接执行生产 btoa 备选路径，10 个相邻块边界例均与 Buffer UTF-8 完全相同。此检查没有模拟 FileReaderSync，不能作为该浏览器分支的证明。
- 发现真实数据验证脚本把 URL 前缀长度误写为 30，实际为 33；已反馈，实施代理确认修正。生产编码代码未因此修改。
- 实施代理正在提供实际 vendor VM 的 GD、样式重建、差量、错误/取消和全量 PBF 对照；根线程负责真实 Chrome。它们不计入本代理亲自执行的 14 个编码检查。

最终是否发布应以根线程的完整浏览器结果和部署环境检查为准；本报告没有把候选报告或其他代理的成功消息算作独立复测。

## 最终主仓复核补记 · 3.46.0-082c97964103

### 独立代码复核

- `watchSource` 直接监听当前 GeoJSONSource；实际 5.6.2 `Evented.fire` 向父节点冒泡时沿用同一事件对象，所以 WeakSet 标记确实可以避免同一错误再被 map 监听器处理一次。WeakSet 不强持有事件。
- 实际 `_updateWorkerData` 的 catch 在发错误前已把 `_isUpdatingWorker` 清为 false；`loaded()` 还检查 pending data/diff。故“旧更新错误且已有新 setData 排队”时 loaded 为 false，监听器不误降级新请求。eligibility、Source 对象身份、pending.seq 共同挡住旧视角、切年和已替换来源的错误。
- data URL 分支失败后 `prepareWorker=null`，故自动回退最多一次；第二次 JSON 失败进入 fail，不会循环创建 Worker。共享准备 Worker 的 destroy 是本图 lease 的释放，另一个 owner 仍存在时不会终止整个 Worker。
- `retry()` 在 removeSource 前同步执行 `unwatchSource()`，`destroy()` 也立即 off 并把 errorSource/listener 置空；这解决了旧 Source 及其大 URL 经控制器监听器字段残留的问题。浏览器内部 URL 锚点、样式存档等仍可能持有字符串，不能由此推断全部 URL 内存已回收。
- `deviceMemory <= 4` 时返回旧路线，未创建准备 Worker；信息缺失的浏览器仍使用 Worker。这个有条件的保护避免新增编码峰值，不保证所有低内存设备都被识别，也不保证旧地图路线的总内存上限。
- 湖泊新门槛先要求当前 `renderSeq===seq` 的 content，且 GeoJSONSource.loaded() 为 true；再等待 `isSourceLoaded`、一次 render 和停止移动/当前覆盖区/档位一致。实际 SourceCache 在 content 冒泡前会 reload/update 瓦片，因而不能用上一轮已 loaded 的瓦片直接越过门槛。原 idle 兜底仍保留；destroy 移除新加入的 sourcedata/render 监听器并清 renderPending。未发现由此引入的实质就绪误判。

### 已复读的外部浏览器证据

这些数据由根线程在 Chrome 取得，本代理读取现存 JSON 后独立核对统计，不把它算作本代理另跑一轮。

- [ab-summary.json](../browser/ab-summary.json)：同一构建、同一 1512×543 视图，中心 [4.8,51.3]、zoom 6.3，旧 JSON / data URL 交替各三次。旧路线 ready 为 4281.2 / 4672.8 / 4514.9 ms；新路线为 4111.6 / 3888.1 / 3615.6 ms。中位数 4514.9 → 3888.1 ms，减少 626.8 ms，约 13.9%。六轮均 2884 地貌面、12 标签、12455 单元、133 地区。此为特定浏览器/视角的小样本结果，不外推所有浏览器、网络或设备。
- 同一记录的主线程长任务分别为旧 [53,298,87,474] / [242,86,461] / [254,88,62,209] ms，新 [238,94,71] / [149,272] / [241,100,54] ms。新路线没有前两次旧路线的 461–474 ms 长任务，但第三组新路线最大 241 ms 与旧路线最大 254 ms 接近；不宣称每一阶段或每一次操作都同幅度改善。
- [source-error-fallback.json](../browser/source-error-fallback.json)：injected=1、reason=data-url-source-error、transport=object、workerDisabled=true、ready/active、failed=false，恢复 2884 面与 12 标签，符合一次回退设计。
- [getdata.json](../browser/getdata.json) 与 [style-reload.json](../browser/style-reload.json)：26141825 字符的数据 URL，GD 及样式重建后均为 2884 要素；GeoJSON SHA-256 同为 `f1046a52e437babef59f989ee0ab329fdde6762c68c5060b35ec00326a3355a9`。
- [湖泊外部记录摘要](../global-load-audit/browser-evidence-summary.json)：根线程单次比较中同为 88 个湖泊，来源自身 ready→激活从约 1434.3 ms 降为 8.0 ms；只支持减少等待全地图 idle 的额外间隔，不证明瓦片下载本身变快。
- 根线程报告当前 document/entry 响应无 CSP header；本代理没有重新请求部署服务，也未验证未来平台策略变化。
- 根线程尝试的 HeapProfiler.collectGarbage 被浏览器能力限制拒绝，故没有 GC 后保留量对照。本代理不据任一 performance.memory 快照宣称内存下降、无泄漏或峰值更低；如记录非 GC 观察，应继续明确这一限制。

本次补记只更新审查文档与证据。无产品文件写入、Sites 操作或浏览器操作。
