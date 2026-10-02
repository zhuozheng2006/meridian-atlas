# 3.15 性能第五轮：zoom≥4 精细物理层的紧凑编码（10.64 MB → 5.33 MB）

目标：把 zoom≥4 一次取走的精细物理层（rivers-10m + lakes-10m + ocean-mask + land-10m）
从 10.64 MB 降到可接受体量，并复核 native 逐文件请求。全部 before/after 数字来自**同一脚本、
同一条件**：`scripts/verification/perf-detail-load.mjs`（本机 8767 = 本仓库 `serve.py`），
外加一组受控逐载荷 A/B（8768 = 改动前 HEAD（commit c76ef44b 之前）`git archive` 出来的纯净副本 vs 8767 = 当前工作树）。
按要求**先测量再改**；不达标或契约不破不了的项一律回退/不做，并如实记录。

## 0. 结论摘要

| # | 改动 | 前后数字 | 保留？ |
|---|---|---|---|
| 1 | 精细物理层改**紧凑编码**（坐标量化 1e-5 度 + 逐环整数 delta，仍是 `.json.gz`、仍走 `readJSON`） | 四层 **10,635,520 → 5,327,275 B（−49.9%，2.00x）**；最大坐标偏差 **5e-6 度（0.55 m）**；要素/环/顶点数完全不变 | ✅ 保留 |
| 2 | 两个概览文件同编码（首屏受益） | **874,196 → 533,737 B（−38.9%）**；冷启动 4 Mbps 与 unthrottled 的物理层组 **1,607,770 → 1,267,311 B（−340,459 B）** | ✅ 保留 |
| 3 | 受控逐载荷 A/B（限速下只取这 6 个文件） | 4 Mbps **22,625 → 11,826 ms（−47.7%）**；1.6 Mbps **56,753 → 29,799 ms（−47.5%）**；解析 CPU 202→100 ms + 重建 23 ms | ✅ 保留 |
| 4 | native 130+ 小文件 bundle | 量化评估：132 请求 / 330,570 B / 6 并发 ≈ 22 个往返。**不做**（契约 + 写作用域，见 §5.2） | ❌ 不做 |
| 5 | 精细层按视野/缩放分片或 LOD 分层 | 量化评估见 §5.1。**不做**：land 与 ocean-mask 顶点 99.938% 重合但**环切分不同（只有 434/6825 个环序列一致）**，独立简化会让海岸线与海罩错开；且 `validate-geography` 锁定了 zoom 3/4 的 URL 契约 | ❌ 不做 |
| 6 | 换更强压缩（brotli 等） | 原始载荷 gzip 只有 **2.83–3.00x**，根因是十进制坐标文本；换算法不是现实路径（见 §5.3） | ❌ 不做 |

首屏（cold-1500）没有回退：unthrottled 编码字节 **5.63 → 5.31 MiB**，4 Mbps 两次同为 3.63 MiB
（该档完成资源集合受瓦片时机影响，精确量见 §2.2）；解码器给 JS 增加 **+1,590 B**（一次性）。

## 1. 方法与环境

- 服务：8767 = 本仓库 `serve.py`（HTTP/1.1 keep-alive + 即时 gzip）。before 数据全部在本轮改动落地**之前**、
  用**同一脚本同一参数**测得。受控 A/B 另开 8768 = `git archive HEAD`（改动前的 `public/`）副本，
  两个服务同机同内容，只有载荷编码不同。
- 浏览器：无头 Chrome + SwiftShader；rAF 被节流，因此时间线用 `performance.now()` 标记、
  `PerformanceResourceTiming`（本轮把 resource-timing buffer 从默认 250 提到 4096，否则精细层会被
  静默丢弃，见 `perf-detail-load.mjs` 注释）与页面内 `fetch` 包装器（content-length = 实际线上字节）。
- 限速：`Network.emulateNetworkConditions`，unthrottled / 4 Mbps·100 ms / 1.6 Mbps·300 ms。
- **噪声**：本机同时有其他成员的浏览器。before 起始 loadavg 6.11、结束 10.65；after 起始 3.76、结束 10.76；
  受控 A/B 时 loadavg 3.10。**字节与逐载荷时间是确定性的**，场景级首帧受负载影响（下表逐条标注负载）。
- 语言/环境：`node v26.7.0`；gzip 用 zlib level 9、mtime=0（同一输入 → 同一字节，sha256 可复现）。

## 2. 字节

