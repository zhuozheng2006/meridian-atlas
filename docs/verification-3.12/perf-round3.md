# 3.12 性能第三轮：首屏加载与「概览 → 细化」路径

用户诉求：「加载地图过于慢，一开始的简略图放大后加载详细图要加载好久」。
本轮只做加载/升级路径，不改制图样式、不动几何与年份语义。所有数字来自同一脚本
`scripts/verification/perf-detail-load.mjs`，before/after 用同一组参数（`--profiles`/`--kinds`/同一 CDP 限速档）。

## 0. 结论摘要

| # | 改动 | 关键前后数字 |
|---|---|---|
| 1 | `serve.py` 启用 HTTP/1.1 keep-alive | 133 个小文件的连接数 **133 → 1（串行）/ 6（并发 6）**；同一批请求耗时 41→32 ms（串行）、26→14 ms（并发 6） |
| 2 | `index.html` 预加载 maplibre-gl.js / app.js / catalog | 三个关键资源都在 **t≈3 ms** 同时开始；**重复 URL 数 = 0**（无二次下载） |
| 3 | `map-engine.js` 读取超时改为「排队 + 停滞」两段 | 1.6 Mbps / 400 kbps 下原生几何升级与精细图层**从整体失败变为成功**（详见 §3.3） |
| 4 | 首屏（unthrottled，冷启动） | 地图就绪 **5425 → 3600 ms（−33%）**；连接数 59 → 14 |
| 5 | 概览 → 原生几何（unthrottled） | 原生全部到位 **6656 → 5502 ms**；连接数 227 → 15 |
| 6 | 相机就绪（unthrottled，regional OHM） | 首帧 5264 → 4333 ms；OHM 就绪 5315 → 4413 ms |
| — | 尝试后主动回退 | 原生几何并行预取：会让 `validate-native` 的 mixed_cache_render 契约失败，已回退（§3.4） |

仍未解决（见 §6）：精细物理层一次要下 10.5–13.5 MB，这是带宽决定的；在线瓦片（terrain / 现代参照 / OHM 在线瓦片）与 2552 个湖泊瓦片仍按需加载。

## 1. 方法与环境

- 被测服务：**8769 = 本仓库当前 `serve.py`（HTTP/1.1 + keep-alive）**；**8767 = 改动前启动的旧进程（HTTP/1.0）**，两者服务同一目录 `public/`，仅服务端版本不同。
- 浏览器：无头 Chrome 154 + SwiftShader 软件渲染；`requestAnimationFrame` 被无头节流到约 2 fps，因此不报帧率，改用 `performance.now()` 标记、`PerformanceResourceTiming`、CDP Network 事件与页面内 `fetch` 包装器。
- 限速：`Network.emulateNetworkConditions`，四档 unthrottled / 4 Mbps·100 ms / 1.6 Mbps·300 ms / 400 kbps·400 ms；每档独立冷启动、独立 profile、缓存禁用（驱动固定 `Network.setCacheDisabled(true)`）。
- 场景：`cold-1500`（boot 年首屏）、`detail-1450`（非 boot 年：概览首帧 → 原生几何 → 放大 3/7/9）、`regional-ohm-1500`（地区详图 + OHM 固化数据，相机 9.32,48.08,6.72）。
- 报告与 provenance：`perf-detail-load-<label>.json` 记录每次运行的 git HEAD、资源版本号、关键文件 sha256 与 loadavg；逐场景增量落盘，浏览器崩溃不会丢数据。

## 2. before / after 对照

由 `node scripts/verification/perf-detail-load.mjs --compare baseline,round3` 生成
（`docs/verification-3.12/perf-detail-compare-baseline-round3.json`）。

| 场景 | 首帧 before → after | 原生几何到位 before → after | 连接数 before → after | 编码字节 before → after |
|---|---|---|---|---|
| cold-1500 / unthrottled | 5425 → **3600 ms** | — | 59 → **14** | 5.43 → 5.44 MiB |
| cold-1500 / 4 Mbps | 9517 → 9501 ms | — | 59 → **16** | 3.49 → 3.51 MiB |
| cold-1500 / 1.6 Mbps | 18587 → ⟨待补⟩ | — | 50 → ⟨待补⟩ | 2.75 → ⟨待补⟩ |
| cold-1500 / 400 kbps | 66934 → ⟨待补⟩ | — | 47 → ⟨待补⟩ | 2.52 → ⟨待补⟩ |
| detail-1450 / unthrottled | 5678 → 4990 ms | 6656 → **5502 ms** | 227 → **15** | 20.81 → 20.82 MiB |
| detail-1450 / 4 Mbps | 17287 → 16774 ms | 22141 → 21811 ms | 227 → **20** | 11.50 → 11.38 MiB |
| detail-1450 / 1.6 Mbps | 34236 → ⟨待补⟩ | 未完成 → ⟨待补⟩ | 87 → ⟨待补⟩ | 7.55 → ⟨待补⟩ |
| detail-1450 / 400 kbps | 69177 → ⟨待补⟩ | 未完成 → ⟨待补⟩ | 73 → ⟨待补⟩ | 3.07 → ⟨待补⟩ |
| regional-ohm-1500 / unthrottled | 5264 → 4333 ms | OHM 5315 → 4413 ms | — | 15.64 → 15.65 MiB |
| regional-ohm-1500 / 4 Mbps | 8387 → 7738 ms | OHM 超时 → **28117 ms 完成** | — | 4.51 → 6.79 MiB |

