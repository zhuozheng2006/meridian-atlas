# 3.40 地区详图独立就绪：实施与验证

生产改动仅 `public/regional-boundaries.js`。测试改动：`scripts/validate-regional.mjs` 的模拟边界补齐真实 content/render 事件；新增 `scripts/validate-regional-frozen.mjs`。未改 package、资产 stamp，未提交、未上传。共享 `scripts/halc-test-map.mjs` 由 map_latency_340 代理维护。

## 实际行为

1. 本地冻结 OHM 与在线 OHM 各自维护 content、render 和错误状态。`isSourceLoaded:true` 的 metadata 消息本身不足以激活任何来源；必须见 content 完成、再经过一个实际 render 或完整 idle 帧。
2. 本地冻结资料已完成时不再等待在线瓦片；在线错误也不关闭冻结图层、冻结记录档案或冻结点击入口。在线恢复使用显式 retry，保留冻结档案，只重建失败的在线源。
3. 冻结原始文件收到但尚未渲染完成时，在线同 osm_id 仍保留。冻结完成后再排除重号；记录合并与覆盖采样也显式排重，避免同帧过滤更新的过渡重复。
4. 两来源第一次填色、边线和点击入口均等到对应完整帧提交。用于查询/加载的 fill 层保持可见但透明；不能借已有另一来源 active 状态显示半加载边界。
5. 已提交的完整混合视图在在线更新期间保留上一批记录与描边，显示 updating；新视口/年份与 source epoch 纳入扫描键。重复 idle/render 不重复执行 63 点覆盖采样。
6. 地图仍保持 auto 的原覆盖阈值、象限/中央约束和 sparse 禁止接管；显式 regional 可以阅读局部资料。切换年份或空间窗口废除旧冻结就绪和重号排除。源失效不影响另一张对照地图。
7. 冻结源显式 `tolerance:0,maxzoom:14`，保留来源坐标显示细节；这不是历史定位精度升级。归属文本改为 Dated static extract，避免继续写死 1492/1500。

## 已运行的验证

- `node scripts/validate-regional-frozen.mjs`：**24/24**。报告 `work/release-340/regional-frozen-verification.json`。
- `node scripts/validate-regional-continuity.mjs`：**24/24**。报告 `work/release-340/regional-continuity-verification.json`，日志同目录。
- `node scripts/validate-regional.mjs`：**15/15**。
- `node scripts/validate-ohm-requests.mjs`：**10/10**，包括跨窗口/年份迟到成功与失败、无新请求移动、网络失败和销毁。
- `node scripts/validate-boundary-comparison.mjs`：**16/16**。
- `node scripts/validate-boundary-app-races.mjs`：**5/5**。
- 当前磁盘冻结数据：中欧 767 条、东亚 381 条，全部通过各自选定年的 `regionalVisible(...,maxLevel=6)`。新的覆盖采样年代检查未剔除这些既有资料。

新增 24 项中涵盖 metadata 非就绪、冻结先到、在线失败后冻结到达、已有冻结档案遇在线失败、在线重试与排重、冻结失败回退在线、auto sparse、auto 实际覆盖不足、在线半帧不得显示/点击、既有混合视图更新连续性、重复事件无额外扫描、移动期间延迟就绪、视口改变只重扫一次、切年/窗口旧数据失效、隐藏后迟到、销毁、两图独立。

这些是生产类和方法配合可控 DOM/MapLibre 边界的功能验证，不是浏览器像素或延时测量。根代理负责最终 stamp、全测试/构建和真实浏览器验收；最终 stamp 会改变生产文件 SHA，因此本目录测试报告属于候选阶段证据，最终应由根的完整测试重新生成。

## 仍然成立的限制

当前修复让现有可用详图更早出现，不新增年代、地区或历史几何。1500 瑞士/巴伐利亚的 Cliopatria 原始轮廓仍粗稀，OHM 快照缺少这些具名政体；本轮不能声称已消除源精度限制。审计详见 `cartography-audit.md`。

## 真实浏览器事件顺序修正

根代理发现首候选错误地在每次瓦片 loading 清空 content 证明，真实 MapLibre 的 content 事件却可能早于各瓦片请求，而瓦片完成事件不带 sourceDataType，导致永久 loading。现已修为：content 证明属于数据世代，只在 source 创建/重建或冻结 setData 替换时清空；瓦片 loading 只递增本帧 epoch。新回归按真实 content(false) → 多个 tile loading → 无 sourceDataType 的 tile sourcedata(true) → render 顺序验证 live/frozen 两条路径，并验证新数据替换不能沿用旧 content 证明。22/22 新测试和 24/24 连续性、15/15 基本行为、10/10 异步请求均重跑通过。最终真实浏览器复验由根代理继续，先前失败候选不得作为成功证据。

## 冻结图层高亮重载的对称连续性

根的真实浏览器进一步发现：选中冻结记录触发 setFilter 后，冻结瓦片短暂重载，在线源已 ready 时曾把完整混合记录目录替换成在线子集。现在完整提交时记录 frozenDrawn，同视口、同窗口/年份且 frozen 仍有效的短暂 tile reload 保留已提交的列表和描边，档案与 selectedId 保持不变；真正 frozen source error 则仍清理该源并回退到在线完整帧。两条新测试覆盖保持与真实失败清理，最新独立套件 24/24，通过后生产再次冻结。
