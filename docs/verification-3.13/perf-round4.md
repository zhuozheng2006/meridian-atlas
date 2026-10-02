# 3.13 性能第四轮：G6 首屏体量与精细层治理

目标（竞品对标 G6）：首屏 ≤8 MB / ≤3.5 s，并处理 zoom≥2.5 一次 10.3 MB 的精细物理层。
本轮在 task-7（keep-alive、预加载、超时两段化，commit c7b1ff44）基础上继续，全部数字来自同一脚本
`scripts/verification/perf-detail-load.mjs`，before/after 使用同一批 CDP 限速档与同一台服务（8769 = 本仓库 `serve.py`）。

## 0. 结论摘要

| # | 改动 | 结果 | 保留？ |
|---|---|---|---|
| 1 | `serve.py` 对文本资源**即时 gzip**（未压缩的 JS/CSS/JSON/GeoJSON） | 首屏编码字节 **5.44 → 4.22 MiB（−22%）**；4 Mbps 首帧 9501→**7987 ms**、1.6 Mbps 19222→**11944 ms（−38%）**、400 kbps 67324→**47110 ms**；手机 4 Mbps 10632→**8539 ms** | ✅ 保留 |
| 2 | `geography.js` 精细水系列按缩放**分层加载**（land 10 m 仍在 zoom≥2.5；rivers/lakes/ocean ≈6.74 MB 推迟到 zoom≥4） | 一次 zoom 3 访问的物理层字节 **13.36 → 6.62 MiB**，其中水系列 7,065,936 B 完全不取；zoom≥4 后照常加载，detail 场景无回退 | ✅ 保留（Lead 已把 `validate-geography` 的四个 fixture 从 zoom 3 改到 zoom 4，并**新增回归断言锁定该分层**：zoom 3 不得请求 rivers/lakes-10m、zoom 4 必须请求；最终 31 pass / 0 findings） |
| 3 | native 130+ 小文件服务端合并 | **被 `validate-native` 契约阻止**（见 §3.3），只给出量化评估与建议 | ❌ 不做（契约） |
| 4 | maplibre-gl.js 换 ESM/裁剪构建 | 收益 ~100 KB/4.22 MB（2.4%），需替换 vendored UMD 构建 | ❌ 不做（见 §3.4） |
| 5 | 湖泊瓦片是否首屏误拉 | 冷启动 lake 请求数 **0、字节 0**：确认按需 | ✅ 已确认 |

## 1. 方法与环境

- 服务：**8769 = 本仓库当前 `serve.py`**（HTTP/1.1 keep-alive + 即时 gzip）。before = 上一轮同端口、同脚本、无 gzip 的 round3 数据。
- 浏览器：无头 Chrome 154 + SwiftShader；rAF 被节流到约 2 fps，故用 `performance.now()` 标记、`PerformanceResourceTiming`（`encodedBodySize` = 压缩后字节）与页面内 `fetch` 包装器（记录 content-length，可统计"已发起"的字节）。
- 限速：`Network.emulateNetworkConditions`，unthrottled / 4 Mbps·100 ms / 1.6 Mbps·300 ms / 400 kbps·400 ms。
- **噪声说明**：round3 起始 loadavg 4.6，round4 起始 loadavg 9.98（其他成员同时在跑浏览器）。因此 **unthrottled 档数字不可比**（5.4 s 上下浮动），限速档稳定且一致变好；报告保留原始 loadavg 以便复核。

## 2. gzip：字节与时间

### 2.1 单资源字节（curl，identity vs gzip）

| 资源 | 原字节 | gzip 后 | 降幅 |
|---|---:|---:|---:|
| assets/maplibre-gl.js | 937,395 | 247,699 | −74% |
| app.js | 92,216 | 30,817 | −67% |
| style.css / product.css / cartography.css | 25,728 / 16,887 / 24,408 | 6,367 / 4,671 / 6,511 | ≈−73% |
| assets/maplibre-gl.css | 69,430 | 10,051 | −86% |
| data/land.geojson | 138,160 | 51,317 | −63% |
| data/coverage.json | 227,984 | 15,654 | −93% |
| data/physical/land-10m.json.gz | 3,569,584 | 3,569,584 | 0%（已压缩，不重复编码） |

### 2.2 场景级（round3 → round4）

