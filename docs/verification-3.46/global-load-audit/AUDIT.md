# 1492 全球地图加载链路审计与湖泊候选

审计起点：主仓提交 `a5cc8779de597ffd1838aecdc1097218f505c72f`，3.45.0。只读主仓；所有交付均在本目录。审计期间根代理继续处理 3.46，所以主仓的资源版本号可能已更新。本代理不操作浏览器或 Sites；收尾时读入根代理提供的真实 Chrome 对照，另列在文末，不将其扩大为生产普遍性能结论。

## 结论

正常的 1492 首帧已经等待原始 Cliopatria 年包。首帧完整后，放大不会再次升级该全球疆域；用户看到的“概览→详图”主要还包含自然地理分格、湖泊、远程地形和区域历史边界四条独立链路。

本次找到一个能在真实控制器及实际 MapLibre 源类上复现的额外等待：3.45 湖泊已经完成自己的数据和视口瓦片，仍须等待整张地图 `idle` 才显现。已准备独立最小修复，16 项新回归和原有 17 项完整湖泊验证通过。随后根代理的真实 Chrome 单组对照确认：1492 全球视野跳到东非6.3级，湖泊自身完成后的等待由约1,434 ms降到8 ms，两次均为88条湖泊。**这是指定视角的一次对照，不是全网站或所有视角的速度保证。**

另一个值得单独测量的全球路径是曲线派生几何：1492 年包只有 150,207 字节，原始显示坐标为 14,537 个；默认曲线和线网产生 483,064 个提交坐标、18,752,670 字节 GeoJSON。Node 观察中该准备工作约 289–297 ms，不能代替浏览器计时。普通放大不会重算它，同年份语言切换却会重新创建集合、重算和重新 setData。

## 首屏和年份链路

1. `public/startup.js:1` 在正文到达前预热 app、catalog 和 MapLibre；`public/entry.js:10` 对默认 atlas 路由启动 app。`public/app.js:26` 默认 1492、globe、auto 边界、地形/湖泊/城市/历史街区开启、现代参考关闭。没有保存 camera 时，中心 `[25,18]`、初始缩放由视口决定（`public/map-engine.js:60`）。
2. `public/app.js:512` 在 catalog 尚未准备时预取 `data/native/year-1492.json.gz`。`ensureAtlas()` 随后同时等待 `ensureCoreData()` 和 MapLibre。`ensureCoreData()` 把 catalog 和 events 绑在一个 `Promise.all` 中（`:505–518`），因此 **446,517 字节 events 也在创建地图的前置路径上**；这是代码上的依赖，不是已测出的当前生产瓶颈。
3. 地图初始 style 先加载 `data/land.geojson`；地图 `load` 后启动 Geography、区域边界和街区控制器（`public/map-engine.js:64–69`）。Geography 并行请求三个自然地理概览：land-50m 527,552 字节、water-overview 80,465 字节、ocean-overview 453,272 字节。地图构造的 `ready` 只表示初始 MapLibre load，不表示这些详层或疆域已显示。
4. `prepareOverview()` 名称容易误导：它先等待 `loadNativeFrame()`（`public/map-engine.js:77–82`）。1492 是 bootstrap 年，使用单个 native 年包；不走时间包、不走大索引和单国小文件。136 个当年政体全部存在于该包，131 个独立几何，别名共享原几何对象。
5. `native-geometry.js:30–45` 合并预取与实际帧的进行中请求；完成后把几何放进 `native` Map，标记 loaded，再从通用 JSON promise cache 释放整个包。并无正常重复请求。`validPack` 检查整个包和映射，实际帧另查所有活动记录完整性。旧导航结果可缓存，但 `request` 序号阻止旧地图提交。
6. 年包失败时首帧才回退到 `data/fast/year-1492.json.gz`；后台随后尝试 1492–1496 的 `temporal/pack-081.json.gz`，再按需读取索引及最多六路单文件（`native-geometry.js:54–94`）。不能把这个异常恢复路径当作默认加载流程。
7. `BoundaryController.commit()` 无条件调用 `displayTerritories()`（`public/boundary-controller.js:17–20`）；默认依次执行 curvedBorders、boundaryMesh、polities.setData（`public/map-engine.js:95–100`）。原始包就绪不等于 worker 索引、视口瓦片、GPU 首帧都已完成。
8. 当前 `geometry-status` 在 setData 调用后立即发送，`applyYear()` 返回即隐藏总加载提示（`public/app.js:102–117`）。这些都是“已提交”观察点；不能用于报告疆域像素已经显示。后台 upgradeDetail 在 geometryKey 以 `n` 结尾时直接返回（`public/map-engine.js:107–115`），所以正常 1492 moveend 不重新取包或重算疆域。

