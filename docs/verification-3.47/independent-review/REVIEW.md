# 3.47 全球首屏与派生帧缓存独立审计

基线：主仓 `25ba64cd`，3.46.0，资源戳 `3.46.0-dce023e2071a`。本代理只读产品代码、候选和实际数据，所有审计输出在本目录；未操作浏览器、Sites 或主仓。

**结论：当前单帧缓存针对的是已证实的同年重复计算和重复提交，不是第一次打开地图的加速。** 首帧仍须生成和提交约 18.75 MB 的派生几何。候选初版的排队差量覆盖问题已由独立反例确认，实施代理已修复；修正版在已完成、自有数据身份匹配时才跳过 setData，飞行中的请求保守重提。

## 1. 默认 1492 首屏真实路径

1. `startup.js` 在正文到达前预热 app、catalog 与 MapLibre；`entry.js` 启动 app，默认为 1492、globe、auto、曲线开启、中心 [25,18]，缩放随视口变化。
2. `ensureAtlas()` 预取一个 `native/year-1492.json.gz`，同时等待 MapLibre 和 `ensureCoreData()`。后者用一个 Promise.all 同时等待 catalog 与 events；这使事件包也成为创建地图之前的依赖。
3. MapLibre 首个 style 只有基础陆地以及空 polities 来源。`AtlasMap.ready` 由初始 map load 解决，随后启动 Geography、区域历史来源和街区控制器；它不是 1492 疆域已呈现的证明。
4. `applyYear→AtlasMap.setYear→BoundaryController.prepare→prepareOverview` 等待完整原始 native 年包。预取与实际加载共享进行中请求；136 个活动政体、131 个独立几何在该包内，正常流程不必下载旧概览或大量单国文件。
5. `BoundaryController.commit` 无条件调用 `displayTerritories`。默认函数顺序是 curvedBorders→boundaryMesh→单次 polities.setData。native 几何已齐时 key 以 n 结尾，后续普通 moveend 的 upgradeDetail 直接退出。
6. app 在 setYear 返回后隐藏加载提示，但这里是数据已经提交；MapLibre Worker 解析、建立索引、视口瓦片和下一次 render 都仍可能未完成。全地图 idle 又可能被自然地理或其他图层拖延，不能代替当前疆域就绪。

没有找到“正常默认首屏必然重复提交两份 18.75 MB”的依据。已经证实的重复来源是同年语言切换、重新 setYear 或来源设置导致新的 commit；初始化空来源的处理也不应算作重复大几何。

代码依据：`public/startup.js`、`entry.js`；`app.js:505–518`、`:101–117`；`map-engine.js:61–114`；`native-geometry.js:30–94`；`boundary-controller.js:17–20`。

## 2. 数据膨胀与重复工作：独立实算

调用实际 AtlasMap.displayTerritories、activeRecords、color 和实际 1492 数据；只把 setData 换为捕获及原生 JSON.stringify，避免使用模拟算法证明自己。原包计算前后 SHA 不变。

| 阶段 | 字节数 | 坐标数 | 含义 |
| --- | ---: | ---: | --- |
| native 年包 gzip | 150,207 | — | 下载字节，不能直接和解压对象内存相比 |
| 解压后的年包 JSON | 506,889 | — | recordIndex 与去重几何字典 |
| 136 政体原始 FeatureCollection | 579,124 | 14,537 | 含别名使用的重复记录 |
| 曲线面 | 11,110,838 | 286,151 | 保持现有算法与参数 |
| 共边线网 | 7,641,848 | 196,913 | 单独边线绘制需要的派生表示 |
| 最终 137 Feature 提交 | **18,752,670** | **483,064** | 原始面记录加一条 MultiLineString Feature |

Node 三次新集合准备为约 241–252 ms，JSON.stringify 为约 20–22 ms。重复使用同一 FeatureCollection 对象时准备约 0.02 ms，但 stringify 仍约 20 ms。当前两个 WeakMap 的确有效，只是 prepareOverview 每次重新包装 FeatureCollection，因而同年重复流程不能命中它们。上述数字是本机 Node、数据已在内存的观察；不含浏览器调度、真实结构克隆、Worker 索引、瓦片与 GPU，不能宣称节省相等的首屏时间。

记录：[baseline-measurements.json](baseline-measurements.json)、[frame-byte-costs.json](frame-byte-costs.json)。重跑：`node work/release-347/independent-review/measure-global-baseline.mjs`。

### 根线程的真实浏览器基线