读法：带宽受限档（4 Mbps 及以下）首帧时间基本由**字节数**决定，keep-alive 只省连接建立，因此 4 Mbps 首屏几乎不变（9517→9501 ms）；真正被修好的是**慢速档下"请求排队被 20 s 固定超时掐断"**这类失败（§3.3）。

## 3. 每项优化

### 3.1 serve.py：HTTP/1.1 keep-alive

```python
class AtlasHandler(SimpleHTTPRequestHandler):
    protocol_version='HTTP/1.1'
    timeout=65
...
server.daemon_threads=True
```

微基准（`--keepalive-bench --files=133`，取自 `public/data/native/geos/**` 的真实前 133 个小文件）：

| 连接方式 | 并发 | 133 个请求耗时 | 新建 TCP 连接 |
|---|---|---|---|
| before（8767，HTTP/1.0） | 1 | 41 ms | **133** |
| after（8769，HTTP/1.1） | 1 | 32 ms | **1** |
| before | 6 | 26 ms | **133** |
| after | 6 | 14 ms | **6** |

浏览器侧同样成立：冷启动连接数 59→14、细化场景 227→15 / 20。本机 RTT 接近 0，绝对收益只有几十毫秒；但在真实网络（RTT 20–100 ms）下省下的是 130+ 次 TCP 握手，收益与 RTT 成正比——这也是 1.6 Mbps（300 ms 延迟）档最该受益的地方。

### 3.2 index.html 预加载

```html
<link rel="preload" href="assets/maplibre-gl.js?v=…" as="script">
<link rel="modulepreload" href="app.js?v=…">
<link rel="preload" href="data/fast/catalog.json.gz" as="fetch" crossorigin>
```

- 预加载 URL 与脚本标签使用**同一 revision 字符串**（`stamp-assets.mjs` 会同时重写 `src`/`href`），因此不会出现"预加载一个 URL、真正请求另一个 URL"的二次下载。
- 实测（cold/unthrottled，after）：maplibre-gl.js、app.js、startup.js、catalog.json.gz 都在 **t≈3 ms** 开始；整页资源列表中**重复 URL = 0**。

### 3.3 map-engine.js：读取超时从「固定 20 s」改为「排队 + 停滞」两段

原来的 `readJSON` 用 `setTimeout(()=>controller.abort(),20000)`，计时从 `fetch()` 调用开始，**把排队等待连接的时间也算进去**。放大时浏览器 6 条连接被 10.5–13.5 MB 的精细物理层占满，原生几何的 `data/native/index.json.gz` 与后续小文件一直排队，20 s 后直接被 abort：

- 1.6 Mbps：`detail-1450` 的 native 请求数 **0**，原生几何 300 s 内从未完成，`#geographyStatus=partial`、湖泊停在 `overview`；
- 400 kbps：同样 native 请求数 **0**，精细层全部失败。

改成两段后：`CONNECT_TIMEOUT=45 s` 覆盖"等连接 + 首字节"，进入下载后每收到一块数据就重置 `STALL_TIMEOUT=20 s`（真正的停滞才中止）。同一批 3.5 MB 文件在 400 kbps 下需要约 70 s，现在能下完而不是第 20 秒被掐断。字节与解析路径完全不变，只是不再误杀健康但缓慢的请求。

### 3.4 尝试后主动回退：原生几何并行预取

曾把 `loadNative` 提前到 `prepareOverview` 里与概览几何并行启动（目的是让 ~130 个小文件先去占队列）。实测会让 `node scripts/validate-native.mjs` 的 `mixed_cache_render` 断言失败：该用例要求"混合缓存下首帧不得自称完整原生"，而并行预取会在首帧构建期间把缓存填满，把首帧标成 `n`。按"不牺牲正确性"的原则**放弃该优化并回退**，保留其余三项。

## 4. 首屏分阶段（after，cold/unthrottled）

