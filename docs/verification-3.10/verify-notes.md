# 3.10 验证基线 · 说明与发现（人工整理）

配套文件：`verify-baseline.md`（由各 JSON 报告生成的断言表）、`perf-baseline.json`、`keyboard-focus.json`、`mobile-check.json`、`network-resilience.json`、`verify-boundary-review.json`、`verify-summary.json`、`shots/`。

本文件只写"数据之外需要人来判断"的部分：结论口径、发现、与现有文档不一致处、以及本环境测不到的东西。所有数字都能在对应 JSON 里找到 `observed`。

## 一、口径

- 全部断言写在报告 `checks[]`：`pass: true/false`；`pass: null` 表示**没测到**，不算通过。
- 每条断言的 `observed` 是本次运行的真实观测（含原始数组/对象），不是概述。
- 报告 `meta.provenance` 记录生成时刻的 git HEAD、未提交路径、`public/index.html` 的资源版本号和关键文件 sha256。Lead 在验证期间持续提交，因此各报告的 HEAD 可能不同；以每份 JSON 自己的 provenance 为准。
- 复现：`node scripts/verification/<脚本>.mjs`；串行跑全部用 `run-all.mjs`（一次只开一个浏览器）。

## 二、关键实测（本轮）

| 项 | 实测 |
|---|---|
| 首屏（两次冷启动，缓存禁用，loadavg≈5） | 4068 / 4764 ms 达到地图就绪；DOMContentLoaded 32/38 ms；FCP 2568/2664 ms；JS 堆 189/276 MB |
| 首屏资源 | 57 个请求 / 5.4 MiB：脚本 32 个 1.36 MB、数据 fetch 21 个 4.18 MB、样式 4 个 136 KB |
| 最大单资源 | maplibre-gl.js 937 KB · modern-ocean-mask-overview 736 KB · historical-settlements-index 630 KB · catalog 603 KB · land-50m 528 KB |
| 年份步进 1490→1510（20 步，每步 1 年） | key→提交 中位 272 ms，p95 333 ms，最大 424 ms；20/20 全部到达目标年；25 个 long task，最长 5.2 s；堆增长 263 MB |
| 大范围拖动（约 800 px，跨 174° 经度） | 最后一次移动后 252 ms 停止移动；7 个 long task（最长 5.3 s）；堆 +0.4 MB。注意 `perMoveMs≈1210` 是 CDP 派发成本，不是应用延迟 |
| 图层失败重试 | 阻断 `physical-overview.json.gz`+`land-50m.json.gz` → 状态"部分精细图层暂不可用 · 可重试"；解除后点 #terrainRetry，4652 ms 恢复，重发 2 个请求 |
| 双图对照 | 10190 ms 打开，2 张活动地图，两台相机中心完全一致（Δ=0），堆 +185 MB |
| 键盘 | 25/25：← → 改年份且相机零调用、中心不变；Alt+←/→/↑ 触发 panBy(±80 px) 且年份不变；#yearInput/#search/#compareYear/阅读器/滑杆各自尊重焦点；Shift 加速 ×10；Home/End 到时间轴两端 |
| 输入法 | 真实组合：CDP `Input.imeSetComposition` 使 #search 进入组合（compositionActive=true），组合期间派发的方向键 `isComposing=true`、年份不变；极性对照（isComposing=false 的同一事件）年份 +10 |
| 手机 390×844 / 360×740 | 20/20：无横向溢出（scrollWidth==innerWidth）、canvas 正好等于 #map 且 = CSS×DPR、图层面板触摸开合且不出屏、阅读器正文 18 px/34.2 px、单指拖动平移且页面不滚动、点事件标记开阅读器、点 #nextYear 按步进（10 年）推进、34 px 安全区 inset 下底栏 padding 4→38 px |
| 弱网 | 4 Mbps/100 ms → 12.0 s；1.6 Mbps/300 ms → 19.1 s；400 kbps/400 ms → 67.7 s；三次都**成功**，无失败请求（每个文件的 20 s 超时未触发） |
| 404 | 1450 年的 overview 几何被 404（拦截 14/72 个请求）→ 5.1 s 后出现"未能载入 公元 1450 年，已保留当前地图。重试"；仍 404 时点重试 → 请求数 7→14（说明坏结果没有被缓存）；放行后重试 → 恢复，年份切走再切回无残留错误 |
| 断网 | 断网切 1600 年 → 11.7 s 后错误提示 + 重试，年份保留 1500，`navigator.onLine=false`，失败请求 `net::ERR_INTERNET_DISCONNECTED`；断网时点重试不假装成功；恢复联网后重试 → 到 1600 |
| 独立复核 | 18/18：relief 在 territories 之下（索引 2<4）、boundary-halo 存在且在 boundary 之下（5<16）、overview 填充透明度为 0.2–0.5 的缩放插值（详图模式为 0）、OHM 冻结数据 98 条且有来源/许可/时间戳、Bern 处 OHM 面=0 而低地国家正对照=1、徽标与文档一致（用户相机处"局部详图 · 61 条 · 空白处未收录"，regional 就绪 9.9 s）、档案目录列出 7 条未收录政体、关掉"疆域"时 territories/boundary/boundary-halo 同时 hidden |
| 1503 原始几何 | 137 条活动记录 / 133 次 native 几何请求 / 总请求 212，`#boundaryStatus`="原始疆域已载入"，稳态用时 1.98 s（同 renderer 二次加载，走内存缓存；文档的"约 12 秒"是冷加载口径，请求数 208 vs 实测 212 基本一致） |

