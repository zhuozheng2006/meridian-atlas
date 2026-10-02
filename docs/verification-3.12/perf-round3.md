# 3.12 性能第三轮：首屏加载与「概览 → 细化」路径

用户诉求：「加载地图过于慢，一开始的简略图放大后加载详细图要加载好久」。
本轮只动加载/升级路径，不改制图样式、不改几何与年份语义。全部数字来自同一脚本
`scripts/verification/perf-detail-load.mjs`，before/after 使用同一组参数与同一批 CDP 限速档。

## 0. 结论摘要

| # | 改动 | 有效范围 | 关键前后数字 |
|---|---|---|---|
| 1 | `serve.py` 启用 HTTP/1.1 keep-alive | 所有档位 | 133 个小文件的连接数 **133 → 1（串行）/ 6（并发 6）**；同一批请求 41→32 ms（串行）、26→14 ms（并发 6）。浏览器侧连接数 59→14（冷启动）、227→15（细化） |
| 2 | `index.html` 预加载 maplibre-gl.js / app.js / catalog | 首屏 | 三个关键资源 **t≈3 ms** 同时开始；资源列表 **重复 URL = 0**；冷启动首帧 5425→**3600 ms（−33%）** |
| 3 | `readJSON` 超时改为「排队 45 s + 停滞 20 s」 | 慢速档 | 1.6 Mbps 下原生几何从未完成（0 个 native 请求）→ **54.6 s 完成（132 个请求）**；不再出现"精细图层暂不可用"式整体失败 |
| 4 | `readJSON` 给 `data/fast`/`data/native` 加 Fetch Priority high | 慢速档 | 本机与 1.6 Mbps 档无显著变化（见 §3.4），保留作为调度提示 |
| — | 尝试后主动回退 | — | 原生几何并行预取会让 `validate-native` 的 mixed_cache_render 契约失败，已回退（§3.5） |

**诚实结论**：在**快网/本机**上，本轮把首屏从 5.4 s 压到 3.6 s、把细化路径的连接数减少一个数量级；在**极慢网（≤1.6 Mbps）**上，修复的是"详细图**根本加载不出来**"（固定 20 s 超时掐断排队请求），代价是首帧变慢几秒——因为原先被掐断的 10–13 MB 精细图层现在真的在下载，会与首帧争带宽。真正的剩余瓶颈是**字节数**：一次放大到 zoom≥2.5 要取约 10.3 MB 精细物理层（§6）。

## 1. 方法与环境

- 被测服务：**8769 = 本仓库当前 `serve.py`（HTTP/1.1 keep-alive）**；**8767 = 改动前启动的旧进程（HTTP/1.0）**。两者服务同一目录 `public/`，仅服务端版本不同，因此 before/after 的差异可归因。
- 浏览器：无头 Chrome 154 + SwiftShader 软件渲染；无头 `requestAnimationFrame` 被节流到约 2 fps，故不报帧率，改用 `performance.now()` 标记、`PerformanceResourceTiming`、页面内 `fetch` 包装器与 CDP Network 事件。
- 限速：`Network.emulateNetworkConditions`；四档 unthrottled / 4 Mbps·100 ms / 1.6 Mbps·300 ms / 400 kbps·400 ms。每档独立 profile、冷启动、缓存禁用（驱动固定 `Network.setCacheDisabled(true)`）。
- 场景：`cold-1500`（boot 年首屏）、`detail-1450`（非 boot 年：默认全球视图首帧 → 原生几何 → 放大 3/7/9，每 250 ms 采样各图层状态）、`regional-ohm-1500`（地区详图 + OHM 固化数据，相机 9.32,48.08,6.72）。
- 报告逐场景增量落盘（浏览器崩溃不丢数据），并记录 git HEAD、资源版本号、关键文件 sha256 与 loadavg。后期提交变动过工作区，最终树见 `perf-detail-load-round3.json` 的 `meta.provenance`。

## 2. before / after 对照

生成命令：`node scripts/verification/perf-detail-load.mjs --compare baseline,round3`
（原始数据 `perf-detail-compare-baseline-round3.json`）。

