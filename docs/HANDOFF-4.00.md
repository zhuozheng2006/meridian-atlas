# 经纬纪 · Meridian Atlas 4.00.0 阶段交付与验证记录

## 本轮核心成果（v4.00.0）

### 1. 深色区划浮窗与目录滚动条视觉统一（[cartography.css](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/cartography.css#L219-L225)）
- 修复深色历史弹窗（HALC 1500、CShapes、地方详图浮窗）与历史详情列表中出现的原生浅色宽滚动条与横向溢出风险：
  - 为 `.historical-popup .maplibregl-popup-content`、`.historical-record-list`、`.country-periods` 与 `.layer-options` 统一设置 `scrollbar-width: thin; scrollbar-color: #3a4f62 transparent` 及 5px 暗青黄铜圆角 `::-webkit-scrollbar` 滑块（悬停态 `#dcc08977`），并为弹窗容器启用 `overflow-x: hidden`。
  - 在 Chrome 无头实测（`#year=1500&boundaries=halc&camera=4.8,52.0,7.5,0,0` 点击区域标签开启浮窗）确认计算样式 `scrollbarWidth: "thin"`、`overflowX: "hidden"`，截图检查完全融入曜黑与香槟金主题。

### 2. 历史身份核查台账千位数字格式化（[identity-ledger.js](file:///Users/zane/Documents/ChatGPT/MeridianAtlas/public/identity-ledger.js#L10)）
- 将台账计数文案中的总条数与当前展示上限从裸数字改用 `toLocaleString()` 格式化（例如：`共 13,765 条，显示前 20 条` / `Showing 20 of 13,765 records`），与下方统计卡千位计数格式保持一致。
- Chrome 实测 `#year=1492&view=sources` 打开台账后直接观察到 `[data-quality-count]` 输出 `"共 13,765 条，显示前 20 条"`。

---

## 全量自动化验证证据（v4.00.0）

- `export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" && npm run prepare:assets && npm test && npm run test:http && npm run build` 全部通过（exit code `0`）：
  - 内容指纹：`PASS 270 native (12 bootstrap) and 117 detail content fingerprints`
  - 身份台账：`records: 13765`, `polities: 13380`
  - 视图状态与深链：`69/69 view-state checks passed`
  - 边界与网格：`24/24 HALC selection checks`, `13/13 HALC real-style reload checks`, `18/18 HALC render readiness checks`, `29/29 HALC lifecycle checks`, `15/15 HALC cache checks`, `30/30 HALC two-source checks`, `24/24 HALC continuity checks`, `26/26 regional continuity checks`, `10/10 OHM asynchronous request checks`, `16/16 regional boundaries checks`
  - 湖泊与地名：`18/18 lake checks passed`, `16/16 places checks`, `17/17 polity display names checks`, `15/15 battles checks`
  - 启动重叠与目录索引：`20/20 startup overlap checks passed`, `26/26 map catalog app checks passed`（5,424 年 / 254,592 条年度政权对、709 事件索引、1,592 政权检索组、64 个链分片）
  - 本地 HTTP 压缩服务：`14/14 local HTTP checks passed`
  - Worker 构建：`dist/server/index.js`、`dist/client` 构建成功（`staticRevision: e3c72442369b6cbea74ff3fc9e37a7b9104cd56aac86c4d7efe337cb970516bf`、`revision: 9c6c5ea6ce8ae32936efbe41`）

---

## Chrome 无头独立进程实测基准（`docs/verification-4.00/final-benchmarks.json`）

| 场景 | 视口 | 无节流可交互 (ms) | 1.5 Mbps / 150 ms RTT 可交互 (ms) | 1.5 Mbps 传输量 | 控制台错误 / 重叠 |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `desktop_1492` | 1440×900 | `322` | `4059` | `649,929 B` | `0 / 0` |
| `south_asia_m250` | 1440×900 | `225` | `3810` | `649,157 B` | `0 / 0` |
| `china_742_regional` | 1440×900 | `261` | `5614` | `850,856 B` | `0 / 0` |
| `europe_1914_cshapes` | 1440×900 | `513` | `6146` | `986,025 B` | `0 / 0` |
| `mobile_390_1492` | 390×844 | `319` | `4023` | `649,929 B` | `0 / 0` |

- 多视口布局校验（`laptop_1280_compare` 1280×720、`tablet_834_1492` 834×1194、`tablet_834_compare` 834×1194、`mobile_390_compare` 390×844）：零元素重叠、零标签碰撞、零水平滚动溢出，控制台错误数 `0`。
- 域级实测（`liveDomainChecks`）：
  - `halc_popup_dark_scrollbar`：`open: true`, `scrollbarWidth: "thin"`, `overflowX: "hidden"`
  - `identity_ledger_comma_count`：`countText: "共 13,765 条，显示前 20 条"`
  - `research_zero_map_assets_and_parchment`：`maplibreCssLoaded: false`, `maplibreJsLoaded: false`, `originalBodyBg: "rgb(255, 252, 244)"`, `originalTextLen: 61216`

---

## 下一步优化方向

1. **排查 `1914`（CShapes 时代）冷启动加载路径**：实测发现 `#year=1914` 首屏触发了 `fullCatalogRequested: true` 与 `country-archive.js` 下载（导致 1.5 Mbps 下传输增至 `986,025 B`、耗时 `6146 ms`），进一步收敛现代年份首屏包依赖可显著拉齐首帧速度。
2. **持续深挖界面细节与交互延迟**：评测 `year` 快速滑动切换帧延迟、CHGIS 1900/1820 高缩放级别、AWMC 古代地中海详情弹窗以及边缘悬停提示防溢出，并核实剩余 1 个天然湖泊（`1427 Dogen`）。
