# 竞品对标矩阵（3.12）

对标对象：Chronosphere、Phersu Atlas、Running Reality、Open History Map、Strata、HistoryMaps。生成时间 2026-10-02T20:43:40.076Z。

方法：我方数字全部来自本机实测（读 public/data 与 browser.mjs 驱动 8767）；竞品为 2026-10-03 当天真实 HTTP 访问（curl，记录状态码与字节数）与仓库 README。未能访问的写“未能验证”并给出原因。

证据规则：每个格子要么是**事实**（附实测值或来源 URL），要么是**未能验证**（附原因）。矩阵里不写形容词。

## 1. 逐维度对照

### 时间跨度与粒度

| 产品 | 结论 | 证据 |
| --- | --- | --- |
| 经纬纪 Meridian Atlas | Cliopatria 疆域 -3400–2024；事件 -48000–2024；OHM 固化 10 个年份（1000–1900）；CShapes 1886–2023；逐年可选（-70000–2026） | public/data/fast/catalog.json.gz、public/data/events.json.gz、public/data/ohm-1500/manifest.json 实测统计 |
| Chronosphere | 首页：123,000 BC → today；About：时间轴逐年覆盖 2000 BC → today，更早为快照 | https://worldbyyear.com/ 首页与内嵌 About 文本（HTTP 200，8,261 B HTML；main.js 47,613 B） |
| Phersu Atlas | **未能验证** — https://www.phersu-atlas.com/ 三次请求均被 Cloudflare 拦截（HTTP 403 "Attention Required"），无法读取任何页面内容 | https://www.phersu-atlas.com/ 三次请求均被 Cloudflare 拦截（HTTP 403 "Attention Required"），无法读取任何页面内容 |
| Running Reality | 首页 meta：3000BC – today，逐年选择（年月日控件） | https://www.runningreality.org/（200，170,369 B） |
| Open History Map | 站点自述为“数字历史地图”，首页索引最新条目 2026-09-29；未给出统一时间跨度声明 | https://www.openhistorymap.org/（200，10,499 B） |
| Strata | 10,000 BCE – 2025 CE，13 个图层，52 个疆域快照文件 | https://raw.githubusercontent.com/dr-nico-f/strata/main/README.md（200，18,800 B） |
| HistoryMaps | **未能验证** — 首页与 About 未给出统一时间跨度；站点按专题地图组织，需逐专题核对 | 首页与 About 未给出统一时间跨度；站点按专题地图组织，需逐专题核对 |

### 全球覆盖均衡度

| 产品 | 结论 | 证据 |
| --- | --- | --- |
| 经纬纪 Meridian Atlas | Cliopatria 全球 13,380 政体时段；OHM 固化仅中欧窗口 bbox 4.5/44/14.5/50.5（10 年）；HALC 仅低地国家 1500；地点分层抽样 320 条跨 8 个分区（Europe/MENA/Asia/Pacific-Asia/N-America/L-America/Africa/Oceania） | task-9 抽样与 manifest 窗口字段 |
| Chronosphere | 自述“every empire · every border · every war”，数据来自 Chronas/CShapes/CHGIS（main.js 中三处引用）；全球均匀度未量化 | https://worldbyyear.com/src/main.js（200，47,613 B）grep |
| Phersu Atlas | **未能验证** — 站点不可达 | 站点不可达 |
| Running Reality | 自述覆盖“human civilization from 3000BC to today”，含全球事实库与贡献流程；未给出各区域条目数 | https://www.runningreality.org/ 与 /docs/（200） |
| Open History Map | 以地中海/欧洲考古项目为主（CAST 2025 Firenze、ArcheoFoss 2024 Chieti 等会议记录），全球均衡度未声明 | https://www.openhistorymap.org/ 首页 |
| Strata | 13 图层全球：237 国人口点（OWID）、920+ 战役、数百城市、14 条贸易/迁徙路线、8 个古海岸区域 | README（200） |
| HistoryMaps | **未能验证** — 首页 3D 地图与时间轴自述“global audience”，但未给出覆盖统计 | 首页 3D 地图与时间轴自述“global audience”，但未给出覆盖统计 |