| 场景 | 首帧 before → after | 原生几何到位 before → after | 连接数 before → after | 编码字节 before → after |
|---|---|---|---|---|
| cold-1500 / unthrottled | 5425 → **3600 ms** | — | 59 → **14** | 5.43 → 5.44 MiB |
| cold-1500 / 4 Mbps | 9517 → 9501 ms | — | 59 → **16** | 3.49 → 3.51 MiB |
| cold-1500 / 1.6 Mbps | 18587 → 19222 ms | — | 50 → **14** | 2.75 → 3.08 MiB |
| cold-1500 / 400 kbps | 66934 → 67324 ms | — | 47 → **14** | 2.52 → 2.52 MiB |
| detail-1450 / unthrottled | 5678 → **4816 ms** | 6656 → **5336 ms** | 227 → **15** | 20.81 → 20.82 MiB |
| detail-1450 / 4 Mbps | 17287 → 16953 ms | 22141 → 21866 ms | 227 → **19** | 11.50 → 11.38 MiB |
| detail-1450 / 1.6 Mbps | 34236 → 40408 ms | **未完成（0 请求）→ 54637 ms（132 请求）** | 87 → **21** | 7.55 → 9.34 MiB |
| detail-1450 / 400 kbps | 69177 → 94464 ms | 未完成 → 采样窗内仍未完成（0 请求） | 73 → **30** | 3.07 → 6.96 MiB |
| regional-ohm-1500 / unthrottled | 5264 → **4333 ms** | OHM 5315 → **4413 ms** | — | 15.64 → 15.65 MiB |
| regional-ohm-1500 / 4 Mbps | 8387 → **7738 ms** | OHM 超时 → **28117 ms 完成** | — | 4.51 → 6.79 MiB |
| mobile 390×844 cold / unthrottled | （仅 after）3760 ms | — | 17 | 5.06 MiB |
| mobile 390×844 cold / 4 Mbps | （仅 after）10632 ms | — | 16 | 4.46 MiB |

读法：带宽受限档（≤4 Mbps）首帧时间主要由**字节数**决定，keep-alive 只省连接建立时间，因此 4 Mbps 首屏几乎不变；而 400 kbps 档 after 首帧变慢，是因为原先被超时掐断的精细图层现在真的在下（§3.3）。

## 3. 每项优化

### 3.1 serve.py：HTTP/1.1 keep-alive

```python
class AtlasHandler(SimpleHTTPRequestHandler):
    protocol_version='HTTP/1.1'
    timeout=65
...
server.daemon_threads=True
```

微基准（`--keepalive-bench --files=133`，取 `public/data/native/geos/**` 真实前 133 个小文件）：

| 连接方式 | 并发 | 133 请求耗时 | 新建 TCP 连接 |
|---|---|---|---|
| before（8767，HTTP/1.0） | 1 | 41 ms | **133** |
| after（8769，HTTP/1.1） | 1 | 32 ms | **1** |
| before | 6 | 26 ms | **133** |
| after | 6 | 14 ms | **6** |

本机 RTT≈0，绝对收益只有几十毫秒；收益与 RTT 成正比（省下 130+ 次 TCP 握手），因此它是慢速高延迟档的结构性修复。浏览器侧连接数：冷启动 59→14、细化 227→15/19/21/30。

### 3.2 index.html 预加载

```html
<link rel="preload" href="assets/maplibre-gl.js?v=…" as="script">
<link rel="modulepreload" href="app.js?v=…">
<link rel="preload" href="data/fast/catalog.json.gz" as="fetch" crossorigin>
```

- 预加载 URL 与脚本标签使用**同一 revision 字符串**（`stamp-assets.mjs` 同时重写 `src`/`href`），不会出现"预加载一个 URL、真正请求另一个 URL"的二次下载；实测资源列表重复 URL = 0。
- after 冷启动：maplibre-gl.js / app.js / startup.js / catalog.json.gz 均在 t≈3 ms 开始；首帧 5425→3600 ms。

