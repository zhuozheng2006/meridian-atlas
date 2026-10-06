# 3.40 地图概览到详图等待审计

审计日期：2026-10-06。主目录 `/Users/zane/meridian_atlas/world-history-atlas`；核对提交 `877c9d97649cf405dd43c66099d147a1618c37ed`，审计开始时工作树干净。只读生产代码与数据；未修改生产文件、未操作浏览器、未联网发布。

结论：3.39 已让原始年代几何优先到达，但不能据此宣称局部详图已绘出。现有局部边界存在**本来源已准备好，却等待全地图 idle 才显现**的额外依赖；本地 HALC 瓦片还没有 HTTP 内容压缩。这两项能够独立改善，不必削减几何精度或改换历史来源。

## 已复现的等待，而非推测

`map-latency-baseline-repro.mjs` 调用真实 `RegionalBoundaries` / `HalcBoundaries`，只替代 DOM、网络与 MapLibre 事件边界；输出 `map-latency-baseline-repro.json`。

- Regional 自身 `sourcedata(isSourceLoaded=true)` 后发 `render`：仍 `loading`，`active=false`，查询 0 次。随后发一次全局 `idle`：立刻 `ready`、`active=true`，64 次查询。
- HALC 自身准备好后发 `render`：仍 `loading`、仍显示 Cliopatria。随后发全局 `idle`：显示 HALC。
- 同一 Regional 视口无变化，额外 5 次 idle 产生 **320 次重复 queryRenderedFeatures**（每轮 1 次记录收集+63 次覆盖采样）。这是确定性事件模拟，不代表浏览器耗时、像素或网络速度。

复现：

```sh
node /Users/zane/Documents/Codex/2026-10-02/new-chat/work/release-340/map-latency-baseline-repro.mjs /Users/zane/meridian_atlas/world-history-atlas
```

## 当前真实依赖链

### 全局国境（Cliopatria 原始几何）

`public/map-engine.js:77–88` 在 prepareOverview 等 `loadNativeFrame`，优先原始年包；实际提交才调用 displayTerritories。`public/native-geometry.js:47–52` 可在目录和渲染库并行载入时预取恰好一个年包；原始独立文件恢复最多 6 并发（87–92）。3.39 手册 2.924 秒是年包 responseEnd，不能代表 setData 后 MapLibre worker、三角化及绘制完成。

`map-engine.js:92` 的 geometry-status 在 `displayTerritories` / setData 前发出，不能作为绘制就绪时刻。`displayTerritories:95–100` 包含 curvedBorders、boundaryMesh 和 source.setData；这也应分开计量。

### OHM 地区详图

- `public/regional-boundaries.js:10,169,176,184–187`：首次到 zoom>=6、moveend 才创建在线行政瓦片源；源最大 zoom14。在线瓦片无预热。
- `192–210`：同条件并行请求选中窗口/年份的冻结 GeoJSON；没有 fetch AbortSignal，使用跨图共享 readJSON Promise；请求序列只阻止迟到提交。
- `169,311–322`：只靠全图 idle 触发 settle；settle 本身仅需要本源 loaded、相机停止。无关 terrain-dem / physical / lakes / reference 请求或样式变化可以延后全图 idle。
- `263–299`：已有完整帧在同年平移时保持可读，状态标记 updating；不能为加速打破这条连续性。
- `301–308`：7×9=63 点覆盖查询；首次足够覆盖后自动切换，不足时保留概览。不能为了快而删去覆盖判定，或把部分数据说成完整。
- `177,208–215,225`：ohmReady 当前表示 JSON ready + source存在，未确认 MapLibre worker 已消费。它会让在线图层排除同 osm_id。若增加来源独立 settle，需要检查 ohm-frozen 源的 rendered/source loaded 状态，避免在线记录先被过滤、冻结几何却尚未就绪。其新旧窗口清理逻辑（198–200）必须保留。

### HALC 地方区划、地区线与1500地貌