## 放大究竟加载什么

| 阈值与图层 | 请求和计算 | 当前显示门槛 |
|---|---|---|
| z≥4 Natural Earth 分格 | physical-spatial index；视口加 20% 边距；最多四路所有相交 10° cells；全结果验证/合并；一次 GeoJSON setData | 自身 sourcedata 或 idle，加 isSourceLoaded 与当前序号；完整后同时显示陆地、水面、海岸、河流 |
| z≥4/6/9 HydroLAKES | lakes index；视口加 20%；分层选所有相交 shards；最多四路；解码所选 feature；一次 GeoJSON setData | **3.45 仅 idle 调 reconcile**，即使湖泊自身已经完成也继续透明 |
| z≥5 地形 | Mapterhorn raster-dem 外部瓦片、hillshade | 当前视口可用 DEM 瓦片且源完成；出错保留本地晕渲 |
| z≥6 区域历史边界 | 自动模式下 OHM 在线行政矢量瓦片；匹配固化区域与年份时另读本地冻结帧 | 自身 content、瓦片、后继 render 和区域覆盖门槛；已不依赖纯 global idle |
| z≥8 海岸参考 | OpenFreeMap TileJSON/矢量瓦片；默认现代参考关闭也会为海岸加载 | 源完成后切换精细海岸；z≥9还显示自然水系 |
| z≥11 历史街区 | OHM 道路/建筑瓦片 | 年代过滤、自身可用瓦片和后续查询 |

HALC 是显式来源，1500 年低地国家的专项表现不能代表默认 1492 auto。上述阈值来自 `physical-grid.js:4,77–105`、`lakes.js:4,57–91`、`geography.js:79–155`、`regional-boundaries.js:10,166–245,320–372`、`historical-detail.js:45–76`。

分格和湖泊都等待本轮所有相交分片到齐才提交；同一时间还会有 DEM、OHM、relief 瓦片。请求并行、反复 setData、worker 排队可能是实际详图等待的一部分，必须用目标视口实测来分解。不能以“JSON 下载完成”推断图已经可用，也不能用主页面 ResourceTiming 缺少 worker PBF 条目推断没有网络耗时。

## 已有证据与本次证据边界

- `docs/verification-3.37/native-request-regressions.json` 已验证 1492 单包、136 记录、预取合并、原始缓存复用、不并发抢取概览、取消和故障恢复。这是正确性回归，受控 1,547 ms 延迟不是浏览器基准。
- `docs/verification-3.38/browser-native-finalstamp-4mbps.json` 是 **3.38、本地、1450、4 Mbit/s 模拟、禁用缓存** 的资源时序；native 包在入口预取，总地图/全自然层仍有后续请求。该文件明确不测首像素，不能当作 3.45 默认1492线上成绩。
- `docs/verification-3.44/map-performance-review.md` 及对应浏览器 JSON 是 **1500 HALC、[4.8,51.3]、4.5→6.3**。它们证明应区分网络、主线程、worker 和显示完成，但不是全球默认路径的数据。
- 本次 `static-inventory.json` 是本地资产字节数、活动记录和几何坐标数。三块示意地理矩形仅用于说明请求选择量：它们不是浏览器视口，不能作为默认 globemode 的请求清单。
- 本次 `native-preparation-node.json` 是实际纯函数在 Node v26.7.0 的三次有界观察，输入已在内存中；包括曲线化、线网和 stringify，不包括下载、浏览器调度、worker、GPU。两个 WeakMap 缓存以 FeatureCollection 身份为键，本试验每轮创建新集合，反映现有同年重复 commit 的准备方式。
- 本次 `lake-readiness-regression.json` 的 16 项全部使用实际 LakeLayer；GeoJSONSource 和 SourceCache 直接来自仓库实际 MapLibre 5.6.2 bundle，worker/瓦片传输受控。它不是伪造 MapLibre setData 完成 promise。

