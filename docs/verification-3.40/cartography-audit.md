# Meridian Atlas 3.40：边界精细度与详图接管审计

审计日期：2026-10-06。仓库：`/Users/zane/meridian_atlas/world-history-atlas`，开始审计时为 3.39.0，工作树干净。只读生产代码与既有资产；未访问浏览器、未新增数据、未推送或部署。本文件和复现程序在任务工作目录。

## 结论

1500 年中欧截图中瑞士、巴伐利亚、洛林的阶梯状轮廓，主要受 **Cliopatria 原始源坐标稀疏、轴对齐** 限制。当前版本已经在首帧优先加载源坐标，并且渲染源设 `tolerance:0`，所以继续提高线条抗锯齿或等待 native 下载都不能补出史料中不存在的转折。

但有一个可以本轮实质改善的读取问题：**本地 OHM 冻结快照虽然已经载入，仍要等待独立的在线 OHM 瓦片全部完成后才能接管；在线瓦片失败还会把可用的本地快照一起屏蔽。** 应优先解除这个无关的网络门控，使完整本地快照先提供有年代依据的细节，再增补在线记录。此改动提升资料可达性和实际等待体验，不增加或捏造历史精度。

## 当前资产与渲染路径

| 来源 | 当前实际条件与范围 | 关键证据 |
|---|---|---|
| Cliopatria native | 全球索引为 13,765 条来源记录，其中 13,380 条 POLITY。原始几何所有 binary64 坐标与顺序保留，无简化、舍入、插值、修复或丢弃组件。1500 年本身有 151,086 B 的完整 native 年包；其他年份优先用 temporal bundles。 | `public/data/native/manifest.json` 的 `processing/counts/validation/temporalBundlePolicy`；`public/native-geometry.js:16–52,54–94` |
| 首屏流程 | `ensureAtlas()` 并行预取所选年 native pack、核心目录、MapLibre。`prepareOverview()` 先等 native；仅失败或覆盖不足时才走旧 overview。并不是通常先下载全套简略几何再放大换高精度。 | `public/app.js:497–505`；`public/map-engine.js:77–88` |
| 国家线描 | `polities` GeoJSON `tolerance:0,maxzoom:14`，WebGL antialias，round join/cap。双层浅晕圈＋深细线；几何与描边同帧提交。默认可逆的柔化对原始坐标生成显示派生物。 | `public/map-engine.js:64,95–105`；`public/boundary-style.js:1–27` |
| OHM 冻结快照 | 两个空间窗口。中欧 10 个年份；东亚 14 个年份，共 24 个窗口×年份。1500 中欧有 98 条、202,009 点、1,639,961 B gzip；不是覆盖全球的连续精细国界。 | `public/regional-boundaries.js:58–61`；`public/data/ohm-1500/manifest.json → years.1500` |
| OHM 在线瓦片 | 自动或 regional 模式、边界开启、非现代参照、zoom≥6。zoom≥8 才纳入 admin_level≤6，否则≤4。使用来源日期与 admin 类型筛选；冻结数据的同 osm_id 从在线源排除。 | `public/regional-boundaries.js:33–55,175–187,223–228,293–300` |
| OHM 自动切换 | 可见视图 7×9 网格采样。初次要求陆地覆盖≥80%，延续≥65%，并有象限/中央检查；metadata verdict sparse 阻止自动接管。用户明确选 regional 时允许局部资料。 | `public/regional-boundaries.js:139–146,301–323` |
| HALC | 只显式 `halc` 模式，1500 年、zoom≥6、低地国家范围。14,863 地方单元；ADM1 152 显示分组不是主权国家。MVT extent8192，maxzoom10，是经过公开转换的瓦片而非无限精度。 | `public/halc-boundaries.js:6,22–24,67`；`public/data/halc/manifest.json`；`public/data/halc-regions/manifest.json` |
| CShapes | 显式 `cshapes`，不对 1500 年生效；支持年份外保留 overview 并显示 unsupported。其坐标不走柔化。 | `public/boundary-controller.js:8–17`；`public/map-engine.js:97–100` |

## 1500 中欧：重新读取当前磁盘数据得到的结果

使用当前 `public/data/catalog.json.gz` + `public/data/native/year-1500.json.gz`，以来源 id 关联；不是沿用旧审计数字。

| 来源记录 | 年代 | 顶点 | 线段 | 完全水平/垂直段 | 中位线段约长 |
|---|---|---:|---:|---:|---:|
| clio-07350 · Duchy of Bavaria | 1459–1506 | 55 | 54 | 11 | 19.06 km |
| clio-07639 · Swiss Confederation | 1497–1501 | 68 | 65 | 20 | 14.69 km |
| clio-07666 · Duchy of Lorraine | 1497–1501 | 102 | 95 | 32 | 14.12 km |

长度是本次以局部经度余弦换算的估算，不能当作大地测量精度指标。顶点/轴对齐段为源几何直接计数。旧 `docs/verification-3.10/geometry-fidelity.md` 的原因分析仍成立，但它关于“非 bootstrap 首帧概览”的描述已被当前 temporal bundle 首帧路径取代，不应当作 3.39 当前流程。

中欧 1500 冻结 OHM 的 gaps 列表仍将 Swiss Confederacy、Duchy of Bavaria、Württemberg、Baden、Habsburg Austria、Tyrol 列为未匹配；Venice/Milan 则有明确匹配记录。不能通过静默切至 OHM 宣称已修复截图中的这几个国家。