| 场景 | 首帧 before → after | 编码字节 before → after | 请求数 |
|---|---|---|---|
| cold-1500 / unthrottled | 3600 → 5004 ms（负载噪声，不采信） | 5.44 → **4.22 MiB** | 63 → 63 |
| cold-1500 / 4 Mbps | 9501 → **7987 ms（−16%）** | 3.51 → **2.29 MiB（−35%）** | 63 → 63 |
| cold-1500 / 1.6 Mbps | 19222 → **11944 ms（−38%）** | 3.08 → **1.61 MiB（−48%）** | 63 → 63 |
| cold-1500 / 400 kbps | 67324 → **47110 ms（−30%）** | 2.52 → **1.65 MiB（−35%）** | 63 → 63 |
| detail-1450 / 4 Mbps | 16953 → **15850 ms** | 11.38 → 12.38 MiB（更多层真正下完） | 243 → 243 |
| detail-1450 / 1.6 Mbps | 40408 → **32513 ms（−20%）** | 9.34 → 8.02 MiB | 243 → 243 |
| regional-ohm-1500 / 4 Mbps | 7738 → **6547 ms（−15%）** | 6.79 → 5.58 MiB | — |
| mobile 390×844 cold / 4 Mbps | 10632 → **8539 ms（−20%）** | 4.46 → **2.54 MiB（−43%）** | — |
| mobile 390×844 cold / unthrottled | 3760 → 5130 ms（噪声） | 5.06 → **3.85 MiB** | — |

实现：`AtlasHandler.do_GET` 对 `.js/.css/.html/.json/.geojson/.svg/.txt/.md/.xml/.webmanifest` 且 ≥1 KB 的文件即时 gzip，带 `Content-Encoding: gzip`、`Content-Length`（压缩后）、`Vary: Accept-Encoding`；带 `Range` 请求、已压缩文件（.gz/.br/.webp/…）与 HEAD 走原路径。压缩结果按 (path, mtime, size) 缓存 64 项。

## 3. 精细层与其它评估

### 3.1 geography.js：精细水系列按缩放分层（已保留）

改动：`loadLocal()` 里 `land`（10 m 海岸线，3.57 MB）仍在 **zoom≥2.5** 加载；`rivers-10m`(2.18 MB) + `lakes-10m`(1.35 MB) + `modern-ocean-mask`(3.54 MB) 推迟到 **zoom≥4**，在此之前继续用已加载的 50 m 概览水系（`water-overview` 138 KB + `ocean-mask-overview` 736 KB）兜底——包括"会话直接从 zoom 3 开始"的情况。

实测（新增 `--kinds=zoom3` 场景：默认全球视图 → 跳到 zoom 3 → 统计物理层字节）：

| 指标 | before-tier | after-tier |
|---|---|---|
| 物理层已发起字节（unthrottled） | 13.36 MiB | **6.62 MiB（−50%）** |
| 物理层已发起字节（1.6 Mbps） | 12.34 MiB | **6.62 MiB（−46%）** |
| 实际取到的水系列文件 | ocean-mask 3,536,204 B + rivers 2,182,931 B + lakes 1,346,801 B | **0 B**（三者均未请求） |
| land-10m | 3,569,584 B | 3,569,584 B（不变） |
| zoom 3 截图 | `shots/detail-before-tier-zoom3-unthrottled.png` | `shots/detail-after-tier-zoom3-unthrottled.png`（肉眼一致） |

用户真正放大到 zoom≥4 时水系列照常加载，`detail-1450`（zoom 3→7→9）无回退：
4 Mbps 15687/19599 ms（round4 15845/21122）、1.6 Mbps 32343/43102 ms（round4 32513/43170）。

**契约过程（如实记录）**：本改动最初让旧的 `validate-geography`（fixture 在 zoom=3 期待四个细层请求）报 4 条 finding，我按"契约不破"先回退；Lead 随后把这四个用例的 zoom 改为 4（它们测的是"细层不被粗层顶掉"的语义而非阈值），并新增一条回归断言把分层意图锁死。重新应用后 `validate-geography` 为 **31 pass / 0 findings、退出码 0**。

### 3.2 native 130+ 小文件：量化评估

现状：`data/native/geos/NNN/ngXXXXX.json.gz` 共 11,307 个文件（每个 ≈0.5–8 KB），一年 132 个请求、合计仅 0.33 MB。keep-alive 之后本机已不是瓶颈，慢网高延迟下是 132/6 ≈ 22 个往返。

潜在做法与服务端合并端点（例如 `/data/native/geos/bundle?ids=…` 返回单个 gzip JSON）：**132 请求 → 1，字节基本不变（≈0.33 MB）**，在 400 ms RTT 下约省 8.8 s。

**结论：不做**，因为 `scripts/validate-native.mjs` 的既有契约明确要求逐文件请求：
- `collision_all`：`assert(requests.some(r=>r.url.startsWith('data/native/geos/')))` 且 `assert(!requests.some(r=>r.url.includes('native-')))`
- `shared_file_cache`：`assert.deepEqual(new Set(非 index 请求 URL), 逐文件路径集合)` —— 任何 bundle URL 都会让这个集合断言失败。