## 最小湖泊候选

文件：`lakes.candidate.js`；补丁：`lake-readiness.patch`。`lakes.baseline.js` 保存未改的3.45控制器，便于根代理继续修改主仓后仍能复现反例。

候选在本轮 setData 前清空 content 证明，记录 `renderSeq`。仅当 `lake-detail` 的 content 到达、控制器序号仍当前、**实际 GeoJSONSource.loaded() 为真**，才记录当前提交完成；随后自己的源完成事件请求下一帧，在 render 中再次核对地图自身 isSourceLoaded、当前视口、缩放层级、移动与销毁状态，才显示湖泊。保留 idle 作为安全兜底。

这个 source.loaded 检查不可省略：实际 bundle 在旧 setData 完成时先发 metadata/content，最后才发起排队的新 setData；旧事件期间 pendingWorkerUpdate 仍非空，因此 loaded 为假。只替换成任意 sourcedata 就放行会把旧帧错误当成当前帧。content 又可能早于视口瓦片，所以还必须等自身 tile 完成，且不能只接收 sourceDataType=content（后续 tile 通常没有该字段）。

16 项覆盖：基线反例、自己完成而无 global idle、metadata/无关源不放行、content→tiles 顺序、两个排队 setData、迟到 tile、movestart、仍移动、越出视口/层级、已加载边距复用、源错误、真实 worker rejection、隐藏/现代参考、独立 destroy、网络回包迟到、idle 兜底。

原有17项湖泊套件在 `existing-lake-suite/` 单独运行通过，包含完整 1,421,001 条湖泊的文件 hash、分类、闭环与所有坐标检查。`validate-lakes-fixture.patch` 只让旧测试夹具补充实际源已有的 loaded()、triggerRepaint() 和 content 完成事件，保留全部旧断言；生产不依赖该夹具。

## 根代理的浏览器测量计划

先保留原有默认配置启动1492全球视野，再分别做：原中心 `[25,18]` 连续跨4/5/6级；全球视野飞到东非湖区 `[32,-1]` 的6.3级；全球视野飞到 `[106,10]` 的6.3级。后两项可覆盖有实质湖泊数据和不同水系/区域来源，不代替首项。HALC应保持 auto，不改成年1500。

每组使用相同窗口、相同 camera、相同图层，报告冷页与热页分开；至少三次有效样本，保留完整结果。网络节流需说明缓存与 worker 请求覆盖；候选和基线都重新加载页面，确保 worker 池配置一致。

| 时间点 | 精确含义 |
|---|---|
| 页面开始、ensureAtlas进入、catalog/events/renderer分别完成 | 定位首屏前置依赖 |
| native响应头/末字节、解压解析完、validPack完、frame返回 | 不将下载、解码和校验混为一项 |
| curvedBorders进入/退出、boundaryMesh进入/退出、polities.setData前后 | 定位主线程派生和同步序列化 |
| polities content、自身 isSourceLoaded、下一 render | 区分提交、worker、视口准备；另取像素截图证明可见 |
| 每次 moveend、各图层选中分片/字节/缓存命中、末分片返回 | 确认本轮详层真正请求了什么 |
| physical-grid/lake-detail setData前后、content、最后自身loaded | 分开网络/主线程与worker/瓦片等待 |
| LakeLayer.ready、fill-opacity=1、后继render、地图idle | `lake-ready - own-loaded` 是候选针对的额外等待；不能用地图idle代替湖泊完成 |
| regional content/后继render/active、DEM ready、reference ready | 核对是否其他来源拖住了global idle |

根可在既有 `window.__meridian.instances` 上给地图 `sourcedata`/`render`/`idle` 和源 setData 加临时观测包装，并每次记录 `sourceId`、`sourceDataType`、`isSourceLoaded`、layer.seq/renderSeq、map.isMoving、year、zoom、bounds。对 lake-detail，必须同时记录 `map.getSource(id).loaded()`；读取状态和时钟不会改变生产源码。真实浏览器的 `isSourceLoaded` 到“地图上的有效像素”仍需下一帧截图或命中/可见层证明。