## 三、发现（按优先级）

> 说明：本节第 2、3 条对应的问题已在提交 963275b1 中修复；下面的文字保留"首次测量 → 当前实测"的对照，避免把已修复项误当成现存缺陷。

1. **P2 · Tab 顺序过长**：`#year=1500` 时 `#yearInput` 是第 **106** 个可聚焦元素（共 125 个；侧栏事件卡 40 个 + 地图事件标记 40 个）。键盘用户必须依赖起点 skip-link（"跳到年份"）才能快速到达年份输入。若要让 Tab 顺序更短，可考虑给地图事件标记与事件卡加 roving tabindex/仅保留一个入口。
2. ~~P2 · safe-area 未声明~~ **已在 963275b1 修复并实测通过**：当前 viewport 为 `width=device-width,initial-scale=1,viewport-fit=cover`，`cartography.css` 使用 `env(safe-area-inset-bottom/top)`；CDP 模拟 34 px 底部 inset 后 `#timeline` 的 padding-bottom 4 px → **38 px**（+34），底边 793 < inset 边界 810。备注：本项第一次测量（提交 963275b1 之前的工作区）确实没有 viewport-fit 与 env()，属于已修复的快照差异，保留此说明以免误读。
3. ~~P3 · 手机默认步长 1 年~~ **已在 963275b1 修复并实测通过**：`app.js` 有 `DEFAULT_STEP=10`；无 `step` 参数的全新移动端 URL 实测选择器 = 10，点 `#nextYear` 1500 → 1510。
4. **P3 · 内存**：首屏 JS 堆 189–276 MB；年份连续切换 20 步堆增长 263 MB；打开第二张地图 +185 MB。低内存手机上值得关注（本轮仅在桌面无头 Chrome 上测量）。
5. **P3 · 文档措辞与实测不完全一致（供 Lead 决定是否改文）**：
   - `docs/verification-3.10/geometry-fidelity.md` 写"疆域填充透明度按缩放重新标定（0.53→0.30 区间）"；实测 overview 表达式是 `0,.5, 4,.42, 7,.3, 10,.2`（0.2–0.5），地区详图模式另设 `0.53/0.4/0.2`，且详图激活时填充为 0。
   - 同文（以及 `ohm-1500.md` §1/§"未收录"）列出"未收录"的六个政体；当前冻结数据 `metadata.gaps` 有 **7** 条非重叠 gap（新增 Holy Roman Empire），且 UI 档案目录实测显示"7 个当年政体在该来源中未收录"（神圣罗马帝国、旧瑞士联邦、巴伐利亚、符腾堡、巴登、哈布斯堡奥地利、蒂罗尔）。建议两份文档同步为 7 条。
   - 同文写"详图模式在该区域本体上是空白"；实测阿尔卑斯窗口（7–11.6E, 45.4–48.4N）有 **27** 条 OHM 要素（admin_level 3 的帝国区划，如 Bayerischer/Schwäbischer Reichskreis），只是六个具名公国/邦联确实没有（Bern 处 OHM 面=0）。建议改成"六个具名政体未收录，区域由上一级区划覆盖"。