### 2.1 逐文件（磁盘字节 = 线上字节；serve.py 对已压缩文件不再编码）

| 文件 | before B | after B | 倍数 | 原始 JSON B → 紧凑 JSON B | 原始 gzip 率 → 紧凑 gzip 率 |
|---|---:|---:|---:|---:|---:|
| rivers-10m.json.gz | 2,182,931 | **1,089,537** | 2.00x | 6,163,277 → 2,815,219 | 2.82x → 2.58x（对原始文本 5.66x） |
| lakes-10m.json.gz | 1,346,801 | **584,726** | 2.30x | 4,035,599 → 1,743,095 | 3.00x → 2.98x（6.90x） |
| land-10m.json.gz | 3,569,584 | **1,828,038** | 1.95x | 10,158,226 → 4,487,260 | 2.85x → 2.45x（5.56x） |
| modern-ocean-mask.json.gz | 3,536,204 | **1,824,974** | 1.94x | 10,134,820 → 4,467,069 | 2.87x → 2.45x（5.55x） |
| **四层合计** | **10,635,520** | **5,327,275** | **2.00x** | 30,491,922 → 13,512,643 | — |
| physical-overview.json.gz | 137,909 | **80,465** | 1.71x | 389,244 → 211,516 | 2.82x → 2.63x |
| modern-ocean-mask-overview.json.gz | 736,287 | **453,272** | 1.62x | 2,006,078 → 1,036,266 | 2.72x → 2.29x |
| **两概览合计** | **874,196** | **533,737** | **1.64x** | 2,395,322 → 1,247,782 | — |

编码格式（`atlas-compact-geojson/1`）：`{v,q,o,c}`，坐标为**量化到 1e-5 度的整数**（半格 5e-6 度 ≈ 0.55 m）、
**逐环 delta**、按要素保存属性与几何类型；文件仍是 `.json.gz`，应用仍用 `readJSON()` 读取，
普通 GeoJSON 原样透传（因此 `validate-geography` 的桩数据路径完全不变）。
量化误差 5e-6 度（≈0.55 m）：远低于 Natural Earth 10m 自身的定位精度（~10²–10³ m 量级）。
换算成像素：zoom 16 ≈ 0.33 px，应用的最大缩放 zoom 18（`maxZoom:18`）≈ 1.3 px（赤道）/ 0.8 px（中纬度）——
理论上界如此，但**实测在 zoom 16 与 zoom 18 的海岸线上逐像素完全相同**（见 §4），
因为 Natural Earth 的相邻顶点间距远大于 0.55 m，取整不会翻转任何像素。

### 2.2 首屏（cold-1500，桌面 1400×900）

两个概览文件是首屏就取的精简物理层（rivers+lakes 概览、海罩概览）：

| 指标 | before | after | 差 |
|---|---:|---:|---:|
| 物理层组（发起字节，4 Mbps 与 unthrottled 相同） | 1,607,770 B | **1,267,311 B** | **−340,459 B（−21.2%）** |
| ↳ 其中两个概览文件 | 874,196 B | **533,737 B** | −340,459 B（−38.9%） |
| 首屏总编码字节 / unthrottled | 5,906,981 B（5.63 MiB） | **5,568,112 B（5.31 MiB）** | **−338,869 B（−5.7%）** |
| 首屏总编码字节 / 4 Mbps | 3,803,626 B（3.63 MiB） | 3,803,409 B（3.63 MiB） | −217 B（完成资源集合受瓦片时机影响，见下） |
| `phases.dataBytes` / unthrottled | 4,383,799 B | **4,043,340 B** | −340,459 B（正好等于概览节省） |
| JS 字节（解码器） | 1,385,721 B | 1,387,311 B | +1,590 B |

4 Mbps 档首屏总量看起来没变，是因为该档到 `collect()` 时**尚未完成的资源集合逐次不同**（relief 瓦片、
fast 分片），而"已发起的物理层字节"两档都是 −340,459 B，这是与时机无关的确定性数字。

## 3. 时间

### 3.1 受控逐载荷 A/B（8768 纯净副本 vs 8767 紧凑载荷，同一 CDP 限速、同一台机）

只取这 6 个文件，顺序 fetch + 完整读取 body，再按应用路径 gunzip→JSON.parse→（紧凑时）重建几何：