- `public/halc-boundaries.js:22–24,62–68,88–103`：限定1500、zoom>=6、低地国家且现代参照关闭；metadata labels 与本地 z6–10 MVT 同时请求；labels 必须有后才激活。地方区划 source readiness 不依赖 landscape，不能把它们绑成单一全成败状态。
- `45,95`：同样仅监听 idle。自身源 ready 但无全图 idle 时仍保持概览。
- `public/halc-regions.js:27–32`：地区线就绪由 parent.settle 调用，并非自己监听 sourcedata/render；父区划先 ready、地区线稍后到达时，也可能等待全图 idle。
- `public/halc-landscape.js:74–98`：index 后3并发空间分片，取视口外20%预留；所有相关分片成功后一次 setData，源 loaded 才显示。它已有本源 sourcedata 监听（38–39），但 sourceLoaded 也不等于屏幕呈现。
- `halc-landscape.js:61–65`：地貌动态层顺序会触发渲染；其出现不能覆盖历史详细边界。

### 共享调度现状

没有一个全局资源调度器。`map-engine.js:17–45` 是 URL→Promise 去重，native/fast fetch priority high，其余 auto；45秒连接/首包与20秒停滞超时；整包读取后主线程解压/JSON parse；普通资源保留在 Map，部分缓存调用 forgetJSON 自行收敛。

不同生产者自己限制并发：PhysicalGrid 4（`physical-grid.js:90`）、LakeLayer 4（`lakes.js:78`）、HalcLandscape 3（`halc-landscape.js:86`）、Native recovery 6。浏览器/MapLibre 自己再调度瓦片。理论总并发多于单一共享带宽预算；不能假定三者各有4路就是全页面4路。

Geography 在 zoom4/5/8/9 分别引入空间物理、DEM、高分海岸与细水系（`geography.js:53–79,107–113,127–135`；`physical-grid.js:5`）。LakeLayer 也仅 idle 后 reconcile（`lakes.js:62–68,83–86`）。这些都会解释“边界资源到达但仍等待”的可能条件。

## 实际载荷

以下为仓库字节实测；不是网速/浏览器耗时。

| 文件/集合 | 压缩文件或PBF原件B | JSON解压B / 说明 |
|---|---:|---:|
| OHM 中欧1500 | 1,639,961 | 4,765,314 |
| OHM 中欧1492 | 1,118,302 | 3,221,679 |
| OHM 东亚1500 | 1,162,373 | 3,555,706 |
| HALC labels.json | 110,037 | 未gzip原件；serve已动态压缩JSON |
| HALC landscape index | 241,581 | 516,382 |
| HALC landscape全部49分片 | 7,723,381 | 只按视口载入，最大单分片1,168,362 B |
| physical-spatial index | 36,043 | 135,839 |
| land-50m | 527,552 | 1,570,749 |
| physical-overview | 80,465 | 211,516 |
| ocean-mask-overview | 453,272 | 1,036,266 |
| HALC地方 z6全部6瓦片 | 3,763,248 | 未压缩MVT；最大2,274,292 B |
| HALC地区 z6全部6瓦片 | 902,816 | 未压缩MVT；最大586,341 B |

HALC两组z6全覆盖合计4,666,064 B；单一视口不一定请求全部6瓦片。最重的6/32/21 两层合计2,860,633 B，单纯按4,000,000bit/s整链路预算就需约5.72秒，尚未计RTT/竞争/解码/绘制。不能把这个带宽下界当成实际加载耗时。

`serve.py:11` COMPRESSIBLE 未含 .pbf，因此本地PBF目前原样传输。直接gzip6（不改变解码字节）：

- HALC `6/32/21.pbf`：2,274,292 → **1,157,115 B**。
- 地区线 `6/32/21.pbf`：586,341 → **286,489 B**。
- 合计可减少49.54%传输；应以 HTTP 实收编码/解码SHA核验。线上 `worker/atlas-worker.mjs:122` 交给 ASSETS；是否已自动压缩未验证，不要声称线上一定受益。

## 最小推荐改动（按优先级）