## 后续最小优化优先级

1. **先测并验湖泊自身完成候选**。不改湖泊几何、分片选择、tier、时间语义；目标是去除无关源等待，不承诺减少下载或索引工作。
2. **3.47 候选目标：同年派生结果复用，本批不实施**。为实际相同 geometryKey 和平滑开关复用已生成的 display+mesh，限制为最近少量帧或当前帧；若无需重提交同一 polities 源，就避免 setData。证明原始几何、完整提交 JSON、点击/选中、语言标签、来源切换、native回退→补齐完全一致。新年或补齐native必须失效。勿把 Node≈290ms 直接宣传为浏览器节省。
3. **拆开首屏必需 catalog 与可异步事件数据**，只有在实测events常拖慢地图创建时再做。允许地图先准备，但事件计数/搜索/分享恢复必须等真实数据，失败时明确重试；不能先显示“零事件”。这涉及 app状态，风险高于湖泊门控，不属于本候选。
4. **按目标视口剖析自然地理/湖泊批次**。先测选片和worker的实际主要等待，再考虑预取阈值或有界派生缓存。不能降低边界精度、粗暴减少湖泊数、把不同时代的行政图替代当前年，或移除出错时仍可用的概览。

核验命令（只写本审计目录）：

```sh
node work/release-346/global-load-audit/validate-lake-readiness.mjs
node work/release-346/global-load-audit/existing-lake-suite/scripts/validate-lakes.mjs
python3 work/release-346/global-load-audit/collect-static-inventory.py
node work/release-346/global-load-audit/measure-native-preparation.mjs
```

如复制 `lakes.candidate.js` 到主仓，先合并其他并行改动，再统一更新 import stamp。本交付未自行合并或发布。

实际浏览器实例入口为 `window.__meridian.instances.find(a=>!a.destroyed&&a.container==='map').geography.lakes`。可选观测脚本 `browser-probe.js` 只添加事件记录和 setData 计时包装，不移动视图、不改变图层；完成后调用 `window.__lakeProbe.dispose()` 撤销。`export()` 返回记录，`mark(name)` 添加人工测量起点。脚本未由本代理在浏览器运行，根代理应在授权浏览器中检验。

归档：`baseline-source/` 从审计起点提交提取15个相关源文件；`MANIFEST.json` 记录源码与交付文件SHA，避免后续主仓变化混淆证据。

## 根代理补充的真实浏览器对照

原始记录：`work/release-346/browser/lake-baseline.json` 和 `lake-candidate.json`，由根代理在实际 Chrome 中采集；本代理只读其 JSON 并复算事件差值。场景据根代理说明为1492全球视野进入东非 `[32,-1]`、zoom 6.3；记录自身显示视口为1512×543。没有从这两个文件推断额外的网络限速、冷热缓存或 CPU 条件。

| 里程碑（相对 jump） | 3.45 基线 | 湖泊候选 |
|---|---:|---:|
| 湖泊 content | 226.4 ms | 297.3 ms |
| content 之后最后自身瓦片就绪 | 997.2 ms | 1042.5 ms |
| ready=true、opacity=1 首次记录 | 2431.5 ms（global idle） | 1050.5 ms（render） |
| 自身已完成到激活的额外等待 | **1434.3 ms** | **8.0 ms** |
| 湖泊数 | 88 | 88 |

基线在1004.9 ms的render仍 `ready=false, opacity=0`，说明并不是恰好缺少一帧；它继续等待到2431.5 ms的全局idle才切换。候选自己的瓦片甚至较晚完成约45 ms，但下一帧即可激活。结果支持移除跨图层 idle 依赖这一具体修复；没有据此声称网络更快、worker更快或所有全球地图都缩短同样时间。此JSON记录的是控制器和图层状态，独立像素截图由根代理负责。

本目录 `browser-evidence-summary.json` 由两份原始记录复算，`root-browser-evidence/` 保留其原字节和SHA。根代理已把候选、旧套件夹具补丁及可移植的新回归合并到主仓，本代理未改产品文件。全球曲线派生缓存仍只作为3.47候选目标。