| 档 | before 传输 | after 传输 | 降幅 | before 解析 | after 解析+重建 |
|---|---:|---:|---:|---:|---:|
| unthrottled | 33 ms | 20 ms | — | 122 ms | 50+11 ms |
| **4 Mbps·100 ms** | **22,625 ms** | **11,826 ms** | **−47.7%** | 202 ms | 100+23 ms |
| **1.6 Mbps·300 ms** | **56,753 ms** | **29,799 ms** | **−47.5%** | 170 ms | 62+16 ms |

其中**四个精细层**：4 Mbps 20,736 → 10,597 ms（−48.9%）；1.6 Mbps 51,965 → 26,645 ms（−48.7%）。
两个概览：4 Mbps 1,889 → 1,229 ms；1.6 Mbps 4,788 → 3,154 ms。
CPU 侧也没有变差：解析字节从 30.5 MB 文本降到 13.5 MB 整数文本，重建几何只多花 16–23 ms。

### 3.2 场景级（同一脚本 / 同一限速 / before 与 after 各一轮）

| 场景 / 档 | 首帧 before → after | 物理层组 before → after | 负载（起→止） |
|---|---|---|---|
| detail-1450 / 4 Mbps | 18,424 → **15,925 ms（−13.6%）** | 13.55 → **8.16 MiB** | 6.11→10.65 / 3.76→10.76 |
| detail-1450 / 1.6 Mbps | 40,772 → **39,145 ms（−4.0%）** | 13.55 → **8.16 MiB** | 同上 |
| zoom3-1450 / 4 Mbps | 16,282 → **15,778 ms（−3.1%）** | 6.62 → **4.64 MiB** | 同上 |
| zoom3-1450 / 1.6 Mbps | 40,826 → **38,037 ms（−6.8%）** | 5.97 → **4.06 MiB** | 同上 |
| cold-1500 桌面 / unthrottled | 4,985 → 5,127 ms（噪声） | 1.53 → **1.21 MiB** | 8.25→9.39 / 10.19→11.90 |
| cold-1500 桌面 / 4 Mbps | 9,720 → **9,618 ms（−1.0%）** | 1.53 → **1.21 MiB** | 同上 |
| cold-1500 手机 390×844 / 4 Mbps | 10,858 → **9,979 ms（−8.1%）** | 1.16 → **0.83 MiB** | 10.65→9.09 / 10.76→10.19 |
| cold-1500 手机 390×844 / 1.6 Mbps | 18,977 → 19,055 ms（+0.4%，噪声） | 1.16 → **0.83 MiB** | 同上 |

`encodedMiB` 这类"已完成资源总量"在两次运行间会漂移（取决于 collect 时刻哪些瓦片完成），
所以上表用**与时机无关的**"物理层组发起字节"和确定性首帧。

### 3.3 为什么首帧只降 1–3 秒

首帧由 fast 分片 + places 索引 + native 几何决定（1450 年首屏约 9.9 MB 数据），精细物理层是在
首帧之后、用户放大时才取，所以首帧只小幅受益。真正被改善的是"放大到 zoom≥4 之后拿到精细层的时间"：
after 的 detail/4 Mbps 场景里，四条精细层的 body 完成于 t+29.4 s / t+40.9 s / t+45.4 s / t+46.8 s
（land / lakes / rivers / ocean，合计 5.33 MB）；before 侧因为旧 instrumentation 的 resource-timing
buffer 溢出**没有采到 body 完成时刻**，只有 header 时刻（land t+21.4 s），所以 before 的时间用
§3.1 的受控 A/B 量化（同样这 6 个文件、同一限速、同机：4 Mbps −10.8 s，1.6 Mbps −27.0 s）。

## 4. 契约与验证

- `node scripts/validate-native.mjs`：**11/11，退出码 0**
- `node scripts/validate-v3.mjs`、`validate-boundary-app-races.mjs`、`validate-lakes.mjs`：退出码 0
- `node scripts/validate-geography.mjs`：**31 pass / 0 findings，退出码 0**（未改该文件；解码器对普通 GeoJSON 透传）
- `node scripts/validate-release.mjs`：**PASS All 357 physical assets match the current release inventory**
  （重编码后同步刷新了 `files.json` 的 bytes/sha256，以及 `physical-manifest.json`、
  `release-manifest.json`、`modern-ocean-mask.manifest.json`、`physical-overview.manifest.json` 中的尺寸/哈希，
  没有留下任何过期声明）