6. **环境缺陷（不是应用问题）**：Chrome 154 (macOS, headless) 在阅读器打开时派发**可信键盘事件**会以 SIGABRT 崩溃：Cocoa 断言 `(self)->_enumeratingSubviewsCount < ((1 << 6) - 1)`，栈顶 `-[NSView performKeyEquivalent:]`（崩溃报告 2026-10-03 02:50 与 02:54，位于 `~/Library/Logs/DiagnosticReports`）。复现 6 次，集中在 reader 场景。因此该场景改用合成 KeyboardEvent（报告 limitations 已注明）；其余 24 条键盘断言仍用 CDP 可信事件。Lead 的其他浏览器脚本若在阅读器打开后按方向键，也可能踩到。

## 四、本环境测不到 / 不适用

- 帧率类指标：无头 Chrome 的 `requestAnimationFrame` 被节流到约 2 fps（实测 1.5 s 内 2 帧），因此不报 FPS/掉帧；改用 MutationObserver 时间线 + `longtask`。
- 真实 GPU：SwiftShader 软件渲染，不代表用户显卡。
- 真实设备/输入法：Chrome 设备模拟与 CDP 组合事件，不覆盖 iOS Safari 的动态工具栏/橡皮筋滚动、真实输入法候选窗；pinch/双击缩放、虚拟键盘顶起未测。
- 浏览器缓存：驱动固定 `Network.setCacheDisabled(true)`，冷/热缓存差异不在范围内。
- 离线冷启动：应用没有 Service Worker，也没有离线壳；断网刷新只能看到浏览器错误页（未作为应用缺陷计入）。
- 项目自带校验器（`npm test`）不在本脚本内重跑：其中若干会重写 `docs/` 审计 JSON，由 Lead 统一执行；本报告改用数据层与浏览器层独立复核。

## 五、复现与证据

```bash
node scripts/verification/perf-baseline.mjs        # 首屏/年份步进/拖动/图层重试/双图
node scripts/verification/keyboard-focus.mjs       # 方向键/Alt 平移/输入框/阅读器/Tab/输入法
node scripts/verification/mobile-check.mjs         # 390×844 与 360×740
node scripts/verification/offline-weaknet.mjs      # 弱网/404/断网与恢复
node scripts/verification/independent-review.mjs   # 边界呈现、OHM 1500、可发布性证据
node scripts/verification/run-all.mjs --summary-only   # 汇总各报告为 verify-summary.json
node scripts/verification/build-report-md.mjs      # 生成 verify-baseline.md
```

补充：用户截图相机（9.32,48.08,6.72）下 `boundaries=regional` 的实测与 `ohm-1500.md` 表格一致：徽标"局部详图 · 61 条 · 空白处未收录"、regional 就绪 9.86 s（Lead 此前实测约 9 s）、OHM 层 4.66 s 建好、视口内 89 个 OHM 面、Bern 0 个、低地 1 个。

截图证据在 `docs/verification-3.10/shots/`：`perf-desktop-1500.png`、`perf-compare-open.png`、`mobile-389...`（两档 atlas/layers/reader）、`network-404-error.png`、`network-offline-error.png`、`review-ohm-1500-alps.png`、`review-native-1503.png`、`keyboard-reader-focus.png`。