本代理复读 [baseline-language-summary.json](../browser/baseline-language-summary.json)，没有自行操作浏览器。1492、[25,18]、zoom 1.54、1512×599，同年 en/zh/bi 切换各一次：displayTerritories 为 485.2 / 465.1 / 468.0 ms，每次 setData 一次，序列化 18,752,685 字符；随后仍有 428 / 419 / 259 ms 的晚期主线程长任务。

这证明同年重复流程值得优化，不证明所有晚期长任务都由某一个函数造成。Chrome 派生字符数与 Node 相差 15；不可声称跨引擎浮点计算的派生 JSON 字节完全相同，应严格核对原始数据及同一运行环境的前后结果。

根线程报告 Page.addScriptToEvaluateOnNewDocument 不在当前浏览器能力范围，未尝试绕过，也未取得首屏函数时间。本批浏览器数据只有同年切换，不将其改称首屏计时。

## 3. global-frame-candidate 的独立评价

候选路径：`../global-frame-candidate/public/territory-frame-cache.js` 与 `map-engine.js`。核心做法是每 AtlasMap 只保留当前派生帧：按原几何对象/coordinates 引用、完整非 coordinates 元数据、Feature 顺序和 mode 判断是否相同。相同内容的新集合可复用曲线与线网；来源对象替换或观察不到来源数据身份时保守重交。

这个范围适合当前产品：native/overview 缓存中的源几何按不可变数据使用，MapLibre 收到的是序列化后的独立数据。缓存不修改曲线参数、原坐标或来源字段，也不把语言当作几何变化。Source kind、曲线开关、记录属性/顺序、geometry 引用变更必须失效。任意深层 coordinates 原位修改不被自动检测；此类新调用者须显式 invalidate，不能将该缓存宣传为任意可变 GeoJSON 的内容缓存。

### 实质问题及修复

初版只按 accepted 数据身份跳过 setData，在以下序列失败：

1. 自有 A 正在 Worker 处理。
2. 外部 updateData(diff) 排队；上游不会立刻更换 `_data`，也不立刻发 dataloading。
3. 同年再次提交 A，缓存误判可跳过。
4. 差量最终仍执行，地图变成 A+diff；原无缓存代码会用 setData(A) 替换 pending 队列并清除 diff。

我将此问题反馈后，实施代理加上 `source.loaded()` 才能跳过的条件。独立实际 MapLibre 主类/Worker 类测试确认：恢复初版条件时最终 IDs 为 [1,2]，原产品与修正版均为 [1]。没有更改候选；旧条件只在内存模块中复现。

证据：[queued-diff-repro.json](queued-diff-repro.json)；重跑：[queued-diff-repro.mjs](queued-diff-repro.mjs)。通过本例时 cache 文件 SHA 为 `7bd21fb2268a9b31dba4035950d5b4ffc2cda729934b9c14dee947482b120751`。

来源事件证明另一个应保守处理的细节：A 完成会先把 `_data` 改成 cloneA，随后 finally 开始 pending B 时并不会重赋 `_data=B`，所以 B 的 dataloading 中 serialize().data 可能仍是 cloneA。候选对这种不确定状态不认可可跳过是正确选择；不应为了每次都零提交而猜测请求身份。

### 必须覆盖的最终候选用例

| 场景 | 必须保持的结果 |
| --- | --- |
| 同年同几何、语言/面板变化 | 已 settled 后可复用；语言、选中样式与标签仍更新 |
| 同年原生补齐、新对象坐标、记录属性/顺序变动 | 派生失效，提交与原算法一致 |
| curved→raw→curved、Cliopatria→CShapes→原来源 | 不串用不同表达；快速排队也最终正确 |
| 同 Source 的外部 setData/updateData、setStyle(diff) | 同年重申必须恢复预期内容；不能只看 Source 身份 |
| own A→own B、external A→own B、排队 diff | 不错误认可旧回复，不删除新请求；不确定则重交 |
| 错误、同步异常、source 替换 | 失去 accepted 证明，下次必须可恢复 |
| 双图独立、关闭其中一图、destroy | 缓存/监听不串图，释放 entry/source/accepted |
| 强制 invalidate 与缺少观察接口 | 重新构造；接口不足时保守提交 |

最终浏览器应以相同 en/zh/bi 场景验证：正常 settled 重复时 0 次 polities.setData，同时显示数据 hash、政体数、点击/选中、语言标签和 source ready 保持。此时可报告同年切换改善；首次构造仍至少 build/submit 一次。