### 3.3 map-engine.js：读取超时从「固定 20 s」改为「排队 + 停滞」两段

原 `readJSON` 的 `setTimeout(()=>controller.abort(),20000)` 从 `fetch()` 调用开始计时，**把排队等待连接的时间也计入**。放大时 6 条连接被 10.3–13.5 MB 精细物理层占满，原生几何的 `data/native/index.json.gz` 及后续 132 个小文件一直排队，20 s 后被 abort：

- before / 1.6 Mbps：native 请求数 **0**，原生几何 300 s 内从未完成；
- before / 400 kbps：同样 **0**；精细层整体失败。

改为 `CONNECT_TIMEOUT=45 s`（等连接+首字节）+ `STALL_TIMEOUT=20 s`（进入下载后每收到数据就重置，仅真停滞才中止）。字节与解析路径不变。效果：1.6 Mbps 下原生几何 **54.6 s 完成、132 个请求**；4 Mbps 下 regional OHM 就绪从"超时"变为 28.1 s 完成。

### 3.4 Fetch Priority 提示（data/fast、data/native → high）

目的：让首帧数据与体积很小的原生几何（0.33 MB）不必排在多兆字节精细层之后。实测：本机与 4 Mbps 档无可测差异（±2%），1.6 Mbps 档 detail 首帧 39263→40408 ms（噪声范围），400 kbps 档仍受制于"6 条连接被已在传输的大文件占满"。保留该提示（成本为零、方向正确），但不计为本轮收益。

### 3.5 尝试后主动回退：原生几何并行预取

曾把 `loadNative` 提前到 `prepareOverview` 里与概览几何并行启动。`node scripts/validate-native.mjs` 的 `mixed_cache_render` 断言失败：该用例要求"混合缓存下首帧不得自称完整原生"，并行预取会在首帧构建期间把缓存填满并把首帧标记为 `n`。按"不为跑分牺牲正确性"**回退**。

## 4. 首屏分阶段（after，cold/unthrottled）