若要拿到这笔收益，需要 Lead 决定是否放宽该契约（例如允许"bundle 优先、逐文件回退"并改写断言）。本轮按"契约不破才保留"的原则仅留评估。

### 3.3 maplibre-gl.js 937 KB：评估后不做

gzip 已把它降到 247,699 B（−74%），占首屏 4.22 MiB 的 5.9%。换官方 ESM/裁剪构建预计再省 ~80–120 KB（≈2.4%），代价是替换仓库内 vendored 的 UMD 构建、并重新验证全部地图行为；本轮不划算。**结论：不做，理由如上。**

### 3.4 湖泊瓦片：确认按需

`public/data/lakes` 有 2552 个 `.bin.gz`（238 MB）。冷启动场景实测：`/data/lakes/` 请求数 **0**、字节 **0**（`perf-detail-load-round4.json` cold-1500 的 `collected.groups.lakes`），只在放大到细节级别时按视野取瓦片。**无需改动。**

## 4. 契约与验证

- `node scripts/validate-native.mjs`：**11/11 通过（退出码 0）**
- `node scripts/validate-v3.mjs`、`validate-boundary-app-races.mjs`、`validate-lakes.mjs`：退出码 0
- `node scripts/validate-geography.mjs`：**31 pass / 0 findings，退出码 0**（分层加载改动 + Lead 更新 fixture/新增回归断言之后）
- `node scripts/stamp-assets.mjs --check`：**需要在收尾时重新盖章**——本轮最后一次修改 `public/geography.js` 发生在 Lead 上次 stamp 之后，因此当前 revision 是旧的（按约定我不跑 `prepare:assets`，由 Lead 统一执行）。
- 桌面 1400×900 与手机 390×844 冷启动各一轮：见上表与 `perf-detail-load-round4-mobile.json`

## 5. 仍未解决 / 下一步

1. **首屏 4.22 MiB** 组成：数据 3.99 MB（其中 catalog 0.60、physical 概览 0.85、places 索引 0.63、events、coverage 0.016）+ JS 0.41 MB + CSS 0.03 MB。要再降需要动数据分片或 places 索引（不在本轮写作用域）。
2. **精细层首次真正加载仍是 10.3 MB**（zoom≥4 时）；本轮只是让 zoom 2.5–4 不再付这笔钱。要再降需要**按视野分片**（需生成派生数据文件 + 构建脚本，且会新增仓库体积）或**更小的编码**（brotli 约再 −15~20%，但静态托管需正确设置 Content-Encoding）。
3. **native 合并**：等待 Lead 对 validate-native 契约的决定。
4. 在线瓦片（terrain/现代参照/OHM）与 lakes 瓦片数量（2552 个）仍是慢网下的请求数瓶颈。

## 6. 复现

```bash
python3 serve.py --port 8769 &     # HTTP/1.1 + 即时 gzip
# 首屏 / 细化 / 地区（含 gzip 前后对照：round3 为上一轮同端口数据）
node scripts/verification/perf-detail-load.mjs --label round4 --url http://127.0.0.1:8769 --profiles=unthrottled,wifi-4mbps --kinds=cold,detail,regional --append
node scripts/verification/perf-detail-load.mjs --label round4 --url http://127.0.0.1:8769 --profiles=slow-4g-1.6mbps,slow-3g-400kbps --kinds=cold,detail --append
node scripts/verification/perf-detail-load.mjs --device mobile --label round4-mobile --url http://127.0.0.1:8769 --profiles=unthrottled,wifi-4mbps --kinds=cold --append
# 分层加载前后（before 用未分层版本重跑，after 为当前代码）
node scripts/verification/perf-detail-load.mjs --label before-tier --url http://127.0.0.1:8769 --profiles=unthrottled,slow-4g-1.6mbps --kinds=zoom3 --append
node scripts/verification/perf-detail-load.mjs --label after-tier  --url http://127.0.0.1:8769 --profiles=unthrottled,slow-4g-1.6mbps --kinds=zoom3 --append
# 契约
node scripts/validate-native.mjs && node scripts/validate-v3.mjs && node scripts/validate-boundary-app-races.mjs && node scripts/validate-lakes.mjs && node scripts/validate-geography.mjs
node scripts/stamp-assets.mjs --check
```

证据文件：`perf-detail-load-round4.json`、`round4-mobile.json`、`round4-tier.json`、`before-tier.json`、`after-tier.json`、`smoke.json`；截图 `docs/verification-3.13/shots/detail-*`。