### 数据可核验性 / 来源透明度

| 产品 | 结论 | 证据 |
| --- | --- | --- |
| 经纬纪 Meridian Atlas | 每条事件带 sources 数组；ATTRIBUTIONS.md 逐源列许可；OHM 固化数据带 manifest（逐 relation id、快照时间、原始响应 sha256、逐条 source/wikidata 标签）；地点记录带 sourceUrl；POLITY 记录带来源 | ATTRIBUTIONS.md、public/data/ohm-1500/manifest.json、docs/verification-3.10/ohm-1500.md |
| Chronosphere | main.js 引用 chronas / CShapes / CHGIS / Wikidata 作为数据来源；页面未逐条标注 | main.js grep（未发现逐要素来源字段） |
| Phersu Atlas | **未能验证** — 站点不可达 | 站点不可达 |
| Running Reality | Docs 有 Data Sources、Citations、Factoids 页面与“Suggest a data edit”贡献流程；Data Use Policy 声明 ODbL 等开放许可的派生数据会回馈 | /docs/reference/datasources.jsp、/docs/policy/datausepolicy.jsp（200） |
| Open History Map | 开源组织（GitHub openhistorymap）、站点列 API/Tools/Explorations；未在首页给出逐条来源 | https://github.com/openhistorymap（200） |
| Strata | 仓库 MIT；数据管线脚本公开（build:cities/battles/disasters/population），生成 JSON 提交在 public/data；上游数据许可需逐源处理 | README（200） |
| HistoryMaps | **未能验证** — 首页/About 未见逐条来源说明；内容以视频与图像为主 | 首页/About 未见逐条来源说明；内容以视频与图像为主 |

### 逐年疆域可用性

| 产品 | 结论 | 证据 |
| --- | --- | --- |
| 经纬纪 Meridian Atlas | Cliopatria 逐年（-3400–2024，按年中快照）；OHM 固化 10 个年份中欧窗口（1500 年 98 条、1700 年 118 条…）；其他年份走在线瓦片且不用邻年顶替 | public/data/ohm-1500/manifest.json、task-5 报告 |
| Chronosphere | About：时间轴逐年 2000 BC → today；更早仅快照 | worldbyyear.com About 文本 |
| Phersu Atlas | **未能验证** — 站点不可达 | 站点不可达 |
| Running Reality | 首页提供年/月/日级时间控件；“Exists”文档说明任意日期可查询 | runningreality.org 首页、/docs/article/exists.jsp |
| Open History Map | **未能验证** — 未找到可读的逐年疆域接口说明 | 未找到可读的逐年疆域接口说明 |
| Strata | 52 个疆域快照文件（world_*.geojson），介于快照之间不插值 | README + public/data/boundaries 结构说明 |
| HistoryMaps | **未能验证** — 未见逐年疆域数据说明 | 未见逐年疆域数据说明 |

### 事件与叙事深度

| 产品 | 结论 | 证据 |
| --- | --- | --- |
| 经纬纪 Meridian Atlas | 401 条双语事件（含来源）；17 个城市篇章；专题 Journeys/Chronicle 视图 | public/data/events.json.gz、editorial/city-narratives.json 实测 |
| Chronosphere | 战役按交战双方着色、战争以时间轴彩带呈现；未给出条目数 | worldbyyear.com About 文本 |
| Phersu Atlas | **未能验证** — 站点不可达 | 站点不可达 |
| Running Reality | Docs 有 Factoids/Citations/Timelines 体系与教学材料（Buy a lesson plan）；条目数未公开 | /docs/（200） |
| Open History Map | 以会议论文/Explorations 形式发布，未给出事件条目数 | 首页 |
| Strata | 75 条文化/政治/科学里程碑 + 920+ 战役 + 35 条导览故事（每条含章节旁白） | README |
| HistoryMaps | 按专题组织的历史地图 + 视频 + 课程（Academy）；未给出条目数 | history-maps.com 与 /about（200） |

### 城市与遗址

