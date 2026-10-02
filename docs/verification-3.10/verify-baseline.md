# 3.10 验证基线 · 独立实测报告

生成时间：2026-10-02T20:24:12.944Z。本文件由 `node scripts/verification/build-report-md.mjs` 从各 JSON 报告生成，请勿手工编辑。

结论口径、发现优先级、与现有文档不一致之处，见 [verify-notes.md](verify-notes.md)。

- git HEAD：8cd713112794d0821ae6749574c591e597f6f654（工作区另有 1 个未提交路径）
- 资源版本号：3.10.0-6af5167ed72f；Node v26.7.0；平台 darwin
- 驱动说明：browser.mjs sets Network.setCacheDisabled(true): HTTP cache is never used.
- 关键文件 sha256（前 16 位）：index.html=af77ead8f3d2a76a、app.js=ebee22bb57d11a4f、map-engine.js=2e9a7f59658193b0、timeline-controls.js=b3954150517b0a12、view-state.js=1b57cdfe210a7322、style.css=95f5e8ac64efeda8、product.css=2631908c806f7e1e、cartography.css=0d6529a4e2e5463b、boundary-controller.js=a3177e6595106833、regional-boundaries.js=3bf76038fc306ce1、geography.js=27c12a277aa10035

## 0. 复现命令

```bash
# 前置：本地服务已在 http://127.0.0.1:8767 指向本工作目录（python3 serve.py --port 8767）
node scripts/verification/perf-baseline.mjs        # → docs/verification-3.10/perf-baseline.json
node scripts/verification/keyboard-focus.mjs       # → docs/verification-3.10/keyboard-focus.json
node scripts/verification/mobile-check.mjs         # → docs/verification-3.10/mobile-check.json + shots/
node scripts/verification/offline-weaknet.mjs      # → docs/verification-3.10/network-resilience.json
node scripts/verification/independent-review.mjs   # → docs/verification-3.10/verify-boundary-review.json
node scripts/verification/build-report-md.mjs      # → 本文件
# 串行跑全部（一次只开一个浏览器）：node scripts/verification/run-all.mjs
# 只汇总已有报告：node scripts/verification/run-all.mjs --summary-only
```

所有报告遵循同一约定：`checks[]` 每条含 expected/observed/pass；`pass: null` 表示未测到（绝不当作通过）；`limitations[]` 记录本环境测不到的内容。

## 1. 总览

| 报告 | 断言通过 | 失败 | 未测 | 报告文件 |
|---|---:|---:|---:|---|
| 性能基线（首屏、年份步进、拖动、图层重试、双图对照） | 7 | 0 | 0 | docs/verification-3.10/perf-baseline.json |
| 键盘与焦点（方向键 / Alt 平移 / 输入框 / 阅读器 / Tab / 输入法） | 25 | 0 | 0 | docs/verification-3.10/keyboard-focus.json |
| 手机两档（390×844、360×740：溢出、画布、图层面板、阅读器、触摸、safe-area） | 20 | 0 | 0 | docs/verification-3.10/mobile-check.json |
| 弱网 / 404 / 断网与恢复 | 10 | 0 | 0 | docs/verification-3.10/network-resilience.json |
| 独立复核：边界呈现、OHM 1500 与可发布性证据 | 18 | 0 | 0 | docs/verification-3.10/verify-boundary-review.json |

失败断言：无。

## 2. 性能基线（首屏、年份步进、拖动、图层重试、双图对照）

报告：docs/verification-3.10/perf-baseline.json；生成于 2026-10-02T20:07:37.502Z；命令 `node scripts/verification/perf-baseline.mjs`。

实测结论：
- First screen: [4068,4764] ms map-ready (2 cold runs, cache disabled), DOMContentLoaded 32 ms, load event 50 ms.
- Resource weight for one 1500 CE first screen: 57 requests / 5546 KiB encoded.
- Year stepping 1490->1510 (21 steps of 1 year): key->idle median 272.1 ms, max 424.3 ms, long tasks 25.
- Large drag ~800 px: settled in 252 ms wall (24203 ms of CDP mouse moves), camera moved -173.73 deg lng.
- Blocked geography sources: status text after block = {"terrain":"部分精细图层暂不可用 · 可重试","lake":"放大查看湖岸细节","mapError":null}; after unblock + #terrainRetry recovered=true in 4652 ms.
- Comparison map: opened in 10190 ms, 2 live maps, heap +185 MB.