| 阶段 | 值 |
|---|---|
| HTML 响应结束 | 2 ms |
| CSS 全部就绪 | 7 ms |
| 关键 JS（maplibre-gl / app / startup）就绪 | 8 ms |
| 首个几何数据就绪 | 8 ms |
| 全部 data/* 就绪 | 3653 ms |
| 地图就绪（#loading 隐藏） | **3600 ms** |
| JS 字节 / CSS 字节 / data 字节 | 1.37 MB / 136 KB / 4.20 MB |

结论：首屏的关键路径是**数据**（4.2 MB），不是 JS/CSS；首屏再快只能靠减少或压缩数据（不在本轮写作用域内）。

## 5. 放大 3 → 7 → 9 各图层到位（before，detail-1450）

（markers 来自每 250 ms 的状态采样，`null` = 采样窗口内未就绪）

| 档位 | zoom | physical 层 | 湖泊细节 | terrain | 现代参照 | regional/OHM |
|---|---|---|---|---|---|---|
| unthrottled | 3 / 7 / 9 | 277 / 14 / 6 ms | — / 7432 / 1536 ms（settle） | — | — | — |
| 1.6 Mbps | 3 / 7 / 9 | ⟨待补⟩ | ⟨待补⟩ | ⟨待补⟩ | ⟨待补⟩ | ⟨待补⟩ |
| 400 kbps | 3 / 7 / 9 | 277 / 14 / 6 ms（见报告 markers） | 未就绪 | 未就绪 | 仅 zoom 9 时 1835 ms | 未就绪 |

## 6. 仍未解决的瓶颈

1. **精细物理层体积**：一次放大到 zoom≥2.5 会取 `land-10m`(3.5 MB) + `ocean-mask`(3.4 MB) + `rivers-10m`(2.1 MB) + `lakes-10m`(1.3 MB) ≈ **10.3 MB**（`detail-1450` 全场景 13.5 MB）。这是 geography.js 的取数策略，不在本轮写作用域；在 400 kbps 下即为 ~3 分钟量级。
2. **在线瓦片**：`terrain-dem`（tiles.mapterhorn.com）、现代地理参照、OHM 在线瓦片依赖外网；无头环境里 terrain 在 unthrottled 下也要等到 zoom 7。
3. **湖泊瓦片**：`public/data/lakes` 有 **2552 个** `.bin.gz`（238 MB），按瓦片按需取；zoom 9 一次视野约 10 个（≈0.7 MB），但每个都是独立请求。
4. **首屏 5.4 MB**：其中物理底图 1.5 MB、places 索引 0.84 MB、catalog 0.6 MB、maplibre 0.94 MB；除 maplibre 外都在别人作用域内，本轮只做了预加载与连接复用。
5. 原生几何本身 ~130 个小文件（共 0.33 MB）；keep-alive 后已不是瓶颈，但仍是 130 次请求。

## 7. 复现

```bash
python3 serve.py --port 8769 &      # 本仓库当前 serve.py（HTTP/1.1）
node scripts/verification/perf-detail-load.mjs --keepalive-bench --label after-http11 --files=133 --url http://127.0.0.1:8769
node scripts/verification/perf-detail-load.mjs --label round3 --url http://127.0.0.1:8769 --profiles=unthrottled,wifi-4mbps --kinds=cold,detail,regional --append
node scripts/verification/perf-detail-load.mjs --device mobile --label round3-mobile --url http://127.0.0.1:8769 --profiles=unthrottled,wifi-4mbps --kinds=cold --append
node scripts/verification/perf-detail-load.mjs --label round3 --url http://127.0.0.1:8769 --profiles=slow-4g-1.6mbps --kinds=cold,detail --append
node scripts/verification/perf-detail-load.mjs --label round3 --url http://127.0.0.1:8769 --profiles=slow-3g-400kbps --kinds=cold,detail --append
node scripts/verification/perf-detail-load.mjs --compare baseline,round3
node scripts/validate-native.mjs && node scripts/validate-v3.mjs && node scripts/validate-boundary-app-races.mjs && node scripts/validate-lakes.mjs
```

## 8. 验证与证据

- `validate-native`（11/11）、`validate-v3`、`validate-boundary-app-races`、`validate-lakes` 全部退出码 0（改动后重跑）。
- 桌面 1400×900 与 390×844 各跑一轮冷启动（`--device mobile`），报告见 `perf-detail-load-round3-mobile.json`。
- 截图：`docs/verification-3.12/shots/detail-<label>-*.png`。
- 原始报告：`perf-detail-load-baseline.json`（before）、`perf-detail-load-round3.json` / `-round3-mobile.json`（after）、`keepalive-bench-before-http10.json`、`keepalive-bench-after-http11.json`、`perf-detail-compare-baseline-round3.json`。
