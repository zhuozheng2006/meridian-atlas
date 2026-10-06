# 3.39 研究启动与全库检索：依赖、实现与验证检查点

真实项目：`/Users/zane/meridian_atlas/world-history-atlas`。本批次仅本地；不上传、推送或部署。主代理拥有 worker、reader、CSS、package 和资产盖章；本子代理拥有入口/轻量 shell/startup/index/app 最小接管接口及相关启动测试。

## 3.38 基线与瓶颈

`docs/verification-3.38/browser-research-cold.json` 为真实浏览器资源证据。冷研究没有 MapLibre JS、地图数据或 canvas，但 app 的静态依赖闭包仍有 **37 个模块，516,964 B 源码，191,968 B 实测传输**；其中 research-view 只有 7,701 B 源码/2,976 B 传输。因而其余 **36 模块/188,992 B 传输**可完全延后。map-engine 的子闭包23个模块，其地理、HALC、OHM、边界、湖泊模块均被拉入；city-narratives、places、polity-reader 又经工具函数反向依赖 map-engine，所以只把 AtlasMap 一个 import 改动态不会切断依赖。

旧请求链：HTML静态 app modulepreload → app及36静态依赖 → init/renderLanguage/bind → showView(research) → research-view动态reader → Polaris index/shard。旧完整 HTML 默认显示 atlasView/timeline、隐藏 contentView，直到 app 执行才改变 hidden；主代理在正常网络首个 snapshot 也复现地图/1492年闪屏。

完整依赖图及模块清单见 `startup-dependency-graph.json`。CSS还有16,908 B的 MapLibre/cartography 传输可后续考虑；本次保留原CSS避免引入样式时序风险。

## 已接入的有界方案

- HTML 默认 atlasView/timeline/browse/compare 为 hidden，contentView 显示双语中性加载状态。即使 JS 尚未到达也没有地图闪屏。
- startup 移到 head，仅非 research 路由提前 import app（此时只载入模块，不渲染）、预载catalog；地图路由还并行载入 MapLibre。它在 DOMContentLoaded 才访问正文节点，并按当时的当前 hash 展示初始区域。
- entry.js 无静态地图依赖，research 分支只动态载入 research-shell.js；shell 的唯一静态依赖是 research-view。研究页版本选择仍按需加载对应reader，原源校验/数据分片契约不变。
- 轻量 shell 覆盖五个顶部导航、返回资料、语言、帮助、skip link、Ctrl/Cmd+K。保存时复制完整当前hash，只改view/lang及研究白名单键，保留year/camera/双图/selection/boundary等地图参数。
- app 导出幂等 `startApplication() -> {ready,navigate}`，import 本身没有渲染、DOM绑定或数据请求。受控启动重新解析最新完整hash，避免下载期间改变语言/研究状态后接管旧参数。
- 用户离开研究时按需导入app，多个退出请求共享同一模块promise；token保证只有最新目的页接管。用户在下载途中继续研究，迟到app只停留在已下载状态，不能创建地图/覆盖研究。接管前同步销毁reader和解绑shell，随后由原app管理全部导航。
- app导入失败清除promise并显示重试及“继续阅读研究资料”。同源资产URL沿用当前资产revision。默认入口等待app.ready，启动异常由入口错误界面处理，不遗留未处理promise。
- 原 ensureAtlas 内 native优先取包、成功首帧后pointlayer启用、CShapes例外和双图共享保持原实现。默认地图原生包性能是否持平/改善需主代理以相同4Mbps条件测实际结果，代码顺序检查不能替代性能实测。

## 生产文件与验证

修改：public/index.html、startup.js、app.js。新增：public/entry.js、research-shell.js。
新增 scripts/validate-research-entry.mjs；调整 validate-map-runtime.mjs 的实际启动transport夹具和HTML入口断言；调整 validate-research-routing.mjs 的函数提取末端标记。没有改 package、reader/store、CSS 或stamp。

已通过：新入口 **15/15**、原 runtime **11/11**、research routing **15/15**、view-state **69/69**、boundary races **5/5**、interactions **9/9**、point-layer gate **8/8**。新测试执行生产entry/shell与app真实函数，覆盖初始HTML隐藏、head阶段不触未解析DOM、研究入口依赖闭包、读取ready拒绝、共享导入、重试、五导航、双版本、完整hash、语言与帮助、快速返回与过期结果、受控app只初始化一次。

机器报告 `research-entry-verification.json`；主代理应把 `node scripts/validate-research-entry.mjs` 加入npm test并统一盖章。浏览器最终需要验证 cold research app/map modules请求0、canvas0、首屏不显示年份地图，以及研究→Sources→研究、研究→Atlas→compare和快速取消。

## 全库检索同步工作（只读分析）

现行 readPolarisJSON 校验压缩/解压 SHA 后在调用线程同步 JSON.parse；loadSearchSheet 又在一次连续执行中验证整表并递归冻结。最大 Social complexity 表18,196,976 B解压JSON/26,033行；验证中每行 `index.polities.find`，仅此表累计约8,055,298次ID比较。桌面Node本地暖中位数：JSON.parse21.12ms、validation30.01ms、freeze5.37ms；这只是独立CPU线索，不是浏览器或手机成绩。脚本与原始试次见 benchmark-polaris-sync.mjs / polaris-sync-benchmark.json。主代理真实浏览器4倍CPU限速复现724ms长任务，其测量才是UI体验依据。

_scan 每500条让出一次执行，但发生在整表解析/验证/冻结之后，不能拆开前述长任务。onProgress每完成一张来源表发送一次，all最多6次，并非每500条重建DOM；pending阶段render主要重建状态/上下文，所以频繁render不是当前首要原因。24张Crisis卡片的21字段仍有较大DOM展开量，可后续独立测量。

主代理已把全库检索与显式导出转到worker，阶段小分片保留主线程。worker迁移可以缩短UI阻塞，但不会自动减少总解析量；默认2表LRU对跨6表的完整查询翻页仍会重新读取/验证前面被淘汰的表，属剩余延迟/内存权衡。可后续考虑有界结果页缓存或按字节预算缓存，而不能为省内存少算total/遗漏来源行。

## Worker 生命周期独立发现

只读检查主代理的 polaris-search-client / polaris-research-store / polaris-search-worker。主要signal/epoch、旧worker身份过滤、dispose终止、串行队列、checksum错误不降级、transfer导出设计与14项真实线程测试相符。

发现一项错误分类缺口，已即时通知主代理：握手snapshot mismatch首次错误拒绝且不fallback；_failure只保存failed=true，第二次请求_start把该状态统一转换为workerUnavailable，facade于是fallback到UI。复现 `worker-mismatch-retry-repro.mjs` / `.json`：第一次fallbackReads=0，第二次=1。应保存原失败原因，只给真实运行环境不可用类错误贴workerUnavailable，增加两次请求的负控。本文记录的是发现时状态，最终修复由主代理核验。