## 拓扑与显示边界

- `border-curves.js` 对共享转角复用同一反向曲线；转角最长裁切 4 km，曲线抽样弦误差目标约 2 m。**2 m 仅是显示曲线采样误差，不是历史边界定位精度。**
- 转角三角形要避开原边和其它曲线包络；复杂分叉、极区、日期变更线等锁定，不做推断修补。各环面积变化受 2% 限制。这有助于维持既有轮廓结构，仍不等于源数据没有拓扑错误。
- `boundary-mesh.js` 只合并精确重合线段、连接 degree-two 路径；不 snapping、不 union、不推断闭合。所以源中两国不完全一致的接缝不会自动变成共同测绘边界。
- OHM frozen 的 `addSource` 目前未显式指定 `tolerance:0`（`regional-boundaries.js:215`）。若后续做“按源像素核验”可对齐该选项并评估 CPU/内存；这是小尺度显示忠实度工作，不能替代缺少源记录，也不是本轮首要瓶颈。

## P1：让已载入的冻结详图独立于在线瓦片工作

### 代码证据

1. `ensureOhm()` 成功后调用 `addOhmLayers()`、`update()`、`settle()`（`regional-boundaries.js:196–210`）。
2. 但 `settle()` 第 312 行要求 `getSource(SOURCE)` 且 `isSourceLoaded(SOURCE)`，SOURCE 是在线 `regional-boundaries`，不是冻结 `ohm-frozen`。
3. 在线 source 的 `error` 回调将 `failed=true`、清空 features，调用 `setActive(false)`（第 171 行）；后续 `settle()` 因 `this.failed` 直接返回。
4. `visibility()` 冻结轮廓需要 `this.active`（第 284–291 行），所以数据到达和 GeoJSON source 已存在仍不足以展示边线。
5. 当前只有地图全局 `idle` 会触发 settle，未监听单独 frozen source 的完成事件；即使解除第一条判断，仍应在冻结数据真正进入 worker/render 后再采样，避免“源对象存在”被误认为“该帧完成”。

### 无网络复现

`work/release-340/frozen-gate-repro.mjs` 直接执行当前生产 `RegionalBoundaries.settle()`，只控制地图边界与查询结果，不修改生产函数。结果在 `frozen-gate-repro.json`：

| 在线瓦片 | 本地 frozen ready | 几何查询 | 接管提交 | active |
|---|---|---:|---:|---|
| pending | true | 0 | 0 | false |
| ready | true | 2 | 1 | true |
| error | true | 0 | 0 | false |

生产文件 SHA-256：`294bf650cb8036656b8a377ec579e57e54573959b23cede8172e98e71666a726`。该复现证明生命周期门控，不宣称浏览器耗时或真实画面已验证。

### 建议实现契约

- 分离 live 与 frozen 的 ready/error 状态；一条源失败不能删除另一条完整已核验源。
- `sourcedata` 针对 `ohm-frozen` 的 `isSourceLoaded` 完成时触发 settle，校验当前 window/year/request；移动中不要接管旧视口。
- 先用当前 frozen 的完成帧做 coverage 检查。auto 仍必须满足原覆盖阈值和 sparse 约束；explicit regional 可显示局部冻结资料。不要将全窗口 manifest 的 53% 直接当作当前视口充分覆盖。
- 在线成功后再合并非重复记录，保留原 `osm_id` 排重。在线仍在更新时不要混入其半载入帧，让旧完整记录/本地完整记录保持一致。
- 更新状态文字区分“已载入本地详图；在线补充中/暂不可用”和整层失败。失败重试应只重建失败源，避免损失阅读状态。
- 添加回归：冻结成功＋在线 pending；冻结成功＋在线 error；在线迟到恢复；冻结成功但 auto sparse；年份与空间窗口切换后的迟到消息；销毁后迟到消息；左右图各自独立；冻结未完成不可采样；已打开冻结记录在在线失败后保持可读。
- 浏览器验收应从明确年度与窗口开始，例如 1500 中欧和 1500 东亚，单独阻断/延迟 OHM 在线域名，验证本地 geometry ready → 可见轮廓的时间和最终 current-year ids。正常联网再做合并结果和慢网首次加载基线，不能用单元测试推断实际毫秒改善。

## 与竞品资料的关系

本轮没有新访问竞品。现有 `docs/verification-3.12/benchmark-matrix.md` 是 2026-10-03 留下的历史证据：Chronosphere 的地球/时间轴/战争条带可参考，但其全球细度未量化，首页传输不等于真实渲染耗时；Phersu 当轮被 Cloudflare 拦截，13 项未能验证。早期 `docs/BENCHMARK-BASELINE-2.1.md` 确认其国家侧栏字段入口广泛，不能由栏目推断数据库正确性。

因此这一轮可以可靠声称“现有本地详图不再受在线补充阻塞”，不能声称边界精度超过 Chronosphere/Phersu 或截图所有锯齿已根治。要提升 Swiss/Bavaria 1500 轮廓，需要有年代、原始地图/数据、空间校准和误差说明的新地区资料；现有 IEG 候选的研究级外推与控制点误差仍不能自动升级为生产高精度来源。