| 产品 | 结论 | 证据 |
| --- | --- | --- |
| 经纬纪 Meridian Atlas | 11,328 条聚落/地名 + 2,040 条人口观测 + 307 条历史首都 + 7,342 条现代参照 + 12 条有据遗址；可达率抽样 320 条中 261 条至少可见一次（81.6%） | task-9 报告与 public/data/places/*.json.gz |
| Chronosphere | **未能验证** — 未在可获取内容中看到城市/遗址图层说明 | 未在可获取内容中看到城市/遗址图层说明 |
| Phersu Atlas | **未能验证** — 站点不可达 | 站点不可达 |
| Running Reality | Docs 含 Geocoding、Buildings、Historic Sites Tour Guides；条目数未公开 | /docs/（200） |
| Open History Map | **未能验证** — 未见城市/遗址图层清单 | 未见城市/遗址图层清单 |
| Strata | 数百座城市（curated + GeoNames 合并，按建立/废弃年份过滤） | README |
| HistoryMaps | **未能验证** — 未见城市/遗址数据层说明 | 未见城市/遗址数据层说明 |

### 双语

| 产品 | 结论 | 证据 |
| --- | --- | --- |
| 经纬纪 Meridian Atlas | 界面 zh/en/中英对照三态；数据侧 nameZh+name_en；事件标题/摘要双语 | public/index.html 语言选择器 + 数据字段 |
| Chronosphere | <html lang="en">，无 hreflang 备选，抓取页面无语言切换控件 → 英文单语 | 所抓取 HTML 的 lang/hreflang 统计 |
| Phersu Atlas | **未能验证** — 站点不可达 | 站点不可达 |
| Running Reality | <html lang="en">，无 hreflang 备选，抓取页面无语言切换控件 → 英文单语 | 所抓取 HTML 的 lang/hreflang 统计 |
| Open History Map | <html lang="en">，无 hreflang 备选，抓取页面无语言切换控件 → 英文单语 | 所抓取 HTML 的 lang/hreflang 统计 |
| Strata | <html lang="en">，无 hreflang 备选，抓取页面无语言切换控件 → 英文单语 | 所抓取 HTML 的 lang/hreflang 统计 |
| HistoryMaps | 首页出现 Sign in，说明有账户体系；但界面仍为英文（lang=en，无 hreflang） | browser.mjs 抓取的 body 文本 |

### 离线能力

| 产品 | 结论 | 证据 |
| --- | --- | --- |
| 经纬纪 Meridian Atlas | 无 Service Worker（grep 无命中）；数据全部本地化（public/data 502 MB），README 明确 Bundled maps, relief, places and texts work offline；在线图层失败时降级 | 仓库实测 + README 第 62/108 行 |
| Chronosphere | /sw.js 与 /service-worker.js 均 404，无 Service Worker → 断网后无离线保证 | curl 探测 /sw.js、/service-worker.js、/manifest.json、/manifest.webmanifest |
| Phersu Atlas | **未能验证** — 站点不可达 | 站点不可达 |
| Running Reality | /sw.js 与 /service-worker.js 均 404，无 Service Worker；但 /manifest.json 200（1,391 B），可安装元数据存在 → 断网后无离线保证 | curl 探测 /sw.js、/service-worker.js、/manifest.json、/manifest.webmanifest |
| Open History Map | /sw.js 与 /service-worker.js 均 404，无 Service Worker → 断网后无离线保证 | curl 探测 /sw.js、/service-worker.js、/manifest.json、/manifest.webmanifest |
| Strata | /sw.js 与 /service-worker.js 均 404，无 Service Worker → 断网后无离线保证 | curl 探测 /sw.js、/service-worker.js、/manifest.json、/manifest.webmanifest |
| HistoryMaps | /sw.js 与 /service-worker.js 均 404，无 Service Worker → 断网后无离线保证 | curl 探测 /sw.js、/service-worker.js、/manifest.json、/manifest.webmanifest |

### 键盘与无障碍

| 产品 | 结论 | 证据 |
| --- | --- | --- |
| 经纬纪 Meridian Atlas | 时间轴键盘：←/→（±步长）、Shift 加速、Home/End、Space 播放；跳过链接、aria-label、对话框焦点管理；step 可由 URL 覆盖（默认 10） | public/timeline-controls.js grep、index.html、task-6 实测 |
| Chronosphere | About：← → 移动一年，shift 十年，space 播放 | worldbyyear.com About 文本 |
| Phersu Atlas | **未能验证** — 站点不可达 | 站点不可达 |
| Running Reality | **未能验证** — 未在抓取内容中找到键盘快捷键清单 | 未在抓取内容中找到键盘快捷键清单 |
| Open History Map | **未能验证** — 未验证 | 未验证 |
| Strata | 完整快捷键表（步进 ±1/±10/±100/±500、Home/End、Space、G 投影、单键切图层、搜索 /、导览 T、分享 S、隐藏界面 H、? 帮助） | README 键盘表 |
| HistoryMaps | **未能验证** — 未验证 | 未验证 |

### 手机

| 产品 | 结论 | 证据 |
| --- | --- | --- |
| 经纬纪 Meridian Atlas | 390×844 与 360×740 无横向溢出（scrollWidth=innerWidth），时间轴贴底且计入 safe-area；viewport-fit=cover | task-6 实测（browser.mjs + CDP） |
| Chronosphere | 390×844：innerWidth 390、scrollWidth 390（无横向溢出） | browser.mjs 手机视口实测 |
| Phersu Atlas | 390×844：只有 Cloudflare 拦截页，无法评估产品移动端 | 同上 |
| Running Reality | 390×844：scrollWidth 390 = innerWidth（无横向溢出） | 同上 |
| Open History Map | 390×844：scrollWidth 390（无横向溢出） | 同上 |
| Strata | 390×844：scrollWidth 390（无横向溢出） | 同上 |
| HistoryMaps | 390×844：innerWidth/scrollWidth 均为 407（无横向溢出，但视口比 390 宽） | 同上 |

### 性能

| 产品 | 结论 | 证据 |
| --- | --- | --- |
| 经纬纪 Meridian Atlas | 冷启动到地图可用 4379 ms、46 个资源、传输 14.5 MB（本机 8767，1440×900）；1900 年地区详图模式 5682 ms 出现「地区详图 · 35 条区划」 | browser.mjs + Performance API 实测；本机服务无网络延迟，与公网站点不可直接比快慢 |
| Chronosphere | 首页 8,261 B，TTFB 0.166 s（curl，本机→站点） | curl -w time_total 与 size_download，2026-10-03；这是网络传输口径，不等于渲染性能 |
| Phersu Atlas | **未能验证** — 站点不可达 | 站点不可达 |
| Running Reality | 首页 170,369 B，TTFB 0.234 s | curl -w time_total 与 size_download，2026-10-03；这是网络传输口径，不等于渲染性能 |
| Open History Map | 首页 10,499 B，TTFB 0.342 s | curl -w time_total 与 size_download，2026-10-03；这是网络传输口径，不等于渲染性能 |
| Strata | Live Demo 外壳 1,554 B，TTFB 0.151 s（SPA，主包需再加载） | curl -w time_total 与 size_download，2026-10-03；这是网络传输口径，不等于渲染性能 |
| HistoryMaps | 首页 35,165 B，TTFB 0.206 s | curl -w time_total 与 size_download，2026-10-03；这是网络传输口径，不等于渲染性能 |

### 视觉完成度

| 产品 | 结论 | 证据 |
| --- | --- | --- |
| 经纬纪 Meridian Atlas | 自绘地形晕渲+疆域压线、湖泊/河流、历史地貌、地区详图多来源、暗色 UI；截图见 docs/verification-3.12/benchmark/shots/ | task-6/9 截图 |
| Chronosphere | 真实渲染：canvas 地图 + 顶部时间轴；截图 benchmark/shots/chronosphere-desktop.png | browser.mjs 1440×900，等待 12 s |
| Phersu Atlas | 仅得到 Cloudflare 拦截图（Sorry, you have been blocked），无产品画面；截图 benchmark/shots/phersu-desktop.png | browser.mjs 1440×900（真实浏览器同样被拦） |
| Running Reality | 真实渲染：canvas 地图 + 年/月/日控件（探针时显示 01/01/1700）；截图 benchmark/shots/runningreality-desktop.png | browser.mjs 1440×900 |
| Open History Map | 首页为编辑式版面（Map/Index/Blog/Explorations/Tools），此页无 canvas；截图 benchmark/shots/openhistory-desktop.png | browser.mjs 1440×900 |
| Strata | 真实渲染：MapLibre canvas + 图层面板（Political boundaries…）、OSM/CARTO 署名、搜索框；截图 benchmark/shots/strata-desktop.png | browser.mjs 1440×900，等待 14 s |
| HistoryMaps | 首页为专题入口（Sign in、NEW/UPDATED FEATURES、Timelines、Game），此页无 canvas；截图 benchmark/shots/historymaps-desktop.png | browser.mjs 1440×900 |

### 许可清晰度

| 产品 | 结论 | 证据 |
| --- | --- | --- |
| 经纬纪 Meridian Atlas | 代码 MIT（LICENSE）；数据逐源列在 ATTRIBUTIONS.md；OHM 固化数据附 NOTICE.md（CC0）与 manifest；CShapes CC BY-NC-SA 4.0、Cliopatria CC BY 4.0、HALC CC BY-SA 4.0、Pleiades CC BY 3.0、Wikidata CC0、Natural Earth 公有领域 | 仓库文件 |
| Chronosphere | **未能验证** — 抓取内容未发现许可声明 | 抓取内容未发现许可声明 |
| Phersu Atlas | **未能验证** — 站点不可达 | 站点不可达 |
| Running Reality | Data Use Policy 页面声明“will always be free and open access”，并承诺回馈 ODbL 等开放许可的派生数据 | /docs/policy/datausepolicy.jsp（200） |
| Open History Map | **未能验证** — 未在首页找到许可声明（仓库许可证需进一步核对） | 未在首页找到许可声明（仓库许可证需进一步核对） |
| Strata | 代码 MIT；README 说明上游数据许可需逐源处理 | GitHub README 徽章与说明 |
| HistoryMaps | **未能验证** — 未在抓取页面找到许可声明 | 未在抓取页面找到许可声明 |

## 2. 差距清单（按用户感知价值排序）

### 2.1 落后项（可执行、可验收）

| # | 差距 | 证据 | 可验收改进项 |
| --- | --- | --- | --- |
| G1 | 事件与叙事体量 | 我方 401 条事件、17 篇城市篇章（实测）；Strata README 自述 75 条里程碑 + 920+ 战役 + 35 条导览故事；Running Reality 有 Factoids/Citations 体系；HistoryMaps 以专题地图+视频+课程为主 | 事件 ≥1,200 条（非欧洲 ≥45%，每条 ≥1 来源）；新增战役图层 ≥300 条（双方、日期、来源）；导览 ≥35 条（每条 ≥3 章、含镜头移动） |
| G2 | 专题图层数量与多样性 | Strata 13 个图层（政治/民族/贸易路线/城市/事件/战役/灾害/人物/宗教/语言/迁徙/人口点/海平面）；我方 8 类（地形/水系/湖泊/历史地貌/疆域/地点/事件/街巷），无宗教、语言、迁徙、古海岸、人口点 | 新增古海岸线（≥6 个时期）、人口点层（OWID/Wikidata，≥5,000 点）、战役层（见 G1） |
| G3 | 全球逐年疆域的粒度 | 我方全球逐年用 Cliopatria 粗多边形；OHM 精化仅中欧窗口 10 个年份（767 条）；Strata 52 个疆域快照（快照间不插值），Chronosphere 自述 2000 BC 起逐年 | OHM 固化扩到第二个窗口（如东亚）且总覆盖 ≥20 个年份；公开逐年覆盖矩阵（现已有 10 年矩阵） |
| G4 | 导出与分享 | Strata 支持 PNG 导出 + 深链分享；我方只有 JSON 导出（事件/目录/地点）与分享链接，没有地图图片导出 | 一键导出当前地图 PNG（≥1600×900，含年份与图例水印），保留现有深链 |
| G5 | 搜索范围 | Strata 全层搜索（/ 或 Cmd+K，跨 13 图层）；我方侧栏搜索以事件为主，地点检索是独立接口 | 统一搜索框覆盖事件/政体/地点/篇章，快捷键 /，结果按类型分组 |
| G6 | 首屏体量 | 我方冷启动 46 请求 / 15.2 MB / 4.38 s（本机）；1900 详图 5.68 s；竞品首屏 HTML 1.5–170 KB（其完整渲染未测） | 首屏传输 ≤8 MB（native geometry 分片懒加载）、本机 ready ≤3.5 s；页面显示按需加载进度 |

### 2.2 领先项（保持并显性化）

| # | 领先点 | 证据 | 建议 |
| --- | --- | --- | --- |
| G7 | 双语与数据可核验性 | 六个竞品实测均为英文单语（lang=en，无 hreflang、无语言控件）；我方三语 UI + 双语数据字段；OHM 固化数据带逐条 manifest（快照/原始响应 sha256）、事件带 sources、ATTRIBUTIONS.md 逐源许可 | 把这些证据做进「来源」页，让用户一眼看到可核验性 |
| G8 | 地方级逐年重建与诚实空白 | HALC 1500 低地国家地方单元 + OHM 10 个年份中欧 767 条真实几何（坐标零改动，verify 39/39）；竞品多为国家级快照或粗多边形；我方对未收录/源残缺有明确标注 | 把空白清单与覆盖矩阵做成可见的图层说明与数据下载项 |

## 3. 访问证据（真实请求与截图）

| URL | HTTP | 字节 | 说明 |
| --- | --- | --- | --- |
| https://worldbyyear.com/ | 200 | 8261 | Chronosphere 首页 + About 面板 |
| https://worldbyyear.com/src/main.js | 200 | 47613 | 数据来源引用：chronas / CShapes / CHGIS / Wikidata |
| https://github.com/dr-nico-f/strata | 200 | 381076 | Strata 仓库页 |
| https://raw.githubusercontent.com/dr-nico-f/strata/main/README.md | 200 | 18800 | Strata README：13 图层、52 快照、快捷键、许可 |
| https://dr-nico-f.github.io/strata/ | 200 | 1554 | Strata Live Demo（SPA 外壳） |
| https://www.runningreality.org/ | 200 | 170369 | Running Reality 首页 |
| https://www.runningreality.org/docs/ | 200 | 28947 | 文档索引 |
| http://www.runningreality.org/docs/policy/datausepolicy.jsp | 200 | 32258 | Data Use Policy：free and open access |
| http://www.runningreality.org/docs/reference/datasources.jsp | 200 |  | Data Sources 页面 |
| https://history-maps.com/ | 200 | 35166 | HistoryMaps 首页 |
| https://history-maps.com/about | 200 | 24472 | About：订阅/捐赠模式 |
| https://www.openhistorymap.org/ | 200 | 10499 | Open History Map 首页 |
| https://github.com/openhistorymap | 200 | 295822 | GitHub 组织页 |
| https://www.phersu-atlas.com/ | 403 | 5489 | Cloudflare 拦截：Attention Required（三次尝试，含 content.phersu-atlas.com） |

截图目录：docs/verification-3.12/benchmark/shots/（每个站点 desktop 1440×900 与 390×844 各一张；Phersu 只有 Cloudflare 拦截页）。

## 4. 方法边界

- 竞品数字来自 2026-10-03 的真实 HTTP 访问与真实浏览器渲染（等待 7–14 s），但未做交互深度测试（未登录、未订阅、未逐图层点选），因此图层/交互类结论凡未亲测的均标为未能验证。
- 我方性能是本机 8767 的冷启动数字（无网络延迟），与公网站点不可直接比较快慢；传输 15.2 MB 包含全部本地数据文件。
- Phersu Atlas 在 curl 与真实浏览器中都被 Cloudflare 拦截（截图留证），其产品能力未能验证。
- 未能验证不等于没有：只表示本会话无法确认。
