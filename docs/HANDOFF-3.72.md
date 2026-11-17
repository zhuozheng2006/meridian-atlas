# 交接记录 · v3.72.0

**当前基线**：`v3.72.0` · **验证报告**：[benchmarks-3.72](verification-3.72/final-benchmarks.json)

---

## 本轮核心成果

### 1. 地名完备性与数据真实度（Wave-7 · 945 处编辑校订地名）
- **古典地名 `Pleiades ref >= 20` 100% 中文覆证**：在 [`public/places.js`](../public/places.js) 的 `PLACE_ZH_EDITORIAL` 增补 **104 处**权威译名（累计 **945 处**）：覆盖此前缺失的 **94 处** `Pleiades ref >= 20` 地中海与近东古典重镇（如 *Tiryns 梯林斯*、*Carchemish 卡赫美士*、*Amphipolis 安菲波利斯*、*Arretium 阿雷提乌姆（阿雷佐）*、*Surrentum 苏伦图姆（索伦托）*、*Col. Narbo Martius 纳尔博·马尔提乌斯（纳博讷）* 等），以及 **10 处**印度洋／南亚／东非贸易重镇（*Palibothra 华氏城（巴连弗邑）*、*Anurādhapura 阿努拉达普拉*、*Methora 马图拉*、*Ozene 乌贾因*、*Muziris 穆济里斯*、*Rhapta 拉普塔* 等）。
- **回归测试扩充**：[`scripts/validate-places.mjs`](../scripts/validate-places.mjs) 已纳入 Wave-7 代表城市校验（**23/23** 全数通过，全部非隔离 `urban-observations` 与全部 `Pleiades ref >= 20` 古城中文覆盖率均为 **100%**）。
- **结构化数据全量体检**：对 `historical-capitals.json.gz`（303 条活跃首都，已由 `CAPITAL_DATE_QUARANTINE` 4 条及 `CAPITAL_ZH_EDITORIAL` 15 条全覆盖）、`attested-places.json.gz`（17/17 有中文）、`battles.json.gz`（603/603 有中文）、`events.json.gz`（709/709 有 `title.zh`）执行极端纬度与坐标冲突核查，未发现新增离岸或错位坐标异常。

### 2. 制图交互与 UI 细节修复
- **地点档案卡片 `.place-stat`／`.place-facts` 样式冲突修复**：排查 [`public/cartography.css`](../public/cartography.css) 与 [`public/product.css`](../public/product.css) 层叠冲突，消除旧规则中 `padding: 22px 0` 覆盖卡片内边距导致大号人口数字贴近左侧金线圆角的视觉挤压，以及 `.place-facts` 末行多余底边框；现恢复 `22px` 水平内边距、内嵌金线（`inset 3px 0 0 var(--gold)`）与干净行分隔（经 1440×900 与 390×844 实机截图核验）。
- **战役浮窗悬停文本与球面地平线裁切修复**：[`public/battles.js`](../public/battles.js) 此前将数组字段 `battle.conflict`（空数组 `[]` 为真值）直接拼接为 `"公元 1492 年 · "` 尾随孤点且忽略 `conflictZh`；现修复为优先读取 `conflictZh` 并过滤空数组；同时为 [`public/battles.js`](../public/battles.js) 与 [`public/atrocities.js`](../public/atrocities.js) 补齐 `zoom < 4.5 && dot < 0.28` 球面地平线剔除与 CJK 字符精准宽度测算，与 [`public/places.js`](../public/places.js) 及 [`public/map-engine.js`](../public/map-engine.js) 保持一致。

### 3. 启动链路与渐进加载速度优化
- **首屏交互带宽去重**：从 [`public/entry.js`](../public/entry.js) 移除交互前对 `data/fast/events-index.json.gz`（40.6 KB）的抢占预取，并将 [`public/app.js`](../public/app.js) 中的 `ensureEventsData()` 调度延后至 `meridian:map-interactive` 打点之后（同时在异常回退路径保底触发，确保 [`scripts/validate-events-loading.mjs`](../scripts/validate-events-loading.mjs) 15/15 通过）。
  - 1.5 Mbps / 150 ms 节流实测（1492 桌面冷启动）：交互前传输量由 `~732 KB` 降至 **`645.7 KB`**，`eventsIndexReqs: 0`（不抢占地图脚本与疆域数据包带宽），`desktop_1492` 交互耗时 **`4020 ms`**（非节流 **`309 ms`**，`domInteractiveMs: 12 ms`）。
- **地点分层渐进渲染**：[`public/places.js`](../public/places.js) 的 `loadPlaces(includeModern, onPartial)` 在单轮并发请求中，一旦 `historical-capitals`、`urban-observations`、`attested-places`（合计约 220 KB gz）到达即刻触发首次标注，无需在慢速网络下苦等 `historical-settlements-index.json.gz`（630 KB gz）下载与解析完成才显示巴黎、伦敦、长安、开罗等核心城市。

---

## 全量验证与基准结果

| 校验项 | 结果 | 说明 |
|---|---|---|
| `npm run prepare:assets` | PASS | 270 份原生分包（12 份启动年份）与 117 份详情指纹生成完成 |
| `npm test` | PASS | 含 `validate-places` 23/23、`validate-events-loading` 15/15、`validate-map-catalog-app` 26/26 等全数通过 |
| `npm run test:http` | PASS | **14/14** HTTP 协商与压缩校验通过 |
| `npm run build` | PASS | 生成 `dist/server/index.js` 与 `dist/client`（377 静态存储 / 2551 数据分包） |
| 无头 Chromium 14 项领域实测 | PASS | `0` UI/标签/图钉碰撞、`0` 水平溢出；`.place-stat` 左/右内边距 `22px`；Wave-7 全部验证 |

> 说明：`final-benchmarks.json` 中捕获的 1 条浏览器层 404 日志（`https://tiles.mapterhorn.com/5/14/10.webp`）发生在巴黎 `z=5` 视角触及北大西洋纯海域瓦片时，系上游 Mapterhorn 静态高程服务按惯例省略纯海洋瓦片所致，应用层已静默容错，本地静态资源与 JS 运行 `0` 报错。

---

## 下一阶段推进方向

1. **CSS 首屏体积精简与视图懒加载**：审校 `style.css` 与 `product.css`、`cartography.css` 仍存在的历史覆盖规则冗余（当前首屏 3 份阻塞样式合计 ~26.8 KB gz），以及评估非高频模块按需拆分。
2. **中低缩放级超大帝国中心锚点可见性审计**：检查罗马帝国、大英帝国、蒙古帝国、清朝等跨洲政体在区域缩放（`z=4..5`）下，视口内虽全屏填充却因单一全局质心落在屏外导致 `polity-label` 缺失的场景优化。
3. **1914 近现代视图（CShapes 2.69 MB）切换响应与移动端档案细节微调**：持续优化近现代年份切换解析耗时及各屏幕比例排版精度。