## 4. 可重复测量与内存约束

首屏和重复操作分开测，不把首次对象缓存构建算作命中。记录固定 commit/资源戳、默认 hash、窗口、camera、投影和图层。每组至少三轮交替基线/候选；HTTP 热缓存的新页面与真正冷网络分别归档。进程内 WeakMap/native cache 复用不能混称 HTTP 缓存热。

首屏需要的里程碑：navigation、catalog/events/renderer 各自完成、Map 构造与 load、native 解码/校验完成、曲线/线网、setData 前后、当前 polities 的 content、源及视口瓦片 loaded、随后 render。显示证明应有可见几何/截图或命中记录；geometry-status 和 applyYear 返回只能证明已提交，global idle 也不能反推首次有效帧。若当前工具不能在首屏捕获这些点，报告缺项，不拼接后来同年测量补齐。

内存只允许一个当前派生帧，不加入跨年强引用 LRU。当前原有 WeakMap 在 rawTerritories 活着时本就保留派生几何；新增缓存仍必须在 frame 换代、source 替换和 destroy 时释放额外强引用/监听。accepted clone 只是数据归属证明，不复制整个对象；但它可能延长旧 clone 的寿命，来源事件与 unbind 必须清除。Node 字节数不等于 JS 堆占用，更不等于 Worker/GPU/进程总内存。当前浏览器不支持强制 GC 的限制仍在，没有可用的 GC 后保留量对照时，不宣称内存降低或无泄漏。

## 5. 首帧下一项实际实验：优先小源包后台计算

**不建议把完整派生 GeoJSON 预生成文件作为默认下载替代。** 精确实算：18,752,670 B 的相同提交 gzip6 仍为 7,907,065 B，gzip9 为 7,909,142 B，约为原 native 年包的 52.6 倍。新增约 7.76 MB 在理想 4 Mbit/s 下仅传输就约 15.5 秒，20 Mbit/s 约 3.1 秒；解压/解析、结构克隆、索引还未计入。HTTP 暖缓存可能避免新增网络，但不能据此推出冷首屏更快。

更值得做的下一项是：仍下载精确的小 native 包，把原曲线与边线函数放入一个有界准备 Worker，并在有效年份、完整活动记录已知后尽早计算。两种运输方式分别测量：直接返回派生对象，或返回自包含序列化表示；前者可能把 18.75 MB 对象克隆开销转回主线程，后者增加编码峰值和长字符串传递，并须完整保留 getData、样式序列化/重建、更新、错误和取消契约。3.45 已说明单纯移出计算未必改善整体 ready，应先在实验分支用真实浏览器全链路比较。

这项实验的边界：只处理最新有效帧、至多一个准备 Worker/任务队列；快速年份切换及双图有 owner/generation；不能缓存所有年份派生结果；低内存或 Worker 不可用保留原路线；Worker 结束必须释放工作缓存。时间包含多年代时不能把包内所有政体一起柔化，必须只用当前活动记录，否则邻接/碰撞约束会被不同时代的几何改变。原包数据和最终可见表达必须与原路径一致，保持来源下载、选中和原档案读取不依赖派生缓存。

另一条首屏依赖值得单独实测：catalog gzip 602,739 B / plain 4,816,003 B，events gzip 446,517 B / plain 1,470,967 B。目前地图构造等待二者。若资源时序证明 events 拖慢创建地图，可先让 catalog+renderer 开图、事件数据随后到达；须保留“正在加载”而非显示零条记录，并正确处理搜索、事件 URL 恢复、计数、失败重试和切换视图。此项属于应用状态改变，不能仅删掉 Promise.all 的 await。

不建议此批通过降低原始边界精度、关掉曲线默认值或少画政体来得出首屏加速。显示曲线的屏幕误差自适应是另一项较大的制图实验，涉及共边一致、投影/纬度、放大切换和视觉验证，应独立设计，不能混入同帧缓存。

## 最终缓存收口复核

实施代理最终版在 unbind 中 off 之后把 onLoading/onData/onError 三个回调字段也置 null，避免回调闭包继续持有旧 Source。已只读确认，未发现新阻断。独立 queued-diff 实际 MapLibre 回归再次通过；当前 cache SHA-256 为 `e28e96bb026061f4605f07752a2081f7882b7a587ee76afed57c6e5402c91385`。本批不继续扩展后台 Worker 实验；上节首帧方案保留为后续方向，不作为已实现功能。