1. **摆脱全图idle依赖，仍在真实render之后判定本来源。** 地区/HALC/地区线监听自己相关的 sourcedata；仅当本源完整且相机停止时安排一次 render 帧回调，再执行 settle。首次查询需要在同一源版本真实渲染之后，不能在 metadata 或 setData 时提前查到旧帧。保留 idle 作为补偿事件，destroy时解除事件/待执行回调。不要每个 render 都重扫，使用 pending 标志及源epoch + 相机/year/mode/filter状态去重。
2. **为当前请求记录单调阶段时间。** 每张地图各自记录 requestId、year、mode、camera/viewport、开始时间、eligible、source-ready、committed、render-confirmed、result（ready/partial/empty/error/cancelled）。`render-confirmed` 必须来源相关、当前request仍有效、实际可见边界query非空或明确empty、对应render发生在visibility提交之后。保留近20个记录足以供测试，不存整GeoJSON。外发DOM事件可供性能记录，不能用它替代视觉检查。
3. **本地PBF启用HTTP gzip。** 仅serve响应编码，不改文件和SHA清单；尊重 Accept-Encoding、Range、HEAD等语义。其改动收益不依赖地图源精度。独立测试需解压后的SHA===原PBF、正确Content-Type/Encoding/Length，identity/Range保持原字节，空瓦片不压也可以。确认MapLibre实际可读。
4. **后续而非未经测量先做全局调度。** 先记录当前视口各层传输/解码/绘制耗时。可能再引入只预取一份有年代依据的冻结窗口（z5.5–6）或将landscape/湖泊后台优先级降低；禁止无界预载、抢占第一幅国境、随意取消另一个地图仍在用的共享请求。高分辨率是独立史料精度问题，不应用无依据平滑制造历史精准感。

建议这轮可把1、2作为核心，3为独立小修；不要同时大规模改变geometry/tiles/cache，以免无法归因。

## 可测验收路径

浏览器路径：同一viewport1280×720；年份1500；欧洲中心[9,48]，zoom5→6.1；另HALC中心[5.1,51.3] zoom5.5→6.2。使用明确的冷缓存/暖缓存，分别4Mbps+100ms和正常网络；重复至少3次并报告各次，勿以单次极值宣称稳定倍率。

从用户 zoom 阈值/地图moveend开始，记录：

- 第一幅可用概览已绘出时刻（必须图层且render证据）；
- 所需边界源首包/responseEnd/source-ready；
- 详细边界切换commit；
- commit之后的render、对应边界可查询及当前元数据；
- 全图idle（仅诊断无关等待）；
- 主线程>=50ms任务、request数/字节、退出后遗留任务、同年平移/快速跨年份。

附带将无关DEM网络延迟/失败与来源边界完成分离的案例：自身边界应先成为可读，其他地形加载继续；它不应让ready错误地表示全地图所有数据已完整。两张对照地图必须各自有 requestId/epoch。

## 既有覆盖与缺口

- `scripts/validate-regional-continuity.mjs:51–71`：真实类、窗口更新连续性、弹窗与档案、覆盖不够回到概览、年份/来源离开、错误与重试、双图独立、destroy。无全图idle时来源就绪的用例缺失。
- `scripts/validate-halc-lifecycle.mjs:35–83`：各种资格门、迟到提交、错误、读取档案取消。
- `scripts/validate-halc-continuity.mjs`：待补齐视口保留旧几何、地区/地方独立就绪、错误与销毁；pending idle不查询。
- **`scripts/halc-test-map.mjs:24` 的 sourceReady 同时发 sourcedata 和 idle。** 这一测试替身会隐藏目前已复现的等待。增加 sourceReadyWithoutIdle / explicitRender 两种独立操作，不要只让新测试沿用旧helper。
- `scripts/validate-ohm-requests.mjs:23–27`：去重、视口改变时丢弃、畸形缓存驱逐；不覆盖MapLibre冻结源worker readiness。
- `scripts/validate-native*.mjs` 与源码/几何验证：年包和回退数据正确、alias/缺失、取消；不能证明屏幕首次呈现。
- HALC原件与MVT integrity核验可确保优化没有改动几何。HTTP压缩不应改这些资产。

新增有价值回归：自身完整、无idle、一次render后可ready；无关sourcedata不触发64次查询；同帧多个相关消息只扫描一次；加载事件与render之间改变年份/视口/来源则旧帧不提交；metadata-only不提交；source-ready时尚moving则moveend后的正确render才提交；HALC地区迟到仅更新地区线；frozen尚在worker处理中不得排除或宣称其ready；destroy移除新增所有监听。最后用浏览器证实像素/交互，而不是仅FakeMap绿色即宣称渲染正确。