- `npm test`（完整套件，收尾复核）：**退出码 0**，447 条 PASS（含 `stamp-assets --check`、`validate-release`）
- **独立回环审计**：`node scripts/build-compact-physical.mjs --audit-git` 用**运行时解码器**
  （从 `public/geography.js` 的 `#region compact-geometry` 提取，保证编解码不漂移）把磁盘上的紧凑载荷与
  `git HEAD` 原始 blob 逐要素、逐属性、逐环、逐顶点比对：6/6 通过，顶点数完全一致，最大偏差 5e-6 度。
  另有 `--check`（files.json 逐文件 bytes+sha256）与 `--write`（幂等，重复执行只刷新清单）。
- **浏览器冒烟**：`#year=1450` 跳到 zoom 5（欧洲），`geography.status='fine'`，
  land/rivers/lakes/coastal-water 四个源全部 loaded、0 错误，viewport 内 land 65 / rivers 337 / lakes 152 要素。
- **像素对照**（8768 纯净副本 vs 8767，同相机、同缩放、同服务、cache 全禁）：
  - zoom 16 威尼斯海岸（reference/terrain 关闭）：**逐像素完全相同**（1,260,000 像素 0 差异）
  - **zoom 18（应用最大缩放）两条海岸线**（威尼斯潟湖、瓦登海）：**逐像素完全相同**（0 差异）
  - zoom 5 阅读视图（默认参考层）：mean diff 0.0003/255，仅 1 个像素差 >8（≤32，抗锯齿/瓦片时机噪声）
  截图 `docs/verification-3.15/shots/parity-*.png`（zoom 5 / 16 / 18 各 before、after）+ 仓库内 r5 场景截图。
- `stamp-assets`：修订号 **3.10.0-4f89524ff74c**（按 Lead 授权只跑 `node scripts/stamp-assets.mjs`，
  未跑 `prepare:assets`）。

### 4.1 契约边界（重要，写给后续轮次）

`scripts/validate-geography.mjs`（本轮**不在写作用域**）把 URL 与缩放绑定死了：
zoom 3 **不得**出现 `rivers-10m|lakes-10m`；zoom 4 **必须**各出现一次 `land-10m`、`rivers-10m`、
`lakes-10m`、`modern-ocean-mask.json`；且重试只能补缺失的那一层（`requests.length === before+1`）。
因此任何"改文件名/加分层/按视野分片"的方案在当前契约下都不可行——要做得先改这份契约并把意图
写成新的回归断言（上一轮 Lead 为"精细水系列按缩放分层"就是这么做的）。本轮因此只改**载荷格式**，
不改 URL、不改请求时序、不改任何阈值。

## 5. 评估但未做（附数字与理由）

### 5.1 按视野/缩放分片、LOD 分层：不做（会真实破坏海岸线与海罩的共边）

- 理论上限很诱人：1400×900 视口在 zoom 4 只覆盖 Web Mercator 世界的 **7.5%**、在 zoom 7 覆盖 **0.12%**，
  完美分片分别可省 ~92% / ~99.9%。
- 但精细层不是"一地一要素"：land-10m 只有 10 个要素、ocean-mask 只有 6 个（60° 条带），
  **按要素分片等于整份重取**；按格裁剪又会在未加载的邻格留下直线假海岸。
- 按 LOD 简化则有更硬的障碍：ocean-mask 的 **99.938% 顶点来自 land**，6794/6825 个海罩环的顶点集合
  与某个 land 环完全相同，但两者是**不同的切分（noding）**——真正能按"环序列+旋转/反向"匹配的只有
  **434/6825**。对 land 与 ocean-mask 各自独立简化，两条边会按各自容差分离（级联后可达 2× 容差，
  zoom 6 下 ~1 像素），在海岸线上出现底图色/relief 的细缝——这正是本项目最忌讳的"看不见却错"。
  要做必须先在构建期用多边形差集（shapely）从**同一套简化后的共享弧**重新生成海罩，并重新过一遍
  `validate-geography` 契约，属于下一轮的独立任务。
- 结论：本轮不做，保留数字供 Lead 决策。

### 5.2 native 几何 bundle：不做（契约 + 写作用域）

现状：一年 132 个 `data/native/geos/**` 小文件、合计 330,570 B；代码用 6 并发，
`ceil(132/6)=22` 个往返，300 ms RTT 下约 **6.6 s**（4 Mbps 档实测 nativeTimeline 跨度 4,583 ms/100 ms RTT）。
合并成 1 个 bundle 后字节几乎不变、往返降到 1。