| 断言 | 结果 | 实测 |
|---|---|---|
| `perf.first-screen-ready` | 通过 | [4068,4764] |
| `perf.no-console-errors` | 通过 | {"coldConsole":[],"yearSequenceErrors":[]} |
| `perf.year-step-latency` | 通过 | {"stats":{"n":20,"min":195.1,"median":272.1,"p95":333.4,"max":424.3,"mean":272.5},"outliers":[],"loadAtStart":{"loadavg":[5.18,9.47,9.46],"chromeProcesses":30,"cpus":18}} |
| `perf.year-steps-all-settled` | 通过 | 20 |
| `perf.drag-settles` | 通过 | {"systemAtStart":{"loadavg":[11.27,10.4,9.8],"chromeProcesses":42,"cpus":18},"perMoveMs":1210.2,"wallMs":24203,"settleMs":252,"camera":{"before":[25,18],"after":[-148.73016,-20.35411],"deltaLng":-173.73,"deltaLat":-38.354,"zoomBef… |
| `perf.layer-retry-recovers` | 通过 | {"recovered":true,"retryMs":4652,"requestsAfterRetry":2} |
| `perf.compare-opens` | 通过 | {"openMs":10190,"maps":2,"compareYearEnabled":true,"map2Canvas":{"attr":[799,672],"rect":[799,672],"dpr":1},"cameraSync":{"left":[25,18],"right":[25,18],"deltaLng":0,"deltaLat":0},"heapDeltaMB":185,"pageErrors":[]} |

本环境测不到 / 不适用：
- requestAnimationFrame is throttled to ~2 fps in this headless configuration ({"count":9,"spanMs":3846}), so per-frame FPS/jank is NOT reported; the per-step timeline uses MutationObserver timestamps instead.
- performance.measureUserAgentSpecificMemory() is unavailable (page is not crossOriginIsolated); JS heap comes from the non-standard performance.memory.usedJSHeapSize.
- GPU raster times are from SwiftShader software rendering, not the user GPU.
- The CDP driver sets Network.setCacheDisabled(true), so cold/warm cache differences and disk-cache reuse are not measured.
- Frame timing during the drag is inferred from long tasks > 50 ms, not from compositor frames.

## 3. 键盘与焦点（方向键 / Alt 平移 / 输入框 / 阅读器 / Tab / 输入法）

报告：docs/verification-3.10/keyboard-focus.json；生成于 2026-10-02T20:01:15.186Z；命令 `node scripts/verification/keyboard-focus.mjs`。

| 断言 | 结果 | 实测 |
|---|---|---|
| `kb.canvas-focused` | 通过 | {"focusCanvas":{"ok":true,"id":null,"cls":"maplibregl-canvas"},"lastKey":{"t":6635.5,"key":"ArrowRight","alt":false,"shift":false,"composing":false,"repeat":false,"target":"maplibregl-canvas"}} |
| `kb.arrows-change-year` | 通过 | {"base":1500,"right":1510,"left":1500,"rightSettled":true,"leftSettled":true} |
| `kb.shift-accelerates` | 通过 | {"expected":1600,"year":1600,"settled":true} |
| `kb.arrows-do-not-pan` | 通过 | {"camops":[],"centerDelta":[0,0],"keyEventObservable":{"t":6635.5,"key":"ArrowRight","alt":false,"shift":false,"composing":false,"repeat":false,"target":"maplibregl-canvas"}} |
| `kb.alt-arrows-pan` | 通过 | [{"name":"panBy","args":[[80,0],{"duration":120}]},{"name":"panTo","args":[{},{"duration":120,"offset":{}},"undefined"]},{"name":"easeTo","args":[{"center":{},"duration":120,"offset":{}},"undefined"]}] |
| `kb.alt-arrows-camera-moved` | 通过 | [18.46344,0.90901] |
| `kb.alt-arrows-keep-year` | 通过 | {"before":1500,"afterAltRight":1500,"afterAltUp":1500} |
| `kb.alt-arrows-ignored-outside-canvas` | 通过 | {"yearBefore":1500,"yearAfter":1500,"centerDelta":[0,0],"camops":[],"active":{"tag":"INPUT","id":"yearInput","cls":"","text":"","rect":[93,31],"visible":true}} |
| `kb.year-input-owns-arrows` | 通过 | {"base":1500,"up":1510,"right":1500,"rightInputValue":"1500"} |
| `kb.year-input-no-pan` | 通过 | {"camops":[],"centerDelta":[0,0]} |
| `kb.year-input-escape-enter` | 通过 | {"base":1500,"escapeValue":"1500","enterYear":1750,"enterSettled":true} |
| `kb.search-owns-arrows` | 通过 | {"yearBefore":1500,"yearAfter":1500,"centerDelta":[0,0],"camops":[],"active":{"tag":"INPUT","id":"search","cls":"","text":"","rect":[304,38],"visible":true},"keysSeen":["search","search","search"]} |
| `kb.slider-owns-arrows` | 通过 | {"base":1500,"right":1510,"homeYear":-70000,"endYear":2026,"homeSettled":true,"endSettled":true} |
| `kb.compare-year-owns-arrows` | 通过 | {"open":{"ok":true,"ms":8417,"maps":2},"before":{"primary":1500,"compare":1900},"up":{"primary":1500,"compare":1910,"camops":[],"key":{"t":17351.4,"key":"ArrowUp","alt":false,"shift":false,"composing":false,"repeat":false,"target"… |
| `kb.reader-owns-arrows` | 通过 | {"openHidden":false,"title":"卡布拉尔船队抵达巴西Cabral reaches Brazil","yearBefore":1500,"yearAfterArrows":1500,"yearAfterTabArrow":1500,"camops":[],"readerHiddenAfter":false,"activeOnHeading":{"tag":"H2","id":null,"cls":"","text":"卡布拉尔船队抵… |
| `kb.reader-escape-closes` | 通过 | {"hidden":true,"active":"BODY"} |
| `kb.tab-focus-works` | 通过 | ["skip-link","brand","active","BUTTON","BUTTON","BUTTON","BUTTON","browseBtn","compareBtn","language","helpBtn","search","region","category","nearBtn","allBtn","window","event-card ","event-card ","event-card ","event-card ","even… |
| `kb.skip-link-first` | 通过 | {"tag":"A","id":null,"cls":"skip-link","text":"跳到年份 · Jump to year","rect":[205,48],"visible":true} |
| `kb.skip-link-activates` | 通过 | {"active":{"tag":"INPUT","id":"yearInput","cls":"","text":"","rect":[93,31],"visible":true},"atlasHidden":false,"hash":"#year=1500&lang=bi&span=50&step=10&projection=globe&camera=25%2C18%2C1.65%2C0%2C0"} |
| `kb.tab-stops-visible` | 通过 | {"stops":["skip-link","brand","active","BUTTON","BUTTON","BUTTON","BUTTON","browseBtn","compareBtn","language","helpBtn","search","region","category","nearBtn","allBtn","window","event-card ","event-card ","event-card ","event-car… |
| `kb.inert-sidebar-not-tabbable` | 通过 | {"sidebarIds":["search","region","category","nearBtn","allBtn","window"],"firstStops":["skip-link","brand","active","BUTTON","BUTTON","BUTTON","BUTTON","browseBtn","compareBtn","language","helpBtn","maplibregl-canvas"],"reached":[… |
| `kb.no-hidden-layer-stops` | 通过 | {"stops":["skip-link","brand","active","BUTTON","BUTTON","BUTTON","BUTTON","browseBtn","compareBtn","language","helpBtn","search","region","category","nearBtn","allBtn","window","event-card ","event-card ","event-card ","event-car… |
| `kb.ime-composition-gated` | 通过 | {"attempted":true,"focus":{"ok":true,"id":"search","cls":""},"compositionActive":true,"compositionStarted":true,"before":{"year":1500,"value":"zhong","activeElement":"search"},"afterArrow":{"year":1500,"value":"zhong","key":{"t":3… |
| `kb.ime-synthetic-guard` | 通过 | {"base":1500,"composingEvent":{"defaultPrevented":false,"isComposing":true},"controlEvent":{"defaultPrevented":true,"isComposing":false},"composingYear":1500,"controlYear":1510,"controlSettled":true} |
| `kb.ime-polity-search` | 通过 | {"attempted":true,"before":1510,"after":1510,"key":{"t":11501.6,"key":"ArrowRight","alt":false,"shift":false,"composing":true,"repeat":false,"target":"politySearch"}} |

发现：
- Tab order: #yearInput is tab stop 106 of 125 visible focusable elements at #year=1500. The sidebar event cards (40) and the map event markers (40) dominate the order, so keyboard users must use the skip link to reach the year field.
- The tab walk looked for #yearInput within 140 presses; walkTail records the stops seen last.

本环境测不到 / 不适用：
- Headless Chrome has no operating-system input method: real candidate windows and OS-level composition cannot be reproduced. The IME contract is tested through (a) CDP Input.imeSetComposition followed by a trusted key event, and (b) a synthetic KeyboardEvent carrying isComposing=true/false.
- renderer document.hasFocus() is false in headless by default; Emulation.setFocusEmulationEnabled was requested and the observed value is recorded in report.tabOrder.focusEmulationObserved.
- Key events are dispatched through CDP Input.dispatchKeyEvent (trusted); the isComposing tests use untrusted synthetic events and are labelled as such.
- Touch keyboards / mobile virtual keyboards are not covered here; see mobile-check.mjs.
- Sections run in separate browser sessions with one retry; a failed session is recorded in report.sessions[].error and its assertions are missing rather than silently passing.
- The reader section dispatches synthetic KeyboardEvents instead of trusted CDP ones because headless Chrome 154 on macOS repeatedly aborted the browser process (SIGABRT, Cocoa assertion "(self)->_enumeratingSubviewsCount < ((1 << 6) - 1)" inside -[NSView performKeyEquivalent:]) when trusted key events were dispatched with the reader open; the crash reports are in ~/Library/Logs/DiagnosticReports (2026-10-03 02:50 and 02:54). This is a browser-build defect, not app code: the reader handler returns before doing any work for those keys.

## 4. 手机两档（390×844、360×740：溢出、画布、图层面板、阅读器、触摸、safe-area）

报告：docs/verification-3.10/mobile-check.json；生成于 2026-10-02T20:22:08.740Z；命令 `node scripts/verification/mobile-check.mjs`。

| 断言 | 结果 | 实测 |
|---|---|---|
| `mobile.iphone-14-390x844.no-horizontal-overflow` | 通过 | {"scrollWidth":390,"innerWidth":390,"offenders":{"count":0,"excludedHiddenSubtrees":238,"inHorizontalScroller":7,"sample":[]}} |
| `mobile.iphone-14-390x844.canvas-fits` | 通过 | {"canvasRect":[390,571],"canvasAttr":[1170,1713],"dpr":3,"mapBox":[390,571],"innerWidth":390} |
| `mobile.iphone-14-390x844.layer-panel-touch` | 通过 | {"beforeHidden":true,"openedHidden":false,"openedInViewport":true,"openedRect":[9,80,372,559],"closedHidden":true} |
| `mobile.iphone-14-390x844.layer-panel-no-overflow` | 通过 | {"scrollWidth":390,"innerWidth":390,"offenders":{"count":0,"excludedHiddenSubtrees":238,"inHorizontalScroller":7,"sample":[]}} |
| `mobile.iphone-14-390x844.touch-drag-pans` | 通过 | {"before":{"center":[25,18],"layout":{"innerWidth":390,"innerHeight":844,"dpr":3,"scrollWidth":390,"bodyScrollWidth":390,"scrollY":0,"visualScale":1,"viewportMeta":"width=device-width,initial-scale=1,viewport-fit=cover"}},"after":… |
| `mobile.iphone-14-390x844.timeline-tap` | 通过 | {"before":1500,"after":1510,"step":10,"settled":true,"nextYearVisible":true,"nextYearInViewport":true,"note":"a URL without a step parameter defaults the step selector to 1 year"} |
| `mobile.iphone-14-390x844.marker-tap-opens-reader` | 通过 | {"marker":{"cx":284,"cy":309,"count":38},"opened":{"hidden":false,"title":"马六甲陷落与葡萄牙海上据点The fall of Melaka and the Portuguese maritime base"}} |
| `mobile.iphone-14-390x844.reader-readable` | 通过 | {"panel":[0,65,390,728],"panelHidden":false,"panelWidth":390,"fontSize":"16px","paragraphFontSize":"18px","paragraphLineHeight":"34.2px","scrollWidth":390,"innerWidth":390,"offenders":0} |
| `mobile.iphone-14-390x844.reader-close-touch` | 通过 | true |
| `mobile.iphone-14-390x844.safe-area` | 通过 | {"supportsEnv":true,"paddingBefore":"4px","paddingAfter":"38px","timelineBottom":793,"innerHeight":844,"insetBottom":34,"timelineBottomVsInset":-17,"viewportMeta":"width=device-width,initial-scale=1,viewport-fit=cover"} |
| `mobile.android-360x740.no-horizontal-overflow` | 通过 | {"scrollWidth":360,"innerWidth":360,"offenders":{"count":0,"excludedHiddenSubtrees":248,"inHorizontalScroller":8,"sample":[]}} |
| `mobile.android-360x740.canvas-fits` | 通过 | {"canvasRect":[360,467],"canvasAttr":[1080,1401],"dpr":3,"mapBox":[360,467],"innerWidth":360} |
| `mobile.android-360x740.layer-panel-touch` | 通过 | {"beforeHidden":true,"openedHidden":false,"openedInViewport":true,"openedRect":[9,80,342,455],"closedHidden":true} |
| `mobile.android-360x740.layer-panel-no-overflow` | 通过 | {"scrollWidth":360,"innerWidth":360,"offenders":{"count":0,"excludedHiddenSubtrees":248,"inHorizontalScroller":8,"sample":[]}} |
| `mobile.android-360x740.touch-drag-pans` | 通过 | {"before":{"center":[25,18],"layout":{"innerWidth":360,"innerHeight":740,"dpr":3,"scrollWidth":360,"bodyScrollWidth":360,"scrollY":0,"visualScale":1,"viewportMeta":"width=device-width,initial-scale=1,viewport-fit=cover"}},"after":… |
| `mobile.android-360x740.timeline-tap` | 通过 | {"before":1500,"after":1510,"step":10,"settled":true,"nextYearVisible":true,"nextYearInViewport":true,"note":"a URL without a step parameter defaults the step selector to 1 year"} |
| `mobile.android-360x740.marker-tap-opens-reader` | 通过 | {"marker":{"cx":262,"cy":264,"count":38},"opened":{"hidden":false,"title":"马六甲陷落与葡萄牙海上据点The fall of Melaka and the Portuguese maritime base"}} |
| `mobile.android-360x740.reader-readable` | 通过 | {"panel":[0,65,360,624],"panelHidden":false,"panelWidth":360,"fontSize":"16px","paragraphFontSize":"18px","paragraphLineHeight":"34.2px","scrollWidth":360,"innerWidth":360,"offenders":0} |
| `mobile.android-360x740.reader-close-touch` | 通过 | true |
| `mobile.android-360x740.safe-area` | 通过 | {"supportsEnv":true,"paddingBefore":"4px","paddingAfter":"38px","timelineBottom":689,"innerHeight":740,"insetBottom":34,"timelineBottomVsInset":-17,"viewportMeta":"width=device-width,initial-scale=1,viewport-fit=cover"} |

发现：
- safe-area (measured, not hard-coded): viewport meta = "width=device-width,initial-scale=1,viewport-fit=cover"; #timeline padding-bottom 4px with no inset -> 38px with a 34 px emulated bottom inset; timeline bottom 793 vs inset edge 810.
- Timeline step: on a fresh mobile URL without a step parameter the selector reads 10 and tapping #nextYear moved 1500 -> 1510.

说明：
- Viewport meta measured in the page: "width=device-width,initial-scale=1,viewport-fit=cover".

本环境测不到 / 不适用：
- No physical device: Chrome device emulation reproduces viewport, DPR and touch events, not iOS Safari behaviour (rubber-band scrolling, dynamic toolbar, real safe-area insets).
- Pinch-zoom, double-tap zoom and virtual-keyboard resizing were not measured.

## 5. 弱网 / 404 / 断网与恢复

报告：docs/verification-3.10/network-resilience.json；生成于 2026-10-02T20:09:46.425Z；命令 `node scripts/verification/offline-weaknet.mjs`。

实测结论：
- Baseline first load: ready in 4491 ms, 63 requests, 5546 KiB encoded.
- Throttled wifi-4mbps (4096 kbps, 100 ms): ready after 10587 ms; failed requests 0; recovery ready in 5056 ms.
- Throttled slow-4g-1.6mbps (1638 kbps, 300 ms): ready after 18530 ms; failed requests 0; recovery ready in 5875 ms.
- Throttled slow-3g-400kbps (400 kbps, 400 ms): ready after 67837 ms; failed requests 0; recovery ready in 6819 ms.
- Simulated 404 on data/fast/overview-NNN.json.gz (year 1450) (intercepted 14 of 72 paused requests): interception hits 14, error surface after 5523 ms (404,404,404,404,404,404,404), retry re-requested the file (7 -> 14 requests), recovery ready in 2759 ms.
- Offline year switch: error surface after 12659 ms with 5 failed requests (sample error: net::ERR_INTERNET_DISCONNECTED); recovery after going online in 360 ms.

| 断言 | 结果 | 实测 |
|---|---|---|
| `net.baseline-ready` | 通过 | {"outcome":"ready","ms":4491,"errorBox":{"present":true,"hidden":true,"text":"","hasRetryButton":false},"year":1500} |
| `net.throttled-outcomes-recorded` | 通过 | [{"profile":"wifi-4mbps","outcome":"ready","ms":10587,"error":"","failures":0},{"profile":"slow-4g-1.6mbps","outcome":"ready","ms":18530,"error":"","failures":0},{"profile":"slow-3g-400kbps","outcome":"ready","ms":67837,"error":""… |
| `net.throttled-recovers` | 通过 | [{"profile":"wifi-4mbps","recovery":"ready","ms":5056},{"profile":"slow-4g-1.6mbps","recovery":"ready","ms":5875},{"profile":"slow-3g-400kbps","recovery":"ready","ms":6819}] |
| `net.404-surface` | 通过 | {"outcome":"error-ui","errorBox":{"present":true,"hidden":false,"text":"未能载入 公元 1450 年，已保留当前地图。重试","hasRetryButton":true},"statuses":[404,404,404,404,404,404,404],"requested":7,"pausedTotal":72,"pausedSample":["/","/assets/maplibr… |
| `net.404-no-bad-cache` | 通过 | {"before":7,"after":14,"stillError":true} |
| `net.404-recovers` | 通过 | {"outcome":"ready","year":1450,"datasetStatus":"133 个当年政体 · 392 条事件","errorBox":{"present":true,"hidden":true,"text":"未能载入 公元 1450 年，已保留当前地图。重试","hasRetryButton":true}} |
| `net.404-no-stale-state` | 通过 | {"to1500":true,"backTo1450":true,"finalYear":1450,"finalErrorBox":{"present":true,"hidden":true,"text":"未能载入 公元 1450 年，已保留当前地图。重试","hasRetryButton":true}} |
| `net.offline-keeps-map` | 通过 | {"outcome":"error-ui","year":1500,"onLine":false,"errorBox":{"present":true,"hidden":false,"text":"未能载入 公元 1600 年，已保留当前地图。重试","hasRetryButton":true},"failures":["net::ERR_INTERNET_DISCONNECTED","net::ERR_INTERNET_DISCONNECTED","ne… |
| `net.offline-retry-honest` | 通过 | {"errorBox":{"present":true,"hidden":false,"text":"未能载入 公元 1600 年，已保留当前地图。重试","hasRetryButton":true},"year":1500} |
| `net.online-recovers` | 通过 | {"outcome":"ready","year":1600,"ms":367,"errorBox":{"present":true,"hidden":true,"text":"未能载入 公元 1600 年，已保留当前地图。重试","hasRetryButton":true}} |

本环境测不到 / 不适用：
- Throttling uses Network.emulateNetworkConditions (latency + throughput); it does not reproduce packet loss, DNS failures or flaky connections.
- Offline cold start (reload while offline) is not meaningful with the driver cache disabled and no service worker: the app ships no offline shell.
- CDP Fetch interception answers the 404 locally; only the status code is simulated.
- There is no automatic retry/backoff to assert: the app exposes manual retry only.
- Chrome serves repeated loads of the same document from its in-memory resource cache, which request interception cannot see. The 404 scenario therefore uses a fresh browser session (measured: a reused renderer paused 0 requests, a fresh one 59).

## 6. 独立复核：边界呈现、OHM 1500 与可发布性证据

报告：docs/verification-3.10/verify-boundary-review.json；生成于 2026-10-02T20:16:56.021Z；命令 `node scripts/verification/independent-review.mjs`。

实测结论：
- Frozen OHM 1500: 98 features, 7 declared gaps, licence notice CC0 = true
- Alps window (7-11.6E, 45.4-48.4N) holds 27 frozen OHM features (imperial circles), while the six named 1500 polities are absent - so "the detail view is blank there" is only true for those named polities, not for the layer as a whole.
- Rendered OHM polygons at Bern = 0; Low Countries positive control = 1; badge = "局部详图 · 61 条 · 空白处未收录"
- Layer stack: relief index 2 < territories 4; boundary-halo 5 < boundary 16.
- Territory fill opacity expression: undefined (the fidelity doc says "0.53 to 0.30"; source constant territoryOpacity is 0.5/0.42/0.3/0.2 and regional mode sets 0.53/0.4/0.2).
- 1503 native steady state (second load in the same renderer, so subresources come from the in-memory cache; the doc figure of ~12 s refers to a cold load): reported after 1969 ms with 133 native geometry requests out of 212 total (doc claims 208 responses / ~12 s).

| 断言 | 结果 | 实测 |
|---|---|---|
| `review.ohm-file-shipped` | 通过 | {"features":98,"source":"OpenHistoricalMap","timestamp":"2026-10-02T19:22:25Z"} |
| `review.ohm-licence-documented` | 通过 | {"mentionsCC0":true,"mentionsOverpass":true} |
| `review.ohm-named-polities-absent` | 通过 | {"matches":[]} |
| `review.ohm-gaps-declared` | 通过 | {"gapCount":7,"gaps":["Holy Roman Empire","Old Swiss Confederacy","Bavaria (duchy or electorate)","Württemberg","Margraviate of Baden","Habsburg Austria","County of Tyrol"],"docClaimsSixNamedPolities":["Old Swiss Confederacy","Duc… |
| `review.ohm-alps-not-empty` | 通过 | {"alpsFeatures":27,"names":["Republica de Venezia","Bayerischer Reichskreis","Sabaudia","Oberrheinischer Reichskreis","Schwäbischer Reichskreis","Ducatus Mediolani","Duché de Lorraine","Freie Reichsstadt Bern"]} |
| `review.ohm-geometry-finite` | 通过 | {"nonFinite":0} |
| `review.attributions-present` | 通过 | {"cliopatria":true,"naturalEarth":true,"cshapes":true,"ohm":true,"wikidata":true,"pleiades":true} |
| `review.noncommercial-flagged` | 通过 | {"nonCommercialLicenceFlagged":true,"dataLicenceMentionsNC":false} |
| `review.ohm-manifest-licence` | 通过 | {"schema":"meridian-ohm-frozen/1","source":"OpenHistoricalMap","endpoint":"https://overpass-api.openhistoricalmap.org/api/interpreter","license":"CC0 1.0 (OpenHistoricalMap data)","attribution":"https://www.openhistoricalmap.org/c… |
| `review.relief-under-territories` | 通过 | {"reliefIndex":2,"territoriesIndex":4,"order":["ocean","land","relief","terrain-shade","territories","boundary-halo","physical-lakes","physical-rivers","lake-detail","regional-wash","regional-edges","regional-selected"]} |
| `review.boundary-halo-present` | 通过 | {"haloIndex":5,"boundaryIndex":16,"haloPaint":{"_properties":{"properties":{"line-opacity":{"specification":{"type":"number","default":1,"minimum":0,"maximum":1,"transition":true,"expression":{"interpolated":true,"parameters":["zo… |
| `review.territory-opacity-calibrated` | 通过 | {"overviewExpression":["interpolate",["linear"],["zoom"],0,0.5,4,0.42,7,0.3,10,0.2],"numericStops":[0.5,0.42,0.3,0.2],"regionalModeValue":0,"docSays":"0.53 to 0.30"} |
| `review.ohm-frozen-served-to-page` | 通过 | {"requests":["year-1500.json.gz"],"layers":["ohm-frozen-wash","ohm-frozen-edges","ohm-frozen-partial","ohm-frozen-selected"],"ohmLayerReadyMs":4790} |
| `review.ohm-positive-control` | 通过 | {"atLowCountries":1,"renderedInViewport":89,"sourceFeatures":257} |
| `review.ohm-alps-coverage-measured` | 通过 | {"atBern":0,"renderedInViewport":89,"sourceFeatures":257,"badge":"局部详图 · 61 条 · 空白处未收录","regionalStatus":"局部详图 · 空白处未收录"} |
| `review.gap-notice-visible` | 通过 | {"found":true,"visible":true,"summary":"7 个当年政体在该来源中未收录","items":["神圣罗马帝国","旧瑞士联邦","巴伐利亚（公国/选侯国）","符腾堡","巴登藩侯国","哈布斯堡奥地利","蒂罗尔"],"popupText":"边界与历史区划自动全球疆域地区详图近现代国家低地国家 · 1500OHM 固化详图（1500 年 · 98 条 · 陆地采样覆盖 53%）与在线瓦片合并显示；两来源都没有记录的… |
| `review.borders-toggle-syncs-halo` | 通过 | {"panelOpen":true,"off":{"territories":"none","boundary":"none","halo":"none"},"on":{"territories":"visible","boundary":"visible","halo":"visible"}} |
| `review.native-1503-steady-state` | 通过 | {"ms":1969,"boundaryStatus":"原始疆域已载入","nativeRequests":133,"totalRequests":212} |

说明：
- Measured at the camera of the user screenshot: camera=9.32,48.08,6.72,0,0.

本环境测不到 / 不适用：
- The project validators (npm test) are not re-run here: several of them rewrite audit JSON under docs/, which the Lead owns. Data-level and browser-level claims are re-derived independently instead.
- queryRenderedFeatures counts depend on the current viewport and zoom; they are reported with the camera and zoom so they can be reproduced.
- OHM admin-level semantics (imperial circles vs duchies) are read from the source properties, not from a gazetteer.

## 截图证据

目录 docs/verification-3.10/shots/（本次脚本产生的 21 个）：

- [keyboard-reader-focus.png](shots/keyboard-reader-focus.png)
- [keyboard-skiplink-target.png](shots/keyboard-skiplink-target.png)
- [mobile-android-360x740-atlas.png](shots/mobile-android-360x740-atlas.png)
- [mobile-android-360x740-layers.png](shots/mobile-android-360x740-layers.png)
- [mobile-android-360x740-reader.png](shots/mobile-android-360x740-reader.png)
- [mobile-iphone-14-390x844-atlas.png](shots/mobile-iphone-14-390x844-atlas.png)
- [mobile-iphone-14-390x844-layers.png](shots/mobile-iphone-14-390x844-layers.png)
- [mobile-iphone-14-390x844-reader.png](shots/mobile-iphone-14-390x844-reader.png)
- [network-404-error.png](shots/network-404-error.png)
- [network-offline-error.png](shots/network-offline-error.png)
- [network-recovered.png](shots/network-recovered.png)
- [network-slow-3g-400kbps.png](shots/network-slow-3g-400kbps.png)
- [network-slow-4g-1.6mbps.png](shots/network-slow-4g-1.6mbps.png)
- [network-wifi-4mbps.png](shots/network-wifi-4mbps.png)
- [perf-after-drag.png](shots/perf-after-drag.png)
- [perf-compare-open.png](shots/perf-compare-open.png)
- [perf-desktop-1500.png](shots/perf-desktop-1500.png)
- [perf-layer-retry.png](shots/perf-layer-retry.png)
- [perf-year-1510.png](shots/perf-year-1510.png)
- [review-native-1503.png](shots/review-native-1503.png)
- [review-ohm-1500-alps.png](shots/review-ohm-1500-alps.png)

## 需要 Lead 决策的问题

- （keyboard-focus.json）Tab order: #yearInput is tab stop 106 of 125 visible focusable elements at #year=1500. The sidebar event cards (40) and the map event markers (40) dominate the order, so keyboard users must use the skip link to reach the year field.
- （keyboard-focus.json）The tab walk looked for #yearInput within 140 presses; walkTail records the stops seen last.
- （mobile-check.json）safe-area (measured, not hard-coded): viewport meta = "width=device-width,initial-scale=1,viewport-fit=cover"; #timeline padding-bottom 4px with no inset -> 38px with a 34 px emulated bottom inset; timeline bottom 793 vs inset edge 810.
- （mobile-check.json）Timeline step: on a fresh mobile URL without a step parameter the selector reads 10 and tapping #nextYear moved 1500 -> 1510.
- （perf-baseline.json）瓶颈：heaviest single resource — "assets/maplibre-gl.js?v=3.10.0-6af5167ed72f" = {"encodedBytes":937395,"ms":4}
- （perf-baseline.json）瓶颈：year step latency — "key -> idle median / p95" = [272.1,333.4]
- （perf-baseline.json）瓶颈：year step outliers — "> 1000 ms, correlated with long tasks" = []
- （perf-baseline.json）瓶颈：CDP mouse dispatch cost — "per drag move under this host load (not app latency)" = 1210.2
- （perf-baseline.json）瓶颈：longest main-thread task — "during year sequence" = 5196
- （perf-baseline.json）瓶颈：js heap growth — "20 year steps" = 263.3
- （perf-baseline.json）瓶颈：js heap after first load — "run 1" = 188.7
- （perf-baseline.json）瓶颈：two-map heap cost — "compare open" = 185

