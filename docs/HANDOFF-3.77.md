# 交接记录 · v3.77.0

**当前基线**：`v3.77.0` · **验证报告**：[benchmarks-3.77](verification-3.77/final-benchmarks.json)

---

## 本轮核心成果

### 1. Pleiades `ref >= 14` 100% 中文覆证与波斯/丝路地标补全（Wave-12 · 累计 1,598 处）
- 在 [`public/places.js`](../public/places.js) 的 `PLACE_ZH_EDITORIAL` 扩展 **Wave-12 共 +161 处**权威双语地名（去重后累计 **`1,598` 处**），使全局 `Pleiades referenceCount >= 14` 的全部 `923` 处古今聚落达成 **100% 中文覆盖**（`remainingRef14PlusWithoutZh: 0`）。
- 本轮涵盖极具代表性的文明核心古城与遗址：**Çatalhöyük** *恰塔尔休于*、**Persepolis** *波斯波利斯（帕尔萨）*、**Marakanda** *马拉坎达（撒马尔罕）*、**Toletum** *托莱多（托莱图姆）*、**Tingi** *丹吉尔（廷吉）*、**Adouli** *阿杜利斯*、**Pantikapaion** *潘提卡彭（刻赤）*、**Borysthenes/Olbia** *奥尔比亚（黑海）*、**Kition** *基蒂翁（拉纳卡）*、**Perge** *佩尔格*、**Ticinum** *帕维亚（提基努姆）*、**Aquincum** *阿昆库姆（布达佩斯）*、**Col. Tarraco** *塔拉科（塔拉戈纳）*、**Artaxata** *阿塔沙特*、**Nisibis** *尼西比斯*、**Rotomagus** *鲁昂（罗托马古斯）*、**Bibracte** *比布拉克特*、**Iuvavum** *尤瓦乌姆（萨尔茨堡）*、**Cyzicus** *基齐库斯* 等 `145` 处 `ref === 14` 聚落。
- 同步补齐公元 1000 年波斯／丝路／阿拉伯／东非实境遗漏的 **16 处**中世聚落：**Rašt** *拉什特*、**Kāšān** *卡尚*、**Padakku/Fadak** *法达克*、**Ruins of Gedi** *格迪古城*、**Marāġe** *马拉盖*、**al-Ḥilla** *希拉（巴比伦近郊）*、**Surt** *苏尔特*、**Kars** *卡尔斯*、**Kermanshahan** *克尔曼沙汗* 等；实测 `1000 CE 波斯` 全屏 14 处可见地标 `noZhPlaces: []`（**100% 中文可读**），并在 [`scripts/validate-places.mjs`](../scripts/validate-places.mjs) 增补 12 项回归检验（全套 `23/23` 通过）。

### 2. 图层浮窗与帮助弹窗轻退交互体验升级
- 在 [`public/app.js`](../public/app.js) 为 `#layerPanel`（山川与人间图层控制浮窗）增加文档级点击外部区域自动收起（保持原目标焦点，不抢焦）以及全局 `Esc` 键关闭响应（同步维护 `aria-expanded` 与恢复触发按钮焦点）；为 `dialog#helpDialog` 增加点击暗色遮罩背景（`::backdrop`）即可关闭的原生模态交互习惯（实测 `layer_panel_and_help_dismissal` 五项断言全通过）。

---

## 全量验证与基准结果

| 校验项 | 结果 | 说明 |
|---|---|---|
| `npm run prepare:assets` | PASS | 生成 `dist` 资源预备与 270 原生 / 117 详图资产指纹 |
| `npm test` | PASS | 包含 `validate-places` **`23/23`**（含 Wave-12 新断言）、`validate-polity-display-names`、`map-catalog-app`（26/26）全数通过 |
| `npm run test:http` | PASS | **14/14** HTTP 内容协商、压缩与缓存验证通过 |
| `npm run build` | PASS | 生成完整 `dist/server/index.js` 与 `dist/client` 构建产物 |
| 无头 Chromium 全维度基准 | PASS | 13 路视口/网络冷启动 `0` 重叠、`0` 裁切、`consoleErrors: []`；`23` 项实境域检查全通过（检索缓存 **`2.6 ms`**，高卢 `100 CE`/中东 `750 CE`/波斯 `1000 CE`/非洲 `1960` 全部 `noZhPlaces: []`） |

> 注：`liveDomainChecks` 期间捕获的 2 条 HTTP 404 日志均源自高卢 `z=5` 边缘请求纯大西洋水域的 Mapterhorn 静态缺失瓦片，所有冷启动基线与本地资源请求 `consoleErrors: []`。