**不做**，两条都成立才允许做：
1. `scripts/validate-native.mjs` 的 `collision_all` 要求至少一个 `data/native/geos/` 请求、
   `shared_file_cache` 要求"2 条别名记录 = 恰好 2 个请求（index + 单几何文件）"。任何 bundle 优先路径都会
   破坏后者；而该文件**不在本轮写作用域**，不能改断言。
2. 本项目"首帧不得被标记为完整原生""按文件粒度缓存可失效"的语义需要先有明确的契约改写方案（bundle 优先 +
   逐文件回退 + 首帧不置 `n` + 失败回退），这是 Lead 的决策项，不是本轮性能分片能单方面改的。

### 5.3 换压缩算法：不是现实路径

原始载荷 gzip 只有 **2.83–3.00x**，根因是它是**十进制坐标文本**（每个数字 ~3.3 bit 熵），
不是压缩器不好；换 brotli 最多再拿 ~15–20%，而且浏览器 `DecompressionStream` 不支持 brotli、
静态托管还得正确设置 `Content-Encoding: br`。先把坐标变成整数 delta 才是数量级正确的做法（本轮 −49.9%）；
紧凑化之后再上 brotli 的边际收益更小，本轮不引入。

## 6. 仍未解决 / 下一步

1. **精细层首次加载仍需 5.33 MB**（1.6 Mbps 下四条合计 26.6 s）。要再降一个数量级只有 §5.1 的
   视野分片/共享弧 LOD，前提是先改 `validate-geography` 契约。
2. **首屏 ~4–5.6 MB** 的大头仍是 fast 分片、places 索引、catalog（本轮只动了 0.34 MB 的概览）。
3. **native 132 请求 / 22 个往返**：等 Lead 对 `validate-native` 契约的决定。
4. 外部瓦片（mapterhorn terrain、OpenFreeMap 参照）在慢网下仍是长尾；不属本轮范围。

## 7. 复现

```bash
python3 serve.py --port 8767 &                      # 当前工作树
# 受控 A/B 的 before 侧：纯净 HEAD 副本
mkdir -p /tmp/atlas-pristine && git archive HEAD~1 public | tar -x -C /tmp/atlas-pristine   # c76ef44b 之前
cp serve.py /tmp/atlas-pristine/ && (cd /tmp/atlas-pristine && python3 serve.py --port 8768 &)
# 1) 契约与回环审计
node scripts/build-compact-physical.mjs --check
node scripts/build-compact-physical.mjs --audit-git      # 需要 HEAD 仍是原始载荷（本轮已在提交前执行）
node scripts/validate-native.mjs && node scripts/validate-v3.mjs \
  && node scripts/validate-boundary-app-races.mjs && node scripts/validate-lakes.mjs \
  && node scripts/validate-geography.mjs && node scripts/validate-release.mjs
# 2) 场景级 before/after（同一脚本同一参数）
node scripts/verification/perf-detail-load.mjs --label r5-before --url http://127.0.0.1:8768 \
  --profiles=wifi-4mbps,slow-4g-1.6mbps --kinds=detail,zoom3 --out docs/verification-3.15/perf-detail-load-r5-before.json
node scripts/verification/perf-detail-load.mjs --label r5-after  --url http://127.0.0.1:8767 \
  --profiles=wifi-4mbps,slow-4g-1.6mbps --kinds=detail,zoom3 --out docs/verification-3.15/perf-detail-load-r5-after.json
# 手机档：--device mobile --kinds=cold；桌面首屏：--kinds=cold --profiles=unthrottled,wifi-4mbps
```

## 8. 证据文件

- `perf-detail-load-r5-before.json` / `r5-after.json`（桌面 detail+zoom3，两档）
- `perf-detail-load-r5-before-mobile.json` / `r5-after-mobile.json`（手机 390×844 cold，两档）
- `perf-detail-load-r5-before-cold.json` / `r5-after-cold.json`（桌面 cold，unthrottled+4 Mbps）
- `perf-physical-payload-bench.json`（受控逐载荷 A/B：bytes / transfer / parse / build）
- `physical-encoding.json`（逐文件 before/after 字节、原始 sha256、紧凑 JSON 尺寸）
- 截图：`docs/verification-3.13/shots/detail-r5-{before,after}-*.png`（8 个场景）；
  像素对照 `docs/verification-3.15/shots/parity-{zoom5,zoom16,zoom18-venice,zoom18-wadden}-{before,after}.png`