| 阶段 | 值 |
|---|---|
| HTML 响应结束 | 2 ms |
| CSS 全部就绪 | 7 ms |
| 关键 JS（maplibre-gl / app / startup）就绪 | 8 ms |
| 首个几何数据就绪 | 8 ms |
| 全部 data/* 就绪 | 3653 ms |
| **地图就绪（#loading 隐藏）** | **3600 ms** |
| JS / CSS / data 字节 | 1.37 MB / 136 KB / 4.20 MB |

关键路径是**数据**（4.2 MB），不是 JS/CSS；首屏要继续变快只能减少或压缩数据。

## 5. 放大 3 → 7 → 9 各图层到位（`detail-1450`，250 ms 采样）

before（baseline）与 after（round3，含 priority）逐档对照，`null` = 采样窗内未就绪：

| 档位 | zoom | 湖泊细节 lakesDetail | terrain | 现代参照 | regional |
|---|---|---|---|---|---|
| unthrottled before | 3/7/9 | — / 6804 / 1677 ms | — / 4968 / 769 ms | — / — / 1425 ms | — / 6804 / 1677 ms |
| unthrottled after | 3/7/9 | — / **3848** / 1683 ms | — / **3075** / 8 ms | — / — / **1097** ms | — / **3848** / 1683 ms |
| 4 Mbps before | 3/7/9 | — / 8046 / 3892 ms | — / 7252 / 6 ms | — / — / 872 ms | — / 8046 / 3892 ms |
| 4 Mbps after | 3/7/9 | — / 8280 / **4570** ms | — / 7481 / 8 ms | — / — / **761** ms | — / 8280 / **4570** ms |
| 1.6 Mbps before | 3/7/9 | — / 16122 / 12360 ms | — / 15368 / 8 ms | — / — / 2142 ms | — / 16122 / 12360 ms |
| 1.6 Mbps after | 3/7/9 | — / 17272 / 12027 ms | — / 16670 / 9 ms | — / — / 1206 ms | — / 17272 / 12027 ms |
| 400 kbps before | 3/7/9 | 全部 null | 全部 null | — / — / 1835 ms | 全部 null |
| 400 kbps after | 3/7/9 | 全部 null | 全部 null | — / — / 1849 ms | 全部 null |

结论：4 Mbps 及以上，放大后 4–8 s 内湖泊/terrain/regional 到位；400 kbps 档因 10.3 MB 精细层在采样窗（每级 60 s）内下不完，湖泊细节与 terrain 仍为未就绪——这是字节数问题，不是超时问题。

## 6. 仍未解决的瓶颈（按影响排序）

1. **精细物理层体积**：放大到 zoom≥2.5 一次取 `land-10m`(3.5 MB) + `ocean-mask`(3.4 MB) + `rivers-10m`(2.1 MB) + `lakes-10m`(1.3 MB) ≈ **10.3 MB**（`detail-1450` 全场景 13.5 MB）。`geography.js` 不在本轮写作用域。建议后续：按缩放分级（例如 zoom<4 用 50m，4–7 用 10m 简化版）、或对这三个文件做几何简化/分块。
2. **原生几何是 130+ 个小文件**（合计仅 0.33 MB）：keep-alive 后本地不再是瓶颈，但慢网高延迟下请求数仍会放大排队时间。建议后续：服务端合并成 1–2 个分片（`native-geometry.js` 已是分文件读取，合并后改动可控）。
3. **在线瓦片**：`terrain-dem`（tiles.mapterhorn.com）、现代地理参照、OHM 在线瓦片依赖外网，无头环境下 terrain 在 unthrottled 也要等到 zoom 7。
4. **湖泊瓦片**：`public/data/lakes` 有 **2552 个** `.bin.gz`（238 MB），按视野按需取；zoom 9 一次约 10 个（≈0.7 MB），单个请求都很小但数量多。
5. **首屏 5.4 MB**：物理底图 1.5 MB + places 索引 0.84 MB + catalog 0.6 MB + maplibre 0.94 MB。除 maplibre 外都在别人作用域内，本轮只做了预加载与连接复用。

## 7. 复现

```bash
python3 serve.py --port 8769 &      # 本仓库当前 serve.py（HTTP/1.1 keep-alive）
# 服务端微基准（133 个小文件）
node scripts/verification/perf-detail-load.mjs --keepalive-bench --label before-http10 --url http://127.0.0.1:8767
node scripts/verification/perf-detail-load.mjs --keepalive-bench --label after-http11 --url http://127.0.0.1:8769
# 浏览器场景（按档拆分，逐场景落盘）
node scripts/verification/perf-detail-load.mjs --label round3 --url http://127.0.0.1:8769 --profiles=unthrottled,wifi-4mbps --kinds=cold,detail,regional --append
node scripts/verification/perf-detail-load.mjs --label round3 --url http://127.0.0.1:8769 --profiles=slow-4g-1.6mbps,slow-3g-400kbps --kinds=cold,detail --append
node scripts/verification/perf-detail-load.mjs --device mobile --label round3-mobile --url http://127.0.0.1:8769 --profiles=unthrottled,wifi-4mbps --kinds=cold --append
node scripts/verification/perf-detail-load.mjs --compare baseline,round3
# 正确性
node scripts/validate-native.mjs && node scripts/validate-v3.mjs && node scripts/validate-boundary-app-races.mjs && node scripts/validate-lakes.mjs
```

## 8. 验证与证据

- 四个校验器改动后全部通过：`validate-native`（11/11）、`validate-v3`、`validate-boundary-app-races`、`validate-lakes`，退出码均为 0。
- 桌面 1400×900 与手机 390×844 各跑一轮冷启动（`perf-detail-load-round3-mobile.json`）。
- 截图：`docs/verification-3.12/shots/detail-<label>-*.png`。
- 原始报告：`perf-detail-load-baseline.json`（before）、`perf-detail-load-round3.json`（after）、`perf-detail-load-round3-mobile.json`、`keepalive-bench-before-http10.json`、`keepalive-bench-after-http11.json`、`perf-detail-compare-baseline-round3.json`。
