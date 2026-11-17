# 经纬纪 3.64.0：界面系统重设计、汉唐字书与四志互证（369/420）及启动指纹表拆分

## 本轮成果总览

1. **视觉与交互界面全面重设计（Studio Obsidian & Brass Refresh）**
   - **图层控制面板（[`cartography.css`](../public/cartography.css)）**：将原有生硬单选圆点方框替换为滑动胶囊拨片开关（`::before` 轨道 + `::after` 滑块），嵌套状态说明加入左侧细金垂线视觉归属并自动隐藏空状态行；重构下属下拉框、人口年代窗口卡片与金色渐变主确认按钮 `#layerClose`，桌面/移动端（单列规整排布）全无元素遮挡。
   - **文明（Polities）、专题（Journeys）、年表（Chronicle）与详图档案（[`app.js`](../public/app.js)、[`product.css`](../public/product.css)）**：
     - **文明页**：按时代赋色与分类徽标（公元前 / 古典时代 / 中古时代 / 近世 / 近现代）、“精选 Featured”标识及底对齐卡片脚注；
     - **专题页**：十二条世界史路线配主题色左饰条、顶部序号徽章对齐及底部“节点数 + 开始探索 →”引导栏；
     - **年表页**：新增 `#libRegion`（全球地区）与 `#libCategory`（八类主题）实时联动筛选下拉框，采用圆角黑曜石表头容器、主题色点标签及胶囊化外部文献入口；
     - **资料页与档案面板**：将 [`source-reader.js`](../public/source-reader.js) 中滞后的 `150条名称已核查` 同步更新为实证已核 **369 条**，去掉南亚研究图版外层笨重线框；详情页 `.fact` 卡片添加左侧金色饰线与等宽数字排版，地区详图弹窗 `.historical-popup` 收紧间距避免底部下载按钮被折断。

2. **西汉全量通关与唐天宝三书互证（`369 / 420` · 未核查数 0）**
   - 本地归档并记录 `SHA-256` 与永久 `wgRevisionId` 的 Wikisource `《汉书·卷二十八》`、`《通典》` 州郡卷 173–183、`《旧唐书》` 卷 40–41 及 `《康熙字典》` 音义条目（见 [`docs/verification-3.64/sources/manifest.json`](verification-3.64/sources/manifest.json) 与 [`docs/verification-3.64/han-tang-name-evidence.json`](verification-3.64/han-tang-name-evidence.json)）：
     - **西汉 8 项全部完成核准（103 / 103）**：依据字书切音与正史原写解决 `牂柯郡`、`会稽郡`（Kuaiji Jun）、`越嶲郡`、`丹扬郡`、`甾川国`、`千乘郡`（Qiansheng Jun，依《广韵》实证切验证读 shèng）、`勃海郡` 与 `琅邪郡`（Langya Jun）。
     - **唐代新增 19 项天宝元年名称与音读互证（266 / 317）**：借助《新唐书》精确口数与《旧唐书》《通典》三书对读，解决此前因《旧唐书》讹衍/异名或声韵异读而暂缓的 `溱溪郡`（Zhenxi Jun）、`武陵郡`（朗州 43,760）、`涪陵郡`（涪州 44,722）、`澧阳郡`（澧州 93,349）、`巴川郡`（合州 77,220）、`会稽郡`（越州）、`云山郡`（奉州/保州 4,536）、`同昌郡`（扶州 14,285）、`上洛郡`（商州 53,080）、`弘农郡`（虢州 88,845）、`冯翊郡`（同州 Pingyi Jun 408,705，与 2-45 左冯翊口径统一）、`琅邪郡`（沂州 195,737）、`乐安郡`（棣州 238,159）、`河间郡`（瀛州 `Yin Zhou` 别名保留 663,171）、`北平郡`（平州 `Bing Zhou` 25,086）、`钟离郡`（濠州 138,361）、`广平郡`（洺州 `Min Zhou` 683,280）、`北庭都护府`（庭州 9,964）与 `武都郡`（武州/晚唐阶州 15,313）。
     - 累计核准：**369 / 420**（**汉 103 / 唐 266**）；其余 **51 / 420** 项均因人口推算（户×5）、学者估算（Gong 2019 / 邻区面积推算）、双志口数不符（59/78/90/117/145/164 等）或非 742 年更名（746/754）严格维持存疑待考，[`docs/verification-3.64/early-asia.json`](verification-3.64/early-asia.json) 校验全部通过。

3. **内容指纹启动表拆分与冷启动提速**
   - 修改 [`scripts/build-native-content-hashes.mjs`](../scripts/build-native-content-hashes.mjs)，在完整保留 `public/native-content-hashes.js`（41,844 B，270 原生 + 117 详图指纹）供按需调用与兼容性校验的同时，单独输出仅含 12 个启动年指纹的轻量模块 [`public/bootstrap-content-hashes.js`](../public/bootstrap-content-hashes.js)（**1,553 B**，缩减 **96.3%**）。
   - [`map-engine.js`](../public/map-engine.js) 首屏仅静态导入 `bootstrap-content-hashes.js`，通过 `syncHistoricalRequest` 保持启动帧与点要素零微任务延迟，仅在读取非启动年份分包或地区详图数据时才异步按需导入 `native-content-hashes.js`，新增 [`scripts/validate-bootstrap-hashes.mjs`](../scripts/validate-bootstrap-hashes.mjs) 纳入 `npm test` 回归验证。

## v3.64.0 实测与基准

全部测量由独立无头 Chromium 进程（禁用缓存、完整测试与 worker 构建后）执行（原始记录见 [`docs/verification-3.64/final-benchmarks.json`](verification-3.64/final-benchmarks.json)）：

| 场景 | 直连冷启动 (`map-interactive`) | 1.5 Mbps / 150ms 限速 | 首屏请求 `native-content-hashes.js` / 全目录 | 重叠 / 控制台报错 |
| --- | --- | --- | --- | --- |
| `desktop_1492` (`1440×900`) | **325 ms** (较 3.63 `-119 ms`) | **4,076 ms** (`715,306 B`，较 3.63 `-139 ms`) | `false` / `0` 次 | 0 / 0 |
| `south_asia_m250` (`-250`, 1440) | **236 ms** (较 3.63 `-71 ms`) | **3,979 ms** (`714,632 B`，较 3.63 `-84 ms`) | 按需读取 / `0` 次 | 0 / 0 |
| `china_742_regional` (`742`, Zoom 6.6) | **287 ms** (较 3.63 `-110 ms`) | **5,732 ms** (`886,718 B`) | 按需读取 / `0` 次 | 0 / 0 |
| `europe_1914_cshapes` (`1914`, 1440) | **519 ms** (较 3.63 `-211 ms`) | **6,400 ms** (`1,047,270 B`，较 3.63 `-293 ms`) | `false` / `0` 次 | 0 / 0 |
| `mobile_390_1492` (`390×844`) | **362 ms** (较 3.63 `-101 ms`) | **4,081 ms** (`715,306 B`，较 3.63 `-131 ms`) | `false` / `0` 次 | 0 / 0 |

多视口双图对照防重叠检测（`1280×720`、`834×1194`、`390×844`）与重设计后的 `Polities`、`Journeys`、`Chronicle`、`Sources`（桌面及移动端 `390×844`）均录得 **0 重叠、0 横向溢出、0 控制台错误**。
